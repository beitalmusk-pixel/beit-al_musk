/**
 * بيت المسك - طبقة الاتصال بقاعدة بيانات وخدمات Supabase السحابية
 * Beit Al-Musk Supabase Client & Database Services
 */

const SupabaseDB = {
  client: null,
  isInitialized: false,
  currentUser: null,

  async init() {
    if (this.isInitialized && this.client) return true;

    if (typeof supabase === "undefined" || !supabase.createClient) {
      console.warn("Supabase SDK is not loaded. Operating in local storage mode.");
      return false;
    }

    const config = window.SupabaseConfig ? window.SupabaseConfig.getConfig() : null;
    if (!config || !config.url || !config.anonKey) {
      console.log("Supabase is not configured yet. Using localStorage mode.");
      return false;
    }

    try {
      this.client = supabase.createClient(config.url, config.anonKey);
      this.isInitialized = true;
      console.log("⚡ Beit Al-Musk connected to Supabase PostgreSQL successfully!");

      // Check active auth session
      const { data: { session } } = await this.client.auth.getSession();
      this.currentUser = session?.user || null;

      // Listen for auth state changes
      this.client.auth.onAuthStateChange((_event, session) => {
        this.currentUser = session?.user || null;
      });

      // Ensure initial seed if table is empty
      await this.ensureInitialSeed();

      return true;
    } catch (err) {
      console.error("Failed to initialize Supabase:", err);
      this.isInitialized = false;
      return false;
    }
  },

  isReady() {
    return this.isInitialized && this.client !== null;
  },

  // --- Auth Services (Real Email & Password) ---
  async login(email, password) {
    if (!this.isReady()) {
      throw new Error("يرجى تهيئة إعدادات Supabase أولاً للتمكن من تسجيل الدخول.");
    }
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });
    if (error) throw error;
    this.currentUser = data.user;
    return data;
  },

  async logout() {
    if (!this.isReady()) return;
    const { error } = await this.client.auth.signOut();
    this.currentUser = null;
    if (error) console.warn("Logout note:", error);
  },

  async getSession() {
    if (!this.isReady()) return null;
    const { data: { session } } = await this.client.auth.getSession();
    return session;
  },

  // --- Perfumes & Catalog (Real-time Cloud Sync) ---
  async fetchPerfumes() {
    if (!this.isReady()) {
      return Storage.getProducts();
    }

    try {
      const { data, error } = await this.client
        .from('perfumes')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        await this.ensureInitialSeed();
        return Storage.getProducts();
      }

      // Format from snake_case to match internal app schema
      const formatted = data.map(p => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        subtitle: p.subtitle,
        category: p.category,
        gender: p.gender,
        podium: p.podium,
        podiumTitle: p.podium_title,
        concentration: p.concentration,
        stock: p.stock,
        defaultSize: p.default_size,
        sizes: p.sizes,
        notes: p.notes,
        description: p.description,
        story: p.story,
        visual: p.visual,
        image: p.image
      }));

      // Cache locally for instant offline rendering
      Storage.saveProducts(formatted);
      return formatted;
    } catch (err) {
      console.error("Supabase fetchPerfumes error:", err);
      return Storage.getProducts();
    }
  },

  async savePerfume(perfume) {
    // 1. Save to local storage for instant UI responsiveness
    Storage.saveProduct(perfume);

    if (!this.isReady()) {
      return { success: true, cloud: false };
    }

    try {
      const record = {
        id: perfume.id,
        name: perfume.name,
        brand: perfume.brand || 'بيت المسك • BEIT AL-MUSK',
        subtitle: perfume.subtitle || 'Extrait de Parfum',
        category: perfume.category || 'عطور ملكية',
        gender: perfume.gender || 'للجنسين',
        podium: perfume.podium || 'men',
        podium_title: perfume.podiumTitle || (perfume.podium === 'women' ? '🌸 جناح العطور النسائية' : '👑 جناح العطور الرجالية'),
        concentration: perfume.concentration || '34% تركيز نقي',
        stock: parseInt(perfume.stock || 15),
        default_size: perfume.defaultSize || '50ml',
        sizes: perfume.sizes,
        notes: perfume.notes,
        description: perfume.description,
        story: perfume.story || perfume.description,
        visual: perfume.visual,
        image: perfume.image || 'assets/logo.jpg',
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.client
        .from('perfumes')
        .upsert(record);

      if (error) throw error;
      return { success: true, cloud: true, data };
    } catch (err) {
      console.error("Supabase savePerfume error:", err);
      return { success: true, cloud: false, error: err.message };
    }
  },

  async deletePerfume(productId) {
    Storage.deleteProduct(productId);

    if (!this.isReady()) {
      return { success: true, cloud: false };
    }

    try {
      const { error } = await this.client
        .from('perfumes')
        .delete()
        .eq('id', productId);

      if (error) throw error;
      return { success: true, cloud: true };
    } catch (err) {
      console.error("Supabase deletePerfume error:", err);
      return { success: true, cloud: false, error: err.message };
    }
  },

  // --- Orders & Checkout (Server Sequence & Inventory Deduction) ---
  async createOrder(orderPayload) {
    // 1. Local backup
    Storage.saveOrder(orderPayload);

    if (!this.isReady()) {
      return { success: true, cloud: false, orderId: orderPayload.orderId };
    }

    try {
      // If server calculation function exists, calculate securely
      let secureTotals = orderPayload.totals;
      try {
        const { data: calcResult, error: calcErr } = await this.client
          .rpc('calculate_secure_order', {
            p_items: orderPayload.items,
            p_coupon_code: orderPayload.totals?.promo?.code || null
          });
        if (!calcErr && calcResult) {
          secureTotals = {
            subtotal: calcResult.subtotal,
            delivery: calcResult.delivery,
            discount: calcResult.discount,
            grandTotal: calcResult.grandTotal
          };
        }
      } catch (calcE) {
        console.warn("RPC calculate_secure_order fallback:", calcE);
      }

      const orderRecord = {
        customer: orderPayload.customer,
        items: orderPayload.items,
        totals: secureTotals,
        payment_method: orderPayload.paymentMethodKey || orderPayload.paymentMethod,
        order_status: 'new',
        payment_status: 'pending'
      };

      const { data, error } = await this.client
        .from('orders')
        .insert(orderRecord)
        .select('order_number, id')
        .single();

      if (error) throw error;

      const generatedNumber = data?.order_number || orderPayload.orderId;
      orderPayload.orderId = generatedNumber;

      return {
        success: true,
        cloud: true,
        orderId: generatedNumber,
        dbId: data?.id
      };
    } catch (err) {
      console.error("Supabase createOrder error:", err);
      return { success: true, cloud: false, orderId: orderPayload.orderId, error: err.message };
    }
  },

  async fetchOrders() {
    if (!this.isReady()) {
      return Storage.getOrders();
    }

    try {
      const { data, error } = await this.client
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map(o => ({
        orderId: o.order_number,
        dbId: o.id,
        customer: o.customer,
        items: o.items,
        totals: o.totals,
        paymentMethod: o.payment_method === 'cod' ? 'عند الاستلام (نقداً)' : (o.payment_method === 'vodafone_cash' ? 'فودافون كاش' : 'إنستا باي (InstaPay)'),
        paymentMethodKey: o.payment_method,
        status: o.order_status,
        formattedDate: new Date(o.created_at).toLocaleString('ar-EG'),
        createdAt: o.created_at
      }));

      return formatted;
    } catch (err) {
      console.error("Supabase fetchOrders error:", err);
      return Storage.getOrders();
    }
  },

  async updateOrderStatus(orderNumber, newStatus) {
    if (!this.isReady()) {
      const orders = Storage.getOrders();
      const ord = orders.find(o => o.orderId === orderNumber);
      if (ord) ord.status = newStatus;
      localStorage.setItem("beit_al_musk_orders_v3", JSON.stringify(orders));
      return { success: true, cloud: false };
    }

    try {
      const { error } = await this.client
        .from('orders')
        .update({ order_status: newStatus, updated_at: new Date().toISOString() })
        .eq('order_number', orderNumber);

      if (error) throw error;
      return { success: true, cloud: true };
    } catch (err) {
      console.error("Supabase updateOrderStatus error:", err);
      return { success: false, error: err.message };
    }
  },

  // --- Store Settings ---
  async fetchSettings() {
    if (!this.isReady()) {
      return Storage.getSettings();
    }

    try {
      const { data, error } = await this.client
        .from('settings')
        .select('value')
        .eq('key', 'store_config')
        .single();

      if (error || !data) return Storage.getSettings();

      const merged = { ...Storage.getSettings(), ...data.value };
      Storage.saveSettings(merged);
      return merged;
    } catch (err) {
      console.error("Supabase fetchSettings error:", err);
      return Storage.getSettings();
    }
  },

  async saveSettings(settings) {
    Storage.saveSettings(settings);

    if (!this.isReady()) {
      return { success: true, cloud: false };
    }

    try {
      const { error } = await this.client
        .from('settings')
        .upsert({
          key: 'store_config',
          value: settings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      return { success: true, cloud: true };
    } catch (err) {
      console.error("Supabase saveSettings error:", err);
      return { success: true, cloud: false, error: err.message };
    }
  },

  // --- Real-Time Order & Catalog Subscriptions ---
  subscribeToOrders(callback) {
    if (!this.isReady()) return () => {};

    const channel = this.client
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
        const orders = await this.fetchOrders();
        callback(orders);
      })
      .subscribe();

    return () => {
      this.client.removeChannel(channel);
    };
  },

  subscribeToPerfumes(callback) {
    if (!this.isReady()) return () => {};

    const channel = this.client
      .channel('public:perfumes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfumes' }, async () => {
        const perfumes = await this.fetchPerfumes();
        callback(perfumes);
      })
      .subscribe();

    return () => {
      this.client.removeChannel(channel);
    };
  },

  // --- Seed Initial Catalog to Supabase ---
  async ensureInitialSeed() {
    if (!this.isReady()) return;

    try {
      const { count, error } = await this.client
        .from('perfumes')
        .select('*', { count: 'exact', head: true });

      if (error) return;

      if (count === 0) {
        console.log("⚡ Seeding initial Beit Al-Musk catalog to Supabase PostgreSQL...");
        const defaultList = window.DEFAULT_PRODUCTS || Storage.getProducts();

        const records = defaultList.map(prod => ({
          id: prod.id,
          name: prod.name,
          brand: prod.brand || 'بيت المسك • BEIT AL-MUSK',
          subtitle: prod.subtitle || 'Extrait de Parfum',
          category: prod.category || 'عطور ملكية',
          gender: prod.gender || 'للجنسين',
          podium: prod.podium || 'men',
          podium_title: prod.podiumTitle || (prod.podium === 'women' ? '🌸 جناح العطور النسائية' : '👑 جناح العطور الرجالية'),
          concentration: prod.concentration || '34% تركيز نقي',
          stock: parseInt(prod.stock || 15),
          default_size: prod.defaultSize || '50ml',
          sizes: prod.sizes,
          notes: prod.notes,
          description: prod.description,
          story: prod.story || prod.description,
          visual: prod.visual,
          image: prod.image || 'assets/logo.jpg'
        }));

        await this.client.from('perfumes').insert(records);
        console.log("⚡ Catalog seeded to Supabase successfully!");
      }
    } catch (e) {
      console.warn("ensureInitialSeed note:", e);
    }
  }
};

window.SupabaseDB = SupabaseDB;
