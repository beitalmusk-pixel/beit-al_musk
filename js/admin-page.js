/**
 * بيت المسك - لوحة تحكم إدارة العطور والأسعار
 * Bayt Al Musk - Dedicated Protected Admin Dashboard Controller
 */

const ADMIN_STORAGE_KEY_PASS = "bayt_al_musk_admin_pass_v1";
const ADMIN_STORAGE_KEY_AUTH = "bayt_al_musk_admin_auth_v1";
const DEFAULT_ADMIN_PASSWORD = "musk2026";

function getAdminPassword() {
  return localStorage.getItem(ADMIN_STORAGE_KEY_PASS) || DEFAULT_ADMIN_PASSWORD;
}

function setAdminPassword(newPass) {
  localStorage.setItem(ADMIN_STORAGE_KEY_PASS, newPass);
}

function isAuthenticated() {
  return sessionStorage.getItem(ADMIN_STORAGE_KEY_AUTH) === "true";
}

function setAuthenticated(status) {
  if (status) {
    sessionStorage.setItem(ADMIN_STORAGE_KEY_AUTH, "true");
  } else {
    sessionStorage.removeItem(ADMIN_STORAGE_KEY_AUTH);
  }
}

const AdminPage = {
  activeEditingId: null,
  currentProducts: [],
  currentTab: 'products',
  currentUploadedImage: null,

  init() {
    this.checkAuth();
    this.bindEvents();
    if (window.lucide) lucide.createIcons();
  },

  checkAuth() {
    const loginGate = document.getElementById("adminLoginGate");
    const dashboard = document.getElementById("adminDashboard");

    if (isAuthenticated()) {
      if (loginGate) loginGate.classList.add("hidden");
      if (dashboard) dashboard.classList.remove("hidden");
      this.refreshData();
      if (window.lucide) lucide.createIcons({ root: dashboard });
    } else {
      if (loginGate) loginGate.classList.remove("hidden");
      if (dashboard) dashboard.classList.add("hidden");
      const passInput = document.getElementById("adminPasswordInput");
      if (passInput) {
        passInput.value = "";
        setTimeout(() => passInput.focus(), 100);
      }
    }
  },

  refreshData() {
    this.currentProducts = Storage.getProducts();
    this.renderStats();
    this.renderProductsList();
  },

  bindEvents() {
    // --- Login Form ---
    const loginForm = document.getElementById("adminLoginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("adminPasswordInput");
        const pass = input ? input.value : "";
        this.handleLogin(pass);
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
    document.getElementById("btnAdminLogout")?.addEventListener("click", () => {
      if (confirm("هل تريد تسجيل الخروج وقفل لوحة التحكم؟")) {
        setAuthenticated(false);
        this.checkAuth();
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
    document.getElementById("changePasswordForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const current = document.getElementById("inputCurrentPass")?.value;
      const newP = document.getElementById("inputNewPass")?.value;
      const confirmP = document.getElementById("inputConfirmNewPass")?.value;
      const errBox = document.getElementById("changePassError");

      if (current !== getAdminPassword()) {
        if (errBox) {
          errBox.textContent = "رمز المرور الحالي غير صحيح!";
          errBox.classList.remove("hidden");
        }
        return;
      }

      if (newP.length < 4) {
        if (errBox) {
          errBox.textContent = "يجب أن يتكون الرمز الجديد من 4 خانات على الأقل!";
          errBox.classList.remove("hidden");
        }
        return;
      }

      if (newP !== confirmP) {
        if (errBox) {
          errBox.textContent = "الرمز الجديد وتأكيده غير متطابقين!";
          errBox.classList.remove("hidden");
        }
        return;
      }

      setAdminPassword(newP);
      closePassModal();
      this.showToast("تم الحفظ بنجاح", "تم تغيير رمز المرور السري بنجاح. احتفظ به بأمان.", "success");
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

    // --- Tab Switching (Products vs Payment & Contact Settings) ---
    document.getElementById("adminTabProductsBtn")?.addEventListener("click", () => {
      this.switchTab("products");
    });

    document.getElementById("adminTabPaymentBtn")?.addEventListener("click", () => {
      this.switchTab("payment");
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

    if (src) {
      imgEl.src = src;
      imgEl.classList.remove("hidden");
      if (placeholder) placeholder.classList.add("hidden");
    } else {
      imgEl.src = "assets/logo.jpg";
      imgEl.classList.remove("hidden");
      if (placeholder) placeholder.classList.add("hidden");
    }
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
    this.currentTab = tabName;
    const tabProdBtn = document.getElementById("adminTabProductsBtn");
    const tabPayBtn = document.getElementById("adminTabPaymentBtn");
    const prodSection = document.getElementById("adminProductsSection");
    const paySection = document.getElementById("adminPaymentSection");

    const activeClass = "admin-nav-tab px-5 py-2.5 rounded-xl text-xs font-bold font-amiri transition flex items-center gap-2 border border-gold-500/50 bg-gold-500/20 text-gold-300 shadow-sm shadow-gold-500/10 cursor-pointer";
    const inactiveClass = "admin-nav-tab px-5 py-2.5 rounded-xl text-xs font-bold font-amiri transition flex items-center gap-2 border border-neutral-800 text-neutral-400 hover:text-cream-100 hover:border-gold-500/40 cursor-pointer";

    if (tabName === "products") {
      if (tabProdBtn) tabProdBtn.className = activeClass;
      if (tabPayBtn) tabPayBtn.className = inactiveClass;
      if (prodSection) prodSection.classList.remove("hidden");
      if (paySection) paySection.classList.add("hidden");
      this.refreshData();
    } else if (tabName === "payment") {
      if (tabProdBtn) tabProdBtn.className = inactiveClass;
      if (tabPayBtn) tabPayBtn.className = activeClass;
      if (prodSection) prodSection.classList.add("hidden");
      if (paySection) paySection.classList.remove("hidden");
      this.loadPaymentSettings();
    }

    if (window.lucide) lucide.createIcons();
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

  handleLogin(password) {
    const correctPassword = getAdminPassword();
    const errBox = document.getElementById("loginErrorMessage");

    if (password === correctPassword) {
      if (errBox) errBox.classList.add("hidden");
      setAuthenticated(true);
      this.checkAuth();
      this.showToast("تم الدخول بنجاح", "مرحباً بك في لوحة إدارة بيت المسك", "success");
    } else {
      if (errBox) {
        errBox.classList.remove("hidden");
        const input = document.getElementById("adminPasswordInput");
        if (input) {
          input.classList.add("border-red-500");
          input.focus();
          setTimeout(() => input.classList.remove("border-red-500"), 2000);
        }
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

      html += `
        <div class="glass-card p-5 sm:p-6 rounded-2xl border border-gold-500/20 hover:border-gold-500/40 transition duration-300 relative group flex flex-col justify-between text-right">
          <div>
            <!-- Header Row -->
            <div class="flex items-start justify-between gap-3 mb-4">
              <div class="flex items-center gap-3">
                <div class="w-14 h-18 rounded-xl bg-obsidian-950 border border-gold-500/30 flex items-center justify-center p-1 flex-shrink-0 shadow-inner overflow-hidden">
                  ${prod.image 
                    ? `<img src="${prod.image}" alt="${prod.name}" class="w-full h-full object-contain rounded-lg">` 
                    : generateBottleSvg(prod, 46, 60)}
                </div>
                <div>
                  <span class="text-[10px] text-gold-400 font-semibold font-sans block">${prod.brand}</span>
                  <h3 class="font-amiri text-xl font-bold text-cream-100 tracking-wide">${prod.name}</h3>
                  <p class="text-xs text-neutral-400 mt-0.5">${prod.subtitle} • <span class="text-gold-300">${prod.concentration}</span></p>
                </div>
              </div>

              <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
                ${podiumBadge}
                ${stockBadge}
              </div>
            </div>

            <!-- Description -->
            <p class="text-xs text-neutral-300 leading-relaxed font-light mb-4 line-clamp-2">
              ${prod.description}
            </p>

            <!-- Notes summary -->
            <div class="p-3 rounded-xl bg-obsidian-950/80 border border-neutral-800 text-[11px] space-y-1 mb-4">
              <div><strong class="text-gold-400 font-bold">القمة:</strong> <span class="text-neutral-300">${topNotes}</span></div>
              <div><strong class="text-gold-400 font-bold">القلب:</strong> <span class="text-neutral-300">${heartNotes}</span></div>
              <div><strong class="text-gold-400 font-bold">القاعدة:</strong> <span class="text-neutral-300">${baseNotes}</span></div>
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
            <button class="btn-edit-perfume flex-1 py-2 px-3 rounded-xl border border-gold-500/40 bg-gold-500/10 text-gold-400 hover:bg-gold-500 hover:text-obsidian-950 text-xs font-bold transition flex items-center justify-center gap-1.5" data-id="${prod.id}">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              <span>تعديل المواصفات</span>
            </button>
            <button class="btn-delete-perfume p-2 rounded-xl border border-neutral-800 text-neutral-500 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition" data-id="${prod.id}" title="حذف العطر">
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

    const image = (this.currentUploadedImage || document.getElementById("formProdImageUrlInput")?.value || existing.image || "assets/logo.jpg").trim();

    const existing = Storage.getProductById(id) || {};

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
    this.closeForm();
    this.refreshData();
    this.showToast("تم الحفظ بنجاح", `تم تحديث وحفظ بيانات عطر "${name}" في المتجر.`, "success");
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
        <h5 class="font-amiri font-bold text-cream-100 text-sm">${title}</h5>
        <p class="text-neutral-300 mt-0.5 leading-relaxed font-sans">${message}</p>
      </div>
      <button class="text-neutral-500 hover:text-cream-100 p-0.5" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  AdminPage.init();
});
