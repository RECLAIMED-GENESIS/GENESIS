// ============================================================
// main.js — bootstrap, player controller, level manager, minimap
// ============================================================
import * as THREE from 'three';
import { StreetLevel } from './levels/level1.js';
import { AlienLevel } from './levels/level2.js';
import { ArchitectLevel } from './levels/level3.js';

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1200);
camera.rotation.order = 'YXZ';

// ---------- player ----------
const player = {
  pos: new THREE.Vector3(0, 0, 55),
  vel: new THREE.Vector3(),
  yaw: Math.PI,
  pitch: 0,
  grounded: false,
  EYE: 1.7,
  R: 0.4, H: 1.8,
};

// ---------- input ----------
const keys = {};
let locked = false;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyR') switchLevel(current);
  if (e.code === 'Digit1') switchLevel(1);
  if (e.code === 'Digit2') switchLevel(2);
  if (e.code === 'Digit3') switchLevel(3);
  if (e.code === 'KeyP' && level.setPhase) {
    phase = phase % 3 + 1;
    level.setPhase(phase, clock.elapsedTime);
  }
});
addEventListener('keyup', e => keys[e.code] = false);
renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  document.getElementById('msg').style.display = locked ? 'none' : 'block';
});
addEventListener('mousemove', e => {
  if (!locked) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch - e.movementY * 0.0022));
});

// ---------- levels ----------
const LEVELS = { 1: StreetLevel, 2: AlienLevel, 3: ArchitectLevel };
let level = null, current = 1, phase = 1;
const hud = document.getElementById('hud');

function switchLevel(n) {
  if (level) {
    try {
      if (typeof level.dispose === 'function') level.dispose(scene);
      else {
        if (level.root && level.root.parent) level.root.parent.remove(level.root);
        if (level.level && level.level.parent) level.level.parent.remove(level.level);
      }
    } catch (e) { console.warn('dispose error', e); }
    if (level.root && scene.children.includes(level.root)) scene.remove(level.root);
    if (level.level && scene.children.includes(level.level)) scene.remove(level.level);
    if (level.sky && scene.children.includes(level.sky)) scene.remove(level.sky);
    if (level.stars && scene.children.includes(level.stars)) scene.remove(level.stars);
  }
  current = n; phase = 1;
  try {
    level = new LEVELS[n](scene, renderer);
  } catch (e) {
    try { level = new LEVELS[n](scene); } catch (e2) { level = new LEVELS[n](); }
  }

  if (level.scene && level.scene !== scene) {
    if (level.scene.background) scene.background = level.scene.background;
    scene.fog = level.scene.fog !== undefined ? level.scene.fog : null;
    if (level.level && level.level.parent === level.scene) {
      level.scene.remove(level.level);
      scene.add(level.level);
    }
    if (level.root && level.root.parent === level.scene) {
      level.scene.remove(level.root);
      scene.add(level.root);
    }
    if (level.sky && level.sky.parent === level.scene) {
      level.scene.remove(level.sky);
      scene.add(level.sky);
    }
    if (level.stars && level.stars.parent === level.scene) {
      level.scene.remove(level.stars);
      scene.add(level.stars);
    }
  }

  if (!level.spawn || !level.spawn.isVector3) {
    console.warn(`Level ${n} missing spawn, using fallback`);
    let fallbackY = 0;
    try {
      if (typeof level.getSurfaceHeight === 'function') fallbackY = level.getSurfaceHeight(0, 55);
      else if (typeof level.groundHeight === 'function') fallbackY = level.groundHeight(0, 55);
      else if (typeof level.terrainHeight === 'function') fallbackY = level.terrainHeight(0, 55);
    } catch (e) { fallbackY = 0; }
    level.spawn = new THREE.Vector3(0, fallbackY + 0.1, 55);
  }
  if (!Array.isArray(level.colliders)) level.colliders = [];
  if (!level.name) level.name = `LEVEL ${n}`;
  player.pos.copy(level.spawn);
  player.vel.set(0, 0, 0);
}

// ── expose switchLevel globally so villageNPCs portal can call it ──
window.__switchLevel = switchLevel;

// ---------- minimap ----------
const mini = new THREE.OrthographicCamera(-55, 55, 55, -55, 1, 300);
mini.layers.set(1);
mini.layers.enable(2);
const marker = new THREE.Mesh(
  new THREE.ConeGeometry(1.1, 2.6, 6),
  new THREE.MeshBasicMaterial({ color: 0x33ffee }));
marker.rotation.order = 'YXZ';
marker.layers.set(2);
scene.add(marker);

// ---------- physics ----------
const GRAV = 30, SPEED = 12, SPRINT = 24;
function stepPlayer(dt) {
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sp = keys.ShiftLeft || keys.ShiftRight ? SPRINT : SPEED;
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  player.vel.x = (-sin * f + cos * s) * sp;
  player.vel.z = (-cos * f - sin * s) * sp;
  player.vel.y -= GRAV * dt;
  if (player.grounded && keys.Space) player.vel.y = 12;

  player.pos.addScaledVector(player.vel, dt);

  let g = 0;
  try {
    if (level && typeof level.getSurfaceHeight === 'function') g = level.getSurfaceHeight(player.pos.x, player.pos.z);
    else if (level && typeof level.groundHeight === 'function') g = level.groundHeight(player.pos.x, player.pos.z, player.pos.y);
    else if (level && typeof level.terrainHeight === 'function') g = level.terrainHeight(player.pos.x, player.pos.z);
  } catch (e) { g = 0; }
  if (player.pos.y <= g) { player.pos.y = g; player.vel.y = 0; player.grounded = true; }
  else player.grounded = false;

  const colliders = (level && Array.isArray(level.colliders)) ? level.colliders : [];
  const pMin = new THREE.Vector3(player.pos.x - player.R, player.pos.y, player.pos.z - player.R);
  const pMax = new THREE.Vector3(player.pos.x + player.R, player.pos.y + player.H, player.pos.z + player.R);
  const pb = new THREE.Box3(pMin, pMax);
  for (const c of colliders) {
    if (!c || typeof c.intersectsBox !== 'function') continue;
    if (!c.intersectsBox(pb)) continue;
    const ox = Math.min(pMax.x - c.min.x, c.max.x - pMin.x);
    const oz = Math.min(pMax.z - c.min.z, c.max.z - pMin.z);
    if (ox < oz) player.pos.x += (pMax.x - c.min.x < c.max.x - pMin.x) ? -ox : ox;
    else player.pos.z += (pMax.z - c.min.z < c.max.z - pMin.z) ? -oz : oz;
    pMin.set(player.pos.x - player.R, player.pos.y, player.pos.z - player.R);
    pMax.set(player.pos.x + player.R, player.pos.y + player.H, player.pos.z + player.R);
  }

  if (player.pos.y < -60) {
    if (level && level.spawn && level.spawn.isVector3) player.pos.copy(level.spawn);
    else player.pos.set(0, 2, 55);
    player.vel.set(0, 0, 0);
  }
}

// ---------- loop ----------
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (!level) return;
  stepPlayer(dt);
  if (typeof level.update === 'function') {
    try { level.update(dt, t, player); }
    catch (e) { console.warn('level.update error', e); }
  }

  camera.position.set(player.pos.x, player.pos.y + player.EYE, player.pos.z);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;

  marker.position.set(player.pos.x, player.pos.y + 2, player.pos.z);
  marker.rotation.set(-Math.PI / 2, player.yaw, 0);

  const levelName = (level && level.name) ? level.name : `LEVEL ${current}`;
  hud.innerHTML =
    `<b>GENESIS — THE DEVICE</b><br>` +
    `${levelName}${level && level.setPhase ? ' · phase ' + phase : ''}<br>` +
    `1/2/3 levels · R restart · P boss phase`;

  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.clear();
  renderer.render(scene, camera);

  const S = 200;
  renderer.setScissorTest(true);
  renderer.setViewport(innerWidth - S - 12, 12, S, S);
  renderer.setScissor(innerWidth - S - 12, 12, S, S);
  renderer.setClearColor(0x0a0a14, 1);
  renderer.clearDepth();
  mini.position.set(player.pos.x, 90, player.pos.z);
  mini.up.set(0, 0, -1);
  mini.lookAt(player.pos.x, 0, player.pos.z);
  renderer.render(scene, mini);
  renderer.setScissorTest(false);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

switchLevel(1);
tick();
