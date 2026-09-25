// ============================================================
// Dialogue.js — simple DOM overlay for the Architect's speech
// Shows lines of text, then up to three choice buttons.
// Returns a promise that resolves with the chosen index.
// ============================================================

export class Dialogue {
  constructor() {
    this.container = null;
    this.textEl = null;
    this.choicesEl = null;
    this.active = false;
    this._resolveChoice = null;

    this._build();
  }

  _build() {
    this.container = document.createElement('div');
    this.container.id = 'dialogueOverlay';
    Object.assign(this.container.style, {
      position: 'fixed',
      bottom: '0',
      left: '0',
      right: '0',
      padding: '40px 20px 60px',
      background: 'linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0))',
      color: '#e8f0ff',
      fontFamily: 'Georgia, serif',
      pointerEvents: 'none',
      zIndex: '200',
      display: 'none',
      textAlign: 'center',
    });

    this.textEl = document.createElement('div');
    Object.assign(this.textEl.style, {
      maxWidth: '760px',
      margin: '0 auto',
      fontSize: '1.3rem',
      lineHeight: '1.7',
      textShadow: '0 2px 8px rgba(0,0,0,0.9)',
      minHeight: '60px',
      transition: 'opacity 0.5s',
      whiteSpace: 'pre-line',
    });
    this.container.appendChild(this.textEl);

    this.choicesEl = document.createElement('div');
    Object.assign(this.choicesEl.style, {
      marginTop: '28px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      pointerEvents: 'auto',
    });
    this.container.appendChild(this.choicesEl);

    document.body.appendChild(this.container);
  }

  // Show a line of dialogue. Returns a promise that resolves
  // after the line has been displayed for `duration` ms.
  say(text, duration = 4000) {
    return new Promise((resolve) => {
      this.container.style.display = 'block';
      this.active = true;
      this.textEl.style.opacity = '0';
      this.textEl.innerText = text;
      this.choicesEl.innerHTML = '';

      // Fade in
      requestAnimationFrame(() => {
        this.textEl.style.opacity = '1';
      });

      setTimeout(() => {
        this.textEl.style.opacity = '0';
        setTimeout(() => resolve(), 500);
      }, duration);
    });
  }

  // Show choices. Returns a promise that resolves with the
  // chosen index (0-based). Also binds keys 1/2/3.
  ask(text, choices) {
    return new Promise((resolve) => {
      this.container.style.display = 'block';
      this.active = true;
      this.textEl.style.opacity = '0';
      this.textEl.innerText = text;
      this.choicesEl.innerHTML = '';
      this._resolveChoice = resolve;

      requestAnimationFrame(() => {
        this.textEl.style.opacity = '1';
      });

      // Create buttons
      choices.forEach((label, i) => {
        const btn = document.createElement('button');
        btn.innerText = `${i + 1}.  ${label}`;
        Object.assign(btn.style, {
          background: 'rgba(20,40,60,0.85)',
          color: '#c8e8ff',
          border: '1px solid #4a9eff',
          borderRadius: '4px',
          padding: '10px 24px',
          fontSize: '1rem',
          fontFamily: 'Georgia, serif',
          cursor: 'pointer',
          minWidth: '320px',
          transition: 'all 0.15s',
        });
        btn.addEventListener('mouseenter', () => {
          btn.style.background = 'rgba(40,80,120,0.95)';
          btn.style.borderColor = '#8fd0ff';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = 'rgba(20,40,60,0.85)';
          btn.style.borderColor = '#4a9eff';
        });
        btn.addEventListener('click', () => this._choose(i));
        this.choicesEl.appendChild(btn);
      });
    });
  }

  _choose(index) {
    if (!this._resolveChoice) return;
    const resolve = this._resolveChoice;
    this._resolveChoice = null;
    this.choicesEl.innerHTML = '';
    resolve(index);
  }

  // Called from main.js when a key is pressed while dialogue
  // is active. Maps 1/2/3 to choices.
  handleKey(code) {
    if (!this._resolveChoice) return;
    if (code === 'Digit1' || code === 'Numpad1') this._choose(0);
    if (code === 'Digit2' || code === 'Numpad2') this._choose(1);
    if (code === 'Digit3' || code === 'Numpad3') this._choose(2);
  }

  hide() {
    this.container.style.display = 'none';
    this.textEl.innerText = '';
    this.choicesEl.innerHTML = '';
    this.active = false;
    this._resolveChoice = null;
  }

  dispose() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.textEl = null;
    this.choicesEl = null;
  }
}