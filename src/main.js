// ============================================================
// main.js — bootstrap, player controller, level manager, minimap
// ============================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { StreetLevel } from './levels/level1.js';
import { AlienLevel } from './levels/level2.js';
import { ArchitectLevel } from './levels/level3.js';
import { Dialogue } from './ui/Dialogue.js';
import { endingAttack, endingLearn, endingSilence } from './player/endings.js';

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
// NOTE: PCFSoftShadowMap was removed in recent three.js versions.
// PCFShadowMap is the modern equivalent.
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

// Surface context-lost events so we can see them in the console
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

// ---------- root motion fix ----------
// Mixamo FBX animations exported without "In Place" bake the character's
// forward travel straight into the Hips bone's position keyframes. That
// means the clip itself drags the model across the floor, on top of our
// own WASD movement code also moving it — double motion, plus a visible
// "snap back" every time the clip loops back to frame 0.
// This locks the Hips bone's X/Z to its first-frame value on every key,
// so the clip plays fully in place, while leaving Y untouched so the
// natural up/down footstep bob is preserved.
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
  pitch: 0,
  grounded: false,
  EYE: 1.7,
  R: 0.4, H: 1.8,
};

// ---------- Sorini avatar (third-person Y_Bot) ----------
const soriniGroup = new THREE.Group();
scene.add(soriniGroup);

let soriniMixer  = null;
let soriniActions = {};
let soriniCurrentAction = null;

let _soriniPending = null;   // action requested before its clip finished downloading

function playSoriniAction(name, loop = true) {
  let next = soriniActions[name];
  // fallback chain if a clip failed to load (e.g. Swagger_Walk.fbx)
  if (!next && name === 'walk') next = soriniActions['run'] || soriniActions['fightIdle'];
  if (!next) { _soriniPending = { name, loop }; return; }  // retried when the clip lands
  if (next === soriniCurrentAction) {
    // Already playing. For loops, do nothing. For one-shots that have
    // finished, restart them so the punch/kick/hook can be re-triggered.
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

// raw clips are cached even when the model hasn't finished loading yet —
// previously any clip that won the download race against Y_Bot.fbx was
// discarded by the `&& soriniMixer` guard and never played again
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

// Load Y_Bot model
new FBXLoader().load('./assets/models/player/sorini.fbx', (fbx) => {
  fbx.scale.setScalar(0.013);
  // Offset the model so feet align with player.pos.y (ground level).
  fbx.position.y = -0.13;
  fbx.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  soriniGroup.add(fbx);

  soriniMixer = new THREE.AnimationMixer(fbx);
  // bind every clip that arrived before the model did
  for (const k of Object.keys(soriniClips)) _bindSoriniClip(k);
  // name anything still missing after 8s (wrong file name / case / path)
  setTimeout(() => {
    const want = ['idle', 'fightIdle', 'walk', 'run', 'punch', 'kick', 'hook', 'jump', 'die'];
    const missing = want.filter(k => !soriniClips[k]);
    if (missing.length) console.warn('[Sorini] clips missing:', missing.join(', '));
  }, 8000);

  const base = './assets/models/player/';
  loadSoriniAnim(base + 'Idle.fbx',           'fightIdle', null);
  loadSoriniAnim(base + 'Dying.fbx',          'die',       null);
  // Dwarf Idle = relaxed idle (not fighting stance) — file is in enemy folder
  new FBXLoader().load('./assets/models/enemy/Dwarf Idle.fbx', (fbx2) => {
    if (fbx2.animations?.[0]) {
      soriniClips['idle'] = stripRootMotion(fbx2.animations[0]);
      _bindSoriniClip('idle');
      playSoriniAction('idle');
    }
  }, undefined, (e) => {
    // fallback to fight idle if Dwarf Idle missing
    if (soriniActions['fightIdle']) {
      soriniActions['idle'] = soriniActions['fightIdle'];
      playSoriniAction('idle');
    }
  });
  loadSoriniAnim(base + 'Swagger_Walk.fbx',   'walk',      null);
  loadSoriniAnim(base + 'Running.fbx',        'run',       null);
  loadSoriniAnim(base + 'Punching.fbx',       'punch',     null);
  loadSoriniAnim(base + 'Kicking.fbx',        'kick',      null);
  loadSoriniAnim(base + 'Hook.fbx',           'hook',      null);
  loadSoriniAnim(base + 'Jump.fbx',           'jump',      null);
  loadSoriniAnim(base + 'Left Turn.fbx',      'turnLeft',  null);
  loadSoriniAnim(base + 'Right Turn.fbx',     'turnRight', null);
}, undefined, (e) => console.warn('Y_Bot load failed:', e));

// ---------- input ----------
const keys = {};
let locked = false;
// attack cooldowns
const attackCooldown = { f: 0, g: 0, h: 0 };
let attackLock = false;   // true while a punch/kick/hook swing plays — roots Sorini

addEventListener('keydown', e => {

  // If dialogue is active, route keys to the dialogue system
  if (window.__dialogue && window.__dialogue.active) {
    window.__dialogue.handleKey(e.code);
    return;
  }

  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyR') switchLevel(current);
  if (e.code === 'Digit1') switchLevel(1);
  if (e.code === 'Digit2') switchLevel(2);
  if (e.code === 'Digit3') switchLevel(3);
  if (e.code === 'KeyP' && level && level.setPhase) {
    phase = phase % 3 + 1;
    level.setPhase(phase, timer.getElapsed());
  }

  // ── Jump ── handled here so it fires once per press (not per frame)
  if (e.code === 'Space' && player.grounded && !attackLock) {
    player.vel.y = 12;
  }

  // ── F = Punch ──
  if (e.code === 'KeyF' && attackCooldown.f <= 0) {
    attackCooldown.f = 0.7;
    playSoriniAction('punch', false);
    _triggerAttack();
    _damageCommanderIfClose(1);
  }
  // ── G = Kick ──
  if (e.code === 'KeyG' && attackCooldown.g <= 0) {
    attackCooldown.g = 0.8;
    playSoriniAction('kick', false);
    _triggerAttack();
    _damageCommanderIfClose(2);
  }
  // ── H = Hook ──
  if (e.code === 'KeyH' && attackCooldown.h <= 0) {
    attackCooldown.h = 0.7;
    playSoriniAction('hook', false);
    _triggerAttack();
    _damageCommanderIfClose(2);
  }
});

function _triggerAttack() {
  if (level && typeof level.onMouseClick === 'function') {
    level.onMouseClick(camera, player.pos);
  } else if (level && level.streetEnemies) {
    level.streetEnemies.onMouseClick(camera, player.pos);
  }
}

function _damageCommanderIfClose(damage) {
  if (!level) return;
  // Commander (Level 1)
  if (level.commander && level.commander.alive) {
    const dist = level.commander.getPosition().distanceTo(player.pos);
    if (dist < 2.5) {
      level.commander.takeDamage(damage);
    }
  }
  // Grunts (Level 1)
  if (level.grunts) {
    level.grunts.checkHit(player.pos, 2.2, damage);
  }
}

addEventListener('keyup', e => keys[e.code] = false);
renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  const msg = document.getElementById('msg');
  if (msg) msg.style.display = locked ? 'none' : 'block';
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

  // Clean up dialogue from a previous Level 3 session
  if (window.__dialogue) {
    try { window.__dialogue.dispose(); } catch (e) {}
    window.__dialogue = null;
  }

  // ── Flush renderer caches ──
  // Three.js keeps an internal cache of GPU objects. Even after
  // .dispose(), the cache holds references. Clearing it forces the
  // renderer to release texture/buffer memory back to the GPU driver.
  try {
    if (renderer.renderLists) renderer.renderLists.dispose();
    if (renderer.info) renderer.info.reset();
  } catch (e) { console.warn('renderer cache flush failed:', e); }

  current = n; phase = 1;

  try {
    level = new LEVELS[n](scene, renderer);

    // If this is Level 3, wire up the dialogue + endings
    if (n === 3 && level instanceof ArchitectLevel) {
      const dialogue = new Dialogue();
      window.__dialogue = dialogue;
      level.dialogue = dialogue;

      level.onDamagePlayer = (dmg) => {
        console.log(`Player took ${dmg} damage from a guardian.`);
      };

      level.onEndingChosen = (choice) => {
        if (choice === 'attack') {
          dialogue.dispose();
          window.__dialogue = null;
          endingAttack();
        } else if (choice === 'learn') {
          // The learn ending needs the dialogue for the final choice,
          // so pass it in and let it dispose itself.
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

  // If the level used its own scene, hoist things onto the main scene.
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

  // ── Spawn resolution ──
  // Some levels provide getSpawn() instead of a fixed spawn vector.
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
const GRAV = 30, SPEED = 4.5, SPRINT = 9;
const TURN_SPEED = 2.2; // radians/sec for A/D turning

function stepPlayer(dt) {
  const isSprint = keys.ShiftLeft || keys.ShiftRight;
  const sp = isSprint ? SPRINT : SPEED;

  // A/D turn Sorini left/right (locked during attack swings)
  if (!attackLock) {
    if (keys.KeyA) player.yaw += TURN_SPEED * dt;
    if (keys.KeyD) player.yaw -= TURN_SPEED * dt;
  }

  // W/S move in the direction Sorini faces
  const f = attackLock ? 0 : (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  player.vel.x = sin * f * sp;
  player.vel.z = cos * f * sp;

  // Gravity — jump velocity is set from the keydown handler
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

// ---------- loop ----------
// three.js deprecates Clock in favour of Timer.
const timer = new THREE.Timer();
let _rafId = 0;

// HUD caching — innerHTML writes every frame are expensive.
let _lastHudString = '';

function tick() {
  _rafId = requestAnimationFrame(tick);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t  = timer.getElapsed();

  if (!level) return;

  stepPlayer(dt);
  if (soriniMixer) soriniMixer.update(dt);
  if (typeof level.update === 'function') {
    try { level.update(dt, t, player); }
    catch (e) { console.warn('level.update error', e); }
  }

  // ── Third-person camera — centered directly behind Sorini ──
  const CAM_DIST   = 5.5;
  const CAM_HEIGHT = 2.8;
  const CAM_LOOK_UP = 1.2;
  const camOffX = -Math.sin(player.yaw) * CAM_DIST;
  const camOffZ = -Math.cos(player.yaw) * CAM_DIST;
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

  // ── Sorini avatar ──
  soriniGroup.position.set(player.pos.x, player.pos.y, player.pos.z);
  soriniGroup.rotation.y = player.yaw;

  // ── tick attack cooldowns ──
  for (const k of ['f','g','h']) if (attackCooldown[k] > 0) attackCooldown[k] -= dt;

  // ── Sorini animation state ──
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
    else if (keys.KeyA && !isMovingW) playSoriniAction('turnLeft');
    else if (keys.KeyD && !isMovingW) playSoriniAction('turnRight');
    else                              playSoriniAction('idle');
  }

  marker.position.set(player.pos.x, player.pos.y + 2, player.pos.z);
  marker.rotation.set(Math.PI / 2, player.yaw, 0);

  // ── HUD (cached — only written when the string changes) ──
  const levelName = (level && level.name) ? level.name : `LEVEL ${current}`;
  const hudStr =
    `<b>GENESIS — THE DEVICE</b><br>` +
    `${levelName}${level && level.setPhase ? ' · phase ' + phase : ''}<br>` +
    `1/2/3 levels · R restart | F punch · G kick · H hook | Shift sprint`;
  if (hudStr !== _lastHudString) {
    hud.innerHTML = hudStr;
    _lastHudString = hudStr;
  }

  // ── Main render ──
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.clear();
  renderer.render(scene, camera);

  // ── Minimap render ──
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

// ---------- Vite HMR cleanup ----------
// Without this, every hot reload leaks a WebGL context. Browsers cap
// a tab at ~16 contexts, so after a dozen saves WebGL stops working
// until you close the tab.
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