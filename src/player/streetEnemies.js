// ============================================================
// streetEnemies.js — Enemy + Citizen system for Level 2
//
// Movement system:
//   • Personal slots — enemies claim positions around the player
//   • Separation force — enemies push each other apart
//   • Smooth turning — angular lerp
//   • Velocity smoothing — enemies accelerate/decelerate
//
// Combat system:
//   • attackCooldown — per-enemy rest between swings
//   • Post-hit cooldown — longer rest after being hit
//   • Attack gate — cap on simultaneous attackers
//   • Wind-up must match animation
//   • Attack check runs BEFORE slot navigation (fixes passivity)
// ============================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// ─────────────────────────────────────────────────────────────
// ROOT MOTION STRIPPER
// ─────────────────────────────────────────────────────────────
function stripRootMotion(clip) {
  if (!clip?.tracks) return clip;
  for (const track of clip.tracks) {
    if (!/Hips/i.test(track.name) || !/\.position/i.test(track.name)) continue;
    const v = track.values;
    const n = v.length / 3;
    if (n < 2) continue;
    const x0 = v[0], z0 = v[2];
    const xN = v[(n - 1) * 3], zN = v[(n - 1) * 3 + 2];
    const dx = (xN - x0) / (n - 1);
    const dz = (zN - z0) / (n - 1);
    for (let i = 0; i < n; i++) {
      v[i * 3]     -= x0 + dx * i;
      v[i * 3 + 2] -= z0 + dz * i;
    }
  }
  return clip;
}

// ─────────────────────────────────────────────────────────────
// MATH HELPERS
// ─────────────────────────────────────────────────────────────
function shortAngle(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ─────────────────────────────────────────────────────────────
// DOM HELPERS
// ─────────────────────────────────────────────────────────────
function ensureHealthBar() {
  let wrap = document.getElementById('soriniHealth');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'soriniHealth';
    Object.assign(wrap.style, {
      position: 'fixed', top: '14px', left: '14px',
      width: '220px', pointerEvents: 'none', zIndex: '100',
    });
    const label = document.createElement('div');
    Object.assign(label.style, {
      color: '#f0e6c8', fontFamily: 'monospace',
      fontSize: '0.82rem', marginBottom: '4px',
    });
    label.innerText = 'SORINI  HP';
    wrap.appendChild(label);
    const track = document.createElement('div');
    Object.assign(track.style, {
      width: '100%', height: '10px', background: '#2a0a0a',
      border: '1px solid #8b0000', borderRadius: '3px', overflow: 'hidden',
    });
    const bar = document.createElement('div');
    bar.id = 'soriniHealthBar';
    Object.assign(bar.style, {
      width: '100%', height: '100%', background: '#e02020', transition: 'width 0.2s',
    });
    track.appendChild(bar);
    wrap.appendChild(track);
    document.body.appendChild(wrap);
  }
  return { wrap, bar: document.getElementById('soriniHealthBar') };
}

function ensureWaveHUD() {
  let el = document.getElementById('waveHUD');
  if (!el) {
    el = document.createElement('div');
    el.id = 'waveHUD';
    Object.assign(el.style, {
      position: 'fixed', top: '14px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.65)', color: '#ff4444', fontFamily: 'monospace',
      fontSize: '0.95rem', padding: '6px 18px', border: '1px solid #ff2222',
      borderRadius: '4px', pointerEvents: 'none', zIndex: '100', display: 'none',
    });
    document.body.appendChild(el);
  }
  return el;
}

let _dlgTimer = null;
function showDialogue(text, duration = 4500) {
  let box = document.getElementById('dialogue');
  if (!box) {
    box = document.createElement('div');
    box.id = 'dialogue';
    Object.assign(box.style, {
      display: 'none', position: 'fixed', bottom: '90px', left: '50%',
      transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.82)',
      color: '#f0e6c8', fontFamily: 'Georgia, serif', fontSize: '1.05rem',
      lineHeight: '1.6', padding: '14px 28px', border: '1px solid #c8a96e',
      borderRadius: '6px', maxWidth: '560px', textAlign: 'center',
      pointerEvents: 'none', transition: 'opacity 0.4s', whiteSpace: 'pre-line', zIndex: '100',
    });
    document.body.appendChild(box);
  }
  box.innerText = text;
  box.style.display = 'block';
  box.style.opacity = '1';
  clearTimeout(_dlgTimer);
  _dlgTimer = setTimeout(() => {
    box.style.opacity = '0';
    setTimeout(() => { box.style.display = 'none'; }, 420);
  }, duration);
}

// ─────────────────────────────────────────────────────────────
// PORTAL SHADER
// ─────────────────────────────────────────────────────────────
const PORTAL_VERT = `
uniform float uTime; varying vec2 vUv;
void main(){
  vUv = uv; vec3 pos = position;
  pos.z += sin(pos.x*3.0+uTime*2.5)*0.06 + cos(pos.y*2.8+uTime*1.9)*0.06;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
}`;
const PORTAL_FRAG = `
uniform float uTime; varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
}
void main(){
  vec2 c=vUv-0.5; float r=length(c),angle=atan(c.y,c.x);
  float swirl=noise(vec2(r*5.0-uTime*1.2,angle*2.0+uTime*0.8));
  float ring=smoothstep(0.48,0.38,r)*smoothstep(0.05,0.18,r);
  vec3 col=mix(vec3(0.0,0.6,1.0),vec3(0.4,0.0,1.0),swirl);
  col+=vec3(0.2,0.8,1.0)*pow(swirl,3.0)*2.0;
  gl_FragColor=vec4(col,ring*(0.7+0.3*swirl));
}`;

// ─────────────────────────────────────────────────────────────
// FBX ANIM LOADER
// ─────────────────────────────────────────────────────────────
function loadAnim(path, onLoad) {
  new FBXLoader().load(path, (fbx) => {
    if (fbx.animations?.[0]) onLoad(stripRootMotion(fbx.animations[0]));
  }, undefined, (e) => console.warn('anim failed:', path, e));
}

// ─────────────────────────────────────────────────────────────
// FURNITURE BUILDERS (unchanged)
// ─────────────────────────────────────────────────────────────
function makeChair(parent, x, y, z, ry = 0) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.9 });
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 0.55), wood);
  seat.position.y = 0.5; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.06), wood);
  back.position.set(0, 0.78, -0.25); g.add(back);
  for (const [lx, lz] of [[-0.22,-0.22],[0.22,-0.22],[-0.22,0.22],[0.22,0.22]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), wood);
    leg.position.set(lx, 0.25, lz); g.add(leg);
  }
  g.position.set(x, y, z); g.rotation.y = ry;
  parent.add(g); return g;
}

function makeRoundTable(parent, x, y, z) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5c3a, roughness: 0.8 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.8 });
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.07, 16), wood);
  top.position.y = 0.75; g.add(top);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.7, 8), metal);
  ped.position.y = 0.37; g.add(ped);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12), metal);
  base.position.y = 0.02; g.add(base);
  for (const [cx, cz] of [[-0.25, -0.2],[0.25, 0.2]]) {
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.05, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0xddccbb, roughness: 0.6 })
    );
    cup.position.set(cx, 0.82, cz); g.add(cup);
  }
  g.position.set(x, y, z);
  parent.add(g);
  makeChair(parent, x - 0.8, y, z, Math.PI / 2);
  makeChair(parent, x + 0.8, y, z, -Math.PI / 2);
  return g;
}

function makeBenchStall(parent, x, y, z, side = 1) {
  const wood  = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.9 });
  const roof  = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.7 });
  const neon  = new THREE.MeshStandardMaterial({ color: 0x00d9ff, emissive: 0x00d9ff, emissiveIntensity: 2.5 });
  const food  = new THREE.MeshStandardMaterial({ color: 0xff9933, roughness: 0.8 });
  const g = new THREE.Group();
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.9, 0.9), wood);
  counter.position.y = 0.45; g.add(counter);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.1, 1.6), roof);
  canopy.position.set(0, 2.4, 0); g.add(canopy);
  for (const px of [-1.6, 1.6]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 0.08), wood);
    post.position.set(px, 1.2, 0); g.add(post);
  }
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 0.06), neon);
  sign.position.set(0, 2.1, -0.48); g.add(sign);
  const signLight = new THREE.PointLight(0x00d9ff, 4, 6, 2);
  signLight.position.set(0, 2.1, -0.6); g.add(signLight);
  for (let i = -1; i <= 1; i++) {
    const item = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.3), food);
    item.position.set(i * 0.8, 0.97, 0); g.add(item);
  }
  const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.4), wood);
  bench.position.set(0, 0.45, side * 1.1); g.add(bench);
  for (const bx of [-1.4, 1.4]) {
    const bleg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), wood);
    bleg.position.set(bx, 0.22, side * 1.1); g.add(bleg);
  }
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function makeDumpster(parent, x, y, z) {
  const mat  = new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.85, metalness: 0.5 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x00ff44, emissive: 0x00cc33, emissiveIntensity: 1.5 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.0), mat);
  body.position.y = 0.7; g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.1, 1.05), trim);
  stripe.position.y = 1.15; g.add(stripe);
  g.position.set(x, y, z);
  parent.add(g);
}

function makeBurnedCar(parent, x, y, z, ry = 0) {
  const body  = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.95, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.8, transparent: true, opacity: 0.5 });
  const wheel = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const g = new THREE.Group();
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 4.2), body);
  chassis.position.y = 0.55; g.add(chassis);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2.2), body);
  cabin.position.set(0, 1.15, 0.2); g.add(cabin);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.06), glass);
  windshield.position.set(0, 1.1, -0.9); g.add(windshield);
  for (const [wx, wz] of [[-1.05,-1.4],[1.05,-1.4],[-1.05,1.4],[1.05,1.4]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.22, 10), wheel);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.35, wz); g.add(w);
  }
  const ember = new THREE.PointLight(0xff4400, 5, 4, 2);
  ember.position.set(0, 0.8, 0); g.add(ember);
  g.position.set(x, y, z); g.rotation.y = ry;
  parent.add(g);
}

// ─────────────────────────────────────────────────────────────
// CITIZEN CLASS (non-fighting NPC)
// ─────────────────────────────────────────────────────────────
const PANIC_LINES = [
  'Run! Something\'s happening up the street!',
  'GET DOWN! They\'re fighting!',
  'What is that?! GO GO GO!',
  'Everyone scatter! NOW!',
];

class Citizen {
  constructor(parent, position, behaviour = 'sit') {
    this.behaviour = behaviour;
    this.panicked  = false;
    this.runDir    = new THREE.Vector3((Math.random() - 0.5) * 2, 0, Math.random() > 0.5 ? -1 : 1).normalize();
    this.hideMode  = Math.random() > 0.5;
    this.active    = true;

    this.group = new THREE.Group();
    this.group.position.copy(position);
    parent.add(this.group);

    this.mixer   = null;
    this.actions = {};
    this.currentAction = null;
    this._desired = 'idle';
    this._loadModel();
  }

  _loadModel() {
    new FBXLoader().load('./assets/models/enemy/X_Bot.fbx', (fbx) => {
      fbx.scale.setScalar(0.012);
      fbx.traverse(o => { if (o.isMesh) o.castShadow = true; });
      fbx.traverse(o => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => { if (m.color) m.color.setHex(0xaaddff); });
        }
      });
      this.group.add(fbx);
      this.fbx = fbx;
      this.mixer = new THREE.AnimationMixer(fbx);

      const idleFile = this.behaviour === 'sit'
        ? './assets/models/enemy/Sitting Talking.fbx'
        : './assets/models/enemy/Dwarf Idle.fbx';

      loadAnim(idleFile, (clip) => {
        this.actions.idle = this.mixer.clipAction(clip);
        if (this._desired === 'idle' && !this.currentAction) {
          this.actions.idle.play();
          this.currentAction = this.actions.idle;
        }
      });

      loadAnim('./assets/models/enemy/Running.fbx', (clip) => {
        this.actions.run = this.mixer.clipAction(clip);
        if (this._desired === 'run') {
          if (this.currentAction) this.currentAction.fadeOut(0.2);
          this.actions.run.reset().fadeIn(0.2).play();
          this.currentAction = this.actions.run;
        }
      });
    }, undefined, () => {
      const cap = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.28, 1.1, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x4488cc })
      );
      cap.position.y = 0.85;
      this.group.add(cap);
    });
  }

  panic() {
    if (this.panicked) return;
    this.panicked = true;

    if (this.hideMode) {
      if (this.currentAction) this.currentAction.stop();
    } else {
      this._desired = 'run';
      if (this.actions.idle) this.actions.idle.fadeOut(0.2);
      if (this.actions.run) {
        this.actions.run.reset().fadeIn(0.2).play();
        this.currentAction = this.actions.run;
      }
      if (Math.abs(this.runDir.x) > 0.1 || Math.abs(this.runDir.z) > 0.1)
        this.group.rotation.y = Math.atan2(this.runDir.x, this.runDir.z);
    }
  }

  update(dt) {
    if (this.mixer) this.mixer.update(dt);
    if (this.panicked && !this.hideMode && this.active) {
      this.group.position.addScaledVector(this.runDir, 6.5 * dt);
      if (this.group.position.length() > 200) this.active = false;
    }
  }

  dispose() {
    if (this.mixer) this.mixer.stopAllAction();
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}

// ─────────────────────────────────────────────────────────────
// ENEMY STATE MACHINE
// ─────────────────────────────────────────────────────────────
const STATE = {
  DORMANT:     0,
  ALERTING:    1,
  APPROACHING: 2,
  CIRCLING:    3,
  ATTACKING:   4,
  RECOVERING:  5,
  STAGGERED:   6,
  DEAD:        7,
};

// ─────────────────────────────────────────────────────────────
// ENEMY TUNING
// ─────────────────────────────────────────────────────────────
const ENEMY = {
  // ── Ranges ─────────────────────────────────────────────
  AWARENESS:       14,      // notices player at this distance
  ENGAGE:          4.0,     // ideal standing distance
  ATTACK_RANGE:    2.8,     // can swing from here
  RECOVER_DIST:    5.5,     // retreats to here after swinging

  // ── Movement speeds (m/s) ──────────────────────────────
  HUMAN_SPEED:     4.0,
  MUTANT_SPEED:    3.0,
  BACKPEDAL_MULT:  0.7,

  // ── Motion smoothing ───────────────────────────────────
  ACCEL:           9.0,     // m/s²
  TURN_SPEED:      4.5,     // rad/sec

  // ── Separation (boids) ─────────────────────────────────
  SEPARATION_DIST: 1.5,
  SEPARATION_STR:  6.0,

  // ── Slot layout ────────────────────────────────────────
  SLOT_COUNT:      6,
  SLOT_RADIUS:     3.8,

  // ── Attack timing ──────────────────────────────────────
  // Attack cooldown is the rest between swings. Longer than the
  // clip so the animation fully plays out before the next starts.
  ATTACK_COOLDOWN_HUMAN:   1.6,
  ATTACK_COOLDOWN_MUTANT:  2.2,
  ATTACK_COOLDOWN_ON_HIT:  1.8,   // extra cooldown after being hit

  // Wind-up: time from clip start to the moment damage lands.
  // MUST match the animation's anticipation phase.
  SWING_WINDUP_HUMAN:      0.55,
  SWING_WINDUP_MUTANT:     0.85,

  // How long the ATTACKING state lasts after the wind-up fires.
  // This is the follow-through + recovery portion of the clip.
  ATTACK_TAIL_HUMAN:       0.7,
  ATTACK_TAIL_MUTANT:      1.0,

  // ── Recovery state ─────────────────────────────────────
  RECOVER_TIME:    1.1,     // how long they back off after swinging

  // ── Alert / stagger timing ─────────────────────────────
  ALERT_ANIM_TIME: 1.5,
  STAGGER_TIME:    0.6,
};

// ─────────────────────────────────────────────────────────────
// ENEMY CLASS
// ─────────────────────────────────────────────────────────────
class Enemy {
  constructor(parent, position, type = 'human', attackGate = null, slotIndex = 0) {
    this.type      = type;
    this.health    = type === 'mutant' ? 8 : 5;
    this.maxHealth = this.health;
    this.state     = STATE.DORMANT;
    this.alerted   = false;
    this.active    = true;
    this._disposed = false;

    // Movement
    this.velocity  = new THREE.Vector3();
    this.targetVel = new THREE.Vector3();
    this.moveSpeed = type === 'mutant' ? ENEMY.MUTANT_SPEED : ENEMY.HUMAN_SPEED;
    this.facingYaw = 0;
    this.targetYaw = 0;

    // Combat timers
    this.swingTimer     = 0;    // time until current swing lands
    this.swingLanded    = false;
    this.attackTail     = 0;    // time remaining in ATTACKING after swing fires
    this.attackCooldown = 0;    // time until this enemy can swing again
    this.recoverTimer   = 0;    // time remaining in RECOVERING state

    // Slot
    this.slotIndex = slotIndex;

    // Attack gate
    this.gate       = attackGate;
    this._holdsSlot = false;

    this.group = new THREE.Group();
    this.group.position.copy(position);
    parent.add(this.group);

    this.mixer   = null;
    this.actions = {};
    this.currentAction = null;
    this.hitbox  = new THREE.Box3();

    this._loadModel();
  }

  _loadModel() {
    new FBXLoader().load('./assets/models/enemy/X_Bot.fbx', (fbx) => {
      const scale = this.type === 'mutant' ? 0.016 : 0.013;
      fbx.scale.setScalar(scale);
      fbx.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.group.add(fbx);
      this.fbx = fbx;
      this.mixer = new THREE.AnimationMixer(fbx);
      this._loadAnims();
    }, undefined, () => {
      const cap = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35, 1.4, 4, 8),
        new THREE.MeshStandardMaterial({ color: this.type === 'mutant' ? 0x662200 : 0x224488 })
      );
      cap.position.y = 1.0;
      this.group.add(cap);
    });
  }

  _loadAnims() {
    const base = './assets/models/enemy/';
    const files = {
      idle:    this.type === 'mutant' ? 'Being_Cocky.fbx'            : 'Dwarf Idle.fbx',
      sit:     'Sitting Talking.fbx',
      move:    this.type === 'mutant' ? 'Mutant Walking.fbx'         : 'Running.fbx',
      attack1: this.type === 'mutant' ? 'Mutant_Punch.fbx'           : 'Boxing.fbx',
      attack2: this.type === 'mutant' ? 'Sprinting_Forward_Roll.fbx' : 'Kicking.fbx',
      hit:     'Reaction.fbx',
      die:     'Dying.fbx',
      roar:    'Mutant_Roaring.fbx',
    };

    this._animFiles = files;

    for (const [key, file] of Object.entries(files)) {
      loadAnim(base + file, (clip) => {
        this.actions[key] = this.mixer.clipAction(clip);

        // Fit the move clip to actual movement speed.
        if (key === 'move') {
          const stride = this.type === 'mutant' ? 1.5 : 4.5;
          this.actions[key].timeScale = this.moveSpeed / stride;
        }

        if (this._desiredAction) this._playAction(this._desiredAction.name, this._desiredAction.loop);
        else if (this.state === STATE.DORMANT) this._playAction('sit', true);
      });
    }

    setTimeout(() => {
      if (this._disposed) return;
      const missing = Object.entries(this._animFiles)
        .filter(([k]) => !this.actions[k])
        .map(([k, f]) => `${k} (${f})`);
      if (missing.length)
        console.warn(`[StreetEnemies] ${this.type} clips missing:`, missing.join(', '));
    }, 8000);
  }

  _playAction(name, loop = true) {
    this._desiredAction = { name, loop };
    let next = this.actions[name];
    if (!next && (name === 'attack1' || name === 'attack2'))
      next = this.actions.attack1 || this.actions.attack2;
    if (!next) return;
    if (next === this.currentAction) {
      if (loop || next.isRunning()) return;
      next.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.08).play();
      return;
    }
    if (this.currentAction) this.currentAction.fadeOut(0.22);
    next.reset()
      .setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
      .fadeIn(0.22).play();
    if (!loop) next.clampWhenFinished = true;
    this.currentAction = next;
  }

  // ── state transitions ───────────────────────────────────
  alert() {
    if (this.alerted || this.state === STATE.DEAD || this._disposed) return;
    this.alerted = true;
    this.state   = STATE.ALERTING;
    this._playAction('roar', false);
    setTimeout(() => {
      if (this._disposed || this.state === STATE.DEAD) return;
      this.state = STATE.APPROACHING;
      this._playAction('move');
    }, ENEMY.ALERT_ANIM_TIME * 1000);
  }

  takeDamage() {
    if (this.state === STATE.DEAD || this._disposed) return false;

    // Losing your turn: release the attack slot and cancel any
    // landing hit that was about to happen.
    this._releaseSlot();
    this.swingLanded = false;
    this.velocity.set(0, 0, 0);

    this.health--;
    if (this.health <= 0) { this._die(); return true; }

    // Reward the player: enemy can't retaliate for a while.
    this.attackCooldown = Math.max(this.attackCooldown, ENEMY.ATTACK_COOLDOWN_ON_HIT);

    this.state = STATE.STAGGERED;
    this._playAction('hit', false);
    setTimeout(() => {
      if (this._disposed || this.state === STATE.DEAD) return;
      this.state = STATE.APPROACHING;
      this._playAction('move');
    }, ENEMY.STAGGER_TIME * 1000);
    return false;
  }

  _releaseSlot() {
    if (this._holdsSlot && this.gate) this.gate.current = Math.max(0, this.gate.current - 1);
    this._holdsSlot = false;
  }

  _die() {
    this._releaseSlot();
    this.swingLanded = false;
    this.state  = STATE.DEAD;
    this.active = false;
    this.velocity.set(0, 0, 0);
    this._playAction('die', false);
  }

  getHitbox() {
    const p = this.group.position;
    this.hitbox.set(
      new THREE.Vector3(p.x - 0.65, p.y, p.z - 0.65),
      new THREE.Vector3(p.x + 0.65, p.y + 2.4, p.z + 0.65)
    );
    return this.hitbox;
  }

  // ── personal slot around the player ─────────────────────
  _slotPosition(playerPos, playerYaw) {
    const angleOffset = (this.slotIndex / ENEMY.SLOT_COUNT) * Math.PI * 2;
    const angle = playerYaw + angleOffset;
    return new THREE.Vector3(
      playerPos.x + Math.sin(angle) * ENEMY.SLOT_RADIUS,
      playerPos.y,
      playerPos.z + Math.cos(angle) * ENEMY.SLOT_RADIUS
    );
  }

  // ── smooth turning ──────────────────────────────────────
  _turnToward(targetYaw, dt) {
    const delta = shortAngle(this.facingYaw, targetYaw);
    const maxStep = ENEMY.TURN_SPEED * dt;
    const step = Math.max(-maxStep, Math.min(maxStep, delta));
    this.facingYaw += step;
    this.group.rotation.y = this.facingYaw;
  }

  // ── velocity smoothing ──────────────────────────────────
  _steerToward(targetDir, targetSpeed, dt, backpedal = false) {
    const speed = backpedal ? targetSpeed * ENEMY.BACKPEDAL_MULT : targetSpeed;
    this.targetVel.copy(targetDir).multiplyScalar(speed);
    const lerpT = Math.min(1, ENEMY.ACCEL * dt / Math.max(0.001, this.moveSpeed));
    this.velocity.lerp(this.targetVel, lerpT);
  }

  // ── main per-frame update ───────────────────────────────
  update(dt, playerPos, playerYaw, neighbors) {
    if (this.mixer) this.mixer.update(dt);
    if (this.state === STATE.DEAD || this._disposed) return;

    // Tick the cooldown — this is the rest between attacks.
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    // Face the player unless staggered or dead.
    if (this.state !== STATE.STAGGERED) {
      const dx = playerPos.x - this.group.position.x;
      const dz = playerPos.z - this.group.position.z;
      if (Math.abs(dx) > 0.05 || Math.abs(dz) > 0.05) {
        this.targetYaw = Math.atan2(dx, dz);
      }
    }
    this._turnToward(this.targetYaw, dt);

    // Separation force — push away from other enemies.
    const separation = new THREE.Vector3();
    for (const other of neighbors) {
      if (other === this || other.state === STATE.DEAD) continue;
      const dx = this.group.position.x - other.group.position.x;
      const dz = this.group.position.z - other.group.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > 0.0001 && distSq < ENEMY.SEPARATION_DIST * ENEMY.SEPARATION_DIST) {
        const dist = Math.sqrt(distSq);
        const push = (ENEMY.SEPARATION_DIST - dist) / ENEMY.SEPARATION_DIST;
        separation.x += (dx / dist) * push;
        separation.z += (dz / dist) * push;
      }
    }
    separation.multiplyScalar(ENEMY.SEPARATION_STR);

    const distToPlayer = Math.hypot(
      playerPos.x - this.group.position.x,
      playerPos.z - this.group.position.z
    );

    // ── behavior by state ────────────────────────────────
    switch (this.state) {

      case STATE.DORMANT:
        this.velocity.multiplyScalar(0.85);
        break;

      case STATE.ALERTING:
        this.velocity.multiplyScalar(0.85);
        break;

      case STATE.APPROACHING: {
        // Priority: if we can strike right now, strike.
        if (distToPlayer <= ENEMY.ATTACK_RANGE && this._canAttack()) {
          this._enterAttack();
          break;
        }

        // Otherwise navigate to slot.
        const slot = this._slotPosition(playerPos, playerYaw);
        const toSlot = new THREE.Vector3(
          slot.x - this.group.position.x, 0,
          slot.z - this.group.position.z
        );
        const slotDist = toSlot.length();

        if (slotDist < 0.6) {
          // Arrived. Attack if possible, otherwise hold.
          if (distToPlayer <= ENEMY.ATTACK_RANGE + 0.4 && this._canAttack()) {
            this._enterAttack();
          } else {
            this.state = STATE.CIRCLING;
          }
        } else {
          const dir = toSlot.normalize();
          dir.add(separation.clone().multiplyScalar(0.15)).normalize();
          this._steerToward(dir, this.moveSpeed, dt);
        }
        break;
      }

      case STATE.CIRCLING: {
        // Actively try to attack every frame the gate is open.
        if (distToPlayer <= ENEMY.ATTACK_RANGE + 0.4 && this._canAttack()) {
          this._enterAttack();
          break;
        }

        // Player walked away — resume approach.
        if (distToPlayer > ENEMY.ENGAGE + 1.5) {
          this.state = STATE.APPROACHING;
          this._playAction('move');
          break;
        }

        // Hold. Apply separation only.
        this.velocity.multiplyScalar(0.85);
        this.group.position.x += separation.x * dt;
        this.group.position.z += separation.z * dt;

        // Idle while waiting.
        if (this.currentAction !== this.actions.idle) {
          this._playAction('idle');
        }
        break;
      }

      case STATE.ATTACKING: {
        // Rooted in place. Kill forward velocity.
        this.velocity.multiplyScalar(0.7);

        // Player ran away mid-swing — abandon.
        if (distToPlayer > ENEMY.ATTACK_RANGE + 1.5) {
          this._releaseSlot();
          this.swingLanded = false;
          this.state = STATE.APPROACHING;
          this._playAction('move');
          break;
        }

        // Count down wind-up.
        if (!this.swingLanded) {
          this.swingTimer -= dt;
          if (this.swingTimer <= 0) {
            this.swingLanded = true;
          }
        }

        // Count down the tail (follow-through + recovery portion).
        this.attackTail -= dt;
        if (this.attackTail <= 0) {
          // Attack fully done. Release slot, retreat.
          this._releaseSlot();
          this.state = STATE.RECOVERING;
          this.recoverTimer = ENEMY.RECOVER_TIME;
          this._playAction('move');
        }
        break;
      }

      case STATE.RECOVERING: {
        // Back away from player.
        const away = new THREE.Vector3(
          this.group.position.x - playerPos.x, 0,
          this.group.position.z - playerPos.z
        ).normalize();
        away.add(separation.clone().multiplyScalar(0.4)).normalize();
        this._steerToward(away, this.moveSpeed, dt, true);

        this.recoverTimer -= dt;
        if (this.recoverTimer <= 0 || distToPlayer > ENEMY.RECOVER_DIST) {
          this.state = STATE.APPROACHING;
          this._playAction('move');
        }
        break;
      }

      case STATE.STAGGERED:
        this.velocity.multiplyScalar(0.7);
        break;
    }

    // Integrate movement.
    const move = this.velocity.clone().multiplyScalar(dt);
    move.x += separation.x * dt;
    move.z += separation.z * dt;
    this.group.position.x += move.x;
    this.group.position.z += move.z;
  }

  // ── attack gating ───────────────────────────────────────
  _canAttack() {
    if (this.attackCooldown > 0) return false;
    if (this.gate && this.gate.current >= this.gate.max) return false;
    return true;
  }

  _enterAttack() {
    // Claim the attack slot.
    if (this.gate) { this.gate.current++; this._holdsSlot = true; }
    this.state = STATE.ATTACKING;

    // Alternate between the two attack clips.
    const pick = this._lastAttack === 'attack1' ? 'attack2'
               : this._lastAttack === 'attack2' ? 'attack1'
               : (Math.random() > 0.5 ? 'attack1' : 'attack2');
    this._lastAttack = pick;
    this._playAction(pick, false);

    const isMutant = this.type === 'mutant';
    this.swingTimer  = isMutant ? ENEMY.SWING_WINDUP_MUTANT : ENEMY.SWING_WINDUP_HUMAN;
    this.attackTail  = isMutant ? ENEMY.ATTACK_TAIL_MUTANT  : ENEMY.ATTACK_TAIL_HUMAN;
    this.swingLanded = false;
    this.recoverTimer = 0;

    // Set the cooldown NOW — this is the "rest" between attacks.
    // It runs in parallel with the swing animation, so by the time
    // the enemy finishes recovering, they're ready to go again.
    this.attackCooldown = isMutant
      ? ENEMY.ATTACK_COOLDOWN_MUTANT
      : ENEMY.ATTACK_COOLDOWN_HUMAN;
  }

  dispose() {
    this._disposed = true;
    this._releaseSlot();
    this.swingLanded = false;
    if (this.mixer) this.mixer.stopAllAction();
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}

// ─────────────────────────────────────────────────────────────
// STREET ENEMIES — main class
// ─────────────────────────────────────────────────────────────
export class StreetEnemies {
  constructor(levelGroup, onComplete) {
    this.group      = levelGroup;
    this.onComplete = onComplete;

    this.enemies     = [];
    this.citizens    = [];
    this.wave        = 1;
    this.alarmFired  = false;
    this.wave2Spawned = false;
    this.complete    = false;
    this._time       = 0;
    this._portalTimer = 0;
    this._architectPlayed = false;

    this.hp    = 100;
    this.maxHp = 100;
    this.dead  = false;
    this.respawnTimer = 0;
    this.punchCooldown = 0;
    this._hurtCooldown  = 0;
    this._disposed      = false;

    // Cap simultaneous attackers.
    this.attackGate = { current: 0, max: 2 };

    // Slot reservation.
    this._slotClaims = new Map();

    this._punchBox = new THREE.Box3();
    const { bar } = ensureHealthBar();
    this._hpBar  = bar;
    this._waveEl = ensureWaveHUD();

    this._portalMesh = null;
    this._portalMat  = null;

    this._buildScene();
  }

  _buildScene() {
    makeRoundTable(this.group, -5, 0, -85);
    makeRoundTable(this.group, 5, 0, -70);
    makeBenchStall(this.group, -6, 0, -55, 1);
    makeBenchStall(this.group, 6, 0, -45, -1);

    this.citizens.push(new Citizen(this.group, new THREE.Vector3(-5.8, 0, -85), 'sit'));
    this.citizens.push(new Citizen(this.group, new THREE.Vector3(-4.2, 0, -84), 'sit'));
    this.citizens.push(new Citizen(this.group, new THREE.Vector3(4.5, 0, -70), 'sit'));
    this.citizens.push(new Citizen(this.group, new THREE.Vector3(5.5, 0, -71), 'sit'));
    this.citizens.push(new Citizen(this.group, new THREE.Vector3(-6, 0, -55), 'stand'));
    this.citizens.push(new Citizen(this.group, new THREE.Vector3(-5, 0, -53), 'stand'));
    this.citizens.push(new Citizen(this.group, new THREE.Vector3(6, 0, -45), 'sit'));
    this.citizens.push(new Citizen(this.group, new THREE.Vector3(3, 0, -62), 'stand'));
    this.citizens[7].runDir.set(-0.3, 0, -1).normalize();

    makeBurnedCar(this.group, -4, 0, 20, Math.PI * 0.1);
    makeDumpster(this.group, 5, 0, 35);
    makeDumpster(this.group, -5.5, 0, 50);

    this._spawnHumans();
  }

  _spawnHumans() {
    const spawns = [
      new THREE.Vector3(-5.5, 0, -18),
      new THREE.Vector3(-6.5, 0, -12),
      new THREE.Vector3(-4.5, 0, -22),
      new THREE.Vector3(-4,   0,   5),
      new THREE.Vector3( 4,   0,  10),
    ];
    for (let i = 0; i < spawns.length; i++) {
      const enemy = new Enemy(this.group, spawns[i], 'human', this.attackGate, i % ENEMY.SLOT_COUNT);
      this.enemies.push(enemy);
      this._slotClaims.set(enemy.slotIndex, enemy);
    }
  }

  _spawnMutants() {
    const startIdx = this.enemies.length;
    const spawns = [
      new THREE.Vector3(-5, 0, 80),
      new THREE.Vector3( 5, 0, 85),
    ];
    for (let i = 0; i < spawns.length; i++) {
      const enemy = new Enemy(this.group, spawns[i], 'mutant', this.attackGate,
                              (startIdx + i) % ENEMY.SLOT_COUNT);
      this.enemies.push(enemy);
      this._slotClaims.set(enemy.slotIndex, enemy);
    }

    setTimeout(() => {
      if (this._disposed) return;
      this.enemies.slice(-2).forEach(e => e.alert());
    }, 600);

    this._waveEl.innerText = '⚠  WAVE 2 — MUTANTS';
    this._waveEl.style.display = 'block';
    setTimeout(() => { this._waveEl.style.display = 'none'; }, 3500);
    showDialogue('The mutants are loose.', 3000);
  }

  _checkAlarm(playerPos) {
    if (this.alarmFired) return;
    const alarm = this.enemies[4];
    if (!alarm?.active) return;
    if (playerPos.distanceTo(alarm.group.position) < 12) {
      this.alarmFired = true;

      const panicLine = PANIC_LINES[Math.floor(Math.random() * PANIC_LINES.length)];
      showDialogue(panicLine, 3000);
      this.citizens.forEach((c, i) => setTimeout(() => c.panic(), i * 120));

      this._waveEl.innerText = '⚠  ALARM TRIGGERED';
      this._waveEl.style.display = 'block';
      setTimeout(() => { this._waveEl.style.display = 'none'; }, 3000);

      // Stagger alerts so they don't all roar at once.
      this.enemies.forEach((e, i) => setTimeout(() => e.alert(), 400 + i * 550));
    }
  }

  onMouseClick(camera, playerPos) {
    if (this.punchCooldown > 0 || this.dead) return;
    this.punchCooldown = 0.4;

    const raw     = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    const forward = new THREE.Vector3(raw.x, 0, raw.z).normalize();
    const center  = playerPos.clone().addScaledVector(forward, 2.0);
    center.y += 1.0;
    this._punchBox.setFromCenterAndSize(center, new THREE.Vector3(2.2, 2.2, 2.2));

    for (const e of this.enemies) {
      if (!e.active) continue;
      if (this._punchBox.intersectsBox(e.getHitbox())) {
        const killed = e.takeDamage();
        if (killed) this._checkWaveComplete();
      }
    }
  }

  _checkWaveComplete() {
    const aliveH = this.enemies.filter(e => e.type === 'human'  && e.active).length;
    const aliveM = this.enemies.filter(e => e.type === 'mutant' && e.active).length;

    if (this.wave === 1 && aliveH === 0 && !this.wave2Spawned) {
      this.wave = 2;
      this.wave2Spawned = true;
      setTimeout(() => { if (!this._disposed) this._spawnMutants(); }, 1200);
    }
    if (this.wave === 2 && aliveM === 0 && this.wave2Spawned && !this.complete) {
      this.complete = true;
      setTimeout(() => this._architectSequence(), 1500);
    }
  }

  _architectSequence() {
    if (this._architectPlayed || this._disposed) return;
    this._architectPlayed = true;
    const lines = [
      'Impressive, Sorini. You exceeded every projection we had for you.',
      'You were our greatest experiment.\nI don\'t understand why you want to destroy what we built together.',
      'Come. Let\'s finish this conversation face to face.',
    ];
    showDialogue(lines[0], 4000);
    setTimeout(() => showDialogue(lines[1], 5000), 4800);
    setTimeout(() => showDialogue(lines[2], 4000), 10500);
    setTimeout(() => {
      showDialogue('Step into the portal.', 6000);
      this._openPortal();
    }, 15000);
  }

  _openPortal() {
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0x0044ff, emissive: 0x0088ff, emissiveIntensity: 3, roughness: 0.2, metalness: 0.8,
    });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.2, 16, 60), torusMat);
    this._portalMat = new THREE.ShaderMaterial({
      vertexShader: PORTAL_VERT, fragmentShader: PORTAL_FRAG,
      uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const disc   = new THREE.Mesh(new THREE.CircleGeometry(2.1, 48), this._portalMat);
    const pLight = new THREE.PointLight(0x0088ff, 24, 20, 1.8);
    this._portalMesh = new THREE.Group();
    this._portalMesh.add(torus, disc, pLight);
    this._portalMesh.position.set(0, 3, 116);
    this.group.add(this._portalMesh);
  }

  _takeDamage(amount) {
    if (this.dead || this._hurtCooldown > 0) return;
    this._hurtCooldown = 0.7;
    this.hp = Math.max(0, this.hp - amount);
    this._hpBar.style.width = `${(this.hp / this.maxHp) * 100}%`;
    if (this.hp <= 0) {
      this.dead = true;
      this.respawnTimer = 2.5;
      showDialogue('Sorini is down...', 2000);
    }
  }

  _respawn(player) {
    this.dead = false;
    this.hp   = this.maxHp;
    this._hpBar.style.width = '100%';
    if (player) { player.pos.set(0, 0.1, -120); player.vel.set(0,0,0); player.yaw = 0; }
    showDialogue('Back on your feet.', 2000);
  }

  update(dt, t, player) {
    this._time += dt;
    const pPos = player.pos;
    const pYaw = player.yaw || 0;

    if (this.punchCooldown > 0) this.punchCooldown -= dt;
    if (this._hurtCooldown > 0) this._hurtCooldown -= dt;

    if (this.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this._respawn(player);
      return;
    }

    if (!this.alarmFired) this._checkAlarm(pPos);

    for (const c of this.citizens) if (c.active) c.update(dt);

    for (const e of this.enemies) {
      if (e.state === STATE.DEAD) { if (e.mixer) e.mixer.update(dt); continue; }
      e.update(dt, pPos, pYaw, this.enemies);
      if (e.swingLanded) {
        e.swingLanded = false;
        const reach = e.type === 'mutant' ? 3.2 : 2.8;
        if (e.group.position.distanceTo(pPos) < reach) {
          this._takeDamage(e.type === 'mutant' ? 20 : 10);
        }
      }
    }

    if (this._portalMesh && this._portalMat) {
      this._portalMat.uniforms.uTime.value = this._time;
      this._portalMesh.rotation.y += dt * 0.4;
      if (pPos.distanceTo(this._portalMesh.position) < 2.8) {
        this._portalTimer += dt;
        if (this._portalTimer > 1.2 && this.onComplete) {
          this.onComplete();
          this.onComplete = null;
        }
      } else {
        this._portalTimer = 0;
      }
    }
  }

  dispose() {
    this._disposed = true;
    for (const e of this.enemies) e.dispose();
    for (const c of this.citizens) c.dispose();
    this.enemies = []; this.citizens = [];
    this._slotClaims.clear();
    if (this._portalMesh) {
      this._portalMesh.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      this._portalMesh.parent?.remove(this._portalMesh);
    }
    document.getElementById('soriniHealth')?.remove();
    document.getElementById('waveHUD')?.remove();
    document.getElementById('dialogue')?.remove();
  }
}