// ============================================================
// level3.js — The Architect's Monument
// A monolithic black slab on the moon. Three interior floors:
// Entrance Hall → Guardians' Chamber → Throne Room.
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { Guardian } from '../player/guardians.js';
import { STATE } from '../player/streetEnemies.js';

export class ArchitectLevel {

  constructor(sceneOrRenderer = null, rendererMaybe = null) {

    // ── SCENE ────────────────────────────────────────────
    let outerScene = null;
    if (sceneOrRenderer && sceneOrRenderer.isScene) outerScene = sceneOrRenderer;

    if (outerScene) {
      this.scene = outerScene;
      this.scene.background = new THREE.Color(0x010204);
      this.scene.fog = null;
    } else {
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x010204);
      this.scene.fog = null;
    }

    this.name = "LEVEL 3 — THE ARCHITECT'S MONUMENT";
    this.colliders = [];
    this.root = null;

    this.level = new THREE.Group();
    this.scene.add(this.level);
    this.root = this.level;

    // References used by update() and other levels
    this.stars = null;
    this.sky = null;
    this.moonSurface = null;
    this.sun = null;
    this.sunGlow = null;

    // Dungeon tracking
    this.guardians = [];
    this.architect = null;
    this.throneDoor = null;
    this.throneDoorOpen = false;
    this.guardiansDefeated = false;
    this.dialogueStarted = false;
    this.architectDialogueActive = false;

    // Dialogue system — created by main.js, attached here
    this.dialogue = null;
    this.onEndingChosen = null;

    // ── BUILD ─────────────────────────────────────────────
    this.createLighting();
    this.createMoonSurface();
    this.createStars();
    this.createEarth();
    this.createSpaceship();      // keep the landing ship as the arrival point
    this.createFlag();
    this.createLandingPath();

    this.createMonument();
    this.createMonumentInterior();
    this.createGuardianSpawns();
    this.createArchitect();

    this._buildColliders();
  }

  // ─────────────────────────────────────────────────────────
  // LIGHTING
  // ─────────────────────────────────────────────────────────
  createLighting() {
    const sun = new THREE.DirectionalLight(0xffffff, 3.2);
    sun.position.set(120, 150, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);   // reduced from 4096
    Object.assign(sun.shadow.camera, {
      left: -120, right: 120,
      top: 120, bottom: -120,
      near: 1, far: 400,
    });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    this.level.add(sun);
    this.sun = sun;

    // Sun glow sprite
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,244,214,0.85)');
    grad.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    sunGlow.position.copy(sun.position).multiplyScalar(2.2);
    sunGlow.scale.set(60, 60, 1);
    this.level.add(sunGlow);
    this.sunGlow = sunGlow;

    // Fill light
    this.level.add(new THREE.HemisphereLight(0x20252c, 0x08090b, 0.25));
  }

  // ─────────────────────────────────────────────────────────
  // MOON SURFACE — reduced segments for memory
  // ─────────────────────────────────────────────────────────
  createMoonSurface() {
    const size = 500;
    const segments = 200;                 // was 300

    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);

    function hash(x, y) {
      const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
      return v - Math.floor(v);
    }
    function noise(x, y) {
      const ix = Math.floor(x), iy = Math.floor(y);
      const fx = x - ix, fy = y - iy;
      const a = hash(ix, iy), b = hash(ix + 1, iy);
      const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);
      return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
    }
    function fbm(x, y) {
      let v = 0, amp = 0.5, f = 1;
      for (let i = 0; i < 5; i++) { v += noise(x * f, y * f) * amp; f *= 2; amp *= 0.5; }
      return v;
    }

    const craters = [
      { x: -120, z: -60, r: 30, d: 4.5 },
      { x: 110, z: -90, r: 35, d: 5 },
      { x: 75, z: 40, r: 22, d: 3.5 },
      { x: -140, z: 70, r: 20, d: 3 },
      { x: 150, z: 100, r: 26, d: 4 },
      { x: -30, z: -140, r: 20, d: 3.2 },
      { x: 10, z: 120, r: 14, d: 2.4 },
    ];

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getY(i);

      let height =
        (fbm(x * 0.006, z * 0.006) - 0.5) * 6.5 +
        (fbm(x * 0.018, z * 0.018) - 0.5) * 2.8 +
        (fbm(x * 0.075, z * 0.075) - 0.5) * 0.85 +
        (noise(x * 0.38, z * 0.38) - 0.5) * 0.2;

      for (const c of craters) {
        const dx = x - c.x, dz = z - c.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < c.r) {
          const n = d / c.r;
          height -= c.d * Math.pow(1 - n, 2.2);
          if (n > 0.68) {
            const rimT = (n - 0.68) / 0.32;
            height += c.d * 0.3 * Math.sin(rimT * Math.PI);
          }
        }
      }

      height *= 0.6;
      positions.setZ(i, height);

      const maria = Math.min(1, Math.max(0, height * 0.06 + 0.5));
      const rock = 0.68 - maria * 0.22;
      colors[i * 3] = rock;
      colors[i * 3 + 1] = rock * 0.985;
      colors[i * 3 + 2] = rock * 0.95;
    }

    positions.needsUpdate = true;
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.0,
    });

    const moon = new THREE.Mesh(geo, mat);
    moon.rotation.x = -Math.PI / 2;
    moon.position.y = -2;
    moon.receiveShadow = true;
    moon.name = 'LunarRegolith';
    this.level.add(moon);
    this.moonSurface = moon;
  }

  // ─────────────────────────────────────────────────────────
  // STARS
  // ─────────────────────────────────────────────────────────
  createStars() {
    const count = 1400;              // was 2800
    const radius = 750;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const y = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(1 - y * y);
      positions[i * 3] = Math.cos(theta) * rr * radius;
      positions[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = Math.sin(theta) * rr * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false });
    this.stars = new THREE.Points(geo, mat);
    this.sky = this.stars;
    this.level.add(this.stars);
  }

  // ─────────────────────────────────────────────────────────
  // EARTH
  // ─────────────────────────────────────────────────────────
  createEarth() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const ocean = ctx.createLinearGradient(0, 0, 0, 256);
    ocean.addColorStop(0, '#0c2a4a');
    ocean.addColorStop(0.5, '#1a4d78');
    ocean.addColorStop(1, '#0c2a4a');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, 512, 256);

    let seed = 91;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    ctx.fillStyle = '#3f6b3a';
    for (let c = 0; c < 8; c++) {
      const cx = rnd() * 512, cy = 256 * (0.2 + rnd() * 0.6);
      for (let b = 0; b < 6; b++) {
        ctx.beginPath();
        ctx.ellipse(cx + (rnd() - 0.5) * 70, cy + (rnd() - 0.5) * 40,
                    10 + rnd() * 20, 8 + rnd() * 16, rnd() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    for (let i = 0; i < 26; i++) {
      ctx.beginPath();
      ctx.ellipse(rnd() * 512, rnd() * 256, 8 + rnd() * 24, 4 + rnd() * 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(7, 32, 32),
      new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.8, metalness: 0,
        emissive: 0x0c1420, emissiveIntensity: 0.3,
      })
    );
    earth.position.set(-260, 105, -40);
    this.level.add(earth);
    this.earth = earth;
  }

  // ─────────────────────────────────────────────────────────
  // SPACESHIP — kept as the arrival point (unchanged behaviour)
  // ─────────────────────────────────────────────────────────
  createSpaceship() {
    const group = new THREE.Group();
    group.name = 'GenesisSpaceship';
    this.spaceship = group;
    this.level.add(group);

    const fbxLoader = new FBXLoader();
    fbxLoader.load('./assets/models/Spaceship.fbx', (fbx) => {
      fbx.name = 'SpaceshipExterior';
      fbx.scale.set(1, 1, 1);
      fbx.updateMatrixWorld(true);
      const hullBox = new THREE.Box3().setFromObject(fbx);
      const hullCenter = hullBox.getCenter(new THREE.Vector3());
      fbx.position.set(-hullCenter.x + 20, -hullBox.min.y - 5, -hullCenter.z + 15);

      const hullMaterial = new THREE.MeshStandardMaterial({
        color: 0xb8bec4,
        roughness: 0.55,
        metalness: 0.3,
        side: THREE.DoubleSide,
      });

      fbx.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
          o.material = hullMaterial;
        }
      });

      group.add(fbx);
    }, undefined, (e) => console.warn('Spaceship load failed:', e));

    // Interior corridor GLB
    const gltfLoader = new GLTFLoader();
    gltfLoader.load('./assets/models/space_ship_hallway.glb', (gltf) => {
      const corridor = gltf.scene;
      corridor.scale.set(1, 2, 1.5);
      corridor.position.set(0, 0, 45);
      corridor.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      group.add(corridor);
    }, undefined, (e) => console.warn('Corridor load failed:', e));

    group.position.set(0, 0, 5);
  }

  // ─────────────────────────────────────────────────────────
  // FLAG
  // ─────────────────────────────────────────────────────────
  createFlag() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 640;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0d12';
    ctx.fillRect(0, 0, 512, 640);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GENESIS', 256, 320);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const flag = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.09, 6.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.4, metalness: 0.6 })
    );
    pole.position.y = 3.25;
    flag.add(pole);
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 3.5),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    );
    cloth.position.set(1.5, 4.15, 0);
    flag.add(cloth);
    flag.position.set(96, -2.6, 76);
    flag.rotation.y = 1.78;
    this.level.add(flag);
  }

  // ─────────────────────────────────────────────────────────
  // LANDING PATH (kept, simplified)
  // ─────────────────────────────────────────────────────────
  createLandingPath() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(20.1, 0, 57.5),
      new THREE.Vector3(20.1, 0, 63.5),
      new THREE.Vector3(20.1, 0, 69.5),
      new THREE.Vector3(46, 0, 72.5),
      new THREE.Vector3(94, 0, 72.5),
      new THREE.Vector3(110, 0, 73),
    ]);
    const slabGeo = new THREE.BoxGeometry(2.6, 0.18, 1.7);
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x3d4249, roughness: 0.15, metalness: 0.7 });
    const pathGroup = new THREE.Group();
    const spacing = 2.15;
    const count = Math.floor(curve.getLength() / spacing);
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const angle = Math.atan2(tan.x, tan.z);
      const y = this.getSurfaceHeight(p.x, p.z);
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.set(p.x, y + 0.04, p.z);
      slab.rotation.y = angle;
      slab.receiveShadow = true;
      pathGroup.add(slab);
    }
    this.level.add(pathGroup);
  }

  // ─────────────────────────────────────────────────────────
  // MONUMENT — the big black slab
  // ─────────────────────────────────────────────────────────
  createMonument() {
    const monument = new THREE.Group();
    monument.position.set(0, 0, -60);
    monument.name = 'Monument';
    this.level.add(monument);

    const surfaceY = this.getSurfaceHeight(0, -60);

    // Base plaza — a large black disc
    const plazaMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a12,
      roughness: 0.35,
      metalness: 0.7,
    });
    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(60, 60, 1.2, 48),
      plazaMat
    );
    plaza.position.set(0, surfaceY + 0.6, 0);
    plaza.receiveShadow = true;
    monument.add(plaza);

    // Steps up from moon to plaza — 8 steps
    const stepMat = new THREE.MeshStandardMaterial({
      color: 0x14141c,
      roughness: 0.5,
      metalness: 0.6,
    });
    for (let i = 0; i < 8; i++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(70 - i * 2, 0.25, 3),
        stepMat
      );
      step.position.set(0, surfaceY - 1 + i * 0.25 + 0.125, 55 - i * 2.8);
      step.receiveShadow = true;
      monument.add(step);
    }

    // Main slab — the monument body
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a12,
      roughness: 0.4,
      metalness: 0.65,
    });
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(80, 200, 60),
      slabMat
    );
    slab.position.set(0, surfaceY + 1.2 + 100, -35);
    slab.castShadow = true;
    slab.receiveShadow = true;
    monument.add(slab);

    // Cyan emissive seams on the sides
    const seamMat = new THREE.MeshStandardMaterial({
      color: 0x00d9ff,
      emissive: 0x00d9ff,
      emissiveIntensity: 2.4,
    });
    for (const side of [-1, 1]) {
      const seam = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 195, 0.4),
        seamMat
      );
      seam.position.set(side * 40.5, surfaceY + 1.2 + 100, 0.5);
      monument.add(seam);
    }

    // ── K SYMBOL on the front face ──
    // Three cyan rectangles arranged as a K
    const kMat = new THREE.MeshStandardMaterial({
      color: 0x00d9ff,
      emissive: 0x00d9ff,
      emissiveIntensity: 2.5,
    });
    const frontZ = -35 + 30 + 0.3;
    const kY = surfaceY + 1.2 + 130;
    // Vertical stem
    const stem = new THREE.Mesh(new THREE.BoxGeometry(4, 40, 0.5), kMat);
    stem.position.set(-8, kY, frontZ);
    monument.add(stem);
    // Upper arm
    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(4, 20, 0.5), kMat);
    upperArm.position.set(2, kY + 8, frontZ);
    upperArm.rotation.z = -Math.PI / 5;
    monument.add(upperArm);
    // Lower arm
    const lowerArm = new THREE.Mesh(new THREE.BoxGeometry(4, 20, 0.5), kMat);
    lowerArm.position.set(2, kY - 8, frontZ);
    lowerArm.rotation.z = Math.PI / 5;
    monument.add(lowerArm);

    // ── ENTRANCE ARCH at the base ──
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x05050a,
      roughness: 0.6,
    });
    // The arch is a "hole" — we build the wall around it. The
    // interior room is physically separate below.
    const archFrame = new THREE.Mesh(
      new THREE.BoxGeometry(34, 50, 2),
      archMat
    );
    archFrame.position.set(0, surfaceY + 1.2 + 25, -35 + 30 + 0.2);
    // We don't add archFrame — it would block the entrance.
    // Instead we add a decorative frame around it.
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x14141c,
      emissive: 0x00d9ff,
      emissiveIntensity: 0.6,
      roughness: 0.5,
    });
    // Top of arch
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(36, 2, 2), frameMat);
    archTop.position.set(0, surfaceY + 1.2 + 50, -35 + 30 + 0.2);
    monument.add(archTop);
    // Sides of arch
    for (const side of [-1, 1]) {
      const sideFrame = new THREE.Mesh(new THREE.BoxGeometry(2, 50, 2), frameMat);
      sideFrame.position.set(side * 17, surfaceY + 1.2 + 25, -35 + 30 + 0.2);
      monument.add(sideFrame);
    }

    this.monument = monument;
  }

  // ─────────────────────────────────────────────────────────
  // MONUMENT INTERIOR — 3 floors
  // ─────────────────────────────────────────────────────────
  createMonumentInterior() {
    const surfaceY = this.getSurfaceHeight(0, -60);
    const interior = new THREE.Group();
    interior.name = 'MonumentInterior';
    this.level.add(interior);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a12,
      roughness: 0.7,
      metalness: 0.2,
      side: THREE.BackSide,     // visible from inside
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x14141c,
      roughness: 0.6,
      metalness: 0.4,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x00d9ff,
      emissive: 0x00d9ff,
      emissiveIntensity: 1.6,
    });

    // Interior volume sits inside the slab. Slab center is at
    // (0, surfaceY+1.2+100, -35), size 80 × 200 × 60.
    // We carve 3 hollow rooms inside.
    const slabCenterY = surfaceY + 1.2 + 100;
    const slabCenterZ = -35;

    // ── FLOOR 1: Entrance Hall (y=0 to 40) ──
    this._addRoom(interior, {
      center: new THREE.Vector3(0, slabCenterY - 80, slabCenterZ),
      size:   new THREE.Vector3(60, 40, 50),
      wallMat, floorMat, trimMat,
    });

    // ── FLOOR 2: Guardians' Chamber (y=40 to 80) ──
    this._addRoom(interior, {
      center: new THREE.Vector3(0, slabCenterY - 20, slabCenterZ),
      size:   new THREE.Vector3(60, 40, 50),
      wallMat, floorMat, trimMat,
    });

    // ── FLOOR 3: Throne Room (y=80 to 110) ──
    this._addRoom(interior, {
      center: new THREE.Vector3(0, slabCenterY + 55, slabCenterZ),
      size:   new THREE.Vector3(40, 30, 40),
      wallMat, floorMat, trimMat,
    });

    // ── Staircases connecting the floors ──
    // Floor 1 → Floor 2
    this._addStairs(
      interior,
      new THREE.Vector3(15, slabCenterY - 80, slabCenterZ - 15),
      new THREE.Vector3(15, slabCenterY - 40, slabCenterZ - 15),
      floorMat
    );
    // Floor 2 → Floor 3
    this._addStairs(
      interior,
      new THREE.Vector3(-15, slabCenterY - 20, slabCenterZ + 15),
      new THREE.Vector3(-15, slabCenterY + 20, slabCenterZ + 15),
      floorMat
    );

    // ── Sealed throne door (Floor 2 → Floor 3 exit) ──
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x02020a,
      emissive: 0xff2244,
      emissiveIntensity: 1.2,
      roughness: 0.3,
      metalness: 0.6,
    });
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(10, 12, 0.5),
      doorMat
    );
    door.position.set(-15, slabCenterY - 20 + 6, slabCenterZ + 15 - 0.4);
    interior.add(door);
    this.throneDoor = door;
    this.throneDoorOriginalPos = door.position.clone();
  }

  _addRoom(parent, { center, size, wallMat, floorMat, trimMat }) {
    // Floor
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, 0.5, size.z),
      floorMat
    );
    floor.position.set(center.x, center.y - size.y / 2, center.z);
    floor.receiveShadow = true;
    parent.add(floor);

    // Ceiling (visible from below)
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, 0.5, size.z),
      floorMat
    );
    ceiling.position.set(center.x, center.y + size.y / 2, center.z);
    parent.add(ceiling);

    // Walls (using back-side material so they're visible from inside)
    // Front wall (has doorway — we skip the full front)
    // Back wall
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, 0.5),
      wallMat
    );
    backWall.position.set(center.x, center.y, center.z - size.z / 2);
    parent.add(backWall);

    // Left wall
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, size.y, size.z),
      wallMat
    );
    leftWall.position.set(center.x - size.x / 2, center.y, center.z);
    parent.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, size.y, size.z),
      wallMat
    );
    rightWall.position.set(center.x + size.x / 2, center.y, center.z);
    parent.add(rightWall);

    // Cyan trim strips along the floor-wall junction
    for (const side of [-1, 1]) {
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.3, size.z),
        trimMat
      );
      trim.position.set(
        center.x + side * (size.x / 2 - 0.3),
        center.y - size.y / 2 + 0.4,
        center.z
      );
      parent.add(trim);
    }

    // Point light in the room
    const light = new THREE.PointLight(0x80c8ff, 8, Math.max(size.x, size.z) * 1.2, 1.5);
    light.position.set(center.x, center.y + size.y / 2 - 2, center.z);
    parent.add(light);
  }

  _addStairs(parent, from, to, mat) {
    // Simple ramp of thin boxes
    const dir = new THREE.Vector3().subVectors(to, from);
    const length = dir.length();
    const steps = 24;
    const stepHeight = dir.y / steps;
    const stepDepth = length / steps;

    // Angle of stair
    const angle = Math.atan2(dir.x, dir.z);
    const rot = new THREE.Euler(0, angle, 0);

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const pos = new THREE.Vector3().lerpVectors(from, to, t);
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.3, stepDepth * 1.1),
        mat
      );
      step.position.copy(pos);
      step.rotation.copy(rot);
      step.receiveShadow = true;
      parent.add(step);
    }
  }

  // ─────────────────────────────────────────────────────────
  // GUARDIAN SPAWNS
  // ─────────────────────────────────────────────────────────
  createGuardianSpawns() {
    const surfaceY = this.getSurfaceHeight(0, -60);
    const chamberY = surfaceY + 1.2 + 60;  // middle of Floor 2

    // Attack gate — max 1 guardian attacking at once
    this.guardianGate = { current: 0, max: 1 };

    // Blade — left of the chamber
    const blade = new Guardian(
      this.level,
      new THREE.Vector3(-10, chamberY, -60),
      'blade',
      this.guardianGate
    );
    // Fist — right of the chamber
    const fist = new Guardian(
      this.level,
      new THREE.Vector3(10, chamberY, -60),
      'fist',
      this.guardianGate
    );

    // Guardians start dormant — they wake when the player enters
    blade.state = STATE.IDLE;
    fist.state = STATE.IDLE;

    this.guardians.push(blade, fist);
  }

  // ─────────────────────────────────────────────────────────
  // ARCHITECT — seated on the throne
  // ─────────────────────────────────────────────────────────
  createArchitect() {
    const surfaceY = this.getSurfaceHeight(0, -60);
    const throneY = surfaceY + 1.2 + 120;

    const group = new THREE.Group();
    group.position.set(0, throneY, -60 - 10);
    this.level.add(group);

    // Throne — simple black box
    const throne = new THREE.Mesh(
      new THREE.BoxGeometry(4, 6, 3),
      new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.4, metalness: 0.6 })
    );
    throne.position.set(0, 3, 0);
    group.add(throne);

    // Seat back
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(4, 4, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.4, metalness: 0.6 })
    );
    back.position.set(0, 5.5, -1.2);
    group.add(back);

    // Architect — reuse Commander model. Placeholder figure
    // until we swap for a Mixamo character.
    const placeholder = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.5, 1.6, 4, 8),
      new THREE.MeshStandardMaterial({
        color: 0x2a2a3a,
        emissive: 0x88aaff,
        emissiveIntensity: 0.3,
        roughness: 0.6,
      })
    );
    placeholder.position.set(0, 4.5, 0);
    group.add(placeholder);

    // Spotlight on the throne
    const spot = new THREE.PointLight(0xaaccff, 12, 30, 1.5);
    spot.position.set(0, 12, 2);
    group.add(spot);

    this.architect = group;
  }

  // ─────────────────────────────────────────────────────────
  // SURFACE HEIGHT
  // ─────────────────────────────────────────────────────────
  getSurfaceHeight(worldX, worldZ) {
    if (!this.moonSurface) return -2;
    const geo = this.moonSurface.geometry;
    const pos = geo.attributes.position;
    const size = geo.parameters.width;
    const segments = geo.parameters.widthSegments;

    const gridX = (worldX + size / 2) / size * segments;
    const gridY = (worldZ + size / 2) / size * segments;

    const ix = Math.min(segments - 1, Math.max(0, Math.floor(gridX)));
    const iy = Math.min(segments - 1, Math.max(0, Math.floor(gridY)));

    const fx = gridX - ix;
    const fy = gridY - iy;

    const stride = segments + 1;
    const h00 = pos.getZ(iy * stride + ix);
    const h10 = pos.getZ(iy * stride + ix + 1);
    const h01 = pos.getZ((iy + 1) * stride + ix);
    const h11 = pos.getZ((iy + 1) * stride + ix + 1);

    return ((h00 * (1 - fx) + h10 * fx) * (1 - fy) +
            (h01 * (1 - fx) + h11 * fx) * fy) - 2;
  }

  groundHeight(x, z, feetY = 0) { return this.getSurfaceHeight(x, z); }
  terrainHeight(x, z) { return this.getSurfaceHeight(x, z); }

  // ─────────────────────────────────────────────────────────
  // COLLIDERS
  // ─────────────────────────────────────────────────────────
  _buildColliders() {
    this.colliders = [];

    const surfaceY = this.getSurfaceHeight(0, -60);

    // The monument slab — one big AABB
    const slabCenterY = surfaceY + 1.2 + 100;
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(-40, slabCenterY - 100, -35 - 30),
      new THREE.Vector3( 40, slabCenterY + 100, -35 + 30)
    ));

    // Interior walls (implicit — the outer slab is enough)
  }

  // ─────────────────────────────────────────────────────────
  // SPAWN
  // ─────────────────────────────────────────────────────────
  getSpawn() {
    const sx = 20.1, sz = 57.5;
    const sy = this.getSurfaceHeight(sx, sz);
    return new THREE.Vector3(sx, sy + 0.2, sz + 2);
  }

  // ─────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────
  update(dt, t, player) {
    this._time = (this._time || 0) + dt;

    // Earth rotation
    if (this.earth) this.earth.rotation.y += dt * 0.015;

    // Sun glow pulse
    if (this.sunGlow) {
      const pulse = 1 + Math.sin(this._time * 0.6) * 0.04;
      this.sunGlow.scale.set(60 * pulse, 60 * pulse, 1);
    }

    // Update guardians
    for (const g of this.guardians) {
      if (g._disposed) continue;

      // Wake guardians when player enters the chamber
      const surfaceY = this.getSurfaceHeight(0, -60);
      const chamberY = surfaceY + 1.2 + 60;
      const dy = Math.abs(player.pos.y - chamberY);
      const distToChamber = player.pos.distanceTo(new THREE.Vector3(0, chamberY, -60));

      if (g.state === STATE.IDLE && distToChamber < 25 && dy < 15) {
        g.alert();
      }

      // Update the guardian (uses parent Enemy.update)
      try {
        g.update(dt, player.pos);

        // Guardian attacks — roll damage when a swing lands
        if (g.swingLanded) {
          g.swingLanded = false;
          const reach = g.kind === 'fist' ? 3.2 : 2.8;
          if (g.group.position.distanceTo(player.pos) < reach) {
            if (this.onDamagePlayer) this.onDamagePlayer(g.guardianDamage || 10);
          }
        }
      } catch (e) {
        console.warn('Guardian update error:', e);
      }
    }

    // Check if both guardians are dead → open throne door
    if (!this.guardiansDefeated && this.guardians.length === 2) {
      const bothDead = this.guardians.every((g) => g.state === STATE.DEAD || g.dead);
      if (bothDead) {
        this.guardiansDefeated = true;
        this._openThroneDoor();
      }
    }

    // Architect dialogue — trigger when player enters throne room
    if (
      this.guardiansDefeated &&
      !this.dialogueStarted &&
      !this.architectDialogueActive &&
      this.dialogue &&
      player.pos.y > this.getSurfaceHeight(0, -60) + 1.2 + 90
    ) {
      this.dialogueStarted = true;
      this.architectDialogueActive = true;
      this._runArchitectSequence();
    }
  }

  _openThroneDoor() {
    if (!this.throneDoor) return;
    // Slide the door up out of the way
    this.throneDoor.position.y += 15;
    console.log('⚔️ GUARDIANS DEFEATED — The Architect awaits.');
  }

  async _runArchitectSequence() {
    const d = this.dialogue;
    if (!d) return;

    try {
      await d.say('Sorini. You made it. I knew you would.', 4200);
      await d.say('I have watched you cross the village, tear through my street soldiers. Every step was exactly as I projected.', 5200);
      await d.say('You are what GENESIS was always meant to create. Come. Sit beside me.', 5000);

      const choice = await d.ask('What do you say?', [
        "I'm here to end this.",
        'What is GENESIS?',
        '(Say nothing.)',
      ]);

      d.hide();

      // Hand off to the endings module
      if (this.onEndingChosen) {
        if (choice === 0) this.onEndingChosen('attack');
        else if (choice === 1) this.onEndingChosen('learn');
        else this.onEndingChosen('silence');
      }
    } catch (e) {
      console.warn('Dialogue error:', e);
    }
  }

  // ─────────────────────────────────────────────────────────
  // PUNCH — called from main.js when F/G/H pressed
  // ─────────────────────────────────────────────────────────
  onMouseClick(camera, playerPos) {
    for (const g of this.guardians) {
      if (!g || g.state === STATE.DEAD || g._disposed) continue;
      const dist = g.group.position.distanceTo(playerPos);
      if (dist < 3.0) {
        const killed = g.takeDamage();
        if (killed) console.log(`💀 Guardian (${g.kind}) defeated`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // DISPOSE
  // ─────────────────────────────────────────────────────────
  dispose(outerScene = null) {
    // Detach from scene
    if (this.level && this.level.parent) this.level.parent.remove(this.level);
    if (this.stars && this.stars.parent) this.stars.parent.remove(this.stars);
    if (this.sky && this.sky.parent) this.sky.parent.remove(this.sky);
    if (this.moonSurface && this.moonSurface.parent) this.moonSurface.parent.remove(this.moonSurface);

    // Dispose sun shadow
    if (this.sun && this.sun.shadow) {
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      if (this.sun.shadow.mapPass) { this.sun.shadow.mapPass.dispose(); this.sun.shadow.mapPass = null; }
    }

    // Dispose guardians
    for (const g of this.guardians) {
      try { g.dispose(); } catch (e) {}
    }
    this.guardians = [];

    // Traverse and dispose everything
    if (this.level) {
      this.level.traverse((object) => {
        if (!object.isMesh && !object.isPoints && !object.isLine && !object.isSprite) return;
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const mats = Array.isArray(object.material) ? object.material : [object.material];
          mats.forEach((m) => {
            for (const k in m) {
              const v = m[k];
              if (v && v.isTexture) v.dispose();
            }
            m.dispose();
          });
        }
      });
    }

    // Sun glow
    if (this.sunGlow) {
      if (this.sunGlow.material) {
        if (this.sunGlow.material.map) this.sunGlow.material.map.dispose();
        this.sunGlow.material.dispose();
      }
      this.sunGlow = null;
    }

    // Null references
    this.stars = null;
    this.sky = null;
    this.earth = null;
    this.moonSurface = null;
    this.sun = null;
    this.spaceship = null;
    this.monument = null;
    this.throneDoor = null;
    this.architect = null;
    this.colliders = [];
  }
}