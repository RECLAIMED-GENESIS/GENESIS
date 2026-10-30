// ============================================================
// main.js — bootstrap, player controller, level manager
// ============================================================
import * as THREE from 'three';
import { showLoading, hideLoading, paintLoading, waitForAssets, prepareGraphics } from './game/loading.js';
import { StreetLevel } from './levels/lvl1.js';
import { LabLevel }    from './levels/LabLevel.js';
import { ChaseLevel }  from './levels/ChaseLevel.js';
import { styleLevelUI } from './ui/gameUI.js';
import { GameShell, LEVEL_CARDS } from './ui/GameShell.js';
import { AudioManager } from './audio/AudioManager.js';
import { loadAllAudio } from './audio/loadAudio.js';
import { getStats } from './game/stats.js';
import { MouseLook } from './game/MouseLook.js';

const LEVELS = { 1: StreetLevel, 2: LabLevel, 3: ChaseLevel };

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false;
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
let cameraMode = 'first';

const player = {
  pos: new THREE.Vector3(0, 0, 55),
  vel: new THREE.Vector3(),
  yaw: Math.PI,
  pitch: 0,
  grounded: false,
  EYE: 1.7,
  R: 0.4, H: 1.8,
};

const mouseLook = new MouseLook();
const keys = {};
let locked = false;
let lockPending = false;
// True when a level panel (lab sheets, devices, dialogue) took the mouse away.
// The next key or click after the panel closes captures it again, so walking
// carries on. A mouse freed on purpose with Esc is left alone.
let relockAfterPanel = false;
let lockError = false;

// Click captures the mouse; Escape only releases it. P controls pause.
addEventListener('keydown', e => {
  if (e.code === 'Escape' && locked) {
    relockAfterPanel = false;
    mouseLook.reset();
    if (document.exitPointerLock) document.exitPointerLock();
    return;
  }
  if (e.code === 'KeyP' && !window.__uiCapture && !e.repeat) {
    if (appState === 'playing' && !levelUiOpen()) setPaused(!paused);
    return;
  }
  if (e.code === 'KeyR' && !window.__uiCapture && !e.repeat && appState === 'playing' && !paused) {
    switchLevel(current, { fade: true, card: true });
    return;
  }

  if (window.__uiCapture || transitioning) return;

  if (window.__dialogue && window.__dialogue.active) {
    window.__dialogue.handleKey(e.code);
    return;
  }

  if (levelUiOpen() || paused || appState !== 'playing') return;

  if (e.code === 'KeyV') {
    e.stopImmediatePropagation();
    if (!e.repeat) shell.setCameraMode(cameraMode === 'first' ? 'third' : 'first');
    return;
  }

  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();

  if (e.code === 'Space' && player.grounded) {
    player.vel.y = 12;
  }
});

addEventListener('keyup', e => { keys[e.code] = false; relockIfPanelClosed(); });
// runs after the level's own handlers, so the panel has already closed
addEventListener('click', () => relockIfPanelClosed());
function relockIfPanelClosed() {
  if (!relockAfterPanel || locked || paused || transitioning || appState !== 'playing' || levelUiOpen()) return;
  relockAfterPanel = false;
  lockPointer();
}

function pointerLockFailed() {
  lockPending = false;
  lockError = true;
  updateMsg();
}

function lockPointer() {
  if (document.pointerLockElement === renderer.domElement || lockPending) return;
  lockPending = true;
  lockError = false;
  try {
    const p = renderer.domElement.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(pointerLockFailed);
  } catch (err) { pointerLockFailed(); }
}

renderer.domElement.addEventListener('click', () => {
  if (appState === 'playing' && !paused && !levelUiOpen()) lockPointer();
});

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (!locked && appState === 'playing' && levelUiOpen()) relockAfterPanel = true;
  if (locked) relockAfterPanel = false;
  lockPending = false;
  lockError = false;
  mouseLook.reset();
  for (const key of Object.keys(keys)) keys[key] = false;
  updateMsg();
});
document.addEventListener('pointerlockerror', pointerLockFailed);

// A browser context menu can release capture during a right click.
renderer.domElement.addEventListener('contextmenu', e => {
  if (document.pointerLockElement === renderer.domElement) e.preventDefault();
});

addEventListener('mousemove', e => {
  if (!locked || paused || appState !== 'playing' || levelUiOpen()) return;
  mouseLook.add(e.movementX, e.movementY);
});

addEventListener('blur', () => {
  mouseLook.reset();
  for (const key of Object.keys(keys)) keys[key] = false;
  // Focus notifications alone must not release the game's mouse confinement.
  // The browser handles tab/application switches; pointerlockchange is authoritative.
});

let level = null, current = 1;
let appState = 'menu';
let paused = false;
let transitioning = false;
let loadingSceneReady = false;
const hud = document.getElementById('hud');
const msgEl = document.getElementById('msg');
const crossEl = document.getElementById('cross');
// Keep shared controls above the level-specific tool belt.
hud.style.bottom = '48px';
msgEl.style.bottom = '104px';
msgEl.style.pointerEvents = 'none';
crossEl.style.pointerEvents = 'none';

const audio = new AudioManager();
try { loadAllAudio(audio); } catch (e) { console.warn('audio init failed', e); }

// Browsers block audio before the first user gesture, so the menu theme
// started on page load dies silently. Retry it on the first click/keypress.
function unlockAudio() {
  try {
    if (audio && typeof audio._unlock === 'function') audio._unlock();
    if (appState === 'menu' && audio && !audio.isPlayingMusic) audio.playMusic('menu_theme');
  } catch (e) {}
}
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

const shell = new GameShell({
  audio,
  onCameraMode: mode => {
    cameraMode = mode;
    level?._view?.setMode(mode);
    if (current === 3 && level) level.view = mode;
  },
  onNewGame,
  onContinue,
  onResume: () => { setPaused(false); },
  onRestartLevel: () => { setPaused(false); switchLevel(current, { fade: true, card: true }); },
  onQuitToMenu: () => quitToMenu(),
});

function levelUiOpen() {
  if (window.__uiCapture) return true;
  if (!level) return false;
  return !!(level.caseOpen || level.outroOpen || level.fileOpen || level.panelOpen ||
    level.endOpen || level.dialogueOpen || level.suspectsOpen || level.verdictOpen ||
    level.confirmOpen || level.reconOpen);
}

const pauseBtn = document.getElementById('pauseBtn');
let shellOpen = !!shell.root.querySelector('.gs-screen.on');
let lastMsgState = null;
// Shell visibility changes only when a screen's class changes, not every frame.
const shellObserver = new MutationObserver(() => {
  shellOpen = !!shell.root.querySelector('.gs-screen.on');
  updateMsg();
});
for (const screen of Object.values(shell.screens)) {
  shellObserver.observe(screen, { attributes: true, attributeFilter: ['class'] });
}

function updateMsg() {
  const uiOpen = levelUiOpen();
  const hasLevel = !!level;
  const prev = lastMsgState;
  if (prev && prev.shellOpen === shellOpen && prev.locked === locked &&
      prev.paused === paused && prev.appState === appState && prev.uiOpen === uiOpen &&
      prev.lockError === lockError && prev.hasLevel === hasLevel) return;
  lastMsgState = { shellOpen, locked, paused, appState, uiOpen, lockError, hasLevel };
  document.body.dataset.uiSuspended = String(transitioning || shellOpen || paused || appState !== 'playing');
  const clean = appState === 'playing' && !paused && !uiOpen && !shellOpen && !transitioning;
  if (msgEl) msgEl.style.display = (clean && !locked) ? 'block' : 'none';
  if (msgEl) msgEl.textContent = lockError
    ? 'MOUSE CAPTURE FAILED — Click the game to retry'
    : 'Click to play · Esc releases mouse · P pauses';
  if (crossEl) crossEl.style.display = (clean && current !== 1 && current !== 3) ? 'block' : 'none';
  if (hud) hud.style.display = (appState === 'playing' && hasLevel) ? 'block' : 'none';
  if (pauseBtn) pauseBtn.style.display = clean ? 'block' : 'none';
}

function setPaused(p) {
  if (appState !== 'playing') return;
  if (p && levelUiOpen()) return;
  mouseLook.reset();
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

  styleLevelUI(level, n);
  player.pos.copy(level.spawn);
  player.vel.set(0, 0, 0);
  player.yaw   = (typeof level.spawnYaw === 'number') ? level.spawnYaw : Math.PI;
  player.pitch = 0;

  try { getStats().levelStartAt = Date.now(); } catch (e) {}
}

async function switchLevel(n, opts = {}) {
  if (transitioning) return;
  if (!LEVELS[n]) {
    console.warn(`Level ${n} is not available yet.`);
    return;
  }
  transitioning = true;
  loadingSceneReady = false;
  document.body.dataset.uiSuspended = 'true';
  window.__paused = true;
  for (const key of Object.keys(keys)) keys[key] = false;
  mouseLook.reset();
  player.vel.set(0, 0, 0);
  const useCard = opts.card !== false;
  try {
    const st = getStats();
    if (st.levelStartAt) st.elapsedMs += Date.now() - st.levelStartAt;
    st.levelStartAt = 0;
  } catch (e) {}
  const loaded = await shell.transition(async () => {
    showLoading(`Level ${n} — ${LEVEL_CARDS[n].sub}`);
    await paintLoading();
    const timing = { level: n };
    const started = performance.now();
    buildLevel(n);
    timing.constructionMs = Math.round(performance.now() - started);
    camera.position.copy(player.pos).add(new THREE.Vector3(0, player.EYE, 0));
    camera.rotation.set(player.pitch, player.yaw, 0);
    // Station materials change as assets arrive. Rendering them here forces
    // synchronous shader compilation before compileAsync can prepare them.
    loadingSceneReady = n !== 2;
    // Reveal the new scene behind the loading overlay, without advancing play.
    shell.veil.classList.remove('on');
    await paintLoading();
    const assetsStarted = performance.now();
    await waitForAssets();
    timing.assetsMs = Math.round(performance.now() - assetsStarted);
    const graphicsStarted = performance.now();
    await prepareGraphics(renderer, scene, camera);
    timing.graphicsMs = Math.round(performance.now() - graphicsStarted);
    timing.totalMs = Math.round(performance.now() - started);
    window.__lastLevelLoad = timing;
    console.info('[level loading]', timing);
    loadingSceneReady = true;
    hideLoading();
  }, useCard && typeof n === 'number' ? n : 0);
  hideLoading();
  transitioning = false;
  loadingSceneReady = false;
  lastMsgState = null;
  if (loaded === false) { paused = true; window.__paused = true; return; }
  paused = false;
  window.__paused = false;
  level?._view?.setMode(cameraMode);
  if (n === 3 && level) level.view = cameraMode;
  try { audio.playLevelMusic(n); } catch (e) {}
  try {
    audio.stopAmbience();
    if (n === 2 || n === 3) audio.playAmbience('city_ambience');
  } catch (e) {}
  try { shell.saveGame({ level: n, caseProgress: window.__caseProgress || null }); } catch (e) {}
  _lastHudString = '';
  updateMsg();
}

function onNewGame() {
  shell.clearSave();
  window.__caseProgress = null;
  appState = 'playing';
  shell.hideAll();
  switchLevel(1, { fade: true, card: true });
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
// console helper: __level() is the level you are in, e.g. __level()._openOutro() previews Level 1's ending
window.__level = () => level;
window.__saveRun = () => { try { shell.saveGame({ level: current, caseProgress: window.__caseProgress || null }); } catch (e) {} };

const GRAV = 30, SPEED = 3, SPRINT = 6;
const pMin = new THREE.Vector3();
const pMax = new THREE.Vector3();
const playerBounds = new THREE.Box3(pMin, pMax);

function stepPlayer(dt) {
  const isSprint = keys.ShiftLeft || keys.ShiftRight;
  const sp = isSprint ? SPRINT : SPEED;
  const frozen = paused || levelUiOpen() || !locked;

  const f = frozen ? 0 : (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const s = (frozen || !locked) ? 0 : (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);

  const scale = sp / Math.max(1, Math.hypot(f, s));
  player.vel.x = (-sin * f + cos * s) * scale;
  player.vel.z = (-cos * f - sin * s) * scale;

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
  pMin.set(player.pos.x - player.R, player.pos.y, player.pos.z - player.R);
  pMax.set(player.pos.x + player.R, player.pos.y + player.H, player.pos.z + player.R);
  const pb = playerBounds;
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

// No diagnostic listeners, DOM, or frame work exist without ?debug=1.
let stopDiagnostics;
if (new URLSearchParams(location.search).get('debug') === '1') {
  const fps = document.createElement('div');
  fps.style.cssText = 'position:fixed;top:8px;left:8px;z-index:30000;color:#fff;background:#000a;padding:4px;font:12px monospace;pointer-events:none';
  document.body.appendChild(fps);
  let frames = 0, since = performance.now(), debugRaf;
  const sample = now => {
    frames++;
    if (now - since >= 500) {
      fps.textContent = `${Math.round(frames * 1000 / (now - since))} FPS`;
      frames = 0; since = now;
    }
    debugRaf = requestAnimationFrame(sample);
  };
  debugRaf = requestAnimationFrame(sample);
  // Opt in separately: ?debug=1&mouse=1 (logging can itself affect FPS).
  const logMouse = e => console.log('[mouse]', e.movementX, e.movementY);
  if (new URLSearchParams(location.search).get('mouse') === '1') addEventListener('mousemove', logMouse);
  stopDiagnostics = () => {
    cancelAnimationFrame(debugRaf);
    removeEventListener('mousemove', logMouse);
    fps.remove();
  };
}

const timer = new THREE.Timer();
let _rafId = 0;
let _lastHudString = '';

function renderScene() {
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.clear();
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
}

function tick() {
  _rafId = requestAnimationFrame(tick);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t  = timer.getElapsed();

  if (transitioning) {
    if (loadingSceneReady) renderScene();
    return;
  }
  if (!level) { renderScene(); updateMsg(); return; }
  if (paused) { renderScene(); return; }

  if (locked && !levelUiOpen()) mouseLook.apply(player, dt);
  else mouseLook.reset();
  if (current !== 3) stepPlayer(dt);
  if (current === 2) {
    const p = player.pos;
    const workspace = p.x > -22.5 && p.x < -10 && p.z > 7 && p.z < 18.2;
    const indoors = workspace || (Math.abs(p.x) < 10.3 && p.z > -7.2 && p.z < 19)
      || (p.x >= 10.3 && p.x < 20.3 && p.z > 7 && p.z < 17.2);
    audio.playAmbience(indoors ? (workspace ? 'station_workspace' : 'station_office') : 'city_ambience');
  }

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

  const levelName = (level && level.name) ? level.name : `LEVEL ${current}`;
  const hudStr = `<b>GENESIS — ${levelName}</b>`;
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
hideLoading();
shell.showMenu();
try { audio.playMusic('menu_theme'); } catch (e) {}
updateMsg();
tick();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(_rafId);
    shellObserver.disconnect();
    stopDiagnostics?.();
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
