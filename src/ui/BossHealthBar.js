// src/ui/BossHealthBar.js
// Top-of-screen boss HP bar with name plate

export class BossHealthBar {
  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'boss-health-bar';
    this.container.style.cssText = `
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      max-width: 800px;
      z-index: 80;
      pointer-events: none;
      font-family: 'Courier New', monospace;
      opacity: 0;
      transition: opacity 0.4s ease;
    `;

    this.container.innerHTML = `
      <div id="boss-name" style="
        text-align: center;
        color: #ffaa44;
        font-size: 20px;
        letter-spacing: 6px;
        text-transform: uppercase;
        text-shadow: 0 0 20px rgba(255, 170, 68, 0.7);
        margin-bottom: 8px;
        font-weight: 700;
      ">THE WARDEN</div>

      <div style="
        width: 100%;
        height: 22px;
        background: rgba(0, 0, 0, 0.85);
        border: 2px solid #661111;
        border-radius: 4px;
        overflow: hidden;
        box-shadow: 0 0 30px rgba(255, 60, 60, 0.4);
      ">
        <div id="boss-hp-fill" style="
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, #ff3300, #ff9900, #ffcc44);
          transition: width 0.3s ease, background 0.3s ease;
          box-shadow: 0 0 20px rgba(255, 100, 0, 0.6);
        "></div>
      </div>

      <div id="boss-phase" style="
        text-align: center;
        color: #888;
        font-size: 11px;
        letter-spacing: 3px;
        margin-top: 6px;
      ">PHASE I</div>
    `;

    document.body.appendChild(this.container);
  }

  show() {
    this.container.style.opacity = '1';
  }

  hide() {
    this.container.style.opacity = '0';
  }

  setHealth(current, max) {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    const fill = document.getElementById('boss-hp-fill');
    if (!fill) return;

    fill.style.width = pct + '%';

    // Color changes by phase
    if (pct > 50) {
      fill.style.background = 'linear-gradient(90deg, #ff3300, #ff9900, #ffcc44)';
    } else if (pct > 25) {
      fill.style.background = 'linear-gradient(90deg, #ff2200, #ff6600)';
    } else {
      fill.style.background = 'linear-gradient(90deg, #cc0000, #ff0000)';
    }
  }

  setPhase(phase) {
    const el = document.getElementById('boss-phase');
    if (!el) return;
    const names = ['PHASE I', 'PHASE II', 'PHASE III'];
    el.textContent = names[phase - 1] || 'PHASE I';
    el.style.color = phase === 3 ? '#ff4444' : phase === 2 ? '#ffaa44' : '#888';
  }

  setName(name) {
    const el = document.getElementById('boss-name');
    if (el) el.textContent = name.toUpperCase();
  }

  dispose() {
    this.container.remove();
  }
}