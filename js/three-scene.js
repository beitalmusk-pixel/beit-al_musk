/**
 * بيت المسك • BEIT AL-MUSK - Interactive 3D Showroom
 * High-end WebGL Three.js showroom featuring official luxury perfume bottles
 * with dynamic spotlights, realistic glass refraction, fluid cores, and hover interactions.
 */

class PerfumeShowroom {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.bottles = [];
    this.bottleGroups = [];
    this.spotlights = [];
    this.mainSpotlight = null;
    this.mensSpotlight = null;
    this.womensSpotlight = null;
    this.mensBanner = null;
    this.womensBanner = null;
    this.pedestalGroup = null;
    this.mensTurntable = null;
    this.womensTurntable = null;
    this.turntableSpinSpeed = 0.0055;
    this.particles = null;

    // Omnidirectional 3D Spherical Orbit State & Dual Royal Podiums
    this.targetCenter = new THREE.Vector3(-3.8, 0.95, 0);
    this.currentCenter = new THREE.Vector3(-3.8, 0.95, 0);
    this.activePodium = "men";
    this.targetYaw = 0;
    this.currentYaw = 0;
    this.targetPitch = 0.16;
    this.currentPitch = 0.16;
    this.targetDistance = 7.0;
    this.currentDistance = 7.0;
    this.minDistance = 4.5;
    this.maxDistance = 16.5;
    this.minPitch = -0.10; // Low angle looking up
    this.maxPitch = 1.25;  // Top-down aerial view (~72 deg)

    this.selectedBottleIndex = 0;
    this.hoveredBottleIndex = -1;
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.pointerDownPos = { x: 0, y: 0 };
    this.dragDistance = 0;
    this.autoRotate = true;
    this.autoRotateSpeed = 0.0016;
    this.orbitRadius = 5.0;
    this.idleTimer = null;
    this.lastTouchDist = 0;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);
    this.logoProcessedCanvas = null;

    try {
      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      logoImg.src = "assets/logo.jpg";
      logoImg.onload = () => {
        this.logoProcessedCanvas = this.createGoldLogoAlphaCanvas(logoImg);
        this.refreshBottleLabels();
      };
    } catch (e) {
      // fallback
    }

    this.init();
  }

  // --- Extract pure gold emblem with transparent background from official logo ---
  createGoldLogoAlphaCanvas(img) {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width || 512;
    c.height = img.naturalHeight || img.height || 512;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      if (brightness < 30) {
        d[i + 3] = 0; // Pure black background becomes fully transparent
      } else {
        // Enhance luminous 24K gold foil brilliance
        d[i] = Math.min(255, Math.max(r, 230));
        d[i + 1] = Math.min(255, Math.max(g, 195));
        d[i + 2] = Math.min(255, Math.max(b, 105));
        d[i + 3] = Math.min(255, Math.round(brightness * 2.3));
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return c;
  }

  // --- Refresh all bottle labels with official branding once loaded ---
  refreshBottleLabels() {
    this.bottleGroups.forEach(bg => {
      if (bg.userData && bg.userData.labelMesh && bg.userData.product) {
        const newTex = this.createLabelTexture(bg.userData.product);
        bg.userData.labelMesh.material.map = newTex;
        bg.userData.labelMesh.material.needsUpdate = true;
      }
    });
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x07060a, 0.05);

    // 2. Camera (Adaptive FOV for Mobile & Desktop)
    const isMobile = width < 640;
    const fov = isMobile ? 48 : 40;
    this.targetDistance = isMobile ? 10.8 : 9.5;
    this.currentDistance = this.targetDistance;
    this.camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 100);
    this.camera.position.set(0, 2.2, this.targetDistance);
    this.camera.lookAt(this.targetCenter);

    // 3. Renderer (High-Speed Optimized)
    this.renderer = new THREE.WebGLRenderer({
      antialias: !isMobile, // optimize performance on mobile
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.0 : 1.25));
    this.renderer.shadowMap.enabled = !isMobile;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    this.container.appendChild(this.renderer.domElement);

    // 3.5 Viewport Visibility Observer (pause rendering when scrolled away!)
    this.isVisible = true;
    if ('IntersectionObserver' in window && this.container) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          this.isVisible = entry.isIntersecting;
        });
      }, { threshold: 0.05 });
      this.observer.observe(this.container);
    }

    // 3.6 Photorealistic Studio Environment Reflections
    try {
      this.scene.environment = this.createShowroomEnvMap(this.renderer);
    } catch (e) {
      console.warn("EnvMap fallback:", e);
    }

    // 4. Build Showroom Elements
    this.buildShowroomEnvironment();
    this.buildLighting();
    this.loadProducts(window.Storage ? window.Storage.getProducts() : window.DEFAULT_PRODUCTS);
    this.createFloatingGoldDust();

    // 5. Events
    this.setupEvents();

    // 6. Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    // Default select first perfume
    setTimeout(() => {
      this.selectBottle(0, false);
    }, 200);
  }

  buildShowroomEnvironment() {
    this.pedestalGroup = new THREE.Group();

    // 1. Shared Grand Studio Floor (Deep Obsidian Reflective Base)
    const studioFloorGeo = new THREE.CylinderGeometry(13.8, 14.2, 0.1, 64);
    const studioFloorMat = new THREE.MeshStandardMaterial({
      color: 0x08070d,
      roughness: 0.32,
      metalness: 0.65,
      flatShading: false
    });
    const studioFloor = new THREE.Mesh(studioFloorGeo, studioFloorMat);
    studioFloor.position.y = -0.22;
    studioFloor.receiveShadow = true;
    this.pedestalGroup.add(studioFloor);

    // 2. Central Connecting Crest Plinth (⚜️ بيت المسك ⚜️ between both wings)
    const centerCrestGeo = new THREE.CylinderGeometry(0.9, 1.0, 0.08, 36);
    const centerCrestMat = new THREE.MeshStandardMaterial({
      color: 0x14121b,
      roughness: 0.28,
      metalness: 0.8
    });
    const centerCrest = new THREE.Mesh(centerCrestGeo, centerCrestMat);
    centerCrest.position.set(0, -0.17, 0);
    this.pedestalGroup.add(centerCrest);

    const centerRimGeo = new THREE.TorusGeometry(0.9, 0.02, 16, 48);
    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.95,
      roughness: 0.18,
      emissive: 0x3d2c08,
      emissiveIntensity: 0.2
    });
    const centerRim = new THREE.Mesh(centerRimGeo, goldTrimMat);
    centerRim.rotation.x = Math.PI / 2;
    centerRim.position.set(0, -0.125, 0);
    this.pedestalGroup.add(centerRim);

    // =========================================================================
    // 3. Left Podium: جناح العطور الرجالية الملكية (Men's Podium 👑 - Obsidian & Gold Rotating Turntable)
    // =========================================================================
    this.mensPodiumGroup = new THREE.Group();
    this.mensPodiumGroup.position.set(-3.8, 0, 0);

    // Motorized Rotating Turntable for Men
    this.mensTurntable = new THREE.Group();

    // Men's Obsidian Marble Cylinder
    const mensPodiumGeo = new THREE.CylinderGeometry(2.7, 2.85, 0.35, 64);
    const mensPodiumMat = new THREE.MeshStandardMaterial({
      color: 0x0c0b12,
      roughness: 0.20,
      metalness: 0.85,
      flatShading: false
    });
    const mensPodium = new THREE.Mesh(mensPodiumGeo, mensPodiumMat);
    mensPodium.position.y = -0.175;
    mensPodium.receiveShadow = true;
    this.mensTurntable.add(mensPodium);

    // Men's 24K Polished Gold Outer Inlay Rim
    const mensOuterRimGeo = new THREE.TorusGeometry(2.7, 0.045, 16, 80);
    const mensOuterRim = new THREE.Mesh(mensOuterRimGeo, goldTrimMat);
    mensOuterRim.rotation.x = Math.PI / 2;
    mensOuterRim.position.y = 0.01;
    this.mensTurntable.add(mensOuterRim);

    // Men's 24K Gold Inner Concentric Ring
    const mensInnerRimGeo = new THREE.TorusGeometry(1.5, 0.025, 16, 64);
    const mensInnerRim = new THREE.Mesh(mensInnerRimGeo, goldTrimMat);
    mensInnerRim.rotation.x = Math.PI / 2;
    mensInnerRim.position.y = 0.012;
    this.mensTurntable.add(mensInnerRim);

    // Men's Floor Medallion (Crown 👑 & Royal Arabic Calligraphy)
    const mensMedallionTex = this.createPodiumMedallionCanvas("men");
    const mensMedallionMat = new THREE.MeshBasicMaterial({
      map: mensMedallionTex,
      transparent: true
    });
    const mensMedallionGeo = new THREE.CircleGeometry(2.6, 64);
    const mensMedallion = new THREE.Mesh(mensMedallionGeo, mensMedallionMat);
    mensMedallion.rotation.x = -Math.PI / 2;
    mensMedallion.position.y = 0.005;
    this.mensTurntable.add(mensMedallion);

    this.mensPodiumGroup.add(this.mensTurntable);
    this.pedestalGroup.add(this.mensPodiumGroup);

    // Men's Floating 3D Sign Plaque (Static in space above podium, bobbing)
    this.mensBanner = this.createPodiumBannerMesh("men", -3.8);
    this.scene.add(this.mensBanner);

    // =========================================================================
    // 4. Right Podium: جناح العطور النسائية الملكية (Women's Podium 🌸 - Pearl White & Rose Gold Rotating Turntable)
    // =========================================================================
    this.womensPodiumGroup = new THREE.Group();
    this.womensPodiumGroup.position.set(3.8, 0, 0);

    // Motorized Rotating Turntable for Women
    this.womensTurntable = new THREE.Group();

    // Women's Pearl White Marble Cylinder
    const womensPodiumGeo = new THREE.CylinderGeometry(2.7, 2.85, 0.35, 64);
    const womensPodiumMat = new THREE.MeshStandardMaterial({
      color: 0xf5f3f4,
      roughness: 0.22,
      metalness: 0.35,
      flatShading: false
    });
    const womensPodium = new THREE.Mesh(womensPodiumGeo, womensPodiumMat);
    womensPodium.position.y = -0.175;
    womensPodium.receiveShadow = true;
    this.womensTurntable.add(womensPodium);

    // Women's Polished Rose Gold Outer Inlay Rim
    const roseGoldMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      metalness: 0.94,
      roughness: 0.18,
      emissive: 0x4a152e,
      emissiveIntensity: 0.25
    });
    const womensOuterRimGeo = new THREE.TorusGeometry(2.7, 0.045, 16, 80);
    const womensOuterRim = new THREE.Mesh(womensOuterRimGeo, roseGoldMat);
    womensOuterRim.rotation.x = Math.PI / 2;
    womensOuterRim.position.y = 0.01;
    this.womensTurntable.add(womensOuterRim);

    // Women's Rose Gold Inner Concentric Ring
    const womensInnerRimGeo = new THREE.TorusGeometry(1.5, 0.025, 16, 64);
    const womensInnerRim = new THREE.Mesh(womensInnerRimGeo, roseGoldMat);
    womensInnerRim.rotation.x = Math.PI / 2;
    womensInnerRim.position.y = 0.012;
    this.womensTurntable.add(womensInnerRim);

    // Women's Floor Medallion (Blossom 🌸 & Royal Arabic Calligraphy)
    const womensMedallionTex = this.createPodiumMedallionCanvas("women");
    const womensMedallionMat = new THREE.MeshBasicMaterial({
      map: womensMedallionTex,
      transparent: true
    });
    const womensMedallionGeo = new THREE.CircleGeometry(2.6, 64);
    const womensMedallion = new THREE.Mesh(womensMedallionGeo, womensMedallionMat);
    womensMedallion.rotation.x = -Math.PI / 2;
    womensMedallion.position.y = 0.005;
    this.womensTurntable.add(womensMedallion);

    this.womensPodiumGroup.add(this.womensTurntable);
    this.pedestalGroup.add(this.womensPodiumGroup);

    // Women's Floating 3D Sign Plaque
    this.womensBanner = this.createPodiumBannerMesh("women", 3.8);
    this.scene.add(this.womensBanner);

    this.scene.add(this.pedestalGroup);
  }

  // --- 3D Floor Medallions for Men's and Women's Wings ---
  createPodiumMedallionCanvas(type) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    const cx = 512, cy = 512;

    if (type === "men") {
      // Obsidian Dark & 24K Gold Crown Medallion
      const bgGrad = ctx.createRadialGradient(cx, cy, 60, cx, cy, 510);
      bgGrad.addColorStop(0, "#161320");
      bgGrad.addColorStop(0.68, "#0c0a13");
      bgGrad.addColorStop(1, "#07060a");
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 510, 0, Math.PI * 2);
      ctx.fill();

      // Outer Gold Engraved Rim
      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, 480, 0, Math.PI * 2);
      ctx.stroke();

      // Gold Star Studs
      ctx.fillStyle = "#fae4a2";
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const x = cx + Math.cos(a) * 458;
        const y = cy + Math.sin(a) * 458;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Secondary Dashed Trim
      ctx.strokeStyle = "rgba(212, 175, 55, 0.65)";
      ctx.lineWidth = 4;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.arc(cx, cy, 435, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Inner Solid Gold Circle
      ctx.strokeStyle = "rgba(212, 175, 55, 0.4)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 270, 0, Math.PI * 2);
      ctx.stroke();

      // Islamic 8-Point Geometric Royal Star
      ctx.save();
      ctx.strokeStyle = "#fae4a2";
      ctx.lineWidth = 4;
      ctx.shadowColor = "rgba(212, 175, 55, 0.8)";
      ctx.shadowBlur = 15;
      for (let r = 0; r < 2; r++) {
        ctx.beginPath();
        const rot = (r * Math.PI) / 4;
        for (let i = 0; i < 4; i++) {
          const a = rot + (i * Math.PI) / 2;
          const px = cx + Math.cos(a) * 230;
          const py = cy + Math.sin(a) * 230;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();

      // Grand 👑 Royal Insignia in center (Clean, no text clutter)
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "160px serif";
      ctx.shadowColor = "rgba(212, 175, 55, 0.85)";
      ctx.shadowBlur = 18;
      ctx.fillText("👑", cx, cy);
      ctx.shadowBlur = 0;

    } else {
      // Pearl White Marble & Rose Gold Blossom Medallion
      const bgGrad = ctx.createRadialGradient(cx, cy, 60, cx, cy, 510);
      bgGrad.addColorStop(0, "#ffffff");
      bgGrad.addColorStop(0.65, "#faf5f8");
      bgGrad.addColorStop(1, "#f3e8ee");
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 510, 0, Math.PI * 2);
      ctx.fill();

      // Outer Rose Gold Rim
      ctx.strokeStyle = "#f472b6";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, 480, 0, Math.PI * 2);
      ctx.stroke();

      // Floral Studs
      ctx.fillStyle = "#ec4899";
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const x = cx + Math.cos(a) * 458;
        const y = cy + Math.sin(a) * 458;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Secondary Dashed Trim
      ctx.strokeStyle = "rgba(244, 114, 182, 0.65)";
      ctx.lineWidth = 4;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.arc(cx, cy, 435, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Inner Solid Rose Gold Circle
      ctx.strokeStyle = "rgba(244, 114, 182, 0.4)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 270, 0, Math.PI * 2);
      ctx.stroke();

      // 12-Petal Sacred Floral Rosette Geometry
      ctx.save();
      ctx.strokeStyle = "rgba(244, 114, 182, 0.55)";
      ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(244, 114, 182, 0.6)";
      ctx.shadowBlur = 12;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const ox = cx + Math.cos(a) * 110;
        const oy = cy + Math.sin(a) * 110;
        ctx.beginPath();
        ctx.arc(ox, oy, 120, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Grand 🌸 Blossom in center (Clean, no text clutter)
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "160px serif";
      ctx.shadowColor = "rgba(244, 114, 182, 0.7)";
      ctx.shadowBlur = 16;
      ctx.fillText("🌸", cx, cy);
      ctx.shadowBlur = 0;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 16;
    tex.needsUpdate = true;
    return tex;
  }

  // --- Floating 3D Holographic Banner Plaques ---
  createPodiumBannerMesh(type, posX) {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");

    const isMen = type === "men";
    const pillW = 600, pillH = 150;
    const x = (640 - pillW) / 2, y = (180 - pillH) / 2, r = 75;

    // Rounded background pill
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, pillW, pillH, r);
    } else {
      ctx.rect(x, y, pillW, pillH);
    }
    ctx.fillStyle = isMen ? "rgba(12, 11, 18, 0.94)" : "rgba(28, 16, 25, 0.94)";
    ctx.fill();

    // Metallic Border
    ctx.strokeStyle = isMen ? "#d4af37" : "#f472b6";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();

    // Inner subtle accent stroke
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x + 8, y + 8, pillW - 16, pillH - 16, r - 8);
    }
    ctx.strokeStyle = isMen ? "rgba(212, 175, 55, 0.4)" : "rgba(244, 114, 182, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Typography
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (isMen) {
      ctx.fillStyle = "#fae4a2";
      ctx.font = "bold 38px 'Amiri', serif";
      ctx.shadowColor = "rgba(212, 175, 55, 0.6)";
      ctx.shadowBlur = 8;
      ctx.fillText("👑  جناح العطور الرجالية", 320, 70);
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#d4af37";
      ctx.font = "bold 20px 'Cinzel', serif";
      ctx.fillText("POUR HOMME • ROYAL SELECTION", 320, 122);
    } else {
      ctx.fillStyle = "#fce7f3";
      ctx.font = "bold 38px 'Amiri', serif";
      ctx.shadowColor = "rgba(244, 114, 182, 0.6)";
      ctx.shadowBlur = 8;
      ctx.fillText("🌸  جناح العطور النسائية", 320, 70);
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#f472b6";
      ctx.font = "bold 20px 'Cinzel', serif";
      ctx.fillText("POUR FEMME • MAISON ELIXIR", 320, 122);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 8;
    tex.needsUpdate = true;

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide
    });
    const geo = new THREE.PlaneGeometry(2.6, 0.73);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(posX, 3.35, -0.2);
    mesh.userData = { baseY: 3.35, phase: isMen ? 0 : Math.PI };
    return mesh;
  }

  buildLighting() {
    // Soft Ambient fill
    const ambientLight = new THREE.AmbientLight(0x252030, 0.75);
    this.scene.add(ambientLight);

    // Warm Hemisphere Light (Gold from top, deep navy from ground)
    const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x050409, 0.65);
    this.scene.add(hemiLight);

    // Dedicated Men's Spotlight (Warm Amber Gold on Left Podium)
    this.mensSpotlight = new THREE.SpotLight(0xffb84d, 3.2, 22, Math.PI / 4.6, 0.55, 1.2);
    this.mensSpotlight.position.set(-3.8, 7.8, 2.5);
    this.mensSpotlight.target.position.set(-3.8, 0.5, 0);
    this.scene.add(this.mensSpotlight);
    this.scene.add(this.mensSpotlight.target);

    // Dedicated Women's Spotlight (Soft Rose Champagne on Right Podium)
    this.womensSpotlight = new THREE.SpotLight(0xffd1dc, 3.2, 22, Math.PI / 4.6, 0.55, 1.2);
    this.womensSpotlight.position.set(3.8, 7.8, 2.5);
    this.womensSpotlight.target.position.set(3.8, 0.5, 0);
    this.scene.add(this.womensSpotlight);
    this.scene.add(this.womensSpotlight.target);

    // Main Dynamic Spotlight (Tracks the active / focused bottle)
    this.mainSpotlight = new THREE.SpotLight(0xffeedd, 3.8);
    this.mainSpotlight.position.set(0, 8.0, 3.5);
    this.mainSpotlight.angle = Math.PI / 6.5;
    this.mainSpotlight.penumbra = 0.65;
    this.mainSpotlight.decay = 1.4;
    this.mainSpotlight.distance = 25;
    this.mainSpotlight.castShadow = true;
    this.mainSpotlight.shadow.mapSize.width = 512;
    this.mainSpotlight.shadow.mapSize.height = 512;
    this.mainSpotlight.shadow.camera.near = 1;
    this.mainSpotlight.shadow.camera.far = 20;
    this.mainSpotlight.shadow.bias = -0.001;
    this.scene.add(this.mainSpotlight);
    this.scene.add(this.mainSpotlight.target);

    // Secondary subtle rim light
    const rimLight = new THREE.DirectionalLight(0xd4af37, 1.0);
    rimLight.position.set(-5, 6, -5);
    this.scene.add(rimLight);

    // Front fill light
    const frontFill = new THREE.PointLight(0xffffff, 0.75, 18);
    frontFill.position.set(0, 3.5, 6.5);
    this.scene.add(frontFill);
  }

  createFloatingGoldDust() {
    const particleCount = 50;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 1] = Math.random() * 6 - 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
      scales[i] = Math.random() * 0.8 + 0.2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

    // Custom shader material for soft glowing golden dust
    const dustMat = new THREE.PointsMaterial({
      color: 0xffd97d,
      size: 0.07,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(geometry, dustMat);
    this.scene.add(this.particles);
  }

  loadProducts(products) {
    // Remove existing bottles from turntables / scene
    this.bottleGroups.forEach(bg => {
      if (bg.parent) bg.parent.remove(bg);
      this.scene.remove(bg);
    });
    this.bottles = [];
    this.bottleGroups = [];

    // Separate products into Men's and Women's wings
    const menProducts = [];
    const womenProducts = [];

    products.forEach(prod => {
      const isWomen = prod.podium === "women" || (prod.gender && (prod.gender.includes("حريمي") || prod.gender.includes("نسائي") || prod.gender.includes("Femme")));
      if (isWomen) {
        womenProducts.push(prod);
      } else {
        menProducts.push(prod);
      }
    });

    let globalIndex = 0;

    // Helper to position a group on its rotating turntable around the circle
    const placePodiumGroup = (groupProds, podiumType, turntableGroup, podiumX) => {
      if (!turntableGroup) return;

      // In the showroom, populate the circular turntable evenly around the perimeter (0, 90, 180, 270 deg)
      // If 2 products (e.g. Moon Night & Sakura), alternate them [p0, p1, p0, p1] so there are 4 bottles
      // arranged in a full circle around the royal medallion, exactly as it was originally placed!
      let displayList = groupProds;
      if (groupProds.length === 2) {
        displayList = [groupProds[0], groupProds[1], groupProds[0], groupProds[1]];
      }

      const totalBottles = displayList.length;
      const orbitRadius = 1.68;

      displayList.forEach((prod, i) => {
        const angle = (i / totalBottles) * Math.PI * 2;
        const localX = Math.sin(angle) * orbitRadius;
        const localZ = Math.cos(angle) * orbitRadius;

        const bottleGroup = this.createPerfumeMesh(prod, globalIndex);
        bottleGroup.position.set(localX, 0.05, localZ);
        bottleGroup.rotation.y = angle; // Face radially outward from turntable center

        bottleGroup.userData = {
          index: globalIndex,
          product: prod,
          podium: podiumType,
          podiumX: podiumX,
          turntable: turntableGroup,
          baseAngle: angle,
          localX: localX,
          localZ: localZ,
          baseY: 0.05,
          targetY: 0.05,
          targetScale: 1.0,
          currentScale: 1.0
        };

        turntableGroup.add(bottleGroup);
        this.bottleGroups.push(bottleGroup);
        globalIndex++;
      });
    };

    placePodiumGroup(menProducts, "men", this.mensTurntable, -3.8);
    placePodiumGroup(womenProducts, "women", this.womensTurntable, 3.8);
  }

  createShowroomEnvMap(renderer) {
    if (!THREE.PMREMGenerator) return null;
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const envCanvas = document.createElement("canvas");
    envCanvas.width = 256;
    envCanvas.height = 128;
    const ctx = envCanvas.getContext("2d");

    // Studio lighting gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, "#191522");
    grad.addColorStop(0.42, "#2b2136");
    grad.addColorStop(0.50, "#8a6a26");
    grad.addColorStop(0.53, "#1a1622");
    grad.addColorStop(1, "#07060a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 128);

    // Studio softbox highlights (white/warm diffuse strips)
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillRect(30, 15, 45, 55);
    ctx.fillRect(170, 20, 40, 50);

    // Warm golden fill light strip
    ctx.fillStyle = "rgba(235, 195, 120, 0.65)";
    ctx.fillRect(100, 30, 38, 38);

    const tex = new THREE.CanvasTexture(envCanvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const envTexture = pmremGenerator.fromEquirectangular(tex).texture;
    pmremGenerator.dispose();
    return envTexture;
  }

  createLabelTexture(prod) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, 1024, 1024);

    const cx = 512;

    // 1. Draw Official Beit Al-Musk Logo
    if (this.logoProcessedCanvas) {
      // Draw extracted gold alpha logo
      ctx.drawImage(this.logoProcessedCanvas, cx - 275, 40, 550, 550);
    } else {
      // Vector fallback identical to the official logo
      const goldGrad = ctx.createLinearGradient(350, 120, 674, 880);
      goldGrad.addColorStop(0, "#fff4c8");
      goldGrad.addColorStop(0.25, "#e5c07b");
      goldGrad.addColorStop(0.55, "#d4af37");
      goldGrad.addColorStop(0.80, "#9c761c");
      goldGrad.addColorStop(1, "#fae4a2");

      ctx.fillStyle = goldGrad;
      ctx.strokeStyle = goldGrad;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Royal Pointed Islamic Arch Mihrab
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(375, 410);
      ctx.lineTo(375, 275);
      ctx.bezierCurveTo(375, 185, 455, 140, 512, 105);
      ctx.bezierCurveTo(569, 140, 649, 185, 649, 275);
      ctx.lineTo(649, 410);
      ctx.closePath();
      ctx.stroke();

      // Perfume Flacon Symbol inside Arch
      ctx.beginPath();
      ctx.arc(512, 230, 42, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(512, 335, 62, 55, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hollow cutout inside flacon
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.ellipse(512, 340, 36, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(512, 230, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Scent vapour trail curve
      ctx.fillStyle = goldGrad;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(615, 375);
      ctx.bezierCurveTo(635, 340, 620, 300, 635, 265);
      ctx.stroke();

      // Arabic Brand Typography
      ctx.font = "bold 96px 'Amiri', 'Traditional Arabic', serif";
      ctx.shadowColor = "rgba(212, 175, 55, 0.45)";
      ctx.shadowBlur = 10;
      ctx.fillText("بيت المسك", cx, 490);
      ctx.shadowBlur = 0;

      // English Brand Typography
      ctx.font = "bold 44px 'Cinzel', serif";
      ctx.fillText("BEIT AL-MUSK", cx, 565);

      // Slogan
      ctx.font = "italic 30px 'Cinzel', serif";
      ctx.fillText("Leave Your Mark", cx, 625);
    }

    // Typography Gradient for Product Names
    const goldGrad = ctx.createLinearGradient(350, 120, 674, 880);
    goldGrad.addColorStop(0, "#fff4c8");
    goldGrad.addColorStop(0.25, "#e5c07b");
    goldGrad.addColorStop(0.55, "#d4af37");
    goldGrad.addColorStop(0.80, "#9c761c");
    goldGrad.addColorStop(1, "#fae4a2");

    ctx.fillStyle = goldGrad;
    ctx.strokeStyle = goldGrad;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 2. Product Specific Screenprint Signature
    if (prod.id === "sokoon") {
      ctx.lineWidth = 8;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(330, 645, 364, 120, 60);
      } else {
        ctx.strokeRect(330, 645, 364, 120);
      }
      ctx.stroke();

      ctx.font = "bold 84px 'Amiri', serif";
      ctx.fillText("سكون", cx, 705);

      ctx.font = "bold 30px 'Cinzel', sans-serif";
      ctx.fillText("SOKOON", cx, 805);

    } else if (prod.id === "moon-night") {
      ctx.font = "bold 68px 'Cinzel', serif";
      ctx.fillText("MOON NIGHT", cx, 705);

      ctx.font = "bold 48px 'Amiri', serif";
      ctx.fillText("مون نايت", cx, 785);

    } else if (prod.id === "miss-allure") {
      ctx.font = "bold 70px 'Cinzel', serif";
      ctx.fillText("Miss allure", cx, 705);

      ctx.font = "bold 48px 'Amiri', serif";
      ctx.fillText("ميس ألور", cx, 785);

    } else if (prod.id === "sakura") {
      ctx.font = "bold 74px 'Cinzel', serif";
      ctx.fillText("Sakura", cx, 705);

      ctx.font = "bold 48px 'Amiri', serif";
      ctx.fillText("ساكورا", cx, 785);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 16;
    texture.needsUpdate = true;
    return texture;
  }

  createPerfumeMesh(prod, index) {
    const group = new THREE.Group();
    const vis = prod.visual || {};
    const accentColorHex = parseInt((vis.accentHex || "#d4af37").replace("#", "0x"), 16);

    // 1. Soft Floor Contact Shadow
    const shadowGeo = new THREE.PlaneGeometry(1.6, 1.6);
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext("2d");
    const sGrad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 64);
    sGrad.addColorStop(0, "rgba(0,0,0,0.85)");
    sGrad.addColorStop(0.35, "rgba(0,0,0,0.40)");
    sGrad.addColorStop(1, "rgba(0,0,0,0)");
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.85 });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.005;
    group.add(shadowMesh);

    // 2. High-Grade Polished 24K Gold Material
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xefd188,
      metalness: 0.96,
      roughness: 0.12,
      emissive: 0x3d2c08,
      emissiveIntensity: 0.2,
      envMapIntensity: 1.8
    });

    let outerGlassMesh, liquidMesh, cap;

    if (prod.id === "sakura") {
      // ==========================================
      // عطر ساكورا (Sakura) - Pure Pearl White Amphora Flacon + Oriental Dome Cap
      // ==========================================
      const sakuraPoints = [];
      sakuraPoints.push(new THREE.Vector2(0, 0));
      sakuraPoints.push(new THREE.Vector2(0.48, 0));
      sakuraPoints.push(new THREE.Vector2(0.53, 0.08));
      sakuraPoints.push(new THREE.Vector2(0.53, 0.88));
      sakuraPoints.push(new THREE.Vector2(0.51, 1.08));
      sakuraPoints.push(new THREE.Vector2(0.44, 1.28));
      sakuraPoints.push(new THREE.Vector2(0.34, 1.46));
      sakuraPoints.push(new THREE.Vector2(0.28, 1.56));
      sakuraPoints.push(new THREE.Vector2(0.28, 1.62));
      const sakuraBodyGeo = new THREE.LatheGeometry(sakuraPoints, 48);

      const sakuraMat = new THREE.MeshPhysicalMaterial({
        color: 0xfcfcfc,
        roughness: 0.20,
        metalness: 0.04,
        clearcoat: 0.95,
        clearcoatRoughness: 0.10,
        reflectivity: 0.85,
        envMapIntensity: 1.5
      });
      outerGlassMesh = new THREE.Mesh(sakuraBodyGeo, sakuraMat);
      outerGlassMesh.castShadow = true;
      group.add(outerGlassMesh);

      // Liquid core placeholder (for focus animation)
      const liquidGeo = new THREE.CylinderGeometry(0.40, 0.40, 1.0, 24);
      const dummyMat = new THREE.MeshBasicMaterial({ visible: false });
      liquidMesh = new THREE.Mesh(liquidGeo, dummyMat);
      liquidMesh.position.y = 0.75;
      group.add(liquidMesh);

      // Gold Collar
      const collarGeo = new THREE.CylinderGeometry(0.30, 0.31, 0.20, 36);
      const collar = new THREE.Mesh(collarGeo, goldMat);
      collar.position.y = 1.70;
      collar.castShadow = true;
      group.add(collar);

      // Gold base ring under dome
      const capRingGeo = new THREE.CylinderGeometry(0.29, 0.31, 0.06, 36);
      const capRing = new THREE.Mesh(capRingGeo, goldMat);
      capRing.position.y = 1.82;
      group.add(capRing);

      // Oriental Onion Dome / Arabesque Cupola Cap (القبة الشرقية الأصلية)
      const domePoints = [];
      domePoints.push(new THREE.Vector2(0.28, 0));
      domePoints.push(new THREE.Vector2(0.34, 0.06));
      domePoints.push(new THREE.Vector2(0.41, 0.18)); // widest bulge
      domePoints.push(new THREE.Vector2(0.36, 0.32));
      domePoints.push(new THREE.Vector2(0.25, 0.44)); // inward sweep
      domePoints.push(new THREE.Vector2(0.14, 0.54)); // tapering neck
      domePoints.push(new THREE.Vector2(0.06, 0.63)); // pointed finial tip
      domePoints.push(new THREE.Vector2(0, 0.68));
      const domeGeo = new THREE.LatheGeometry(domePoints, 48);
      cap = new THREE.Mesh(domeGeo, sakuraMat);
      cap.position.y = 1.84;
      cap.castShadow = true;
      group.add(cap);

      // Curved Screen-Printed Gold Calligraphy Label
      const labelGeo = new THREE.CylinderGeometry(0.538, 0.538, 0.90, 36, 1, true, Math.PI * 0.68, Math.PI * 0.64);
      const labelTex = this.createLabelTexture(prod);
      const labelMat = new THREE.MeshBasicMaterial({
        map: labelTex,
        transparent: true,
        opacity: 0.98,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const labelMesh = new THREE.Mesh(labelGeo, labelMat);
      labelMesh.position.y = 0.88;
      labelMesh.rotation.y = 0;
      labelMesh.renderOrder = 20;
      group.userData.labelMesh = labelMesh;
      group.add(labelMesh);

    } else if (prod.id === "moon-night") {
      // ==========================================
      // عطر مون نايت (Moon Night) - Glossy Smoked Obsidian Cylinder + Gold Collar & Black Cap
      // ==========================================
      const moonPoints = [];
      moonPoints.push(new THREE.Vector2(0, 0));
      moonPoints.push(new THREE.Vector2(0.48, 0));
      moonPoints.push(new THREE.Vector2(0.53, 0.06));
      moonPoints.push(new THREE.Vector2(0.53, 1.25));
      moonPoints.push(new THREE.Vector2(0.51, 1.38));
      moonPoints.push(new THREE.Vector2(0.44, 1.48));
      moonPoints.push(new THREE.Vector2(0.33, 1.56));
      moonPoints.push(new THREE.Vector2(0.26, 1.62));
      moonPoints.push(new THREE.Vector2(0.26, 1.66));
      const moonBodyGeo = new THREE.LatheGeometry(moonPoints, 48);

      const moonMat = new THREE.MeshPhysicalMaterial({
        color: 0x09070e,
        transmission: 0.52,
        transparent: true,
        opacity: 0.98,
        roughness: 0.06,
        metalness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        reflectivity: 0.95,
        envMapIntensity: 1.8
      });
      outerGlassMesh = new THREE.Mesh(moonBodyGeo, moonMat);
      outerGlassMesh.castShadow = true;
      group.add(outerGlassMesh);

      // Inner liquid glow (warm amber depth)
      const liquidGeo = new THREE.CylinderGeometry(0.44, 0.44, 1.15, 32);
      const liquidMat = new THREE.MeshPhysicalMaterial({
        color: 0x4a2a12,
        transparent: true,
        opacity: 0.85,
        emissive: 0x331b08,
        emissiveIntensity: 0.35,
        roughness: 0.15
      });
      liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
      liquidMesh.position.y = 0.75;
      group.add(liquidMesh);

      // Gold Collar
      const collarGeo = new THREE.CylinderGeometry(0.30, 0.31, 0.22, 36);
      const collar = new THREE.Mesh(collarGeo, goldMat);
      collar.position.y = 1.74;
      collar.castShadow = true;
      group.add(collar);

      // Gold accent ring band at bottom of cap
      const capRingGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.07, 36);
      const capRing = new THREE.Mesh(capRingGeo, goldMat);
      capRing.position.y = 1.88;
      group.add(capRing);

      // Sleek black cap
      const capGeo = new THREE.CylinderGeometry(0.42, 0.43, 0.58, 36);
      const capMat = new THREE.MeshStandardMaterial({
        color: 0x09080d,
        metalness: 0.85,
        roughness: 0.12,
        envMapIntensity: 1.8
      });
      cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 2.18;
      cap.castShadow = true;
      group.add(cap);

      // Curved Screen-Printed Gold Calligraphy Label
      const labelGeo = new THREE.CylinderGeometry(0.538, 0.538, 0.90, 36, 1, true, Math.PI * 0.68, Math.PI * 0.64);
      const labelTex = this.createLabelTexture(prod);
      const labelMat = new THREE.MeshBasicMaterial({
        map: labelTex,
        transparent: true,
        opacity: 0.98,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const labelMesh = new THREE.Mesh(labelGeo, labelMat);
      labelMesh.position.y = 0.88;
      labelMesh.rotation.y = 0;
      labelMesh.renderOrder = 20;
      group.userData.labelMesh = labelMesh;
      group.add(labelMesh);

    } else if (prod.id === "miss-allure") {
      // ==========================================
      // عطر ميس ألور (Miss Allure) - Deep Ruby Noir Cylinder + Gold Collar & Black Cap
      // ==========================================
      const allurePoints = [];
      allurePoints.push(new THREE.Vector2(0, 0));
      allurePoints.push(new THREE.Vector2(0.48, 0));
      allurePoints.push(new THREE.Vector2(0.53, 0.06));
      allurePoints.push(new THREE.Vector2(0.53, 1.25));
      allurePoints.push(new THREE.Vector2(0.51, 1.38));
      allurePoints.push(new THREE.Vector2(0.44, 1.48));
      allurePoints.push(new THREE.Vector2(0.33, 1.56));
      allurePoints.push(new THREE.Vector2(0.26, 1.62));
      allurePoints.push(new THREE.Vector2(0.26, 1.66));
      const allureBodyGeo = new THREE.LatheGeometry(allurePoints, 48);

      const allureMat = new THREE.MeshPhysicalMaterial({
        color: 0x1d0510,
        transmission: 0.62,
        transparent: true,
        opacity: 0.97,
        roughness: 0.06,
        metalness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        reflectivity: 0.95,
        envMapIntensity: 1.8
      });
      outerGlassMesh = new THREE.Mesh(allureBodyGeo, allureMat);
      outerGlassMesh.castShadow = true;
      group.add(outerGlassMesh);

      // Inner liquid glow (deep crimson ruby)
      const liquidGeo = new THREE.CylinderGeometry(0.44, 0.44, 1.15, 32);
      const liquidMat = new THREE.MeshPhysicalMaterial({
        color: 0x6e0926,
        transparent: true,
        opacity: 0.88,
        emissive: 0x480415,
        emissiveIntensity: 0.38,
        roughness: 0.15
      });
      liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
      liquidMesh.position.y = 0.75;
      group.add(liquidMesh);

      // Gold Collar
      const collarGeo = new THREE.CylinderGeometry(0.30, 0.31, 0.22, 36);
      const collar = new THREE.Mesh(collarGeo, goldMat);
      collar.position.y = 1.74;
      collar.castShadow = true;
      group.add(collar);

      // Gold accent ring band at bottom of cap
      const capRingGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.07, 36);
      const capRing = new THREE.Mesh(capRingGeo, goldMat);
      capRing.position.y = 1.88;
      group.add(capRing);

      // Sleek black cap
      const capGeo = new THREE.CylinderGeometry(0.42, 0.43, 0.58, 36);
      const capMat = new THREE.MeshStandardMaterial({
        color: 0x09080d,
        metalness: 0.85,
        roughness: 0.12,
        envMapIntensity: 1.8
      });
      cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 2.18;
      cap.castShadow = true;
      group.add(cap);

      // Curved Screen-Printed Gold Calligraphy Label
      const labelGeo = new THREE.CylinderGeometry(0.538, 0.538, 0.90, 36, 1, true, Math.PI * 0.68, Math.PI * 0.64);
      const labelTex = this.createLabelTexture(prod);
      const labelMat = new THREE.MeshBasicMaterial({
        map: labelTex,
        transparent: true,
        opacity: 0.98,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const labelMesh = new THREE.Mesh(labelGeo, labelMat);
      labelMesh.position.y = 0.88;
      labelMesh.rotation.y = 0;
      labelMesh.renderOrder = 20;
      group.userData.labelMesh = labelMesh;
      group.add(labelMesh);

    } else {
      // ==========================================
      // عطر سكون (Sokoon) - Crystal-Faceted Rectangular Flacon + Diamond Prism Cap & Dip Tube
      // ==========================================
      const w = 0.44, d = 0.30, ch = 0.08;
      const shape = new THREE.Shape();
      shape.moveTo(-w + ch, -d);
      shape.lineTo(w - ch, -d);
      shape.lineTo(w, -d + ch);
      shape.lineTo(w, d - ch);
      shape.lineTo(w - ch, d);
      shape.lineTo(-w + ch, d);
      shape.lineTo(-w, d - ch);
      shape.lineTo(-w, -d + ch);
      shape.closePath();

      const extrudeSettings = {
        depth: 1.45,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.025,
        bevelThickness: 0.025
      };
      const outerGlassGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      outerGlassGeo.center();
      outerGlassGeo.rotateX(Math.PI / 2);

      const crystalMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 0.95,
        transparent: true,
        opacity: 1,
        roughness: 0.03,
        ior: 1.52,
        thickness: 0.6,
        reflectivity: 0.95,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.8
      });
      outerGlassMesh = new THREE.Mesh(outerGlassGeo, crystalMat);
      outerGlassMesh.position.y = 0.88;
      outerGlassMesh.castShadow = true;
      group.add(outerGlassMesh);

      // Solid crystal base
      const baseGlassGeo = new THREE.CylinderGeometry(0.50, 0.52, 0.16, 32);
      const baseGlass = new THREE.Mesh(baseGlassGeo, crystalMat);
      baseGlass.position.y = 0.08;
      group.add(baseGlass);

      // Inner liquid core (warm champagne gold)
      const innerW = 0.36, innerD = 0.22;
      const innerShape = new THREE.Shape();
      innerShape.moveTo(-innerW, -innerD);
      innerShape.lineTo(innerW, -innerD);
      innerShape.lineTo(innerW, innerD);
      innerShape.lineTo(-innerW, innerD);
      innerShape.closePath();
      const liquidGeo = new THREE.ExtrudeGeometry(innerShape, { depth: 1.15, bevelEnabled: false });
      liquidGeo.center();
      liquidGeo.rotateX(Math.PI / 2);

      const liquidMat = new THREE.MeshPhysicalMaterial({
        color: 0xf5ce62,
        transmission: 0.6,
        transparent: true,
        opacity: 0.92,
        roughness: 0.1,
        ior: 1.36,
        emissive: 0x8a6210,
        emissiveIntensity: 0.25,
        envMapIntensity: 1.4
      });
      liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
      liquidMesh.position.y = 0.82;
      group.add(liquidMesh);

      // Perfume Dip Tube
      const dipTubeGeo = new THREE.CylinderGeometry(0.016, 0.016, 1.25, 16);
      const dipTubeMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 0.9,
        transparent: true,
        opacity: 0.8,
        roughness: 0.1
      });
      const dipTube = new THREE.Mesh(dipTubeGeo, dipTubeMat);
      dipTube.position.y = 0.85;
      group.add(dipTube);

      // Gold Collar
      const collarGeo = new THREE.CylinderGeometry(0.20, 0.22, 0.24, 32);
      const collar = new THREE.Mesh(collarGeo, goldMat);
      collar.position.y = 1.68;
      collar.castShadow = true;
      group.add(collar);

      // Faceted crystal ring under cap
      const ringGeo = new THREE.CylinderGeometry(0.28, 0.29, 0.12, 12);
      const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 0.92,
        roughness: 0.05,
        flatShading: true,
        envMapIntensity: 1.8
      }));
      ringMesh.position.y = 1.80;
      group.add(ringMesh);

      // Diamond-cut crystal prism stopper (multi-faceted expanding crystal)
      const capGeo = new THREE.CylinderGeometry(0.38, 0.24, 0.58, 8);
      const capMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 0.96,
        transparent: true,
        opacity: 1,
        roughness: 0.04,
        flatShading: true,
        ior: 1.54,
        envMapIntensity: 2.0
      });
      cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 2.14;
      cap.castShadow = true;
      group.add(cap);

      // Gold core inside crystal cap
      const capCoreGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.40, 16);
      const capCore = new THREE.Mesh(capCoreGeo, goldMat);
      capCore.position.y = 2.08;
      group.add(capCore);

      // Front Label
      const labelPlaneGeo = new THREE.PlaneGeometry(0.70, 0.95);
      const labelTex = this.createLabelTexture(prod);
      const labelMat = new THREE.MeshBasicMaterial({
        map: labelTex,
        transparent: true,
        opacity: 0.98,
        depthWrite: false
      });
      const labelMesh = new THREE.Mesh(labelPlaneGeo, labelMat);
      labelMesh.position.set(0, 0.86, d + 0.035);
      labelMesh.renderOrder = 20;
      group.userData.labelMesh = labelMesh;
      group.add(labelMesh);
    }

    // Individual Bottle Ground Spotlight
    const bottleSpotlight = new THREE.SpotLight(accentColorHex, 0.4, 6, Math.PI / 6, 0.6);
    bottleSpotlight.position.set(0, 4, 0);
    bottleSpotlight.target = group;
    group.add(bottleSpotlight);

    // Store references for raycasting & animation
    group.userData.liquidMesh = liquidMesh;
    group.userData.outerGlassMesh = outerGlassMesh;
    group.userData.cap = cap;
    group.userData.bottleSpotlight = bottleSpotlight;

    // Interaction Hit Box (invisible larger cylinder to make hover silky smooth)
    const hitBoxGeo = new THREE.CylinderGeometry(0.9, 0.9, 2.8, 16);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitBox.position.y = 1.2;
    hitBox.userData = { isHitBox: true, bottleGroup: group, index };
    group.add(hitBox);
    this.bottles.push(hitBox);

    return group;
  }

  setupEvents() {
    const dom = this.renderer.domElement;

    // Hover Raycasting
    const onPointerMove = (e) => {
      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (!this.isDragging) {
        this.checkHover();
      }
    };

    dom.addEventListener('pointermove', onPointerMove);

    // Mouse Drag & Touch (Turntable Rotation + Horizontal Swipe + Pitch Tilt)
    dom.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.autoRotate = false;
      clearTimeout(this.idleTimer);
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
      this.dragDistance = 0;
    });

    window.addEventListener('pointerup', (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      const totalDx = e.clientX - this.pointerDownPos.x;
      const totalDy = e.clientY - this.pointerDownPos.y;

      // Horizontal swipe gesture to switch between the two podiums!
      if (Math.abs(totalDx) > 55 && Math.abs(totalDx) > Math.abs(totalDy) * 1.3) {
        if (totalDx < 0 && this.activePodium === "men") {
          this.switchToPodium("women");
          return;
        } else if (totalDx > 0 && this.activePodium === "women") {
          this.switchToPodium("men");
          return;
        }
      }

      // Tap / Click detection: if moved less than 8px, treat as click to select bottle
      if (this.dragDistance < 8) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.bottles, false);
        if (intersects.length > 0) {
          const index = intersects[0].object.userData.index;
          this.selectBottle(index, true);
        } else {
          // If clicked on other side, smooth glide to that podium
          if (this.activePodium === "men" && this.mouse.x > 0.35) {
            this.switchToPodium("women");
          } else if (this.activePodium === "women" && this.mouse.x < -0.35) {
            this.switchToPodium("men");
          }
        }
      }

      // Resume smooth auto-rotation after 4 seconds of inactivity
      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => {
        this.autoRotate = true;
      }, 4000);
    });

    window.addEventListener('pointermove', (e) => {
      if (this.isDragging) {
        const deltaX = e.clientX - this.previousMousePosition.x;
        const deltaY = e.clientY - this.previousMousePosition.y;
        this.dragDistance += Math.hypot(deltaX, deltaY);

        // Spin the active circular turntable horizontally ("والدايره بتلف")
        const activeTT = this.activePodium === "women" ? this.womensTurntable : this.mensTurntable;
        if (activeTT) {
          activeTT.rotation.y += deltaX * 0.007;
        }
        if (this.activePodium === "all") {
          if (this.mensTurntable) this.mensTurntable.rotation.y += deltaX * 0.007;
          if (this.womensTurntable) this.womensTurntable.rotation.y += deltaX * 0.007;
        }

        // Subtle horizontal camera angle
        this.targetYaw -= deltaX * 0.0015;

        // Vertical tilt (Pitch)
        this.targetPitch -= deltaY * 0.0045;
        this.targetPitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.targetPitch));

        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    });

    // Desktop Mouse Wheel Zoom (In / Out)
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY * 0.005;
      this.targetDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.targetDistance + zoomFactor));
    }, { passive: false });

    // Mobile Multi-Touch Support (1-finger turntable spin & tap/swipe, 2-finger pinch zoom)
    dom.addEventListener('touchstart', (e) => {
      clearTimeout(this.idleTimer);
      this.autoRotate = false;

      if (e.touches.length === 1) {
        this.isDragging = true;
        this.dragDistance = 0;
        this.pointerDownPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.lastTouchDist = Math.hypot(dx, dy);
      }
    }, { passive: true });

    dom.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const deltaX = e.touches[0].clientX - this.previousMousePosition.x;
        const deltaY = e.touches[0].clientY - this.previousMousePosition.y;
        this.dragDistance += Math.hypot(deltaX, deltaY);

        const activeTT = this.activePodium === "women" ? this.womensTurntable : this.mensTurntable;
        if (activeTT) {
          activeTT.rotation.y += deltaX * 0.008;
        }
        if (this.activePodium === "all") {
          if (this.mensTurntable) this.mensTurntable.rotation.y += deltaX * 0.008;
          if (this.womensTurntable) this.womensTurntable.rotation.y += deltaX * 0.008;
        }

        this.targetPitch -= deltaY * 0.0055;
        this.targetPitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.targetPitch));

        this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2 && this.lastTouchDist > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.hypot(dx, dy);
        const pinchDelta = (this.lastTouchDist - currentDist) * 0.02;
        this.targetDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.targetDistance + pinchDelta));
        this.lastTouchDist = currentDist;
      }
    }, { passive: true });

    dom.addEventListener('touchend', (e) => {
      this.isDragging = false;
      this.lastTouchDist = 0;

      // Tap on mobile to select bottle
      if (this.dragDistance < 10 && e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((t.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((t.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.bottles, false);
        if (intersects.length > 0) {
          const index = intersects[0].object.userData.index;
          this.selectBottle(index, true);
        }
      }

      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => {
        this.autoRotate = true;
      }, 7000);
    }, { passive: true });

    // Window Resize with mobile FOV adaptation
    window.addEventListener('resize', () => {
      if (!this.container) return;
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      const isMobile = width < 640;
      this.camera.fov = isMobile ? 48 : 40;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });

    // Listen to Storage products update
    window.addEventListener('products:updated', (e) => {
      this.loadProducts(e.detail.products);
    });
  }

  checkHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.bottles, false);

    if (intersects.length > 0) {
      const index = intersects[0].object.userData.index;
      if (this.hoveredBottleIndex !== index) {
        this.hoveredBottleIndex = index;
        this.applyShowroomFocus(index, false);
        this.notifyHover(index);
      }
    } else {
      if (this.hoveredBottleIndex !== -1) {
        this.hoveredBottleIndex = -1;
        this.applyShowroomFocus(this.selectedBottleIndex, false);
      }
    }
  }

  selectBottle(index, triggerEvent = true) {
    if (index < 0 || index >= this.bottleGroups.length) return;
    this.selectedBottleIndex = index;
    const bg = this.bottleGroups[index];
    const podX = bg.userData.podiumX !== undefined ? bg.userData.podiumX : -3.8;
    const podType = bg.userData.podium || "men";

    // Switch active podium if on the other wing
    this.activePodium = podType;
    this.targetCenter.set(podX, 0.95, 0);

    const isMobile = window.innerWidth < 640;
    this.targetDistance = isMobile ? 8.2 : 7.0;
    this.targetPitch = 0.16;

    // Smoothly rotate the turntable to bring the selected bottle to the front facing the viewer
    const tt = bg.userData.turntable;
    if (tt && bg.userData.baseAngle !== undefined) {
      const targetRotY = -bg.userData.baseAngle;
      let diff = (targetRotY - tt.rotation.y) % (Math.PI * 2);
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      const smoothTarget = tt.rotation.y + diff;

      if (window.gsap) {
        gsap.to(tt.rotation, {
          y: smoothTarget,
          duration: 0.9,
          ease: "power2.out"
        });
      } else {
        tt.rotation.y = smoothTarget;
      }
    }

    this.applyShowroomFocus(index, true);

    if (triggerEvent && window.app) {
      window.app.onShowroomBottleSelected(bg.userData.product, true);
    }
  }

  switchToPodium(type) {
    this.activePodium = type;
    const isMobile = window.innerWidth < 640;

    if (type === "men") {
      this.targetCenter.set(-3.8, 0.95, 0);
      this.targetDistance = isMobile ? 8.2 : 7.0;
      this.targetPitch = 0.16;
      this.targetYaw = 0;
      const menIdx = this.bottleGroups.findIndex(bg => bg.userData.podium === "men");
      if (menIdx !== -1) {
        this.selectBottle(menIdx, false);
        if (window.app) {
          window.app.updateSpotlightInfoPanel(this.bottleGroups[menIdx].userData.product, false);
          window.app.setPodiumActiveTab("men");
        }
      }
    } else if (type === "women") {
      this.targetCenter.set(3.8, 0.95, 0);
      this.targetDistance = isMobile ? 8.2 : 7.0;
      this.targetPitch = 0.16;
      this.targetYaw = 0;
      const womenIdx = this.bottleGroups.findIndex(bg => bg.userData.podium === "women");
      if (womenIdx !== -1) {
        this.selectBottle(womenIdx, false);
        if (window.app) {
          window.app.updateSpotlightInfoPanel(this.bottleGroups[womenIdx].userData.product, false);
          window.app.setPodiumActiveTab("women");
        }
      }
    } else if (type === "all") {
      this.targetCenter.set(0, 0.95, 0);
      this.targetDistance = isMobile ? 14.8 : 12.8;
      this.targetPitch = 0.20;
      this.targetYaw = 0;

      if (window.app) window.app.setPodiumActiveTab("all");

      // In all view, keep all bottles illuminated
      this.bottleGroups.forEach(bg => {
        bg.userData.targetScale = 1.0;
        bg.userData.targetY = 0.05;
        if (bg.userData.liquidMesh) {
          bg.userData.liquidMesh.material.opacity = 0.95;
          bg.userData.liquidMesh.material.emissiveIntensity = 0.35;
        }
        if (bg.userData.bottleSpotlight) {
          bg.userData.bottleSpotlight.intensity = 0.8;
        }
      });
      if (window.gsap && this.mainSpotlight) {
        gsap.to(this.mainSpotlight.position, { x: 0, y: 8.0, z: 3.5, duration: 0.8 });
        gsap.to(this.mainSpotlight.target.position, { x: 0, y: 0.8, z: 0, duration: 0.8 });
      } else if (this.mainSpotlight) {
        this.mainSpotlight.target.position.set(0, 0.8, 0);
      }
    }

    if (window.app && window.app.updatePodiumNavArrows) {
      window.app.updatePodiumNavArrows(type);
    }
  }

  applyShowroomFocus(activeIdx, isSelection = false) {
    this.bottleGroups.forEach((bg, idx) => {
      const isTarget = idx === activeIdx;

      if (isTarget) {
        // Enlarge & Elevate
        bg.userData.targetScale = 1.18;
        bg.userData.targetY = 0.35;

        // Brighten materials
        if (bg.userData.liquidMesh) {
          bg.userData.liquidMesh.material.opacity = 0.98;
          bg.userData.liquidMesh.material.emissiveIntensity = 0.45;
        }
        if (bg.userData.bottleSpotlight) {
          bg.userData.bottleSpotlight.intensity = 1.4;
        }
      } else {
        // Dim other bottles
        bg.userData.targetScale = 0.92;
        bg.userData.targetY = 0.05;

        if (bg.userData.liquidMesh) {
          bg.userData.liquidMesh.material.opacity = 0.45;
          bg.userData.liquidMesh.material.emissiveIntensity = 0.1;
        }
        if (bg.userData.bottleSpotlight) {
          bg.userData.bottleSpotlight.intensity = 0.15;
        }
      }
    });

    // Steer the Main Dynamic Spotlight to the focused bottle
    if (this.bottleGroups[activeIdx]) {
      const targetBg = this.bottleGroups[activeIdx];
      const worldPos = new THREE.Vector3();
      targetBg.getWorldPosition(worldPos);

      // Smooth spotlight repositioning
      if (window.gsap) {
        gsap.to(this.mainSpotlight.position, {
          x: worldPos.x * 0.7,
          z: worldPos.z * 0.7 + 3.0,
          y: 7.0,
          duration: 0.8,
          ease: "power2.out"
        });
        gsap.to(this.mainSpotlight.target.position, {
          x: worldPos.x,
          z: worldPos.z,
          y: worldPos.y + 0.8,
          duration: 0.8,
          ease: "power2.out"
        });
      } else {
        this.mainSpotlight.target.position.set(worldPos.x, worldPos.y + 0.8, worldPos.z);
      }
    }
  }

  notifyHover(index) {
    if (this.bottleGroups[index] && window.app) {
      window.app.onShowroomBottleHovered(this.bottleGroups[index].userData.product);
    }
  }

  animate() {
    requestAnimationFrame(this.animate);
    if (!this.isVisible || document.hidden) return;

    // Auto-spin the circular turntables ("والدايره بتلف")
    if (this.autoRotate && !this.isDragging) {
      if (this.mensTurntable) {
        this.mensTurntable.rotation.y += this.turntableSpinSpeed;
      }
      if (this.womensTurntable) {
        this.womensTurntable.rotation.y += this.turntableSpinSpeed;
      }
    }

    // Smooth camera center gliding interpolation across studio
    if (this.currentCenter && this.targetCenter) {
      this.currentCenter.lerp(this.targetCenter, 0.08);
    }

    // Smooth inertia / damping interpolation
    const damp = 0.08;
    this.currentYaw += (this.targetYaw - this.currentYaw) * damp;
    this.currentPitch += (this.targetPitch - this.currentPitch) * damp;
    this.currentDistance += (this.targetDistance - this.currentDistance) * damp;

    // Spherical orbit to Cartesian coordinates around currentCenter
    const cosPitch = Math.cos(this.currentPitch);
    const sinPitch = Math.sin(this.currentPitch);
    const center = this.currentCenter || this.targetCenter;

    this.camera.position.x = center.x + Math.sin(this.currentYaw) * cosPitch * this.currentDistance;
    this.camera.position.y = center.y + sinPitch * this.currentDistance;
    this.camera.position.z = center.z + Math.cos(this.currentYaw) * cosPitch * this.currentDistance;
    this.camera.lookAt(center);

    // Floating bobbing animation for 3D Podium Banners
    const time = Date.now() * 0.0022;
    if (this.mensBanner) {
      this.mensBanner.position.y = 3.35 + Math.sin(time) * 0.06;
    }
    if (this.womensBanner) {
      this.womensBanner.position.y = 3.35 + Math.sin(time + Math.PI) * 0.06;
    }

    // Smooth bottle elevation and scaling
    this.bottleGroups.forEach((bg) => {
      bg.userData.currentScale += (bg.userData.targetScale - bg.userData.currentScale) * 0.1;
      const s = bg.userData.currentScale;
      bg.scale.set(s, s, s);
      bg.position.y += (bg.userData.targetY - bg.position.y) * 0.1;
    });

    // Rotate floating golden dust particles
    if (this.particles) {
      this.particles.rotation.y += 0.0006;
      const positions = this.particles.geometry.attributes.position.array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] += 0.002;
        if (positions[i] > 5) positions[i] = -0.5;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }

  // Camera presets
  setCameraPreset(mode) {
    if (mode === "panorama") {
      this.targetPitch = 0.22;
      this.targetDistance = window.innerWidth < 640 ? 10.5 : 9.5;
    } else if (mode === "solo") {
      this.targetPitch = 0.12;
      this.targetDistance = 6.2;
    } else if (mode === "vault") {
      this.targetPitch = 1.15; // Aerial top-down view
      this.targetDistance = 9.8;
    }
  }

  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    if (!this.autoRotate) clearTimeout(this.idleTimer);
    return this.autoRotate;
  }
}

window.PerfumeShowroom = PerfumeShowroom;
