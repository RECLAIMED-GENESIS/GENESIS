// ============================================================
// architect.js — The Architect (Dreyar), seated on his throne
// The Dreyar rig ships with a RECLINED sit pose (torso ~50°
// back, legs forward), so the throne is built as a matching
// recliner: pivoting backrest, low seat, side arms.
// ============================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// ── Asset paths ────────────────────────────────────────────
const MODEL_BASE   = './assets/models/enemy/';
const DREYAR_FILE  = 'Dreyar By M.Aure.fbx';
const SITTING_FILE = 'Male Sitting Pose.fbx';

// ── Model tunables ─────────────────────────────────────────
// Direct scale matching Sorini (main.js uses 0.013). Slightly
// larger so the Architect reads as a boss — try 0.013 for an
// exact match with the player, 0.015 for boss presence.
const DREYAR_SCALE = 0.0025;

// 0 = face +Z (toward the entrance the player walks in from).
// Try 0 first; if he faces away, use Math.PI; if sideways,
// use Math.PI / 2 or -Math.PI / 2.
const DREYAR_ROT_Y = 0;

// Pitch the model itself (rad). Leave 0 for now — the throne's
// backrest handles the recline.
const DREYAR_TILT_X = 0;

// Fine-tune his butt landing on the cushion. Positive = up.
const DREYAR_SEAT_OFFSET_Y = 0.0;

// Forward/back along Z. Positive = toward the entrance.
const DREYAR_SEAT_OFFSET_Z = 0.3;
// ───────────────────────────────────────────────────────────

// ── Throne dimensions ──────────────────────────────────────
const SEAT_Y   = 0.35;   // bottom of the cushion
const SEAT_H   = 0.22;   // cushion thickness
const SEAT_TOP = SEAT_Y + SEAT_H;   // ≈ 0.9 — where his butt lands
const SEAT_W   = 1.4;   // was 3.2 — wider for a bigger torso
const SEAT_D   = 2.2;   // was 3.2 — reclined pose has legs forward

// Backrest: pivot sits at the rear edge of the seat and tilts
// backward to match the Dreyar pose's torso angle. Radians.
// 0 = vertical, -0.6 ≈ 34° back, -0.9 ≈ 52° back (matches the pose).
const BACK_TILT   = -0.75;
const BACK_HEIGHT = 6.5;   // was 6.0

// ─────────────────────────────────────────────────────────────
// Pose retargeting (same technique enforcer.js uses)
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
    console.warn(`[Architect] pose retarget matched 0/${total} tracks`);
  } else {
    console.log(`[Architect] pose retarget matched ${kept.length}/${total} tracks`);
  }
  return clip;
}

// ─────────────────────────────────────────────────────────────
// ARCHITECT
// ─────────────────────────────────────────────────────────────
export class Architect {
  constructor(parent, position) {
    this.parent = parent;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    parent.add(this.group);

    this.model = null;
    this.mixer = null;
    this.actions = {};

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
    // Pivot sits at the rear top edge of the cushion; the mesh is
    // offset up the pivot's local Y so it extends away from the seat.
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
    const ARM_Y = SEAT_TOP + 1.2;   // was SEAT_TOP + 0.9
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

    // ── Throne lighting ──
    const spot = new THREE.PointLight(0xaaccff, 14, 30, 1.5);
    spot.position.set(0, SEAT_TOP + 6, 3);
    this.group.add(spot);

    const rim = new THREE.PointLight(0x6688ff, 6, 14, 2);
    rim.position.set(0, SEAT_TOP + 3, 4);
    this.group.add(rim);
  }

  // ── Character ─────────────────────────────────────────────
  _loadCharacter() {
    const loader = new FBXLoader();

    loader.load(encodeURI(MODEL_BASE + DREYAR_FILE), (fbx) => {
      if (this._disposed) return;

      // Direct scale — matches Sorini's load in main.js so Dreyar
      // lands at the same character height regardless of what units
      // the FBX export used internally.
      console.log('[Architect] using scale:', DREYAR_SCALE);
      fbx.scale.setScalar(DREYAR_SCALE);
      fbx.rotation.y = DREYAR_ROT_Y;
      fbx.rotation.x = DREYAR_TILT_X;

      // Pelvis on the cushion. The pose file's pelvis-offset decides
      // whether this needs the SEAT_OFFSET_Y nudge — the console log
      // below reports his scaled bbox so you can dial it in.
      fbx.position.set(0, SEAT_TOP + DREYAR_SEAT_OFFSET_Y, DREYAR_SEAT_OFFSET_Z);

      fbx.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = false;
        }
      });

      this.group.add(fbx);
      this.model = fbx;
      this.mixer = new THREE.AnimationMixer(fbx);

      this._loadSittingPose(loader, fbx);
      console.log('✅ Dreyar model loaded');
    }, undefined, (err) => {
      console.warn('⚠️ Dreyar FBX failed to load — using capsule placeholder.', err);
      this._buildPlaceholder();
    });
  }

  _loadSittingPose(loader, dreyarModel) {
    loader.load(encodeURI(MODEL_BASE + SITTING_FILE), (poseFbx) => {
      if (this._disposed) return;

      if (!poseFbx.animations || poseFbx.animations.length === 0) {
        console.warn(
          '[Architect] Male Sitting Pose.fbx has no AnimationClip. ' +
          'Re-export from Mixamo as an animation (1 frame is fine).'
        );
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

      this.actions.idle = action;
      console.log(
        '✅ Architect seated:', clip.name || '(unnamed)',
        '| tracks:', clip.tracks.length,
        '| duration:', clip.duration.toFixed(2) + 's'
      );
    }, undefined, (err) => console.warn('[Architect] sitting pose load failed:', err));
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
    this.group.add(cap);
  }

  // ── Public API ────────────────────────────────────────────
  update(dt) {
    if (this.mixer) this.mixer.update(dt);
  }

  getPosition() {
    return this.group.position.clone();
  }

  get position() {
    return this.group.position;
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
    this.group = null;
  }
}
