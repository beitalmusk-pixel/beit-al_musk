/**
 * بيت المسك - واجهة التعامل مع قاعدة البيانات السحابية (Google Firebase Cloud Firestore)
 * Beit Al-Musk Cloud Database & Real-Time Sync Layer
 */

const CloudDB = {
  db: null,
  auth: null,
  isInitialized: false,
  isSyncing: false,

  COLLECTIONS: {
    PRODUCTS: "beitalmusk_products",
    SETTINGS: "beitalmusk_settings",
    ORDERS: "beitalmusk_orders"
  },

  async init() {
    if (this.isInitialized && this.db) return true;

    if (typeof firebase === "undefined") {
      console.warn("Firebase SDK is not loaded. Operating in local mode.");
      return false;
    }

    const config = window.FirebaseConfig ? window.FirebaseConfig.getConfig() : null;
    if (!config || !config.apiKey || !config.projectId) {
      console.log("Firebase is not configured yet. Using localStorage mode.");
      return false;
    }

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }
      this.db = firebase.firestore();
      this.auth = firebase.auth();
      this.isInitialized = true;
      console.log("☁️ Beit Al-Musk Cloud Database connected successfully!");

      // Seed default products if cloud collection is brand new and empty
      await this.ensureInitialSeed();

      return true;
    } catch (err) {
      console.error("Failed to initialize Firebase CloudDB:", err);
      this.isInitialized = false;
      return false;
    }
  },

  isCloudActive() {
    return this.isInitialized && this.db !== null;
  },

  // --- Products Management (Cloud Sync) ---
  async fetchProducts() {
    if (!this.isCloudActive()) {
      return Storage.getProducts();
    }

    try {
      const snapshot = await this.db.collection(this.COLLECTIONS.PRODUCTS).get();
      if (snapshot.empty) {
        // Fallback to local and seed
        await this.ensureInitialSeed();
        return Storage.getProducts();
      }

      const products = [];
      snapshot.forEach(doc => {
        products.push({ id: doc.id, ...doc.data() });
      });

      // Cache locally in localStorage for fast offline rendering
      Storage.saveProducts(products);
      return products;
    } catch (err) {
      console.error("CloudDB.fetchProducts error:", err);
      return Storage.getProducts();
    }
  },

  async saveProduct(product) {
    // Save to local storage first
    Storage.saveProduct(product);

    if (!this.isCloudActive()) {
      return { success: true, cloud: false };
    }

    try {
      const docRef = this.db.collection(this.COLLECTIONS.PRODUCTS).doc(product.id);
      await docRef.set({
        ...product,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return { success: true, cloud: true };
    } catch (err) {
      console.error("CloudDB.saveProduct error:", err);
      return { success: true, cloud: false, error: err.message };
    }
  },

  async deleteProduct(productId) {
    Storage.deleteProduct(productId);

    if (!this.isCloudActive()) {
      return { success: true, cloud: false };
    }

    try {
      await this.db.collection(this.COLLECTIONS.PRODUCTS).doc(productId).delete();
      return { success: true, cloud: true };
    } catch (err) {
      console.error("CloudDB.deleteProduct error:", err);
      return { success: true, cloud: false, error: err.message };
    }
  },

  // --- Store Settings & Payment Info ---
  async fetchSettings() {
    if (!this.isCloudActive()) {
      return Storage.getSettings();
    }

    try {
      const doc = await this.db.collection(this.COLLECTIONS.SETTINGS).doc("store_config").get();
      if (doc.exists) {
        const cloudSettings = doc.data();
        const merged = { ...Storage.getSettings(), ...cloudSettings };
        Storage.saveSettings(merged);
        return merged;
      } else {
        // Seed initial settings
        const initial = Storage.getSettings();
        await this.db.collection(this.COLLECTIONS.SETTINGS).doc("store_config").set({
          ...initial,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return initial;
      }
    } catch (err) {
      console.error("CloudDB.fetchSettings error:", err);
      return Storage.getSettings();
    }
  },

  async saveSettings(settings) {
    Storage.saveSettings(settings);

    if (!this.isCloudActive()) {
      return { success: true, cloud: false };
    }

    try {
      await this.db.collection(this.COLLECTIONS.SETTINGS).doc("store_config").set({
        ...settings,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return { success: true, cloud: true };
    } catch (err) {
      console.error("CloudDB.saveSettings error:", err);
      return { success: true, cloud: false, error: err.message };
    }
  },

  // --- Real-Time Orders Management ---
  async submitOrder(orderData) {
    // 1. Save to local history
    Storage.saveOrder(orderData);

    if (!this.isCloudActive()) {
      return { success: true, cloud: false, orderId: orderData.orderId };
    }

    try {
      const orderRef = this.db.collection(this.COLLECTIONS.ORDERS).doc(orderData.orderId);
      await orderRef.set({
        ...orderData,
        status: "new", // "new" | "processing" | "shipped" | "completed" | "cancelled"
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { success: true, cloud: true, orderId: orderData.orderId };
    } catch (err) {
      console.error("CloudDB.submitOrder error:", err);
      return { success: true, cloud: false, orderId: orderData.orderId, error: err.message };
    }
  },

  async fetchOrders() {
    if (!this.isCloudActive()) {
      return Storage.getOrders();
    }

    try {
      const snapshot = await this.db.collection(this.COLLECTIONS.ORDERS)
        .orderBy("createdAt", "desc")
        .get();

      const orders = [];
      snapshot.forEach(doc => {
        orders.push({ id: doc.id, ...doc.data() });
      });

      return orders;
    } catch (err) {
      console.error("CloudDB.fetchOrders error:", err);
      return Storage.getOrders();
    }
  },

  async updateOrderStatus(orderId, newStatus) {
    if (!this.isCloudActive()) {
      // Update locally
      const orders = Storage.getOrders();
      const ord = orders.find(o => o.orderId === orderId);
      if (ord) {
        ord.status = newStatus;
        localStorage.setItem("beit_al_musk_orders_v3", JSON.stringify(orders));
      }
      return { success: true, cloud: false };
    }

    try {
      await this.db.collection(this.COLLECTIONS.ORDERS).doc(orderId).update({
        status: newStatus,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { success: true, cloud: true };
    } catch (err) {
      console.error("CloudDB.updateOrderStatus error:", err);
      return { success: false, error: err.message };
    }
  },

  listenToOrders(callback) {
    if (!this.isCloudActive()) {
      callback(Storage.getOrders());
      return () => {};
    }

    return this.db.collection(this.COLLECTIONS.ORDERS)
      .orderBy("createdAt", "desc")
      .onSnapshot(snapshot => {
        const orders = [];
        snapshot.forEach(doc => {
          orders.push({ id: doc.id, ...doc.data() });
        });
        callback(orders);
      }, err => {
        console.error("listenToOrders snapshot error:", err);
      });
  },

  listenToProducts(callback) {
    if (!this.isCloudActive()) {
      callback(Storage.getProducts());
      return () => {};
    }

    return this.db.collection(this.COLLECTIONS.PRODUCTS)
      .onSnapshot(snapshot => {
        const products = [];
        snapshot.forEach(doc => {
          products.push({ id: doc.id, ...doc.data() });
        });
        Storage.saveProducts(products);
        callback(products);
      }, err => {
        console.error("listenToProducts snapshot error:", err);
      });
  },

  // --- Auto-Seed Initial Products ---
  async ensureInitialSeed() {
    if (!this.isCloudActive() || this.isSyncing) return;

    try {
      this.isSyncing = true;
      const snapshot = await this.db.collection(this.COLLECTIONS.PRODUCTS).limit(1).get();
      if (snapshot.empty) {
        console.log("Seeding initial Beit Al-Musk catalog to Cloud Firestore...");
        const defaultList = window.DEFAULT_PRODUCTS || Storage.getProducts();
        const batch = this.db.batch();

        defaultList.forEach(prod => {
          const docRef = this.db.collection(this.COLLECTIONS.PRODUCTS).doc(prod.id);
          batch.set(docRef, {
            ...prod,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });

        // Seed initial store settings
        const settingsRef = this.db.collection(this.COLLECTIONS.SETTINGS).doc("store_config");
        batch.set(settingsRef, {
          ...Storage.getSettings(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        console.log("Initial catalog and store settings seeded to Cloud successfully!");
      }
    } catch (err) {
      console.warn("ensureInitialSeed note:", err);
    } finally {
      this.isSyncing = false;
    }
  }
};

window.CloudDB = CloudDB;
