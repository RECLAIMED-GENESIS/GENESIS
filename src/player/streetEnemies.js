// ============================================================
// streetEnemies.js — Enemy + Citizen system for Level 2
// Third-person camera is handled in main.js
// ============================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

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
    if (fbx.animations?.[0]) onLoad(fbx.animations[0]);
  }, undefined, (e) => console.warn('anim failed:', path, e));
}

// ─────────────────────────────────────────────────────────────
// FURNITURE BUILDER
// ─────────────────────────────────────────────────────────────
function makeChair(parent, x, y, z, ry = 0) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.9 });
  const g = new THREE.Group();
  // seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 0.55), wood);
  seat.position.y = 0.5; g.add(seat);
  // back
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.06), wood);
  back.position.set(0, 0.78, -0.25); g.add(back);
  // legs
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
  // top
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.07, 16), wood);
  top.position.y = 0.75; g.add(top);
  // pedestal
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.7, 8), metal);
  ped.position.y = 0.37; g.add(ped);
  // base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12), metal);
  base.position.y = 0.02; g.add(base);
  // cups on table
  for (const [cx, cz] of [[-0.25, -0.2],[0.25, 0.2]]) {
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.05, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0xddccbb, roughness: 0.6 })
    );
    cup.position.set(cx, 0.82, cz); g.add(cup);
  }
  g.position.set(x, y, z);
  parent.add(g);
  // two chairs around it
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

  // counter
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.9, 0.9), wood);
  counter.position.y = 0.45; g.add(counter);
  // canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.1, 1.6), roof);
  canopy.position.set(0, 2.4, 0); g.add(canopy);
  // supports
  for (const px of [-1.6, 1.6]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 0.08), wood);
    post.position.set(px, 1.2, 0); g.add(post);
  }
  // neon sign
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 0.06), neon);
  sign.position.set(0, 2.1, -0.48); g.add(sign);
  const signLight = new THREE.PointLight(0x00d9ff, 4, 6, 2);
  signLight.position.set(0, 2.1, -0.6); g.add(signLight);
  // food items on counter
  for (let i = -1; i <= 1; i++) {
    const item = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.3), food);
    item.position.set(i * 0.8, 0.97, 0); g.add(item);
  }
  // bench on customer side
  const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.4), wood);
  bench.position.set(0, 0.45, side * 1.1); g.add(bench);
  // bench legs
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
  // ember glow inside
  const ember = new THREE.PointLight(0xff4400, 5, 4, 2);
  ember.position.set(0, 0.8, 0); g.add(ember);
  g.position.set(x, y, z); g.rotation.y = ry;
  parent.add(g);
}

// ─────────────────────────────────────────────────────────────
// CITIZEN CLASS  (non-fighting NPC)
// ─────────────────────────────────────────────────────────────
const PANIC_LINES = [
  'Run! Something\'s happening up the street!',
  'GET DOWN! They\'re fighting!',
  'What is that?! GO GO GO!',
  'Everyone scatter! NOW!',
];

class Citizen {
  constructor(parent, position, behaviour = 'sit') {
    // behaviour: 'sit' | 'stand' | 'walk'
    this.behaviour = behaviour;
    this.panicked  = false;
    this.runDir    = new THREE.Vector3((Math.random() - 0.5) * 2, 0, Math.random() > 0.5 ? -1 : 1).normalize();
    this.hideMode  = Math.random() > 0.5; // true = hide, false = run
    this.active    = true;

    this.group = new THREE.Group();
    this.group.position.copy(position);
    parent.add(this.group);

    this.mixer   = null;
    this.actions = {};
    this.currentAction = null;
    this._loadModel();
  }

  _loadModel() {
    new FBXLoader().load('./assets/models/enemy/X_Bot.fbx', (fbx) => {
      fbx.scale.setScalar(0.012);
      fbx.traverse(o => { if (o.isMesh) o.castShadow = true; });
      // tint citizens differently — slightly brighter colour
      fbx.traverse(o => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => { if (m.color) m.color.setHex(0xaaddff); });
        }
      });
      this.group.add(fbx);
      this.fbx = fbx;
      this.mixer = new THREE.AnimationMixer(fbx);

      // sitting citizens use Sitting Talking, standing use Dwarf Idle
      const idleFile = this.behaviour === 'sit'
        ? './assets/models/enemy/Sitting Talking.fbx'
        : './assets/models/enemy/Dwarf Idle.fbx';

      this._desired = 'idle';
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
      // fallback capsule — light blue to distinguish from enemies
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
      // freeze in place — just stop animating normally
      if (this.currentAction) this.currentAction.stop();
    } else {
      // switch to run (if the clip is still downloading, the load callback
      // picks this up via _desired and starts it the moment it lands)
      this._desired = 'run';
      if (this.actions.idle) this.actions.idle.fadeOut(0.2);
      if (this.actions.run) {
        this.actions.run.reset().fadeIn(0.2).play();
        this.currentAction = this.actions.run;
      }
      // face run direction
      if (Math.abs(this.runDir.x) > 0.1 || Math.abs(this.runDir.z) > 0.1)
        this.group.rotation.y = Math.atan2(this.runDir.x, this.runDir.z);
    }
  }

  update(dt) {
    if (this.mixer) this.mixer.update(dt);
    if (this.panicked && !this.hideMode && this.active) {
      this.group.position.addScaledVector(this.runDir, 6.5 * dt);
      // despawn when far enough away
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
// ENEMY CLASS
// ─────────────────────────────────────────────────────────────
export const STATE = { IDLE: 0, ALERTED: 1, WALKING: 2, ATTACKING: 3, HIT: 4, DEAD: 5 };

export class Enemy {
  constructor(parent, position, type = 'human', attackGate = null) {
    this.type        = type;
    this.health      = type === 'mutant' ? 8 : 5;
    this.maxHealth   = this.health;
    this.state       = STATE.IDLE;
    this.alerted     = false;
    this.active      = true;
    this._disposed   = false;

    // gate-driven attack state, ticked from update() — no setTimeout
    // chains, so the "max simultaneous attackers" gate can never be
    // bypassed and dead/disposed enemies can never land phantom hits
    this.swingTimer   = 0;     // wind-up remaining before the hit lands
    this.swingLanded  = false; // one-swing flag, consumed by the manager
    this.recoverTimer = 0;     // recovery gap before this enemy may swing again

    // shared across all enemies — caps how many can be actively swinging
    // at the player at once, so you don't get dogpiled by the whole pack
    this.gate        = attackGate;
    this._holdsSlot  = false;

    this.group = new THREE.Group();
    this.group.position.copy(position);
    parent.add(this.group);

    // personal slot around the player — stops everyone piling onto one point
    this.attackOffset = new THREE.Vector3((Math.random() - 0.5) * 2.4, 0, (Math.random() - 0.5) * 2.4);

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
      sit:     'Sitting Talking.fbx',   // H1-H3 use this before alarm
      // HUMANS run, MUTANTS walk — key fix
      move:    this.type === 'mutant' ? 'Mutant Walking.fbx'         : 'Running.fbx',
      attack1: this.type === 'mutant' ? 'Mutant_Punch.fbx'           : 'Boxing.fbx',
      attack2: this.type === 'mutant' ? 'Sprinting_Forward_Roll.fbx' : 'Kicking.fbx',
      hit:     'Reaction.fbx',
      die:     'Dying.fbx',
      roar:    'Mutant_Roaring.fbx',
    };

    // Remember which clip maps to which action so we can report the ones
    // that never arrive (usually a wrong file name / capitalisation / path)
    this._animFiles = files;

    for (const [key, file] of Object.entries(files)) {
      loadAnim(base + file, (clip) => {
        this.actions[key] = this.mixer.clipAction(clip);
        // whatever state the enemy is in right now may have been requested
        // before this clip finished downloading — re-issue it so the
        // animation always converges (this is what used to leave enemies
        // looping their run clip while attacking)
        if (this._desiredAction) this._playAction(this._desiredAction.name, this._desiredAction.loop);
        else if (this.state === STATE.IDLE) this._playAction('idle');
      });
    }

    // after 8s, name any clips that failed so the missing files are visible
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
    // if an attack clip failed to load, fall back to whichever attack exists
    if (!next && (name === 'attack1' || name === 'attack2'))
      next = this.actions.attack1 || this.actions.attack2;
    if (!next) return;   // clip still downloading — the load callback above
                         // will re-issue this request once it lands
    if (next === this.currentAction) {
      // a running loop (or a still-running one-shot) doesn't need a restart,
      // but a FINISHED one-shot must be reset so it can play again
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

  alert() {
    if (this.alerted || this.state === STATE.DEAD || this._disposed) return;
    this.alerted = true;
    this.state   = STATE.ALERTED;
    this._playAction('roar', false);
    setTimeout(() => {
      if (this._disposed || this.state === STATE.DEAD) return;
      this.state = STATE.WALKING;
      this._playAction('move');
    }, 1500);
  }

  takeDamage() {
    if (this.state === STATE.DEAD || this._disposed) return false;
    this._releaseSlot();      // getting hit knocks them out of their attack turn
    this.swingLanded = false; // and cancels any hit that was about to land
    this.health--;
    if (this.health <= 0) { this._die(); return true; }
    this.state = STATE.HIT;
    this._playAction('hit', false);
    setTimeout(() => {
      if (this._disposed || this.state === STATE.DEAD) return;
      this.state = STATE.WALKING;
      this._playAction('move');
    }, 700);
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
    this._playAction('die', false);
    // Stay on ground permanently — no despawn timer
  }

  getHitbox() {
    const p = this.group.position;
    this.hitbox.set(
      new THREE.Vector3(p.x - 0.65, p.y, p.z - 0.65),
      new THREE.Vector3(p.x + 0.65, p.y + 2.4, p.z + 0.65)
    );
    return this.hitbox;
  }

  update(dt, playerPos) {
    if (this.mixer) this.mixer.update(dt);
    if (this.state === STATE.DEAD || this._disposed) return;

    // face player (aiming at this enemy's personal slot, not the exact centre)
    const tx = playerPos.x + this.attackOffset.x;
    const tz = playerPos.z + this.attackOffset.z;
    const dx = tx - this.group.position.x;
    const dz = tz - this.group.position.z;
    if (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1)
      this.group.rotation.y = Math.atan2(dx, dz);

    const dist = Math.hypot(dx, dz);

    if (this.state === STATE.WALKING) {
      if (dist > 2.2) {
        const speed = this.type === 'mutant' ? 3.5 : 5.5;
        const dir = new THREE.Vector3(dx, 0, dz).normalize();
        this.group.position.addScaledVector(dir, speed * dt);
      } else if (this.recoverTimer > 0) {
        this.recoverTimer -= dt;  // close enough, still catching breath
        this._playAction('idle'); // don't run in place while waiting to attack
      } else if (!(!this.gate || this.gate.current < this.gate.max)) {
        this._playAction('idle'); // every attack slot is taken — hold, don't jog
      } else {
        // an attack slot is free — step in and take it
        if (this.gate) { this.gate.current++; this._holdsSlot = true; }
        this.state = STATE.ATTACKING;
        this._startSwing();
      }
      // else: close enough but every slot is taken — hold position,
      // stay facing the player (already handled above), and wait
    } else if (this.state === STATE.ATTACKING) {
      if (dist > 3.5) {
        // player broke away — abandon the swing, give the slot back
        this._releaseSlot();
        this.swingLanded = false;
        this.state = STATE.WALKING;
        this._playAction('move');
        return;
      }
      this.swingTimer -= dt;
      if (this.swingTimer <= 0 && !this.swingLanded) {
        this.swingLanded = true;   // the manager turns this into damage
      }
      this.recoverTimer -= dt;
      if (this.recoverTimer <= 0) {
        // swing fully finished — hand the slot back, then decide what's next
        this._releaseSlot();
        if (dist <= 2.6 && (!this.gate || this.gate.current < this.gate.max)) {
          if (this.gate) { this.gate.current++; this._holdsSlot = true; }
          this._startSwing();
        } else {
          this.state = STATE.WALKING;
          this._playAction('move');
        }
      }
    }
  }

  _startSwing() {
    // strictly alternate so we never re-trigger the same one-shot
    const pick = this._lastAttack === 'attack1' ? 'attack2'
               : this._lastAttack === 'attack2' ? 'attack1'
               : (Math.random() > 0.5 ? 'attack1' : 'attack2');
    this._lastAttack = pick;
    this._playAction(pick, false);
    // wind-up before the hit connects, then a per-enemy recovery gap —
    // this is what stops the pack machine-gunning Sorini together
    this.swingTimer   = this.type === 'mutant' ? 0.85 : 0.55;
    this.swingLanded  = false;
    this.recoverTimer = this.swingTimer + (this.type === 'mutant' ? 1.6 : 1.1) + Math.random() * 0.6;
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

    // Sorini health
    this.hp    = 100;
    this.maxHp = 100;
    this.dead  = false;
    this.respawnTimer = 0;
    this.punchCooldown = 0;
    this._hurtCooldown  = 0;   // post-hit invulnerability window
    this._disposed      = false;

    // caps how many enemies can be actively attacking at once —
    // everyone else in range holds position and waits their turn
    // instead of piling all their attacks on you simultaneously
    this.attackGate = { current: 0, max: 2 };

    this._punchBox = new THREE.Box3();
    const { bar } = ensureHealthBar();
    this._hpBar  = bar;
    this._waveEl = ensureWaveHUD();

    this._portalMesh = null;
    this._portalMat  = null;

    this._buildScene();
  }

  // ── BUILD ─────────────────────────────────────────────────
  _buildScene() {
    // ── CIVILIAN ZONE  (z = -90 to -40) ──────────────────
    // Round tables with citizens
    makeRoundTable(this.group, -5, 0, -85);
    makeRoundTable(this.group, 5, 0, -70);

    // Bench stalls
    makeBenchStall(this.group, -6, 0, -55, 1);
    makeBenchStall(this.group, 6, 0, -45, -1);

    // Citizens — 8 total
    // C1, C2 at left round table
    this.citizens.push(new Citizen(this.group, new THREE.Vector3(-5.8, 0, -85), 'sit'));
    this.citizens.push(new Citizen(this.group, new THREE.Vector3(-4.2, 0, -84), 'sit'));
    // C3, C4 at right round table
    this.citizens.push(new Citizen(this.group, new THREE.Vector3(4.5, 0, -70), 'sit'));
    this.citizens.push(new Citizen(this.group, new THREE.Vector3(5.5, 0, -71), 'sit'));
    // C5 vendor at left bench stall
    this.citizens.push(new Citizen(this.group, new THREE.Vector3(-6, 0, -55), 'stand'));
    // C6 browsing at left bench stall
    this.citizens.push(new Citizen(this.group, new THREE.Vector3(-5, 0, -53), 'stand'));
    // C7 sitting at right bench
    this.citizens.push(new Citizen(this.group, new THREE.Vector3(6, 0, -45), 'sit'));
    // C8 walking — starts further south, walks north
    this.citizens.push(new Citizen(this.group, new THREE.Vector3(3, 0, -62), 'stand'));
    this.citizens[7].runDir.set(-0.3, 0, -1).normalize(); // walker runs south

    // ── COVER OBJECTS (mid street) ────────────────────────
    makeBurnedCar(this.group, -4, 0, 20, Math.PI * 0.1);
    makeDumpster(this.group, 5, 0, 35);
    makeDumpster(this.group, -5.5, 0, 50);

    // ── ENEMIES  (z = -20 to +60) ─────────────────────────
    this._spawnHumans();
  }

  _spawnHumans() {
    // H1, H2, H3 — sitting at stall area near z = -15
    this.enemies.push(new Enemy(this.group, new THREE.Vector3(-5.5, 0, -18), 'human', this.attackGate));
    this.enemies.push(new Enemy(this.group, new THREE.Vector3(-6.5, 0, -12), 'human', this.attackGate));
    this.enemies.push(new Enemy(this.group, new THREE.Vector3(-4.5, 0, -22), 'human', this.attackGate));
    // H4, H5 — patrolling mid street
    this.enemies.push(new Enemy(this.group, new THREE.Vector3(-4, 0, 5),  'human', this.attackGate));
    this.enemies.push(new Enemy(this.group, new THREE.Vector3(4,  0, 10), 'human', this.attackGate));

    // sit the first three until alarm
    this.enemies[0]._playAction && setTimeout(() => {
      if (this._disposed) return;
      [0,1,2].forEach(i => {
        if (this.enemies[i]) this.enemies[i]._playAction?.('sit');
      });
    }, 800);
  }

  _spawnMutants() {
    this.enemies.push(new Enemy(this.group, new THREE.Vector3(-5, 0, 80), 'mutant', this.attackGate));
    this.enemies.push(new Enemy(this.group, new THREE.Vector3(5,  0, 85), 'mutant', this.attackGate));
    setTimeout(() => {
      this.enemies.slice(-2).forEach(e => e.alert());
    }, 600);

    this._waveEl.innerText = '⚠  WAVE 2 — MUTANTS';
    this._waveEl.style.display = 'block';
    setTimeout(() => { this._waveEl.style.display = 'none'; }, 3500);
    showDialogue('The mutants are loose.', 3000);
  }

  // ── ALARM ─────────────────────────────────────────────────
  _checkAlarm(playerPos) {
    if (this.alarmFired) return;
    const alarm = this.enemies[4]; // H5
    if (!alarm?.active) return;
    if (playerPos.distanceTo(alarm.group.position) < 12) {
      this.alarmFired = true;

      // citizens panic
      const panicLine = PANIC_LINES[Math.floor(Math.random() * PANIC_LINES.length)];
      showDialogue(panicLine, 3000);
      this.citizens.forEach((c, i) => setTimeout(() => c.panic(), i * 120));

      // wave HUD
      this._waveEl.innerText = '⚠  ALARM TRIGGERED';
      this._waveEl.style.display = 'block';
      setTimeout(() => { this._waveEl.style.display = 'none'; }, 3000);

      // alert enemies with a heavier stagger — with the 2-attacker gate above,
      // this mostly affects how soon they start closing in, not how many can
      // hit you at once, but spreading the approach still stops them arriving
      // in one solid wall
      this.enemies.forEach((e, i) => setTimeout(() => e.alert(), 400 + i * 550));
    }
  }

  // ── PUNCH ─────────────────────────────────────────────────
  onMouseClick(camera, playerPos) {
    if (this.punchCooldown > 0 || this.dead) return;
    this.punchCooldown = 0.4;

    // The over-shoulder camera looks slightly DOWN at the player (it sits
    // above and behind, aimed at the player's position), so its raw 3D
    // forward vector points partway into the ground. Using that directly
    // shortened the effective reach and skewed the box low — enemies
    // right in front could still be missed. Flattening to yaw-only gives
    // the exact horizontal direction Sorini is actually facing.
    const raw     = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    const forward = new THREE.Vector3(raw.x, 0, raw.z).normalize();
    const center  = playerPos.clone().addScaledVector(forward, 2.0);
    center.y += 1.0;
    // widened a bit so near-miss angles (enemy just off-center) still connect
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

  // ── ARCHITECT ENDING ──────────────────────────────────────
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
      this.openPortal();
    }, 15000);
  }

  openPortal() {
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

  // ── SORINI HEALTH ─────────────────────────────────────────
  _takeDamage(amount) {
    if (this.dead || this._hurtCooldown > 0) return;  // i-frames: packs can't stun-lock Sorini
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

  // ── UPDATE ────────────────────────────────────────────────
  update(dt, t, player) {
    this._time += dt;
    const pPos = player.pos;

    if (this.punchCooldown > 0) this.punchCooldown -= dt;
    if (this._hurtCooldown > 0) this._hurtCooldown -= dt;

    if (this.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this._respawn(player);
      return;
    }

    if (!this.alarmFired) this._checkAlarm(pPos);

    // update citizens
    for (const c of this.citizens) if (c.active) c.update(dt);

    // update enemies — damage happens exactly when a swing lands,
    // and only if the player is still in range at that moment
    for (const e of this.enemies) {
      if (e.state === STATE.DEAD) { if (e.mixer) e.mixer.update(dt); continue; }
      e.update(dt, pPos);
      if (e.swingLanded) {
        e.swingLanded = false;
        const reach = e.type === 'mutant' ? 3.2 : 2.8;
        if (e.group.position.distanceTo(pPos) < reach) {
          this._takeDamage(e.type === 'mutant' ? 20 : 10);
        }
      }
    }

    // portal
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

  // ── DISPOSE ──────────────────────────────────────────────
  dispose() {
    this._disposed = true;
    for (const e of this.enemies) e.dispose();
    for (const c of this.citizens) c.dispose();
    this.enemies = []; this.citizens = [];
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
