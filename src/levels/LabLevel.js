// ============================================================
// LabLevel.js — LEVEL 2, THE FORENSIC LAB (phase-1 physical rebuild)
//
// You are the forensic analyst. Eight bagged items from Dr. Nkosi's
// office sit on the intake table. Four benches process them:
//
//   BENCH 1 CYBER     → the victim's phone (carry, shield, unlock, read)
//   BENCH 2 TRACE     → hair fibres vs 5 references + guest-glass print
//   BENCH 3 BIOLOGY   → handkerchief blood DNA (16-marker STR)
//   BENCH 4 DOCUMENTS → torn note (ESDA/UV) + calendar + UV trail photos
//
// PHASE-1 PRINCIPLE: objects get interacted with, not panels. You pick
// things up, carry them, place them, turn knobs and look through lenses.
// A screen appears only where a real screen exists: the phone in your
// hand, the unlock unit's little display, the microscope eyepiece.
// (DNA + documents keep their paper panels until phase 2.)
//
// HARD RULES:
//   - the phone is cracked BY YOU: dump the lock record and run hashcat in a
//     real terminal on the examiner laptop (levels/LabExtras.js), then walk
//     to the handset and type the PIN. No "DECRYPTING" bars, no auto-solve.
//     FAST + RISKY alternative: guess 1610 from the October calendar —
//     3 wrong guesses wipe it
//   - every bench action is a physical prop ([E] on it), not a panel
//   - results are hedged ("consistent with", "insufficient"), and on the
//     comparison scope YOU write the verdict — overstating it or wrongly
//     excluding the true donor costs captain trust (see investigation.js)
//   - gloves are required: bare-handed touches are logged (stats.js)
//   - chain of custody: sign intake before benches unlock; sign every
//     folder page before the handoff
//
// RUBRIC shaders (time-uniform, explainable):
//   1. FlickerStripMaterial — one faulty fluorescent tube (uTime)
//   2. MicroscopeFocusMaterial — hair plane blurs with uFocus
//   3. UVRevealMaterial — hidden indentations fade in with uUV
// ============================================================
import * as THREE from 'three';
import { getCase, SUSPECTS, IDS, normId } from '../game/case.js';
import { getStats } from '../game/stats.js';
import { PhotoCamera, PHOTO } from '../game/photoCamera.js';
import { play as sfx } from '../audio/sfx.js';
import { showBriefing } from '../game/briefing.js';
import { installLabExtras } from './LabExtras.js';
import { attachPlayerView } from '../game/DetectiveAvatar.js';

const EYE = 1.7;
const REACH = 3.4;
const PIN = '1610';            // DDMM: 16 October, ringed twice on his calendar
const UNIT_SECS = 45;          // unlock-unit acquisition run (work elsewhere)
const WIPE_SECS = 20;          // signal window after unlock before remote wipe
const NAME = (id) => (SUSPECTS[normId(id)] || { name: id }).name;

// Shift-pressure beats: the captain checks in over the intercom as the lab clock runs.
// (1 real second = 0.5 lab minutes, so these land at roughly 4.5, 9.5, 14.5 and 16.5 real minutes.)
const SHIFT_END = 17 * 60;
const RADIO = [
  { at: 10 * 60 + 30, text: (n) => n === 0
      ? '\u201cHalf past ten. I have a body, a bag of exhibits and no names. Talk to me.\u201d'
      : '\u201cHalf past ten. ' + n + ' report' + (n === 1 ? '' : 's') + ' on my desk. Keep them coming.\u201d' },
  { at: 13 * 60, text: (n) => n >= 2
      ? '\u201cOne o\u2019clock. Good \u2014 the picture is forming. Do not get sloppy now.\u201d'
      : '\u201cOne o\u2019clock and I am still waiting on the bench work. Pick up the pace.\u201d' },
  { at: 15 * 60 + 30, text: () => '\u201cNinety minutes to shift end. The city does not wait for paperwork.\u201d' },
  { at: 16 * 60 + 30, text: () => '\u201cThirty minutes. Sign what you have \u2014 a partial dossier beats a late one.\u201d' },
];

const NEED = {
  digital: ['phone'],
  micro: ['hair', 'glass'],
  dna: ['handkerchief', 'trail'],
  docs: ['note', 'calendar', 'casing'],
};
const LABEL = {
  casing: 'Bullet casing (9mm, brass)', glass: 'Two whiskey glasses',
  hair: 'Hair fibres (guest chair)', handkerchief: 'Monogrammed handkerchief',
  phone: "The victim's phone", note: 'Torn note (two halves)',
  trail: 'Wiped blood trail (UV photo)', calendar: 'Desk calendar',
};

// Fake-but-stable per-suspect hair detail for the comparison scope.
// The killer's three traits are the truth; the decoy shares colour and
// length but differs at the medulla — that is the whole examination.
function hairDetail(id, killerId) {
  const s = SUSPECTS[id];
  if (id === killerId) return { medulla: 'broad, continuous', pigment: 'dense, even', cuticle: 'fine scales' };
  const sameLook = s.hairName === SUSPECTS[killerId].hairName && s.hairLong === SUSPECTS[killerId].hairLong;
  return {
    medulla: sameLook ? 'narrow, interrupted' : 'absent / fragmented',
    pigment: sameLook ? 'dense, even' : 'sparse, clumped',
    cuticle: 'coarse scales',
  };
}

// ------------------------------------------------------------
// Custom shaders (rubric 10%). Small, commented, explainable.
// ------------------------------------------------------------
function FlickerStripMaterial() {
  // One fluorescent tube with a faulty ballast: brightness drops out
  // in irregular bursts driven by uTime. The others use plain material.
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'varying vec2 vUv; uniform float uTime;',
      'void main(){',
      '  float base = 0.92;',
      '  float drop = step(0.965, fract(sin(floor(uTime*9.0)*12.9898)*43758.5453));',
      '  float hum = 0.04 * sin(uTime*47.0);',
      '  float b = base - drop*0.75 + hum;',
      '  gl_FragColor = vec4(vec3(0.86,0.92,1.0)*b, 1.0);',
      '}',
    ].join('\n'),
  });
}
function MicroscopeFocusMaterial() {
  // A hair strand drawn procedurally; uFocus 0..1 controls how much of
  // the strand is sharp. Out-of-focus areas lerp toward flat grey.
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uFocus: { value: 0.1 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'varying vec2 vUv; uniform float uFocus; uniform float uTime;',
      'void main(){',
      '  float strand = 1.0 - smoothstep(0.008, 0.03, abs(vUv.y - 0.5 - 0.06*sin(vUv.x*22.0)));',
      '  float sharp = smoothstep(0.0, 1.0, uFocus);',
      '  vec3 hair = mix(vec3(0.16,0.10,0.06), vec3(0.42,0.26,0.14), vUv.x);',
      '  vec3 dull = vec3(0.10,0.11,0.13);',
      '  vec3 col = mix(dull, hair, strand * (0.25 + 0.75*sharp));',
      '  col += strand * 0.08 * sin(uTime*2.0 + vUv.x*40.0) * sharp;',
      '  float vig = smoothstep(0.75, 0.35, length(vUv - 0.5));',
      '  gl_FragColor = vec4(col * (0.35 + 0.65*vig), 1.0);',
      '}',
    ].join('\n'),
  });
}
function UVRevealMaterial() {
  // Hidden indentations on paper: invisible under room light, fading in
  // as uUV goes 0 -> 1 when the examiner kills the lights and raises UV.
  // With uSweep = 1 the text appears ONLY where the wand beam hits: uBeam
  // carries the beam position in paper UV space, uOn gates the lamp.
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uUV: { value: 0 }, uBeam: { value: new THREE.Vector2(-1, -1) }, uOn: { value: 0 }, uSweep: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'varying vec2 vUv; uniform float uUV; uniform vec2 uBeam; uniform float uOn; uniform float uSweep;',
      'float line(vec2 p, vec2 a, vec2 b){ vec2 pa = p-a; vec2 ba = b-a;',
      '  float t = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);',
      '  return 1.0 - smoothstep(0.004, 0.012, length(pa - ba*t)); }',
      'void main(){',
      '  vec3 paper = vec3(0.82,0.78,0.64);',
      '  float txt = max(line(vUv, vec2(0.15,0.7), vec2(0.85,0.7)),',
      '              max(line(vUv, vec2(0.15,0.55), vec2(0.85,0.55)),',
      '                  line(vUv, vec2(0.15,0.4), vec2(0.6,0.4))));',
      '  vec3 uv = vec3(0.45,0.55,0.9);',
      '  float gateUV = uUV;',
      '  if (uSweep > 0.5) {',
      '    float d = distance(vUv * vec2(1.0, 0.75), uBeam * vec2(1.0, 0.75));',
      '    gateUV = uOn * (1.0 - smoothstep(0.10, 0.30, d));',
      '  }',
      '  vec3 col = mix(paper, uv*(0.4+0.6*txt) + paper*0.25*txt, clamp(gateUV, 0.0, 1.0)*0.9);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}',
    ].join('\n'),
  });
}

export class LabLevel {
  constructor(sceneOrRenderer = null, rendererMaybe = null) {
    this.scene = (sceneOrRenderer && sceneOrRenderer.isScene) ? sceneOrRenderer : new THREE.Scene();
    this.renderer = rendererMaybe || window.__renderer || null;
    this._prevBg = this.scene.background;
    this._prevFog = this.scene.fog;
    // Daylight working lab: bright, flat, nothing hides in shadow. Evidence
    // is found by looking, not by following glow markers — there are none.
    this.scene.background = new THREE.Color(0x2b2f36);
    this.scene.fog = null;

    this.name = 'LEVEL 2 — THE FORENSIC LAB';
    this.spawn = new THREE.Vector3(0, 0, 5.6);
    this.spawnYaw = Math.PI;
    this.colliders = [];
    this.level = new THREE.Group();
    this.root = this.level;
    this.scene.add(this.level);

    this.case = getCase();
    this.killer = SUSPECTS[this.case.killerId];
    this.witnessId = (this.case.decoyId && this.case.decoyId !== this.case.killerId)
      ? this.case.decoyId
      : IDS.filter((i) => i !== this.case.killerId)[0];
    this.witness = SUSPECTS[this.witnessId];

    const l1 = (window.__caseProgress && window.__caseProgress.l1) || {};
    const assumeAll = !window.__caseProgress || !window.__caseProgress.l1;
    this.collected = {};
    for (const id of Object.keys(LABEL)) this.collected[id] = assumeAll || !!l1[id];

    this.signedIn = false;
    this.gloves = false;
    this.carried = null;        // { id:'phone' } — what is in your hands
    this.heldKnob = null;       // knob id while drag-turning a 3D control
    this.dossier = { names: new Set(), weapon: null, window: null, depot: null, temperament: null, memo: null };
    this.reports = {};

    // Phone: staged = bag | carried | faraday | cradle
    this.cyber = {
      staged: 'bag', connected: false, unitRunning: false, unitT: 0, unitDone: false,
      unlocked: false, attempts: 0, wiped: false, airplane: false, signalT: 0,
      page: 0, openApp: null, flags: new Set(), reported: false,
    };
    // Microscope: knobs are real state shared by 3D meshes + eyepiece dials
    this.trace = {
      strand: false, cover: false, focus: 10, stageX: 0, stageY: 0, turret: '10x',
      openRef: null, seenRefs: new Set(), verdicts: {}, claim: null, claimPick: null,
      glassUV: false, reported: false,
    };
    this.bio = { cut: false, lysis: false, loaded: false, running: false, t: 0, ready: false, matched: false, reported: false };
    this.docs = { lightsOff: false, uvOn: false, noteRead: false, calRead: false, trailRead: false, reported: false, cover: new Set() };

    this.elapsed = 0;
    this.clockStartMin = 8 * 60 + 15;
    this.captainReady = false;
    this.focus = null;
    this._o = new THREE.Vector3(); this._d = new THREE.Vector3(0, 0, -1);
    this._rc = new THREE.Raycaster(); this._rc.far = REACH;
    this._knobRay = new THREE.Raycaster();

    this._buildRoom();
    this._buildIntake();
    this._buildCyberBench();
    this._buildTraceBench();
    this._buildBioBench();
    this._buildDocsBench();
    this._buildReportTable();
    this._buildCaptainDesk();
    this._buildLights();
    this._buildUI();
    this._buildCamera();
    this._buildLabProps();       // chemicals, hood, fridge, sink, whiteboard ... (LabExtras)
    this._buildPhysicalBenches(); // laptop, strand, linen, buttons, clipboards ... (LabExtras)
    this._syncProps();

    this.level.traverse((o) => {
      if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; }
    });

    window.__firstPerson = true;
    // the detective's body + [V] first / third person (runs after this level's own update)
    this._view = attachPlayerView(this, { tag: true, forceFirst: () => this._uiBusy() });
    const labUpdate = this.update.bind(this);
    this.update = (dt, t, player) => { labUpdate(dt, t, player); this._view.update(dt, player); };
    this._onKey = (e) => this._handleKey(e);
    window.addEventListener('keydown', this._onKey);
    this._onMouseMove = (e) => this._handleKnobDrag(e);
    window.addEventListener('mousemove', this._onMouseMove);
    // Wheel while holding a knob = fine adjustment (±2 per notch, no drag needed)
    this._onWheel = (e) => {
      if (!this.heldKnob || this.heldKnob === 'turret') return;
      const d = -Math.sign(e.deltaY || 1) * 2;
      const t = this.trace;
      if (this.heldKnob === 'focus') t.focus = Math.max(0, Math.min(100, t.focus + d));
      if (this.heldKnob === 'stageX') t.stageX = Math.max(-50, Math.min(50, t.stageX + d));
      if (this.heldKnob === 'stageY') t.stageY = Math.max(-50, Math.min(50, t.stageY + d));
      this._applyScopeState();
      if (this.ui.device.style.display === 'flex' && this._deviceMode === 'eyepiece') this._refreshEyepieceField();
    };
    window.addEventListener('wheel', this._onWheel, { passive: true });
    // Opening: Captain Mabaso sets the clock before the lab clock starts.
    this._briefing = showBriefing({
      kicker: 'CAPT. MABASO',
      stamp: '08:15  \u2014  FORENSIC LAB, BASEMENT',
      speaker: 'INTERCOM \u2192 FORENSIC ANALYST',
      lines: [
        'Eight bags from Nkosi\u2019s office are on your intake table. Last night I had a corpse and a guess. This morning I want a case I can put in front of a judge.',
        'Four benches: the phone, the hairs and glass, the blood, the paperwork. Gloves on before you touch anything, and sign the intake sheet or nothing downstairs counts.',
        'I need names I can defend, the weapon, the time window, and where he was going tomorrow. Say \u201cconsistent with\u201d when that is all you know. Overstate it and I stop trusting you.',
        'Shift ends at 17:00. The city does not wait for paperwork, and neither does the killer. Clock starts when you walk in.',
      ],
      onDone: () => {
        this.elapsed = 0;   // the briefing must not eat lab time
        if (this.ui) this._toast('FORENSIC LAB \u2014 08:15', 'Gloves, sign-in, then work. [Q] raises your camera \u2014 photograph each exhibit before you file it. [E] to interact. [Esc] frees the mouse.', 9000);
      },
    });
  }

  getSurfaceHeight() { return 0; }
  groundHeight() { return 0; }
  terrainHeight() { return 0; }

  // ================= GEOMETRY =================
  _box(parent, w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); parent.add(m); return m;
  }
  _std(color, rough = 0.8, metal = 0.1) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  }

  _buildRoom() {
    const W = 20, D = 14, H = 3.4;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this._std(0x9aa0a8, 0.55, 0.05));
    floor.rotation.x = -Math.PI / 2; this.level.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this._std(0x191c22, 1, 0));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = H; this.level.add(ceil);
    const wallMat = this._std(0xcfd4da, 0.95, 0);
    const mkWall = (cx, cz, w, d) => {
      this._box(this.level, w, H, d, wallMat, cx, H / 2, cz);
      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(cx - w / 2, 0, cz - d / 2), new THREE.Vector3(cx + w / 2, H, cz + d / 2)));
    };
    mkWall(0, -D / 2 - 0.15, W + 0.6, 0.3); mkWall(0, D / 2 + 0.15, W + 0.6, 0.3);
    mkWall(-W / 2 - 0.15, 0, 0.3, D + 0.6); mkWall(W / 2 + 0.15, 0, 0.3, D + 0.6);

    const court = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.8), new THREE.MeshBasicMaterial({ color: 0x8d99a3 }));
    court.position.set(-2, 2.0, -D / 2 + 0.02); this.level.add(court);
    this._box(this.level, 8.4, 2.0, 0.08, this._std(0x3a3f47, 0.6, 0.4), -2, 2.0, -D / 2 + 0.05);
    for (let i = 0; i < 3; i++) this._box(this.level, 0.08, 1.8, 0.1, this._std(0x3a3f47, 0.6, 0.4), -5 + i * 3, 2.0, -D / 2 + 0.06);

    const c = document.createElement('canvas'); c.width = c.height = 256;
    this._clockCanvas = c; this._clockCtx = c.getContext('2d');
    this._clockTex = new THREE.CanvasTexture(c); this._clockTex.colorSpace = THREE.SRGBColorSpace;
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.32, 32), new THREE.MeshBasicMaterial({ map: this._clockTex }));
    clock.position.set(4.5, 2.5, -D / 2 + 0.06); this.level.add(clock);
    this._drawClock(this.clockStartMin);

    this._flickerMat = FlickerStripMaterial();
    const steady = new THREE.MeshBasicMaterial({ color: 0xdfe8f2 });
    [[-6, 2.5], [0, 2.5], [6, 2.5], [0, -3.5]].forEach(([x, z], i) => {
      const tube = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 0.24), (i === 2) ? this._flickerMat : steady);
      tube.position.set(x, H - 0.06, z); tube.userData.noShadow = true; this.level.add(tube);
      this._box(this.level, 3.4, 0.04, 0.34, this._std(0x2a2e35, 0.6, 0.5), x, H - 0.02, z);
    });

    this._box(this.level, 0.5, 0.22, 0.18, this._std(0x23262c, 0.7, 0.2), 9.4, 1.15, -6.6);
    this._box(this.level, 0.09, 0.11, 0.09, this._std(0xd8d2c2, 0.9, 0), -3.2, 1.0, 1.4);
    this._box(this.level, 0.5, 1.1, 0.14, this._std(0xe4e8ec, 0.95, 0), -9.75, 1.4, 5.5);

    this._focusMat = MicroscopeFocusMaterial();
    const demo = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), this._focusMat);
    demo.position.set(6.6, 1.9, 0.4); demo.rotation.y = -Math.PI / 2; demo.userData.noShadow = true;
    this.level.add(demo);
    this._uvMat = UVRevealMaterial();
    const uv = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), this._uvMat);
    uv.position.set(6.6, 1.9, -2.2); uv.rotation.y = -Math.PI / 2; uv.userData.noShadow = true;
    this.level.add(uv);
  }

  _drawClock(mins) {
    const g = this._clockCtx; if (!g) return;
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#f2f4f6'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 116, 0, 7); g.stroke();
    g.fillStyle = '#222'; g.font = '28px monospace'; g.textAlign = 'center';
    g.fillText('12', 128, 48); g.fillText('6', 128, 228); g.fillText('3', 216, 138); g.fillText('9', 40, 138);
    const h = (mins / 60) % 12, m = mins % 60;
    const ang = (v, full) => (v / full) * Math.PI * 2 - Math.PI / 2;
    g.strokeStyle = '#222'; g.lineWidth = 10; g.beginPath();
    g.moveTo(128, 128); g.lineTo(128 + 60 * Math.cos(ang(h, 12)), 128 + 60 * Math.sin(ang(h, 12))); g.stroke();
    g.lineWidth = 6; g.beginPath();
    g.moveTo(128, 128); g.lineTo(128 + 92 * Math.cos(ang(m, 60)), 128 + 92 * Math.sin(ang(m, 60))); g.stroke();
    g.fillStyle = '#a1241c'; g.beginPath(); g.arc(128, 128, 8, 0, 7); g.fill();
    if (this._clockTex) this._clockTex.needsUpdate = true;
  }
  _labMinutes() { return this.clockStartMin + this.elapsed * 0.5; }
  _labClock() {
    const m = Math.floor(this._labMinutes());
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  _benchBase(g, x, z) {
    g.position.set(x, 0, z);
    this._box(g, 3.4, 0.08, 1.7, this._std(0x6b5a44, 0.7, 0.05), 0, 0.9, 0);
    for (const [lx, lz] of [[-1.5, -0.7], [1.5, -0.7], [-1.5, 0.7], [1.5, 0.7]])
      this._box(g, 0.09, 0.9, 0.09, this._std(0x4a3d2e, 0.8, 0), lx, 0.45, lz);
    this.level.add(g);
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(x - 1.8, 0, z - 0.95), new THREE.Vector3(x + 1.8, 1.0, z + 0.95)));
  }
  _hit(x, y, z, w, h, d, interact) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial());
    m.visible = false; m.position.set(x, y, z); m.userData.interact = interact;
    this.level.add(m); return m;
  }

  _buildIntake() {
    const t = new THREE.Group(); t.position.set(0, 0, 4.6);
    this._box(t, 6.2, 0.08, 1.7, this._std(0x707a86, 0.5, 0.5), 0, 0.9, 0);
    for (const [lx, lz] of [[-2.9, -0.7], [2.9, -0.7], [-2.9, 0.7], [2.9, 0.7]])
      this._box(t, 0.09, 0.9, 0.09, this._std(0x2c3038, 0.6, 0.6), lx, 0.45, lz);
    this.level.add(t);
    this.colliders.push(new THREE.Box3(new THREE.Vector3(-3.2, 0, 3.7), new THREE.Vector3(3.2, 1.0, 5.5)));
    const ids = Object.keys(LABEL);
    ids.forEach((id, i) => {
      const x = -2.7 + i * 0.77;
      if (!this.collected[id]) {
        this._box(this.level, 0.5, 0.005, 0.34, new THREE.MeshBasicMaterial({ color: 0x3a3f47 }), x, 0.955, 4.6);
        return;
      }
      if (id === 'phone') {
        // The phone rides in its own spot — you lift it out by hand.
        this._phoneProp = new THREE.Group();
        this._box(this._phoneProp, 0.12, 0.015, 0.24, this._std(0x0c0e12, 0.3, 0.2), 0, 0.02, 0);
        this._phoneProp.position.set(x, 0.96, 4.6);
        this.level.add(this._phoneProp);
        return;
      }
      const bag = new THREE.Group();
      const film = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.34),
        new THREE.MeshStandardMaterial({ color: 0xdfe7ea, transparent: true, opacity: 0.32, roughness: 0.15 }));
      film.position.y = 0.03; film.userData.noShadow = true; bag.add(film);
      const tag = this._box(bag, 0.16, 0.004, 0.1, this._std(0xd8cfa8, 0.95, 0), 0.2, 0.06, 0.12);
      tag.rotation.y = 0.2;
      bag.position.set(x, 0.95, 4.6); this.level.add(bag);
    });
    this._box(this.level, 0.34, 0.01, 0.26, this._std(0xd8cfa8, 0.9, 0), 2.9, 0.955, 4.6);
    // Glove dispenser on the intake table's door-side end
    this._box(this.level, 0.4, 0.22, 0.3, this._std(0x7a9ec2, 0.7, 0), -3.4, 1.05, 4.6);
    this._hit(-3.4, 1.0, 4.6, 0.7, 0.6, 0.7, { kind: 'gloves' });
    this._hit(1.2, 1.0, 4.6, 4.0, 0.8, 1.9, { kind: 'intake' });
    if (this.collected.phone) this._hit(-2.7 + 4 * 0.77, 1.0, 4.6, 0.5, 0.4, 0.6, { kind: 'phone' });
  }

  _buildCyberBench() {
    const b = new THREE.Group(); this._benchBase(b, -6.8, 1.6);
    // Unlock unit: cradle + cable + small display (a real screen)
    this._box(b, 0.75, 0.025, 0.52, this._std(0x1c1f25, 0.5, 0.5), -0.6, 0.955, 0.1);
    this._unitCradle = this._box(b, 0.2, 0.03, 0.34, this._std(0x2c3038, 0.6, 0.4), -0.6, 0.97, 0.15);
    const dc = document.createElement('canvas'); dc.width = 256; dc.height = 96;
    this._unitCtx = dc.getContext('2d');
    this._unitTex = new THREE.CanvasTexture(dc); this._unitTex.colorSpace = THREE.SRGBColorSpace;
    this._drawUnit('UNIT READY');
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), new THREE.MeshBasicMaterial({ map: this._unitTex }));
    disp.position.set(-0.6, 1.25, -0.1); disp.rotation.x = -0.12; disp.userData.noShadow = true; b.add(disp);
    this._box(b, 0.08, 0.3, 0.08, this._std(0x1c1f25, 0.5, 0.5), -0.6, 1.1, -0.12);
    this._box(b, 0.5, 0.3, 0.4, this._std(0x8f96a0, 0.35, 0.7), 0.9, 1.09, 0.2);   // faraday box
    this._box(b, 0.05, 0.02, 1.0, this._std(0x222222, 0.9, 0), 0.1, 0.945, 0.1);   // cable
    this._box(b, 0.4, 0.02, 0.3, this._std(0xd8cfa8, 0.95, 0), -1.3, 0.95, 0.45);  // analyst notebook
    this._hit(-5.9, 1.05, 1.8, 0.8, 0.6, 0.7, { kind: 'faraday' });
    this._hit(-7.4, 1.0, 1.45, 0.9, 0.7, 0.9, { kind: 'unit' });
  }
  _drawUnit(line, sub) {
    const g = this._unitCtx; if (!g) return;
    g.fillStyle = '#0a141c'; g.fillRect(0, 0, 256, 96);
    g.fillStyle = '#7fd4a0'; g.font = '20px monospace'; g.textAlign = 'center';
    g.fillText(line, 128, 42);
    g.fillStyle = '#4a7f60'; g.font = '14px monospace';
    g.fillText(sub || '', 128, 70);
    if (this._unitTex) this._unitTex.needsUpdate = true;
  }

  _buildTraceBench() {
    const b = new THREE.Group(); this._benchBase(b, 6.8, 1.6);
    this._box(b, 0.2, 0.03, 0.32, this._std(0x2a2d34, 0.6, 0.4), -0.7, 0.955, 0);
    this._box(b, 0.1, 0.5, 0.1, this._std(0x1c1f25, 0.5, 0.5), -0.7, 1.22, -0.1);
    this._box(b, 0.26, 0.07, 0.12, this._std(0x1c1f25, 0.5, 0.5), -0.7, 1.5, -0.06);
    // Eyepiece tubes you lean into
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 16), this._std(0x111318, 0.4, 0.6));
    eye.position.set(-0.7, 1.62, 0.12); eye.rotation.x = 0.5; b.add(eye);
    // Turret disc (tap [E] to click between 4x / 10x / 40x)
    this._turretMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 20), this._std(0x3a3f47, 0.4, 0.7));
    this._turretMesh.position.set(-0.7, 1.42, -0.02); b.add(this._turretMesh);
    this._turretMesh.userData.knob = 'turret';
    // Focus knob (drag) + stage knobs (drag)
    const knobMat = this._std(0x555b63, 0.4, 0.7);
    this._focusKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), knobMat.clone());
    this._focusKnob.rotation.z = Math.PI / 2; this._focusKnob.position.set(-0.45, 1.15, -0.1);
    this._focusKnob.userData.knob = 'focus'; b.add(this._focusKnob);
    this._stageKnobX = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 14), knobMat.clone());
    this._stageKnobX.rotation.x = Math.PI / 2; this._stageKnobX.position.set(-0.45, 1.0, 0.25);
    this._stageKnobX.userData.knob = 'stageX'; b.add(this._stageKnobX);
    this._stageKnobY = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 14), knobMat.clone());
    this._stageKnobY.rotation.x = Math.PI / 2; this._stageKnobY.position.set(-0.45, 1.0, 0.42);
    this._stageKnobY.userData.knob = 'stageY'; b.add(this._stageKnobY);
    this._box(b, 0.5, 0.06, 0.3, this._std(0x2a2d34, 0.6, 0.4), 0.5, 0.97, -0.2);
    for (let i = 0; i < 5; i++)
      this._box(b, 0.06, 0.005, 0.14, new THREE.MeshStandardMaterial({ color: 0xd8e2ec, transparent: true, opacity: 0.45, roughness: 0.2 }), 0.1 + i * 0.16, 0.955, 0.5);
    this._box(b, 0.3, 0.12, 0.2, this._std(0x1c1f25, 0.5, 0.5), 1.35, 1.0, 0.3);
    this._hit(6.1, 1.6, 1.72, 0.4, 0.4, 0.4, { kind: 'eyepiece' });
    this._hit(6.35, 1.15, 1.5, 0.35, 0.35, 0.35, { kind: 'knob', knob: 'focus' });
    this._hit(6.1, 1.42, 1.58, 0.4, 0.3, 0.3, { kind: 'knob', knob: 'turret' });
    this._hit(6.35, 1.0, 1.85, 0.3, 0.3, 0.3, { kind: 'knob', knob: 'stageX' });
    this._hit(6.35, 1.0, 2.02, 0.3, 0.3, 0.3, { kind: 'knob', knob: 'stageY' });
  }

  _buildBioBench() {
    const b = new THREE.Group(); this._benchBase(b, -6.8, -2.6);
    this._box(b, 1.25, 0.85, 1.0, this._std(0x30343c, 0.5, 0.5), -0.5, 1.36, 0);
    { const bc = document.createElement('canvas'); bc.width = 512; bc.height = 205;
      this._bioCtx = bc.getContext('2d'); this._bioTex = new THREE.CanvasTexture(bc); this._bioTex.colorSpace = THREE.SRGBColorSpace; }
    this._bioDisplay = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.4), new THREE.MeshBasicMaterial({ map: this._bioTex }));
    this._bioDisplay.position.set(-0.5, 1.5, 0.51);
    this._bioDisplay.userData.noShadow = true; b.add(this._bioDisplay);
    this._box(b, 0.26, 0.05, 0.03, this._std(0x0a0c10, 0.6, 0.3), -0.5, 1.12, 0.5);
    for (let i = 0; i < 3; i++)
      this._box(b, 0.09, 0.15, 0.09, new THREE.MeshStandardMaterial({ color: 0x4a8fb8, transparent: true, opacity: 0.85, roughness: 0.4 }), 0.7 + i * 0.16, 1.02, 0.5);
    this._cartridgeMesh = this._box(b, 0.3, 0.1, 0.2, this._std(0xd8e2ec, 0.3, 0.1), 1.3, 0.99, -0.3);
  }

  _buildDocsBench() {
    const b = new THREE.Group(); this._benchBase(b, 6.8, -2.6);
    this._docsLight = this._box(b, 1.7, 0.025, 1.05,
      new THREE.MeshStandardMaterial({ color: 0xe8f0f8, emissive: 0x8fb8d8, emissiveIntensity: 0.55, roughness: 0.4 }), -0.3, 0.945, 0);
    this._box(b, 0.52, 0.006, 0.42, this._std(0xd8cfa8, 0.95, 0), -0.7, 0.962, 0);
    // The torn note itself: a sweep-reveal surface. The beam position drives
    // the shader, so indentations surface only where the wand points.
    this._noteMat = UVRevealMaterial();
    this._noteMat.uniforms.uSweep.value = 1;
    this._noteMat.uniforms.uUV.value = 1;
    this._noteMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), this._noteMat);
    this._noteMesh.rotation.x = -Math.PI / 2;
    this._noteMesh.position.set(-0.7, 0.968, 0);
    this._noteMesh.userData.noShadow = true;
    b.add(this._noteMesh);
    this._box(b, 0.5, 0.006, 0.4, this._std(0xcdd6e0, 0.95, 0), 0.5, 0.962, 0.1);
    this._box(b, 0.14, 0.05, 0.1, this._std(0xb08d3e, 0.4, 0.8), 1.35, 0.97, 0.4);
    this._box(b, 0.04, 0.55, 0.04, this._std(0x1c1f25, 0.5, 0.5), 1.3, 1.2, -0.4);
    this._uvLampHead = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.16, 14, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x2a2f3a, emissive: 0x4a3a8f, emissiveIntensity: 0.4, side: THREE.DoubleSide }));
    this._uvLampHead.position.set(1.3, 1.48, -0.4); b.add(this._uvLampHead);
    // Handheld UV wand resting on the bench — pick it up and sweep by hand
    this._wandProp = new THREE.Group();
    const wandBody = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.34, 12), this._std(0x1c1f25, 0.5, 0.5));
    wandBody.rotation.z = Math.PI / 2; this._wandProp.add(wandBody);
    const wandTip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 12),
      new THREE.MeshStandardMaterial({ color: 0x2a2f3a, emissive: 0x6a5adf, emissiveIntensity: 0.6 }));
    wandTip.rotation.z = Math.PI / 2; wandTip.position.x = 0.18; this._wandProp.add(wandTip);
    this._wandProp.position.set(0.4, 0.98, -0.55);
    b.add(this._wandProp);
    this._hit(7.2, 0.98, -3.15, 0.5, 0.3, 0.4, { kind: 'wand' });
    this._hit(6.1, 0.97, -2.6, 0.7, 0.3, 0.6, { kind: 'note' });
    // Wall light switch by the west wall — the room goes dark by hand
    this._box(this.level, 0.04, 0.16, 0.1, this._std(0xd8d2c2, 0.6, 0), -9.93, 1.5, 1.0);
    this._hit(-9.85, 1.5, 1.0, 0.35, 0.4, 0.4, { kind: 'lightswitch' });
    // The sweep beam: a real spotlight + a pool of light where you aim
    this._beam = new THREE.SpotLight(0x7a6adf, 0, 8, 0.32, 0.5, 1.2);
    this.level.add(this._beam); this.level.add(this._beam.target);
    this._beamPool = new THREE.Mesh(new THREE.CircleGeometry(0.14, 20),
      new THREE.MeshBasicMaterial({ color: 0x8a7aff, transparent: true, opacity: 0 }));
    this._beamPool.rotation.x = -Math.PI / 2; this._beamPool.userData.noShadow = true;
    this.level.add(this._beamPool);
  }

  _buildReportTable() {
    const t = new THREE.Group(); t.position.set(0, 0, -0.6);
    this._box(t, 2.6, 0.08, 1.6, this._std(0x54432f, 0.75, 0.05), 0, 0.88, 0);
    for (const [lx, lz] of [[-1.1, -0.6], [1.1, -0.6], [-1.1, 0.6], [1.1, 0.6]])
      this._box(t, 0.09, 0.88, 0.09, this._std(0x3a2c20, 0.85, 0), lx, 0.44, lz);
    this._box(t, 0.45, 0.035, 0.33, this._std(0xc9a76a, 0.95, 0), -0.5, 0.94, 0.1);
    this._box(t, 0.4, 0.006, 0.3, this._std(0xe8e2d0, 0.95, 0), 0.45, 0.935, -0.15);
    this.level.add(t);
    this.colliders.push(new THREE.Box3(new THREE.Vector3(-1.4, 0, -1.5), new THREE.Vector3(1.4, 1.0, 0.3)));
    this._hit(0, 0.9, -0.6, 2.8, 1.0, 1.8, { kind: 'folder' });
  }

  _buildCaptainDesk() {
    const d = new THREE.Group(); d.position.set(0, 0, -5.9);
    this._box(d, 3.0, 0.08, 1.3, this._std(0x3a2c20, 0.8, 0), 0, 0.78, 0);
    for (const [lx, lz] of [[-1.3, -0.5], [1.3, -0.5], [-1.3, 0.5], [1.3, 0.5]])
      this._box(d, 0.1, 0.78, 0.1, this._std(0x2a1e14, 0.9, 0), lx, 0.39, lz);
    this._box(d, 0.4, 0.03, 0.3, this._std(0xc9a76a, 0.95, 0), -0.7, 0.835, 0.15);
    const lampHead = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.2, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x2a3a2c, emissive: 0xffc98a, emissiveIntensity: 1.4, side: THREE.DoubleSide }));
    lampHead.position.set(1.0, 1.32, -0.3); d.add(lampHead);
    this._box(d, 0.04, 0.5, 0.04, this._std(0x1c1f25, 0.5, 0.5), 1.0, 1.05, -0.3);
    this.level.add(d);
    this.colliders.push(new THREE.Box3(new THREE.Vector3(-1.6, 0, -6.6), new THREE.Vector3(1.6, 0.9, -5.2)));
    const cap = new THREE.Group();
    const uniform = this._std(0x1e2a44, 0.85, 0), skin = this._std(0x6f4d3a, 0.8, 0);
    this._box(cap, 0.42, 0.62, 0.24, uniform, 0, 1.15, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), skin);
    head.position.set(0, 1.62, 0); cap.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.126, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), this._std(0x151210, 1, 0));
    hair.position.set(0, 1.635, -0.008); cap.add(hair);
    cap.position.set(0, 0, -6.7); this.level.add(cap); this.captain = cap;
    this._hit(0, 1.0, -5.9, 2.2, 2.0, 1.6, { kind: 'captain' });
  }

  _buildLights() {
    this._hemi = new THREE.HemisphereLight(0xf4f7fa, 0x3a3d44, 1.7);
    this.level.add(this._hemi);
    this._stripLights = [];
    [[-6, 2.5], [0, 2.5], [6, 2.5], [0, -3.5]].forEach(([x, z], i) => {
      const pl = new THREE.PointLight(0xe8f0fa, 22, 15, 1.7);
      pl.position.set(x, 3.1, z); this.level.add(pl); this._stripLights.push({ pl, flicker: i === 2 });
    });
    const warm = new THREE.PointLight(0xffc98a, 6, 8, 1.8);
    warm.position.set(1.0, 1.6, -6.1); this.level.add(warm);
    const uv = new THREE.PointLight(0x6a5adf, 0, 6, 1.8);
    uv.position.set(8.1, 1.7, -3.0); this.level.add(uv); this._uvLight = uv;
  }

  // ================= LAB CAMERA (you photograph what YOU find) =================
  // [Q] raise, wheel zoom, click shoot. Film is limited and blanks count
  // against your rank — and every bench report needs its exhibit photo.
  _buildCamera() {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    this._ptargets = [
      { id: 'phone', name: 'victim\'s phone', kind: 'evidence', radius: 0.3, getPos: (v) => v.copy(V(0.38, 1.0, 4.6)), live: () => this.cyber.staged === 'bag' },
      { id: 'unit-display', name: 'examiner laptop screen', kind: 'evidence', radius: 0.35, getPos: (v) => v.copy(V(-6.5, 1.1, 1.8)) },
      { id: 'microscope', name: 'comparison scope', kind: 'evidence', radius: 0.5, getPos: (v) => v.copy(V(6.1, 1.35, 1.7)) },
      { id: 'sequencer', name: 'sequencer readout', kind: 'evidence', radius: 0.6, getPos: (v) => v.copy(V(-7.3, 1.5, -2.1)) },
      { id: 'note', name: 'torn note', kind: 'evidence', radius: 0.35, getPos: (v) => v.copy(V(6.1, 0.97, -2.6)) },
      { id: 'calendar', name: 'desk calendar', kind: 'evidence', radius: 0.3, getPos: (v) => v.copy(V(7.3, 0.97, -2.5)) },
      { id: 'casing', name: 'casing tray', kind: 'evidence', radius: 0.25, getPos: (v) => v.copy(V(8.15, 0.97, -2.2)) },
    ];
    this.photoCam = new PhotoCamera({
      scene: this.scene,
      renderer: this.renderer,
      opts: { film: 12, maxDist: 16, lockDist: 6 },
      getTargets: () => this._ptargets.filter((t) => !t.live || t.live()),
      getColliders: () => this.colliders,
      isBlocked: () => !!(window.__uiCapture || this.heldKnob || !this.ui ||
        this.ui.overlay.style.display === 'block' || this.ui.device.style.display === 'flex' || this.ui.captain.style.display === 'flex'),
      clockLabel: () => this._labClock(),
      onPhoto: (photo) => this._onPhoto(photo),
    });
    if (!this.renderer) console.warn('LabLevel: no renderer was passed, photos will be blank');
  }
  _onPhoto(photo) {
    const sharp = photo.subjects.filter((s) => s.sharp);
    if (!sharp.length) {
      try { getStats().wastedFilm++; } catch (e) {}
      this._toast('PHOTO ' + photo.id + ' — NOTHING SHARP', 'Get closer, centre the exhibit, zoom if you need it. Blanks cost film.', 3500);
    } else {
      sfx('collect');
      this._toast('PHOTO ' + photo.id + ' — ' + sharp.map((s) => (s.name || s.id).toUpperCase()).join(' · '), this.photoCam.film + ' shots left. It is in the folder now.', 3500);
    }
    window.__caseProgress = window.__caseProgress || { l1: {} };
    const rec = window.__caseProgress.labPhotos = window.__caseProgress.labPhotos || [];
    rec.push({ id: photo.id, time: photo.time, subjects: photo.subjects.map((s) => ({ id: s.id, kind: s.kind, sharp: s.sharp })) });
    this._refreshCounter();
  }
  _hasPhoto(id) {
    return !!(this.photoCam && this.photoCam.photos.some((p) => p.subjects.some((s) => s.id === id && s.sharp)));
  }
  _photoThumbs() {
    if (!this.photoCam || !this.photoCam.photos.length) return '<p style="opacity:.6">No exposures yet. [Q] raises the camera — exhibits first, then reports.</p>';
    return '<div style="display:flex;gap:10px;flex-wrap:wrap">' + this.photoCam.photos.map((p) => {
      const names = p.subjects.filter((s) => s.sharp).map((s) => s.name || s.id).join(', ') || 'nothing sharp';
      return '<div style="background:#f4efe2;padding:4px 4px 16px;width:132px;box-shadow:0 4px 12px rgba(0,0,0,.3)">' +
        (p.image ? '<img src="' + p.image + '" style="display:block;width:124px;height:93px;background:#111">' : '<div style="width:124px;height:93px;background:#111"></div>') +
        '<div style="font-size:10px;color:#4a4538;margin-top:2px">#' + p.id + ' ' + (p.time || '') + ' — ' + names + '</div></div>';
    }).join('') + '</div>';
  }

  // ================= UI =================
  _buildUI() {
    const mk = (tag, css, parent, html) => {
      const e = document.createElement(tag); e.style.cssText = css;
      if (html !== undefined) e.innerHTML = html;
      (parent || document.body).appendChild(e); return e;
    };
    const ui = this.ui = {};
    ui.root = mk('div', 'position:fixed;inset:0;pointer-events:none;z-index:50;font-family:"Courier New",monospace;color:#1c222b;');
    ui.counter = mk('div', 'position:absolute;left:18px;top:16px;font-size:13px;letter-spacing:1px;background:rgba(240,244,248,.85);padding:6px 10px;border:1px solid #9aa2ad;', ui.root, '');
    ui.carry = mk('div', 'position:absolute;left:18px;top:52px;font-size:12px;letter-spacing:1px;background:rgba(20,26,34,.85);color:#ffe9a8;padding:6px 10px;display:none;', ui.root);
    ui.quest = mk('div', 'position:absolute;right:18px;top:16px;width:290px;font-size:12px;line-height:1.6;background:rgba(240,244,248,.9);padding:8px 12px;border:1px solid #9aa2ad;', ui.root, '');
    ui.prompt = mk('div', 'position:absolute;left:50%;bottom:22%;transform:translateX(-50%);font-size:15px;letter-spacing:1px;background:rgba(20,26,34,.85);color:#f2f4f6;padding:8px 14px;display:none;', ui.root);
    ui.toast = mk('div', 'position:absolute;left:50%;top:9%;transform:translate(-50%,0);width:min(680px,92vw);text-align:center;opacity:0;transition:opacity .4s;', ui.root);
    ui.overlay = mk('div', 'position:fixed;inset:0;display:none;background:rgba(235,238,242,.97);z-index:9000;font-family:"Courier New",monospace;color:#1c222b;overflow:auto;pointer-events:auto;');
    ui.overlayInner = mk('div', 'max-width:1020px;margin:4vh auto;padding:0 24px 6vh', ui.overlay);
    // Device zoom: phone / eyepiece float over the dimmed 3D room
    ui.device = mk('div', 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;gap:26px;background:rgba(5,8,10,.72);z-index:9500;font-family:"Courier New",monospace;color:#dfe7ea;pointer-events:auto;padding:20px;');
    ui.deviceInner = mk('div', 'display:flex;gap:26px;align-items:flex-start;flex-wrap:wrap;justify-content:center;max-height:94vh;overflow:auto;', ui.device);
    ui.captain = mk('div', 'position:fixed;inset:0;display:none;align-items:flex-end;justify-content:center;background:linear-gradient(180deg,rgba(20,24,32,.35) 0%,rgba(10,12,16,.95) 70%);z-index:10000;font-family:"Courier New",monospace;color:#e9d9b0;pointer-events:auto;');
    ui.captainInner = mk('div', 'max-width:840px;margin:0 auto 6vh;padding:0 24px;text-align:center', ui.captain);
    this._refreshCounter();
  }
  _refreshCounter() {
    const done = Object.keys(this.reports).length;
    const film = this.photoCam ? this.photoCam.film + ' exp' : '';
    const shots = this.photoCam ? this.photoCam.photos.length : 0;
    this.ui.counter.textContent = this._labClock() + '  ·  REPORTS ' + done + '/4  ·  NAMES ' + this.dossier.names.size + (this.gloves ? '  ·  🧤' : '') + '  ·  FILM ' + film + ' (' + shots + ' taken)';
    if (this.ui.quest) this._refreshQuest();
    if (this._syncProps) this._syncProps();
    this.ui.carry.style.display = this.carried ? 'block' : 'none';
    if (this.carried) {
      let next = 'lay it in the FARADAY box (silver box, cyber bench)';
      if (this.carried.id === 'uvwand') next = this.docs.lightsOff ? 'sweep the beam across the torn note' : 'kill the room lights at the wall switch, then sweep the note';
      else if (this.cyber.staged === 'faraday') next = 'seat it in the unit CRADLE (cyber bench)';
      this.ui.carry.textContent = 'CARRYING: ' + this.carried.id.toUpperCase() + ' — ' + next;
    }
  }
  // ================= GUIDANCE: work order + next step =================
  _uiBusy() {
    return !!(this.heldKnob || this.ui.overlay.style.display === 'block' || this.ui.device.style.display === 'flex'
      || this.ui.captain.style.display === 'flex' || (this.photoCam && this.photoCam.up));
  }
  _nextStep() {
    const c = this.cyber, r = this.reports, b = this.bio, d = this.docs;
    if (!this.signedIn) return { text: 'Sign the intake sheet on the intake table.' };
    if (!this.gloves) return { text: 'Glove up \u2014 the dispenser is on the intake table.' };
    const opts = [];
    if (!r.digital && !c.wiped) {
      let t, wait = false;
      if (c.staged === 'bag') t = 'CYBER: lift the phone out of its bag on the intake table.';
      else if (c.staged === 'carried') t = 'CYBER: lay the phone in the silver FARADAY box.';
      else if (c.staged === 'faraday') t = 'CYBER: seat the phone in the unlock-unit CRADLE.';
      else if (c.unlocked && !c.airplane) t = 'CYBER: AIRPLANE MODE on the handset \u2014 it is signalling and will wipe!';
      else if (c.unlocked) t = 'CYBER: read his apps, then file the digital report.';
      else if (c.unitDone) t = 'CYBER: you cracked it \u2014 pick up the handset in the cradle and type the PIN.';
      else if (c.unitRunning) { t = 'CYBER: acquisition running \u2014 work another bench meanwhile.'; wait = true; }
      else t = 'CYBER: open the examiner laptop \u2014 dump the lock record, then crack it with hashcat.';
      opts.push({ text: t, wait });
    }
    if (!r.dna) {
      if (b.running) opts.push({ text: 'BIOLOGY: sequencer running \u2014 work another bench meanwhile.', wait: true });
      else if (b.ready) opts.push({ text: 'BIOLOGY: press MATCH on the sequencer, photograph the readout, file the clipboard.' });
      else opts.push({ text: 'BIOLOGY: cut a swatch from the handkerchief, lyse it, seat the cartridge, press RUN.' });
    }
    if (!r.micro) opts.push({ text: 'TRACE: lay the strand, lower the cover slip, compare under the eyepiece, file the clipboard.' });
    if (!r.docs) {
      if (!d.lightsOff) opts.push({ text: 'DOCUMENTS: kill the lights, take the UV wand, sweep the torn note.' });
      else if (!d.noteRead) opts.push({ text: 'DOCUMENTS: sweep the wand across the whole note.' });
      else opts.push({ text: 'DOCUMENTS: read the calendar and trail prints, photograph the note, file the clipboard.' });
    }
    const act = opts.find((o) => !o.wait) || opts[0];
    if (act) return act;
    const unsigned = ['digital', 'micro', 'dna', 'docs'].filter((k) => r[k] && !r[k].signed).length;
    if (unsigned) return { text: 'Sign every page of the folder at the report table (' + unsigned + ' left).' };
    return { text: 'Report to Capt. Mabaso at her desk.' };
  }
  _refreshQuest() {
    const r = this.reports;
    const signedAll = ['digital', 'micro', 'dna', 'docs'].every((k) => r[k] && r[k].signed);
    const rows = [
      ['Sign in + gloves', this.signedIn && this.gloves],
      ['CYBER \u2014 the phone', !!r.digital],
      ['BIOLOGY \u2014 handkerchief DNA', !!r.dna],
      ['TRACE \u2014 hair vs references', !!r.micro],
      ['DOCUMENTS \u2014 note, calendar, casing', !!r.docs],
      ['Sign every page', signedAll],
    ].map(([t, ok]) => '<div style="' + (ok ? 'color:#1f6f5c' : '') + '">' + (ok ? '&#10003; ' : '&#9744; ') + t + '</div>').join('');
    const left = SHIFT_END - this._labMinutes();
    const shift = left <= 0 ? 'SHIFT OVER \u2014 every minute is on your record'
      : 'Shift ends 17:00 \u00b7 ' + Math.floor(left / 60) + 'h ' + String(Math.floor(left % 60)).padStart(2, '0') + 'm left';
    this.ui.quest.innerHTML =
      '<div style="letter-spacing:2px;opacity:.6;margin-bottom:2px">WORK ORDER</div>' + rows +
      '<div style="margin-top:6px;' + (left < 60 ? 'color:#a1241c;font-weight:bold' : 'opacity:.7') + '">' + shift + '</div>' +
      '<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #9aa2ad"><b>NEXT:</b> ' + this._nextStep().text + '</div>';
  }

  _toast(title, text, ms = 6000) {
    clearTimeout(this._toastTimer);
    this.ui.toast.innerHTML =
      '<div style="font-size:19px;letter-spacing:3px;color:#123;margin-bottom:8px">' + title + '</div>' +
      '<div style="font-size:14px;line-height:1.5;background:rgba(255,255,255,.92);border:1px solid #9aa2ad;padding:10px 16px;display:inline-block;color:#1c222b">' + text + '</div>';
    this.ui.toast.style.opacity = 1;
    this._toastTimer = setTimeout(() => { this.ui.toast.style.opacity = 0; }, ms);
  }
  _checkGloves(action) {
    if (this.gloves) return true;
    try { getStats().contamination++; } catch (e) {}
    this._toast('CONTAMINATION LOGGED', 'Bare hands on ' + action + '. Gloves are in the dispenser on the intake table — this goes in your record.', 5000);
    return false;
  }
  _loseTrust(n, reason) {
    try { getStats().trustLost += n; } catch (e) {}
    window.__caseProgress = window.__caseProgress || { l1: {} };
    const cur = (window.__caseProgress.trust === undefined) ? 3 : window.__caseProgress.trust;
    window.__caseProgress.trust = Math.max(0, cur - n);
    this._toast('CAPTAIN NOTES IT', reason + ' Trust is now ' + window.__caseProgress.trust + '/3 going into the city.', 6000);
  }

  // ================= INPUT =================
  _handleKey(e) {
    if (e.repeat) return;
    if (this.heldKnob) {                       // turning a physical knob owns E/Esc
      if (e.code === 'KeyE' || e.code === 'Escape') this._releaseKnob();
      return;
    }
    if (this.ui.overlay.style.display === 'block') {
      if (e.code === 'Escape') this._closeOverlay();
      return;
    }
    if (this.ui.device.style.display === 'flex') {
      if (e.code === 'Escape') this._closeDevice();
      return;
    }
    if (this.ui.captain.style.display === 'flex') {
      if (e.code === 'Escape') this._closeCaptain();
      return;
    }
    if (e.code === 'KeyE' && this.focus) this._interact(this.focus);
  }
  _handleKnobDrag(e) {
    if (!this.heldKnob) return;
    const dx = e.movementX || 0, dy = e.movementY || 0;
    const d = (dx - dy) * 0.35;
    const t = this.trace;
    if (this.heldKnob === 'focus') t.focus = Math.max(0, Math.min(100, t.focus + d));
    if (this.heldKnob === 'stageX') t.stageX = Math.max(-50, Math.min(50, t.stageX + d));
    if (this.heldKnob === 'stageY') t.stageY = Math.max(-50, Math.min(50, t.stageY + d));
    this._applyScopeState();
    if (this.ui.device.style.display === 'flex' && this._deviceMode === 'eyepiece') this._renderEyepiece();
  }
  _grabKnob(id) {
    if (id === 'turret') {   // turret has click stops: tap [E] to rotate 4x → 10x → 40x
      const order = ['4x', '10x', '40x'];
      const t = this.trace;
      t.turret = order[(order.indexOf(t.turret) + 1) % order.length];
      if (this._turretMesh) this._turretMesh.rotation.y += Math.PI / 3;
      sfx('collect');
      this._applyScopeState();
      this._toast('OBJECTIVE ' + t.turret, t.turret === '4x' ? 'Finder view — shape only.' : t.turret === '10x' ? 'Medulla structure resolves.' : '40x — cuticle scales resolve. This is where comparisons are made.', 3000);
      if (this.ui.device.style.display === 'flex' && this._deviceMode === 'eyepiece') this._renderEyepiece();
      return;
    }
    this.heldKnob = id;      // focus / stage knobs: drag to turn
    if (this.photoCam && this.photoCam.up) this.photoCam.toggle();  // wheel belongs to the knob now
    window.__uiCapture = true;
    if (document.exitPointerLock) document.exitPointerLock();
    const name = { focus: 'FOCUS', stageX: 'STAGE X', stageY: 'STAGE Y' }[id];
    this._toast(name + ' KNOB', 'Drag to turn, wheel for fine steps. [E] to let go.', 4000);
  }
  _releaseKnob() {
    this.heldKnob = null;
    window.__uiCapture = false;
  }
  _applyScopeState() {
    const t = this.trace;
    if (this._focusMat) this._focusMat.uniforms.uFocus.value = t.focus / 100;
    if (this._focusKnob) this._focusKnob.rotation.x = t.focus / 100 * Math.PI * 2;
    if (this._stageKnobX) this._stageKnobX.rotation.y = t.stageX / 50 * Math.PI;
    if (this._stageKnobY) this._stageKnobY.rotation.y = t.stageY / 50 * Math.PI;
  }

  _interact(it) {
    this._idleT = 0;
    if (this._interactFlavor(it)) return;   // decor you can poke at any time
    if (!this.signedIn && it.kind !== 'intake' && it.kind !== 'gloves') {
      if (it.kind === 'captain') { this._toast('NOT YET', 'Sign in first.', 2500); return; }
      this._toast('CHAIN OF CUSTODY', 'Sign the intake sheet before touching anything.', 3500); return;
    }
    if (this._interactExtra(it)) return;     // physical bench props (LabExtras)
    if (it.kind === 'gloves') {
      this.gloves = true; sfx('collect');
      this._toast('GLOVES ON', 'Nitrile, fresh pair. Change them if they tear — contamination ends careers.', 3500);
      this._refreshCounter(); return;
    }
    if (it.kind === 'intake') return this._openOverlay(this._intakePanel());
    if (it.kind === 'folder') return this._openOverlay(this._folderPanel());
    if (it.kind === 'captain') return this._openCaptain();
    if (it.kind === 'phone') {   // lift the phone out of its bag
      if (this.cyber.staged !== 'bag') return;
      this._checkGloves('the victim\'s phone');
      this.carried = { id: 'phone' };
      this.cyber.staged = 'carried';
      if (this._phoneProp) this._phoneProp.visible = false;
      sfx('collect'); this._refreshCounter();
      this._toast('PHONE IN HAND', 'Live device. Into the faraday box on the cyber bench — before anything pings it.', 5000);
      return;
    }
    if (it.kind === 'faraday') {
      if (this.carried && this.carried.id === 'phone') {
        this.carried = null; this.cyber.staged = 'faraday';
        sfx('collect'); this._refreshCounter();
        this._toast('SHIELDED', 'No signal in or out. Pick it back up [E] and seat it in the unlock-unit cradle.', 5000);
      } else if (this.cyber.staged === 'faraday' && !this.carried) {
        this._checkGloves('the victim\'s phone');
        this.carried = { id: 'phone' };
        sfx('collect'); this._refreshCounter();
        this._toast('PHONE IN HAND', 'Shielded the whole way. Seat it in the unit cradle ([E] on the cradle).', 4000);
      } else if (this.cyber.staged === 'faraday') {
        this._toast('FARADAY BOX', 'The phone is inside, dark and quiet.', 3000);
      } else this._toast('FARADAY BOX', 'Empty. It is waiting for the live device.', 3000);
      return;
    }
    if (it.kind === 'unit') {
      const c = this.cyber;
      if (this.carried && this.carried.id === 'phone') {
        if (c.staged !== 'faraday') { this._toast('PROCEDURE', 'Faraday box first — a live phone crosses the room shielded or not at all.', 4000); return; }
        this.carried = null; c.staged = 'cradle'; c.connected = true;
        sfx('collect'); this._refreshCounter();
        this._drawUnit('SEATED · LINKED', 'use the laptop');
        this._toast('SEATED', 'Cradled and cabled. Open the examiner laptop beside it and read README.txt for the procedure — or pick up the handset and guess the PIN if you are in a hurry (three wrong tries wipes it).', 5000);
        return;
      }
      if (c.staged === 'cradle' && !c.unlocked && !c.wiped) return this._openDevice('phone');  // lift handset, type PIN
      if (c.unlocked) return this._openDevice('phone');
      this._toast('UNLOCK UNIT', this._unitHint(), 4000);
      return;
    }
    if (it.kind === 'eyepiece') {
      if (!this.trace.strand || !this.trace.cover) { this._toast('EMPTY STAGE', 'Prep a slide first — strand, then cover slip.', 3500); return; }
      return this._openDevice('eyepiece');
    }
    if (it.kind === 'wand') {
      if (this.carried && this.carried.id === 'uvwand') {   // set it back down
        this.carried = null;
        if (this._wandProp) this._wandProp.visible = true;
        sfx('collect'); this._refreshCounter(); this._applyDocsMood();
        this._toast('WAND DOWN', 'UV wand back on the bench.', 2500);
      } else if (!this.carried) {
        this.carried = { id: 'uvwand' };
        if (this._wandProp) this._wandProp.visible = false;
        sfx('collect'); this._refreshCounter(); this._applyDocsMood();
        if (this.docs.lightsOff) this._toast('UV WAND', 'In hand, and the room is dark. Aim at the torn note and sweep slowly \u2014 the words only show inside the beam.', 6000);
        else this._toast('SWITCH THE LIGHTS OFF FIRST', 'Room light washes the UV out. Flip a wall switch (one on the east wall by this bench, one on the west wall), then sweep the torn note with the wand.', 9000);
      } else this._toast('HANDS FULL', 'Put down what you are carrying first.', 3000);
      return;
    }
    if (it.kind === 'lightswitch') {
      this.docs.lightsOff = !this.docs.lightsOff; sfx('collect');
      this._applyDocsMood(); this._markDocsReads();
      this._toast(this.docs.lightsOff ? 'LIGHTS OFF' : 'LIGHTS ON',
        this.docs.lightsOff
          ? (this.carried && this.carried.id === 'uvwand' ? 'Dark. Aim the wand at the torn note and sweep slowly.' : 'Dark. Now pick up the UV wand from the documents bench.')
          : 'Fluorescents hum back up.', 5000);
      return;
    }
    if (it.kind === 'note') {
      if (!this.collected.note) { this._toast('TORN NOTE', 'Not collected at the scene.', 3000); return; }
      if (this.docs.noteRead) return this._openOverlay(this._transcriptionSlip());
      if (!this.docs.lightsOff) { this._toast('ROOM LIGHT', 'Under these tubes it is just paper. Kill the lights, bring the wand.', 4000); return; }
      const got = this.docs.cover.size;
      this._toast('SWEEP IT YOURSELF', 'Aim the beam across the whole note — ' + got + '/3 thirds fluorescing so far. The words only live inside the beam.', 4500);
      return;
    }
    if (it.kind === 'knob') return this._grabKnob(it.knob);
    if (it.kind === 'bench') {
      if (it.bench === 'digital') return this._openOverlay(this._cyberPanel());
      if (it.bench === 'micro') return this._openOverlay(this._tracePanel());
      if (it.bench === 'dna') return this._openOverlay(this._bioPanel());
      if (it.bench === 'docs') return this._openOverlay(this._docsPanel());
    }
  }
  _unitHint() {
    const c = this.cyber;
    if (c.wiped) return 'The device is wiped. Nothing left to read.';
    if (c.staged === 'bag') return 'The phone is still bagged on the intake table. Carry it here — via the faraday box.';
    if (c.staged === 'carried') return 'Phone in hand. Into the faraday box first.';
    if (c.staged === 'faraday') return 'Phone is shielded. Seat it in the unit cradle to begin.';
    if (c.staged === 'cradle' && !c.unitDone && !c.unlocked) return 'Phone cabled. Open the laptop beside the cradle: dump the lock record, then crack it with hashcat.';
    if (c.unitRunning) return 'Acquisition running — ' + Math.floor(c.unitT) + 's / ' + UNIT_SECS + 's. It continues while you work.';
    if (c.unitDone && !c.unlocked) return 'Lock cracked — pick up the handset and type the PIN you recovered.';
    if (c.unlocked) return 'Unlocked. Lift the handset and read his apps.';
    return 'Seat the phone in the cradle first.';
  }

  _openOverlay(html) {
    this.ui.overlayInner.innerHTML = html;
    this.ui.overlay.style.display = 'block';
    window.__uiCapture = true;
    if (document.exitPointerLock) document.exitPointerLock();
    this._wireOverlay();
  }
  _closeOverlay() {
    this.ui.overlay.style.display = 'none';
    this.ui.overlayInner.innerHTML = '';
    window.__uiCapture = false;
  }
  _openDevice(mode) {
    this._deviceMode = mode;
    this.ui.device.style.display = 'flex';
    window.__uiCapture = true;
    if (document.exitPointerLock) document.exitPointerLock();
    this._renderDevice();
  }
  _closeDevice() {
    if (this._deviceMode === 'terminal' && this._termStop) this._termStop();
    this.ui.device.style.display = 'none';
    this.ui.deviceInner.innerHTML = '';
    window.__uiCapture = false;
    this._deviceMode = null;
  }
  _renderDevice() {
    if (this._deviceMode === 'phone') this._renderPhone();
    else if (this._deviceMode === 'eyepiece') this._renderEyepiece();
    else if (this._deviceMode === 'terminal') this._renderTerminal();
    else if (this._deviceMode === 'glassscan') this._renderGlassScan();
  }

  // ================= INTAKE + FOLDER =================
  _intakePanel() {
    const rows = Object.keys(LABEL).map((id) => {
      const have = this.collected[id];
      return '<div style="display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #c9cfd8;opacity:' + (have ? 1 : 0.4) + '">' +
        '<span>' + (have ? '✓' : '·') + ' <b>' + LABEL[id] + '</b></span>' +
        '<span style="opacity:.65;font-size:12px">' + (have ? 'bagged & tagged' : 'NOT collected — finding will be missing') + '</span></div>';
    }).join('');
    return '<h2 style="letter-spacing:5px;margin:0 0 6px">INTAKE SHEET — CASE #001</h2>' +
      '<p style="opacity:.7;margin:0 0 16px;font-size:13px">08:15 — evidence received from the night scene. Gloves on, then sign to open the chain of custody.</p>' +
      '<div style="background:#fff;border:1px solid #9aa2ad;max-width:660px">' + rows + '</div>' +
      '<button id="intake-sign" style="margin-top:18px;font:inherit;padding:10px 22px;background:' + (this.signedIn ? '#5a6b5a' : '#1f6f5c') + ';color:#fff;border:0;cursor:pointer" ' + (this.signedIn ? 'disabled' : '') + '>' +
      (this.signedIn ? 'Signed — custody open' : 'Sign custody open') + '</button>' +
      '<p style="opacity:.5;margin-top:18px;font-size:12px">[Esc] close</p>';
  }

  _folderPanel() {
    const pages = ['digital', 'micro', 'dna', 'docs'].filter((k) => this.reports[k]).map((k) => {
      const titles = { digital: 'DIGITAL FORENSICS', micro: 'TRACE EVIDENCE', dna: 'DNA ANALYSIS', docs: 'DOCUMENTS' };
      const signed = this.reports[k].signed;
      return '<div style="background:#fff;border:1px solid #9aa2ad;padding:14px 16px;margin-bottom:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center"><b style="letter-spacing:2px">' + titles[k] + '</b>' +
        '<button data-sign="' + k + '" style="font:inherit;padding:6px 14px;background:' + (signed ? '#5a6b5a' : '#7a5a1e') + ';color:#fff;border:0;cursor:pointer" ' + (signed ? 'disabled' : '') + '>' +
        (signed ? 'Signed' : 'Sign page') + '</button></div>' +
        '<div style="font-size:13px;line-height:1.6;margin-top:10px">' + this.reports[k].body + '</div></div>';
    }).join('');
    const names = [...this.dossier.names];
    return '<h2 style="letter-spacing:5px;margin:0 0 6px">CASE FOLDER</h2>' +
      '<p style="opacity:.7;margin:0 0 16px;font-size:13px">Names so far: ' + (names.length ? names.join(' · ') : '—') + '. Every completed page must be signed before the captain accepts the folder.</p>' +
      '<div style="max-width:720px">' + (pages || '<p style="opacity:.6">No pages yet. Finish a bench — its report lands here as paper.</p>') + '</div>' +
      '<h3 style="letter-spacing:3px;margin:22px 0 8px">PHOTOGRAPHS (' + (this.photoCam ? this.photoCam.photos.length : 0) + '/12)</h3>' +
      '<div style="max-width:720px">' + this._photoThumbs() + '</div>' +
      '<p style="opacity:.5;margin-top:18px;font-size:12px">[Esc] close</p>';
  }

  // ================= BENCH 1 — CYBER (phone in hand) =================
  // Examiner workstation as a bench panel: every button mirrors a physical
  // step (same order, same rules) so the phone can never dead-end.
  _cyberPanel() {
    const c = this.cyber;
    if (!this.collected.phone) return '<h2>EXAMINER WORKSTATION</h2><p>The phone was never collected at the scene. The digital record for this run is blank.</p><p style="opacity:.5;font-size:12px">[Esc] close</p>';
    if (c.wiped) return '<h2>EXAMINER WORKSTATION</h2><p>The device is wiped — nothing left to read. The folder notes the loss honestly.</p><p style="opacity:.5;font-size:12px">[Esc] close</p>';
    const step = (label, id, enabled) => '<button id="' + id + '" style="font:inherit;padding:10px 20px;margin:6px 8px 6px 0;background:' + (enabled ? '#1f6f5c' : '#9aa2ad') + ';color:#fff;border:0;cursor:' + (enabled ? 'pointer' : 'default') + '"' + (enabled ? '' : ' disabled') + '>' + label + '</button>';
    let body = '<h2 style="letter-spacing:4px;margin:0 0 6px">EXAMINER WORKSTATION</h2>' +
      '<p style="font-size:13px;opacity:.75;max-width:660px">Do it by hand at the bench ([E] on the phone, box, cradle) or step through here — same procedure: shield, seat, acquire or guess, type the PIN yourself.</p>';
    body += '<div>Where the phone is: <b>' + ({ bag: 'evidence bag (intake)', carried: 'in your hands', faraday: 'faraday box', cradle: 'unit cradle' })[c.staged] + '</b>' +
      (c.unitRunning ? ' · acquiring ' + Math.floor(c.unitT) + 's/' + UNIT_SECS + 's' : c.unitDone ? ' · acquisition done — PIN on unit display' : '') + '</div><div style="margin-top:12px">';
    body += step('Lift the phone out', 'cy-take', c.staged === 'bag' && !this.carried);
    body += step('Lay in faraday box', 'cy-box', !!(this.carried && this.carried.id === 'phone') && c.staged !== 'faraday');
    body += step('Take back out', 'cy-out', c.staged === 'faraday' && !this.carried);
    body += step('Seat in cradle + cable', 'cy-seat', !!(this.carried && this.carried.id === 'phone') && c.staged === 'faraday');
    body += step('Start acquisition (45s)', 'cy-run', c.staged === 'cradle' && !c.unitRunning && !c.unitDone && !c.unlocked);
    body += step('Lift the handset', 'cy-lift', (c.staged === 'cradle' && !c.wiped && (c.unitDone || !c.unitRunning)) || c.unlocked);
    body += '</div><p style="opacity:.5;margin-top:14px;font-size:12px">[Esc] close</p>';
    return body;
  }
  _renderPhone() {
    const c = this.cyber;
    const el = this.ui.deviceInner;
    if (!this.collected.phone) { el.innerHTML = '<p>No phone was collected.</p>'; return; }
    if (c.wiped) {
      el.innerHTML = '<div style="width:300px;background:#0c0e12;border:10px solid #1c1f25;border-radius:28px;padding:26px 18px;text-align:center">' +
        '<div style="font-size:13px;opacity:.7">VICTIM\'S PHONE</div><div style="margin:26px 0;font-size:15px">BLANK.<br><span style="opacity:.6;font-size:12px">Remote wipe completed.<br>The chip holds nothing now.</span></div></div>';
      return;
    }
    if (!c.unlocked) {
      const left = 3 - c.attempts;
      el.innerHTML =
        '<div style="max-width:300px;font-size:12px;line-height:1.7;opacity:.85">The handset is warm from the cradle. Type the PIN on <b>its</b> keypad — the unit never touches the lock screen.' +
        (c.unitDone ? '<br><br>Your hashcat run recovered a PIN. Type it on this keypad.' : '<br><br>Not cracked yet. Either crack it on the laptop (safe) or guess from his habits (risky).') +
        '<br><br>Notebook: “dates — DDMM. October, ringed twice.”' +
        '<br><span style="opacity:.6">[Esc] set the handset down</span></div>' +
        '<div style="width:300px;background:#0c0e12;border:10px solid #1c1f25;border-radius:28px;padding:22px 16px;text-align:center">' +
        '<div style="font-size:11px;opacity:.6">VICTIM\'S PHOTO — a desk clock, a book</div>' +
        '<div id="ph-dots" style="font-size:26px;letter-spacing:8px;margin:16px 0">••••</div>' +
        '<div style="font-size:11px;opacity:.6">wrong tries before wipe: ' + left + '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px">' +
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '⌫'].map((k) => '<button data-k="' + k + '" style="font:inherit;padding:12px;background:#1c222b;color:#dfe7ea;border:1px solid #3a4450;cursor:pointer">' + k + '</button>').join('') +
        '</div></div>';
      let entry = '';
      el.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
        const k = b.getAttribute('data-k');
        const dots = el.querySelector('#ph-dots');
        if (k === 'C') { entry = ''; dots.textContent = '••••'; return; }
        if (k === '⌫') { entry = entry.slice(0, -1); dots.textContent = (entry + '••••').slice(0, 4); return; }
        entry += k; dots.textContent = (entry + '••••').slice(0, 4);
        if (entry.length === 4) {
          if (entry === PIN) {
            c.unlocked = true; c.signalT = 0; sfx('correct');
            this._toast('UNLOCKED', 'You typed it yourself. First job: AIRPLANE MODE — it is already signalling.', 6000);
            this._renderPhone();
          } else {
            c.attempts++; sfx('wrong'); entry = '';
            if (c.attempts >= 3) {
              c.wiped = true;
              try { getStats().wipes++; } catch (e) {}
              this.reports.digital = { body: 'Device wiped after three wrong PINs (analyst entry). No image taken. The digital record for this run is honestly blank.', signed: false };
              this._refreshCounter(); this._renderPhone();
            } else { this._toast('WRONG PIN', (3 - c.attempts) + ' try(ies) left before the device wipes.', 4000); dots.textContent = '••••'; }
          }
        }
      }));
      return;
    }
    // ---- home screen: airplane first, then pages of apps, scrollable threads ----
    const apps = [
      ['messages', '💬', 'Messages'], ['calls', '📞', 'Call log'], ['contacts', '👥', 'Contacts'],
      ['photos', '📷', 'Photos'], ['maps', '🗺', 'Maps'], ['notes', '📝', 'Notes'],
    ];
    const perPage = 4, pages = [apps.slice(0, 4), apps.slice(4)];
    const page = pages[Math.min(c.page, pages.length - 1)];
    const grid = page.map(([k, e, l]) =>
      '<button data-app="' + k + '" style="font:inherit;padding:12px 4px;background:' + (c.openApp === k ? '#dcebf5' : '#1c222b') + ';color:#dfe7ea;border:1px solid #3a4450;cursor:pointer;font-size:12px">' +
      '<div style="font-size:24px">' + e + '</div>' + l + (c.flags.has(k) ? ' ⚑' : '') + '</button>').join('');
    const wipeIn = Math.max(0, Math.ceil(WIPE_SECS - c.signalT));
    el.innerHTML =
      '<div style="max-width:280px;font-size:12px;line-height:1.7;opacity:.85">His phone, in your hand. Swipe pages (‹ ›), open apps, <b>scroll</b> — the useful bits sit at different depths. Flag (⚑) what matters for the report.' +
      '<br><br><span style="opacity:.6">[Esc] set the handset down — the signal timer keeps running</span></div>' +
      '<div style="width:300px;background:#0c0e12;border:10px solid #1c1f25;border-radius:28px;padding:16px 12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;background:' + (c.airplane ? '#1f4f3a' : '#5c1f1f') + ';padding:8px 10px;font-size:12px">' +
      '<span>✈ AIRPLANE ' + (c.airplane ? 'ON' : 'OFF') + '</span>' +
      (c.airplane ? '<span style="opacity:.7">quiet</span>'
        : '<button id="ph-air" style="font:inherit;font-size:12px;padding:6px 10px;background:#dfe7ea;border:0;cursor:pointer">enable</button>') + '</div>' +
      (!c.airplane ? '<div style="font-size:11px;color:#ff9a8a;margin-top:6px">▮ signal — remote wipe in ~' + wipeIn + 's</div>' : '') +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0;font-size:12px;opacity:.7">' +
      '<button id="ph-prev" style="font:inherit;background:none;color:#dfe7ea;border:0;cursor:pointer">‹</button><span>home · page ' + (c.page + 1) + '/' + pages.length + '</span><button id="ph-next" style="font:inherit;background:none;color:#dfe7ea;border:0;cursor:pointer">›</button></div>' +
      '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">' + grid + '</div>' +
      '<div id="ph-app" style="background:#11161c;border:1px solid #3a4450;margin-top:10px;max-height:220px;overflow:auto;padding:10px;font-size:12px;line-height:1.6">' + this._phoneAppDetail(c.openApp) + '</div>' +
      '<button id="ph-log" style="width:100%;margin-top:10px;font:inherit;padding:10px;background:' + (this._phoneLogReady() && this._hasPhoto('unit-display') && !c.reported ? '#1f6f5c' : '#2a3038') + ';color:#fff;border:0" ' + (this._phoneLogReady() && this._hasPhoto('unit-display') && !c.reported ? '' : 'disabled') + '>' + (c.reported ? 'Logged to folder ✓' : 'Log digital report') + '</button>' +
      (!this._phoneLogReady() ? '<div style="font-size:11px;opacity:.6;margin-top:6px">Flag the 23:31 thread, the depot pin and the recent contacts first.</div>' : '') +
      (this._phoneLogReady() && !this._hasPhoto('unit-display') ? '<div style="font-size:11px;opacity:.6;margin-top:6px">Exhibit first: photograph the laptop screen showing the recovered PIN ([Q] camera, close and centred).</div>' : '') +
      '</div>';
    el.querySelector('#ph-prev').addEventListener('click', () => { c.page = (c.page + pages.length - 1) % pages.length; c.openApp = null; this._renderPhone(); });
    el.querySelector('#ph-next').addEventListener('click', () => { c.page = (c.page + 1) % pages.length; c.openApp = null; this._renderPhone(); });
    const air = el.querySelector('#ph-air');
    if (air) air.addEventListener('click', () => {
      c.airplane = true; sfx('collect');
      this._toast('QUIET', 'Airplane mode on. Whatever is out there can no longer reach this chip.', 4000);
      this._renderPhone();
    });
    el.querySelectorAll('[data-app]').forEach((b) => b.addEventListener('click', () => { c.openApp = b.getAttribute('data-app'); sfx('collect'); this._renderPhone(); }));
    el.querySelectorAll('[data-flag]').forEach((b) => b.addEventListener('click', () => {
      c.flags.add(b.getAttribute('data-flag')); sfx('correct'); this._renderPhone();
    }));
    const logBtn = el.querySelector('#ph-log');
    if (logBtn) logBtn.addEventListener('click', () => {
      const cc = this.cyber; if (cc.reported || !this._phoneLogReady() || !this._hasPhoto('unit-display')) return;
      cc.reported = true;
      this.dossier.window = '23:19 → 23:31 → 23:38';
      this.dossier.depot = this.dossier.depot || 'City depot, 14:00';
      this.reports.digital = {
        body: 'Device: Samsung Galaxy A12, IMEI ends 8821. Shielded in faraday, lock record dumped and cracked with hashcat (4-digit mask), PIN entered by hand (consistent with 16 October, DDMM).<br>' +
          'Last message 23:31, “Unknown” (burner, no registry). Recent contacts: ' + IDS.map((id) => NAME(id)).join(', ') + '.<br>' +
          'Maps: city depot pinned twice, 14:00 tomorrow. Notes: “the memo is in the blue folder.”',
        signed: false,
      };
      sfx('correct'); this._refreshCounter(); this._checkCaptainReady();
      this._toast('PAGE FILED', 'Digital forensics page is in the folder. Sign it at the report table.', 4500);
      this._renderPhone();
    });
  }
  _phoneLogReady() {
    const f = this.cyber.flags;
    return f.has('messages') && f.has('maps') && f.has('contacts');
  }
  _phoneAppDetail(app) {
    if (!app) return '<span style="opacity:.5">Open an app above.</span>';
    const flagBtn = (k, label) => this.cyber.flags.has(k)
      ? '<div style="color:#7fd4a0;font-size:11px">⚑ flagged for the report</div>'
      : '<button data-flag="' + k + '" style="font:inherit;font-size:11px;padding:4px 10px;background:#7a5a1e;color:#fff;border:0;cursor:pointer">⚑ flag ' + label + '</button>';
    if (app === 'messages') {
      let s = '<b>MESSAGES — Unknown (burner)</b><div style="height:8px"></div>';
      for (let i = 0; i < 14; i++) s += '<div style="opacity:.45">… older thread …</div>';
      s += '<div>22:48 Unknown: “Exam scripts. Your office, tonight.”</div><div style="height:30px"></div>';
      s += '<div>23:19 You: “Just locked up. Heading to my office.”</div><div style="height:30px"></div>';
      s += '<div><b>23:31 Unknown: “Coming up the back stairs. Tell no one.”</b></div><div style="height:10px"></div>' + flagBtn('messages', '23:31 thread');
      return s;
    }
    if (app === 'calls') return '<b>CALL LOG</b><br>⋮<br><br>'.repeat(4) + '23:31 — incoming, unknown number, 42s.<br>No registry entry. A burner: cash, no contract, no name.';
    if (app === 'contacts') return '<b>CONTACTS — recent</b><br>' + IDS.map((id) => '• ' + SUSPECTS[id].name + ' — ' + SUSPECTS[id].role).join('<br>') + '<div style="height:10px"></div>' + flagBtn('contacts', 'recent list');
    if (app === 'photos') {
      let s = '<b>PHOTOS — 41 items</b><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin:8px 0">';
      for (let i = 0; i < 12; i++) s += '<div style="aspect-ratio:1;background:#2a3038;display:flex;align-items:center;justify-content:center;font-size:16px">🖼</div>';
      s += '</div><div>22:12 — his own desk calendar. <b>October, the 16th ringed twice.</b> He photographed the date he was afraid he would not live to keep.</div>';
      return s;
    }
    if (app === 'maps') return '<b>MAPS</b><br>⋮ history ⋮<br><br>'.repeat(3) + 'Pinned twice this week: <b>City depot — 14:00, tomorrow</b>. Route saved. He meant to go.<div style="height:10px"></div>' + flagBtn('maps', 'depot pin');
    if (app === 'notes') return '<b>NOTES</b><br>“If I don\'t come back from the depot — 14:00 — the memo is in the blue folder. MARKS — BOARD. Three names. One of them is lying.”';
    return '';
  }

  // ================= BENCH 2 — TRACE (comparison scope you drive) =================
  _tracePanel() {
    const t = this.trace;
    if (!this.collected.hair && !this.collected.glass) return '<h2>MICROSCOPY BENCH</h2><p>Neither the hair nor the guest glass was collected. Nothing to compare.</p><p style="opacity:.5;font-size:12px">[Esc] close</p>';
    if (!t.strand || !t.cover) {
      return '<h2 style="letter-spacing:4px;margin:0 0 6px">MICROSCOPY BENCH — PREP</h2>' +
        '<p style="font-size:13px;max-width:640px">A comparison starts with a clean slide — with gloves on. Click the <b>strand</b> to lay it on the stage, then click the <b>cover slip</b> to lower it. No dragging — just clicks, in order.</p>' +
        '<div style="display:flex;gap:12px;margin:20px 0;flex-wrap:wrap">' +
        (t.strand ? '<div style="font:inherit;padding:10px 18px;background:#5a6b5a;color:#fff">✓ strand on stage</div>'
          : '<button id="tr-strand" style="font:inherit;padding:10px 18px;background:#4a2c17;color:#fff;border:1px solid #222;cursor:pointer">1 · Lay the strand</button>') +
        (t.cover ? '<div style="font:inherit;padding:10px 18px;background:#5a6b5a;color:#fff">✓ cover slip down</div>'
          : '<button id="tr-cover" style="font:inherit;padding:10px 18px;background:' + (t.strand ? '#fff' : '#9aa2ad') + ';border:1px solid #555;cursor:pointer" ' + (t.strand ? '' : 'disabled') + '>2 · Lower cover slip</button>') +
        '</div><div id="tr-stage" style="width:170px;height:60px;background:#0c0e12;border:2px solid #8fa2b5;color:#dfe7ea;display:flex;align-items:center;justify-content:center;font-size:12px">MICROSCOPE STAGE' + (t.strand ? ' · strand' : '') + (t.cover ? ' · covered' : '') + '</div>' +
        '<p style="opacity:.6;font-size:12px">[Esc] close</p>';
    }
    const haveGlass = this.collected.glass;
    const claimState = t.claim
      ? ' · claim: ' + t.claim + ' on ' + (t.claimPick ? SUSPECTS[t.claimPick].initials : '(no one picked yet)')
      : ' · no claim yet';
    return '<h2 style="letter-spacing:4px;margin:0 0 6px">MICROSCOPY BENCH</h2>' +
      '<p style="font-size:13px;max-width:660px">Slide is prepped. The verdicts happen <b>inside the eyepiece</b>: lean in (button below or [E] on the tubes), follow the 4-step recipe there, come back here to file.</p>' +
      '<button id="tr-lean" style="font:inherit;padding:10px 22px;background:#1c222b;color:#fff;border:0;cursor:pointer">Lean into the eyepiece</button>' +
      '<div style="font-size:13px;margin:10px 0">Verdicts recorded: ' + Object.keys(t.verdicts).length + '/5' + claimState + '</div>' +
      (haveGlass ? '<div style="margin-top:12px;font-size:13px"><button id="tr-uv" style="font:inherit;padding:8px 16px;background:' + (t.glassUV ? '#5a6b5a' : '#3a4450') + ';color:#fff;border:0;cursor:pointer">' + (t.glassUV ? '✓ Glass examined' : 'Examine guest glass under UV') + '</button>' +
        (t.glassUV ? '<div style="margin-top:8px;background:#fff;border:1px solid #9aa2ad;padding:10px 12px">Partial print on the base — <b>insufficient for identification</b>. Skin texture: dry, cracked, right index finger. Someone who handles dry material — paper, leather, metal.</div>' : '') + '</div>' : '') +
      '<button id="tr-record" style="margin-top:14px;font:inherit;padding:10px 22px;background:' + (this._traceClaimComplete() && this._hasPhoto('microscope') && !t.reported ? '#1f6f5c' : '#9aa2ad') + ';color:#fff;border:0" ' + (this._traceClaimComplete() && this._hasPhoto('microscope') && !t.reported ? '' : 'disabled') + '>' + (t.reported ? 'Recorded in folder' : 'File trace page from my verdict') + '</button>' +
      (this._traceClaimComplete() && !this._hasPhoto('microscope') ? '<p style="font-size:12px;opacity:.6">Exhibit first: photograph the scope itself ([Q], close and centred).</p>' : '') +
      (this._traceClaimComplete() ? '' : '<p style="font-size:12px;opacity:.6">To file: verdicts on at least two references, plus a final claim (consistent names your match; inconclusive is honest but names no one).</p>') +
      '<p style="opacity:.5;font-size:12px;margin-top:12px">[Esc] close</p>';
  }
  _traceClaimComplete() {
    const t = this.trace;
    if (Object.keys(t.verdicts).length < 2) return false;
    // Inconclusive is an honest, fileable result — it just names no one.
    if (t.claim === 'inconclusive') return true;
    return !!(t.claim && t.claimPick && t.verdicts[t.claimPick] === 'consistent');
  }
  // Circular field only — rebuilt on dial input WITHOUT touching the dials,
  // so a drag never destroys the slider mid-motion.
  _eyepieceFieldHTML() {
    const t = this.trace;
    const sharp = t.focus >= 74 && t.focus <= 90;
    const mag = t.turret === '4x' ? 0.7 : t.turret === '10x' ? 1 : 1.6;
    const blur = sharp ? 0 : Math.min(6, Math.abs(t.focus - 82) / 8);
    const strandCss = (color) => 'height:6px;border-radius:3px;background:' + color + ';width:' + Math.round(200 * mag) + 'px;transform:translate(' + t.stageX + 'px,' + t.stageY + 'px);filter:blur(' + blur + 'px);';
    const kCol = this.killer.hairName === 'brown' ? 'linear-gradient(90deg,#3a2412,#6b4423)' : 'linear-gradient(90deg,#0c0c0c,#2c2c2c)';
    const refColor = (id) => {
      const s = SUSPECTS[id];
      return s.hairName === 'brown' ? 'linear-gradient(90deg,#3a2412,#6b4423)' : 'linear-gradient(90deg,#0c0c0c,#2c2c2c)';
    };
    const cur = t.openRef ? SUSPECTS[t.openRef] : null;
    const kd = hairDetail(this.case.killerId, this.case.killerId);
    const rd = t.openRef ? hairDetail(t.openRef, this.case.killerId) : null;
    const showMedulla = sharp && t.turret !== '4x';
    const showCuticle = sharp && t.turret === '40x';
    // Both halves share one fixed centre line: label row, strand row, traits.
    // Nothing above the strands ever changes height, so left and right sit level.
    // No wrapper divs: each half is a direct, equal flex child (flex:1 1 0).
    const half = (inner, border) => '<div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;padding:10px 6px;overflow-y:auto;overflow-x:hidden' + (border ? ';border-right:2px solid #3a4450' : '') + '">' + inner + '</div>';
    const labelRow = (txt) => '<div style="min-height:30px;max-width:100%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:11px;opacity:.8;overflow-wrap:break-word">' + txt + '</div>';
    const strandRow = (css) => '<div style="height:46px;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden"><div style="' + css + ';flex-shrink:0"></div></div>';
    const traitBox = (html) => '<div style="font-size:11px;line-height:1.7;width:100%;text-align:center;overflow-wrap:break-word">' + html + '</div>';
    const leftHalf = half(
      labelRow('LEFT — UNKNOWN') +
      strandRow(strandCss(kCol)) +
      traitBox('<span style="opacity:.7">' + (this.killer.hairLong ? 'long' : 'short') + ' ' + this.killer.hairName + ', single donor</span><br>medulla: ' + (showMedulla ? kd.medulla : '—') + '<br>pigment: ' + (sharp ? kd.pigment : '—') + '<br>cuticle: ' + (showCuticle ? kd.cuticle : '—')), true);
    let rightHalf;
    if (cur) {
      rightHalf = half(
        labelRow('RIGHT — ' + cur.name) +
        strandRow(strandCss(refColor(t.openRef))) +
        traitBox(
          'medulla: ' + (showMedulla ? rd.medulla : '<span style="opacity:.4">— 10x+ —</span>') + '<br>' +
          'pigment: ' + (sharp ? rd.pigment : '<span style="opacity:.4">— focus —</span>') + '<br>' +
          'cuticle: ' + (showCuticle ? rd.cuticle : '<span style="opacity:.4">— 40x —</span>')) +
        (sharp && t.turret === '40x'
          ? '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;justify-content:center">' +
            ['consistent', 'excluded', 'unclear'].map((v) => '<button data-verdict="' + v + '" style="font:inherit;font-size:11px;padding:6px 10px;background:' + (t.verdicts[t.openRef] === v ? '#1f6f5c' : '#2a3038') + ';color:#fff;border:0;cursor:pointer">' + v + '</button>').join('') + '</div>'
          : '<div style="font-size:11px;opacity:.6;margin-top:8px">Verdicts unlock at sharp focus on 40x.</div>'));
    } else {
      rightHalf = half(labelRow('RIGHT — rack a reference') + strandRow('height:6px;width:120px;background:#2a3038') + traitBox('<span style="opacity:.5">Empty stage.</span>'));
    }
    return '<div style="position:absolute;inset:0;display:flex">' + leftHalf + rightHalf + '</div>';
  }
  _refreshEyepieceField() {
    const t = this.trace;
    const field = this.ui.deviceInner.querySelector('#ep-field');
    if (field) field.innerHTML = this._eyepieceFieldHTML();
    const num = this.ui.deviceInner.querySelector('#ep-focus-num');
    if (num) num.textContent = Math.round(t.focus) + ((t.focus >= 74 && t.focus <= 90) ? ' — SHARP' : '');
    this._wireEyepieceVerdicts();
  }
  _wireEyepieceVerdicts() {
    const t = this.trace;
    const el = this.ui.deviceInner;
    el.querySelectorAll('[data-verdict]').forEach((b) => b.addEventListener('click', () => {
      const v = b.getAttribute('data-verdict');
      const prev = t.verdicts[t.openRef];
      t.verdicts[t.openRef] = v; sfx('collect');
      if (t.openRef === this.case.killerId && v === 'excluded' && prev !== 'excluded') {
        try { getStats().wrongExclusions++; } catch (e) {}
        this._loseTrust(1, 'You excluded the true donor on the scope. The captain will remember that.');
      }
      this._renderEyepiece();
    }));
  }
  _renderEyepiece() {
    const t = this.trace;
    const el = this.ui.deviceInner;
    const sharp = t.focus >= 74 && t.focus <= 90;
    const refs = IDS.map((id) => {
      const s = SUSPECTS[id];
      const v = t.verdicts[id];
      return '<button data-ref="' + id + '" style="font:inherit;padding:8px 10px;background:' + (t.openRef === id ? '#7a5a1e' : '#1c222b') + ';color:#dfe7ea;border:1px solid #3a4450;cursor:pointer;font-size:12px">' +
        s.initials + (v ? (v === 'consistent' ? ' ≈' : v === 'excluded' ? ' ✕' : ' ?') : '') + '</button>';
    }).join('');
    const claimOpts = [['consistent', 'Consistent with my pick (hedged — the honest wording)'], ['absolute', 'Positive identification (absolute — overstates the science)'], ['inconclusive', 'Inconclusive']];
    const stepRow = (ok, label) => '<div style="font-size:11px;margin:2px 0">' + (ok ? '✓ ' : '○ ') + label + '</div>';
    const curVerd = t.openRef ? t.verdicts[t.openRef] : null;
    const nVerd = Object.keys(t.verdicts).length;
    const photoOk = this._hasPhoto('microscope');
    const fileReady = this._traceClaimComplete() && photoOk;
    const progRow = (ok, label) => '<div style="font-size:11px;margin:2px 0">' + (ok ? '✓ ' : '○ ') + label + '</div>';
    el.innerHTML =
      '<div style="font-size:12px;opacity:.85;max-width:250px;line-height:1.7"><b>HOW TO COMPARE</b><br>Left = the unknown hair from the guest chair. Right = a suspect\'s known hair.<br><br>1. Click a reference (initials) in the rack.<br>2. Drag FOCUS until it says SHARP.<br>3. Turret to 40x (click turret).<br>4. Compare medulla, pigment and cuticle left vs right. All three match = consistent. Any real difference = excluded.<br>5. Do 2+ references, then set your final claim.<br><br>Colour alone proves nothing \u2014 two people can share it.<br><br><span style="opacity:.6">[Esc] lean back</span></div>' +
      '<div style="width:420px;height:420px;border-radius:50%;border:14px solid #111318;background:#05080c;position:relative;overflow:hidden;flex-shrink:0"><div id="ep-field" style="position:absolute;inset:0">' + this._eyepieceFieldHTML() + '</div></div>' +
      '<div style="width:280px;font-size:12px;display:flex;flex-direction:column;gap:10px">' +
      '<div><div style="opacity:.7;margin-bottom:4px">REFERENCE RACK</div><div style="display:flex;gap:6px;flex-wrap:wrap">' + refs + '</div></div>' +
      '<div style="background:#11161c;border:1px solid #3a4450;padding:8px 10px"><div style="opacity:.7;margin-bottom:4px">RECIPE — verdicts in 4 steps</div>' +
      stepRow(!!t.openRef, '1 · rack a reference' + (t.openRef ? ' (' + SUSPECTS[t.openRef].name + ')' : '')) +
      stepRow(sharp, '2 · FOCUS dial to SHARP (74–90)') +
      stepRow(t.turret === '40x', '3 · turret to 40x (now ' + t.turret + ')') +
      stepRow(!!curVerd, '4 · mark consistent / excluded' + (curVerd ? ' (' + curVerd + ')' : '')) + '</div>' +
      '<div>FOCUS dial <input id="ep-focus" type="range" min="0" max="100" value="' + t.focus + '" style="width:100%;accent-color:#7fd4a0"> <span id="ep-focus-num">' + Math.round(t.focus) + (sharp ? ' — SHARP' : '') + '</span></div>' +
      '<div>STAGE dials <input id="ep-sx" type="range" min="-50" max="50" value="' + t.stageX + '" style="width:46%;accent-color:#7fd4a0"> <input id="ep-sy" type="range" min="-50" max="50" value="' + t.stageY + '" style="width:46%;accent-color:#7fd4a0"></div>' +
      '<div>OBJECTIVE: <b>' + t.turret + '</b> <span style="opacity:.6">(tap the 3D turret, or</span> <button id="ep-turret" style="font:inherit;font-size:11px;padding:4px 10px;background:#2a3038;color:#fff;border:0;cursor:pointer">click turret</button><span style="opacity:.6">)</span></div>' +
      '<div><div style="opacity:.7;margin-bottom:4px">MY FINAL CLAIM</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:6px">' + IDS.map((id) => '<button data-pick="' + id + '" style="font:inherit;font-size:11px;padding:4px 8px;background:' + (t.claimPick === id ? '#7a5a1e' : '#2a3038') + ';color:#fff;border:0;cursor:pointer">' + SUSPECTS[id].initials + '</button>').join('') + '</div>' +
      claimOpts.map(([v, l]) => '<label style="display:block;margin:4px 0;cursor:pointer"><input type="radio" name="claim" value="' + v + '"' + (t.claim === v ? ' checked' : '') + '> ' + l + '</label>').join('') + '</div>' +
      '<div style="background:#11161c;border:1px solid #3a4450;padding:8px 10px"><div style="opacity:.7;margin-bottom:4px">TO FILE THIS BENCH</div>' +
      progRow(nVerd >= 2, 'verdicts on 2+ references (' + nVerd + '/2)') +
      progRow(!!(t.claim === 'inconclusive' || (t.claim && t.claimPick && t.verdicts[t.claimPick] === 'consistent')), 'final claim' + (t.claim === 'inconclusive' ? ' (inconclusive names no one)' : '')) +
      progRow(photoOk, 'scope photographed ([Q] in the room)') +
      '<div style="font-size:11px;opacity:.75;margin-top:6px">' + (fileReady ? 'Ready — lean back [Esc], [E] the bench, file the page.' : 'Nothing files from in here — lean back [Esc] when the boxes above are ticked, then file at the bench.') + '</div></div>' +
      '</div>';
    // Dials update the field in place — never rebuild the shell mid-drag.
    el.querySelector('#ep-focus').addEventListener('input', (e) => { t.focus = +e.target.value; this._applyScopeState(); this._refreshEyepieceField(); });
    el.querySelector('#ep-sx').addEventListener('input', (e) => { t.stageX = +e.target.value; this._applyScopeState(); this._refreshEyepieceField(); });
    el.querySelector('#ep-sy').addEventListener('input', (e) => { t.stageY = +e.target.value; this._applyScopeState(); this._refreshEyepieceField(); });
    el.querySelector('#ep-turret').addEventListener('click', () => this._grabKnob('turret'));
    el.querySelectorAll('[data-ref]').forEach((b) => b.addEventListener('click', () => {
      t.openRef = b.getAttribute('data-ref'); t.seenRefs.add(t.openRef); sfx('collect'); this._renderEyepiece();
    }));
    this._wireEyepieceVerdicts();
    el.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { t.claimPick = b.getAttribute('data-pick'); this._renderEyepiece(); }));
    el.querySelectorAll('input[name="claim"]').forEach((r) => r.addEventListener('change', () => {
      const prev = t.claim; t.claim = r.value;
      if (r.value === 'absolute' && prev !== 'absolute') this._loseTrust(1, '“Positive identification” overstates hair science. The captain circled it in red.');
      this._renderEyepiece();
    }));
  }

  // ================= BENCH 3 — BIOLOGY (phase-2 panel, unchanged logic) =================
  _bioPanel() {
    const b = this.bio;
    if (!this.collected.handkerchief) return '<h2>DNA BENCH</h2><p>The handkerchief was never collected. No blood, no profile.</p><p style="opacity:.5;font-size:12px">[Esc] close</p>';
    if (!b.loaded) {
      return '<h2 style="letter-spacing:4px;margin:0 0 6px">DNA BENCH — PREP</h2>' +
        '<p style="font-size:13px;max-width:640px">Gloves on. Cut a swatch from the stained linen, wash it in lysis buffer, then seat the single-use cartridge. (Phase 2 will make the pipette, centrifuge and peak-overlay manual — the chemistry below is unchanged.)</p>' +
        '<div style="display:flex;gap:12px;margin:18px 0;flex-wrap:wrap">' +
        '<button id="bio-cut" style="font:inherit;padding:10px 18px;background:' + (b.cut ? '#5a6b5a' : '#fff') + ';border:1px solid #555;cursor:pointer">' + (b.cut ? '✓ swatch cut' : '1 · Cut swatch') + '</button>' +
        '<button id="bio-lysis" style="font:inherit;padding:10px 18px;background:' + (b.lysis ? '#5a6b5a' : '#fff') + ';border:1px solid #555;cursor:pointer" ' + (b.cut && !b.lysis ? '' : 'disabled') + '>' + (b.lysis ? '✓ in lysis buffer' : '2 · Lysis buffer') + '</button>' +
        '<button id="bio-load" style="font:inherit;padding:10px 18px;background:#1f6f5c;color:#fff;border:0;cursor:pointer" ' + (b.lysis && !b.loaded ? '' : 'disabled') + '>3 · Seat cartridge (clicks in)</button></div>' +
        '<p style="opacity:.6;font-size:12px">[Esc] close</p>';
    }
    if (!b.ready) {
      if (b.running) {
        const pct = Math.min(100, Math.round((b.t / 180) * 100));
        return '<h2 style="letter-spacing:4px;margin:0 0 6px">SEQUENCER — RUNNING</h2>' +
          '<p style="font-size:13px">Stage: <b>' + this._dnaStage() + '</b>. Close [Esc] and work elsewhere (' + Math.floor(b.t) + 's / 180s).</p>' +
          '<div style="height:14px;background:#d4d9df;border:1px solid #9aa2ad;position:relative;max-width:560px"><div style="position:absolute;inset:0 ' + (100 - pct) + '% 0 0;background:#2a5f80"></div></div>';
      }
      return '<h2 style="letter-spacing:4px;margin:0 0 6px">DNA BENCH — READY</h2>' +
        '<p style="font-size:13px;max-width:640px">Cartridge seated. A full 16-locus STR run takes about three minutes. Start it, then go work another bench.</p>' +
        '<button id="bio-run" style="font:inherit;padding:10px 22px;background:#1f6f5c;color:#fff;border:0;cursor:pointer">Start STR run (3 min)</button>' +
        '<p style="opacity:.6;font-size:12px;margin-top:14px">[Esc] close</p>';
    }
    let bars = '';
    for (let i = 0; i < 16; i++) {
      const h = 20 + ((this.case.seed >> (i % 24)) + i * 37) % 60;
      bars += '<div style="flex:1;background:#2a5f80;height:' + h + 'px" title="D' + (i + 1) + '"></div>';
    }
    return '<h2 style="letter-spacing:4px;margin:0 0 6px">DNA BENCH — PROFILE READY</h2>' +
      '<p style="font-size:13px;opacity:.75">16-locus STR profile, high confidence. Compare against the five known references.</p>' +
      '<div style="display:flex;gap:3px;align-items:flex-end;height:100px;background:#fff;border:1px solid #9aa2ad;padding:10px;max-width:560px">' + bars + '</div>' +
      '<div style="background:#fff;border:1px solid #9aa2ad;padding:12px 14px;margin-top:12px;max-width:640px;font-size:13px;line-height:1.6">' +
      (b.matched ? this._bioMatchText() : 'Run the match when ready.') + '</div>' +
      (b.matched ? '<button id="bio-log" style="margin-top:12px;font:inherit;padding:10px 22px;background:' + (b.reported ? '#5a6b5a' : (this._hasPhoto('sequencer') ? '#1f6f5c' : '#9aa2ad')) + ';color:#fff;border:0" ' + (b.reported || !this._hasPhoto('sequencer') ? 'disabled' : '') + '>' + (b.reported ? 'Logged to folder' : 'Log DNA report') + '</button>'
        : '<button id="bio-match-btn" style="margin-top:12px;font:inherit;padding:10px 22px;background:#1f6f5c;color:#fff;border:0;cursor:pointer">Run reference match</button>') +
      (b.matched && !b.reported && !this._hasPhoto('sequencer') ? '<p style="font-size:12px;opacity:.6">Exhibit first: photograph the sequencer readout ([Q], close and centred).</p>' : '') +
      '<p style="opacity:.5;font-size:12px;margin-top:12px">[Esc] close</p>';
  }
  _dnaStage() {
    const t = this.bio.t;
    if (t < 30) return 'LYSIS';
    if (t < 60) return 'EXTRACTION';
    if (t < 120) return 'PCR AMPLIFICATION';
    if (t < 170) return 'CAPILLARY ELECTROPHORESIS';
    return 'PROFILE READY';
  }
  _bioMatchText() {
    return '<b>Match:</b> profile is <b>consistent with ' + this.witness.name + '</b> (' + this.witness.role + ', known reference).<br>' +
      'The blood is not the victim\'s. It is not the handkerchief owner\'s either — the linen is monogrammed <b>' + this.killer.initials + '</b> (' + this.killer.name + ').<br>' +
      'Two individuals were in that room.';
  }

  // ================= BENCH 4 — DOCUMENTS (phase-2 panel, unchanged logic) =================
  // What you copied off the paper under the beam — your transcription, filed as paper
  _transcriptionSlip() {
    return '<h2 style="letter-spacing:4px;margin:0 0 6px">TRANSCRIPTION — TORN NOTE</h2>' +
      '<p style="opacity:.7;font-size:13px;margin:0 0 14px">Copied by hand under the wand, ' + this._labClock() + '. Second hand pressed hard — not the victim\'s writing.</p>' +
      '<div style="background:#fff;border:1px solid #9aa2ad;padding:18px 20px;max-width:560px;font-size:15px;line-height:1.8">' +
      '“…MARKS — BOARD. Three names on the list.<br>Only one of them is lying to you.”</div>' +
      '<p style="opacity:.5;margin-top:18px;font-size:12px">[Esc] close — the reading itself lives on the paper, this slip is just your copy</p>';
  }
  _docsPanel() {
    const d = this.docs;
    const uvTxt = this.docs.noteRead
      ? '<b style="color:#2a3a8f">“…MARKS — BOARD. Three names on the list. Only one of them is lying to you.”</b><br><span style="font-size:12px;opacity:.7">Transcribed under your own sweep. [E] on the note re-reads it.</span>'
      : '<span style="opacity:.6">Unresolved — sweep coverage ' + this.docs.cover.size + '/3. Pick up the wand, kill the wall lights, sweep the paper by hand.</span>';
    return '<h2 style="letter-spacing:4px;margin:0 0 6px">DOCUMENTS BENCH</h2>' +
      '<p style="font-size:13px;opacity:.75;max-width:660px">The note is read <b>by hand</b>: pick up the UV wand on the bench, kill the room lights (wall switch, west wall), and sweep the beam across the paper until all three thirds fluoresce. Calendar and trail photos below.</p>' +
      '<div style="display:flex;gap:10px;margin:14px 0;flex-wrap:wrap">' +
      '<button id="doc-lights" style="font:inherit;padding:8px 16px;background:' + (d.lightsOff ? '#3a3f47' : '#fff') + ';color:' + (d.lightsOff ? '#fff' : '#111') + ';border:1px solid #555;cursor:pointer">' + (d.lightsOff ? 'Room lights: OFF' : 'Kill room lights (mirrors wall switch)') + '</button>' +
      '<div style="font-size:12px;align-self:center;opacity:.7">sweep coverage: ' + d.cover.size + '/3' + (d.noteRead ? ' ✓' : '') + '</div></div>' +
      '<div style="background:#fff;border:1px solid #9aa2ad;padding:12px 14px;max-width:640px;font-size:13px;line-height:1.6">' +
      '<b>TORN NOTE</b> (item #6) — ' + (this.collected.note ? uvTxt : 'not collected at the scene.') + '</div>' +
      '<div style="background:#fff;border:1px solid #9aa2ad;padding:12px 14px;margin-top:10px;max-width:640px;font-size:13px;line-height:1.6">' +
      '<b>DESK CALENDAR</b> (item #8) — ' + (this.collected.calendar
        ? 'October, the <b>16th ringed twice</b>. One appointment stands out: <b>city depot, 14:00, tomorrow</b>' + (this.cyber.reported ? ' (GPS-confirmed)' : ' (pending phone read)') + '.'
        : 'not collected at the scene.') + '</div>' +
      '<div style="background:#fff;border:1px solid #9aa2ad;padding:12px 14px;margin-top:10px;max-width:640px;font-size:13px;line-height:1.6">' +
      '<b>TRAIL PHOTOS</b> (item #7) — ' + (this.collected.trail
        ? 'stride 61cm, steady, no drag marks, no stumble. Whoever bled here <b>walked out calmly</b> — they did not run.'
        : 'not collected at the scene.') +
      (this.collected.casing ? '<br><b>CASING</b> (item #1) — 9×19mm Parabellum, unregistered lot. Primer strike fits a service pistol with the serial filed off. Under-a-metre shot.' : '') + '</div>' +
      '<button id="doc-log" style="margin-top:14px;font:inherit;padding:10px 22px;background:' + (this._docsReady() && this._hasPhoto('note') && !d.reported ? '#1f6f5c' : '#9aa2ad') + ';color:#fff;border:0" ' + (this._docsReady() && this._hasPhoto('note') && !d.reported ? '' : 'disabled') + '>' + (d.reported ? 'Logged to folder' : 'Log documents report') + '</button>' +
      (this._docsReady() && !this._hasPhoto('note') ? '<p style="font-size:12px;opacity:.6">Exhibit first: photograph the note ([Q], close and centred — lights on reads best).</p>' : '') +
      (this._docsReady() ? '' : '<p style="font-size:12px;opacity:.6">Read the note under UV, the calendar and the trail photos to log this page.</p>') +
      '<p style="opacity:.5;font-size:12px;margin-top:12px">[Esc] close</p>';
  }
  _docsReady() {
    return (!this.collected.note || this.docs.noteRead) &&
      (!this.collected.calendar || this.docs.calRead) && (!this.collected.trail || this.docs.trailRead);
  }

  // ================= OVERLAY WIRING (paper panels) =================
  _wireOverlay() {
    const q = (s) => this.ui.overlayInner.querySelector(s);
    const qa = (s) => [...this.ui.overlayInner.querySelectorAll(s)];
    const rerender = (html) => { this.ui.overlayInner.innerHTML = html; this._wireOverlay(); };

    const sign = q('#intake-sign');
    if (sign) sign.addEventListener('click', () => {
      this.signedIn = true; sfx('collect');
      this._toast('CUSTODY OPEN', 'Evidence signed in. Gloves on — the benches are yours, any order.', 4000);
      rerender(this._intakePanel());
    });
    qa('[data-sign]').forEach((b) => b.addEventListener('click', () => {
      const k = b.getAttribute('data-sign');
      if (this.reports[k]) { this.reports[k].signed = true; sfx('collect'); rerender(this._folderPanel()); this._checkCaptainReady(); }
    }));

    // --- trace prep: click-click, in order (no dragging anywhere in the lab) ---
    const st = q('#tr-strand'), cv = q('#tr-cover');
    if (st) st.addEventListener('click', () => {
      this._checkGloves('the hair fibres');
      this.trace.strand = true; sfx('collect'); rerender(this._tracePanel());
    });
    if (cv) cv.addEventListener('click', () => {
      if (!this.trace.strand) return;
      this.trace.cover = true; sfx('collect'); rerender(this._tracePanel());
    });
    const tuv = q('#tr-uv');
    if (tuv) tuv.addEventListener('click', () => { this.trace.glassUV = true; sfx('collect'); rerender(this._tracePanel()); });
    const lean = q('#tr-lean');
    if (lean) lean.addEventListener('click', () => { this._closeOverlay(); this._openDevice('eyepiece'); });

    // --- cyber bench panel: same physical steps, as buttons ---
    const cyTake = q('#cy-take'), cyBox = q('#cy-box'), cyOut = q('#cy-out');
    const cySeat = q('#cy-seat'), cyRun = q('#cy-run'), cyLift = q('#cy-lift');
    const cyRefresh = () => rerender(this._cyberPanel());
    if (cyTake) cyTake.addEventListener('click', () => {
      if (this.cyber.staged !== 'bag' || this.carried) return;
      this._checkGloves('the victim\'s phone');
      this.carried = { id: 'phone' }; this.cyber.staged = 'carried';
      if (this._phoneProp) this._phoneProp.visible = false;
      sfx('collect'); this._refreshCounter(); cyRefresh();
    });
    if (cyBox) cyBox.addEventListener('click', () => {
      if (!(this.carried && this.carried.id === 'phone')) return;
      this.carried = null; this.cyber.staged = 'faraday';
      sfx('collect'); this._refreshCounter(); cyRefresh();
    });
    if (cyOut) cyOut.addEventListener('click', () => {
      if (this.cyber.staged !== 'faraday' || this.carried) return;
      this._checkGloves('the victim\'s phone');
      this.carried = { id: 'phone' };
      sfx('collect'); this._refreshCounter(); cyRefresh();
    });
    if (cySeat) cySeat.addEventListener('click', () => {
      if (!(this.carried && this.carried.id === 'phone') || this.cyber.staged !== 'faraday') return;
      this.carried = null; this.cyber.staged = 'cradle'; this.cyber.connected = true;
      this._drawUnit('SEATED · LINKED', 'start acquisition');
      sfx('collect'); this._refreshCounter(); cyRefresh();
    });
    if (cyRun) cyRun.addEventListener('click', () => {
      const c = this.cyber;
      if (c.staged !== 'cradle' || c.unitRunning || c.unitDone) return;
      c.unitRunning = true; c.unitT = 0;
      this._drawUnit('ACQUIRING…', 'keep working — 45s');
      sfx('collect'); cyRefresh();
    });
    if (cyLift) cyLift.addEventListener('click', () => { this._closeOverlay(); this._openDevice('phone'); });
    const rec = q('#tr-record');
    if (rec) rec.addEventListener('click', () => {
      const t = this.trace; if (t.reported || !this._traceClaimComplete() || !this._hasPhoto('microscope')) return;
      t.reported = true;
      const pick = SUSPECTS[t.claimPick];
      const kl = this.killer.hairLong ? 'long' : 'short';
      const claimLine = t.claim === 'absolute'
        ? 'Analyst claims <b>positive identification of ' + pick.name + '</b> — this overstates hair comparison science.'
        : t.claim === 'consistent'
          ? 'Analyst concludes the unknown hair is <b>consistent with ' + pick.name + '</b> (' + pick.role + ') — hedged, as comparison work requires.'
          : 'Analyst records the comparison as <b>inconclusive</b>.';
      const verdLines = Object.keys(t.verdicts).map((id) => NAME(id) + ': ' + t.verdicts[id]).join('; ');
      this.reports.micro = {
        body: 'Hair (item #3): ' + kl + ', ' + this.killer.hairName + ', single donor. Examined at 40x against racked knowns — verdicts: ' + verdLines + '.<br>' + claimLine + '<br>' +
          'Guest glass (item #2): partial print, <b>insufficient for identification</b>. Dry, cracked skin, right index finger.',
        signed: false,
      };
      if (t.claim === 'consistent' && t.claimPick) this.dossier.names.add(pick.name);
      if (t.claim === 'inconclusive') this._toast('FILED WEAK', 'Inconclusive is honest — but the captain still needs a name from somewhere.', 5000);
      sfx('correct'); this._refreshCounter(); this._checkCaptainReady();
      rerender(this._tracePanel());
    });

    // --- bio ---
    const cut = q('#bio-cut'), lys = q('#bio-lysis'), load = q('#bio-load');
    if (cut) cut.addEventListener('click', () => { this._checkGloves('the stained linen'); this.bio.cut = true; sfx('collect'); rerender(this._bioPanel()); });
    if (lys) lys.addEventListener('click', () => { if (this.bio.cut) { this.bio.lysis = true; sfx('collect'); rerender(this._bioPanel()); } });
    if (load) load.addEventListener('click', () => { if (this.bio.lysis) { this.bio.loaded = true; sfx('collect'); rerender(this._bioPanel()); } });
    const run = q('#bio-run');
    if (run) run.addEventListener('click', () => { this.bio.running = true; this.bio.t = 0; sfx('collect'); rerender(this._bioPanel()); });
    const mb = q('#bio-match-btn');
    if (mb) mb.addEventListener('click', () => { this.bio.matched = true; sfx('correct'); rerender(this._bioPanel()); });
    const bl = q('#bio-log');
    if (bl) bl.addEventListener('click', () => {
      const b = this.bio; if (b.reported || !this._hasPhoto('sequencer')) return;
      b.reported = true;
      this.reports.dna = { body: 'Sample: dried blood, item #4 (handkerchief). Full 16-locus STR profile, high confidence.<br>' + this._bioMatchText() + '<br>Trail photo (item #7): the bleeder walked — steady stride, no drag. Whoever left was calm.', signed: false };
      this.dossier.names.add(this.killer.name);
      this.dossier.names.add(this.witness.name);
      this.dossier.temperament = 'walked out, steady, calm';
      sfx('correct'); this._refreshCounter(); this._checkCaptainReady();
      this._toast('PAGE FILED', 'DNA page names a second person. Two people were in that room.', 4500);
      rerender(this._bioPanel());
    });

    // --- docs ---
    const li = q('#doc-lights'), uvb = q('#doc-uv');
    if (li) li.addEventListener('click', () => {
      this.docs.lightsOff = !this.docs.lightsOff; sfx('collect');
      this._applyDocsMood(); this._markDocsReads(); rerender(this._docsPanel());
    });
    if (uvb) uvb.addEventListener('click', () => {
      this.docs.uvOn = !this.docs.uvOn; sfx('collect');
      this._applyDocsMood(); this._markDocsReads(); rerender(this._docsPanel());
    });
    const dl = q('#doc-log');
    if (dl) dl.addEventListener('click', () => {
      const d = this.docs; if (d.reported || !this._docsReady() || !this._hasPhoto('note')) return;
      d.reported = true;
      this.reports.docs = {
        body: 'Torn note (item #6): two hands on one page. ESDA under UV reveals the missing half — <b>“MARKS — BOARD. Three names on the list. Only one of them is lying to you.”</b><br>' +
          'Desk calendar (item #8): October, 16th ringed twice — <b>city depot, 14:00</b>' + (this.cyber.reported ? ' (GPS-confirmed)' : '') + '; the other ring is the board meeting.<br>' +
          'UV trail (item #7): steady 61cm stride, no drag — the bleeder walked. Calm on the way out.<br>' +
          'Casing (item #1): 9×19mm, unregistered. Whoever brought the gun brought it on purpose.',
        signed: false,
      };
      this.dossier.weapon = '9mm, unregistered';
      this.dossier.depot = 'City depot, 14:00';
      this.dossier.memo = 'three names on the altered-marks memo';
      sfx('correct'); this._refreshCounter(); this._checkCaptainReady();
      this._toast('PAGE FILED', 'Documents page filed — motive, meeting and temperament.', 4500);
      rerender(this._docsPanel());
    });
  }
  _markDocsReads() {
    // The note is read only by hand-sweep (coverage), never by toggles.
    // calendar + trail prints are read by hand now (see LabExtras)
  }
  _applyDocsMood() {
    if (this._uvMat) this._uvMat.uniforms.uUV.value = this.docs.uvOn ? 1 : 0;
    if (this._uvLight) this._uvLight.intensity = this.docs.uvOn ? 5 : 0;
    if (this._uvLampHead) this._uvLampHead.material.emissiveIntensity = this.docs.uvOn ? 2.2 : 0.4;
    if (this._docsLight) this._docsLight.material.emissiveIntensity = this.docs.lightsOff ? 0.12 : 0.55;
    // The room itself goes dark by the wall switch — the wand beam then owns the note
    const dark = this.docs.lightsOff ? 1 : 0;
    if (this._hemi) this._hemi.intensity = dark ? 0.35 : 1.7;
    for (const s of this._stripLights || []) { if (!s.flicker) s.pl.intensity = dark ? 4 : 22; }
    if (this._noteMat) this._noteMat.uniforms.uOn.value = (this.docs.lightsOff && this.carried && this.carried.id === 'uvwand') ? 1 : 0;
  }

  // ================= CAPTAIN =================
  _checkCaptainReady() {
    const done = Object.keys(this.reports).length;
    if (done >= 3 && !this.captainReady) {
      this.captainReady = true;
      this._toast('THE CAPTAIN IS WAITING', 'Capt. R. Mabaso is at her desk. Sign your pages at the report table, then report. [E] to speak.', 9000);
    }
  }
  _openCaptain() {
    if (!this.captainReady) { this._toast('NOT YET', 'File at least three bench reports before you report.', 3500); return; }
    this.ui.captain.style.display = 'flex';
    window.__uiCapture = true;
    if (document.exitPointerLock) document.exitPointerLock();
    const names = [...this.dossier.names];
    const unsigned = Object.keys(this.reports).filter((k) => !this.reports[k].signed);
    const line = names.length >= 2
      ? '“Two people were in that room. Both had a reason to lie. One of them is your killer. Find them.”'
      : names.length === 1
        ? '“You\'ve got one name — ' + names[0] + '. I want two. Go back and finish.”'
        : '“Nothing I can act on yet. Go back and finish.”';
    const missing = [];
    if (!this.dossier.weapon) missing.push('weapon profile');
    if (!this.dossier.window) missing.push('time window');
    if (!this.dossier.depot) missing.push('the depot appointment');
    if (!this.dossier.temperament) missing.push('a temperament read');
    if (names.length < 2) missing.push('a second name');
    if (unsigned.length) missing.push('signatures (' + unsigned.join(', ') + ')');
    const canGo = names.length >= 2 && this.dossier.depot && unsigned.length === 0;
    this.ui.captainInner.innerHTML =
      '<div style="font-size:12px;letter-spacing:4px;color:#7fd4ff;opacity:.8;margin-bottom:8px">CAPT. R. MABASO — CASE #001</div>' +
      '<div style="font-size:18px;line-height:1.6;margin-bottom:20px">' + line + '</div>' +
      '<div style="text-align:left;background:rgba(6,8,12,.7);border:1px solid #2a3440;padding:16px 20px;margin:0 auto 20px;max-width:560px;font-size:13px;line-height:1.7">' +
      '<b style="color:#f2b84b;letter-spacing:2px">DOSSIER</b><br>' +
      'NAMES: ' + (names.length ? names.join(', ') : '—') + '<br>' +
      'WEAPON: ' + (this.dossier.weapon || '—') + '<br>' +
      'WINDOW: ' + (this.dossier.window || '—') + '<br>' +
      'DEPOT: ' + (this.dossier.depot || '—') + '<br>' +
      'TEMPERAMENT: ' + (this.dossier.temperament || '—') + '<br>' +
      'MEMO: ' + (this.dossier.memo || '—') + '</div>' +
      '<div style="font-size:12px;opacity:.75;margin-bottom:14px">' + (missing.length ? 'Still missing: ' + missing.join(' · ') : 'The dossier is complete.') + '</div>' +
      (canGo
        ? '<button id="cap-go" style="font:inherit;padding:12px 26px;background:#a1241c;color:#fff;border:0;cursor:pointer">Take the dossier to the City →</button>'
        : '<button id="cap-close" style="font:inherit;padding:10px 22px;background:#1a2028;color:#c8d8e8;border:1px solid #2a3440;cursor:pointer">Back to the lab</button>');
    const go = this.ui.captainInner.querySelector('#cap-go');
    if (go) go.addEventListener('click', () => this._handoffToCity());
    const close = this.ui.captainInner.querySelector('#cap-close');
    if (close) close.addEventListener('click', () => this._closeCaptain());
  }
  _closeCaptain() { this.ui.captain.style.display = 'none'; window.__uiCapture = false; }
  _handoffToCity() {
    window.__caseProgress = window.__caseProgress || { l1: {} };
    if (this._labMinutes() >= 17 * 60) {
      try { getStats().timeOverrun = 1; } catch (e) {}
      this._toast('SHIFT END', 'The clock reads past 17:00. The captain signs anyway — the delay is on your record.', 5000);
    }
    window.__caseProgress.lab = {
      names: [...this.dossier.names],
      killerId: this.case.killerId,
      witnessId: this.witnessId,
      weapon: this.dossier.weapon,
      window: this.dossier.window,
      depot: this.dossier.depot,
      temperament: this.dossier.temperament,
      memo: this.dossier.memo,
    };
    if (typeof window.__saveRun === 'function') window.__saveRun();
    let st = {}; try { st = getStats(); } catch (e) {}
    this._toast('HANDOFF \u2014 FILED ' + this._labClock(),
      'The captain signs the folder. Contamination: ' + (st.contamination || 0) + ' \u00b7 wipes: ' + (st.wipes || 0) + ' \u00b7 film wasted: ' + (st.wastedFilm || 0) + '. One of those names was seen at GENESIS, the abandoned beachfront site. Go now.', 3600);
    setTimeout(() => { if (typeof window.__switchLevel === 'function') window.__switchLevel(3); }, 3600);
  }

  // ================= FRAME =================
  _applyFirstPerson(player) {
    const cam = window.__camera;
    if (!cam || !player || !player.pos) return;
    cam.position.set(player.pos.x, (player.pos.y || 0) + EYE, player.pos.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(player.pitch || 0, player.yaw || 0, 0);
  }
  _updateFocus(cam) {
    this.focus = null;
    if (!cam) return;
    if (this.heldKnob) { this.ui.prompt.style.display = 'none'; return; }
    if (this.ui.overlay.style.display === 'block' || this.ui.device.style.display === 'flex' || this.ui.captain.style.display === 'flex') {
      this.ui.prompt.style.display = 'none'; return;
    }
    cam.getWorldDirection(this._d);
    this._o.copy(cam.position);
    this._rc.set(this._o, this._d);
    const targets = [];
    this.level.traverse((o) => { if (o.userData.interact) targets.push(o); });
    const hits = this._rc.intersectObjects(targets, false).filter((h) => { const w = h.object.userData.interact.when; return !w || w(); });
    if (!hits.length) { this.ui.prompt.style.display = 'none'; return; }
    // Small precise targets (phone, knobs, eyepiece, cradle) sit INSIDE big
    // bench hitboxes — nearest-surface would always pick the big box. The
    // smallest volume along the ray is the thing you are actually aiming at.
    const vol = (o) => {
      const p = (o.geometry && o.geometry.parameters) || {};
      return ((p.width || 1) * (p.height || 1) * (p.depth || 1));
    };
    hits.sort((a, b) => vol(a.object) - vol(b.object));
    const it = hits[0].object.userData.interact;
    if (it.kind === 'phone' && this.cyber.staged !== 'bag') { this.ui.prompt.style.display = 'none'; return; }
    this.focus = it;
    const label = this._promptFor(it);
    if (!label) { this.ui.prompt.style.display = 'none'; return; }
    this.ui.prompt.textContent = label;
    this.ui.prompt.style.display = 'block';
  }
  _promptFor(it) {
    const c = this.cyber;
    { const x = this._promptExtra(it); if (x !== undefined) return x; }
    if (it.kind === 'gloves') return this.gloves ? 'Gloves on ✓' : '[E] Pull on gloves';
    if (it.kind === 'intake') return '[E] Read intake sheet';
    if (it.kind === 'folder') return '[E] Open case folder';
    if (it.kind === 'captain') return this.captainReady ? '[E] Report to the captain' : '[E] The captain (not ready)';
    if (it.kind === 'phone') return this.carried ? '' : '[E] Lift the phone out (gloves!)';
    if (it.kind === 'faraday') {
      if (this.carried && this.carried.id === 'phone') return '[E] Lay the phone in the faraday box';
      if (c.staged === 'faraday') return '[E] Take the phone back out';
      return 'Faraday box (empty)';
    }
    if (it.kind === 'unit') {
      if (this.carried && this.carried.id === 'phone') return c.staged === 'faraday' ? '[E] Seat phone in cradle + cable' : 'Shield it in the faraday box first';
      if (c.staged === 'cradle' && !c.unlocked && !c.unitDone) return 'Cradle — crack the lock on the laptop (or [E] guess on the handset)';
      if (c.staged === 'cradle' && !c.unlocked) return '[E] Lift the handset — type the PIN';
      if (c.unlocked) return '[E] Lift the handset — read his apps';
      return 'Unlock unit';
    }
    if (it.kind === 'eyepiece') {
      if (!this.trace.strand || !this.trace.cover) return 'Eyepiece (prep a slide first)';
      return '[E] Look through the microscope';
    }
    if (it.kind === 'knob') {
      if (it.knob === 'turret') return '[E] Click turret → ' + this.trace.turret + ' (next: ' + ({ '4x': '10x', '10x': '40x', '40x': '4x' })[this.trace.turret] + ')';
      return '[E] Hold the ' + it.knob + ' knob — drag to turn';
    }
    if (it.kind === 'wand') {
      if (this.carried && this.carried.id === 'uvwand') return '[E] Set the UV wand down';
      return this.carried ? 'UV wand (hands full)' : (this.docs.lightsOff ? '[E] Pick up the UV wand' : '[E] Pick up the UV wand (switch the lights OFF first)');
    }
    if (it.kind === 'lightswitch') return this.docs.lightsOff ? '[E] Room lights on' : '[E] Kill the room lights';
    if (it.kind === 'note') {
      if (!this.collected.note) return 'Note slot (empty)';
      if (this.docs.noteRead) return '[E] Read the transcription';
      if (!this.docs.lightsOff) return 'Torn note \u2014 switch the room lights OFF first (wall switch)';
      if (!(this.carried && this.carried.id === 'uvwand')) return 'Torn note \u2014 pick up the UV wand from the bench';
      return 'Torn note \u2014 sweep it with the wand (' + this.docs.cover.size + '/3)';
    }
    if (it.kind === 'bench') {
      if (it.bench === 'digital') return 'Examiner workstation — work the phone by hand';
      const n = { micro: 'microscope bench', dna: 'DNA bench', docs: 'documents bench' }[it.bench];
      const done = (it.bench === 'micro' && this.reports.micro) || (it.bench === 'dna' && this.reports.dna) || (it.bench === 'docs' && this.reports.docs);
      return '[E] ' + n + (done ? ' (filed)' : '');
    }
    return '[E]';
  }

  update(dt, t, player) {
    this.elapsed += dt;
    // Intercom beats + a nudge when the player has stalled
    if (this._uiBusy()) this._idleT = 0;
    else {
      this._idleT = (this._idleT || 0) + dt;
      this._radioDone = this._radioDone || new Set();
      const lm = this._labMinutes();
      const rb = RADIO.find((x) => lm >= x.at && !this._radioDone.has(x.at));
      if (rb) {
        this._radioDone.add(rb.at); this._idleT = 0; sfx('collect');
        this._toast('INTERCOM \u2014 CAPT. MABASO', rb.text(Object.keys(this.reports).length), 7000);
      } else if (this._idleT > 60) {
        this._idleT = 0;
        this._toast('NEXT STEP', this._nextStep().text, 6000);
      }
    }
    // Unlock-unit acquisition keeps running while you work elsewhere
    const cy = this.cyber;
    if (cy.unitRunning && !cy.unitDone) {
      cy.unitT += dt;
      if (cy.unitT >= UNIT_SECS) {
        cy.unitRunning = false; cy.unitDone = true;
        this._drawUnit('PIN ' + PIN, 'type it on the handset');
        sfx('correct');
        this._toast('UNIT FINISHED', 'Acquisition complete — the PIN is on the unit display. Lift the handset and type it.', 7000);
      } else if (Math.floor(cy.unitT * 2) !== Math.floor((cy.unitT - dt) * 2)) {
        this._drawUnit('ACQUIRING ' + Math.round((cy.unitT / UNIT_SECS) * 100) + '%', 'keep working');
      }
    }
    // Live signal after unlock: 20s to airplane mode or remote wipe
    if (cy.unlocked && !cy.airplane && !cy.wiped) {
      cy.signalT += dt;
      if (cy.signalT >= WIPE_SECS) {
        cy.wiped = true;
        try { getStats().wipes++; } catch (e) {}
        this.reports.digital = { body: 'REMOTE WIPE at ' + this._labClock() + ': the device was left signalling for ~20s after unlock and wiped itself. The digital record for this run is honestly blank.', signed: false };
        this._refreshCounter();
        this._toast('REMOTE WIPE', 'A message arrived — “erase confirmed” — and the chip went blank. Airplane mode first, next time.', 7000);
        if (this.ui.device.style.display === 'flex' && this._deviceMode === 'phone') this._renderPhone();
      } else if (this.ui.device.style.display === 'flex' && this._deviceMode === 'phone' && Math.floor(cy.signalT) !== Math.floor(cy.signalT - dt)) {
        this._renderPhone();
      }
    }
    // DNA sequencer keeps running while overlays are closed
    const b = this.bio;
    if (b.running && !b.ready) {
      b.t += dt;
      if (b.t >= 180) {
        b.running = false; b.ready = true; sfx('correct');
        this._toast('PROFILE READY', 'Sequencer finished. Read the 16-marker profile at the DNA bench.', 6000);
        if (this.ui.overlay.style.display === 'block') { this._closeOverlay(); this._openOverlay(this._bioPanel()); }
      }
    }
    // UV wand sweep: the beam lives where YOU aim. Text surfaces only inside it.
    const sweeping = !!(this.carried && this.carried.id === 'uvwand' && this.docs.lightsOff && this.collected.note && !this.docs.noteRead);
    if (this._noteMat) this._noteMat.uniforms.uOn.value = (this.carried && this.carried.id === 'uvwand' && this.docs.lightsOff) ? 1 : 0;
    if (this._beam) this._beam.intensity = sweeping ? 6 : 0;
    if (this._beamPool) this._beamPool.material.opacity = 0;
    const cam2 = window.__camera;
    if (sweeping && cam2 && this._noteMesh) {
      cam2.getWorldDirection(this._d);
      this._o.copy(cam2.position);
      this._knobRay.set(this._o, this._d);
      const hit = this._knobRay.intersectObject(this._noteMesh, false)[0];
      if (hit && hit.uv) {
        this._noteMat.uniforms.uBeam.value.set(hit.uv.x, hit.uv.y);
        this._beam.position.copy(cam2.position);
        this._beam.target.position.copy(hit.point);
        this._beamPool.position.set(hit.point.x, hit.point.y + 0.006, hit.point.z);
        this._beamPool.material.opacity = 0.45;
        const third = hit.uv.x < 0.38 ? 0 : hit.uv.x < 0.71 ? 1 : 2;
        if (!this.docs.cover.has(third)) {
          this.docs.cover.add(third); sfx('collect');
          if (this.docs.cover.size >= 3) {
            this.docs.noteRead = true;
            this._toast('INDENTATIONS RAISED', 'Three passes — the missing half reads clean under your beam. [E] on the note for your transcription.', 7000);
          } else this._toast('FLUORESCING ' + this.docs.cover.size + '/3', 'Keep sweeping — the words only live inside the beam.', 2500);
        }
      } else {
        this._noteMat.uniforms.uBeam.value.set(-1, -1);
        this._beam.position.copy(cam2.position);
        this._beam.target.position.copy(this._o.addScaledVector(this._d, 4));
      }
    }
    if ((this._clockTick = (this._clockTick || 0) + dt) > 1) {
      this._clockTick = 0;
      this._drawClock(this._labMinutes());
      this._refreshCounter();
    }
    if (this._flickerMat) this._flickerMat.uniforms.uTime.value = t;
    if (this._focusMat) this._focusMat.uniforms.uTime.value = t;
    for (const s of this._stripLights || []) {
      if (!s.flicker) continue;
      const drop = (Math.sin(t * 9.0) * 43758.5453) % 1;
      s.pl.intensity = (drop > 0.93) ? 3 : 22;
    }
    if (this.captain) this.captain.position.y = Math.sin(this.elapsed * 1.2) * 0.006;
    if (this._helix && this._helix.visible) this._helix.rotation.y += dt * 0.9;
    if (this._centriSpin > 0 && this._rotor) { this._rotor.rotation.y += dt * 25; this._centriSpin -= dt; if (this._centriSpin <= 0) this._rotor.visible = false; }
    if (this.photoCam) this.photoCam.update(dt, this.elapsed);

    const cam = window.__camera;
    if (cam && cam.isCamera && player && player.pos) this._applyFirstPerson(player);
    if (cam) this._updateFocus(cam);
  }

  dispose() {
    if (this._view) { this._view.dispose(); this._view = null; }
    clearTimeout(this._toastTimer);
    if (this._briefing) { this._briefing.cancel(); this._briefing = null; }
    if (this._termStop) this._termStop();
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('wheel', this._onWheel);
    if (this.photoCam) { this.photoCam.dispose(); this.photoCam = null; }
    window.__firstPerson = false;
    window.__uiCapture = false;
    if (this.ui) { for (const k of Object.keys(this.ui)) { const e = this.ui[k]; if (e && e.remove) e.remove(); } this.ui = null; }
    if (this.level && this.level.parent) this.level.parent.remove(this.level);
    this.level.traverse((o) => {
      if (o.isMesh) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
    this.scene.background = this._prevBg || null;
    this.scene.fog = this._prevFog || null;
  }
}

installLabExtras(LabLevel);
