// ============================================================
// guardians.js — Level 3 boss guardians (X_Bot skin)
//   • Deferred model load (Enemy ctor fires _loadModel() before
//     this.kind exists — we wait one tick)
//   • skeletonClone per guardian (plain .clone() breaks SkinnedMesh)
//   • Root-motion-stripped clips (kills the run stutter)
//   • Sorini-grade physics + coordinated attack gate
// ============================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Enemy, STATE } from './streetEnemies.js';
import {
  resolveEntity, pushOutOfCircle, worldColliders
} from '../physics/CollisionSystem.js';

const GRAV = 30;

const GUARDIAN_STATS = {
  blade: {
    health: 20, damage: 15, speed: 6.0,
    attackRange: 2.5, windup: 0.45, tail: 0.55, cooldown: 1.3,
    tint: 0xcc2233, scale: 1.1,
  },
  fist: {
    health: 30, damage: 25, speed: 3.0,
    attackRange: 3.0, windup: 0.85, tail: 0.75, cooldown: 1.8,
    tint: 0x2266cc, scale: 1.25,
  },
};

// ─────────────────────────────────────────────────────────────
// SHARED ASSET CACHE
// Load the base X_Bot FBX and every clip once; both guardians
// skeletonClone their own copy of the model afterwards.
// ─────────────────────────────────────────────────────────────
const GUARDIAN_BASE = './assets/models/enemy/';
const GUARDIAN_CLIP_FILES = {
  idle:    'Dwarf Idle.fbx',
  move:    'Running.fbx',
  attack1: 'Boxing.fbx',
  attack2: 'Kicking.fbx',
  hit:     'Reaction.fbx',
  die:     'Dying.fbx',
};

let _guardianAssetsPromise = null;

function loadFbx(loader, path) {
  return new Promise((resolve) => {
    loader.load(
      path,
      (fbx) => resolve(fbx),
      undefined,
      (err) => { console.warn('[Guardian] load failed:', path, err); resolve(null); }
    );
  });
}

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

function getGuardianAssets() {
  if (_guardianAssetsPromise) return _guardianAssetsPromise;
  _guardianAssetsPromise = (async () => {
    const loader = new FBXLoader();

    const baseFbx = await loadFbx(loader, GUARDIAN_BASE + 'X_Bot.fbx');
    if (!baseFbx) return null;

    const clips = {};
    await Promise.all(
      Object.entries(GUARDIAN_CLIP_FILES).map(async ([key, file]) => {
        const fbx = await loadFbx(loader, GUARDIAN_BASE + file);
        if (fbx?.animations?.[0]) {
          clips[key] = stripRootMotion(fbx.animations[0]);
        }
      })
    );

    return { baseFbx, clips };
  })();
  return _guardianAssetsPromise;
}

// ─────────────────────────────────────────────────────────────
// WEAPONS
// ─────────────────────────────────────────────────────────────
function makeBlade() {
  const group = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 1.4),
    new THREE.MeshStandardMaterial({
      color: 0xff2233, emissive: 0xff2233,
      emissiveIntensity: 3.5, metalness: 0.3, roughness: 0.2,
    })
  );
  blade.position.set(0, 0, 0.7);
  group.add(blade);
  const hilt = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.14, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
  );
  group.add(hilt);
  group.add(new THREE.PointLight(0xff2233, 4, 6, 2));
  return group;
}

function makeGauntlets() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x00ddff, emissive: 0x00ddff,
    emissiveIntensity: 3, metalness: 0.4, roughness: 0.25,
  });
  const left = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), mat);
  left.position.set(-0.5, 1.0, 0.2);
  group.add(left);
  const right = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), mat);
  right.position.set(0.5, 1.0, 0.2);
  group.add(right);
  const light = new THREE.PointLight(0x00ddff, 4, 6, 2);
  light.position.set(0, 1.0, 0.2);
  group.add(light);
  return group;
}

// ─────────────────────────────────────────────────────────────
// GUARDIAN
// ─────────────────────────────────────────────────────────────
export class Guardian extends Enemy {
  constructor(parent, position, kind = 'blade', attackGate = null, level = null) {
    super(parent, position, 'human', attackGate);

    // Set by the time _doLoadModel actually runs (next tick).
    this.kind    = kind;
    this.level   = level;
    this.spawnY  = position.y;
    this.vel     = new THREE.Vector3();
    this._chasing = false;

    const stats = GUARDIAN_STATS[kind];
    this.health              = stats.health;
    this.maxHealth           = stats.health;
    this.moveSpeed           = stats.speed;
    this.guardianDamage      = stats.damage;
    this.guardianAttackRange = stats.attackRange;
    this.guardianWindup      = stats.windup;
    this.guardianTail        = stats.tail;
    this.guardianCooldown    = stats.cooldown;

    const side = kind === 'blade' ? -1 : 1;
    this.attackOffset.set(side * 2.6, 0, 0);

    this.isGuardian = true;
    this.dead = false;
  }

  // ── Defer actual load by one tick ──
  // Enemy's constructor calls this BEFORE our constructor body runs,
  // so this.kind isn't set yet. Deferring lets us read GUARDIAN_STATS
  // safely and prevents the silent async-catch crash that was leaving
  // the guardian invisible.
  _loadModel() {
    setTimeout(() => this._doLoadModel(), 0);
  }

  // Parent Enemy also tries to load anims — we do it ourselves.
  _loadAnims() { /* no-op */ }

  async _doLoadModel() {
    const stats = GUARDIAN_STATS[this.kind];
    if (!stats) {
      console.warn('[Guardian] unknown kind:', this.kind);
      return;
    }

    const assets = await getGuardianAssets();
    if (!assets || this._disposed) return;

    // skeletonClone — the crucial part. Plain .clone(true) shares
    // the original bone hierarchy, so the SkinnedMesh renders a
    // static/wrong pose no matter what the mixer does.
    const fbx = skeletonClone(assets.baseFbx);
    fbx.scale.setScalar(0.013 * stats.scale);
    fbx.position.y = -0.13;

    fbx.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
        if (o.material) {
          o.material = Array.isArray(o.material)
            ? o.material.map((m) => m.clone())
            : o.material.clone();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if (m.color) m.color.setHex(stats.tint);
            if (m.emissive) {
              m.emissive.setHex(stats.tint);
              m.emissiveIntensity = 0.3;
            }
          });
        }
      }
    });

    this.group.add(fbx);
    this.fbx   = fbx;
    this.mixer = new THREE.AnimationMixer(fbx);

    for (const [key, clip] of Object.entries(assets.clips)) {
      if (!clip) continue;
      this.actions[key] = this.mixer.clipAction(clip);
    }

    if (this.state === STATE.IDLE) this._playAction('idle');
    this._attachWeapon();
  }

  _attachWeapon() {
    if (this.weaponMesh) return;
    const weapon = this.kind === 'blade' ? makeBlade() : makeGauntlets();
    weapon.position.set(0.6, 1.1, 0.3);
    this.group.add(weapon);
    this.weaponMesh = weapon;
  }

  // ── Smooth transitions — loops don't reset, one-shots do ──
  _playAction(name, loop = true) {
    this._desiredAction = { name, loop };
    let next = this.actions[name];
    if (!next && (name === 'attack1' || name === 'attack2'))
      next = this.actions.attack1 || this.actions.attack2;
    if (!next) return;

    if (next === this.currentAction) {
      if (loop || next.isRunning()) return;
      next.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.1).play();
      return;
    }

    if (this.currentAction) this.currentAction.fadeOut(0.18);
    if (!loop) next.reset();
    next
      .setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
      .fadeIn(0.18)
      .play();
    if (!loop) next.clampWhenFinished = true;
    this.currentAction = next;
  }

  alert() {
    if (this.alerted || this.state === STATE.DEAD || this._disposed) return;
    this.alerted = true;
    this.state   = STATE.ALERTED;
    this._playAction('idle');

    const delay = 400 + Math.random() * 700;
    setTimeout(() => {
      if (this._disposed || this.state === STATE.DEAD) return;
      this.state = STATE.WALKING;
      this._chasing = true;
      this._playAction('move');
    }, delay);
  }

  _startSwing() {
    const pick = this._lastAttack === 'attack1' ? 'attack2'
               : this._lastAttack === 'attack2' ? 'attack1'
               : (Math.random() > 0.5 ? 'attack1' : 'attack2');
    this._lastAttack = pick;
    this._playAction(pick, false);

    this.swingTimer   = this.guardianWindup;
    this.swingLanded  = false;
    this.recoverTimer = this.guardianWindup + this.guardianTail + 0.35
                      + Math.random() * 0.35;

    if (this.weaponMesh) {
      this.weaponMesh.traverse((o) => {
        if (o.isMesh && o.material && o.material.emissiveIntensity !== undefined)
          o.material.emissiveIntensity = 6;
        if (o.isLight) o.intensity = 12;
      });
      setTimeout(() => {
        if (this._disposed || !this.weaponMesh) return;
        this.weaponMesh.traverse((o) => {
          if (o.isMesh && o.material && o.material.emissiveIntensity !== undefined)
            o.material.emissiveIntensity = 3.5;
          if (o.isLight) o.intensity = 4;
        });
      }, this.guardianWindup * 1000);
    }
  }

  takeDamage(amount = 1) {
    if (this.state === STATE.DEAD || this._disposed) return false;
    this._releaseSlot();
    this.swingLanded = false;
    if (this.vel) this.vel.set(0, 0, 0);
    this.health -= amount;

    if (this.health <= 0) { this._die(); this.dead = true; return true; }

    this.state = STATE.HIT;
    this._playAction('hit', false);
    setTimeout(() => {
      if (this._disposed || this.state === STATE.DEAD) return;
      this.state = STATE.WALKING;
      this._chasing = true;
      this._playAction('move');
    }, 500);
    return false;
  }

  update(dt, playerPos) {
    if (this._disposed) return;

    if (this.mixer) this.mixer.update(dt);
    if (this.state === STATE.DEAD) return;

    const tx = playerPos.x + this.attackOffset.x;
    const tz = playerPos.z + this.attackOffset.z;
    const dx = tx - this.group.position.x;
    const dz = tz - this.group.position.z;
    if (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1) {
      this.group.rotation.y = Math.atan2(dx, dz);
    }
    const dist = Math.hypot(dx, dz);

    if (this.state === STATE.WALKING) {
      const chaseStart = this._chasing ? 2.0 : 2.6;
      if (dist > chaseStart) {
        this._chasing = true;
        const dir = new THREE.Vector3(dx, 0, dz).normalize();
        this.group.position.addScaledVector(dir, this.moveSpeed * dt);
        this._playAction('move');
      } else {
        this._chasing = false;
        if (this.recoverTimer > 0) {
          this.recoverTimer -= dt;
          this._playAction('idle');
        } else if (this.gate && this.gate.current >= this.gate.max) {
          this._playAction('idle');
        } else {
          if (this.gate) { this.gate.current++; this._holdsSlot = true; }
          this.state = STATE.ATTACKING;
          this._startSwing();
        }
      }
    } else if (this.state === STATE.ATTACKING) {
      if (dist > 3.5) {
        this._releaseSlot();
        this.swingLanded = false;
        this.state = STATE.WALKING;
        this._chasing = true;
        this._playAction('move');
      } else {
        this.swingTimer -= dt;
        if (this.swingTimer <= 0 && !this.swingLanded) this.swingLanded = true;
        this.recoverTimer -= dt;
        if (this.recoverTimer <= 0) {
          this._releaseSlot();
          if (dist <= 2.6 && (!this.gate || this.gate.current < this.gate.max)) {
            if (this.gate) { this.gate.current++; this._holdsSlot = true; }
            this._startSwing();
          } else {
            this.state = STATE.WALKING;
            this._chasing = true;
            this._playAction('move');
          }
        }
      }
    }

    // ── Gravity + ground snap ──
    this.vel.y -= GRAV * dt;
    this.group.position.y += this.vel.y * dt;

    let ground = this.spawnY;
    if (this.level && typeof this.level.getSurfaceHeight === 'function') {
      try {
        ground = this.level.getSurfaceHeight(
          this.group.position.x,
          this.group.position.z,
          this.group.position.y
        );
      } catch (e) { /* fall back to spawnY */ }
    }
    if (this.group.position.y <= ground) {
      this.group.position.y = ground;
      this.vel.y = 0;
    }

    resolveEntity(this.group.position, worldColliders, 0.45, 2.0);
    pushOutOfCircle(this.group.position, playerPos, 0.85);

    if (this.level && Array.isArray(this.level.guardians)) {
      for (const other of this.level.guardians) {
        if (other === this || other._disposed) continue;
        if (other.state === STATE.DEAD) continue;
        pushOutOfCircle(this.group.position, other.group.position, 1.4);
      }
    }
  }
}
