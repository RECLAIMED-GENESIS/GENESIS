// Accumulate raw pixel deltas once per frame, independent of frame rate.
export class MouseLook {
  constructor() { this.sens = 0.002; this.reset(); }
  reset() { this.x = 0; this.y = 0; }
  add(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 400 || Math.abs(y) > 400) return;
    this.x += x;
    this.y += y;
  }
  apply(player, dt) {
    player.yaw -= this.x * this.sens;
    player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch - this.y * this.sens));
    this.reset();
  }
}
