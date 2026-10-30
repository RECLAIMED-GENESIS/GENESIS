// Examination is completed only after the player has inspected each feature
// and explicitly records the result. Partial coverage survives closing a view.
export class ExaminationProgress {
  constructor(features, recorded = false) {
    this.features = features; this.coverage = Object.fromEntries(features.map(id => [id, recorded ? 1 : 0]));
    this.recorded = recorded;
  }
  inspect(id, dt) {
    if (!(id in this.coverage) || !Number.isFinite(dt) || dt <= 0) return;
    this.coverage[id] = Math.min(1, this.coverage[id] + Math.min(dt, .1) / .45);
  }
  get ready() { return this.features.every(id => this.coverage[id] >= 1); }
  record() { if (!this.ready) return false; this.recorded = true; return true; }
}
