/**
 * بيت المسك - إعدادات وتكوين الربط السحابي مع Google Firebase
 * Beit Al-Musk Cloud Sync Configuration
 */

const FirebaseConfig = {
  STORAGE_KEY: "beit_al_musk_firebase_config_v1",

  // الإعدادات الافتراضية المدمجة (يمكن للأدمن تحديثها من لوحة التحكم أو تركها فارغة للتهيئة)
  defaultConfig: null,

  getConfig() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.apiKey && parsed.projectId) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Could not parse saved Firebase config:", e);
    }
    return this.defaultConfig;
  },

  saveConfig(configObj) {
    if (!configObj || !configObj.apiKey || !configObj.projectId) {
      throw new Error("بيانات إعدادات Firebase غير مكتملة، يجب توفير apiKey و projectId على الأقل.");
    }
    const cleanConfig = {
      apiKey: String(configObj.apiKey).trim(),
      authDomain: String(configObj.authDomain || `${configObj.projectId}.firebaseapp.com`).trim(),
      projectId: String(configObj.projectId).trim(),
      storageBucket: String(configObj.storageBucket || `${configObj.projectId}.appspot.com`).trim(),
      messagingSenderId: String(configObj.messagingSenderId || "").trim(),
      appId: String(configObj.appId || "").trim()
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cleanConfig));
    return cleanConfig;
  },

  clearConfig() {
    localStorage.removeItem(this.STORAGE_KEY);
  },

  isConfigured() {
    const cfg = this.getConfig();
    return !!(cfg && cfg.apiKey && cfg.projectId);
  }
};

window.FirebaseConfig = FirebaseConfig;
