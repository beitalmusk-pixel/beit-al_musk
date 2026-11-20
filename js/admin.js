/**
 * بيت المسك - لوحة إدارة العطور والمنتجات
 * Catalog Management Admin Panel (Arabic Edition)
 */

const Admin = {
  modalEl: null,
  activeEditingId: null,
  currentTab: "products",
  currentUploadedImage: null,

  init() {
    this.modalEl = document.getElementById("adminModal");
    this.bindEvents();
  },

  bindEvents() {
    // Open Admin Modal
    document.querySelectorAll("[data-open-admin]").forEach(btn => {
      btn.addEventListener("click", () => this.openAdminModal());
    });

    // Close Admin Modal
    document.querySelectorAll("[data-close-admin]").forEach(btn => {
      btn.addEventListener("click", () => this.closeAdminModal());
    });

    // Keyboard shortcut: Ctrl + Shift + A
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        this.openAdminModal();
      }
    });

    // Tab Navigation
    const tabProdBtn = document.getElementById("adminTabProductsBtn");
    const tabSetBtn = document.getElementById("adminTabSettingsBtn");
    if (tabProdBtn) {
      tabProdBtn.addEventListener("click", () => this.switchTab("products"));
    }
    if (tabSetBtn) {
      tabSetBtn.addEventListener("click", () => this.switchTab("settings"));
    }

    // Reset to defaults
    const resetBtn = document.getElementById("adminResetDefaultsBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (confirm("هل تريد استعادة مجموعة عطور بيت المسك الملكية الأصلية؟ سيتم إلغاء أي تعديلات مخصصة.")) {
          Storage.resetProductsToDefault();
          this.renderProductsList();
          if (window.app) window.app.showToast("استعادة الكتالوج", "تمت استعادة مجموعة بيت المسك الأصلية بنجاح.", "success");
        }
      });
    }

    // Add new perfume
    const addBtn = document.getElementById("adminAddNewBtn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        this.openEditForm(null);
      });
    }

    // Form submit
    const editForm = document.getElementById("adminProductForm");
    if (editForm) {
      editForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveProductFromForm();
      });
    }

    // Cancel edit
    const cancelFormBtn = document.getElementById("adminCancelEditBtn");
    if (cancelFormBtn) {
      cancelFormBtn.addEventListener("click", () => {
        this.closeEditForm();
      });
    }

    // Save Store Settings (WhatsApp & Discounts)
    const saveSettingsBtn = document.getElementById("adminSaveSettingsBtn");
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener("click", () => this.saveStoreSettings());
    }

    // Test WhatsApp Button
    const testWaBtn = document.getElementById("adminTestWhatsAppBtn");
    if (testWaBtn) {
      testWaBtn.addEventListener("click", () => this.testWhatsAppNumber());
    }

    // Add New Promo Button
    const addPromoBtn = document.getElementById("adminAddPromoBtn");
    if (addPromoBtn) {
      addPromoBtn.addEventListener("click", () => this.addNewPromoCode());
    }

    // Global Discount Checkbox Toggle Listener
    const discountCheck = document.getElementById("adminGlobalDiscountEnabled");
    if (discountCheck) {
      discountCheck.addEventListener("change", (e) => {
        const badge = document.getElementById("adminDiscountStatusBadge");
        if (badge) {
          if (e.target.checked) {
            badge.textContent = "مفعل ومباشر";
            badge.className = "text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold";
          } else {
            badge.textContent = "معطل";
            badge.className = "text-[11px] px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-bold";
          }
        }
      });
    }

    // Embedded Podium Radio listener
    document.querySelectorAll('input[name="adminProdPodium"]').forEach(radio => {
      radio.addEventListener("change", () => this.updateEmbeddedPodiumUI());
    });

    // Embedded Image upload listeners
    const triggerUploadBtn = document.getElementById("btnTriggerEmbeddedImageUpload");
    const fileInput = document.getElementById("embeddedProdImageFileInput");
    const removeImgBtn = document.getElementById("btnRemoveEmbeddedImage");
    const urlInput = document.getElementById("embeddedProdImageUrlInput");

    triggerUploadBtn?.addEventListener("click", () => fileInput?.click());

    fileInput?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const compressedDataUrl = await Storage.compressImageFile(file, 800, 800, 0.85);
        this.currentUploadedImage = compressedDataUrl;
        const imgEl = document.getElementById("embeddedProdImagePreview");
        if (imgEl) imgEl.src = compressedDataUrl;
        if (urlInput) urlInput.value = "";
        if (window.app) window.app.showToast("صورة العطر", "تم تحميل ومعالجة الصورة بنجاح.", "success");
      } catch (err) {
        console.error("Image upload failed:", err);
        alert(err.message || "تعذر معالجة ملف الصورة");
      } finally {
        fileInput.value = "";
      }
    });

    removeImgBtn?.addEventListener("click", () => {
      this.currentUploadedImage = "assets/logo.jpg";
      const imgEl = document.getElementById("embeddedProdImagePreview");
      if (imgEl) imgEl.src = "assets/logo.jpg";
      if (urlInput) urlInput.value = "";
      if (window.app) window.app.showToast("صورة العطر", "تم استعادة الصورة الافتراضية.", "info");
    });

    urlInput?.addEventListener("input", (e) => {
      const url = e.target.value.trim();
      this.currentUploadedImage = url;
      const imgEl = document.getElementById("embeddedProdImagePreview");
      if (imgEl) imgEl.src = url || "assets/logo.jpg";
    });
  },

  updateEmbeddedPodiumUI() {
    const selected = document.querySelector('input[name="adminProdPodium"]:checked')?.value || "men";
    const menCard = document.getElementById("embeddedPodiumMen");
    const womenCard = document.getElementById("embeddedPodiumWomen");

    if (selected === "women") {
      if (menCard) menCard.className = "border-2 border-neutral-800 bg-obsidian-950 p-3 rounded-xl cursor-pointer flex items-center justify-between";
      if (womenCard) womenCard.className = "border-2 border-pink-500 bg-pink-500/10 p-3 rounded-xl cursor-pointer flex items-center justify-between";
    } else {
      if (menCard) menCard.className = "border-2 border-gold-500 bg-gold-500/10 p-3 rounded-xl cursor-pointer flex items-center justify-between";
      if (womenCard) womenCard.className = "border-2 border-neutral-800 bg-obsidian-950 p-3 rounded-xl cursor-pointer flex items-center justify-between";
    }
  },

  switchTab(tabName) {
    this.currentTab = tabName;
    const tabProdBtn = document.getElementById("adminTabProductsBtn");
    const tabSetBtn = document.getElementById("adminTabSettingsBtn");
    const prodList = document.getElementById("adminProductsListPanel");
    const editForm = document.getElementById("adminEditFormPanel");
    const settingsPanel = document.getElementById("adminSettingsPanel");

    if (tabName === "products") {
      if (tabProdBtn) {
        tabProdBtn.className = "admin-tab-btn px-4 py-2 rounded-xl text-xs font-bold font-amiri transition flex items-center gap-2 border border-gold-500/50 bg-gold-500/20 text-gold-300";
      }
      if (tabSetBtn) {
        tabSetBtn.className = "admin-tab-btn px-4 py-2 rounded-xl text-xs font-bold font-amiri transition flex items-center gap-2 border border-neutral-800 text-neutral-400 hover:text-cream-100 hover:border-gold-500/30";
      }
      if (settingsPanel) settingsPanel.classList.add("hidden");
      if (editForm && !editForm.classList.contains("hidden")) {
        // keep edit form
      } else {
        if (prodList) prodList.classList.remove("hidden");
      }
      this.renderProductsList();
    } else if (tabName === "settings") {
      if (tabSetBtn) {
        tabSetBtn.className = "admin-tab-btn px-4 py-2 rounded-xl text-xs font-bold font-amiri transition flex items-center gap-2 border border-gold-500/50 bg-gold-500/20 text-gold-300";
      }
      if (tabProdBtn) {
        tabProdBtn.className = "admin-tab-btn px-4 py-2 rounded-xl text-xs font-bold font-amiri transition flex items-center gap-2 border border-neutral-800 text-neutral-400 hover:text-cream-100 hover:border-gold-500/30";
      }
      if (prodList) prodList.classList.add("hidden");
      if (editForm) editForm.classList.add("hidden");
      if (settingsPanel) settingsPanel.classList.remove("hidden");
      this.renderSettingsPanel();
    }
  },

  openAdminModal() {
    if (!this.modalEl) return;
    this.closeEditForm();
    this.switchTab("products");
    this.modalEl.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  },

  closeAdminModal() {
    if (!this.modalEl) return;
    this.modalEl.classList.add("hidden");
    document.body.style.overflow = "";
  },

  renderSettingsPanel() {
    const settings = Storage.getSettings();

    // 1. WhatsApp & Payment Transfer Details
    const waInput = document.getElementById("adminSettingWhatsApp");
    if (waInput) waInput.value = settings.whatsappNumber || "+201012345678";

    const vodafoneInput = document.getElementById("adminSettingVodafoneCash");
    if (vodafoneInput) vodafoneInput.value = settings.vodafoneCashNumber || "01012345678";

    const vodafoneNameInput = document.getElementById("adminSettingVodafoneCashName");
    if (vodafoneNameInput) vodafoneNameInput.value = settings.vodafoneCashName || "بيت المسك للعطور";

    const instapayInput = document.getElementById("adminSettingInstapay");
    if (instapayInput) instapayInput.value = settings.instapayAccount || "beitalmusk@instapay";

    const instapayNameInput = document.getElementById("adminSettingInstapayName");
    if (instapayNameInput) instapayNameInput.value = settings.instapayName || "بيت المسك للعطور الملكية";

    const instructionsInput = document.getElementById("adminSettingPaymentInstructions");
    if (instructionsInput) instructionsInput.value = settings.paymentInstructions || "يرجى تحويل المبلغ الإجمالي وإرسال إشعار أو سكرين شوت بالتحويل عبر الواتساب لتأكيد خروج الشحنة فوراً.";

    // 2. Global Discount
    const discCheck = document.getElementById("adminGlobalDiscountEnabled");
    const discPercent = document.getElementById("adminGlobalDiscountPercent");
    const discLabel = document.getElementById("adminGlobalDiscountLabel");
    const badge = document.getElementById("adminDiscountStatusBadge");

    if (discCheck) discCheck.checked = !!settings.globalDiscountEnabled;
    if (discPercent) discPercent.value = settings.globalDiscountPercent !== undefined ? settings.globalDiscountPercent : 0;
    if (discLabel) discLabel.value = settings.globalDiscountLabel || "خصم بيت المسك";

    if (badge) {
      if (settings.globalDiscountEnabled) {
        badge.textContent = "مفعل ومباشر";
        badge.className = "text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold";
      } else {
        badge.textContent = "معطل";
        badge.className = "text-[11px] px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-bold";
      }
    }

    // 3. Promos Table
    this.renderPromosTable(settings.promos || {});
  },

  renderPromosTable(promos) {
    const tbody = document.getElementById("adminPromosTableBody");
    if (!tbody) return;

    const entries = Object.entries(promos);
    if (entries.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-neutral-500 text-xs">لا توجد كوبونات إضافية مفعلة حالياً</td></tr>`;
      return;
    }

    let html = "";
    entries.forEach(([code, p]) => {
      const typeLabel = p.type === "percent" ? `${p.value}% خصم` : `${p.value} ج.م خصم`;
      html += `
        <tr class="border-b border-neutral-800/80 hover:bg-neutral-800/30 transition">
          <td class="py-2.5 px-3 font-mono font-bold text-gold-400">${code}</td>
          <td class="py-2.5 px-3 text-center font-mono text-cream-100 font-semibold">${typeLabel}</td>
          <td class="py-2.5 px-3 text-neutral-300">${p.label || "-"}</td>
          <td class="py-2.5 px-3 text-left">
            <button type="button" class="admin-del-promo-btn text-neutral-500 hover:text-red-400 p-1 transition" data-promo-code="${code}" title="حذف الكوبون">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    if (window.lucide) lucide.createIcons({ root: tbody });

    tbody.querySelectorAll(".admin-del-promo-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const code = btn.getAttribute("data-promo-code");
        if (confirm(`هل أنت متأكد من حذف كود الخصم "${code}"؟`)) {
          Storage.deletePromo(code);
          const updated = Storage.getSettings();
          this.renderPromosTable(updated.promos || {});
          if (window.app) window.app.showToast("تم حذف الكود", `تم حذف كود الخصم ${code}.`, "info");
        }
      });
    });
  },

  addNewPromoCode() {
    const codeInput = document.getElementById("adminNewPromoCode");
    const valInput = document.getElementById("adminNewPromoValue");
    const typeSelect = document.getElementById("adminNewPromoType");
    const labelInput = document.getElementById("adminNewPromoLabel");

    const code = (codeInput?.value || "").trim().toUpperCase();
    const val = parseFloat(valInput?.value) || 0;
    const type = typeSelect?.value || "percent";
    const label = (labelInput?.value || "").trim() || `خصم كود ${code}`;

    if (!code) {
      alert("يرجى كتابة رمز كود الخصم أولاً");
      return;
    }
    if (val <= 0) {
      alert("يرجى إدخال قيمة صحيحة للخصم");
      return;
    }

    Storage.savePromo(code, { type, value: val, label });
    if (codeInput) codeInput.value = "";
    if (valInput) valInput.value = "";
    if (labelInput) labelInput.value = "";

    const updated = Storage.getSettings();
    this.renderPromosTable(updated.promos || {});
    if (window.app) window.app.showToast("تمت إضافة كود الخصم", `الكود "${code}" متاح للاستخدام الآن بنجاح.`, "success");
  },

  saveStoreSettings() {
    const waInput = document.getElementById("adminSettingWhatsApp");
    const vodafoneInput = document.getElementById("adminSettingVodafoneCash");
    const vodafoneNameInput = document.getElementById("adminSettingVodafoneCashName");
    const instapayInput = document.getElementById("adminSettingInstapay");
    const instapayNameInput = document.getElementById("adminSettingInstapayName");
    const instructionsInput = document.getElementById("adminSettingPaymentInstructions");

    const discCheck = document.getElementById("adminGlobalDiscountEnabled");
    const discPercent = document.getElementById("adminGlobalDiscountPercent");
    const discLabel = document.getElementById("adminGlobalDiscountLabel");

    const whatsappNumber = (waInput?.value || "").trim() || "+201012345678";
    const vodafoneCashNumber = (vodafoneInput?.value || "").trim() || "01012345678";
    const vodafoneCashName = (vodafoneNameInput?.value || "").trim() || "بيت المسك للعطور";
    const instapayAccount = (instapayInput?.value || "").trim() || "beitalmusk@instapay";
    const instapayName = (instapayNameInput?.value || "").trim() || "بيت المسك للعطور الملكية";
    const paymentInstructions = (instructionsInput?.value || "").trim();

    const globalDiscountEnabled = !!discCheck?.checked;
    const globalDiscountPercent = parseInt(discPercent?.value) || 0;
    const globalDiscountLabel = (discLabel?.value || "").trim() || "خصم بيت المسك";

    Storage.saveSettings({
      whatsappNumber,
      vodafoneCashNumber,
      vodafoneCashName,
      instapayAccount,
      instapayName,
      paymentInstructions,
      globalDiscountEnabled,
      globalDiscountPercent,
      globalDiscountLabel
    });

    if (window.app) {
      window.app.updateStoreDiscountBanner();
      window.app.showToast("تم الحفظ بنجاح", "تم تحديث أرقام الكاش والإنستا وبيانات التواصل بنجاح.", "success");
    }
  },

  testWhatsAppNumber() {
    const waInput = document.getElementById("adminSettingWhatsApp");
    const rawNumber = (waInput?.value || "").trim();
    const cleanNumber = rawNumber.replace(/[^0-9]/g, "");

    if (!cleanNumber) {
      alert("يرجى كتابة رقم هاتف صالح أولاً");
      return;
    }

    const testMsg = `مرحباً بيت المسك (BEIT AL-MUSK)، هذه رسالة تجريبية لتأكيد ربط رقم واتساب الإدارة بالمتجر بنجاح ⚜️.`;
    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(testMsg)}`;
    window.open(url, "_blank");
  },

  renderProductsList() {
    const container = document.getElementById("adminProductsTableBody");
    if (!container) return;

    const products = Storage.getProducts();

    let html = "";
    products.forEach((prod, idx) => {
      const price30 = prod.sizes["30ml"] ? prod.sizes["30ml"].price : "-";
      const price50 = prod.sizes["50ml"] ? prod.sizes["50ml"].price : "-";
      const price100 = prod.sizes["100ml"] ? prod.sizes["100ml"].price : "-";
      const isWomen = prod.podium === "women" || (prod.gender && (prod.gender.includes("حريمي") || prod.gender.includes("نسائي") || prod.gender.includes("Femme")));
      const podiumBadge = isWomen 
        ? `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-pink-500/15 text-pink-300 border border-pink-500/30">🌸 حريمي</span>`
        : `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-gold-500/15 text-gold-300 border border-gold-500/30">👑 رجالي</span>`;
      const stockBadge = prod.stock > 10 
        ? `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${prod.stock} متوفر</span>`
        : `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">متبقي ${prod.stock} فقط</span>`;

      html += `
        <tr class="border-b border-neutral-800/80 hover:bg-neutral-800/30 transition text-xs">
          <td class="py-3 px-4 font-mono text-neutral-400 text-center">${idx + 1}</td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-10 rounded border border-gold-500/30 bg-obsidian-950 flex items-center justify-center overflow-hidden flex-shrink-0">
                ${prod.image 
                  ? `<img src="${prod.image}" alt="${prod.name}" class="w-full h-full object-contain p-0.5">` 
                  : generateBottleSvg(prod, 32, 40)}
              </div>
              <div>
                <p class="font-amiri font-bold text-cream-100 text-sm flex items-center gap-2">
                  <span>${prod.name}</span>
                  ${podiumBadge}
                </p>
                <p class="text-[10px] text-neutral-400 font-sans">${prod.subtitle} • ${prod.category}</p>
              </div>
            </div>
          </td>
          <td class="py-3 px-4 font-mono text-center" dir="ltr">
            <div class="flex items-center justify-center gap-1 text-[11px]">
              <span class="text-neutral-400">${price30} ج.م</span>
              <span class="text-neutral-600">/</span>
              <span class="text-gold-400 font-bold">${price50} ج.م</span>
              <span class="text-neutral-600">/</span>
              <span class="text-cream-200">${price100} ج.م</span>
            </div>
          </td>
          <td class="py-3 px-4 text-center">
            ${stockBadge}
          </td>
          <td class="py-3 px-4 text-left">
            <div class="flex items-center justify-end gap-2">
              <button class="admin-edit-prod-btn px-3 py-1 rounded bg-gold-500/10 text-gold-400 hover:bg-gold-500 hover:text-obsidian-950 text-xs font-bold transition" data-id="${prod.id}">
                تعديل
              </button>
              <button class="admin-delete-prod-btn p-1.5 rounded text-neutral-500 hover:text-red-400 transition" data-id="${prod.id}" title="حذف">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons({ root: container });

    // Bind edit buttons
    container.querySelectorAll(".admin-edit-prod-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.openEditForm(id);
      });
    });

    // Bind delete buttons
    container.querySelectorAll(".admin-delete-prod-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const prod = Storage.getProductById(id);
        if (confirm(`هل أنت متأكد من حذف عطر "${prod?.name}" من الكتالوج؟`)) {
          Storage.deleteProduct(id);
          this.renderProductsList();
          if (window.app) window.app.showToast("تم الحذف", `تم حذف عطر "${prod?.name}".`, "info");
        }
      });
    });
  },

  openEditForm(productId) {
    this.activeEditingId = productId;
    const formPanel = document.getElementById("adminEditFormPanel");
    const listPanel = document.getElementById("adminProductsListPanel");
    const titleEl = document.getElementById("adminFormTitle");

    if (!formPanel || !listPanel) return;

    listPanel.classList.add("hidden");
    formPanel.classList.remove("hidden");

    if (productId) {
      const prod = Storage.getProductById(productId);
      if (!prod) return;

      if (titleEl) titleEl.textContent = `تعديل بيانات العطر: ${prod.name}`;

      document.getElementById("editProdId").value = prod.id;
      document.getElementById("editProdName").value = prod.name;
      document.getElementById("editProdBrand").value = prod.brand;
      document.getElementById("editProdSubtitle").value = prod.subtitle;
      document.getElementById("editProdCategory").value = prod.category;
      document.getElementById("editProdConcentration").value = prod.concentration;
      document.getElementById("editProdStock").value = prod.stock;

      document.getElementById("editProdPrice30").value = prod.sizes["30ml"] ? prod.sizes["30ml"].price : 150;
      document.getElementById("editProdPrice50").value = prod.sizes["50ml"] ? prod.sizes["50ml"].price : 220;
      document.getElementById("editProdPrice100").value = prod.sizes["100ml"] ? prod.sizes["100ml"].price : 340;

      document.getElementById("editProdTopNotes").value = (prod.notes?.top || []).join("، ");
      document.getElementById("editProdHeartNotes").value = (prod.notes?.heart || []).join("، ");
      document.getElementById("editProdBaseNotes").value = (prod.notes?.base || []).join("، ");

      document.getElementById("editProdDescription").value = prod.description;
      document.getElementById("editProdStory").value = prod.story || "";

      document.getElementById("editProdLiquidColor").value = prod.visual?.liquidColor || "#d4af37";
      document.getElementById("editProdCapColor").value = prod.visual?.capColor || "#e5c07b";
      document.getElementById("editProdAccentColor").value = prod.visual?.accentHex || "#d4af37";

      this.currentUploadedImage = prod.image || "assets/logo.jpg";
      const imgEl = document.getElementById("embeddedProdImagePreview");
      if (imgEl) imgEl.src = this.currentUploadedImage;
      const urlInput = document.getElementById("embeddedProdImageUrlInput");
      if (urlInput) urlInput.value = prod.image && !prod.image.startsWith("data:") ? prod.image : "";

      const isWomen = prod ? (prod.podium === "women" || (prod.gender && (prod.gender.includes("حريمي") || prod.gender.includes("نسائي") || prod.gender.includes("Femme")))) : false;
      const menRadio = document.querySelector('input[name="adminProdPodium"][value="men"]');
      const womenRadio = document.querySelector('input[name="adminProdPodium"][value="women"]');
      if (isWomen) {
        if (womenRadio) womenRadio.checked = true;
      } else {
        if (menRadio) menRadio.checked = true;
      }
      this.updateEmbeddedPodiumUI();
    } else {
      if (titleEl) titleEl.textContent = "إضافة عطر ملكي جديد للكتالوج";

      document.getElementById("adminProductForm").reset();
      document.getElementById("editProdId").value = "perfume-" + Date.now();
      document.getElementById("editProdBrand").value = "بيت المسك • BEIT AL-MUSK";
      document.getElementById("editProdSubtitle").value = "خلاصة عطرية ملكية - Extrait de Parfum";
      document.getElementById("editProdStock").value = 12;
      document.getElementById("editProdPrice30").value = 175;
      document.getElementById("editProdPrice50").value = 260;
      document.getElementById("editProdPrice100").value = 390;
      document.getElementById("editProdLiquidColor").value = "#df8a14";
      document.getElementById("editProdCapColor").value = "#d4af37";
      document.getElementById("editProdAccentColor").value = "#d4af37";

      this.currentUploadedImage = "assets/logo.jpg";
      const imgEl = document.getElementById("embeddedProdImagePreview");
      if (imgEl) imgEl.src = "assets/logo.jpg";
      const urlInput = document.getElementById("embeddedProdImageUrlInput");
      if (urlInput) urlInput.value = "";

      const menRadio = document.querySelector('input[name="adminProdPodium"][value="men"]');
      if (menRadio) menRadio.checked = true;
      this.updateEmbeddedPodiumUI();
    }
  },

  closeEditForm() {
    const formPanel = document.getElementById("adminEditFormPanel");
    const listPanel = document.getElementById("adminProductsListPanel");
    if (formPanel) formPanel.classList.add("hidden");
    if (listPanel) listPanel.classList.remove("hidden");
    this.activeEditingId = null;
  },

  saveProductFromForm() {
    const id = document.getElementById("editProdId").value;
    const name = document.getElementById("editProdName").value.trim();
    const brand = document.getElementById("editProdBrand").value.trim();
    const subtitle = document.getElementById("editProdSubtitle").value.trim();
    const category = document.getElementById("editProdCategory").value.trim();
    const concentration = document.getElementById("editProdConcentration").value.trim();
    const stock = parseInt(document.getElementById("editProdStock").value) || 10;

    const p30 = parseFloat(document.getElementById("editProdPrice30").value) || 150;
    const p50 = parseFloat(document.getElementById("editProdPrice50").value) || 220;
    const p100 = parseFloat(document.getElementById("editProdPrice100").value) || 340;

    const splitNotes = (val) => val.split(/[,،]/).map(s => s.trim()).filter(Boolean);
    const topNotes = splitNotes(document.getElementById("editProdTopNotes").value);
    const heartNotes = splitNotes(document.getElementById("editProdHeartNotes").value);
    const baseNotes = splitNotes(document.getElementById("editProdBaseNotes").value);

    const description = document.getElementById("editProdDescription").value.trim();
    const story = document.getElementById("editProdStory").value.trim();

    const liquidColor = document.getElementById("editProdLiquidColor").value;
    const capColor = document.getElementById("editProdCapColor").value;
    const accentHex = document.getElementById("editProdAccentColor").value;

    const selectedPodium = document.querySelector('input[name="adminProdPodium"]:checked')?.value || "men";
    const isWomen = selectedPodium === "women";
    const gender = isWomen ? "حريمي ساحر (Pour Femme)" : "رجالي فاخر (Pour Homme)";
    const podiumTitle = isWomen ? "الجناح النسائي 🌸" : "الجناح الرجالي 👑";

    const image = (this.currentUploadedImage || document.getElementById("embeddedProdImageUrlInput")?.value || existing.image || "assets/logo.jpg").trim();

    const existing = Storage.getProductById(id) || {};

    const updatedProduct = {
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
        top: topNotes.length ? topNotes : ["البرغموت", "الهيل الأخضر"],
        heart: heartNotes.length ? heartNotes : ["الورد الدمشقي", "الياسمين"],
        base: baseNotes.length ? baseNotes : ["العنبر الأسود", "خشب الأرز"]
      },
      description,
      story: story || description,
      visual: {
        bottleColor: existing.visual?.bottleColor || "#0f0e13",
        liquidColor,
        capColor,
        accentHex,
        spotlight: `rgba(${parseInt(accentHex.slice(1,3),16)}, ${parseInt(accentHex.slice(3,5),16)}, ${parseInt(accentHex.slice(5,7),16)}, 0.45)`
      }
    };

    Storage.saveProduct(updatedProduct);
    this.closeEditForm();
    this.renderProductsList();

    if (window.app) window.app.showToast("تم الحفظ بنجاح", `تم حفظ عطر "${name}" في الكتالوج.`, "success");
  }
};

window.Admin = Admin;
