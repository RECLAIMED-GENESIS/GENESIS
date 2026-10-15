// ============================================================
// sfx.js — tiny WebAudio synth stingers for game feedback.
// No audio assets: every sound is an oscillator/noise envelope.
// Output routes through Howler's master gain so the existing
// mute/volume settings in GameShell apply to these too.
// ============================================================
import { Howler } from 'howler';

let ctx = null;
let out = null;

function ac() {
  if (!ctx) {
    ctx = Howler.ctx || null;
    out = Howler.masterGain || null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      out = ctx.createGain();
      out.gain.value = 1;
      out.connect(ctx.destination);
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone({ f = 440, f1 = 0, type = 'sine', dur = 0.15, vol = 0.3, delay = 0 }) {
  const c = ac(); if (!c || !out) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(out);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function noise({ dur = 0.12, vol = 0.25, delay = 0, lp = 1200 }) {
  const c = ac(); if (!c || !out) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(out);
  src.start(t0);
}

const PRESETS = {
  collect: () => { tone({ f: 660, dur: 0.12, vol: 0.3 }); tone({ f: 990, dur: 0.22, vol: 0.26, delay: 0.09 }); },
  correct: () => { tone({ f: 523, dur: 0.12, vol: 0.3 }); tone({ f: 659, dur: 0.12, vol: 0.3, delay: 0.09 }); tone({ f: 784, dur: 0.3, vol: 0.32, delay: 0.18 }); },
  wrong:   () => { tone({ f: 160, f1: 90, type: 'sawtooth', dur: 0.35, vol: 0.26 }); },
  crack:   () => { noise({ dur: 0.1, vol: 0.35, lp: 2600 }); tone({ f: 900, f1: 260, type: 'square', dur: 0.18, vol: 0.2, delay: 0.02 }); },
  deflect: () => { tone({ f: 180, f1: 120, dur: 0.2, vol: 0.26 }); },
  strong:  () => { tone({ f: 95, f1: 55, type: 'square', dur: 0.28, vol: 0.36 }); noise({ dur: 0.08, vol: 0.22, lp: 900 }); },
  partial: () => { tone({ f: 330, dur: 0.14, vol: 0.28 }); },
  none:    () => { tone({ f: 220, f1: 300, type: 'triangle', dur: 0.22, vol: 0.26 }); },
  chip:    () => { tone({ f: 1250, dur: 0.05, vol: 0.16 }); },
  break:   () => { noise({ dur: 0.35, vol: 0.36, lp: 700 }); tone({ f: 240, f1: 50, type: 'sawtooth', dur: 0.7, vol: 0.32 }); tone({ f: 60, dur: 0.8, vol: 0.36, delay: 0.05 }); },
  rank:    () => { [392, 523, 659, 784].forEach((f, i) => tone({ f, dur: 0.16, vol: 0.3, delay: i * 0.12 })); tone({ f: 1046, dur: 0.5, vol: 0.32, delay: 0.5 }); },
};

export function play(name) {
  try { const p = PRESETS[name]; if (p) p(); } catch (e) {}
}

export default { play };
