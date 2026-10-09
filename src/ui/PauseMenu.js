// src/ui/PauseMenu.js
// Pause / options overlay. Opens on Esc mid-game — via the pointer-lock
// release (when the mouse is captured) or directly via the Escape key
// (when it is not). Lets the player adjust audio and mouse sensitivity,
// restart the current level, or quit to the main menu — all without
// refreshing the page.

export class PauseMenu {
  constructor({
    audioManager,
    initialSensitivity = 0.0022,
    onSensitivityChange = () => {},
    onResume = () => {},
    onRestartLevel = () => {},
    onControls = () => {},
    onQuitToMenu = () => {},
  }) {
    this.audioManager = audioManager;
    this.visible = false;

    this._onSensitivityChange = onSensitivityChange;
    this._onResume = onResume;
    this._onRestartLevel = onRestartLevel;
    this._onControls = onControls;
    this._onQuitToMenu = onQuitToMenu;

    this.container = document.createElement('div');
    this.container.id = 'pause-menu';
    Object.assign(this.container.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0, 5, 15, 0.78)',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '300',
      fontFamily: "'Courier New', monospace",
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      background: 'rgba(2, 10, 20, 0.92)',
      border: '2px solid #00ffff',
      borderRadius: '16px',
      boxShadow: '0 0 60px rgba(0, 255, 255, 0.15)',
      padding: '40px 60px',
      textAlign: 'center',
      color: '#d8f4ff',
      minWidth: '340px',
    });

    const title = document.createElement('h2');
    title.innerText = 'PAUSED';
    Object.assign(title.style, {
      margin: '0 0 26px 0',
      fontSize: '2.2rem',
      letterSpacing: '8px',
      color: '#00ffff',
      textShadow: '0 0 30px rgba(0,255,255,0.4)',
      fontWeight: '700',
    });
    panel.appendChild(title);

    panel.appendChild(this._makeButton('RESUME', () => this._onResume()));
    panel.appendChild(this._makeButton('RESTART LEVEL', () => this._onRestartLevel()));
    panel.appendChild(this._makeButton('CONTROLS', () => this._onControls()));
    panel.appendChild(this._makeButton('QUIT TO MENU', () => this._onQuitToMenu()));

    // ── Options ──
    panel.appendChild(this._makeDivider());
    const optsTitle = document.createElement('div');
    optsTitle.innerText = 'OPTIONS';
    Object.assign(optsTitle.style, {
      fontSize: '0.8rem',
      letterSpacing: '3px',
      color: '#88dddd',
      marginBottom: '16px',
    });
    panel.appendChild(optsTitle);

    panel.appendChild(this._makeSlider(
      'MUSIC', this.audioManager.musicVolume, 0, 1, 0.05,
      (v) => this.audioManager.setMusicVolume(v),
      (v) => Math.round(v * 100) + '%'
    ));
    panel.appendChild(this._makeSlider(
      'SFX', this.audioManager.sfxVolume, 0, 1, 0.05,
      (v) => this.audioManager.setSfxVolume(v),
      (v) => Math.round(v * 100) + '%'
    ));
    panel.appendChild(this._makeSlider(
      'MOUSE', initialSensitivity, 0.0005, 0.005, 0.0001,
      (v) => this._onSensitivityChange(v),
      (v) => Math.round((v / 0.0022) * 100) + '%'
    ));
    panel.appendChild(this._makeMuteToggle());

    this.container.appendChild(panel);
    document.body.appendChild(this.container);
  }

  show() {
    this.container.style.display = 'flex';
    this.visible = true;
  }

  hide() {
    this.container.style.display = 'none';
    this.visible = false;
  }

  // Un-pause via the RESUME button or the Esc key (main.js keydown).
  resume() {
    this._onResume();
  }

  _makeButton(label, onClick) {
    const btn = document.createElement('button');
    btn.innerText = label;
    Object.assign(btn.style, {
      display: 'block',
      width: '240px',
      margin: '0 auto 12px',
      background: 'transparent',
      border: '2px solid #555',
      color: '#aaa',
      padding: '12px 30px',
      fontSize: '1rem',
      letterSpacing: '2px',
      cursor: 'pointer',
      borderRadius: '8px',
      transition: 'all 0.2s ease',
      fontFamily: 'inherit',
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = '#00ffff';
      btn.style.color = '#00ffff';
      btn.style.background = 'rgba(0,255,255,0.1)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = '#555';
      btn.style.color = '#aaa';
      btn.style.background = 'transparent';
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  _makeDivider() {
    const div = document.createElement('div');
    Object.assign(div.style, {
      width: '240px',
      height: '1px',
      margin: '22px auto',
      background: 'rgba(0,255,255,0.25)',
    });
    return div;
  }

  _makeSlider(label, value, min, max, step, onChange, format) {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      width: '300px',
      margin: '0 auto 12px',
      fontSize: '0.75rem',
      letterSpacing: '2px',
      color: '#aaa',
    });

    const name = document.createElement('span');
    name.innerText = label;
    name.style.width = '52px';
    name.style.textAlign = 'left';
    row.appendChild(name);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    Object.assign(input.style, {
      flex: '1',
      accentColor: '#00ffff',
      cursor: 'pointer',
    });
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      valueDisplay.innerText = format(v);
      onChange(v);
    });
    row.appendChild(input);

    const valueDisplay = document.createElement('span');
    valueDisplay.innerText = format(value);
    valueDisplay.style.width = '44px';
    valueDisplay.style.textAlign = 'right';
    valueDisplay.style.color = '#d8f4ff';
    row.appendChild(valueDisplay);

    return row;
  }

  _makeMuteToggle() {
    const btn = document.createElement('button');
    const refresh = () => {
      btn.innerText = this.audioManager.isMuted ? 'SOUND: OFF' : 'SOUND: ON';
      btn.style.borderColor = this.audioManager.isMuted ? '#ff5555' : '#555';
      btn.style.color = this.audioManager.isMuted ? '#ff5555' : '#aaa';
    };
    Object.assign(btn.style, {
      display: 'block',
      width: '240px',
      margin: '4px auto 0',
      background: 'transparent',
      border: '2px solid #555',
      padding: '8px 30px',
      fontSize: '0.85rem',
      letterSpacing: '2px',
      cursor: 'pointer',
      borderRadius: '8px',
      transition: 'all 0.2s ease',
      fontFamily: 'inherit',
    });
    btn.addEventListener('click', () => {
      this.audioManager.toggleMute();
      refresh();
    });
    refresh();
    return btn;
  }
}
