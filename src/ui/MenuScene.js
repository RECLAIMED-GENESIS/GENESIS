// src/ui/MenuScene.js
// Isolated 3D scene for the main menu — Sorini left, Architect right
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

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
    this._running = true;

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
      fbx.position.set(-4.0, -0.13, 0);
      fbx.rotation.y = Math.PI / 2 + 0.3;   // face toward +X, slight turn toward camera
      fbx.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      this.scene.add(fbx);
      this.sorini = fbx;

      // Idle animation
      loader.load('./assets/models/player/Idle.fbx', (animFbx) => {
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
  // ARCHITECT — right side, seated, facing left
  // ─────────────────────────────────────────
  _loadArchitect() {
    const loader = new FBXLoader();
    loader.load('./assets/models/enemy/Dreyar By M.Aure.fbx', (fbx) => {
      fbx.scale.setScalar(0.0025);
      fbx.position.set(4.2, -0.13, 0);
      fbx.rotation.y = -Math.PI / 2 - 0.3;   // face toward -X, slight turn toward camera
      fbx.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      this.scene.add(fbx);
      this.architect = fbx;

      // Sitting pose
      loader.load('./assets/models/enemy/Male Sitting Pose.fbx', (animFbx) => {
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
  // AXIOM ORB — floating in Sorini's hands
  // ─────────────────────────────────────────
  _createAxiomOrb() {
    this.axiomOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18, 0),
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
    const animate = () => {
      if (!this._running) return;
      requestAnimationFrame(animate);
      this._time += 0.016;
      if (this.mixer) this.mixer.update(0.016);
      if (this.architectMixer) this.architectMixer.update(0.016);

      // Orb pulse
      const pulse = 0.6 + Math.sin(this._time * 2) * 0.4;
      this.axiomOrb.material.emissiveIntensity = 2 + pulse * 2;
      this.axiomLight.intensity = 3 + pulse * 3;
      this.axiomOrb.rotation.y += 0.01;

      // Gentle camera drift
      this.camera.position.x = Math.sin(this._time * 0.3) * 0.15;

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  dispose() {
    this._running = false;
    window.removeEventListener('resize', this._onResize);

    [this.sorini, this.architect].forEach((model) => {
      if (!model) return;
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