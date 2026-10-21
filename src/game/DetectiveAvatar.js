// ============================================================
// DetectiveAvatar.js — the main character, in every level.
//
//   loadDetective(height)  -> the team's characters/detective.fbx,
//                             matte materials, feet on y = 0, facing +z.
//                             The 54 MB file is loaded once and shared.
//   DetectiveRig           -> poses that model in code (idle, walk,
//                             run, jump, arrest) because the file has
//                             no animations of its own.
//   attachPlayerView(level)-> the player's body + [V] first / third
//                             person, used by Level 1 and Level 2.
//   makeDetective()        -> a simple code-built stand-in shown for
//                             the few seconds the model is loading.
// ============================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import detectiveURL from '../characters/detective.fbx?url';

let basePromise = null;
function loadBase() {
  if (!basePromise) {
    basePromise = new Promise((resolve, reject) => new FBXLoader().load(detectiveURL, resolve, undefined, reject));
    basePromise.catch(() => { basePromise = null; });
  }
  return basePromise;
}

// Mixamo files come with shiny Phong materials; make skin and cloth matte
function makeMatte(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const out = list.map((m) => new THREE.MeshStandardMaterial({
      map: m.map || null, normalMap: m.normalMap || null,
      color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
      roughness: 0.8, metalness: 0, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side,
    }));
    o.material = Array.isArray(o.material) ? out : out[0];
  });
}

// resolves to { root, rig, model, prefix }   (root is what you place and turn)
export async function loadDetective(height = 1.78) {
  const base = await loadBase();
  if (!base.userData.ready) { makeMatte(base); base.userData.ready = true; }
  const model = cloneSkinned(base);
  model.animations = [];
  model.position.set(0, 0, 0); model.scale.setScalar(1);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const s = height / Math.max(0.01, box.max.y - box.min.y);
  model.scale.setScalar(s);
  model.position.y = -box.min.y * s;
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  const root = new THREE.Group();
  root.add(model);
  let hips = null;
  model.traverse((o) => { if (!hips && o.isBone && /Hips$/.test(o.name)) hips = o; });
  const prefix = hips ? hips.name.replace(/Hips$/, '') : '';
  return { root, model, prefix, rig: new DetectiveRig(model, root) };
}

// Rename a Mixamo clip's tracks to another Mixamo character's bone prefix,
// so the suspect's run / jump clips can drive the detective.
export function retargetClip(clip, prefix) {
  const c = clip.clone();
  c.tracks.forEach((t) => { t.name = t.name.replace(/^mixamorig\d*/, prefix); });
  return c;
}

// =============================================================
// DetectiveRig — poses the T-pose model by pointing each limb bone
// in a direction (relative to where he is facing). Every frame starts
// from the bind pose, so nothing drifts.
// =============================================================
export class DetectiveRig {
  constructor(model, root) {
    this.root = root;
    this._v = [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3());
    this._q = [0, 1, 2].map(() => new THREE.Quaternion());
    const find = (n) => { let b = null; model.traverse((o) => { if (!b && o.isBone && o.name.endsWith(n)) b = o; }); return b; };
    const names = ['Spine', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
      'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
    this.b = {};
    for (const n of names) this.b[n] = find(n);
    this.rest = new Map();
    for (const n of names) if (this.b[n]) this.rest.set(this.b[n], this.b[n].quaternion.clone());
    this.ok = !!(this.b.LeftArm && this.b.LeftUpLeg && this.b.RightArm && this.b.RightUpLeg && this.b.LeftFoot && this.b.RightFoot);
    this.model = model;
    this.baseY = model.position.y;
    if (this.ok) { this._reset(); this.restFoot = this._footY(); }
  }
  _reset() {
    for (const [bone, q] of this.rest) bone.quaternion.copy(q);
    if (this.model && this.baseY !== undefined) this.model.position.y = this.baseY;
    this.root.updateMatrixWorld(true);
    const q = this.root.getWorldQuaternion(this._q[0]);
    this.f = this._v[3].set(0, 0, 1).applyQuaternion(q);       // forward
    this.r = this._v[4].set(-1, 0, 0).applyQuaternion(q);      // his right
    this.d = this._v[5].set(0, -1, 0);                         // down
  }
  _footY() {
    this.root.updateMatrixWorld(true);
    const ry = this.root.getWorldPosition(this._v[2]).y;
    return Math.min(this.b.LeftFoot.getWorldPosition(this._v[0]).y, this.b.RightFoot.getWorldPosition(this._v[1]).y) - ry;
  }
  // bent legs are shorter: drop the body so the lower foot stays on the floor
  _ground() {
    const dy = this._footY() - this.restFoot;
    this.model.position.y = this.baseY - dy;
    this.model.updateMatrixWorld(true);
  }
  // direction: x forward, y right, z down (relative to him)
  _dir(x, y, z) { return new THREE.Vector3().addScaledVector(this.f, x).addScaledVector(this.r, y).addScaledVector(this.d, z).normalize(); }
  _aim(bone, child, dir) {
    if (!bone || !child) return;
    bone.updateMatrixWorld(true);
    const a = bone.getWorldPosition(this._v[0]), b = child.getWorldPosition(this._v[1]);
    const cur = b.sub(a).normalize();
    const q = this._q[1].setFromUnitVectors(cur, dir);
    const world = bone.getWorldQuaternion(this._q[2]).premultiply(q);
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
    bone.updateMatrixWorld(true);
  }
  _limbs(lt, ls, rt, rs, la, lf, ra, rf) {
    const b = this.b;
    this._aim(b.LeftUpLeg, b.LeftLeg, lt); this._aim(b.LeftLeg, b.LeftFoot, ls);
    this._aim(b.RightUpLeg, b.RightLeg, rt); this._aim(b.RightLeg, b.RightFoot, rs);
    this._aim(b.LeftArm, b.LeftForeArm, la); this._aim(b.LeftForeArm, b.LeftHand, lf);
    this._aim(b.RightArm, b.RightForeArm, ra); this._aim(b.RightForeArm, b.RightHand, rf);
  }
  // amount: 0 still, 1 walking, 2 running
  pose(phase, amount, airborne = false) {
    if (!this.ok) return;
    this._reset();
    const D = (x, y, z) => this._dir(x, y, z);
    const ang = (a, side) => D(Math.sin(a), side, Math.cos(a));
    if (airborne) {
      this._limbs(ang(0.9, -0.05), ang(-0.3, -0.05), ang(-0.25, 0.05), ang(-1.0, 0.05),
        ang(-0.5, -0.35), ang(0.2, -0.2), ang(0.6, 0.35), ang(1.0, 0.2));
      return;
    }
    const a = Math.min(1, amount), run = Math.max(0, amount - 1);
    const legSwing = 0.42 * a + 0.38 * run, armSwing = 0.32 * a + 0.42 * run;
    const leg = (p, side) => {
      const t = Math.sin(p) * legSwing;
      const bend = (0.05 + Math.max(0, Math.cos(p)) * (0.55 * a + 0.75 * run));
      return [ang(t, side * 0.04), ang(t - bend, side * 0.03)];
    };
    const arm = (p, side) => {
      const t = -Math.sin(p) * armSwing;
      return [ang(t + 0.05, side * (0.16 - 0.05 * run)), ang(t + 0.2 + 0.25 * a + 0.9 * run, side * 0.08)];
    };
    const [lt, ls] = leg(phase, -1), [rt, rs] = leg(phase + Math.PI, 1);
    const [la, lf] = arm(phase, -1), [ra, rf] = arm(phase + Math.PI, 1);
    this._limbs(lt, ls, rt, rs, la, lf, ra, rf);
    this._ground();
  }
  // reaching down to cuff someone kneeling in front of him
  arrest(k = 1) {
    if (!this.ok) return;
    this._reset();
    const D = (x, y, z) => this._dir(x, y, z);
    const L = (a, b) => a.clone().lerp(b, k).normalize();
    this._limbs(L(D(0, -0.04, 1), D(0.35, -0.06, 1)), L(D(0, -0.03, 1), D(-0.1, -0.05, 1)),
      L(D(0, 0.04, 1), D(-0.2, 0.06, 1)), L(D(0, 0.03, 1), D(-0.35, 0.05, 1)),
      L(D(0.05, -0.16, 1), D(0.5, -0.1, 0.85)), L(D(0.2, -0.08, 1), D(0.55, 0.1, 0.85)),
      L(D(0.05, 0.16, 1), D(0.5, 0.1, 0.85)), L(D(0.2, 0.08, 1), D(0.55, -0.1, 0.85)));
    this._ground();
  }
}

// =============================================================
// attachPlayerView — the player's body + [V] first / third person.
// The level keeps driving the first-person camera and its examine
// ray exactly as before; afterwards, in third person, the camera is
// moved back over the right shoulder, aimed at the same spot the
// crosshair was on, so [E] keeps lining up.
//   opts.forceFirst() -> true while photos / files / panels are open
//   opts.bounds       -> {L, R, B, F, H} room limits for the camera
//   opts.tag          -> show a small "[V] 1st / 3rd person" key tag
// =============================================================
const yawOf = (p) => p.yaw || 0;

export function attachPlayerView(level, opts = {}) {
  const parent = level.level || level.root;
  const stand = makeDetective();
  stand.root.visible = false;
  parent.add(stand.root);
  const st = { third: false, phase: 0, last: null, det: null, dead: false };
  loadDetective(1.78).then((d) => {
    if (st.dead) return;
    d.root.visible = false;
    parent.add(d.root);
    st.det = d;
    stand.root.visible = false;
  }).catch((e) => console.warn('[detective] model not loaded, using the stand-in', e));

  let tag = null;
  const setTag = () => { if (tag) tag.innerHTML = `<b>V</b> ${st.third ? '3rd' : '1st'} person`; };
  if (opts.tag) {
    tag = document.createElement('div');
    tag.style.cssText = 'position:fixed;right:14px;top:14px;z-index:60;pointer-events:none;font-family:"Courier New",monospace;' +
      'font-size:11px;letter-spacing:1px;color:#c9c2b0;background:rgba(8,10,16,.72);border:1px solid #2c3442;border-radius:8px;padding:6px 10px';
    tag.className = 'dv-tag';
    document.body.appendChild(tag);
    if (!document.getElementById('dv-tag-css')) {
      const css = document.createElement('style'); css.id = 'dv-tag-css';
      css.textContent = '.dv-tag b{display:inline-block;min-width:20px;padding:2px 5px;margin-right:6px;text-align:center;border:1px solid #5a5040;' +
        'border-bottom-width:3px;border-radius:4px;background:#14171e;color:#f2d9a0}';
      document.head.appendChild(css);
    }
    setTag();
  }
  const onKey = (e) => {
    if (e.code !== 'KeyV' || e.repeat || window.__uiCapture || window.__paused) return;
    st.third = !st.third; setTag();
  };
  window.addEventListener('keydown', onKey);

  const REACH = 3.6, BACK = 2.2, UP = 0.25, SIDE = 0.5;
  const ray = new THREE.Ray(), hit = new THREE.Vector3();
  return {
    isThird: () => st.third,
    setMode(mode) { st.third = mode === 'third'; setTag(); },
    update(dt, player) {
      dt = Math.min(dt || 0, 0.05);
      const cam = window.__camera;
      if (!player || !player.pos || !cam) return;
      const third = st.third && !(opts.forceFirst && opts.forceFirst());
      const p = player.pos;
      let speed = 0;
      if (st.last) speed = Math.hypot(p.x - st.last.x, p.z - st.last.z) / Math.max(dt, 1e-4);
      st.last = (st.last || new THREE.Vector3()).copy(p);
      const amount = Math.min(2, speed / 4.5);
      if (amount > 0.05) st.phase += dt * (3 + speed * 1.6);
      const body = st.det ? st.det.root : stand.root;
      body.position.set(p.x, p.y, p.z);
      body.rotation.y = (player.yaw || 0) + Math.PI;
      if (st.det) st.det.rig.pose(st.phase, amount, !player.grounded);
      else poseDetective(stand, st.phase, amount, !player.grounded, performance.now() / 1000);
      body.visible = third;
      if (!third) {
        // first person: a gentle head bob while walking, like a person's eyes
        if (amount > 0.05 && player.grounded && !(opts.forceFirst && opts.forceFirst())) {
          const a = Math.min(1, amount);
          cam.position.y += Math.abs(Math.sin(st.phase)) * 0.035 * a - 0.015 * a;
          cam.position.x += Math.cos(yawOf(player)) * Math.sin(st.phase) * 0.012 * a;
          cam.position.z += -Math.sin(yawOf(player)) * Math.sin(st.phase) * 0.012 * a;
        }
        return;
      }

      // The camera stays level behind his shoulder like a person walking:
      // turning swings it around him, looking up / down only tilts the view
      // (it never flies up over his head to show the whole room).
      const yaw = player.yaw || 0, pitch = Math.max(-0.6, Math.min(0.5, player.pitch || 0));
      const eye = new THREE.Vector3(p.x, p.y + 1.7, p.z);
      const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch || 0, yaw, 0, 'YXZ'));
      const target = eye.clone().addScaledVector(dir, REACH);
      const flatBack = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const want = eye.clone().addScaledVector(flatBack, BACK).addScaledVector(right, SIDE);
      want.y += UP - pitch * 0.35;
      const toWant = want.clone().sub(eye);
      let dist = toWant.length();
      ray.set(eye, toWant.normalize());
      for (const c of level.colliders || []) {
        if (!c || !c.isBox3 || c.containsPoint(eye)) continue;
        if (ray.intersectBox(c, hit)) dist = Math.min(dist, eye.distanceTo(hit) - 0.2);
      }
      const camPos = eye.clone().addScaledVector(toWant, Math.max(0.3, dist));
      const b = opts.bounds;
      if (b) {
        camPos.x = Math.min(b.R - 0.25, Math.max(b.L + 0.25, camPos.x));
        camPos.z = Math.min(b.F - 0.25, Math.max(b.B + 0.25, camPos.z));
        camPos.y = Math.min(b.H - 0.25, camPos.y);
      }
      cam.position.copy(camPos);
      cam.lookAt(target);
    },
    dispose() {
      st.dead = true;
      window.removeEventListener('keydown', onKey);
      if (tag) tag.remove();
    },
  };
}

// =============================================================
// Code-built stand-in (shown until the model has loaded)
// =============================================================
const mat = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85 }, o));

export function makeDetective() {
  const skin = mat(0x6b4630, { roughness: 0.7 });
  const coat = mat(0x262a31, { roughness: 0.9 });          // dark charcoal coat
  const shirt = mat(0xd9dde3, { roughness: 0.8 });
  const trousers = mat(0x1c1f25, { roughness: 0.9 });
  const shoes = mat(0x0c0c0c, { roughness: 0.4 });
  const glove = mat(0x2f4f86, { roughness: 0.6 });         // blue crime-scene gloves
  const hair = mat(0x111111, { roughness: 1 });

  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const add = (p, geo, m, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o;
  };
  const cap = (r, len, m) => new THREE.CapsuleGeometry(r, len, 4, 10);

  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
  add(hips, new THREE.CapsuleGeometry(0.15, 0.12, 4, 10), trousers).rotation.z = Math.PI / 2;

  const legs = [];
  for (const s of [-1, 1]) {
    const thigh = new THREE.Group(); thigh.position.set(0.1 * s, -0.03, 0); hips.add(thigh);
    add(thigh, cap(0.075, 0.32), trousers, 0, -0.22, 0);
    const knee = new THREE.Group(); knee.position.y = -0.45; thigh.add(knee);
    add(knee, cap(0.06, 0.32), trousers, 0, -0.21, 0);
    const shoe = add(knee, new THREE.CapsuleGeometry(0.055, 0.16, 4, 8), shoes, 0, -0.45, 0.06);
    shoe.rotation.x = Math.PI / 2;
    legs.push({ thigh, knee });
  }

  const chest = new THREE.Group(); chest.position.y = 0.06; hips.add(chest);
  const torso = add(chest, new THREE.CapsuleGeometry(0.19, 0.3, 4, 12), coat, 0, 0.3, 0);
  torso.scale.set(1.08, 1, 0.68);
  // coat skirt below the belt line, open at the front
  for (const s of [-1, 1]) {
    const flap = add(chest, new THREE.BoxGeometry(0.2, 0.34, 0.03), coat, 0.1 * s, -0.08, 0.1);
    flap.rotation.x = -0.08;
  }
  add(chest, new THREE.BoxGeometry(0.42, 0.34, 0.03), coat, 0, -0.08, -0.12).rotation.x = 0.08;
  add(chest, new THREE.BoxGeometry(0.1, 0.3, 0.02), shirt, 0, 0.36, 0.135);              // shirt front
  const lapelM = coat;
  for (const s of [-1, 1]) { const l = add(chest, new THREE.BoxGeometry(0.07, 0.24, 0.02), lapelM, 0.07 * s, 0.42, 0.14); l.rotation.z = 0.35 * s; }
  add(chest, new THREE.CylinderGeometry(0.055, 0.065, 0.1, 12), skin, 0, 0.64, 0);      // neck

  const headG = new THREE.Group(); headG.position.y = 0.8; chest.add(headG);
  const head = add(headG, new THREE.SphereGeometry(0.115, 18, 14), skin); head.scale.set(0.92, 1.08, 1);
  const hairCap = add(headG, new THREE.SphereGeometry(0.12, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 0.02, -0.01);
  hairCap.scale.set(0.95, 1, 1.02);
  add(headG, new THREE.SphereGeometry(0.03, 8, 6), skin, -0.105, -0.01, 0);              // ears
  add(headG, new THREE.SphereGeometry(0.03, 8, 6), skin, 0.105, -0.01, 0);
  add(headG, new THREE.ConeGeometry(0.022, 0.05, 8), skin, 0, -0.01, 0.115).rotation.x = Math.PI / 2;   // nose

  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(0.25 * s, 0.53, 0); chest.add(shoulder);
    add(shoulder, cap(0.06, 0.2), coat, 0, -0.15, 0);
    const elbow = new THREE.Group(); elbow.position.y = -0.3; shoulder.add(elbow);
    add(elbow, cap(0.052, 0.18), coat, 0, -0.13, 0);
    add(elbow, new THREE.SphereGeometry(0.055, 10, 8), glove, 0, -0.29, 0);
    arms.push({ shoulder, elbow, s });
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, body, hips, chest, headG, legs, arms };
}

// amount: 0 = standing still, 1 = walking, 2 = running
export function poseDetective(r, phase, amount, airborne, t) {
  if (airborne) {
    r.body.position.y = 0; r.chest.rotation.set(0.15, 0, 0); r.hips.rotation.set(0, 0, 0);
    r.legs[0].thigh.rotation.set(-0.9, 0, 0); r.legs[0].knee.rotation.set(1.2, 0, 0);
    r.legs[1].thigh.rotation.set(0.25, 0, 0); r.legs[1].knee.rotation.set(0.8, 0, 0);
    r.arms[0].shoulder.rotation.set(-0.7, 0, 0.25); r.arms[0].elbow.rotation.set(-0.5, 0, 0);
    r.arms[1].shoulder.rotation.set(0.5, 0, -0.25); r.arms[1].elbow.rotation.set(-0.5, 0, 0);
    return;
  }
  const a = Math.min(1, amount), run = Math.max(0, amount - 1);
  r.body.position.y = Math.abs(Math.sin(phase)) * (0.02 * a + 0.05 * run) + (a < 0.05 ? Math.sin(t * 1.8) * 0.004 : 0);
  r.chest.rotation.set(0.04 + 0.16 * run, 0, 0);
  r.hips.rotation.set(0, Math.sin(phase) * 0.08 * a, 0);
  for (let i = 0; i < 2; i++) {
    const p = phase + i * Math.PI;
    const swing = 0.45 * a + 0.4 * run;
    r.legs[i].thigh.rotation.set(-Math.sin(p) * swing, 0, 0);
    r.legs[i].knee.rotation.set(0.05 + Math.max(0, Math.cos(p)) * (0.5 * a + 0.7 * run), 0, 0);
    r.arms[i].shoulder.rotation.set(Math.sin(p) * (0.35 * a + 0.45 * run), 0, r.arms[i].s * -0.05);
    r.arms[i].elbow.rotation.set(-(0.15 + 0.25 * a + 0.9 * run), 0, 0);
  }
}
