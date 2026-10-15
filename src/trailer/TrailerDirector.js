// ============================================================
// src/trailer/TrailerDirector.js
// Hands-free trailer mode — "attract mode" for capturing footage.
//
// Press F9 (or the TRAILER menu button, or open ?trailer=1) and the
// game plays its own trailer prologue with zero input:
//
//   1. HOME     — Sorini asleep in her house
//   2. THE FALL — the artifact crash-lands outside her window
//   3. VISITOR  — it drifts in and docks in her chest ("Sorini.")
//   4. TAKING   — it takes her body and will (l1_axiom_3 VO)
//   5. INVASION — it carries her to Level 1's war (ships overhead)
//
// …then hands control to Level 1, whose own cinematic intro
// (8-shot camera + full Axiom dialogue) plays automatically.
//
// The prologue renders through the MAIN renderer on its own scene,
// so a single OBS capture records everything. ESC skips to gameplay.
// Voice lines are the game's real files — no new narration needed.
// ============================================================
import * as THREE from 'three';
import { CinematicCamera } from '../ui/CinematicCamera.js';
import { PreludeScene } from './PreludeScene.js';

export class TrailerDirector {
  constructor({ renderer, audioManager, uiManager, menuScene, menuCanvas, onFinish }) {
    this._renderer = renderer;
    this._audio = audioManager;
    this._ui = uiManager;
    this._menuScene = menuScene;
    this._menuCanvas = menuCanvas;
    this._onFinish = onFinish;

    this._active = false;
    this._finishing = false;
    this._cancelled = false;

    this._cam = new CinematicCamera();
    this._camera = null;          // built in start()
    this.prelude = null;

    // Timeline animation stamps (seconds on this._t)
    this._t = 0;
    this._flightT0 = null;   // artifact flying to the house
    this._sinkT0 = null;     // artifact sinking into her chest
    this._riseT0 = null;     // she rises out of the bed
    this._levT0 = null;      // levitation ramp

    this._shake = 0;
    this._scratch = new THREE.Vector3();
  }

  // ─────────────────────────────────────────
  // START / SKIP / TEARDOWN
  // ─────────────────────────────────────────
  start() {
    if (this._active) return;
    this._active = true;
    this._finishing = false;
    this._cancelled = false;

    // Take the screen away from the main menu
    if (this._menuScene) this._menuScene.stop();
    if (this._menuCanvas) this._menuCanvas.style.display = 'none';
    if (this._ui) this._ui.hideAllScreens();

    this._buildOverlay();

    // Dedicated cinematic camera — the gameplay camera never runs
    this._camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);
    this._camera.rotation.order = 'YXZ';
    this._onResize = () => {
      this._camera.aspect = innerWidth / innerHeight;
      this._camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', this._onResize);

    // ESC skips the whole prologue (capture-safe: never mid-flip garbage,
    // jumps straight into gameplay)
    this._escHandler = (e) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.skip();
      }
    };
    window.addEventListener('keydown', this._escHandler, true);

    this.prelude = new PreludeScene();
    this._clock = new THREE.Clock();
    this._rafId = requestAnimationFrame(this._loop = this._loop.bind(this));

    // Roll once Sorini is in (or 8s timeout — fail soft, show the world)
    Promise.race([this.prelude.ready, this._sleep(8000)]).then(() => {
      if (this._active && !this._finishing) this._run();
    });
  }

  skip() {
    if (!this._active || this._finishing) return;
    this.finish(true);
  }

  finish(fast) {
    if (this._finishing) return;
    this._finishing = true;
    this._cancelled = true;

    this._cam.stop();
    this._stopVoices();
    // switchLevel() restarts the level track at the default volume
    try { this._audio.setMusicVolume(0.6); } catch (e) {}

    // Close the book over the screen
    this._setPagesOpen(false);
    this._hideCaption();

    const settle = fast ? 350 : 620;
    setTimeout(() => {
      this._active = false;
      cancelAnimationFrame(this._rafId);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('keydown', this._escHandler, true);

      // Hand the game back — Level 1 boots (and self-plays its intro)
      if (this._onFinish) this._onFinish();

      // Fade the overlay out over the first gameplay frames, then clean up
      const overlay = document.getElementById('trailer-overlay');
      if (overlay) {
        overlay.style.transition = 'opacity 0.7s ease';
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.remove();
          if (this.prelude) { this.prelude.dispose(); this.prelude = null; }
          this._finishing = false;
        }, 800);
      }
    }, settle);
  }

  // ─────────────────────────────────────────
  // RENDER LOOP (owned while the trailer runs)
  // ─────────────────────────────────────────
  _loop() {
    if (!this._active) return;
    this._rafId = requestAnimationFrame(this._loop);
    if (!this.prelude) return;

    const dt = Math.min(this._clock.getDelta(), 0.05);
    this._t += dt;
    const P = this.prelude;
    P.update(dt, this._t);

    // ── Timeline-driven animations ──
    if (this._flightT0 !== null) {
      const t01 = Math.min((this._t - this._flightT0) / 6.2, 1);
      P.flightPoint(t01, this._scratch);
      // gentle hover bob once she arrives above the bed
      const bob = t01 >= 1 ? Math.sin(this._t * 2.2) * 0.04 : 0;
      P.flyer.position.set(this._scratch.x, this._scratch.y + bob, this._scratch.z);
    }
    if (this._sinkT0 !== null) {
      const k = Math.min((this._t - this._sinkT0) / 1.1, 1);
      P.chestWorldPos(this._scratch);
      P.flyer.position.lerp(this._scratch, Math.min(1, k * k * 1.4));
      P.flyer.scale.setScalar(1 - 0.6 * k);
    }
    if (this._riseT0 !== null) {
      P.setRise(Math.min((this._t - this._riseT0) / 1.8, 1));
    }
    if (this._riseT0 !== null || this._levT0 !== null) {
      // Takeover blaze — ramps to ~3.2× with an arrhythmic flicker
      const flick = 1 + Math.sin(this._t * 23) * 0.08 + Math.random() * 0.06;
      P.setArtifactIntensity((1 + Math.min(this._t / 4, 1) * 2.2) * flick);
    }
    if (this._levT0 !== null) {
      P.setLevitate(Math.min((this._t - this._levT0) / 2.2, 1));
    }

    // ── Camera ──
    if (this._cam.active) {
      this._cam.update(dt);
      this._cam.applyTo(this._camera);
    }
    if (this._shake > 0) {
      this._camera.position.x += (Math.random() - 0.5) * this._shake;
      this._camera.position.y += (Math.random() - 0.5) * this._shake;
      this._shake = Math.max(0, this._shake - dt * 1.4);
    }

    // ── REC timer ──
    if (this._recEl && (this._t - (this._recLast || 0)) > 0.25) {
      this._recLast = this._t;
      const s = Math.floor(this._t);
      this._recEl.textContent =
        `● REC ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }

    // ── Render through the MAIN renderer (one canvas for OBS) ──
    const r = this._renderer;
    r.setScissorTest(false);
    r.setViewport(0, 0, innerWidth, innerHeight);
    r.clear();
    r.render(P.scene, this._camera);
  }

  // ─────────────────────────────────────────
  // THE TIMELINE — five picture cards
  // ─────────────────────────────────────────
  async _run() {
    const P = this.prelude;
    const alive = () => this._active && !this._cancelled;

    // The book starts closed over a black screen — open onto HOME
    this._setPagesOpen(true);
    await this._sleep(1000);
    if (!alive()) return;

    // ── CARD 1 — HOME: she is asleep; the world is ordinary ──
    this._cam.play([{
      pos: [-2.4, 1.15, 1.7], look: [-0.5, 0.75, -1.2],
      duration: 8500, transition: 0, drift: [1.5, 0.1, -0.6], ease: 'in-out',
    }]);
    this._showCaption('Earth. A quiet night, like any other.');
    await this._sleep(5400); if (!alive()) return;
    this._hideCaption();
    await this._sleep(3100); if (!alive()) return;

    // ── flip → CARD 2 — THE FALL ──
    await this._flipSwap(() => {}); if (!alive()) return;
    this._cam.play([{
      pos: [0.5, 1.25, -0.1], look: [0.4, 1.9, 12],
      duration: 8900, transition: 0, drift: [0, 0.12, 0.8], ease: 'in-out',
    }]);
    await this._sleep(1300); if (!alive()) return;
    P.launchMeteor();
    await this._sleep(1150); if (!alive()) return;   // meteor reaches the crater
    this._flash();
    this._shake = 0.5;
    this._audio.playSfx('boss_phase_change');
    await this._sleep(3100); if (!alive()) return;
    this._showCaption('Something fell from the sky.');
    await this._sleep(3400); if (!alive()) return;
    this._hideCaption();
    await this._sleep(400); if (!alive()) return;

    // ── flip → CARD 3 — THE VISITOR ──
    await this._flipSwap(() => {}); if (!alive()) return;
    this._cam.play([{
      pos: [1.8, 0.95, 2.0], look: [-0.5, 0.8, -1.3],
      duration: 13000, transition: 2200, drift: [-1.0, 0.05, -0.9], ease: 'in-out',
    }]);
    await this._sleep(600); if (!alive()) return;
    P.showFlyer(true);
    this._flightT0 = this._t;
    await this._sleep(5600); if (!alive()) return;   // crater → window → hover
    this._voice('l1_axiom_1');                        // "Sorini."
    this._showCaption('It had been looking for her.');
    await this._sleep(3600); if (!alive()) return;
    this._hideCaption();
    this._sinkT0 = this._t;                           // sink into her chest
    await this._sleep(1150); if (!alive()) return;
    this._flightT0 = null;
    this._sinkT0 = null;
    this._flash(320);
    P.dockArtifact();
    P.setArtifactIntensity(1.6);
    this._showCaption('It chose her.');
    await this._sleep(2300); if (!alive()) return;
    this._hideCaption();
    await this._sleep(300); if (!alive()) return;

    // ── CARD 4 — THE TAKING (no flip: one continuous shot) ──
    const chestLook = () => {
      P.chestWorldPos(this._scratch);
      return { x: this._scratch.x, y: this._scratch.y + 0.1, z: this._scratch.z };
    };
    this._cam.play([
      {   // close on the reactor as it wakes
        pos: [1.6, 0.85, 1.1], look: chestLook,
        duration: 6500, transition: 1600, drift: [-0.5, 0.4, -0.4], ease: 'in-out',
      },
      {   // low angle as she rises into frame
        pos: [1.5, 0.55, 2.3], look: chestLook,
        duration: 6000, transition: 2000, drift: [-0.3, 1.0, -0.5], ease: 'in-out',
      },
    ]);
    this._voice('l1_axiom_3');   // "Not with a mouth — with a mind…"
    this._riseT0 = this._t;
    await this._sleep(1300); if (!alive()) return;
    this._showCaption('It took her mind.');
    await this._sleep(3300); if (!alive()) return;
    this._hideCaption();
    this._levT0 = this._t;       // she leaves the bed entirely
    await this._sleep(1200); if (!alive()) return;
    this._showCaption('It took her body.');
    await this._sleep(3200); if (!alive()) return;
    this._hideCaption();
    await this._sleep(2400); if (!alive()) return;   // hold on the blazing float
    this._riseT0 = null;
    this._levT0 = null;

    // ── flip → CARD 5 — THE INVASION ──
    this._audio.playSfx('portal_activate');
    this._flash(600);
    await this._flipSwap(() => {
      P.setMode('invasion');
      P.setRise(1);
      P.setLevitate(0);
      P.setArtifactIntensity(1.4);
    });
    if (!alive()) return;
    this._audio.playMusic('level_1_chiptune');
    this._audio.setMusicVolume(0.32);
    this._cam.play([{
      pos: [1.2, 0.6, -3.6], look: [0, 1.5, 5],
      duration: 11000, transition: 0, drift: [-0.5, 0.4, 1.2], ease: 'in-out',
    }]);
    await this._sleep(1100); if (!alive()) return;
    this._showCaption('It carried her to the war.');
    await this._sleep(3400); if (!alive()) return;
    this._hideCaption();
    await this._sleep(400); if (!alive()) return;
    this._voice('l1_ship_1');    // "So many spaceships."
    this._showCaption('So many spaceships.');
    await this._sleep(2800); if (!alive()) return;
    this._hideCaption();
    await this._sleep(2600); if (!alive()) return;   // let the ships breathe

    // Close the book and roll Level 1
    this.finish(false);
  }

  // ─────────────────────────────────────────
  // AUDIO — trailer VO shares the game's voice bus
  // ─────────────────────────────────────────
  _voice(key) {
    if (!this._audio) return;
    this._stopVoices();
    this._audio.playSfx(key);
  }

  _stopVoices() {
    if (!this._audio || !this._audio.sounds) return;
    for (const k of Object.keys(this._audio.sounds)) {
      if (/^l1_axiom_|^l1_ship_/.test(k)) this._audio.sounds[k].stop();
    }
  }

  // ─────────────────────────────────────────
  // DOM OVERLAY — letterbox, captions, flips, REC
  // ─────────────────────────────────────────
  _buildOverlay() {
    const el = document.createElement('div');
    el.id = 'trailer-overlay';
    el.innerHTML = `
      <style>
        #trailer-overlay {
          position: fixed; inset: 0;
          z-index: 250;                 /* over HUD/menu, under pause menu */
          pointer-events: none;
          font-family: 'Courier New', monospace;
        }
        #trailer-overlay .bar {
          position: absolute; left: 0; right: 0; height: 12%;
          background: #000;
        }
        #trailer-overlay .bar.top { top: 0; }
        #trailer-overlay .bar.bottom { bottom: 0; }
        #trailer-overlay .caption {
          position: absolute; left: 50%; bottom: 17%;
          transform: translateX(-50%);
          max-width: 80%;
          text-align: center;
          color: #dffcff;
          font-size: clamp(1rem, 2.2vw, 1.5rem);
          letter-spacing: 3px;
          text-shadow: 0 0 18px rgba(0, 217, 242, 0.75), 0 2px 4px #000;
          opacity: 0;
          transition: opacity 0.45s ease;
          white-space: pre-line;
        }
        #trailer-overlay .rec {
          position: absolute; top: calc(12% + 12px); left: 18px;
          color: #ff5555;
          font-size: 0.85rem;
          letter-spacing: 2px;
          opacity: 0.85;
          text-shadow: 0 0 8px rgba(255, 60, 60, 0.6);
        }
        #trailer-overlay .skip-hint {
          position: absolute; bottom: calc(12% + 12px); right: 18px;
          color: #5a6a7a;
          font-size: 0.75rem;
          letter-spacing: 2px;
          opacity: 0.8;
        }
        #trailer-overlay .flip {
          position: absolute; inset: 0;
          perspective: 1400px;
        }
        #trailer-overlay .page {
          position: absolute; top: 0; bottom: 0; width: 50.15%;
          background: #000;
          transition: transform 0.5s cubic-bezier(0.65, 0, 0.35, 1);
          backface-visibility: hidden;
          box-shadow: 0 0 40px rgba(0, 217, 242, 0.12);
        }
        #trailer-overlay .page.left  { left: 0;  transform-origin: left center; }
        #trailer-overlay .page.right { right: 0; transform-origin: right center; }
        #trailer-overlay.pages-open .page.left  { transform: rotateY(-92deg); }
        #trailer-overlay.pages-open .page.right { transform: rotateY(92deg); }
        #trailer-overlay .flash {
          position: absolute; inset: 0;
          background: #cfeeff;
          opacity: 0;
          transition: opacity 0.55s ease;
        }
      </style>
      <div class="bar top"></div>
      <div class="bar bottom"></div>
      <div class="flip">
        <div class="page left"></div>
        <div class="page right"></div>
      </div>
      <div class="caption"></div>
      <div class="flash"></div>
      <div class="rec">● REC 00:00</div>
      <div class="skip-hint">ESC — SKIP TRAILER</div>
    `;
    document.body.appendChild(el);

    this._overlay = el;
    this._captionEl = el.querySelector('.caption');
    this._flashEl = el.querySelector('.flash');
    this._recEl = el.querySelector('.rec');
    this._skipEl = el.querySelector('.skip-hint');

    // Pages start CLOSED (the closed book) — _run() opens them
    el.classList.remove('pages-open');

    // Fade the skip hint out after a few seconds — keep the frame clean
    setTimeout(() => {
      if (this._skipEl) {
        this._skipEl.style.transition = 'opacity 1s ease';
        this._skipEl.style.opacity = '0';
      }
    }, 5000);
  }

  _setPagesOpen(open) {
    if (!this._overlay) return;
    // A closed book hides the screen; an open one reveals the scene.
    if (open) this._overlay.classList.add('pages-open');
    else this._overlay.classList.remove('pages-open');
  }

  async _flipSwap(midFn) {
    // Close both pages over the screen, let the caller re-dress the
    // world behind them, then open onto the next "picture".
    this._setPagesOpen(false);
    await this._sleep(560);
    if (this._cancelled) return;
    if (midFn) midFn();
    await this._sleep(120);
    this._setPagesOpen(true);
    await this._sleep(620);
  }

  _showCaption(text) {
    if (!this._captionEl) return;
    this._captionEl.textContent = text;
    this._captionEl.style.opacity = '1';
  }

  _hideCaption() {
    if (!this._captionEl) return;
    this._captionEl.style.opacity = '0';
  }

  _flash(duration = 550) {
    if (!this._flashEl) return;
    this._flashEl.style.transition = 'none';
    this._flashEl.style.opacity = '0.95';
    // Force a style flush so the fade-back always runs
    void this._flashEl.offsetHeight;
    this._flashEl.style.transition = `opacity ${duration}ms ease`;
    this._flashEl.style.opacity = '0';
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
