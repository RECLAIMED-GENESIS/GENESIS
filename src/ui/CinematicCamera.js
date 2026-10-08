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
    this._toPos.set(shot.pos[0], shot.pos[1], shot.pos[2]);
    this._toLook.set(shot.look[0], shot.look[1], shot.look[2]);
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

  update(dt) {
    if (!this.active) return;

    const shot = this.shots[this.currentShotIndex];
    if (!shot) return;

    this.shotTimer += dt * 1000;

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