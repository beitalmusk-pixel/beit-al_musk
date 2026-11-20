/**
 * بيت المسك - BEIT AL-MUSK
 * الكتالوج الرسمي الحصري لعطور بيت المسك الملكية
 * 4 عطور نيش فاخرة أصلية
 */

const DEFAULT_PRODUCTS = [
  {
    id: "sokoon",
    name: "عطر سكون (Sokoon)",
    englishName: "Sokoon",
    brand: "بيت المسك • BEIT AL-MUSK",
    subtitle: "لمسة من السحر والأنوثة لكل لحظة",
    tagline: "هدوء وسحر لا يُقاوم بنفحات الفانيلا والمسك الأبيض",
    description: "عطر سكون: لمسة من السحر والأنوثة لكل لحظة. افتتاحية منعشة ومشرقة من البرغموت الإيطالي ولمسات الفانيلا المخملية، ينساب برقة إلى قلب زهري آسر مفعم بالياسمين وبتلات الورد الأبيض، ليستقر على قاعدة دافئة ومترفة من العنبر والمسك الأبيض الفاخر.",
    story: "صُمم عطر سكون في معمل بيت المسك ليكون رفيق كل لحظة أنثوية هادئة ومميزة؛ يمنحك هالة من النقاء والرقة التي تترك بصمة ساحرة وأثراً لا يُنسى أينما حللت.",
    category: "زهري ناعم ومسكي",
    gender: "نسائي ناعم (Pour Femme)",
    podium: "women",
    podiumTitle: "الجناح النسائي 🌸",
    concentration: "ماء عطر مكثف • Eau de Parfum Intense",
    defaultSize: "50ml",
    image: "assets/products/sokoon.jpg",
    sizes: {
      "30ml": { price: 165, label: "30 مل (فاخر)", available: true },
      "50ml": { price: 245, label: "50 مل (الأكثر طلباً)", available: true },
      "100ml": { price: 360, label: "100 مل (القنينة الملكية)", available: true }
    },
    stock: 15,
    rating: 4.96,
    reviewsCount: 84,
    badge: "الأكثر سحراً وهدوءاً",
    notes: {
      top: [
        { name: "برغموت", en: "Bergamot", icon: "🍋", role: "انتعاش حمضي مشرق", color: "#84cc16" },
        { name: "فانيلا", en: "Vanilla", icon: "🍦", role: "حلاوة ناعمة مخملية", color: "#fef08a" }
      ],
      heart: [
        { name: "ياسمين", en: "Jasmine", icon: "🤍", role: "سحر زهري أنثوي ناعم", color: "#ffffff" },
        { name: "ورد", en: "Rose", icon: "🌸", role: "بتلات ورد ندية رقيقة", color: "#f472b6" }
      ],
      base: [
        { name: "عنبر", en: "Amber", icon: "🪔", role: "دفء عنبري مترف", color: "#d97706" },
        { name: "مسك أبيض", en: "White Musk", icon: "🌿", role: "نقاء مسكي ناصع يدوم طويلاً", color: "#e2e8f0" }
      ]
    },
    accords: ["مسك أبيض نقي", "فانيلا مخملية", "ياسمين ساحر", "برغموت منعش", "عنبر دافئ", "ورد رقيق"],
    visual: {
      bottleColor: "#fbf6f0",
      liquidColor: "#e6c88b",
      capColor: "#e5c07b",
      spotlight: "rgba(229, 192, 123, 0.5)",
      accentHex: "#d4af37",
      geometry: "slender-crystal",
      capStyle: "faceted-diamond-gem",
      themeColor: "#fef3c7",
      particleType: "sparkle-gold"
    }
  },
  {
    id: "moon-night",
    name: "مون نايت (Moon Night)",
    englishName: "Moon Night",
    brand: "بيت المسك • BEIT AL-MUSK",
    subtitle: "سحر الليالي الآسرة بالمسك والعنبر والتوت الفاخر",
    tagline: "غموض وجاذبية الليل الفاتن تحت ضوء القمر",
    description: "عطر مون نايت يجسد غموض وجاذبية الليل الفاتن. يبتدئ بانفجار فاكهي غني ومبهج من التوت البري والرازبيري والبلاك بيري وبشر الحمضيات، يتناغم بسحر مع باقة زهرية مخملية من الياسمين والبنفسج، ويتكئ على عرش فاخر من العنبر والأخشاب النبيلة مع دفء المسك والفانيليا.",
    story: "مستوحى من سحر القمر في سماء ليلة شرقية دافئة؛ حيث تتعانق نسائم البنفسج والزهور الليلية النادرة مع عبير التوت البري وأخشاب الغابات ودهن مسك بيت المسك المعتق.",
    category: "فاكهي وزهري ليلي فخم",
    gender: "رجالي فاخر (Pour Homme)",
    podium: "men",
    podiumTitle: "الجناح الرجالي 👑",
    concentration: "خلاصة عطرية ملكية • Extrait de Parfum 32%",
    defaultSize: "50ml",
    image: "assets/products/moon-night.jpg",
    sizes: {
      "30ml": { price: 195, label: "30 مل (فاخر)", available: true },
      "50ml": { price: 285, label: "50 مل (الأكثر طلباً)", available: true },
      "100ml": { price: 440, label: "100 مل (القنينة الملكية)", available: true }
    },
    stock: 11,
    rating: 4.98,
    reviewsCount: 112,
    badge: "الإصدار الليلي الأكثر مبيعاً",
    notes: {
      top: [
        { name: "توت بري وبلاك بيري", en: "Wild Berries & Blackberry", icon: "🫐", role: "فواكه داكنة غنية", color: "#3b0764" },
        { name: "رازبيري مع بشر حمضيات", en: "Raspberry & Zest", icon: "🍓", role: "حيوية مبهجة منعشة", color: "#e11d48" }
      ],
      heart: [
        { name: "الياسمين", en: "Jasmine", icon: "🤍", role: "أناقة زهرية بيضاء", color: "#ffffff" },
        { name: "البنفسج", en: "Violet", icon: "💜", role: "نفحة مخملية أثيرية", color: "#a855f7" }
      ],
      base: [
        { name: "العنبر والأخشاب", en: "Amber & Woods", icon: "🪵", role: "عمق خشبي عنبري ملكي", color: "#78350f" },
        { name: "المسك والفانيليا", en: "Musk & Vanilla", icon: "✨", role: "نعومة مسكية دافئة وثبات مذهل", color: "#facc15" }
      ]
    },
    accords: ["توت بري وبلاك بيري", "مسك وفاكهة", "عنبر ملكي", "بنفسج مخملي", "أخشاب نبيلة", "فانيليا دافئة"],
    visual: {
      bottleColor: "#0f0c18",
      liquidColor: "#3b1638",
      capColor: "#120f1b",
      spotlight: "rgba(168, 85, 247, 0.45)",
      accentHex: "#a855f7",
      geometry: "cylindrical-heavy",
      capStyle: "black-glossy-gold-collar",
      themeColor: "#581c87",
      particleType: "night-stars"
    }
  },
  {
    id: "miss-allure",
    name: "ميس ألور (Miss Allure)",
    englishName: "Miss Allure",
    brand: "بيت المسك • BEIT AL-MUSK",
    subtitle: "فيض الأنوثة بالورد الجوري والفراولة البرية والمسك الناعم",
    tagline: "توقيع الجاذبية المطلقة والجمال الآسر",
    description: "عطر ميس ألور من بيت المسك، تحفة فنية تنبض بالجاذبية والرقة الملكية. يفتتح العطر بعبير الفراولة البرية وتوت العليق الأسود، يتعانق مع قلب أسطوري من الورد الجوري والورد التركي والياسمين الملكي وزنبق الوادي، ويستقر على قاعدة مخملية من المسك الناعم والفانيليا المدغشقرية النادرة.",
    story: "حكاية جاذبية لا تُقاوم؛ صُمم ميس ألور ليكون توقيع المرأة الواثقة المفعمة بالجمال، حيث تلتقي نفحات البساتين الفرنسية والورود الشرقية بأفخم درجات المسك الناعم والفانيليا المدغشقرية.",
    category: "زهري فاكهي ساحر",
    gender: "نسائي ساحر (Pour Femme)",
    podium: "women",
    podiumTitle: "الجناح النسائي 🌸",
    concentration: "ماء عطر مكثف • Eau de Parfum 28%",
    defaultSize: "50ml",
    image: "assets/products/miss-allure.jpg",
    sizes: {
      "30ml": { price: 180, label: "30 مل (فاخر)", available: true },
      "50ml": { price: 265, label: "50 مل (الأكثر طلباً)", available: true },
      "100ml": { price: 390, label: "100 مل (القنينة الملكية)", available: true }
    },
    stock: 14,
    rating: 4.97,
    reviewsCount: 96,
    badge: "الأكثر طلباً وجاذبية",
    notes: {
      top: [
        { name: "توت العليق الأسود", en: "Blackberry", icon: "🫐", role: "نوتة فاكهية فاخرة", color: "#4c0519" },
        { name: "فراولة برية", en: "Wild Strawberry", icon: "🍓", role: "نضارة غنية ومغرية", color: "#f43f5e" }
      ],
      heart: [
        { name: "ورد جوري وورد تركي", en: "Damask & Turkish Rose", icon: "🌹", role: "فخامة الورد الملكي النقي", color: "#e11d48" },
        { name: "ياسمين ملكي وزنبق الوادي", en: "Royal Jasmine & Lily", icon: "💐", role: "نقاء الندى الصباحي والبساتين", color: "#ffffff" }
      ],
      base: [
        { name: "مسك ناعم", en: "Soft Musk", icon: "🕊️", role: "عناق مسكي رقيق ومثير", color: "#fce7f3" },
        { name: "فانيليا مدغشقرية", en: "Madagascar Vanilla", icon: "🍦", role: "دفء فانيليا نقي لا يُضاهى", color: "#fbbf24" }
      ]
    },
    accords: ["ورد جوري تركي", "فراولة برية", "مسك ناعم", "فانيليا مدغشقر", "توت العليق", "زنبق الوادي"],
    visual: {
      bottleColor: "#210915",
      liquidColor: "#881337",
      capColor: "#14050d",
      spotlight: "rgba(225, 29, 72, 0.45)",
      accentHex: "#f43f5e",
      geometry: "cylindrical-heavy",
      capStyle: "black-glossy-gold-collar",
      themeColor: "#831843",
      particleType: "rose-petals"
    }
  },
  {
    id: "sakura",
    name: "ساكورا (Sakura)",
    englishName: "Sakura",
    brand: "بيت المسك • BEIT AL-MUSK",
    subtitle: "سيمفونية زهرية تفيض بالحياة، وتترك أثراً مخملياً ساحراً",
    tagline: "تحفة بيت المسك البيضاء بزهر الكرز والمسك النقي",
    description: "عطر ساكورا من بيت المسك: سيمفونية زهرية تفيض بالحياة، وتترك أثراً مخملياً ساحراً. افتتاحية منعشة من الفاوانيا والماندرين (اليوسفي)، يعقبها قلب أثيري من زهر الكرز والزنبق والورد، تتوجها قاعدة فاخرة من المسك الأبيض النقي، العنبر الذهبي، وخشب الصندل العتيق.",
    story: "مستوحى من موسم إزهار الكرز الملكي؛ يجسد التجدد والأناقة النقية في قنينة بورسلين بيضاء ناصعة كاللؤلؤ، يعلوها تاج الذهب وأندر قطرات المسك الصافي من بيت المسك.",
    category: "زهري نضر ومسكي أبيض",
    gender: "للجنسين والرجال (Unisex & Him)",
    podium: "men",
    podiumTitle: "الجناح الرجالي والنيش 👑",
    concentration: "خلاصة ملكية نادرة • Extrait de Parfum 30%",
    defaultSize: "50ml",
    image: "assets/products/sakura.jpg",
    sizes: {
      "30ml": { price: 190, label: "30 مل (فاخر)", available: true },
      "50ml": { price: 275, label: "50 مل (الأكثر طلباً)", available: true },
      "100ml": { price: 410, label: "100 مل (القنينة الملكية)", available: true }
    },
    stock: 9,
    rating: 4.99,
    reviewsCount: 130,
    badge: "تحفة بيت المسك البيضاء",
    notes: {
      top: [
        { name: "الفاوانيا", en: "Peony", icon: "🌸", role: "انتعاش الزهور الربيعية المبهجة", color: "#f472b6" },
        { name: "الماندرين (اليوسفي)", en: "Mandarin", icon: "🍊", role: "إشراقة حمضية راقية", color: "#fb923c" }
      ],
      heart: [
        { name: "زهر الكرز (ساكورا)", en: "Cherry Blossom (Sakura)", icon: "🌺", role: "الرائحة الأيقونية الآسرة الحية", color: "#fb7185" },
        { name: "الزنبق والورد", en: "Lily & Rose", icon: "🤍", role: "صفاء ملكي وبتلات مخملية", color: "#ffffff" }
      ],
      base: [
        { name: "المسك الأبيض", en: "White Musk", icon: "🌿", role: "نقاء مسك بيت المسك المميز", color: "#f1f5f9" },
        { name: "العنبر وخشب الصندل", en: "Amber & Sandalwood", icon: "🪵", role: "دفء وثبات أسطوري مخملي", color: "#b45309" }
      ]
    },
    accords: ["زهر الكرز (ساكورا)", "مسك أبيض", "فاوانيا ربيعية", "خشب الصندل", "ماندرين", "عنبر ذهبي"],
    visual: {
      bottleColor: "#fcfbf9",
      liquidColor: "#fce7f3",
      capColor: "#f8f6f0",
      spotlight: "rgba(244, 114, 182, 0.45)",
      accentHex: "#ec4899",
      geometry: "white-porcelain-dome",
      capStyle: "porcelain-dome-gold-band",
      themeColor: "#fdf2f8",
      particleType: "cherry-blossom"
    }
  }
];

function generateBottleSvg(product, width = 280, height = 360) {
  const vis = product.visual || {};
  const liquid = vis.liquidColor || "#d4af37";
  const id = (product.id || "preview").replace(/[^a-zA-Z0-9]/g, "");

  const isSakura = product.id === "sakura";
  const isMoon = product.id === "moon-night";
  const isAllure = product.id === "miss-allure";
  const isSokoon = product.id === "sokoon";

  return `
  <svg viewBox="0 0 280 360" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" class="bottle-vector-art">
    <defs>
      <!-- 24K Polished Gold Gradient -->
      <linearGradient id="goldGrad-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fff4c2" />
        <stop offset="25%" stop-color="#e5c07b" />
        <stop offset="55%" stop-color="#d4af37" />
        <stop offset="80%" stop-color="#96741c" />
        <stop offset="100%" stop-color="#fae4a0" />
      </linearGradient>

      <!-- Glass Specular Reflection -->
      <linearGradient id="reflGrad-${id}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.4)" />
        <stop offset="20%" stop-color="rgba(255,255,255,0.08)" />
        <stop offset="50%" stop-color="rgba(0,0,0,0.15)" />
        <stop offset="80%" stop-color="rgba(255,255,255,0.05)" />
        <stop offset="100%" stop-color="rgba(255,255,255,0.3)" />
      </linearGradient>

      <!-- Aura Halo Glow -->
      <radialGradient id="auraGrad-${id}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${isSakura ? '#ffd1dc' : (isAllure ? '#c92a63' : (isMoon ? '#d4af37' : '#f5ce62'))}" stop-opacity="0.32" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0" />
      </radialGradient>
    </defs>

    <!-- Background Halo Aura -->
    <ellipse cx="140" cy="195" rx="100" ry="120" fill="url(#auraGrad-${id})" />

    <!-- Floor Pedestal Reflection -->
    <ellipse cx="140" cy="336" rx="75" ry="12" fill="rgba(0,0,0,0.75)" filter="blur(6px)" />
    <ellipse cx="140" cy="336" rx="50" ry="6" fill="rgba(212,175,55,0.25)" filter="blur(3px)" />

    ${isSakura ? `
    <!-- SAKURA: Satin Pearl White Amphora Bottle + Oriental Onion Dome Cap -->
    <!-- Amphora Silhouette Body -->
    <path d="M 140 102 C 146 102 154 108 166 128 C 182 154 188 182 188 285 C 188 312 178 322 140 322 C 102 322 92 312 92 285 C 92 182 98 154 114 128 C 126 108 134 102 140 102 Z" fill="#fafafa" stroke="url(#goldGrad-${id})" stroke-width="1.2" />
    <path d="M 140 102 C 146 102 154 108 166 128 C 182 154 188 182 188 285 C 188 312 178 322 140 322 C 102 322 92 312 92 285 C 92 182 98 154 114 128 C 126 108 134 102 140 102 Z" fill="url(#reflGrad-${id})" opacity="0.5" />

    <!-- Specular Highlight Curve -->
    <path d="M 106 145 C 100 175 100 250 102 295" stroke="rgba(255,255,255,0.6)" stroke-width="2.5" stroke-linecap="round" fill="none" />

    <!-- Gold Collar Ring -->
    <rect x="122" y="90" width="36" height="15" rx="2" fill="url(#goldGrad-${id})" stroke="#6b5014" stroke-width="0.8" />

    <!-- Oriental Onion Dome Cap (القبة الشرقية) -->
    <rect x="124" y="84" width="32" height="6" rx="1.5" fill="url(#goldGrad-${id})" />
    <path d="M 125 84 C 120 74 114 62 124 50 C 132 40 137 32 140 22 C 143 32 148 40 156 50 C 166 62 160 74 155 84 Z" fill="#fafafa" stroke="url(#goldGrad-${id})" stroke-width="1.2" />
    <ellipse cx="140" cy="22" rx="2.5" ry="3.5" fill="url(#goldGrad-${id})" />
    ` : (isMoon || isAllure ? `
    <!-- MOON NIGHT / MISS ALLURE: Curved Cylinder + Gold Band & Glossy Cap -->
    <!-- Cylinder Glass Body with Rounded Shoulder -->
    <path d="M 140 102 C 146 102 165 106 182 122 C 190 130 192 144 192 160 L 192 295 C 192 315 180 322 140 322 C 100 322 88 315 88 295 L 88 160 C 88 144 90 130 98 122 C 115 106 134 102 140 102 Z" fill="${isMoon ? '#0a0810' : '#1a040f'}" stroke="url(#goldGrad-${id})" stroke-width="1.2" />

    <!-- Inner Liquid Glow -->
    <path d="M 140 110 C 145 110 162 114 176 128 C 184 136 186 148 186 162 L 186 288 C 186 306 176 314 140 314 C 104 314 94 306 94 288 L 94 162 C 94 148 96 136 104 128 C 118 114 135 110 140 110 Z" fill="${isMoon ? '#4a2a12' : '#610a24'}" opacity="0.75" />
    <path d="M 140 102 C 146 102 165 106 182 122 C 190 130 192 144 192 160 L 192 295 C 192 315 180 322 140 322 C 100 322 88 315 88 295 L 88 160 C 88 144 90 130 98 122 C 115 106 134 102 140 102 Z" fill="url(#reflGrad-${id})" opacity="0.45" />

    <!-- Glass Specular Highlight -->
    <line x1="98" y1="130" x2="98" y2="300" stroke="rgba(255,255,255,0.4)" stroke-width="2.5" stroke-linecap="round" />

    <!-- Gold Collar Ring -->
    <rect x="120" y="88" width="40" height="16" rx="2" fill="url(#goldGrad-${id})" stroke="#6b5014" stroke-width="0.8" />

    <!-- Glossy Black Cap with Gold Bottom Band -->
    <rect x="114" y="82" width="52" height="6" rx="1.5" fill="url(#goldGrad-${id})" />
    <rect x="116" y="32" width="48" height="50" rx="4" fill="#09080d" stroke="#2a2533" stroke-width="1" />
    <line x1="120" y1="36" x2="120" y2="78" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-linecap="round" />
    ` : `
    <!-- SOKOON: Beveled Crystal Rectangular Flacon + Diamond Stopper + Dip Tube -->
    <!-- Outer Crystal Glass with Cut Bevels -->
    <polygon points="90,122 104,106 176,106 190,122 190,305 178,322 102,322 90,305" fill="#ffffff" fill-opacity="0.08" stroke="url(#goldGrad-${id})" stroke-width="1.2" />

    <!-- Inner Golden Perfume Liquid -->
    <polygon points="98,135 108,122 172,122 182,135 182,295 174,308 106,308 98,295" fill="#f5ce62" fill-opacity="0.88" />
    <polygon points="90,122 104,106 176,106 190,122 190,305 178,322 102,322 90,305" fill="url(#reflGrad-${id})" opacity="0.6" />

    <!-- Perfume Dip Tube -->
    <line x1="140" y1="106" x2="140" y2="305" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round" />

    <!-- Faceted Bevel Highlights -->
    <line x1="104" y1="106" x2="102" y2="322" stroke="rgba(255,255,255,0.55)" stroke-width="1.5" />
    <line x1="176" y1="106" x2="178" y2="322" stroke="rgba(255,255,255,0.3)" stroke-width="1" />

    <!-- Gold Collar & Faceted Ring -->
    <rect x="122" y="90" width="36" height="16" rx="2" fill="url(#goldGrad-${id})" stroke="#6b5014" stroke-width="0.8" />
    <polygon points="120,88 126,78 154,78 160,88" fill="#ffffff" fill-opacity="0.4" stroke="url(#goldGrad-${id})" stroke-width="0.8" />

    <!-- Diamond-Cut Crystal Prism Stopper -->
    <polygon points="122,76 112,42 128,26 152,26 168,42 158,76" fill="#ffffff" fill-opacity="0.35" stroke="url(#goldGrad-${id})" stroke-width="1.2" />
    <polygon points="128,26 140,40 152,26" fill="#ffffff" fill-opacity="0.8" />
    <polygon points="112,42 140,40 128,26" fill="rgba(255,255,255,0.2)" />
    <polygon points="168,42 140,40 152,26" fill="rgba(255,255,255,0.5)" />
    <line x1="140" y1="40" x2="140" y2="76" stroke="url(#goldGrad-${id})" stroke-width="1.5" />
    `)}

    <!-- ==========================================
         GENUINE GOLD SCREEN-PRINTED BRANDING & CALLIGRAPHY
         ========================================== -->
    <!-- Official Pointed Islamic Arch Mihrab Logo (بيت المسك) -->
    <path d="M 129 194 L 129 178 C 129 171 135 167 140 163 C 145 167 151 171 151 178 L 151 194 Z" fill="none" stroke="url(#goldGrad-${id})" stroke-width="1.8" />
    <circle cx="140" cy="176" r="3.2" fill="url(#goldGrad-${id})" />
    <path d="M 136 181 Q 140 179 144 181 L 145 189 Q 140 192 135 189 Z" fill="url(#goldGrad-${id})" />
    <path d="M 148 190 Q 151 184 149 179 Q 152 174 149 170" stroke="url(#goldGrad-${id})" stroke-width="1.2" fill="none" stroke-linecap="round" />

    <!-- Arabic Calligraphy -->
    <text x="140" y="206" text-anchor="middle" font-family="'Amiri', serif" font-weight="700" font-size="12" fill="url(#goldGrad-${id})" letter-spacing="0.5">بيت المسك</text>
    
    <!-- English Luxury Serif -->
    <text x="140" y="217" text-anchor="middle" font-family="'Cinzel', serif" font-weight="700" font-size="7.5" fill="url(#goldGrad-${id})" letter-spacing="1.5">BEIT AL-MUSK</text>

    ${isSokoon ? `
    <!-- SOKOON: Gold Cartouche Frame -->
    <rect x="114" y="226" width="52" height="20" rx="10" fill="none" stroke="url(#goldGrad-${id})" stroke-width="1.2" />
    <text x="140" y="240" text-anchor="middle" font-family="'Amiri', serif" font-weight="700" font-size="12" fill="url(#goldGrad-${id})">سكون</text>
    <text x="140" y="255" text-anchor="middle" font-family="'Cinzel', serif" font-size="5" fill="url(#goldGrad-${id})" letter-spacing="1.2">SOKOON</text>
    ` : (isMoon ? `
    <!-- MOON NIGHT -->
    <text x="140" y="226" text-anchor="middle" font-family="'Cinzel', serif" font-style="italic" font-size="4.5" fill="url(#goldGrad-${id})">Leave Your Mark</text>
    <text x="140" y="238" text-anchor="middle" font-family="'Cinzel', serif" font-weight="700" font-size="8.5" fill="url(#goldGrad-${id})" letter-spacing="1">MOON NIGHT</text>
    <text x="140" y="250" text-anchor="middle" font-family="'Amiri', serif" font-weight="700" font-size="9" fill="url(#goldGrad-${id})">مون نايت</text>
    ` : (isAllure ? `
    <!-- MISS ALLURE -->
    <text x="140" y="226" text-anchor="middle" font-family="'Cinzel', serif" font-style="italic" font-size="4.5" fill="url(#goldGrad-${id})">Leave Your Mark</text>
    <text x="140" y="238" text-anchor="middle" font-family="'Cinzel', serif" font-weight="700" font-size="9" fill="url(#goldGrad-${id})" letter-spacing="0.8">Miss allure</text>
    <text x="140" y="250" text-anchor="middle" font-family="'Amiri', serif" font-weight="700" font-size="9" fill="url(#goldGrad-${id})">ميس ألور</text>
    ` : `
    <!-- SAKURA -->
    <text x="140" y="226" text-anchor="middle" font-family="'Cinzel', serif" font-style="italic" font-size="4.5" fill="url(#goldGrad-${id})">Leave Your Mark</text>
    <text x="140" y="238" text-anchor="middle" font-family="'Cinzel', serif" font-weight="700" font-size="9" fill="url(#goldGrad-${id})" letter-spacing="1">Sakura</text>
    <text x="140" y="250" text-anchor="middle" font-family="'Amiri', serif" font-weight="700" font-size="9" fill="url(#goldGrad-${id})">ساكورا</text>
    `))}
  </svg>
  `;
}

window.DEFAULT_PRODUCTS = DEFAULT_PRODUCTS;
window.generateBottleSvg = generateBottleSvg;
