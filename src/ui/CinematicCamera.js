// src/ui/CinematicCamera.js
// Cinematic camera for dialogue sequences.
// Plays a queue of camera "shots" — position offsets + look-at targets — with
// smooth or instant transitions between them.

import * as THREE from 'three';

export class CinematicCamera {
  constructor() {
    this.active = false;
    this.shots = [];
    this.currentShotIndex = -1;
    this.shotTimer = 0;

    // Internal state for interpolating between shots
    this._fromPos = new THREE.Vector3();
    this._fromLook = new THREE.Vector3();
    this._toPos = new THREE.Vector3();
    this._toLook = new THREE.Vector3();

    // Scratch vectors
    this._targetPos = new THREE.Vector3();
    this._targetLook = new THREE.Vector3();
  }

  /**
   * Start a cinematic sequence.
   * shots = [
   *   { pos: [x,y,z], look: [x,y,z], duration: 4000, transition: 800, ease: 'in-out' }
   *   ...
   * ]
   * pos / look may instead be functions returning { x, y, z } — they are
   * re-evaluated every frame, so a shot can track a moving subject (a
   * walking enemy, the player). Optional `drift: [x,y,z]` slides the shot
   * target slowly across its duration (drift * (progress - 0.5)), keeping
   * the camera creeping even when the targets themselves are still.
   */
  play(shots) {
    this.shots = shots.slice();
    this.currentShotIndex = -1;
    this.shotTimer = 0;
    this.active = true;
    this._advanceShot(true);   // instant to first shot
  }

  stop() {
    this.active = false;
    this.shots = [];
    this.currentShotIndex = -1;
  }

  _advanceShot(instant = false) {
    this.currentShotIndex++;
    if (this.currentShotIndex >= this.shots.length) {
      this.active = false;
      return;
    }

    const shot = this.shots[this.currentShotIndex];
    this._resolve(shot.pos, this._toPos);
    this._resolve(shot.look, this._toLook);
    this.shotTimer = 0;

    if (instant || !shot.transition) {
      this._fromPos.copy(this._toPos);
      this._fromLook.copy(this._toLook);
    } else {
      this._fromPos.copy(this._targetPos);
      this._fromLook.copy(this._targetLook);
    }

    this._currentDuration = shot.duration || 4000;
    this._transitionDuration = shot.transition || 0;
    this._ease = shot.ease || 'in-out';

  }

  // Resolve a shot target. `v` may be a plain [x,y,z] array or a function
  // returning { x, y, z }. The function form is re-evaluated every frame so
  // shots can track moving subjects.
  _resolve(v, out) {
    if (typeof v === 'function') {
      const p = v();
      out.set(p.x, p.y, p.z);
    } else {
      out.set(v[0], v[1], v[2]);
    }
  }

  update(dt) {
    if (!this.active) return;

    const shot = this.shots[this.currentShotIndex];
    if (!shot) return;

    this.shotTimer += dt * 1000;

    // Re-resolve the targets every frame (they may track moving subjects)
    // and apply the optional slow `drift` across the shot.
    this._resolve(shot.pos, this._toPos);
    this._resolve(shot.look, this._toLook);
    if (shot.drift) {
      const dp = Math.min(this.shotTimer / this._currentDuration, 1) - 0.5;
      this._toPos.x += shot.drift[0] * dp;
      this._toPos.y += shot.drift[1] * dp;
      this._toPos.z += shot.drift[2] * dp;
    }

    // Interpolate toward the target if we're in the transition window
    let t = 1;
    if (this._transitionDuration > 0 && this.shotTimer < this._transitionDuration) {
      t = this.shotTimer / this._transitionDuration;
      if (this._ease === 'in-out') {
        t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      }
    }

    this._targetPos.lerpVectors(this._fromPos, this._toPos, t);
    this._targetLook.lerpVectors(this._fromLook, this._toLook, t);

    // Advance to the next shot when the duration elapses
    if (this.shotTimer >= this._currentDuration) {
      this._advanceShot(false);
    }
  }

  // Called each frame by main.js — returns {pos, look} or null
  applyTo(camera) {
    if (!this.active) return null;
    camera.position.copy(this._targetPos);
    camera.lookAt(this._targetLook);
    return { pos: this._targetPos, look: this._targetLook };
  }
}