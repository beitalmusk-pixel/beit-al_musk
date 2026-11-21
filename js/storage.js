/**
 * بيت المسك - إدارة التخزين وحالة المتجر
 * Persistent storage for Products, Shopping Cart, Orders & Promos (Bayt Al Musk Edition)
 */

// Global security utilities (XSS & URL sanitization)
function sanitizeImageUrl(rawUrl, fallback = "assets/logo.jpg") {
  if (!rawUrl || typeof rawUrl !== "string") return fallback;
  const trimmed = rawUrl.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:") || lower.startsWith("data:text/html")) {
    return fallback;
  }
  // Allow relative paths starting with assets/ or / or ./
  if (trimmed.startsWith("assets/") || trimmed.startsWith("./assets/") || trimmed.startsWith("/")) {
    if (/[<>"'\s]/.test(trimmed)) return fallback;
    return trimmed;
  }
  // Allow data:image/... base64 for uploaded local previews
  if (trimmed.startsWith("data:image/")) {
    if (trimmed.includes(";") && trimmed.includes("base64,")) return trimmed;
    return fallback;
  }
  // Validate absolute HTTP/HTTPS URL
  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
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

const STORAGE_KEYS = {
  PRODUCTS: "beit_al_musk_official_catalog_v3",
  CART: "beit_al_musk_cart_v3",
  ORDERS: "beit_al_musk_orders_v3",
  PROMO: "beit_al_musk_active_promo_v3",
  LAST_ORDER: "beit_al_musk_last_order_v3",
  SETTINGS: "beit_al_musk_store_settings_v3"
};

const DEFAULT_SETTINGS = {
  // 1. رقم التواصل وواتساب الإدارة
  whatsappNumber: "+201012345678",
  contactPhone: "+201012345678",

  // 2. محفظة فودافون كاش
  vodafoneCashNumber: "01012345678",
  vodafoneCashName: "بيت المسك للعطور",

  // 3. حساب إنستا باي (InstaPay)
  instapayAccount: "beitalmusk@instapay",
  instapayName: "بيت المسك للعطور الملكية",

  // 4. بيانات الحساب البنكي وتعليمات التحويل
  bankName: "البنك الأهلي المصري",
  bankAccountNumber: "",
  bankIban: "",
  beneficiaryName: "بيت المسك للعطور الملكية",
  paymentInstructions: "يرجى تحويل المبلغ الإجمالي وإرسال إشعار أو سكرين شوت بالتحويل عبر الواتساب لتأكيد خروج الشحنة فوراً.",

  globalDiscountEnabled: false,
  globalDiscountPercent: 0,
  globalDiscountLabel: "خصم بيت المسك",
  // الخصم التلقائي عند وصول الفاتورة لسعر معين (طلب الإدارة)
  thresholdDiscountEnabled: false,
  thresholdAmount: 500, // حد الفاتورة بالجنيه
  thresholdDiscountValue: 50, // قيمة الخصم بالجنيه
  thresholdDiscountLabel: "خصم الطلبات الأكثر من 500 ج.م",
  deliveryFee: 50,
  promos: {}
};

const VALID_PROMOS = {};

try {
  if (!localStorage.getItem("beit_al_musk_clean_offers_v2")) {
    localStorage.removeItem(STORAGE_KEYS.PROMO);
    const existingSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || "null");
    if (existingSettings) {
      existingSettings.globalDiscountEnabled = false;
      existingSettings.globalDiscountPercent = 0;
      existingSettings.promos = {};
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(existingSettings));
    }
    localStorage.setItem("beit_al_musk_clean_offers_v2", "true");
  }
} catch (e) {
  console.warn("Storage cleanup error:", e);
}

const Storage = {
  // --- Product Management ---
  getProducts() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If stored products contain old obsolete IDs or missing podium, migrate to official 4 perfumes
          const hasOld = parsed.some(p => p.id === "nocturne-oud" || p.id === "santal-mystique" || !p.podium);
          if (!hasOld) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn("Error reading products from storage:", e);
    }
    // Default fallback to the 4 official Beit Al-Musk perfumes
    this.saveProducts(window.DEFAULT_PRODUCTS);
    return window.DEFAULT_PRODUCTS;
  },

  saveProducts(products) {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      window.dispatchEvent(new CustomEvent("products:updated", { detail: { products } }));
      return true;
    } catch (e) {
      console.error("Failed to save products:", e);
      return false;
    }
  },

  getProductById(id) {
    const products = this.getProducts();
    return products.find(p => p.id === id) || null;
  },

  saveProduct(productData) {
    const products = this.getProducts();
    const index = products.findIndex(p => p.id === productData.id);
    if (index >= 0) {
      products[index] = { ...products[index], ...productData };
    } else {
      products.push(productData);
    }
    this.saveProducts(products);
    return true;
  },

  deleteProduct(id) {
    let products = this.getProducts();
    products = products.filter(p => p.id !== id);
    this.saveProducts(products);
    return true;
  },

  resetProductsToDefault() {
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    this.saveProducts(window.DEFAULT_PRODUCTS);
    return window.DEFAULT_PRODUCTS;
  },

  // ضغط ومعالجة صور العطور المرفوعة لحفظها بأمان داخل التخزين
  compressImageFile(file, maxWidth = 800, maxHeight = 800, quality = 0.85) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        return reject(new Error("الملف المحدد ليس صورة صالحة"));
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("فشل في قراءة ملف الصورة"));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error("فشل في تحميل الصورة للمعالجة"));
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Output clean JPEG data URL
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(dataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  // --- Cart Management ---
  getCart() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CART);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn("Error reading cart:", e);
      return [];
    }
  },

  saveCart(cart) {
    try {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
      window.dispatchEvent(new CustomEvent("cart:updated", { detail: { cart } }));
      return true;
    } catch (e) {
      console.error("Failed to save cart:", e);
      return false;
    }
  },

  addToCart(productId, size = "50ml", quantity = 1) {
    const product = this.getProductById(productId);
    if (!product) return { success: false, message: "العطر غير متوفر" };

    const sizeData = product.sizes[size] || product.sizes[product.defaultSize] || { price: 250 };
    const unitPrice = sizeData.price;
    const cartItemId = `${productId}_${size}`;

    const cart = this.getCart();
    const existingIndex = cart.findIndex(item => item.cartItemId === cartItemId);

    if (existingIndex >= 0) {
      cart[existingIndex].quantity += Number(quantity);
    } else {
      cart.push({
        cartItemId,
        productId,
        name: product.name,
        brand: product.brand,
        subtitle: product.subtitle,
        size,
        sizeLabel: sizeData.label || size,
        unitPrice,
        quantity: Number(quantity),
        bottleColor: product.visual ? product.visual.bottleColor : "#0f0e13",
        liquidColor: product.visual ? product.visual.liquidColor : "#d4af37",
        accentHex: product.visual ? product.visual.accentHex : "#d4af37"
      });
    }

    this.saveCart(cart);
    return { success: true, item: cart.find(i => i.cartItemId === cartItemId), cart };
  },

  updateCartQuantity(cartItemId, quantity) {
    const cart = this.getCart();
    const index = cart.findIndex(i => i.cartItemId === cartItemId);
    if (index >= 0) {
      if (quantity <= 0) {
        cart.splice(index, 1);
      } else {
        cart[index].quantity = Math.max(1, Math.min(99, Number(quantity)));
      }
      this.saveCart(cart);
    }
    return cart;
  },

  removeFromCart(cartItemId) {
    let cart = this.getCart();
    cart = cart.filter(i => i.cartItemId !== cartItemId);
    this.saveCart(cart);
    return cart;
  },

  clearCart() {
    this.saveCart([]);
    this.removePromo();
  },

  // --- Store Settings & Discounts Management ---
  getSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          promos: { ...DEFAULT_SETTINGS.promos, ...(parsed.promos || {}) }
        };
      }
    } catch (e) {
      console.warn("Error reading settings:", e);
    }
    return { ...DEFAULT_SETTINGS };
  },

  saveSettings(newSettings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...newSettings };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("settings:updated", { detail: { settings: updated } }));
      return true;
    } catch (e) {
      console.error("Failed to save settings:", e);
      return false;
    }
  },

  savePromo(code, promoData) {
    const settings = this.getSettings();
    const cleanCode = (code || "").trim().toUpperCase();
    if (!cleanCode) return false;
    settings.promos = settings.promos || {};
    settings.promos[cleanCode] = {
      code: cleanCode,
      type: promoData.type || "fixed",
      value: Number(promoData.value) || 50,
      min_order_amount: Number(promoData.min_order_amount) || 0,
      is_active: promoData.is_active !== false,
      label: promoData.label || `خصم ${Number(promoData.value) || 50} ج.م (${cleanCode})`,
      created_at: promoData.created_at || new Date().toISOString()
    };
    return this.saveSettings(settings);
  },

  deletePromo(code) {
    const settings = this.getSettings();
    const cleanCode = (code || "").trim().toUpperCase();
    if (settings.promos && settings.promos[cleanCode]) {
      delete settings.promos[cleanCode];
      return this.saveSettings(settings);
    }
    return false;
  },

  // --- Promo Code Management ---
  getActivePromo() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROMO);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  applyPromo(code) {
    const cleanCode = (code || "").trim().toUpperCase();
    const settings = this.getSettings();
    const availablePromos = settings.promos || DEFAULT_SETTINGS.promos || {};
    const promo = availablePromos[cleanCode];

    if (!promo) {
      return { success: false, message: "رمز الخصم غير صالح أو غير موجود. يرجى التأكد من الرمز المدخل." };
    }

    if (promo.is_active === false) {
      return { success: false, message: "عذراً، كود الخصم هذا معطل حالياً." };
    }

    // Check minimum order requirement
    const cart = this.getCart();
    const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    if (promo.min_order_amount > 0 && subtotal < promo.min_order_amount) {
      return {
        success: false,
        message: `يتطلب هذا الكود حداً أدنى للطلب بقيمة ${promo.min_order_amount} ج.م (قيمة سلتك الحالية ${subtotal} ج.م)`
      };
    }

    localStorage.setItem(STORAGE_KEYS.PROMO, JSON.stringify(promo));
    window.dispatchEvent(new CustomEvent("promo:updated", { detail: { promo } }));
    return { success: true, promo };
  },

  removePromo() {
    localStorage.removeItem(STORAGE_KEYS.PROMO);
    window.dispatchEvent(new CustomEvent("promo:updated", { detail: { promo: null } }));
  },

  // --- Calculations ---
  calculateTotals() {
    const cart = this.getCart();
    const promo = this.getActivePromo();
    const settings = this.getSettings();

    const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

    // Fixed shipping fee: 50 EGP (ثابتة لجميع الطلبات والمحافظات)
    const deliveryFee = subtotal === 0 ? 0 : 50;
    const isFreeDelivery = false;
    const deliveryThreshold = 0;
    const freeDeliveryRemaining = 0;

    let discount = 0;
    let discountLabel = "";
    let thresholdDiscount = 0;
    let thresholdLabel = "";

    // 1. Store-wide Global Direct Discount if active
    let globalDisc = 0;
    if (settings.globalDiscountEnabled && settings.globalDiscountPercent > 0 && subtotal > 0) {
      globalDisc = Math.round((subtotal * settings.globalDiscountPercent) / 100);
      discount = globalDisc;
      discountLabel = `${settings.globalDiscountLabel || 'خصم المتجر'} (${settings.globalDiscountPercent}%)`;
    }

    // 2. Automatic Invoice Threshold Discount (خصم بلوغ حد الفاتورة بالجنيه)
    const isThresholdActive = !!settings.thresholdDiscountEnabled;
    const thresholdAmount = Number(settings.thresholdAmount) || 0;
    const thresholdValue = Number(settings.thresholdDiscountValue) || 0;
    const isThresholdReached = isThresholdActive && thresholdAmount > 0 && thresholdValue > 0 && subtotal >= thresholdAmount;

    if (isThresholdReached) {
      thresholdDiscount = Math.min(subtotal, thresholdValue);
      thresholdLabel = settings.thresholdDiscountLabel || `خصم الفاتورة فوق ${thresholdAmount} ج.م`;
      if (thresholdDiscount > discount) {
        discount = thresholdDiscount;
        discountLabel = thresholdLabel;
      }
    }

    // 3. Promo Code Discount (Fixed EGP or Percent)
    let promoDisc = 0;
    if (promo && subtotal > 0) {
      const isEligible = !promo.min_order_amount || subtotal >= promo.min_order_amount;
      if (isEligible && promo.is_active !== false) {
        if (promo.type === "percent") {
          promoDisc = Math.round((subtotal * promo.value) / 100);
        } else {
          // fixed cash discount in EGP (خصم مباشر بالجنيه)
          promoDisc = Math.min(subtotal, promo.value);
        }

        // Stacking: If customer reached the invoice threshold AND also entered a valid promo code!
        if (isThresholdReached && thresholdDiscount > 0) {
          const combined = Math.min(subtotal, thresholdDiscount + promoDisc);
          discount = combined;
          discountLabel = `${thresholdLabel} + كود (${promo.code})`;
        } else if (promoDisc > discount) {
          discount = promoDisc;
          discountLabel = promo.label || `خصم ${promo.value} ج.م (${promo.code})`;
        }
      }
    }

    const grandTotal = Math.max(0, subtotal - discount + deliveryFee);

    return {
      subtotal,
      totalQuantity,
      deliveryFee,
      isFreeDelivery,
      freeDeliveryRemaining,
      deliveryThreshold,
      discount,
      discountLabel,
      promo,
      globalDiscount: settings.globalDiscountEnabled ? settings.globalDiscountPercent : 0,
      thresholdDiscount,
      thresholdLabel,
      thresholdAmount,
      thresholdValue,
      isThresholdActive,
      isThresholdReached,
      thresholdRemaining: Math.max(0, thresholdAmount - subtotal),
      grandTotal
    };
  },

  // --- Orders ---
  getOrders() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ORDERS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  saveOrder(order) {
    const orders = this.getOrders();
    orders.unshift(order);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    localStorage.setItem(STORAGE_KEYS.LAST_ORDER, JSON.stringify(order));
    window.dispatchEvent(new CustomEvent("orders:updated", { detail: { order } }));
    return order;
  },

  deleteOrder(orderId) {
    const orders = this.getOrders().filter(o => o.orderId !== orderId && o.id !== orderId);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    window.dispatchEvent(new CustomEvent("orders:updated", { detail: { orders } }));
    return true;
  },

  updateStock(productId, newStock) {
    const products = this.getProducts();
    const p = products.find(prod => prod.id === productId);
    if (p) {
      p.stock = Math.max(0, parseInt(newStock) || 0);
      this.saveProducts(products);
      window.dispatchEvent(new CustomEvent("products:updated", { detail: { products } }));
      return p;
    }
    return null;
  },

  getLastOrder() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LAST_ORDER);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
};

window.Storage = Storage;
window.VALID_PROMOS = VALID_PROMOS;
