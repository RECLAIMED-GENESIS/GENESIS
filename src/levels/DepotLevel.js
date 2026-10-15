// ============================================================
// DepotLevel.js — Stakeout mini-level
// ============================================================
import * as THREE from 'three';
import { getCase, SUSPECTS } from '../game/case.js';
import { stakeoutEvidence } from '../game/investigation.js';
import { PhotoCamera } from '../game/photoCamera.js';

const EYE = 1.7;

export class DepotLevel {
  constructor(sceneOrRenderer = null, rendererMaybe = null) {
    this.scene = (sceneOrRenderer && sceneOrRenderer.isScene) ? sceneOrRenderer : new THREE.Scene();
    this.renderer = rendererMaybe || window.__renderer || null;
    this.case = getCase();

    this.name = 'LEVEL 2 — THE DEPOT (STAKEOUT)';
    this.spawn = new THREE.Vector3(0, 0, 30);
    this.spawnYaw = Math.PI;
    this.colliders = [];
    this.level = new THREE.Group();
    this.root = this.level;
    this.scene.add(this.level);

    this.time = 0;
    this.beat = -1;
    this.killerOut = false;
    this.spooked = false;
    this.shots = [];
    this.phase = 'arrival';
    this._o = new THREE.Vector3(); this._d = new THREE.Vector3(0,0,-1);
    this._rc = new THREE.Raycaster();

    this._buildGround();
    this._buildDepot();
    this._buildParkingBays();
    this._buildKillerCar();
    this._buildKillerFigure();
    this._buildHiding();
    this._buildLight();
    this._buildCamera();
    this._buildUI();

    window.__firstPerson = true;
    this._onKey = (e) => {
      if (window.__uiCapture || window.__paused) return;
      if (e.code === 'KeyL' && this.beat >= 3) this._leave();
    };
    window.addEventListener('keydown', this._onKey);

    this._toast('STAKEOUT — 14:00', 'You have the camera. Wait for the car. Photograph everything: their face at arrival, what they carry, and the hand. [Q] raise camera, wheel zoom, click shoot.', 9000);
  }

  getSurfaceHeight() { return 0; }
  groundHeight() { return 0; }
  terrainHeight() { return 0; }

  _box(parent, w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); parent.add(m); return m;
  }

  _buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.level.add(ground);
  }

  _buildDepot() {
    const concrete = new THREE.MeshStandardMaterial({ color: 0x53555a, roughness: 0.9 });
    const rollup = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.6, metalness: 0.5 });

    const body = this._box(this.level, 40, 9, 18, concrete, 0, 4.5, -24);
    body.castShadow = body.receiveShadow = true;
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(-20, 0, -33), new THREE.Vector3(20, 9, -15)));

    for (const dx of [-10, 4]) {
      this._box(this.level, 8, 5.5, 0.4, rollup, dx, 2.75, -15.2);
    }

    const containers = [[-22, 2, 12, 0x8a3a2a], [-22, 2, 4, 0x2a5a8a], [-22, 2, -4, 0x6a6a2a]];
    for (const [cx, cy, cz, col] of containers) {
      const c = this._box(this.level, 3, 2.6, 8,
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 }), cx, cy + 0.1, cz);
      c.castShadow = true;
    }
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(-24, 0, -8), new THREE.Vector3(-20, 3, 16)));

    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.7, metalness: 0.4 });
    for (let z = -14; z <= 14; z += 2.5) {
      this._box(this.level, 0.1, 2.2, 0.1, fenceMat, 22, 1.1, z);
    }
    this._box(this.level, 0.12, 0.12, 28, fenceMat, 22, 2.05, 0);
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(21.9, 0, -14), new THREE.Vector3(22.1, 2.2, 14)));
  }

  _buildParkingBays() {
    const white = new THREE.MeshStandardMaterial({ color: 0xd8d6c8, roughness: 0.85 });
    const count = 10, bw = 3.4, depth = 5.2;
    const x0 = -((count * bw) / 2) + bw / 2;
    for (let i = 0; i <= count; i++) {
      const x = x0 - bw / 2 + i * bw;
      const line = this._box(this.level, 0.12, 0.02, depth, white, x, 0.011, -11.5);
      line.receiveShadow = false;
    }
    this._box(this.level, count * bw, 0.02, 0.12, white, 0, 0.011, -14.1);
    for (let i = 0; i < count; i++) {
      const x = x0 + i * bw;
      const n = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9),
        new THREE.MeshBasicMaterial({ color: 0x8a8880, transparent: true, opacity: 0.5 }));
      n.rotation.x = -Math.PI / 2; n.position.set(x, 0.014, -13.6);
      this.level.add(n);
    }

    this._parkedCar(-14.5, -12.5, 0x4a5058);
    this._parkedCar(8.5, -12.5, 0x3a2a2a);
    this._parkedCar(12, -12.5, 0x2a3a4a);
  }

  _parkedCar(x, z, color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 4.4),
      new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.4 }));
    body.position.y = 0.65; body.castShadow = true; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.3),
      new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.2, metalness: 0.6 }));
    cabin.position.set(0, 1.3, -0.3); g.add(cabin);
    const wheelG = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
    wheelG.rotateZ(Math.PI / 2);
    const wm = new THREE.MeshStandardMaterial({ color: 0x0c0d10 });
    for (const [wx, wz] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) {
      const w = new THREE.Mesh(wheelG, wm); w.position.set(wx, 0.36, wz); g.add(w);
    }
    g.position.set(x, 0, z);
    this.level.add(g);
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(x - 1, 0, z - 2.2), new THREE.Vector3(x + 1, 1.6, z + 2.2)));
  }

  _buildKillerCar() {
    const cfg = this.case.stakeout;
    const bay = parseInt((cfg.bay || 'B5').slice(1), 10) - 1;
    const x = -((10 * 3.4) / 2) + 1.7 + bay * 3.4;
    const z = -12.5;

    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: cfg.car.color, roughness: 0.4, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 4.6), bodyMat);
    body.position.y = 0.68; body.castShadow = true; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.15, metalness: 0.7 }));
    cabin.position.set(0, 1.4, -0.3); g.add(cabin);
    const wheelG = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12);
    wheelG.rotateZ(Math.PI / 2);
    const wm = new THREE.MeshStandardMaterial({ color: 0x0c0d10 });
    for (const [wx, wz] of [[-1.0, 1.6], [1.0, 1.6], [-1.0, -1.6], [1.0, -1.6]]) {
      const w = new THREE.Mesh(wheelG, wm); w.position.set(wx, 0.38, wz); g.add(w);
    }
    g.position.set(x, 0, z);
    g.rotation.y = 0;
    this.level.add(g);
    this.car = g;
    this.carX = x; this.carZ = z;
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(x - 1.1, 0, z - 2.4), new THREE.Vector3(x + 1.1, 1.8, z + 2.4)));

    g.position.set(x, 0, 60);
    this.carStartZ = 60;
  }

  _buildKillerFigure() {
    const s = SUSPECTS[this.case.killerId];
    const skin = new THREE.MeshStandardMaterial({ color: 0x8a6248, roughness: 0.8 });
    const coat = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.85 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.9 });
    const hair = new THREE.MeshStandardMaterial({ color: s.hairName === 'brown' ? 0x4a2c17 : 0x14110f, roughness: 1 });

    const g = new THREE.Group();
    const cyl = (rt, rb, h, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 10), mat);
      m.position.set(x, y, z); g.add(m); return m;
    };
    cyl(0.07, 0.06, 0.85, pants, -0.1, 0.45, 0);
    cyl(0.07, 0.06, 0.85, pants, 0.1, 0.45, 0);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.64, 0.24), coat);
    torso.position.set(0, 1.16, 0); g.add(torso);
    cyl(0.05, 0.045, 0.6, coat, -0.26, 1.12, 0);
    cyl(0.05, 0.045, 0.6, coat, 0.26, 1.12, 0);
    const lh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
    lh.position.set(-0.26, 0.8, 0); g.add(lh);
    const rh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
    rh.position.set(0.26, 0.8, 0); g.add(rh);
    cyl(0.05, 0.06, 0.1, skin, 0, 1.52, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), skin);
    head.position.set(0, 1.66, 0); g.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.126, 14, 10, 0, Math.PI*2, 0, Math.PI*0.55), hair);
    cap.position.set(0, 1.675, -0.008); cap.scale.set(1, 1.05, 1.06); g.add(cap);
    if (s.hairLong) {
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.06), hair);
      back.position.set(0, 1.5, -0.115); g.add(back);
    }
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.07, 10),
      new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 1 }));
    const sgn = this.case.woundHand === 'left' ? -1 : 1;
    wrap.position.set(0.26 * sgn, 0.8, 0.01); g.add(wrap);

    g.position.set(this.carX, 0, this.carZ);
    g.rotation.y = Math.PI;
    g.visible = false;
    this.level.add(g);
    this.killer = g;
    this.killerX = this.carX;
  }

  _buildHiding() {
    const vanMat = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.6, metalness: 0.4 });
    const van = new THREE.Group();
    van.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 6), vanMat));
    van.position.set(-6, 1.1, 18);
    van.castShadow = true;
    this.level.add(van);
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(-7.2, 0, 15), new THREE.Vector3(-4.8, 2.2, 21)));

    const pillar = this._box(this.level, 0.8, 4.5, 0.8,
      new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.85 }), 12, 2.25, 8);
    pillar.castShadow = true;
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(11.5, 0, 7.5), new THREE.Vector3(12.5, 4.5, 8.5)));

    const bushMat = new THREE.MeshStandardMaterial({ color: 0x1e2a1e, roughness: 1 });
    for (let x = -20; x <= -10; x += 2) {
      this._box(this.level, 1.8, 1.2, 1.2, bushMat, x, 0.6, 22);
    }
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(-21, 0, 21), new THREE.Vector3(-9, 1.2, 23)));
  }

  _buildLight() {
    const hemi = new THREE.HemisphereLight(0xc8d8f0, 0x3a3226, 0.8);
    this.level.add(hemi);
    const sun = new THREE.DirectionalLight(0xffc98a, 2.4);
    sun.position.set(60, 60, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 200;
    sun.target.position.set(0, 0, -10);
    this.level.add(sun, sun.target);
    this.level.traverse((o) => { if (o.isMesh && !o.userData.noShadow) o.castShadow = true; });
  }

  _buildCamera() {
    this._ptargets = [{
      id: this.case.killerId, name: SUSPECTS[this.case.killerId].name,
      kind: 'person', radius: 0.5, tag: 'killer',
      getPos: (v) => v.set(this.killer.position.x, 1.5, this.killer.position.z),
    }];
    this.photoCam = new PhotoCamera({
      scene: this.scene,
      renderer: this.renderer,
      getTargets: () => this.killer.visible ? this._ptargets : [],
      getColliders: () => this.colliders,
      isBlocked: () => !!window.__uiCapture,
      clockLabel: () => `14:${String(Math.min(59, Math.floor(this.time))).padStart(2, '0')}`,
      onPhoto: (p) => this._onPhoto(p),
    });
  }

  _onPhoto(photo) {
    const sharp = photo.subjects.filter(s => s.sharp);
    if (!sharp.length) { this._toast('SOFT', 'Centre them in the frame and get closer.', 2600); return; }
    const phase = this.phase;
    this.shots.push({ subject: 'killer', phase, early: !this.spooked });
    this._toast('FILM — ' + this.photoCam.film, `Captured: ${phase}`, 1800);
    if (phase === 'arrival') this.phase = 'carry';
    else if (phase === 'carry') this.phase = 'wound';
    else if (phase === 'wound') this.phase = 'done';
  }

  _buildUI() {
    const mk = (tag, css, html) => {
      const e = document.createElement(tag); e.style.cssText = css;
      if (html !== undefined) e.innerHTML = html;
      document.body.appendChild(e); return e;
    };
    this.ui = {};
    this.ui.hint = mk('div', 'position:fixed;left:18px;bottom:18px;z-index:50;font-family:"Courier New",monospace;font-size:12px;color:#e9d9b0;text-shadow:0 1px 3px #000;pointer-events:none', '[Q] camera · wheel zoom · click shoot · [L] leave');
    this.ui.toast = mk('div', 'position:fixed;left:50%;top:9%;transform:translateX(-50%);z-index:50;width:min(640px,90vw);text-align:center;font-family:"Courier New",monospace;color:#e9d9b0;opacity:0;transition:opacity .4s;pointer-events:none');
  }

  _toast(title, text, ms = 4000) {
    clearTimeout(this._tt);
    this.ui.toast.innerHTML = `<div style="font-size:18px;letter-spacing:3px;color:#f2b84b;margin-bottom:8px">${title}</div><div style="font-size:14px;background:rgba(6,8,12,.8);border:1px solid #2c3440;padding:8px 14px;display:inline-block">${text}</div>`;
    this.ui.toast.style.opacity = 1;
    this._tt = setTimeout(() => { this.ui.toast.style.opacity = 0; }, ms);
  }

  _leave() {
    const ev = stakeoutEvidence(this.shots, this.spooked);
    window.__caseProgress = window.__caseProgress || { l1: {} };
    window.__caseProgress.stakeout = {
      spooked: this.spooked,
      shots: this.shots.slice(),
      evidence: ev.slice(),
    };
    this._toast('STAKE-OUT ENDS', `Evidence logged: ${ev.length ? ev.join(', ') : 'nothing conclusive'}`, 2200);
    setTimeout(() => { if (typeof window.__switchLevel === 'function') window.__switchLevel(3); }, 2300);
  }

  update(dt, t, player) {
    this.time += dt;
    const cam = window.__camera;
    if (cam && player && player.pos) {
      cam.position.set(player.pos.x, (player.pos.y || 0) + EYE, player.pos.z);
      cam.rotation.order = 'YXZ';
      cam.rotation.set(player.pitch || 0, player.yaw || 0, 0);
    }
    if (this.photoCam) this.photoCam.update(dt, this.time);

    if (this.beat < 0 && this.time > 3) { this.beat = 0; this._toast('ENGINE', 'A car is coming up the service road.', 2500); }
    if (this.beat === 0) {
      this.car.position.z += (this.carZ - this.car.position.z) * Math.min(1, dt * 1.2) - (this.car.position.z > this.carZ ? dt * 6 : 0);
      if (Math.abs(this.car.position.z - this.carZ) < 0.4) { this.car.position.z = this.carZ; this.beat = 1; }
    }
    if (this.beat === 1 && this.time > 8) {
      this.beat = 2;
      this.killer.visible = true;
      this.killer.position.set(this.carX + 1.3, 0, this.carZ - 0.8);
      this._toast('PHOTOGRAPH THEM', 'Face at arrival. What they carry. The hand.', 5000);
    }
    if (this.beat === 2 && this.time > 16) { this.beat = 3; this.phase = 'carry'; this._toast('CARRY', 'They are at the trunk.', 2200); }
    if (this.beat === 3 && this.time > 26) { this.beat = 4; this.phase = 'wound'; this._toast('HANDS', 'Watch the hand.', 2200); }

    if (this.killer.visible && player && player.pos) {
      const d = Math.hypot(player.pos.x - this.killer.position.x, player.pos.z - this.killer.position.z);
      this._closeT = (d < 4) ? (this._closeT || 0) + dt : 0;
      if (this._closeT > 1.6 && !this.spooked) {
        this.spooked = true;
        this.beat = Math.max(this.beat, 3);
        this._toast('SPOOKED', 'They are leaving — only what you got before now counts.', 4000);
      }
    }

    if (this.beat >= 3 && this.killer.visible) {
      const tx = this.spooked ? 30 : 4;
      const tz = this.spooked ? 40 : -14.6;
      this.killer.position.x += (tx - this.killer.position.x) * Math.min(1, dt * 0.5);
      this.killer.position.z += (tz - this.killer.position.z) * Math.min(1, dt * 0.5);
      this.killer.rotation.y = Math.atan2(tx - this.killer.position.x, tz - this.killer.position.z);
      if (this.spooked && this.killer.position.x > 25 && this.beat !== 5) {
        this.beat = 5;
        this.killer.visible = false;
        this._toast('GONE', 'They are gone. Leave the depot with what you have.  [L]', 5000);
      }
      if (!this.spooked && Math.abs(this.killer.position.z - tz) < 1.5) {
        this.beat = 5;
        this._toast('MEETING OVER', 'They are inside. Whatever they carried is logged.  [L] to leave.', 6000);
      }
    }
  }

  dispose() {
    clearTimeout(this._tt);
    if (this.photoCam) { this.photoCam.dispose(); this.photoCam = null; }
    window.removeEventListener('keydown', this._onKey);
    window.__firstPerson = false;
    window.__uiCapture = false;
    if (this.ui) { for (const k of Object.keys(this.ui)) this.ui[k].remove(); this.ui = null; }
    if (this.level && this.level.parent) this.level.parent.remove(this.level);
    this.level.traverse((o) => {
      if (o.isMesh) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      }
    });
  }
}
