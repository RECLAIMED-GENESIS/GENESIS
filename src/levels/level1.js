// level1.js
// Level 1: Haru's house — entrance hall, main room, study corner and the
// back garden under the village night sky. All six clues of the case live
// here. Collect every one and the back door opens onto Neon Street.
//
// Layout (x east, z toward the front door):
//   hall   z  1.5 .. 5    delivery slip, first prints
//   main   z -2.5 .. 1.5  stopped clock, two cups, cane prints
//   study  z -5   ..-2.5  desk, hidden compartment, fresh prints
//   garden z -11  ..-5    night sky, fireflies, the way onward

import * as THREE from 'three';
import { mystery } from '../mystery/mystery.js';

const W = 8;
const D = 10;
const H = 2.9;
const WALL_T = 0.2;
const HX = W / 2;
const HZ = D / 2;
const DOOR_X = 1.6;   // back door center
const GAP_L = 1.05;   // back wall opening
const GAP_R = 2.15;

const CLUE_IDS = ['clock', 'slip', 'cups', 'canePrints', 'coffeePrints', 'compartment'];

function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export class HouseLevel {
  constructor(scene) {
    this.scene = scene;
    this.name = "HARU'S HOUSE";
    this.root = new THREE.Group();
    this.colliders = [];
    this.spawn = new THREE.Vector3(0, 0, 4.2);
    this.spawnYaw = Math.PI;
    this._disposables = [];
    this._exitReady = false;
    this._doorAnim = 1;      // 0..1 slide progress, 1 = fully open
    this._doorHomeX = DOOR_X;

    scene.add(this.root);
    scene.background = new THREE.Color(0x0b0e1a);
    scene.fog = new THREE.Fog(0x0b0e1a, 8, 30);

    this._buildRoom();
    this._buildFurniture();
    this._buildGarden();
    this._buildLights();
    this._registerClues();
  }

  getSurfaceHeight() {
    return 0;
  }

  _track(obj) {
    this._disposables.push(obj);
    return obj;
  }

  // ---------- textures ----------
  _tatamiTexture(repeatX, repeatY) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#b9a773';
    g.fillRect(0, 0, 128, 256);
    for (let y = 0; y < 256; y += 3) {
      g.fillStyle = y % 6 === 0 ? 'rgba(90,80,40,0.10)' : 'rgba(255,245,200,0.07)';
      g.fillRect(0, y, 128, 1);
    }
    g.strokeStyle = '#2f2f1c';
    g.lineWidth = 5;
    g.strokeRect(2, 2, 124, 252);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.colorSpace = THREE.SRGBColorSpace;
    return this._track(tex);
  }

  _woodTexture(base, seam, seed, repeatX, repeatY) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    const r = rng(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 32) {
      g.fillStyle = 'rgba(0,0,0,' + (0.05 + r() * 0.08).toFixed(2) + ')';
      g.fillRect(0, y, 128, 32);
      g.fillStyle = seam;
      g.fillRect(0, y, 128, 2);
      for (let i = 0; i < 5; i++) {
        g.fillStyle = 'rgba(255,235,200,' + (0.02 + r() * 0.04).toFixed(2) + ')';
        g.fillRect(0, y + 4 + r() * 26, 128, 1);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.colorSpace = THREE.SRGBColorSpace;
    return this._track(tex);
  }

  _grassTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    const r = rng(77);
    g.fillStyle = '#1c2b17';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(60,90,45,0.5)' : 'rgba(10,18,8,0.6)';
      g.fillRect(r() * 128, r() * 128, 2, 2 + r() * 3);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 4);
    tex.colorSpace = THREE.SRGBColorSpace;
    return this._track(tex);
  }

  // Footprint trail texture. Canvas top = behind the walker, so toes are
  // drawn at the bottom of each print, pointing along the trail.
  _printTexture(fresh, cane) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    const g = c.getContext('2d');
    const col = fresh ? 'rgba(36,28,22,0.95)' : 'rgba(76,64,45,0.72)';
    for (let i = 0; i < 3; i++) {
      const y = 30 + i * 78;
      const x = 64 + (i % 2 === 0 ? -16 : 16);
      g.fillStyle = col;
      g.beginPath(); g.ellipse(x, y + 8, 13, 17, 0, 0, Math.PI * 2); g.fill();
      for (let t = -1; t <= 1; t++) {
        g.beginPath(); g.ellipse(x + t * 11, y + 27, 5.5, 8, t * 0.25, 0, Math.PI * 2); g.fill();
      }
      if (fresh) {
        g.fillStyle = 'rgba(62,44,26,0.85)';
        for (let s = 0; s < 14; s++) {
          g.fillRect(x - 22 + Math.random() * 44, y - 10 + Math.random() * 52, 2, 2);
        }
      }
      if (cane) {
        g.fillStyle = 'rgba(52,44,30,0.85)';
        g.beginPath();
        g.arc(x + (i % 2 === 0 ? 28 : -28), y + 12, 5, 0, Math.PI * 2);
        g.fill();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return this._track(tex);
  }

  _clockTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#e8dfc8';
    g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2b2118';
    g.lineWidth = 5;
    g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x1 = 64 + Math.sin(a) * 50, y1 = 64 - Math.cos(a) * 50;
      const x2 = 64 + Math.sin(a) * 56, y2 = 64 - Math.cos(a) * 56;
      g.lineWidth = i % 3 === 0 ? 4 : 2;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    const hand = (deg, len, wdt, color) => {
      const a = (deg / 180) * Math.PI;
      g.strokeStyle = color;
      g.lineWidth = wdt;
      g.beginPath();
      g.moveTo(64 - Math.sin(a) * len * 0.2, 64 + Math.cos(a) * len * 0.2);
      g.lineTo(64 + Math.sin(a) * len, 64 - Math.cos(a) * len);
      g.stroke();
    };
    hand(185, 26, 5, '#2b2118');   // hour — just past six
    hand(60, 40, 3.5, '#2b2118');  // minute — on the two
    hand(305, 44, 1.5, '#8f1d17'); // second hand, frozen
    g.fillStyle = '#8f1d17';
    g.beginPath(); g.arc(64, 64, 4, 0, Math.PI * 2); g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return this._track(tex);
  }

  _slipTexture() {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#efe8d2';
    g.fillRect(0, 0, 96, 128);
    g.strokeStyle = '#b8ad8e';
    g.lineWidth = 2;
    g.strokeRect(4, 4, 88, 120);
    g.strokeStyle = '#4a4033';
    g.lineWidth = 2;
    for (let y = 24; y < 84; y += 12) {
      g.beginPath();
      g.moveTo(12, y);
      g.bezierCurveTo(30, y - 3, 50, y + 3, 84, y - 1);
      g.stroke();
    }
    g.font = 'bold 15px Georgia, serif';
    g.fillStyle = '#6b1410';
    g.fillText('5:40', 14, 102);
    g.strokeStyle = '#23304d';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(48, 104);
    g.bezierCurveTo(56, 92, 62, 112, 70, 100);
    g.bezierCurveTo(76, 92, 80, 106, 88, 98);
    g.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return this._track(tex);
  }

  _beanTexture() {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = '#d9c9a4';
    g.fillRect(0, 0, 96, 96);
    g.fillStyle = '#b39a6e';
    g.fillRect(0, 66, 96, 30);
    g.fillStyle = '#8f1d17';
    g.beginPath(); g.arc(48, 38, 20, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f3e6c8';
    g.font = 'bold 11px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('EMBER', 48, 35);
    g.font = '8px Georgia, serif';
    g.fillText('CAFE', 48, 46);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return this._track(tex);
  }

  _scrollTexture() {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#e6dec6';
    g.fillRect(0, 0, 96, 256);
    g.fillStyle = '#3a3128';
    g.beginPath();
    g.moveTo(48, 40);
    g.bezierCurveTo(20, 80, 76, 110, 48, 150);
    g.bezierCurveTo(30, 175, 60, 195, 48, 215);
    g.lineWidth = 7;
    g.strokeStyle = '#3a3128';
    g.stroke();
    g.fillStyle = '#b3261e';
    g.fillRect(62, 220, 18, 18);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return this._track(tex);
  }

  _shojiTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 192;
    const g = c.getContext('2d');
    g.fillStyle = '#d8cfae';
    g.fillRect(0, 0, 128, 192);
    g.fillStyle = 'rgba(120,95,60,0.35)';
    for (let x = 0; x <= 128; x += 32) g.fillRect(x - 1, 0, 2, 192);
    for (let y = 0; y <= 192; y += 32) g.fillRect(0, y - 1, 128, 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return this._track(tex);
  }

  _glowSpriteTexture() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,230,1)');
    grad.addColorStop(0.4, 'rgba(230,255,160,0.5)');
    grad.addColorStop(1, 'rgba(230,255,160,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return this._track(tex);
  }

  // ---------- small builders ----------
  _box(w, h, d, x, y, z, material, collide) {
    const geo = this._track(new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    if (collide) {
      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
        new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2)
      ));
    }
    return mesh;
  }

  _hitbox(w, h, d, x, y, z) {
    const mesh = new THREE.Mesh(
      this._track(new THREE.BoxGeometry(w, h, d)),
      this._track(new THREE.MeshBasicMaterial({ visible: false }))
    );
    mesh.position.set(x, y, z);
    mesh.userData.hitbox = true;
    return mesh;
  }

  _cyl(rTop, rBot, h, x, y, z, material, collide, r) {
    const geo = this._track(new THREE.CylinderGeometry(rTop, rBot, h, r || 14));
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    if (collide) {
      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(x - rBot, y - h / 2, z - rBot),
        new THREE.Vector3(x + rBot, y + h / 2, z + rBot)
      ));
    }
    return mesh;
  }

  _printTrail(points, fresh, cane) {
    const group = new THREE.Group();
    const tex = this._printTexture(fresh, cane);
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, z1] = points[i];
      const [x2, z2] = points[i + 1];
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz) + 0.35;
      const geo = this._track(new THREE.PlaneGeometry(0.62, len));
      const mat = this._track(new THREE.MeshStandardMaterial({
        map: tex, transparent: true, roughness: 1, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2,
      }));
      const m = new THREE.Mesh(geo, mat);
      m.rotation.order = 'YXZ';
      m.rotation.y = Math.atan2(dx, dz);
      m.rotation.x = -Math.PI / 2;
      m.position.set((x1 + x2) / 2, 0.012, (z1 + z2) / 2);
      m.receiveShadow = true;
      group.add(m);
    }
    this.root.add(group);
    return group;
  }

  // ---------- room shell ----------
  _buildRoom() {
    const wood = this._track(new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.8 }));
    const woodLight = this._track(new THREE.MeshStandardMaterial({ color: 0x6b4e32, roughness: 0.85 }));
    const plaster = this._track(new THREE.MeshStandardMaterial({ color: 0xcbbfa6, roughness: 0.95 }));

    // floors: hall (dark wood), main (tatami), study (lighter wood)
    const hallFloor = new THREE.Mesh(
      this._track(new THREE.PlaneGeometry(W, 3.5)),
      this._track(new THREE.MeshStandardMaterial({
        map: this._woodTexture('#3a281a', '#241708', 31, 4, 2), roughness: 0.9,
      }))
    );
    hallFloor.rotation.x = -Math.PI / 2;
    hallFloor.position.set(0, 0, 3.25);
    hallFloor.receiveShadow = true;
    this.root.add(hallFloor);

    const mainFloor = new THREE.Mesh(
      this._track(new THREE.PlaneGeometry(W, 4)),
      this._track(new THREE.MeshStandardMaterial({
        map: this._tatamiTexture(W, 2), roughness: 0.95,
      }))
    );
    mainFloor.rotation.x = -Math.PI / 2;
    mainFloor.position.set(0, 0, -0.5);
    mainFloor.receiveShadow = true;
    this.root.add(mainFloor);

    const studyFloor = new THREE.Mesh(
      this._track(new THREE.PlaneGeometry(W, 2.5)),
      this._track(new THREE.MeshStandardMaterial({
        map: this._woodTexture('#4d3826', '#332415', 47, 4, 1.4), roughness: 0.9,
      }))
    );
    studyFloor.rotation.x = -Math.PI / 2;
    studyFloor.position.set(0, 0, -3.75);
    studyFloor.receiveShadow = true;
    this.root.add(studyFloor);

    // ceiling and beams
    const ceiling = new THREE.Mesh(
      this._track(new THREE.PlaneGeometry(W, D)),
      this._track(new THREE.MeshStandardMaterial({ color: 0x33261a, roughness: 0.9 }))
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = H;
    this.root.add(ceiling);
    for (const z of [-3.5, -1, 1.5, 4]) {
      this._box(W, 0.16, 0.2, 0, H - 0.08, z, wood, false);
    }

    // walls — the back wall is split around the door opening
    const wy = H / 2;
    this._box(W + WALL_T * 2, H, WALL_T, 0, wy, HZ + WALL_T / 2, plaster, true);
    this._box(WALL_T, H, D, -HX - WALL_T / 2, wy, 0, plaster, true);
    this._box(WALL_T, H, D, HX + WALL_T / 2, wy, 0, plaster, true);
    const backL = GAP_L + HX + WALL_T;
    this._box(backL, H, WALL_T, (-HX - WALL_T + GAP_L) / 2, wy, -HZ - WALL_T / 2, plaster, true);
    const backR = HX + WALL_T - GAP_R;
    this._box(backR, H, WALL_T, (GAP_R + HX + WALL_T) / 2, wy, -HZ - WALL_T / 2, plaster, true);
    // lintel and door frame posts
    this._box(GAP_R - GAP_L + 0.24, H - 2.05, WALL_T, DOOR_X, (2.05 + H) / 2, -HZ - WALL_T / 2, plaster, false);
    this._box(0.12, 2.05, 0.26, GAP_L - 0.06, 1.025, -HZ, wood, false);
    this._box(0.12, 2.05, 0.26, GAP_R + 0.06, 1.025, -HZ, wood, false);
    this._box(GAP_R - GAP_L + 0.24, 0.1, 0.26, DOOR_X, 2.1, -HZ, wood, false);

    // front door (decorative — the player starts inside)
    const doorMat = this._track(new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.7 }));
    this._box(1.24, 2.1, 0.08, 0, 1.05, HZ - 0.06, doorMat, false);
    this._box(1.4, 0.12, 0.14, 0, 2.16, HZ - 0.08, wood, false);

    // baseboards
    const bb = this._track(new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.8 }));
    this._box(W, 0.12, 0.03, 0, 0.06, HZ - 0.01, bb, false);
    this._box(0.03, 0.12, D, -HX + 0.01, 0.06, 0, bb, false);
    this._box(0.03, 0.12, D, HX - 0.01, 0.06, 0, bb, false);
    this._box(GAP_L + HX, 0.12, 0.03, (GAP_L - HX) / 2, 0.06, -HZ + 0.01, bb, false);
    this._box(HX - GAP_R, 0.12, 0.03, (HX + GAP_R) / 2, 0.06, -HZ + 0.01, bb, false);

    // shoji frame between hall and main room (open center)
    this._box(W, 0.28, 0.18, 0, 2.06, 1.5, wood, false);
    this._box(0.14, 2.2, 0.14, -1.5, 1.1, 1.5, wood, false);
    this._box(0.14, 2.2, 0.14, 1.5, 1.1, 1.5, wood, false);
    const shojiMat = this._track(new THREE.MeshStandardMaterial({
      map: this._shojiTexture(), roughness: 1,
    }));
    for (const sx of [-2.55, 2.55]) {
      const panel = new THREE.Mesh(this._track(new THREE.PlaneGeometry(1.9, 1.9)), shojiMat);
      panel.position.set(sx, 0.98, 1.46);
      panel.receiveShadow = true;
      this.root.add(panel);
      this._box(1.9, 0.06, 0.05, sx, 1.95, 1.47, wood, false);
      this._box(1.9, 0.06, 0.05, sx, 0.03, 1.47, wood, false);
    }

    // main/study divider: threshold + posts + a tall shelf on the west side
    this._box(W, 0.04, 0.18, 0, 0.02, -2.5, woodLight, false);
    this._box(0.14, H, 0.14, 2.7, H / 2, -2.5, wood, false);
    this._box(1.3, 1.9, 0.34, -3.35, 0.95, -2.5, wood, true);
    this._box(1.34, 0.05, 0.38, -3.35, 0.62, -2.5, woodLight, false);
    this._box(1.34, 0.05, 0.38, -3.35, 1.25, -2.5, woodLight, false);

    // window, main room east wall — paper panes with a night glow
    const paperGlow = this._track(new THREE.MeshStandardMaterial({
      color: 0x8fa6d8, emissive: 0x2c3f78, emissiveIntensity: 0.9, roughness: 1,
    }));
    const win = new THREE.Mesh(this._track(new THREE.PlaneGeometry(2.3, 1.25)), paperGlow);
    win.position.set(HX - 0.01, 1.6, -0.9);
    win.rotation.y = -Math.PI / 2;
    this.root.add(win);
    this._box(0.06, 1.35, 2.4, HX - 0.03, 1.6, -0.9, wood, false);
    for (const dz of [-0.77, 0, 0.77]) {
      this._box(0.05, 1.25, 0.05, HX - 0.05, 1.6, -0.9 + dz, wood, false);
    }
    this._box(0.05, 0.05, 2.3, HX - 0.05, 1.6, -0.9, wood, false);

    // small window, study west wall
    const win2 = new THREE.Mesh(this._track(new THREE.PlaneGeometry(1.5, 0.95)), paperGlow);
    win2.position.set(-HX + 0.01, 1.7, -3.6);
    win2.rotation.y = Math.PI / 2;
    this.root.add(win2);
    this._box(0.06, 1.05, 1.6, -HX + 0.03, 1.7, -3.6, wood, false);
    this._box(0.05, 0.05, 1.5, -HX + 0.05, 1.7, -3.6, wood, false);

    // hanging paper lantern over the main room
    const shadeMat = this._track(new THREE.MeshStandardMaterial({
      color: 0xffe2b0, emissive: 0xffb070, emissiveIntensity: 0.9, roughness: 0.9,
    }));
    const cord = this._cyl(0.006, 0.006, 0.55, 0, H - 0.27, -0.4, wood, false, 6);
    cord.castShadow = false;
    const shade = this._cyl(0.2, 0.24, 0.3, 0, H - 0.7, -0.4, shadeMat, false, 16);
    shade.castShadow = false;
  }

  // ---------- furniture and props ----------
  _buildFurniture() {
    const lacquer = this._track(new THREE.MeshStandardMaterial({ color: 0x2b1c14, roughness: 0.4 }));
    const cloth = this._track(new THREE.MeshStandardMaterial({ color: 0x6b2630, roughness: 0.9 }));
    const wood = this._track(new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.8 }));
    const paper = this._track(new THREE.MeshStandardMaterial({ color: 0xe8dfc8, roughness: 0.95 }));
    const ceramic = this._track(new THREE.MeshStandardMaterial({ color: 0xdcd6c8, roughness: 0.5 }));

    // -- hall: console table with the delivery slip --
    this._box(1.3, 0.06, 0.5, 3.35, 0.85, 3.6, lacquer, false);
    for (const [lx, lz] of [[-0.55, -0.15], [0.55, -0.15], [-0.55, 0.15], [0.55, 0.15]]) {
      this._box(0.06, 0.82, 0.06, 3.35 + lx, 0.41, 3.6 + lz, lacquer, false);
    }
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(2.65, 0, 3.3), new THREE.Vector3(4.05, 0.95, 3.9)
    ));
    // shoe bench
    this._box(1.4, 0.32, 0.4, -3.3, 0.16, 3.9, wood, true);

    this._slip = new THREE.Mesh(
      this._track(new THREE.PlaneGeometry(0.24, 0.34)),
      this._track(new THREE.MeshStandardMaterial({ map: this._slipTexture(), roughness: 0.9 }))
    );
    this._slip.rotation.order = 'YXZ';
    this._slip.rotation.x = -Math.PI / 2;
    this._slip.rotation.z = 0.5;
    this._slip.position.set(3.35, 0.89, 3.6);
    this._slip.receiveShadow = true;
    this.root.add(this._slip);

    // -- main room: low table, cushions, the two cups --
    this._box(1.4, 0.06, 0.8, 0, 0.38, -0.4, lacquer, false);
    for (const [lx, lz] of [[-0.6, -0.72], [0.6, -0.72], [-0.6, -0.08], [0.6, -0.08]]) {
      this._box(0.06, 0.35, 0.06, lx, 0.175, lz, lacquer, false);
    }
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(-0.75, 0, -0.85), new THREE.Vector3(0.75, 0.45, 0.05)
    ));
    const cushionGeo = this._track(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 20));
    for (const [cx, cz] of [[0, 0.45], [0, -1.25]]) {
      const c = new THREE.Mesh(cushionGeo, cloth);
      c.position.set(cx, 0.04, cz);
      c.castShadow = true;
      c.receiveShadow = true;
      this.root.add(c);
    }

    this._cupsGroup = new THREE.Group();
    const cupGeo = this._track(new THREE.CylinderGeometry(0.07, 0.055, 0.09, 14));
    const cup1 = new THREE.Mesh(cupGeo, ceramic);
    cup1.position.set(-0.3, 0.46, -0.28);
    const coffee = new THREE.Mesh(
      this._track(new THREE.CircleGeometry(0.058, 14)),
      this._track(new THREE.MeshStandardMaterial({ color: 0x1d1208, roughness: 0.3 }))
    );
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.set(-0.3, 0.5, -0.28);
    const cup2 = new THREE.Mesh(cupGeo, ceramic);
    cup2.position.set(0.26, 0.46, -0.58);
    const bag = new THREE.Mesh(
      this._track(new THREE.CylinderGeometry(0.075, 0.09, 0.15, 12)),
      this._track(new THREE.MeshStandardMaterial({ map: this._beanTexture(), roughness: 0.85 }))
    );
    bag.position.set(0.02, 0.48, -0.02);
    for (const m of [cup1, cup2, bag]) { m.castShadow = true; m.receiveShadow = true; }
    this._cupsGroup.add(cup1, coffee, cup2, bag);
    this._cupsGroup.add(this._hitbox(1.0, 0.4, 0.8, 0, 0.5, -0.35));
    this.root.add(this._cupsGroup);

    // -- main room west wall: the stopped clock --
    this._clock = new THREE.Group();
    const rim = new THREE.Mesh(
      this._track(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 24)),
      lacquer
    );
    rim.rotation.z = Math.PI / 2;
    const face = new THREE.Mesh(
      this._track(new THREE.CircleGeometry(0.27, 24)),
      this._track(new THREE.MeshStandardMaterial({ map: this._clockTexture(), roughness: 0.8 }))
    );
    face.rotation.y = Math.PI / 2;
    face.position.x = 0.028;
    this._clock.add(rim, face);
    this._clock.add(this._hitbox(0.6, 0.7, 0.7, 0, 0, 0));
    this._clock.position.set(-HX + 0.06, 1.95, -0.6);
    this.root.add(this._clock);

    // ink scroll between clock and window
    const scroll = new THREE.Mesh(
      this._track(new THREE.PlaneGeometry(0.5, 1.3)),
      this._track(new THREE.MeshStandardMaterial({ map: this._scrollTexture(), roughness: 1 }))
    );
    scroll.position.set(-HX + 0.02, 1.6, 0.9);
    scroll.rotation.y = Math.PI / 2;
    this.root.add(scroll);
    this._box(0.03, 0.06, 0.56, -HX + 0.02, 2.29, 0.9, lacquer, false);
    this._box(0.03, 0.06, 0.56, -HX + 0.02, 0.91, 0.9, lacquer, false);

    // books on the divider shelf
    const r = rng(9);
    const bookColors = [0x6b3a2a, 0x3a5a6b, 0x777750, 0x54321f, 0x7a4a3a, 0x44503a];
    for (const shelfY of [0.65, 1.28]) {
      let bx = -3.9;
      while (bx < -2.85) {
        const bw = 0.05 + r() * 0.04;
        const bh = 0.26 + r() * 0.12;
        this._box(bw, bh, 0.24, bx + bw / 2, shelfY + bh / 2, -2.5,
          this._track(new THREE.MeshStandardMaterial({ color: bookColors[Math.floor(r() * 6)], roughness: 0.9 })), false);
        bx += bw + 0.012;
      }
    }

    // -- study corner: desk against the north wall --
    this._box(1.8, 0.06, 0.75, -1.2, 0.72, -4.55, lacquer, false);
    for (const [lx, lz] of [[-0.82, -0.28], [0.82, -0.28], [-0.82, 0.28], [0.82, 0.28]]) {
      this._box(0.07, 0.69, 0.07, -1.2 + lx, 0.345, -4.55 + lz, lacquer, false);
    }
    this._box(0.5, 0.3, 0.68, -0.75, 0.54, -4.55, wood, false); // drawer block
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(-2.15, 0, -4.95), new THREE.Vector3(-0.25, 0.78, -4.15)
    ));
    const deskCushion = new THREE.Mesh(cushionGeo, cloth);
    deskCushion.position.set(-1.2, 0.04, -3.85);
    deskCushion.castShadow = true;
    deskCushion.receiveShadow = true;
    this.root.add(deskCushion);

    // papers on the desk
    for (const [px, pz, rot] of [[-1.5, -4.5, 0.3], [-1.05, -4.62, -0.35]]) {
      const p = new THREE.Mesh(
        this._track(new THREE.PlaneGeometry(0.26, 0.36)),
        paper
      );
      p.rotation.order = 'YXZ';
      p.rotation.x = -Math.PI / 2;
      p.rotation.z = rot;
      p.position.set(px, 0.758, pz);
      this.root.add(p);
    }

    // desk lamp
    this._cyl(0.02, 0.06, 0.35, -1.95, 0.93, -4.7, lacquer, false, 10);
    const lampShade = this._cyl(0.09, 0.13, 0.14, -1.95, 1.15, -4.7,
      this._track(new THREE.MeshStandardMaterial({
        color: 0xffe2b0, emissive: 0xffc080, emissiveIntensity: 0.8, roughness: 0.9,
      })), false, 12);
    lampShade.castShadow = false;

    // -- hidden compartment under the tatami --
    this._compartmentGroup = new THREE.Group();
    const pitMat = this._track(new THREE.MeshStandardMaterial({ color: 0x070503, roughness: 1 }));
    const pitBottom = new THREE.Mesh(this._track(new THREE.BoxGeometry(0.86, 0.02, 0.86)), pitMat);
    pitBottom.position.set(1.6, -0.02, -3.9);
    this._compartmentGroup.add(pitBottom);
    for (const [w, d, px, pz] of [
      [0.86, 0.03, 0, -0.415], [0.86, 0.03, 0, 0.415], [0.03, 0.8, -0.415, 0], [0.03, 0.8, 0.415, 0],
    ]) {
      const wall = new THREE.Mesh(this._track(new THREE.BoxGeometry(w, 0.24, d)), pitMat);
      wall.position.set(1.6 + px, -0.12, -3.9 + pz);
      this._compartmentGroup.add(wall);
    }
    // frame around the opening
    for (const [w, d, px, pz] of [
      [1.04, 0.08, 0, -0.5], [1.04, 0.08, 0, 0.5], [0.08, 0.92, -0.5, 0], [0.08, 0.92, 0.5, 0],
    ]) {
      const f = new THREE.Mesh(this._track(new THREE.BoxGeometry(w, 0.035, d)), wood);
      f.position.set(1.6 + px, 0.017, -3.9 + pz);
      f.receiveShadow = true;
      this._compartmentGroup.add(f);
    }
    // the mat, flipped open against the floor
    const mat = new THREE.Mesh(
      this._track(new THREE.BoxGeometry(0.88, 0.035, 0.88)),
      this._track(new THREE.MeshStandardMaterial({
        map: this._tatamiTexture(1, 1), roughness: 0.95,
      }))
    );
    mat.rotation.x = -1.15;
    mat.position.set(1.6, 0.16, -4.45);
    mat.castShadow = true;
    mat.receiveShadow = true;
    this._compartmentGroup.add(mat);
    this._compartmentGroup.add(this._hitbox(1.5, 0.8, 1.5, 1.6, 0.3, -4.05));
    this.root.add(this._compartmentGroup);
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(1.1, 0, -4.35), new THREE.Vector3(2.1, 0.35, -3.45)
    ));

    // a crate in the corner
    this._box(0.55, 0.55, 0.55, 3.3, 0.275, -4.4, wood, true);
    this._box(0.57, 0.06, 0.57, 3.3, 0.56, -4.4, wood, false);

    // -- back door: closed panel + collider until the case is made --
    this._doorPanel = this._box(GAP_R - GAP_L - 0.06, 2.0, 0.07, DOOR_X, 1.0, -HZ + 0.05,
      this._track(new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.7 })), false);
    const doorPaper = new THREE.Mesh(
      this._track(new THREE.PlaneGeometry(0.6, 1.5)),
      this._track(new THREE.MeshStandardMaterial({ map: this._shojiTexture(), roughness: 1 }))
    );
    doorPaper.position.set(0, 0.1, 0.041);
    this._doorPanel.add(doorPaper);
    this._doorCollider = new THREE.Box3(
      new THREE.Vector3(GAP_L, 0, -HZ - 0.15), new THREE.Vector3(GAP_R, 2.05, -HZ + 0.15)
    );
    this.colliders.push(this._doorCollider);

    // teal glow waiting behind the door, revealed on unlock
    this._doorGlow = new THREE.Mesh(
      this._track(new THREE.PlaneGeometry(GAP_R - GAP_L, 2.0)),
      this._track(new THREE.MeshBasicMaterial({
        color: 0x7ff5e0, transparent: true, opacity: 0, fog: false,
      }))
    );
    this._doorGlow.position.set(DOOR_X, 1.0, -HZ - 0.35);
    this.root.add(this._doorGlow);
    this._doorLight = new THREE.PointLight(0x7ff5e0, 0, 7, 2);
    this._doorLight.position.set(DOOR_X, 1.2, -HZ - 0.6);
    this.root.add(this._doorLight);

    // -- footprint trails (both are clues) --
    this._caneGroup = this._printTrail(
      [[0.45, 3.1], [0.25, 2.2], [0.05, 1.3], [-0.12, 0.55]], false, true
    );
    this._caneGroup.add(this._hitbox(1.6, 0.5, 3.4, 0.18, 0.25, 1.85));

    this._coffeeGroup = this._printTrail(
      [[0.35, -1.1], [0.7, -1.9], [1.15, -2.7], [1.55, -3.35], [1.62, -4.15], [1.6, -4.85]],
      true, false
    );
    this._coffeeGroup.add(this._hitbox(2.2, 0.5, 4.6, 1.0, 0.25, -2.9));
  }

  // ---------- garden ----------
  _buildGarden() {
    const grass = new THREE.Mesh(
      this._track(new THREE.PlaneGeometry(10.4, 6.6)),
      this._track(new THREE.MeshStandardMaterial({ map: this._grassTexture(), roughness: 1 }))
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, -0.005, -8.5);
    grass.receiveShadow = true;
    this.root.add(grass);

    const stone = this._track(new THREE.MeshStandardMaterial({ color: 0x5d5d58, roughness: 0.95 }));
    const stones = [[1.6, -5.7], [1.45, -6.5], [1.15, -7.3], [0.9, -8.1], [0.75, -8.9]];
    for (const [sx, sz] of stones) {
      const s = this._cyl(0.28, 0.3, 0.05, sx, 0.025, sz, stone, false, 9);
      s.scale.x = 1.15;
    }

    // fence with colliders
    const fenceMat = this._track(new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: 0.9 }));
    const fence = (x1, z1, x2, z2) => {
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const n = Math.max(2, Math.round(len / 1.15));
      for (let i = 0; i <= n; i++) {
        const px = x1 + (dx * i) / n, pz = z1 + (dz * i) / n;
        this._box(0.09, 1.15, 0.09, px, 0.575, pz, fenceMat, false);
      }
      const rail = new THREE.Mesh(this._track(new THREE.BoxGeometry(len, 0.07, 0.05)), fenceMat);
      rail.position.set((x1 + x2) / 2, 0.95, (z1 + z2) / 2);
      rail.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
      rail.castShadow = true;
      this.root.add(rail);
      const rail2 = rail.clone();
      rail2.position.y = 0.45;
      this.root.add(rail2);
      const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
      const t = 0.12;
      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(cx - Math.abs(dx) / 2 - t, 0, cz - Math.abs(dz) / 2 - t),
        new THREE.Vector3(cx + Math.abs(dx) / 2 + t, 1.2, cz + Math.abs(dz) / 2 + t)
      ));
    };
    fence(-4.4, -5.3, -4.4, -11.2);
    fence(4.4, -5.3, 4.4, -11.2);
    fence(-4.4, -11.2, 4.4, -11.2);

    // trees and bushes
    const trunkMat = this._track(new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.95 }));
    const leafMat = this._track(new THREE.MeshStandardMaterial({
      color: 0x16281a, roughness: 1, flatShading: true,
    }));
    const tree = (x, z, s) => {
      this._cyl(0.1 * s, 0.14 * s, 1.7 * s, x, 0.85 * s, z, trunkMat, true, 8);
      for (const [ox, oy, oz, r] of [[0, 1.9, 0, 0.85], [0.5, 1.5, 0.2, 0.55], [-0.45, 1.55, -0.15, 0.5]]) {
        const c = new THREE.Mesh(this._track(new THREE.IcosahedronGeometry(r * s, 0)), leafMat);
        c.position.set(x + ox * s, oy * s, z + oz * s);
        c.castShadow = true;
        this.root.add(c);
      }
    };
    tree(-2.8, -9.6, 1.1);
    tree(3.1, -9.2, 0.9);
    for (const [bx, bz] of [[-3.6, -6.2], [3.6, -6.6], [-1.6, -10.4], [2.4, -10.6]]) {
      const b = new THREE.Mesh(this._track(new THREE.IcosahedronGeometry(0.42, 0)), leafMat);
      b.position.set(bx, 0.3, bz);
      b.scale.y = 0.7;
      b.castShadow = true;
      this.root.add(b);
    }

    // stone lantern
    const stoneMat = this._track(new THREE.MeshStandardMaterial({ color: 0x565650, roughness: 0.95 }));
    this._box(0.34, 0.22, 0.34, -0.9, 0.11, -6.3, stoneMat, true);
    this._cyl(0.07, 0.09, 0.5, -0.9, 0.47, -6.3, stoneMat, false, 8);
    const lampBox = this._box(0.24, 0.2, 0.24, -0.9, 0.82, -6.3,
      this._track(new THREE.MeshStandardMaterial({
        color: 0xffe2b0, emissive: 0xffcf7a, emissiveIntensity: 1.3, roughness: 0.9,
      })), false);
    lampBox.castShadow = false;
    const roof = new THREE.Mesh(this._track(new THREE.ConeGeometry(0.3, 0.2, 4)), stoneMat);
    roof.position.set(-0.9, 1.02, -6.3);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    this.root.add(roof);

    // distant village and mountains beyond the fence
    const farMat = this._track(new THREE.MeshBasicMaterial({ color: 0x0c1424, fog: false }));
    for (const [mx, mz, mr, mh] of [[-18, -30, 11, 9], [16, -36, 15, 11]]) {
      const m = new THREE.Mesh(this._track(new THREE.ConeGeometry(mr, mh, 5)), farMat);
      m.position.set(mx, mh / 2 - 0.5, mz);
      this.root.add(m);
    }
    const houseMat = this._track(new THREE.MeshBasicMaterial({ color: 0x0a0f18, fog: false }));
    const winMat = this._track(new THREE.MeshBasicMaterial({ color: 0xffcf7a, fog: false }));
    for (const [hx, hz] of [[-7, -16], [6.5, -17], [-2, -19]]) {
      const h = new THREE.Mesh(this._track(new THREE.BoxGeometry(1.4, 1.1, 1.2)), houseMat);
      h.position.set(hx, 0.55, hz);
      this.root.add(h);
      const w = new THREE.Mesh(this._track(new THREE.PlaneGeometry(0.22, 0.22)), winMat);
      w.position.set(hx, 0.55, hz + 0.61);
      this.root.add(w);
    }

    // night sky dome
    const skyMat = this._track(new THREE.ShaderMaterial({
      uniforms: {
        uHorizon: { value: new THREE.Color(0x1a2f4a) },
        uZenith: { value: new THREE.Color(0x05070f) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uHorizon;
        uniform vec3 uZenith;
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y;
          vec3 col = mix(uHorizon, uZenith, smoothstep(-0.05, 0.5, h));
          col += vec3(0.05, 0.10, 0.12) * (1.0 - smoothstep(0.0, 0.18, abs(h - 0.02)));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }));
    const sky = new THREE.Mesh(this._track(new THREE.SphereGeometry(60, 24, 16)), skyMat);
    sky.position.set(0, 0, -8);
    sky.renderOrder = -10;
    this.root.add(sky);

    // stars
    const sr = rng(1234);
    const starPos = new Float32Array(420 * 3);
    for (let i = 0; i < 420; i++) {
      const a = sr() * Math.PI * 2;
      const y = 0.08 + sr() * 0.9;
      const rr = Math.sqrt(Math.max(0, 1 - y * y)) * 56;
      starPos[i * 3] = Math.cos(a) * rr;
      starPos[i * 3 + 1] = y * 56;
      starPos[i * 3 + 2] = Math.sin(a) * rr - 8;
    }
    const starGeo = this._track(new THREE.BufferGeometry());
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = this._track(new THREE.PointsMaterial({
      color: 0xffffff, size: 1.5, sizeAttenuation: false,
      transparent: true, opacity: 0.85, fog: false, depthWrite: false,
    }));
    this.root.add(new THREE.Points(starGeo, starMat));

    // moon
    const moon = new THREE.Mesh(
      this._track(new THREE.CircleGeometry(2.6, 32)),
      this._track(new THREE.MeshBasicMaterial({ color: 0xf5ecd0, fog: false }))
    );
    moon.position.set(22, 26, -46);
    moon.lookAt(0, 2, -8);
    this.root.add(moon);
    const moonGlow = new THREE.Sprite(this._track(new THREE.SpriteMaterial({
      map: this._glowSpriteTexture(), color: 0xfff3d6, transparent: true,
      opacity: 0.75, blending: THREE.AdditiveBlending, fog: false, depthWrite: false,
    })));
    moonGlow.scale.set(16, 16, 1);
    moonGlow.position.copy(moon.position);
    this.root.add(moonGlow);

    // fireflies
    const fr = rng(555);
    const N = 42;
    this._ffBase = new Float32Array(N * 3);
    this._ffPhase = new Float32Array(N);
    const ffPos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this._ffBase[i * 3] = -3.8 + fr() * 7.6;
      this._ffBase[i * 3 + 1] = 0.3 + fr() * 1.5;
      this._ffBase[i * 3 + 2] = -10.8 + fr() * 5.2;
      this._ffPhase[i] = fr() * Math.PI * 2;
      ffPos.set([this._ffBase[i * 3], this._ffBase[i * 3 + 1], this._ffBase[i * 3 + 2]], i * 3);
    }
    const ffGeo = this._track(new THREE.BufferGeometry());
    ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
    const ffMat = this._track(new THREE.PointsMaterial({
      map: this._glowSpriteTexture(), color: 0xe6ff9e, size: 0.16,
      transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending,
      depthWrite: false, sizeAttenuation: true,
    }));
    this._fireflies = new THREE.Points(ffGeo, ffMat);
    this.root.add(this._fireflies);
  }

  // ---------- lights ----------
  _buildLights() {
    this.root.add(new THREE.AmbientLight(0x40485f, 0.55));

    this._warm = new THREE.PointLight(0xffb070, 16, 10, 2);
    this._warm.position.set(0, 2.05, -0.4);
    this._warm.castShadow = true;
    this._warm.shadow.mapSize.set(1024, 1024);
    this._warm.shadow.bias = -0.002;
    this.root.add(this._warm);

    const cool = new THREE.PointLight(0x6f8cff, 6, 8, 2);
    cool.position.set(3.0, 1.5, -0.9);
    this.root.add(cool);

    const lamp = new THREE.PointLight(0xffc080, 4, 5, 2);
    lamp.position.set(-1.9, 1.2, -4.6);
    this.root.add(lamp);

    this._lantern = new THREE.PointLight(0xffcf7a, 5, 8, 2);
    this._lantern.position.set(-0.9, 0.9, -6.3);
    this.root.add(this._lantern);

    const moonlight = new THREE.DirectionalLight(0x8fa6d8, 0.4);
    moonlight.position.set(15, 25, -30);
    moonlight.target.position.set(0, 0, -8);
    this.root.add(moonlight);
    this.root.add(moonlight.target);
  }

  // ---------- clues ----------
  _registerClues() {
    mystery.registerClue('clock', this._clock);
    mystery.registerClue('slip', this._slip);
    mystery.registerClue('cups', this._cupsGroup);
    mystery.registerClue('canePrints', this._caneGroup);
    mystery.registerClue('coffeePrints', this._coffeeGroup);
    mystery.registerClue('compartment', this._compartmentGroup);
  }

  forgetClues() {
    mystery.forgetObjects(CLUE_IDS);
  }

  onClueCollected() {
    const got = CLUE_IDS.filter((id) => mystery.hasClue(id)).length;
    if (got >= CLUE_IDS.length && !this._exitReady) this._unlockExit();
  }

  _unlockExit() {
    this._exitReady = true;
    this._doorAnim = 0;
    this.colliders = this.colliders.filter((c) => c !== this._doorCollider);
    if (window.__toast) {
      window.__toast('THE BACK DOOR', 'Six pieces of evidence. Neon Street is waiting.');
    }
  }

  // Prompt shown when the exit is ready and the player stands at the door.
  getPrompt(player) {
    if (this._exitReady && player) {
      const dx = player.pos.x - DOOR_X;
      const dz = player.pos.z - (-HZ);
      if (dx * dx + dz * dz < 2.4 * 2.4) return 'E — Step through to Neon Street';
    }
    return '';
  }

  // Level-specific interaction (the exit door). Returns true if consumed.
  tryInteract(raycaster) {
    if (!this._exitReady) return false;
    const hits = raycaster.intersectObjects([this._doorPanel], false);
    if (!hits.length) return false;
    if (window.__switchLevel) window.__switchLevel(2);
    return true;
  }

  update(dt, t) {
    if (this._warm) {
      this._warm.intensity = 16 + Math.sin(t * 7) * 0.4 + Math.sin(t * 13.3) * 0.2;
    }
    if (this._lantern) {
      this._lantern.intensity = 5 + Math.sin(t * 9.1) * 0.35 + Math.sin(t * 17.7) * 0.15;
    }
    if (this._exitReady && this._doorAnim < 1) {
      this._doorAnim = Math.min(1, this._doorAnim + dt * 0.8);
      const k = 1 - Math.pow(1 - this._doorAnim, 3);
      this._doorPanel.position.x = this._doorHomeX + k * 1.02;
      this._doorGlow.material.opacity = k * 0.4;
      this._doorLight.intensity = k * 5;
    }
    if (this._fireflies) {
      const attr = this._fireflies.geometry.attributes.position;
      const a = attr.array;
      for (let i = 0; i < this._ffPhase.length; i++) {
        const ph = this._ffPhase[i];
        a[i * 3] = this._ffBase[i * 3] + Math.sin(t * 0.5 + ph) * 0.5;
        a[i * 3 + 1] = this._ffBase[i * 3 + 1] + Math.sin(t * 0.8 + ph * 1.3) * 0.3;
        a[i * 3 + 2] = this._ffBase[i * 3 + 2] + Math.cos(t * 0.4 + ph * 0.7) * 0.5;
      }
      attr.needsUpdate = true;
    }
  }

  dispose(scene) {
    this.forgetClues();
    const s = scene || this.scene;
    if (this.root.parent) this.root.parent.remove(this.root);
    for (const d of this._disposables) {
      if (d && typeof d.dispose === 'function') d.dispose();
    }
    this._disposables = [];
    if (s) {
      s.background = null;
      s.fog = null;
    }
  }
}

