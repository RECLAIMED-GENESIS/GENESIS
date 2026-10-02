// IntroStory.js
// Full screen picture story shown before Level 1 begins.
// Each panel has art (built in SVG, or your own image) and a few lines of text.
// Click, Space, Enter or the right arrow advances. Escape or Skip ends it.

const W = 1600;

function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function starField(count, seed, maxY) {
  const r = rng(seed);
  let out = '';
  for (let i = 0; i < count; i++) {
    out += '<circle cx="' + (r() * W).toFixed(0) + '" cy="' + (r() * maxY).toFixed(0) +
      '" r="' + (0.6 + r() * 1.5).toFixed(1) + '" fill="#ffffff" opacity="' +
      (0.3 + r() * 0.7).toFixed(2) + '"/>';
  }
  return out;
}

const svg = (inner) =>
  '<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
  inner + '</svg>';

// Built in art. Add your own images by setting panel.image in introPanels.js
export const PANEL_ART = {
  bureau: () => svg(
    '<defs>' +
    '<radialGradient id="b_bg" cx="28%" cy="40%" r="95%"><stop offset="0" stop-color="#2d2b6b"/><stop offset="1" stop-color="#05060d"/></radialGradient>' +
    '<linearGradient id="b_pl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0b074"/><stop offset="1" stop-color="#6a2a5e"/></linearGradient>' +
    '<radialGradient id="b_glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#f6e3a1" stop-opacity="0.55"/><stop offset="1" stop-color="#f6e3a1" stop-opacity="0"/></radialGradient>' +
    '</defs>' +
    '<rect width="1600" height="900" fill="url(#b_bg)"/>' +
    starField(160, 11, 900) +
    '<circle cx="1210" cy="360" r="230" fill="url(#b_pl)"/>' +
    '<ellipse cx="1210" cy="360" rx="380" ry="62" fill="none" stroke="#f7d9a8" stroke-opacity="0.55" stroke-width="10" transform="rotate(-18 1210 360)"/>' +
    '<circle cx="430" cy="470" r="260" fill="url(#b_glow)"/>' +
    '<circle cx="430" cy="470" r="150" fill="#0b0c1c" stroke="#f3d98b" stroke-width="8"/>' +
    '<circle cx="430" cy="470" r="128" fill="none" stroke="#f3d98b" stroke-opacity="0.45" stroke-width="3"/>' +
    '<polygon points="430,365 456,434 530,438 473,484 492,555 430,515 368,555 387,484 330,438 404,434" fill="#f3d98b"/>' +
    '<path d="M900 720 l70 -16 l-16 26 z" fill="#cfd6ff" opacity="0.85"/>' +
    '<path d="M1010 760 l46 -10 l-10 17 z" fill="#cfd6ff" opacity="0.6"/>' +
    '<path d="M780 690 l36 -8 l-8 13 z" fill="#cfd6ff" opacity="0.5"/>'
  ),

  village: () => svg(
    '<defs>' +
    '<linearGradient id="v_sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1f4d"/><stop offset="0.45" stop-color="#6b4a8a"/><stop offset="0.75" stop-color="#f2a65a"/><stop offset="1" stop-color="#f7c883"/></linearGradient>' +
    '<radialGradient id="v_glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff3d6" stop-opacity="0.55"/><stop offset="1" stop-color="#fff3d6" stop-opacity="0"/></radialGradient>' +
    '</defs>' +
    '<rect width="1600" height="900" fill="url(#v_sky)"/>' +
    starField(60, 5, 380) +
    '<circle cx="1120" cy="330" r="260" fill="url(#v_glow)"/>' +
    '<circle cx="1120" cy="330" r="110" fill="#fff3d6"/>' +
    '<path d="M0 640 L240 470 L420 580 L640 430 L900 600 L1120 500 L1380 610 L1600 520 L1600 900 L0 900 Z" fill="#3b3560" opacity="0.92"/>' +
    '<path d="M0 720 L200 600 L420 700 L700 570 L980 710 L1260 620 L1600 720 L1600 900 L0 900 Z" fill="#241f45"/>' +
    '<path d="M0 790 Q400 745 800 788 T1600 775 L1600 900 L0 900 Z" fill="#0f0e22"/>' +
    '<rect x="310" y="520" width="26" height="290" fill="#b3261e"/>' +
    '<rect x="510" y="520" width="26" height="290" fill="#b3261e"/>' +
    '<path d="M255 512 Q423 482 590 512 L590 540 L255 540 Z" fill="#8f1d17"/>' +
    '<rect x="300" y="584" width="246" height="20" fill="#b3261e"/>' +
    '<polygon points="900,800 940,690 980,800" fill="#0a1a16"/>' +
    '<polygon points="930,800 980,670 1030,800" fill="#0a1a16"/>' +
    '<polygon points="1500,800 1545,680 1590,800" fill="#0a1a16"/>' +
    '<rect x="1130" y="700" width="170" height="100" fill="#14112a"/>' +
    '<polygon points="1110,704 1215,640 1320,704" fill="#0c0a1c"/>' +
    '<rect x="1170" y="730" width="34" height="34" fill="#ffcf7a"/>'
  ),

  night: () => svg(
    '<defs>' +
    '<linearGradient id="n_sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070f"/><stop offset="1" stop-color="#15273d"/></linearGradient>' +
    '<radialGradient id="n_glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffcf7a" stop-opacity="0.6"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="n_msg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#7ff5e0" stop-opacity="0.4"/><stop offset="1" stop-color="#7ff5e0" stop-opacity="0"/></radialGradient>' +
    '</defs>' +
    '<rect width="1600" height="900" fill="url(#n_sky)"/>' +
    starField(150, 21, 520) +
    '<path d="M0 640 Q300 560 600 630 T1200 610 T1600 640 L1600 900 L0 900 Z" fill="#0a1220"/>' +
    '<path d="M0 760 Q400 720 800 760 T1600 750 L1600 900 L0 900 Z" fill="#060b14"/>' +
    '<polygon points="760,780 840,780 1040,900 560,900" fill="#0e1626"/>' +
    '<rect x="520" y="500" width="560" height="260" fill="#0a0e18"/>' +
    '<polygon points="430,515 800,335 1170,515 1170,535 430,535" fill="#04060b"/>' +
    '<circle cx="700" cy="610" r="190" fill="url(#n_glow)"/>' +
    '<rect x="640" y="560" width="120" height="100" fill="#ffcf7a"/>' +
    '<path d="M700 560 V660 M640 610 H760" stroke="#2a1c0c" stroke-width="6"/>' +
    '<rect x="860" y="590" width="110" height="170" fill="#111827"/>' +
    '<path d="M120 760 L130 420 M170 770 L176 360 M230 765 L236 450" stroke="#0b2018" stroke-width="12"/>' +
    '<circle cx="1355" cy="195" r="170" fill="url(#n_msg)"/>' +
    '<rect x="1260" y="130" width="190" height="130" rx="10" fill="none" stroke="#7ff5e0" stroke-width="5"/>' +
    '<polyline points="1260,134 1355,205 1450,134" fill="none" stroke="#7ff5e0" stroke-width="5"/>'
  ),

  door: () => svg(
    '<defs>' +
    '<linearGradient id="d_wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1410"/><stop offset="1" stop-color="#0a0806"/></linearGradient>' +
    '<radialGradient id="d_glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffb866" stop-opacity="0.55"/><stop offset="1" stop-color="#ffb866" stop-opacity="0"/></radialGradient>' +
    '<pattern id="d_tape" width="48" height="64" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)"><rect width="22" height="64" fill="#1a1a1a"/></pattern>' +
    '</defs>' +
    '<rect width="1600" height="900" fill="url(#d_wall)"/>' +
    '<path d="M0 150 H1600 M0 300 H1600 M0 450 H1600 M0 600 H1600 M0 750 H1600" stroke="#000000" stroke-opacity="0.25" stroke-width="3"/>' +
    '<rect x="470" y="110" width="660" height="720" fill="#2a1d14"/>' +
    '<rect x="500" y="140" width="290" height="660" fill="#cdbf9d" opacity="0.85"/>' +
    '<rect x="810" y="140" width="290" height="660" fill="#cdbf9d" opacity="0.85"/>' +
    '<path d="M645 140 V800 M955 140 V800 M500 360 H790 M500 580 H790 M810 360 H1100 M810 580 H1100" stroke="#5b4630" stroke-width="8"/>' +
    '<g transform="rotate(-14 800 470)"><rect x="250" y="438" width="1100" height="64" fill="#e6b800"/><rect x="250" y="438" width="1100" height="64" fill="url(#d_tape)"/></g>' +
    '<g transform="rotate(11 800 600)"><rect x="250" y="568" width="1100" height="64" fill="#e6b800"/><rect x="250" y="568" width="1100" height="64" fill="url(#d_tape)"/></g>' +
    '<circle cx="250" cy="330" r="200" fill="url(#d_glow)"/>' +
    '<path d="M250 110 V250" stroke="#000" stroke-width="5"/>' +
    '<rect x="215" y="250" width="70" height="110" rx="10" fill="#7a2a14"/>' +
    '<rect x="230" y="268" width="40" height="74" rx="6" fill="#ffcf7a"/>'
  ),

  hall: () => svg(
    '<defs>' +
    '<radialGradient id="h_glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffcc7a" stop-opacity="0.75"/><stop offset="1" stop-color="#ffcc7a" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="h_floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a4628"/><stop offset="1" stop-color="#1e170d"/></linearGradient>' +
    '</defs>' +
    '<rect width="1600" height="900" fill="#0c0a10"/>' +
    '<polygon points="0,0 1600,0 980,330 620,330" fill="#0d0b09"/>' +
    '<polygon points="0,0 620,330 620,530 0,900" fill="#1a1510"/>' +
    '<polygon points="1600,0 980,330 980,530 1600,900" fill="#16120d"/>' +
    '<polygon points="0,900 1600,900 980,530 620,530" fill="url(#h_floor)"/>' +
    '<rect x="620" y="330" width="360" height="200" fill="#ffcc7a" opacity="0.9"/>' +
    '<circle cx="800" cy="430" r="420" fill="url(#h_glow)"/>' +
    '<rect x="620" y="330" width="360" height="200" fill="none" stroke="#2a1c10" stroke-width="14"/>' +
    '<rect x="735" y="468" width="130" height="22" fill="#1a0f09"/>' +
    '<path d="M745 490 V524 M855 490 V524" stroke="#1a0f09" stroke-width="8"/>' +
    '<path d="M800 530 L200 900 M800 530 L500 900 M800 530 L800 900 M800 530 L1100 900 M800 530 L1400 900" stroke="#000000" stroke-opacity="0.35" stroke-width="3"/>' +
    '<polygon points="700,530 900,530 1060,900 540,900" fill="#ffcc7a" opacity="0.12"/>'
  ),
};

const CSS = `
.is-root{position:fixed;inset:0;z-index:1000;background:#05060c;color:#ece6d6;font-family:Georgia,'Times New Roman',serif;display:flex;flex-direction:column;opacity:1;transition:opacity .8s ease;user-select:none;cursor:pointer;}
.is-root.is-out{opacity:0;pointer-events:none;}
.is-bar{height:5vh;background:#000;flex:0 0 auto;}
.is-stage{position:relative;flex:1 1 auto;overflow:hidden;background:#000;}
.is-art{position:absolute;inset:0;opacity:0;transition:opacity .9s ease;overflow:hidden;}
.is-art.is-on{opacity:1;}
.is-inner{position:absolute;inset:-4%;width:108%;height:108%;}
.is-art.is-on .is-inner{animation:isKen 18s ease-out forwards;}
.is-inner svg,.is-inner img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
@keyframes isKen{from{transform:scale(1) translate(0,0);}to{transform:scale(1.07) translate(-1.2%,-.8%);}}
.is-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,.7) 100%);}
.is-skip{position:absolute;top:16px;right:18px;background:rgba(0,0,0,.45);color:#cfc8b6;border:1px solid rgba(255,255,255,.25);border-radius:4px;padding:6px 14px;font:13px Georgia,serif;letter-spacing:.08em;cursor:pointer;}
.is-skip:hover{background:rgba(255,255,255,.15);color:#fff;}
.is-caption{flex:0 0 auto;min-height:27vh;padding:2.2vh 8vw 1.6vh;background:linear-gradient(#000,#07080f);border-top:1px solid rgba(243,217,139,.35);display:flex;flex-direction:column;gap:1.2vh;}
.is-label{font-size:clamp(11px,1.5vh,14px);letter-spacing:.32em;color:#f3d98b;text-transform:uppercase;}
.is-text{font-size:clamp(17px,2.9vh,28px);line-height:1.55;white-space:pre-wrap;min-height:5.2em;}
.is-note{font-size:clamp(12px,1.7vh,16px);color:#9fd9cf;letter-spacing:.06em;white-space:pre-wrap;min-height:1.2em;}
.is-foot{display:flex;justify-content:space-between;align-items:center;margin-top:auto;}
.is-dots{display:flex;gap:9px;}
.is-dot{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.2);transition:background .3s;}
.is-dot.is-cur{background:#f3d98b;}
.is-dot.is-done{background:rgba(243,217,139,.5);}
.is-hint{font-size:clamp(11px,1.5vh,13px);letter-spacing:.14em;color:#8d8878;text-transform:uppercase;animation:isBlink 2.4s ease-in-out infinite;}
@keyframes isBlink{0%,100%{opacity:.4;}50%{opacity:1;}}
@media (prefers-reduced-motion:reduce){.is-art.is-on .is-inner{animation:none;}.is-hint{animation:none;}}
`;

function injectStyle() {
  if (document.getElementById('intro-story-style')) return;
  const el = document.createElement('style');
  el.id = 'intro-story-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

export class IntroStory {
  constructor({ panels, onDone } = {}) {
    this.panels = panels || [];
    this.onDone = onDone || (() => {});
    this.index = -1;
    this.typing = false;
    this.finished = false;
    this._interval = 0;
    this._full = '';
    this._pos = 0;
    this._onKey = this._onKey.bind(this);
    this._reduced = typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  start() {
    if (!this.panels.length) { this.finish(); return; }
    injectStyle();
    this._build();
    window.addEventListener('keydown', this._onKey, true);
    this._show(0);
  }

  _build() {
    const root = document.createElement('div');
    root.className = 'is-root';
    root.innerHTML =
      '<div class="is-bar"></div>' +
      '<div class="is-stage"><div class="is-arts"></div><div class="is-vignette"></div>' +
      '<button class="is-skip" type="button">SKIP</button></div>' +
      '<div class="is-caption">' +
      '<div class="is-label"></div><div class="is-text"></div><div class="is-note"></div>' +
      '<div class="is-foot"><div class="is-dots"></div>' +
      '<div class="is-hint">Click or press Space to continue</div></div></div>';
    document.body.appendChild(root);
    this.root = root;
    this.elArts = root.querySelector('.is-arts');
    this.elLabel = root.querySelector('.is-label');
    this.elText = root.querySelector('.is-text');
    this.elNote = root.querySelector('.is-note');
    this.elDots = root.querySelector('.is-dots');

    this.arts = this.panels.map((p) => {
      const art = document.createElement('div');
      art.className = 'is-art';
      const inner = document.createElement('div');
      inner.className = 'is-inner';
      const builder = PANEL_ART[p.art];
      inner.innerHTML = builder ? builder() : '';
      if (p.image) {
        const img = document.createElement('img');
        img.alt = '';
        img.addEventListener('error', () => img.remove());
        img.src = p.image;
        inner.appendChild(img);
      }
      art.appendChild(inner);
      this.elArts.appendChild(art);
      return art;
    });

    this.dots = this.panels.map(() => {
      const d = document.createElement('div');
      d.className = 'is-dot';
      this.elDots.appendChild(d);
      return d;
    });

    root.addEventListener('click', () => this.advance());
    root.querySelector('.is-skip').addEventListener('click', (e) => {
      e.stopPropagation();
      this.finish();
    });
  }

  _show(i) {
    this.index = i;
    const p = this.panels[i];
    this.arts.forEach((a, k) => a.classList.toggle('is-on', k === i));
    this.dots.forEach((d, k) => {
      d.classList.toggle('is-cur', k === i);
      d.classList.toggle('is-done', k < i);
    });
    this.elLabel.textContent = p.label || '';
    this.elNote.textContent = p.note || '';
    this._full = p.text || '';
    this._pos = 0;
    clearInterval(this._interval);
    if (this._reduced) {
      this.elText.textContent = this._full;
      this.typing = false;
      return;
    }
    this.elText.textContent = '';
    this.typing = true;
    this._interval = setInterval(() => {
      this._pos += 1;
      this.elText.textContent = this._full.slice(0, this._pos);
      if (this._pos >= this._full.length) {
        clearInterval(this._interval);
        this.typing = false;
      }
    }, 24);
  }

  advance() {
    if (this.finished) return;
    if (this.typing) {
      clearInterval(this._interval);
      this.elText.textContent = this._full;
      this.typing = false;
      return;
    }
    if (this.index < this.panels.length - 1) this._show(this.index + 1);
    else this.finish();
  }

  _onKey(e) {
    e.stopImmediatePropagation();
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
      e.preventDefault();
      this.advance();
    } else if (e.code === 'Escape') {
      this.finish();
    }
  }

  _cleanup() {
    clearInterval(this._interval);
    window.removeEventListener('keydown', this._onKey, true);
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this._cleanup();
    if (this.root) {
      this.root.classList.add('is-out');
      setTimeout(() => { if (this.root) this.root.remove(); }, 900);
    }
    this.onDone();
  }

  dispose() {
    this.finished = true;
    this._cleanup();
    if (this.root) this.root.remove();
  }
}
