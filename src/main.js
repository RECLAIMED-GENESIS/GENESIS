// ============================================================
// main.js — bootstrap, player controller, level manager, minimap
//
// YOUR CHARACTER GOES HERE:
//   search for "CHARACTER HOOK" below. Instead of the first-person
//   camera you can parent your avatar model to a Group that follows
//   player.pos and player.yaw (third person). Everything else
//   (maps, collision, pads, phases) already works.
// ============================================================
import * as THREE from 'three';
import { StreetLevel } from './levels/level1.js';
import { AlienLevel } from './levels/level2.js';
import { ArchitectLevel } from './levels/level3.js';

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true }); // antialiasing ✅
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
  yaw: Math.PI,          // face north (-z)
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
  if (e.code === 'KeyR') switchLevel(current);           // restart, no refresh ✅
  if (e.code === 'Digit1') switchLevel(1);
  if (e.code === 'Digit2') switchLevel(2);
  if (e.code === 'Digit3') switchLevel(3);
  if (e.code === 'KeyP' && level.setPhase) {             // preview boss phases
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
  if (level) level.dispose(scene);
  current = n; phase = 1;
  level = new LEVELS[n](scene);
  player.pos.copy(level.spawn);
  player.vel.set(0, 0, 0);
}

// ---------- minimap (picture-in-picture orthographic view) ✅ ----------
const mini = new THREE.OrthographicCamera(-55, 55, 55, -55, 1, 300);
mini.layers.set(1);          // layer 1 = map meshes only
mini.layers.enable(2);       // layer 2 = player marker
// player arrow on the minimap
const marker = new THREE.Mesh(
  new THREE.ConeGeometry(1.1, 2.6, 6),
  new THREE.MeshBasicMaterial({ color: 0x33ffee }));
marker.rotation.order = 'YXZ';
marker.layers.set(2);
scene.add(marker);

// ---------- physics ----------
const GRAV = 30, SPEED = 12, SPRINT = 24;
function stepPlayer(dt) {
  // input direction in camera space
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sp = keys.ShiftLeft || keys.ShiftRight ? SPRINT : SPEED;
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  // forward = (-sin, 0, -cos), right = (cos, 0, -sin)
  player.vel.x = (-sin * f + cos * s) * sp;
  player.vel.z = (-cos * f - sin * s) * sp;
  player.vel.y -= GRAV * dt;
  if (player.grounded && keys.Space) player.vel.y = 12;

  player.pos.addScaledVector(player.vel, dt);

  // ground
  const g = level.groundHeight(player.pos.x, player.pos.z, player.pos.y);
  if (player.pos.y <= g) { player.pos.y = g; player.vel.y = 0; player.grounded = true; }
  else player.grounded = false;

  // AABB colliders (buildings, cars, props)
  const pMin = new THREE.Vector3(player.pos.x - player.R, player.pos.y, player.pos.z - player.R);
  const pMax = new THREE.Vector3(player.pos.x + player.R, player.pos.y + player.H, player.pos.z + player.R);
  const pb = new THREE.Box3(pMin, pMax);
  for (const c of level.colliders) {
    if (!c.intersectsBox(pb)) continue;
    // push out along the smaller horizontal overlap
    const ox = Math.min(pMax.x - c.min.x, c.max.x - pMin.x);
    const oz = Math.min(pMax.z - c.min.z, c.max.z - pMin.z);
    if (ox < oz) player.pos.x += (pMax.x - c.min.x < c.max.x - pMin.x) ? -ox : ox;
    else player.pos.z += (pMax.z - c.min.z < c.max.z - pMin.z) ? -oz : oz;
    pMin.set(player.pos.x - player.R, player.pos.y, player.pos.z - player.R);
    pMax.set(player.pos.x + player.R, player.pos.y + player.H, player.pos.z + player.R);
  }

  // fell off the world -> respawn
  if (player.pos.y < -60) {
    player.pos.copy(level.spawn);
    player.vel.set(0, 0, 0);
  }
}

// ---------- CHARACTER HOOK ----------
// Third person? Create a Group, add your model to it, then each frame:
//   yourGroup.position.copy(player.pos);
//   yourGroup.rotation.y = player.yaw + Math.PI;
// and move `camera` to trail behind. That's it — collision, pads and
// phases already feed through player.pos / level.update().

// ---------- loop ----------
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  stepPlayer(dt);
  level.update(dt, t, player);

  // first-person camera (swap for your third-person rig at the hook above)
  camera.position.set(player.pos.x, player.pos.y + player.EYE, player.pos.z);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;

  // marker for the minimap
  marker.position.set(player.pos.x, player.pos.y + 2, player.pos.z);
  marker.rotation.set(-Math.PI / 2, player.yaw, 0);

  hud.innerHTML =
    `<b>GENESIS — THE DEVICE</b><br>` +
    `${level.name}${level.setPhase ? ' · phase ' + phase : ''}<br>` +
    `1/2/3 levels · R restart · P boss phase` +
    (player.pos.distanceTo(level.spawn) > 2 ? '' : '');

  // main view (full screen)
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.clear();
  renderer.render(scene, camera);

  // minimap (bottom-right corner)
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

