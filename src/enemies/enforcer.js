// src/enemies/enforcer.js
// Level 2 Boss — "The Enforcer"
// Uses enforcer.glb (Jones character from Mixamo)

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Bone-name remap (FBX clips vs GLB skeleton)
function normalizeBoneName(name) {
  return name
    .replace(/^mixamorig:?/i, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function remapClipTracks(clip, model, label = '') {
  if (!clip || !model) return clip;
  const byExact = new Map();
  const byNorm = new Map();
  model.traverse(o => {
    if (!o.name) return;
    if (!byExact.has(o.name)) byExact.set(o.name, o.name);
    const n = normalizeBoneName(o.name);
    if (!byNorm.has(n)) byNorm.set(n, o.name);
  });
  const kept = [];
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    const nodeName = track.name.slice(0, dot);
    const prop = track.name.slice(dot);
    const target = byExact.get(nodeName) || byNorm.get(normalizeBoneName(nodeName));
    if (target) {
      track.name = target + prop;
      kept.push(track);
    }
  }
  clip.tracks = kept;
  if (kept.length === 0) console.error(`[remap] ${label}: 0/${clip.tracks.length} tracks matched`);
  return clip;
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

export class Enforcer {
  constructor(scene, position, callbacks = {}) {
    this.scene = scene;
    this.position = position.clone();
    this.callbacks = callbacks;

    // Config
    this.MAX_HEALTH = 150;              // tougher than Level 1 Warden
    this.health = this.MAX_HEALTH;
    this.SCALE = 0.018;                   // imposing size (same as Warden)
    this.SPEED = 2.5;
    this.CHARGE_SPEED = 10.0;
    this.ATTACK_RANGE = 3.0;
    this.ATTACK_DAMAGE = 3;             // harder hits
    this.ATTACK_COOLDOWN = 1.8;
    this.CHARGE_COOLDOWN = 6.0;
    this.ROAR_COOLDOWN = 12.0;

    // State
    this.alive = true;
    this.phase = 1;
    this.attackTimer = 0;
    this.chargeTimer = 4.0;
    this.roarTimer = 10.0;
    this.isCharging = false;
    this.isAttacking = false;
    this.isRoaring = false;
    this.chargeDirection = new THREE.Vector3();
    this.currentAction = null;
    this.mixer = null;
    this.actions = {};
    this.clips = {};
    this.model = null;
    this.hitFlashTimer = 0;

    // Minion spawn thresholds
    this.spawnThresholds = [
      { pct: 0.75, spawned: false, count: 3 },
      { pct: 0.50, spawned: false, count: 3 },
      { pct: 0.25, spawned: false, count: 4 }
    ];

    this._group = new THREE.Group();
    this._group.position.copy(this.position);
    this.scene.add(this._group);

    this._loadModel();
  }

    _loadModel() {
    const fbxLoader = new FBXLoader();

    fbxLoader.load('./assets/models/enemy/enforcer.fbx', (model) => {
      model.scale.setScalar(this.SCALE);
      model.position.set(0, 0, 0);

      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = false;
        }
      });

      this._group.add(model);
      this.model = model;

      this.mixer = new THREE.AnimationMixer(model);

      const base = './assets/models/enemy/';
      const animPaths = {
        idle:  base + 'enforcer_idle.fbx',
        walk:  base + 'enforcer_walk.fbx',
        run:   base + 'enforcer_run.fbx',
        punch: base + 'enforcer_punch.fbx',
        roar:  base + 'enforcer_roar.fbx',
        hit:   base + 'enforcer_hit.fbx',
        die:   base + 'enforcer_dying.fbx'
      };

      for (const [key, path] of Object.entries(animPaths)) {
        fbxLoader.load(path, (animFbx) => {
          if (animFbx.animations?.[0]) {
            const clip = stripRootMotion(animFbx.animations[0]);
            this.clips[key] = clip;
            this.actions[key] = this.mixer.clipAction(clip);
          }
        }, undefined, (e) => console.warn(`Enforcer anim failed: ${key}`, e));
      }

      setTimeout(() => this._playAction('idle'), 500);
    }, undefined, (e) => console.error('Enforcer.fbx load failed:', e));
  }

  _playAction(name, loop = true) {
    const next = this.actions[name];
    if (!next) return;
    if (next === this.currentAction) return;

    if (this.currentAction) this.currentAction.fadeOut(0.2);

    next.reset()
      .setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
      .fadeIn(0.2)
      .play();

    if (!loop) next.clampWhenFinished = true;
    this.currentAction = next;
  }

    update(delta, playerPos) {
    // Keep the mixer running even after death so the death animation plays.
    // Only the AI logic should stop when `alive` is false.
    this.mixer?.update(delta);

    if (!this.alive) return;

    const hpPct = this.health / this.MAX_HEALTH;
    if (hpPct <= 0.5 && this.phase < 2) this.phase = 2;
    if (hpPct <= 0.25 && this.phase < 3) this.phase = 3;

    this._checkMinionSpawns();

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0 && this.model) this._restoreColor();
    }

    const toPlayer = new THREE.Vector3(
      playerPos.x - this.position.x,
      0,
      playerPos.z - this.position.z
    );
    const distance = toPlayer.length();
    toPlayer.normalize();

    if (!this.isCharging && !this.isAttacking && !this.isRoaring) {
      this._group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    }

    if (this.isCharging) {
      this._updateCharge(delta, distance);
    } else if (this.isAttacking) {
      this._updateAttack(delta, distance);
    } else {
      this._updateIdleBehavior(delta, toPlayer, distance);
    }

    this._group.position.set(this.position.x, this.position.y, this.position.z);
  }

  _updateIdleBehavior(delta, toPlayer, distance) {
    this.attackTimer -= delta;
    this.chargeTimer -= delta;
    this.roarTimer -= delta;

    if (distance < this.ATTACK_RANGE && this.attackTimer <= 0) {
      this._startAttack();
      return;
    }

    if (this.phase >= 2 && this.chargeTimer <= 0 && distance > 5 && distance < 20) {
      this._startCharge(toPlayer);
      return;
    }

    if (this.phase >= 2 && this.roarTimer <= 0 && distance < 8) {
      this._startRoar();
      return;
    }

        // Chase the player — run when far, walk when close
    if (distance > this.ATTACK_RANGE - 0.5) {
      const isFar = distance > 12;              // 12+ units → run
      const baseSpeed = isFar ? this.SPEED * 2.2 : this.SPEED;
      const speed = this.phase === 1 ? baseSpeed : baseSpeed * 1.3;

      this.position.x += toPlayer.x * speed * delta;
      this.position.z += toPlayer.z * speed * delta;

      this._playAction(isFar ? 'run' : 'walk');
    } else {
      this._playAction('idle');
    }
  }

  _startAttack() {
    this.isAttacking = true;
    this.attackTimer = this.ATTACK_COOLDOWN;
    this._playAction('punch', false);
    this._attackDidHit = false;

    setTimeout(() => {
      this.isAttacking = false;
      this._playAction('idle');
    }, 700);
  }

  _updateAttack(delta, distance) {
    if (!this._attackDidHit && distance < this.ATTACK_RANGE + 0.5) {
      this._attackDidHit = true;
      if (this.callbacks.onDamagePlayer) {
        this.callbacks.onDamagePlayer(this.ATTACK_DAMAGE);
      }
    }
  }

  _startCharge(direction) {
    this.isCharging = true;
    this.chargeTimer = this.CHARGE_COOLDOWN;
    this.chargeDirection.copy(direction);
    this._chargeDidHit = false;
    this._playAction('run', true);

    setTimeout(() => {
      this.isCharging = false;
      this._playAction('idle');
    }, 600);
  }

  _updateCharge(delta, distance) {
    this.position.x += this.chargeDirection.x * this.CHARGE_SPEED * delta;
    this.position.z += this.chargeDirection.z * this.CHARGE_SPEED * delta;

    if (distance < 2.5 && !this._chargeDidHit) {
      this._chargeDidHit = true;
      if (this.callbacks.onDamagePlayer) {
        this.callbacks.onDamagePlayer(4);
      }
    }
  }

  _startRoar() {
    this.isRoaring = true;
    this.roarTimer = this.ROAR_COOLDOWN;
    this._playAction('roar', false);

    if (this.callbacks.onRoar) this.callbacks.onRoar();

    setTimeout(() => {
      this.isRoaring = false;
      this._playAction('idle');
    }, 1500);
  }

  _checkMinionSpawns() {
    const hpPct = this.health / this.MAX_HEALTH;
    for (const t of this.spawnThresholds) {
      if (!t.spawned && hpPct <= t.pct) {
        t.spawned = true;
        if (this.callbacks.onMinionSpawn) {
          this.callbacks.onMinionSpawn(t.count);
        }
      }
    }
  }

  takeDamage(amount) {
    if (!this.alive) return;

    this.health -= amount;
    this.hitFlashTimer = 0.15;
    this._flashColor();

    if (this.actions.hit && !this.isCharging) {
      this._playAction('hit', false);
      setTimeout(() => {
        if (this.alive) this._playAction('idle');
      }, 400);
    }

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
            mat.emissive.setHex(0xff6666);
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
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          }
        });
      }
    });
  }

    _die() {
    this.alive = false;
    console.log('💀 [Enforcer] _die called. Available actions:', Object.keys(this.actions));
    console.log('   die action exists?', !!this.actions.die);
    this._playAction('die', false);

    setTimeout(() => {
      if (this.callbacks.onDeath) this.callbacks.onDeath();
    }, 1500);
  }

  dispose() {
    this.scene.remove(this._group);
    this.mixer = null;
    this.actions = {};
    this.clips = {};
  }

  getPosition() {
    return this.position.clone();
  }
}
