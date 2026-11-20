/**
 * بيت المسك - حقيبة التسوق واختيار المنتجات
 * Shopping Cart Module (Arabic & Luxury RTL Edition)
 */

const CartUI = {
  drawerEl: null,
  cartItemsContainer: null,
  cartCountBadge: null,
  cartSubtotalEl: null,
  cartGrandTotalEl: null,
  cartDiscountRow: null,
  cartDiscountEl: null,
  cartDeliveryEl: null,
  deliveryProgressBar: null,
  deliveryProgressText: null,

  init() {
    this.drawerEl = document.getElementById("cartDrawer");
    this.cartItemsContainer = document.getElementById("cartItemsList");
    this.cartCountBadge = document.getElementById("headerCartCount");
    this.cartSubtotalEl = document.getElementById("cartSubtotal");
    this.cartGrandTotalEl = document.getElementById("cartGrandTotal");
    this.cartDiscountRow = document.getElementById("cartDiscountRow");
    this.cartDiscountEl = document.getElementById("cartDiscount");
    this.cartDeliveryEl = document.getElementById("cartDeliveryFee");
    this.deliveryProgressBar = document.getElementById("deliveryProgressBar");
    this.deliveryProgressText = document.getElementById("deliveryProgressText");

    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // Open cart drawer
    document.querySelectorAll("[data-open-cart]").forEach(btn => {
      btn.addEventListener("click", () => this.openCart());
    });

    // Close cart drawer
    document.querySelectorAll("[data-close-cart]").forEach(btn => {
      btn.addEventListener("click", () => this.closeCart());
    });

    // Listen to storage cart updates
    window.addEventListener("cart:updated", () => this.render());
    window.addEventListener("promo:updated", () => this.render());

    // Promo code apply
    const promoForm = document.getElementById("cartPromoForm");
    if (promoForm) {
      promoForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = document.getElementById("cartPromoInput");
        const rawCode = input ? input.value.trim() : "";
        if (!rawCode) return;

        let res = Storage.applyPromo(rawCode);
        if (!res.success && window.SupabaseDB && SupabaseDB.isReady()) {
          try {
            await SupabaseDB.fetchCoupons();
            res = Storage.applyPromo(rawCode);
          } catch (err) {
            console.warn("Coupon sync error:", err);
          }
        }

        if (res.success) {
          const discountVal = res.promo.value;
          if (window.app) window.app.showToast("⚜️ تم تطبيق كود الخصم!", `تم تفعيل خصم ${discountVal} ج.م بنجاح على طلبك!`, "success");
          if (input) input.value = "";
        } else {
          if (window.app) window.app.showToast("تنبيه بخصوص كود الخصم", res.message, "warning");
        }
      });
    }

    // Remove promo
    const removePromoBtn = document.getElementById("removePromoBtn");
    if (removePromoBtn) {
      removePromoBtn.addEventListener("click", () => {
        Storage.removePromo();
        if (window.app) window.app.showToast("رمز الخصم", "تمت إزالة كود الخصم", "info");
      });
    }
  },

  openCart() {
    if (!this.drawerEl) return;
    this.drawerEl.classList.remove("-translate-x-full", "translate-x-full", "pointer-events-none");
    this.drawerEl.classList.add("translate-x-0");
    document.getElementById("cartBackdrop")?.classList.remove("opacity-0", "pointer-events-none");
    document.getElementById("cartBackdrop")?.classList.add("opacity-100");
    document.body.style.overflow = "hidden";
  },

  closeCart() {
    if (!this.drawerEl) return;
    this.drawerEl.classList.add("-translate-x-full");
    this.drawerEl.classList.remove("translate-x-0");
    document.getElementById("cartBackdrop")?.classList.add("opacity-0", "pointer-events-none");
    document.getElementById("cartBackdrop")?.classList.remove("opacity-100");
    document.body.style.overflow = "";
  },

  render() {
    const cart = Storage.getCart();
    const totals = Storage.calculateTotals();

    // Update cart badge in header and mobile bottom nav
    if (this.cartCountBadge) {
      this.cartCountBadge.textContent = totals.totalQuantity;
      if (totals.totalQuantity > 0) {
        this.cartCountBadge.classList.remove("scale-0");
        this.cartCountBadge.classList.add("scale-100");
      } else {
        this.cartCountBadge.classList.remove("scale-100");
        this.cartCountBadge.classList.add("scale-0");
      }
    }

    const mobileBadge = document.getElementById("mobileBottomCartBadge");
    if (mobileBadge) {
      mobileBadge.textContent = totals.totalQuantity;
      if (totals.totalQuantity > 0) {
        mobileBadge.classList.remove("scale-0");
        mobileBadge.classList.add("scale-100");
      } else {
        mobileBadge.classList.remove("scale-100");
        mobileBadge.classList.add("scale-0");
      }
    }

    // Render items list or empty state
    if (!this.cartItemsContainer) return;

    if (cart.length === 0) {
      this.cartItemsContainer.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-400">
          <div class="w-20 h-20 rounded-full border border-gold-500/30 flex items-center justify-center mb-5 bg-gold-500/5 text-gold-400">
            <i data-lucide="shopping-bag" class="w-8 h-8 opacity-60"></i>
          </div>
          <h3 class="font-amiri text-2xl text-cream-100 tracking-wide mb-2 font-bold">حقيبتك الملكية فارغة</h3>
          <p class="text-xs text-neutral-400 max-w-xs mb-6 font-light leading-relaxed">
            استكشف مجموعتنا من خلاصات جراس النادرة وانطلق في رحلة عطرية استثنائية تأسر الحواس.
          </p>
          <button data-close-cart class="gold-gradient-btn px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider text-obsidian-950 transition hover:shadow-lg hover:shadow-gold-500/20">
            استكشف مجموعة العطور
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons({ root: this.cartItemsContainer });
      this.cartItemsContainer.querySelector("[data-close-cart]")?.addEventListener("click", () => this.closeCart());

      document.getElementById("cartFooterSection")?.classList.add("opacity-50", "pointer-events-none");
    } else {
      document.getElementById("cartFooterSection")?.classList.remove("opacity-50", "pointer-events-none");

      let html = "";
      cart.forEach(item => {
        const itemTotal = item.unitPrice * item.quantity;
        const prod = Storage.getProductById(item.productId);
        const imgMarkup = (prod && prod.image) 
          ? `<img src="${prod.image}" alt="${item.name}" class="w-full h-full object-contain rounded-md">`
          : (prod ? generateBottleSvg(prod, 70, 90) : `<img src="assets/logo.jpg" class="w-full h-full object-contain">`);

        html += `
          <div class="cart-item group relative flex gap-4 p-4 rounded-xl bg-obsidian-900/60 border border-gold-500/15 backdrop-blur-md transition hover:border-gold-500/30 mb-3" data-cart-id="${item.cartItemId}">
            <!-- Bottle Visual -->
            <div class="w-16 h-20 flex-shrink-0 rounded-lg bg-obsidian-950 flex items-center justify-center p-1 border border-gold-500/20 overflow-hidden relative">
              ${imgMarkup}
            </div>

            <!-- Item Info -->
            <div class="flex-1 flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-start gap-2">
                  <h4 class="font-amiri text-base text-cream-100 font-bold tracking-wide leading-tight group-hover:text-gold-300 transition">
                    ${item.name}
                  </h4>
                  <button class="remove-cart-item text-neutral-500 hover:text-red-400 p-1 transition" data-remove-id="${item.cartItemId}" title="حذف">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-[11px] text-neutral-400 font-sans">${item.brand}</span>
                  <span class="text-neutral-600">•</span>
                  <span class="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-400 border border-gold-500/20 font-mono">
                    ${item.size}
                  </span>
                </div>
              </div>

              <!-- Price & Quantity Row -->
              <div class="flex justify-between items-center mt-3 pt-2 border-t border-neutral-800/80">
                <div class="flex items-center gap-1.5 border border-neutral-700 rounded-lg p-0.5 bg-obsidian-950/80">
                  <button class="cart-qty-btn decrease-qty w-6 h-6 rounded flex items-center justify-center text-neutral-400 hover:text-cream-100 hover:bg-neutral-800 text-xs transition" data-cart-id="${item.cartItemId}" data-delta="-1" title="تقليل">
                    <i data-lucide="minus" class="w-3 h-3"></i>
                  </button>
                  <span class="text-xs font-semibold text-cream-100 w-6 text-center select-none font-mono">${item.quantity}</span>
                  <button class="cart-qty-btn increase-qty w-6 h-6 rounded flex items-center justify-center text-neutral-400 hover:text-cream-100 hover:bg-neutral-800 text-xs transition" data-cart-id="${item.cartItemId}" data-delta="1" title="زيادة">
                    <i data-lucide="plus" class="w-3 h-3"></i>
                  </button>
                </div>
                <div class="text-left font-mono">
                  <div class="text-xs text-neutral-500">${item.unitPrice.toLocaleString()} ج.م للحبة</div>
                  <div class="text-sm font-semibold text-gold-400 tracking-wide">${itemTotal.toLocaleString()} ج.م</div>
                </div>
              </div>
            </div>
          </div>
        `;
      });

      this.cartItemsContainer.innerHTML = html;
      if (window.lucide) lucide.createIcons({ root: this.cartItemsContainer });

      // Quantity buttons listener
      this.cartItemsContainer.querySelectorAll(".cart-qty-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const cartId = btn.getAttribute("data-cart-id");
          const delta = parseInt(btn.getAttribute("data-delta"));
          const item = cart.find(i => i.cartItemId === cartId);
          if (item) {
            Storage.updateCartQuantity(cartId, item.quantity + delta);
          }
        });
      });

      // Remove item listener
      this.cartItemsContainer.querySelectorAll(".remove-cart-item").forEach(btn => {
        btn.addEventListener("click", () => {
          const cartId = btn.getAttribute("data-remove-id");
          const parent = btn.closest(".cart-item");
          if (parent && window.gsap) {
            gsap.to(parent, {
              opacity: 0,
              x: -50,
              duration: 0.3,
              onComplete: () => {
                Storage.removeFromCart(cartId);
                if (window.app) window.app.showToast("تحديث الحقيبة", "تمت إزالة العطر من حقيبة التسوق", "info");
              }
            });
          } else {
            Storage.removeFromCart(cartId);
          }
        });
      });
    }

    // Update Totals
    if (this.cartSubtotalEl) this.cartSubtotalEl.textContent = `${totals.subtotal.toLocaleString()} ج.م`;
    if (this.cartGrandTotalEl) this.cartGrandTotalEl.textContent = `${totals.grandTotal.toLocaleString()} ج.م`;

    // Delivery calculation: Fixed 50 EGP
    if (this.cartDeliveryEl) {
      if (totals.subtotal === 0) {
        this.cartDeliveryEl.textContent = "0 ج";
      } else {
        this.cartDeliveryEl.innerHTML = `<span class="text-gold-400 font-bold font-mono">50 ج</span> <span class="text-[10px] text-neutral-400 font-normal">(شحن ثابت)</span>`;
      }
    }

    // Delivery notice: Fixed 50 EGP for all orders
    if (this.deliveryProgressText) {
      this.deliveryProgressText.innerHTML = `🚚 <strong class="text-cream-100">مصاريف الشحن:</strong> <strong class="text-gold-400 font-mono">50 ج</strong> (ثابتة لكافة المحافظات)`;
    }
    if (this.deliveryProgressBar) {
      this.deliveryProgressBar.style.width = "100%";
      this.deliveryProgressBar.className = "h-full bg-gold-500/80 transition-all duration-500";
    }

    // Threshold Milestone / Incentive Notice
    const thresholdNotice = document.getElementById("cartThresholdNotice");
    const thresholdMsg = document.getElementById("cartThresholdMsg");
    const thresholdBadge = document.getElementById("cartThresholdBadge");
    const thresholdProgress = document.getElementById("cartThresholdProgressBar");

    if (thresholdNotice) {
      if (totals.isThresholdActive && totals.thresholdAmount > 0 && totals.thresholdValue > 0 && totals.subtotal > 0) {
        thresholdNotice.classList.remove("hidden");
        const pct = Math.min(100, Math.round((totals.subtotal / totals.thresholdAmount) * 100));
        if (thresholdProgress) thresholdProgress.style.width = `${pct}%`;
        if (thresholdBadge) thresholdBadge.textContent = `${pct}%`;

        if (totals.isThresholdReached) {
          thresholdNotice.className = "mt-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-300 transition space-y-1.5 shadow-sm";
          if (thresholdMsg) thresholdMsg.innerHTML = `🎉 <strong>مبروك!</strong> تم تفعيل خصم <strong>${totals.thresholdValue} ج.م</strong> تلقائياً لتجاوزك ${totals.thresholdAmount} ج.م!`;
          if (thresholdProgress) thresholdProgress.className = "h-full bg-emerald-400 transition-all duration-500 rounded-full";
        } else {
          thresholdNotice.className = "mt-3 p-3 rounded-xl bg-gold-500/10 border border-gold-500/30 text-xs text-gold-300 transition space-y-1.5";
          const remaining = totals.thresholdRemaining;
          if (thresholdMsg) thresholdMsg.innerHTML = `✨ أضف عطوراً بـ <strong class="font-mono text-cream-100">${remaining.toLocaleString()} ج.م</strong> إضافية لتحصل على <strong>خصم ${totals.thresholdValue} ج.م</strong> فوري!`;
          if (thresholdProgress) thresholdProgress.className = "h-full bg-gold-500 transition-all duration-500 rounded-full";
        }
      } else {
        thresholdNotice.classList.add("hidden");
      }
    }

    // Promo / Store Discount Row
    if (this.cartDiscountRow && this.cartDiscountEl) {
      if (totals.discount > 0) {
        this.cartDiscountRow.classList.remove("hidden");
        const discLabel = totals.discountLabel || (totals.promo ? totals.promo.code : 'خصم المتجر');
        this.cartDiscountEl.textContent = `-${totals.discount.toLocaleString()} ج.م (${discLabel})`;
        if (totals.promo) {
          document.getElementById("activePromoTag")?.classList.remove("hidden");
          document.getElementById("activePromoLabel") && (document.getElementById("activePromoLabel").textContent = totals.promo.label);
        } else {
          document.getElementById("activePromoTag")?.classList.add("hidden");
        }
      } else {
        this.cartDiscountRow.classList.add("hidden");
        document.getElementById("activePromoTag")?.classList.add("hidden");
      }
    }
  },

  // Luxury flying particle animation from product button into header bag icon
  animateFlyToCart(originEl) {
    if (!originEl) return;
    const bagBtn = document.querySelector("[data-open-cart]");
    if (!bagBtn) return;

    const startRect = originEl.getBoundingClientRect();
    const targetRect = bagBtn.getBoundingClientRect();

    const particle = document.createElement("div");
    particle.className = "fixed pointer-events-none z-50 rounded-full flex items-center justify-center shadow-lg shadow-gold-500/50";
    particle.style.width = "26px";
    particle.style.height = "26px";
    particle.style.backgroundColor = "#d4af37";
    particle.style.left = `${startRect.left + startRect.width / 2 - 13}px`;
    particle.style.top = `${startRect.top + startRect.height / 2 - 13}px`;
    particle.innerHTML = `<span style="font-size: 13px; color: #08070b; font-weight: bold;">⚜️</span>`;
    document.body.appendChild(particle);

    if (window.gsap) {
      gsap.to(particle, {
        duration: 0.75,
        left: targetRect.left + targetRect.width / 2 - 13,
        top: targetRect.top + targetRect.height / 2 - 13,
        scale: 0.35,
        opacity: 0.9,
        ease: "power2.inOut",
        onComplete: () => {
          particle.remove();
          gsap.fromTo(bagBtn, { scale: 1 }, { scale: 1.25, duration: 0.2, yoyo: true, repeat: 1, ease: "power1.out" });
        }
      });
    } else {
      setTimeout(() => particle.remove(), 700);
    }
  }
};

window.CartUI = CartUI;
