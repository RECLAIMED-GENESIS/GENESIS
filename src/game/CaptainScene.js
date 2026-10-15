// ============================================================
// CaptainScene.js — Captain Mabaso briefing overlay UI
// ============================================================
import { normId } from './case.js';

export class CaptainScene {
  constructor(opts) {
    this.opts = opts;
    this.open_ = false;
    this._build();
  }

  _build() {
    const root = document.createElement('div');
    root.style.cssText = `position:fixed;inset:0;display:none;background:linear-gradient(180deg,#0a0c14 0%,#05070a 100%);
      z-index:10000;font-family:"Courier New",monospace;color:#e9d9b0;pointer-events:auto`;
    root.innerHTML = `
      <div style="position:absolute;left:0;right:0;top:0;height:64%;overflow:hidden">
        <div style="position:absolute;inset:0;background:
          radial-gradient(ellipse at 50% 30%, rgba(255,180,90,.09), transparent 60%),
          radial-gradient(ellipse at 20% 90%, rgba(60,80,140,.12), transparent 55%)"></div>
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax meet"
             style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:min(440px,52vw);height:auto">
          <defs>
            <linearGradient id="capBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#2a3444"/><stop offset="1" stop-color="#151a26"/>
            </linearGradient>
          </defs>
          <ellipse cx="200" cy="298" rx="200" ry="26" fill="#0a0d14"/>
          <path d="M 130 220 Q 130 150 200 145 Q 270 150 270 220 L 280 300 L 120 300 Z" fill="url(#capBody)"/>
          <path d="M 170 150 L 200 175 L 230 150 L 220 145 L 200 160 L 180 145 Z" fill="#0e1218"/>
          <ellipse cx="200" cy="115" rx="42" ry="50" fill="#3d3227"/>
          <path d="M 158 108 Q 158 62 200 58 Q 242 62 242 108 Q 238 90 200 86 Q 162 90 158 108 Z" fill="#151210"/>
          <path d="M 156 118 Q 154 140 162 150 Q 158 132 160 118 Z" fill="#151210"/>
          <path d="M 244 118 Q 246 140 238 150 Q 242 132 240 118 Z" fill="#151210"/>
          <rect x="178" y="112" width="14" height="3" fill="#0e0a06"/>
          <rect x="208" y="112" width="14" height="3" fill="#0e0a06"/>
          <path d="M 186 142 Q 200 146 214 142" stroke="#1a120a" stroke-width="2" fill="none"/>
          <path d="M 132 220 L 118 232 L 122 244 L 138 234 Z" fill="#8a6a30"/>
          <path d="M 268 220 L 282 232 L 278 244 L 262 234 Z" fill="#8a6a30"/>
        </svg>
      </div>
      <div style="position:absolute;left:0;right:0;bottom:0;padding:0 40px 40px;background:linear-gradient(180deg,transparent,#020305 30%)">
        <div style="max-width:820px;margin:0 auto">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <b style="letter-spacing:3px;color:#f2b84b" id="cap-name">CAPT. R. MABASO</b>
            <span style="font-size:12px;opacity:.75" id="cap-trust"></span>
          </div>
          <p id="cap-line" style="font-size:16px;line-height:1.6;min-height:3.4em;margin:0 0 18px"></p>
          <div id="cap-btns" style="display:flex;gap:10px;flex-wrap:wrap"></div>
          <p style="opacity:.5;font-size:11px;margin-top:14px">[Esc] back out</p>
        </div>
      </div>`;
    document.body.appendChild(root);
    this.root = root;
    this.nameEl = root.querySelector('#cap-name');
    this.trustEl = root.querySelector('#cap-trust');
    this.lineEl = root.querySelector('#cap-line');
    this.btnEl = root.querySelector('#cap-btns');
    this._onKey = (e) => { if (this.open_ && e.code === 'Escape') this.close(); };
  }

  open(suspectId) {
    this.open_ = true;
    this.suspectId = normId(suspectId);
    this.root.style.display = 'block';
    this._render();
    window.__uiCapture = true;
    if (document.exitPointerLock) document.exitPointerLock();
    document.addEventListener('keydown', this._onKey, true);
  }

  close() {
    this.open_ = false;
    this.root.style.display = 'none';
    window.__uiCapture = false;
    document.removeEventListener('keydown', this._onKey, true);
    if (this.opts.onDone) this.opts.onDone();
  }

  _render(line) {
    const s = this.opts.getSuspect(this.suspectId) || { name: 'Unknown' };
    const sum = this.opts.getSummaryFor(this.suspectId) || { kinds: [], score: 0 };
    const trust = this.opts.getTrust ? this.opts.getTrust() : 3;

    this.nameEl.textContent = `CAPT. R. MABASO — CASE #001`;
    this.trustEl.textContent = `TRUST  ${'●'.repeat(trust)}${'○'.repeat(Math.max(0,3-trust))}`;
    this.lineEl.textContent = line ||
      `"So. ${s.name}. ${sum.kinds.length ? sum.kinds.length + ' kind' + (sum.kinds.length===1?'':'s') + ' of link, score ' + sum.score.toFixed(1) + '.' : 'Nothing on the board that points at anyone.'} What do you want me to do with that?"`;
    this.btnEl.innerHTML = '';
    const mk = (label, ask) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'font:inherit;padding:10px 20px;background:#141a24;color:#e9d9b0;border:1px solid #334052;cursor:pointer';
      if (ask === 'warrant') { b.style.background = '#a1241c'; b.style.color = '#fff'; b.style.border = '0'; }
      b.addEventListener('click', () => this._ask(ask));
      this.btnEl.appendChild(b);
    };
    mk('Ask for questioning', 'questioning');
    mk('Ask for a warrant', 'warrant');
    const b = document.createElement('button');
    b.textContent = 'Back out';
    b.style.cssText = 'font:inherit;padding:10px 20px;background:transparent;color:#8b93a3;border:1px solid #334052;cursor:pointer;margin-left:auto';
    b.addEventListener('click', () => this.close());
    this.btnEl.appendChild(b);
  }

  _ask(ask) {
    const r = this.opts.applyAsk(this.suspectId, ask);
    if (r.reassigned) {
      this._render(`"That's it. I'm taking the file." She does not look up again.`);
      setTimeout(() => { this.close(); if (this.opts.onReassigned) this.opts.onReassigned(); }, 2400);
      return;
    }
    if (r.granted && r.got === 'warrant') {
      this._render(`"Now THAT is a case. Sign here." She stamps the warrant. "Stakeout at the depot is authorised. Do not lose them."`);
      setTimeout(() => this.close(), 2600);
      return;
    }
    if (r.granted && r.got === 'questioning') {
      this._render(`"I'll have them brought in. What you get out of them in the cells is on you."`);
      setTimeout(() => this.close(), 2200);
      return;
    }
    if (r.partial) {
      this._render(`"A warrant on this? Not yet. I'll have them brought in for questioning — that much the paper holds."`);
      setTimeout(() => this.close(), 2400);
      return;
    }
    this._render(`"That is not a case. That is a hobby. Come back when you have something."`);
    setTimeout(() => this.close(), 2200);
  }

  dispose() { this.close(); this.root.remove(); }
}
