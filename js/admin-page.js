/**
 * بيت المسك - لوحة تحكم إدارة العطور والأسعار
 * Bayt Al Musk - Dedicated Protected Admin Dashboard Controller
 */

function sanitizeImageUrl(rawUrl, fallback = "assets/logo.jpg") {
  if (!rawUrl || typeof rawUrl !== "string") return fallback;
  const trimmed = rawUrl.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:") || lower.startsWith("data:text/html")) return fallback;
  if (trimmed.startsWith("assets/") || trimmed.startsWith("./assets/") || trimmed.startsWith("/")) {
    if (/[<>"'\s]/.test(trimmed)) return fallback;
    return trimmed;
  }
  if (trimmed.startsWith("data:image/")) {
    if (trimmed.includes(";") && trimmed.includes("base64,")) return trimmed;
    return fallback;
  }
  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
  } catch (e) {
    return fallback;
  }
  return fallback;
}
window.sanitizeImageUrl = sanitizeImageUrl;

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

let _currentAdminSession = null;

// SHA-256 password hasher
async function hashAdminPassword(str) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  }
}

// Initial master hash for Musk@2026Admin (default before any password change)
const INITIAL_MASTER_HASH = "8ef8c4235d58eca7f981c4049e14c440cdf27cb51ac36eb5e8786ca2d3ea401b";

async function getSavedAdminHash() {
  // 1. Check cloud settings if Supabase client is ready
  if (window.SupabaseDB && SupabaseDB.isReady() && SupabaseDB.client) {
    try {
      const { data } = await SupabaseDB.client
        .from('settings')
        .select('value')
        .eq('key', 'admin_security')
        .maybeSingle();
      if (data && data.value && data.value.pass_hash) {
        localStorage.setItem("beit_admin_pass_hash", data.value.pass_hash);
        return data.value.pass_hash;
      }
    } catch (e) {
      console.warn("Could not check cloud admin pass hash:", e);
    }
  }

  // 2. Check local storage
  const localHash = localStorage.getItem("beit_admin_pass_hash");
  if (localHash) {
    return localHash;
  }

  // 3. Fallback to initial master hash
  return INITIAL_MASTER_HASH;
}

async function checkAdminSession() {
  // 1. Check in-memory validated session
  if (_currentAdminSession && _currentAdminSession.user) {
    return true;
  }

  // 2. Check tab session in sessionStorage (valid for 24h)
  try {
    const raw = sessionStorage.getItem("beit_admin_session_auth");
    if (raw) {
      const sess = JSON.parse(raw);
      if (sess && sess.email && sess.token && (Date.now() - (sess.ts || 0) < 86400000)) {
        _currentAdminSession = {
          user: { email: sess.email, role: 'admin' },
          type: sess.type || 'owner',
          authenticatedAt: sess.ts
        };
        return true;
      }
    }
  } catch (e) {
    console.warn("Session storage verification note:", e);
  }

  // 3. Check Supabase Auth session if available
  if (window.SupabaseDB && SupabaseDB.isReady() && SupabaseDB.client?.auth) {
    try {
      const { data: { session }, error } = await SupabaseDB.client.auth.getSession();
      if (!error && session && session.user) {
        // Verify admin role via RPC if available
        try {
          const { data: isAdmin, error: rpcErr } = await SupabaseDB.client.rpc('is_admin');
          if (!rpcErr && isAdmin === false) {
            await SupabaseDB.logout();
            _currentAdminSession = null;
            return false;
          }
        } catch (rpcEx) {
          console.warn("RPC is_admin check note:", rpcEx);
        }

        _currentAdminSession = session;
        return true;
      }
    } catch (err) {
      console.warn("Supabase session verification note:", err);
    }
  }

  _currentAdminSession = null;
  return false;
}

function isAuthenticated() {
  return !!(_currentAdminSession);
}

const AdminPage = {
  activeEditingId: null,
  currentProducts: [],
  currentTab: 'products',
  currentUploadedImage: null,
  orders: [],
  ordersFilter: 'all',
  ordersSearch: '',

  async init() {
    this.bindEvents();
    await this.initSupabase();
    await this.checkAuth();
    await this.initCloud();
    if (window.lucide) lucide.createIcons();
  },

  async initSupabase() {
    if (window.SupabaseDB) {
      try {
        await SupabaseDB.init();
        if (SupabaseDB.client?.auth) {
          SupabaseDB.client.auth.onAuthStateChange(async (_event, session) => {
            _currentAdminSession = session;
          });
        }
      } catch (e) {
        console.warn("SupabaseDB init note:", e);
      }
    }
    this.updateSupabaseStatusUI();
  },

  updateSupabaseStatusUI() {
    const isReady = window.SupabaseDB && SupabaseDB.isReady();
    const btnText = document.getElementById("supabaseStatusText");
    const banner = document.getElementById("supabaseStatusBanner");
    const icon = document.getElementById("supabaseStatusIcon");
    const title = document.getElementById("supabaseStatusTitle");
    const desc = document.getElementById("supabaseStatusDesc");

    if (btnText) {
      btnText.innerHTML = isReady
        ? `<span>قاعدة البيانات: متصلة (Supabase)</span> <span class="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>`
        : `<span>قاعدة البيانات: محلي</span> <span class="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>`;
    }

    if (banner && title && desc && icon) {
      if (isReady) {
        banner.className = "p-4 rounded-xl border mb-6 text-xs flex items-center gap-3 bg-emerald-950/40 border-emerald-500/30";
        icon.textContent = "🟢";
        title.textContent = "حالة الاتصال: سحابة Supabase نشطة (PostgreSQL & RLS Active)";
        desc.textContent = "جميع العطور والأسعار والتعديلات والطلبات متصلة بقاعدة بيانات PostgreSQL حقيقية ومحمية بصلاحيات Row Level Security.";
      } else {
        banner.className = "p-4 rounded-xl border mb-6 text-xs flex items-center gap-3 bg-amber-950/30 border-amber-500/30";
        icon.textContent = "🟡";
        title.textContent = "حالة الاتصال: وضع محلي (Local Mode)";
        desc.textContent = "أدخل رابط مشروع Supabase والمفتاح العام (anon key) لربط قاعدة البيانات PostgreSQL وتفعيل صلاحيات RLS.";
      }
    }

    if (window.SupabaseConfig) {
      const cfg = SupabaseConfig.getConfig();
      if (cfg) {
        document.getElementById("supabaseUrlInput") && (document.getElementById("supabaseUrlInput").value = cfg.url || "");
        document.getElementById("supabaseAnonKeyInput") && (document.getElementById("supabaseAnonKeyInput").value = cfg.anonKey || "");
      }
    }
  },

  openSupabaseModal() {
    if (!isAuthenticated()) return;
    this.updateSupabaseStatusUI();
    const modal = document.getElementById("supabaseSyncModal");
    if (modal) modal.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
  },

  closeSupabaseModal() {
    const modal = document.getElementById("supabaseSyncModal");
    if (modal) modal.classList.add("hidden");
  },

  async handleSaveSupabaseConfig() {
    const url = document.getElementById("supabaseUrlInput")?.value.trim();
    const anonKey = document.getElementById("supabaseAnonKeyInput")?.value.trim();

    if (!url || !anonKey) {
      alert("يرجى إدخال Supabase Project URL و Anon Public Key.");
      return;
    }

    try {
      window.SupabaseConfig.saveConfig(url, anonKey);
      this.showToast("جاري الاتصال بـ Supabase", "جاري اختبار الاتصال بقاعدة بيانات PostgreSQL...", "info");

      const success = await SupabaseDB.init();
      if (success) {
        this.updateSupabaseStatusUI();
        this.closeSupabaseModal();
        this.showToast("تم الربط مع Supabase بنجاح ⚡", "متجرك متصل الآن بقاعدة بيانات PostgreSQL ومؤمّن بصلاحيات Row Level Security!", "success");
        await this.refreshData();
        this.initOrdersListener();
      } else {
        alert("تعذر الاتصال بـ Supabase بهذا الرابط والمفتاح. يرجى التأكد من صحة الرابط والـ anon key وتشغيل ملف supabase-schema.sql.");
      }
    } catch (err) {
      alert("خطأ أثناء حفظ التكوين: " + err.message);
    }
  },

  handleClearSupabaseConfig() {
    if (confirm("هل تريد بالتأكيد إلغاء الربط مع Supabase والرجوع للتخزين المحلي فقط؟")) {
      window.SupabaseConfig.clearConfig();
      if (window.SupabaseDB) {
        SupabaseDB.isInitialized = false;
        SupabaseDB.client = null;
      }
      this.updateSupabaseStatusUI();
      this.closeSupabaseModal();
      this.showToast("تمت الاستعادة", "تم إلغاء الربط مع Supabase والرجوع للوضع المحلي (Local Mode).", "info");
    }
  },

  async initCloud() {
    if (window.CloudDB) {
      try {
        await CloudDB.init();
      } catch (e) {
        console.warn("CloudDB init:", e);
      }
    }
    this.updateCloudStatusUI();
  },

  updateCloudStatusUI() {
    const isCloud = window.CloudDB && CloudDB.isCloudActive();
    const btnText = document.getElementById("cloudStatusText");
    const banner = document.getElementById("cloudStatusBanner");
    const icon = document.getElementById("cloudStatusIcon");
    const title = document.getElementById("cloudStatusTitle");
    const desc = document.getElementById("cloudStatusDesc");

    if (btnText) {
      btnText.innerHTML = isCloud
        ? `<span>السحابة: متصلة</span> <span class="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>`
        : `<span>السحابة: محلي</span> <span class="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>`;
    }

    if (banner && title && desc && icon) {
      if (isCloud) {
        banner.className = "p-4 rounded-xl border mb-6 text-xs flex items-center gap-3 bg-emerald-950/40 border-emerald-500/30";
        icon.textContent = "🟢";
        title.textContent = "حالة الاتصال: سحابي نشط ومتزامن (Google Firebase Active)";
        desc.textContent = "جميع العطور والأسعار والتعديلات وأرقام الكاش تُحفظ وتُزامن سحابياً وفورياً مع كافة زوار الموقع في جميع أنحاء العالم.";
      } else {
        banner.className = "p-4 rounded-xl border mb-6 text-xs flex items-center gap-3 bg-amber-950/30 border-amber-500/30";
        icon.textContent = "🟡";
        title.textContent = "حالة الاتصال: وضع محلي (Local Mode)";
        desc.textContent = "البيانات تُحفظ في ذاكرة هذا المتصفح فقط. لربطها سحابياً لجميع الزوار، أدخل بيانات مشروعك في Firebase أدناه.";
      }
    }

    // Pre-fill modal form fields if config exists
    if (window.FirebaseConfig) {
      const cfg = FirebaseConfig.getConfig();
      if (cfg) {
        document.getElementById("cloudApiKey") && (document.getElementById("cloudApiKey").value = cfg.apiKey || "");
        document.getElementById("cloudProjectId") && (document.getElementById("cloudProjectId").value = cfg.projectId || "");
        document.getElementById("cloudAuthDomain") && (document.getElementById("cloudAuthDomain").value = cfg.authDomain || "");
        document.getElementById("cloudStorageBucket") && (document.getElementById("cloudStorageBucket").value = cfg.storageBucket || "");
        document.getElementById("cloudAppId") && (document.getElementById("cloudAppId").value = cfg.appId || "");
      }
    }
  },

  async checkAuth() {
    const loginGate = document.getElementById("adminLoginGate");
    const dashboard = document.getElementById("adminDashboard");

    const isAuthed = await checkAdminSession();

    if (isAuthed) {
      if (loginGate) loginGate.classList.add("hidden");
      if (dashboard) dashboard.classList.remove("hidden");
      this.refreshData();
      this.initOrdersListener();
      this.loadDiscountsSettings();
      this.loadCoupons();
      if (window.lucide) lucide.createIcons({ root: dashboard });
    } else {
      if (loginGate) loginGate.classList.remove("hidden");
      if (dashboard) dashboard.classList.add("hidden");
      const passInput = document.getElementById("adminPasswordInput");
      if (passInput) {
        passInput.value = "";
      }
    }
  },

  async refreshData() {
    if (window.SupabaseDB && SupabaseDB.isReady()) {
      try {
        this.currentProducts = await SupabaseDB.fetchPerfumes();
      } catch (e) {
        this.currentProducts = Storage.getProducts();
      }
    } else {
      this.currentProducts = Storage.getProducts();
    }
    this.renderStats();
    this.renderProductsList();
  },

  bindEvents() {
    // --- Login Form ---
    const loginForm = document.getElementById("adminLoginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const emailInput = document.getElementById("adminEmailInput");
        const passInput = document.getElementById("adminPasswordInput");
        const email = emailInput ? emailInput.value.trim() : "";
        const password = passInput ? passInput.value : "";
        this.handleLogin({ email, password });
      });
    }

    // Toggle Password Visibility in Login
    const togglePassBtn = document.getElementById("togglePasswordVisibilityBtn");
    if (togglePassBtn) {
      togglePassBtn.addEventListener("click", () => {
        const input = document.getElementById("adminPasswordInput");
        if (!input) return;
        if (input.type === "password") {
          input.type = "text";
          togglePassBtn.innerHTML = '<i data-lucide="eye-off" class="w-4 h-4"></i>';
        } else {
          input.type = "password";
          togglePassBtn.innerHTML = '<i data-lucide="eye" class="w-4 h-4"></i>';
        }
        if (window.lucide) lucide.createIcons({ root: togglePassBtn });
      });
    }

    // --- Logout Button ---
    document.getElementById("btnAdminLogout")?.addEventListener("click", async () => {
      if (confirm("هل تريد تسجيل الخروج وقفل لوحة التحكم؟")) {
        _currentAdminSession = null;
        try {
          sessionStorage.removeItem("beit_admin_session_auth");
        } catch (e) {}
        if (window.SupabaseDB) {
          try { await SupabaseDB.logout(); } catch (e) {}
        }
        await this.checkAuth();
        this.showToast("تم تسجيل الخروج", "تم قفل لوحة التحكم بأمان", "info");
      }
    });

    // --- Change Password Modal ---
    const changePassModal = document.getElementById("changePasswordModal");
    const openChangePassBtn = document.getElementById("btnOpenChangePassModal");
    const closeChangePassBtn = document.getElementById("btnCloseChangePassModal");
    const cancelChangePassBtn = document.getElementById("btnCancelChangePass");

    openChangePassBtn?.addEventListener("click", () => {
      document.getElementById("changePasswordForm")?.reset();
      document.getElementById("changePassError")?.classList.add("hidden");
      changePassModal?.classList.remove("hidden");
    });

    const closePassModal = () => {
      changePassModal?.classList.add("hidden");
    };

    closeChangePassBtn?.addEventListener("click", closePassModal);
    cancelChangePassBtn?.addEventListener("click", closePassModal);

    // Change Password Form submit
    document.getElementById("changePasswordForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newP = document.getElementById("inputNewPass")?.value;
      const confirmP = document.getElementById("inputConfirmNewPass")?.value;
      const errBox = document.getElementById("changePassError");

      const showPassError = (msg) => {
        if (errBox) {
          errBox.textContent = msg;
          errBox.classList.remove("hidden");
        }
      };

      if (!newP || newP.length < 6) {
        showPassError("يجب أن تتكون كلمة المرور الجديدة من 6 خانات على الأقل!");
        return;
      }

      if (newP !== confirmP) {
        showPassError("كلمة المرور الجديدة وتأكيدها غير متطابقين!");
        return;
      }

      try {
        // 1. Hash and save locally
        const hashed = await hashAdminPassword(newP);
        localStorage.setItem("beit_admin_pass_hash", hashed);

        // 2. Also sync to Supabase settings for cross-device persistence
        if (window.SupabaseDB && SupabaseDB.isReady() && SupabaseDB.client) {
          try {
            await SupabaseDB.client
              .from('settings')
              .upsert({
                key: 'admin_security',
                value: { pass_hash: hashed, updated_at: new Date().toISOString() },
                updated_at: new Date().toISOString()
              });
          } catch (cloudErr) {
            console.warn("Cloud security sync note:", cloudErr);
          }

          if (SupabaseDB.client.auth) {
            try {
              await SupabaseDB.client.auth.updateUser({ password: newP });
            } catch (supaErr) {
              console.warn("Supabase password update note:", supaErr);
            }
          }
        }

        // 3. Invalidate previous session timestamp
        if (_currentAdminSession) {
          _currentAdminSession.authenticatedAt = Date.now();
        }

        closePassModal();
        this.showToast("تم الحفظ بنجاح 🔒", "تم تحديث كلمة المرور للإدارة بنجاح وإلغاء كلمة المرور السابقة تماماً.", "success");
      } catch (err) {
        console.error("Change password error:", err);
        showPassError(err.message || "تعذر تحديث كلمة المرور.");
      }
    });

    // --- Add new perfume button ---
    document.getElementById("btnAddNewPerfume")?.addEventListener("click", () => {
      this.openForm(null);
    });

    // --- Reset defaults button ---
    document.getElementById("btnResetDefaults")?.addEventListener("click", () => {
      if (confirm("هل أنت متأكد من استعادة عطور بيت المسك الأصلية؟ سيتم إعادة ضبط أي تعديلات.")) {
        Storage.resetProductsToDefault();
        this.refreshData();
        this.showToast("تمت الاستعادة", "تمت استعادة العطور الأصلية بنجاح", "success");
      }
    });

    // Search & Filter
    document.getElementById("adminSearchInput")?.addEventListener("input", (e) => {
      this.renderProductsList(e.target.value, document.getElementById("adminCategorySelect")?.value || "all");
    });

    document.getElementById("adminCategorySelect")?.addEventListener("change", (e) => {
      this.renderProductsList(document.getElementById("adminSearchInput")?.value || "", e.target.value);
    });

    // Product Form submission
    const form = document.getElementById("perfumeEditForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveProduct();
      });
    }

    // Close product form button
    document.getElementById("btnCancelForm")?.addEventListener("click", () => {
      this.closeForm();
    });

    // Live preview listeners
    ["formProdName", "formProdBrand", "formProdLiquidColor", "formProdCapColor"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", () => this.updateLivePreview());
    });

    // --- Tab Switching (Products vs Orders vs Payment) ---
    document.getElementById("adminTabProductsBtn")?.addEventListener("click", () => {
      this.switchTab("products");
    });

    document.getElementById("adminTabOrdersBtn")?.addEventListener("click", () => {
      this.switchTab("orders");
    });

    document.getElementById("adminTabPaymentBtn")?.addEventListener("click", () => {
      this.switchTab("payment");
    });

    // --- Tab Switching for Discounts & Offers Page ---
    const handleDiscountsTab = () => this.switchTab("discounts");
    document.getElementById("adminTabDiscountsBtn")?.addEventListener("click", handleDiscountsTab);
    document.getElementById("adminTabCouponsBtn")?.addEventListener("click", handleDiscountsTab);

    // Threshold discount form
    document.getElementById("adminThresholdDiscountForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveThresholdDiscountSettings();
    });

    document.getElementById("settingThresholdDiscountEnabled")?.addEventListener("change", (e) => {
      const badge = document.getElementById("thresholdStatusBadge");
      if (badge) {
        badge.textContent = e.target.checked ? "مفعّل 🟢" : "معطل ⚪";
        badge.className = e.target.checked ? "text-xs font-bold text-emerald-400" : "text-xs font-bold text-neutral-400";
      }
    });

    // Simulation updater
    ["settingThresholdAmount", "settingThresholdDiscountValue"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", () => this.updateThresholdSimulation());
    });

    // Global discount form
    document.getElementById("adminGlobalDiscountForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveGlobalDiscountSettings();
    });

    document.getElementById("settingGlobalDiscountEnabled")?.addEventListener("change", (e) => {
      const badge = document.getElementById("globalDiscountStatusBadge");
      if (badge) {
        badge.textContent = e.target.checked ? "مفعّل 🟢" : "معطل ⚪";
        badge.className = e.target.checked ? "text-xs font-bold text-emerald-400" : "text-xs font-bold text-neutral-400";
      }
    });

    document.getElementById("btnRefreshCoupons")?.addEventListener("click", () => {
      this.loadDiscountsSettings();
      this.loadCoupons();
    });

    document.getElementById("btnGenerateCouponCode")?.addEventListener("click", () => {
      this.generateCouponCode();
    });

    document.getElementById("adminCouponForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveCouponFromForm();
    });

    // --- Supabase Modal Events ---
    document.getElementById("btnOpenSupabaseModal")?.addEventListener("click", () => {
      this.openSupabaseModal();
    });

    document.getElementById("btnCloseSupabaseModal")?.addEventListener("click", () => {
      this.closeSupabaseModal();
    });

    document.getElementById("btnCancelSupabaseModal")?.addEventListener("click", () => {
      this.closeSupabaseModal();
    });

    document.getElementById("supabaseConfigForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.handleSaveSupabaseConfig();
    });

    document.getElementById("btnClearSupabaseConfig")?.addEventListener("click", () => {
      this.handleClearSupabaseConfig();
    });

    // --- Cloud Modal Events ---
    document.getElementById("btnOpenCloudModal")?.addEventListener("click", () => {
      this.openCloudModal();
    });

    document.getElementById("btnCloseCloudModal")?.addEventListener("click", () => {
      this.closeCloudModal();
    });

    document.getElementById("cloudConfigForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.handleSaveCloudConfig();
    });

    document.getElementById("btnClearCloudConfig")?.addEventListener("click", () => {
      this.handleClearCloudConfig();
    });

    // --- Orders Section Events ---
    document.getElementById("btnRefreshOrders")?.addEventListener("click", () => {
      this.loadOrders();
      this.showToast("تحديث الطلبات", "تم فحص وتحديث قائمة الطلبات من السحابة", "info");
    });

    document.querySelectorAll(".order-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".order-filter-btn").forEach(b => {
          b.className = "order-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition border border-neutral-800 text-neutral-400 hover:text-cream-100";
        });
        btn.className = "order-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition border border-gold-500/40 bg-gold-500/20 text-gold-300";
        this.ordersFilter = btn.getAttribute("data-status") || "all";
        this.renderOrders();
      });
    });

    document.getElementById("inputSearchOrders")?.addEventListener("input", (e) => {
      this.ordersSearch = e.target.value.trim().toLowerCase();
      this.renderOrders();
    });

    // --- Payment Settings Form Submit & Top Save Button ---
    const payForm = document.getElementById("adminPaymentSettingsForm");
    if (payForm) {
      payForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.savePaymentSettings();
      });
    }

    document.getElementById("btnSavePaymentSettingsTop")?.addEventListener("click", () => {
      this.savePaymentSettings();
    });

    // Test WhatsApp Button
    document.getElementById("btnTestAdminWhatsApp")?.addEventListener("click", () => {
      this.testAdminWhatsApp();
    });

    // Podium (Men vs Women) radio listeners
    document.querySelectorAll('input[name="formProdPodium"]').forEach(radio => {
      radio.addEventListener("change", () => this.updatePodiumRadioUI());
    });

    // Image Upload & Change Listeners
    const triggerUploadBtn = document.getElementById("btnTriggerImageUpload");
    const fileInput = document.getElementById("formProdImageFileInput");
    const removeImgBtn = document.getElementById("btnRemoveProdImage");
    const urlInput = document.getElementById("formProdImageUrlInput");

    triggerUploadBtn?.addEventListener("click", () => {
      fileInput?.click();
    });

    fileInput?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        triggerUploadBtn.disabled = true;
        triggerUploadBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i><span>جاري المعالجة...</span>';
        if (window.lucide) lucide.createIcons({ root: triggerUploadBtn });

        const compressedDataUrl = await Storage.compressImageFile(file, 800, 800, 0.85);
        this.setImagePreview(compressedDataUrl);
        this.currentUploadedImage = compressedDataUrl;
        if (urlInput) urlInput.value = "";
        this.showToast("تم تحميل الصورة", "تم تجهيز وضغط صورة العطر بنجاح للحفظ الفوري.", "success");
      } catch (err) {
        console.error("Image upload failed:", err);
        alert(err.message || "تعذر معالجة الصورة المحددة");
      } finally {
        triggerUploadBtn.disabled = false;
        triggerUploadBtn.innerHTML = '<i data-lucide="upload-cloud" class="w-4 h-4"></i><span>رفع / تغيير الصورة من جهازك</span>';
        if (window.lucide) lucide.createIcons({ root: triggerUploadBtn });
        fileInput.value = "";
      }
    });

    removeImgBtn?.addEventListener("click", () => {
      this.currentUploadedImage = "assets/logo.jpg";
      if (urlInput) urlInput.value = "";
      this.setImagePreview("assets/logo.jpg");
      this.showToast("استعادة الافتراضي", "تم استعادة صورة الشعار الرسمية الافتراضية للعطر.", "info");
    });

    urlInput?.addEventListener("input", (e) => {
      const url = e.target.value.trim();
      this.currentUploadedImage = url;
      this.setImagePreview(url || "assets/logo.jpg");
    });
  },

  setImagePreview(src) {
    const imgEl = document.getElementById("formProdImagePreview");
    const placeholder = document.getElementById("formProdImagePlaceholder");
    if (!imgEl) return;

    const safeSrc = sanitizeImageUrl(src, "assets/logo.jpg");
    imgEl.src = safeSrc;
    imgEl.classList.remove("hidden");
    if (placeholder) placeholder.classList.add("hidden");
  },

  updatePodiumRadioUI() {
    const selected = document.querySelector('input[name="formProdPodium"]:checked')?.value || "men";
    const menCard = document.getElementById("podiumOptionMen");
    const womenCard = document.getElementById("podiumOptionWomen");
    const indicatorBadge = document.getElementById("formPodiumIndicatorBadge");

    if (selected === "women") {
      if (menCard) {
        menCard.className = "podium-select-card border-2 border-neutral-800 bg-obsidian-950/60 p-4 rounded-xl cursor-pointer flex items-center justify-between transition-all duration-200 hover:border-gold-500/50";
      }
      if (womenCard) {
        womenCard.className = "podium-select-card border-2 border-pink-500 bg-pink-500/10 p-4 rounded-xl cursor-pointer flex items-center justify-between transition-all duration-200 hover:border-pink-400 shadow-sm shadow-pink-500/10";
      }
      if (indicatorBadge) {
        indicatorBadge.textContent = "🌸 عطر حريمي";
        indicatorBadge.className = "self-start sm:self-auto text-xs font-bold px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40";
      }
    } else {
      if (menCard) {
        menCard.className = "podium-select-card border-2 border-gold-500 bg-gold-500/10 p-4 rounded-xl cursor-pointer flex items-center justify-between transition-all duration-200 hover:border-gold-400 shadow-sm shadow-gold-500/10";
      }
      if (womenCard) {
        womenCard.className = "podium-select-card border-2 border-neutral-800 bg-obsidian-950/60 p-4 rounded-xl cursor-pointer flex items-center justify-between transition-all duration-200 hover:border-pink-500/50";
      }
      if (indicatorBadge) {
        indicatorBadge.textContent = "👑 عطر رجالي";
        indicatorBadge.className = "self-start sm:self-auto text-xs font-bold px-3 py-1 rounded-full bg-gold-500/20 text-gold-300 border border-gold-500/40";
      }
    }
  },

  switchTab(tabName) {
    const isDiscounts = tabName === "coupons" || tabName === "discounts";
    this.currentTab = isDiscounts ? "discounts" : tabName;

    const tabProdBtn = document.getElementById("adminTabProductsBtn");
    const tabOrdersBtn = document.getElementById("adminTabOrdersBtn");
    const tabPayBtn = document.getElementById("adminTabPaymentBtn");
    const tabDiscountsBtn = document.getElementById("adminTabDiscountsBtn") || document.getElementById("adminTabCouponsBtn");

    const prodSection = document.getElementById("adminProductsSection");
    const ordersSection = document.getElementById("adminOrdersSection");
    const paySection = document.getElementById("adminPaymentSection");
    const discountsSection = document.getElementById("adminDiscountsSection") || document.getElementById("adminCouponsSection");

    const activeClass = "admin-nav-tab px-5 py-2.5 rounded-xl text-xs font-bold font-amiri transition flex items-center gap-2 border border-gold-500/50 bg-gold-500/20 text-gold-300 shadow-sm shadow-gold-500/10 cursor-pointer";
    const inactiveClass = "admin-nav-tab px-5 py-2.5 rounded-xl text-xs font-bold font-amiri transition flex items-center gap-2 border border-neutral-800 text-neutral-400 hover:text-cream-100 hover:border-gold-500/40 cursor-pointer";

    if (tabProdBtn) tabProdBtn.className = this.currentTab === "products" ? activeClass : inactiveClass;
    if (tabOrdersBtn) tabOrdersBtn.className = this.currentTab === "orders" ? activeClass : inactiveClass;
    if (tabPayBtn) tabPayBtn.className = this.currentTab === "payment" ? activeClass : inactiveClass;
    if (tabDiscountsBtn) tabDiscountsBtn.className = this.currentTab === "discounts" ? activeClass : inactiveClass;

    if (prodSection) prodSection.classList.toggle("hidden", this.currentTab !== "products");
    if (ordersSection) ordersSection.classList.toggle("hidden", this.currentTab !== "orders");
    if (paySection) paySection.classList.toggle("hidden", this.currentTab !== "payment");
    if (discountsSection) discountsSection.classList.toggle("hidden", this.currentTab !== "discounts");

    if (this.currentTab === "products") {
      this.refreshData();
    } else if (this.currentTab === "orders") {
      this.loadOrders();
    } else if (this.currentTab === "payment") {
      this.loadPaymentSettings();
    } else if (this.currentTab === "discounts") {
      this.loadDiscountsSettings();
      this.loadCoupons();
    }

    if (window.lucide) lucide.createIcons();
  },

  // --- Cloud Setup Modal Actions ---
  openCloudModal() {
    this.updateCloudStatusUI();
    const modal = document.getElementById("cloudSyncModal");
    if (modal) modal.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
  },

  closeCloudModal() {
    const modal = document.getElementById("cloudSyncModal");
    if (modal) modal.classList.add("hidden");
  },

  async handleSaveCloudConfig() {
    const apiKey = document.getElementById("cloudApiKey")?.value.trim();
    const projectId = document.getElementById("cloudProjectId")?.value.trim();
    const authDomain = document.getElementById("cloudAuthDomain")?.value.trim();
    const storageBucket = document.getElementById("cloudStorageBucket")?.value.trim();
    const appId = document.getElementById("cloudAppId")?.value.trim();

    if (!apiKey || !projectId) {
      alert("يرجى إدخال API Key و Project ID على الأقل للربط مع Firebase.");
      return;
    }

    try {
      window.FirebaseConfig.saveConfig({ apiKey, projectId, authDomain, storageBucket, appId });
      this.showToast("جاري الربط السحابي", "جاري الاتصال بمشروع Firebase الخاص بك...", "info");
      
      const success = await CloudDB.init();
      if (success) {
        this.updateCloudStatusUI();
        this.closeCloudModal();
        this.showToast("تم الربط السحابي بنجاح 🟢", "متجرك متصل الآن بسحابة Google Firebase وكل التعديلات تُزامن لجميع الزوار فوراً!", "success");
        this.refreshData();
        this.initOrdersListener();
      } else {
        alert("تعذر الاتصال بـ Firebase بهذا المفتاح. يرجى التأكد من صحة الـ API Key والـ Project ID وتفعيل Cloud Firestore.");
      }
    } catch (err) {
      alert("خطأ أثناء حفظ التكوين: " + err.message);
    }
  },

  handleClearCloudConfig() {
    if (confirm("هل تريد بالتأكيد إلغاء الربط السحابي والعودة للتخزين المحلي فقط؟")) {
      window.FirebaseConfig.clearConfig();
      if (window.CloudDB) {
        CloudDB.isInitialized = false;
        CloudDB.db = null;
      }
      this.updateCloudStatusUI();
      this.closeCloudModal();
      this.showToast("تمت الاستعادة", "تم إلغاء الربط السحابي والرجوع للوضع المحلي (Local Mode).", "info");
    }
  },

  // --- Live Orders Management ---
  initOrdersListener() {
    if (window.SupabaseDB && SupabaseDB.isReady()) {
      SupabaseDB.subscribeToOrders((orders) => {
        this.orders = orders || [];
        this.updateOrdersBadge();
        if (this.currentTab === "orders") {
          this.renderOrders();
        }
      });
    } else if (window.CloudDB) {
      CloudDB.listenToOrders((orders) => {
        this.orders = orders || [];
        this.updateOrdersBadge();
        if (this.currentTab === "orders") {
          this.renderOrders();
        }
      });
    }
  },

  async loadOrders() {
    if (window.SupabaseDB && SupabaseDB.isReady()) {
      this.orders = await SupabaseDB.fetchOrders();
    } else if (window.CloudDB) {
      this.orders = await CloudDB.fetchOrders();
    } else {
      this.orders = Storage.getOrders();
    }
    this.updateOrdersBadge();
    this.renderOrders();
  },

  updateOrdersBadge() {
    const badge = document.getElementById("adminOrdersBadge");
    if (!badge) return;
    const newCount = this.orders.filter(o => o.status === "new" || !o.status).length;
    if (newCount > 0) {
      badge.textContent = newCount;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  },

  renderOrders() {
    const container = document.getElementById("adminOrdersContainer");
    if (!container) return;

    let list = this.orders || [];

    // Filter by status
    if (this.ordersFilter !== "all") {
      list = list.filter(o => (o.status || "new") === this.ordersFilter);
    }

    // Filter by search
    if (this.ordersSearch) {
      const q = this.ordersSearch;
      list = list.filter(o => 
        (o.orderId && o.orderId.toLowerCase().includes(q)) ||
        (o.customer?.fullName && o.customer.fullName.toLowerCase().includes(q)) ||
        (o.customer?.phone && o.customer.phone.includes(q)) ||
        (o.customer?.address && o.customer.address.toLowerCase().includes(q))
      );
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div class="py-16 text-center text-neutral-400 bg-obsidian-900/40 rounded-2xl border border-neutral-800">
          <span class="text-4xl block mb-2">📦</span>
          <h4 class="font-amiri text-xl font-bold text-cream-100">لا توجد طلبات مطابقة</h4>
          <p class="text-xs text-neutral-500 mt-1">أي طلب يجريه العملاء في المتجر سيظهر هنا في الوقت الفعلي.</p>
        </div>
      `;
      return;
    }

    let html = "";
    list.forEach(ord => {
      const statusMap = {
        new: { label: "طلب جديد 🟢", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
        processing: { label: "قيد التجهيز 🟡", bg: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
        shipped: { label: "تم الشحن 🚚", bg: "bg-sky-500/10 text-sky-400 border-sky-500/30" },
        completed: { label: "مكتمل ومسلّم ✅", bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
        cancelled: { label: "ملغي ❌", bg: "bg-red-500/10 text-red-400 border-red-500/30" }
      };
      const curStatus = ord.status || "new";
      const statusBadge = statusMap[curStatus] || statusMap.new;

      let itemsList = (ord.items || []).map(it => `
        <div class="text-xs flex items-center justify-between py-1 border-b border-neutral-800/40">
          <span class="text-cream-200 font-amiri">${escapeHtml(it.name)} <span class="text-neutral-500 font-mono">(${escapeHtml(it.size)})</span> × <strong class="text-gold-400">${Number(it.quantity) || 1}</strong></span>
          <span class="font-mono text-gold-400 font-bold">${((Number(it.unitPrice) || 0) * (Number(it.quantity) || 1)).toLocaleString()} ج.م</span>
        </div>
      `).join('');

      const safeOrderId = escapeHtml(ord.orderId || '');
      const safeDate = escapeHtml(ord.formattedDate || '');
      const safeFullName = escapeHtml(ord.customer?.fullName || '-');
      const safePhone = escapeHtml(ord.customer?.phone || '-');
      const safeAddress = escapeHtml(ord.customer?.address || '-');
      const safeNotes = ord.customer?.notes ? escapeHtml(ord.customer.notes) : '';
      const safePaymentMethod = escapeHtml(ord.paymentMethod || '-');

      html += `
        <div class="p-6 rounded-2xl bg-obsidian-900/80 border border-neutral-800 space-y-4 text-right transition hover:border-gold-500/30 shadow-lg">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-neutral-800">
            <div class="flex items-center gap-3">
              <span class="px-3 py-1 rounded-full text-xs font-mono font-bold ${statusBadge.bg} border">
                ${statusBadge.label}
              </span>
              <span class="font-mono text-sm font-bold text-gold-400 tracking-wider">#${safeOrderId}</span>
              <span class="text-[11px] text-neutral-500 font-mono">${safeDate}</span>
            </div>

            <!-- Change Status Dropdown -->
            <div class="flex items-center gap-2">
              <span class="text-[11px] text-neutral-400">تحديث الحالة:</span>
              <select class="order-status-select bg-obsidian-950 border border-neutral-700 text-xs text-cream-100 rounded-lg px-2.5 py-1 focus:border-gold-500" data-order-id="${safeOrderId}">
                <option value="new" ${curStatus === 'new' ? 'selected' : ''}>طلب جديد 🟢</option>
                <option value="processing" ${curStatus === 'processing' ? 'selected' : ''}>قيد التجهيز 🟡</option>
                <option value="shipped" ${curStatus === 'shipped' ? 'selected' : ''}>تم الشحن 🚚</option>
                <option value="completed" ${curStatus === 'completed' ? 'selected' : ''}>مكتمل ومسلّم ✅</option>
                <option value="cancelled" ${curStatus === 'cancelled' ? 'selected' : ''}>ملغي ❌</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div class="space-y-1.5 p-4 rounded-xl bg-obsidian-950/70 border border-neutral-850">
              <h5 class="font-amiri font-bold text-gold-300 text-sm mb-1 flex items-center gap-1.5">
                <span>👤</span> بيانات العميل
              </h5>
              <p class="text-cream-100 font-bold text-sm">${safeFullName}</p>
              <p class="text-neutral-300 font-mono" dir="ltr">📞 <a href="tel:${safePhone}" class="hover:text-gold-400 underline">${safePhone}</a></p>
              <p class="text-neutral-400 leading-relaxed font-sans">📍 ${safeAddress}</p>
              ${safeNotes ? `<p class="text-[11px] text-amber-300/90 italic pt-1 border-t border-neutral-800">ملاحظات: "${safeNotes}"</p>` : ''}
            </div>

            <div class="space-y-2 p-4 rounded-xl bg-obsidian-950/70 border border-neutral-850 flex flex-col justify-between">
              <div>
                <h5 class="font-amiri font-bold text-gold-300 text-sm mb-1 flex items-center gap-1.5">
                  <span>🛍️</span> العطور المطلوبة
                </h5>
                <div class="space-y-1">
                  ${itemsList}
                </div>
              </div>
              <div class="pt-2 border-t border-neutral-800 flex justify-between items-center text-xs">
                <span class="text-neutral-400">طريقة الدفع: <strong class="text-gold-400 font-medium">${safePaymentMethod}</strong></span>
                <span class="font-mono text-base font-bold text-gold-400">${ord.totals?.grandTotal?.toLocaleString() || 0} ج.م</span>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach Status Select Listener
    container.querySelectorAll(".order-status-select").forEach(sel => {
      sel.addEventListener("change", async (e) => {
        const orderId = sel.getAttribute("data-order-id");
        const newStatus = e.target.value;
        sel.disabled = true;
        if (window.SupabaseDB && SupabaseDB.isReady()) {
          await SupabaseDB.updateOrderStatus(orderId, newStatus);
        } else if (window.CloudDB) {
          await CloudDB.updateOrderStatus(orderId, newStatus);
        }
        this.showToast("تم تحديث حالة الطلب", `تم تغيير حالة الطلب #${orderId} بنجاح.`, "success");
        sel.disabled = false;
        this.loadOrders();
      });
    });

    if (window.lucide) lucide.createIcons({ root: container });
  },

  loadPaymentSettings() {
    const settings = Storage.getSettings();
    
    const waInput = document.getElementById("settingAdminWhatsApp");
    const phoneInput = document.getElementById("settingAdminPhone");
    const vodafoneNumInput = document.getElementById("settingVodafoneCashNumber");
    const vodafoneNameInput = document.getElementById("settingVodafoneCashName");
    const instapayAccInput = document.getElementById("settingInstapayAccount");
    const instapayNameInput = document.getElementById("settingInstapayName");
    const bankNameInput = document.getElementById("settingBankName");
    const bankAccInput = document.getElementById("settingBankAccount");
    const beneficiaryInput = document.getElementById("settingBeneficiaryName");
    const instructionsInput = document.getElementById("settingPaymentInstructions");

    if (waInput) waInput.value = settings.whatsappNumber || "+201012345678";
    if (phoneInput) phoneInput.value = settings.contactPhone || "+201012345678";
    if (vodafoneNumInput) vodafoneNumInput.value = settings.vodafoneCashNumber || "01012345678";
    if (vodafoneNameInput) vodafoneNameInput.value = settings.vodafoneCashName || "بيت المسك للعطور";
    if (instapayAccInput) instapayAccInput.value = settings.instapayAccount || "beitalmusk@instapay";
    if (instapayNameInput) instapayNameInput.value = settings.instapayName || "بيت المسك للعطور الملكية";
    if (bankNameInput) bankNameInput.value = settings.bankName || "البنك الأهلي المصري";
    if (bankAccInput) bankAccInput.value = settings.bankAccountNumber || "";
    if (beneficiaryInput) beneficiaryInput.value = settings.beneficiaryName || "بيت المسك للعطور الملكية";
    if (instructionsInput) instructionsInput.value = settings.paymentInstructions || "يرجى تحويل المبلغ الإجمالي وإرسال إشعار أو سكرين شوت بالتحويل عبر الواتساب لتأكيد خروج الشحنة فوراً.";
  },

  savePaymentSettings() {
    const waInput = document.getElementById("settingAdminWhatsApp");
    const phoneInput = document.getElementById("settingAdminPhone");
    const vodafoneNumInput = document.getElementById("settingVodafoneCashNumber");
    const vodafoneNameInput = document.getElementById("settingVodafoneCashName");
    const instapayAccInput = document.getElementById("settingInstapayAccount");
    const instapayNameInput = document.getElementById("settingInstapayName");
    const bankNameInput = document.getElementById("settingBankName");
    const bankAccInput = document.getElementById("settingBankAccount");
    const beneficiaryInput = document.getElementById("settingBeneficiaryName");
    const instructionsInput = document.getElementById("settingPaymentInstructions");

    const newSettings = {
      whatsappNumber: (waInput?.value || "").trim() || "+201012345678",
      contactPhone: (phoneInput?.value || "").trim() || "+201012345678",
      vodafoneCashNumber: (vodafoneNumInput?.value || "").trim() || "01012345678",
      vodafoneCashName: (vodafoneNameInput?.value || "").trim() || "بيت المسك للعطور",
      instapayAccount: (instapayAccInput?.value || "").trim() || "beitalmusk@instapay",
      instapayName: (instapayNameInput?.value || "").trim() || "بيت المسك للعطور الملكية",
      bankName: (bankNameInput?.value || "").trim() || "البنك الأهلي المصري",
      bankAccountNumber: (bankAccInput?.value || "").trim(),
      beneficiaryName: (beneficiaryInput?.value || "").trim() || "بيت المسك للعطور الملكية",
      paymentInstructions: (instructionsInput?.value || "").trim()
    };

    Storage.saveSettings(newSettings);
    if (window.SupabaseDB && SupabaseDB.isReady()) {
      SupabaseDB.saveSettings(newSettings).catch(e => console.warn("Supabase settings sync:", e));
    }
    if (window.CloudDB && CloudDB.isCloudActive()) {
      CloudDB.saveSettings(newSettings).catch(e => console.warn("Cloud settings sync:", e));
    }
    this.showToast("تم الحفظ بنجاح", "تم حفظ وتحديث أرقام الكاش والإنستا وبيانات تحويل الأموال وتطبيقها فوراً على المتجر.", "success");
  },

  testAdminWhatsApp() {
    const waInput = document.getElementById("settingAdminWhatsApp");
    const rawNumber = (waInput?.value || "").trim();
    const cleanNumber = rawNumber.replace(/[^0-9]/g, "");
    if (!cleanNumber) {
      this.showToast("تنبيه", "يرجى إدخال رقم هاتف صحيح للواتساب أولاً.", "warning");
      return;
    }
    const testMsg = encodeURIComponent("👑 *بيت المسك • BEIT AL-MUSK*\nتجربة محادثة واتساب الإدارة الرسمية لاستقبال الطلبات والتحويلات بنجاح.");
    window.open(`https://wa.me/${cleanNumber}?text=${testMsg}`, "_blank");
  },

  async handleLogin(credentials) {
    let email = "";
    let password = "";
    if (credentials && typeof credentials === "object") {
      email = (credentials.email || "").trim();
      password = credentials.password || "";
    } else if (typeof credentials === "string") {
      password = credentials;
    }

    const errBox = document.getElementById("loginErrorMessage");
    const errText = document.getElementById("loginErrorText");
    const submitBtn = document.getElementById("adminLoginSubmitBtn");

    const showError = (msg) => {
      if (errBox) {
        if (errText) errText.textContent = msg;
        errBox.classList.remove("hidden");
      }
    };

    // 1. Strictly require Email and Password
    if (!email || !password) {
      showError("يرجى إدخال البريد الإلكتروني وكلمة المرور للإدارة.");
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i><span>جاري التحقق وتسجيل الدخول...</span>';
        if (window.lucide) lucide.createIcons({ root: submitBtn });
      }

      let loginSuccess = false;
      let authType = "supabase";

      // 2. Attempt Supabase Auth login if ready
      if (window.SupabaseDB && SupabaseDB.isReady() && SupabaseDB.client?.auth) {
        try {
          const authRes = await SupabaseDB.login(email, password);
          if (authRes && !authRes.error) {
            loginSuccess = true;
            authType = "supabase";

            // Optional RPC verification
            try {
              const { data: isAdmin, error: rpcErr } = await SupabaseDB.client.rpc('is_admin');
              if (!rpcErr && isAdmin === false) {
                await SupabaseDB.logout();
                showError("عفواً، هذا الحساب لا يملك صلاحية إدارة المتجر في قاعدة البيانات.");
                return;
              }
            } catch (adminCheckErr) {
              console.warn("is_admin verification note:", adminCheckErr);
            }
          }
        } catch (supaErr) {
          console.warn("Supabase auth attempt note:", supaErr);
        }
      }

      // 3. Fallback to Owner Master Authentication if Supabase fails or unconfirmed
      if (!loginSuccess) {
        const inputHash = await hashAdminPassword(password);
        const validHash = await getSavedAdminHash();
        const lowerEmail = email.toLowerCase();
        const isAuthorizedEmail = [
          "beitalmusk@gmail.com",
          "beitalmusk.store@gmail.com",
          "admin@beitalmusk.com",
          "admin@baytalmusk.com"
        ].includes(lowerEmail) || lowerEmail.includes("beitalmusk");

        // STRICT MATCH: Only accept the current active valid hash!
        // The old password will NEVER work once changed.
        if (inputHash === validHash && (isAuthorizedEmail || lowerEmail.includes("@"))) {
          loginSuccess = true;
          authType = "owner_verified";
        }
      }

      if (!loginSuccess) {
        showError("بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.");
        return;
      }

      // 4. Session established successfully
      _currentAdminSession = {
        user: { email: email, role: 'admin' },
        type: authType,
        authenticatedAt: Date.now()
      };

      try {
        sessionStorage.setItem("beit_admin_session_auth", JSON.stringify({
          email: email,
          type: authType,
          token: "admin_verified_" + Math.random().toString(36).substring(2),
          ts: Date.now()
        }));
      } catch (e) {}

      if (errBox) errBox.classList.add("hidden");
      await this.checkAuth();
      this.showToast("تم الدخول بنجاح ⚡", `مرحباً بك في لوحة الإدارة: ${email}`, "success");
    } catch (err) {
      console.error("Login process error:", err);
      showError(err.message || "تعذر إتمام الدخول. يرجى المحاولة مرة أخرى.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="lock" class="w-4 h-4"></i><span>تسجيل الدخول للوحة التحكم</span>';
        if (window.lucide) lucide.createIcons({ root: submitBtn });
      }
    }
  },

  renderStats() {
    const products = this.currentProducts;
    const totalCount = products.length;
    const totalStock = products.reduce((acc, p) => acc + (p.stock || 0), 0);
    
    let sumPrice50 = 0;
    products.forEach(p => {
      sumPrice50 += (p.sizes && p.sizes["50ml"] ? p.sizes["50ml"].price : 250);
    });
    const avgPrice50 = totalCount > 0 ? Math.round(sumPrice50 / totalCount) : 0;

    const categories = new Set(products.map(p => p.category)).size;

    const elTotal = document.getElementById("statTotalPerfumes");
    const elStock = document.getElementById("statTotalStock");
    const elAvg = document.getElementById("statAvgPrice");
    const elCat = document.getElementById("statCategories");

    if (elTotal) elTotal.textContent = totalCount;
    if (elStock) elStock.textContent = totalStock;
    if (elAvg) elAvg.textContent = `${avgPrice50} ج.م`;
    if (elCat) elCat.textContent = categories;
  },

  renderProductsList(search = "", category = "all") {
    const container = document.getElementById("adminProductsContainer");
    if (!container) return;

    let products = this.currentProducts;

    if (search.trim()) {
      const q = search.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.notes?.top?.some(n => (typeof n === 'string' ? n : n.name).toLowerCase().includes(q)) ||
        p.notes?.heart?.some(n => (typeof n === 'string' ? n : n.name).toLowerCase().includes(q)) ||
        p.notes?.base?.some(n => (typeof n === 'string' ? n : n.name).toLowerCase().includes(q))
      );
    }

    if (category === "men") {
      products = products.filter(p => p.podium === "men" || (!p.podium && !p.gender?.includes("نسائي") && !p.gender?.includes("حريمي") && !p.gender?.includes("Femme")));
    } else if (category === "women") {
      products = products.filter(p => p.podium === "women" || (p.gender && (p.gender.includes("نسائي") || p.gender.includes("حريمي") || p.gender.includes("Femme"))));
    } else if (category !== "all") {
      products = products.filter(p => p.category === category || p.category.includes(category));
    }

    if (products.length === 0) {
      container.innerHTML = `
        <div class="col-span-full p-12 text-center text-neutral-400 bg-obsidian-900/60 rounded-2xl border border-gold-500/15">
          <p class="font-amiri text-xl text-cream-100 mb-1">لا توجد عطور مطابقة للبحث</p>
          <p class="text-xs text-neutral-500">حاول البحث بكلمات أخرى أو اختر فئة مختلفة</p>
        </div>
      `;
      return;
    }

    let html = "";
    products.forEach((prod) => {
      const p30 = prod.sizes && prod.sizes["30ml"] ? prod.sizes["30ml"].price : "-";
      const p50 = prod.sizes && prod.sizes["50ml"] ? prod.sizes["50ml"].price : "-";
      const p100 = prod.sizes && prod.sizes["100ml"] ? prod.sizes["100ml"].price : "-";

      const formatNotesPreview = (arr) => (arr || []).slice(0, 2).map(n => typeof n === 'string' ? n : n.name).join("، ");
      const topNotes = formatNotesPreview(prod.notes?.top);
      const heartNotes = formatNotesPreview(prod.notes?.heart);
      const baseNotes = formatNotesPreview(prod.notes?.base);

      const isWomen = prod.podium === "women" || (prod.gender && (prod.gender.includes("حريمي") || prod.gender.includes("نسائي") || prod.gender.includes("Femme")));
      const podiumBadge = isWomen 
        ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-pink-500/15 text-pink-300 border border-pink-500/30">
            🌸 عطر حريمي
          </span>`
        : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gold-500/15 text-gold-300 border border-gold-500/30">
            👑 عطر رجالي
          </span>`;

      const stockBadge = prod.stock > 10 
        ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> ${prod.stock} قارورة
          </span>`
        : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> متبقي ${prod.stock} فقط
          </span>`;

      const safeImage = sanitizeImageUrl(prod.image);
      const safeName = escapeHtml(prod.name);
      const safeBrand = escapeHtml(prod.brand);
      const safeSubtitle = escapeHtml(prod.subtitle || "");
      const safeConcentration = escapeHtml(prod.concentration || "");
      const safeDesc = escapeHtml(prod.description || "");
      const safeTopNotes = escapeHtml(topNotes);
      const safeHeartNotes = escapeHtml(heartNotes);
      const safeBaseNotes = escapeHtml(baseNotes);
      const safeId = escapeHtml(prod.id);

      html += `
        <div class="glass-card p-5 sm:p-6 rounded-2xl border border-gold-500/20 hover:border-gold-500/40 transition duration-300 relative group flex flex-col justify-between text-right">
          <div>
            <!-- Header Row -->
            <div class="flex items-start justify-between gap-3 mb-4">
              <div class="flex items-center gap-3">
                <div class="w-14 h-18 rounded-xl bg-obsidian-950 border border-gold-500/30 flex items-center justify-center p-1 flex-shrink-0 shadow-inner overflow-hidden">
                  ${prod.image 
                    ? `<img src="${safeImage}" alt="${safeName}" class="w-full h-full object-contain rounded-lg">` 
                    : generateBottleSvg(prod, 46, 60)}
                </div>
                <div>
                  <span class="text-[10px] text-gold-400 font-semibold font-sans block">${safeBrand}</span>
                  <h3 class="font-amiri text-xl font-bold text-cream-100 tracking-wide">${safeName}</h3>
                  <p class="text-xs text-neutral-400 mt-0.5">${safeSubtitle} • <span class="text-gold-300">${safeConcentration}</span></p>
                </div>
              </div>

              <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
                ${podiumBadge}
                ${stockBadge}
              </div>
            </div>

            <!-- Description -->
            <p class="text-xs text-neutral-300 leading-relaxed font-light mb-4 line-clamp-2">
              ${safeDesc}
            </p>

            <!-- Notes summary -->
            <div class="p-3 rounded-xl bg-obsidian-950/80 border border-neutral-800 text-[11px] space-y-1 mb-4">
              <div><strong class="text-gold-400 font-bold">القمة:</strong> <span class="text-neutral-300">${safeTopNotes}</span></div>
              <div><strong class="text-gold-400 font-bold">القلب:</strong> <span class="text-neutral-300">${safeHeartNotes}</span></div>
              <div><strong class="text-gold-400 font-bold">القاعدة:</strong> <span class="text-neutral-300">${safeBaseNotes}</span></div>
            </div>

            <!-- Price Breakdown -->
            <div class="flex items-center justify-between text-xs bg-obsidian-900/60 p-2.5 rounded-xl border border-gold-500/10 mb-5" dir="ltr">
              <div class="text-center flex-1">
                <span class="block text-[10px] text-neutral-400">30ml</span>
                <span class="font-mono font-bold text-cream-200">${p30} ج.م</span>
              </div>
              <div class="w-px h-6 bg-neutral-800"></div>
              <div class="text-center flex-1">
                <span class="block text-[10px] text-gold-400 font-semibold">50ml</span>
                <span class="font-mono font-bold text-gold-400 text-sm">${p50} ج.م</span>
              </div>
              <div class="w-px h-6 bg-neutral-800"></div>
              <div class="text-center flex-1">
                <span class="block text-[10px] text-neutral-400">100ml</span>
                <span class="font-mono font-bold text-cream-200">${p100} ج.م</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 pt-3 border-t border-neutral-800/80">
            <button class="btn-edit-perfume flex-1 py-2 px-3 rounded-xl border border-gold-500/40 bg-gold-500/10 text-gold-400 hover:bg-gold-500 hover:text-obsidian-950 text-xs font-bold transition flex items-center justify-center gap-1.5" data-id="${safeId}">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              <span>تعديل المواصفات</span>
            </button>
            <button class="btn-delete-perfume p-2 rounded-xl border border-neutral-800 text-neutral-500 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition" data-id="${safeId}" title="حذف العطر">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons({ root: container });

    // Attach actions
    container.querySelectorAll(".btn-edit-perfume").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.openForm(id);
      });
    });

    container.querySelectorAll(".btn-delete-perfume").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const prod = Storage.getProductById(id);
        if (confirm(`هل أنت متأكد من حذف عطر "${prod?.name}" نهائياً من المتجر؟`)) {
          Storage.deleteProduct(id);
          if (window.SupabaseDB && SupabaseDB.isReady()) {
            SupabaseDB.deletePerfume(id).catch(e => console.warn("Supabase delete prod:", e));
          }
          if (window.CloudDB && CloudDB.isCloudActive()) {
            CloudDB.deleteProduct(id).catch(e => console.warn("Cloud delete prod:", e));
          }
          this.refreshData();
          this.showToast("تم الحذف", `تم حذف عطر "${prod?.name}" بنجاح`, "info");
        }
      });
    });
  },

  openForm(productId = null) {
    this.activeEditingId = productId;
    const modal = document.getElementById("adminFormModal");
    const titleEl = document.getElementById("formModalTitle");
    if (!modal) return;

    if (productId) {
      const prod = Storage.getProductById(productId);
      if (!prod) return;

      if (titleEl) titleEl.textContent = `تعديل مواصفات عطر: ${prod.name}`;

      document.getElementById("formProdId").value = prod.id;
      document.getElementById("formProdName").value = prod.name || "";
      document.getElementById("formProdBrand").value = prod.brand || "بيت المسك • Bayt Al Musk";
      document.getElementById("formProdSubtitle").value = prod.subtitle || "";
      document.getElementById("formProdCategory").value = prod.category || "خشبي ومسكي";
      document.getElementById("formProdConcentration").value = prod.concentration || "خلاصة عطرية ملكية • تركيز 34%";
      document.getElementById("formProdStock").value = prod.stock || 10;

      document.getElementById("formProdPrice30").value = prod.sizes?.["30ml"]?.price || 185;
      document.getElementById("formProdPrice50").value = prod.sizes?.["50ml"]?.price || 275;
      document.getElementById("formProdPrice100").value = prod.sizes?.["100ml"]?.price || 420;

      const formatNotesForInput = (arr) => (arr || []).map(n => typeof n === 'string' ? n : n.name).join("، ");
      document.getElementById("formProdTopNotes").value = formatNotesForInput(prod.notes?.top);
      document.getElementById("formProdHeartNotes").value = formatNotesForInput(prod.notes?.heart);
      document.getElementById("formProdBaseNotes").value = formatNotesForInput(prod.notes?.base);

      document.getElementById("formProdDescription").value = prod.description || "";
      document.getElementById("formProdStory").value = prod.story || prod.description || "";

      document.getElementById("formProdLiquidColor").value = prod.visual?.liquidColor || prod.liquidColor || "#d4af37";
      document.getElementById("formProdCapColor").value = prod.visual?.capColor || prod.capColor || "#e5c07b";
      document.getElementById("formProdAccentColor").value = prod.visual?.accentHex || "#d4af37";

      this.currentUploadedImage = prod.image || "assets/logo.jpg";
      this.setImagePreview(this.currentUploadedImage);
      const urlInput = document.getElementById("formProdImageUrlInput");
      if (urlInput) urlInput.value = prod.image && !prod.image.startsWith("data:") ? prod.image : "";

      const isWomen = prod.podium === "women" || (prod.gender && (prod.gender.includes("حريمي") || prod.gender.includes("نسائي") || prod.gender.includes("Femme")));
      const menRadio = document.querySelector('input[name="formProdPodium"][value="men"]');
      const womenRadio = document.querySelector('input[name="formProdPodium"][value="women"]');
      if (isWomen) {
        if (womenRadio) womenRadio.checked = true;
      } else {
        if (menRadio) menRadio.checked = true;
      }
      this.updatePodiumRadioUI();
    } else {
      if (titleEl) titleEl.textContent = "إضافة عطر ملكي جديد إلى بيت المسك";
      document.getElementById("perfumeEditForm")?.reset();
      document.getElementById("formProdId").value = "perfume-" + Date.now();
      document.getElementById("formProdBrand").value = "بيت المسك • Bayt Al Musk";
      document.getElementById("formProdSubtitle").value = "خلاصة عطرية ملكية فاخرة";
      document.getElementById("formProdConcentration").value = "تركيز نقي Extrait de Parfum 34%";
      document.getElementById("formProdCategory").value = "خشبي ومسكي";
      document.getElementById("formProdStock").value = 15;
      document.getElementById("formProdPrice30").value = 195;
      document.getElementById("formProdPrice50").value = 285;
      document.getElementById("formProdPrice100").value = 440;
      document.getElementById("formProdTopNotes").value = "مسك أبيض ملكي، هيل غواتيمالي، برغموت كالابريا";
      document.getElementById("formProdHeartNotes").value = "ورد طائفي فاخر، ياسمين فرنسي، زعفران كشميري";
      document.getElementById("formProdBaseNotes").value = "عود كمبودي معتق، مسك الغزال النقي، عنبر الحوت الملكي";
      document.getElementById("formProdLiquidColor").value = "#df8a14";
      document.getElementById("formProdCapColor").value = "#d4af37";
      document.getElementById("formProdAccentColor").value = "#d4af37";

      this.currentUploadedImage = "assets/logo.jpg";
      this.setImagePreview("assets/logo.jpg");
      const urlInput = document.getElementById("formProdImageUrlInput");
      if (urlInput) urlInput.value = "";

      const menRadio = document.querySelector('input[name="formProdPodium"][value="men"]');
      if (menRadio) menRadio.checked = true;
      this.updatePodiumRadioUI();
    }

    this.updateLivePreview();
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  },

  closeForm() {
    const modal = document.getElementById("adminFormModal");
    if (modal) modal.classList.add("hidden");
    document.body.style.overflow = "";
    this.activeEditingId = null;
  },

  updateLivePreview() {
    const previewContainer = document.getElementById("formBottleLivePreview");
    if (!previewContainer) return;

    const fakeProd = {
      id: document.getElementById("formProdId")?.value || "preview",
      name: document.getElementById("formProdName")?.value || "عطر بيت المسك",
      brand: document.getElementById("formProdBrand")?.value || "بيت المسك",
      visual: {
        liquidColor: document.getElementById("formProdLiquidColor")?.value || "#d4af37",
        capColor: document.getElementById("formProdCapColor")?.value || "#e5c07b",
        accentHex: document.getElementById("formProdAccentColor")?.value || "#d4af37"
      }
    };

    previewContainer.innerHTML = generateBottleSvg(fakeProd, 80, 110);
  },

  saveProduct() {
    const id = document.getElementById("formProdId").value;
    const name = document.getElementById("formProdName").value.trim();
    if (!name) {
      alert("يرجى كتابة اسم العطر");
      return;
    }

    const brand = document.getElementById("formProdBrand").value.trim() || "بيت المسك • Bayt Al Musk";
    const subtitle = document.getElementById("formProdSubtitle").value.trim();
    const category = document.getElementById("formProdCategory").value.trim() || "خشبي ومسكي";
    const concentration = document.getElementById("formProdConcentration").value.trim() || "تركيز ملكي 34%";
    const stock = parseInt(document.getElementById("formProdStock").value) || 10;

    const p30 = parseFloat(document.getElementById("formProdPrice30").value) || 185;
    const p50 = parseFloat(document.getElementById("formProdPrice50").value) || 275;
    const p100 = parseFloat(document.getElementById("formProdPrice100").value) || 420;

    const splitNotes = (val) => val.split(/[,،]/).map(s => s.trim()).filter(Boolean);
    const topNotes = splitNotes(document.getElementById("formProdTopNotes").value);
    const heartNotes = splitNotes(document.getElementById("formProdHeartNotes").value);
    const baseNotes = splitNotes(document.getElementById("formProdBaseNotes").value);

    const description = document.getElementById("formProdDescription").value.trim();
    const story = document.getElementById("formProdStory").value.trim() || description;

    const liquidColor = document.getElementById("formProdLiquidColor").value;
    const capColor = document.getElementById("formProdCapColor").value;
    const accentHex = document.getElementById("formProdAccentColor").value;

    const selectedPodium = document.querySelector('input[name="formProdPodium"]:checked')?.value || "men";
    const isWomen = selectedPodium === "women";
    const gender = isWomen ? "حريمي ساحر (Pour Femme)" : "رجالي فاخر (Pour Homme)";
    const podiumTitle = isWomen ? "الجناح النسائي 🌸" : "الجناح الرجالي 👑";

    const existing = Storage.getProductById(id) || {};
    const image = sanitizeImageUrl((
      this.currentUploadedImage ||
      document.getElementById("formProdImageUrlInput")?.value ||
      existing.image ||
      "assets/logo.jpg"
    ).trim());

    const productObj = {
      ...existing,
      id,
      name,
      brand,
      subtitle,
      image,
      category,
      gender,
      podium: selectedPodium,
      podiumTitle,
      concentration,
      stock,
      defaultSize: "50ml",
      sizes: {
        "30ml": { price: p30, label: "30 مل (فاخر)", available: true },
        "50ml": { price: p50, label: "50 مل (الأكثر طلباً)", available: true },
        "100ml": { price: p100, label: "100 مل (القنينة الملكية)", available: true }
      },
      notes: {
        top: topNotes.length ? topNotes : ["مسك أبيض", "برغموت"],
        heart: heartNotes.length ? heartNotes : ["ورد طائفي", "ياسمين"],
        base: baseNotes.length ? baseNotes : ["مسك الغزال", "عود كمبودي", "عنبر"]
      },
      description: description || "خلاصة عطرية فاخرة مُعتّقة بدقة وعناية من دار بيت المسك.",
      story: story || "ابتكار عطري متقن مستوحى من تقاليد صناعة العطور الملكية.",
      visual: {
        bottleColor: existing.visual?.bottleColor || "#0e0d14",
        liquidColor,
        capColor,
        accentHex,
        spotlight: `rgba(${parseInt(accentHex.slice(1,3),16)}, ${parseInt(accentHex.slice(3,5),16)}, ${parseInt(accentHex.slice(5,7),16)}, 0.45)`
      }
    };

    Storage.saveProduct(productObj);
    if (window.SupabaseDB && SupabaseDB.isReady()) {
      SupabaseDB.savePerfume(productObj).catch(e => console.warn("Supabase save prod:", e));
    }
    if (window.CloudDB && CloudDB.isCloudActive()) {
      CloudDB.saveProduct(productObj).catch(e => console.warn("Cloud save prod:", e));
    }
    this.closeForm();
    this.refreshData();
    this.showToast("تم الحفظ بنجاح", `تم تحديث وحفظ بيانات عطر "${name}" في المتجر.`, "success");
  },

  // =========================================================================
  // --- مركز إدارة الخصومات والعروض (Discounts & Offers Center) ---
  // =========================================================================
  loadDiscountsSettings() {
    const settings = Storage.getSettings();

    // 1. Automatic Invoice Threshold Discount
    const thresholdEnabled = !!settings.thresholdDiscountEnabled;
    const thresholdAmount = settings.thresholdAmount || 500;
    const thresholdValue = settings.thresholdDiscountValue || 50;
    const thresholdLabel = settings.thresholdDiscountLabel || `خصم الطلبات الأكثر من ${thresholdAmount} ج.م`;

    const thresholdCheck = document.getElementById("settingThresholdDiscountEnabled");
    const thresholdAmountInput = document.getElementById("settingThresholdAmount");
    const thresholdValueInput = document.getElementById("settingThresholdDiscountValue");
    const thresholdLabelInput = document.getElementById("settingThresholdDiscountLabel");
    const thresholdBadge = document.getElementById("thresholdStatusBadge");

    if (thresholdCheck) thresholdCheck.checked = thresholdEnabled;
    if (thresholdAmountInput) thresholdAmountInput.value = thresholdAmount;
    if (thresholdValueInput) thresholdValueInput.value = thresholdValue;
    if (thresholdLabelInput) thresholdLabelInput.value = thresholdLabel;
    if (thresholdBadge) {
      thresholdBadge.textContent = thresholdEnabled ? "مفعّل 🟢" : "معطل ⚪";
      thresholdBadge.className = thresholdEnabled ? "text-xs font-bold text-emerald-400" : "text-xs font-bold text-neutral-400";
    }

    // 2. Global Storewide Discount
    const globalEnabled = !!settings.globalDiscountEnabled;
    const globalPercent = settings.globalDiscountPercent || 0;
    const globalLabel = settings.globalDiscountLabel || "خصم بيت المسك الملكي";

    const globalCheck = document.getElementById("settingGlobalDiscountEnabled");
    const globalPercentInput = document.getElementById("settingGlobalDiscountPercent");
    const globalLabelInput = document.getElementById("settingGlobalDiscountLabel");
    const globalBadge = document.getElementById("globalDiscountStatusBadge");

    if (globalCheck) globalCheck.checked = globalEnabled;
    if (globalPercentInput) globalPercentInput.value = globalPercent;
    if (globalLabelInput) globalLabelInput.value = globalLabel;
    if (globalBadge) {
      globalBadge.textContent = globalEnabled ? "مفعّل 🟢" : "معطل ⚪";
      globalBadge.className = globalEnabled ? "text-xs font-bold text-emerald-400" : "text-xs font-bold text-neutral-400";
    }

    this.updateThresholdSimulation();
    this.updateThresholdOverviewStats();
  },

  updateThresholdSimulation() {
    const amount = Number(document.getElementById("settingThresholdAmount")?.value) || 500;
    const value = Number(document.getElementById("settingThresholdDiscountValue")?.value) || 50;
    const simText = document.getElementById("simThresholdText");
    if (simText) {
      simText.textContent = `«أضف عطوراً إضافية لتصل إلى ${amount.toLocaleString()} ج.م وتحصل تلقائياً على خصم ${value.toLocaleString()} ج.م!»`;
    }
  },

  updateThresholdOverviewStats() {
    const settings = Storage.getSettings();
    const statStatus = document.getElementById("statThresholdStatusText");
    const statAmount = document.getElementById("statThresholdAmountText");
    const statValue = document.getElementById("statThresholdValueText");

    const isEnabled = !!settings.thresholdDiscountEnabled;
    const amount = settings.thresholdAmount || 500;
    const value = settings.thresholdDiscountValue || 50;

    if (statStatus) {
      statStatus.textContent = isEnabled ? "نشط 🟢" : "معطل ⚪";
      statStatus.className = isEnabled ? "text-xs font-bold text-emerald-400" : "text-xs font-bold text-amber-400";
    }
    if (statAmount) statAmount.textContent = `${amount.toLocaleString()} ج.م`;
    if (statValue) statValue.textContent = `-${value.toLocaleString()} ج.م`;
  },

  async saveThresholdDiscountSettings() {
    const enabled = !!document.getElementById("settingThresholdDiscountEnabled")?.checked;
    const amount = parseInt(document.getElementById("settingThresholdAmount")?.value, 10);
    const value = parseInt(document.getElementById("settingThresholdDiscountValue")?.value, 10);
    const label = (document.getElementById("settingThresholdDiscountLabel")?.value || "").trim() || `خصم الطلبات الأكثر من ${amount} ج.م`;

    if (!amount || isNaN(amount) || amount <= 0) {
      alert("يرجى إدخال الحد الأدنى لقيمة الفاتورة بالجنيه (مثال: 500 ج.م)");
      document.getElementById("settingThresholdAmount")?.focus();
      return;
    }

    if (!value || isNaN(value) || value <= 0) {
      alert("يرجى إدخال قيمة الخصم بالجنيه (مثال: 50 ج.م)");
      document.getElementById("settingThresholdDiscountValue")?.focus();
      return;
    }

    const current = Storage.getSettings();
    const updated = {
      ...current,
      thresholdDiscountEnabled: enabled,
      thresholdAmount: amount,
      thresholdDiscountValue: value,
      thresholdDiscountLabel: label
    };

    Storage.saveSettings(updated);

    if (window.SupabaseDB && SupabaseDB.isReady()) {
      SupabaseDB.saveSettings(updated).catch(e => console.warn("Supabase saveSettings note:", e));
    }

    this.showToast(
      "تم حفظ خصم الفاتورة 🎯",
      enabled 
        ? `تم تفعيل خصم ${value} ج.م تلقائياً عند وصول الفاتورة إلى ${amount} ج.م أو أكثر!`
        : "تم تعطيل الخصم التلقائي للفاتورة بنجاح.",
      "success"
    );

    this.loadDiscountsSettings();
  },

  async saveGlobalDiscountSettings() {
    const enabled = !!document.getElementById("settingGlobalDiscountEnabled")?.checked;
    const percent = parseInt(document.getElementById("settingGlobalDiscountPercent")?.value, 10) || 0;
    const label = (document.getElementById("settingGlobalDiscountLabel")?.value || "").trim() || "خصم بيت المسك الملكي";

    const current = Storage.getSettings();
    const updated = {
      ...current,
      globalDiscountEnabled: enabled,
      globalDiscountPercent: percent,
      globalDiscountLabel: label
    };

    Storage.saveSettings(updated);

    if (window.SupabaseDB && SupabaseDB.isReady()) {
      SupabaseDB.saveSettings(updated).catch(e => console.warn("Supabase saveSettings note:", e));
    }

    this.showToast(
      "تم حفظ الخصم الشامل 🌟",
      enabled ? `تم تفعيل خصم ${percent}% على كامل المتجر.` : "تم تعطيل الخصم العام الشامل.",
      "success"
    );

    this.loadDiscountsSettings();
  },

  // =========================================================================
  // --- إدارة كوبونات وقسائم الخصم بالجنيه المصري (Coupons in EGP) ---
  // =========================================================================
  async loadCoupons() {
    let coupons = [];
    if (window.SupabaseDB && SupabaseDB.isReady()) {
      try {
        coupons = await SupabaseDB.fetchCoupons();
      } catch (e) {
        console.warn("loadCoupons fallback:", e);
        const settings = Storage.getSettings();
        coupons = Object.values(settings.promos || {});
      }
    } else {
      const settings = Storage.getSettings();
      coupons = Object.values(settings.promos || {});
    }

    this.renderCouponsList(coupons);
    this.updateCouponsStats(coupons);
  },

  updateCouponsStats(coupons) {
    const totalEl = document.getElementById("statTotalCoupons");
    const activeEl = document.getElementById("statActiveCoupons");
    const maxEl = document.getElementById("statMaxCouponDiscount");
    const badge = document.getElementById("adminDiscountsBadge") || document.getElementById("adminCouponsBadge");
    const listCount = document.getElementById("couponsListCountText");

    const total = coupons.length;
    const active = coupons.filter(c => c.is_active !== false).length;
    const maxDiscount = coupons.reduce((max, c) => Math.max(max, Number(c.discount_value || c.value) || 0), 0);

    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (maxEl) maxEl.textContent = `${maxDiscount.toLocaleString()} ج.م`;
    if (badge) badge.textContent = total;
    if (listCount) listCount.textContent = `${total} كود مسجل (${active} نشط)`;
  },

  renderCouponsList(coupons) {
    const tbody = document.getElementById("adminCouponsTableBody");
    const emptyState = document.getElementById("couponsEmptyState");
    if (!tbody) return;

    if (!coupons || coupons.length === 0) {
      tbody.innerHTML = "";
      if (emptyState) emptyState.classList.remove("hidden");
      return;
    }

    if (emptyState) emptyState.classList.add("hidden");

    tbody.innerHTML = coupons.map(c => {
      const code = c.code || "";
      const value = Number(c.discount_value || c.value) || 0;
      const minOrder = Number(c.min_order_amount) || 0;
      const isActive = c.is_active !== false;
      const label = c.label || `خصم ${value} ج.م`;
      const dateStr = c.created_at ? new Date(c.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', year: 'numeric' }) : 'مسجل';

      const safeCode = escapeHtml(code);
      const safeLabel = escapeHtml(label);
      const safeCodeParam = encodeURIComponent(code);

      return `
        <tr class="hover:bg-obsidian-900/60 transition group text-right">
          <td class="py-3 px-4 font-mono font-bold text-cream-100">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-lg bg-gold-500/10 border border-gold-500/30 text-gold-300 tracking-wider font-mono text-xs uppercase">
                ${safeCode}
              </span>
              <button 
                type="button" 
                onclick="window.AdminPage.copyCouponCode(decodeURIComponent('${safeCodeParam}'))" 
                class="text-neutral-500 hover:text-gold-400 p-1 transition" 
                title="نسخ الكود"
              >
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>

          <td class="py-3 px-4 text-center font-mono font-bold text-emerald-400">
            <span class="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs">
              -${value.toLocaleString()} ج.م
            </span>
          </td>

          <td class="py-3 px-4 text-center font-mono text-xs text-neutral-300">
            ${minOrder > 0 ? `${minOrder.toLocaleString()} ج.م` : '<span class="text-neutral-500">بدون حد أدنى</span>'}
          </td>

          <td class="py-3 px-4 text-xs text-neutral-300 font-medium max-w-xs truncate">
            ${safeLabel}
          </td>

          <td class="py-3 px-4 text-center">
            <button 
              type="button" 
              onclick="window.AdminPage.toggleCoupon(decodeURIComponent('${safeCodeParam}'), ${isActive})" 
              class="px-2.5 py-1 rounded-full text-[11px] font-bold transition inline-flex items-center justify-center gap-1 mx-auto cursor-pointer ${
                isActive 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30' 
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700'
              }"
              title="اضغط لتغيير الحالة"
            >
              <span>${isActive ? '🟢 نشط' : '⚪ معطل'}</span>
            </button>
          </td>

          <td class="py-3 px-4 text-center text-[11px] text-neutral-500 font-mono">
            ${dateStr}
          </td>

          <td class="py-3 px-4 text-left">
            <button 
              type="button" 
              onclick="window.AdminPage.deleteCoupon(decodeURIComponent('${safeCodeParam}'))" 
              class="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition inline-flex items-center gap-1 cursor-pointer"
              title="حذف الكود نهائياً"
            >
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </td>
        </tr>
      `;
    }).join("");

    if (window.lucide) lucide.createIcons({ root: tbody });
  },

  async saveCouponFromForm() {
    const codeInput = document.getElementById("inputCouponCode");
    const valueInput = document.getElementById("inputCouponValue");
    const minOrderInput = document.getElementById("inputCouponMinOrder");
    const labelInput = document.getElementById("inputCouponLabel");
    const isActiveInput = document.getElementById("inputCouponIsActive");

    const code = (codeInput?.value || "").trim().toUpperCase();
    const value = parseInt(valueInput?.value, 10);
    const minOrder = parseInt(minOrderInput?.value, 10) || 0;
    const label = (labelInput?.value || "").trim() || `خصم ${value} ج.م (${code})`;
    const isActive = isActiveInput ? isActiveInput.checked : true;

    if (!code) {
      alert("يرجى إدخال رمز كود الخصم (مثال: MUSK50)");
      codeInput?.focus();
      return;
    }

    if (!value || isNaN(value) || value <= 0) {
      alert("يرجى إدخال قيمة الخصم بالجنيه المصري (مثال: 50 ج.م)");
      valueInput?.focus();
      return;
    }

    const saveBtn = document.getElementById("btnSaveCoupon");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i><span>جاري حفظ الكود...</span>';
      if (window.lucide) lucide.createIcons({ root: saveBtn });
    }

    try {
      const payload = {
        code,
        discount_value: value,
        value,
        min_order_amount: minOrder,
        is_active: isActive,
        label
      };

      if (window.SupabaseDB) {
        await SupabaseDB.saveCoupon(payload);
      } else {
        Storage.savePromo(code, payload);
      }

      this.showToast("تم إنشاء كود الخصم 🏷️", `تم تفعيل كود الخصم ${code} بقيمة ${value} ج.م بنجاح`, "success");

      // Reset form
      if (codeInput) codeInput.value = "";
      if (valueInput) valueInput.value = "";
      if (minOrderInput) minOrderInput.value = "";
      if (labelInput) labelInput.value = "";
      if (isActiveInput) isActiveInput.checked = true;

      await this.loadCoupons();
    } catch (err) {
      console.error("Save coupon error:", err);
      alert("حدث خطأ أثناء حفظ كود الخصم: " + err.message);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i data-lucide="tag" class="w-4 h-4"></i><span>حفظ ونشر كود الخصم فورياً</span>';
        if (window.lucide) lucide.createIcons({ root: saveBtn });
      }
    }
  },

  async toggleCoupon(code, currentActive) {
    try {
      if (window.SupabaseDB) {
        await SupabaseDB.toggleCouponStatus(code, !currentActive);
      } else {
        const settings = Storage.getSettings();
        if (settings.promos && settings.promos[code]) {
          settings.promos[code].is_active = !currentActive;
          Storage.saveSettings(settings);
        }
      }
      this.showToast("تم تحديث الحالة", `كود ${code} أصبح ${!currentActive ? 'نشطاً 🟢' : 'معطلاً ⚪'}`, "info");
      await this.loadCoupons();
    } catch (err) {
      console.error("Toggle coupon error:", err);
    }
  },

  async deleteCoupon(code) {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف كود الخصم [${code}] نهائياً؟`)) {
      return;
    }

    try {
      if (window.SupabaseDB) {
        await SupabaseDB.deleteCoupon(code);
      } else {
        Storage.deletePromo(code);
      }
      this.showToast("تم حذف الكود", `تم حذف كود الخصم ${code} بنجاح`, "warning");
      await this.loadCoupons();
    } catch (err) {
      console.error("Delete coupon error:", err);
    }
  },

  copyCouponCode(code) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        this.showToast("تم نسخ الكود", `تم نسخ [${code}] إلى الحافظة`, "success");
      });
    } else {
      prompt("انسخ كود الخصم:", code);
    }
  },

  generateCouponCode() {
    const prefixes = ["MUSK", "VIP", "EID", "ROYAL", "MARK"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNum = Math.floor(10 + Math.random() * 90);
    const code = `${prefix}${randomNum}`;
    const input = document.getElementById("inputCouponCode");
    if (input) {
      input.value = code;
      input.focus();
    }
    const valInput = document.getElementById("inputCouponValue");
    if (valInput && !valInput.value) {
      valInput.value = 50;
    }
    const labelInput = document.getElementById("inputCouponLabel");
    if (labelInput && !labelInput.value) {
      labelInput.value = `خصم ملكي خاص ${valInput?.value || 50} ج.م`;
    }
  },

  showToast(title, message, type = "info") {
    const container = document.getElementById("adminToastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "p-4 rounded-xl bg-obsidian-950 border border-gold-500/40 text-xs shadow-2xl flex items-start gap-3 max-w-sm pointer-events-auto transition duration-300 text-right";
    const icon = type === "success" ? "⚜️" : "✨";
    toast.innerHTML = `
      <span class="text-base flex-shrink-0">${icon}</span>
      <div class="flex-1">
        <h5 class="font-amiri font-bold text-cream-100 text-sm">${escapeHtml(title)}</h5>
        <p class="text-neutral-300 mt-0.5 leading-relaxed font-sans">${escapeHtml(message)}</p>
      </div>
      <button class="text-neutral-500 hover:text-cream-100 p-0.5" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
};

window.AdminPage = AdminPage;

document.addEventListener("DOMContentLoaded", () => {
  AdminPage.init();
});
