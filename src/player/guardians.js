// ============================================================
// guardians.js — Level 3 boss guardians
// Two tougher enemies that guard the Architect's throne room.
// Reuse the Enemy class from streetEnemies.js with modified
// stats and a glowing weapon attached to the right hand.
// ============================================================
import * as THREE from 'three';
import { Enemy, STATE } from './streetEnemies.js';

// ─────────────────────────────────────────────────────────────
// GUARDIAN STATS
// ─────────────────────────────────────────────────────────────
const GUARDIAN_STATS = {
  blade: {
    health: 20,
    damage: 15,
    speed: 6.0,
    attackRange: 2.5,
    windup: 0.45,
    tail: 0.55,
    cooldown: 1.3,
    tint: 0xcc2233,      // red
    scale: 1.1,
  },
  fist: {
    health: 30,
    damage: 25,
    speed: 3.0,
    attackRange: 3.0,
    windup: 0.85,
    tail: 0.75,
    cooldown: 1.8,
    tint: 0x2266cc,      // blue
    scale: 1.25,
  },
};

// ─────────────────────────────────────────────────────────────
// GUARDIAN WEAPON — attached to the right hand
// Blade: a thin glowing red box
// Fist: two glowing cyan spheres
// ─────────────────────────────────────────────────────────────
function makeBlade() {
  const group = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 1.4),
    new THREE.MeshStandardMaterial({
      color: 0xff2233,
      emissive: 0xff2233,
      emissiveIntensity: 3.5,
      metalness: 0.3,
      roughness: 0.2,
    })
  );
  blade.position.set(0, 0, 0.7);
  group.add(blade);
  // Hilt
  const hilt = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.14, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
  );
  group.add(hilt);
  // Point light so the blade casts glow
  const light = new THREE.PointLight(0xff2233, 4, 6, 2);
  group.add(light);
  return group;
}

function makeGauntlets() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x00ddff,
    emissive: 0x00ddff,
    emissiveIntensity: 3,
    metalness: 0.4,
    roughness: 0.25,
  });
  // Two fists — approximate hand positions
  const left = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), mat);
  left.position.set(-0.5, 1.0, 0.2);
  group.add(left);
  const right = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), mat);
  right.position.set(0.5, 1.0, 0.2);
  group.add(right);
  // A soft glow between them
  const light = new THREE.PointLight(0x00ddff, 4, 6, 2);
  light.position.set(0, 1.0, 0.2);
  group.add(light);
  return group;
}

// ─────────────────────────────────────────────────────────────
// GUARDIAN CLASS
// Wraps the Enemy class with guardian-specific tweaks
// ─────────────────────────────────────────────────────────────
export class Guardian extends Enemy {
  constructor(parent, position, kind = 'blade', attackGate = null) {
    // Call parent with 'human' type (uses human animations) but we
    // override stats right after.
    super(parent, position, 'human', attackGate);

    this.kind = kind;              // 'blade' or 'fist'
    const stats = GUARDIAN_STATS[kind];

    // Override parent stats
    this.health     = stats.health;
    this.maxHealth  = stats.health;
    this.moveSpeed  = stats.speed;
    this.guardianDamage = stats.damage;
    this.guardianAttackRange = stats.attackRange;
    this.guardianWindup = stats.windup;
    this.guardianTail = stats.tail;
    this.guardianCooldown = stats.cooldown;

    // Track for wave completion
    this.isGuardian = true;
    this.dead = false;
  }

  // Override the model loader to add a tint + weapon after the
  // base X_Bot loads. We call super._loadModel() and then hook
  // onto the load with a MutationObserver-like pattern.
  _loadModel() {
    // Reuse parent, but intercept after the model loads
    super._loadModel();

    // Watch for this.fbx to be set (it's set in the parent's load callback)
    const check = () => {
      if (this._disposed) return;
      if (this.fbx && !this._guardianDecorated) {
        this._guardianDecorated = true;
        this._applyGuardianAppearance();
      } else if (!this._guardianDecorated) {
        setTimeout(check, 100);
      }
    };
    setTimeout(check, 100);
  }

  _applyGuardianAppearance() {
    const stats = GUARDIAN_STATS[this.kind];

    // Tint the mesh
    this.fbx.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (m.color) m.color.setHex(stats.tint);
          if (m.emissive) {
            m.emissive.setHex(stats.tint);
            m.emissiveIntensity = 0.3;
          }
        });
      }
    });

    // Scale up
    this.fbx.scale.multiplyScalar(stats.scale);

    // Attach weapon
    const weapon = this.kind === 'blade' ? makeBlade() : makeGauntlets();
    // Attach to group at roughly hand height — simpler than
    // finding the bone, and reads fine at gameplay distance.
    weapon.position.set(0.6, 1.1, 0.3);
    this.group.add(weapon);
    this.weaponMesh = weapon;
  }

  // Override swing to use guardian stats
  _startSwing() {
    const pick = this._lastAttack === 'attack1' ? 'attack2'
               : this._lastAttack === 'attack2' ? 'attack1'
               : (Math.random() > 0.5 ? 'attack1' : 'attack2');
    this._lastAttack = pick;
    this._playAction(pick, false);

    this.swingTimer   = this.guardianWindup;
    this.swingLanded  = false;
    this.recoverTimer = this.guardianWindup + this.guardianTail + Math.random() * 0.4;

    // Flash the weapon brighter during windup
    if (this.weaponMesh) {
      this.weaponMesh.traverse((o) => {
        if (o.isMesh && o.material && o.material.emissiveIntensity !== undefined) {
          o.material.emissiveIntensity = 6;
        }
        if (o.isLight) o.intensity = 12;
      });
      setTimeout(() => {
        if (this._disposed || !this.weaponMesh) return;
        this.weaponMesh.traverse((o) => {
          if (o.isMesh && o.material && o.material.emissiveIntensity !== undefined) {
            o.material.emissiveIntensity = 3.5;
          }
          if (o.isLight) o.intensity = 4;
        });
      }, this.guardianWindup * 1000);
    }
  }

  // Override takeDamage to prevent any enemy from taking over
  // its health — guardians use the guardian damage numbers.
  takeDamage() {
    if (this.state === STATE.DEAD || this._disposed) return false;
    this._releaseSlot();
    this.swingLanded = false;
    this.velocity && this.velocity.set(0, 0, 0);
    this.health--;
    if (this.health <= 0) { this._die(); this.dead = true; return true; }

    this.state = STATE.HIT;
    this._playAction('hit', false);
    setTimeout(() => {
      if (this._disposed || this.state === STATE.DEAD) return;
      this.state = STATE.WALKING;
      this._playAction('move');
    }, 500);
    return false;
  }
}