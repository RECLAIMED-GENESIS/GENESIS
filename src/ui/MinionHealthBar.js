// src/ui/MinionHealthBar.js
// Manages floating HP bars above minions.
// Registers entities, tracks their positions on screen each frame.

import * as THREE from 'three';

export class MinionHealthBar {
  constructor(camera) {
    this.camera = camera;
    this.bars = new Map();   // entity -> { el, fill, nameTag }

    // Global style
    const style = document.createElement('style');
    style.textContent = `
      .minion-hp-bar {
        position: fixed;
        width: 44px;
        height: 5px;
        background: rgba(0, 0, 0, 0.8);
        border: 1px solid #444;
        pointer-events: none;
        z-index: 50;
        border-radius: 2px;
        transition: opacity 0.2s;
      }
      .minion-hp-fill {
        width: 100%;
        height: 100%;
        background: #cc3333;
        border-radius: 2px;
        transition: width 0.2s;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Register an entity to track. Must have:
   *  - getPosition() -> THREE.Vector3
   *  - health, MAX_HEALTH
   *  - alive (boolean)
   */
  register(entity) {
    if (this.bars.has(entity)) return;

    const el = document.createElement('div');
    el.className = 'minion-hp-bar';

    const fill = document.createElement('div');
    fill.className = 'minion-hp-fill';

    el.appendChild(fill);
    document.body.appendChild(el);

    this.bars.set(entity, { el, fill });
  }

  unregister(entity) {
    const bar = this.bars.get(entity);
    if (!bar) return;
    bar.el.remove();
    this.bars.delete(entity);
  }

  /** Call every frame */
  update() {
    const v = new THREE.Vector3();

    for (const [entity, bar] of this.bars) {
      if (!entity.alive) {
        bar.el.style.opacity = '0';
        // Wait a bit then remove
        setTimeout(() => this.unregister(entity), 500);
        continue;
      }

      // Get entity world position (top of head)
      const pos = entity.getPosition();
      v.set(pos.x, pos.y + 2.2, pos.z);

      // Project to screen
      v.project(this.camera);

      // Behind camera? Hide.
      if (v.z > 1) {
        bar.el.style.opacity = '0';
        continue;
      }

      const x = (v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight;

      bar.el.style.left = (x - 22) + 'px';
      bar.el.style.top = y + 'px';
      bar.el.style.opacity = '1';

      // Update fill
      const pct = Math.max(0, (entity.health / entity.MAX_HEALTH) * 100);
      bar.fill.style.width = pct + '%';

      // Color by HP
      if (pct > 60) bar.fill.style.background = '#cc3333';
      else if (pct > 30) bar.fill.style.background = '#cc6633';
      else bar.fill.style.background = '#661111';
    }
  }

  /** Clear all bars (on reset/level change) */
  clear() {
    for (const [, bar] of this.bars) {
      bar.el.remove();
    }
    this.bars.clear();
  }
}