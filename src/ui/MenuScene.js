// src/ui/MenuScene.js
// Isolated 3D scene for the main menu — Sorini left, Architect right
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// ── Throne dimensions — MIRRORS architect.js (Level 3) ──
// The Dreyar rig ships with a RECLINED sit pose, so the throne is
// a matching recliner: pivoting backrest, low seat, side arms.
// Keep these in sync with architect.js.
const SEAT_Y   = 0.35;              // bottom of the cushion
const SEAT_H   = 0.22;              // cushion thickness
const SEAT_TOP = SEAT_Y + SEAT_H;   // where his butt lands
const SEAT_W   = 1.4;
const SEAT_D   = 2.2;
const BACK_TILT   = -0.75;          // ≈ 43° back — matches the pose
const BACK_HEIGHT = 6.5;

export class MenuScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();

    // Wider FOV for the wide two-character layout
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    this.camera.position.set(0, 1.8, 9.5);
    this.camera.lookAt(0, 1.0, 0);

    // ── Lighting: dusk palette from the game ──
    const hemi = new THREE.HemisphereLight(0xb8a0e8, 0x5a4a70, 1.4);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffd4a8, 2.2);
    key.position.set(4, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);

    // Purple rim light behind Sorini (left)
    const rimL = new THREE.PointLight(0x9900ff, 15, 10, 2);
    rimL.position.set(-3, 2.5, -1.5);
    this.scene.add(rimL);

    // Orange rim light behind Architect (right)
    const rimR = new THREE.PointLight(0xff8833, 15, 10, 2);
    rimR.position.set(3, 2.5, -1.5);
    this.scene.add(rimR);

    // ── Fog ──
    this.scene.fog = new THREE.FogExp2(0x1a1030, 0.05);

    // ── Ground plane (so shadows land somewhere) ──
    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a1030,
      roughness: 0.95,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // ── Load both characters ──
    this._loadSorini();
    this._loadArchitect();
    this._createAxiomOrb();

    this._time = 0;
    // The render loop is NOT running yet — main.js calls start()
    // right after construction. Starting the flag at `true` would
    // make start()'s guard bail and the menu would render nothing.
    this._running = false;

    this._onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this._onResize);
  }

  // ─────────────────────────────────────────
  // SORINI — left side, facing right
  // ─────────────────────────────────────────
  _loadSorini() {
    const loader = new FBXLoader();
    loader.load('./assets/models/player/sorini.fbx', (fbx) => {
      fbx.scale.setScalar(0.013);
      // Her feet sit at local y≈0 (Mixamo origin) — keep the group ON the
      // floor plane (y=0). A previous -0.13 offset here buried her boots.
      fbx.position.set(-4.0, 0, 0);
      fbx.rotation.y = Math.PI / 2 + 0.3;   // face toward +X, slight turn toward camera
      fbx.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        // Mixamo quirk: her boots/bodysuit material ships with the specular
        // PNG wired as an alphaMap and transparent:true — the map's dark
        // regions punch alpha to zero and her shoes vanish. Force it opaque.
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m.transparent && m.alphaMap) {
            m.transparent = false;
            m.alphaMap = null;
            m.opacity = 1;
            m.needsUpdate = true;
          }
        }
      });
      this.scene.add(fbx);
      this.sorini = fbx;

      // Idle animation
      loader.load('./assets/models/player/idle.fbx', (animFbx) => {
        if (animFbx.animations?.[0]) {
          this.mixer = new THREE.AnimationMixer(fbx);
          const clip = animFbx.animations[0];
          for (const track of clip.tracks) {
            if (!/Hips/i.test(track.name) || !/\.position/i.test(track.name)) continue;
            const v = track.values;
            if (!v || v.length < 3) continue;
            const x0 = v[0], z0 = v[2];
            for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
          }
          this.mixer.clipAction(clip).play();
        }
      });
    }, undefined, (e) => console.warn('MenuScene: sorini.fbx load failed', e));
  }

  // ─────────────────────────────────────────
  // ARCHITECT — right side, seated on his throne, facing left
  // ─────────────────────────────────────────
  _loadArchitect() {
    const loader = new FBXLoader();

    // Menu-space anchor for the Architect AND his throne. Same
    // facing as before (toward Sorini). The throne is built in the
    // group's local space with the exact layout of the Level 3
    // arena (see architect.js), and the character root sits on the
    // cushion with the same local offset — so the pose lands on
    // the chair identically here.
    const arch = new THREE.Group();
    arch.position.set(4.2, -0.13, 0);
    arch.rotation.y = -Math.PI / 2 - 0.3;   // face toward -X, slight turn toward camera
    this.scene.add(arch);
    this.architectRoot = arch;

    this._buildThrone(arch);

    loader.load('./assets/models/enemy/dreyar.fbx', (fbx) => {
      fbx.scale.setScalar(0.0025);
      // Seating placement straight from architect.js: root on the
      // cushion (SEAT_TOP), nudged forward along the facing axis.
      fbx.position.set(0, SEAT_TOP, 0.3);
      fbx.rotation.y = 0;   // facing comes from the group
      fbx.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      arch.add(fbx);
      this.architect = fbx;

      // Sitting pose
      loader.load('./assets/models/enemy/sitting_pose.fbx', (animFbx) => {
        if (animFbx.animations?.[0] && !this.architectMixer) {
          this.architectMixer = new THREE.AnimationMixer(fbx);
          const clip = animFbx.animations[0];
          // Retarget bone names
          const byNorm = new Map();
          fbx.traverse(o => {
            if (o.name) {
              const n = o.name.replace(/^mixamorig:?/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
              if (!byNorm.has(n)) byNorm.set(n, o.name);
            }
          });
          for (const track of clip.tracks) {
            const dot = track.name.lastIndexOf('.');
            const nodeName = track.name.slice(0, dot);
            const prop = track.name.slice(dot);
            const target = byNorm.get(
              nodeName.replace(/^mixamorig:?/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
            );
            if (target) track.name = target + prop;
          }
          this.architectMixer.clipAction(clip).play();
        }
      });
    }, undefined, (e) => console.warn('MenuScene: architect load failed', e));
  }

  // ─────────────────────────────────────────
  // THRONE — ported from architect.js (Level 3 arena) so the
  // Architect sits on the same chair here as in his boss room.
  // Built in `parent`'s local space, facing +Z.
  // ─────────────────────────────────────────
  _buildThrone(parent) {
    const throneMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a12, roughness: 0.35, metalness: 0.75,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      // Dim, matte cyan for the menu close-up: the L3 strip material
      // (near-white base, metalness 0.75) speculars out to white bars
      // under the throne light at this camera distance.
      color: 0x9fd8e8, emissive: 0xaee5ff,
      emissiveIntensity: 0.5, metalness: 0.1, roughness: 0.7,
    });

    // ── Seat cushion (flat) ──
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(SEAT_W, SEAT_H, SEAT_D), throneMat);
    seat.position.set(0, SEAT_Y + SEAT_H / 2, 0);
    seat.castShadow = true;
    seat.receiveShadow = true;
    parent.add(seat);

    // ── Plinth under the seat ──
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(SEAT_W - 0.4, SEAT_Y, SEAT_D - 0.2), throneMat);
    base.position.set(0, SEAT_Y / 2, 0);
    base.castShadow = true;
    parent.add(base);

    // ── Backrest on a pivot group so it tilts back with the pose ──
    const backPivot = new THREE.Group();
    backPivot.position.set(0, SEAT_TOP, -SEAT_D / 2 + 0.25);
    backPivot.rotation.x = BACK_TILT;
    parent.add(backPivot);

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(SEAT_W, BACK_HEIGHT, 0.5), throneMat);
    back.position.set(0, BACK_HEIGHT / 2, 0);
    back.castShadow = true;
    backPivot.add(back);

    // Glowing trim strips running up the backrest
    for (const side of [-1, 1]) {
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, BACK_HEIGHT, 0.6), trimMat);
      trim.position.set(side * (SEAT_W / 2 - 0.09), BACK_HEIGHT / 2, 0);
      backPivot.add(trim);
    }

    // ── Armrests alongside the cushion ──
    const ARM_Y = SEAT_TOP + 1.2;
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.4, SEAT_D - 0.4), throneMat);
      arm.position.set(side * (SEAT_W / 2 - 0.175), ARM_Y, 0);
      arm.castShadow = true;
      parent.add(arm);

      // Armrest support posts (front + back)
      for (const z of [SEAT_D / 2 - 0.5, -SEAT_D / 2 + 0.5]) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, ARM_Y - SEAT_TOP, 0.2), throneMat);
        post.position.set(side * (SEAT_W / 2 - 0.175),
                          SEAT_TOP + (ARM_Y - SEAT_TOP) / 2, z);
        parent.add(post);
      }
    }

    // ── Throne lighting — same palette as the Level 3 arena, ──
    // softened for the menu's closer camera.
    const spot = new THREE.PointLight(0xaaccff, 8, 30, 1.5);
    spot.position.set(0, SEAT_TOP + 6, 3);
    parent.add(spot);

    const rim = new THREE.PointLight(0x6688ff, 6, 14, 2);
    rim.position.set(0, SEAT_TOP + 3, 4);
    parent.add(rim);
  }

  // ─────────────────────────────────────────
  // AXIOM ORB — floating in Sorini's hands
  // ─────────────────────────────────────────
  _createAxiomOrb() {
    this.axiomOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.26, 0),
      new THREE.MeshStandardMaterial({
        color: 0x88ddff,
        emissive: 0x88ddff,
        emissiveIntensity: 3,
        transparent: true,
        opacity: 0.95,
      })
    );
    // Position: at Sorini's chest/front, roughly where her hands are
    this.axiomOrb.position.set(-3.6, 1.1, 0.4);
    this.scene.add(this.axiomOrb);

    this.axiomLight = new THREE.PointLight(0x88ddff, 4, 5, 2);
    this.axiomLight.position.copy(this.axiomOrb.position);
    this.scene.add(this.axiomLight);
  }

  start() {
    if (this._running) return;
    this._running = true;
    const animate = () => {
      if (!this._running) return;
      requestAnimationFrame(animate);
      this._frames = (this._frames || 0) + 1;   // live-loop diagnostics
      this._time += 0.016;
      if (this.mixer) this.mixer.update(0.016);
      if (this.architectMixer) this.architectMixer.update(0.016);

      // Pulse in the CYAN range — high emissive through ACES tone
      // mapping clamps to white, which made the orb read as a white
      // speck instead of the glowing artifact.
      const pulse = 0.6 + Math.sin(this._time * 2) * 0.4;
      this.axiomOrb.material.emissiveIntensity = 1.1 + pulse * 0.9;
      this.axiomLight.intensity = 3 + pulse * 3;
      this.axiomOrb.rotation.y += 0.01;

      // Gentle camera drift
      this.camera.position.x = Math.sin(this._time * 0.3) * 0.15;

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  // Pause the menu render loop without tearing down GL resources,
  // so the scene can resume later (e.g. after quitting to the menu).
  stop() {
    this._running = false;
  }

  dispose() {
    this._running = false;
    window.removeEventListener('resize', this._onResize);

    [this.sorini, this.architectRoot].forEach((model) => {
      if (!model) return;
      if (model.parent) model.parent.remove(model);   // throne + character
      model.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
    });

    if (this.mixer) this.mixer.stopAllAction();
    if (this.architectMixer) this.architectMixer.stopAllAction();
    this.renderer.dispose();
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }
}