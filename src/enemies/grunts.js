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

export async function loadGruntAssets() {
  // Warm cache only once every clip has actually arrived — CACHED_CLIPS is
  // briefly an empty object between the model load and the anim loads
  if (CACHED_MODEL && CACHED_CLIPS && Object.keys(CACHED_CLIPS).length === Object.keys(ANIM_PATHS).length) {
    return {
      model: skeletonClone(CACHED_MODEL),
      clips: CACHED_CLIPS,
    };
  }
  if (!LOADING_PROMISE) {
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
  }

  await LOADING_PROMISE;
  if (!CACHED_MODEL) return null;
  return {
    model: skeletonClone(CACHED_MODEL),
    clips: CACHED_CLIPS,
  };
}

// ── Grunt instance ──
export class Grunt {
  constructor(scene, position, heightAt = null) {
    this.scene = scene;
    this.position = position.clone();
    this.heightAt = heightAt;

    this.MAX_HEALTH = 15;
    this.health = this.MAX_HEALTH;
    this.SCALE = 0.013;
    this.SPEED = 3.5;
    this.RUN_SPEED = 6.0;
    this.RUN_ENTER = 10;            // start running beyond this distance
    this.RUN_EXIT = 7;              // keep running until this close (hysteresis)
    this.ATTACK_RANGE = 1.8;
    this.ATTACK_DAMAGE = 1;
    this.ATTACK_COOLDOWN = 1.5;

    this.alive = true;
    this.attackTimer = Math.random() * 1.5;
    this.mixer = null;
    this.actions = {};
    this.currentAction = null;
    this.hitFlashTimer = 0;

    // ── State machine: chase | attack | hit | die ──
    this.state = 'chase';
    this.stateTime = 0;
    this._running = false;
    this._attackDuration = 0;
    this._attackHitTime = 0;
    this._attackDidHit = false;
    this._hitDuration = 0;

    // ── Flanking ──
    // Orbit angle is locked on first approach so each grunt takes its own
    // side of the player; slow drift keeps them circle-strafing in combat
    this.ORBIT_LOCK_DIST = 12;
    this.RING_STANDOFF = this.ATTACK_RANGE - 0.25;
    this._orbit = null;
    this._orbitDrift = 0;

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
    if (!next) return;
    if (next === this.currentAction) {
      // Looping actions can keep playing; one-shots must restart from frame 0
      if (loop) return;
      next.reset().play();
      return;
    }
    if (this.currentAction) this.currentAction.fadeOut(0.15);
    next.reset()
      .setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
      .fadeIn(0.15).play();
    if (!loop) next.clampWhenFinished = true;
    this.currentAction = next;
  }

  update(delta, playerPos, onDamagePlayer) {
    this.mixer?.update(delta);
    if (!this.alive) return;

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) this._restoreColor();
    }

    const toPlayer = new THREE.Vector3(
      playerPos.x - this.position.x, 0, playerPos.z - this.position.z
    );
    const distance = toPlayer.length();
    toPlayer.normalize();

    if (this.state !== 'attack') {
      this._group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    }

    this.stateTime += delta;
    this.attackTimer -= delta;

    if (this.state === 'attack') {
      this._updateAttack(distance, onDamagePlayer);
    } else if (this.state === 'hit') {
      if (this.stateTime >= this._hitDuration) this._enterChase();
    } else {
      this._updateChase(delta, playerPos, toPlayer, distance);
    }

    // Keep feet on the terrain — grunts travel over slopes and would
    // otherwise stay frozen at their spawn height
    if (this.heightAt) this.position.y = this.heightAt(this.position.x, this.position.z);
    this._group.position.copy(this.position);
  }

  _enterChase() {
    this.state = 'chase';
    this.stateTime = 0;
  }

  _enterAttack() {
    const kind = Math.random() < 0.5 ? 'punch' : 'kick';
    const action = this.actions[kind];
    if (!action) {
      // Anim not loaded yet — retry shortly instead of swinging blind
      this.attackTimer = 0.5;
      return;
    }
    this.state = 'attack';
    this.stateTime = 0;
    this._attackDuration = action.getClip().duration;
    this._attackHitTime = this._attackDuration * 0.4;  // damage lands mid-swing
    this._attackDidHit = false;
    this.attackTimer = this.ATTACK_COOLDOWN;
    this._playAction(kind, false);
  }

  _updateAttack(distance, onDamagePlayer) {
    if (
      !this._attackDidHit &&
      this.stateTime >= this._attackHitTime &&
      distance < this.ATTACK_RANGE + 0.5
    ) {
      this._attackDidHit = true;
      if (onDamagePlayer) onDamagePlayer(this.ATTACK_DAMAGE);
    }
    if (this.stateTime >= this._attackDuration + 0.15) this._enterChase();
  }

  _enterHit() {
    this.state = 'hit';
    this.stateTime = 0;
    const action = this.actions.hit;
    if (action) {
      this._hitDuration = Math.min(action.getClip().duration, 0.45);
      this._playAction('hit', false);
    } else {
      this._hitDuration = 0.25;
    }
  }

  _updateChase(delta, playerPos, toPlayer, distance) {
    if (distance < this.ATTACK_RANGE && this.attackTimer <= 0) {
      this._enterAttack();
      return;
    }

    // Lock each grunt to the side it arrived from, so a pack surrounds the
    // player instead of stacking in one spot
    if (this._orbit === null && distance < this.ORBIT_LOCK_DIST) {
      this._orbit =
        Math.atan2(this.position.z - playerPos.z, this.position.x - playerPos.x) +
        (Math.random() - 0.5) * 1.2;
      this._orbitDrift = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.4);
    }

    // Head for a personal slot on a ring around the player; the slow orbit
    // drift turns that into a circle-strafe once the slot is reached
    let moveX, moveZ;
    if (this._orbit !== null) {
      this._orbit += this._orbitDrift * delta;
      const slotX = playerPos.x + Math.cos(this._orbit) * this.RING_STANDOFF;
      const slotZ = playerPos.z + Math.sin(this._orbit) * this.RING_STANDOFF;
      moveX = slotX - this.position.x;
      moveZ = slotZ - this.position.z;
      const len = Math.hypot(moveX, moveZ);
      if (len > 0.05) {
        moveX /= len;
        moveZ /= len;
      } else {
        moveX = 0;
        moveZ = 0;
      }
    } else {
      moveX = toPlayer.x;
      moveZ = toPlayer.z;
    }

    if (moveX !== 0 || moveZ !== 0) {
      if (distance > this.RUN_ENTER) this._running = true;
      else if (distance < this.RUN_EXIT) this._running = false;
      const speed = this._running ? this.RUN_SPEED : this.SPEED;
      this.position.x += moveX * speed * delta;
      this.position.z += moveZ * speed * delta;
      this._playAction(this._running ? 'run' : 'walk');
    } else {
      this._playAction('idle');
    }
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.health -= amount;
    this.hitFlashTimer = 0.12;
    this._flashColor();
    if (this.health <= 0) {
      this._die();
      return;
    }
    // Mid-swing attacks aren't interrupted by hit stagger
    if (this.state !== 'attack') this._enterHit();
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
    this.state = 'die';
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
  constructor(scene, heightAt = null) {
    this.scene = scene;
    this.heightAt = heightAt;
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
      if (this.heightAt) pos.y = this.heightAt(pos.x, pos.z);
      this.grunts.push(new Grunt(this.scene, pos, this.heightAt));
    }
    console.log(`👹 Spawned ${count} grunts`);
  }

  update(delta, playerPos, onDamagePlayer) {
    for (const g of this.grunts) g.update(delta, playerPos, onDamagePlayer);
    // Drop grunts once their corpse has been removed from the scene,
    // otherwise dead entries block wave-clear checks forever
    this.grunts = this.grunts.filter((g) => g._group.parent);
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