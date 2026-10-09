// src/enemies/enforcer.js
// Level 2 Boss — "The Enforcer"
// Uses enforcer.fbx (Jones character from Mixamo) with a mixed strike
// set — jabs, cross, kicks — plus head/stomach hit reactions.

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
    this.ATTACK_RANGE = 2.2;
    this.ATTACK_DAMAGE = 3;             // harder hits
    this.ATTACK_COOLDOWN = 1.8;
    this.CHARGE_COOLDOWN = 6.0;
    this.ROAR_COOLDOWN = 12.0;

    // State
    this.alive = true;
    // Pre-combat: until activate() is called the Enforcer only stalks
    // toward the player — no attacks, charges, roars or minion summons.
    this.activated = false;
    this.APPROACH_SPEED = 3.0;
    this.APPROACH_STOP = 4.0;
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

    // Fight pacing
    this._combo = null;       // current strike chain
    this._comboIndex = 0;
    this._flinchTimer = 0;    // min gap between hit-reaction flinches
    this._flinching = false;  // riding out a hit reaction right now
    this._playerPos = null;   // last known player position (per-frame)

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
        die:   base + 'enforcer_dying.fbx',
        // Hit reactions — two impact points, picked at random on damage
        hit_head:    base + 'enforcer_head_hit.fbx',
        hit_stomach: base + 'enforcer_stomach_hit.fbx',
        // Attack set — varied strikes so the fight never loops one move
        punch_left:  base + 'enforcer_left_punch.fbx',
        punch_right: base + 'enforcer_right_punch.fbx',
        punch_cross: base + 'enforcer_cross_punch.fbx',
        punch_elbow: base + 'enforcer_elbow_punch.fbx',
        kick:        base + 'enforcer_kick.fbx',
        // Phase-2+ special (replaces the removed roar clip)
        roundhouse:  base + 'enforcer_roundhouse_kick.fbx'
      };

      for (const [key, path] of Object.entries(animPaths)) {
        fbxLoader.load(path, (animFbx) => {
          if (animFbx.animations?.[0]) {
                        const clip = stripRootMotion(
              remapClipTracks(animFbx.animations[0], model, 'enforcer/' + key)
            );
            this.clips[key] = clip;
            this.actions[key] = this.mixer.clipAction(clip);
          }
        }, undefined, (e) => console.warn(`Enforcer anim failed: ${key}`, e));
      }

      setTimeout(() => this._playAction('idle'), 500);
    }, undefined, (e) => console.error('Enforcer.fbx load failed:', e));
  }

  _playAction(name, loop = true) {
      // Once dead, lock to the death animation — nothing else can override
    if (!this.alive && name !== 'die') return;
    
  
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

  // Pick a random clip from a set of action keys, skipping any whose
  // FBX hasn't finished loading (or failed) — null if none are ready.
  _randomKey(names) {
    const available = names.filter(k => this.actions[k]);
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  // Duration of an action's clip in ms, with a fallback for clips that
  // are still downloading so one-shot timing degrades to the old fixed
  // values instead of firing instantly.
  _clipMs(name, fallbackMs) {
    const clip = this.actions[name]?.getClip();
    return (clip ? clip.duration : 0) * 1000 || fallbackMs;
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

    this._playerPos = playerPos;
    this._flinchTimer = Math.max(0, this._flinchTimer - delta);

    const toPlayer = new THREE.Vector3(
      playerPos.x - this.position.x,
      0,
      playerPos.z - this.position.z
    );
    const distance = toPlayer.length();
    toPlayer.normalize();

    if (!this.isCharging && !this.isAttacking && !this.isRoaring &&
        !this._flinching) {
      this._group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    }

    // Pre-combat — while the intro dialogue plays she only walks toward
    // the player. Combat AI stays asleep until activate() is called.
    if (!this.activated) {
      this._updateApproach(delta, toPlayer, distance);
      this._group.position.set(this.position.x, this.position.y, this.position.z);
      return;
    }

    if (this.isCharging) {
      this._updateCharge(delta, distance);
    } else if (this.isAttacking) {
      this._updateAttack(delta, distance);
    } else if (this._flinching) {
      // ride out the hit reaction before resuming the chase
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

    // Called when the intro dialogue ends — switches the Enforcer from her
    // pre-combat stalk into the full combat AI.
    activate() {
      this.activated = true;
    }
    
    // Pre-combat stalk: slow, menacing walk toward the player, stopping at
    // a conversational distance. No attacks, charges, roars or minions.
    _updateApproach(delta, toPlayer, distance) {
      if (distance > this.APPROACH_STOP) {
        this.position.x += toPlayer.x * this.APPROACH_SPEED * delta;
        this.position.z += toPlayer.z * this.APPROACH_SPEED * delta;
        this._playAction('walk');
      } else {
        this._playAction('idle');
      }
    }
    
    _startAttack() {
    this.isAttacking = true;
    this.attackTimer = this.ATTACK_COOLDOWN;
    this._combo = this._pickCombo();
    this._comboIndex = 0;
    this._attackDidHit = false;
    this._playComboStrike();
  }

  // Play one strike of the combo, then chain straight into the next one
  // with no idle in between — only a short recovery after the LAST strike.
  _playComboStrike() {
    if (!this.alive) { this.isAttacking = false; return; }

    const key = this._combo[this._comboIndex];

    // Re-face the player at the start of each strike so strafing
    // mid-combo doesn't leave him whiffing over their shoulder
    if (this._playerPos) {
      const dx = this._playerPos.x - this.position.x;
      const dz = this._playerPos.z - this.position.z;
      if (dx || dz) this._group.rotation.y = Math.atan2(dx, dz);
    }

    this._playAction(key, false);
    const durMs = this._clipMs(key, 700);

    setTimeout(() => {
      if (!this.alive || !this.isAttacking) return;
      this._comboIndex++;
      if (this._comboIndex < this._combo.length) {
        this._attackDidHit = false;   // each strike lands on its own
        this._playComboStrike();
      } else {
        setTimeout(() => {            // brief recovery between combos
          if (!this.alive) return;
          this.isAttacking = false;
          this._playAction('idle');
        }, this._recoveryMs());
      }
    }, durMs);
  }

  // Curated chains — kicks show up from the opening bell, and bigger
  // kick-heavy combos unlock as the fight escalates.
  _pickCombo() {
    const basic = [
      ['punch_left', 'punch_right'],
      ['punch_cross', 'punch_left'],
      ['punch_elbow', 'punch_right'],
      ['punch_left', 'kick'],
    ];
    const heavy = [
      ['punch_left', 'punch_right', 'punch_cross'],
      ['punch_cross', 'punch_elbow'],
      ['punch_left', 'punch_right', 'kick'],
      ['punch_elbow', 'punch_left', 'kick'],
      ['kick', 'punch_cross'],
    ];
    const pool = this.phase >= 2 ? basic.concat(heavy) : basic;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Recovery between combos shrinks as he loses health — phase 3 barely
  // pauses before coming back in.
  _recoveryMs() {
    if (this.phase >= 3) return 350;
    if (this.phase === 2) return 600;
    return 900;
  }

  _updateAttack(delta, distance) {
    if (!this._attackDidHit && distance < this.ATTACK_RANGE) {
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
    // The old roar clip is gone — the phase special is now a spinning
    // roundhouse kick, timed to the clip instead of a fixed 1.5 s.
    const key = this.actions.roundhouse ? 'roundhouse' : null;
    this._playAction(key, false);

    if (this.callbacks.onRoar) this.callbacks.onRoar();

    setTimeout(() => {
      this.isRoaring = false;
      this._playAction('idle');
    }, this._clipMs(key, 1500));
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

    // Poise: he fights THROUGH damage — reactions only land between
    // combos and never more often than the flinch cooldown, so player
    // pressure never fully staggers him into passivity.
    if (!this.isCharging && !this.isAttacking && !this.isRoaring &&
        !this._flinching && this._flinchTimer <= 0) {
      const hitKey = this._randomKey(['hit_head', 'hit_stomach']);
      if (hitKey) {
        this._playAction(hitKey, false);
        const recoverMs = Math.max(400, this._clipMs(hitKey, 400) * 0.8);
        this._flinching = true;
        this._flinchTimer = recoverMs / 1000 + 0.4;
        setTimeout(() => {
          this._flinching = false;
          if (this.alive) this._playAction('idle');
        }, recoverMs);
      }
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
    this.isAttacking = false;
    this._flinching = false;
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
