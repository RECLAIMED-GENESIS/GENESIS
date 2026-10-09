// ============================================================
// LEVEL 3 THE HOLDING CELLS (first person interrogation and accusation)
//
// The three people picked at the end of Level 2 are brought in and put in
// cells side by side. Walk the corridor, stand at the bars, press E, then
// show each of them the evidence you logged in the office and the city.
// When you are sure, accuse the one who pulled the trigger.
//
// Nothing here tells the player who is right. The picks made in Level 2
// decide who stands in the cells, so the real killer may not be there.
//
// Endings
//   1 Case closed        the killer is accused and enough proof was shown
//   2 Could not prove it the killer is accused with too little proof
//   3 Wrong man          someone else is accused and the killer is in the
//                        next cell, so he walks
//   4 Wrong man          the killer was never picked in Level 2
//
// Host contract (same as Level 1 and Level 2)
//   window.__firstPerson   set while this level is alive
//   window.__uiCapture     set while a panel is open so main.js stops moving you
//   window.__camera        this level drives the camera from player pos and yaw
//   window.__switchLevel   used by the ending buttons
//   window.__caseProgress  reads l1 flags, city flags and picks
//
// Controls
//   mouse look, W A S D move, E question the person you are looking at
//   C case file, Up and Down choose, Enter show, Escape step back
//
// Rubric coverage
//   Player controls   first person look, raycast interaction, panels
//   Physics           Box3 walls and cell fronts, plus pushable chairs and
//                     crates that slide, spin and stop against walls
//   Shaders           (1) interrogation light cone with drifting dust that
//                         brightens on the person you are looking at
//                     (2) flickering tube lights
// ============================================================
import * as THREE from 'three';
import { CASE } from './lvl1.js';

const EYE = 1.7;
const REACH = 4.4;
const H = 3.4;
const KILLER = 'kyle';
const PROOF_KEYS = ['handkerchief', 'stub', 'look'];
const PROOF_NEEDED = 2;

// ------------------------------------------------------------
// city evidence, matches the three clues of Level 2
// ------------------------------------------------------------
const CITY_EVIDENCE = {
  gun: {
    name: 'Unregistered pistol (.40)',
    note: 'A service pistol with the serial filed away, hidden behind the glass dome where the watchman sits. It is not the gun that fired the 9mm in the office.',
  },
  uvtrail: {
    name: 'UV bootprints and scrawl',
    note: 'Muddy bootprints circling the dome and a scrawl on the kerb that only shows under UV: DEPOT, HE KNOWS.',
  },
  stub: {
    name: 'Parking exit stub 23:38',
    note: 'A faculty garage exit ticket stamped 23:38, nineteen minutes after the victim sent his last message.',
  },
};

// ------------------------------------------------------------
// people, what they look like, what they say, how they end up
// tag: strong, partial, clear or none (never shown to the player)
// ------------------------------------------------------------
const R = (tag, text) => ({ tag, text });

const PEOPLE = {
  sipho: {
    id: 'sipho', name: 'Sipho Ndlovu', role: 'Night watchman', obj: 'him',
    hair: 0x14110f, long: false, bandage: false, coat: 0x2e3a2a, pants: 0x1c1e22, skin: 0x7a5641,
    intro: 'Sipho Ndlovu leans on the back wall with his arms folded, as if the cell were his dome.',
    look: R('none', `Calm, far too calm. His boots are caked with the same mud that circles the glass dome, and his eyes keep drifting to a corner where a tarp used to be. A man who sells his silence.`),
    react: {
      gun: R('clear', `"Mine. Case hardened, unregistered, and it fires .40." He holds your eye. "The slug in your lecturer was a nine. Check the chamber, it has not been fired in a year." He is guilty of something, but the something is not the shot.`),
      casing: R('clear', `"Nine millimetre. Mine fires .40." He shrugs. "I read it off the cleaner's radio. Whoever shot your lecturer did not carry my gun."`),
      uvtrail: R('partial', `"Depot. He knows." He laughs without sound. "Everyone in this city has a price and the lecturer knew mine. I looked away at the back gate. I did not look at what came through."`),
      handkerchief: R('partial', `"K.P." He studies it far too long. "Initials are not names." But he knows whose hand wiped itself on that cloth, and he does not say it.`),
    },
    fate: 'Sipho Ndlovu was charged with an unregistered firearm and with obstruction for the night he looked away.',
  },
  anele: {
    id: 'anele', name: 'Anele Mahlangu', role: 'Department administrator', obj: 'her',
    hair: 0x4a2c17, long: true, bandage: false, coat: 0x53324a, pants: 0x23242a, skin: 0x8a6248,
    intro: 'Anele Mahlangu sits very straight on the bunk. "I told you everything," she says.',
    look: R('clear', `Her cuffs are stiff with dried fish scales and her hands smell of river water. Whatever she did tonight, she did it on a quay.`),
    react: {
      hair: R('partial', `Long brown hair, and hers is long and brown. "Half the women in this department have brown hair. Ask who sat in that chair." She does not blink.`),
      phone: R('clear', `"23:19, locked up the common room." She nods slowly. "That was after I left. I was already at the water, the fish trader beside me will say so."`),
      handkerchief: R('clear', `"K.P. is not me." She says it without a flicker.`),
      stub: R('clear', `"I do not drive. I walked down to the water." She turns her hands over, empty.`),
    },
    fate: 'Anele Mahlangu was released, her alibi on the quay held.',
  },
  naledi: {
    id: 'naledi', name: 'Prof. Naledi Dube', role: 'Head of Department', obj: 'her',
    hair: 0x14110f, long: false, bandage: false, coat: 0x30425c, pants: 0x20242c, skin: 0x6f4d3a,
    intro: 'Prof. Dube grips the bars with both hands. "Is my name on something?" she asks.',
    look: R('none', `Her hands tremble on the bars and there is no polish on her nails. She has not slept. She looks like a woman who has imagined this corridor many times.`),
    react: {
      note: R('partial', `"I begged him to keep quiet. I asked him to wait until the board had met." Her voice is steady, her knuckles are not. "I did not kill him, detective. I did the second worst thing."`),
      hair: R('clear', `She touches her short cropped hair. "The fibres are long and brown. I have worn it like this for twenty years."`),
      stub: R('clear', `"Mine was in the workshop all week. That is why I walked the road home." She does not look away.`),
      handkerchief: R('clear', `"K.P." She almost smiles. "I am N.D., detective."`),
      casing: R('clear', `"I have never held a gun in my life." Her hands on the bars do not move.`),
      phone: R('none', `"Exam scripts, your office tonight." Her face goes blank. "That is not my number and that is not my phrase."`),
    },
    fate: 'Prof. Naledi Dube resigned and now faces the inquiry into the altered marks.',
  },
  kyle: {
    id: 'kyle', name: 'Kyle Pretorius', role: 'PhD student and tutor', obj: 'him',
    hair: 0x4a2c17, long: true, bandage: true, coat: 0x414b3c, pants: 0x22232a, skin: 0x8a6248,
    intro: 'Kyle Pretorius will not stand still. His right hand stays pressed against his chest.',
    look: R('strong', `The bandage on his right hand is fresh, the skin under it sealed with clinic glue, and it smells of iodine from an after hours practice. A garage nail does not get stitched at half past midnight. The cut runs across the FRONT of the hand, the way a hand bleeds against a pistol barrel.`),
    react: {
      handkerchief: R('strong', `He reads the monogram and the colour leaves his face. "Anyone could have K.P. stitched on a handkerchief." Then he looks at his own bandaged hand, and then at the floor.`),
      stub: R('strong', `"Faculty exit. 23:38." He says it back to you like a man reading a line he no longer believes. "I told you I was home." Nobody in the corridor says anything for a long moment.`),
      trail: R('partial', `He glances at his sleeve cuff, then away. "A smear on a floor. I was not there." He says it to the wall, not to you.`),
      hair: R('partial', `Long brown hair. He tucks his own behind his ear before he can stop himself. "Half this building has brown hair."`),
      phone: R('partial', `"Coming up the back stairs. Tell no one." He frowns at it too long. "Anyone could send that. It is not signed."`),
      note: R('partial', `"Marks. He was going to report the marks." He licks his lips. "I tutored those scripts, I would never have touched them." Nobody asked him if he had.`),
      uvtrail: R('partial', `"Depot." His voice catches on it. "I cut my hand on a nail on the way home from the depot. I told you."`),
      casing: R('partial', `"Nine millimetre. I have never owned a gun." That may be true. It is not what you asked.`),
    },
    fate: 'Kyle Pretorius was charged with the murder of Dr. Thabo Nkosi.',
  },
  mandla: {
    id: 'mandla', name: 'Mandla Dlamini', role: 'Taxi rank fixer', obj: 'him',
    hair: 0x4a2c17, long: false, bandage: false, coat: 0x4c3524, pants: 0x2b2118, skin: 0x5d4436,
    intro: 'Mandla Dlamini grins through the bars. "Does this one cost extra?"',
    look: R('clear', `His pockets are stuffed with invoices and a roll of cash. A man paid to watch, not to act. He smiles like it is all a game.`),
    react: {
      stub: R('none', `"Faculty exit stamp, 23:38." He whistles. "Whoever punched that ticket was on that campus while your lecturer was cooling on his floor. Not me, I was on the footbridge."`),
      uvtrail: R('partial', `"Depot. He knows." He taps his temple. "I watch gates, detective. I watch more than this."`),
    },
    fate: 'Mandla Dlamini was released, his invoices having alibied the woman at the water.',
  },
};
PEOPLE.anale = PEOPLE.anele;   // Level 2 spells this id anale

function reactionFor(def, key) {
  if (key === 'look') return def.look;
  if (def.react[key]) return def.react[key];
  return R('none', `${def.name.split(' ')[0]} glances at it and shrugs. It does not seem to mean anything to ${def.obj}.`);
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let _seed = 4242;
const rng = () => (_seed = (_seed * 16807) % 2147483647) / 2147483647;

// ------------------------------------------------------------
// shader: interrogation light cone
// ------------------------------------------------------------
const CONE_VERT = `
varying float vY; varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){
  vY = clamp((position.y + 1.65) / 3.3, 0.0, 1.0);
  vP = position;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const CONE_FRAG = `
uniform float uTime, uFocus;
uniform vec3 uColor;
varying float vY; varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){
  float face = pow(abs(dot(normalize(vN), normalize(vV))), 0.7);
  float beam = pow(vY, 1.5);
  float dust = 0.55 + 0.45 * sin(uTime * 0.7 + vY * 16.0 + atan(vP.x, vP.z) * 3.0);
  float a = beam * face * dust * (0.16 + uFocus * 0.22);
  gl_FragColor = vec4(uColor * a * 2.2, a);
}`;

// ------------------------------------------------------------
export class JailLevel {
  constructor(sceneOrRenderer = null) {
    this.scene = (sceneOrRenderer && sceneOrRenderer.isScene) ? sceneOrRenderer : new THREE.Scene();
    this._prevBg = this.scene.background;
    this._prevFog = this.scene.fog;
    this.scene.background = new THREE.Color(0x0a0d13);
    this.scene.fog = new THREE.Fog(0x0a0d13, 14, 42);

    this.name = 'LEVEL 3 THE HOLDING CELLS';
    this.spawn = new THREE.Vector3(0.1, 0, 11.4);
    this.spawnYaw = 0;
    this.colliders = [];
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.time = 0;
    this.focus = null;
    this.panelOpen = false;
    this.fileOpen = false;
    this.confirmOpen = false;
    this.endOpen = false;
    this.sel = 0;
    this.current = null;
    this.notes = [];
    this.tubes = [];
    this.cones = [];
    this.pushables = [];

    this._o = new THREE.Vector3();
    this._d = new THREE.Vector3(0, 0, -1);
    this._rc = new THREE.Raycaster();
    this._rc.far = REACH;

    this.evidence = this._collectEvidence();
    this.picks = this._readPicks();

    this._materials();
    this._buildShell();
    this._buildCells();
    this._buildSigns();
    this._buildLights();
    this._buildPushables();
    this._buildSuspects();
    this._buildUI();

    window.__firstPerson = true;
    this._onKey = (e) => this._handleKey(e);
    window.addEventListener('keydown', this._onKey);

    this._toast('THE HOLDING CELLS',
      'Three people were brought in on your word. One of them may have pulled the trigger, or none. Stand at the bars and press E. [C] case file', 9000);
  }

  getSurfaceHeight() { return 0; }
  groundHeight() { return 0; }
  terrainHeight() { return 0; }

  // =========================================================
  // data
  // =========================================================
  _collectEvidence() {
    const prog = window.__caseProgress || null;
    const all = !prog;
    const l1 = (prog && prog.l1) || {};
    const city = (prog && prog.city) || {};
    const out = [];
    for (const id of Object.keys(CASE.clues)) {
      if (all || l1[id]) out.push({ id, name: CASE.clues[id].name, note: CASE.clues[id].note, from: 'Office' });
    }
    for (const id of Object.keys(CITY_EVIDENCE)) {
      if (all || city[id]) out.push({ id, name: CITY_EVIDENCE[id].name, note: CITY_EVIDENCE[id].note, from: 'City' });
    }
    return out;
  }

  _readPicks() {
    const prog = window.__caseProgress;
    let picks = (prog && Array.isArray(prog.picks)) ? prog.picks.filter((id) => PEOPLE[id]) : [];
    picks = picks.map((id) => PEOPLE[id].id);
    if (picks.length !== 3) picks = ['kyle', 'sipho', 'naledi'];
    for (let i = picks.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [picks[i], picks[j]] = [picks[j], picks[i]];
    }
    return picks;
  }

  // =========================================================
  // construction
  // =========================================================
  _materials() {
    const floorTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#5a5f66'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 700; i++) {
        g.fillStyle = `rgba(${rng() > 0.5 ? '20,22,26' : '120,124,130'},${(rng() * 0.12).toFixed(3)})`;
        g.fillRect(rng() * w, rng() * h, 2 + rng() * 9, 2 + rng() * 9);
      }
      g.strokeStyle = 'rgba(15,17,20,0.75)'; g.lineWidth = 3;
      g.strokeRect(0, 0, w, h);
      g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(5, 14);
    this.mFloor = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 });
    this.mLow = new THREE.MeshStandardMaterial({ color: 0x4d5d57, roughness: 0.9 });
    this.mUp = new THREE.MeshStandardMaterial({ color: 0xaeb0a2, roughness: 0.95 });
    this.mCeil = new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: 1 });
    this.mBar = new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.4, metalness: 0.85 });
    this.mWood = new THREE.MeshStandardMaterial({ color: 0x6b5238, roughness: 0.8 });
    this.mMetal = new THREE.MeshStandardMaterial({ color: 0x70767e, roughness: 0.5, metalness: 0.6 });
  }

  _box(w, h, d, x, y, z, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    this.root.add(m);
    return m;
  }

  _wall(x0, x1, z0, z1, collide = true) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const lowH = 1.3, upH = H - lowH;
    this._box(w, lowH, d, cx, lowH / 2, cz, this.mLow);
    this._box(w, upH, d, cx, lowH + upH / 2, cz, this.mUp);
    if (collide) this.colliders.push(new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, H, z1)));
  }

  _buildShell() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 28.4), this.mFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(-2.4, 0, -0.7);
    this.root.add(floor);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 28.4), this.mCeil);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(-2.4, H, -0.7);
    this.root.add(ceil);

    this._wall(-7.6, 2.8, 13.2, 13.6);      // south end
    this._wall(-7.6, 2.8, -14.6, -14.2);    // north end
    this._wall(2.4, 2.8, -14.2, 13.2);      // east side
    this._wall(-7.6, -7.2, -14.2, 13.2);    // west back wall
    this._wall(-2.4, -2.2, 8.7, 13.2);      // closes the corridor beside the cells
    this._wall(-2.4, -2.2, -14.2, -7.1);
  }

  _buildCells() {
    this.cellZ = [6.0, 0.8, -4.4];
    // dividers between and around the cells
    for (const [a, b] of [[8.5, 8.7], [3.3, 3.5], [-1.9, -1.7], [-7.1, -6.9]]) {
      this._wall(-7.2, -2.4, a, b, false);
    }
    // the cell fronts block the player and anything pushed
    this.colliders.push(new THREE.Box3(new THREE.Vector3(-2.35, 0, -7.1), new THREE.Vector3(-2.05, H, 8.7)));

    // bars as instanced boxes
    const spots = [];
    for (const cz of this.cellZ) {
      for (let z = cz - 2.4; z <= cz + 2.41; z += 0.26) spots.push(z);
    }
    const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 3.0, 0.05), this.mBar, spots.length);
    const m4 = new THREE.Matrix4();
    spots.forEach((z, i) => { m4.setPosition(-2.2, 1.5, z); bars.setMatrixAt(i, m4); });
    bars.instanceMatrix.needsUpdate = true;
    this.root.add(bars);
    this._box(0.08, 0.08, 15.8, -2.2, 3.0, 0.8, this.mBar);
    this._box(0.08, 0.08, 15.8, -2.2, 0.08, 0.8, this.mBar);
    this._box(0.08, 0.08, 15.8, -2.2, 1.5, 0.8, this.mBar);

    // cell furniture
    for (const cz of this.cellZ) {
      this._box(1.0, 0.18, 2.3, -6.55, 0.55, cz - 1.3, this.mMetal);
      this._box(1.0, 0.1, 2.3, -6.55, 0.62, cz - 1.3, new THREE.MeshStandardMaterial({ color: 0x5a5d52, roughness: 1 }));
      this._box(0.5, 0.45, 0.5, -6.85, 0.225, cz + 2.0, this.mMetal);

      const chart = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.9), new THREE.MeshBasicMaterial({
        map: canvasTex(128, 290, (g, w, h) => {
          g.fillStyle = '#d9d8cc'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#222'; g.font = '11px monospace';
          for (let i = 0; i <= 12; i++) {
            const y = 20 + i * 20;
            g.fillRect(0, y, i % 2 ? 40 : 70, 2);
            g.fillText(String(190 - i * 5), 76, y + 4);
          }
        }),
      }));
      chart.rotation.y = Math.PI / 2;
      chart.position.set(-7.18, 1.45, cz);
      this.root.add(chart);
    }
  }

  _buildSigns() {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.9), new THREE.MeshBasicMaterial({
      map: canvasTex(512, 270, (g, w, h) => {
        g.fillStyle = '#6a4a2e'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#c9b88e'; g.fillRect(10, 10, w - 20, h - 20);
        g.fillStyle = '#2a1a0c'; g.font = 'bold 24px monospace';
        g.fillText('EVIDENCE LOGGED', 26, 46);
        g.font = '15px monospace';
        this.evidence.forEach((e, i) => {
          const col = i < 6 ? 0 : 1, row = i % 6;
          const x = 28 + col * 240, y = 82 + row * 30;
          g.fillStyle = '#a1241c'; g.beginPath(); g.arc(x, y - 5, 5, 0, 6.3); g.fill();
          g.fillStyle = '#2a1a0c'; g.fillText(e.name.slice(0, 26), x + 14, y);
        });
        g.fillStyle = '#6b1d15'; g.font = 'bold 14px monospace';
        g.fillText(`${this.evidence.length} ITEMS`, w - 120, h - 22);
      }),
    }));
    board.rotation.y = -Math.PI / 2;
    board.position.set(2.38, 1.8, 4.0);
    this.root.add(board);

    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.7), new THREE.MeshBasicMaterial({
      map: canvasTex(512, 106, (g, w, h) => {
        g.fillStyle = '#1b2430'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#e8d9a8'; g.font = 'bold 40px monospace';
        g.fillText('PRECINCT 7 HOLDING', 24, 66);
      }),
    }));
    sign.rotation.y = Math.PI;
    sign.position.set(0.1, 2.3, 13.18);
    this.root.add(sign);
  }

  _buildLights() {
    this.root.add(new THREE.AmbientLight(0x8da0b8, 0.55));
    this.root.add(new THREE.HemisphereLight(0xcfe0ff, 0x1a1c20, 0.35));

    for (const z of [10, 4, -2, -8]) {
      const glow = new THREE.MeshBasicMaterial({ color: 0xe6f2ff });
      this._box(0.18, 0.06, 1.8, 0.1, H - 0.05, z, glow);
      this.tubes.push({ mat: glow, seed: z * 1.7 });
      const l = new THREE.PointLight(0xcfe2ff, 24, 14, 2);
      l.position.set(0.1, H - 0.35, z);
      this.root.add(l);
    }
    for (const cz of this.cellZ) {
      const l = new THREE.PointLight(0xffe9c6, 16, 9, 2);
      l.position.set(-4.4, 3.0, cz);
      this.root.add(l);
    }
  }

  _chair(x, z) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.45), this.mWood);
    seat.position.y = 0.45; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.05), this.mWood);
    back.position.set(0, 0.73, -0.2); g.add(back);
    for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.05), this.mMetal);
      leg.position.set(lx, 0.225, lz); g.add(leg);
    }
    g.position.set(x, 0, z);
    return g;
  }

  _buildPushables() {
    const defs = [
      { g: this._chair(0.9, 8.4), r: 0.34 },
      { g: this._chair(-1.2, 1.8), r: 0.34 },
      { g: (() => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), this.mWood); m.position.set(1.3, 0.35, -3.6); return m; })(), r: 0.45 },
      { g: (() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.55), this.mMetal); m.position.set(-0.8, 0.45, -9.5); return m; })(), r: 0.55 },
    ];
    for (const d of defs) {
      this.root.add(d.g);
      this.pushables.push({ mesh: d.g, r: d.r, vx: 0, vz: 0 });
    }
  }

  _person(def) {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: def.skin, roughness: 0.8 });
    const coat = new THREE.MeshStandardMaterial({ color: def.coat, roughness: 0.85 });
    const pants = new THREE.MeshStandardMaterial({ color: def.pants, roughness: 0.9 });
    const hair = new THREE.MeshStandardMaterial({ color: def.hair, roughness: 1 });
    const cyl = (rt, rb, h, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 10), mat);
      m.position.set(x, y, z); g.add(m); return m;
    };
    cyl(0.07, 0.06, 0.85, pants, -0.1, 0.45, 0);
    cyl(0.07, 0.06, 0.85, pants, 0.1, 0.45, 0);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 0.24), coat);
    torso.position.set(0, 1.16, 0); g.add(torso);
    cyl(0.05, 0.045, 0.6, coat, -0.25, 1.12, 0);
    cyl(0.05, 0.045, 0.6, coat, 0.25, 1.12, 0);
    for (const x of [-0.25, 0.25]) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
      h.position.set(x, 0.8, 0); g.add(h);
    }
    cyl(0.05, 0.06, 0.1, skin, 0, 1.52, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), skin);
    head.position.set(0, 1.66, 0); g.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.126, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    cap.position.set(0, 1.675, -0.008); cap.scale.set(1, 1.05, 1.06); g.add(cap);
    if (def.long) {
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.06), hair);
      back.position.set(0, 1.5, -0.115); g.add(back);
    }
    if (def.bandage) {
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.07, 10),
        new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 1 }));
      wrap.position.set(0.25, 0.8, 0.01); g.add(wrap);
    }
    return g;
  }

  _buildSuspects() {
    this.suspects = [];
    this.picks.forEach((id, i) => {
      const def = PEOPLE[id];
      const cz = this.cellZ[i];
      const g = this._person(def);
      g.position.set(-4.4, 0, cz);
      g.rotation.y = Math.PI / 2;
      this.root.add(g);

      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.9), new THREE.MeshBasicMaterial());
      hit.position.set(-4.4, 0.95, cz);
      hit.visible = false;
      this.root.add(hit);

      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.4, 3.3, 28, 1, true),
        new THREE.ShaderMaterial({
          uniforms: { uTime: { value: 0 }, uFocus: { value: 0 }, uColor: { value: new THREE.Color(0xffe2b0) } },
          vertexShader: CONE_VERT, fragmentShader: CONE_FRAG,
          transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        }));
      cone.position.set(-4.4, 1.65, cz);
      this.root.add(cone);
      this.cones.push(cone);

      const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.42), new THREE.MeshBasicMaterial({
        map: canvasTex(512, 84, (c, w, h) => {
          c.fillStyle = '#10151c'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#e8d9a8'; c.font = 'bold 30px monospace';
          c.fillText(`CELL ${i + 1}  ${def.name.toUpperCase()}`.slice(0, 30), 14, 38);
          c.fillStyle = '#9aa7b8'; c.font = '20px monospace';
          c.fillText(def.role.toUpperCase().slice(0, 34), 14, 68);
        }),
      }));
      plate.rotation.y = Math.PI / 2;
      plate.position.set(-2.12, 3.2, cz);
      this.root.add(plate);

      const s = { def, group: g, hit, cone, cell: i, presented: {}, questioned: false, pos: new THREE.Vector3(-4.4, 0, cz), phase: rng() * 6.28 };
      hit.userData.suspect = s;
      this.suspects.push(s);
    });
  }

  // =========================================================
  // ui
  // =========================================================
  _buildUI() {
    const mk = (tag, css, parent, html) => {
      const e = document.createElement(tag); e.style.cssText = css;
      if (html !== undefined) e.innerHTML = html;
      (parent || document.body).appendChild(e); return e;
    };
    const mono = 'font-family:"Courier New",monospace;color:#f2d9a0;';
    const ui = this.ui = {};
    ui.root = mk('div', 'position:fixed;inset:0;pointer-events:none;z-index:50;' + mono);
    ui.prompt = mk('div', 'position:absolute;left:50%;bottom:22%;transform:translateX(-50%);font-size:15px;letter-spacing:1px;text-shadow:0 1px 3px #000;display:none;', ui.root);
    ui.counter = mk('div', 'position:absolute;left:18px;top:16px;font-size:13px;letter-spacing:1px;opacity:.85;', ui.root, '');
    ui.toast = mk('div', 'position:absolute;left:50%;top:9%;transform:translate(-50%,0);width:min(680px,92vw);text-align:center;opacity:0;transition:opacity .4s;', ui.root);
    ui.panel = mk('div', 'position:fixed;left:50%;bottom:2vh;transform:translateX(-50%);width:min(900px,94vw);max-height:70vh;overflow:auto;display:none;background:rgba(4,6,10,.94);border:1px solid #3c4656;padding:18px 22px;z-index:9500;pointer-events:auto;' + mono);
    ui.file = mk('div', 'position:fixed;inset:0;display:none;align-items:flex-start;justify-content:center;background:rgba(3,4,7,.93);z-index:9999;overflow:auto;pointer-events:auto;' + mono);
    ui.confirm = mk('div', 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(2,3,5,.8);z-index:10000;pointer-events:auto;' + mono);
    ui.end = mk('div', 'position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:rgba(2,3,5,.985);z-index:10001;color:#e9d9b0;pointer-events:auto;padding:4vw;overflow:auto;font-family:"Courier New",monospace;');

    ui.panel.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;
      if (act === 'opt') { this.sel = Number(t.dataset.i); this._present(); }
      else if (act === 'accuse') this._openConfirm();
      else if (act === 'close') this._closePanel();
    });
    ui.panel.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-act="opt"]');
      if (t && Number(t.dataset.i) !== this.sel) { this.sel = Number(t.dataset.i); this._paintSel(); }
    });
    ui.confirm.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      if (t.dataset.act === 'yes') this._finish(this.current);
      else this._closeConfirm();
    });
    ui.end.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      if (t.dataset.act === 'menu') {
        if (typeof window.__showMenu === 'function') window.__showMenu();
        return;
      }
      if (typeof window.__switchLevel !== 'function') return;
      window.__switchLevel(t.dataset.act === 'again' ? 1 : 3);
    });
    this._updateCounter();
  }

  _updateCounter() {
    const q = this.suspects.filter((s) => s.questioned).length;
    this.ui.counter.innerHTML = `HOLDING CELLS &nbsp;·&nbsp; QUESTIONED ${q}/3 &nbsp;·&nbsp; EVIDENCE ${this.evidence.length}`;
  }

  _toast(title, text, ms = 5000) {
    clearTimeout(this._toastTimer);
    this.ui.toast.innerHTML =
      `<div style="font-size:20px;letter-spacing:3px;color:#f2b84b;margin-bottom:8px;text-shadow:0 0 14px rgba(0,0,0,.9)">${title}</div>` +
      `<div style="font-size:14px;line-height:1.5;background:rgba(6,8,12,.8);border:1px solid #2c3440;padding:10px 16px;display:inline-block">${text}</div>`;
    this.ui.toast.style.opacity = 1;
    this._toastTimer = setTimeout(() => { this.ui.toast.style.opacity = 0; }, ms);
  }

  _capture(on) {
    window.__uiCapture = on;
    if (on && document.exitPointerLock) document.exitPointerLock();
  }

  // ---------- interrogation panel ----------
  _options() {
    const first = this.current.def.name.split(' ')[0];
    const out = [{ key: 'look', label: `Look at ${this.current.def.obj} closely` }];
    for (const e of this.evidence) out.push({ key: e.id, label: `Show ${first}: ${e.name}`, tag: e.from });
    return out;
  }

  _openPanel(s) {
    this.current = s;
    s.questioned = true;
    this.panelOpen = true;
    this.sel = 0;
    this.lastText = s.def.intro;
    this._capture(true);
    this._updateCounter();
    this._renderPanel();
    this.ui.panel.style.display = 'block';
  }

  _renderPanel() {
    const s = this.current;
    const opts = this._options();
    const rows = opts.map((o, i) => {
      const done = s.presented[o.key] ? '<span style="color:#7fd4ff">&#10003;</span> ' : '&nbsp;&nbsp;&nbsp;';
      return `<div data-act="opt" data-i="${i}" data-sel="${i === this.sel ? 1 : 0}" style="padding:6px 10px;cursor:pointer;border-left:3px solid ${i === this.sel ? '#f2b84b' : 'transparent'};background:${i === this.sel ? 'rgba(242,184,75,.12)' : 'transparent'}">${done}${o.label}${o.tag ? `<span style="opacity:.5"> (${o.tag})</span>` : ''}</div>`;
    }).join('');
    const shown = Object.keys(s.presented).length;
    this.ui.panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
        <div><b style="color:#f2b84b;font-size:18px;letter-spacing:2px">${s.def.name.toUpperCase()}</b>
        <span style="opacity:.7"> ${s.def.role}</span></div>
        <div style="opacity:.6;font-size:12px">Up Down choose, Enter show, Esc step back</div>
      </div>
      <div id="jl-text" style="min-height:96px;padding:12px 14px;margin-bottom:10px;background:rgba(255,255,255,.04);border:1px solid #2c3440;line-height:1.55;font-size:15px">${this.lastText}</div>
      <div style="max-height:30vh;overflow:auto;margin-bottom:12px">${rows}</div>
      <div style="display:flex;gap:12px;align-items:center">
        <button data-act="accuse" style="font:inherit;letter-spacing:1px;padding:10px 20px;background:#a1241c;color:#fff;border:0;cursor:pointer">ACCUSE ${s.def.name.split(' ')[0].toUpperCase()} OF THE SHOOTING</button>
        <button data-act="close" style="font:inherit;padding:10px 20px;background:#141a24;color:#e9d9b0;border:1px solid #334052;cursor:pointer">Step back</button>
        <span style="opacity:.6;font-size:12px">${shown} shown to ${s.def.obj}</span>
      </div>`;
  }

  _paintSel() {
    this.ui.panel.querySelectorAll('[data-act="opt"]').forEach((el) => {
      const on = Number(el.dataset.i) === this.sel;
      el.style.borderLeft = `3px solid ${on ? '#f2b84b' : 'transparent'}`;
      el.style.background = on ? 'rgba(242,184,75,.12)' : 'transparent';
    });
  }

  _present() {
    const s = this.current;
    const opt = this._options()[this.sel];
    if (!opt) return;
    const r = reactionFor(s.def, opt.key);
    const first = !s.presented[opt.key];
    s.presented[opt.key] = r.tag;
    this.lastText = r.text;
    if (first) {
      const label = opt.key === 'look' ? `Looked closely at ${s.def.name}` : `Showed ${s.def.name} the ${opt.label.split(': ')[1]}`;
      this.notes.push({ who: s.def.name, label, text: r.text });
    }
    this._renderPanel();
  }

  _closePanel() {
    this.panelOpen = false;
    this._capture(false);
    this.ui.panel.style.display = 'none';
  }

  // ---------- accusation ----------
  _openConfirm() {
    const s = this.current;
    this.confirmOpen = true;
    this.ui.confirm.innerHTML = `
      <div style="max-width:min(560px,92vw);background:rgba(8,10,16,.98);border:1px solid #a1241c;padding:26px 30px;text-align:center">
        <h2 style="letter-spacing:3px;color:#d34a3f;margin:0 0 12px">THERE IS NO SECOND ACCUSATION</h2>
        <p style="line-height:1.6">You are about to name <b style="color:#f2b84b">${s.def.name}</b> as the person who pulled the trigger.
        You have shown ${s.def.obj} ${Object.keys(s.presented).length} of ${this._options().length} things.</p>
        <div style="margin-top:18px;display:flex;gap:12px;justify-content:center">
          <button data-act="yes" style="font:inherit;padding:10px 22px;background:#a1241c;color:#fff;border:0;cursor:pointer">Name ${s.def.name.split(' ')[0]}</button>
          <button data-act="no" style="font:inherit;padding:10px 22px;background:#141a24;color:#e9d9b0;border:1px solid #334052;cursor:pointer">Not yet</button>
        </div>
      </div>`;
    this.ui.confirm.style.display = 'flex';
  }

  _closeConfirm() {
    this.confirmOpen = false;
    this.ui.confirm.style.display = 'none';
  }

  _recap() {
    const have = (id) => this.evidence.some((e) => e.id === id);
    const out = [];
    if (have('handkerchief')) out.push(CASE.clues.handkerchief.finding);
    if (have('stub')) out.push('The faculty exit stub stamped 23:38, nineteen minutes after the last message from the victim.');
    if (have('hair')) out.push(CASE.clues.hair.finding);
    out.push('A rehearsed alibi, a hand bandaged at an after hours clinic, and a story about a garage nail that fell apart.');
    return out;
  }

  _finish(accused) {
    this._closeConfirm();
    this.panelOpen = false;
    this.ui.panel.style.display = 'none';
    this.endOpen = true;
    this._capture(true);

    const killerHere = this.picks.includes(KILLER);
    const kyle = this.suspects.find((x) => x.def.id === KILLER);
    const proof = kyle ? PROOF_KEYS.filter((k) => kyle.presented[k]).length : 0;
    const others = this.suspects.filter((x) => x.def.id !== accused.def.id);
    let title, color, body, kind;

    if (accused.def.id === KILLER && proof >= PROOF_NEEDED) {
      kind = 'closed'; title = 'CASE CLOSED'; color = '#6fe0a8';
      body = `<p>${accused.def.name} asks for a lawyer, then stops asking. You laid the handkerchief, the stub and the hand in front of ${accused.def.obj} and there was nothing left to say.</p>
        <p>${others.map((o) => o.def.fate).join('<br>')}</p>
        <p style="opacity:.8">Dr. Thabo Nkosi had one gunshot, a guest who never finished his drink and a detective who finished the job.</p>`;
    } else if (accused.def.id === KILLER) {
      kind = 'unproven'; title = 'YOU KNEW. YOU COULD NOT PROVE IT.'; color = '#f2b84b';
      body = `<p>${accused.def.name} did it, and you named the right person. But you stood at those bars with too little in your hands.</p>
        <p>The prosecutor reads your file twice and lets ${accused.def.obj} go. Somewhere a handkerchief, a parking stub and a bandaged hand were enough, and you never put them in front of ${accused.def.obj}.</p>
        <p style="opacity:.8">Show the right person the right things, then accuse.</p>`;
    } else if (killerHere) {
      kind = 'walked'; title = 'THE WRONG MAN'; color = '#d34a3f';
      body = `<p>${accused.def.name} is charged and the file is closed. In the next cell, ${PEOPLE[KILLER].name} walks out at dawn with a bandaged hand and a clean statement.</p>
        <p>You had him in the cell. You looked at him, and you chose someone else.</p>
        <p style="opacity:.8">${this._recap().join('<br>')}</p>`;
    } else {
      kind = 'missing'; title = 'THE WRONG MAN'; color = '#d34a3f';
      body = `<p>${accused.def.name} is charged and the file is closed. The man who killed Dr. Nkosi was never in these cells.</p>
        <p>${PEOPLE[KILLER].name} was one of the five in the city, and he is the one you left off the list.</p>
        <p style="opacity:.8">You were holding what you needed:<br>${this._recap().join('<br>')}</p>`;
    }

    window.__caseProgress = window.__caseProgress || { l1: {} };
    window.__caseProgress.ending = kind;

    this.ui.end.innerHTML = `
      <h1 style="letter-spacing:6px;color:${color};max-width:86vw;margin:0 0 18px">${title}</h1>
      <div style="max-width:min(740px,90vw);line-height:1.7;font-size:16px">${body}</div>
      <div style="margin-top:28px;display:flex;gap:14px;flex-wrap:wrap;justify-content:center">
        <button data-act="replay" style="font:inherit;padding:12px 24px;background:#141a24;color:#e9d9b0;border:1px solid #334052;cursor:pointer">Replay the cells</button>
        <button data-act="again" style="font:inherit;padding:12px 24px;background:#1f6f5c;color:#fff;border:0;cursor:pointer">Play again from the office</button>
        <button data-act="menu" style="font:inherit;padding:12px 24px;background:#141a24;color:#e9d9b0;border:1px solid #334052;cursor:pointer">Main menu</button>
      </div>`;
    this.ui.end.style.display = 'flex';
  }

  // ---------- case file ----------
  _openFile() {
    this.fileOpen = true;
    this._capture(true);
    const ev = this.evidence.map((e) => `<p style="margin:8px 0"><b style="color:#f2b84b">${e.name}</b> <span style="opacity:.55">(${e.from})</span><br><span style="opacity:.85">${e.note}</span></p>`).join('');
    const nt = this.notes.length
      ? this.notes.map((n) => `<p style="margin:8px 0"><b style="color:#7fd4ff">${n.who}</b>, ${n.label}<br><span style="opacity:.85">${n.text}</span></p>`).join('')
      : '<p style="opacity:.6">Nothing yet. Stand at the bars and press E.</p>';
    this.ui.file.innerHTML = `
      <div style="max-width:min(820px,94vw);margin:4vh 0;background:rgba(8,10,16,.97);border:1px solid #3c4656;padding:26px 30px;line-height:1.5;font-size:14px">
        <h2 style="letter-spacing:3px;color:#f2b84b;margin-top:0">CASE FILE: ${CASE.victim}</h2>
        <p>${CASE.found}. ${CASE.body.note}</p>
        <h3 style="color:#f2b84b;letter-spacing:2px">EVIDENCE</h3>${ev}
        <h3 style="color:#f2b84b;letter-spacing:2px">INTERROGATION NOTES</h3>${nt}
        <p style="opacity:.6;margin-top:18px">Press C or Esc to close.</p>
      </div>`;
    this.ui.file.style.display = 'flex';
  }

  _closeFile() {
    this.fileOpen = false;
    this._capture(false);
    this.ui.file.style.display = 'none';
  }

  // =========================================================
  // input
  // =========================================================
  _handleKey(e) {
    if (e.repeat) return;
    if (this.endOpen) return;
    if (this.confirmOpen) { if (e.code === 'Escape') this._closeConfirm(); return; }
    if (this.fileOpen) { if (e.code === 'KeyC' || e.code === 'Escape') this._closeFile(); return; }
    if (this.panelOpen) {
      const n = this._options().length;
      if (e.code === 'ArrowDown') { this.sel = (this.sel + 1) % n; this._paintSel(); e.preventDefault(); }
      else if (e.code === 'ArrowUp') { this.sel = (this.sel - 1 + n) % n; this._paintSel(); e.preventDefault(); }
      else if (e.code === 'Enter' || e.code === 'Space') { this._present(); e.preventDefault(); }
      else if (e.code === 'Escape') this._closePanel();
      return;
    }
    if (e.code === 'KeyC') { this._openFile(); return; }
    if (e.code === 'KeyE' && this.focus) this._openPanel(this.focus);
  }

  // =========================================================
  // per frame
  // =========================================================
  _updateFocus(cam) {
    this.focus = null;
    cam.getWorldDirection(this._d);
    this._o.copy(cam.position);
    this._rc.set(this._o, this._d);
    this._rc.far = REACH;
    const hits = this._rc.intersectObjects(this.suspects.map((s) => s.hit), false);
    if (hits.length) {
      const s = hits[0].object.userData.suspect;
      this.focus = s;
      this.ui.prompt.textContent = `[E] Question ${s.def.name}`;
      this.ui.prompt.style.display = 'block';
    } else {
      this.ui.prompt.style.display = 'none';
    }
  }

  _updatePushables(dt, player) {
    const pr = 0.4;
    for (const p of this.pushables) {
      const pos = p.mesh.position;
      if (player && player.pos) {
        const dx = pos.x - player.pos.x, dz = pos.z - player.pos.z;
        const dist = Math.hypot(dx, dz);
        const min = p.r + pr;
        if (dist < min && dist > 0.0001) {
          const nx = dx / dist, nz = dz / dist;
          pos.x += nx * (min - dist);
          pos.z += nz * (min - dist);
          p.vx = nx * 2.6;
          p.vz = nz * 2.6;
        }
      }
      pos.x += p.vx * dt;
      pos.z += p.vz * dt;
      const damp = Math.exp(-3.2 * dt);
      p.vx *= damp; p.vz *= damp;
      p.mesh.rotation.y += (p.vx - p.vz) * dt * 0.8;

      for (const c of this.colliders) {
        if (pos.x > c.min.x - p.r && pos.x < c.max.x + p.r && pos.z > c.min.z - p.r && pos.z < c.max.z + p.r) {
          const l = pos.x - (c.min.x - p.r), r = (c.max.x + p.r) - pos.x;
          const t = pos.z - (c.min.z - p.r), b = (c.max.z + p.r) - pos.z;
          const m = Math.min(l, r, t, b);
          if (m === l) { pos.x = c.min.x - p.r; p.vx = 0; }
          else if (m === r) { pos.x = c.max.x + p.r; p.vx = 0; }
          else if (m === t) { pos.z = c.min.z - p.r; p.vz = 0; }
          else { pos.z = c.max.z + p.r; p.vz = 0; }
        }
      }
    }
  }

  update(dt, t, player) {
    this.time += dt;
    const cam = window.__camera;
    const hasCam = !!(cam && cam.isCamera);
    if (hasCam && player && player.pos) {
      cam.position.set(player.pos.x, (player.pos.y || 0) + EYE, player.pos.z);
      cam.rotation.order = 'YXZ';
      cam.rotation.set(player.pitch || 0, player.yaw || 0, 0);
    }

    // flicker on the tube lights
    for (const tb of this.tubes) {
      const f = Math.sin(this.time * 31 + tb.seed) * Math.sin(this.time * 7.3 + tb.seed * 2.1);
      const dim = f > 0.93 ? 0.25 : 1;
      tb.mat.color.setRGB(0.9 * dim, 0.95 * dim, 1 * dim);
    }

    this._updatePushables(dt, player);

    // people turn to watch you when you are close
    if (player && player.pos) {
      for (const s of this.suspects) {
        const dx = player.pos.x - s.pos.x, dz = player.pos.z - s.pos.z;
        if (Math.hypot(dx, dz) < 8) {
          const want = Math.atan2(dx, dz);
          const cur = s.group.rotation.y;
          const diff = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          s.group.rotation.y = cur + diff * Math.min(1, dt * 2.5);
        }
        s.group.position.y = Math.sin(this.time * 1.3 + s.phase) * 0.012;
      }
    }

    const overlay = this.panelOpen || this.fileOpen || this.confirmOpen || this.endOpen;
    if (overlay) { this.ui.prompt.style.display = 'none'; this.focus = null; }
    else if (hasCam) this._updateFocus(cam);

    for (const s of this.suspects) {
      const u = s.cone.material.uniforms;
      u.uTime.value = this.time;
      const want = (this.focus === s || (this.panelOpen && this.current === s)) ? 1 : 0;
      u.uFocus.value += (want - u.uFocus.value) * Math.min(1, dt * 5);
    }
  }

  // =========================================================
  // dispose
  // =========================================================
  dispose() {
    clearTimeout(this._toastTimer);
    window.removeEventListener('keydown', this._onKey);
    window.__firstPerson = false;
    window.__uiCapture = false;
    if (this.scene) {
      this.scene.remove(this.root);
      this.root.traverse((o) => {
        if (o.isMesh || o.isInstancedMesh) {
          if (o.geometry) o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (!m) continue;
            if (m.map) m.map.dispose();
            if (m.dispose) m.dispose();
          }
        }
      });
      this.scene.background = this._prevBg;
      this.scene.fog = this._prevFog;
    }
    if (this.ui) {
      for (const k of ['root', 'panel', 'file', 'confirm', 'end']) {
        if (this.ui[k]) this.ui[k].remove();
      }
    }
    this.ui = null;
  }
}
