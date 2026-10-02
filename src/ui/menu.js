// menu.js
// Start screen + pause menu for The Last Order.
// Main menu: Start Game, Story, Credits, Quit.
// Pause (in-game ⏸ button, P or Esc): Resume, Restart Level, Story, Credits, Quit to Menu.
// Quit on web cannot close the tab reliably, so it shows a farewell screen instead.

const CSS = `
.gm-root{position:fixed;inset:0;z-index:900;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 35%,rgba(20,26,58,.92),rgba(3,4,9,.96));font-family:Georgia,'Times New Roman',serif;color:#ece6d6;user-select:none;}
.gm-root.gm-hidden{display:none;}
.gm-card{width:min(560px,90vw);max-height:88vh;overflow:auto;text-align:center;padding:38px 44px;background:rgba(4,8,14,.82);border:1px solid rgba(243,217,139,.35);border-radius:6px;box-shadow:0 0 60px rgba(0,0,0,.7);}
.gm-kicker{font-size:11px;letter-spacing:.34em;color:#7ff5e0;margin-bottom:10px;}
.gm-title{font-size:clamp(30px,5vw,46px);letter-spacing:.12em;color:#f3d98b;margin:0 0 6px;}
.gm-sub{font-size:14px;color:#9fb8b2;letter-spacing:.06em;margin-bottom:26px;line-height:1.6;}
.gm-btns{display:flex;flex-direction:column;gap:10px;}
.gm-btn{background:rgba(255,255,255,.03);color:#ece6d6;border:1px solid rgba(243,217,139,.4);border-radius:4px;padding:12px 18px;font:16px Georgia,serif;letter-spacing:.14em;cursor:pointer;transition:background .15s,color .15s;}
.gm-btn:hover{background:rgba(243,217,139,.14);color:#fff;}
.gm-btn.gm-primary{background:rgba(127,245,224,.1);border-color:rgba(127,245,224,.55);color:#dffff5;}
.gm-btn.gm-primary:hover{background:rgba(127,245,224,.22);}
.gm-panel{text-align:left;font-size:14.5px;line-height:1.65;color:#cfc8b6;white-space:pre-wrap;margin:6px 0 18px;max-height:40vh;overflow:auto;}
.gm-panel b{color:#f3d98b;font-weight:normal;letter-spacing:.06em;}
.gm-panel a{color:#7ff5e0;}
.gm-foot{margin-top:18px;font-size:11px;letter-spacing:.18em;color:#8d8878;}
.gm-back{background:none;border:none;color:#8d8878;font:13px Georgia,serif;letter-spacing:.14em;cursor:pointer;margin-top:14px;}
.gm-back:hover{color:#fff;}
.gm-pausebtn{position:fixed;top:14px;right:14px;z-index:800;width:42px;height:42px;border-radius:50%;background:rgba(0,0,0,.55);color:#f3d98b;border:1px solid rgba(243,217,139,.45);font-size:17px;cursor:pointer;display:none;align-items:center;justify-content:center;}
.gm-pausebtn:hover{background:rgba(243,217,139,.18);}
.gm-pausebtn.gm-show{display:flex;}
`;

function injectStyle() {
  if (document.getElementById('gm-style')) return;
  const el = document.createElement('style');
  el.id = 'gm-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

const STORY_TEXT =
  `You are an agent of the Interstellar Bureau.\n\n` +
  `Your former partner Haru — an alien who retired to Earth to live as a human ` +
  `in a Japanese village — has been found murdered in his own house at dusk.\n\n` +
  `Search his house. Follow his last coffee order to the hidden alien district of Neon Street. ` +
  `Question three suspects. Then name the killer on the moon.\n\n` +
  `Loop for every level: collect, question, decide.`;

const CREDITS_TEXT =
  `GENESIS CASE FILES — Case: The Last Order\n` +
  `by 404 Found Us\n` +
  `Banele Mjali · Busisiwe Innocentia Mnguni · Sibusiso Ndunge · Pumelela Mapukata\n\n` +
  `ENGINE + LIBS\n` +
  `• three.js (3D rendering)\n` +
  `• vite (dev server + build)\n` +
  `• cannon-es (player physics body — planned)\n` +
  `• howler (audio — planned)\n\n` +
  `EXTERNAL RESOURCES (replace with author + licence before release)\n` +
  `• Textures: burner.png, skybox1.png, Road.png, ground.png, brick.png, poster.png\n` +
  `• Models: light.glb, Spaceship.fbx, space_ship_hallway.glb\n` +
  `• Audio: level_1_chiptune.mp3, level_2_orchestral.mp3, level_3_electronic.mp3 + sfx/\n` +
  `• Fonts/icons: system + Georgia serif (no external font)\n\n` +
  `If any asset above is downloaded, add its author, source URL and licence here. ` +
  `Anything drawn in code (house interior, intro SVG panels, scan shader) needs no credit.`;

export class GameMenu {
  constructor({ onStart, onRestart, onQuitToMenu } = {}) {
    injectStyle();
    this.onStart = onStart || (() => {});
    this.onRestart = onRestart || (() => {});
    this.onQuitToMenu = onQuitToMenu || (() => {});
    this.mode = 'main'; // main | story | credits | farewell
    this.pauseOpen = false;
    this._build();
  }

  _build() {
    this.root = document.createElement('div');
    this.root.className = 'gm-root';
    this.root.innerHTML =
      '<div class="gm-card">' +
      '<div class="gm-kicker">404 FOUND US PRESENTS</div>' +
      '<h1 class="gm-title">GENESIS CASE FILES</h1>' +
      '<div class="gm-sub">Case: The Last Order — a first-person space-cop murder mystery.<br>No combat — collect, question, decide.</div>' +
      '<div class="gm-panel" style="display:none"></div>' +
      '<div class="gm-btns"></div>' +
      '<button class="gm-back" type="button" style="display:none">← BACK</button>' +
      '<div class="gm-foot">WASD MOVE · MOUSE LOOK · Q SCANNER · E EXAMINE</div>' +
      '</div>';
    document.body.appendChild(this.root);
    this.elPanel = this.root.querySelector('.gm-panel');
    this.elBtns = this.root.querySelector('.gm-btns');
    this.elBack = this.root.querySelector('.gm-back');
    this.elBack.addEventListener('click', () => this._render(this.pauseOpen ? 'pause' : 'main'));

    this.pauseBtn = document.createElement('button');
    this.pauseBtn.className = 'gm-pausebtn';
    this.pauseBtn.type = 'button';
    this.pauseBtn.textContent = '⏸';
    this.pauseBtn.title = 'Pause (P / Esc)';
    this.pauseBtn.setAttribute('aria-label', 'Pause');
    this.pauseBtn.addEventListener('click', () => this.setPaused(true));
    document.body.appendChild(this.pauseBtn);

    this._render('main');
  }

  _render(mode) {
    this.mode = mode;
    const B = (label, fn, cls) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gm-btn' + (cls ? ' ' + cls : '');
      b.textContent = label;
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    this.elBtns.innerHTML = '';
    this.elPanel.style.display = 'none';
    this.elBack.style.display = 'none';

    if (mode === 'main') {
      this.pauseOpen = false;
      this.elBtns.append(
        B('START GAME', () => this.onStart(), 'gm-primary'),
        B('STORY', () => this._render('story')),
        B('CREDITS', () => this._render('credits')),
        B('QUIT', () => this._render('farewell')),
      );
    } else if (mode === 'pause') {
      this.pauseOpen = true;
      this.elBtns.append(
        B('RESUME', () => this.setPaused(false), 'gm-primary'),
        B('RESTART LEVEL', () => this.onRestart()),
        B('STORY', () => this._render('story')),
        B('CREDITS', () => this._render('credits')),
        B('QUIT TO MENU', () => this.onQuitToMenu()),
        B('QUIT GAME', () => this._render('farewell')),
      );
    } else if (mode === 'story' || mode === 'credits') {
      this.elPanel.textContent = mode === 'story' ? STORY_TEXT : CREDITS_TEXT;
      this.elPanel.style.display = 'block';
      this.elBack.style.display = 'inline';
      this.elBtns.append(
        this.pauseOpen
          ? B('RESUME', () => this.setPaused(false), 'gm-primary')
          : B('START GAME', () => this.onStart(), 'gm-primary'),
      );
    } else if (mode === 'farewell') {
      this.elPanel.textContent =
        `Thanks for playing GENESIS CASE FILES.\n\n` +
        `Browsers block tabs from closing themselves, so just close this tab — ` +
        `your case file is safe.`;
      this.elPanel.style.display = 'block';
      this.elBack.style.display = 'inline';
      const closeBtn = B('CLOSE TAB', () => window.close());
      this.elBtns.append(closeBtn);
      const note = document.createElement('div');
      note.className = 'gm-foot';
      note.textContent = 'IF NOTHING HAPPENS, CLOSE THE TAB MANUALLY.';
      this.elBtns.append(note);
    }
  }

  showMain() {
    this.root.classList.remove('gm-hidden');
    this.pauseBtn.classList.remove('gm-show');
    this._render('main');
  }

  hideAll() {
    this.root.classList.add('gm-hidden');
    this.pauseBtn.classList.add('gm-show');
  }

  // Called from main.js. Returns true if now paused.
  setPaused(paused) {
    this.pauseOpen = paused;
    if (paused) {
      if (document.pointerLockElement) document.exitPointerLock();
      this.root.classList.remove('gm-hidden');
      this._render('pause');
    } else {
      this.root.classList.add('gm-hidden');
      this.pauseBtn.classList.add('gm-show');
    }
    return paused;
  }

  get paused() {
    return this.pauseOpen;
  }

  dispose() {
    this.root.remove();
    this.pauseBtn.remove();
  }
}
