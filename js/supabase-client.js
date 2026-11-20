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

  async isAdmin() {
    if (!this.isReady()) return false;
    try {
      const { data, error } = await this.client.rpc('is_admin');
      if (error) return false;
      return !!data;
    } catch {
      return false;
    }
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

  // --- Orders & Checkout (Anti-Price-Tampering & Atomic Server Verification) ---
  async createOrder(orderPayload) {
    if (!this.isReady()) {
      return {
        success: false,
        error: "تعذر التحقق من صحة الأسعار مع خادم المتجر. خدمة السحابة Supabase غير متصلة. تم إلغاء العملية لحماية بيانات الطلب."
      };
    }

    try {
      const customer = orderPayload.customer;
      const items = orderPayload.items;
      const couponCode = orderPayload.totals?.promo?.code || orderPayload.couponCode || null;
      const paymentMethod = orderPayload.paymentMethodKey || orderPayload.paymentMethod || 'cod';
      const notes = orderPayload.customer?.notes || orderPayload.notes || null;

      // 1. Primary Secure Path: RPC create_verified_order (Atomic Server Calculation & Inventory Deduction)
      let verifiedOrder = null;
      let rpcError = null;

      try {
        const { data, error } = await this.client.rpc('create_verified_order', {
          p_customer: customer,
          p_items: items,
          p_coupon_code: couponCode,
          p_payment_method: paymentMethod,
          p_notes: notes
        });

        if (!error && data && data.success) {
          verifiedOrder = data;
        } else if (error) {
          rpcError = error;
          console.warn("RPC create_verified_order returned error:", error);
        }
      } catch (rpcEx) {
        rpcError = rpcEx;
        console.warn("RPC create_verified_order invocation error:", rpcEx);
      }

      // If create_verified_order succeeded:
      if (verifiedOrder) {
        const generatedNumber = verifiedOrder.order_number || verifiedOrder.orderId;
        orderPayload.orderId = generatedNumber;
        if (verifiedOrder.totals) {
          orderPayload.totals = verifiedOrder.totals;
        }

        // Cache locally only after verified server creation
        try {
          Storage.saveOrder(orderPayload);
        } catch (e) {
          console.warn("Storage saveOrder cache note:", e);
        }

        return {
          success: true,
          cloud: true,
          orderId: generatedNumber,
          dbId: verifiedOrder.dbId || verifiedOrder.id,
          verified: true,
          totals: verifiedOrder.totals
        };
      }

      // If create_verified_order failed due to validation/stock/coupon error, ABORT immediately!
      const isMissingRpc = rpcError && (
        (rpcError.message && (rpcError.message.includes("function") || rpcError.message.includes("does not exist") || rpcError.message.includes("schema cache"))) ||
        rpcError.code === "PGRST202" ||
        rpcError.code === "42883"
      );

      if (rpcError && !isMissingRpc) {
        console.error("Order rejected by create_verified_order:", rpcError);
        return {
          success: false,
          error: rpcError.message || "تعذر التحقق من صحة الأسعار مع خادم المتجر. تم إلغاء العملية لحماية بيانات الطلب."
        };
      }

      // 2. Fallback Path: If create_verified_order is not available, call calculate_secure_order
      let secureTotals = null;
      let verifiedItems = items;

      const { data: calcResult, error: calcErr } = await this.client.rpc('calculate_secure_order', {
        p_items: items,
        p_coupon_code: couponCode
      });

      // CRITICAL SECURITY RULE: If server calculation fails, ABORT the order!
      if (calcErr || !calcResult) {
        console.error("calculate_secure_order error:", calcErr);
        return {
          success: false,
          error: calcErr?.message || "تعذر التحقق من صحة الأسعار مع خادم المتجر. تم إلغاء العملية لحماية بيانات الطلب."
        };
      }

      secureTotals = {
        subtotal: calcResult.subtotal,
        delivery: calcResult.delivery,
        discount: calcResult.discount,
        grandTotal: calcResult.grandTotal
      };
      if (calcResult.items) {
        verifiedItems = calcResult.items;
      }

      // NEVER insert client-calculated totals if server check fails!
      const orderRecord = {
        customer: customer,
        items: verifiedItems,
        totals: secureTotals,
        payment_method: paymentMethod,
        order_status: 'new',
        payment_status: 'pending'
      };

      const { data: insertData, error: insertError } = await this.client
        .from('orders')
        .insert(orderRecord)
        .select('order_number, id')
        .single();

      if (insertError) {
        console.error("Orders table insertion error:", insertError);
        return {
          success: false,
          error: insertError.message || "فشل قيد الطلب في قاعدة البيانات السحابية."
        };
      }

      const generatedNumber = insertData?.order_number || orderPayload.orderId;
      orderPayload.orderId = generatedNumber;
      orderPayload.totals = secureTotals;

      // Cache locally only after verified server insertion
      try {
        Storage.saveOrder(orderPayload);
      } catch (e) {
        console.warn("Storage saveOrder cache note:", e);
      }

      return {
        success: true,
        cloud: true,
        orderId: generatedNumber,
        dbId: insertData?.id,
        verified: true,
        totals: secureTotals
      };

    } catch (err) {
      console.error("Supabase createOrder fatal error:", err);
      return {
        success: false,
        error: err.message || "تعذر التحقق من صحة الأسعار مع خادم المتجر. تم إلغاء العملية لحماية بيانات الطلب."
      };
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

  // --- Coupons & Discount Codes Management (Fixed EGP) ---
  async fetchCoupons() {
    if (!this.isReady()) {
      const settings = Storage.getSettings();
      return Object.values(settings.promos || {});
    }

    try {
      const { data, error } = await this.client
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (Array.isArray(data)) {
        const settings = Storage.getSettings();
        settings.promos = settings.promos || {};
        data.forEach(c => {
          settings.promos[c.code] = {
            id: c.id,
            code: c.code,
            type: c.discount_type || 'fixed',
            value: Number(c.discount_value) || 0,
            min_order_amount: Number(c.min_order_amount) || 0,
            is_active: c.is_active !== false,
            label: `خصم ${c.discount_value} ج.م (${c.code})`,
            created_at: c.created_at
          };
        });
        Storage.saveSettings(settings);
      }
      return data || [];
    } catch (err) {
      console.warn("fetchCoupons note:", err.message);
      const settings = Storage.getSettings();
      return Object.values(settings.promos || {});
    }
  },

  async saveCoupon(coupon) {
    const cleanCode = (coupon.code || "").trim().toUpperCase();
    const value = Math.max(1, Number(coupon.discount_value || coupon.value) || 50);
    const minOrder = Math.max(0, Number(coupon.min_order_amount) || 0);
    const isActive = coupon.is_active !== false;
    const label = coupon.label || `خصم ${value} ج.م (${cleanCode})`;

    // 1. Save locally first for instant reactivity
    Storage.savePromo(cleanCode, {
      code: cleanCode,
      type: 'fixed',
      value: value,
      min_order_amount: minOrder,
      is_active: isActive,
      label: label
    });

    if (!this.isReady()) {
      return { success: true, cloud: false };
    }

    try {
      const payload = {
        code: cleanCode,
        discount_type: 'fixed',
        discount_value: value,
        min_order_amount: minOrder,
        is_active: isActive
      };

      const { data, error } = await this.client
        .from('coupons')
        .upsert(payload, { onConflict: 'code' })
        .select()
        .single();

      if (error) throw error;
      return { success: true, cloud: true, data };
    } catch (err) {
      console.warn("saveCoupon cloud error:", err.message);
      return { success: true, cloud: false, error: err.message };
    }
  },

  async deleteCoupon(code) {
    const cleanCode = (code || "").trim().toUpperCase();
    Storage.deletePromo(cleanCode);

    if (!this.isReady()) {
      return { success: true, cloud: false };
    }

    try {
      const { error } = await this.client
        .from('coupons')
        .delete()
        .eq('code', cleanCode);

      if (error) throw error;
      return { success: true, cloud: true };
    } catch (err) {
      console.warn("deleteCoupon cloud error:", err.message);
      return { success: true, cloud: false, error: err.message };
    }
  },

  async toggleCouponStatus(code, isActive) {
    const cleanCode = (code || "").trim().toUpperCase();
    const settings = Storage.getSettings();
    if (settings.promos && settings.promos[cleanCode]) {
      settings.promos[cleanCode].is_active = !!isActive;
      Storage.saveSettings(settings);
    }

    if (!this.isReady()) {
      return { success: true, cloud: false };
    }

    try {
      const { error } = await this.client
        .from('coupons')
        .update({ is_active: !!isActive })
        .eq('code', cleanCode);

      if (error) throw error;
      return { success: true, cloud: true };
    } catch (err) {
      console.warn("toggleCouponStatus cloud error:", err.message);
      return { success: true, cloud: false };
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
