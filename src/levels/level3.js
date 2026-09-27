// ============================================================
// level3.js — The Architect's Monument
// A monolithic black slab on the moon. Three interior floors:
// Entrance Hall → Guardians' Chamber → Throne Room.
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { Guardian } from '../player/guardians.js';
import { Architect } from '../player/architect.js';   // ← add this line
import { STATE } from '../player/streetEnemies.js';
import { worldColliders } from '../physics/CollisionSystem.js';

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
    this._propColliders = [];   // filled by builders, merged in _buildColliders
    this._walkSurfaces = [];    // walkable floor boxes {x0,z0,x1,z1,top}
    this._stairRamps = [];      // walkable stair ramps {ax,az,bx,bz,ya,yb,halfWidth}
    this._plazaTop = null;      // set by createMonument
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

    this.createWreckageField();
    this.createDistantFleet();
    this.createBackgroundSpires();

    this.createMonument();
    this.createPlazaStatues();
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
  // Walls off the back/left/right of a bounding box but leaves the max-Z
  // face open — that's the side facing the spawn/landing path, where the
  // door actually is. Used instead of a single solid Box3 so the player
  // can walk through the doorway and into the interior instead of the
  // whole model acting as one sealed brick.
  // Tight single-box collider for a decorative model. Shrinks the source
  // bounds by ~15% on XZ so the box hugs the visible hull instead of
  // extending past the mesh into nearby walkways. One box, centred on
  // the hull, no left/right/back walls running off into the level.
  _addHullCollider(box, label) {
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    const hx = (box.max.x - box.min.x) * 0.42;
    const hz = (box.max.z - box.min.z) * 0.42;

    const collider = new THREE.Box3(
      new THREE.Vector3(cx - hx, box.min.y, cz - hz),
      new THREE.Vector3(cx + hx, box.max.y, cz + hz)
    );
    collider.name = label;
    this.colliders.push(collider);
    if (Array.isArray(worldColliders)) worldColliders.push(collider);
  }

  createSpaceship() {
    const group = new THREE.Group();
    group.name = 'GenesisSpaceship';
    this.spaceship = group;
    this.level.add(group);

    // How high the ship hull sits above the moon surface.
    // Landing-gear legs bridge this gap; maintenance stands sit underneath.
    const SHIP_LIFT = 5.5;

    const fbxLoader = new FBXLoader();
    fbxLoader.load('./assets/models/Spaceship.fbx', (fbx) => {
      fbx.name = 'SpaceshipExterior';
      fbx.scale.set(1, 1, 1);
      fbx.updateMatrixWorld(true);
      const hullBox = new THREE.Box3().setFromObject(fbx);
      const hullCenter = hullBox.getCenter(new THREE.Vector3());

      // Raise the hull by SHIP_LIFT so it floats above the ground
      fbx.position.set(
        -hullCenter.x + 20,
        -hullBox.min.y - 5 + SHIP_LIFT,
        -hullCenter.z + 15
      );

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

      fbx.updateMatrixWorld(true);
      const shipBox = new THREE.Box3().setFromObject(fbx);
      // FIX: was _addWallShell(shipBox, 'GenesisSpaceship'). That built a
      // full wall shell around the FBX's *bounding box* — which for a
      // cm-scale model is enormous — and its walls ran out across the
      // walkway between spawn and the monument. One tight hull box is
      // enough to stop the player walking through the ship's central
      // mass, without fencing off the rest of the moon.
      this._addHullCollider(shipBox, 'GenesisSpaceship');

      // ── Landing gear + maintenance stands ──────────────────
      // Build these after the FBX loads so we know the real hull extents.
      this._buildShipSupports(group, shipBox, SHIP_LIFT);
    }, undefined, (e) => console.warn('Spaceship load failed:', e));

    // Interior corridor GLB
    const gltfLoader = new GLTFLoader();
    gltfLoader.load('./assets/models/space_ship_hallway.glb', (gltf) => {
      const corridor = gltf.scene;
      corridor.scale.set(1, 2, 1.5);
      corridor.position.set(0, 0, 45 + SHIP_LIFT * 0.4);  // raise corridor entry slightly too
      corridor.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      group.add(corridor);

      corridor.updateMatrixWorld(true);
      const corridorBox = new THREE.Box3().setFromObject(corridor);
      // FIX: was _addWallShell(corridorBox, 'SpaceshipCorridor', { openBack: true }).
      // The corridor sits directly in the spawn→monument walking lane,
      // so its side walls were acting as an invisible gate. It's a
      // decorative interior model — no collider at all is the right
      // answer here.
      // (intentionally no collider)
    }, undefined, (e) => console.warn('Corridor load failed:', e));

    group.position.set(0, 0, 5);
  }

  // ─────────────────────────────────────────────────────────
  // SHIP SUPPORTS — landing legs + maintenance jack-stands
  // Called after the FBX loads so we have real hull dimensions.
  // ─────────────────────────────────────────────────────────
  _buildShipSupports(group, shipBox, liftHeight) {
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x4a5260,
      roughness: 0.5,
      metalness: 0.8,
    });
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x2a2e36,
      roughness: 0.7,
      metalness: 0.3,
    });
    const warnMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xffaa00,
      emissiveIntensity: 0.6,
      roughness: 0.6,
    });
    const scaffoldMat = new THREE.MeshStandardMaterial({
      color: 0x7a6030,
      roughness: 0.8,
      metalness: 0.4,
    });

    const cx  = (shipBox.min.x + shipBox.max.x) / 2;
    const cz  = (shipBox.min.z + shipBox.max.z) / 2;
    const hw  = (shipBox.max.x - shipBox.min.x) * 0.38; // half-spread of legs
    const hd  = (shipBox.max.z - shipBox.min.z) * 0.35;
    const groundY = shipBox.min.y - liftHeight; // approximate moon surface under ship

    // ── Four landing legs (strut + foot pad) ──────────────────
    const legPositions = [
      [ cx - hw, cz - hd ],
      [ cx + hw, cz - hd ],
      [ cx - hw, cz + hd ],
      [ cx + hw, cz + hd ],
    ];

    for (const [lx, lz] of legPositions) {
      // Diagonal strut from hull bottom down to ground
      const strutH = liftHeight + 0.4;
      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.18, strutH, 8),
        metalMat
      );
      strut.position.set(lx, groundY + strutH / 2, lz);
      // Angle the strut outward slightly for realism
      const angleX = (lz - cz > 0) ?  0.18 : -0.18;
      const angleZ = (lx - cx > 0) ?  0.18 : -0.18;
      strut.rotation.set(angleX, 0, angleZ);
      strut.castShadow = true;
      group.add(strut);

      // Horizontal brace bar connecting inner pair of legs
      const brace = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6),
        metalMat
      );
      brace.position.set(lx, groundY + strutH * 0.45, lz);
      brace.rotation.z = Math.PI / 2;
      group.add(brace);

      // Foot pad — flat disc on the ground
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.65, 0.18, 12),
        padMat
      );
      pad.position.set(lx, groundY + 0.09, lz);
      pad.castShadow = true;
      group.add(pad);

      // Warning stripe ring on the pad
      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(0.52, 0.055, 6, 18),
        warnMat
      );
      stripe.rotation.x = Math.PI / 2;
      stripe.position.set(lx, groundY + 0.19, lz);
      group.add(stripe);
    }

    // ── Maintenance jack-stands under the belly ────────────────
    // Two heavy box stands that look like the ship is propped up for work.
    const standH = liftHeight * 0.72;
    const standPositions = [
      [ cx - hw * 0.4, cz + hd * 0.1 ],
      [ cx + hw * 0.4, cz - hd * 0.1 ],
    ];

    for (const [sx, sz] of standPositions) {
      // Main column
      const column = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, standH, 1.1),
        scaffoldMat
      );
      column.position.set(sx, groundY + standH / 2, sz);
      column.castShadow = true;
      group.add(column);

      // Top cradle cap — sits right against the hull underside
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.3, 1.6),
        metalMat
      );
      cap.position.set(sx, groundY + standH + 0.15, sz);
      group.add(cap);

      // Cross brace on the column
      for (const h of [standH * 0.3, standH * 0.65]) {
        const ring = new THREE.Mesh(
          new THREE.BoxGeometry(1.3, 0.12, 1.3),
          metalMat
        );
        ring.position.set(sx, groundY + h, sz);
        group.add(ring);
      }

      // Warning light on the stand top
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        warnMat
      );
      light.position.set(sx, groundY + standH + 0.4, sz + 0.6);
      group.add(light);
    }

    // ── Side service scaffold ──────────────────────────────────
    // Everything here is in WORLD space. shipBox was built with
    // updateMatrixWorld so its coords are already world-space.
    // Meshes are added to this.level (not group) so their .position
    // is world-space too — no group-offset confusion.
    const sfW      = 3.6;
    const platH    = 0.5;
    const platD    = 3.0;
    const platW    = sfW + 0.4;

    // Place scaffold to the left of the ship in world space
    const sfX      = shipBox.min.x - platW / 2 - 0.4;
    const sfZ      = (shipBox.min.z + shipBox.max.z) / 2;
    const sfGndY   = this.getSurfaceHeight(sfX, sfZ);  // exact moon surface here
    const platTopY = sfGndY + platH;

    const uprightH = liftHeight + 3.0;

    // Tall uprights (visual — reach up to hull side)
    for (const side of [-1, 1]) {
      const upright = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, uprightH, 0.18),
        scaffoldMat
      );
      upright.position.set(sfX + side * sfW / 2, sfGndY + uprightH / 2, sfZ);
      upright.castShadow = true;
      this.level.add(upright);
    }
    for (const h of [uprightH * 0.35, uprightH * 0.65, uprightH * 0.9]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(sfW, 0.12, 0.12), metalMat);
      bar.position.set(sfX, sfGndY + h, sfZ);
      this.level.add(bar);
    }

    // Platform deck — sits flush on the moon surface
    const platform = new THREE.Mesh(new THREE.BoxGeometry(platW, platH, platD), scaffoldMat);
    platform.position.set(sfX, sfGndY + platH / 2, sfZ);
    platform.castShadow = true;
    platform.receiveShadow = true;
    this.level.add(platform);

    // Back railing (ship side)
    const rail = new THREE.Mesh(new THREE.BoxGeometry(platW, 0.9, 0.1), metalMat);
    rail.position.set(sfX, sfGndY + platH + 0.45, sfZ - platD / 2 + 0.05);
    this.level.add(rail);

    // Warning stripe on front edge
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(platW, 0.08, 0.18), warnMat);
    stripe.position.set(sfX, sfGndY + platH + 0.04, sfZ + platD / 2 - 0.1);
    this.level.add(stripe);

    // ── Walkable surface (world-space, no offset needed) ──
    this._walkSurfaces.push({
      x0: sfX - platW / 2,
      x1: sfX + platW / 2,
      z0: sfZ - platD / 2,
      z1: sfZ + platD / 2,
      top: platTopY,
    });

    // No Box3 wall collider needed — the platform is low enough that
    // _walkSurfaces + gravity snaps the player onto it automatically.
    // A wall collider would push the player sideways away from the platform.
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
    monument.position.set(0, 0, 0);           // built in world coords
    monument.name = 'Monument';
    this.level.add(monument);

    const surfaceY = this.getSurfaceHeight(0, -60);
    this._plazaTop = surfaceY + 1.2;

    // ── Plaza disc ───────────────────────────────────────────
    const plazaMat = new THREE.MeshStandardMaterial({
      color: 0xc9d4dc, roughness: 0.18, metalness: 0.88,
    });
    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(60, 60, 1.2, 64),
      plazaMat
    );
    plaza.position.set(0, surfaceY + 0.6, -60);
    plaza.receiveShadow = true;
    monument.add(plaza);

    // Inner decorative ring so the plaza isn't a flat pancake
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xaebcc8, roughness: 0.22, metalness: 0.92,
    });
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(22, 22, 0.22, 48),
      ringMat
    );
    ring.position.set(0, surfaceY + 1.31, -60);
    monument.add(ring);

    // ── Exterior steps: moon → plaza ─────────────────────────
    // 8 steps walking up from world z=15 to the plaza's +z rim at z=0.
    const stepMat = new THREE.MeshStandardMaterial({
      color: 0xb8c4cf, roughness: 0.3, metalness: 0.75,
    });
    const stairBaseZ = 15;
    const stairTopZ  = 0;
    const STEPS      = 8;
    const baseY      = this.getSurfaceHeight(0, stairBaseZ);
    const stepDepth  = (stairBaseZ - stairTopZ) / STEPS;
    const stepRise   = (this._plazaTop - baseY) / STEPS;

    for (let i = 0; i < STEPS; i++) {
      const stepTopY = baseY + stepRise * (i + 1);
      const stepBotY = baseY - 0.6;
      const stepH    = stepTopY - stepBotY;
      const localZ   = stairBaseZ - stepDepth * (i + 0.5);

      const step = new THREE.Mesh(
        new THREE.BoxGeometry(24, stepH, stepDepth + 0.05),
        stepMat
      );
      step.position.set(0, stepBotY + stepH / 2, localZ);
      step.receiveShadow = true;
      step.castShadow = true;
      monument.add(step);

      // Emissive lip so the steps read in the dark
      const lip = new THREE.Mesh(
        new THREE.BoxGeometry(24.1, 0.08, 0.15),
        new THREE.MeshStandardMaterial({
          color: 0xdff6ff, emissive: 0xaee5ff, emissiveIntensity: 1.4,
        })
      );
      lip.position.set(0, stepTopY, localZ + stepDepth / 2 - 0.05);
      monument.add(lip);
    }

    this._stairRamps.push({
      ax: 0, az: stairBaseZ,
      bx: 0, bz: stairTopZ,
      ya: baseY, yb: this._plazaTop,
      halfWidth: 12,
    });

    // ── TOWER ─────────────────────────────────────────────────
    // Base section wraps around the interior room (footprint
    // x[-30,30], z[-125,-5]) with a 10-unit-thick shell. Everything
    // above is solid tiered massing with an Avengers-style setback.

    const roomXMin = -30, roomXMax = 30;
    const roomZMin = -125, roomZMax = -5;
    const WALL = 10;

    const towerXMin = roomXMin - WALL;   // -40
    const towerXMax = roomXMax + WALL;   // +40

    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xb8c8d4, roughness: 0.18, metalness: 0.92,
      side: THREE.DoubleSide,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x2a3a52, roughness: 0.14, metalness: 0.95,
      emissive: 0x102238, emissiveIntensity: 0.4,
    });
    const seamMat = new THREE.MeshStandardMaterial({
      color: 0xdff6ff, emissive: 0xaee5ff, emissiveIntensity: 2.2,
    });
    const kMat = new THREE.MeshStandardMaterial({
      color: 0xdff6ff, emissive: 0xaee5ff, emissiveIntensity: 2.6,
    });

    // ── BASE (y: surfaceY → surfaceY+80) ──
    const BASE_H = 80;
    const ARCH_HALF_W = 17;
    const ARCH_H = 50;

    // Front wall — split into left block, right block, lintel, so the
    // arch opening at x[-17,17] is a real hole in the geometry.
    const fL = new THREE.Mesh(
      new THREE.BoxGeometry(towerXMax - ARCH_HALF_W, BASE_H, 1.5), shellMat);
    fL.position.set((towerXMin + (-ARCH_HALF_W)) / 2, surfaceY + BASE_H / 2, roomZMax);
    monument.add(fL);

    const fR = new THREE.Mesh(
      new THREE.BoxGeometry(towerXMax - ARCH_HALF_W, BASE_H, 1.5), shellMat);
    fR.position.set((towerXMax + ARCH_HALF_W) / 2, surfaceY + BASE_H / 2, roomZMax);
    monument.add(fR);

    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(ARCH_HALF_W * 2, BASE_H - ARCH_H, 1.5), shellMat);
    lintel.position.set(0, surfaceY + ARCH_H + (BASE_H - ARCH_H) / 2, roomZMax);
    monument.add(lintel);

    // Back wall
    const bW = new THREE.Mesh(
      new THREE.BoxGeometry(towerXMax - towerXMin, BASE_H, 1.5), shellMat);
    bW.position.set(0, surfaceY + BASE_H / 2, roomZMin);
    monument.add(bW);

    // Left / right walls
    for (const sx of [towerXMin, towerXMax]) {
      const w = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, BASE_H, roomZMax - roomZMin), shellMat);
      w.position.set(sx, surfaceY + BASE_H / 2, (roomZMin + roomZMax) / 2);
      monument.add(w);
    }

    // Roof of base
    const baseRoof = new THREE.Mesh(
      new THREE.BoxGeometry(towerXMax - towerXMin, 1.5, roomZMax - roomZMin), shellMat);
    baseRoof.position.set(0, surfaceY + BASE_H, (roomZMin + roomZMax) / 2);
    monument.add(baseRoof);

    // Base corner seam strips — vertical glowing edges
    for (const x of [towerXMin + 0.2, towerXMax - 0.2]) {
      for (const z of [roomZMin + 0.2, roomZMax - 0.2]) {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.5, BASE_H, 0.5), seamMat);
        seam.position.set(x, surfaceY + BASE_H / 2, z);
        monument.add(seam);
      }
    }

    // ── TIER 2 (y: +80 → +130) ──
    const T2_Y = surfaceY + BASE_H;
    const T2_H = 50;
    const T2_XW = 30;
    const T2_ZMIN = roomZMin + 10;
    const T2_ZMAX = roomZMax - 10;
    const t2 = new THREE.Mesh(
      new THREE.BoxGeometry(T2_XW * 2, T2_H, T2_ZMAX - T2_ZMIN), glassMat);
    t2.position.set(0, T2_Y + T2_H / 2, (T2_ZMIN + T2_ZMAX) / 2);
    t2.castShadow = true;
    monument.add(t2);

    // Tier 2 seams
    for (const x of [-T2_XW + 0.2, T2_XW - 0.2]) {
      for (const z of [T2_ZMIN + 0.2, T2_ZMAX - 0.2]) {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.4, T2_H, 0.4), seamMat);
        seam.position.set(x, T2_Y + T2_H / 2, z);
        monument.add(seam);
      }
    }

    // ── TIER 3 (y: +130 → +170) ──
    const T3_Y = T2_Y + T2_H;
    const T3_H = 40;
    const T3_XW = 22;
    const T3_ZMIN = T2_ZMIN + 10;
    const T3_ZMAX = T2_ZMAX - 10;
    const t3 = new THREE.Mesh(
      new THREE.BoxGeometry(T3_XW * 2, T3_H, T3_ZMAX - T3_ZMIN), glassMat);
    t3.position.set(0, T3_Y + T3_H / 2, (T3_ZMIN + T3_ZMAX) / 2);
    t3.castShadow = true;
    monument.add(t3);

    // ── CROWN (y: +170 → +200) ──
    const CR_Y = T3_Y + T3_H;
    const CR_H = 30;
    const CR_XW = 14;
    const CR_ZMIN = T3_ZMIN + 10;
    const CR_ZMAX = T3_ZMAX - 10;
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(CR_XW * 2, CR_H, CR_ZMAX - CR_ZMIN), shellMat);
    crown.position.set(0, CR_Y + CR_H / 2, (CR_ZMIN + CR_ZMAX) / 2);
    crown.castShadow = true;
    monument.add(crown);

    // ── ANTENNA + TIP ──
    const antBaseY = CR_Y + CR_H;
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.8, 32, 10), shellMat);
    antenna.position.set(0, antBaseY + 16, (CR_ZMIN + CR_ZMAX) / 2);
    monument.add(antenna);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 12), seamMat);
    tip.position.set(0, antBaseY + 32, (CR_ZMIN + CR_ZMAX) / 2);
    monument.add(tip);

    // ── DIAGONAL BUTTRESS STRUTS on the front corners ──
    // The signature "avengers-tower" visual — angled bracing bars that
    // lean back into the tower.
    for (const sx of [-1, 1]) {
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 42, 1.6), seamMat);
      strut.position.set(sx * (towerXMax - 1.5), surfaceY + 34, roomZMax - 4);
      strut.rotation.x = -0.12;
      monument.add(strut);
    }

    // ── K LOGO on tier 2 front face ──
    // Stylised: vertical stem + two angled arms, just like the original
    // but now positioned high on the tower where it reads from far away.
    const kFrontZ = T2_ZMAX + 0.6;
    const kY      = T2_Y + T2_H / 2 + 3;

    const stem = new THREE.Mesh(new THREE.BoxGeometry(3.2, 24, 0.7), kMat);
    stem.position.set(-5, kY, kFrontZ);
    monument.add(stem);

    const armTop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 14, 0.7), kMat);
    armTop.position.set(3.5, kY + 6, kFrontZ);
    armTop.rotation.z = -Math.PI / 5;
    monument.add(armTop);

    const armBot = new THREE.Mesh(new THREE.BoxGeometry(3.2, 14, 0.7), kMat);
    armBot.position.set(3.5, kY - 6, kFrontZ);
    armBot.rotation.z = Math.PI / 5;
    monument.add(armBot);

    const kLight = new THREE.PointLight(0xaee5ff, 10, 30, 1.4);
    kLight.position.set(0, kY, kFrontZ + 5);
    monument.add(kLight);

    // ── FACADE FLOODLIGHTS ──
    const floodPositions = [[-25, 0, 20], [0, 0, 22], [25, 0, 20]];
    for (const [fx, , fz] of floodPositions) {
      const flood = new THREE.SpotLight(0xe8f6ff, 40, 180, Math.PI / 7, 0.4, 1.2);
      flood.position.set(fx, surfaceY + 3, fz);
      flood.target.position.set(fx, surfaceY + 140, -20);
      monument.add(flood);
      monument.add(flood.target);
    }

    // ── BACKLIGHT HALO ──
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = haloCanvas.height = 256;
    const hctx = haloCanvas.getContext('2d');
    const hgrad = hctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    hgrad.addColorStop(0, 'rgba(220,240,255,0.55)');
    hgrad.addColorStop(0.5, 'rgba(150,190,220,0.22)');
    hgrad.addColorStop(1, 'rgba(60,80,100,0)');
    hctx.fillStyle = hgrad;
    hctx.fillRect(0, 0, 256, 256);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(haloCanvas),
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    halo.position.set(0, surfaceY + 110, -150);
    halo.scale.set(260, 260, 1);
    monument.add(halo);
    this.monumentHalo = halo;

    this.monument = monument;
  }

  // ─────────────────────────────────────────────────────────
  // MONUMENT INTERIOR — one open boss hall. Used to be three
  // stacked floors linked by stairs; the stairs were unreliable to
  // climb, so it's now a single walkable hall the whole way through,
  // dressed up so it still reads as the boss's domain.
  // ─────────────────────────────────────────────────────────
  createMonumentInterior() {
    const surfaceY = this.getSurfaceHeight(0, -60);
    const interior = new THREE.Group();
    interior.name = 'MonumentInterior';
    this.level.add(interior);

    // Aesthetic palette — deep indigo/slate instead of near-black, so the
    // hall actually reads instead of vanishing into shadow.
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1c2040,
      roughness: 0.5,
      metalness: 0.4,
      side: THREE.BackSide,     // visible from inside
    });
    // FIX: match the plaza so the hall floor doesn't read as a
    // distinct navy layer through the arch.
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xc9d4dc,     // was 0x272c50 — same as plazaMat
      roughness: 0.18,     // was 0.45
      metalness: 0.88,     // was 0.5
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x00d9ff,
      emissive: 0x00d9ff,
      emissiveIntensity: 1.6,
    });

    // FIX: room now spans the entire tower base — z[-125, -5] instead of
    // z[-125, -65]. That removes the dead front section the player used
    // to clip through, and lets the tower's arch at z=-5 open directly
    // into the hall.
    const slabCenterZ = -65;
    const roomHeight  = 70;

    // FIX: was surfaceY + 1.45. The slab is centered on this Y and is
    // 0.5 thick, so its top now lands at surfaceY + 1.2 — exactly the
    // plaza top. No step, no visible second layer.
    this._F = { floor: surfaceY + 0.95 };

    this._addRoom(interior, {
      center: new THREE.Vector3(0, this._F.floor + roomHeight / 2, slabCenterZ),
      size:   new THREE.Vector3(60, roomHeight, 120),
      wallMat, floorMat, trimMat,
    });

    this._decorateHall(interior);
  }

  // Pillars, braziers, banners and crates — makes the hall feel like a
  // lived-in boss lair instead of an empty box, and adds enough warm
  // light that the aesthetic wall colors actually show up.
  _decorateHall(parent) {
    const floorY = this._F.floor;

    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x30365c, roughness: 0.4, metalness: 0.55,
    });
    const emberMat = new THREE.MeshStandardMaterial({
      color: 0xff8a3d, emissive: 0xff6a1a, emissiveIntensity: 2.2, roughness: 0.4,
    });
    const bannerMat = new THREE.MeshStandardMaterial({
      color: 0x2a2f55, emissive: 0x0099cc, emissiveIntensity: 0.5,
      roughness: 0.6, side: THREE.DoubleSide,
    });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x3a3f2e, roughness: 0.8 });

    // Paired pillars with braziers on top, running the length of the hall.
    for (const z of [-80, -95, -110]) {
      for (const side of [-1, 1]) {
        const x = side * 24;

        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 68, 12), pillarMat);
        pillar.position.set(x, floorY + 34, z);
        pillar.castShadow = true;
        parent.add(pillar);

        const brazier = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), emberMat);
        brazier.position.set(x, floorY + 3.2, z);
        parent.add(brazier);

        const flame = new THREE.PointLight(0xff8844, 6, 16, 2);
        flame.position.set(x, floorY + 3.8, z);
        parent.add(flame);
      }
    }

    // Banners flanking the throne, at the back of the hall
    for (const side of [-1, 1]) {
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(4, 14), bannerMat);
      banner.position.set(side * 12, floorY + 22, -119);
      parent.add(banner);
    }

    // Crates near the entrance so the hall feels lived-in, not staged
    const crateSpots = [[-20, -74], [22, -76], [18, -72]];
    for (const [cx, cz] of crateSpots) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), crateMat);
      crate.position.set(cx, floorY + 1, cz);
      crate.rotation.y = Math.random() * Math.PI;
      crate.castShadow = true;
      parent.add(crate);
    }

    // Extra fill light — the single point light from _addRoom isn't
    // enough to light the whole 70-unit-tall hall on its own.
    const fill = new THREE.PointLight(0x8fb8ff, 6, 90, 1.4);
    fill.position.set(0, floorY + 45, -95);
    parent.add(fill);
  }

  _addRoom(parent, { center, size, wallMat, floorMat, trimMat, floorOpening = null, ceilingOpening = null }) {
    // Floor + ceiling. Each is one slab, or four strips around a
    // stairwell opening so the stairs can pass through.
    this._addSlab(parent, center.x, center.y - size.y / 2, center.z, size.x, size.z, floorMat, floorOpening, true);
    this._addSlab(parent, center.x, center.y + size.y / 2, center.z, size.x, size.z, floorMat, ceilingOpening, false);

    // Walls (using back-side material so they're visible from inside)
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

  _addSlab(parent, cx, y, cz, sizeX, sizeZ, mat, opening, walkable) {
    const T = 0.5;
    const top = y + T / 2;
    const minX = cx - sizeX / 2, maxX = cx + sizeX / 2;
    const minZ = cz - sizeZ / 2, maxZ = cz + sizeZ / 2;

    const rects = [];
    if (!opening) {
      rects.push([minX, minZ, maxX, maxZ]);
    } else {
      rects.push([minX, minZ, maxX, opening.z0]);             // front strip
      rects.push([minX, opening.z1, maxX, maxZ]);             // back strip
      rects.push([minX, opening.z0, opening.x0, opening.z1]); // left of hole
      rects.push([opening.x1, opening.z0, maxX, opening.z1]); // right of hole
    }

    for (const [x0, z0, x1, z1] of rects) {
      if (x1 - x0 < 0.05 || z1 - z0 < 0.05) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, T, z1 - z0), mat);
      m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
      m.receiveShadow = true;
      parent.add(m);
      if (walkable) this._walkSurfaces.push({ x0, z0, x1, z1, top });
    }
  }

  // (Interior stairs removed — see createMonumentInterior. The exterior
  // plaza approach stairs in createMonument() are unrelated and unaffected.)

  // ─────────────────────────────────────────────────────────
  // GUARDIAN SPAWNS
  // ─────────────────────────────────────────────────────────
  createGuardianSpawns() {
    const chamberY = this._F.floor;  // the hall's one walking level

    // Attack gate — max 1 guardian attacking at once
    this.guardianGate = { current: 0, max: 1 };

    // Blade — left of the chamber
    const blade = new Guardian(
      this.level,
      new THREE.Vector3(-10, chamberY, -95),
      'blade',
      this.guardianGate,
      this                              // ← level ref for ground query
    );
    // Fist — right of the chamber
    const fist = new Guardian(
      this.level,
      new THREE.Vector3(10, chamberY, -95),
      'fist',
      this.guardianGate,
      this                              // ← same
    );

    // Guardians start dormant — they wake when the player enters
    blade.state = STATE.IDLE;
    fist.state = STATE.IDLE;

    this.guardians.push(blade, fist);
  }

  // ─────────────────────────────────────────────────────────
  // ARCHITECT — delegates to Architect (src/player/architect.js)
  // ─────────────────────────────────────────────────────────
  createArchitect() {
    const throneY = this._F.floor;
    this.architect = new Architect(
      this.level,
      new THREE.Vector3(0, throneY, -113)
    );
  }

  // ─────────────────────────────────────────────────────────
  // PLAZA STATUES — frozen marble guardian figures ringing the
  // plaza, matching the icy monument palette
  // ─────────────────────────────────────────────────────────
  createPlazaStatues() {
    const group = new THREE.Group();
    group.name = 'PlazaStatues';
    this.level.add(group);

    const marbleMat = new THREE.MeshStandardMaterial({
      color: 0xe7eef3, roughness: 0.35, metalness: 0.15,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xdff6ff, emissive: 0xaee5ff, emissiveIntensity: 1.4,
    });
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0xa8b4bf, roughness: 0.3, metalness: 0.6,
    });

    function buildStatue() {
      const s = new THREE.Group();

      // Pedestal
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 1.0, 16), pedestalMat);
      pedestal.position.y = 0.5;
      pedestal.castShadow = true;
      pedestal.receiveShadow = true;
      s.add(pedestal);

      // Robed body — tapered cylinder reads as a cloak
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.15, 3.2, 12), marbleMat);
      robe.position.y = 1.0 + 1.6;
      robe.castShadow = true;
      s.add(robe);

      // Shoulders
      const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 8), marbleMat);
      shoulders.scale.set(1, 0.55, 0.85);
      shoulders.position.y = 1.0 + 3.15;
      s.add(shoulders);

      // Hooded head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), marbleMat);
      head.position.y = 1.0 + 3.75;
      s.add(head);
      const hoodPoint = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 10), marbleMat);
      hoodPoint.position.y = 1.0 + 4.2;
      s.add(hoodPoint);

      // Faint glowing eyes — the only spot of life on an otherwise frozen figure
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), trimMat);
        eye.position.set(side * 0.14, 1.0 + 3.78, 0.36);
        s.add(eye);
      }

      // A single glowing seam down the front of the robe, echoing the monument
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.6, 0.08), trimMat);
      seam.position.set(0, 1.0 + 1.7, 0.5);
      s.add(seam);

      return s;
    }

    const surfaceY = this.getSurfaceHeight(0, -60);
    const count = 8;
    const radius = 46; // inside the 60-radius plaza, outside the steps/path
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.PI / count; // offset so none sit dead-center on the entrance
      const x = Math.cos(angle) * radius;
      const z = -60 + Math.sin(angle) * radius;

      // Skip the two positions that would block the entrance steps
      if (Math.abs(x) < 12 && Math.sin(angle) > 0.5) continue;

      const statue = buildStatue();
      statue.position.set(x, surfaceY + 0.6, z);
      statue.rotation.y = Math.atan2(-x, -(z + 60)); // face the plaza center
      group.add(statue);
      this._propColliders.push(new THREE.Box3(
        new THREE.Vector3(x - 1.6, surfaceY, z - 1.6),
        new THREE.Vector3(x + 1.6, surfaceY + 5.5, z + 1.6)));
    }

    this.plazaStatues = group;
  }


  createWreckageField() {
    const group = new THREE.Group();
    group.name = 'WreckageField';
    this.level.add(group);

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x2b2d33, roughness: 0.7, metalness: 0.6,
    });
    const scorchMat = new THREE.MeshStandardMaterial({
      color: 0x0f0f12, roughness: 0.9, metalness: 0.3,
    });
    const emberMat = new THREE.MeshStandardMaterial({
      color: 0xff5522, emissive: 0xff4400, emissiveIntensity: 3,
    });

    // Keep clear of the landing path (x≈20, z 57-73) and the monument
    // plaza (60 radius around 0,-60) so nothing blocks walking routes.
    let seed = 42;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

    for (let i = 0; i < 14; i++) {
      const angle = rnd() * Math.PI * 2;
      const radius = 70 + rnd() * 110;
      const x = Math.cos(angle) * radius;
      const z = -60 + Math.sin(angle) * radius; // biased around the monument approach
      if (Math.abs(x - 20) < 20 && z > 40 && z < 80) continue; // skip landing path
      if (Math.sqrt(x * x + (z + 60) * (z + 60)) < 65) continue; // skip plaza

      const y = this.getSurfaceHeight(x, z);
      const piece = new THREE.Group();

      const bodyLen = 2 + rnd() * 4;
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(bodyLen, 0.7 + rnd() * 0.6, 1.2 + rnd() * 1.4),
        rnd() > 0.5 ? hullMat : scorchMat
      );
      hull.rotation.set(rnd() * 0.5, rnd() * Math.PI * 2, rnd() * 0.6);
      hull.castShadow = true;
      hull.receiveShadow = true;
      piece.add(hull);

      // A jagged fin/plate sticking out of some pieces
      if (rnd() > 0.4) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.9), hullMat);
        fin.position.set(bodyLen * 0.3, 0.5, 0);
        fin.rotation.z = (rnd() - 0.5) * 0.8;
        piece.add(fin);
      }

      // Occasional glowing ember crack + light — a few, not all
      if (rnd() > 0.65) {
        const ember = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.4), emberMat);
        ember.position.y = 0.35;
        piece.add(ember);
        const glow = new THREE.PointLight(0xff5522, 3, 5, 2);
        glow.position.y = 0.4;
        piece.add(glow);
      }

      piece.position.set(x, y + 0.3, z);
      group.add(piece);
    }
  }

  // ─────────────────────────────────────────────────────────
  // DISTANT FLEET — enemy ships parked in the black sky
  // ─────────────────────────────────────────────────────────
  createDistantFleet() {
    this.fleetShips = [];
    const group = new THREE.Group();
    group.name = 'DistantFleet';
    this.level.add(group);

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x15161c, roughness: 0.5, metalness: 0.7,
    });
    const lightColors = [0xff2244, 0x00d9ff, 0xffaa00];

    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

    for (let i = 0; i < 6; i++) {
      const ship = new THREE.Group();

      const scale = 6 + rnd() * 10;
      const body = new THREE.Mesh(new THREE.ConeGeometry(scale * 0.18, scale, 6), hullMat);
      body.rotation.x = Math.PI / 2;
      ship.add(body);

      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(scale * 1.4, scale * 0.06, scale * 0.35),
        hullMat
      );
      wing.position.z = scale * 0.1;
      ship.add(wing);

      // Running lights — tiny emissive dots, visible even at distance
      const lightColor = lightColors[i % lightColors.length];
      for (const side of [-1, 1]) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(scale * 0.05, 6, 6),
          new THREE.MeshBasicMaterial({ color: lightColor })
        );
        dot.position.set(side * scale * 0.65, 0, scale * 0.1);
        ship.add(dot);
      }

      const x = (rnd() - 0.5) * 500;
      const y = 60 + rnd() * 140;
      const z = -300 - rnd() * 250;
      ship.position.set(x, y, z);
      ship.rotation.y = rnd() * Math.PI * 2;
      group.add(ship);

      this.fleetShips.push({ mesh: ship, baseX: x, drift: (rnd() - 0.5) * 1.2 });
    }
  }

  // ─────────────────────────────────────────────────────────
  // BACKGROUND SPIRES — smaller monoliths breaking up the skyline
  // ─────────────────────────────────────────────────────────
  createBackgroundSpires() {
    const group = new THREE.Group();
    group.name = 'BackgroundSpires';
    this.level.add(group);

    const slabMat = new THREE.MeshStandardMaterial({
      color: 0xa8b4bf, roughness: 0.25, metalness: 0.8,
    });
    const seamMat = new THREE.MeshStandardMaterial({
      color: 0xdff6ff, emissive: 0xaee5ff, emissiveIntensity: 1.8,
    });

    let seed = 99;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

    for (let i = 0; i < 9; i++) {
      const angle = rnd() * Math.PI * 2;
      const radius = 180 + rnd() * 160;
      const x = Math.cos(angle) * radius;
      const z = -60 + Math.sin(angle) * radius;

      const height = 40 + rnd() * 90;
      const width = 6 + rnd() * 10;
      const y = this.getSurfaceHeight(x, z);

      const spire = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, width * 0.7),
        slabMat
      );
      spire.position.set(x, y + height / 2, z);
      spire.rotation.y = rnd() * Math.PI;
      spire.castShadow = true;
      group.add(spire);

      // Thin glowing seam so it reads at a distance, matching the monument
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.3, height * 0.9, 0.3), seamMat);
      seam.position.set(x, y + height / 2, z + width * 0.36);
      group.add(seam);
    }
  }

  // ─────────────────────────────────────────────────────────
  // SURFACE HEIGHT
  // ─────────────────────────────────────────────────────────
  // Multi-surface ground query. Returns the highest walkable surface
  // at (x, z) that is not above refY + STEP_UP — so a player standing
  // on Floor 1 doesn't get snapped up to Floor 2, but can still walk
  // up stairs one step at a time. Pass the entity's current Y as refY.
  // Multi-surface ground query. Returns the highest walkable surface
  // at (x, z) that is not above refY + STEP_UP — so a player standing
  // on Floor 1 doesn't get snapped up to Floor 2, but can still walk
  // up stairs one step at a time. Pass the entity's current Y as refY.
  getSurfaceHeight(worldX, worldZ, refY = Infinity) {
    let g = this._moonHeight(worldX, worldZ);
    const limit = refY + 1.6;   // FIX: was refY + 0.6 — plaza is 1.2 up,
                                // interior floor is 1.7 up; 1.6 lets you
                                // step onto both without teleporting onto
                                // the monument slab

    // Plaza disc
    if (this._plazaTop !== null) {
      const dx = worldX, dz = worldZ + 60;
      // FIX: radius 60 (matches the visual cylinder) so the stair top
      // hands off cleanly to the plaza walkable zone with no dip.
      if (dx * dx + dz * dz <= 60 * 60 &&
          this._plazaTop <= limit && this._plazaTop > g) g = this._plazaTop;
    }

    // Interior floor slabs
    const S = this._walkSurfaces;
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      if (worldX >= s.x0 && worldX <= s.x1 &&
          worldZ >= s.z0 && worldZ <= s.z1 &&
          s.top <= limit && s.top > g) g = s.top;
    }

    // Stair ramps — project onto the ramp segment and interpolate
    const R = this._stairRamps;
    for (let i = 0; i < R.length; i++) {
      const r = R[i];
      const abx = r.bx - r.ax, abz = r.bz - r.az;
      const lenSq = abx * abx + abz * abz;
      const t = ((worldX - r.ax) * abx + (worldZ - r.az) * abz) / lenSq;
      if (t < 0 || t > 1) continue;
      const px = r.ax + abx * t, pz = r.az + abz * t;
      const ddx = worldX - px, ddz = worldZ - pz;
      if (ddx * ddx + ddz * ddz > r.halfWidth * r.halfWidth) continue;
      const h = r.ya + (r.yb - r.ya) * t;
      if (h <= limit && h > g) g = h;
    }

    return g;
  }

  _moonHeight(worldX, worldZ) {
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

  groundHeight(x, z, feetY = 0) { return this.getSurfaceHeight(x, z, feetY); }
  terrainHeight(x, z) { return this.getSurfaceHeight(x, z); }

  // ─────────────────────────────────────────────────────────
  // COLLIDERS
  // ─────────────────────────────────────────────────────────
  _buildColliders() {
    this.colliders = [];
    if (this._propColliders) this.colliders.push(...this._propColliders);

    const surfaceY = this.getSurfaceHeight(0, -60);
    // FIX: was surfaceY + 1.45. Must equal this._F.floor so wall colliders
    // sit at the same height the floor mesh is drawn at.
    const floorY   = surfaceY + 0.95;
    const roomH    = 70;
    const wallT    = 0.6;

    // Interior room now spans the whole tower base: x[-30,30], z[-125,-5]
    const roomXMin = -30, roomXMax = 30;
    const roomZMin = -125, roomZMax = -5;

    // ── Interior hall walls (back, left, right) ──
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(roomXMin, floorY, roomZMin - wallT),
      new THREE.Vector3(roomXMax, floorY + roomH, roomZMin)
    ));
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(roomXMin - wallT, floorY, roomZMin),
      new THREE.Vector3(roomXMin, floorY + roomH, roomZMax)
    ));
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(roomXMax, floorY, roomZMin),
      new THREE.Vector3(roomXMax + wallT, floorY + roomH, roomZMax)
    ));

    // ── Front wall at z = -5 (with arch opening x[-17,17], y<+50) ──
    const ARCH_HALF = 17;
    const ARCH_H    = 50;
    const sBase     = surfaceY;
    const sTop      = surfaceY + 200;
    const T         = 1.5;

    // Left block
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(-40, sBase, roomZMax - T),
      new THREE.Vector3(-ARCH_HALF, sTop, roomZMax)
    ));
    // Right block
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(ARCH_HALF, sBase, roomZMax - T),
      new THREE.Vector3(40, sTop, roomZMax)
    ));
    // Lintel above the arch
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(-ARCH_HALF, floorY + ARCH_H, roomZMax - T),
      new THREE.Vector3(ARCH_HALF, sTop, roomZMax)
    ));

    // Back wall of base
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(-40, sBase, roomZMin - T),
      new THREE.Vector3(40, sTop, roomZMin)
    ));
    // Base side walls
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(-41, sBase, roomZMin),
      new THREE.Vector3(-40, sTop, roomZMax)
    ));
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(40, sBase, roomZMin),
      new THREE.Vector3(41, sTop, roomZMax)
    ));

    // No per-step colliders — the walkable ramp on _stairRamps handles
    // ground height, and the steps themselves are cosmetic. No plaza rim
    // either: the 1.2 lip is trivially stepped onto, and a rim wall would
    // just block entry again.
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

    // Architect animation
    if (this.architect && typeof this.architect.update === 'function') {
      this.architect.update(dt);
    }

    // Distant fleet — slow drift so the sky doesn't feel static
    if (this.fleetShips) {
      for (const ship of this.fleetShips) {
        ship.mesh.position.x += ship.drift * dt;
        if (Math.abs(ship.mesh.position.x - ship.baseX) > 15) ship.drift *= -1;
      }
    }

    // Update guardians
    for (const g of this.guardians) {
      if (g._disposed) continue;

      // Wake guardians when player enters the hall
      const chamberY = this._F.floor;
      const dy = Math.abs(player.pos.y - chamberY);
      const distToChamber = player.pos.distanceTo(new THREE.Vector3(0, chamberY, -95));

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

    // Check if both minions are dead — the Architect is now approachable
    if (!this.guardiansDefeated && this.guardians.length === 2) {
      const bothDead = this.guardians.every((g) => g.state === STATE.DEAD || g.dead);
      if (bothDead) {
        this.guardiansDefeated = true;
        console.log('⚔️ GUARDIANS DEFEATED — The Architect awaits.');
      }
    }

    // Architect dialogue — trigger when the player gets close to him,
    // now that the hall is one open room instead of a gated throne floor.
    if (
      this.guardiansDefeated &&
      !this.dialogueStarted &&
      !this.architectDialogueActive &&
      this.dialogue &&
      this.architect &&
      player.pos.distanceTo(this.architect.getPosition()) < 12
    ) {
      this.dialogueStarted = true;
      this.architectDialogueActive = true;
      this._runArchitectSequence();
    }
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
    if (this.architect) {
      try { this.architect.dispose(); } catch (e) {}
      this.architect = null;
    }
    this.fleetShips = null;
    this.colliders = [];
  }
}
