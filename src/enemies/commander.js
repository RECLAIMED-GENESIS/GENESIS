// src/enemies/commander.js
// The Warden — Level 1 Boss
// Uses X_Bot.fbx scaled up, dark red + gold accents

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// Root motion stripper (same technique as Sorini's main.js)
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

export class Commander {
  /**
   * @param {THREE.Scene} scene - Scene to add commander to
   * @param {THREE.Vector3} position - Spawn position
   * @param {Object} callbacks - { onMinionSpawn(threshold), onDeath() }
   */
  constructor(scene, position, callbacks = {}) {
    this.scene = scene;
    this.position = position.clone();
    this.callbacks = callbacks;

    // ── Config ──
    this.MAX_HEALTH = 100;
    this.health = this.MAX_HEALTH;
    this.SCALE = 0.013 * 2.0;      // 2× normal character size
    this.SPEED = 2.0;               // slow chase
    this.CHARGE_SPEED = 8.0;        // dash speed
    this.ATTACK_RANGE = 2.5;
    this.ATTACK_DAMAGE = 2;
    this.ATTACK_COOLDOWN = 1.8;
    this.CHARGE_COOLDOWN = 6.0;
    this.ROAR_COOLDOWN = 12.0;

    // ── State ──
    this.alive = true;
    this.phase = 1;                 // 1: 100-50%, 2: 50-25%, 3: 25-0%
    this.attackTimer = 0;
    this.chargeTimer = 4.0;         // first charge after 4s
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

    // Minion spawn thresholds (HP percentages)
   this.spawnThresholds = [
  { pct: 0.75, spawned: false, count: 2 },
  { pct: 0.50, spawned: false, count: 2 },
  { pct: 0.25, spawned: false, count: 3 }
];

    this._group = new THREE.Group();
    this._group.position.copy(this.position);
    this.scene.add(this._group);

    this._loadModel();
  }

  // ─────────────────────────────────────────
  // MODEL LOADING
  // ─────────────────────────────────────────
  _loadModel() {
    const loader = new FBXLoader();

    loader.load('./assets/models/enemy/X_Bot.fbx', (fbx) => {
      // Scale + position
      fbx.scale.setScalar(this.SCALE);
      fbx.position.y = -0.13 * 2.0;  // matches player offset but scaled

      // Tint: dark red body + gold accents
      fbx.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;

          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((mat) => {
              if (mat.color) {
                // Dark red body
                mat.color.setHex(0x661111);

                // Gold emissive accent
                if (mat.emissive) {
                  mat.emissive.setHex(0x442200);
                  mat.emissiveIntensity = 0.3;
                }
              }
            });
          }
        }
      });

      this._group.add(fbx);
      this.model = fbx;

      // Animation mixer
      this.mixer = new THREE.AnimationMixer(fbx);

      // Load all needed animations
      const base = './assets/models/enemy/';
      const animPaths = {
        idle:      base + 'Idle.fbx',
        walk:      base + 'Mutant Walking.fbx',
        run:       base + 'Running.fbx',
        punch:     base + 'Mutant_Punch.fbx',
        roar:      base + 'Mutant_Roaring.fbx',
        hit:       base + 'Reaction.fbx',
        die:       base + 'Dying.fbx'
      };

      for (const [key, path] of Object.entries(animPaths)) {
        loader.load(path, (animFbx) => {
          if (animFbx.animations?.[0]) {
            this.clips[key] = stripRootMotion(animFbx.animations[0]);
            this.actions[key] = this.mixer.clipAction(this.clips[key]);
          }
        }, undefined, (e) => console.warn(`Commander anim failed: ${key}`, e));
      }

      // Start idle after animations load
      setTimeout(() => this._playAction('idle'), 500);
    }, undefined, (e) => console.error('Commander X_Bot load failed:', e));
  }

  // ─────────────────────────────────────────
  // ANIMATION CONTROL
  // ─────────────────────────────────────────
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
    this._currentName = name;
  }

  // ─────────────────────────────────────────
  // UPDATE — called every frame
  // ─────────────────────────────────────────
  update(delta, playerPos) {
    if (!this.alive) return;

    this.mixer?.update(delta);

    // Update phase based on HP
    const hpPct = this.health / this.MAX_HEALTH;
    if (hpPct <= 0.5 && this.phase < 2) this.phase = 2;
    if (hpPct <= 0.25 && this.phase < 3) this.phase = 3;

    // Check minion thresholds
    this._checkMinionSpawns();

    // Hit flash timer
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0 && this.model) {
        this._restoreColor();
      }
    }

    // Face player
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

    // ── Movement / AI ──
    if (this.isCharging) {
      this._updateCharge(delta, distance);
    } else if (this.isAttacking) {
      this._updateAttack(delta, distance);
    } else if (this.isRoaring) {
      this._updateRoar(delta, distance);
    } else {
      this._updateIdleBehavior(delta, toPlayer, distance);
    }

    // Sync group position
    this._group.position.set(this.position.x, this.position.y, this.position.z);
  }

  _updateIdleBehavior(delta, toPlayer, distance) {
    // Cooldowns
    this.attackTimer -= delta;
    this.chargeTimer -= delta;
    this.roarTimer -= delta;

    // Decide action
    if (distance < this.ATTACK_RANGE && this.attackTimer <= 0) {
      this._startAttack();
      return;
    }

    if (this.phase >= 2 && this.chargeTimer <= 0 && distance > 4 && distance < 15) {
      this._startCharge(toPlayer);
      return;
    }

    if (this.phase >= 2 && this.roarTimer <= 0 && distance < 6) {
      this._startRoar();
      return;
    }

    // Chase player
    if (distance > this.ATTACK_RANGE - 0.5) {
      const speed = this.phase === 1 ? this.SPEED : this.SPEED * 1.5;
      this.position.x += toPlayer.x * speed * delta;
      this.position.z += toPlayer.z * speed * delta;
      this._playAction('walk');
    } else {
      this._playAction('idle');
    }
  }

  _startAttack() {
    this.isAttacking = true;
    this.attackTimer = this.ATTACK_COOLDOWN;
    this._playAction('punch', false);
    this._attackDidHit = false;

    // Reset after animation
    setTimeout(() => {
      this.isAttacking = false;
      this._playAction('idle');
    }, 700);
  }

  _updateAttack(delta, distance) {
    // Mid-swing hit check
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
    this.chargeTimeLeft = 0.6;  // charge lasts 0.6s
    this._playAction('run', true);

    setTimeout(() => {
      this.isCharging = false;
      this._playAction('idle');
    }, 600);
  }

  _updateCharge(delta, distance) {
    this.position.x += this.chargeDirection.x * this.CHARGE_SPEED * delta;
    this.position.z += this.chargeDirection.z * this.CHARGE_SPEED * delta;

    // Hit player during charge
    if (distance < 2.0 && !this._chargeDidHit) {
      this._chargeDidHit = true;
      if (this.callbacks.onDamagePlayer) {
        this.callbacks.onDamagePlayer(3);  // heavy damage
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

  _updateRoar(delta, distance) {
    // Roar damages player if close
  }

  // ─────────────────────────────────────────
  // MINION SPAWNING
  // ─────────────────────────────────────────
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

  // ─────────────────────────────────────────
  // COMBAT
  // ─────────────────────────────────────────
  takeDamage(amount) {
    if (!this.alive) return;

    this.health -= amount;
    this.hitFlashTimer = 0.15;
    this._flashColor();

    // Hit reaction
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
            mat.emissive.setHex(0x442200);
            mat.emissiveIntensity = 0.3;
          }
        });
      }
    });
  }

  _die() {
    this.alive = false;
    this._playAction('die', false);

    setTimeout(() => {
      if (this.callbacks.onDeath) this.callbacks.onDeath();
    }, 1500);
  }

  // ─────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────
  dispose() {
    if (this.model) {
      this.model.traverse((o) => {
        if (o.isMesh) {
          o.geometry?.dispose();
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material?.dispose();
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