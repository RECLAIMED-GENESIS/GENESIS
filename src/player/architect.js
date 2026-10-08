// ============================================================
// architect.js — The Architect (Dreyar), Level 3 final boss
//
// Phase 0 'seated'  — decorative god on his recliner throne
//                     (the Dreyar rig ships with a RECLINED sit
//                     pose, so the throne matches it).
// Phase 'rising'    — no stand-up clip exists for this rig, so
//                     he rises TELEKINETICALLY: levitates off the
//                     throne, a light flash at the apex masks the
//                     sit→stand pose swap, and he lands in front
//                     of the throne slightly larger — combat form.
// Phase 'fighting'  — 3-phase combo boss (same architecture as
//                     the Enforcer: chained strikes, poise-gated
//                     flinches, phase-scaled recovery). Wields a
//                     greatsword — the mesh is parented to the
//                     RightHand bone, so every clip grips it.
//                     Phase 3 adds evasion back-steps and a
//                     spin signature move.
// ============================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// ── Asset paths ────────────────────────────────────────────
const MODEL_BASE   = './assets/models/enemy/';
const DREYAR_FILE  = 'dreyar.fbx';
const SITTING_FILE = 'sitting_pose.fbx';

// Combat kit — user-downloaded Mixamo clips for the Dreyar rig
// ("without skin", 30 fps). The sword strikes bake a right-hand
// grip, which the procedural sword rides. Keys are ROLES, not
// bones: punch = light slash, hook = power slash, kick = hurricane
// kick, heavy = greatsword, dropkick/spin = phase signature moves.
const FIGHT_CLIPS = {
  idle:     'architect_idle.fbx',
  run:      'architect_great_sword_run.fbx',
  taunt:    'architect_standing_clap.fbx',
  punch:    'architect_stable_sword_inward_slash.fbx',
  hook:     'architect_stable_sword_outward_slash.fbx',
  kick:     'architect_hurricane_kick.fbx',
  heavy:    'architect_great_sword_attack.fbx',
  dropkick: 'architect_drop_kick.fbx',
  spin:     'architect_great_sword_high_spin_attack.fbx',
  die:      'architect_sword_death.fbx',
};

// ── Model tunables ─────────────────────────────────────────
const DREYAR_SCALE = 0.0025;   // seated — matches the throne build
const FIGHT_SCALE  = 0.0030;   // +20% "combat form" on landing

const DREYAR_ROT_Y = 0;        // face +Z — toward the entering player

// Seated pose placement on the cushion
const DREYAR_SEAT_OFFSET_Y = 0.0;
const DREYAR_SEAT_OFFSET_Z = 0.3;

// Where he lands after the rise (local to the throne group —
// roughly 1.3 m in front of the seat's front edge)
const LAND_Z = 2.4;

// ── Throne dimensions ──────────────────────────────────────
const SEAT_Y   = 0.35;   // bottom of the cushion
const SEAT_H   = 0.22;   // cushion thickness
const SEAT_TOP = SEAT_Y + SEAT_H;   // where his butt lands
const SEAT_W   = 1.4;
const SEAT_D   = 2.2;

const BACK_TILT   = -0.75;
const BACK_HEIGHT = 6.5;

// ── Combat tunables ────────────────────────────────────────
const MAX_HEALTH     = 200;
const SPEED          = 3.2;
const ATTACK_RANGE   = 3.0;   // sword reach — longer than the enforcer's fists
const ATTACK_COOLDOWN = 1.3;
const PHASE_DAMAGE   = { 1: 5, 2: 6, 3: 7 };
// Phases flip at 60% / 30% so each stage gets real screen time
const PHASE_HP       = { 2: 0.6, 3: 0.3 };

// Rise timeline (seconds)
const RISE_LIFT_END = 1.2;   // levitation up, throne lights flare
const RISE_APEX     = 1.5;   // flash + sit→stand swap + scale-up
const RISE_LAND     = 2.8;   // touches down in front of the throne
const RISE_APEX_Y   = 1.8;

// ─────────────────────────────────────────────────────────────
// Pose retargeting (same technique enforcer.js / grunts.js use)
// ─────────────────────────────────────────────────────────────
function normalizeBoneName(n) {
  return n.replace(/^mixamorig:?/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function remapClip(clip, model) {
  if (!clip || !model) return clip;
  const exact = new Map();
  const norm  = new Map();
  model.traverse((o) => {
    if (!o.name) return;
    if (!exact.has(o.name)) exact.set(o.name, o.name);
    const n = normalizeBoneName(o.name);
    if (!norm.has(n)) norm.set(n, o.name);
  });

  const total = clip.tracks.length;
  const kept = [];
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    const nodeName = track.name.slice(0, dot);
    const prop = track.name.slice(dot);
    const target = exact.get(nodeName) || norm.get(normalizeBoneName(nodeName));
    if (target) {
      track.name = target + prop;
      kept.push(track);
    }
  }
  clip.tracks = kept;
  if (kept.length === 0) {
    console.warn(`[Architect] retarget matched 0/${total} tracks`);
  }
  return clip;
}

// Removes horizontal drift from the Hips track so clips play in place
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

// ─────────────────────────────────────────────────────────────
// WEAPON — the Architect's sword, built in metres in the same
// idiom as guardians.js makeBlade. Parented to the RightHand
// bone with scale compensation, so it rides every animation.
// Icy-blue trim matching his throne's glow.
// ─────────────────────────────────────────────────────────────
function makeArchitectSword() {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({
    color: 0x1a2330, metalness: 0.85, roughness: 0.3,
  });
  const energy = new THREE.MeshStandardMaterial({
    color: 0xdff6ff, emissive: 0x66ccff, emissiveIntensity: 2.2,
    metalness: 0.3, roughness: 0.2,
  });

  // Blade — greatsword slab along +Y, glowing fuller along the edge
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.024), steel);
  blade.position.y = 0.735;
  group.add(blade);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.026, 1.15, 0.032), energy);
  edge.position.set(0.058, 0.735, 0);
  group.add(edge);

  // Crossguard, grip, pommel — grip centre (y=0) sits in the fist
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.055, 0.07), steel);
  guard.position.y = 0.13;
  group.add(guard);
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.22, 8),
    new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.7 }));
  group.add(grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 10), energy);
  pommel.position.y = -0.13;
  group.add(pommel);

  // Faint cyan glow following the blade
  group.add(new THREE.PointLight(0x66ccff, 2, 4, 2));
  return group;
}

const easeOutCubic  = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

// ─────────────────────────────────────────────────────────────
// ARCHITECT
// ─────────────────────────────────────────────────────────────
export class Architect {
  constructor(parent, position) {
    this.parent = parent;
    // Throne anchor — never moves. The character rides in a child
    // group so combat can roam him without dragging the throne.
    this.group = new THREE.Group();
    this.group.position.copy(position);
    parent.add(this.group);

    this.char = new THREE.Group();
    this.group.add(this.char);

    this.model = null;
    this.mixer = null;
    this.actions = {};

    // ── Boss state ──
    this.state = 'seated';        // seated | rising | dialogue | fighting | dying
    this.alive = true;
    this.health = MAX_HEALTH;
    this.MAX_HEALTH = MAX_HEALTH;
    this.phase = 1;
    this.isAttacking = false;
    this._flinching = false;
    this._flinchTimer = 0;
    this._dodgeCooldown = 0;
    this._playerPos = null;
    this._riseT = 0;
    this._riseFlags = {};
    this._riseCbs = null;
    this._combatCbs = null;
    this._origMats = null;

    this._disposed = false;

    this._buildThrone();
    this._loadCharacter();
  }

  // ── Recliner-style throne ─────────────────────────────────
  _buildThrone() {
    const throneMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a12, roughness: 0.35, metalness: 0.75,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xdff6ff, emissive: 0xaee5ff, emissiveIntensity: 1.6,
    });

    // ── Seat cushion (flat) ──
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(SEAT_W, SEAT_H, SEAT_D), throneMat);
    seat.position.set(0, SEAT_Y + SEAT_H / 2, 0);
    seat.castShadow = true;
    seat.receiveShadow = true;
    this.group.add(seat);

    // ── Plinth under the seat ──
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(SEAT_W - 0.4, SEAT_Y, SEAT_D - 0.2), throneMat);
    base.position.set(0, SEAT_Y / 2, 0);
    base.castShadow = true;
    this.group.add(base);

    // ── Backrest on a pivot group so it can tilt back ──
    const backPivot = new THREE.Group();
    backPivot.position.set(0, SEAT_TOP, -SEAT_D / 2 + 0.25);
    backPivot.rotation.x = BACK_TILT;
    this.group.add(backPivot);

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(SEAT_W, BACK_HEIGHT, 0.5), throneMat);
    back.position.set(0, BACK_HEIGHT / 2, 0);
    back.castShadow = true;
    backPivot.add(back);

    // Glowing trim strips running up the backrest, in the pivot
    // so they tilt with it.
    for (const side of [-1, 1]) {
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, BACK_HEIGHT, 0.6), trimMat);
      trim.position.set(side * (SEAT_W / 2 - 0.09), BACK_HEIGHT / 2, 0);
      backPivot.add(trim);
    }

    // ── Armrests — sit alongside the cushion at hand height ──
    const ARM_Y = SEAT_TOP + 1.2;
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.4, SEAT_D - 0.4), throneMat);
      arm.position.set(side * (SEAT_W / 2 - 0.175), ARM_Y, 0);
      arm.castShadow = true;
      this.group.add(arm);

      // Armrest support posts (front + back)
      for (const z of [SEAT_D / 2 - 0.5, -SEAT_D / 2 + 0.5]) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, ARM_Y - SEAT_TOP, 0.2), throneMat);
        post.position.set(side * (SEAT_W / 2 - 0.175),
                          SEAT_TOP + (ARM_Y - SEAT_TOP) / 2, z);
        this.group.add(post);
      }
    }

    // ── Throne lighting (spot ref kept — the rise flares it) ──
    this._throneSpot = new THREE.PointLight(0xaaccff, 14, 30, 1.5);
    this._throneSpot.position.set(0, SEAT_TOP + 6, 3);
    this.group.add(this._throneSpot);

    const rim = new THREE.PointLight(0x6688ff, 6, 14, 2);
    rim.position.set(0, SEAT_TOP + 3, 4);
    this.group.add(rim);

    // Rise flash — parked at intensity 0 until the apex
    this.flashLight = new THREE.PointLight(0xffffff, 0, 18, 2);
    this.flashLight.position.set(0, 1.4, 0);
    this.char.add(this.flashLight);
  }

  // ── Character ─────────────────────────────────────────────
  _loadCharacter() {
    const loader = new FBXLoader();

    loader.load(encodeURI(MODEL_BASE + DREYAR_FILE), (fbx) => {
      if (this._disposed) return;

      fbx.scale.setScalar(DREYAR_SCALE);
      fbx.rotation.y = DREYAR_ROT_Y;

      // Pelvis on the cushion (pose file's pelvis offset decides the nudge)
      fbx.position.set(0, SEAT_TOP + DREYAR_SEAT_OFFSET_Y, DREYAR_SEAT_OFFSET_Z);

      fbx.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = false;
        }
      });

      this.char.add(fbx);
      this.model = fbx;
      this.mixer = new THREE.AnimationMixer(fbx);

      this._loadSittingPose(loader, fbx);
      this._attachSword();                 // rides the RightHand bone
      this._loadFightClips(loader, fbx);   // preload the combat kit
    }, undefined, (err) => {
      console.warn('⚠️ Dreyar FBX failed to load — using capsule placeholder.', err);
      this._buildPlaceholder();
    });
  }

  _loadSittingPose(loader, dreyarModel) {
    loader.load(encodeURI(MODEL_BASE + SITTING_FILE), (poseFbx) => {
      if (this._disposed) return;

      if (!poseFbx.animations || poseFbx.animations.length === 0) {
        console.warn('[Architect] sitting_pose.fbx has no AnimationClip.');
        return;
      }

      const clip = remapClip(poseFbx.animations[0], dreyarModel);
      if (clip.tracks.length === 0) {
        console.warn('[Architect] no tracks matched — skipping pose');
        return;
      }

      const action = this.mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.reset().play();

      this.mixer.update(0);   // hold the last frame from t=0

      this.actions.sit = action;
    }, undefined, (err) => console.warn('[Architect] sitting pose load failed:', err));
  }

  // Combat kit — all clips preloaded so the fight never stalls
  _loadFightClips(loader, dreyarModel) {
    let pending = Object.keys(FIGHT_CLIPS).length;
    for (const [key, file] of Object.entries(FIGHT_CLIPS)) {
      loader.load(encodeURI(MODEL_BASE + file), (animFbx) => {
        if (this._disposed) return;
        if (animFbx.animations && animFbx.animations[0]) {
          let clip = stripRootMotion(animFbx.animations[0]);
          clip = remapClip(clip, dreyarModel);
          if (clip.tracks.length > 0) {
            this.actions[key] = this.mixer.clipAction(clip);
          }
        }
        pending--;
        if (pending === 0 && !this.actions.punch && !this.actions.kick) {
          console.warn('[Architect] no combat clips loaded — fight would be a standoff');
        }
      }, undefined, () => {
        console.warn(`[Architect] fight clip failed: ${key}`);
        pending--;
      });
    }
  }

  _buildPlaceholder() {
    const cap = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.5, 1.6, 4, 8),
      new THREE.MeshStandardMaterial({
        color: 0x2a2a3a, emissive: 0x88aaff,
        emissiveIntensity: 0.3, roughness: 0.6,
      })
    );
    cap.position.set(0, SEAT_TOP + 0.9, 0);
    this.char.add(cap);
  }

  // ── Sword — hidden until the rise materialises it in his grip ──
  _attachSword() {
    let hand = null;
    this.model.traverse((o) => {
      if (!hand && o.isBone && /RightHand/i.test(o.name)) hand = o;
    });
    if (!hand) {
      console.warn('[Architect] RightHand bone not found — sword skipped');
      return;
    }
    this.sword = makeArchitectSword();
    // Bones inherit the character's ~0.003 scale — compensate so the
    // sword's metre-based geometry renders true size in world space
    const ws = new THREE.Vector3();
    hand.getWorldScale(ws);
    this._swordComp = 1 / (ws.x || this.model.scale.x || FIGHT_SCALE);
    this.sword.scale.setScalar(0.0001);
    this.sword.visible = false;
    // Blade out of the fist — orientation tuned for Mixamo hand bones
    this.sword.rotation.set(-Math.PI / 2, 0, 0);
    this.sword.position.set(0, 0.05, 0);
    hand.add(this.sword);
  }

  // ─────────────────────────────────────────────────────────
  // THE RISE — telekinetic stand-in for a missing get-up clip
  // ─────────────────────────────────────────────────────────
  beginRise(callbacks = {}) {
    if (this.state !== 'seated' || !this.model) return;
    this.state = 'rising';
    this._riseT = 0;
    this._riseFlags = {};
    this._riseCbs = callbacks;
  }

  _updateRise(dt) {
    this._riseT += dt;
    const t = this._riseT;
    const fbx = this.model;

    // Levitate off the throne
    if (t <= RISE_LIFT_END) {
      const k = easeOutCubic(t / RISE_LIFT_END);
      fbx.position.y = SEAT_TOP + (RISE_APEX_Y - SEAT_TOP) * k;
      fbx.position.z = DREYAR_SEAT_OFFSET_Z + 0.3 * k;
      this._throneSpot.intensity = 14 + 26 * k;
      return;
    }

    // Apex (once) — flash + swap sit→stand + grow into combat form
    if (!this._riseFlags.apex) {
      this._riseFlags.apex = true;
      if (this.flashLight) this.flashLight.intensity = 60;
      if (this.sword) this.sword.visible = true;   // draws with the flash
      if (this.actions.sit && this.actions.idle) {
        this.actions.sit.fadeOut(0.35);
        this.actions.idle.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.35).play();
        this.currentAction = this.actions.idle;
      } else if (this.actions.sit) {
        // No stand clip yet — release the clamped sit so he holds the
        // rig's bind pose instead of levitating while seated
        this.actions.sit.stop();
        this.currentAction = null;
      }
      if (this._riseCbs.onFlash) this._riseCbs.onFlash();
    }

    if (t <= RISE_LAND) {
      const k = clamp01((t - RISE_LIFT_END) / (RISE_LAND - RISE_LIFT_END));
      const e = easeInOutCubic(k);
      fbx.position.y = RISE_APEX_Y * (1 - e);
      fbx.position.z = 0.6 + (LAND_Z - 0.6) * e;
      fbx.scale.setScalar(DREYAR_SCALE + (FIGHT_SCALE - DREYAR_SCALE) * k);
      if (this.flashLight) this.flashLight.intensity = 60 * (1 - k);
      this._throneSpot.intensity = 40 - 26 * k;
      // The sword assembles in his grip across the descent
      if (this.sword) {
        this.sword.scale.setScalar(Math.max(0.0001, this._swordComp * easeOutCubic(k)));
      }
      return;
    }

    // Touch down (once) — re-base onto the char group for combat
    if (!this._riseFlags.landed) {
      this._riseFlags.landed = true;
      fbx.position.set(0, 0, 0);
      fbx.scale.setScalar(FIGHT_SCALE);
      this.char.position.set(0, 0, LAND_Z);
      if (this.flashLight) this.flashLight.intensity = 0;
      this._throneSpot.intensity = 14;
      if (this.sword) this.sword.scale.setScalar(this._swordComp);
      this.state = 'dialogue';
      if (this._riseCbs.onLanded) this._riseCbs.onLanded();
    }
  }

  // ─────────────────────────────────────────────────────────
  // COMBAT — 3-phase combo boss (Enforcer architecture)
  // ─────────────────────────────────────────────────────────
  startCombat(callbacks = {}) {
    if (this.state !== 'dialogue') return;
    this._combatCbs = callbacks;
    this.state = 'fighting';
    this.attackTimer = 1.0;   // a beat before the first swing
    // Opening flourish — he's been sitting for eons
    if (this.actions.taunt) {
      this._playAction('taunt', false);
      setTimeout(() => {
        if (this.alive && this.state === 'fighting' && !this.isAttacking) {
          this._playAction('idle');
        }
      }, this._clipMs('taunt', 2000));
    }
  }

  canBeHit() {
    return this.alive && this.state === 'fighting';
  }

  _pickCombo() {
    // Sword grammar — punch = light slash, hook = power slash,
    // kick = hurricane kick, heavy = greatsword, dropkick and
    // spin are the phase-2/3 signature moves.
    const p1 = [
      ['punch', 'punch'],
      ['punch', 'kick'],
      ['kick'],
      ['punch', 'punch', 'kick'],
    ];
    const p2 = [
      ['punch', 'hook'],
      ['kick', 'heavy'],
      ['punch', 'punch', 'heavy'],
      ['dropkick'],
      ['heavy'],
    ];
    const p3 = [
      ['punch', 'kick', 'heavy'],
      ['spin'],
      ['hook', 'spin'],
      ['dropkick', 'hook'],
      ['punch', 'punch', 'kick', 'heavy'],
    ];
    const pool = this.phase === 3 ? p2.concat(p3)
               : this.phase === 2 ? p1.concat(p2)
               : p1;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _recoveryMs() {
    if (this.phase >= 3) return 400;
    if (this.phase === 2) return 600;
    return 900;
  }

  _startAttack() {
    this.isAttacking = true;
    this.attackTimer = ATTACK_COOLDOWN;
    this._combo = this._pickCombo();
    this._comboIndex = 0;
    this._playComboStrike();
  }

  _playComboStrike() {
    if (!this.alive || this.state !== 'fighting') { this.isAttacking = false; return; }
    const key = this._combo[this._comboIndex];

    // Re-face the player at the start of each strike
    if (this._playerPos) {
      const dx = this._playerPos.x - this.char.position.x;
      const dz = this._playerPos.z - this.char.position.z;
      if (dx || dz) this.char.rotation.y = Math.atan2(dx, dz);
    }

    this._playAction(key, false);
    const durMs = this._clipMs(key, 700);

    // Damage lands mid-swing if she's still in reach
    setTimeout(() => {
      if (!this.alive || !this.isAttacking || this._attackDidHit) return;
      if (this._playerPos) {
        const dist = Math.hypot(
          this._playerPos.x - this.char.position.x,
          this._playerPos.z - this.char.position.z
        );
        if (dist < ATTACK_RANGE + 0.7) {   // generous — it's a greatsword
          this._attackDidHit = true;
          if (window.__audioManager) window.__audioManager.playSfx('punch_hit');
          if (this._combatCbs && this._combatCbs.onDamagePlayer) {
            this._combatCbs.onDamagePlayer(PHASE_DAMAGE[this.phase] || 4);
          }
        }
      }
    }, durMs * 0.4);

    setTimeout(() => {
      if (!this.alive || !this.isAttacking) return;
      this._comboIndex++;
      if (this._comboIndex < this._combo.length) {
        this._attackDidHit = false;
        this._playComboStrike();
      } else {
        setTimeout(() => {
          if (!this.alive) return;
          this.isAttacking = false;
          if (this.state === 'fighting') this._playAction('idle');
        }, this._recoveryMs());
      }
    }, durMs);
  }

  takeDamage(amount) {
    if (!this.canBeHit()) return;
    this.health -= amount;
    this._flashColor();
    if (this.health <= 0) {
      this._die();
      return;
    }

    // Phase flips
    const hpPct = this.health / this.MAX_HEALTH;
    if (this.phase < 3 && hpPct <= PHASE_HP[3]) this._enterPhase(3);
    else if (this.phase < 2 && hpPct <= PHASE_HP[2]) this._enterPhase(2);

    // Poise — mid-swing and recent flinches don't stagger
    this._flinchTimer -= 0;   // decremented in update()
    if (this.isAttacking || this._flinching || this._flinchTimer > 0) return;

    // Phase 3: sometimes he evades instead of eating the hit
    if (this.phase >= 3 && this._dodgeCooldown <= 0 && Math.random() < 0.3) {
      this._rollDodge();
      return;
    }

    // Flinch
    if (this.actions.hit) {
      this._flinching = true;
      this._flinchTimer = 0.6 + this._clipMs('hit', 500) / 1000;
      this._playAction('hit', false);
      setTimeout(() => {
        this._flinching = false;
        if (this.alive && this.state === 'fighting' && !this.isAttacking) {
          this._playAction('idle');
        }
      }, this._clipMs('hit', 500));
    }
  }

  _enterPhase(phase) {
    this.phase = phase;
    if (this._combatCbs && this._combatCbs.onPhaseChange) {
      this._combatCbs.onPhaseChange(phase);
    }
    // Phase flourish — taunts while the new pace kicks in
    if (this.actions.taunt && !this.isAttacking) {
      this._playAction('taunt', false);
      setTimeout(() => {
        if (this.alive && this.state === 'fighting' && !this.isAttacking) {
          this._playAction('idle');
        }
      }, this._clipMs('taunt', 2000));
    }
  }

  _rollDodge() {
    this._dodgeCooldown = 4;
    this._flinching = true;
    this._playAction('roll', false);
    const dur = this._clipMs('roll', 600);
    // Back-step away from her (no roll clip — a hasty slide for
    // now), spread across the action's duration
    const away = this._playerPos
      ? new THREE.Vector3(
          this.char.position.x - this._playerPos.x, 0,
          this.char.position.z - this._playerPos.z
        ).normalize()
      : new THREE.Vector3(0, 0, 1);
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      setTimeout(() => {
        if (!this.alive) return;
        this.char.position.addScaledVector(away, 2.2 / steps);
      }, (dur / steps) * i);
    }
    setTimeout(() => {
      this._flinching = false;
      if (this.alive && this.state === 'fighting' && !this.isAttacking) {
        this._playAction('idle');
      }
    }, dur);
  }

  _die() {
    this.alive = false;
    this.state = 'dying';
    this.isAttacking = false;
    this._flinching = false;
    this._playAction('die', false);
    if (this._combatCbs && this._combatCbs.onDeath) {
      this._combatCbs.onDeath();
    }
  }

  _flashColor() {
    if (!this.model) return;
    if (!this._origMats) {
      this._origMats = [];
      this.model.traverse((o) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if (m.emissive) {
              this._origMats.push([m, m.emissive.getHex(), m.emissiveIntensity]);
            }
          });
        }
      });
    }
    this._origMats.forEach(([m]) => {
      m.emissive.setHex(0xff4444);
      m.emissiveIntensity = 1.0;
    });
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => this._restoreColor(), 120);
  }

  _restoreColor() {
    if (!this._origMats) return;
    this._origMats.forEach(([m, hex, intensity]) => {
      m.emissive.setHex(hex);
      m.emissiveIntensity = intensity;
    });
  }

  // ─────────────────────────────────────────────────────────
  // FRAME UPDATE
  // ─────────────────────────────────────────────────────────
  _playAction(name, loop = true) {
    const next = this.actions[name];
    if (!next) return;
    if (next === this.currentAction) {
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

  _clipMs(name, fallbackMs) {
    const a = this.actions[name];
    if (a && a.getClip()) return a.getClip().duration * 1000;
    return fallbackMs;
  }

  update(dt, playerPos) {
    if (this.mixer) this.mixer.update(dt);
    if (this._disposed) return;

    if (this.state === 'rising') {
      this._updateRise(dt);
      return;
    }

    if (this.state !== 'fighting' || !this.alive) return;

    // All combat math (chase, facing, strike range) compares the
    // player against char.position, which lives in the throne
    // group's LOCAL frame — convert the player's world position
    // once so every x/z below shares one space.
    this._playerPos = playerPos
      ? this.group.worldToLocal(playerPos.clone())
      : null;
    this._flinchTimer -= dt;
    this._dodgeCooldown -= dt;
    this.attackTimer -= dt;

    if (this._flinching || this.isAttacking) return;

    // Face the player
    if (this._playerPos) {
      const dx = this._playerPos.x - this.char.position.x;
      const dz = this._playerPos.z - this.char.position.z;
      if (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1) {
        this.char.rotation.y = Math.atan2(dx, dz);
      }
    }

    const dist = this._playerPos
      ? Math.hypot(this._playerPos.x - this.char.position.x,
                   this._playerPos.z - this.char.position.z)
      : Infinity;

    if (dist > ATTACK_RANGE) {
      // He doesn't walk — a god glides at a run
      if (this.actions.run && this._playerPos) {
        const dir = new THREE.Vector3(
          this._playerPos.x - this.char.position.x, 0,
          this._playerPos.z - this.char.position.z
        ).normalize();
        this.char.position.addScaledVector(dir, SPEED * dt);
      }
      this._playAction(this.actions.run ? 'run' : 'idle');
    } else if (this.attackTimer <= 0) {
      this._startAttack();
    } else {
      this._playAction('idle');
    }
  }

  // ── Public API ────────────────────────────────────────────
  getPosition() {
    const v = new THREE.Vector3();
    this.char.getWorldPosition(v);
    return v;
  }

  get position() {
    return this.char.position;
  }

  dispose() {
    this._disposed = true;
    if (this.mixer) {
      try { this.mixer.stopAllAction(); } catch (e) {}
      this.mixer = null;
    }
    this.actions = {};

    if (this.group && this.group.parent) this.group.parent.remove(this.group);
    if (this.group) {
      this.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
    }
    this.model = null;
    this.char = null;
    this.group = null;
  }
}
