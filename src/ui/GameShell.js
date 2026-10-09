// ============================================================
// GameShell — main menu, settings, credits, pause, level cards,
// fade transitions, save slots and the painted story intro.
// All overlays live at z-index 20000+, above every level UI.
// Styling: noir / Courier, amber + cyan on near-black.
// ============================================================

const SAVE_KEY = 'genesis.save.v1';
const SETTINGS_KEY = 'genesis.settings.v1';

export const LEVEL_CARDS = {
  1: { title: 'LEVEL 1', sub: 'THE OFFICE', line: 'Dr. Nkosi is dead. The room remembers everything.' },
  2: { title: 'LEVEL 2', sub: 'THE CITY', line: 'Five people know something about tonight.' },
  3: { title: 'LEVEL 3', sub: 'THE CELLS', line: 'Three names on the list. One pulled the trigger.' },
};

const CSS = `
#gs-veil{position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .45s ease;z-index:20000}
#gs-veil.on{opacity:1;pointer-events:auto}
.gs-screen{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:20001;
  font-family:"Courier New",monospace;color:#e9d9b0;background:rgba(2,3,6,.88)}
.gs-screen.on{display:flex}
.gs-card{max-width:min(680px,93vw);max-height:92vh;overflow:auto;text-align:center;
  background:rgba(6,8,13,.96);border:1px solid #3c4656;padding:34px 42px;box-shadow:0 0 60px rgba(0,0,0,.8)}
.gs-title{font-size:52px;letter-spacing:10px;color:#f2b84b;margin:0;text-shadow:0 0 26px rgba(242,184,75,.35)}
.gs-sub{letter-spacing:5px;font-size:13px;color:#7fd4ff;margin:8px 0 26px}
.gs-btn{display:block;width:300px;margin:9px auto;padding:13px 18px;font:inherit;font-size:16px;letter-spacing:2px;
  cursor:pointer;border:1px solid #334052;background:#141a24;color:#e9d9b0;transition:all .15s}
.gs-btn:hover:not(:disabled){border-color:#f2b84b;color:#f2b84b;background:#1c222e}
.gs-btn.primary{background:#a1241c;border-color:#a1241c;color:#fff}
.gs-btn.primary:hover:not(:disabled){background:#c22e23;color:#fff;border-color:#c22e23}
.gs-btn:disabled{opacity:.35;cursor:default}
.gs-btn.small{width:220px;font-size:13px;padding:9px 12px}
.gs-row{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:12px auto;max-width:340px;font-size:14px}
.gs-row input[type=range]{flex:1;accent-color:#f2b84b}
.gs-row input[type=checkbox]{transform:scale(1.4);accent-color:#a1241c}
.gs-body{font-size:14px;line-height:1.8;text-align:left;opacity:.92}
.gs-body b{color:#f2b84b}
.gs-foot{margin-top:18px;font-size:12px;opacity:.55}
#gs-card-title{font-size:40px;letter-spacing:8px;color:#f2b84b;margin:0}
#gs-card-sub{letter-spacing:6px;color:#7fd4ff;font-size:16px;margin:10px 0}
#gs-card-line{font-style:italic;opacity:.75;font-size:14px}
/* intro */
#gs-intro .gs-card{max-width:min(1020px,95vw);padding:22px}
#gs-canvas{width:min(900px,88vw);aspect-ratio:16/9;background:#05070c;border:1px solid #2c3440;display:block;overflow:hidden}
#gs-canvas canvas{width:100%;height:100%;display:block;animation:kenburns 7s ease-out forwards}
@keyframes kenburns{from{transform:scale(1)}to{transform:scale(1.09)}}
#gs-caption{min-height:52px;margin:14px auto 4px;font-size:17px;line-height:1.6;max-width:820px}
#gs-dots{margin:8px 0 4px;letter-spacing:6px;font-size:12px;color:#7fd4ff}
#gs-dots .dim{opacity:.3}
.gs-introbar{display:flex;gap:12px;justify-content:center;margin-top:10px}
`;

function el(html) {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstChild;
}

export class GameShell {
  constructor(opts = {}) {
    this.cb = opts;                       // onNewGame, onContinue, onResume, onRestartLevel, onQuitToMenu
    this.audio = opts.audio || null;
    this.settings = this._loadSettings();
    this._applySettings();
    this._pauseFrom = null;               // 'pause' | 'settings-return'

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
  }

  // ================= settings + saves =================
  _loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (s && typeof s === 'object') return { music: 0.7, sfx: 0.8, muted: false, ...s };
    } catch (e) {}
    return { music: 0.7, sfx: 0.8, muted: false };
  }
  _applySettings() {
    if (!this.audio) return;
    this.audio.setMusicVolume(this.settings.music);
    this.audio.setSfxVolume(this.settings.sfx);
    this.audio.setMuted(this.settings.muted);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
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
    this.root.appendChild(node);
    this.screens[name] = node;
  }
  show(name) {
    for (const k of Object.keys(this.screens)) this.screens[k].classList.remove('on');
    if (this.screens[name]) this.screens[name].classList.add('on');
    this._syncHudPause();
  }
  hideAll() {
    for (const k of Object.keys(this.screens)) this.screens[k].classList.remove('on');
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
    await work();
    if (cardN && LEVEL_CARDS[cardN]) {
      this.showCard(cardN);
      await new Promise((r) => setTimeout(r, 500));
      await this.fade(false);
      await new Promise((r) => setTimeout(r, 1400));
      this.hideAll();
    } else {
      await this.fade(false);
    }
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
      <div class="gs-card">
        <p class="gs-title">GENESIS</p>
        <p class="gs-sub">· A MURDER MYSTERY ·</p>
        <p style="font-style:italic;opacity:.7;font-size:14px;margin:0 0 22px">Dr. Nkosi is dead. Three levels. Five liars. One truth.</p>
        <button class="gs-btn primary" id="gs-new">▶&nbsp; NEW GAME</button>
        <button class="gs-btn" id="gs-continue">↻&nbsp; CONTINUE</button>
        <button class="gs-btn" id="gs-how">HOW TO PLAY</button>
        <button class="gs-btn" id="gs-settings">SETTINGS</button>
        <button class="gs-btn" id="gs-credits">CREDITS</button>
        <p class="gs-foot">WASD + mouse · E examine · F torch · C case file · P pause</p>
      </div></div>`);
    n.querySelector('#gs-new').addEventListener('click', () => this.cb.onNewGame && this.cb.onNewGame());
    n.querySelector('#gs-continue').addEventListener('click', () => this.cb.onContinue && this.cb.onContinue());
    n.querySelector('#gs-how').addEventListener('click', () => this.show('howto'));
    n.querySelector('#gs-settings').addEventListener('click', () => { this._pauseFrom = 'menu'; this.show('settings'); });
    n.querySelector('#gs-credits').addEventListener('click', () => this.show('credits'));
    this._addScreen('menu', n);
  }
  refreshMenu() {
    const b = this.screens.menu && this.screens.menu.querySelector('#gs-continue');
    if (!b) return;
    const s = this.loadGame();
    b.disabled = !s;
    b.innerHTML = s ? `↻&nbsp; CONTINUE — LEVEL ${s.level}` : '↻&nbsp; CONTINUE';
  }
  showMenu() { this.refreshMenu(); this.show('menu'); }

  _buildHowto() {
    const n = el(`<div>
      <div class="gs-card"><p class="gs-title" style="font-size:34px">HOW TO PLAY</p>
      <div class="gs-body">
        <p><b>MOVE</b> — W / S walk, A / D (or mouse) turn. SHIFT sprints, SPACE jumps. Click the scene to grab the mouse.</p>
        <p><b>E</b> — question people, collect evidence. <b>F</b> — UV torch (one clue needs it). <b>C</b> — case file.</p>
        <p><b>LEVEL 1 — THE OFFICE.</b> Log every clue, then close the room.</p>
        <p><b>LEVEL 2 — THE CITY.</b> Question all five witnesses, work the three street clues, seal the suspect list of three.</p>
        <p><b>LEVEL 3 — THE CELLS.</b> Show each prisoner the right evidence, then accuse the killer.</p>
        <p><b>P / Esc / ⏸</b> — pause. <b>R</b> — restart the level. Progress auto-saves on every level change.</p>
      </div>
      <button class="gs-btn small" id="gs-how-back">← BACK</button></div></div>`);
    n.querySelector('#gs-how-back').addEventListener('click', () => this.show('menu'));
    this._addScreen('howto', n);
  }

  _buildSettings() {
    const n = el(`<div>
      <div class="gs-card"><p class="gs-title" style="font-size:34px">SETTINGS</p>
        <div class="gs-row"><span>MUSIC</span><input id="gs-music" type="range" min="0" max="100"><b id="gs-music-v"></b></div>
        <div class="gs-row"><span>SOUND FX</span><input id="gs-sfx" type="range" min="0" max="100"><b id="gs-sfx-v"></b></div>
        <div class="gs-row"><span>MUTE ALL</span><input id="gs-mute" type="checkbox"></div>
        <button class="gs-btn small" id="gs-set-back">← BACK</button></div></div>`);
    const m = n.querySelector('#gs-music'), s = n.querySelector('#gs-sfx'), mu = n.querySelector('#gs-mute');
    const paint = () => {
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
  }
  openSettings(from) { this._pauseFrom = from; if (this._paintSettings) this._paintSettings(); this.show('settings'); }

  _buildCredits() {
    const n = el(`<div>
      <div class="gs-card"><p class="gs-title" style="font-size:34px">CREDITS</p>
      <div class="gs-body">
        <p><b>GENESIS</b><br>A three-level murder mystery: the office, the city, the cells.</p>
        <p><b>MADE BY — 404 FOUND US</b><br>
        Banele Mjali<br>
        Busisiwe Mnguni<br>
        Pumelela Mapukata<br>
        Sibusiso Ndunge</p>
        <p><b>STORY & CASE</b> — Dr. T. Nkosi, the five witnesses, and the sealed list of three.</p>
        <p><b>MUSIC</b> — all tracks from OpenGameArt.org<br>
        <span style="opacity:.7">menu theme · office chiptune · city orchestral · cells electronic · city traffic ambience</span></p>
        <p><b>ENGINE</b> — Three.js · Howler.js · Vite</p>
        <p style="opacity:.65">Thanks for playing detective.</p>
      </div>
      <button class="gs-btn small" id="gs-cr-back">← BACK</button></div></div>`);
    n.querySelector('#gs-cr-back').addEventListener('click', () => this.show('menu'));
    this._addScreen('credits', n);
  }

  // ================= pause =================
  _buildPause() {
    const n = el(`<div>
      <div class="gs-card"><p class="gs-title" style="font-size:34px">PAUSED</p>
        <p class="gs-sub" id="gs-pause-sub">LEVEL 1 — THE OFFICE</p>
        <button class="gs-btn primary" id="gs-resume">▶&nbsp; RESUME</button>
        <button class="gs-btn" id="gs-restart">↻&nbsp; RESTART LEVEL</button>
        <button class="gs-btn" id="gs-pset">SETTINGS</button>
        <button class="gs-btn" id="gs-quit">QUIT TO MENU</button></div></div>`);
    n.querySelector('#gs-resume').addEventListener('click', () => this.cb.onResume && this.cb.onResume());
    n.querySelector('#gs-restart').addEventListener('click', () => this.cb.onRestartLevel && this.cb.onRestartLevel());
    n.querySelector('#gs-pset').addEventListener('click', () => this.openSettings('pause'));
    n.querySelector('#gs-quit').addEventListener('click', () => this.cb.onQuitToMenu && this.cb.onQuitToMenu());
    this._addScreen('pause', n);
  }
  showPause(levelName) {
    document.getElementById('gs-pause-sub').textContent = levelName || '';
    this.show('pause');
  }

  _buildCard() {
    const n = el(`<div style="background:rgba(1,2,4,.0)">
      <div style="text-align:center">
        <p id="gs-card-title"></p><p id="gs-card-sub"></p><p id="gs-card-line"></p>
      </div></div>`);
    this._addScreen('card', n);
  }

  // ================= painted intro =================
  _buildIntro() {
    const n = el(`<div id="gs-intro">
      <div class="gs-card">
        <div id="gs-canvas"><canvas id="gs-art" width="960" height="540"></canvas></div>
        <p id="gs-caption"></p>
        <div id="gs-dots"></div>
        <div class="gs-introbar">
          <button class="gs-btn small" id="gs-skip">SKIP →</button>
          <button class="gs-btn small primary" id="gs-next">NEXT →</button>
        </div>
      </div></div>`);
    this._addScreen('intro', n);
    this._art = n.querySelector('#gs-art');
    this._cap = n.querySelector('#gs-caption');
    this._dots = n.querySelector('#gs-dots');
    this._next = n.querySelector('#gs-next');
    n.querySelector('#gs-skip').addEventListener('click', () => this._finishIntro());
    this._next.addEventListener('click', () => {
      if (this._introIdx >= INTRO_PANELS.length - 1) this._finishIntro();
      else this._showPanel(this._introIdx + 1);
    });
  }
  showIntro(onDone) {
    this._introDone = onDone;
    this._showPanel(0);
    this.show('intro');
  }
  _finishIntro() {
    const cb = this._introDone;
    this._introDone = null;
    this.hideAll();
    if (cb) cb();
  }
  _showPanel(i) {
    this._introIdx = i;
    const g = this._art.getContext('2d');
    INTRO_PANELS[i].draw(g, 960, 540);
    // restart the slow zoom
    const cv = this._art;
    cv.style.animation = 'none'; void cv.offsetWidth; cv.style.animation = '';
    this._cap.textContent = INTRO_PANELS[i].cap;
    this._dots.innerHTML = INTRO_PANELS.map((_, k) =>
      `<span class="${k === i ? '' : 'dim'}">●</span>`).join('');
    this._next.innerHTML = (i === INTRO_PANELS.length - 1) ? 'BEGIN THE INVESTIGATION →' : 'NEXT →';
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
  { cap: 'CENTRAL CITY, OCTOBER — rain for three days straight, and nobody is sleeping.',
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
  { cap: 'DR. THABO NKOSI — found dead in his university office. One gunshot, close range.',
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
  { cap: 'No witnesses. No confession. Only what the room remembers.',
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
      // handkerchief + casing inside the lens
      g.fillStyle = '#ddd6c2'; g.save(); g.translate(610, 320); g.rotate(-0.2); g.fillRect(-45, -35, 90, 70); g.restore();
      g.fillStyle = '#7a1f1a'; g.font = 'bold 34px monospace'; g.textAlign = 'center'; g.fillText('K.P.', 610, 333);
      g.fillStyle = '#c9a227'; g.fillRect(668, 352, 26, 10);
      g.fillStyle = 'rgba(255,240,200,.5)'; g.fillRect(668, 352, 26, 3);
    } },
  { cap: 'Five names in the city. Three of them are lying.',
    draw(g, w, h) {
      sky(g, w, h, '#0b0906', '#17110a', '#241811');
      // cork board
      g.fillStyle = '#3a2a1a'; g.fillRect(130, 60, 700, 420);
      g.fillStyle = '#4a3622'; g.fillRect(142, 72, 676, 396);
      const photos = [[180, 120], [330, 120], [480, 120], [630, 120], [255, 290], [405, 290], [555, 290]];
      const faces = ['S.N.', 'A.M.', 'N.D.', 'K.P.', 'M.D.', '?', '?'];
      photos.forEach(([x, y], i) => {
        g.fillStyle = i < 5 ? '#c9c2ae' : '#5a5a5a'; g.fillRect(x, y, 110, 130);
        g.fillStyle = '#222'; g.beginPath(); g.arc(x + 55, y + 55, 26, 0, 7); g.fill();
        g.fillRect(x + 20, y + 88, 70, 34);
        g.fillStyle = '#7a1f1a'; g.font = 'bold 22px monospace'; g.textAlign = 'center';
        g.fillText(faces[i], x + 55, y + 118);
        g.fillStyle = '#a1241c'; g.beginPath(); g.arc(x + 55, y - 6, 7, 0, 7); g.fill();
      });
      // red strings to the center note
      g.strokeStyle = 'rgba(200,40,40,.85)'; g.lineWidth = 2.5;
      const cx = 480, cy = 420;
      photos.forEach(([x]) => { g.beginPath(); g.moveTo(x + 55, 250); g.lineTo(cx, cy); g.stroke(); });
      g.fillStyle = '#e8dcc0'; g.fillRect(cx - 130, cy - 24, 260, 52);
      g.fillStyle = '#111'; g.font = 'bold 21px monospace'; g.textAlign = 'center';
      g.fillText('WHO STAYS OFF THE LIST?', cx, cy + 8);
    } },
  { cap: 'You are the investigator. Question all five. Seal the list of three.',
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
