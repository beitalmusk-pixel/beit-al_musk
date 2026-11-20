/**
 * بيت المسك - إتمام الطلب، الفاتورة الرقمية وتكامل الواتساب
 * Checkout & Invoice (Bayt Al Musk Edition)
 */

const Checkout = {
  modalEl: null,
  confirmationModalEl: null,
  invoiceModalEl: null,
  currentOrder: null,

  init() {
    this.modalEl = document.getElementById("checkoutModal");
    this.confirmationModalEl = document.getElementById("confirmationModal");
    this.invoiceModalEl = document.getElementById("invoiceModal");

    this.bindEvents();
  },

  bindEvents() {
    document.querySelectorAll("[data-open-checkout]").forEach(btn => {
      btn.addEventListener("click", () => {
        const cart = Storage.getCart();
        if (cart.length === 0) {
          if (window.app) window.app.showToast("تنبيه", "حقيبة التسوق فارغة، يرجى اختيار عطر أولاً.", "warning");
          return;
        }
        if (window.CartUI) CartUI.closeCart();
        this.openCheckoutModal();
      });
    });

    document.querySelectorAll("[data-close-checkout]").forEach(btn => {
      btn.addEventListener("click", () => this.closeCheckoutModal());
    });

    const form = document.getElementById("checkoutForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.processOrder();
      });
    }

    document.querySelectorAll("[data-close-invoice]").forEach(btn => {
      btn.addEventListener("click", () => this.closeInvoiceModal());
    });

    document.querySelectorAll("[data-print-invoice]").forEach(btn => {
      btn.addEventListener("click", () => window.print());
    });

    document.querySelectorAll("[data-close-confirmation]").forEach(btn => {
      btn.addEventListener("click", () => this.closeConfirmationModal());
    });

    const viewInvoiceBtn = document.getElementById("viewInvoiceFromConfirmBtn");
    if (viewInvoiceBtn) {
      viewInvoiceBtn.addEventListener("click", () => {
        this.closeConfirmationModal();
        this.openInvoiceModal(this.currentOrder || Storage.getLastOrder());
      });
    }

    document.querySelectorAll("input[name='paymentMethod']").forEach(radio => {
      radio.addEventListener("change", () => {
        document.querySelectorAll(".payment-method-card").forEach(c => c.classList.remove("border-gold-500", "bg-gold-500/10"));
        const parent = radio.closest(".payment-method-card");
        if (parent) parent.classList.add("border-gold-500", "bg-gold-500/10");
        this.renderPaymentMethodDetails(radio.value);
      });
    });

    // Make clicking the whole payment card select its radio
    document.querySelectorAll(".payment-method-card").forEach(card => {
      card.addEventListener("click", () => {
        const radio = card.querySelector("input[name='paymentMethod']");
        if (radio) {
          radio.checked = true;
          document.querySelectorAll(".payment-method-card").forEach(c => c.classList.remove("border-gold-500", "bg-gold-500/10"));
          card.classList.add("border-gold-500", "bg-gold-500/10");
          this.renderPaymentMethodDetails(radio.value);
        }
      });
    });

    // Close on backdrop click (outside dialog)
    this.modalEl?.addEventListener("click", (e) => {
      if (e.target === this.modalEl) this.closeCheckoutModal();
    });

    this.confirmationModalEl?.addEventListener("click", (e) => {
      if (e.target === this.confirmationModalEl) this.closeConfirmationModal();
    });

    this.invoiceModalEl?.addEventListener("click", (e) => {
      if (e.target === this.invoiceModalEl) this.closeInvoiceModal();
    });

    // Close on Escape key
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeCheckoutModal();
        this.closeConfirmationModal();
        this.closeInvoiceModal();
      }
    });
  },

  openCheckoutModal() {
    if (!this.modalEl) return;
    this.renderCheckoutSummary();
    this.renderPaymentMethodDetails();
    this.modalEl.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    if (window.gsap) {
      gsap.fromTo(this.modalEl.querySelector(".checkout-dialog"), 
        { scale: 0.95, opacity: 0, y: 20 },
        { scale: 1, opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }
      );
    }
  },

  renderPaymentMethodDetails(method) {
    const box = document.getElementById("paymentTransferInfoBox");
    if (!box) return;

    if (!method) {
      const checked = document.querySelector("input[name='paymentMethod']:checked");
      method = checked ? checked.value : "cod";
    }

    const settings = Storage.getSettings();

    if (method === "vodafone_cash") {
      box.className = "mt-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs space-y-2.5 text-right";
      box.innerHTML = `
        <div class="flex items-center justify-between pb-2 border-b border-red-500/20">
          <span class="font-bold text-red-400 font-amiri text-sm flex items-center gap-1.5">
            <span>📱</span> بيانات تحويل فودافون كاش
          </span>
          <button type="button" id="btnCopyVodafoneCash" class="text-[11px] text-cream-200 bg-red-500/20 hover:bg-red-500/30 px-3 py-1 rounded-lg border border-red-500/40 transition flex items-center gap-1 cursor-pointer">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            <span>نسخ الرقم</span>
          </button>
        </div>
        <div class="flex justify-between items-center text-cream-100">
          <span class="text-neutral-400">رقم المحفظة للتحويل:</span>
          <span class="font-mono font-bold text-base tracking-wider text-red-300" dir="ltr">${settings.vodafoneCashNumber || '01012345678'}</span>
        </div>
        ${settings.vodafoneCashName ? `
        <div class="flex justify-between items-center text-cream-100">
          <span class="text-neutral-400">اسم صاحب المحفظة:</span>
          <span class="font-medium text-cream-100">${settings.vodafoneCashName}</span>
        </div>` : ''}
        <p class="text-[11px] text-neutral-300 pt-1 border-t border-red-500/20 leading-relaxed">
          ${settings.paymentInstructions || 'يرجى تحويل المبلغ الإجمالي إلى رقم المحفظة أعلاه وإرسال إشعار أو سكرين شوت بالتحويل لتأكيد الشحن فوراً.'}
        </p>
      `;

      document.getElementById("btnCopyVodafoneCash")?.addEventListener("click", () => {
        navigator.clipboard?.writeText(settings.vodafoneCashNumber || "01012345678");
        if (window.app) window.app.showToast("تم النسخ", "تم نسخ رقم محفظة فودافون كاش بنجاح 📋", "success");
      });

    } else if (method === "instapay") {
      box.className = "mt-3 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs space-y-2.5 text-right";
      box.innerHTML = `
        <div class="flex items-center justify-between pb-2 border-b border-purple-500/20">
          <span class="font-bold text-purple-400 font-amiri text-sm flex items-center gap-1.5">
            <span>⚡</span> بيانات تحويل إنستا باي (InstaPay)
          </span>
          <button type="button" id="btnCopyInstapay" class="text-[11px] text-cream-200 bg-purple-500/20 hover:bg-purple-500/30 px-3 py-1 rounded-lg border border-purple-500/40 transition flex items-center gap-1 cursor-pointer">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            <span>نسخ الحساب</span>
          </button>
        </div>
        <div class="flex justify-between items-center text-cream-100">
          <span class="text-neutral-400">معرف / رقم إنستاباي:</span>
          <span class="font-mono font-bold text-base tracking-wider text-purple-300" dir="ltr">${settings.instapayAccount || 'beitalmusk@instapay'}</span>
        </div>
        ${settings.instapayName ? `
        <div class="flex justify-between items-center text-cream-100">
          <span class="text-neutral-400">اسم المستلم:</span>
          <span class="font-medium text-cream-100">${settings.instapayName}</span>
        </div>` : ''}
        <p class="text-[11px] text-neutral-300 pt-1 border-t border-purple-500/20 leading-relaxed">
          ${settings.paymentInstructions || 'تحويل بنكي فوري عبر تطبيق InstaPay. يرجى إرفاق إشعار التحويل لتأكيد الشحن فوراً.'}
        </p>
      `;

      document.getElementById("btnCopyInstapay")?.addEventListener("click", () => {
        navigator.clipboard?.writeText(settings.instapayAccount || "beitalmusk@instapay");
        if (window.app) window.app.showToast("تم النسخ", "تم نسخ معرف إنستاباي بنجاح 📋", "success");
      });

    } else if (method === "cod") {
      box.className = "mt-3 p-3.5 rounded-xl bg-gold-500/10 border border-gold-500/25 text-xs text-neutral-300 flex items-center gap-2.5 text-right";
      box.innerHTML = `
        <span class="text-gold-400 text-lg flex-shrink-0">💵</span>
        <span>الدفع نقدًا عند استلام طلبك الملكي وتوصيل القارورة لباب منزلك من المندوب.</span>
      `;
    }

    if (window.lucide) lucide.createIcons({ root: box });
  },

  closeCheckoutModal() {
    if (!this.modalEl) return;
    this.modalEl.classList.add("hidden");
    document.body.style.overflow = "";
  },

  renderCheckoutSummary() {
    const cart = Storage.getCart();
    const totals = Storage.calculateTotals();
    const container = document.getElementById("checkoutOrderItems");

    if (!container) return;

    let itemsHtml = "";
    cart.forEach(item => {
      const prod = Storage.getProductById(item.productId);
      const thumbMarkup = (prod && prod.image) 
        ? `<img src="${prod.image}" alt="${item.name}" class="w-full h-full object-contain">`
        : `<span class="text-[10px]">⚜️</span>`;

      itemsHtml += `
        <div class="flex items-center justify-between py-2.5 border-b border-neutral-800/60 text-xs">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-10 rounded-lg bg-obsidian-950 border border-gold-500/20 flex items-center justify-center p-0.5 overflow-hidden flex-shrink-0">
              ${thumbMarkup}
            </div>
            <span class="w-5 h-5 rounded-full bg-gold-500/20 text-gold-400 font-semibold text-[11px] flex items-center justify-center border border-gold-500/30 font-mono flex-shrink-0">
              ${item.quantity}
            </span>
            <div>
              <p class="font-amiri text-cream-100 font-bold text-sm">${item.name}</p>
              <p class="text-[10px] text-neutral-400 font-sans">${item.size} • ${item.unitPrice.toLocaleString()} ج.م للحبة</p>
            </div>
          </div>
          <span class="font-bold text-gold-400 font-mono">${(item.unitPrice * item.quantity).toLocaleString()} ج.م</span>
        </div>
      `;
    });

    container.innerHTML = itemsHtml;

    document.getElementById("checkoutSummaryQty") && (document.getElementById("checkoutSummaryQty").textContent = totals.totalQuantity);
    document.getElementById("checkoutSummarySubtotal") && (document.getElementById("checkoutSummarySubtotal").textContent = `${totals.subtotal.toLocaleString()} ج.م`);
    
    const deliveryEl = document.getElementById("checkoutSummaryDelivery");
    if (deliveryEl) {
      deliveryEl.innerHTML = `<span class="text-gold-400 font-mono font-bold">50 ج</span> <span class="text-[10px] text-neutral-400 font-normal">(شحن ثابت لكافة المحافظات)</span>`;
    }

    const discountRow = document.getElementById("checkoutSummaryDiscountRow");
    if (discountRow) {
      if (totals.discount > 0) {
        discountRow.classList.remove("hidden");
        document.getElementById("checkoutSummaryDiscount").textContent = `-${totals.discount.toLocaleString()} ج.م`;
      } else {
        discountRow.classList.add("hidden");
      }
    }

    document.getElementById("checkoutSummaryTotal") && (document.getElementById("checkoutSummaryTotal").textContent = `${totals.grandTotal.toLocaleString()} ج.م`);
  },

  processOrder() {
    const form = document.getElementById("checkoutForm");
    if (!form) return;

    const fullNameInput = document.getElementById("checkoutFullName");
    const phoneInput = document.getElementById("checkoutPhone");
    const addressInput = document.getElementById("checkoutAddress");
    const notesInput = document.getElementById("checkoutNotes");

    const fullName = (fullNameInput?.value || "").trim();
    const phone = (phoneInput?.value || "").trim();
    const address = (addressInput?.value || "").trim();
    const notes = (notesInput?.value || "").trim();
    const paymentMethodValue = form.querySelector("input[name='paymentMethod']:checked")?.value || "cod";

    // 1. Anti-Spam Bot Honeypot
    const honey = document.getElementById("muskHoneypot")?.value;
    if (honey) {
      console.warn("Spam bot detected via honeypot field. Dropping submission.");
      return;
    }

    // 2. Client Rate Limiting (Prevent Double Submission / Spamming)
    const nowTime = Date.now();
    if (this.lastOrderTime && (nowTime - this.lastOrderTime < 20000)) {
      if (window.app) window.app.showToast("يرجى الانتظار", "تم استلام طلبكم بالفعل وجاري تجهيزه، يرجى الانتظار قليلاً.", "warning");
      return;
    }

    const highlightField = (inputEl, message) => {
      if (inputEl) {
        inputEl.classList.add("border-red-500", "focus:border-red-500", "ring-2", "ring-red-500/50");
        inputEl.focus();
        inputEl.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          inputEl.classList.remove("border-red-500", "focus:border-red-500", "ring-2", "ring-red-500/50");
        }, 3000);
      }
      if (window.app) window.app.showToast("حقل مطلوب", message, "warning");
    };

    if (!fullName || fullName.length < 3) {
      highlightField(fullNameInput, "يرجى كتابة اسم العميل الكريم بالكامل (الاسم الثنائي على الأقل).");
      return;
    }

    const cleanPhone = phone.replace(/[\s\-\(\)]/g, "");
    const egyptianPhoneRegex = /^(?:\+20|0020|0)?1[0125][0-9]{8}$/;
    if (!cleanPhone || !egyptianPhoneRegex.test(cleanPhone)) {
      highlightField(phoneInput, "يرجى كتابة رقم هاتف مصري صحيح يبدأ بـ 010 أو 011 أو 012 أو 015 لتأكيد الشحن.");
      return;
    }

    if (!address || address.length < 8) {
      highlightField(addressInput, "يرجى كتابة عنوان التوصيل بالتفصيل (المحافظة، المنطقة، اسم الشارع، ورقم العقار).");
      return;
    }

    const cart = Storage.getCart();
    if (cart.length === 0) {
      if (window.app) window.app.showToast("تنبيه", "حقيبة التسوق فارغة، يرجى اختيار عطر أولاً.", "warning");
      this.closeCheckoutModal();
      return;
    }

    // Validate quantities are positive numbers
    const invalidItem = cart.find(i => !i.quantity || i.quantity <= 0);
    if (invalidItem) {
      if (window.app) window.app.showToast("خطأ", "يوجد عنصر بكمية غير صحيحة في الحقيبة.", "error");
      return;
    }

    const totals = Storage.calculateTotals();
    const uniqueNumber = Math.floor(1500 + Math.random() * 8500);
    const orderId = `MUSK-2026-${uniqueNumber}`;
    const now = new Date();

    const paymentLabels = {
      cod: "عند الاستلام (نقداً)",
      vodafone_cash: "فودافون كاش (Vodafone Cash)",
      instapay: "إنستا باي (InstaPay)"
    };

    const paymentLabel = paymentLabels[paymentMethodValue] || "عند الاستلام (نقداً)";

    const orderData = {
      orderId,
      date: now.toISOString(),
      formattedDate: now.toLocaleDateString("ar-EG", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      customer: {
        fullName,
        phone: cleanPhone,
        address,
        notes
      },
      paymentMethod: paymentLabel,
      paymentMethodKey: paymentMethodValue,
      items: [...cart],
      totals: { ...totals }
    };

    const submitBtn = document.getElementById("checkoutSubmitBtn");
    const originalText = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="inline-block animate-spin ml-2">⚜️</span>
        جاري قيد وتأكيد الحجز الملكي...
      `;
    }

    setTimeout(async () => {
      try {
        // 1. Save in Supabase first (Database sequence number & Inventory deduction)
        if (window.SupabaseDB && SupabaseDB.isReady()) {
          try {
            const dbRes = await SupabaseDB.createOrder(orderData);
            if (dbRes && dbRes.orderId) {
              orderData.orderId = dbRes.orderId;
            }
          } catch (supErr) {
            console.warn("Supabase createOrder fallback note:", supErr);
          }
        }

        // 2. Fallback / Parallel CloudDB Firebase sync
        if (window.CloudDB && CloudDB.isCloudActive()) {
          CloudDB.submitOrder(orderData).catch(e => console.warn("Cloud order submission sync:", e));
        }

        // 3. Save to local storage cache
        Storage.saveOrder(orderData);
        this.lastOrderTime = Date.now();
        this.currentOrder = orderData;
        Storage.clearCart();

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }

        this.closeCheckoutModal();
        this.openConfirmationModal(orderData);

        if (window.confetti) {
          window.confetti({
            particleCount: 85,
            spread: 75,
            origin: { y: 0.6 },
            colors: ['#d4af37', '#ffffff', '#e5c07b', '#f8d568']
          });
        }
      } catch (err) {
        console.error("Order processing error:", err);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
        if (window.app) window.app.showToast("خطأ", "حدث خطأ أثناء حفظ الطلب، يرجى المحاولة مجدداً.", "error");
      }
    }, 250);
  },

  openConfirmationModal(order) {
    if (!this.confirmationModalEl) return;

    document.getElementById("confirmOrderNumber") && (document.getElementById("confirmOrderNumber").textContent = order.orderId);
    document.getElementById("confirmCustomerName") && (document.getElementById("confirmCustomerName").textContent = order.customer.fullName);
    document.getElementById("confirmCustomerPhone") && (document.getElementById("confirmCustomerPhone").textContent = order.customer.phone);
    document.getElementById("confirmDeliveryAddress") && (document.getElementById("confirmDeliveryAddress").textContent = order.customer.address);
    document.getElementById("confirmPaymentMethod") && (document.getElementById("confirmPaymentMethod").textContent = order.paymentMethod);
    document.getElementById("confirmGrandTotal") && (document.getElementById("confirmGrandTotal").textContent = `${order.totals.grandTotal.toLocaleString()} ج.م`);

    const transferRow = document.getElementById("confirmTransferDetailsRow");
    const settings = Storage.getSettings();
    if (transferRow) {
      if (order.paymentMethodKey === "vodafone_cash" && settings.vodafoneCashNumber) {
        transferRow.classList.remove("hidden");
        document.getElementById("confirmTransferDetailsLabel").textContent = "محفظة فودافون كاش:";
        document.getElementById("confirmTransferDetailsValue").textContent = settings.vodafoneCashNumber;
      } else if (order.paymentMethodKey === "instapay" && settings.instapayAccount) {
        transferRow.classList.remove("hidden");
        document.getElementById("confirmTransferDetailsLabel").textContent = "حساب إنستا باي:";
        document.getElementById("confirmTransferDetailsValue").textContent = settings.instapayAccount;
      } else {
        transferRow.classList.add("hidden");
      }
    }

    this.setupWhatsAppButton(order);

    this.confirmationModalEl.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    if (window.gsap) {
      gsap.fromTo(this.confirmationModalEl.querySelector(".confirmation-dialog"),
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.4)" }
      );
    }
  },

  closeConfirmationModal() {
    if (!this.confirmationModalEl) return;
    this.confirmationModalEl.classList.add("hidden");
    document.body.style.overflow = "";
  },

  setupWhatsAppButton(order) {
    const waBtn = document.getElementById("whatsappOrderBtn");

    let itemsListText = "";
    order.items.forEach((it, idx) => {
      const sizeText = it.size ? ` (${it.size})` : "";
      itemsListText += `  ${idx + 1}. *${it.name}*${sizeText} × عدد (${it.quantity}) — ${(it.unitPrice * it.quantity).toLocaleString()} ج.م\n`;
    });

    const discountText = order.totals.discount > 0 ? `\n🎁 *خصم بيت المسك:* -${order.totals.discount.toLocaleString()} ج.م` : "";

    const settings = Storage.getSettings();
    let transferNote = "";
    if (order.paymentMethodKey === "vodafone_cash" && settings.vodafoneCashNumber) {
      transferNote = `\n📲 *رقم محفظة فودافون كاش للتحويل:* ${settings.vodafoneCashNumber}${settings.vodafoneCashName ? ` (${settings.vodafoneCashName})` : ''}`;
    } else if (order.paymentMethodKey === "instapay" && settings.instapayAccount) {
      transferNote = `\n⚡ *حساب إنستا باي للتحويل:* ${settings.instapayAccount}${settings.instapayName ? ` (${settings.instapayName})` : ''}`;
    }

    const message = 
`👑 *طلب جديد من متجر بيت المسك • BEIT AL-MUSK*
───────────────────────
👤 *اسم العميل:* ${order.customer.fullName}
📞 *رقم التليفون:* ${order.customer.phone}
📍 *عنوان التوصيل:* ${order.customer.address}
${order.customer.notes ? `📝 *ملاحظات التوصيل:* "${order.customer.notes}"\n` : ""}───────────────────────
🛍️ *المنتجات المطلوبة:*
${itemsListText}───────────────────────
💵 *المجموع الفرعي:* ${order.totals.subtotal.toLocaleString()} ج.م
🚚 *مصاريف الشحن:* 50 ج.م (ثابتة لكافة المحافظات)${discountText}
💰 *الإجمالي النهائي للفاتورة:* ${order.totals.grandTotal.toLocaleString()} ج.م
💳 *طريقة الدفع:* ${order.paymentMethod}${transferNote}
───────────────────────
⚜️ *رقم الفاتورة:* #${order.orderId}
📅 *تاريخ الطلب:* ${order.formattedDate}

✨ شكراً لاختياركم بيت المسك • Leave Your Mark`;

    const encodedMessage = encodeURIComponent(message);
    const rawPhone = settings.whatsappNumber || "+201012345678";
    const cleanPhone = rawPhone.replace(/[^0-9]/g, "");
    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedMessage}` : `https://wa.me/?text=${encodedMessage}`;

    if (waBtn) {
      waBtn.href = waUrl;
      waBtn.target = "_blank";
    }

    return waUrl;
  },

  openInvoiceModal(order) {
    if (!this.invoiceModalEl || !order) return;

    const invoiceContent = document.getElementById("invoiceContent");
    if (!invoiceContent) return;

    let itemsTableRows = "";
    order.items.forEach((item, index) => {
      itemsTableRows += `
        <tr class="border-b border-neutral-800 text-xs text-cream-200">
          <td class="py-3 px-4 font-mono text-neutral-400 text-center">${String(index + 1).padStart(2, '0')}</td>
          <td class="py-3 px-4 text-right">
            <span class="font-amiri font-bold text-cream-100 text-sm block">${item.name}</span>
            <span class="block text-[11px] text-neutral-400 font-sans">${item.brand} • ${item.subtitle || 'Extrait de Parfum'}</span>
          </td>
          <td class="py-3 px-4 text-center">
            <span class="px-2.5 py-0.5 rounded text-[10px] font-mono bg-neutral-900 border border-gold-500/30 text-gold-400 font-bold">${item.size}</span>
          </td>
          <td class="py-3 px-4 text-center font-mono font-bold">${item.quantity}</td>
          <td class="py-3 px-4 text-left font-mono">${item.unitPrice.toLocaleString()} ج.م</td>
          <td class="py-3 px-4 text-left font-mono font-bold text-gold-400">${(item.unitPrice * item.quantity).toLocaleString()} ج.م</td>
        </tr>
      `;
    });

    const deliveryFormatted = "50 ج (شحن ثابت)";

    invoiceContent.innerHTML = `
      <div class="luxury-invoice-sheet bg-obsidian-950 p-8 md:p-12 text-cream-100 border border-gold-500/30 shadow-2xl relative overflow-hidden max-w-3xl mx-auto rounded-2xl text-right" dir="rtl">
        <div class="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none select-none">
          <span class="text-[140px] font-amiri font-bold text-gold-400">بيت المسك</span>
        </div>

        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gold-500/25 pb-8 relative z-10">
          <div class="flex items-center gap-4">
            <img src="assets/logo.jpg" alt="بيت المسك - BEIT AL-MUSK" class="h-16 w-auto object-contain rounded-xl border border-gold-500/30 shadow-md">
            <div>
              <h2 class="font-amiri text-2xl font-bold tracking-wide text-gold-300">بيت المسك • BEIT AL-MUSK</h2>
              <p class="text-xs font-amiri tracking-wider text-gold-400">Leave Your Mark • دار العطور الملكية الفاخرة</p>
              <p class="text-[11px] text-neutral-500 mt-0.5 font-mono">12 Place Vendôme, Paris • Riyadh • Dubai • Cairo</p>
            </div>
          </div>

          <div class="text-right md:text-left">
            <div class="inline-block px-3 py-1 rounded border border-gold-500/30 bg-gold-500/10 text-gold-400 text-xs font-mono font-bold tracking-wider mb-2">
              فاتورة رسمية معتمدة
            </div>
            <p class="font-mono text-sm text-cream-100 font-bold">#INV-${order.orderId.replace("MUSK-", "")}</p>
            <p class="text-xs text-neutral-400 mt-1">تاريخ الإصدار: ${order.formattedDate}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 my-8 text-xs relative z-10">
          <div class="p-4 rounded-xl bg-obsidian-900/60 border border-neutral-800">
            <h4 class="font-amiri font-bold text-gold-400 text-sm mb-2 flex items-center gap-1.5">
              <span>👤</span> بيانات العميل الكريم
            </h4>
            <p class="font-bold text-base text-cream-100 mb-1 font-amiri">${order.customer.fullName}</p>
            <p class="text-neutral-300 font-mono mb-1">📞 ${order.customer.phone}</p>
            <p class="text-neutral-400 leading-relaxed font-sans">📍 ${order.customer.address}</p>
          </div>

          <div class="p-4 rounded-xl bg-obsidian-900/60 border border-neutral-800 flex flex-col justify-between">
            <div>
              <h4 class="font-amiri font-bold text-gold-400 text-sm mb-2 flex items-center gap-1.5">
                <span>📦</span> التوصيل وطريقة الدفع
              </h4>
              <p class="text-neutral-300"><span class="text-neutral-500">طريقة الدفع:</span> ${order.paymentMethod}</p>
              <p class="text-neutral-300 mt-1"><span class="text-neutral-500">نوع الخدمة:</span> شحن VIP مبرد ومؤمن بالكامل من بيت المسك</p>
            </div>
            ${order.customer.notes ? `<p class="text-[11px] text-gold-300/80 italic mt-3 pt-2 border-t border-neutral-800">ملاحظات: "${order.customer.notes}"</p>` : ''}
          </div>
        </div>

        <div class="relative z-10 overflow-x-auto rounded-xl border border-neutral-800 mb-8 bg-obsidian-900/40">
          <table class="w-full text-right border-collapse">
            <thead>
              <tr class="border-b border-gold-500/20 bg-obsidian-900 text-xs font-amiri text-gold-400">
                <th class="py-3 px-4 text-center">#</th>
                <th class="py-3 px-4">وصف العطر الملكي</th>
                <th class="py-3 px-4 text-center">الحجم</th>
                <th class="py-3 px-4 text-center">الكمية</th>
                <th class="py-3 px-4 text-left">سعر الحبة</th>
                <th class="py-3 px-4 text-left">المجموع</th>
              </tr>
            </thead>
            <tbody>
              ${itemsTableRows}
            </tbody>
          </table>
        </div>

        <div class="flex flex-col md:flex-row justify-between items-end gap-6 relative z-10 pt-4 border-t border-neutral-800">
          <div class="flex items-center gap-4">
            <div class="w-20 h-20 rounded-xl border border-gold-500/40 p-2 flex flex-col items-center justify-center bg-obsidian-900/90 text-center">
              <span class="text-[9px] font-amiri font-bold text-gold-400">بيت المسك</span>
              <span class="text-2xl">⚜️</span>
              <span class="text-[8px] font-mono text-neutral-400 uppercase">ختم الأصالة</span>
            </div>
            <div>
              <p class="text-sm font-amiri font-bold text-cream-200">شهادة أصالة معتمدة</p>
              <p class="text-[11px] text-neutral-400 max-w-xs mt-0.5 leading-relaxed">كل قنينة تُخلط وتُرقّم وتُختم في بيت المسك وفقاً لأرقى معايير العطور العالمية.</p>
            </div>
          </div>

          <div class="w-full md:w-72 space-y-2 text-xs">
            <div class="flex justify-between text-neutral-400">
              <span>المجموع الفرعي:</span>
              <span class="font-mono text-cream-100 font-semibold text-sm">${order.totals.subtotal.toLocaleString()} ج.م</span>
            </div>
            ${order.totals.discount > 0 ? `
              <div class="flex justify-between text-emerald-400">
                <span>خصم الامتياز (${order.totals.promo?.code}):</span>
                <span class="font-mono font-semibold text-sm">-${order.totals.discount.toLocaleString()} ج.م</span>
              </div>
            ` : ''}
            <div class="flex justify-between text-neutral-400">
              <span>مصاريف الشحن:</span>
              <span class="font-mono font-semibold text-gold-400">${deliveryFormatted}</span>
            </div>
            <div class="flex justify-between pt-2 border-t border-gold-500/30 text-base font-bold text-cream-100">
              <span class="font-amiri text-gold-300 text-lg">المبلغ الإجمالي للدفع:</span>
              <span class="font-mono text-gold-400 text-xl font-bold">${order.totals.grandTotal.toLocaleString()} ج.م</span>
            </div>
          </div>
        </div>

        <div class="mt-10 pt-6 border-t border-neutral-800/80 text-center relative z-10">
          <p class="font-amiri italic text-neutral-400 text-sm">"بيت المسك — حيث تلتقي فخامة المسك والعود النادر مع أرقى فنون العطور."</p>
          <p class="text-[10px] text-gold-400/60 uppercase tracking-[0.2em] mt-1.5 font-mono">BAYT AL MUSK • PARIS & RIYADH • ALL RIGHTS RESERVED</p>
        </div>
      </div>
    `;

    this.invoiceModalEl.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  },

  closeInvoiceModal() {
    if (!this.invoiceModalEl) return;
    this.invoiceModalEl.classList.add("hidden");
    document.body.style.overflow = "";
  }
};

window.Checkout = Checkout;
