// ============================================================
// GameShell — main menu, settings, credits, pause, level cards,
// fade transitions, save slots and the painted story intro.
//
// Look: the detective's night. The menu is the victim's office
// window in the rain, sodium streetlight and a desk lamp, with the
// title stamped over it. Everything that is "paper" (how to play,
// settings, credits) is a typed case-file sheet. Everything that is
// "game state" (pause, level cards) is type on the dark glass.
//
// Public API is unchanged, so main.js needs no edits:
//   showMenu / showPause / showCard / showIntro / showError
//   hideAll / show / fade / transition / openSettings
//   saveGame / loadGame / hasSave / clearSave / refreshMenu
// All overlays live at z-index 20000+, above every level UI.
// The `.gs-screen` / `.on` classes are read by main.js; keep them.
// ============================================================

const SAVE_KEY = 'genesis.save.v1';
const SETTINGS_KEY = 'genesis.settings.v1';

export const LEVEL_CARDS = {
  1: { title: 'Level 1', sub: "The victim's office", line: 'Dr. Nkosi is dead. The room remembers everything.' },
  2: { title: 'Level 2', sub: 'The police station', line: 'Greet reception. Examine the evidence. Bring the file to the captain.' },
  3: { title: 'Level 3', sub: 'Genesis', line: 'The suspect is running. Catch him before the bridge.' },
};

const LEVEL_NAMES = {
  1: "The victim's office",
  2: 'The police station',
  3: 'Genesis: the chase',
};

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap';

const CSS = `
#gs-veil{position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .45s ease;z-index:20000}
#gs-veil.on{opacity:1;pointer-events:auto}

.gs-screen{
  --night:#07111a; --paper:#eadfc4; --paper2:#d6c8a4; --ink:#1e1b16;
  --sodium:#e8a33d; --stamp:#c2362b; --mist:#9fb4bf;
  --disp:"Big Shoulders Display","Arial Narrow","Franklin Gothic Condensed",Impact,sans-serif;
  --type:"Courier Prime","Courier New",monospace;
  position:fixed;inset:0;display:none;z-index:20001;
  font-family:var(--type);color:var(--paper);background:var(--night);
}
.gs-screen.on{display:flex}
.gs-screen button{font:inherit;color:inherit;cursor:pointer}
.gs-screen :focus-visible{outline:2px solid var(--sodium);outline-offset:3px}

/* ---------- shared: rows (menu + pause) ---------- */
.gm-nav{display:flex;flex-direction:column;width:min(430px,100%);margin-top:30px}
.gm-row{position:relative;display:block;width:100%;text-align:left;background:none;border:0;
  border-top:1px solid rgba(234,223,196,.16);padding:13px 8px 13px 26px;transition:transform .18s ease}
.gm-row:last-child{border-bottom:1px solid rgba(234,223,196,.16)}
.gm-row::before{content:"";position:absolute;left:0;top:11px;bottom:11px;width:4px;background:var(--stamp);
  transform:scaleY(0);transform-origin:top;transition:transform .2s ease}
.gm-row:hover:not(:disabled),.gm-row:focus-visible{transform:translateX(6px)}
.gm-row:hover:not(:disabled)::before,.gm-row:focus-visible::before{transform:scaleY(1)}
.gm-row:hover:not(:disabled) .gm-n,.gm-row:focus-visible .gm-n{color:var(--sodium)}
.gm-row:focus-visible{outline-offset:-2px}
.gm-n{display:block;font-family:var(--disp);font-weight:800;font-size:30px;line-height:1.05;letter-spacing:.03em;text-transform:uppercase}
.gm-row.primary .gm-n{font-size:42px}
.gm-s{display:block;font-size:13px;line-height:1.4;color:var(--mist);margin-top:3px}
.gm-row:disabled{opacity:.42;cursor:default}

/* ---------- menu ---------- */
.gs-screen[data-screen="menu"]{align-items:stretch;justify-content:flex-start;overflow:hidden}
.gm-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.gm-shade{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(90deg,rgba(3,7,11,.86) 0%,rgba(3,7,11,.6) 36%,rgba(3,7,11,0) 72%)}
.gm-vig{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse at 40% 55%,rgba(0,0,0,0) 45%,rgba(0,0,0,.7) 100%)}
.gm-grain{position:absolute;inset:0;pointer-events:none;opacity:.09;mix-blend-mode:overlay}
.gm-col{position:relative;z-index:3;display:flex;flex-direction:column;
  box-sizing:border-box;min-width:0;width:100%;padding:32px clamp(24px,8vw,128px);overflow:auto}
.gm-col > *{flex-shrink:0}
.gm-col > .gm-title{margin-top:auto}
.gm-col > .gm-rest{margin-bottom:auto}
.gm-title{position:relative;margin:0;font-family:var(--disp);font-weight:900;text-transform:uppercase;
  font-size:clamp(40px,12vw,180px);line-height:1.12;letter-spacing:.005em;width:max-content;max-width:100%}
.gm-word{display:block;background:linear-gradient(180deg,#f6eed9 8%,#c9ba94 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 0 26px rgba(232,163,61,.22))}
.gm-stamp{position:absolute;right:0;bottom:4%;font-family:var(--type);font-weight:700;
  font-size:clamp(15px,2vw,26px);letter-spacing:.14em;text-transform:uppercase;line-height:1;
  color:var(--stamp);border:3px solid var(--stamp);padding:.22em .55em;transform:rotate(-7deg);opacity:.92;
  -webkit-mask-image:radial-gradient(circle at 18% 30%,#000 55%,rgba(0,0,0,.7) 100%)}
.gm-slogan{max-width:42ch;margin:14px 0 0;font-family:var(--type);font-weight:700;font-size:clamp(12px,1.2vw,16px);line-height:1.6;letter-spacing:.16em;text-transform:uppercase;color:var(--sodium)}

.gs-screen[data-screen="menu"].on .gm-word{animation:gm-wipe .95s cubic-bezier(.2,.7,.2,1) both}
.gs-screen[data-screen="menu"].on .gm-stamp{animation:gm-slam .32s .95s cubic-bezier(.3,1.7,.5,1) both}
.gs-screen[data-screen="menu"].on .gm-rest{animation:gm-fade .8s 1.15s ease both}
@keyframes gm-wipe{from{clip-path:inset(-20% 100% -20% -5%)}to{clip-path:inset(-20% -5% -20% -5%)}}
@keyframes gm-slam{from{opacity:0;transform:rotate(-7deg) scale(1.7)}to{opacity:.92;transform:rotate(-7deg) scale(1)}}
@keyframes gm-fade{from{opacity:0}to{opacity:1}}

/* ---------- paper sheets (how to play, settings, credits) ---------- */
.gs-screen[data-screen="howto"],.gs-screen[data-screen="settings"],.gs-screen[data-screen="credits"]{
  align-items:center;justify-content:center;
  background:radial-gradient(ellipse at 50% 40%,#10202c 0%,#050b11 75%)}
.gs-sheet{position:relative;width:min(760px,92vw);max-height:90vh;overflow:auto;
  background-color:var(--paper);
  background-image:repeating-linear-gradient(0deg,transparent 0 27px,rgba(30,27,22,.075) 27px 28px);
  color:var(--ink);padding:40px 48px 40px 78px;box-shadow:0 34px 90px rgba(0,0,0,.7);
  transform:rotate(-.35deg);font-size:15px;line-height:28px}
.gs-sheet::before{content:"";position:absolute;left:46px;top:0;bottom:0;width:2px;background:rgba(194,54,43,.4)}
.gs-sheet p{margin:0 0 28px}
.gs-h{margin:0 0 28px;font-family:var(--disp);font-weight:900;font-size:46px;line-height:56px;
  text-transform:uppercase;letter-spacing:.01em}
.gs-sheet b{font-weight:700}
.gs-keys{display:grid;grid-template-columns:150px 1fr;margin:0 0 28px}
.gs-keys dt{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.gs-keys dd{margin:0}
.gs-sheet kbd{font:700 12px/18px var(--type);padding:0 7px;border:1px solid var(--ink);border-bottom-width:3px;
  border-radius:3px;background:var(--paper2)}
.gs-pill{display:inline-block;padding:9px 22px;line-height:1.2;background:transparent;border:1px solid currentColor;
  letter-spacing:.04em;transition:background .15s,color .15s}
.gs-sheet .gs-pill{border:2px solid var(--ink);color:var(--ink);font-weight:700}
.gs-sheet .gs-pill:hover{background:var(--ink);color:var(--paper)}
.gs-set{display:grid;grid-template-columns:150px 1fr 44px;align-items:center;column-gap:16px;margin:0 0 28px;min-height:28px}
.gs-set output{text-align:right;font-weight:700}
.gs-sheet input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:28px;background:transparent;margin:0}
.gs-sheet input[type=range]::-webkit-slider-runnable-track{height:2px;background:var(--ink)}
.gs-sheet input[type=range]::-moz-range-track{height:2px;background:var(--ink)}
.gs-sheet input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:24px;margin-top:-11px;background:var(--stamp);border:0;border-radius:0}
.gs-sheet input[type=range]::-moz-range-thumb{width:14px;height:24px;background:var(--stamp);border:0;border-radius:0}
.gs-sheet input[type=checkbox]{-webkit-appearance:none;appearance:none;width:26px;height:26px;margin:0;border:2px solid var(--ink);background:transparent;position:relative;cursor:pointer}
.gs-sheet input[type=checkbox]:checked::after{content:"";position:absolute;inset:3px;background:var(--stamp)}
.gs-sheet :focus-visible{outline-color:var(--stamp)}
.gs-credit-list{margin:12px 0 28px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px 24px}.gs-credit-list dt{font-weight:bold}.gs-credit-list dd{margin:0;overflow-wrap:anywhere}
.gs-guide{border-top:1px solid rgba(30,27,22,.25);padding:14px 0}
.gs-guide summary{cursor:pointer;font-weight:bold;line-height:1.5}
.gs-guide summary:focus-visible{outline:2px solid var(--stamp);outline-offset:4px}
.gs-guide p{margin:12px 0}.gs-guide li{margin:10px 0;line-height:1.6}
.gs-guide ol,.gs-guide ul{padding-left:24px}
.gs-guide pre{overflow:auto;max-width:100%;background:var(--ink);color:var(--paper);padding:12px;font:12px/1.7 var(--type)}
.gs-guide code{overflow-wrap:anywhere}.gs-guide .gs-guide{margin-left:8px}
.gs-cr h3{margin:0;font-weight:700;font-size:15px}
.gs-faint{opacity:.72}

/* ---------- pause ---------- */
.gs-screen[data-screen="pause"]{align-items:center;justify-content:flex-start;
  background:rgba(4,10,15,.8);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.gp-col{padding:0 clamp(24px,8vw,128px)}
.gp-title{margin:0;font-family:var(--disp);font-weight:900;text-transform:uppercase;font-size:clamp(64px,9vw,124px);line-height:.88}
.gp-sub{margin:10px 0 0;color:var(--mist);font-size:15px}

/* ---------- level card ---------- */
.gs-screen[data-screen="card"]{align-items:center;justify-content:flex-start;background:linear-gradient(90deg,rgba(7,17,26,.86),rgba(7,17,26,.54));padding-left:clamp(24px,10vw,170px)}
#gs-card-title{margin:0 0 6px;font-size:18px;letter-spacing:.06em;color:var(--sodium)}
#gs-card-sub{margin:0;font-family:var(--disp);font-weight:900;text-transform:uppercase;
  font-size:clamp(56px,10.5vw,160px);line-height:.88}
.gc-rule{height:3px;width:min(220px,40vw);background:var(--stamp);margin:22px 0 18px;transform-origin:left}
#gs-card-line{margin:0;font-style:italic;font-size:17px;color:var(--mist);max-width:46ch;line-height:1.55}
.gs-screen[data-screen="card"].on #gs-card-sub{animation:gm-wipe .8s cubic-bezier(.2,.7,.2,1) both}
.gs-screen[data-screen="card"].on .gc-rule{animation:gc-rule .6s .5s ease both}
.gs-screen[data-screen="card"].on #gs-card-line{animation:gm-fade .7s .8s ease both}
@keyframes gc-rule{from{transform:scaleX(0)}to{transform:scaleX(1)}}

/* ---------- intro ---------- */
.gs-screen[data-screen="intro"]{flex-direction:column;align-items:center;justify-content:center;background:#010305}
.gi-wrap{width:min(960px,92vw)}
#gs-canvas{width:100%;aspect-ratio:16/9;background:#05070c;overflow:hidden;position:relative;
  box-shadow:0 0 0 1px rgba(234,223,196,.12),0 30px 80px rgba(0,0,0,.8)}
#gs-canvas canvas{width:100%;height:100%;display:block;animation:kenburns 8s ease-out forwards}
#gs-canvas::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse at 50% 50%,transparent 55%,rgba(0,0,0,.55) 100%)}
@keyframes kenburns{from{transform:scale(1)}to{transform:scale(1.08)}}
#gs-canvas #gs-fx{position:absolute;inset:0;animation:none;pointer-events:none;z-index:2}
#gs-canvas::before{content:"";position:absolute;left:0;right:0;top:0;height:7%;background:#000;z-index:3}
#gs-slug{position:absolute;left:4%;bottom:10%;z-index:4;font-size:13px;letter-spacing:.28em;color:var(--sodium);
  text-shadow:0 0 8px #000;opacity:0;animation:gm-fade .8s .4s ease forwards}
#gs-hint{margin:10px 0 0;font-size:11px;letter-spacing:.12em;opacity:.45}
#gs-caption{min-height:3.3em;margin:20px 0 14px;font-size:19px;line-height:1.6;max-width:62ch}
.gi-bar{display:flex;align-items:center;justify-content:space-between;gap:16px}
#gs-dots{display:flex;gap:6px}
#gs-dots i{display:block;width:34px;height:3px;background:rgba(234,223,196,.22)}
#gs-dots i.on{background:var(--sodium)}
.gi-btns{display:flex;gap:12px}
.gs-pill.solid{background:var(--sodium);border-color:var(--sodium);color:var(--ink);font-weight:700}
.gs-pill.solid:hover{background:#f4b955;border-color:#f4b955}
.gs-pill.quiet:hover{background:rgba(234,223,196,.1)}

@media (max-width:640px){
  .gs-sheet{padding:28px 22px 28px 52px}.gs-sheet::before{left:30px}
  .gs-keys,.gs-set{grid-template-columns:1fr}.gs-set output{text-align:left}
  .gm-n{font-size:26px}.gm-row.primary .gm-n{font-size:34px}
}
@media (prefers-reduced-motion:reduce){
  .gs-screen *,.gs-screen *::before,.gs-screen *::after{animation:none!important;transition:none!important}
}
`;

function el(html) {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstChild;
}

// ============================================================
// RainScene — the menu backdrop: a night skyline seen through a
// rain-streaked window, with a desk lamp guttering in the corner.
// Static layers are drawn once; only bokeh, rain and glow animate.
// Runs only while the menu is on screen.
// ============================================================
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class RainScene {
  constructor(canvas) {
    this.cv = canvas;
    this.g = canvas.getContext ? canvas.getContext('2d') : null;
    this.running = false;
    this.raf = 0;
    this.t = 0;
    this.last = 0;
    this.reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this._onResize = () => this._layout();
    window.addEventListener('resize', this._onResize);
    this._layout();
  }

  _layout() {
    if (!this.g) return;
    const w = this.w = Math.max(320, window.innerWidth);
    const h = this.h = Math.max(240, window.innerHeight);
    const s = this.s = Math.min(window.devicePixelRatio || 1, 1.25);
    this.cv.width = Math.floor(w * s);
    this.cv.height = Math.floor(h * s);
    this.layers = this._buildLayers(w, h, s);
    this._seed(w, h);
    if (!this.running && this.reduce && this.shown) this._draw(2, 0);
  }

  _buildLayers(w, h, s) {
    const rng = mulberry(20241016);
    const mk = () => {
      const c = document.createElement('canvas');
      c.width = Math.floor(w * s); c.height = Math.floor(h * s);
      const g = c.getContext('2d');
      g.setTransform(s, 0, 0, s, 0, 0);
      return [c, g];
    };

    // --- far world: sky, sodium haze, three skyline layers ---
    const [bg, b] = mk();
    const sky = b.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#04090f'); sky.addColorStop(0.5, '#0a1a26');
    sky.addColorStop(0.82, '#1a2a30'); sky.addColorStop(1, '#2a2418');
    b.fillStyle = sky; b.fillRect(0, 0, w, h);
    const haze = b.createRadialGradient(w * 0.4, h * 0.8, 10, w * 0.4, h * 0.8, w * 0.55);
    haze.addColorStop(0, 'rgba(232,163,61,.18)'); haze.addColorStop(1, 'rgba(232,163,61,0)');
    b.fillStyle = haze; b.fillRect(0, 0, w, h);
    const rows = [
      { base: h * 0.74, lo: h * 0.10, hi: h * 0.24, fill: '#0c1b26', win: 'rgba(160,195,210,.55)', lit: 2, cell: [13, 17] },
      { base: h * 0.82, lo: h * 0.12, hi: h * 0.30, fill: '#08141d', win: 'rgba(232,170,80,.75)', lit: 3, cell: [15, 20] },
      { base: h * 0.92, lo: h * 0.10, hi: h * 0.26, fill: '#050c13', win: 'rgba(232,170,80,.85)', lit: 2, cell: [18, 24] },
    ];
    for (const L of rows) {
      let x = -30;
      while (x < w + 30) {
        const bw = 56 + rng() * 110;
        const bh = L.lo + rng() * (L.hi - L.lo);
        b.fillStyle = L.fill; b.fillRect(x, L.base - bh, bw, h);
        const cols = Math.max(1, Math.floor((bw - 10) / L.cell[0]));
        const rws = Math.max(1, Math.floor((bh - 14) / L.cell[1]));
        for (let r = 0; r < rws; r++) {
          for (let c = 0; c < cols; c++) {
            if (rng() * 10 < L.lit) {
              b.fillStyle = L.win;
              b.fillRect(x + 6 + c * L.cell[0], L.base - bh + 8 + r * L.cell[1], L.cell[0] - 6, L.cell[1] - 8);
            }
          }
        }
        x += bw + 4 + rng() * 10;
      }
    }
    const mist = b.createLinearGradient(0, h * 0.7, 0, h);
    mist.addColorStop(0, 'rgba(120,150,165,0)'); mist.addColorStop(1, 'rgba(120,150,165,.10)');
    b.fillStyle = mist; b.fillRect(0, h * 0.7, w, h * 0.3);

    // --- window frame in front of the glass ---
    const [fg, f] = mk();
    const edge = '#030609';
    f.fillStyle = edge;
    f.fillRect(0, 0, w * 0.035, h); f.fillRect(w * 0.965, 0, w * 0.035, h);
    f.fillRect(0, 0, w, h * 0.05); f.fillRect(0, h * 0.9, w, h * 0.1);
    f.fillRect(w * 0.66 - 7, 0, 14, h * 0.9);            // mullion
    f.fillRect(w * 0.66, h * 0.42 - 6, w * 0.34, 12);     // transom (right pane only)
    f.fillStyle = 'rgba(170,200,215,.10)';
    f.fillRect(w * 0.66 - 7, 0, 2, h * 0.9); f.fillRect(w * 0.66, h * 0.42 - 6, w * 0.34, 2);
    f.fillRect(0, h * 0.9, w, 2);

    // --- bokeh sprites ---
    const sprite = (rgb) => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      gr.addColorStop(0, `rgba(${rgb},.85)`); gr.addColorStop(0.7, `rgba(${rgb},.5)`);
      gr.addColorStop(0.92, `rgba(${rgb},.75)`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
      return c;
    };
    return { bg, fg, sprites: [sprite('232,163,61'), sprite('110,175,195'), sprite('240,225,190')] };
  }

  _seed(w, h) {
    const rng = mulberry(77);
    this.bokeh = Array.from({ length: 16 }, () => ({
      x: w * (0.25 + rng() * 0.8), y: h * (0.5 + rng() * 0.38), r: 18 + rng() * 52,
      sp: (rng() < 0.5 ? -1 : 1) * (2 + rng() * 6), ph: rng() * 6.28, a: 0.05 + rng() * 0.1,
      k: Math.floor(rng() * 3),
    }));
    this.streaks = Array.from({ length: Math.round(w / 12) }, () => ({
      x: rng() * w, y: rng() * h, l: 12 + rng() * 18, v: 700 + rng() * 500,
    }));
    this.drops = Array.from({ length: Math.round((w * h) / 26000) }, () => ({
      x: rng() * w, y: rng() * h, r: 2 + rng() * 4.5, vy: 15 + rng() * 120,
      wait: rng() * 2, tl: 30 + rng() * 70, trail: 0,
    }));
  }

  _draw(t, dt) {
    const g = this.g, w = this.w, h = this.h, s = this.s;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.drawImage(this.layers.bg, 0, 0, w, h);

    for (const b of this.bokeh) {
      b.x += b.sp * dt;
      if (b.x < -b.r) b.x = w + b.r;
      if (b.x > w + b.r) b.x = -b.r;
      g.globalAlpha = b.a * (0.75 + 0.25 * Math.sin(t * 0.6 + b.ph));
      g.drawImage(this.layers.sprites[b.k], b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
    g.globalAlpha = 1;

    // falling rain outside the glass
    g.strokeStyle = 'rgba(170,200,220,.16)';
    g.lineWidth = 1;
    g.beginPath();
    for (const r of this.streaks) {
      r.y += r.v * dt; r.x -= r.v * 0.16 * dt;
      if (r.y > h + 30 || r.x < -30) { r.y = -30 - Math.random() * h * 0.2; r.x = Math.random() * (w + 200); }
      g.moveTo(r.x, r.y); g.lineTo(r.x + r.l * 0.16, r.y - r.l);
    }
    g.stroke();

    // drops that cling to the glass, stop, then run
    for (const d of this.drops) {
      if (d.wait > 0) {
        d.wait -= dt;
      } else {
        d.y += d.vy * dt;
        d.trail = Math.min(d.tl, d.trail + d.vy * dt);
        if (Math.random() < dt * 0.9) { d.wait = 0.3 + Math.random() * 2.2; d.vy = 15 + Math.random() * 120; }
        if (d.y > h + 30) { d.y = -20; d.x = Math.random() * w; d.trail = 0; d.wait = Math.random() * 3; }
      }
      if (d.trail > 1) {
        g.strokeStyle = 'rgba(200,225,238,.07)'; g.lineWidth = d.r * 0.55;
        g.beginPath(); g.moveTo(d.x, d.y - d.trail); g.lineTo(d.x, d.y); g.stroke();
      }
      g.fillStyle = 'rgba(190,215,230,.09)'; g.strokeStyle = 'rgba(215,235,245,.32)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(d.x, d.y, d.r * 0.8, d.r * 1.15, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.45)';
      g.beginPath(); g.arc(d.x - d.r * 0.25, d.y - d.r * 0.35, d.r * 0.2, 0, 7); g.fill();
    }

    g.drawImage(this.layers.fg, 0, 0, w, h);

    // desk lamp in the corner, with the odd gutter
    const dip = (Math.sin(t * 0.9) * Math.sin(t * 2.3) > 0.93) ? 0.05 : 0;
    const flick = 0.15 + 0.02 * Math.sin(t * 3.1) + 0.012 * Math.sin(t * 7.7) - dip;
    g.globalCompositeOperation = 'lighter';
    const lg = g.createRadialGradient(w * 0.1, h * 1.02, 10, w * 0.1, h * 1.02, h * 0.95);
    lg.addColorStop(0, `rgba(232,163,61,${(flick * 1.6).toFixed(3)})`);
    lg.addColorStop(1, 'rgba(232,163,61,0)');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';

    // fade up from black on arrival
    if (t < 1.4) { g.fillStyle = `rgba(0,0,0,${(1 - t / 1.4).toFixed(3)})`; g.fillRect(0, 0, w, h); }
  }

  start() {
    this.shown = true;
    if (!this.g || this.running) return;
    if (this.reduce) { this._draw(2, 0); return; }
    this.running = true;
    this.t = 0;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      this._draw(this.t, dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.shown = false;
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
  }
}

function grainURL() {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    if (!g) return '';
    const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  } catch (e) { return ''; }
}

export class GameShell {
  constructor(opts = {}) {
    this.cb = opts;                       // onNewGame, onContinue, onResume, onRestartLevel, onQuitToMenu
    this.audio = opts.audio || null;
    this.settings = this._loadSettings();
    this._applySettings();
    this._pauseFrom = null;               // 'pause' | 'menu'
    this.scene = null;

    if (!document.getElementById('gs-fonts')) {
      const l = document.createElement('link');
      l.id = 'gs-fonts'; l.rel = 'stylesheet'; l.href = FONT_HREF;
      document.head.appendChild(l);
    }
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    this.veil = el('<div id="gs-veil"></div>');
    document.body.appendChild(this.veil);

    this.root = el('<div id="gs-root"></div>');
    document.body.appendChild(this.root);

    this.screens = {};
    this._buildMenu();
    this._buildHowto();
    this._buildSettings();
    this._buildCredits();
    this._buildPause();
    this._buildCard();
    this._buildIntro();

    // UI click sound on every shell button (menu, pause, settings, intro…)
    this.root.addEventListener('click', (e) => {
      if (!e.target.closest('.gs-btn')) return;
      try { if (this.audio) this.audio.playSfx('button_click'); } catch (err) {}
    });

    // Arrow keys move between rows; Esc backs out of the paper sheets.
    this._onKey = (e) => {
      const on = document.querySelector('.gs-screen.on');
      if (!on) return;
      const name = on.dataset.screen;
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
        const rows = [...on.querySelectorAll('.gm-row:not(:disabled)')];
        if (!rows.length) return;
        let i = rows.indexOf(document.activeElement);
        i = e.code === 'ArrowDown' ? (i + 1) % rows.length : (i <= 0 ? rows.length - 1 : i - 1);
        rows[i].focus();
        e.preventDefault();
      } else if (e.code === 'Escape') {
        if (name === 'howto') {
          this.show(this._guideFrom === 'pause' ? 'pause' : 'menu');
          e.stopPropagation();
        } else if (name === 'settings') {
          this.show(this._pauseFrom === 'pause' ? 'pause' : 'menu');
          e.stopPropagation();
        } else if (name === 'credits') {
          this.show('menu');
          e.stopPropagation();
        }
      }
    };
    document.addEventListener('keydown', this._onKey);
  }

  // ================= settings + saves =================
  _loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (s && typeof s === 'object') return { music: 0.7, sfx: 0.8, muted: false, ...s, cameraMode: s.cameraMode === 'third' ? 'third' : 'first' };
    } catch (e) {}
    return { music: 0.7, sfx: 0.8, muted: false, cameraMode: 'first' };
  }
  setCameraMode(mode) {
    this.settings.cameraMode = mode === 'third' ? 'third' : 'first';
    this._applySettings();
    if (this._paintSettings) this._paintSettings();
  }
  _applySettings() {
    this.cb.onCameraMode?.(this.settings.cameraMode);
    if (!this.audio) return;
    this.audio.setMusicVolume(this.settings.music);
    this.audio.setSfxVolume(this.settings.sfx);
    this.audio.setMuted(this.settings.muted);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) {}
  }
  saveGame(data) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, ts: Date.now() })); } catch (e) {}
    this.refreshMenu();
  }
  loadGame() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
  }
  hasSave() { return !!this.loadGame(); }
  clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} this.refreshMenu(); }

  // ================= screen plumbing =================
  _addScreen(name, node) {
    node.classList.add('gs-screen');
    node.dataset.screen = name;
    this.root.appendChild(node);
    this.screens[name] = node;
  }
  show(name) {
    for (const k of Object.keys(this.screens)) this.screens[k].classList.remove('on');
    if (this.screens[name]) this.screens[name].classList.add('on');
    if (this.scene) { if (name === 'menu') this.scene.start(); else this.scene.stop(); }
    this._syncHudPause();
    if (name === 'menu' || name === 'pause') {
      const first = this.screens[name] && this.screens[name].querySelector('.gm-row:not(:disabled)');
      if (first) setTimeout(() => { try { first.focus({ preventScroll: true }); } catch (e) {} }, 0);
    }
  }
  hideAll() {
    for (const k of Object.keys(this.screens)) this.screens[k].classList.remove('on');
    if (this.scene) this.scene.stop();
    this._syncHudPause();
  }
  _syncHudPause() {
    const anyOpen = Object.values(this.screens).some((s) => s.classList.contains('on'));
    const pb = document.getElementById('pauseBtn');
    if (pb) pb.style.display = anyOpen ? 'none' : 'block';
  }
  fade(toBlack, ms = 450) {
    return new Promise((res) => {
      this.veil.style.transitionDuration = `${ms / 1000}s`;
      this.veil.classList.toggle('on', toBlack);
      setTimeout(res, ms + 30);
    });
  }
  async transition(work, cardN = 0) {
    await this.fade(true);
    try {
      await work();
    } catch (err) {
      // Never strand the player on a black veil: lift it and say what broke.
      console.error('[GENESIS] level swap failed:', err);
      await this.fade(false);
      this.showError(err);
      return false;
    }
    if (cardN && LEVEL_CARDS[cardN]) {
      this.showCard(cardN);
      await new Promise((r) => setTimeout(r, 500));
      await this.fade(false);
      await new Promise((r) => setTimeout(r, 1800));
      this.hideAll();
    } else {
      await this.fade(false);
    }
  }
  showError(err) {
    const msg = (err && (err.stack || err.message)) ? String(err.stack || err.message) : String(err);
    let s = document.getElementById('gs-error');
    if (!s) {
      s = document.createElement('div');
      s.id = 'gs-error';
      s.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:20002;font-family:"Courier Prime","Courier New",monospace;background:rgba(2,6,10,.94)';
      s.innerHTML = '<div style="max-width:min(720px,92vw);background:#eadfc4;color:#1e1b16;padding:30px 36px;box-shadow:0 30px 80px rgba(0,0,0,.7);border-top:6px solid #c2362b">' +
        '<div style="font-family:\'Big Shoulders Display\',Impact,sans-serif;font-weight:900;font-size:38px;text-transform:uppercase;line-height:1;margin-bottom:10px">The level failed to load</div>' +
        '<div style="font-size:14px;line-height:1.5;margin-bottom:12px">Take a screenshot of this and send it to the developer. Press R or reload the page to try again.</div>' +
        '<pre id="gs-error-text" style="font-size:11px;line-height:1.5;max-height:40vh;overflow:auto;background:#1e1b16;color:#eadfc4;padding:12px;white-space:pre-wrap"></pre>' +
        '<button id="gs-error-back" style="font:inherit;font-weight:700;margin-top:14px;padding:9px 22px;background:transparent;color:#1e1b16;border:2px solid #1e1b16;cursor:pointer">Back to menu</button></div>';
      document.body.appendChild(s);
      s.querySelector('#gs-error-back').addEventListener('click', () => {
        s.style.display = 'none';
        try { window.__showMenu && window.__showMenu(); } catch (e) {}
      });
    }
    s.querySelector('#gs-error-text').textContent = msg.slice(0, 2000);
    s.style.display = 'flex';
  }
  showCard(n) {
    const c = LEVEL_CARDS[n];
    document.getElementById('gs-card-title').textContent = c.title;
    document.getElementById('gs-card-sub').textContent = c.sub;
    document.getElementById('gs-card-line').textContent = c.line;
    this.show('card');
  }

  // ================= menu =================
  _buildMenu() {
    const n = el(`<div>
      <canvas class="gm-canvas" aria-hidden="true"></canvas>
      <div class="gm-shade"></div><div class="gm-vig"></div><div class="gm-grain"></div>
      <div class="gm-col">
        <h1 class="gm-title"><span class="gm-word">Genesis</span><span class="gm-stamp">Unsolved</span></h1>
        <div class="gm-rest">
          <p class="gm-slogan">Follow the evidence. Question everyone.</p>
          <nav class="gm-nav">
            <button class="gs-btn gm-row primary" id="gs-new"><span class="gm-n">Open the case</span></button>
            <button class="gs-btn gm-row" id="gs-continue"><span class="gm-n">Continue</span><span class="gm-s">No saved case yet</span></button>
            <button class="gs-btn gm-row" id="gs-how"><span class="gm-n">Controls &amp; mission guide</span></button>
            <button class="gs-btn gm-row" id="gs-settings"><span class="gm-n">Settings</span></button>
            <button class="gs-btn gm-row" id="gs-credits"><span class="gm-n">Credits</span></button>
          </nav>
        </div>
      </div></div>`);
    n.querySelector('#gs-new').addEventListener('click', () => this.cb.onNewGame && this.cb.onNewGame());
    n.querySelector('#gs-continue').addEventListener('click', () => this.cb.onContinue && this.cb.onContinue());
    n.querySelector('#gs-how').addEventListener('click', () => { this._guideFrom = 'menu'; this.show('howto'); });
    n.querySelector('#gs-settings').addEventListener('click', () => this.openSettings('menu'));
    n.querySelector('#gs-credits').addEventListener('click', () => this.show('credits'));
    const url = grainURL();
    if (url) n.querySelector('.gm-grain').style.backgroundImage = `url(${url})`;
    this._addScreen('menu', n);
    try { this.scene = new RainScene(n.querySelector('.gm-canvas')); } catch (e) { this.scene = null; }
  }
  _saveSummary(s) {
    const name = LEVEL_NAMES[s.level] || `Level ${s.level}`;
    let when = '';
    if (s.ts) {
      try { when = new Date(s.ts).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
    }
    return when ? `${name}, saved ${when}` : name;
  }
  refreshMenu() {
    const b = this.screens.menu && this.screens.menu.querySelector('#gs-continue');
    if (!b) return;
    const s = this.loadGame();
    b.disabled = !s;
    b.querySelector('.gm-s').textContent = s ? this._saveSummary(s) : 'No saved case yet';
  }
  showMenu() { this.refreshMenu(); this.show('menu'); }

  // ================= paper sheets =================
  _buildHowto() {
    const n = el(`<div>
      <div class="gs-sheet">
        <h2 class="gs-h">Controls &amp; mission guide</h2>
        <p class="gs-faint"><b>Read the Room. Close the Case.</b></p>
        <p>Open this guide from the main menu or <b>P → Controls &amp; mission guide</b> while playing. Close a device or report with Esc before opening Pause.</p>
        <h3>Movement &amp; shared controls</h3>
        <dl class="gs-keys">
          <dt><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></dt><dd>Walk in the office and station. Click the scene to capture the mouse, then move it to look.</dd>
          <dt><kbd>Shift</kbd> / <kbd>Space</kbd></dt><dd>Sprint / jump during exploration.</dd>
          <dt><kbd>V</kbd></dt><dd>Switch first / third person. Photography and scripted scenes control their own view.</dd>
          <dt><kbd>E</kbd></dt><dd>Look at an object, move close enough for its prompt, then interact.</dd>
          <dt><kbd>Q</kbd> + click</dt><dd>Office and lab: raise the camera, centre the subject and left-click to photograph. Scroll to zoom; Q lowers it.</dd>
          <dt><kbd>Esc</kbd></dt><dd>Close a lab device or report; otherwise release the mouse. Click the scene to look and move again.</dd>
          <dt><kbd>P</kbd></dt><dd>Pause / resume. The pause button also opens the menu.</dd>
          <dt><kbd>R</kbd></dt><dd>Restart the current level. Current level actions must be repeated.</dd>
        </dl>
        <details class="gs-guide" open>
          <summary>Level 1 — Secure the office</summary>
          <p><b>Your goal:</b> photograph and collect all six exhibits. The detective’s notes raise questions; the lab provides the answers.</p>
          <ol>
            <li>Look closely around the room. Use Q and left-click for a sharp photograph before collecting anything.</li>
            <li>Lower the camera with Q. Use <b>1: bags, 2: tweezers, 3: swab</b>, then E to collect. A sharp photograph selects the appropriate tool; the wrong tool records contamination.</li>
            <li>Use <b>F</b> for the UV torch. Photograph the revealed trail with UV on; this photograph logs that exhibit.</li>
            <li>Use <b>C</b> to review field notes. Once all six exhibits are logged, seal the evidence and follow the departure screens to Level 2. There is no timeline-ordering puzzle.</li>
          </ol>
        </details>
        <details class="gs-guide" open>
          <summary>Level 2 — Examine the evidence</summary>
          <p><b>Your goal:</b> finish four reports, sign all four pages, then deliver the file to the captain. Examining an item alone does not file its report.</p>
          <ol>
            <li><b>Arrive:</b> enter the station, greet Mokoena at reception on the left with E, then enter the marked lab. No conversation or initial captain visit is needed.</li>
            <li><b>Prepare:</b> sign the intake sheet and put on gloves at the dispenser.</li>
            <li><b>Work:</b> follow the HUD’s <b>NEXT</b> instruction. The four benches are digital forensics, trace evidence, biology, and scene reconstruction.</li>
            <li><b>Finish each bench:</b> examine → photograph the required subject → file the report. While a machine runs, you can work at another bench.</li>
            <li><b>Deliver:</b> use E on the folder at the report table and click <b>Sign page</b> on all four reports. Go to the captain’s office on the right and press E to deliver. The acknowledgement leads directly to Level 3.</li>
          </ol>
          <p><b>FIELD TRAINING:</b> follow the amber marker and the one-step instruction card. Device controls are outlined when needed, and the guide advances when you complete the action. Press <b>H</b> to hide or restore guidance. You still make the comparisons and conclusions yourself.</p>
          <p><b>Lab controls:</b> E opens benches and devices; use the mouse on their buttons. Esc closes them. Q takes photographs in the room. Open the folder with <b>E at the report table</b>, not C. Use the lab’s physical UV wand and light controls, not the office’s F shortcut.</p>
          <details class="gs-guide">
            <summary>Phone — shield, unlock, read, photograph, file</summary>
            <ol>
              <li>Lift the phone from intake, place it in the <b>Faraday box</b> (radio shielding), take it out and seat it in the cradle.</li>
              <li>Open the examiner laptop. Type <code>cat README.txt</code> for its instructions. Recover the PIN here instead of guessing on the handset.</li>
              <li>Enter the recovered PIN on the phone and turn <b>airplane mode on immediately</b>. Three wrong PIN attempts, or leaving the unlocked phone connected to the network too long, can wipe it.</li>
              <li>Read Messages, Maps and Contacts. Scroll inside the apps and use their <b>flag</b> buttons to record the relevant entries.</li>
              <li>Close the device, photograph the laptop display with the recovered PIN, then reopen the phone and <b>Log digital report</b>.</li>
            </ol>
            <details class="gs-guide"><summary>Need help with the laptop commands?</summary>
              <p>This is an in-game terminal. Enter each command and wait for its output:</p>
              <pre>lockdump /dev/cradle0 -o lock.hash
hashcat -m 0 -a 3 lock.hash ?d?d?d?d
hashcat --show lock.hash</pre>
              <p>Read the recovered PIN from the result and enter it on the handset. Esc closes the laptop.</p>
            </details>
          </details>
          <details class="gs-guide">
            <summary>Trace evidence — compare under the microscope</summary>
            <p>Place the strand and cover slip. Open the eyepiece, adjust focus and magnification, and follow its comparison checklist. Record verdicts on at least two references and choose your final claim. Photograph the microscope, then return to the bench to file the trace page. Inspect the guest glass with the lab UV wand too; observations belong in your investigation, not guesses about the culprit.</p>
            <p>For physical microscope knobs, E selects a knob; move the mouse or scroll to adjust it. E or Esc releases it.</p>
          </details>
          <details class="gs-guide">
            <summary>Biology — prepare and compare the sample</summary>
            <p>Cut the swatch, add the lysis treatment, load the cartridge and start the sequencer. When it finishes, use MATCH and read the comparison. Close the panel, photograph the sequencer, then return to log the DNA report.</p>
          </details>
          <details class="gs-guide">
            <summary>Scene reconstruction — inspect the original exhibits</summary>
            <p>Examine the casing in its tray and the working copy of the UV-trail photograph. Photograph both subjects in the lab, then use the reconstruction clipboard to file the report. This is a lab examination, not the removed Level 1 ordering puzzle.</p>
          </details>
          <details class="gs-guide">
            <summary>Stuck? Check these first</summary>
            <ul>
              <li><b>No E prompt:</b> lower the camera, close any panel, move closer and aim at the item.</li>
              <li><b>Cannot take a photo:</b> Esc out of the device, click the room to capture the mouse, then use Q. Centre the actual exhibit or machine and move closer for a sharp shot.</li>
              <li><b>Report button disabled:</b> check the panel’s missing requirements. Reading, flagging, choosing a verdict and taking a sharp photograph are separate steps.</li>
              <li><b>Captain will not accept the file:</b> check that all four reports exist and each page is signed at the report table.</li>
              <li><b>Phone wiped:</b> restart the level with R if you want to recover its evidence. Shield it and enable airplane mode promptly on the next attempt.</li>
            </ul>
          </details>
        </details>
        <details class="gs-guide" open>
          <summary>Level 3 — Catch the suspect</summary>
          <p>Press Enter or click through the arrival story. After the countdown, forward running is automatic. Use <b>A / D</b> or <b>left / right arrows</b> to change lanes, <b>Space</b> to jump and <b>V</b> to change view. Watch the suspect-distance meter.</p>
          <p>Jump smaller obstacles and change lanes around large barriers. Catch the suspect before the cave bridge. At the result screen, choose the retry button or press Enter to try again.</p>
        </details>
        <p><b>Office and station briefings:</b> Enter or click completes the current line, then advances; Esc skips. Your next task remains on the HUD.</p>
        <p><b>Saving:</b> progress saves at level transitions. Continue restarts the saved level; it does not restore individual mid-level actions.</p>
        <button class="gs-btn gs-pill" id="gs-how-back">Back</button>
      </div></div>`);
    n.querySelector('#gs-how-back').addEventListener('click', () => this.show(this._guideFrom === 'pause' ? 'pause' : 'menu'));
    this._addScreen('howto', n);
  }

  _buildSettings() {
    const n = el(`<div>
      <div class="gs-sheet">
        <h2 class="gs-h">Settings</h2>
        <div class="gs-set"><label for="gs-camera">Exploration view</label><select id="gs-camera"><option value="first">First-person</option><option value="third">Third-person</option></select></div>
        <p class="gs-faint">Press V while exploring to switch views. Your choice is saved. Photography and story scenes temporarily use their required view.</p>
        <div class="gs-set"><label for="gs-music">Music</label><input id="gs-music" type="range" min="0" max="100"><output id="gs-music-v"></output></div>
        <div class="gs-set"><label for="gs-sfx">Sound effects</label><input id="gs-sfx" type="range" min="0" max="100"><output id="gs-sfx-v"></output></div>
        <div class="gs-set"><label for="gs-mute">Mute everything</label><input id="gs-mute" type="checkbox"></div>
        <button class="gs-btn gs-pill" id="gs-set-back">Back</button>
      </div></div>`);
    const view = n.querySelector('#gs-camera');
    view.addEventListener('change', () => this.setCameraMode(view.value));
    const m = n.querySelector('#gs-music'), s = n.querySelector('#gs-sfx'), mu = n.querySelector('#gs-mute');
    const paint = () => {
      view.value = this.settings.cameraMode;
      m.value = Math.round(this.settings.music * 100);
      s.value = Math.round(this.settings.sfx * 100);
      mu.checked = this.settings.muted;
      n.querySelector('#gs-music-v').textContent = m.value;
      n.querySelector('#gs-sfx-v').textContent = s.value;
    };
    m.addEventListener('input', () => { this.settings.music = m.value / 100; this._applySettings(); paint(); });
    s.addEventListener('input', () => { this.settings.sfx = s.value / 100; this._applySettings(); paint(); });
    mu.addEventListener('change', () => { this.settings.muted = mu.checked; this._applySettings(); paint(); });
    n.querySelector('#gs-set-back').addEventListener('click', () => this.show(this._pauseFrom === 'pause' ? 'pause' : 'menu'));
    this._addScreen('settings', n);
    this._paintSettings = paint;
    paint();
  }
  openSettings(from) { this._pauseFrom = from; if (this._paintSettings) this._paintSettings(); this.show('settings'); }

  _buildCredits() {
    const n = el(`<div>
      <div class="gs-sheet gs-cr">
        <h2 class="gs-h">Credits</h2>
        <p><b>GENESIS — Read the Room. Close the Case.</b><br>A murder mystery in three stages: the office, the lab and the chase through Genesis.</p>
        <h3>Made by 404 Found Us</h3>
        <p>Busisiwe Mnguni — Level 1<br>Sibusiso Ndunge — Level 2<br>Pumelela Mapukata — Level 3</p>
        <h3>Story</h3>
        <p>Dr. T. Nkosi, the five witnesses and the case behind them. Procedural killer, clues and alibis — different every run.</p>
        <h3>Level 1 — The office</h3>
        <dl class="gs-credit-list">
          <dt>Professor &amp; detective characters and poses</dt><dd>Mixamo (Adobe)</dd>
          <dt>Music</dt><dd>OpenGameArt.org</dd>
          <dt>Room, furniture, textures &amp; lighting</dt><dd>Made in code by the team</dd>
        </dl>
        <h3>Level 2 — The police station</h3>
        <dl class="gs-credit-list">
          <dt>Bricks, wall, carpet, wood floor, road &amp; painted plaster</dt><dd>struffelproductions</dd>
          <dt>Police vehicle</dt><dd>low-poly.com</dd>
          <dt>Furniture</dt><dd>Sketchfab</dd>
          <dt>Music</dt><dd>freemusic</dd>
          <dt>Sky</dt><dd>CGTrader</dd>
        </dl>
        <h3>Level 3 — The chase through Genesis</h3>
        <dl class="gs-credit-list">
          <dt>Street lights</dt><dd>Sketchfab</dd>
          <dt>Music</dt><dd>freemusic</dd>
          <dt>Textures</dt><dd>Images found on Google</dd>
          <dt>Detective &amp; suspect characters and animations</dt><dd>Mixamo (Adobe)</dd>
          <dt>Obstacles, chase effects &amp; sound effects</dt><dd>Made in code by the team</dd>
        </dl>
        <h3>Other music &amp; audio</h3>
        <p>OpenGameArt.org. The music for each level is credited in that level's section above.</p>
        <h3>Tools</h3>
        <p>Three.js, Howler.js and Vite. Type set in Big Shoulders Display and Courier Prime.</p>
        <p class="gs-faint">Thanks for playing detective.</p>
        <button class="gs-btn gs-pill" id="gs-cr-back">Back</button>
      </div></div>`);
    n.querySelector('#gs-cr-back').addEventListener('click', () => this.show('menu'));
    this._addScreen('credits', n);
  }

  // ================= pause =================
  _buildPause() {
    const n = el(`<div>
      <div class="gp-col">
        <h2 class="gp-title">Paused</h2>
        <p class="gp-sub" id="gs-pause-sub"></p>
        <nav class="gm-nav">
          <button class="gs-btn gm-row primary" id="gs-resume"><span class="gm-n">Resume</span></button>
          <button class="gs-btn gm-row" id="gs-restart"><span class="gm-n">Restart level</span></button>
          <button class="gs-btn gm-row" id="gs-pguide"><span class="gm-n">Controls &amp; mission guide</span></button>
          <button class="gs-btn gm-row" id="gs-pset"><span class="gm-n">Settings</span></button>
          <button class="gs-btn gm-row" id="gs-quit"><span class="gm-n">Quit to menu</span></button>
        </nav>
      </div></div>`);
    n.querySelector('#gs-resume').addEventListener('click', () => this.cb.onResume && this.cb.onResume());
    n.querySelector('#gs-restart').addEventListener('click', () => this.cb.onRestartLevel && this.cb.onRestartLevel());
    n.querySelector('#gs-pguide').addEventListener('click', () => { this._guideFrom = 'pause'; this.show('howto'); });
    n.querySelector('#gs-pset').addEventListener('click', () => this.openSettings('pause'));
    n.querySelector('#gs-quit').addEventListener('click', () => this.cb.onQuitToMenu && this.cb.onQuitToMenu());
    this._addScreen('pause', n);
  }
  showPause(levelName) {
    document.getElementById('gs-pause-sub').textContent = levelName || '';
    this.show('pause');
  }

  // ================= level card =================
  _buildCard() {
    const n = el(`<div>
      <div>
        <p id="gs-card-title"></p>
        <p id="gs-card-sub"></p>
        <div class="gc-rule"></div>
        <p id="gs-card-line"></p>
      </div></div>`);
    this._addScreen('card', n);
  }

  // ================= painted intro =================
  _buildIntro() {
    const n = el(`<div id="gs-intro">
      <div class="gi-wrap">
        <div id="gs-canvas"><canvas id="gs-art" width="960" height="540"></canvas><canvas id="gs-fx" width="960" height="540"></canvas><div id="gs-slug"></div></div>
        <p id="gs-caption"></p>
        <div class="gi-bar">
          <div id="gs-dots"></div>
          <div class="gi-btns">
            <button class="gs-btn gs-pill quiet" id="gs-skip">Skip</button>
            <button class="gs-btn gs-pill solid" id="gs-next">Next</button>
          </div>
        </div>
        <p id="gs-hint">ENTER next &nbsp;·&nbsp; ESC skip</p>
      </div></div>`);
    this._addScreen('intro', n);
    this._art = n.querySelector('#gs-art');
    this._cap = n.querySelector('#gs-caption');
    this._dots = n.querySelector('#gs-dots');
    this._fx = n.querySelector('#gs-fx');
    this._slug = n.querySelector('#gs-slug');
    this._next = n.querySelector('#gs-next');
    this._typeT = 0;
    this._typing = false;
    n.querySelector('#gs-skip').addEventListener('click', () => this._finishIntro());
    this._next.addEventListener('click', () => {
      if (this._typing) { this._skipTyping(); return; }
      if (this._introIdx >= INTRO_PANELS.length - 1) this._finishIntro();
      else this._showPanel(this._introIdx + 1);
    });
  }
  showIntro(onDone) {
    this._introDone = onDone;
    this._showPanel(0);
    this.show('intro');
    this._startFx();
    this._introKey = (e) => {
      if (!document.querySelector('.gs-screen[data-screen="intro"].on')) return;
      if (e.code === 'Escape') { e.preventDefault(); this._finishIntro(); return; }
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'ArrowRight') {
        e.preventDefault();
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        this._next.click();
      }
    };
    document.addEventListener('keydown', this._introKey);
  }
  // Live layer over the painted panel: slanting rain, lightning, film grain.
  _startFx() {
    this._stopFx();
    const cv = this._fx; if (!cv) return;
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const drops = Array.from({ length: 170 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 700 + Math.random() * 500, l: 12 + Math.random() * 22 }));
    let last = performance.now(), flash = 0, nextFlash = 1.5 + Math.random() * 2.5;
    this._flashNow = () => { flash = 0.9; };
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      g.clearRect(0, 0, W, H);
      g.strokeStyle = 'rgba(175,200,255,.30)'; g.lineWidth = 1.2;
      g.beginPath();
      for (const d of drops) {
        d.y += d.v * dt; d.x -= d.v * dt * 0.28;
        if (d.y > H) { d.y = -20; d.x = Math.random() * (W + 200); }
        g.moveTo(d.x, d.y); g.lineTo(d.x + d.l * 0.28, d.y - d.l);
      }
      g.stroke();
      nextFlash -= dt;
      if (nextFlash <= 0) { flash = 0.55 + Math.random() * 0.35; nextFlash = 3 + Math.random() * 5; }
      if (flash > 0.01) {
        g.fillStyle = `rgba(205,220,255,${(flash * 0.32).toFixed(3)})`; g.fillRect(0, 0, W, H);
        flash *= Math.pow(0.02, dt);
      }
      for (let i = 0; i < 90; i++) {            // grain
        g.fillStyle = `rgba(255,255,255,${(Math.random() * 0.05).toFixed(3)})`;
        g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
      }
      this._fxRaf = requestAnimationFrame(loop);
    };
    this._fxRaf = requestAnimationFrame(loop);
  }
  _stopFx() {
    if (this._fxRaf) cancelAnimationFrame(this._fxRaf);
    this._fxRaf = 0; this._flashNow = null;
  }
  _finishIntro() {
    clearInterval(this._typeT);
    this._typing = false;
    this._stopFx();
    if (this._introKey) { document.removeEventListener('keydown', this._introKey); this._introKey = null; }
    const cb = this._introDone;
    this._introDone = null;
    this.hideAll();
    if (cb) cb();
  }
  _typeCaption(text) {
    clearInterval(this._typeT);
    this._capFull = text;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { this._cap.textContent = text; this._typing = false; return; }
    let i = 0;
    this._cap.textContent = '';
    this._typing = true;
    this._typeT = setInterval(() => {
      i += 1;
      this._cap.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(this._typeT); this._typing = false; }
    }, 24);
  }
  _skipTyping() {
    clearInterval(this._typeT);
    this._typing = false;
    this._cap.textContent = this._capFull || '';
  }
  _showPanel(i) {
    this._introIdx = i;
    const g = this._art.getContext('2d');
    INTRO_PANELS[i].draw(g, 960, 540);
    // restart the slow zoom
    const cv = this._art;
    cv.style.animation = 'none'; void cv.offsetWidth; cv.style.animation = '';
    this._typeCaption(INTRO_PANELS[i].cap);
    if (this._slug) {
      const s = this._slug; s.textContent = INTRO_PANELS[i].slug || '';
      s.style.animation = 'none'; void s.offsetWidth; s.style.animation = '';
    }
    if (this._flashNow && i > 0) this._flashNow();
    this._dots.innerHTML = INTRO_PANELS.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('');
    this._next.textContent = (i === INTRO_PANELS.length - 1) ? 'Begin the investigation' : 'Next';
  }
}

// ============================================================
// Noir panel paintings (procedural 2D canvas, no assets)
// ============================================================
function sky(g, w, h, top, mid, bot) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, top); gr.addColorStop(0.62, mid); gr.addColorStop(1, bot);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
function litWindows(g, x, y, ww, hh, cols, rows, lit, color) {
  const cw = ww / cols, ch = hh / rows;
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++, k++) {
    const on = ((k * 7919 + c * 13 + r * 7) % 10) < lit;
    g.fillStyle = on ? color : 'rgba(0,0,0,.55)';
    g.fillRect(x + c * cw + 2, y + r * ch + 3, cw - 4, ch - 6);
  }
}

const INTRO_PANELS = [
  { slug: 'CENTRAL CITY  \u2014  22:47',
    cap: 'Central City, October. Three days of rain, and the whole town is holding its breath. I have not slept for most of them.',
    draw(g, w, h) {
      sky(g, w, h, '#04060d', '#0b1226', '#1a1430');
      // moon glow
      const mg = g.createRadialGradient(760, 110, 8, 760, 110, 130);
      mg.addColorStop(0, 'rgba(230,235,255,.85)'); mg.addColorStop(0.25, 'rgba(180,190,230,.25)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = mg; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8ecff'; g.beginPath(); g.arc(760, 110, 26, 0, 7); g.fill();
      // skyline
      const blocks = [[0, 300, 130, 240], [120, 250, 110, 290], [225, 320, 150, 220], [370, 230, 120, 310],
        [485, 300, 140, 240], [620, 260, 110, 280], [725, 310, 120, 230], [840, 270, 120, 270]];
      for (const [x, y, bw, bh] of blocks) {
        g.fillStyle = '#070a13'; g.fillRect(x, y, bw, bh);
        litWindows(g, x + 8, y + 14, bw - 16, bh - 30, 5, 9, 3, '#ffd9a0');
      }
      // street glow + wet reflection
      g.fillStyle = 'rgba(255,180,107,.10)'; g.fillRect(0, 470, w, 70);
      g.fillStyle = 'rgba(0,217,255,.10)'; g.fillRect(0, 505, w, 35);
      // rain
      g.strokeStyle = 'rgba(170,200,255,.35)'; g.lineWidth = 1.5;
      for (let i = 0; i < 130; i++) {
        const x = (i * 173) % w, y = (i * 311) % h;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - 8, y + 26); g.stroke();
      }
    } },
  { slug: 'FACULTY OF COMPUTING  \u2014  00:50',
    cap: 'Dr. Thabo Nkosi. Senior lecturer. The cleaner found him at ten to one, in his own office. One shot, chest, closer than a handshake.',
    draw(g, w, h) {
      sky(g, w, h, '#0a0a10', '#141018', '#241418');
      // room
      g.fillStyle = '#0c0d13'; g.fillRect(80, 60, 800, 420);
      g.fillStyle = '#151824'; g.fillRect(80, 380, 800, 100);           // floor
      // window with blinds, night outside
      g.fillStyle = '#060913'; g.fillRect(560, 110, 240, 200);
      g.fillStyle = 'rgba(160,190,255,.16)'; g.fillRect(560, 110, 240, 200);
      for (let y = 120; y < 310; y += 18) { g.fillStyle = '#0c0d13'; g.fillRect(560, y, 240, 8); }
      // desk + lamp glow
      g.fillStyle = '#241a12'; g.fillRect(150, 300, 300, 22);
      g.fillStyle = '#171008'; g.fillRect(160, 322, 24, 90); g.fillRect(416, 322, 24, 90);
      const lg = g.createRadialGradient(300, 285, 6, 300, 285, 150);
      lg.addColorStop(0, 'rgba(255,194,122,.5)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg; g.fillRect(100, 130, 400, 300);
      g.fillStyle = '#f2b84b'; g.beginPath(); g.arc(300, 288, 12, 0, 7); g.fill();
      // body chalk outline
      g.strokeStyle = 'rgba(240,240,240,.85)'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(620, 430, 90, 26, -0.15, 0, 7); g.stroke();
      g.beginPath(); g.arc(700, 408, 20, 0, 7); g.stroke();
      // police tape
      g.save(); g.translate(480, 180); g.rotate(-0.12);
      g.fillStyle = '#d8b93a'; g.fillRect(-400, 0, 800, 26);
      g.fillStyle = '#111'; g.font = 'bold 17px monospace'; g.textAlign = 'center';
      g.fillText('POLICE LINE — DO NOT CROSS · POLICE LINE — DO NOT CROSS', 0, 19);
      g.restore();
    } },
  { slug: 'OFFICE 3.14  \u2014  THE SCENE',
    cap: 'No witness. No confession. Two glasses, a stranger\u2019s hair, and a room that refuses to say who was sitting across from him.',
    draw(g, w, h) {
      sky(g, w, h, '#05070d', '#0a0f1c', '#131020');
      // detective silhouette
      g.fillStyle = '#020304';
      g.beginPath(); g.arc(330, 215, 62, 0, 7); g.fill();                 // head
      g.fillRect(238, 168, 184, 26);                                       // hat brim
      g.fillRect(282, 108, 96, 66);                                        // hat top
      g.beginPath(); g.moveTo(200, 540); g.quadraticCurveTo(210, 330, 330, 300);
      g.quadraticCurveTo(450, 330, 460, 540); g.closePath(); g.fill();     // shoulders
      // magnifier over glowing clues
      const mg = g.createRadialGradient(640, 330, 10, 640, 330, 200);
      mg.addColorStop(0, 'rgba(255,220,160,.30)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = mg; g.fillRect(380, 130, 520, 400);
      g.strokeStyle = '#cfd6e4'; g.lineWidth = 10;
      g.beginPath(); g.arc(640, 330, 95, 0, 7); g.stroke();
      g.lineWidth = 16; g.beginPath(); g.moveTo(710, 400); g.lineTo(790, 480); g.stroke();
      // handkerchief with a blood-smeared monogram (the killer is different every run,
      // so the initials are never legible)
      g.fillStyle = '#ddd6c2'; g.save(); g.translate(610, 320); g.rotate(-0.2); g.fillRect(-45, -35, 90, 70); g.restore();
      g.fillStyle = 'rgba(122,31,26,.85)';
      for (const [dx, dy, rx, ry, rot] of [[0, 0, 26, 10, 0.3], [10, 6, 18, 7, -0.4], [-14, 8, 14, 6, 0.8]]) {
        g.beginPath(); g.ellipse(610 + dx, 325 + dy, rx, ry, rot, 0, 7); g.fill();
      }
      g.fillStyle = '#c9a227'; g.fillRect(668, 352, 26, 10);
      g.fillStyle = 'rgba(255,240,200,.5)'; g.fillRect(668, 352, 26, 3);
    } },
  { slug: 'FIVE NAMES',
    cap: 'Five people had a reason to want him quiet. One of them pulled the trigger. The other four are lying about something smaller \u2014 and that makes it harder.',
    draw(g, w, h) {
      sky(g, w, h, '#0b0906', '#17110a', '#241811');
      // cork board
      g.fillStyle = '#3a2a1a'; g.fillRect(130, 60, 700, 420);
      g.fillStyle = '#4a3622'; g.fillRect(142, 72, 676, 396);
      const photos = [[162, 120], [292, 120], [422, 120], [552, 120], [682, 120]];
      const faces = ['S.N.', 'A.M.', 'N.D.', 'K.P.', 'M.D.'];
      photos.forEach(([x, y], i) => {
        g.fillStyle = '#c9c2ae'; g.fillRect(x, y, 110, 130);
        g.fillStyle = '#222'; g.beginPath(); g.arc(x + 55, y + 55, 26, 0, 7); g.fill();
        g.fillRect(x + 20, y + 88, 70, 34);
        g.fillStyle = '#7a1f1a'; g.font = 'bold 22px monospace'; g.textAlign = 'center';
        g.fillText(faces[i], x + 55, y + 118);
        g.fillStyle = '#a1241c'; g.beginPath(); g.arc(x + 55, y - 6, 7, 0, 7); g.fill();
      });
      // red strings to the center note
      g.strokeStyle = 'rgba(200,40,40,.85)'; g.lineWidth = 2.5;
      const cx = 480, cy = 400;
      photos.forEach(([x]) => { g.beginPath(); g.moveTo(x + 55, 250); g.lineTo(cx, cy); g.stroke(); });
      g.fillStyle = '#e8dcc0'; g.fillRect(cx - 110, cy - 24, 220, 52);
      g.fillStyle = '#111'; g.font = 'bold 22px monospace'; g.textAlign = 'center';
      g.fillText('WHO LIED?', cx, cy + 8);
    } },
  { slug: 'CASE #001  \u2014  OPENED',
    cap: 'The file has my name on it now. Read the room. Work the lab. Then take it to the streets before the killer gets comfortable.',
    draw(g, w, h) {
      sky(g, w, h, '#0a0d1a', '#2b1f38', '#59331f');
      // dawn sun band over the sea
      const sg = g.createRadialGradient(620, 330, 10, 620, 330, 260);
      sg.addColorStop(0, 'rgba(255,190,120,.9)'); sg.addColorStop(0.3, 'rgba(255,150,90,.35)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg; g.fillRect(200, 100, 700, 400);
      g.fillStyle = '#0d1420'; g.fillRect(0, 340, w, 200);                  // sea
      g.fillStyle = 'rgba(255,180,110,.35)'; g.fillRect(480, 340, 280, 10);
      g.fillStyle = 'rgba(255,180,110,.20)'; g.fillRect(540, 360, 160, 8);
      // ship silhouette
      g.fillStyle = '#05070c';
      g.fillRect(560, 300, 150, 26); g.fillRect(600, 272, 60, 30); g.fillRect(626, 250, 10, 24);
      // quay railing foreground + detective at the rail
      g.fillStyle = '#020304';
      for (let x = 40; x < w; x += 90) g.fillRect(x, 400, 14, 140);
      g.fillRect(0, 392, w, 14);
      g.beginPath(); g.arc(330, 330, 40, 0, 7); g.fill();
      g.fillRect(272, 300, 116, 16);
      g.beginPath(); g.moveTo(250, 540); g.quadraticCurveTo(258, 400, 330, 384);
      g.quadraticCurveTo(402, 400, 410, 540); g.closePath(); g.fill();
      // gulls
      g.strokeStyle = 'rgba(20,20,30,.9)'; g.lineWidth = 3;
      for (const [x, y, s] of [[180, 140, 14], [250, 110, 10], [800, 150, 12]]) {
        g.beginPath(); g.arc(x - s, y, s, 3.4, 5.9); g.stroke();
        g.beginPath(); g.arc(x + s, y, s, 3.5, 6.0); g.stroke();
      }
    } },
];
