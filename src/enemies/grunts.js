// src/enemies/grunts.js
// Level 1 Minions — "Grunts" (Alien Soldier)

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// Shared model cache
let CACHED_GRUNT = null;
let CACHED_GRUNT_CLIPS = null;
let LOADING_PROMISE = null;

async function loadGruntModel(loader) {
  if (CACHED_GRUNT) return { model: CACHED_GRUNT.clone(true), clips: CACHED_GRUNT_CLIPS };
  if (LOADING_PROMISE) return LOADING_PROMISE;

  LOADING_PROMISE = new Promise((resolve) => {
    loader.load('./assets/models/enemy/grunt.fbx', (fbx) => {
      CACHED_GRUNT = fbx;
      CACHED_GRUNT_CLIPS = {};

      const base = './assets/models/enemy/';
      const anims = {
        idle:  base + 'Idle.fbx',
        walk:  base + 'Mutant Walking.fbx',
        punch: base + 'Mutant_Punch.fbx',
        hit:   base + 'Reaction.fbx',
        die:   base + 'Dying.fbx'
      };

      let pending = Object.keys(anims).length;
      for (const [key, path] of Object.entries(anims)) {
        loader.load(path, (animFbx) => {
          if (animFbx.animations?.[0]) {
            CACHED_GRUNT_CLIPS[key] = stripRootMotion(animFbx.animations[0]);
          }
          if (--pending === 0) resolve({ model: CACHED_GRUNT.clone(true), clips: CACHED_GRUNT_CLIPS });
        }, undefined, () => { if (--pending === 0) resolve({ model: CACHED_GRUNT.clone(true), clips: CACHED_GRUNT_CLIPS }); });
      }
    }, undefined, (e) => {
      console.error('Grunt load failed:', e);
      resolve(null);
    });
  });

  return LOADING_PROMISE;
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

export class Grunt {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position.clone();

    this.MAX_HEALTH = 15;
    this.health = this.MAX_HEALTH;
    this.SCALE = 0.013 * 0.8;
    this.SPEED = 3.5;
    this.ATTACK_RANGE = 1.8;
    this.ATTACK_DAMAGE = 1;
    this.ATTACK_COOLDOWN = 1.5;

    this.alive = true;
    this.attackTimer = Math.random() * 1.5;
    this.isAttacking = false;
    this.mixer = null;
    this.actions = {};
    this.clips = {};
    this.model = null;
    this.currentAction = null;
    this.hitFlashTimer = 0;

    this._group = new THREE.Group();
    this._group.position.copy(this.position);
    this.scene.add(this._group);

    this._loadModel();
  }

  async _loadModel() {
    const loader = new FBXLoader();
    const result = await loadGruntModel(loader);
    if (!result) return;

    const fbx = result.model;
    fbx.scale.setScalar(this.SCALE);
    fbx.position.y = -0.13 * 0.8;

    // Tint: alien purple body, green glowing accents
    fbx.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
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

    setTimeout(() => this._playAction('idle'), 200);
  }

  _playAction(name, loop = true) {
    const next = this.actions[name];
    if (!next || next === this.currentAction) return;

    if (this.currentAction) this.currentAction.fadeOut(0.15);
    next.reset()
      .setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
      .fadeIn(0.15)
      .play();
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
      playerPos.x - this.position.x,
      0,
      playerPos.z - this.position.z
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

    if (distance > this.ATTACK_RANGE - 0.3) {
      this.position.x += toPlayer.x * this.SPEED * delta;
      this.position.z += toPlayer.z * this.SPEED * delta;
      this._playAction('walk');
    } else {
      this._playAction('idle');
    }

    this._group.position.copy(this.position);
  }

  _attack(onDamagePlayer) {
    this.isAttacking = true;
    this.attackTimer = this.ATTACK_COOLDOWN;
    this._playAction('punch', false);

    setTimeout(() => {
      if (onDamagePlayer) onDamagePlayer(this.ATTACK_DAMAGE);
      this.isAttacking = false;
      this._playAction('idle');
    }, 400);
  }

  takeDamage(amount) {
    if (!this.alive) return;

    this.health -= amount;
    this.hitFlashTimer = 0.12;
    this._flashColor();

    if (this.health <= 0) {
      this._die();
    }
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
    setTimeout(() => this.dispose(), 1200);
  }

  dispose() {
    if (this.model) {
      this.model.traverse((o) => {
        if (o.isMesh) {
          o.geometry?.dispose();
          if (Array.isArray(o.material)) {
            o.material.forEach(m => {
              if (m.map) m.map.dispose();
              if (m.normalMap) m.normalMap.dispose();
              if (m.emissiveMap) m.emissiveMap.dispose();
              if (m.roughnessMap) m.roughnessMap.dispose();
              if (m.metalnessMap) m.metalnessMap.dispose();
              m.dispose();
            });
          } else if (o.material) {
            const m = o.material;
            if (m.map) m.map.dispose();
            if (m.normalMap) m.normalMap.dispose();
            if (m.emissiveMap) m.emissiveMap.dispose();
            if (m.roughnessMap) m.roughnessMap.dispose();
            if (m.metalnessMap) m.metalnessMap.dispose();
            m.dispose();
          }
        }
      });
    }
    this.scene.remove(this._group);
    this.mixer = null;
    this.actions = {};
    this.clips = {};
  }

  getPosition() {
    return this.position.clone();
  }
}

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
    for (const g of this.grunts) {
      g.update(delta, playerPos, onDamagePlayer);
    }
    this.grunts = this.grunts.filter(g => g.alive);
  }

  killAll() {
    for (const g of this.grunts) {
      g._die();
    }
    this.grunts = [];
  }

  getAlive() {
    return this.grunts.filter(g => g.alive);
  }

  checkHit(attackerPos, range, damage) {
    for (const g of this.grunts) {
      if (!g.alive) continue;
      const d = g.position.distanceTo(attackerPos);
      if (d < range) {
        g.takeDamage(damage);
        return g;
      }
    }
    return null;
  }

  get count() {
    return this.grunts.length;
  }
}