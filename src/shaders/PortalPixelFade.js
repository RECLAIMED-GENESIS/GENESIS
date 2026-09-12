import * as THREE from 'three'

/**
 * Task 3 - Portal Pixelation Fade.
 *
 * Drives a PixelationEffect so the world smoothly transitions from
 * pixel art to a clear image as the player approaches (and activates)
 * the portal. It does this by:
 *   - shrinking the blocky pixel size (uPixelSize) toward a minimum, and
 *   - raising uFade from 0 (pixel art) to 1 (clear).
 *
 * The transition progress is derived from the player-to-portal distance
 * and then DAMPED over time so it is always smooth, never a snap.
 *
 * This class is intentionally decoupled from the game: pass in any two
 * positions (THREE.Vector3-like with .distanceTo) each frame.
 */
export class PortalPixelFade {
  /**
   * @param {import('./PixelationPass.js').PixelationEffect} effect
   * @param {object} [options]
   * @param {number} [options.basePixelSize=8] pixel size far from the portal
   * @param {number} [options.minPixelSize=1] pixel size when fully clear
   * @param {number} [options.fadeStart=10]   distance where fading begins
   * @param {number} [options.fadeEnd=3]      distance where it is fully clear
   * @param {number} [options.smoothing=4]    damping rate (higher = snappier)
   */
  constructor(effect, options = {}) {
    this.effect = effect
    this.basePixelSize = options.basePixelSize ?? 8
    this.minPixelSize = options.minPixelSize ?? 1
    this.fadeStart = options.fadeStart ?? 10
    this.fadeEnd = options.fadeEnd ?? 3
    this.smoothing = options.smoothing ?? 4

    // 0 = pixel art, 1 = clear. Animated toward the distance-based target.
    this.progress = 0
    this.activated = false

    this._apply()
  }

  /** Change the chunkiest pixel size (used when far from the portal). */
  setBasePixelSize(pixelSize) {
    this.basePixelSize = pixelSize
    this._apply()
  }

  /** Force the full transition - e.g. the moment the portal switches on. */
  activate() {
    this.activated = true
  }

  /** Return to the pixel-art state (player backed off / portal closed). */
  reset() {
    this.activated = false
    this.progress = 0
    this._apply()
  }

  /**
   * Advance the fade one frame.
   * @param {THREE.Vector3} playerPos
   * @param {THREE.Vector3} portalPos
   * @param {number} delta seconds since last frame
   * @returns {number} the smoothed progress (0..1)
   */
  update(playerPos, portalPos, delta) {
    let target = 0

    if (this.activated) {
      // Portal is on: transition all the way to clear.
      target = 1
    } else if (playerPos && portalPos) {
      const dist = playerPos.distanceTo(portalPos)
      // 0 at fadeStart (or farther), 1 at fadeEnd (or closer).
      const span = Math.max(this.fadeStart - this.fadeEnd, 0.0001)
      target = THREE.MathUtils.clamp((this.fadeStart - dist) / span, 0, 1)
    }

    // Frame-rate independent damping toward the target.
    const t = 1 - Math.exp(-this.smoothing * delta)
    this.progress += (target - this.progress) * t

    this._apply()
    return this.progress
  }

  /** Push the current progress into the effect's uniforms. */
  _apply() {
    const p = this.progress
    const pixelSize = THREE.MathUtils.lerp(this.basePixelSize, this.minPixelSize, p)
    this.effect.setPixelSize(pixelSize)
    this.effect.setFade(p)
  }
}
