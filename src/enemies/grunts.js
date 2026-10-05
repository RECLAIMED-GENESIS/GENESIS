// src/enemies/grunts.js
// Level 1 Minions — X_Bot variants with fresh animation set

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

// ── Root motion stripper ──
// Removes horizontal drift from Hips track so animations play in place
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

// ── Track name remapper ──
// Fixes mismatches between animation track names and model bone names
function remapClipTracks(clip, model) {
  if (!clip || !model) return clip;

  const byExact = new Map();
  const byNorm = new Map();
  model.traverse((o) => {
    if (!o.name) return;
    if (!byExact.has(o.name)) byExact.set(o.name, o.name);
    const n = o.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (!byNorm.has(n)) byNorm.set(n, o.name);
  });

  const kept = [];
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    const nodeName = track.name.slice(0, dot);
    const prop = track.name.slice(dot);
    const target =
      byExact.get(nodeName) ||
      byNorm.get(nodeName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
    if (target) {
      track.name = target + prop;
      kept.push(track);
    }
  }
  clip.tracks = kept;
  return clip;
}

// ── Shared model + clip cache ──
let CACHED_MODEL = null;
let CACHED_CLIPS = null;
let LOADING_PROMISE = null;

const MODEL_PATH = './assets/models/enemy/grunt.fbx';
const ANIM_PATHS = {
  idle:  './assets/models/enemy/grunt_idle.fbx',
  walk:  './assets/models/enemy/grunt_walk.fbx',
  run:   './assets/models/enemy/grunt_run.fbx',
  punch: './assets/models/enemy/grunt_punch.fbx',
  kick:  './assets/models/enemy/grunt_kick.fbx',
  hit:   './assets/models/enemy/grunt_hit.fbx',
  die:   './assets/models/enemy/grunt_dying.fbx',
};

async function loadGruntAssets() {
  if (CACHED_MODEL && CACHED_CLIPS) {
    return {
      model: skeletonClone(CACHED_MODEL),
      clips: CACHED_CLIPS,
    };
  }
  if (LOADING_PROMISE) return LOADING_PROMISE;

  const loader = new FBXLoader();

  LOADING_PROMISE = new Promise((resolve) => {
    loader.load(MODEL_PATH, (fbx) => {
      CACHED_MODEL = fbx;
      CACHED_CLIPS = {};

      let pending = Object.keys(ANIM_PATHS).length;
      const done = () => { if (--pending === 0) resolve(); };

      for (const [key, path] of Object.entries(ANIM_PATHS)) {
        loader.load(path, (animFbx) => {
          if (animFbx.animations && animFbx.animations[0]) {
            let clip = animFbx.animations[0];
            clip = stripRootMotion(clip);
            clip = remapClipTracks(clip, CACHED_MODEL);
            CACHED_CLIPS[key] = clip;
          }
          done();
        }, undefined, (e) => {
          console.warn(`Grunt anim failed: ${key}`, e);
          done();
        });
      }
    }, undefined, (e) => {
      console.error('Grunt model load failed:', e);
      resolve();
    });
  });

  await LOADING_PROMISE;
  return {
    model: skeletonClone(CACHED_MODEL),
    clips: CACHED_CLIPS,
  };
}

// ── Grunt instance ──
export class Grunt {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position.clone();

    this.MAX_HEALTH = 15;
    this.health = this.MAX_HEALTH;
    this.SCALE = 0.013;
    this.SPEED = 3.5;
    this.ATTACK_RANGE = 1.8;
    this.ATTACK_DAMAGE = 1;
    this.ATTACK_COOLDOWN = 1.5;

    this.alive = true;
    this.attackTimer = Math.random() * 1.5;
    this.isAttacking = false;
    this.mixer = null;
    this.actions = {};
    this.currentAction = null;
    this.hitFlashTimer = 0;

    this._group = new THREE.Group();
    this._group.position.copy(this.position);
    this.scene.add(this._group);

    this._loadModel();
  }

  async _loadModel() {
    const result = await loadGruntAssets();
    if (!result || !result.model || !this.alive) return;

    const fbx = result.model;
    fbx.scale.setScalar(this.SCALE);
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
          mats.forEach((mat) => {
            if (mat.color) mat.color.setHex(0x4a2a6b);
            if (mat.emissive) {
              mat.emissive.setHex(0x2a4400);
              mat.emissiveIntensity = 0.4;
            }
          });
        }
      }
    });

    this._group.add(fbx);
    this.model = fbx;

    this.mixer = new THREE.AnimationMixer(fbx);
    for (const [key, clip] of Object.entries(result.clips)) {
      this.actions[key] = this.mixer.clipAction(clip);
    }

    if (this.actions.idle) {
      this.actions.idle.reset().play();
      this.currentAction = this.actions.idle;
    }
  }

  _playAction(name, loop = true) {
    const next = this.actions[name];
    if (!next || next === this.currentAction) return;
    if (this.currentAction) this.currentAction.fadeOut(0.15);
    next.reset()
      .setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
      .fadeIn(0.15).play();
    if (!loop) next.clampWhenFinished = true;
    this.currentAction = next;
  }

  update(delta, playerPos, onDamagePlayer) {
    if (!this.alive) return;
    this.mixer?.update(delta);

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) this._restoreColor();
    }

    const toPlayer = new THREE.Vector3(
      playerPos.x - this.position.x, 0, playerPos.z - this.position.z
    );
    const distance = toPlayer.length();
    toPlayer.normalize();

    if (!this.isAttacking) {
      this._group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    }

    this.attackTimer -= delta;
    if (distance < this.ATTACK_RANGE && this.attackTimer <= 0) {
      this._attack(onDamagePlayer);
      return;
    }

        if (!this.isAttacking) {
      if (distance > this.ATTACK_RANGE - 0.3) {
        this.position.x += toPlayer.x * this.SPEED * delta;
        this.position.z += toPlayer.z * this.SPEED * delta;
        this._playAction('walk');
      } else {
        this._playAction('idle');
      }
    } else {
      // Still move while attacking, but don't change animation
      this.position.x += toPlayer.x * this.SPEED * delta * 0.3;
      this.position.z += toPlayer.z * this.SPEED * delta * 0.3;
    }

    this._group.position.copy(this.position);
  }

 _attack(onDamagePlayer) {
  if (this.isAttacking) return;
  this.isAttacking = true;
  this.attackTimer = this.ATTACK_COOLDOWN;
  this._playAction('punch', false);

  // Damage lands mid-swing (punch is 1.73s, hit around 0.7s in)
  setTimeout(() => {
    if (onDamagePlayer) onDamagePlayer(this.ATTACK_DAMAGE);
  }, 700);

  // Return to idle after punch finishes (1.73s + small fade buffer)
  setTimeout(() => {
    this.isAttacking = false;
    if (this.alive) this._playAction('idle');
  }, 1800);
}

  takeDamage(amount) {
    if (!this.alive) return;
    this.health -= amount;
    this.hitFlashTimer = 0.12;
    this._flashColor();
    if (this.health <= 0) this._die();
  }

  _flashColor() {
    if (!this.model) return;
    this.model.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((mat) => {
          if (mat.emissive) {
            mat.emissive.setHex(0xff4444);
            mat.emissiveIntensity = 1.0;
          }
        });
      }
    });
  }

  _restoreColor() {
    if (!this.model) return;
    this.model.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((mat) => {
          if (mat.emissive) {
            mat.emissive.setHex(0x2a4400);
            mat.emissiveIntensity = 0.4;
          }
        });
      }
    });
  }

  _die() {
    this.alive = false;
    this._playAction('die', false);
    setTimeout(() => this.dispose(), 1500);
  }

  dispose() {
    this.scene.remove(this._group);
    if (this.mixer) this.mixer.stopAllAction();
    this.mixer = null;
    this.actions = {};
  }

  getPosition() {
    return this.position.clone();
  }
}

// ── Grunt Manager ──
export class GruntManager {
  constructor(scene) {
    this.scene = scene;
    this.grunts = [];
  }

  spawnWave(centerPos, count) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 5 + Math.random() * 3;
      const pos = new THREE.Vector3(
        centerPos.x + Math.cos(angle) * radius,
        centerPos.y,
        centerPos.z + Math.sin(angle) * radius
      );
      this.grunts.push(new Grunt(this.scene, pos));
    }
    console.log(`👹 Spawned ${count} grunts`);
  }

  update(delta, playerPos, onDamagePlayer) {
    for (const g of this.grunts) g.update(delta, playerPos, onDamagePlayer);
  }

  checkHit(attackerPos, range, damage) {
    for (const g of this.grunts) {
      if (!g.alive) continue;
      const dx = g.position.x - attackerPos.x;
      const dz = g.position.z - attackerPos.z;
      if (Math.hypot(dx, dz) < range) {
        g.takeDamage(damage);
        return g;
      }
    }
    return null;
  }

  killAll() {
    for (const g of this.grunts) {
      if (g.alive) g.takeDamage(999);
    }
  }

  dispose() {
    for (const g of this.grunts) g.dispose();
    this.grunts = [];
  }
}