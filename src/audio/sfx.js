// ============================================================
// sfx.js — tiny WebAudio synth stingers for game feedback.
// No audio assets: every sound is an oscillator/noise envelope.
// Output routes through Howler's master gain so the existing
// mute/volume settings in GameShell apply to these too.
// ============================================================
import { Howler } from 'howler';

let ctx = null;
let out = null;
let volume = .8;
export function setVolume(value) { if (Number.isFinite(value)) volume = Math.max(0, Math.min(1, value)); }

function ac() {
  // The public volume getter initializes Howler's context when needed.
  // Never create a separate context that bypasses the game's mute controls.
  if (!Howler.ctx) Howler.volume();
  ctx = Howler.ctx; out = Howler.masterGain;
  if (!ctx || !out) return null;
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
  g.gain.linearRampToValueAtTime(vol * volume, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(out);
  o.onended = () => { o.disconnect(); g.disconnect(); };
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
  const g = c.createGain(); g.gain.value = vol * volume;
  src.connect(f); f.connect(g); g.connect(out);
  src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
  src.start(t0);
}

const PRESETS = {
  collect: () => { noise({dur:.035,vol:.045,lp:1800}); tone({f:320,f1:170,dur:.055,vol:.035}); },
  shutter: () => { noise({dur:.035,vol:.15,lp:2800}); noise({dur:.045,vol:.1,lp:1600,delay:.065}); tone({f:185,f1:95,dur:.08,vol:.03}); },
  pickup: () => { noise({dur:.22,vol:.07,lp:1700}); tone({f:160,f1:340,dur:.16,vol:.025}); },
  bagSeal: () => { noise({dur:.26,vol:.13,lp:4200}); noise({dur:.04,vol:.08,lp:2600,delay:.2}); },
  setDown: () => { noise({dur:.065,vol:.13,lp:1100}); tone({f:190,f1:80,dur:.075,vol:.06}); },
  glassPlace: () => { noise({dur:.025,vol:.055,lp:3800}); tone({f:2450,f1:2100,dur:.095,vol:.035}); tone({f:3600,dur:.06,vol:.015}); },
  gloves: () => { noise({dur:.25,vol:.09,lp:3200}); noise({dur:.07,vol:.14,lp:2200,delay:.2}); },
  lightSwitch: () => { noise({dur:.025,vol:.16,lp:2200}); tone({f:140,f1:80,dur:.045,vol:.04}); },
  waterTap: () => { noise({dur:.5,vol:.08,lp:3800}); noise({dur:.08,vol:.04,lp:1600}); },
  uvPower: () => { noise({dur:.025,vol:.07,lp:2500}); tone({f:340,f1:680,dur:.12,vol:.025}); },
  scanMark: () => { tone({f:820,dur:.06,vol:.035}); tone({f:1100,dur:.08,vol:.025,delay:.055}); },
  record: () => { noise({dur:.08,vol:.09,lp:1600}); tone({f:580,f1:730,dur:.13,vol:.04,delay:.04}); },
  door: () => { noise({dur:.18,vol:.1,lp:600}); noise({dur:.05,vol:.14,lp:1400,delay:.15}); tone({f:100,f1:65,dur:.2,vol:.04}); },
  instrumentStart: () => { tone({f:95,f1:210,type:'triangle',dur:.65,vol:.045}); tone({f:780,dur:.07,vol:.04,delay:.4}); },
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
  if (volume === 0) return;
  try { const p = PRESETS[name]; if (p) p(); } catch (e) {}
}

export default { play };
