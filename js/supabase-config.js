/**
 * بيت المسك - إعدادات وتكوين Supabase (PostgreSQL & Auth)
 * Beit Al-Musk Supabase Configuration Layer
 */

const SupabaseConfig = {
  STORAGE_KEY: "beit_al_musk_supabase_credentials_v1",

  // الإعدادات الافتراضية المعتمدة لمتجر بيت المسك
  defaultConfig: {
    url: "https://txunqrvjcvziozulkegv.supabase.co",
    anonKey: "sb_publishable_X4cum6mHNaYrZjcevTkfWA_1F-YB1JV"
  },

  getConfig() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.url && parsed.anonKey) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Could not read Supabase config:", e);
    }
    return this.defaultConfig;
  },

  saveConfig(url, anonKey) {
    if (!url || !anonKey) {
      throw new Error("يرجى إدخال Supabase Project URL و Anon Public Key بشكل صحيح.");
    }

    let cleanUrl = String(url).trim();
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = "https://" + cleanUrl;
    }
    // Remove trailing slash
    cleanUrl = cleanUrl.replace(/\/+$/, "");

    const config = {
      url: cleanUrl,
      anonKey: String(anonKey).trim()
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    return config;
  },

  clearConfig() {
    localStorage.removeItem(this.STORAGE_KEY);
  },

  isConfigured() {
    const cfg = this.getConfig();
    return !!(cfg && cfg.url && cfg.anonKey && cfg.url.includes("supabase.co"));
  }
};

window.SupabaseConfig = SupabaseConfig;
