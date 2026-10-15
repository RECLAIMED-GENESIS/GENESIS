// ============================================================
// main.js — bootstrap, player controller, level manager, minimap
// ============================================================
import * as THREE from 'three';
import { StreetLevel } from './levels/lvl1.js';
import { LabLevel }    from './levels/LabLevel.js';
import { CityLevel }   from './levels/CityLevel.js';
import { DepotLevel }  from './levels/DepotLevel.js';
import { GameShell } from './ui/GameShell.js';
import { AudioManager } from './audio/AudioManager.js';
import { loadAllAudio } from './audio/loadAudio.js';
import { getStats } from './game/stats.js';

const LEVELS = { 1: StreetLevel, 2: LabLevel, 3: CityLevel, depot: DepotLevel };

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

renderer.domElement.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  console.error('[GENESIS] WebGL context lost. Refresh the tab.');
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  console.log('[GENESIS] WebGL context restored.');
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1200);
camera.rotation.order = 'YXZ';
window.__camera = camera;

const player = {
  pos: new THREE.Vector3(0, 0, 55),
  vel: new THREE.Vector3(),
  yaw: Math.PI,
  pitch: 0,
  grounded: false,
  EYE: 1.7,
  R: 0.4, H: 1.8,
};

const keys = {};
let locked = false;

addEventListener('keydown', e => {
  if ((e.code === 'KeyP' || e.code === 'Escape') && !window.__uiCapture && !e.repeat) {
    if (appState === 'playing' && !levelUiOpen()) setPaused(!paused);
    return;
  }
  if (e.code === 'KeyR' && !window.__uiCapture && !e.repeat && appState === 'playing' && !paused) {
    switchLevel(current, { fade: true, card: true });
    return;
  }

  if (window.__uiCapture) return;

  if (window.__dialogue && window.__dialogue.active) {
    window.__dialogue.handleKey(e.code);
    return;
  }

  if (levelUiOpen() || paused || appState !== 'playing') return;

  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();

  if (e.code === 'Space' && player.grounded) {
    player.vel.y = 12;
  }
});

addEventListener('keyup', e => keys[e.code] = false);

function lockPointer() {
  try {
    const p = renderer.domElement.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (err) {}
}

renderer.domElement.addEventListener('click', () => {
  if (appState === 'playing' && !paused && !levelUiOpen()) lockPointer();
});

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  updateMsg();
  if (!locked && appState === 'playing' && !paused && !levelUiOpen()) setPaused(true);
});

addEventListener('mousemove', e => {
  if (!locked || paused || appState !== 'playing') return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch - e.movementY * 0.0022));
});

let level = null, current = 1;
let appState = 'menu';
let paused = false;
const hud = document.getElementById('hud');
const msgEl = document.getElementById('msg');
const crossEl = document.getElementById('cross');

const audio = new AudioManager();
try { loadAllAudio(audio); } catch (e) { console.warn('audio init failed', e); }

const shell = new GameShell({
  audio,
  onNewGame,
  onContinue,
  onResume: () => { setPaused(false); lockPointer(); },
  onRestartLevel: () => { setPaused(false); switchLevel(current, { fade: true, card: true }); },
  onQuitToMenu: () => quitToMenu(),
});

function levelUiOpen() {
  if (window.__uiCapture) return true;
  if (!level) return false;
  return !!(level.caseOpen || level.outroOpen || level.fileOpen || level.panelOpen ||
    level.endOpen || level.dialogueOpen || level.suspectsOpen || level.verdictOpen ||
    level.confirmOpen);
}

function updateMsg() {
  const shellOpen = !!document.querySelector('.gs-screen.on');
  const clean = appState === 'playing' && !paused && !levelUiOpen() && !shellOpen;
  if (msgEl) msgEl.style.display = (clean && !locked) ? 'block' : 'none';
  if (crossEl) crossEl.style.display = (appState === 'playing' && !shellOpen) ? 'block' : 'none';
  if (hud) hud.style.display = (appState === 'playing' && level) ? 'block' : 'none';
  const pb = document.getElementById('pauseBtn');
  if (pb) pb.style.display = clean ? 'block' : 'none';
}

function setPaused(p) {
  if (appState !== 'playing') return;
  if (p && levelUiOpen()) return;
  paused = p;
  window.__paused = p;
  if (p) {
    for (const k of Object.keys(keys)) keys[k] = false;
    if (document.exitPointerLock) document.exitPointerLock();
    shell.showPause(level && level.name ? level.name : '');
  } else {
    shell.hideAll();
  }
  updateMsg();
}

function disposeLevel() {
  if (!level) return;
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
  level = null;
  if (window.__dialogue) {
    try { window.__dialogue.dispose(); } catch (e) {}
    window.__dialogue = null;
  }
  window.__uiCapture = false;
}

function buildLevel(n) {
  disposeLevel();
  try {
    if (renderer.renderLists) renderer.renderLists.dispose();
    if (renderer.info) renderer.info.reset();
  } catch (e) { console.warn('renderer cache flush failed:', e); }

  current = n;
  try {
    level = new LEVELS[n](scene, renderer);
  } catch (e) {
    console.warn(`Level ${n} primary constructor failed:`, e);
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

  if (typeof level.getSpawn === 'function') {
    try { level.spawn = level.getSpawn(); } catch (e) { console.warn('getSpawn failed:', e); }
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
  player.yaw   = (typeof level.spawnYaw === 'number') ? level.spawnYaw : Math.PI;
  player.pitch = 0;

  try { getStats().levelStartAt = Date.now(); } catch (e) {}
}

async function switchLevel(n, opts = {}) {
  if (!LEVELS[n]) {
    console.warn(`Level ${n} is not available yet.`);
    return;
  }
  const useCard = opts.card !== false;
  try {
    const st = getStats();
    if (st.levelStartAt) st.elapsedMs += Date.now() - st.levelStartAt;
    st.levelStartAt = 0;
  } catch (e) {}
  await shell.transition(() => buildLevel(n), useCard && typeof n === 'number' ? n : 0);
  paused = false;
  window.__paused = false;
  try { audio.playLevelMusic(n); } catch (e) {}
  try {
    audio.stopAmbience();
    if (n === 3) audio.playAmbience('city_ambience');
  } catch (e) {}
  try { shell.saveGame({ level: n, caseProgress: window.__caseProgress || null }); } catch (e) {}
  _lastHudString = '';
  updateMsg();
}

function onNewGame() {
  shell.clearSave();
  window.__caseProgress = null;
  appState = 'intro';
  shell.showIntro(() => {
    appState = 'playing';
    switchLevel(1, { fade: true, card: true });
  });
}

function onContinue() {
  const s = shell.loadGame();
  if (!s) return;
  window.__caseProgress = (s.caseProgress !== undefined) ? s.caseProgress : null;
  try { getStats(); } catch (e) {}
  appState = 'playing';
  shell.hideAll();
  switchLevel(s.level || 1, { fade: true, card: true });
}

function quitToMenu() {
  paused = false;
  window.__paused = false;
  try {
    const st = getStats();
    if (st.levelStartAt) { st.elapsedMs += Date.now() - st.levelStartAt; st.levelStartAt = 0; }
  } catch (e) {}
  disposeLevel();
  try { audio.stopMusic(); audio.stopAmbience(); } catch (e) {}
  scene.background = null;
  scene.fog = null;
  appState = 'menu';
  shell.showMenu();
  try { audio.playMusic('menu_theme'); } catch (e) {}
  updateMsg();
}

window.__switchLevel = (n) => { if (appState === 'playing') switchLevel(n, { fade: true, card: typeof n === 'number' }); };
window.__showMenu = () => quitToMenu();
window.__restartLevel = () => { if (appState === 'playing') switchLevel(current, { fade: true, card: true }); };
window.__saveRun = () => { try { shell.saveGame({ level: current, caseProgress: window.__caseProgress || null }); } catch (e) {} };

const mini = new THREE.OrthographicCamera(-55, 55, 55, -55, 1, 300);
mini.layers.enable(0);
mini.layers.enable(1);
mini.layers.enable(2);
const marker = new THREE.Mesh(
  new THREE.ConeGeometry(1.1, 2.6, 6),
  new THREE.MeshBasicMaterial({ color: 0x33ffee }));
marker.rotation.order = 'YXZ';
marker.layers.set(2);
scene.add(marker);

const GRAV = 30, SPEED = 4.5, SPRINT = 9;
const TURN_SPEED = 2.2;

function stepPlayer(dt) {
  const isSprint = keys.ShiftLeft || keys.ShiftRight;
  const sp = isSprint ? SPRINT : SPEED;
  const frozen = paused || levelUiOpen();

  if (!frozen && !locked) {
    if (keys.KeyA) player.yaw += TURN_SPEED * dt;
    if (keys.KeyD) player.yaw -= TURN_SPEED * dt;
  }

  const f = frozen ? 0 : (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const s = (frozen || !locked) ? 0 : (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);

  player.vel.x = (-sin * f + cos * s) * sp;
  player.vel.z = (-cos * f - sin * s) * sp;

  player.vel.y -= GRAV * dt;
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
    else         player.pos.z += (pMax.z - c.min.z < c.max.z - pMin.z) ? -oz : oz;
    pMin.set(player.pos.x - player.R, player.pos.y, player.pos.z - player.R);
    pMax.set(player.pos.x + player.R, player.pos.y + player.H, player.pos.z + player.R);
  }

  if (player.pos.y < -60) {
    if (level && level.spawn && level.spawn.isVector3) player.pos.copy(level.spawn);
    else player.pos.set(0, 2, 55);
    player.vel.set(0, 0, 0);
  }
}

const timer = new THREE.Timer();
let _rafId = 0;
let _lastHudString = '';

function renderScene() {
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

function tick() {
  _rafId = requestAnimationFrame(tick);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t  = timer.getElapsed();

  if (!level) { renderScene(); updateMsg(); return; }
  if (paused) { renderScene(); return; }

  stepPlayer(dt);
  if (typeof level.update === 'function') {
    try { level.update(dt, t, player); }
    catch (e) { console.warn('level.update error', e); }
  }

  if (!window.__firstPerson) {
    const EYE = player.EYE || 1.7;
    camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(player.pitch, player.yaw, 0);
  }

  marker.position.set(player.pos.x, player.pos.y + 2, player.pos.z);
  marker.rotation.set(-Math.PI / 2, player.yaw, 0);

  const levelName = (level && level.name) ? level.name : `LEVEL ${current}`;
  const hudStr =
    `<b>GENESIS — ${levelName}</b><br>` +
    `WASD move · E examine · F torch · C file · P pause`;
  if (hudStr !== _lastHudString) {
    hud.innerHTML = hudStr;
    _lastHudString = hudStr;
  }
  updateMsg();

  renderScene();
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

document.getElementById('pauseBtn').addEventListener('click', () => {
  if (appState === 'playing' && !paused && !levelUiOpen()) setPaused(true);
});
shell.showMenu();
try { audio.playMusic('menu_theme'); } catch (e) {}
updateMsg();
tick();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(_rafId);
    try {
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    } catch (e) { console.warn('HMR renderer dispose failed:', e); }
    try {
      if (level && typeof level.dispose === 'function') level.dispose(scene);
    } catch (e) { console.warn('HMR level dispose failed:', e); }
    try {
      if (window.__dialogue) window.__dialogue.dispose();
    } catch (e) {}
  });
}
