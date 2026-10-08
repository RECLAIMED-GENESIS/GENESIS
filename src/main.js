// ============================================================
// main.js — bootstrap, player controller, level manager, minimap
// ============================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { StreetLevel } from './levels/level1.js';
import { AlienLevel } from './levels/level2.js';
import { ArchitectLevel } from './levels/level3.js';
import { PlayerHealth } from './player/PlayerHealth.js';
import { AudioManager } from './audio/AudioManager.js';
import { loadAllAudio } from './audio/loadAudio.js';
import { Dialogue } from './ui/dialogue.js';
import { endingAttack, endingLearn, endingSilence } from './player/endings.js';
import { UIManager } from './ui/UIManager.js';
import { createMainMenu } from './ui/MainMenu.js';
import { MenuScene } from './ui/MenuScene.js';
import { CinematicCamera } from './ui/CinematicCamera.js';
import { createHUD, updateHUD } from './ui/HUD.js';   // ← ADDED updateHUD
import { createLoadingScreen, updateLoadingScreen } from './ui/LoadingScreen.js';
import { PauseMenu } from './ui/PauseMenu.js';

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

renderer.domElement.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  console.error('[GENESIS] WebGL context lost. Refresh the tab.');
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1200);
camera.rotation.order = 'YXZ';
window.__camera = camera;

const cinematicCamera = new CinematicCamera();
window.__cinematicCamera = cinematicCamera;

// ---------- audio ----------
const audioManager = new AudioManager();
loadAllAudio(audioManager);
window.__audioManager = audioManager;

// ---------- root motion fix ----------
function stripRootMotion(clip) {
  if (!clip || !clip.tracks) return clip;
  for (const track of clip.tracks) {
    if (!/Hips/i.test(track.name) || !/\.position/i.test(track.name)) continue;
    const v = track.values;
    if (!v || v.length < 3) continue;
    const x0 = v[0], z0 = v[2];
    for (let i = 0; i < v.length; i += 3) {
      v[i] = x0;
      v[i + 2] = z0;
    }
  }
  return clip;
}

// ---------- player ----------
const player = {
  pos: new THREE.Vector3(0, 0, 55),
  vel: new THREE.Vector3(),
  yaw: Math.PI,
  cameraYaw: Math.PI,
  pitch: 0,
  grounded: false,
  EYE: 1.7,
  R: 0.4, H: 1.8,
};

// =====================================================
// PLAYER HEALTH — shared across all levels
// =====================================================
let _lastDeathPos = null;

const playerHealth = new PlayerHealth({
  onDeath: () => {
    _lastDeathPos = player.pos.clone();
  },
  onRespawn: (spawnPos) => {
    let target = null;
    if (spawnPos && spawnPos.isVector3) {
      target = spawnPos;
    } else if (_lastDeathPos) {
      target = _lastDeathPos;
    } else if (level && level.spawn) {
      target = level.spawn;
    }
    if (target) {
      player.pos.copy(target);
      player.pos.y = (level && level.getSurfaceHeight)
        ? level.getSurfaceHeight(player.pos.x, player.pos.z) + 0.2
        : player.pos.y + 0.2;
    }
    player.vel.set(0, 0, 0);
    _lastDeathPos = null;
  }
});
window.__playerHealth = playerHealth;

// ---------- Sorini avatar ----------
const soriniGroup = new THREE.Group();
scene.add(soriniGroup);

// ── Axiom (the artifact) — a glowing point at Sorini's chest ──
const axiomLight = new THREE.PointLight(0x88ddff, 0, 6, 2);
axiomLight.position.set(0, 1.1, 0.3);
soriniGroup.add(axiomLight);

const axiomMesh = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.12, 0),
  new THREE.MeshStandardMaterial({
    color: 0x88ddff,
    emissive: 0x88ddff,
    emissiveIntensity: 0,
    transparent: true,
    opacity: 0,
  })
);
axiomMesh.position.set(0, 1.1, 0.3);
soriniGroup.add(axiomMesh);

window.__axiom = {
  light: axiomLight,
  mesh: axiomMesh,
  activate() {
    axiomLight.intensity = 0;
    axiomMesh.material.opacity = 0;
    axiomMesh.material.emissiveIntensity = 0;
  },
  setIntensity(v) {
    axiomLight.intensity = v;
    axiomMesh.material.opacity = Math.min(1, v);
    axiomMesh.material.emissiveIntensity = v * 3;
  },
};

// ── Axiom Dash trail ──
const dashTrailPool = [];
const DASH_TRAIL_COUNT = 6;   // how many ghost sprites left behind

for (let i = 0; i < DASH_TRAIL_COUNT; i++) {
  const ghost = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 8, 6),
    new THREE.MeshBasicMaterial({
      color: 0x88ddff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  ghost.visible = false;
  scene.add(ghost);
  dashTrailPool.push({ mesh: ghost, life: 0 });
}

function spawnDashTrail(fromPos) {
  // Find an unused ghost
  for (const t of dashTrailPool) {
    if (t.life <= 0) {
      t.mesh.position.copy(fromPos);
      t.mesh.position.y += 1.0;
      t.mesh.visible = true;
      t.mesh.material.opacity = 0.7;
      t.mesh.scale.setScalar(1.0);
      t.life = 0.4;   // seconds
      return;
    }
  }
}

function updateDashTrails(dt) {
  for (const t of dashTrailPool) {
    if (t.life > 0) {
      t.life -= dt;
      const progress = Math.max(0, t.life / 0.4);
      t.mesh.material.opacity = 0.7 * progress;
      t.mesh.scale.setScalar(1.0 + (1 - progress) * 1.5);
      if (t.life <= 0) {
        t.mesh.visible = false;
        t.mesh.material.opacity = 0;
      }
    }
  }
}

let soriniMixer  = null;
let soriniActions = {};
let soriniCurrentAction = null;
let _soriniPending = null;

function playSoriniAction(name, loop = true) {
  let next = soriniActions[name];
  if (!next && name === 'walk') next = soriniActions['run'] || soriniActions['idle'];
  if (!next) { _soriniPending = { name, loop }; return; }
  if (next === soriniCurrentAction) {
    if (next.isRunning()) return;
    next.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.05).play();
    return;
  }
  if (soriniCurrentAction) soriniCurrentAction.fadeOut(0.22);
  next.reset()
    .setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
    .fadeIn(0.22).play();
  if (!loop) next.clampWhenFinished = true;
  soriniCurrentAction = next;
}

const soriniClips = {};

function _bindSoriniClip(key) {
  if (!soriniMixer || !soriniClips[key] || soriniActions[key]) return;
  soriniActions[key] = soriniMixer.clipAction(soriniClips[key]);
  if (_soriniPending && _soriniPending.name === key) {
    const p = _soriniPending; _soriniPending = null;
    playSoriniAction(p.name, p.loop);
  }
}

function loadSoriniAnim(path, key, onDone) {
  new FBXLoader().load(path, (fbx) => {
    if (fbx.animations?.[0]) {
      soriniClips[key] = stripRootMotion(fbx.animations[0]);
      _bindSoriniClip(key);
      if (onDone) onDone();
    }
  }, undefined, (e) => console.warn('sorini anim failed:', path, e));
}

new FBXLoader().load('./assets/models/player/sorini.fbx', (fbx) => {
  fbx.scale.setScalar(0.013);
  // Her feet sit at local y≈0 (Mixamo origin) and soriniGroup rides the
  // surface height each frame — keep her un-offset so boots rest ON the
  // ground (a previous -0.13 here sank her 13 cm into every floor).
  fbx.position.y = 0;
  fbx.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    // Mixamo quirk: her boots/bodysuit material ships with the specular
    // PNG wired as an alphaMap and transparent:true — the map's dark
    // regions punch alpha to zero and her shoes vanish. Force it opaque.
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (m.transparent && m.alphaMap) {
        m.transparent = false;
        m.alphaMap = null;
        m.opacity = 1;
        m.needsUpdate = true;
      }
    }
  });
  soriniGroup.add(fbx);

  soriniMixer = new THREE.AnimationMixer(fbx);
  for (const k of Object.keys(soriniClips)) _bindSoriniClip(k);

  setTimeout(() => {
    const want = ['idle', 'walk', 'run', 'punch', 'kick', 'hook', 'jump', 'die'];
    const missing = want.filter(k => !soriniClips[k]);
    if (missing.length) console.warn('[Sorini] clips missing:', missing.join(', '));
  }, 8000);

  const base = './assets/models/player/';
  loadSoriniAnim(base + 'idle.fbx',           'idle',     null);
  loadSoriniAnim(base + 'dying.fbx',          'die',      null);
  loadSoriniAnim(base + 'swagger_walk.fbx',   'walk',     null);
  loadSoriniAnim(base + 'running.fbx',        'run',      null);
  loadSoriniAnim(base + 'punching.fbx',       'punch',    null);
  loadSoriniAnim(base + 'kicking.fbx',        'kick',     null);
  loadSoriniAnim(base + 'hook.fbx',           'hook',     null);
  loadSoriniAnim(base + 'jump.fbx',           'jump',     null);
}, undefined, (e) => console.warn('sorini.fbx load failed:', e));

// ---------- input ----------
const keys = {};
let locked = false;
const attackCooldown = { f: 0, g: 0, h: 0 };
let attackLock = false;

// ── Axiom Dash state ──
const dash = {
  cooldown: 0,        // seconds remaining
  maxCooldown: 1.5,   // 1.5s cooldown
  duration: 0.15,     // how long the snap-dash lasts
  distance: 12,        // world units to travel
  activeTimer: 0,
  iframeDuration: 0.4,
  enabled: false,     // disabled until Level 2+
};

addEventListener('keydown', e => {
  if (window.__dialogue && window.__dialogue.active) {
    // Space/Enter skips the current line
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (typeof window.__dialogue.skip === 'function') window.__dialogue.skip();
      return;
    }
    window.__dialogue.handleKey(e.code);
    return;
  }

  // ── Esc toggles the pause menu directly — no prior mouse click ──
  // When the pointer is LOCKED, the browser exits the lock on Esc and
  // the pointerlockchange handler below opens the menu. When it is
  // NOT locked (player never clicked the canvas, or lock was lost),
  // this keydown is the only path to pause, so handle it here too.
  if (e.code === 'Escape') {
    if (!gameStarted.value || !level) return;
    if (cinematicCamera.active) return;
    if (document.getElementById('endOverlay')) return;
    if (pauseMenu.visible) {
      pauseMenu.resume();   // Esc again un-pauses
    } else {
      pauseMenu.show();
    }
    return;
  }

  if (pauseMenu.visible) return;   // gameplay input frozen while paused

  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();

    // ── Axiom Dash: Shift + Space ──
  if ((e.code === 'Space') &&
      (keys.ShiftLeft || keys.ShiftRight) &&
      dash.enabled &&
      dash.cooldown <= 0 &&
      player.grounded) {
    _triggerDash();
    return;   // consume the space so it doesn't also trigger a jump
  }
  if (e.code === 'KeyR') switchLevel(current);
  if (e.code === 'Digit1') switchLevel(1);
  if (e.code === 'Digit2') switchLevel(2);
  if (e.code === 'Digit3') switchLevel(3);
  if (e.code === 'KeyP' && level && level.setPhase) {
    phase = phase % 3 + 1;
    level.setPhase(phase, timer.getElapsed());
  }

    if (e.code === 'Space' && player.grounded && !attackLock && !keys._spaceConsumed
      && !keys.ShiftLeft && !keys.ShiftRight) {
    player.vel.y = 12;
    keys._spaceConsumed = true;
  }

  if (e.code === 'KeyF' && attackCooldown.f <= 0) {
    attackCooldown.f = 0.7;
    playSoriniAction('punch', false);
    _triggerAttack();
    _damageEnemiesIfClose(1);
    audioManager.playSfx('punch_hit');
  }
  if (e.code === 'KeyG' && attackCooldown.g <= 0) {
    attackCooldown.g = 0.8;
    playSoriniAction('kick', false);
    _triggerAttack();
    _damageEnemiesIfClose(2);
    audioManager.playSfx('punch_hit');
  }
  if (e.code === 'KeyH' && attackCooldown.h <= 0) {
    attackCooldown.h = 0.7;
    playSoriniAction('hook', false);
    _triggerAttack();
    _damageEnemiesIfClose(2);
    audioManager.playSfx('punch_hit');
  }
});

function _triggerAttack() {
  if (level && typeof level.onMouseClick === 'function') {
    level.onMouseClick(camera, player.pos);
  } else if (level && level.streetEnemies) {
    level.streetEnemies.onMouseClick(camera, player.pos);
  }
}

function _damageEnemiesIfClose(damage) {
  if (!level) return;

  if (level.commander && level.commander.alive) {
    const dist = level.commander.getPosition().distanceTo(player.pos);
    if (dist < 2.5) level.commander.takeDamage(damage);
  }
  if (level.grunts) {
    level.grunts.checkHit(player.pos, 2.2, damage);
  }

  if (level.enforcer && level.enforcer.alive) {
    const dist = level.enforcer.getPosition().distanceTo(player.pos);
    if (dist < 2.0) level.enforcer.takeDamage(damage);
  }

  // Level 3 final boss — only hittable once he's actually fighting
  if (level.architect && level.architect.canBeHit && level.architect.canBeHit()) {
    const dist = level.architect.getPosition().distanceTo(player.pos);
    if (dist < 2.8) level.architect.takeDamage(damage);
  }
}

addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'Space') keys._spaceConsumed = false;
});

renderer.domElement.addEventListener('click', () => {
  requestGamePointerLock();

  if (window.Howler && window.Howler.ctx && window.Howler.ctx.state === 'suspended') {
    window.Howler.ctx.resume();
  }

  // Safety net: if the level track ever drops out, bring it back here.
  if (window.__audioManager && !window.__audioManager.currentMusic) {
    const musicMap = { 1: 'level_1_chiptune', 2: 'level_2_orchestral', 3: 'level_3_electronic' };
    const track = musicMap[current];
    if (track) audioManager.playMusic(track);
  }
});

function _triggerDash() {
  dash.cooldown = dash.maxCooldown;
  dash.activeTimer = dash.duration;

  // Direction: where the player is currently moving (WASD) or facing
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  let dirX, dirZ;

  if (f === 0 && r === 0) {
    // Not moving — dash forward in facing direction
    dirX = Math.sin(player.yaw);
    dirZ = Math.cos(player.yaw);
  } else {
    // Movement direction — combine forward + strafe, normalize
    const fwdX = Math.sin(player.yaw);
    const fwdZ = Math.cos(player.yaw);
    const rgtX = Math.cos(player.yaw);
    const rgtZ = -Math.sin(player.yaw);
    dirX = fwdX * f + rgtX * r;
    dirZ = fwdZ * f + rgtZ * r;
    const len = Math.hypot(dirX, dirZ) || 1;
    dirX /= len;
    dirZ /= len;
  }

    // Leave a trail behind at the OLD position
  if (typeof spawnDashTrail === 'function') {
    spawnDashTrail(player.pos.clone());
  }

  // Snap position forward
  player.pos.x += dirX * dash.distance;
  player.pos.z += dirZ * dash.distance;

  // I-frames — mark player invincible
  if (window.__playerHealth) {
    window.__playerHealth._hurtCooldown = dash.iframeDuration;
  }

  // Axiom glow flash
  if (window.__axiom) {
    window.__axiom.setIntensity(3.0);
    setTimeout(() => {
      if (window.__axiom) window.__axiom.setIntensity(0.4);
    }, 300);
  }

  // Sound
  if (window.__audioManager) {
    window.__audioManager.playSfx('punch_hit');
  }
}

let _wasLocked = false;

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;

  if (locked) {
    _wasLocked = true;
    _lockFailCount = 0;
    clearTimeout(_lockRetryTimer);
    _lockRetryTimer = null;
    const hint = document.getElementById('recapture-hint');
    if (hint) hint.remove();
    pauseMenu.hide();
    return;
  }

  // Esc (or alt-tab) released the pointer mid-game → open the pause
  // menu, except during dialogue, cinematics, or the ending overlays.
  if (_wasLocked && gameStarted.value && level &&
      !(window.__dialogue && window.__dialogue.active) &&
      !cinematicCamera.active &&
      !document.getElementById('endOverlay')) {
    pauseMenu.show();
  }
  _wasLocked = false;
});

// ── Pointer re-capture ──
// Chrome refuses to re-capture the pointer for ~1.25 s after an Esc
// release, so a quick RESUME click inside that window fails silently
// and the game keeps running in free-cursor mode. Retry once the
// cooldown has passed, and as a last resort show a recapture hint.
let _lockRetryTimer = null;
let _lockFailCount = 0;

function _showRecaptureHint() {
  let hint = document.getElementById('recapture-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'recapture-hint';
    Object.assign(hint.style, {
      position: 'fixed',
      left: '50%',
      bottom: '12%',
      transform: 'translateX(-50%)',
      padding: '10px 26px',
      border: '2px solid #00ffff',
      borderRadius: '8px',
      background: 'rgba(2, 10, 20, 0.85)',
      color: '#00ffff',
      fontFamily: "'Courier New', monospace",
      fontSize: '0.95rem',
      letterSpacing: '3px',
      zIndex: '400',
      pointerEvents: 'none',
    });
    document.body.appendChild(hint);
  }
  hint.innerText = 'CLICK TO CAPTURE THE MOUSE';
  clearTimeout(hint._t);
  hint._t = setTimeout(() => hint.remove(), 3000);
}

function _scheduleLockRetry() {
  if (_lockRetryTimer) return;   // a retry is already pending
  _lockRetryTimer = setTimeout(() => {
    _lockRetryTimer = null;
    if (document.pointerLockElement === renderer.domElement) return;
    if (_lockFailCount >= 3) return;             // browser keeps refusing — stop
    if (pauseMenu.visible) return;               // re-paused — leave the cursor free
    if (!gameStarted.value || !level) return;    // back at the main menu
    if (window.__dialogue && window.__dialogue.active) return;
    if (cinematicCamera.active) return;
    if (document.getElementById('endOverlay')) return;
    requestGamePointerLock(false);               // one silent retry, then the hint
  }, 1400);
}

function requestGamePointerLock(retryOnFail = true) {
  if (document.pointerLockElement === renderer.domElement) return;
  const fail = () => {
    _lockFailCount++;
    if (retryOnFail) _scheduleLockRetry();
    else _showRecaptureHint();
  };
  try {
    const p = renderer.domElement.requestPointerLock();
    if (p && p.catch) p.catch(fail);
  } catch (e) { fail(); }
}

// Safari/Firefox signal failures via an event instead of a rejected
// promise — route those through the same retry.
document.addEventListener('pointerlockerror', () => {
  if (document.pointerLockElement !== renderer.domElement &&
      _lockFailCount < 3) {
    _scheduleLockRetry();
  }
});

let mouseSensitivity = 0.0022;   // radians per pixel — tunable in the pause menu

addEventListener('mousemove', e => {
  if (!locked) return;
  player.cameraYaw -= e.movementX * mouseSensitivity;
  player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch - e.movementY * mouseSensitivity));
});

// ---------- levels ----------
const LEVELS = { 1: StreetLevel, 2: AlienLevel, 3: ArchitectLevel };
let level = null, current = 1, phase = 1;

function disposeCurrentLevel() {
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

  if (window.__dialogue) {
    try { window.__dialogue.dispose(); } catch (e) {}
    window.__dialogue = null;
  }

  try {
    if (renderer.renderLists) renderer.renderLists.dispose();
    if (renderer.info) renderer.info.reset();
  } catch (e) { console.warn('renderer cache flush failed:', e); }
}

function switchLevel(n) {
  disposeCurrentLevel();

  current = n; phase = 1;
  _lastDeathPos = null;

  try {
    level = new LEVELS[n](scene, renderer);

    if (n === 3 && level instanceof ArchitectLevel) {
      window.__level3 = level;   // debug hook — fight/asset testing
      window.__player = player;
      const dialogue = new Dialogue();
      window.__dialogue = dialogue;
      level.dialogue = dialogue;

      level.onEndingChosen = (choice) => {
        if (choice === 'attack') {
          dialogue.dispose();
          window.__dialogue = null;
          endingAttack();
        } else if (choice === 'learn') {
          endingLearn(dialogue).then(() => {
            window.__dialogue = null;
          });
        } else {
          dialogue.dispose();
          window.__dialogue = null;
          endingSilence();
        }
      };
    }
  } catch (e) {
    console.warn(`Level ${n} primary constructor failed:`, e);
    try { level = new LEVELS[n](scene); } catch (e2) { level = new LEVELS[n](); }
  }

  // Wire player damage callback
  if (level) {
    level.onDamagePlayer = (dmg) => {
      playerHealth.takeDamage(dmg);
    };
    level.playerHealth = playerHealth;
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

  if (n === 2 && typeof level.startIntroSequence === 'function') {
    level.startIntroSequence();
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
    player.cameraYaw = player.yaw;   // start camera behind her facing forward

  // Axiom Dash unlocks from Level 2 onward
dash.enabled = (n >= 2);

  const musicMap = { 1: 'level_1_chiptune', 2: 'level_2_orchestral', 3: 'level_3_electronic' };
  const track = musicMap[n];
  if (track) audioManager.playMusic(track);
}

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

const MAX_DOTS = 32;
const enemyDots = [];
const gruntDotMat = new THREE.MeshBasicMaterial({ color: 0xff3a3a });
const bossDotMat  = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
const dotGeo = new THREE.CircleGeometry(1.6, 12);

for (let i = 0; i < MAX_DOTS; i++) {
  const dot = new THREE.Mesh(dotGeo, gruntDotMat);
  dot.rotation.x = -Math.PI / 2;
  dot.layers.set(1);
  dot.visible = false;
  scene.add(dot);
  enemyDots.push(dot);
}

// ---------- physics ----------
const GRAV = 30, SPEED = 4.5, SPRINT = 9;
const TURN_SPEED = 2.2;

function stepPlayer(dt) {
  const isSprint = keys.ShiftLeft || keys.ShiftRight;
  const sp = isSprint ? SPRINT : SPEED;

  // ── Rotation ──
  // A/D rotate Sorini ONLY (camera stays put unless mouse-look)
  if (!attackLock) {
    if (keys.KeyA) player.yaw += TURN_SPEED * dt;
    if (keys.KeyD) player.yaw -= TURN_SPEED * dt;
  }

  // S turns her 180° smoothly (over ~0.35s)
  const fwd = keys.KeyW ? 1 : 0;
  const back = keys.KeyS ? 1 : 0;

  if (back && !fwd && !attackLock) {
    // Target yaw: 180° from current
    const targetYaw = player._sTargetYaw !== undefined
      ? player._sTargetYaw
      : (player._sTargetYaw = player.yaw + Math.PI);
    const diff = ((targetYaw - player.yaw + Math.PI) % (2 * Math.PI)) - Math.PI;
    player.yaw += diff * Math.min(1, dt * 8);
  } else {
    player._sTargetYaw = undefined;   // reset when S released
  }

  // ── Movement ──
  // W or S both move her FORWARD in her facing direction
  // (S already flipped her yaw, so she walks toward where she's facing)
  const f = attackLock ? 0 : (fwd || back ? 1 : 0);
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  player.vel.x = sin * f * sp;
  player.vel.z = cos * f * sp;

  player.vel.y -= GRAV * dt;
  player.pos.addScaledVector(player.vel, dt);

  // ── Ground snap ──
  let g = 0;
  try {
    if (level && typeof level.getSurfaceHeight === 'function') g = level.getSurfaceHeight(player.pos.x, player.pos.z);
    else if (level && typeof level.groundHeight === 'function') g = level.groundHeight(player.pos.x, player.pos.z, player.pos.y);
    else if (level && typeof level.terrainHeight === 'function') g = level.terrainHeight(player.pos.x, player.pos.z);
  } catch (e) { g = 0; }
  if (player.pos.y <= g) { player.pos.y = g; player.vel.y = 0; player.grounded = true; }
  else player.grounded = false;

  // ── Colliders ──
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
    pMax.set(player.pos.x + player.R, player.pos.y, player.pos.z + player.R);
  }

  if (player.pos.y < -60) {
    if (level && level.spawn && level.spawn.isVector3) player.pos.copy(level.spawn);
    else player.pos.set(0, 2, 55);
    player.vel.set(0, 0, 0);
  }
}

// ---------- loop ----------
const timer = new THREE.Timer();
let _rafId = 0;

function tick() {
  _rafId = requestAnimationFrame(tick);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t  = timer.getElapsed();

  if (!level) return;

  // Freeze the whole world while the pause menu is open — the last
  // presented frame stays on screen behind the overlay.
  if (pauseMenu.visible) return;

  playerHealth.update(dt);

  stepPlayer(dt);
  if (soriniMixer) soriniMixer.update(dt);
  if (typeof level.update === 'function') {
    try { level.update(dt, t, player); }
    catch (e) { console.warn('level.update error', e); }
  }

  // ── Update HUD every frame (health, wave counter, level name) ──
  const waveCurrent = (typeof level.waveIndex === 'number') ? level.waveIndex : 0;
  const waveTotal   = (level.waves ? level.waves.length : 3);
  updateHUD(
    playerHealth.hp,
    playerHealth.maxHp,
    0,           // fragments — unused
    0,           // fragments — unused
    waveCurrent,
    waveTotal,
    level.name || 'LEVEL 1'
  );

  const CAM_DIST   = 5.5;
  const CAM_HEIGHT = 2.8;
  const CAM_LOOK_UP = 1.2;
   const camOffX = -Math.sin(player.cameraYaw) * CAM_DIST;
  const camOffZ = -Math.cos(player.cameraYaw) * CAM_DIST;
  camera.position.set(
    player.pos.x + camOffX,
    player.pos.y + CAM_HEIGHT,
    player.pos.z + camOffZ
  );

    // ── Cinematic camera takes over during dialogue ──
  if (cinematicCamera.active) {
    cinematicCamera.update(dt);
    cinematicCamera.applyTo(camera);
  } else {
    // Normal third-person camera
    const CAM_DIST   = 5.5;
    const CAM_HEIGHT = 2.8;
    const CAM_LOOK_UP = 1.2;
    const camOffX = -Math.sin(player.cameraYaw) * CAM_DIST;
    const camOffZ = -Math.cos(player.cameraYaw) * CAM_DIST;
    camera.position.set(
      player.pos.x + camOffX,
      player.pos.y + CAM_HEIGHT,
      player.pos.z + camOffZ
    );
    if (level && typeof level.getSurfaceHeight === 'function') {
      const camGround = level.getSurfaceHeight(camera.position.x, camera.position.z) + 0.5;
      if (camera.position.y < camGround) camera.position.y = camGround;
    }
    camera.lookAt(player.pos.x, player.pos.y + CAM_LOOK_UP, player.pos.z);
  }

  soriniGroup.position.set(player.pos.x, player.pos.y, player.pos.z);
  soriniGroup.rotation.y = player.yaw;
  if (level && typeof level.getSurfaceHeight === 'function') {
    const camGround = level.getSurfaceHeight(camera.position.x, camera.position.z) + 0.5;
    if (camera.position.y < camGround) camera.position.y = camGround;
  }
  camera.lookAt(player.pos.x, player.pos.y + CAM_LOOK_UP, player.pos.z);

  soriniGroup.position.set(player.pos.x, player.pos.y, player.pos.z);
  soriniGroup.rotation.y = player.yaw;

  for (const k of ['f','g','h']) if (attackCooldown[k] > 0) attackCooldown[k] -= dt;
  if (dash.cooldown > 0) dash.cooldown -= dt;
  if (dash.activeTimer > 0) dash.activeTimer -= dt;

  updateDashTrails(dt);

  const isSprint  = keys.ShiftLeft || keys.ShiftRight;
  const isMovingW = keys.KeyW || keys.KeyS;

  const attackNames = ['punch','kick','hook','jump'];
  const currentIsAttack = soriniCurrentAction && attackNames.some(
    n => soriniActions[n] && soriniActions[n] === soriniCurrentAction
  );
  const attackStillPlaying = currentIsAttack &&
    soriniCurrentAction.isRunning() &&
    soriniCurrentAction.loop === THREE.LoopOnce;
  attackLock = attackStillPlaying;

  if (soriniMixer && !attackStillPlaying) {
    if (!player.grounded)             playSoriniAction('jump');
    else if (isSprint && isMovingW)   playSoriniAction('run');
    else if (isMovingW)               playSoriniAction('walk');
    else                              playSoriniAction('idle');
  }

  marker.position.set(player.pos.x, player.pos.y + 2, player.pos.z);
  marker.rotation.set(Math.PI / 2, player.yaw, 0);

  // ── Update minimap enemy dots ──
  const enemies = (level && typeof level.getEnemyMarkers === 'function')
    ? level.getEnemyMarkers()
    : [];

  for (let i = 0; i < MAX_DOTS; i++) {
    const dot = enemyDots[i];
    if (i < enemies.length) {
      const e = enemies[i];
      dot.position.set(e.x, 1, e.z);
      dot.material = (e.kind === 'commander') ? bossDotMat : gruntDotMat;
      dot.visible = true;
    } else if (dot.visible) {
      dot.visible = false;
    }
  }

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

// ---------- debug globals ----------
window.__player = player;

Object.defineProperty(window, '__level', {
  get() { return level; },
  configurable: true,
});

// ============================================================
// UI SYSTEM — Main Menu, Loading Screen, HUD
// ============================================================
const uiManager = new UIManager();

const hudElement = createHUD();
uiManager.registerScreen('hud', hudElement);

const loadingScreenElement = createLoadingScreen();
uiManager.registerScreen('loading', loadingScreenElement);

// Credits overlay
function showCreditsOverlay() {
  const creditsDiv = document.createElement('div');
  creditsDiv.id = 'credits-overlay';
  creditsDiv.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: rgba(0,0,0,0.95);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    font-family: 'Courier New', monospace;
    z-index: 200;
    overflow-y: auto;
    padding: 20px;
  `;
    creditsDiv.innerHTML = `
    <h1 style="color: #00ffff; font-size: 36px; margin-bottom: 30px;">CREDITS</h1>
    <div style="text-align: left; font-size: 16px; line-height: 2; color: #aaa; max-width: 600px;">
      <h2 style="color: #ffffff; font-size: 20px; margin-bottom: 10px;">LIBRARIES</h2>
      <p>● Three.js (MIT) - <a href="https://threejs.org" style="color: #00ffff;">threejs.org</a></p>
      <p>● Howler.js (MIT) - <a href="https://howlerjs.com" style="color: #00ffff;">howlerjs.com</a></p>
      <p>● Vite (MIT) - <a href="https://vitejs.dev" style="color: #00ffff;">vitejs.dev</a></p>

      <h2 style="color: #ffffff; font-size: 20px; margin-top: 20px; margin-bottom: 10px;">MUSIC & SOUND EFFECTS (OpenGameArt)</h2>
      <p>● Sci-Fi Drone by jdagenet (CC-BY 4.0) - <a href="https://opengameart.org/content/sci-fi-drone" style="color: #00ffff;">Ship hum</a></p>
      <p>● Punch SFX by DavidW (CC-BY 3.0) - <a href="https://opengameart.org/content/punch-sfx" style="color: #00ffff;">Link</a></p>
      <p>● Spell Sounds Starter Pack by p0ss (CC-BY-SA 3.0) - <a href="https://opengameart.org/content/spell-sounds-starter-pack" style="color: #00ffff;">Link</a></p>
      <p>● A Kinda Cool Sound Effect by Spring Spring (CC0) - <a href="https://opengameart.org/content/a-kinda-cool-sound-effect" style="color: #00ffff;">Link</a></p>
      <p>● Tactical Weapons and Tactics Sound Pack by XCVG (CC-BY 3.0) - <a href="https://opengameart.org/content/tactical-weapons-and-tactics-sound-pack" style="color: #00ffff;">Link</a></p>
      <p>● 37 hits/punches by independent.nu (CC-BY 3.0) - <a href="https://opengameart.org/content/37-hitspunches" style="color: #00ffff;">Link</a></p>

      <h2 style="color: #ffffff; font-size: 20px; margin-top: 20px; margin-bottom: 10px;">VOICE ACTING (AI-Generated)</h2>
      <p>● Sorini (Sonia) & Axiom (Brian) — <a href="https://freetts.ai" style="color: #00ffff;">FreeTTS.ai</a></p>
      <p>● The Enforcer (Darlene, Monster effect) — <a href="https://speechgen.io" style="color: #00ffff;">SpeechGen.io</a></p>
      <p>● The Architect (Pain) & Narrator (Madara Uchiha V1) — <a href="https://fish.audio" style="color: #00ffff;">Fish Audio</a></p>
      <p style="font-size: 13px; color: #666; margin-left: 20px;">All voices are AI-generated and used under their respective free-tier terms.</p>

      <h2 style="color: #ffffff; font-size: 20px; margin-top: 20px; margin-bottom: 10px;">MODELS</h2>
      <p>● Kachujin (Sorini) — Mixamo</p>
      <p>● X_Bot (Grunts) — Mixamo</p>
      <p>● Dreyar (Architect) — Mixamo</p>
      <p>● Enforcer (Jones) — Mixamo</p>

      <h2 style="color: #ffffff; font-size: 20px; margin-top: 20px; margin-bottom: 10px;">TEAM MEMBERS</h2>
      <p>● Banele — UI, Audio, Deployment, Voice Direction</p>
      <p>● Busisiwe — Shaders</p>
      <p>● Pumelela — Environment, Art</p>
      <p>● Sibusiso — Player, Controls, Physics</p>
    </div>
    <button id="credits-back" style="
      margin-top: 40px;
      background: #00ffff;
      border: none;
      color: #000;
      padding: 12px 40px;
      font-size: 18px;
      font-family: 'Courier New', monospace;
      cursor: pointer;
      border-radius: 8px;
    ">BACK</button>
  `;
  document.body.appendChild(creditsDiv);
  document.getElementById('credits-back').addEventListener('click', () => {
    creditsDiv.remove();
  });
}

// ── Pause menu — options, restart level, quit to menu ──
const pauseMenu = new PauseMenu({
  audioManager,
  initialSensitivity: 0.0022,
  onSensitivityChange: (v) => { mouseSensitivity = v; },
  onResume: () => {
    pauseMenu.hide();
    // This click is the browser gesture; if Chrome's post-Esc cooldown
    // rejects the lock, requestGamePointerLock retries ~1.4 s later.
    requestGamePointerLock();
  },
  onRestartLevel: () => {
    pauseMenu.hide();
    switchLevel(current);
  },
  onQuitToMenu: () => restartToMenu(),
});

// ── Full in-page restart — back to the main menu, no page refresh ──
function restartToMenu() {
  if (document.pointerLockElement) document.exitPointerLock();
  pauseMenu.hide();

  disposeCurrentLevel();
  level = null;
  current = 1;
  phase = 1;
  _lastDeathPos = null;

  // Remove any ending overlay left over from the Level 3 endings
  const endOverlay = document.getElementById('endOverlay');
  if (endOverlay && endOverlay.parentNode) endOverlay.parentNode.removeChild(endOverlay);

  // Reset transient gameplay state
  playerHealth.reset();
  player.vel.set(0, 0, 0);
  dash.enabled = false;
  dash.cooldown = 0;
  dash.activeTimer = 0;
  attackCooldown.f = 0; attackCooldown.g = 0; attackCooldown.h = 0;
  attackLock = false;
  for (const k of Object.keys(keys)) keys[k] = false;

  // Silence every sound and blank the game canvas
  audioManager.reset();
  renderer.clear();

  // Back to the main menu
  uiManager.hideHUD();
  uiManager.showScreen('main-menu');
  menuCanvas.style.display = '';
  if (menuScene) menuScene.start();
}
window.__restartToMenu = restartToMenu;

// Main Menu — with PLAY and CREDITS callbacks
const gameStarted = { value: false };

const mainMenuElement = createMainMenu(
  // PLAY
  () => {
        // Hide the menu 3D scene
    menuCanvas.style.display = 'none';
    if (menuScene) {
      menuScene.stop();
    }
    audioManager.playMusic('level_1_chiptune');

    uiManager.showScreen('loading');
    updateLoadingScreen(
      'LEVEL 1',
      'THE GROVE VILLAGE',
      'Sorini awakens in an unfamiliar land. Fight your way through the villagers\' shadows and find the Warden.',
      0,
      'Initializing...'
    );

    let progress = 0;
    const loadInterval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(loadInterval);
        updateLoadingScreen(
          'LEVEL 1',
          'THE GROVE VILLAGE',
          'Sorini awakens in an unfamiliar land. Fight your way through the villagers\' shadows and find the Warden.',
          100,
          'Ready!',
          true
        );

        const continueBtn = document.getElementById('continueBtn');
        if (continueBtn) {
          continueBtn.onclick = () => {
            uiManager.hideAllScreens();
            uiManager.showHUD();
            if (!gameStarted.value) {
              gameStarted.value = true;
              switchLevel(1);
              tick();
            } else {
              switchLevel(1);
            }
            // Capture the mouse right away — THIS click is the user
            // gesture the browser requires, so Esc can pause without
            // any extra click on the canvas.
            requestGamePointerLock();
          };
        }
      } else {
        const statuses = ['Loading assets...', 'Building world...', 'Spawning enemies...', 'Almost ready...'];
        const statusIndex = Math.floor(Math.random() * statuses.length);
        updateLoadingScreen(
          'LEVEL 1',
          'THE GROVE VILLAGE',
          'Sorini awakens in an unfamiliar land. Fight your way through the villagers\' shadows and find the Warden.',
          progress,
          statuses[statusIndex % statuses.length]
        );
      }
    }, 200);
  },
  // CREDITS
  () => {
    showCreditsOverlay();
  }
);

uiManager.registerScreen('main-menu', mainMenuElement);

// ── Main Menu 3D Scene ──
const menuCanvas = document.createElement('canvas');
menuCanvas.id = 'menu-canvas';
// z-index 20 sits ABOVE #ui-container (z-10): Chromium does not
// composite this canvas under that overlay (its backdrop-filter
// panel isolates the stack), which blacked out the whole scene.
// The canvas is transparent where nothing is drawn, so the menu
// DOM still shows through, and pointer-events:none keeps the
// buttons clickable underneath.
menuCanvas.style.cssText = `
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  z-index: 20;
  pointer-events: none;
`;
document.body.appendChild(menuCanvas);

const menuScene = new MenuScene(menuCanvas);
menuScene.start();
window.__menuScene = menuScene;   // debug handle for live inspection

uiManager.showScreen('main-menu');

// ---------- Vite HMR cleanup ----------
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