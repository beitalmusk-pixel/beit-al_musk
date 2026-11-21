/**
 * بيت المسك - المنسق العام للتطبيق
 * Application Controller (Arabic Edition)
 */

/**
 * URL validation & sanitization function
 * Explicitly rejects javascript:, vbscript:, data:text/html, quotes, script tags, angle brackets, or malformed URLs
 */
function sanitizeImageUrl(rawUrl, fallback = "assets/logo.jpg") {
  if (!rawUrl || typeof rawUrl !== "string") return fallback;
  const trimmed = rawUrl.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:") || lower.startsWith("data:text/html")) {
    return fallback;
  }
  // Allow relative paths starting with assets/ or / or ./
  if (trimmed.startsWith("assets/") || trimmed.startsWith("./assets/") || trimmed.startsWith("/")) {
    // Disallow quotes, script tags or angle brackets
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

/**
 * HTML escape function to prevent harmful HTML / XSS injection
 */
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

class LuxuryApp {
  constructor() {
    this.showroom = null;
    this.currentSpotlightProduct = null;
    this.spotlightSelectedSize = "50ml";
    this.spotlightQuantity = 1;

    // Detail Modal state
    this.modalProduct = null;
    this.modalSelectedSize = "50ml";
    this.modalQuantity = 1;

    // Navigation history for exit button
    this.lastProductSourceSection = "collectionSection";

    // Audio SFX
    this.soundEnabled = false;
    this.audioCtx = null;

    this.init();
  }

  async init() {
    // 1. Initialize Supabase PostgreSQL & Auth if configured
    if (window.SupabaseDB) {
      try {
        const supabaseReady = await SupabaseDB.init();
        if (supabaseReady) {
          await SupabaseDB.fetchSettings();
          await SupabaseDB.fetchPerfumes();
          await SupabaseDB.fetchCoupons();
          SupabaseDB.subscribeToPerfumes((updatedProds) => {
            this.renderCollectionGrid();
            this.renderMobileBottleCarousel();
          });
        }
      } catch (e) {
        console.warn("SupabaseDB init note:", e);
      }
    }

    // 2. Initialize Firebase as secondary cloud layer
    if (window.CloudDB) {
      try {
        const cloudReady = await CloudDB.init();
        if (cloudReady) {
          await CloudDB.fetchSettings();
          await CloudDB.fetchProducts();
          CloudDB.listenToProducts((updatedProds) => {
            this.renderCollectionGrid();
            this.renderMobileBottleCarousel();
          });
        }
      } catch (e) {
        console.warn("CloudDB init note:", e);
      }
    }

    if (window.CartUI) CartUI.init();
    if (window.Checkout) Checkout.init();
    if (window.Admin) Admin.init();

    const showroomContainer = document.getElementById("threeCanvasContainer");
    if (showroomContainer && window.PerfumeShowroom) {
      try {
        this.showroom = new PerfumeShowroom("threeCanvasContainer");
      } catch (err) {
        console.warn("Three.js WebGL initialization fallback:", err);
      }
    }

    this.renderCollectionGrid();
    this.renderMobileBottleCarousel();
    this.updateStoreDiscountBanner();

    const products = Storage.getProducts();
    if (products.length > 0) {
      this.updateSpotlightInfoPanel(products[0]);
    }

    this.setupListeners();

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  setupListeners() {
    const soundBtn = document.getElementById("toggleSoundBtn");
    if (soundBtn) {
      soundBtn.addEventListener("click", () => {
        this.toggleSound();
      });
    }

    document.querySelectorAll("[data-cam-mode]").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-cam-mode");
        document.querySelectorAll("[data-cam-mode]").forEach(b => b.classList.remove("border-gold-500", "text-gold-400"));
        btn.classList.add("border-gold-500", "text-gold-400");
        if (this.showroom) this.showroom.setCameraPreset(mode);
        this.playChime(660);
      });
    });

    const autoRotateBtn = document.getElementById("toggleAutoRotateBtn");
    if (autoRotateBtn) {
      autoRotateBtn.addEventListener("click", () => {
        if (this.showroom) {
          const isRotating = this.showroom.toggleAutoRotate();
          autoRotateBtn.classList.toggle("text-gold-400", isRotating);
          autoRotateBtn.classList.toggle("border-gold-500", isRotating);
          this.showToast("المعرض ثلاثي الأبعاد", isRotating ? "تم تفعيل الدوران التلقائي" : "تم تفعيل نمط التدوير اليدوي", "info");
        }
      });
    }

    // --- Dual Podiums Switching (👑 جناح العطور الرجالية vs 🌸 جناح العطور النسائية vs ⚜️ كلا المنصتين) ---
    const menPodiumBtn = document.getElementById("podiumTabMenBtn");
    const womenPodiumBtn = document.getElementById("podiumTabWomenBtn");
    const allPodiumBtn = document.getElementById("podiumTabAllBtn");

    if (menPodiumBtn) {
      menPodiumBtn.addEventListener("click", () => {
        this.setPodiumActiveTab("men");
        if (this.showroom) this.showroom.switchToPodium("men");
        this.playChime(660);
      });
    }

    if (womenPodiumBtn) {
      womenPodiumBtn.addEventListener("click", () => {
        this.setPodiumActiveTab("women");
        if (this.showroom) this.showroom.switchToPodium("women");
        this.playChime(784);
      });
    }

    if (allPodiumBtn) {
      allPodiumBtn.addEventListener("click", () => {
        this.setPodiumActiveTab("all");
        if (this.showroom) this.showroom.switchToPodium("all");
        this.playChime(587);
      });
    }

    // --- Floating Side Arrows between Men's & Women's Wings ---
    const navPrevBtn = document.getElementById("podiumNavPrevBtn");
    const navNextBtn = document.getElementById("podiumNavNextBtn");

    if (navPrevBtn) {
      navPrevBtn.addEventListener("click", () => {
        if (this.showroom) this.showroom.switchToPodium("men");
        this.playChime(660);
      });
    }

    if (navNextBtn) {
      navNextBtn.addEventListener("click", () => {
        if (this.showroom) this.showroom.switchToPodium("women");
        this.playChime(784);
      });
    }

    const searchInput = document.getElementById("perfumeSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.renderCollectionGrid(e.target.value);
      });
    }

    document.querySelectorAll(".category-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".category-filter-btn").forEach(b => b.classList.remove("active", "border-gold-500", "bg-gold-500/20", "text-gold-300"));
        btn.classList.add("active", "border-gold-500", "bg-gold-500/20", "text-gold-300");
        const category = btn.getAttribute("data-category");
        this.renderCollectionGrid(searchInput ? searchInput.value : "", category);
      });
    });

    document.querySelectorAll("[data-close-detail-modal]").forEach(btn => {
      btn.addEventListener("click", () => this.closeDetailModal());
    });

    window.addEventListener("products:updated", (e) => {
      this.renderCollectionGrid();
      this.renderMobileBottleCarousel();
      if (this.currentSpotlightProduct) {
        const refreshed = Storage.getProductById(this.currentSpotlightProduct.id);
        if (refreshed) this.updateSpotlightInfoPanel(refreshed);
      }
    });

    window.addEventListener("settings:updated", (e) => {
      this.updateStoreDiscountBanner();
      this.renderCollectionGrid();
      this.updateSpotlightCalculations();
      if (window.CartUI) CartUI.render();
    });

    document.querySelectorAll("[data-scroll-to]").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-scroll-to");
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      });
    });

    // Sticky Quick-Buy Button
    const stickyAddBtn = document.getElementById("stickyBarAddBtn");
    if (stickyAddBtn) {
      stickyAddBtn.addEventListener("click", () => {
        if (!this.currentSpotlightProduct) return;
        const res = Storage.addToCart(this.currentSpotlightProduct.id, this.spotlightSelectedSize, 1);
        if (res.success) {
          if (navigator.vibrate) navigator.vibrate(25);
          if (window.CartUI) CartUI.animateFlyToCart(stickyAddBtn);
          this.showToast(
            "أُضيف إلى حقيبتك الملكية",
            `تمت إضافة ${this.currentSpotlightProduct.name} (${this.spotlightSelectedSize}) عبر الشراء السريع.`,
            "success"
          );
          this.playChime(880, 0.15);
        }
      });
    }

    // Showroom Go To Details Button
    const goToDetailsBtn = document.getElementById("showroomGoToDetailsBtn");
    if (goToDetailsBtn) {
      goToDetailsBtn.addEventListener("click", () => {
        this.lastProductSourceSection = "showroomSection";
        const detailsSection = document.getElementById("perfumeDetailsSection");
        if (detailsSection) {
          detailsSection.scrollIntoView({ behavior: "smooth" });
        }
      });
    }

    // Close / Exit Perfume Details Button (X)
    const closeDetailsBtn = document.getElementById("closePerfumeDetailsBtn");
    if (closeDetailsBtn) {
      closeDetailsBtn.addEventListener("click", () => {
        const targetId = this.lastProductSourceSection || "collectionSection";
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth" });
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        this.playChime(500, 0.08);
      });
    }

    this.setupMobileScrollAndNav();
    this.setupSecretAdminAccess();
  }

  // --- Showroom Events ---
  onShowroomBottleHovered(product) {
    if (!product) return;
    this.updateSpotlightInfoPanel(product, false);
    this.playChime(520, 0.05);
  }

  onShowroomBottleSelected(product, autoScroll = false) {
    if (!product) return;
    if (!this.preventShowroomSourceOverride) {
      this.lastProductSourceSection = "showroomSection";
    }
    if (product.podium) {
      this.setPodiumActiveTab(product.podium);
    }
    this.updateSpotlightInfoPanel(product, true);
    this.playChime(740, 0.1);

    if (autoScroll) {
      const detailsSection = document.getElementById("perfumeDetailsSection");
      if (detailsSection) {
        detailsSection.scrollIntoView({ behavior: "smooth" });
      }
    }

    this.triggerBottleIngredientsEruption(product, true);
    this.triggerAromaAuraEffect(product);
  }

  setPodiumActiveTab(mode) {
    const menBtn = document.getElementById("podiumTabMenBtn");
    const womenBtn = document.getElementById("podiumTabWomenBtn");
    const allBtn = document.getElementById("podiumTabAllBtn");

    if (menBtn) {
      menBtn.classList.toggle("active-men", mode === "men");
    }
    if (womenBtn) {
      womenBtn.classList.toggle("active-women", mode === "women");
    }
    if (allBtn) {
      allBtn.classList.toggle("active-all", mode === "all");
    }

    this.updatePodiumNavArrows(mode);
  }

  updatePodiumNavArrows(mode) {
    const prevBtn = document.getElementById("podiumNavPrevBtn");
    const nextBtn = document.getElementById("podiumNavNextBtn");
    if (!prevBtn || !nextBtn) return;

    if (mode === "men") {
      prevBtn.style.opacity = "0.35";
      prevBtn.style.pointerEvents = "none";
      nextBtn.style.opacity = "1";
      nextBtn.style.pointerEvents = "auto";
      nextBtn.classList.add("animate-pulse");
      prevBtn.classList.remove("animate-pulse");
    } else if (mode === "women") {
      prevBtn.style.opacity = "1";
      prevBtn.style.pointerEvents = "auto";
      nextBtn.style.opacity = "0.35";
      nextBtn.style.pointerEvents = "none";
      prevBtn.classList.add("animate-pulse");
      nextBtn.classList.remove("animate-pulse");
    } else {
      prevBtn.style.opacity = "1";
      prevBtn.style.pointerEvents = "auto";
      nextBtn.style.opacity = "1";
      nextBtn.style.pointerEvents = "auto";
      prevBtn.classList.remove("animate-pulse");
      nextBtn.classList.remove("animate-pulse");
    }
  }

  updateStoreDiscountBanner() {
    const banner = document.getElementById("storeDiscountBanner");
    const bannerText = document.getElementById("storeDiscountBannerText");
    if (!banner || !bannerText) return;

    const settings = Storage.getSettings();
    if (settings.globalDiscountEnabled && settings.globalDiscountPercent > 0) {
      banner.classList.remove("hidden");
      bannerText.textContent = `${settings.globalDiscountLabel || 'عرض حصري'} — خصم خاص ${settings.globalDiscountPercent}% على جميع عطور بيت المسك الملكية!`;
    } else {
      banner.classList.add("hidden");
    }
  }

  // --- Play Royal Fragrance Burst Sound SFX ---
  playFragranceBurstSound() {
    if (!this.soundEnabled && !this.audioCtx) return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const notes = [659, 830, 987, 1318]; // E5, G#5, B5, E6
      const now = this.audioCtx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.045, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.35);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.35);
      });
    } catch (e) {
      // AudioContext policy
    }
  }

  // --- Trigger Authentic Perfume Ingredients Eruption from Bottle Opening ---
  triggerBottleIngredientsEruption(product, userTriggered = false) {
    const overlay = document.getElementById("bottleIngredientsBurstOverlay");
    if (!overlay || !product) return;

    // Clear previous eruption elements
    overlay.innerHTML = "";

    if (userTriggered) {
      this.playFragranceBurstSound();
    }

    // Authentic ingredient data for Beit Al-Musk official fragrances
    const officialIngredientsMap = {
      "moon-night": {
        glow: "#a855f7",
        ingredients: [
          { name: "فراولة برية", icon: "🍓", role: "نفحة فاكهية عليا", color: "#f43f5e" },
          { name: "توت أسود", icon: "🫐", role: "توت العليق الملكي", color: "#3b0764" },
          { name: "بشر برغموت", icon: "🍋", role: "انتعاش حمضي مشرق", color: "#84cc16" },
          { name: "زهرة البنفسج", icon: "💜", role: "سحر مخملي ليلي", color: "#a855f7" },
          { name: "ياسمين ملكي", icon: "🤍", role: "أناقة زهرية نقية", color: "#ffffff" },
          { name: "عنبر ملكي", icon: "🪔", role: "دفء عنبري مترف", color: "#d97706" },
          { name: "أخشاب نبيلة", icon: "🪵", role: "عمق خشبي فخم", color: "#78350f" },
          { name: "مسك وفانيليا", icon: "✨", role: "نعومة مسك دافئة", color: "#facc15" }
        ],
        sprayEmojis: ['🫐', '🍓', '💜', '✨', '🍇', '✨', '🪵', '🤍', '🌙']
      },
      "sakura": {
        glow: "#ec4899",
        ingredients: [
          { name: "زهر الكرز (ساكورا)", icon: "🌸", role: "الرائحة الأيقونية الآسرة", color: "#fb7185" },
          { name: "زهور الفاوانيا", icon: "🌺", role: "انتعاش الزهور الربيعية", color: "#f472b6" },
          { name: "ماندرين يوسفي", icon: "🍊", role: "إشراقة حمضية راقية", color: "#fb923c" },
          { name: "زنبق الوادي", icon: "🤍", role: "صفاء ملكي ناصع", color: "#ffffff" },
          { name: "ورد جوري", icon: "🌹", role: "بتلات مخملية فاخرة", color: "#e11d48" },
          { name: "مسك أبيض نقي", icon: "🕊️", role: "نقاء مسك بيت المسك", color: "#f1f5f9" },
          { name: "خشب الصندل", icon: "🪵", role: "ثبات أسطوري مخملي", color: "#b45309" },
          { name: "عنبر وزعفران", icon: "🪔", role: "دفء شرقي ساحر", color: "#d97706" }
        ],
        sprayEmojis: ['🌸', '🌺', '✨', '🍃', '🤍', '🌸', '🕊️', '✨', '🍊']
      },
      "miss-allure": {
        glow: "#f43f5e",
        ingredients: [
          { name: "فراولة برية", icon: "🍓", role: "نضارة غنية ومغرية", color: "#f43f5e" },
          { name: "توت العليق الأسود", icon: "🫐", role: "نوتة فاكهية فاخرة", color: "#4c0519" },
          { name: "ورد جوري ملكي", icon: "🌹", role: "فخامة الورد الملكي", color: "#e11d48" },
          { name: "ورد تركي", icon: "🌸", role: "عبير البساتين الآسر", color: "#fb7185" },
          { name: "ياسمين ملكي", icon: "🤍", role: "نقاء زهري ساحر", color: "#ffffff" },
          { name: "زنبق الوادي", icon: "💐", role: "أنوثة فائقة ورقة", color: "#34d399" },
          { name: "مسك ناعم", icon: "🕊️", role: "عناق مسكي رقيق ومثير", color: "#fce7f3" },
          { name: "فانيليا مدغشقرية", icon: "🍦", role: "دفء فانيليا نقي مترف", color: "#fbbf24" }
        ],
        sprayEmojis: ['🌹', '🍓', '🫐', '✨', '🌸', '💐', '🕊️', '🍦', '💖']
      },
      "sokoon": {
        glow: "#d4af37",
        ingredients: [
          { name: "برغموت إيطالي", icon: "🍋", role: "انتعاش حمضي مشرق", color: "#84cc16" },
          { name: "فانيلا مخملية", icon: "🍦", role: "حلاوة ناعمة لا تُقاوم", color: "#fef08a" },
          { name: "ياسمين نقي", icon: "🤍", role: "سحر زهري أنثوي ناعم", color: "#ffffff" },
          { name: "بتلات الورد", icon: "🌸", role: "رقة زهرية آسرة", color: "#f472b6" },
          { name: "عنبر دافئ", icon: "🪔", role: "دفء عنبري مترف", color: "#d97706" },
          { name: "مسك أبيض فاخر", icon: "🌿", role: "نقاء يدوم طوال اليوم", color: "#e2e8f0" }
        ],
        sprayEmojis: ['✨', '🍋', '🤍', '🌸', '🍦', '🪔', '🌿', '💎', '✨']
      }
    };

    let items = [];
    let glowColor = (product.visual && product.visual.accentHex) || '#d4af37';
    let sprayEmojis = ['✨', '🌸', '🤍', '🌿', '🪔'];

    if (officialIngredientsMap[product.id]) {
      items = officialIngredientsMap[product.id].ingredients;
      glowColor = officialIngredientsMap[product.id].glow;
      sprayEmojis = officialIngredientsMap[product.id].sprayEmojis;
    } else if (product.notes) {
      const top = (product.notes.top || []).map(n => typeof n === 'string' ? { name: n, icon: '🍋', role: 'نوتة عليا' } : n);
      const heart = (product.notes.heart || []).map(n => typeof n === 'string' ? { name: n, icon: '🌸', role: 'قلب العطر' } : n);
      const base = (product.notes.base || []).map(n => typeof n === 'string' ? { name: n, icon: '🪵', role: 'قاعدة العطر' } : n);
      items = [...top, ...heart, ...base];
      if (items.length === 0 && product.accords) {
        items = product.accords.map(a => ({ name: a, icon: '✨', role: 'نفحة متناغمة' }));
      }
    }

    // 1. Spout glowing aromatic vapour cloud from the bottle opening
    const vapour = document.createElement("div");
    vapour.className = "bottle-vapour-cloud";
    vapour.style.background = `radial-gradient(ellipse at bottom, ${glowColor}70 0%, rgba(212, 175, 55, 0.35) 45%, transparent 75%)`;
    overlay.appendChild(vapour);

    // Responsive scaling for desktop vs mobile
    const isMobile = window.innerWidth < 640;
    const scale = isMobile ? 0.72 : 1.0;

    // Harmonious curved positions surrounding the bottle
    let basePositions = [
      { x: -115, y: -62, rot: -7 },   // Top Left (shoulder)
      { x: 115,  y: -62, rot: 7 },    // Top Right (shoulder)
      { x: 0,    y: -95, rot: 0 },    // Top Center (above cap)
      { x: -135, y: 15,  rot: -10 },  // Mid Left (waist)
      { x: 135,  y: 15,  rot: 10 },   // Mid Right (waist)
      { x: -125, y: 90,  rot: -5 },   // Lower Left
      { x: 125,  y: 90,  rot: 5 },    // Lower Right
      { x: 0,    y: 150, rot: 0 }     // Bottom Center (pedestal)
    ];

    if (items.length === 6) {
      basePositions = [
        { x: -115, y: -58, rot: -6 },
        { x: 115,  y: -58, rot: 6 },
        { x: -135, y: 22,  rot: -9 },
        { x: 135,  y: 22,  rot: 9 },
        { x: -120, y: 98,  rot: -5 },
        { x: 120,  y: 98,  rot: 5 }
      ];
    }

    // 2. Spawn authentic ingredient capsules erupting from the bottle
    items.forEach((item, idx) => {
      const pos = basePositions[idx % basePositions.length];
      const targetX = Math.round(pos.x * scale);
      const targetY = Math.round(pos.y * scale);
      const targetRot = pos.rot;

      const badge = document.createElement("div");
      badge.className = "bottle-ingredient-badge";
      badge.setAttribute("data-ingredient-name", item.name);
      badge.style.setProperty("--target-x", `${targetX}px`);
      badge.style.setProperty("--target-y", `${targetY}px`);
      badge.style.setProperty("--target-rot", `${targetRot}deg`);
      badge.style.setProperty("--badge-glow", item.color || glowColor);
      badge.style.animationDelay = `${idx * 0.07}s, ${0.75 + idx * 0.07}s`;

      badge.innerHTML = `
        <span class="ingredient-icon-halo">${escapeHtml(item.icon || '✨')}</span>
        <span>${escapeHtml(item.name)}</span>
      `;

      badge.addEventListener("click", (e) => {
        e.stopPropagation();
        badge.classList.add("highlighted");
        this.playChime(640 + idx * 55, 0.2);
        this.showToast(item.name, `${item.role || 'مكون أساسي فاخر'} في تركيبة ${product.name} ⚜️`, "info");

        // Highlight matching note card in olfactory pyramid
        document.querySelectorAll(".note-ingredient-card").forEach(c => {
          const cardName = c.getAttribute("data-note-name") || "";
          if (cardName && (cardName.includes(item.name.slice(0, 3)) || item.name.includes(cardName.slice(0, 3)))) {
            c.classList.add("active-note");
            setTimeout(() => c.classList.remove("active-note"), 2600);
          }
        });

        setTimeout(() => badge.classList.remove("highlighted"), 2000);
      });

      overlay.appendChild(badge);
    });

    // 3. Spawn micro-particles spraying outwards from the nozzle
    const particleCount = isMobile ? 14 : 22;
    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement("div");
      p.className = "bottle-erupt-particle";
      p.textContent = sprayEmojis[Math.floor(Math.random() * sprayEmojis.length)];

      const angle = (Math.PI * 2 * (i / particleCount)) + (Math.random() * 0.4 - 0.2);
      const distance = (65 + Math.random() * 115) * scale;
      const px = Math.round(Math.cos(angle) * distance);
      const py = Math.round(Math.sin(angle) * distance - (25 * scale));
      const duration = 2.0 + Math.random() * 1.4;
      const rot = Math.round((Math.random() - 0.5) * 360);
      const fontSize = Math.round(14 + Math.random() * 14);

      p.style.fontSize = `${fontSize}px`;
      p.style.setProperty("--px", `${px}px`);
      p.style.setProperty("--py", `${py}px`);
      p.style.setProperty("--prot", `${rot}deg`);
      p.style.setProperty("--pduration", `${duration}s`);
      p.style.animationDelay = `${Math.random() * 0.3}s`;

      overlay.appendChild(p);
    }

    // Celebratory golden & petal confetti
    if (window.confetti && (product.id === "sakura" || userTriggered)) {
      confetti({
        particleCount: isMobile ? 22 : 36,
        spread: 65,
        origin: { y: 0.65 },
        colors: product.id === "moon-night" ? ['#a855f7', '#6b21a8', '#d4af37'] :
                product.id === "miss-allure" ? ['#f43f5e', '#fda4af', '#d4af37'] :
                ['#f472b6', '#fbcfe8', '#d4af37']
      });
    }
  }

  // --- Trigger Eye-Catching Aroma Aura Particle Explosion ---
  triggerAromaAuraEffect(product) {
    const container = document.getElementById("scentAuraContainer");
    if (!container || !product) return;

    // Clear previous particles
    container.innerHTML = "";

    // Themed scent particle emojis based on perfume profile
    let emojis = ['✨', '🌸', '🤍', '🌿', '🪔'];
    if (product.id === "sakura") {
      emojis = ['🌸', '🌺', '🍃', '✨', '🤍', '🌸', '🌸', '✨'];
    } else if (product.id === "sokoon") {
      emojis = ['✨', '🤍', '🍋', '🌿', '🌼', '🍦', '✨', '🤍'];
    } else if (product.id === "moon-night") {
      emojis = ['🌙', '🫐', '✨', '💜', '🪵', '✨', '🫐', '🍇'];
    } else if (product.id === "miss-allure") {
      emojis = ['🌹', '🍓', '💖', '✨', '💐', '🌹', '✨', '🍓'];
    }

    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement("div");
      p.className = "aroma-particle";
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];

      const left = Math.random() * 88 + 6; // 6% to 94% across width
      const bottom = Math.random() * 60; // 0px to 60px
      const delay = Math.random() * 1.6;
      const size = Math.random() * 16 + 16; // 16px to 32px
      const duration = 3.2 + Math.random() * 1.6;

      p.style.left = `${left}%`;
      p.style.bottom = `${bottom}px`;
      p.style.fontSize = `${size}px`;
      p.style.animationDelay = `${delay}s`;
      p.style.animationDuration = `${duration}s`;

      container.appendChild(p);
    }
  }

  updateSpotlightInfoPanel(product, animate = false) {
    this.currentSpotlightProduct = product;
    const panel = document.getElementById("perfumeDetailsSection");
    if (!panel) return;

    this.spotlightQuantity = 1;
    if (!product.sizes[this.spotlightSelectedSize]) {
      this.spotlightSelectedSize = product.defaultSize || "50ml";
    }

    const currentPrice = product.sizes[this.spotlightSelectedSize]?.price || 245;

    // Showroom top badge (names only without price)
    const badgeName = document.getElementById("showroomActivePerfumeNameBadge");
    if (badgeName) badgeName.textContent = product.name;

    const nameEl = document.getElementById("spotlightPerfumeName");
    const brandEl = document.getElementById("spotlightBrandName");
    const subtitleEl = document.getElementById("spotlightSubtitle");
    const descEl = document.getElementById("spotlightDescription");
    const storyEl = document.getElementById("spotlightStoryText");
    const stockEl = document.getElementById("spotlightStockBadge");
    const badgeTagEl = document.getElementById("spotlightBadgeTag");
    const previewEl = document.getElementById("spotlightVisualThumb");
    const realImgEl = document.getElementById("spotlightRealImage");

    if (nameEl) nameEl.textContent = product.name;
    if (brandEl) brandEl.textContent = product.brand;
    if (subtitleEl) subtitleEl.textContent = `${product.subtitle} • ${product.concentration}`;
    if (descEl) descEl.textContent = product.description;
    if (storyEl) storyEl.textContent = product.story || product.description;
    if (badgeTagEl) badgeTagEl.textContent = product.badge || "عطر ملكي فاخر";

    if (stockEl) {
      if (product.stock === 0) {
        stockEl.innerHTML = `🚫 <span class="text-red-400 font-bold">نفذت الكمية بالكامل — سيتوفر قريباً</span>`;
      } else if (product.stock <= 5) {
        stockEl.innerHTML = `⚠️ <span class="text-amber-400 font-semibold">إصدار نادر — متبقي ${product.stock} قوارير فقط</span>`;
      } else {
        stockEl.innerHTML = `⚜️ <span class="text-emerald-400 font-semibold">متوفر في المعمل (${product.stock} زجاجة جاهزة للتسليم)</span>`;
      }
    }

    // High-Resolution Authentic Product Artwork
    if (realImgEl && product.image) {
      realImgEl.src = sanitizeImageUrl(product.image);
      realImgEl.alt = `${escapeHtml(product.name)} - بيت المسك`;
    }

    // 3D Vector Alternative
    if (previewEl) {
      previewEl.innerHTML = generateBottleSvg(product, 180, 230);
    }

    // Setup Photo vs Vector toggle buttons
    const viewPhotoBtn = document.getElementById("viewRealPhotoBtn");
    const viewVectorBtn = document.getElementById("viewVectorSvgBtn");
    const photoWrapper = document.getElementById("spotlightRealPhotoWrapper");

    if (viewPhotoBtn && viewVectorBtn && photoWrapper && previewEl) {
      viewPhotoBtn.onclick = () => {
        photoWrapper.classList.remove("hidden");
        photoWrapper.classList.add("flex");
        previewEl.classList.add("hidden");
        previewEl.classList.remove("flex");
        viewPhotoBtn.classList.add("text-gold-400", "bg-gold-500/20", "font-bold");
        viewPhotoBtn.classList.remove("text-neutral-400");
        viewVectorBtn.classList.remove("text-gold-400", "bg-gold-500/20", "font-bold");
        viewVectorBtn.classList.add("text-neutral-400");
      };

      viewVectorBtn.onclick = () => {
        photoWrapper.classList.add("hidden");
        photoWrapper.classList.remove("flex");
        previewEl.classList.remove("hidden");
        previewEl.classList.add("flex");
        viewVectorBtn.classList.add("text-gold-400", "bg-gold-500/20", "font-bold");
        viewVectorBtn.classList.remove("text-neutral-400");
        viewPhotoBtn.classList.remove("text-gold-400", "bg-gold-500/20", "font-bold");
        viewPhotoBtn.classList.add("text-neutral-400");
      };
    }

    // Click photo or bottle to trigger authentic ingredients eruption!
    if (photoWrapper) {
      photoWrapper.onclick = (e) => {
        if (e.target.closest("#zoomPhotoModalBtn")) {
          this.openDetailModal(product);
        } else {
          this.triggerBottleIngredientsEruption(product, true);
          this.showToast(product.name, `🌸 تم إطلاق مكونات ونفحات ${product.name} مباشرة من الزجاجة!`, "success");
        }
      };
    }

    // Trigger Aroma & Ingredients Button
    const triggerAromaBtn = document.getElementById("triggerAromaEffectBtn");
    if (triggerAromaBtn) {
      triggerAromaBtn.onclick = () => {
        this.triggerBottleIngredientsEruption(product, true);
        this.triggerAromaAuraEffect(product);
        this.showToast("مكونات القنينة الملكية", `تم إطلاق نفحات ومكونات ${product.name} 🌸`, "success");
      };
    }

    // Automatically trigger ingredients eruption for active bottle
    this.triggerBottleIngredientsEruption(product, false);

    // Render 3-Tier Interactive Olfactory Pyramid
    this.renderOlfactoryPyramid(product);

    this.renderSpotlightSizeButtons(product);
    this.updateSpotlightCalculations();
    this.bindSpotlightActionButtons(product);
    this.updateMobileStickyBar(product);
    this.updateMobileCarouselSelection(product);

    if (animate && window.gsap) {
      gsap.fromTo(panel, 
        { opacity: 0.9, y: 8 }, 
        { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }
      );
    }
  }

  // --- Render 3-Tier Interactive Olfactory Pyramid with Effects ---
  renderOlfactoryPyramid(product) {
    if (!product || !product.notes) return;

    const renderTierRow = (containerId, notesList, defaultTone = 600) => {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (!Array.isArray(notesList) || notesList.length === 0) {
        container.innerHTML = `<span class="text-xs text-neutral-500">نوتات نقية متناغمة</span>`;
        return;
      }

      container.innerHTML = notesList.map((note, idx) => {
        const name = typeof note === 'string' ? note : note.name;
        const en = typeof note === 'object' ? (note.en || '') : '';
        const icon = typeof note === 'object' ? (note.icon || '✨') : '✨';
        const role = typeof note === 'object' ? (note.role || 'نفحة عطرية أصلية') : 'نفحة عطرية أصلية';

        return `
          <div class="note-ingredient-card" style="animation-delay: ${idx * 0.08}s" data-note-name="${escapeHtml(name)}">
            <div class="flex items-center gap-2">
              <span class="text-xl flex-shrink-0">${escapeHtml(icon)}</span>
              <div class="flex flex-col min-w-0">
                <span class="font-amiri font-bold text-cream-100 text-xs truncate">${escapeHtml(name)}</span>
                ${en ? `<span class="text-[9px] font-mono text-gold-400/90 truncate">${escapeHtml(en)}</span>` : ''}
              </div>
            </div>
            <div class="text-[9.5px] text-neutral-400 mt-1 font-sans line-clamp-1">${escapeHtml(role)}</div>
          </div>
        `;
      }).join('');

      // Add interactive click / hover audio-visual feedback
      container.querySelectorAll(".note-ingredient-card").forEach((card, idx) => {
        card.addEventListener("click", () => {
          card.classList.add("active-note");
          this.playChime(defaultTone + idx * 70, 0.15);
          const noteName = card.getAttribute("data-note-name");
          this.showToast(noteName, `نفحة أصلية في تركيبة ${product.name}`, "info");
          setTimeout(() => card.classList.remove("active-note"), 2000);
        });
      });
    };

    renderTierRow("topNotesCardsRow", product.notes.top, 660);
    renderTierRow("heartNotesCardsRow", product.notes.heart, 540);
    renderTierRow("baseNotesCardsRow", product.notes.base, 440);
  }

  renderSpotlightSizeButtons(product) {
    const container = document.getElementById("spotlightSizesGroup");
    if (!container) return;

    let html = "";
    ["30ml", "50ml", "100ml"].forEach(sizeKey => {
      const sizeObj = product.sizes[sizeKey];
      if (!sizeObj) return;

      const isSelected = sizeKey === this.spotlightSelectedSize;
      const activeClass = isSelected 
        ? "border-gold-500 bg-gold-500/20 text-cream-100 shadow-md shadow-gold-500/20 font-bold" 
        : "border-neutral-700/80 bg-obsidian-950/80 text-neutral-400 hover:border-gold-500/50 hover:text-cream-200";

      const arLabel = sizeKey === "30ml" ? "30 مل" : (sizeKey === "50ml" ? "50 مل" : "100 مل");

      html += `
        <button class="spotlight-size-btn flex-1 py-2 px-1.5 rounded-xl border text-center transition ${activeClass}" data-size="${sizeKey}">
          <div class="text-[11px] tracking-wider uppercase font-amiri">${arLabel}</div>
          <div class="text-[10px] font-mono text-gold-400 font-semibold">${sizeObj.price} ج.م</div>
        </button>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll(".spotlight-size-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.spotlightSelectedSize = btn.getAttribute("data-size");
        this.renderSpotlightSizeButtons(product);
        this.updateSpotlightCalculations();
        this.playChime(600, 0.05);
      });
    });
  }

  calculateProductPrice(product, sizeKey = "50ml", quantity = 1) {
    if (!product || !product.sizes) {
      return { unitPrice: 245, total: 245, hasDiscount: false, discountedUnitPrice: 245, discountedTotal: 245 };
    }

    const sizeObj = product.sizes[sizeKey] || product.sizes["50ml"] || Object.values(product.sizes)[0];
    const unitPrice = sizeObj ? sizeObj.price : 245;
    const total = unitPrice * Math.max(1, quantity);

    const settings = Storage.getSettings();
    const hasDiscount = Boolean(settings.globalDiscountEnabled && settings.globalDiscountPercent > 0);
    const discountFactor = hasDiscount ? (1 - settings.globalDiscountPercent / 100) : 1;
    const discountedUnitPrice = hasDiscount ? Math.round(unitPrice * discountFactor) : unitPrice;
    const discountedTotal = hasDiscount ? Math.round(total * discountFactor) : total;

    return {
      unitPrice,
      total,
      hasDiscount,
      discountedUnitPrice,
      discountedTotal
    };
  }

  updateSpotlightCalculations() {
    if (!this.currentSpotlightProduct) return;
    const calc = this.calculateProductPrice(this.currentSpotlightProduct, this.spotlightSelectedSize, this.spotlightQuantity);

    const unitPriceEl = document.getElementById("spotlightUnitPrice");
    const totalEl = document.getElementById("spotlightTotalPrice");
    const customQtyInput = document.getElementById("spotlightCustomQtyInput");

    if (unitPriceEl) {
      unitPriceEl.innerHTML = calc.hasDiscount
        ? `<span class="line-through text-xs text-neutral-500 ml-1.5 font-normal">${calc.unitPrice} ج.م</span><span class="text-emerald-400 font-bold">${calc.discountedUnitPrice} ج.م</span>`
        : `${calc.unitPrice} ج.م`;
    }
    if (totalEl) {
      totalEl.innerHTML = calc.hasDiscount
        ? `<span class="line-through text-xs text-neutral-500 ml-1.5 font-normal">${calc.total.toLocaleString()} ج.م</span><span class="text-emerald-400 font-bold">${calc.discountedTotal.toLocaleString()} ج.م</span>`
        : `${calc.total.toLocaleString()} ج.م`;
    }
    if (customQtyInput) customQtyInput.value = this.spotlightQuantity;

    const stickyPriceEl = document.getElementById("stickyBarPrice");
    const stickySizeEl = document.getElementById("stickyBarSize");
    if (stickyPriceEl) {
      stickyPriceEl.innerHTML = calc.hasDiscount
        ? `<span class="line-through text-[10px] text-neutral-500 ml-1 font-normal">${calc.unitPrice} ج.م</span><span class="text-emerald-400 font-bold">${calc.discountedUnitPrice} ج.م</span>`
        : `${calc.unitPrice} ج.م`;
    }
    if (stickySizeEl) stickySizeEl.textContent = this.spotlightSelectedSize;

    document.querySelectorAll(".spotlight-quick-qty-btn").forEach(btn => {
      const q = parseInt(btn.getAttribute("data-qty"));
      if (q === this.spotlightQuantity) {
        btn.classList.add("border-gold-500", "bg-gold-500/20", "text-gold-300");
      } else {
        btn.classList.remove("border-gold-500", "bg-gold-500/20", "text-gold-300");
      }
    });
  }

  bindSpotlightActionButtons(product) {
    const minusBtn = document.getElementById("spotlightQtyMinus");
    const plusBtn = document.getElementById("spotlightQtyPlus");
    const customInput = document.getElementById("spotlightCustomQtyInput");

    if (minusBtn) {
      minusBtn.onclick = () => {
        if (this.spotlightQuantity > 1) {
          this.spotlightQuantity--;
          this.updateSpotlightCalculations();
        }
      };
    }

    if (plusBtn) {
      plusBtn.onclick = () => {
        if (this.spotlightQuantity < (product.stock || 99)) {
          this.spotlightQuantity++;
          this.updateSpotlightCalculations();
        }
      };
    }

    if (customInput) {
      const handleCustomQty = (e) => {
        let val = parseInt(e.target.value) || 1;
        val = Math.max(1, Math.min(product.stock || 99, val));
        this.spotlightQuantity = val;
        this.updateSpotlightCalculations();
      };
      customInput.oninput = handleCustomQty;
      customInput.onchange = handleCustomQty;
    }

    document.querySelectorAll(".spotlight-quick-qty-btn").forEach(btn => {
      btn.onclick = () => {
        this.spotlightQuantity = parseInt(btn.getAttribute("data-qty")) || 1;
        this.updateSpotlightCalculations();
      };
    });

    const waBtn = document.getElementById("spotlightWhatsAppBtn");
    if (waBtn) {
      waBtn.onclick = () => {
        // Add product to cart with selected size and quantity
        Storage.addToCart(product.id, this.spotlightSelectedSize, this.spotlightQuantity);
        
        // Close spotlight modal
        this.closeSpotlight();

        // Open checkout modal immediately so customer enters Name, Phone, and Address
        if (window.CheckoutUI) {
          CheckoutUI.openCheckoutModal();
          this.showToast(
            "⚜️ استكمال بيانات الشحن",
            "أدخل اسمك ورقم هاتفك وعنوان التوصيل لتأكيد الطلب وإرسال تفاصيل الفاتورة عبر WhatsApp فوراً.",
            "info"
          );
        }
      };
    }

    const addBtn = document.getElementById("spotlightAddToCartBtn");
    if (addBtn) {
      addBtn.onclick = (e) => {
        if (navigator.vibrate) navigator.vibrate(20);
        const res = Storage.addToCart(product.id, this.spotlightSelectedSize, this.spotlightQuantity);
        if (res.success) {
          if (window.CartUI) CartUI.animateFlyToCart(addBtn);
          this.showToast(
            "أُضيف إلى حقيبتك الملكية",
            `تمت إضافة ${product.name} (حجم ${this.spotlightSelectedSize}) بالعدد ${this.spotlightQuantity} إلى حقيبة التسوق.`,
            "success"
          );
          this.playChime(880, 0.15);
        }
      };
    }

    const detailsBtn = document.getElementById("spotlightViewDetailsBtn");
    if (detailsBtn) {
      detailsBtn.onclick = () => {
        this.openDetailModal(product);
      };
    }
  }

  // --- Collection Gallery Grid ---
  renderCollectionGrid(searchQuery = "", categoryFilter = "all") {
    const container = document.getElementById("collectionGridContainer");
    if (!container) return;

    let products = Storage.getProducts();

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.notes?.top?.some(n => (typeof n === 'string' ? n : n.name).toLowerCase().includes(q))) ||
        (p.notes?.heart?.some(n => (typeof n === 'string' ? n : n.name).toLowerCase().includes(q))) ||
        (p.notes?.base?.some(n => (typeof n === 'string' ? n : n.name).toLowerCase().includes(q)))
      );
    }

    if (categoryFilter && categoryFilter !== "all") {
      products = products.filter(p => {
        const cat = (p.category || "").toLowerCase();
        if (categoryFilter === "floral") return cat.includes("زهر") || p.id === "sokoon" || p.id === "miss-allure" || p.id === "sakura";
        if (categoryFilter === "night") return cat.includes("ليلي") || p.id === "moon-night";
        if (categoryFilter === "musk") return cat.includes("مسك") || p.id === "sokoon" || p.id === "sakura";
        return cat.includes(categoryFilter);
      });
    }

    if (products.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center text-neutral-400">
          <p class="font-amiri text-2xl text-cream-100 mb-2">لم يتم العثور على عطور مطابقة</p>
          <p class="text-xs text-neutral-500">جرب البحث بكلمات أخرى أو اختر "كل العطور".</p>
        </div>
      `;
      return;
    }

    const settings = Storage.getSettings();
    const hasDiscount = settings.globalDiscountEnabled && settings.globalDiscountPercent > 0;

    let html = "";
    products.forEach((prod) => {
      const p30 = prod.sizes["30ml"]?.price || 165;
      const p50 = prod.sizes["50ml"]?.price || 245;
      const p100 = prod.sizes["100ml"]?.price || 360;

      const discountedP30 = hasDiscount ? Math.round(p30 * (1 - settings.globalDiscountPercent / 100)) : p30;
      const priceBadge = hasDiscount
        ? `<span class="line-through text-[10px] text-neutral-500 mr-1">${p30} ج.م</span><span class="text-sm font-bold text-emerald-400">${discountedP30} ج.م</span>`
        : `<span class="text-sm font-bold text-gold-400 mr-1">${p30} ج.م</span>`;

      const safeId = escapeHtml(prod.id);
      const safeBadge = escapeHtml(prod.badge || prod.category || "");
      const safeImage = sanitizeImageUrl(prod.image);
      const safeName = escapeHtml(prod.name);
      const safeBrand = escapeHtml(prod.brand);
      const safeDesc = escapeHtml(prod.description);

      html += `
        <div class="perfume-card group relative rounded-2xl bg-obsidian-900/60 border border-gold-500/15 backdrop-blur-xl p-6 transition-all duration-500 hover:border-gold-500/50 hover:shadow-2xl hover:shadow-gold-500/15 flex flex-col justify-between text-right" data-product-id="${safeId}">
          
          <!-- Top Badge & Price Range -->
          <div class="flex justify-between items-start mb-4">
            <span class="px-3 py-1 rounded-full text-[11px] font-amiri font-bold bg-gold-500/10 text-gold-400 border border-gold-500/25">
              ${safeBadge}
            </span>
            <div class="text-left font-mono">
              <span class="text-[10px] text-neutral-400">يبدأ من</span>
              ${priceBadge}
            </div>
          </div>

          <!-- Authentic Luxury Photography Visual -->
          <div class="card-visual-wrapper cursor-pointer py-2 flex items-center justify-center relative overflow-hidden transition-transform duration-500 group-hover:scale-105" data-view-product="${safeId}">
            <div class="absolute inset-0 bg-radial-glow opacity-0 group-hover:opacity-100 transition duration-700 pointer-events-none" style="background: radial-gradient(circle, ${prod.visual?.spotlight || 'rgba(212,175,55,0.2)'} 0%, transparent 70%);"></div>
            <img src="${safeImage}" alt="${safeName}" loading="lazy" decoding="async" class="max-h-[220px] w-auto object-contain rounded-xl shadow-lg border border-gold-500/20 group-hover:border-gold-500/50 transition">
          </div>

          <!-- Product Info -->
          <div class="mt-4">
            <div class="text-[11px] font-sans text-gold-500/80 mb-1 font-semibold">${safeBrand}</div>
            <h3 class="font-amiri text-2xl text-cream-100 font-bold tracking-wide group-hover:text-gold-300 transition duration-300 cursor-pointer" data-view-product="${safeId}">
              ${safeName}
            </h3>
            <p class="text-xs text-neutral-400 line-clamp-2 mt-2 font-light leading-relaxed">
              ${safeDesc}
            </p>

            <!-- Fragrance Notes Preview with Icons -->
            <div class="mt-3.5 flex flex-wrap gap-1.5 justify-start">
              ${(prod.notes?.top || []).slice(0, 2).map(n => {
                const name = typeof n === 'string' ? n : n.name;
                const icon = typeof n === 'object' ? (n.icon || '✨') : '✨';
                return `
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-obsidian-950 text-neutral-300 border border-neutral-800 flex items-center gap-1">
                    <span>${escapeHtml(icon)}</span>
                    <span>${escapeHtml(name)}</span>
                  </span>
                `;
              }).join('')}
              ${(prod.notes?.heart || []).slice(0, 1).map(n => {
                const name = typeof n === 'string' ? n : n.name;
                const icon = typeof n === 'object' ? (n.icon || '🌸') : '🌸';
                return `
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-obsidian-950 text-gold-400/90 border border-gold-500/25 flex items-center gap-1">
                    <span>${escapeHtml(icon)}</span>
                    <span>${escapeHtml(name)}</span>
                  </span>
                `;
              }).join('')}
            </div>

            <!-- Size Selector Pills in Card -->
            <div class="mt-5 pt-4 border-t border-neutral-800/80 flex items-center justify-between gap-2" dir="ltr">
              <div class="flex items-center gap-1.5 flex-1" id="cardSizes-${safeId}">
                <button class="card-size-opt flex-1 py-1 px-1 text-center rounded-lg border border-neutral-700 bg-obsidian-950 text-[10px] font-mono text-neutral-400 hover:border-gold-500" data-card-size="30ml" data-price="${p30}">30ml</button>
                <button class="card-size-opt active flex-1 py-1 px-1 text-center rounded-lg border border-gold-500 bg-gold-500/20 text-[10px] font-mono text-cream-100 font-bold" data-card-size="50ml" data-price="${p50}">50ml</button>
                <button class="card-size-opt flex-1 py-1 px-1 text-center rounded-lg border border-neutral-700 bg-obsidian-950 text-[10px] font-mono text-neutral-400 hover:border-gold-500" data-card-size="100ml" data-price="${p100}">100ml</button>
              </div>
            </div>

            <!-- Action Buttons: View Details & Quick Add -->
            <div class="mt-4 flex gap-2">
              <button class="card-details-btn flex-1 py-2.5 px-3 rounded-xl border border-gold-500/40 text-gold-400 text-xs font-bold tracking-wider hover:bg-gold-500/10 transition text-center" data-view-product="${safeId}">
                عرض المواصفات والنفحات
              </button>
              <button class="card-quick-add-btn gold-gradient-btn px-4 py-2.5 rounded-xl text-obsidian-950 text-xs font-bold tracking-wider transition flex items-center justify-center gap-1.5" data-add-prod="${safeId}">
                <i data-lucide="shopping-bag" class="w-3.5 h-3.5"></i>
                <span class="card-price-display font-mono" id="cardPriceDisplay-${safeId}">${p50} ج.م</span>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons({ root: container });

    products.forEach(prod => {
      const cardEl = container.querySelector(`[data-product-id="${prod.id}"]`);
      if (!cardEl) return;

      let chosenSize = "50ml";

      cardEl.querySelectorAll(".card-size-opt").forEach(btn => {
        btn.addEventListener("click", () => {
          cardEl.querySelectorAll(".card-size-opt").forEach(b => {
            b.classList.remove("border-gold-500", "bg-gold-500/20", "text-cream-100", "font-bold");
            b.classList.add("border-neutral-700", "bg-obsidian-950", "text-neutral-400");
          });
          btn.classList.add("border-gold-500", "bg-gold-500/20", "text-cream-100", "font-bold");
          btn.classList.remove("border-neutral-700", "bg-obsidian-950", "text-neutral-400");
          chosenSize = btn.getAttribute("data-card-size");
          const price = btn.getAttribute("data-price");
          const displayEl = document.getElementById(`cardPriceDisplay-${prod.id}`);
          if (displayEl) displayEl.textContent = `${price} ج.م`;
        });
      });

      const addBtn = cardEl.querySelector(`[data-add-prod="${prod.id}"]`);
      if (addBtn) {
        addBtn.addEventListener("click", () => {
          const res = Storage.addToCart(prod.id, chosenSize, 1);
          if (res.success) {
            if (window.CartUI) CartUI.animateFlyToCart(addBtn);
            this.showToast("أُضيف للحقيبة", `تمت إضافة ${prod.name} (${chosenSize}).`, "success");
            this.playChime(880, 0.15);
          }
        });
      }

      cardEl.querySelectorAll(`[data-view-product="${prod.id}"]`).forEach(btn => {
        btn.addEventListener("click", () => {
          this.lastProductSourceSection = "collectionSection";
          this.preventShowroomSourceOverride = true;
          const prods = Storage.getProducts();
          const idx = prods.findIndex(p => p.id === prod.id);
          if (this.showroom && idx !== -1) {
            this.showroom.selectBottle(idx, false);
          }
          this.updateSpotlightInfoPanel(prod, true);
          const detailsSec = document.getElementById("perfumeDetailsSection");
          if (detailsSec) {
            detailsSec.scrollIntoView({ behavior: "smooth" });
          }
          this.triggerBottleIngredientsEruption(prod, true);
          this.triggerAromaAuraEffect(prod);
          this.playChime(780, 0.15);
          setTimeout(() => {
            this.preventShowroomSourceOverride = false;
          }, 800);
        });
      });
    });
  }

  // --- Product Detail Modal ---
  openDetailModal(product) {
    this.modalProduct = product;
    this.modalSelectedSize = "50ml";
    this.modalQuantity = 1;

    const modal = document.getElementById("productDetailModal");
    if (!modal) return;

    document.getElementById("modalPerfumeName").textContent = product.name;
    document.getElementById("modalPerfumeBrand").textContent = product.brand;
    document.getElementById("modalPerfumeSubtitle").textContent = `${product.subtitle} • ${product.concentration}`;
    document.getElementById("modalDescription").textContent = product.description;
    document.getElementById("modalStory").textContent = product.story || product.description;
    document.getElementById("modalRatingText").textContent = `★★★★★ ${product.rating} / 5.0 (${product.reviewsCount || 48} تقييم موثق من ذواقة العطور)`;

    const artContainer = document.getElementById("modalBottleGraphic");
    if (artContainer) {
      if (product.image) {
        artContainer.innerHTML = `
          <div class="relative w-full flex items-center justify-center p-3">
            <img src="${sanitizeImageUrl(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" class="max-h-[340px] w-auto object-contain rounded-2xl shadow-2xl border border-gold-500/30">
          </div>
        `;
      } else {
        artContainer.innerHTML = generateBottleSvg(product, 240, 310);
      }
    }

    const topNotesEl = document.getElementById("modalTopNotes");
    const heartNotesEl = document.getElementById("modalHeartNotes");
    const baseNotesEl = document.getElementById("modalBaseNotes");

    const formatNoteList = (arr) => (arr || []).map(n => typeof n === 'string' ? n : `${n.icon || ''} ${n.name}`).join(" • ");

    if (topNotesEl) topNotesEl.textContent = formatNoteList(product.notes?.top);
    if (heartNotesEl) heartNotesEl.textContent = formatNoteList(product.notes?.heart);
    if (baseNotesEl) baseNotesEl.textContent = formatNoteList(product.notes?.base);

    const accordsEl = document.getElementById("modalAccords");
    if (accordsEl && product.accords) {
      accordsEl.innerHTML = product.accords.map(acc => `
        <span class="px-3 py-1 rounded-full text-xs font-amiri font-bold bg-neutral-900 border border-gold-500/20 text-gold-400">
          ${escapeHtml(acc)}
        </span>
      `).join('');
    }

    this.renderModalSizes(product);
    this.updateModalCalculations();
    this.bindModalActions(product);

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    if (window.gsap) {
      gsap.fromTo(modal.querySelector(".modal-dialog"),
        { scale: 0.95, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.35, ease: "power2.out" }
      );
    }
  }

  renderModalSizes(product) {
    const container = document.getElementById("modalSizesGroup");
    if (!container) return;

    let html = "";
    ["30ml", "50ml", "100ml"].forEach(sizeKey => {
      const sizeObj = product.sizes[sizeKey];
      if (!sizeObj) return;

      const isSelected = sizeKey === this.modalSelectedSize;
      const activeClass = isSelected
        ? "border-gold-500 bg-gold-500/20 text-cream-100 shadow-lg shadow-gold-500/20 font-bold"
        : "border-neutral-700 bg-obsidian-950 text-neutral-400 hover:border-gold-500/50";

      const arLabel = sizeKey === "30ml" ? "30 مل" : (sizeKey === "50ml" ? "50 مل" : "100 مل");

      html += `
        <button class="modal-size-btn flex-1 p-3 rounded-xl border text-center transition ${activeClass}" data-size="${sizeKey}">
          <div class="text-xs font-amiri font-bold">${arLabel}</div>
          <div class="text-sm font-mono text-gold-400 font-semibold mt-1">${sizeObj.price} ج.م</div>
        </button>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll(".modal-size-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.modalSelectedSize = btn.getAttribute("data-size");
        this.renderModalSizes(product);
        this.updateModalCalculations();
        this.playChime(640, 0.05);
      });
    });
  }

  updateModalCalculations() {
    if (!this.modalProduct) return;
    const calc = this.calculateProductPrice(this.modalProduct, this.modalSelectedSize, this.modalQuantity);

    const unitPriceEl = document.getElementById("modalUnitPrice");
    const totalEl = document.getElementById("modalTotalPrice");

    if (unitPriceEl) {
      unitPriceEl.innerHTML = calc.hasDiscount
        ? `<span class="line-through text-xs text-neutral-500 ml-1.5 font-normal">${calc.unitPrice} ج.م</span><span class="text-emerald-400 font-bold">${calc.discountedUnitPrice} ج.م</span>`
        : `${calc.unitPrice} ج.م`;
    }
    if (totalEl) {
      totalEl.innerHTML = calc.hasDiscount
        ? `<span class="line-through text-xs text-neutral-500 ml-1.5 font-normal">${calc.total.toLocaleString()} ج.م</span><span class="text-emerald-400 font-bold">${calc.discountedTotal.toLocaleString()} ج.م</span>`
        : `${calc.total.toLocaleString()} ج.م`;
    }
    document.getElementById("modalCustomQtyInput") && (document.getElementById("modalCustomQtyInput").value = this.modalQuantity);
  }

  bindModalActions(product) {
    const minusBtn = document.getElementById("modalQtyMinus");
    const plusBtn = document.getElementById("modalQtyPlus");
    const customInput = document.getElementById("modalCustomQtyInput");

    if (minusBtn) {
      minusBtn.onclick = () => {
        if (this.modalQuantity > 1) {
          this.modalQuantity--;
          this.updateModalCalculations();
        }
      };
    }

    if (plusBtn) {
      plusBtn.onclick = () => {
        if (this.modalQuantity < (product.stock || 99)) {
          this.modalQuantity++;
          this.updateModalCalculations();
        }
      };
    }

    if (customInput) {
      const handleModalCustomQty = (e) => {
        let val = parseInt(e.target.value) || 1;
        val = Math.max(1, Math.min(product.stock || 99, val));
        this.modalQuantity = val;
        this.updateModalCalculations();
      };
      customInput.oninput = handleModalCustomQty;
      customInput.onchange = handleModalCustomQty;
    }

    const addBtn = document.getElementById("modalAddToCartBtn");
    if (addBtn) {
      addBtn.onclick = () => {
        const res = Storage.addToCart(product.id, this.modalSelectedSize, this.modalQuantity);
        if (res.success) {
          if (window.CartUI) CartUI.animateFlyToCart(addBtn);
          this.showToast(
            "أُضيف إلى حقيبتك الفاخرة",
            `تم وضع ${product.name} (حجم ${this.modalSelectedSize}) بالعدد ${this.modalQuantity} في الحقيبة.`,
            "success"
          );
          this.closeDetailModal();
          this.playChime(880, 0.15);
        }
      };
    }
  }

  closeDetailModal() {
    const modal = document.getElementById("productDetailModal");
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    this.modalProduct = null;
  }

  showToast(title, message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast-pill flex items-start gap-3 p-4 rounded-xl bg-obsidian-950/95 border border-gold-500/40 backdrop-blur-xl shadow-2xl shadow-gold-500/10 text-xs max-w-sm pointer-events-auto transform transition-all duration-300 text-right";

    const icon = type === "success" ? "⚜️" : (type === "warning" ? "⚠️" : "✨");
    toast.innerHTML = `
      <span class="text-base flex-shrink-0">${icon}</span>
      <div class="flex-1">
        <h5 class="font-amiri font-bold text-cream-100 tracking-wide text-sm">${escapeHtml(title)}</h5>
        <p class="text-neutral-300 mt-0.5 leading-relaxed font-sans">${escapeHtml(message)}</p>
      </div>
      <button class="text-neutral-500 hover:text-cream-100 p-0.5 transition" onclick="this.parentElement.remove()">
        ✕
      </button>
    `;

    container.appendChild(toast);

    if (window.gsap) {
      gsap.fromTo(toast, { opacity: 0, y: -20, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "power2.out" });
    }

    setTimeout(() => {
      if (toast.parentElement) {
        if (window.gsap) {
          gsap.to(toast, { opacity: 0, y: -20, duration: 0.3, onComplete: () => toast.remove() });
        } else {
          toast.remove();
        }
      }
    }, 4500);
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    const btn = document.getElementById("toggleSoundBtn");
    if (btn) {
      btn.classList.toggle("text-gold-400", this.soundEnabled);
      btn.classList.toggle("border-gold-500", this.soundEnabled);
    }
    if (this.soundEnabled) {
      this.playChime(587, 0.2);
      this.showToast("المؤثرات الصوتية", "تم تفعيل النغمات الملكية الهادئة", "info");
    } else {
      this.showToast("المؤثرات الصوتية", "تم كتم الصوت", "info");
    }
  }

  playChime(freq = 600, duration = 0.12) {
    if (!this.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) this.audioCtx = new AudioCtx();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.audioCtx.currentTime + duration);

      gain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  // --- Mobile Touch & Responsive Enhancements ---
  renderMobileBottleCarousel() {
    const container = document.getElementById("mobileBottleCarousel");
    if (!container) return;

    const products = Storage.getProducts();
    let html = "";
    products.forEach((prod, idx) => {
      const isSelected = this.currentSpotlightProduct && this.currentSpotlightProduct.id === prod.id;
      const activeClass = isSelected 
        ? "border-gold-500 bg-gold-500/25 text-cream-100 shadow-md shadow-gold-500/30 font-bold scale-[1.02]" 
        : "border-neutral-800/90 bg-obsidian-950/80 text-neutral-400 hover:border-gold-500/40 hover:text-cream-200";

      const icon = prod.podium === "women" ? "🌸" : "👑";

      html += `
        <button class="mobile-bottle-tab flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs whitespace-nowrap transition-all duration-300 flex-shrink-0 ${activeClass}" data-bottle-idx="${idx}" data-product-id="${escapeHtml(prod.id)}">
          <span class="w-2.5 h-2.5 rounded-full border border-gold-500/40 inline-block shadow-sm" style="background-color: ${escapeHtml(prod.visual?.liquidColor || prod.liquidColor || '#d4af37')}"></span>
          <span class="text-xs">${icon}</span>
          <span class="font-amiri font-bold">${escapeHtml(prod.name)}</span>
        </button>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll(".mobile-bottle-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        this.lastProductSourceSection = "showroomSection";
        const pid = btn.getAttribute("data-product-id");
        if (this.showroom) {
          const bIndex = this.showroom.bottleGroups.findIndex(bg => bg.userData.product && bg.userData.product.id === pid);
          if (bIndex !== -1) {
            this.showroom.selectBottle(bIndex, true);
          } else {
            const idx = parseInt(btn.getAttribute("data-bottle-idx"));
            this.showroom.selectBottle(idx, true);
          }
        } else {
          const prods = Storage.getProducts();
          const target = prods.find(p => p.id === pid);
          if (target) this.updateSpotlightInfoPanel(target, true);
          document.getElementById("perfumeDetailsSection")?.scrollIntoView({ behavior: "smooth" });
        }
        if (navigator.vibrate) navigator.vibrate(15);
      });
    });
  }

  updateMobileCarouselSelection(product) {
    if (!product) return;
    const container = document.getElementById("mobileBottleCarousel");
    if (!container) return;

    container.querySelectorAll(".mobile-bottle-tab").forEach(btn => {
      const pid = btn.getAttribute("data-product-id");
      if (pid === product.id) {
        btn.classList.add("border-gold-500", "bg-gold-500/25", "text-cream-100", "shadow-md", "shadow-gold-500/30", "font-bold", "scale-[1.02]");
        btn.classList.remove("border-neutral-800/90", "text-neutral-400");
        btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      } else {
        btn.classList.remove("border-gold-500", "bg-gold-500/25", "text-cream-100", "shadow-md", "shadow-gold-500/30", "font-bold", "scale-[1.02]");
        btn.classList.add("border-neutral-800/90", "text-neutral-400");
      }
    });
  }

  updateMobileStickyBar(product) {
    if (!product) return;
    const thumb = document.getElementById("stickyBarThumb");
    const nameEl = document.getElementById("stickyBarName");
    const sizeEl = document.getElementById("stickyBarSize");
    const priceEl = document.getElementById("stickyBarPrice");

    if (thumb) thumb.innerHTML = generateBottleSvg(product, 32, 42);
    if (nameEl) nameEl.textContent = product.name;
    if (sizeEl) sizeEl.textContent = this.spotlightSelectedSize;
    if (priceEl) {
      const price = product.sizes[this.spotlightSelectedSize]?.price || 250;
      priceEl.textContent = `${price} ج.م`;
    }
  }

  setupMobileScrollAndNav() {
    const stickyBar = document.getElementById("mobileStickyBuyBar");
    const navItems = document.querySelectorAll(".mobile-nav-item[data-nav-target]");

    window.addEventListener("scroll", () => {
      const scrollY = window.scrollY;

      // Show/Hide Floating Sticky Quick-Buy Bar
      if (stickyBar) {
        if (scrollY > 350) {
          stickyBar.classList.add("visible");
        } else {
          stickyBar.classList.remove("visible");
        }
      }

      // Update active state in mobile bottom nav
      navItems.forEach(item => {
        const targetId = item.getAttribute("data-nav-target");
        const el = document.getElementById(targetId);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 250 && rect.bottom >= 100) {
            navItems.forEach(i => i.classList.remove("active"));
            item.classList.add("active");
          }
        }
      });
    }, { passive: true });
  }

  // --- Secret Admin Access (3 Taps on Logo) ---
  setupSecretAdminAccess() {
    let tapCount = 0;
    let tapResetTimer = null;
    const REQUIRED_TAPS = 3;
    const TAP_WINDOW_MS = 1400;

    const handleLogoTap = (e) => {
      e.preventDefault();
      e.stopPropagation();

      tapCount++;

      const logoEl = e.currentTarget;
      logoEl.classList.remove("logo-tap-pulse");
      void logoEl.offsetWidth; // trigger reflow
      logoEl.classList.add("logo-tap-pulse");

      // Soft audio feedback
      this.playChime(500 + tapCount * 120, 0.08);

      if (tapResetTimer) clearTimeout(tapResetTimer);

      if (tapCount >= REQUIRED_TAPS) {
        tapCount = 0;
        if (tapResetTimer) clearTimeout(tapResetTimer);

        // Haptic feedback for mobile
        if (navigator.vibrate) {
          try { navigator.vibrate([60, 40, 100]); } catch (_) {}
        }

        // Royal unlock chime
        this.playRoyalUnlockSound();

        // Confetti celebration
        if (typeof confetti === "function") {
          try {
            confetti({
              particleCount: 50,
              spread: 70,
              origin: { y: 0.15 },
              colors: ['#d4af37', '#f7e6a6', '#ffffff']
            });
          } catch (_) {}
        }

        this.showToast(
          "بوابة الإدارة الملكية 👑",
          "تم تفعيل الدخول السري بنجاح... جارٍ نقلك إلى لوحة التحكم.",
          "success"
        );

        // Redirect to admin.html after a smooth animation
        setTimeout(() => {
          window.location.href = "admin.html";
        }, 700);

      } else {
        tapResetTimer = setTimeout(() => {
          // If only 1 tap and timed out, standard scroll to top
          if (tapCount === 1) {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
          tapCount = 0;
        }, TAP_WINDOW_MS);
      }
    };

    document.querySelectorAll("[data-royal-logo]").forEach(el => {
      el.addEventListener("click", handleLogoTap);
    });
  }

  playRoyalUnlockSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) this.audioCtx = new AudioCtx();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const now = this.audioCtx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);

        gain.gain.setValueAtTime(0.06, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.35);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.35);
      });
    } catch {
      // Audio autoplay policy fallback
    }
  }
}

window.LuxuryApp = LuxuryApp;
document.addEventListener("DOMContentLoaded", () => {
  window.app = new LuxuryApp();
});
