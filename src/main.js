// main.js
// Bootstrap, first person controller and level manager for The Last Order.
// Combat, the third person avatar, health, audio, minimap and endings are gone.
// Add intro=0 as a query on the address to skip the picture story while developing.
//
// Controls: WASD move, mouse look, Shift faster, Q scanner, E examine.

import * as THREE from 'three';
import { HouseLevel } from './levels/level1.js';
import { IntroStory } from './ui/IntroStory.js';
import { GameMenu } from './ui/menu.js';
import { INTRO_PANELS } from './mystery/introPanels.js';
import { mystery } from './mystery/mystery.js';
import { Scanner } from './mystery/scanner.js';

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
document.body.appendChild(renderer.domElement);

renderer.domElement.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  console.error('[CASE] WebGL context lost. Refresh the tab.');
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  console.log('[CASE] WebGL context restored.');
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 1200);
camera.rotation.order = 'YXZ';
window.__camera = camera;

// ---------- player ----------
// Only a position and a view direction. The player is never drawn.
const player = {
  pos: new THREE.Vector3(0, 0, 2.6),
  vel: new THREE.Vector3(),
  yaw: Math.PI,
  pitch: 0,
  grounded: false,
  EYE: 1.6,
  R: 0.3,
  H: 1.8,
};

// Levels 2 and 3 still call these until their combat code is removed.
const playerHealthStub = {
  hp: 100,
  takeDamage() {},
  heal() {},
  update() {},
};
window.__playerHealth = playerHealthStub;

// ---------- case state ----------
window.__mystery = mystery;

// ---------- game state ----------
const params = new URLSearchParams(location.search);
const skipIntro = params.get('intro') === '0';
let gameActive = false;
let locked = false;

// ---------- hud, hint, prompt, toast ----------
const hud = document.getElementById('hud');
const oldMsg = document.getElementById('msg');
if (oldMsg) oldMsg.style.display = 'none';

const hint = document.createElement('div');
hint.textContent = 'Click to look around';
Object.assign(hint.style, {
  position: 'fixed', left: '50%', bottom: '9%', transform: 'translateX(-50%)',
  padding: '10px 22px', background: 'rgba(0,0,0,0.55)', color: '#f3d98b',
  border: '1px solid rgba(243,217,139,0.45)', borderRadius: '4px',
  font: '15px Georgia, serif', letterSpacing: '0.12em', zIndex: '500',
  display: 'none', pointerEvents: 'none',
});
document.body.appendChild(hint);

const promptEl = document.createElement('div');
Object.assign(promptEl.style, {
  position: 'fixed', left: '50%', bottom: '15%', transform: 'translateX(-50%)',
  padding: '8px 18px', background: 'rgba(0,0,0,0.6)', color: '#7ff5e0',
  border: '1px solid rgba(127,245,224,0.4)', borderRadius: '4px',
  font: '14px Georgia, serif', letterSpacing: '0.1em', zIndex: '500',
  display: 'none', pointerEvents: 'none',
});
document.body.appendChild(promptEl);

window.__setPrompt = (text) => {
  const dialogueOpen = window.__dialogue && window.__dialogue.active;
  const show = text && locked && gameActive && !dialogueOpen;
  promptEl.textContent = text || '';
  promptEl.style.display = show ? 'block' : 'none';
};

const toastEl = document.createElement('div');
Object.assign(toastEl.style, {
  position: 'fixed', left: '50%', top: '12%', transform: 'translateX(-50%)',
  padding: '12px 26px', background: 'rgba(4,9,12,0.85)',
  border: '1px solid rgba(127,245,224,0.45)', borderRadius: '4px',
  color: '#dcefe9', font: '15px Georgia, serif', textAlign: 'center',
  zIndex: '600', display: 'none', pointerEvents: 'none', maxWidth: '72vw',
  lineHeight: '1.5',
});
document.body.appendChild(toastEl);

let toastTimer = 0;
function toast(title, sub, kicker) {
  toastEl.innerHTML =
    '<div style="color:#7ff5e0;letter-spacing:0.28em;font-size:10px;margin-bottom:5px">' +
    (kicker || 'EVIDENCE LOGGED') + '</div>' +
    '<div style="color:#f3d98b;font-size:18px;letter-spacing:0.06em">' + title + '</div>' +
    (sub ? '<div style="color:#a9c8c0;font-size:13px;margin-top:5px;max-width:46ch">' + sub + '</div>' : '');
  toastEl.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, 4600);
}
window.__toast = toast;

function refreshHint() {
  const dialogueOpen = window.__dialogue && window.__dialogue.active;
  hint.style.display = (gameActive && !locked && !dialogueOpen) ? 'block' : 'none';
}

// ---------- input ----------
const keys = {};

addEventListener('keydown', (e) => {
  if (!gameActive) return;
  // Pause toggle works even when paused (menu handles its own keys separately).
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (menu) menu.setPaused(!menu.paused);
    return;
  }
  if (menu && menu.paused) return;
  if (window.__dialogue && window.__dialogue.active) {
    window.__dialogue.handleKey(e.code);
    return;
  }
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();

  if (e.code === 'KeyE') tryInteract();
  if (e.code === 'KeyQ') toggleScanner();

  // developer shortcuts
  if (e.code === 'KeyR') switchLevel(current);
  if (e.code === 'Digit1') switchLevel(1);
  if (e.code === 'Digit2') switchLevel(2);
  if (e.code === 'Digit3') switchLevel(3);
});

addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

addEventListener('blur', () => {
  for (const k of Object.keys(keys)) keys[k] = false;
});

renderer.domElement.addEventListener('click', () => {
  if (!gameActive) return;
  renderer.domElement.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  refreshHint();
});

addEventListener('mousemove', (e) => {
  if (!locked || !gameActive) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0022));
});

// ---------- scanner ----------
function toggleScanner() {
  if (!window.__scanner) return;
  const on = window.__scanner.toggle();
  toast(
    on ? 'SCANNER ONLINE' : 'SCANNER OFF',
    on ? 'Evidence in view glows teal. Press E to examine it.' : '',
    'SCANNER'
  );
}

// ---------- interaction ----------
const raycaster = new THREE.Raycaster();
raycaster.far = 3.2;
const screenCenter = new THREE.Vector2(0, 0);

function clueIdForObject(obj) {
  let o = obj;
  while (o) {
    for (const [id, entry] of mystery.entries) {
      if (entry.object === o && !mystery.hasClue(id)) return id;
    }
    o = o.parent;
  }
  return null;
}

function tryInteract() {
  if (!gameActive || !level) return;
  raycaster.setFromCamera(screenCenter, camera);

  // level-specific interactables (doors, gates) get first claim
  if (typeof level.tryInteract === 'function') {
    try {
      if (level.tryInteract(raycaster)) return;
    } catch (e) { console.warn('level.tryInteract failed:', e); }
  }

  // then registered clues
  const targets = [];
  for (const entry of mystery.entries.values()) {
    if (entry.object && !mystery.hasClue(entry.id)) targets.push(entry.object);
  }
  if (!targets.length) return;
  const hits = raycaster.intersectObjects(targets, true);
  for (const h of hits) {
    const id = clueIdForObject(h.object);
    if (id) {
      mystery.collect(id);
      return;
    }
  }
}

// ---------- clue collection feedback ----------
mystery.onChange((evt) => {
  if (evt.type !== 'collect') return;
  const def = mystery.defs[evt.id] || { name: evt.id, detail: '' };
  toast(def.name, def.detail);
  if (window.__scanner) window.__scanner.sync();
  updateEvidenceHud();
  if (level && typeof level.onClueCollected === 'function') {
    try { level.onClueCollected(evt.id); } catch (e) { console.warn('onClueCollected failed:', e); }
  }
});

// ---------- levels ----------
// Level 1-only: Levels 2/3 are not imported until their combat code is stripped.
// Referencing them here threw `ReferenceError: AlienLevel is not defined` on load.
const LEVELS = { 1: HouseLevel };
let level = null;
let current = 1;
let hudBase = '';

function updateEvidenceHud() {
  if (!hud) return;
  const total = mystery.totalForLevel(current);
  const got = mystery.collectedForLevel(current);
  hud.innerHTML = hudBase +
    (total > 0
      ? '<br><span style="color:#7ff5e0;letter-spacing:0.2em;font-size:12px">EVIDENCE ' +
        got + ' / ' + total + '</span>'
      : '');
}

function disposeLevel() {
  if (!level) return;
  if (window.__scanner) window.__scanner.clear();
  if (typeof level.forgetClues === 'function') level.forgetClues();
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

function adoptSceneParts() {
  // Older levels build their own scene and hand pieces over to the main scene.
  if (!level.scene || level.scene === scene) return;
  if (level.scene.background) scene.background = level.scene.background;
  scene.fog = level.scene.fog !== undefined ? level.scene.fog : null;
  for (const key of ['level', 'root', 'sky', 'stars']) {
    const part = level[key];
    if (part && part.parent === level.scene) {
      level.scene.remove(part);
      scene.add(part);
    }
  }
}

function switchLevel(n) {
  if (!LEVELS[n]) {
    console.warn('Level ' + n + ' not wired yet (Level 1-only build).');
    toast('LEVEL ' + n + ' NOT WIRED YET', 'Level 1-only build: staying in Haru\u2019s house.');
    return;
  }
  disposeLevel();

  if (window.__dialogue) {
    try { window.__dialogue.dispose(); } catch (e) { /* ignore */ }
    window.__dialogue = null;
  }

  try {
    if (renderer.renderLists) renderer.renderLists.dispose();
    if (renderer.info) renderer.info.reset();
  } catch (e) { console.warn('renderer cache flush failed:', e); }

  current = n;

  try {
    level = new LEVELS[n](scene, renderer);
  } catch (e) {
    console.warn('Level ' + n + ' primary constructor failed:', e);
    try { level = new LEVELS[n](scene); } catch (e2) { level = new LEVELS[n](); }
  }

  level.onDamagePlayer = () => {};
  level.playerHealth = playerHealthStub;

  adoptSceneParts();

  if (typeof level.getSpawn === 'function') {
    try { level.spawn = level.getSpawn(); } catch (e) { console.warn('getSpawn failed:', e); }
  }

  if (n === 2 && typeof level.startIntroSequence === 'function') {
    level.startIntroSequence();
  }

  if (!level.spawn || !level.spawn.isVector3) {
    console.warn('Level ' + n + ' missing spawn, using fallback');
    level.spawn = new THREE.Vector3(0, 0.1, 2.6);
  }
  if (!Array.isArray(level.colliders)) level.colliders = [];
  if (!level.name) level.name = 'LEVEL ' + n;

  player.pos.copy(level.spawn);
  player.vel.set(0, 0, 0);
  player.yaw = (typeof level.spawnYaw === 'number') ? level.spawnYaw : Math.PI;
  player.pitch = 0;

  hudBase = '<b>GENESIS CASE FILES</b><br>' + level.name +
    '<br><span style="color:#8d8878;font-size:11px">WASD move · mouse look · Shift faster · Q scanner · E examine</span>';
  updateEvidenceHud();

  // scanner shells follow the clues of the level that just built them
  if (!window.__scanner) window.__scanner = new Scanner(camera, scene);
  window.__scanner.clear();
  window.__scanner.sync();
}

window.__switchLevel = switchLevel;

// ---------- physics ----------
const GRAV = 30;
const SPEED = 3.2;
const SPRINT = 5.5;

function groundAt(x, z, y) {
  try {
    if (level && typeof level.getSurfaceHeight === 'function') return level.getSurfaceHeight(x, z);
    if (level && typeof level.groundHeight === 'function') return level.groundHeight(x, z, y);
    if (level && typeof level.terrainHeight === 'function') return level.terrainHeight(x, z);
  } catch (e) { /* ignore */ }
  return 0;
}

function stepPlayer(dt) {
  const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sprint = keys.ShiftLeft || keys.ShiftRight;
  const sp = sprint ? SPRINT : SPEED;

  const sin = Math.sin(player.yaw);
  const cos = Math.cos(player.yaw);
  let vx = sin * fwd - cos * strafe;
  let vz = cos * fwd + sin * strafe;
  const len = Math.hypot(vx, vz);
  if (len > 1) { vx /= len; vz /= len; }
  player.vel.x = vx * sp;
  player.vel.z = vz * sp;
  player.vel.y -= GRAV * dt;

  player.pos.addScaledVector(player.vel, dt);

  const g = groundAt(player.pos.x, player.pos.z, player.pos.y);
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
    else player.pos.set(0, 1, 2.6);
    player.vel.set(0, 0, 0);
  }
}

// ---------- loop ----------
const timer = new THREE.Timer();
let rafId = 0;

function tick() {
  rafId = requestAnimationFrame(tick);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();

  if (!level) return;

  const paused = (menu && menu.paused) || !gameActive;
  if (!paused) stepPlayer(dt);

  if (window.__scanner) {
    try { window.__scanner.update(dt, t); } catch (e) { /* ignore */ }
  }

  if (!paused && typeof level.update === 'function') {
    try { level.update(dt, t, player); }
    catch (e) { console.warn('level.update error', e); }
  }

  // compose the interact prompt: scanner target wins, then the level's own
  let promptLabel = '';
  if (window.__scanner && window.__scanner.active && window.__scanner.target) {
    const def = mystery.defs[window.__scanner.target];
    promptLabel = 'E — Examine: ' + (def ? def.name : 'evidence');
  } else if (typeof level.getPrompt === 'function') {
    try { promptLabel = level.getPrompt(player) || ''; } catch (e) { /* ignore */ }
  }
  window.__setPrompt(promptLabel);

  // first person camera sits at eye height and looks along yaw and pitch
  camera.position.set(player.pos.x, player.pos.y + player.EYE, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw + Math.PI, 0);

  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- start ----------
let menu = null;

function beginPlay() {
  gameActive = true;
  refreshHint();
}

// Correct order: menu first -> Start Game -> picture story -> Level 1.
// `?intro=0` still skips the picture story after Start (dev shortcut).
function startGame() {
  if (menu) menu.hideAll();
  if (skipIntro) {
    beginPlay();
  } else {
    new IntroStory({ panels: INTRO_PANELS, onDone: beginPlay }).start();
  }
}

switchLevel(1);
tick();

menu = new GameMenu({
  onStart: startGame,
  onRestart: () => {
    menu.setPaused(false);
    switchLevel(current);
  },
  onQuitToMenu: () => {
    gameActive = false;
    for (const k of Object.keys(keys)) keys[k] = false;
    if (document.pointerLockElement) document.exitPointerLock();
    window.__setPrompt('');
    menu.showMain();
    refreshHint();
  },
});
window.__menu = menu;

// ---------- Vite hot reload cleanup ----------
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(rafId);
    try {
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    } catch (e) { console.warn('HMR renderer dispose failed:', e); }
    try {
      if (level && typeof level.dispose === 'function') level.dispose(scene);
    } catch (e) { console.warn('HMR level dispose failed:', e); }
    try {
      if (window.__dialogue) window.__dialogue.dispose();
    } catch (e) { /* ignore */ }
    try {
      if (menu) menu.dispose();
    } catch (e) { /* ignore */ }
    hint.remove();
    promptEl.remove();
    toastEl.remove();
  });
}

