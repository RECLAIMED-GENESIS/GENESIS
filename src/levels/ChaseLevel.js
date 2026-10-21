// ============================================================
// ChaseLevel.js — LEVEL 3: THE CHASE
//
// The suspect runs. You are the cop on foot, right behind him.
// He runs down the waterfront street (now a construction site),
// into the old mine cave and over the rope bridge. Catch him
// before he crosses: once he is over, the bridge comes down
// behind him and he is gone.
//
// NEW FILE ONLY. Reuses the Level2 street scene (the same way
// the old city level did) and adds the construction site, the cave, the
// bridge, the two avatars and the chase rules on top of it.
//
// Controls:  A / D (or arrows) change lane · SPACE jump
//            V switch first / third person · R restart
//
// How it works (no physics library):
//   * the player runs forward on their own; this file sets x/z
//   * jumping + gravity come from main.js (player.vel.y), using
//     getSurfaceHeight() below as the floor
//   * hits = Box3 overlap between the player and an obstacle
//   * GAP = how far ahead the suspect is. Hits make it grow.
//     Gap reaches 1.7 m -> caught (handcuff scene, you win).
//     He reaches the far side of the bridge first -> bridge
//     breaks. Jump after him = you fall. Stop = he escapes.
// ============================================================
import * as THREE from 'three';
import { Level2 } from './Level2.js';
import { play as sfx } from '../audio/sfx.js';
import { getCase, killerOf } from '../game/case.js';
import { loadDetective, retargetClip } from '../game/DetectiveAvatar.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import suspectURL from '../characters/suspect.glb?url';
import suspectRunURL from '../characters/suspect_run.json?url';
import suspectJumpURL from '../characters/suspect_jump.json?url';

// ---------------- tuning ----------------
const LANES = [-3.2, 0, 3.2];
const CHAR_SCALE = 1.3;       // the detective and suspect, larger so they read against the city
const EYE = 1.7 * CHAR_SCALE;
const PLAYER_SPEED = 10.5;    // m/s running
const STUMBLE_SPEED = 6;      // m/s after hitting something
const PUDDLE_SPEED = 7;       // m/s while splashing through water
const CRIMINAL_SPEED = 9.6;   // m/s (a bit slower than you)
const PACE_GAIN = 0.35;       // both of you are 35% faster by the time you reach the bridge
const START_GAP = 26;         // m between you and him at GO
const CATCH_GAP = 1.7;        // m: close enough to tackle
const PLAYER_START_Z = 100;

// ---------------- layout (the run goes toward -z) ----------------
const CAVE_Z = -150;          // cave mouth
const NARROW_Z = -236;        // cave narrows to one path
const BRIDGE_NEAR = -250;     // bridge starts (your side)
const BRIDGE_FAR = -262;      // bridge ends (his side)
const CAVE_END = -318;
const CHASM_BOTTOM = -60;
const BRIDGE_HALF = 1.8;      // half width of the bridge
const STREET_HALF = 6.5;      // half width used for wide obstacles
const CAVE_HALF = 5.5;

// ---------------- small helpers ----------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const rand = (a, b) => a + Math.random() * (b - a);

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85 }, opts));
}

function signTexture(lines, bg, fg, w = 512, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = fg; g.lineWidth = 12; g.strokeRect(12, 12, w - 24, h - 24);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const size = Math.floor(h / (lines.length + 1.4));
  g.font = `bold ${size}px "Courier New", monospace`;
  lines.forEach((ln, i) => g.fillText(ln, w / 2, (h * (i + 1)) / (lines.length + 1)));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function stripeTexture(a = '#e8701a', b = '#f2f2f2') {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = b; g.fillRect(0, 0, 128, 32);
  g.fillStyle = a;
  for (let x = -32; x < 160; x += 32) {
    g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// =============================================================
// NOISE + ROCK TEXTURES (generated in code, no image files)
// Used to shape the cave walls and the hill so they look like
// real rock instead of boxes.
// =============================================================
function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w) * 2 - 1;
}
function fbm3(x, y, z, oct = 4) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
// tileable 2D noise (wraps every P cells) so textures repeat without seams
function pnoise2(x, y, P, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const w = (i) => ((i % P) + P) % P;
  const c = (i, j) => hash3(w(xi + i), w(yi + j), seed);
  return lerp(lerp(c(0, 0), c(1, 0), u), lerp(c(0, 1), c(1, 1), u), v) * 2 - 1;
}
function pfbm2(x, y, P, seed, oct = 5) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * pnoise2(x * f, y * f, P * f, seed + i); n += a; a *= 0.5; f *= 2; }
  return s / n;
}

// colour map + normal map for rock / dirt
function rockMaps(rgb, P, seed, bump, size = 256) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x / size) * P, v = (y / size) * P;
    const n = pfbm2(u, v, P, seed);
    const ridge = 1 - Math.abs(pfbm2(u * 2, v * 2, P * 2, seed + 50, 3));   // cracks
    h[y * size + x] = 0.65 * n + 0.35 * (ridge * ridge * 2 - 1);
  }
  const mk = (fill) => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); const img = g.createImageData(size, size);
    fill(img.data);
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  const map = mk((d) => {
    for (let i = 0; i < size * size; i++) {
      const k = 0.62 + 0.38 * (h[i] * 0.5 + 0.5);
      const tint = 0.94 + 0.12 * pnoise2((i % size) / size * 3, Math.floor(i / size) / size * 3, 3, seed + 99);
      d[i * 4] = clamp(rgb[0] * k * tint, 0, 255);
      d[i * 4 + 1] = clamp(rgb[1] * k, 0, 255);
      d[i * 4 + 2] = clamp(rgb[2] * k / tint, 0, 255);
      d[i * 4 + 3] = 255;
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = mk((d) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const at = (xx, yy) => h[((yy + size) % size) * size + ((xx + size) % size)];
      let nx = (at(x - 1, y) - at(x + 1, y)) * bump;
      let ny = (at(x, y - 1) - at(x, y + 1)) * bump;
      const l = Math.hypot(nx, ny, 1); nx /= l; ny /= l;
      const i = (y * size + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  });
  return { map, normalMap };
}

function woodTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#5a3d22'; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(${30 + Math.random() * 40},${18 + Math.random() * 20},8,${0.25 + Math.random() * 0.4})`;
    g.lineWidth = 1 + Math.random() * 2;
    const x = Math.random() * 64;
    g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 4, 80, x - 4, 170, x + 2, 256); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function repeated(tex, rx, ry) {
  const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return t;
}

// lumpy natural rock (noise-bent sphere) for obstacles and rubble
function makeRock(r, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.IcosahedronGeometry(r, 3);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const seed = Math.random() * 100;
  const ax = sx * (0.85 + Math.random() * 0.3), ay = sy * (0.85 + Math.random() * 0.2), az = sz * (0.85 + Math.random() * 0.3);
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
    const d = 1 + 0.28 * fbm3(vx / r * 1.6 + seed, vy / r * 1.6, vz / r * 1.6);
    p.setXYZ(i, vx * d * ax, vy * d * ay, vz * d * az);
    const k = clamp(0.55 + 0.45 * (d - 0.8), 0.35, 1);
    col[i * 3] = k; col[i * 3 + 1] = k * 0.95; col[i * 3 + 2] = k * 0.9;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.position.set(x, y, z); m.rotation.y = Math.random() * 6.28;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// =============================================================
// LEVEL 3 STORY — shown before the chase, one panel per [ENTER]
// =============================================================
const GEN = '<b style="color:#e0362a;letter-spacing:3px">GENESIS</b>';
const STORY = [
  `The lab results all point to one place: ${GEN}, the beachfront city that was never finished.`,
  `It was going to be luxury living on the shore. Then the money ran out before the cave could be brought down. The cranes stopped. The builders left.`,
  `The criminals moved in. They turned the empty site into a trap for police: barriers, pipes, rubble and skips, all left exactly where they slow a chase down.`,
  `Inside the old cave they strung a rope bridge across the chasm. It was built to be cut the moment anyone follows them over it.`,
  `Your suspect is here, and he has seen you. Catch him before he reaches the bridge.`,
];

// =============================================================
// SUSPECT FILES — loaded once per page and reused on every replay / restart.
// =============================================================
function stripRootMotion(clip, keepY) {
  for (const tr of clip.tracks) {
    if (!/Hips\.position$/.test(tr.name)) continue;
    const v = tr.values, x0 = v[0], y0 = v[1], z0 = v[2];
    for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; if (!keepY) v[i + 1] = y0; }
  }
  return clip;
}
let suspectFiles = null;
function loadSuspectFiles() {
  if (!suspectFiles) {
    const clip = (url, keepY) => fetch(url).then((r) => r.json())
      .then((j) => stripRootMotion(THREE.AnimationClip.parse(j), keepY))
      .catch((e) => { console.warn('[chase] clip not loaded', url, e); return null; });
    suspectFiles = Promise.all([
      new GLTFLoader().loadAsync(suspectURL).then((g) => g.scene),
      clip(suspectRunURL, true),
      clip(suspectJumpURL, false),
    ]).then(([base, run, jump]) => ({ base, run, jump }));
    suspectFiles.catch(() => { suspectFiles = null; });
  }
  return suspectFiles;
}

// =============================================================
// ENDING — after the arrest: why Dr. Nkosi was killed (shown on the win screen).
// The killer is whoever the case picked this run (see game/case.js).
// =============================================================
function endingStory() {
  let k = null;
  try { k = killerOf(getCase()); } catch (e) {}
  const name = k ? k.name : 'The killer';
  const role = k ? k.role.toLowerCase() : 'insider';
  return {
    name,
    summary: `Dr. Thabo Nkosi secretly hid money for the crew behind ${GEN}. When he tried to quit and go to the police, they sent ${name}, the ${role}, to silence him.`,
  };
}

// =============================================================
// AVATAR — a jointed humanoid (same simple style as the city
// NPCs) whose arms and legs swing, so it can run, jump, kneel
// and be handcuffed without any downloaded model.
// The figure faces +z; the chase turns it to face -z.
// =============================================================
function makeRunner(o) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const skin = mat(o.skin, { roughness: 0.75 });
  const top = mat(o.top);
  const pants = mat(o.pants, { roughness: 0.9 });
  const shoe = mat(o.shoes, { roughness: 0.6 });

  const add = (parent, geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
  };

  const hips = new THREE.Group(); hips.position.y = 0.92; body.add(hips);
  add(hips, new THREE.BoxGeometry(0.36, 0.18, 0.22), pants);

  const legs = [];
  for (const s of [-1, 1]) {
    const thigh = new THREE.Group(); thigh.position.set(0.1 * s, -0.04, 0); hips.add(thigh);
    add(thigh, new THREE.CylinderGeometry(0.075, 0.065, 0.44, 10), pants, 0, -0.22, 0);
    const knee = new THREE.Group(); knee.position.y = -0.44; thigh.add(knee);
    add(knee, new THREE.CylinderGeometry(0.062, 0.05, 0.42, 10), pants, 0, -0.21, 0);
    add(knee, new THREE.BoxGeometry(0.12, 0.08, 0.26), shoe, 0, -0.44, 0.05);
    legs.push({ thigh, knee });
  }

  const chest = new THREE.Group(); chest.position.y = 0.08; hips.add(chest);
  add(chest, new THREE.BoxGeometry(0.42, 0.6, 0.25), top, 0, 0.3, 0);
  add(chest, new THREE.CylinderGeometry(0.05, 0.06, 0.1, 10), skin, 0, 0.64, 0);

  const headG = new THREE.Group(); headG.position.y = 0.78; chest.add(headG);
  add(headG, new THREE.SphereGeometry(0.12, 14, 12), skin);

  const arms = [];
  const hands = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(0.26 * s, 0.55, 0); chest.add(shoulder);
    add(shoulder, new THREE.CylinderGeometry(0.056, 0.05, 0.3, 10), top, 0, -0.15, 0);
    const elbow = new THREE.Group(); elbow.position.y = -0.3; shoulder.add(elbow);
    add(elbow, new THREE.CylinderGeometry(0.05, 0.045, 0.27, 10), o.sleeves ? top : skin, 0, -0.135, 0);
    const hand = add(elbow, new THREE.SphereGeometry(0.056, 10, 8), skin, 0, -0.29, 0);
    arms.push({ shoulder, elbow, s });
    hands.push(hand);
  }

  if (o.kind === 'cop') {
    const capM = mat(0x111a2e, { roughness: 0.6 });
    add(headG, new THREE.CylinderGeometry(0.135, 0.13, 0.08, 16), capM, 0, 0.09, 0);
    add(headG, new THREE.CylinderGeometry(0.145, 0.145, 0.03, 16), capM, 0, 0.055, 0);
    add(headG, new THREE.BoxGeometry(0.2, 0.02, 0.1), capM, 0, 0.05, 0.13);
    add(chest, new THREE.BoxGeometry(0.07, 0.08, 0.02), mat(0xf2c14b, { metalness: 0.8, roughness: 0.3 }), 0.11, 0.44, 0.13);
    add(hips, new THREE.BoxGeometry(0.44, 0.07, 0.26), mat(0x0b0b0b, { roughness: 0.5 }), 0, 0.08, 0);
    add(hips, new THREE.BoxGeometry(0.08, 0.14, 0.08), mat(0x0b0b0b), 0.24, 0.0, 0.02);   // holster
  } else {
    const hoodM = mat(o.top, { side: THREE.DoubleSide });
    const hood = add(headG, new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hoodM, 0, 0.01, -0.025);
    hood.rotation.x = -0.35;
    add(chest, new THREE.BoxGeometry(0.3, 0.12, 0.04), top, 0, 0.12, 0.13);              // hoodie pocket
    add(chest, new THREE.BoxGeometry(0.3, 0.36, 0.14), mat(0x3b2a1a), 0, 0.3, -0.19);    // backpack
  }

  root.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { root, body, hips, chest, headG, legs, arms, hands };
}

function poseRun(r, ph, lean = 0.2) {
  r.body.position.y = Math.abs(Math.sin(ph)) * 0.07;
  r.chest.rotation.set(lean, 0, 0);
  r.hips.rotation.set(0, Math.sin(ph) * 0.12, 0);
  for (let i = 0; i < 2; i++) {
    const p = ph + i * Math.PI;
    r.legs[i].thigh.rotation.set(-Math.sin(p) * 0.9, 0, 0);
    r.legs[i].knee.rotation.set(0.2 + 1.2 * Math.max(0, Math.cos(p)), 0, 0);
    r.arms[i].shoulder.rotation.set(Math.sin(p) * 0.85, 0, 0);
    r.arms[i].elbow.rotation.set(-1.35, 0, 0);
  }
}

function poseJump(r) {
  r.body.position.y = 0;
  r.chest.rotation.set(0.25, 0, 0);
  r.hips.rotation.set(0, 0, 0);
  r.legs[0].thigh.rotation.set(-1.0, 0, 0); r.legs[0].knee.rotation.set(1.3, 0, 0);
  r.legs[1].thigh.rotation.set(0.3, 0, 0);  r.legs[1].knee.rotation.set(1.0, 0, 0);
  r.arms[0].shoulder.rotation.set(-0.9, 0, 0.3); r.arms[0].elbow.rotation.set(-0.6, 0, 0);
  r.arms[1].shoulder.rotation.set(0.7, 0, -0.3); r.arms[1].elbow.rotation.set(-0.6, 0, 0);
}

function poseIdle(r, t) {
  r.body.position.y = Math.sin(t * 2) * 0.008;
  r.chest.rotation.set(0.02, 0, 0);
  r.hips.rotation.set(0, 0, 0);
  for (let i = 0; i < 2; i++) {
    r.legs[i].thigh.rotation.set(0, 0, 0);
    r.legs[i].knee.rotation.set(0.05, 0, 0);
    r.arms[i].shoulder.rotation.set(0.05, 0, 0);
    r.arms[i].elbow.rotation.set(-0.2, 0, 0);
  }
}

function poseStumble(r, ph) {
  poseRun(r, ph, 0.65);
  r.arms[0].shoulder.rotation.set(-1.4, 0, 0.4);
  r.arms[1].shoulder.rotation.set(-1.2, 0, -0.4);
}

function poseKneel(r, k) {
  r.body.position.y = -0.43 * k;
  r.chest.rotation.set(0.3 * k, 0, 0);
  r.hips.rotation.set(0, 0, 0);
  for (let i = 0; i < 2; i++) {
    const s = r.arms[i].s;
    r.legs[i].thigh.rotation.set(-0.1 * k, 0, 0);
    r.legs[i].knee.rotation.set(1.5 * k, 0, 0);
    r.arms[i].shoulder.rotation.set(0.6 * k, 0, -s * 0.3 * k);
    r.arms[i].elbow.rotation.set(1.0 * k, 0, 0);
  }
  r.headG.rotation.set(0.25 * k, 0, 0);
}

function poseArrest(r, k) {
  r.body.position.y = 0;
  r.chest.rotation.set(0.2 * k, 0, 0);
  r.hips.rotation.set(0, 0, 0);
  for (let i = 0; i < 2; i++) {
    const s = r.arms[i].s;
    r.legs[i].thigh.rotation.set(i ? -0.35 * k : 0.15 * k, 0, 0);
    r.legs[i].knee.rotation.set(i ? 0.5 * k : 0.1, 0, 0);
    r.arms[i].shoulder.rotation.set(-1.05 * k, 0, s * 0.15 * k);
    r.arms[i].elbow.rotation.set(-0.35 * k, 0, 0);
  }
}

// =============================================================
// OBSTACLE LAYOUT — placed by hand along the run.
// lane: 0 = left, 1 = middle, 2 = right.  wide = across all lanes.
// drop = sits up on a scaffold and falls after the suspect passes
// (he knocks it down behind him).
// low obstacles can be jumped; tall ones you must go around.
// =============================================================
const LAYOUT = [
  // ---- the street: construction site ----
  { z: 72, lane: 0, type: 'cone' }, { z: 72, lane: 2, type: 'cone' },
  { z: 62, lane: 1, type: 'barrier' },
  { z: 50, lane: 0, type: 'skip' }, { z: 50, lane: 1, type: 'bags' },
  { z: 38, wide: true, type: 'beam' },
  { z: 26, lane: 1, type: 'cone' }, { z: 26, lane: 2, type: 'cone' },
  { z: 12, lane: 2, type: 'pipes' },
  { z: 4, lane: 0, type: 'barrier' },
  { z: -8, lane: 1, type: 'skip' }, { z: -8, lane: 2, type: 'cone' },
  { z: -20, lane: 0, type: 'bags' }, { z: -20, lane: 2, type: 'bags' },
  { z: -32, wide: true, type: 'beam' },
  { z: -44, lane: 0, type: 'pipes' }, { z: -44, lane: 1, type: 'barrier' },
  { z: -54, lane: 2, type: 'barrels' },
  { z: -64, lane: 0, type: 'cone' }, { z: -64, lane: 1, type: 'cone' }, { z: -64, lane: 2, type: 'cone' },
  { z: -76, lane: 0, type: 'skip' }, { z: -76, lane: 2, type: 'skip' },
  { z: -88, lane: 1, type: 'barrier' }, { z: -88, lane: 0, type: 'bags' },
  { z: -100, lane: 1, type: 'pipes' },
  { z: -110, wide: true, type: 'beam' },
  { z: -122, lane: 0, type: 'barrier' }, { z: -122, lane: 2, type: 'barrier' },
  { z: -134, lane: 1, type: 'cone' }, { z: -134, lane: 2, type: 'cone' },
  { z: -143, lane: 2, type: 'bags' },
  // ---- the cave ----
  { z: -162, lane: 0, type: 'rockTall' }, { z: -162, lane: 1, type: 'rockLow' },
  { z: -174, lane: 1, type: 'puddle' }, { z: -174, lane: 2, type: 'puddle' },
  { z: -186, wide: true, type: 'timber' },
  { z: -198, lane: 1, type: 'rockTall' }, { z: -198, lane: 2, type: 'rockLow' },
  { z: -210, lane: 0, type: 'barrels' }, { z: -210, lane: 2, type: 'cone' },
  { z: -222, lane: 0, type: 'rockLow' }, { z: -222, lane: 1, type: 'rockLow' }, { z: -222, lane: 2, type: 'rockLow' },
  { z: -231, lane: 1, type: 'puddle' },
];

// =============================================================
export class ChaseLevel {
  constructor(sceneOrRenderer = null, rendererMaybe = null) {
    this.scene = (sceneOrRenderer && sceneOrRenderer.isScene) ? sceneOrRenderer : new THREE.Scene();
    this.renderer = rendererMaybe || (sceneOrRenderer && sceneOrRenderer.isWebGLRenderer ? sceneOrRenderer : null) || window.__renderer || null;

    // ---- the street scene, hoisted into our scene (same way the old city level did) ----
    this.inner = new Level2();
    this._prevBg = this.scene.background;
    this._prevFog = this.scene.fog;
    this.scene.background = this.inner.scene.background;
    const f0 = this.inner.scene.fog;
    this.baseFog = {
      color: (f0 && f0.color) ? f0.color.clone() : new THREE.Color(0x1c1a38),
      near: (f0 && f0.near !== undefined) ? f0.near : 90,
      far: (f0 && f0.far !== undefined) ? f0.far : 400,
    };
    this.caveFogColor = new THREE.Color(0x121018);
    this.fog = new THREE.Fog(this.baseFog.color.clone(), this.baseFog.near, this.baseFog.far);
    this.scene.fog = this.fog;
    this.scene.add(this.inner.level);
    this.scene.add(this.inner.sky);
    this.level = this.inner.level;
    this.root = this.inner.level;
    this.sky = this.inner.sky;
    this.colliders = [];           // the chase moves the player itself

    this.name = 'LEVEL 3 — GENESIS';
    this.spawn = new THREE.Vector3(LANES[1], 0, PLAYER_START_Z);
    this.spawnYaw = 0;

    this.chase = new THREE.Group();
    this.scene.add(this.chase);

    // ---- run state ----
    this.state = 'story';          // story -> intro (countdown) -> run -> caught | escaped | fell
    this.stateT = 0;
    this.time = 0;
    this.lane = 1;
    this.prevLane = 1;
    this.py = 0; this.vy = 0; this.grounded = true;   // the chase does its own jump + gravity
    this.px = LANES[1];
    this.pz = PLAYER_START_Z;
    this.speed = 0;
    this.stumble = 0;
    this.slow = 0;
    this.shake = 0;
    this.hits = 0;
    this.runTime = 0;
    this.copPhase = 0;
    this.view = 'third';
    this.crim = { lane: 1, x: LANES[1], z: PLAYER_START_Z - START_GAP, y: 0, vy: 0, phase: 0, gone: false, look: 0 };
    this.bridgeBroken = false;
    this.breakT = 0;
    this.endOpen = false;
    this.obstacles = [];
    this.blinkMats = [];
    this.camPos = new THREE.Vector3(LANES[1], 3, PLAYER_START_Z + 6);
    this._pb = new THREE.Box3();
    this._kb = new THREE.Box3();
    this._av1 = new THREE.Vector3(); this._av2 = new THREE.Vector3(); this._av3 = new THREE.Vector3();
    this._av4 = new THREE.Vector3(); this._av5 = new THREE.Vector3(); this._av6 = new THREE.Vector3();
    this._aq1 = new THREE.Quaternion(); this._aq2 = new THREE.Quaternion(); this._aq3 = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();

    this._cutGround();
    this._buildRoadEnd();
    this._buildSiteDressing();
    this._buildCave();
    this._buildBridge();
    this._buildObstacles();
    this._buildAvatars();
    this._ready = { suspect: false, cop: false };
    this._loadSuspect();
    this._loadCop();
    this._buildUI();
    this._mainHud = document.getElementById('hud');
    if (this._mainHud) { this._mainHudVis = this._mainHud.style.visibility; this._mainHud.style.visibility = 'hidden'; }
    this._mainMsg = document.getElementById('msg');      // "click to play · WASD · E · F · C" line from main.js
    if (this._mainMsg) { this._mainMsgVis = this._mainMsg.style.visibility; this._mainMsg.style.visibility = 'hidden'; }
    this._buildLights();
    this._buildStory();

    window.__firstPerson = true;   // this level drives the camera
    this._grabKeys();
    this._onKey = (e) => this._handleKey(e);
    window.addEventListener('keydown', this._onKey);
  }

  // floor height used by main.js for jumping / falling
  getSurfaceHeight(x, z) {
    if (z < BRIDGE_NEAR && z > BRIDGE_FAR) {
      if (this.bridgeBroken) return -200;
      return Math.abs(x) <= BRIDGE_HALF ? 0 : -200;
    }
    return 0;
  }
  groundHeight(x, z) { return this.getSurfaceHeight(x, z); }
  terrainHeight(x, z) { return this.getSurfaceHeight(x, z); }

  // =========================================================
  // BUILD — world
  // =========================================================

  // The street's ground plane runs under the cave. Clip it (this
  // level's own copy only) so the chasm under the bridge is a real hole.
  _cutGround() {
    if (!this.renderer) return;
    this._prevClip = this.renderer.localClippingEnabled;
    this.renderer.localClippingEnabled = true;
    const planes = [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), -8.5),          // x > -8.5
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -8.5),           // x <  8.5
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -(CAVE_Z + 0.5)),// z < CAVE_Z
      new THREE.Plane(new THREE.Vector3(0, 0, -1), CAVE_END - 10), // z > CAVE_END - 10
    ];
    this.inner.level.traverse((o) => {
      if (!o.isMesh || !o.geometry || o.geometry.type !== 'PlaneGeometry') return;
      const p = o.geometry.parameters || {};
      if ((p.width || 0) < 250 || (p.height || 0) < 500) return;
      if (Math.abs(o.position.y) > 1) return;        // the ground, not the sea
      const m = o.material.clone();
      m.clippingPlanes = planes;
      m.clipIntersection = true;
      o.material = m;
    });
  }

  _box(parent, w, h, d, m, x, y, z) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true;
    parent.add(b); return b;
  }

  _block(m, x0, x1, y0, y1, z0, z1) {
    return this._box(this.chase, x1 - x0, y1 - y0, z1 - z0, m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  }

  // Paint three lanes: hide the street's single centre dash (this level's copy
  // only) and add two dashed dividers between the lanes, the whole way to the cave.
  _paintLanes() {
    let neon = null;
    this.inner.level.traverse((o) => {
      if (!o.isMesh || !o.geometry || o.geometry.type !== 'BoxGeometry') return;
      const p = o.geometry.parameters || {};
      if (Math.abs(o.position.x) < 0.01 && Math.abs(p.width - 0.16) < 0.01 && Math.abs(p.depth - 5) < 0.01) {
        o.visible = false; neon = o.material;
      }
    });
    neon = neon || new THREE.MeshStandardMaterial({ color: 0x00d9ff, emissive: 0x00d9ff, emissiveIntensity: 3.5 });
    const dash = new THREE.BoxGeometry(0.14, 0.06, 3.2);
    for (const x of [(LANES[0] + LANES[1]) / 2, (LANES[1] + LANES[2]) / 2]) {
      for (let z = 98; z > CAVE_Z + 2; z -= 9) {
        const d = new THREE.Mesh(dash, neon);
        d.position.set(x, 0.05, z); d.userData.noShadow = true;
        this.chase.add(d);
      }
    }
  }

  _buildRoadEnd() {
    this._paintLanes();
    const asphalt = mat(0x2a2e36, { roughness: 0.7, metalness: 0.15 });
    this._block(asphalt, -8, 8, -0.5, 0, CAVE_Z - 0.5, -130);
    const dirt = mat(0x4a3b2c, { roughness: 1 });
    this._block(dirt, -30, -8, -0.3, 0.02, CAVE_Z, -126);
  }

  _buildSiteDressing() {
    const g = new THREE.Group(); this.chase.add(g);
    const stripes = stripeTexture();
    stripes.wrapS = THREE.RepeatWrapping; stripes.repeat.set(2, 1);
    const boardM = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.6 });
    const legM = mat(0x2a2a2a, { roughness: 0.6 });
    const amber = new THREE.MeshStandardMaterial({ color: 0xffa020, emissive: 0xffa020, emissiveIntensity: 2 });
    this.blinkMats.push(amber);

    // barricade fences along both road edges
    let n = 0;
    for (let z = 86; z > CAVE_Z + 2; z -= 7) {
      for (const x of [-7.6, 7.6]) {
        const f = new THREE.Group(); f.position.set(x, 0, z); g.add(f);
        this._box(f, 0.08, 0.45, 2.6, boardM, 0, 0.85, 0);
        this._box(f, 0.08, 0.3, 2.6, boardM, 0, 0.35, 0);
        for (const dz of [-1.15, 1.15]) this._box(f, 0.07, 1.1, 0.07, legM, 0, 0.55, dz);
        if ((n++) % 2 === 0) {
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), amber);
          lamp.position.set(0, 1.18, 1.15); f.add(lamp);
        }
      }
    }

    // ROAD CLOSED boards facing the player at the start
    for (const x of [-6.6, 6.6]) this._signBoard(g, ['ROAD CLOSED'], '#f4f4f0', '#b8261c', 1.8, 0.9, x, 1.5, 88, 0);

    // site cabin, sand piles, scaffold towers (off the road, -x side)
    this._box(g, 2.4, 2.6, 6, mat(0x2a5a8a, { roughness: 0.7, metalness: 0.3 }), -13, 1.3, 66);
    const sand = mat(0x9a7a52, { roughness: 1, flatShading: true });
    for (const z of [8, -26, -112]) {
      const p = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.2, 9), sand);
      p.position.set(-13, 1.1, z); p.receiveShadow = true; g.add(p);
    }
    for (const z of [32, -68]) this._scaffoldTower(g, -12.5, z);

    // the developer's billboards: the city was called GENESIS
    const billboard = (lines, w, h, x, y, z, ry) => {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
      const q = c.getContext('2d');
      const gr = q.createLinearGradient(0, 0, 0, 512);
      gr.addColorStop(0, '#9ec3d6'); gr.addColorStop(0.62, '#e9d9b4'); gr.addColorStop(1, '#c9a873');
      q.fillStyle = gr; q.fillRect(0, 0, 1024, 512);
      q.fillStyle = 'rgba(40,60,80,.35)';                 // faded towers on the shore
      for (let i = 0; i < 9; i++) q.fillRect(80 + i * 100, 330 - (i % 3) * 60 - 40, 60, 200);
      q.textAlign = 'center';
      q.fillStyle = '#c4261c'; q.font = 'bold 150px "Courier New", monospace'; q.fillText('GENESIS', 512, 170);
      q.fillStyle = '#1b2430'; q.font = 'bold 40px "Courier New", monospace'; q.fillText(lines[0], 512, 240);
      q.font = '30px "Courier New", monospace'; q.fillText(lines[1], 512, 290);
      q.save(); q.translate(560, 400); q.rotate(-0.16);                // the stamp across it
      q.strokeStyle = '#b01010'; q.lineWidth = 10; q.strokeRect(-330, -56, 660, 112);
      q.fillStyle = '#b01010'; q.font = 'bold 66px "Courier New", monospace'; q.fillText(lines[2], 0, 24);
      q.restore();
      q.fillStyle = 'rgba(30,20,10,.25)';                              // weathering
      for (let i = 0; i < 260; i++) q.fillRect(Math.random() * 1024, Math.random() * 512, 2 + Math.random() * 6, 1 + Math.random() * 30);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, emissive: 0x222222, emissiveIntensity: 0.6 }));
      face.position.y = y; b.add(face);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(0x2a2a2a)); back.rotation.y = Math.PI; back.position.set(0, y, -0.03); b.add(back);
      for (const px of [-w * 0.35, w * 0.35]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, y + h / 2, 12), mat(0x5a5f66, { metalness: 0.6, roughness: 0.5 }));
        p.position.set(px, (y + h / 2) / 2 - 0.2, -0.15); p.castShadow = true; b.add(p);
      }
    };
    // only stand them where no street building is
    const blockers = [];
    this.inner.level.updateMatrixWorld(true);
    for (const ch of this.inner.level.children) {
      const b = new THREE.Box3().setFromObject(ch);
      if (b.isEmpty()) continue;
      const sx = b.max.x - b.min.x, sz = b.max.z - b.min.z;
      if (sx > 120 || sz > 120 || b.max.y < 2.5 || (sx < 3 && sz < 3)) continue;
      blockers.push(b);
    }
    const free = (x, z, r) => !blockers.some((b) => x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z);
    const pick = (spots) => spots.find(([x, z]) => free(x, z, 4.2)) || null;
    const s1 = pick([[-12, 80], [-12, 90], [-12, 58], [-12, 46], [-12, 14]]);
    const s2 = pick([[-12, -140], [-12, -134], [-12, -100], [-12, -92], [-12, -60]]);
    if (s1) billboard(['BEACHFRONT CITY', 'luxury living on the shore - phase 1', 'PROJECT ABANDONED'], 7, 3.5, s1[0], 4.6, s1[1], 0.3);
    if (s2) billboard(['PHASE 2: CAVE CLEARANCE', 'bringing the hill down to the sea', 'FUNDS FROZEN'], 7, 3.5, s2[0], 4.6, s2[1], 0.3);

  }

  _scaffoldTower(parent, x, z) {
    const pipe = mat(0x8a8f96, { metalness: 0.6, roughness: 0.4 });
    const plank = mat(0x7a5a36, { roughness: 0.9 });
    const t = new THREE.Group(); t.position.set(x, 0, z); parent.add(t);
    for (const dx of [-1.5, 1.5]) for (const dz of [-2, 2]) this._box(t, 0.08, 9, 0.08, pipe, dx, 4.5, dz);
    for (let y = 2; y <= 8; y += 2) {
      for (const dx of [-1.5, 1.5]) this._box(t, 0.06, 0.06, 4, pipe, dx, y, 0);
      for (const dz of [-2, 2]) this._box(t, 3, 0.06, 0.06, pipe, 0, y, dz);
      this._box(t, 3, 0.06, 4, plank, 0, y + 0.06, 0);
    }
  }

  // gantry the drop obstacles sit on, across the road above one lane
  _gantry(z, cave) {
    const m = cave ? mat(0x6a4a2a, { roughness: 0.95 }) : mat(0x8a8f96, { metalness: 0.6, roughness: 0.4 });
    const half = cave ? 5.2 : 7.3;
    const g = new THREE.Group(); g.position.set(0, 0, z); this.chase.add(g);
    for (const x of [-half, half]) for (const dz of [-0.9, 0.9]) this._box(g, 0.14, 6.3, 0.14, m, x, 3.15, dz);
    for (const dz of [-0.9, 0.9]) this._box(g, half * 2, 0.14, 0.14, m, 0, 6.2, dz);
  }

  _rock(parent, r, x, y, z, m) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), m);
    rock.position.set(x, y, z);
    rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    rock.scale.set(rand(0.8, 1.25), rand(0.7, 1.1), rand(0.8, 1.25));
    rock.castShadow = true; rock.receiveShadow = true;
    parent.add(rock); return rock;
  }

  // A real-looking hill with a mine tunnel through it: a sculpted
  // cliff face with the mouth cut out, a rolling hilltop, and a
  // tunnel whose walls are bent with noise, with stalactites, rubble
  // and old timber supports. All rock is textured in code.
  _buildCave() {
    const rockT = rockMaps([104, 96, 88], 8, 11, 3.2);
    const dirtT = rockMaps([86, 70, 54], 16, 23, 1.8);
    const wood = woodTexture();
    this._caveTex = [rockT.map, rockT.normalMap, dirtT.map, dirtT.normalMap, wood];
    const rockMat = (rx, ry, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({
      map: repeated(rockT.map, rx, ry), normalMap: repeated(rockT.normalMap, rx, ry),
      normalScale: new THREE.Vector2(1.5, 1.5), roughness: 0.93, vertexColors: true,
    }, extra));

    // ---------- the mountain profile across x ----------
    // on the sea side (x > 8) the ground drops to the water (y -6),
    // so the hill's foot goes down to y -9, under the water line
    const baseY = (X) => -9 * smooth(9, 16, X);
    const mH = (X) => {
      const base = 42 * smooth(-105, -55, X) * (1 - smooth(25, 68, X));
      return baseY(X) + Math.max(0, base + (base > 2 ? 5 * fbm3(X * 0.045, 3.1, 1.7) : 0));
    };

    // ---------- tunnel shell ----------
    const C = 2.2, RW = 6.0, RH = 6.0;
    const shellScale = (bx, by, bz) =>
      1 + 0.2 * fbm3(bx * 0.22, by * 0.22, bz * 0.16) + 0.07 * fbm3(bx * 0.9 + 11, by * 0.9, bz * 0.9);
    const z0 = CAVE_Z + 0.8, z1 = CAVE_END - 3, len = z0 - z1;
    const sg = new THREE.CylinderGeometry(1, 1, len, 72, Math.round(len / 0.8), true);
    sg.rotateX(Math.PI / 2);
    sg.translate(0, 0, (z0 + z1) / 2);
    {
      const pos = sg.attributes.position;
      const col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const ux = pos.getX(i), uy = pos.getY(i), z = pos.getZ(i);
        const bx = ux * RW, by = C + uy * RH;
        const flare = clamp((z - (CAVE_Z - 5)) / 5, 0, 1);       // opens up at the mouth
        const s = 1 + (shellScale(bx, by, z) - 1) * (1 - 0.6 * flare) + 0.32 * flare;
        const X = bx * s;
        let Y = C + (by - C) * s;
        const inChasm = z < BRIDGE_NEAR + 0.4 && z > BRIDGE_FAR - 0.4;
        if (Y < 0.1) Y = inChasm ? CHASM_BOTTOM - 1 : -0.3;
        pos.setXYZ(i, X, Y, z);
        const n = fbm3(X * 0.5, Y * 0.5, z * 0.5);
        const band = 0.5 + 0.5 * Math.sin(Y * 1.7 + n * 2.4);       // rock layers
        let k = 0.66 + 0.24 * band + (s - 1) * 0.6;
        if (Y < 1.3) k *= 0.62;                                    // damp, dark base
        if (Y < -3) k *= 0.5;                                      // down in the chasm
        k = clamp(k, 0.25, 1.1);
        col[i * 3] = k; col[i * 3 + 1] = k * 0.95; col[i * 3 + 2] = k * 0.9;
      }
      sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
      sg.computeVertexNormals();
    }
    const shell = new THREE.Mesh(sg, rockMat(9, len / 6, { side: THREE.DoubleSide }));
    shell.receiveShadow = true;
    this.chase.add(shell);
    // ceiling height at (x, z), for hanging things
    const ceilAt = (x, z) => {
      const s = shellScale(0, C + RH, z);
      const ux = clamp(x / (RW * s), -0.95, 0.95);
      return C + RH * s * Math.sqrt(1 - ux * ux);
    };

    // ---------- floor (solid rock under a dirt path) ----------
    const slab = new THREE.MeshStandardMaterial({
      map: repeated(rockT.map, 3, 8), normalMap: repeated(rockT.normalMap, 3, 8), color: 0x5a524a, roughness: 0.95 });
    this._block(slab, -8, 8, CHASM_BOTTOM - 3, -0.03, BRIDGE_NEAR, CAVE_Z + 0.3);
    this._block(slab, -8, 8, CHASM_BOTTOM - 3, -0.03, CAVE_END - 3, BRIDGE_FAR);
    const floorPiece = (za, zb) => {
      const L = za - zb;
      const g = new THREE.PlaneGeometry(15, L, 30, Math.round(L));
      g.rotateX(-Math.PI / 2); g.translate(0, 0, (za + zb) / 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const edge = smooth(4.4, 6.5, Math.abs(x));                // bumps only at the sides
        p.setY(i, 0.005 + edge * (0.15 + 0.35 * (fbm3(x * 0.6, 1, z * 0.6) * 0.5 + 0.5)));
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
        map: repeated(dirtT.map, 3, L / 5), normalMap: repeated(dirtT.normalMap, 3, L / 5), roughness: 1 }));
      m.receiveShadow = true; this.chase.add(m);
    };
    floorPiece(CAVE_Z + 0.3, BRIDGE_NEAR);
    floorPiece(BRIDGE_FAR, CAVE_END - 3);
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(16, BRIDGE_NEAR - BRIDGE_FAR + 2),
      new THREE.MeshBasicMaterial({ color: 0x000000 }));
    pit.rotation.x = -Math.PI / 2; pit.position.set(0, CHASM_BOTTOM - 0.5, (BRIDGE_NEAR + BRIDGE_FAR) / 2);
    this.chase.add(pit);

    // ---------- cliff face with the mouth cut out ----------
    {
      const nx = 175, ny = 46;
      const cg = new THREE.PlaneGeometry(175, 1, nx, ny);
      cg.translate(-17.5, 0.5, 0);
      const p = cg.attributes.position;
      const col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const X0 = p.getX(i), t = p.getY(i);
        const top = mH(X0);
        const Y = lerp(baseY(X0), top, t);
        const near = 1 - Math.exp(-((X0 * X0) / 81 + ((Y - 3) * (Y - 3)) / 110));   // 0 at the mouth
        const n = fbm3(X0 * 0.15, Y * 0.15, 2.0) * 0.5 + 0.5;
        const zoff = -(0.8 + 2.8 * n) * (0.05 + 0.95 * near) * (1 - t * t) - t * t * 10;
        const X = X0 + fbm3(X0 * 0.2, Y * 0.2, 9) * 0.9 * near * (1 - t);
        p.setXYZ(i, X, Y, CAVE_Z + zoff);
        const k = clamp(0.62 + 0.3 * n + 0.15 * Math.sin(Y * 0.9 + n * 3), 0.35, 1.05);
        col[i * 3] = k; col[i * 3 + 1] = k * 0.96; col[i * 3 + 2] = k * 0.9;
      }
      // remove the triangles inside the mouth
      const idx = cg.index.array, keep = [];
      for (let i = 0; i < idx.length; i += 3) {
        let cx = 0, cy = 0;
        for (let j = 0; j < 3; j++) { cx += p.getX(idx[i + j]) / 3; cy += p.getY(idx[i + j]) / 3; }
        if ((cx / 6.6) ** 2 + ((cy - 1.0) / 8.0) ** 2 < 1) continue;
        keep.push(idx[i], idx[i + 1], idx[i + 2]);
      }
      cg.setIndex(keep);
      cg.setAttribute('color', new THREE.BufferAttribute(col, 3));
      cg.computeVertexNormals();
      const cliff = new THREE.Mesh(cg, rockMat(22, 6, { side: THREE.DoubleSide }));
      cliff.castShadow = true; cliff.receiveShadow = true;
      this.chase.add(cliff);
    }

    // ---------- rolling hilltop behind the cliff ----------
    {
      const tz0 = CAVE_Z - 10, TD = 205, tz1 = tz0 - TD;
      const tg = new THREE.PlaneGeometry(175, TD, 88, 102);
      tg.rotateX(-Math.PI / 2); tg.translate(-17.5, 0, (tz0 + tz1) / 2);
      const p = tg.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const X = p.getX(i), Z = p.getZ(i);
        const h = mH(X);
        const bY = baseY(X);
        const full = lerp(bY, h * (0.85 + 0.3 * fbm3(X * 0.02, 0.5, Z * 0.02)), smooth(tz1, tz1 + 55, Z))
          + (h > 2 ? 3.5 * fbm3(X * 0.1, 5, Z * 0.1) : 0);
        p.setY(i, Math.max(bY, lerp(h, full, smooth(tz0, tz0 - 14, Z))));
      }
      tg.computeVertexNormals();
      const nrm = tg.attributes.normal;
      const col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const flat = smooth(0.8, 0.95, nrm.getY(i));                 // flatter = dusty scrub
        const n = fbm3(p.getX(i) * 0.3, 2, p.getZ(i) * 0.3) * 0.5 + 0.5;
        const k = 0.6 + 0.3 * n;
        col[i * 3] = k * lerp(1, 0.75, flat); col[i * 3 + 1] = k * lerp(0.95, 0.85, flat); col[i * 3 + 2] = k * lerp(0.9, 0.6, flat);
      }
      tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const hill = new THREE.Mesh(tg, rockMat(20, 24));
      hill.castShadow = true; hill.receiveShadow = true;
      this.chase.add(hill);
    }

    // ---------- boulders ----------
    const boulderMat = rockMat(1.5, 1.5);
    const boulder = (r, x, y, z) => {
      const g = new THREE.IcosahedronGeometry(r, 3);
      const p = g.attributes.position;
      const col = new Float32Array(p.count * 3);
      const sx = rand(0.8, 1.3), sy = rand(0.6, 1.0), sz = rand(0.8, 1.3), seed = rand(0, 100);
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
        const d = 1 + 0.28 * fbm3(vx / r * 1.6 + seed, vy / r * 1.6, vz / r * 1.6);
        p.setXYZ(i, vx * d * sx, vy * d * sy, vz * d * sz);
        const k = clamp(0.55 + 0.45 * (d - 0.8), 0.35, 1);
        col[i * 3] = k; col[i * 3 + 1] = k * 0.95; col[i * 3 + 2] = k * 0.9;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, boulderMat);
      m.position.set(x, y, z); m.rotation.y = rand(0, 6.28);
      m.castShadow = true; m.receiveShadow = true;
      this.chase.add(m); return m;
    };
    // at the foot of the cliff (kept off the road)
    for (let i = 0; i < 16; i++) {
      const s = Math.random() < 0.5 ? -1 : 1;
      const x = s * rand(9.5, 40) + (s < 0 ? -rand(0, 30) : 0);
      boulder(rand(1.2, 3.2), x, rand(-0.3, 0.4), CAVE_Z + rand(0.5, 4));
    }
    // around the mouth
    for (const [x, y, r] of [[-8.2, 0.6, 1.8], [8.4, 0.5, 1.6], [-7.6, 6.5, 1.3], [7.8, 7.2, 1.2], [-4.5, 9.8, 1.4], [5.2, 10.1, 1.5]]) {
      boulder(r, x, y, CAVE_Z + 0.4);
    }
    // rubble along the tunnel walls (outside the running lanes)
    for (let z = CAVE_Z - 3; z > CAVE_END + 4; z -= rand(2, 3.5)) {
      if (z < BRIDGE_NEAR + 2 && z > BRIDGE_FAR - 2) continue;
      for (const s of [-1, 1]) if (Math.random() < 0.7) boulder(rand(0.3, 0.75), s * rand(5.0, 5.6), 0.05, z);
    }
    // the cave narrows to the bridge
    for (let z = NARROW_Z - 2; z > BRIDGE_NEAR + 1; z -= 2.6) {
      for (const s of [-1, 1]) boulder(rand(1.2, 1.5), s * 4.5, rand(0.4, 1.4), z);
    }

    // ---------- find the real ceiling (ray up to the tunnel wall) ----------
    shell.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const up = new THREE.Vector3(0, 1, 0);
    const ceilHit = (x, z) => {
      ray.set(new THREE.Vector3(x, 1.5, z), up);
      const h = ray.intersectObject(shell, false);
      return h.length ? h[0].point.y : ceilAt(x, z);
    };

    // ---------- stalactites, each one starting inside the rock ----------
    const stalM = new THREE.MeshStandardMaterial({ color: 0x6e655b, roughness: 0.6, metalness: 0.05 });
    for (let z = CAVE_Z - 4; z > CAVE_END + 3; z -= 1.3) {
      if (Math.random() < 0.45) continue;
      const x = rand(-4.4, 4.4), zz = z + rand(-0.5, 0.5), L = rand(0.3, 1.1);
      const top = ceilHit(x, zz);
      const st = new THREE.Mesh(new THREE.ConeGeometry(rand(0.07, 0.2), L + 0.4, 7), stalM);
      st.rotation.x = Math.PI;
      st.position.set(x, top - (L + 0.4) / 2 + 0.4, zz);
      this.chase.add(st);
    }

    // ---------- work lights hanging on wires from the ceiling ----------
    const wireM = mat(0x111111);
    const bulbM = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc27a, emissiveIntensity: 3 });
    for (let z = CAVE_Z - 4; z > BRIDGE_NEAR; z -= 8) {
      const top = ceilHit(0, z);
      const y = Math.max(5.6, top - 1.0);
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, top - y + 0.3, 5), wireM);
      w.position.set(0, (top + y) / 2 + 0.15, z); this.chase.add(w);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), bulbM);
      b.position.set(0, y, z); this.chase.add(b);
    }
    for (const z of [CAVE_Z - 8, -186, -218, -246]) {
      const pl = new THREE.PointLight(0xffc27a, 45, 34, 1.4);
      pl.position.set(0, Math.max(5.4, ceilHit(0, z) - 1.2), z); this.chase.add(pl);
    }
    const far = new THREE.PointLight(0x7fa8ff, 10, 30, 1.6);
    far.position.set(0, 5, CAVE_END + 12); this.chase.add(far);

    // ---------- signs, standing on round posts ----------
    const postM = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.95 });
    const post = (x, h, z) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, h, 10), postM);
      p.position.set(x, h / 2, z); p.castShadow = true; this.chase.add(p);
    };
    this._signBoard(this.chase, ['DANGER', 'OLD MINE - KEEP OUT'], '#f4f4f0', '#b8261c', 2.6, 1.1, -9.6, 1.7, CAVE_Z + 3.2, 0.35);
    const unsafe = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshStandardMaterial({
      map: signTexture(['DANGER', 'BRIDGE UNSAFE'], '#b8261c', '#ffffff'), roughness: 0.7,
      emissive: 0x330000, emissiveIntensity: 0.6 }));
    unsafe.position.set(-3.0, 1.5, BRIDGE_NEAR + 6); unsafe.rotation.y = 0.35; this.chase.add(unsafe);
    post(-3.0, 1.15, BRIDGE_NEAR + 5.97);
  }

  _buildBridge() {
    const wood = mat(0x6b4a2b, { roughness: 0.95 });
    const rope = mat(0xa08a62, { roughness: 1 });
    this.planks = [];
    const n = 12, len = BRIDGE_NEAR - BRIDGE_FAR;
    for (let i = 0; i < n; i++) {
      const z = BRIDGE_NEAR - (i + 0.5) * (len / n);
      const sag = Math.sin(Math.PI * (i + 0.5) / n) * 0.12;
      const p = this._box(this.chase, 3.4, 0.12, len / n - 0.12, wood, rand(-0.05, 0.05), -0.06 - sag, z);
      p.rotation.y = rand(-0.04, 0.04);
      this.planks.push({ mesh: p, vel: new THREE.Vector3(), spin: new THREE.Vector3(), delay: 0 });
    }
    this.ropes = [];
    for (const x of [-1.9, 1.9]) {
      for (const z of [BRIDGE_NEAR - 0.1, BRIDGE_FAR + 0.1]) {
        const pst = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.5, 10), wood);
        pst.position.set(x, 0.6, z); pst.castShadow = true; this.chase.add(pst);
      }
      for (const y of [1.05, 0.55]) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 6), rope);
        r.rotation.x = Math.PI / 2; r.position.set(x, y, (BRIDGE_NEAR + BRIDGE_FAR) / 2);
        this.chase.add(r);
        this.ropes.push({ mesh: r, vel: new THREE.Vector3(), spin: new THREE.Vector3() });
      }
    }
  }

  // shared, generated textures/materials for the obstacles
  _obsMaterials() {
    if (this._om) return this._om;
    const concrete = rockMaps([156, 152, 144], 8, 31, 1.4, 128);
    const rust = rockMaps([122, 66, 36], 8, 41, 2.2, 128);
    const paint = rockMaps([66, 92, 60], 4, 51, 1.1, 128);       // weathered green skip paint
    const paper = rockMaps([200, 190, 164], 4, 61, 0.5, 128);
    const rockT = rockMaps([104, 96, 88], 8, 11, 3.2, 128);
    const woodT = woodTexture();
    this._obsTex = [concrete, rust, paint, paper, rockT].flatMap((t) => [t.map, t.normalMap]).concat([woodT]);
    const tm = (t, rx, ry, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({
      map: repeated(t.map, rx, ry), normalMap: repeated(t.normalMap, rx, ry), roughness: 0.9 }, extra));
    this._om = {
      concrete: tm(concrete, 1, 2, { side: THREE.DoubleSide }),
      rust: tm(rust, 4, 1, { metalness: 0.45, roughness: 0.7 }),
      skip: tm(paint, 2, 1, { metalness: 0.35, roughness: 0.7, side: THREE.DoubleSide }),
      paper: tm(paper, 1, 1, { roughness: 1 }),
      rock: tm(rockT, 1.5, 1.5, { vertexColors: true, roughness: 0.95 }),
      wood: new THREE.MeshStandardMaterial({ map: woodT, roughness: 0.95 }),
      orange: new THREE.MeshStandardMaterial({ color: 0xff5a0a, roughness: 0.45 }),
      reflect: new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.25, emissive: 0x6a6a6a, side: THREE.DoubleSide }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }),
      red: new THREE.MeshStandardMaterial({ color: 0xc22a1e, roughness: 0.45 }),
      white: new THREE.MeshStandardMaterial({ color: 0xecebe6, roughness: 0.45 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.7, roughness: 0.4 }),
      brick: new THREE.MeshStandardMaterial({ color: 0x8a4a32, roughness: 0.95 }),
      water: new THREE.MeshStandardMaterial({ color: 0x0a121c, roughness: 0.04, metalness: 0.85, transparent: true, opacity: 0.88 }),
    };
    return this._om;
  }

  // a real road sign: metal board (text on the front only) on two round poles
  _signBoard(parent, lines, bg, fg, w, h, x, y, z, ry) {
    const face = new THREE.MeshStandardMaterial({
      map: signTexture(lines, bg, fg, 768, Math.round((768 * h) / w)), roughness: 0.5, emissive: 0x161616 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.45 });
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; parent.add(b);
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), [metal, metal, metal, metal, face, metal]);
    board.position.y = y; board.castShadow = true; b.add(board);
    const ph = y + h / 2 - 0.05;
    for (const px of [-w * 0.32, w * 0.32]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, ph, 10), metal);
      pole.position.set(px, ph / 2, -0.05); pole.castShadow = true; b.add(pole);
    }
    return b;
  }

  _mesh(parent, geo, m, x = 0, y = 0, z = 0) {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true;
    parent.add(o); return o;
  }

  // =========================================================
  // BUILD — obstacles (realistic construction-site props)
  // =========================================================
  _makeObstacle(type) {
    const M = this._obsMaterials();
    const g = new THREE.Group();
    let low = true, halfW = 0.4;
    const V2 = (x, y) => new THREE.Vector2(x, y);
    switch (type) {
      case 'cone': {          // traffic cone: square rubber base, tapered body, two reflective bands
        this._mesh(g, new RoundedBoxGeometry(0.46, 0.04, 0.46, 2, 0.015), M.rubber, 0, 0.02, 0);
        const body = new THREE.LatheGeometry([V2(0.17, 0.04), V2(0.16, 0.1), V2(0.045, 0.74), V2(0.028, 0.765), V2(0, 0.77)], 24);
        this._mesh(g, body, M.orange);
        const r = (y) => 0.16 - (y - 0.1) * (0.115 / 0.64) + 0.003;
        this._mesh(g, new THREE.CylinderGeometry(r(0.55), r(0.45), 0.1, 24, 1, true), M.reflect, 0, 0.5, 0);
        this._mesh(g, new THREE.CylinderGeometry(r(0.36), r(0.28), 0.08, 24, 1, true), M.reflect, 0, 0.32, 0);
        halfW = 0.25; break;
      }
      case 'barrier': {       // plastic water-filled road barrier, red + white sections
        const s = new THREE.Shape([V2(-0.3, 0), V2(0.3, 0), V2(0.3, 0.08), V2(0.17, 0.3), V2(0.12, 0.8), V2(-0.12, 0.8), V2(-0.17, 0.3), V2(-0.3, 0.08)]);
        const eg = new THREE.ExtrudeGeometry(s, { depth: 1.04, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2 });
        eg.translate(0, 0, -0.52); eg.rotateY(Math.PI / 2);
        this._mesh(g, eg, M.red, -0.55, 0, 0);
        this._mesh(g, eg, M.white, 0.55, 0, 0);
        for (const x of [-0.55, 0.55]) this._mesh(g, new THREE.CylinderGeometry(0.07, 0.07, 0.04, 14), M.rubber, x, 0.83, 0);
        halfW = 1.12; break;
      }
      case 'bags': {          // cement sacks stacked on a wooden pallet
        for (const z of [-0.42, 0, 0.42]) this._mesh(g, new THREE.BoxGeometry(1.2, 0.1, 0.1), M.wood, 0, 0.05, z);
        for (let i = 0; i < 5; i++) this._mesh(g, new THREE.BoxGeometry(0.14, 0.025, 1.0), M.wood, -0.52 + i * 0.26, 0.112, 0);
        const sack = new RoundedBoxGeometry(0.58, 0.15, 0.38, 3, 0.065);
        for (let layer = 0; layer < 3; layer++) {
          const y = 0.2 + layer * 0.145;
          const across = layer % 2 === 1;
          for (let k = 0; k < (layer === 2 ? 2 : 3); k++) {
            const sk = this._mesh(g, sack, M.paper);
            if (across) { sk.rotation.y = Math.PI / 2 + rand(-0.06, 0.06); sk.position.set(-0.38 + k * 0.4, y, 0); }
            else { sk.rotation.y = rand(-0.06, 0.06); sk.position.set(rand(-0.3, 0.3) * (layer === 2 ? 1 : 0), y, -0.4 + k * 0.4); }
            sk.scale.set(rand(0.95, 1.05), rand(0.9, 1.08), 1);
          }
        }
        halfW = 0.65; break;
      }
      case 'beam': {          // rusty steel I-beam resting on two road sawhorses
        const ib = new THREE.Shape([V2(-0.1, 0), V2(0.1, 0), V2(0.1, 0.025), V2(0.008, 0.025), V2(0.008, 0.275), V2(0.1, 0.275),
          V2(0.1, 0.3), V2(-0.1, 0.3), V2(-0.1, 0.275), V2(-0.008, 0.275), V2(-0.008, 0.025), V2(-0.1, 0.025)]);
        const len = STREET_HALF * 2 - 0.4;
        const bg = new THREE.ExtrudeGeometry(ib, { depth: len, bevelEnabled: false });
        bg.translate(0, 0, -len / 2); bg.rotateY(Math.PI / 2);
        const b = this._mesh(g, bg, M.rust, 0, 0.62, 0); b.rotation.x = 0.02;
        const board = new THREE.MeshStandardMaterial({ map: stripeTexture('#c8261c', '#f2f2f2'), roughness: 0.4 });
        for (const x of [-(STREET_HALF - 1.1), STREET_HALF - 1.1]) {
          for (const s of [-1, 1]) for (const dz of [-0.28, 0.28]) {
            const leg = this._mesh(g, new THREE.CylinderGeometry(0.025, 0.025, 0.68, 8), M.steel, x + s * 0.45, 0.31, dz * 0.5);
            leg.rotation.x = dz > 0 ? -0.35 : 0.35;
          }
          this._mesh(g, new THREE.BoxGeometry(1.2, 0.2, 0.03), board, x, 0.5, 0.16);
          this._mesh(g, new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), M.steel, x, 0.61, 0).rotation.z = Math.PI / 2;
        }
        halfW = STREET_HALF; break;
      }
      case 'timber': {        // fallen round log across the cave path
        const log = this._mesh(g, new THREE.CylinderGeometry(0.22, 0.27, CAVE_HALF * 2 - 0.3, 16), M.wood, 0, 0.25, 0);
        log.rotation.z = Math.PI / 2 + 0.03; log.rotation.x = 0.05;
        for (const x of [-CAVE_HALF + 0.6, CAVE_HALF - 0.9]) g.add(makeRock(0.35, M.rock, x, 0.15, 0.35));
        halfW = CAVE_HALF; break;
      }
      case 'skip': {          // open-top skip: thin steel walls, sloped ends, rim, rubble heaped inside
        const paint = M.skip;
        // long sides (trapezoids), 5 cm steel
        const side = new THREE.Shape([V2(-1.3, 0), V2(1.3, 0), V2(1.7, 1.32), V2(-1.7, 1.32)]);
        const sideG = new THREE.ExtrudeGeometry(side, { depth: 0.05, bevelEnabled: false });
        sideG.rotateY(Math.PI / 2);
        for (const sx of [-1, 1]) this._mesh(g, sideG, paint, sx * 0.95 - 0.025, 0.08, 0);
        // sloped ends
        const slant = Math.hypot(0.4, 1.32), tilt = Math.atan2(0.4, 1.32);
        for (const sz of [-1, 1]) {
          const e = this._mesh(g, new THREE.BoxGeometry(1.9, slant, 0.05), paint, 0, 0.08 + 0.66, sz * 1.5);
          e.rotation.x = sz * tilt;
        }
        // floor + steel skids underneath
        this._mesh(g, new THREE.BoxGeometry(1.9, 0.06, 2.6), paint, 0, 0.11, 0);
        for (const sx of [-0.6, 0.6]) this._mesh(g, new THREE.BoxGeometry(0.14, 0.08, 2.5), M.steel, sx, 0.04, 0);
        // rounded rim along the top edge
        for (const sx of [-1, 1]) {
          const r = this._mesh(g, new THREE.CylinderGeometry(0.045, 0.045, 3.4, 10), paint, sx * 0.95, 1.41, 0);
          r.rotation.x = Math.PI / 2;
        }
        for (const sz of [-1, 1]) {
          const r = this._mesh(g, new THREE.CylinderGeometry(0.045, 0.045, 1.95, 10), paint, 0, 1.41, sz * 1.7);
          r.rotation.z = Math.PI / 2;
        }
        // lifting lugs
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          this._mesh(g, new THREE.TorusGeometry(0.08, 0.022, 8, 14), M.steel, sx * 1.0, 1.1, sz * 1.1).rotation.y = Math.PI / 2;
        }
        // heap of rubble filling it
        const hg = new THREE.PlaneGeometry(1.86, 3.1, 18, 30);
        hg.rotateX(-Math.PI / 2);
        const hp = hg.attributes.position;
        for (let i = 0; i < hp.count; i++) {
          const x = hp.getX(i), z = hp.getZ(i);
          const dome = Math.max(0, (1 - (x / 0.95) ** 2)) * Math.max(0, (1 - (z / 1.6) ** 2));
          hp.setY(i, 1.0 + 0.5 * dome + 0.12 * fbm3(x * 2.5, 7, z * 2.5) * dome);
        }
        hg.computeVertexNormals();
        const heapCol = new Float32Array(hp.count * 3);
        for (let i = 0; i < hp.count; i++) { const k = 0.55 + 0.35 * (fbm3(hp.getX(i) * 3, 1, hp.getZ(i) * 3) * 0.5 + 0.5); heapCol[i * 3] = k; heapCol[i * 3 + 1] = k * 0.95; heapCol[i * 3 + 2] = k * 0.88; }
        hg.setAttribute('color', new THREE.BufferAttribute(heapCol, 3));
        this._mesh(g, hg, M.rock);
        const heapY = (x, z) => 1.0 + 0.5 * Math.max(0, 1 - (x / 0.95) ** 2) * Math.max(0, 1 - (z / 1.6) ** 2);
        for (let i = 0; i < 10; i++) { const x = rand(-0.6, 0.6), z = rand(-1.2, 1.2); g.add(makeRock(rand(0.14, 0.3), M.rock, x, heapY(x, z), z)); }
        for (let i = 0; i < 7; i++) {
          const x = rand(-0.6, 0.6), z = rand(-1.1, 1.1);
          const br = this._mesh(g, new THREE.BoxGeometry(0.22, 0.07, 0.11), M.brick, x, heapY(x, z) + 0.03, z);
          br.rotation.set(rand(-0.4, 0.4), rand(0, 3), rand(-0.4, 0.4));
        }
        const pl = this._mesh(g, new THREE.BoxGeometry(0.14, 0.03, 2.0), M.wood, 0.25, 1.55, -0.3); pl.rotation.set(0.32, 0.25, 0.08);
        low = false; halfW = 1.05; break;
      }
      case 'pipes': {         // thick-walled concrete pipes, stacked and chocked
        // real culvert size: 1.44 m across, 2.4 m long, 10 cm walls, wider socket at one end
        const ring = new THREE.LatheGeometry([V2(0.62, -1.2), V2(0.72, -1.2), V2(0.72, 0.92), V2(0.8, 0.98), V2(0.8, 1.2),
          V2(0.68, 1.2), V2(0.68, 1.0), V2(0.62, 0.98), V2(0.62, -1.2)], 36);
        const top = 0.72 + Math.sqrt(1.44 * 1.44 - 0.76 * 0.76);
        [[-0.76, 0.72, 0], [0.76, 0.72, Math.PI], [0, top, 0]].forEach(([x, y, flip]) => {
          const p = this._mesh(g, ring, M.concrete, x, y, 0); p.rotation.set(Math.PI / 2 + flip, rand(-0.03, 0.03), 0);
        });
        for (const x of [-1.5, 1.5]) for (const z of [-0.9, 0.9]) {
          const w = this._mesh(g, new THREE.CylinderGeometry(0.0, 0.16, 0.3, 3), M.wood, x, 0.1, z);   // wooden wedges
          w.rotation.set(Math.PI / 2, 0, x > 0 ? Math.PI / 2 : -Math.PI / 2);
        }
        low = false; halfW = 1.48; break;
      }
      case 'barrels': {       // three traffic drums
        for (const [x, z] of [[-0.34, 0.16], [0.34, 0.16], [0, -0.36]]) {
          this._mesh(g, new THREE.CylinderGeometry(0.4, 0.42, 0.06, 20), M.rubber, x, 0.03, z);
          this._mesh(g, new THREE.CylinderGeometry(0.27, 0.3, 0.92, 22), M.orange, x, 0.52, z);
          for (const y of [0.62, 0.82]) this._mesh(g, new THREE.CylinderGeometry(0.276, 0.282, 0.09, 22, 1, true), M.reflect, x, y, z);
          this._mesh(g, new THREE.TorusGeometry(0.29, 0.015, 6, 22), M.orange, x, 0.4, z).rotation.x = Math.PI / 2;
        }
        low = false; halfW = 0.72; break;
      }
      case 'rockLow': {
        g.add(makeRock(0.62, M.rock, 0, 0.18, 0, 1.6, 0.7, 1.0));
        halfW = 1.0; break;
      }
      case 'rockTall': {
        g.add(makeRock(1.0, M.rock, 0, 0.95, 0, 1.15, 1.35, 1.0));
        low = false; halfW = 1.1; break;
      }
      case 'puddle': {        // irregular dark puddle
        const cg = new THREE.CircleGeometry(1.15, 40);
        const p = cg.attributes.position;
        for (let i = 1; i < p.count; i++) {
          const a = Math.atan2(p.getY(i), p.getX(i));
          const k = 1 + 0.22 * Math.sin(a * 3 + 1.3) + 0.12 * Math.sin(a * 7);
          p.setXY(i, p.getX(i) * k, p.getY(i) * k * 1.3);
        }
        const w = new THREE.Mesh(cg, M.water);
        w.rotation.x = -Math.PI / 2; w.position.y = 0.02; w.receiveShadow = true; g.add(w);
        halfW = 1.1; break;
      }
    }
    return { group: g, low, halfW };
  }

  _buildObstacles() {
    for (const d of LAYOUT) {
      const inCave = d.z < CAVE_Z;
      const made = this._makeObstacle(d.type);
      const x = d.wide ? 0 : LANES[d.lane];
      const o = {
        type: d.type, mesh: made.group, x, z: d.z,
        low: made.low, wide: !!d.wide, halfW: made.halfW,
        puddle: d.type === 'puddle', drop: !!d.drop,
        state: d.drop ? 'up' : 'down',
        box: new THREE.Box3(), knocked: false, kt: 0, splashed: false,
        vel: new THREE.Vector3(), spin: new THREE.Vector3(), vy: 0,
      };
      made.group.position.set(x, 0, d.z);
      made.group.rotation.y = d.wide ? 0 : rand(-0.12, 0.12);
      this.chase.add(made.group);
      made.group.updateMatrixWorld(true);
      o.box.setFromObject(made.group);
      if (d.drop) {
        made.group.position.y = 6.3;          // sits on the gantry
        this._gantry(d.z, inCave);
      }
      this.obstacles.push(o);
    }
  }

  _buildAvatars() {
    this.cop = makeRunner({ kind: 'cop', skin: 0x6b4630, top: 0x1d2c4f, pants: 0x121a2c, shoes: 0x0a0a0a, sleeves: true });
    this.crook = makeRunner({ kind: 'crook', skin: 0x8a5a3c, top: 0x2b2b2e, pants: 0x2c3e66, shoes: 0xdedede, sleeves: true });
    for (const r of [this.cop, this.crook]) { r.root.rotation.y = Math.PI; r.root.scale.setScalar(CHAR_SCALE); this.chase.add(r.root); }
    this.cop.root.position.set(this.px, 0, this.pz);
    this.crook.root.position.set(this.crim.x, 0, this.crim.z);

    // handcuffs (hidden until the arrest)
    const steel = new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 0.95, roughness: 0.25 });
    this.cuffs = new THREE.Group();
    this.cuffRings = [];
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065 * CHAR_SCALE, 0.016 * CHAR_SCALE, 8, 18), steel);
      this.cuffs.add(ring); this.cuffRings.push(ring);
    }
    this.cuffChain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 6), steel);
    this.cuffs.add(this.cuffChain);
    this.cuffs.visible = false;
    this.chase.add(this.cuffs);

    // torch light that follows you inside the cave
    this.torch = new THREE.PointLight(0xfff2dc, 0, 32, 1.3);
    this.chase.add(this.torch);
  }

  // =========================================================
  // UI
  // =========================================================
  _buildUI() {
    const css = document.createElement('style');
    css.textContent = `
      .ch-hud{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:60;
        font-family:'Courier New',monospace;color:#f2e6c8;text-align:center;pointer-events:none;
        background:rgba(8,10,16,.62);border:1px solid #3c4656;padding:8px 14px;width:min(440px,86vw);box-sizing:border-box}
      .ch-row{display:flex;align-items:center;gap:10px;font-size:13px;letter-spacing:2px}
      .ch-bar{flex:1;height:12px;background:#1a1f2a;border:1px solid #3c4656;position:relative;overflow:hidden}
      .ch-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:#f2b84b;transition:background .2s}
      .ch-sub{font-size:11px;letter-spacing:1px;color:#9fb0c6;margin-top:5px}
      .ch-hint{position:fixed;left:14px;bottom:14px;z-index:60;pointer-events:none;font-family:'Courier New',monospace;
        background:rgba(8,10,16,.72);border:1px solid #3c4656;padding:10px 12px;color:#e8e2d2;font-size:12px;letter-spacing:1px}
      .ch-hint .r{display:flex;align-items:center;gap:8px;margin:5px 0}
      .ch-k{display:inline-block;min-width:26px;padding:3px 6px;text-align:center;border:1px solid #f2b84b;border-bottom-width:3px;
        border-radius:4px;color:#f2b84b;font-weight:bold;background:#11151d}
      .ch-k.w{min-width:84px}
      .ch-center .ck{margin-top:18px;font-size:15px;letter-spacing:1px;color:#e8e2d2}
      .ch-center{position:fixed;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;
        z-index:61;pointer-events:none;font-family:'Courier New',monospace;color:#fff;text-align:center;padding:0 16px}
      .ch-center h1{font-size:clamp(40px,12vw,120px);margin:0;color:#f2b84b;text-shadow:0 0 18px rgba(242,184,75,.6)}
      .ch-center h2{font-size:clamp(20px,4vw,34px);letter-spacing:5px;margin:0 0 12px;color:#f2b84b}
      .ch-center p{max-width:min(620px,90vw);line-height:1.7;font-size:15px;margin:4px 0;color:#e8e2d2}
      .ch-card{background:rgba(8,10,16,.8);border:1px solid #3c4656;padding:22px 26px}
      .ch-end{position:fixed;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;
        z-index:19990;font-family:'Courier New',monospace;color:#fff;text-align:center;background:rgba(0,0,0,.66);padding:0 16px}
      .ch-end h2{font-size:clamp(24px,5vw,44px);letter-spacing:6px;margin:0 0 14px}
      .ch-end p{max-width:min(640px,90vw);line-height:1.7;font-size:16px;margin:4px 0}
      .ch-end button{font:inherit;padding:12px 24px;margin:18px 8px 0;border:0;cursor:pointer;letter-spacing:2px}
      .ch-end.win{background:radial-gradient(ellipse at 50% 40%,rgba(40,30,8,.82),rgba(0,0,0,.9));animation:chWinIn .5s ease}
      .ch-win-kick{font-size:clamp(14px,2.4vw,20px);letter-spacing:12px;color:#f2b84b;margin-bottom:6px;
        text-shadow:0 0 18px rgba(242,184,75,.8);animation:chGlow 1.6s ease-in-out infinite alternate}
      .ch-stamp{display:inline-block;font-size:clamp(34px,8vw,78px);font-weight:bold;letter-spacing:6px;color:#e0362a;
        border:6px solid #e0362a;padding:4px 22px;margin:6px 0 16px;transform:rotate(-6deg);
        text-shadow:0 0 14px rgba(224,54,42,.5);animation:chSlam .55s cubic-bezier(.2,1.6,.4,1) .15s both}
      .ch-congrats{font-size:clamp(20px,3.4vw,30px)!important;letter-spacing:3px!important;color:#ffe08a;margin:4px 0 10px!important;
        animation:chUp .6s ease .6s both}
      .ch-motive{animation:chUp .6s ease .85s both}
      .ch-theend{margin-top:10px;letter-spacing:8px;color:#9fb0c6;font-size:13px;animation:chUp .6s ease 1.1s both}
      .ch-confetti{position:fixed;inset:0;pointer-events:none;z-index:19995;overflow:hidden}
      .ch-confetti i{position:absolute;top:-24px;display:block;border-radius:2px;opacity:.95;
        animation-name:chFall;animation-timing-function:linear;animation-iteration-count:infinite}
      @keyframes chFall{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(var(--dx),110vh) rotate(var(--r))}}
      @keyframes chSlam{0%{opacity:0;transform:rotate(-6deg) scale(2.6)}70%{opacity:1;transform:rotate(-6deg) scale(.94)}100%{transform:rotate(-6deg) scale(1)}}
      @keyframes chUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
      @keyframes chGlow{from{text-shadow:0 0 8px rgba(242,184,75,.4)}to{text-shadow:0 0 26px rgba(242,184,75,1)}}
      @keyframes chWinIn{from{opacity:0}to{opacity:1}}
      .ch-flash{position:fixed;inset:0;pointer-events:none;z-index:59;opacity:0;
        box-shadow:inset 0 0 140px 40px rgba(200,20,20,.85);transition:opacity .25s}
      .ch-fade{position:fixed;inset:0;pointer-events:none;z-index:62;background:#000;opacity:0;transition:opacity .9s}
    `;
    const hud = document.createElement('div'); hud.className = 'ch-hud';
    hud.innerHTML = `
      <div class="ch-row"><span>SUSPECT</span><div class="ch-bar"><div class="ch-fill"></div></div><span class="ch-gap">26 m</span></div>
      <div class="ch-sub"></div>`;
    const hint = document.createElement('div'); hint.className = 'ch-hint';
    hint.innerHTML = `
      <div class="r"><span class="ch-k">A</span><span class="ch-k">D</span> change lane (left / right)</div>
      <div class="r"><span class="ch-k w">SPACE</span> jump</div>
      <div class="r"><span class="ch-k">V</span> first / third person</div>
      <div class="r"><span class="ch-k">P</span> pause</div>`;
    const center = document.createElement('div'); center.className = 'ch-center';
    const end = document.createElement('div'); end.className = 'ch-end';
    const flash = document.createElement('div'); flash.className = 'ch-flash';
    const fade = document.createElement('div'); fade.className = 'ch-fade';
    for (const el of [css, hud, hint, center, end, flash, fade]) document.body.appendChild(el);
    this.ui = {
      css, hud, hint, center, end, flash, fade,
      fill: hud.querySelector('.ch-fill'), gap: hud.querySelector('.ch-gap'), sub: hud.querySelector('.ch-sub'),
    };
    this._centerKey = '';
  }

  _setCenter(key, html) {
    if (this._centerKey === key) return;
    this._centerKey = key;
    if (!html) { this.ui.center.style.display = 'none'; return; }
    this.ui.center.innerHTML = html;
    this.ui.center.style.display = 'flex';
  }

  _updateHud() {
    const gap = Math.max(0, this.pz - this.crim.z);
    const close = 1 - clamp((gap - CATCH_GAP) / 26, 0, 1);
    this.ui.fill.style.width = `${(close * 100).toFixed(1)}%`;
    this.ui.fill.style.background = close > 0.75 ? '#5fe08a' : (close > 0.4 ? '#f2b84b' : '#e0533a');
    this.ui.gap.textContent = `${gap.toFixed(0)} m`;
    const toBridge = Math.max(0, this.crim.z - BRIDGE_FAR);
    const sub = this.bridgeBroken
      ? 'THE BRIDGE IS DOWN'
      : `He reaches the bridge in ${toBridge.toFixed(0)} m  ·  hits ${this.hits}  ·  ${this.view === 'third' ? '3rd' : '1st'} person [V]`;
    if (sub !== this._lastSub) { this.ui.sub.textContent = sub; this._lastSub = sub; }
  }

  _flashHit() {
    this.ui.flash.style.opacity = '1';
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => { if (this.ui) this.ui.flash.style.opacity = '0'; }, 160);
  }

  _end(kind) {
    if (this.endOpen) return;
    this.endOpen = true;
    window.__uiCapture = true;
    try { if (document.exitPointerLock) document.exitPointerLock(); } catch (e) {}
    this.ui.hint.style.display = 'none';
    this._setCenter('', null);
    const t = this.runTime.toFixed(1);
    let html;
    if (kind === 'win') {
      const e = endingStory();
      this.ui.end.classList.add('win');
      this._confetti();
      html = `<div class="ch-win-kick">YOU WIN</div>
        <div class="ch-stamp">CASE CLOSED</div>
        <h2 class="ch-congrats">Congratulations, Detective</h2>
        <p class="ch-motive">${e.summary}</p>
        <p><b style="color:#5fe08a">${e.name} is in custody.</b></p>
        <p style="color:#9fb0c6;font-size:13px">Chase ${t} s &nbsp;·&nbsp; hits ${this.hits}</p>
        <div class="ch-theend">— THE END —</div>`;
    } else if (kind === 'fell') {
      html = `<h2 style="color:#e0533a">YOU FELL</h2>
        <p>The bridge was gone. You jumped after him and fell into the chasm.</p>
        <p style="color:#9fb0c6">Catch him before he reaches the bridge.</p>`;
    } else {
      html = `<h2 style="color:#e0533a">HE GOT AWAY</h2>
        <p>The suspect crossed the old bridge and brought it down behind him.</p>
        <p style="color:#9fb0c6">Hits ${this.hits} &nbsp;·&nbsp; dodge more to close the gap.</p>`;
    }
    html += `<div>
        <button data-a="again" style="background:#f2b84b;color:#111">${kind === 'win' ? 'REPLAY THE CHASE' : 'PLAY AGAIN'} [ENTER]</button>
        <button data-a="menu" style="background:#2a3342;color:#f2e6c8">MAIN MENU</button>
      </div>`;
    this.ui.end.innerHTML = html;
    this.ui.end.style.display = 'flex';
    this.ui.end.querySelector('[data-a="again"]').addEventListener('click', () => this._again());
    this.ui.end.querySelector('[data-a="menu"]').addEventListener('click', () => this._menu());
  }

  // gold and white paper falling over the win screen
  _confetti() {
    const box = document.createElement('div');
    box.className = 'ch-confetti';
    const cols = ['#f2b84b', '#ffe08a', '#ffffff', '#5fe08a', '#e0362a'];
    for (let i = 0; i < 90; i++) {
      const p = document.createElement('i');
      const w = 5 + Math.random() * 7;
      p.style.cssText = `left:${Math.random() * 100}%;width:${w}px;height:${w * (1.4 + Math.random())}px;` +
        `background:${cols[i % cols.length]};animation-duration:${2.6 + Math.random() * 2.4}s;` +
        `animation-delay:${Math.random() * 1.6}s;--dx:${(Math.random() - 0.5) * 220}px;--r:${(Math.random() - 0.5) * 1440}deg`;
      box.appendChild(p);
    }
    document.body.appendChild(box);
    this.ui.confetti = box;
  }

  _again() {
    if (typeof window.__restartLevel === 'function') window.__restartLevel();
    else if (typeof window.__switchLevel === 'function') window.__switchLevel(3);
  }

  _menu() {
    if (typeof window.__showMenu === 'function') window.__showMenu();
  }

  // =========================================================
  // STORY (before the countdown)
  // =========================================================
  _buildStory(lines = STORY, heading = `LEVEL 3 &nbsp;·&nbsp; THE CITY OF ${GEN}`) {
    const css = document.createElement('style');
    css.textContent = `
      .ch-bars:before,.ch-bars:after{content:'';position:fixed;left:0;right:0;height:11vh;background:#000;z-index:63}
      .ch-bars:before{top:0}.ch-bars:after{bottom:0}
      .ch-story{position:fixed;left:50%;bottom:13vh;transform:translateX(-50%);z-index:64;width:min(760px,90vw);
        box-sizing:border-box;background:rgba(6,8,14,.86);border:1px solid #3c4656;padding:18px 22px 14px;
        font-family:'Courier New',monospace;color:#e8e2d2;cursor:pointer}
      .ch-story .t{font-size:clamp(15px,2.2vw,19px);line-height:1.7;min-height:5.1em}
      .ch-story .f{display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12px;letter-spacing:2px}
      .ch-story .d span{color:#f2b84b;margin-right:5px}.ch-story .d span.dim{color:#3c4656}
      .ch-story .n{color:#f2b84b}
      .ch-title{position:fixed;top:14vh;left:0;right:0;text-align:center;z-index:64;pointer-events:none;
        font-family:'Courier New',monospace;color:#f2e6c8;letter-spacing:6px;font-size:clamp(14px,2vw,18px)}
    `;
    const bars = document.createElement('div'); bars.className = 'ch-bars';
    const title = document.createElement('div'); title.className = 'ch-title';
    title.innerHTML = heading;
    const box = document.createElement('div'); box.className = 'ch-story';
    box.innerHTML = `<div class="t"></div><div class="f"><span class="d"></span><span class="n"></span></div>`;
    box.addEventListener('click', () => this._storyNext());
    for (const el of [css, bars, title, box]) document.body.appendChild(el);
    this.story = { css, bars, title, box, lines, text: box.querySelector('.t'), dots: box.querySelector('.d'), next: box.querySelector('.n'), idx: 0, shown: 0, t: 0 };
    this.ui.hud.style.display = 'none';
    this.ui.hint.style.display = 'none';
    this._showStoryPanel(0);
  }

  _showStoryPanel(i) {
    const s = this.story;
    s.idx = i; s.shown = 0;
    const L = s.lines, last = i === L.length - 1;
    s.plain = L[i].replace(/<[^>]+>/g, '');
    s.dots.innerHTML = L.map((_, k) => `<span class="${k === i ? '' : 'dim'}">●</span>`).join('');
    s.next.innerHTML = !last ? '[ENTER] NEXT ▸'
      : '<span class="ch-k">A</span> <span class="ch-k">D</span> lane &nbsp; <span class="ch-k w">SPACE</span> jump &nbsp;&nbsp; [ENTER] START THE CHASE ▸';
    s.text.textContent = '';
  }

  _updateStory(dt) {
    const s = this.story;
    if (!s) return;
    s.t += dt;
    if (s.shown < s.plain.length) {
      s.shown = Math.min(s.plain.length, s.shown + dt * 55);       // typewriter
      if (s.shown >= s.plain.length) s.text.innerHTML = s.lines[s.idx];
      else s.text.textContent = s.plain.slice(0, Math.floor(s.shown));
    }
  }

  _storyNext() {
    const s = this.story;
    if (!s) return;
    if (s.shown < s.plain.length) {                                 // finish the line first
      s.shown = s.plain.length; s.text.innerHTML = s.lines[s.idx]; return;
    }
    sfx('chip');
    if (s.idx < s.lines.length - 1) { this._showStoryPanel(s.idx + 1); return; }
    for (const k of ['css', 'bars', 'title', 'box']) s[k].remove();
    this.story = null;
    // intro done -> countdown
    this.ui.hud.style.display = '';
    this.ui.hint.style.display = '';
    const cam = window.__camera;
    if (cam) this.camPos.copy(cam.position);
    this.state = this._ready.suspect && this._ready.cop ? 'intro' : 'loading';
    this.stateT = 0;
    if (this.state === 'loading') this._setCenter('loading', '<div class="ch-card"><h2 style="margin:0">LOADING THE CHASE…</h2></div>');
    this._grabKeys();
  }

  // slow fly-over of the abandoned city toward the start line
  _storyCamera(cam) {
    const k = smooth(0, 1, this.time / 22);
    const from = this._v.set(26, 40, 175), to = this._v2.set(0, 3.4, PLAYER_START_Z + 7.5);
    cam.position.lerpVectors(from, to, k);
    cam.lookAt(0, lerp(8, 1.4, k), lerp(CAVE_Z, PLAYER_START_Z - 10, k));
  }

  // brighter fill so obstacles read in the dusk / dark cave
  _buildLights() {
    const hemi = new THREE.HemisphereLight(0xbcc8e6, 0x3a3026, 0.7);
    this.chase.add(hemi);
    // a work floodlight that always lights the road ahead of you
    this.ahead = new THREE.PointLight(0xfff0dc, 34, 46, 1.1);
    this.chase.add(this.ahead);
  }

  // make sure key presses reach the game (not a focused button or field)
  _grabKeys() {
    try {
      const a = document.activeElement;
      if (a && a !== document.body && typeof a.blur === 'function') a.blur();
      window.focus();
    } catch (e) {}
  }

  // =========================================================
  // INPUT
  // =========================================================
  _handleKey(e) {
    if (e.repeat) return;
    if (this.endOpen) {
      if (e.code === 'Enter') this._again();
      return;
    }
    if (window.__uiCapture || window.__paused) return;
    if (e.code === 'KeyV') { this.view = this.view === 'third' ? 'first' : 'third'; return; }
    if (this.state === 'story') { if (e.code === 'Enter' || e.code === 'NumpadEnter') this._storyNext(); return; }
    if (this.state !== 'run') return;
    if (this.pz < NARROW_Z + 2) return;               // one path near the bridge
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') { this.prevLane = this.lane; this.lane = Math.max(0, this.lane - 1); }
    if (e.code === 'KeyD' || e.code === 'ArrowRight') { this.prevLane = this.lane; this.lane = Math.min(2, this.lane + 1); }
    if (e.code === 'Space' && this.grounded) { this.vy = 12; this.grounded = false; }
  }

  // =========================================================
  // PER FRAME
  // =========================================================
  update(dt, t, player) {
    this.time += dt;
    this.stateT += dt;
    const p = player && player.pos ? player : null;
    this._player = p;
    // Jump and gravity live here: main.js does not move the player in Level 3.
    if (this.state === 'run' || this.state === 'fell' || this.state === 'escaped') {
      this.vy -= 30 * Math.min(dt, 0.05);
      this.py += this.vy * Math.min(dt, 0.05);
      const floor = this.getSurfaceHeight(this.px, this.pz);
      if (this.py <= floor) { this.py = floor; this.vy = 0; this.grounded = true; }
      else this.grounded = false;
      if (this.py < -200) { this.py = -200; this.vy = 0; }
    } else { this.py = 0; this.vy = 0; this.grounded = true; }
    if (p) { p.pos.y = this.py; p.vel.y = this.vy; p.grounded = this.grounded; }
    const py = this.py;
    const grounded = this.grounded;

    // mouse look is limited: you always run down the road
    if (p) {
      p.yaw = clamp(p.yaw || 0, -0.5, 0.5);
      p.pitch = clamp(p.pitch || 0, -0.5, 0.35);
    }

    // blink the amber site lamps
    const on = Math.sin(this.time * 6) > 0;
    for (const m of this.blinkMats) m.emissiveIntensity = on ? 2.4 : 0.15;

    if (this.story) this._updateStory(dt);
    if (this.state === 'story') { this.px = LANES[1]; this.pz = PLAYER_START_Z; }
    else if (this.state === 'loading') {
      this.px = LANES[1]; this.pz = PLAYER_START_Z;
      if ((this._ready.suspect && this._ready.cop) || this.stateT > 30) { this._setCenter('', null); this.state = 'intro'; this.stateT = 0; }
    }
    else if (this.state === 'intro') this._updateIntro();
    else if (this.state === 'run') this._updateRun(dt, py, grounded);
    else if (this.state === 'escaped') this._updateEscaped(dt);
    else if (this.state === 'caught') this._updateCaught(dt);
    else if (this.state === 'fell') this._updateFell();

    // the suspect keeps running unless caught / still waiting
    if (this.state === 'run' || this.state === 'escaped' || this.state === 'fell') this._updateCriminal(dt);

    this._updateObstacles(dt);
    this._updateBridge(dt);

    // keep main.js's player where the chase says it is
    if (p) { p.pos.x = this.px; p.pos.z = this.pz; }

    this._updateAvatars(dt, py, grounded);
    this._updateFogAndLights(py);
    this._updateCamera(dt, p, py);
    if (!this.endOpen) this._updateHud();
  }

  _updateIntro() {
    this.px = LANES[1]; this.pz = PLAYER_START_Z;
    const s = this.stateT;
    const keys = `<div class="ck"><span class="ch-k">A</span> <span class="ch-k">D</span> change lane &nbsp;&nbsp; <span class="ch-k w">SPACE</span> jump</div>`;
    if (s < 0.9) { if (this._centerKey !== '3') sfx('chip'); this._setCenter('3', '<h1>3</h1>' + keys); }
    else if (s < 1.8) { if (this._centerKey !== '2') sfx('chip'); this._setCenter('2', '<h1>2</h1>' + keys); }
    else if (s < 2.7) { if (this._centerKey !== '1') sfx('chip'); this._setCenter('1', '<h1>1</h1>' + keys); }
    else {
      sfx('partial');
      this._grabKeys();
      this._setCenter('go', '<h1>GO!</h1>');
      this.state = 'run'; this.stateT = 0;
      this.speed = PLAYER_SPEED * 0.6;
    }
  }

  _updateRun(dt, py, grounded) {
    if (this.stateT > 0.7 && this._centerKey === 'go') this._setCenter('', null);
    this.runTime += dt;
    this.stumble = Math.max(0, this.stumble - dt);
    this.slow = Math.max(0, this.slow - dt);
    this.shake = Math.max(0, this.shake - dt);

    const pace = this._pace();
    let target = PLAYER_SPEED * pace;
    if (this.slow > 0) target = PUDDLE_SPEED * pace;
    if (this.stumble > 0) target = STUMBLE_SPEED * pace;
    this.speed = damp(this.speed, target, this.stumble > 0 ? 14 : 3, dt);

    // bridge is down: stop at the edge, unless you jumped
    if (this.bridgeBroken && this.pz > BRIDGE_NEAR && grounded) {
      const stopZ = BRIDGE_NEAR + 1.0;
      this.speed = Math.min(this.speed, Math.max(0, (this.pz - stopZ) * 2.5));
      if (this.pz - stopZ < 0.05) {
        this.speed = 0;
        this.state = 'escaped'; this.stateT = 0;
        sfx('wrong');
      }
    }

    // he vanished into the dark end of the tunnel
    if (this.crim.gone) {
      this.speed = 0; this.state = 'escaped'; this.stateT = 0; sfx('wrong');
      return;
    }
    // he is over and the bridge is down while you are still far back: he got away
    if (this.bridgeBroken && this.pz > BRIDGE_NEAR + 20 && this.time - this.breakAt > 2.5) {
      this.speed = 0; this.state = 'escaped'; this.stateT = 0; sfx('wrong');
      return;
    }

    this.pz = Math.max(CAVE_END + 4, this.pz - this.speed * dt);
    if (this.pz < NARROW_Z + 2) this.lane = 1;
    this.px = damp(this.px, LANES[this.lane], 14, dt);

    // hits
    const pb = this._pb;
    pb.min.set(this.px - 0.35, py + 0.05, this.pz - 0.35);
    pb.max.set(this.px + 0.35, py + 1.75, this.pz + 0.35);
    for (const o of this.obstacles) {
      if (o.knocked || o.state !== 'down') continue;
      if (Math.abs(o.z - this.pz) > 4) continue;
      if (!o.box.intersectsBox(pb)) continue;
      if (o.puddle) {
        if (!o.splashed) { o.splashed = true; this.slow = 0.55; sfx('chip'); }
        continue;
      }
      if (o.type === 'cone') this._hit(o);                             // light: knocked over
      else if (o.low) this._trip(o);                                   // low + heavy: you trip over it
      else this._blockedBy(o);                                         // tall + heavy: it stops you
    }

    // caught him
    if (this.pz - this.crim.z <= CATCH_GAP && !this.crim.gone) { this._caught(); return; }

    // fell into the chasm
    if (py < -2.5) {
      this.state = 'fell'; this.stateT = 0;
      sfx('wrong');
      this.ui.fade.style.opacity = '1';
    }
  }

  // The chase speeds up as it goes: 1.0 at the start line, rising to
  // 1 + PACE_GAIN at the bridge. You and the suspect speed up together,
  // so who wins is still down to mistakes, but there is less time to react.
  _pace() {
    const k = clamp((PLAYER_START_Z - this.pz) / (PLAYER_START_Z - BRIDGE_NEAR), 0, 1);
    return 1 + PACE_GAIN * k;
  }

  _hit(o) {
    o.knocked = true;
    o.kt = 0;
    o.tip = 0;
    const side = (o.x - this.px) >= 0 ? 1 : -1;
    const light = o.type === 'cone';
    o.topple = light;
    if (light) {
      // light things tip over forward and slide
      o.vel.set(side * rand(0.8, 1.6), o.type === 'cone' ? 2 : 0, -(this.speed * 0.35 + 1));
      o.spin.set(0, rand(-2, 2), 0);
    } else {
      // heavy things only get shoved a little
      const k = o.wide ? 0.25 : 1;
      o.vel.set(side * rand(0.2, 0.5) * k, 0, -rand(1.4, 2.2) * k);
      o.spin.set(0, rand(-0.5, 0.5) * k, 0);
    }
    this.stumble = o.low ? 0.6 : 0.9;
    this.shake = 0.35;
    this.hits++;
    this._flashHit();
    sfx(o.low ? 'crack' : 'strong');
  }

  // you trip over a low heavy obstacle: stumble up and over it (it does not move)
  _trip(o) {
    o.knocked = true;
    o.kt = 99;
    if (this.grounded) { this.vy = 9; this.grounded = false; }
    this.stumble = 0.6;
    this.shake = 0.3;
    this.hits++;
    this._flashHit();
    sfx('crack');
  }

  // a skip, pipes or a big rock: you cannot run through it. You stop
  // dead in front of it until you change lane.
  _blockedBy(o) {
    if (this.pz > o.box.max.z - 0.4) {          // ran into its front
      this.pz = Math.max(this.pz, o.box.max.z + 0.36);
      this.speed = 0;
    } else {                                    // clipped its side changing lane
      this.lane = this.prevLane;
    }
    if (this.time - (o.lastHit !== undefined ? o.lastHit : -9) > 1.2) {
      this.hits++;
      this.stumble = 0.5;
      this.shake = 0.3;
      this._flashHit();
      sfx('strong');
    }
    o.lastHit = this.time;
  }

  _caught() {
    this.state = 'caught'; this.stateT = 0;
    this.speed = 0;
    this.shake = 0;
    this.caughtAt = new THREE.Vector3(this.crim.x, 0, this.crim.z);
    this.crim.y = 0;
    this.camPos.copy(window.__camera ? window.__camera.position : this.camPos);
    this.ui.hint.style.display = 'none';
    sfx('strong');
  }

  _updateCaught(dt) {
    const k = clamp(this.stateT / 0.9, 0, 1);
    this._arrestK = k * k * (3 - 2 * k);
    const c = this.caughtAt;
    this.px = damp(this.px, c.x, 6, dt);
    this.pz = damp(this.pz, c.z + 0.85, 6, dt);
    if (this.stateT > 1.15 && !this.cuffs.visible) {
      this.cuffs.visible = true;
      sfx('correct');
    }
    if (this.stateT > 1.1 && this._centerKey !== 'cuffed' && !this._endingStarted) {
      this._setCenter('cuffed', '<h2 style="position:absolute;bottom:16vh;left:0;right:0">YOU ARE UNDER ARREST</h2>');
    }
    if (this.stateT > 2.6 && !this._endingStarted) {
      this._endingStarted = true;
      sfx('rank');
      this._end('win');
    }
  }

  _updateEscaped(dt) {
    this.speed = 0;
    this.shake = Math.max(0, this.shake - dt);
    if (this.stateT > 1.6 && !this.endOpen) this._end('escaped');
  }

  _updateFell() {
    if (this.stateT > 1.1 && !this.endOpen) this._end('fell');
  }

  _updateCriminal(dt) {
    const c = this.crim;
    if (c.gone) return;
    const pace = this._pace();
    c.z -= CRIMINAL_SPEED * pace * dt;
    c.phase += dt * CRIMINAL_SPEED * pace * 0.95;

    if (c.z < NARROW_Z + 4) c.lane = 1;
    else {
      // nearest obstacle ahead of him in his lane
      const inLane = (o, l) => o.wide || Math.abs(o.x - LANES[l]) < o.halfW + 0.45;
      const live = (o) => !o.puddle && !o.knocked && o.state === 'down';
      // nearest obstacle ahead in his lane
      let next = null, nd = Infinity;
      for (const o of this.obstacles) {
        if (!live(o) || !inLane(o, c.lane)) continue;
        const d = c.z - 0.35 - o.box.max.z;
        if (d < -0.6 || d > 12) continue;
        if (d < nd) { nd = d; next = o; }
      }
      if (next) {
        // a lane is free if nothing stands in it from here to just past this obstacle
        const free = (l) => !this.obstacles.some((o) => live(o) && inLane(o, l) &&
          o.box.max.z > next.box.min.z - 2.5 && o.box.min.z < c.z - 0.2);
        let best = -1, bestD = Infinity;
        for (let l = 0; l < 3; l++) {
          if (l === c.lane || !free(l)) continue;
          if (Math.abs(l - c.lane) === 2 && !free(1)) continue;      // can't cut through the middle
          const dl = Math.abs(l - c.lane) + Math.random() * 0.1;
          if (dl < bestD) { bestD = dl; best = l; }
        }
        // otherwise step into a lane that only has things he can jump
        const noTall = (l) => !this.obstacles.some((o) => live(o) && !o.low && inLane(o, l) &&
          o.box.max.z > next.box.min.z - 2.5 && o.box.min.z < c.z - 0.2);
        if (best < 0 && !next.low) {
          for (const l of [c.lane - 1, c.lane + 1]) if (l >= 0 && l < 3 && noTall(l)) { best = l; break; }
        }
        if (best >= 0 && nd > 0.9) c.lane = best;                    // side-step it
        else if (next.low && nd < 1.4 && c.y <= 0.001) c.vy = 10;    // nowhere to go: jump it
      }
    }
    c.x = damp(c.x, LANES[c.lane], 10, dt);
    c.vy -= 30 * dt;
    c.y += c.vy * dt;
    if (c.y < 0) { c.y = 0; c.vy = 0; }

    // over the bridge: it comes down behind him
    if (!this.bridgeBroken && c.z < BRIDGE_FAR - 1.0) this._breakBridge();
    if (c.z < CAVE_END + 20) { c.gone = true; this.crook.root.visible = false; }

    // now and then he looks back at you
    const wantLook = Math.sin(this.time * 0.8) > 0.8 ? 1 : 0;
    c.look = damp(c.look, wantLook, 6, dt);
  }

  _breakBridge() {
    this.bridgeBroken = true;
    this.breakT = 0;
    this.breakAt = this.time;
    sfx('break');
    if (Math.abs(this.pz - BRIDGE_NEAR) < 60) this.shake = Math.max(this.shake, 0.5);
    this.planks.forEach((pl, i) => {
      pl.delay = (this.planks.length - 1 - i) * 0.05;     // far planks go first
      pl.vel.set(rand(-0.6, 0.6), rand(0, 1.2), rand(-0.5, 0.5));
      pl.spin.set(rand(-3, 3), rand(-1, 1), rand(-3, 3));
    });
    for (const r of this.ropes) { r.vel.set(rand(-1, 1), 0, 0); r.spin.set(rand(-1, 1), 0, rand(-0.5, 0.5)); }
  }

  _updateBridge(dt) {
    if (!this.bridgeBroken) return;
    this.breakT += dt;
    for (const pl of this.planks) {
      if (this.breakT < pl.delay || !pl.mesh.visible) continue;
      pl.vel.y -= 30 * dt;
      pl.mesh.position.addScaledVector(pl.vel, dt);
      pl.mesh.rotation.x += pl.spin.x * dt; pl.mesh.rotation.y += pl.spin.y * dt; pl.mesh.rotation.z += pl.spin.z * dt;
      if (pl.mesh.position.y < CHASM_BOTTOM + 2) pl.mesh.visible = false;
    }
    for (const r of this.ropes) {
      if (!r.mesh.visible) continue;
      r.vel.y -= 20 * dt;
      r.mesh.position.addScaledVector(r.vel, dt);
      r.mesh.rotation.z += r.spin.z * dt;
      if (r.mesh.position.y < CHASM_BOTTOM + 2) r.mesh.visible = false;
    }
  }

  _updateObstacles(dt) {
    for (const o of this.obstacles) {
      // drops: he knocks them off the gantry once he is past
      if (o.drop && o.state === 'up' && this.state === 'run' && this.crim.z < o.z - 1.5) {
        if (this.pz - o.z < 7) o.state = 'skip';        // too close to dodge: it holds
        else { o.state = 'falling'; o.vy = 0; }
      }
      if (o.state === 'falling') {
        o.vy -= 30 * dt;
        o.mesh.position.y += o.vy * dt;
        o.mesh.rotation.z = Math.sin(this.time * 9) * 0.05;
        if (o.mesh.position.y <= 0) {
          o.mesh.position.y = 0; o.mesh.rotation.z = 0;
          o.state = 'down';
          o.mesh.updateMatrixWorld(true);
          o.box.setFromObject(o.mesh);
          const d = Math.abs(this.pz - o.z);
          if (d < 45) sfx('strong');
          if (d < 18) this.shake = Math.max(this.shake, 0.25);
        }
      }
      // knocked by you: tip / slide, always resting ON the ground
      if (o.knocked && o.kt < 3) {
        o.kt += dt;
        const m = o.mesh;
        if (o.topple && o.tip < Math.PI / 2) {
          o.tip = Math.min(Math.PI / 2, o.tip + dt * 5);
          m.rotation.x = -o.tip;
        }
        const f = Math.exp(-4 * dt);
        o.vel.x *= f; o.vel.z *= f;
        o.spin.y *= f;
        o.vel.y -= 30 * dt;
        m.position.x += o.vel.x * dt;
        m.position.z += o.vel.z * dt;
        m.position.y += o.vel.y * dt;
        m.rotation.y += o.spin.y * dt;
        // keep it inside the road / tunnel
        const lim = o.z < CAVE_Z ? 4.6 : 6.6;
        m.position.x = clamp(m.position.x, -lim, lim);
        // never below the ground: lift by however far its lowest point sank
        m.updateMatrixWorld(true);
        this._kb.setFromObject(m);
        if (this._kb.min.y < 0) {
          m.position.y -= this._kb.min.y;
          if (o.vel.y < 0) o.vel.y = 0;
        }
      }
    }
  }

  // =========================================================
  // SUSPECT AVATAR — the team's Mixamo model (characters/suspect.glb)
  // The jointed stand-in above is shown until the model has loaded.
  // =========================================================
  _loadSuspect() {
    loadSuspectFiles().then(({ base, run, jump }) => {
      if (this._disposed) return;
      const obj = cloneSkinned(base);
      obj.animations = [];
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      const h = Math.max(0.01, box.max.y - box.min.y);
      const s = 1.95 / h;
      obj.scale.setScalar(s);
      obj.position.y = -box.min.y * s;
      obj.traverse((m) => {
        if (!m.isMesh) return;
        m.castShadow = true; m.receiveShadow = true;
        m.frustumCulled = false;                       // skinned: bounds lag the animation
      });
      const bone = (n) => { let b = null; obj.traverse((o) => { if (!b && o.isBone && o.name.endsWith(n)) b = o; }); return b; };
      const S = {
        obj, baseY: obj.position.y,
        mixer: new THREE.AnimationMixer(obj),
        head: bone('Head'), spine: bone('Spine1'),
        hips: bone('Hips'),
        lArm: bone('LeftArm'), lFore: bone('LeftForeArm'), lHand: bone('LeftHand'),
        rArm: bone('RightArm'), rFore: bone('RightForeArm'), rHand: bone('RightHand'),
        lUp: bone('LeftUpLeg'), lLeg: bone('LeftLeg'), lFoot: bone('LeftFoot'),
        rUp: bone('RightUpLeg'), rLeg: bone('RightLeg'), rFoot: bone('RightFoot'),
      };
      if (run) { S.run = S.mixer.clipAction(run); S.run.play(); this._runClip = run; }
      if (jump) {
        S.jump = S.mixer.clipAction(jump);
        S.jump.setLoop(THREE.LoopOnce, 1);
        S.jump.clampWhenFinished = false;
        this._jumpClip = jump;
      }
      this.crook.root.add(obj);
      this.crook.body.visible = false;                 // hide the stand-in
      this.suspect = S;
      this._ready.suspect = true;
      this._wireCop();
      this._prewarm();
    }).catch((err) => {
      console.warn('[chase] suspect model not loaded, using stand-in', err);
      this._ready.suspect = true;
    });
  }

  // =========================================================
  // THE DETECTIVE (player) — the team's detective model. It has no
  // animations of its own, so it borrows the suspect's run and jump
  // clips (same Mixamo skeleton) and is posed in code for standing,
  // falling and the arrest.
  // =========================================================
  _loadCop() {
    loadDetective(1.95).then((d) => {
      if (this._disposed) return;
      this.cop.root.add(d.root);
      this.cop.body.visible = false;              // hide the stand-in
      this.copFBX = Object.assign(d, { mixer: new THREE.AnimationMixer(d.model), mode: 'pose', jumpT: 0 });
      this._ready.cop = true;
      this._wireCop();
      this._prewarm();
    }).catch((err) => { console.warn('[chase] detective model not loaded, using stand-in', err); this._ready.cop = true; });
  }

  // Prepare the characters' shaders on the graphics card while the story is
  // still on screen, so the first frames of the chase do not stutter.
  _prewarm() {
    if (this._warmed || !this._ready.suspect || !this._ready.cop || !this.renderer || !window.__camera) return;
    this._warmed = true;
    const shown = [this.cop.root.visible, this.crook.root.visible];
    this.cop.root.visible = this.crook.root.visible = true;
    try { this.renderer.compile(this.scene, window.__camera); } catch (e) {}
    [this.cop.root.visible, this.crook.root.visible] = shown;
  }

  _wireCop() {
    const C = this.copFBX;
    if (!C) return;
    if (this._runClip && !C.run) C.run = C.mixer.clipAction(retargetClip(this._runClip, C.prefix));
    if (this._jumpClip && !C.jump) {
      C.jump = C.mixer.clipAction(retargetClip(this._jumpClip, C.prefix));
      C.jump.setLoop(THREE.LoopOnce, 1);
    }
  }

  _updateCop(dt, grounded) {
    const C = this.copFBX;
    if (!C) return;
    const toPose = () => { if (C.mode !== 'pose') { C.mixer.stopAllAction(); C.mode = 'pose'; C.jumpT = 0; } };
    if (this.state === 'caught') { toPose(); C.rig.arrest(this._arrestK || 0); return; }
    if (this.state === 'fell') { toPose(); C.rig.pose(0, 0, true); return; }
    if (this.state !== 'run' || this.speed < 0.3) { toPose(); C.rig.pose(this.copPhase, 0, false); return; }
    if (!C.run) { C.rig.pose(this.copPhase, 2, !grounded); return; }   // clips not loaded yet
    if (C.mode !== 'clip') { C.run.reset().play(); C.mode = 'clip'; }
    if (!grounded && C.jump && C.jumpT <= 0) {
      C.jump.reset().setEffectiveWeight(1).fadeIn(0.08).play();
      C.run.fadeOut(0.08);
      C.jumpT = C.jump.getClip().duration;
    }
    if (C.jumpT > 0) {
      C.jumpT -= dt;
      if (C.jumpT <= 0.12 && C.jump.isRunning()) { C.jump.fadeOut(0.12); C.run.reset().fadeIn(0.12).play(); C.jumpT = 0; }
    }
    C.run.timeScale = this.stumble > 0 ? 0.8 : 0.45 + this.speed / 12;
    C.mixer.update(dt);
  }

  // point a bone so the line to its child bone faces `dir` (world space)
  _aimBone(bone, child, dir) {
    if (!bone || !child) return;
    bone.updateMatrixWorld(true);
    const a = bone.getWorldPosition(this._av1), b = child.getWorldPosition(this._av2);
    const cur = b.sub(a).normalize();
    const q = this._aq1.setFromUnitVectors(cur, this._av3.copy(dir).normalize());
    const world = bone.getWorldQuaternion(this._aq2).premultiply(q);
    const parentQ = bone.parent.getWorldQuaternion(this._aq3);
    bone.quaternion.copy(parentQ.invert().multiply(world));
    bone.updateMatrixWorld(true);
  }

  _updateSuspect(dt) {
    const S = this.suspect;
    if (!S) return;
    const c = this.crim;
    if (this.state === 'caught') {
      if (!S.posed) { S.mixer.stopAllAction(); S.posed = true; S.obj.position.y = S.baseY; }
      this._poseSuspectArrest(this._arrestK || 0);
      return;
    }
    const running = this.state === 'run' || this.state === 'escaped' || this.state === 'fell';
    if (S.run) S.run.timeScale = running ? 1.25 * this._pace() : 0;
    // jump: play the running-jump clip, and let the clip lift him instead of the code
    if (c.vy > 6 && S.jump && !S.jump.isRunning()) {
      S.jump.reset().setEffectiveWeight(1).fadeIn(0.08).play();
      S.run.fadeOut(0.08);
      S.jumpT = S.jump.getClip().duration;
    }
    if (S.jumpT > 0) {
      S.jumpT -= dt * (S.jump ? S.jump.timeScale : 1);
      if (S.jumpT <= 0.12 && S.jump.isRunning()) { S.jump.fadeOut(0.12); S.run.reset().fadeIn(0.12).play(); }
    }
    S.obj.position.y = S.baseY;
    S.mixer.update(dt);
    // glance back over his shoulder now and then
    if (S.head) S.head.rotateY(c.look * 1.1);
    if (this.state === 'story' || this.state === 'intro') { if (S.head) S.head.rotateY(1.0); }
  }

  // kneeling, hands behind his back
  _poseSuspectArrest(k) {
    const S = this.suspect;
    this.crook.root.updateMatrixWorld(true);
    // his facing in the world (root faces -z), his right, down
    const f = this._av4.set(0, 0, 1).applyQuaternion(this.crook.root.getWorldQuaternion(this._aq1)).normalize();
    const down = this._av5.set(0, -1, 0);
    const right = this._av6.crossVectors(f, down).normalize().negate();
    const mix = (x, y, z) => new THREE.Vector3().addScaledVector(f, x).addScaledVector(right, y).addScaledVector(down, z);
    const L = (a, b, t) => a.clone().lerp(b, t).normalize();
    // legs: thighs down, shins back along the ground
    this._aimBone(S.lUp, S.lLeg, L(mix(0.05, -0.08, 1), mix(0.15, -0.12, 1), k));
    this._aimBone(S.rUp, S.rLeg, L(mix(0.05, 0.08, 1), mix(0.15, 0.12, 1), k));
    this._aimBone(S.lLeg, S.lFoot, L(mix(0, -0.05, 1), mix(-1, -0.05, 0.12), k));
    this._aimBone(S.rLeg, S.rFoot, L(mix(0, 0.05, 1), mix(-1, 0.05, 0.12), k));
    // arms pulled behind: elbows back, both forearms aimed at one point at
    // the small of his back. Try a few elbow widths and keep the one where
    // the wrists end up closest, so they meet for the cuffs.
    const sc = this.crook.root.scale.y;
    const poseArms = (w, back) => {
      this._aimBone(S.lArm, S.lFore, L(mix(0, -0.35, 1), mix(-back, -w, 0.8), k));
      this._aimBone(S.rArm, S.rFore, L(mix(0, 0.35, 1), mix(-back, w, 0.8), k));
      if (!S.hips) return 0;
      const meet = S.hips.getWorldPosition(new THREE.Vector3()).addScaledVector(f, -0.24 * sc);
      meet.y += 0.05 * sc;
      for (const [fore, hand] of [[S.lFore, S.lHand], [S.rFore, S.rHand]]) {
        if (!fore || !hand) continue;
        const elbow = fore.getWorldPosition(new THREE.Vector3());
        this._aimBone(fore, hand, L(mix(0.1, 0, 1), meet.clone().sub(elbow).normalize(), k));
      }
      return S.lHand.getWorldPosition(this._av1).distanceTo(S.rHand.getWorldPosition(this._av2));
    };
    let best = k >= 1 ? S.armBest : null;
    if (!best) {
      for (const w of [0.3, 0.2, 0.12, 0.06, 0.0]) for (const back of [0.35, 0.55, 0.8]) {
        const gap = poseArms(w, back);
        if (!best || gap < best.gap) best = { w, back, gap };
      }
      if (k >= 1) S.armBest = best;
    }
    poseArms(best.w, best.back);
    if (S.head) { S.head.rotation.x = 0.35 * k; }
    // lower him until the knees touch the ground
    S.obj.position.y = S.baseY;
    this.crook.root.updateMatrixWorld(true);
    const kn = Math.min(S.lLeg.getWorldPosition(this._av1).y, S.rLeg.getWorldPosition(this._av2).y);
    S.obj.position.y = S.baseY - (kn - 0.08) * k / this.crook.root.scale.y;
  }

  _updateAvatars(dt, py, grounded) {
    const cop = this.cop, crook = this.crook, c = this.crim;

    // ---- the cop (you) ----
    cop.root.position.set(this.px, this.state === 'caught' ? 0 : py, this.pz);
    cop.root.rotation.set(0, Math.PI, clamp((LANES[this.lane] - this.px) * 0.06, -0.12, 0.12));
    cop.root.visible = this.view === 'third' || this.state === 'caught';
    if (this.state === 'run') {
      this.copPhase += dt * this.speed * 0.95;
      if (!grounded) poseJump(cop);
      else if (this.stumble > 0) poseStumble(cop, this.copPhase);
      else poseRun(cop, this.copPhase);
    } else if (this.state === 'caught') poseArrest(cop, this._arrestK || 0);
    else if (this.state === 'fell') poseJump(cop);
    else poseIdle(cop, this.time);

    // ---- the suspect ----
    crook.root.position.set(c.x, c.y, c.z);
    if (this.state === 'intro' || this.state === 'story' || this.state === 'loading') {
      poseIdle(crook, this.time + 1);
      crook.headG.rotation.set(0, 2.4, 0);          // glancing back at you
    } else if (this.state === 'caught') {
      crook.root.position.set(this.caughtAt.x, 0, this.caughtAt.z);
      poseKneel(crook, this._arrestK || 0);
      this._placeCuffs();
    } else {
      if (c.y > 0.02) poseJump(crook); else poseRun(crook, c.phase, 0.25);
      crook.headG.rotation.set(0, c.look * 2, 0);
    }
    this._updateSuspect(dt);
    this._updateCop(dt, grounded);
    if (this.state === 'caught') this._placeCuffs();
  }

  _placeCuffs() {
    if (!this.cuffs.visible) return;
    this.crook.root.updateMatrixWorld(true);
    const S = this.suspect;
    const a = (S && S.lHand ? S.lHand : this.crook.hands[0]).getWorldPosition(this._v);
    const b = (S && S.rHand ? S.rHand : this.crook.hands[1]).getWorldPosition(this._v2);
    this.cuffRings[0].position.copy(a);
    this.cuffRings[1].position.copy(b);
    for (const r of this.cuffRings) r.rotation.set(Math.PI / 2, 0, 0);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a);
    const len = Math.max(0.02, dir.length());
    this.cuffChain.position.copy(mid);
    this.cuffChain.scale.set(1, len, 1);
    this.cuffChain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  }

  _updateFogAndLights(py) {
    const k = clamp((CAVE_Z + 6 - this.pz) / 18, 0, 1);
    this.fog.color.copy(this.baseFog.color).lerp(this.caveFogColor, k);
    this.fog.near = this.baseFog.near + (10 - this.baseFog.near) * k;
    this.fog.far = this.baseFog.far + (120 - this.baseFog.far) * k;
    this.torch.intensity = 30 * k;
    if (this.ahead) this.ahead.position.set(this.px * 0.5, py + 5.5, this.pz - 13);
    this.torch.position.set(this.px, py + 3, this.pz - 2.5);
  }

  _updateCamera(dt, p, py) {
    const cam = window.__camera;
    if (!cam || !cam.isCamera) return;
    cam.rotation.order = 'YXZ';
    const sh = this.shake > 0 ? this.shake * 0.35 : 0;
    const sx = sh ? rand(-sh, sh) : 0, sy = sh ? rand(-sh, sh) : 0;

    if (this.state === 'story') { this._storyCamera(cam); return; }
    if (this.state === 'caught') {
      const c = this.caughtAt;
      const side = c.x > 0 ? -1 : 1;
      const want = this._v.set(c.x + side * (3.6 - this.stateT * 0.15), 2.0, c.z + 2.9);
      this.camPos.lerp(want, 1 - Math.exp(-4 * dt));
      cam.position.copy(this.camPos);
      cam.lookAt(c.x, 1.0, c.z + 0.45);
      return;
    }
    if (this.state === 'fell') {
      cam.position.set(this.px, Math.max(py + EYE, -22), this.pz);
      cam.rotation.set(-1.0, 0, 0);
      return;
    }

    if (this.view === 'first') {
      const bob = (this.state === 'run' && this.speed > 1) ? Math.sin(this.copPhase * 2) * 0.05 : 0;
      cam.position.set(this.px + sx, py + EYE + bob + sy, this.pz);
      const roll = clamp((LANES[this.lane] - this.px) * -0.02, -0.06, 0.06);
      cam.rotation.set(p ? p.pitch : 0, p ? p.yaw : 0, roll);
      this.camPos.copy(cam.position);
    } else {
      const want = this._v.set(this.px * 0.8, py + 3.3, this.pz + 5.2);
      this.camPos.lerp(want, 1 - Math.exp(-10 * dt));
      cam.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
      cam.lookAt(this.px * 0.9, py + 1.9, this.pz - 8);
    }
  }

  // =========================================================
  // DISPOSE
  // =========================================================
  dispose() {
    this._disposed = true;
    if (this.suspect) { this.suspect.mixer.stopAllAction(); this.suspect = null; }
    if (this.copFBX) { this.copFBX.mixer.stopAllAction(); this.copFBX = null; }
    clearTimeout(this._flashT);
    window.removeEventListener('keydown', this._onKey);
    window.__firstPerson = false;
    window.__uiCapture = false;
    if (this.story) { for (const k of ['css', 'bars', 'title', 'box']) this.story[k].remove(); this.story = null; }
    if (this._mainHud) this._mainHud.style.visibility = this._mainHudVis || '';
    if (this._mainMsg) this._mainMsg.style.visibility = this._mainMsgVis || '';
    if (this.ui) {
      for (const k of ['css', 'hud', 'hint', 'center', 'end', 'flash', 'fade', 'confetti']) if (this.ui[k]) this.ui[k].remove();
      this.ui = null;
    }
    if (this.scene) {
      this.scene.remove(this.chase);
      this.chase.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          if (m.map) m.map.dispose();
          if (m.normalMap) m.normalMap.dispose();
          m.dispose();
        });
      });
      this.scene.remove(this.inner.level);
      this.scene.remove(this.inner.sky);
      this.scene.background = this._prevBg;
      this.scene.fog = this._prevFog;
    }
    if (this._caveTex) this._caveTex.forEach((t) => t.dispose());
    if (this._obsTex) this._obsTex.forEach((t) => t.dispose());
    if (this.renderer && this._prevClip !== undefined) this.renderer.localClippingEnabled = this._prevClip;
  }
}
