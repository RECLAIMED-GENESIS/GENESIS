// ============================================================
// LEVEL 1 — THE VICTIM'S OFFICE   (first-person investigation)
//
// A lecturer is found dead in his office late at night. Shot once
// in the chest. One room, even lighting, no NPCs, no combat.
// Find 6 clues (look at them, press E), then a short cutscene shows the
// investigator logging the evidence and heading for the next lead.
//
// NOTE ABOUT THE CAMERA / CONTROLS
//   Evidence is aimed from eye height. The host can render a trailing
//   third-person view on the same sightline after this level updates.
//   Photography stays at eye height; V toggles the exploration view.
//
// Controls used by this level
//   mouse      look (needs pointer lock)
//   W A S D    walk, Shift sprint, Space jump   (host player controller)
//   E          examine / collect the clue you are looking at
//   F          toggle UV lamp (reveals hidden evidence)
//   C          open / close the case file
//
//   The level sets window.__firstPerson = true while it is alive, so a host
//   that still drives a third-person camera can stop overriding it. This
//   file deliberately does not edit any other module.
//
// Rubric coverage
//   * Player controls – first-person look + raycast interaction (E examine,
//                       F UV torch, C case file); no visible body parts
//   * Physics         – Box3 wall/furniture colliders (level.colliders)
//                       AND pushable furniture (chairs, boxes, bin) with
//                       sliding, friction and wall/furniture collision
//   * Shaders         – (1) UV reveal shader for hidden blood / a
//                         scrawl that only shows under the torch
//                       (2) pulsing fresnel "evidence glow" on every clue
//                       (3) rainy night window shader (two windows, steady)
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import professorURL from '../characters/professor.glb?url';
import professorPoseURL from '../characters/professor_pose.json?url';
import { getStats } from '../game/stats.js';
import { applyCaseToStory, getCase, killerOf } from '../game/case.js';
import { PhotoCamera } from '../game/photoCamera.js';
import { play as sfx } from '../audio/sfx.js';
import { showBriefing } from '../game/briefing.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { attachPlayerView } from '../game/DetectiveAvatar.js';

// ------------------------------------------------------------
// CASE DATA  — edit the story here
// ------------------------------------------------------------
// Exported so Level 2's case file can carry the Level 1 evidence forward.
export const CASE = {
  victim: 'Dr. Thabo Nkosi',
  role: 'Senior Lecturer, Computer Science',
  found: 'Found at 00:50 by the night cleaner',
  suspects: [
    { name: 'Prof. Naledi Dube', role: 'Head of Department' },
    { name: 'Kyle Pretorius', role: 'PhD student & tutor' },
    { name: 'Ms. Anele Mahlangu', role: 'Department administrator' },
  ],
  lastSeenPlace: 'The Staff Common Room (3rd floor)',
  nextLevel: 2,
  nextPlace: 'Central Police Station',
  // Shown as a short cutscene once every clue is logged: the investigator bags
  // the evidence for examination at the station lab.
  outro: [
    'Everything is photographed and packed. A room full of questions, and a few things that might help me answer them.',
    'Hmm. I wonder what I will find when I look at these properly. No sense deciding what happened before the tests are done.',
    'Next stop, the station lab. Let the evidence tell its own story.',
  ],
  body: {
    name: 'The body',
    note: 'A wound in his chest. I need to document the scene carefully. The examinations will have to answer the rest.',
  },
  clues: {
    casing: {
      name: 'Bullet casing',
      note: 'Hmm, a casing. This could be useful. I will bag it carefully and see what the lab can tell me.',
    },
    glass: {
      name: 'Two whiskey glasses',
      note: 'Two glasses. I wonder what traces are still on them. Better preserve both before I jump to conclusions.',
    },
    hair: {
      name: 'Brown hair fibres (guest chair)',
      note: 'A few strands caught in the chair. Easy to miss. I wonder whether the microscope will give me something to work with.',
    },
    handkerchief: {
      name: 'Monogrammed handkerchief',
      note: 'There is a stain on this cloth, and some stitching in the corner. Hmm. I will need a closer look back at the lab.',
    },
    phone: {
      name: 'His phone',
      note: 'His phone. There might be something useful in here, but I need to examine it properly. For now, keep it safe.',
    },
    trail: {
      name: 'Wiped blood trail (UV)',
      note: 'Something shows up under the UV light. Let me photograph it as it is. I wonder what I will make of it at the lab.',
    },
  },

};

const REACH = 3.6;       // how far the player can examine things
const PLAYER_R = 0.38;   // radius used when the player pushes objects
const EYE = 1.66;        // first-person eye height

// ------------------------------------------------------------
// FORENSIC TOOL BELT — every clue states its tool. Photograph first,
// then lift with the right instrument. Wrong tool = contamination.
// ------------------------------------------------------------
const TOOLS = { bag: 'EVIDENCE BAGS', tweezers: 'TWEEZERS', swab: 'SWAB KIT', camera: 'CAMERA' };
const CLUE_TOOL = {
  casing: 'tweezers', glass: 'bag', hair: 'tweezers', handkerchief: 'swab',
  phone: 'bag', trail: 'camera',
};

// ------------------------------------------------------------
// small helpers
// ------------------------------------------------------------
// Nudges used by the idle-hint system (a stuck player is a bored player).
const CLUE_HINT = {
  casing: 'Something brass caught the lightning near the bookshelf. Check the floor under it.',
  glass: 'He had company. Look for a second drink — not on the desk.',
  hair: 'The guest sat somewhere. Check the guest chair: cushion and armrest.',
  handkerchief: 'Something was dropped where the guest stood up. Check the floor by the guest chair.',
  phone: 'His phone should be near the desk. The screen was still lit when he died.',
  note: 'Something was hidden, not lost. Try under the moving boxes.',
  trail: 'The floor has more to say. UV torch [F] — sweep from the guest chair toward the door.',
  calendar: 'A dead man\'s plans live on his desk. Check the desk calendar.',
};

let _seed = 1337;
const rng = () => (_seed = (_seed * 16807) % 2147483647) / 2147483647;

function canvasTex(w, h, draw, opts) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (opts && opts.alpha) t.premultiplyAlpha = false;
  return t;
}
function wrapText(g, text, maxW) {
  const words = text.split(' '); const lines = []; let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// ------------------------------------------------------------
// SHADERS
// ------------------------------------------------------------
// 1) UV reveal — hidden marks are invisible unless inside the UV torch cone
const UV_VERT = `
varying vec2 vUv; varying vec3 vWorld;
void main(){
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const UV_FRAG = `
uniform sampler2D uMap;
uniform float uTime, uUvOn, uUvCos;
uniform vec3 uUvPos, uUvDir;
uniform vec3 uTint;
varying vec2 vUv; varying vec3 vWorld;
void main(){
  vec3 toP = vWorld - uUvPos;
  float dist = length(toP);
  float c = dot(toP / max(dist, 0.001), uUvDir);
  float cone = smoothstep(uUvCos, uUvCos + 0.05, c);
  float atten = 1.0 / (1.0 + 0.10 * dist * dist);
  float a = texture2D(uMap, vUv).a * cone * atten * uUvOn;
  float shimmer = 0.85 + 0.15 * sin(uTime * 3.0 + vWorld.x * 4.0 + vWorld.z * 3.0);
  vec3 col = mix(uTint, vec3(0.85, 0.55, 1.0), vUv.y);
  gl_FragColor = vec4(col * a * 2.6 * shimmer, a);
}`;

// 2) Evidence glow — pulsing fresnel aura around each clue
const GLOW_VERT = `
varying vec3 vN; varying vec3 vV;
void main(){
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = `
uniform float uTime, uFocus, uPhase;
uniform vec3 uColor;
varying vec3 vN; varying vec3 vV;
void main(){
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
  float pulse = 0.55 + 0.45 * sin(uTime * 2.6 + uPhase);
  float a = fres * pulse * (0.5 + uFocus * 1.4);
  gl_FragColor = vec4(uColor * a * 1.6, a);
}`;

// 3) Rainy window with occasional lightning
const WIN_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WIN_FRAG = `
uniform float uTime, uFlash;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 col = mix(vec3(0.015, 0.03, 0.07), vec3(0.09, 0.14, 0.26), vUv.y);
  float streak = 0.0;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float cols = 14.0 + fi * 9.0;
    float id = floor(vUv.x * cols);
    float x = fract(vUv.x * cols) - 0.5;
    float spd = 0.25 + hash(vec2(id, fi)) * 0.5;
    float y = fract(vUv.y * (1.0 + fi * 0.4) + uTime * spd + hash(vec2(id, fi + 3.0)));
    streak += smoothstep(0.07, 0.0, abs(x)) * smoothstep(0.35, 0.0, y) * 0.35;
  }
  col += vec3(0.45, 0.6, 0.85) * streak;
  col += uFlash * vec3(0.55, 0.65, 0.95);
  gl_FragColor = vec4(col, 1.0);
}`;

// ============================================================
export class StreetLevel {
  constructor(sceneOrRenderer = null, rendererMaybe = null) {
    applyCaseToStory(CASE);   // clue text follows this run's randomly chosen killer
    let outerScene = null;
    if (sceneOrRenderer && sceneOrRenderer.isScene) outerScene = sceneOrRenderer;
    this.scene = outerScene || new THREE.Scene();
    this.renderer = rendererMaybe || window.__renderer || null;

    // remember what was there so dispose() can restore it
    this._prevBg = this.scene.background;
    this._prevFog = this.scene.fog;
    this.scene.background = new THREE.Color(0x04050a);
    this.scene.fog = new THREE.FogExp2(0x0b0e16, 0.012);

    this.name = "LEVEL 1 — THE VICTIM'S OFFICE";
    this.colliders = [];
    this.level = new THREE.Group();
    this.root = this.level;
    this.scene.add(this.level);

    this.time = 0;

    // ---- room footprint (an individual professor's office). The centre is offset
    //      on BOTH axes so the BACK wall (door / windows / desk) and the RIGHT wall
    //      never move. The FRONT wall is pulled in and the LEFT end is cut off just
    //      past the second window (the bookcases + reading chair went with it).
    //      x -6..10.5, z -7..+4.5, height 4.2 ----
    const L = -6, R = 8.5, B = -7, F = 2.5;
    this.W = R - L; 
    this.D = F - B; 
    this.H = 3.3;   // was 4.2 — a real office ceiling, so the room feels its size
    this.CX = (L + R) / 2;                        // room centre on X
    this.CZ = (B + F) / 2;                       // room centre on Z
    this.HALF_W = this.W / 2;
    this.HALF_D = this.D / 2;
    this.LEFT = this.CX - this.HALF_W;     // -6    cut just past the 2nd window
    this.RIGHT = this.CX + this.HALF_W;    // +10.5 door-side wall (unchanged)
    this.BACK = this.CZ - this.HALF_D;     // -7    door / windows / desk wall
    this.FRONT = this.CZ + this.HALF_D;    // +4.5  display-table wall

    this.spawn = new THREE.Vector3(5.5, 0, 1.6);
    this.spawnYaw = Math.PI * 0.78;   // face across the room toward the desk

    this.clues = [];
    this.movables = [];
    this.occluders = [];       // invisible boxes that block the examine ray
    this.uvOn = false;
    this.tool = 'bag';         // 1 bags · 2 tweezers · 3 swab kit
    this.caseOpen = false;
    this.outroOpen = false;
    this._idle = 0;           // seconds since the last find (drives hints)
    this._dark = 0;           // blackout timer for the mid-level scare
    this._scared = false;
    this.focus = null;
    this.focusBody = false;
    this._nextFlash = 5;
    this._flashT = 0;
    this._reachT = -1;         // hand reach animation timer
    this._bob = 0;
    this._bobAmt = 0;

    // temp vectors
    this._o = new THREE.Vector3(); this._d = new THREE.Vector3(0, 0, -1);
    this._v = new THREE.Vector3(); this._rc = new THREE.Raycaster();
    this._q = new THREE.Quaternion();

    // shared UV uniforms (every UV-reactive material references these objects)
    this.uv = {
      uTime: { value: 0 },
      uUvOn: { value: 0 },
      uUvCos: { value: Math.cos(0.55) },
      uUvPos: { value: new THREE.Vector3() },
      uUvDir: { value: new THREE.Vector3(0, 0, -1) },
    };

    this._makeMaterials();
    this._buildRoom();
    this._buildLighting();
    this._buildFurniture();
    this._buildDecor();          // display table (books + awards) & wall paintings
    this._buildEvidenceMarkers();
    this._buildBody();
    this._buildClues();
    this._buildCamera();       // [Q] scene camera — photograph before you lift
    // NOTE: no first-person hand/torch rig is built — the view stays clean.
    this._buildUI();

    // shadows on everything built so far
    this.level.traverse((o) => {
      if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; }
    });
    this.level.updateMatrixWorld(true);
    this._look = applyLevel1Look(this);

    // the third-person avatar is no longer part of this game
    this._hideAvatar();
    window.__firstPerson = true;   // tell any host camera rig to stand down

    this._onKey = (e) => this._handleKey(e);
    window.addEventListener('keydown', this._onKey);
    this._toast('INCIDENT — LECTURER FOUND DEAD', `Photograph everything before you lift it. [Q] camera · [1] bags · [2] tweezers · [3] swab · [E] collect · [F] UV lamp · [C] file`, 11000);
    // Opening: a typed dispatch over the radio, then the evidence reminder.
    this._briefing = showBriefing({
      kicker: 'POLICE RADIO',
      stamp: '00:58  \u2014  FACULTY OF COMPUTING, 3RD FLOOR',
      speaker: 'DISPATCH \u2192 INVESTIGATOR',
      objective: 'Photograph and collect all 6 exhibits. Review the case file [C], then take the sealed evidence to the police station.',
      lines: [
        'DISPATCH: Detective, you are in Dr. Thabo Nkosi’s office at the Faculty of Computing. The night cleaner found him dead at 00:50. He suffered a single gunshot wound.',
        'DETECTIVE: I will secure the room and document what happened. We have five possible suspects, but no finding identifies the killer yet.',
        'DISPATCH: Start with the visible objects on the desk and beside the body. Look at an exhibit, raise your camera with Q and click to photograph it. Lower the camera with Q, then press E to collect it.',
        'DISPATCH: Use 1 for evidence bags, 2 for tweezers and 3 for the blood swab. The camera suggests the correct tool after a sharp photo. F turns on UV: use it to find and photograph the wiped trail.',
        'CAPTAIN MABASO: Log all six exhibits. Open your case file with C, check your inventory and seal the evidence. Then come to Central Police Station: greet reception and head straight to the lab.',
      ],
      onDone: () => {
        if (this.ui) this._toast('INCIDENT \u2014 LECTURER FOUND DEAD', `Photograph everything before you lift it.`, 9000);
      },
    });
  }

  // ---------- gameplay helpers (same names the host expects) ----------
  getSurfaceHeight() { return 0; }
  groundHeight() { return 0; }
  terrainHeight() { return 0; }
  _h() { return 0; }

  _hideAvatar() {
    // Defensive only: if the host scene still carries the old fighting-game
    // character, hide it so the view stays first-person.
    try {
      this.scene.traverse((o) => {
        const n = (o.name || '').toLowerCase();
        if (o.isMesh || o.isGroup) {
          if (n.includes('sorini') || n.includes('y_bot') || n.includes('playermesh')) o.visible = false;
        }
      });
    } catch (e) { /* ignore */ }
  }

  // =========================================================
  // MATERIALS
  // =========================================================
  _makeMaterials() {
    const floorTex = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#2a1b12'; g.fillRect(0, 0, w, h);
      for (let col = 0; col < 8; col++) {
        let y = -(col % 2) * 64;
        while (y < h) {
          const len = 128;
          g.fillStyle = `hsl(${22 + rng() * 6}, ${32 + rng() * 10}%, ${13 + rng() * 9}%)`;
          g.fillRect(col * 64 + 1, y + 1, 62, len - 2);
          g.fillStyle = 'rgba(0,0,0,0.25)';
          for (let k = 0; k < 5; k++) g.fillRect(col * 64 + 4 + rng() * 54, y + rng() * len, 1, 10 + rng() * 30);
          y += len;
        }
      }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(4, 3);

    const wallTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#c9cdd6'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 700; i++) {
        g.fillStyle = `rgba(${rng() > 0.5 ? '255,255,255' : '120,126,140'},${rng() * 0.06})`;
        g.fillRect(rng() * w, rng() * h, 2 + rng() * 4, 2 + rng() * 4);
      }
      // a clean, freshly painted university-office wall — no damp, no grime
    });
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(6, 1.6);

    this.m = {
      floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.05 }),
      wall: new THREE.MeshStandardMaterial({ map: wallTex, color: 0xe3e6ed, roughness: 0.9 }),
      ceil: new THREE.MeshStandardMaterial({ color: 0x33373f, roughness: 1 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x4a2f20, roughness: 0.6 }),
      woodDark: new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.7 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x77808c, roughness: 0.4, metalness: 0.7 }),
      fabric: new THREE.MeshStandardMaterial({ color: 0x2c3a4a, roughness: 0.95 }),
      leather: new THREE.MeshStandardMaterial({ color: 0x30201a, roughness: 0.8 }),
      cardboard: new THREE.MeshStandardMaterial({ color: 0x9a7448, roughness: 0.9 }),
      paper: new THREE.MeshStandardMaterial({ color: 0xd9d2bf, roughness: 0.9 }),
      porcelain: new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.3 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xdfe9f2, roughness: 0.06, metalness: 0, transmission: 0.85,
        thickness: 0.4, transparent: true, opacity: 0.55, ior: 1.5,
      }),
      whiskey: new THREE.MeshStandardMaterial({ color: 0x8a4a12, roughness: 0.12, transparent: true, opacity: 0.85 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xc9982f, roughness: 0.25, metalness: 0.9 }),
      blood: new THREE.MeshStandardMaterial({ color: 0x4b0d0d, roughness: 0.35, metalness: 0 }),
      bloodDark: new THREE.MeshStandardMaterial({ color: 0x2a0606, roughness: 0.5 }),
      chalk: new THREE.MeshBasicMaterial({ color: 0xe9e9e2, transparent: true, opacity: 0.55 }),
      rug: new THREE.MeshStandardMaterial({ color: 0x4a2630, roughness: 1 }),
      glove: new THREE.MeshStandardMaterial({ color: 0x22303f, roughness: 0.75 }),
      skinGlove: new THREE.MeshStandardMaterial({ color: 0xb98b6b, roughness: 0.8 }),
      tape: new THREE.MeshStandardMaterial({ color: 0xd8c22a, emissive: 0x2a2400, roughness: 0.6 }),
    };
  }

  _box(parent, w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  _cyl(parent, rt, rb, h, mat, x, y, z, seg, open) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 16, 1, !!open), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // invisible mesh used for raycasting only (Raycaster ignores .visible)
  _ghost(parent, w, h, d, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial());
    m.visible = false; m.userData.noShadow = true;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // static, solid piece of the level: collider (for the player) + occluder (for the examine ray)
  _static(cx, cz, hw, hd, h) {
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(cx - hw, 0, cz - hd),
      new THREE.Vector3(cx + hw, h, cz + hd)));
    this.occluders.push(this._ghost(this.level, hw * 2, h, hd * 2, cx, h / 2, cz));
  }

  // =========================================================
  // ROOM  (21m wide x 11.5m deep, 4.2m high — an individual professor's office.
  //        The centre is offset on Z so the back wall sits at z = -7 and the
  //        front wall at z = +4.5; see this.CZ / this.BACK / this.FRONT.)
  // =========================================================
  _buildRoom() {
    const W = this.W, D = this.D, H = this.H;
    const cz = this.CZ, bk = this.BACK, ft = this.FRONT;
    const cx0 = this.CX, lf = this.LEFT, rt = this.RIGHT;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this.m.floor);
    floor.rotation.x = -Math.PI / 2; floor.position.set(cx0, 0, cz); this.level.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this.m.ceil);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(cx0, H, cz); this.level.add(ceil);

    // walls (visual + collider). Thickness .3 sits outside the room.
    const wall = (cx, czz, w, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), this.m.wall);
      m.position.set(cx, H / 2, czz); this.level.add(m);
      this._static(cx, czz, w / 2, d / 2, H);
    };
    wall(cx0, bk - 0.15, W + 0.6, 0.3);    // back (door / windows / desk)
    wall(cx0, ft + 0.15, W + 0.6, 0.3);    // front (display wall)
    wall(lf - 0.15, cz, 0.3, D + 0.6);     // left (cut off past the 2nd window)
    wall(rt + 0.15, cz, 0.3, D + 0.6);     // right (door side — unchanged)

    // wainscot + cornice around the whole room
    const wain = this.m.woodDark;
    this._box(this.level, W, 1.05, 0.05, wain, cx0, 0.52, bk + 0.03);
    this._box(this.level, W, 1.05, 0.05, wain, cx0, 0.52, ft - 0.03);
    this._box(this.level, 0.05, 1.05, D, wain, lf + 0.03, 0.52, cz);
    this._box(this.level, 0.05, 1.05, D, wain, rt - 0.03, 0.52, cz);
    this._box(this.level, W, 0.12, 0.12, wain, cx0, H - 0.16, bk + 0.06);
    this._box(this.level, 0.12, 0.12, D, wain, lf + 0.06, H - 0.16, cz);
    this._box(this.level, 0.12, 0.12, D, wain, rt - 0.06, H - 0.16, cz);

    // ceiling tile grid spanning the room
    const tileMat = new THREE.MeshStandardMaterial({ color: 0x3a3e47, roughness: 1 });
    for (let i = -2; i <= 2; i++) {
      const s = this._box(this.level, 0.06, 0.04, D - 0.6, tileMat, cx0 + i * 3.3, H - 0.04, cz);
      s.userData.noShadow = true;
    }

    // rug under the conversation area
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.6), this.m.rug);
    rug.rotation.x = -Math.PI / 2; rug.position.set(0.2, 0.01, -1.0);
    rug.userData.noShadow = true; this.level.add(rug);

    // ---- door (back wall, x = 7) — the room is sealed, this is set dressing ----
    const door = new THREE.Group(); door.position.set(7, 0, bk + 0.08);
    this._box(door, 1.05, 2.2, 0.06, this.m.wood, 0, 1.1, 0);
    this._box(door, 0.1, 2.3, 0.1, this.m.woodDark, -0.6, 1.15, 0);
    this._box(door, 0.1, 2.3, 0.1, this.m.woodDark, 0.6, 1.15, 0);
    this._box(door, 1.3, 0.1, 0.1, this.m.woodDark, 0, 2.3, 0);
    this._box(door, 0.05, 0.05, 0.14, this.m.metal, 0.4, 1.05, 0.06);
    // frosted glass panel in the door
    const panel = this._box(door, 0.6, 0.9, 0.02, new THREE.MeshStandardMaterial({
      color: 0x8fa8bf, roughness: 0.2, transparent: true, opacity: 0.35,
    }), 0, 1.6, 0.02);
    panel.userData.noShadow = true;
    const leakMat = new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0xbfdcff, emissiveIntensity: 2.4 });
    const strip = this._box(door, 1.0, 0.014, 0.02, leakMat, 0, 0.014, 0.05);
    strip.userData.noShadow = true;
    this.level.add(door);

    // police line across the doorway, inside the room
    const tape = new THREE.Group(); tape.position.set(7, 0, bk + 0.5);
    for (let i = 0; i < 2; i++) {
      const p = this._box(tape, 0.05, 1.0, 0.05, this.m.metal, (i ? 0.9 : -0.9), 0.5, 0);
      p.userData.noShadow = true;
    }
    const ribbon = this._box(tape, 1.9, 0.16, 0.012, this.m.tape, 0, 0.92, 0);
    ribbon.userData.noShadow = true;
    this.level.add(tape);

    // ---- two windows on the back wall : rainy night shader ----
    this.winMat = new THREE.ShaderMaterial({
      vertexShader: WIN_VERT, fragmentShader: WIN_FRAG,
      uniforms: { uTime: this.uv.uTime, uFlash: { value: 0 } },
    });
    const fr = this.m.woodDark;
    const curtainMat = new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 1 });
    for (const wx of [-4.0, 3.0]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), this.winMat);
      pane.position.set(wx, 2.15, bk + 0.02); pane.userData.noShadow = true;
      this.level.add(pane);
      // frame + mullions
      this._box(this.level, 2.85, 0.12, 0.14, fr, wx, 3.02, bk + 0.06);
      this._box(this.level, 2.85, 0.14, 0.14, fr, wx, 1.28, bk + 0.06);
      this._box(this.level, 0.12, 1.9, 0.14, fr, wx - 1.4, 2.15, bk + 0.06);
      this._box(this.level, 0.12, 1.9, 0.14, fr, wx + 1.4, 2.15, bk + 0.06);
      this._box(this.level, 0.06, 1.6, 0.1, fr, wx, 2.15, bk + 0.06);
      this._box(this.level, 2.6, 0.06, 0.1, fr, wx, 2.15, bk + 0.06);
      // windowsill
      this._box(this.level, 2.95, 0.06, 0.24, fr, wx, 1.26, bk + 0.13);
      // a neat curtain panel parked at each side of the reveal
      for (const side of [-1, 1]) {
        const c = this._box(this.level, 0.34, 2.05, 0.06, curtainMat, wx + side * 1.6, 2.12, bk + 0.2);
        c.userData.noShadow = true;
      }
    }

    // ---- a framed photo on the back wall (the row of diplomas hung on the
    //      left end that has now been cut off, so it went with it) ----
    this._box(this.level, 0.8, 0.62, 0.04, this.m.woodDark, -1.0, 2.4, bk + 0.04);
    const photoTex = canvasTex(128, 96, (g, w, h) => {
      g.fillStyle = '#3b4a5c'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7a6b57'; g.fillRect(0, h * 0.55, w, h * 0.45);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = '#22252c'; g.beginPath();
        g.arc(24 + i * 26, h * 0.55, 10, 0, Math.PI * 2); g.fill();
        g.fillRect(14 + i * 26, h * 0.55, 20, 34);
      }
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, w, h / 2);
    });
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.54), new THREE.MeshBasicMaterial({ map: photoTex }));
    photo.position.set(-1.0, 2.4, bk + 0.07); photo.userData.noShadow = true; this.level.add(photo);

    // ---- corkboard + shelf on the right wall ----
    this._box(this.level, 0.05, 1.1, 1.9, this.m.woodDark, rt - 0.04, 1.9, -1.2);
    this._box(this.level, 0.03, 1.0, 1.8, new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1 }), rt - 0.07, 1.9, -1.2);
    for (let i = 0; i < 9; i++) {
      const p = this._box(this.level, 0.012, 0.24, 0.18, this.m.paper, rt - 0.09, 1.55 + rng() * 0.7, -2.0 + rng() * 1.7);
      p.rotation.x = (rng() - 0.5) * 0.35;
    }
    // a photo pinned crookedly, circled in red pen
    const pinned = this._box(this.level, 0.014, 0.3, 0.24, this.m.paper, rt - 0.09, 2.1, -0.9);
    pinned.rotation.x = 0.2;
    this._box(this.level, 0.016, 0.02, 0.32, new THREE.MeshStandardMaterial({ color: 0xa01c1c, emissive: 0x400808, emissiveIntensity: 1 }), rt - 0.1, 2.1, -0.9);
  }

  // =========================================================
  // LIGHTING — clean and even. Bright ceiling tubes, a warm desk lamp and
  // moonlight through the two windows. Everything is steady: no flicker.
  // =========================================================
  _buildLighting() {
    // ---- a well-lit university office at night ----
    // soft sky/ground bounce plus a base ambient so nothing is lost in shadow
    this.level.add(new THREE.HemisphereLight(0xbcd0f2, 0x544c3e, 1.15));
    this.level.add(new THREE.AmbientLight(0xdfe8ff, 0.5));

    // One central ceiling fill replaces the three overlapping point lights.
    // Sky and ambient light retain the soft illumination in the corners.
    this.roomFill = new THREE.PointLight(0xeaf0ff, 8.0, 34, 1.7);
    this.roomFill.position.set(this.CX, this.H - 0.5, this.CZ);
    this.level.add(this.roomFill);

    // desk lamp — the warm focal light over the desk (steady, no flicker)
    this.lamp = new THREE.PointLight(0xffc27a, 11, 15, 1.5);
    this.lamp.position.set(-2.6, 1.5, -3.4);
    this.lamp.castShadow = false;
    this.level.add(this.lamp);

    // moonlight through BOTH windows — steady night light, no lightning
    this.moon = new THREE.SpotLight(0x82a4e6, 16, 30, Math.PI / 3.2, 0.9, 1.0);
    this.moon.position.set(-4.0, 3.3, this.BACK + 0.6);
    this.moon.target.position.set(-2.0, 0, 1.0);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(1024, 1024);
    this.level.add(this.moon, this.moon.target);

    this.moon2 = new THREE.SpotLight(0x82a4e6, 12, 28, Math.PI / 3.2, 0.9, 1.0);
    this.moon2.position.set(3.0, 3.3, this.BACK + 0.6);
    this.moon2.target.position.set(4.5, 0, 1.5);
    this.level.add(this.moon2, this.moon2.target);

    // bright ceiling tube fixtures — steady, evenly spaced (no flicker)
    this.tubeMat = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, emissive: 0xe8f0ff, emissiveIntensity: 1.6 });
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 12), this.tubeMat);
      t.rotation.z = Math.PI / 2;
      t.position.set(
        this.CX + (i - 1.5) * 3.9,                         // was 4.4 spacing
        this.H - 0.24,
        this.CZ + (i % 2 ? 1 : -1) * (this.D / 2 - 2.4)    // stays inside the room
      );
      t.userData.noShadow = true;
      this.level.add(t);
    }

    // light leaking in from the corridor through the door
    const leak = new THREE.PointLight(0x9fc0ff, 1.6, 8, 2);
    leak.position.set(7, 0.35, this.BACK + 0.6);
    this.level.add(leak);

    // UV lamp — a proper ultraviolet source, not just a torch: a wide violet
    // cone plus an ambient UV wash that makes fluorescing evidence bloom.
    this.uvLight = new THREE.SpotLight(0x8a2bff, 0, 16, 0.62, 0.78, 1.05);
    this.level.add(this.uvLight, this.uvLight.target);
    this.uvWash = new THREE.PointLight(0x7a3cff, 0, 15, 2);
    this.level.add(this.uvWash);
  }

  // =========================================================
  // FURNITURE
  // =========================================================
  _chair(x, z, rotY, opts = {}) {
    const g = new THREE.Group();
    const seatMat = opts.leather ? this.m.leather : this.m.fabric;
    this._box(g, 0.52, 0.09, 0.52, seatMat, 0, 0.47, 0);
    this._box(g, 0.52, 0.6, 0.07, seatMat, 0, 0.82, -0.24);
    this._box(g, 0.06, 0.36, 0.06, this.m.woodDark, -0.23, 1.0, -0.24);
    this._box(g, 0.06, 0.36, 0.06, this.m.woodDark, 0.23, 1.0, -0.24);
    for (const [lx, lz] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]]) {
      this._box(g, 0.05, 0.45, 0.05, this.m.woodDark, lx, 0.225, lz);
    }
    this._box(g, 0.52, 0.05, 0.05, this.m.woodDark, 0, 0.16, -0.21);
    g.rotation.y = rotY;
    const m = this._movable(g, x, z, 0.29, 0.29, 1.1, opts.ease == null ? 0.75 : opts.ease, opts.name || 'chair');
    if (opts.tipped) {
      g.rotation.x = -1.45;            // fallen on its back, physics still uses x/z
      m.h = 0.55;
    }
    return m;
  }

  _movable(group, x, z, hx, hz, h, ease, name) {
    group.position.set(x, 0, z);
    this.level.add(group);
    // invisible proxy, child of the group so it follows it; blocks the examine ray
    const proxy = this._ghost(group, hx * 2, h, hz * 2, 0, h / 2, 0);
    this.occluders.push(proxy);
    const m = { group, x, z, hx, hz, h, ease, name, vx: 0, vz: 0 };
    this.movables.push(m);
    return m;
  }

  // bookcase standing against the left wall, front facing +x
  _bookcase(z0) {
    const g = new THREE.Group();
    const w = 2.6, d = 0.45, h = 2.5;
    this._box(g, w, h, 0.05, this.m.woodDark, 0, h / 2, -d / 2 + 0.02);
    this._box(g, 0.06, h, d, this.m.wood, -w / 2, h / 2, 0);
    this._box(g, 0.06, h, d, this.m.wood, w / 2, h / 2, 0);
    for (let i = 0; i < 5; i++) this._box(g, w, 0.045, d, this.m.wood, 0, 0.12 + i * 0.58, 0);
    this._box(g, w, 0.06, d, this.m.wood, 0, h, 0);
    const per = 24, rows = 4;
    const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), per * rows);
    const M = new THREE.Matrix4(), c = new THREE.Color();
    let k = 0;
    for (let r = 0; r < rows; r++) {
      let x = -w / 2 + 0.12;
      for (let i = 0; i < per && x < w / 2 - 0.12; i++) {
        const bw = 0.04 + rng() * 0.06, bh = 0.3 + rng() * 0.18;
        M.compose(new THREE.Vector3(x + bw / 2, 0.14 + r * 0.58 + bh / 2, -0.02),
          new THREE.Quaternion(), new THREE.Vector3(bw, bh, 0.3));
        books.setMatrixAt(k, M);
        c.setHSL(rng(), 0.32, 0.16 + rng() * 0.14); books.setColorAt(k, c);
        k++; x += bw + 0.006;
      }
    }
    // a gap where someone leant something
    books.count = k; books.instanceMatrix.needsUpdate = true;
    if (books.instanceColor) books.instanceColor.needsUpdate = true;
    g.add(books);
    const cx = this.LEFT + d / 2 + 0.06;
    g.position.set(cx, 0, z0);
    g.rotation.y = Math.PI / 2;
    this.level.add(g);
    this._static(cx, z0, d / 2 + 0.02, w / 2, h);
    return g;
  }

  _filingCabinet(x, z, rotY) {
    const g = new THREE.Group();
    this._box(g, 0.72, 1.4, 0.62, this.m.metal, 0, 0.7, 0);
    for (let i = 0; i < 3; i++) {
      this._box(g, 0.64, 0.4, 0.02, new THREE.MeshStandardMaterial({ color: 0x59616c, roughness: 0.5, metalness: 0.5 }), 0, 0.24 + i * 0.44, 0.31);
      this._box(g, 0.2, 0.035, 0.04, this.m.woodDark, 0, 0.34 + i * 0.44, 0.34);
    }
    // top drawer pulled out an inch
    this._box(g, 0.6, 0.36, 0.1, this.m.metal, 0, 1.1, 0.36);
    g.position.set(x, 0, z); g.rotation.y = rotY;
    this.level.add(g);
    this._static(x, z, 0.36, 0.32, 1.4);
    return g;
  }

  _buildFurniture() {
    // ---- desk (against the back wall, facing the door) — a generous lectern ----
    const desk = new THREE.Group();
    desk.position.set(-2.8, 0, -5.15);
    this._box(desk, 3.9, 0.08, 1.4, this.m.wood, 0, 0.76, 0);
    this._box(desk, 3.94, 0.24, 0.06, this.m.woodDark, 0, 0.62, -0.68);
    this._box(desk, 0.62, 0.72, 1.25, this.m.woodDark, -1.55, 0.36, 0);
    this._box(desk, 0.62, 0.72, 1.25, this.m.woodDark, 1.55, 0.36, 0);
    // modesty panel
    this._box(desk, 2.5, 0.52, 0.05, this.m.woodDark, 0, 0.44, -0.6);
    // desk lamp
    this._box(desk, 0.2, 0.03, 0.2, this.m.metal, -1.02, 0.81, -0.3);
    const lampArm = this._box(desk, 0.035, 0.52, 0.035, this.m.metal, -1.02, 1.07, -0.3); lampArm.rotation.z = 0.18;
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.22, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x2f4a38, emissive: 0xffc27a, emissiveIntensity: 1.8, side: THREE.DoubleSide }));
    shade.position.set(-0.98, 1.32, -0.3); shade.userData.noShadow = true; desk.add(shade);
    this.lampShadeMat = shade.material;
    // monitor (dark), keyboard, papers, an open ledger
    const mon = this._box(desk, 0.62, 0.38, 0.03, new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.35 }), 0.55, 1.16, -0.34);
    mon.rotation.y = -0.12;
    this._box(desk, 0.16, 0.22, 0.16, this.m.metal, 0.55, 0.9, -0.34);
    this._box(desk, 0.5, 0.02, 0.18, new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.8 }), 0.45, 0.81, 0.12);
    this._box(desk, 0.3, 0.035, 0.4, this.m.paper, -0.35, 0.81, -0.05).rotation.y = 0.25;
    this._box(desk, 0.36, 0.06, 0.28, this.m.leather, -0.15, 0.82, 0.28).rotation.y = -0.1;
    this._box(desk, 0.33, 0.02, 0.25, this.m.paper, -0.15, 0.86, 0.28).rotation.y = -0.1;
    this.level.add(desk);
    this._static(-2.8, -5.15, 1.95, 0.7, 0.79);
    this.desk = desk;

    // the victim's own chair, still behind the desk
    this._chair(-2.5, -5.9, 0, { leather: true, ease: 0.45 });

    // guest chair — the shooter sat here
    this.guestChair = this._chair(1.5, -1.4, Math.PI * 0.92, { leather: true, ease: 0.7 });

    // a spare chair, upright and tidy in the front-right corner
    this._chair(7.4, 1.5, 2.4, { ease: 1.0 }); 

    // ---- filing cabinet on the right wall (the two left-wall bookcases stood on
    //      the cut-off end, so they are gone) ----
    this._filingCabinet(this.RIGHT - 0.4, -2.6, -Math.PI / 2);

    // side cabinet the guest used — holds the decanter and the second glass
    const side = new THREE.Group();
    this._box(side, 1.4, 0.85, 0.6, this.m.woodDark, 0, 0.425, 0);
    this._box(side, 1.44, 0.05, 0.64, this.m.wood, 0, 0.88, 0);
    this._box(side, 0.62, 0.3, 0.02, this.m.wood, -0.34, 0.45, 0.31);
    this._box(side, 0.62, 0.3, 0.02, this.m.wood, 0.34, 0.45, 0.31);
    side.position.set(7.4, 0, -6.3);
    this.level.add(side);
    this._static(7.4, -6.3, 0.7, 0.3, 0.9);

    // decanter + the guest's half-finished glass (the collectable pair lives
    // in _buildClues; this is the furniture that makes the corner read)
    const decanter = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.26, 16), this.m.glass);
    decanter.position.set(7.15, 1.03, -6.3); this.level.add(decanter);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 0.1, 12), this.m.glass);
    neck.position.set(7.15, 1.2, -6.3); this.level.add(neck);

    // ---- a single tidy wastebasket. The pushable-furniture physics still
    //      runs on this and the chairs, but the office is kept neat: no
    //      cardboard moving boxes, no spilled papers. ----
    const bin = new THREE.Group();
    const binMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }));
    binMesh.position.y = 0.21; bin.add(binMesh);
    for (let i = 0; i < 3; i++) {
      const crumpled = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), this.m.paper);
      crumpled.position.set((rng() - 0.5) * 0.16, 0.36 + rng() * 0.05, (rng() - 0.5) * 0.16);
      bin.add(crumpled);
    }
    this._movable(bin, 4.2, 1.8, 0.22, 0.22, 0.44, 1.0, 'bin');
  }

  // =========================================================
  // DECOR — fills the floor with a proper academic's display
  // table (neat book stacks + awards) and hangs paintings on
  // the walls. All of it is set dressing: nothing here is a
  // clue, and none of it can be examined or lifted.
  // =========================================================
  _buildDecor() {
    // ---- display table against the front wall ----
    const disp = new THREE.Group();
    disp.position.set(-3.5, 0, this.FRONT - 0.6);
    this._box(disp, 2.6, 0.06, 0.62, this.m.wood, 0, 0.74, 0);            // top
    this._box(disp, 2.6, 0.1, 0.05, this.m.woodDark, 0, 0.66, 0.28);      // front rail
    this._box(disp, 2.6, 0.1, 0.05, this.m.woodDark, 0, 0.66, -0.28);     // back rail
    this._box(disp, 0.08, 0.72, 0.54, this.m.woodDark, -1.2, 0.36, 0);    // left end panel
    this._box(disp, 0.08, 0.72, 0.54, this.m.woodDark, 1.2, 0.36, 0);     // right end panel
    this._box(disp, 2.2, 0.04, 0.5, this.m.wood, 0, 0.28, 0);             // lower shelf

    // a neat stack of hardbacks on the top
    const bookColors = [0x7a2c2c, 0x2c4a7a, 0x2f5d3a, 0x6a5a2c, 0x4a2c6a];
    for (let i = 0; i < 5; i++) {
      const b = this._box(disp, 0.34, 0.05, 0.24,
        new THREE.MeshStandardMaterial({ color: bookColors[i], roughness: 0.8 }),
        -0.82, 0.795 + i * 0.05, 0.03);
      b.rotation.y = (rng() - 0.5) * 0.14;
    }
    // two books standing on end beside the stack
    this._box(disp, 0.05, 0.27, 0.2, new THREE.MeshStandardMaterial({ color: 0x8a3b2c, roughness: 0.8 }), -0.42, 0.905, 0.02);
    this._box(disp, 0.05, 0.25, 0.2, new THREE.MeshStandardMaterial({ color: 0x2c3a6a, roughness: 0.8 }), -0.35, 0.895, 0.02);
    // a couple more lying flat on the lower shelf
    this._box(disp, 0.3, 0.05, 0.22, new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 }), -0.6, 0.325, 0.0);
    this._box(disp, 0.3, 0.05, 0.22, new THREE.MeshStandardMaterial({ color: 0x1f3550, roughness: 0.8 }), -0.6, 0.375, 0.0);

    // ---- awards ----
    const mkTrophy = (x, z, s) => {
      const t = new THREE.Group();
      this._box(t, 0.14 * s, 0.04, 0.14 * s, this.m.woodDark, 0, 0.02, 0);            // plinth
      this._cyl(t, 0.02 * s, 0.045 * s, 0.12 * s, this.m.brass, 0, 0.1 * s, 0, 12);   // stem
      this._cyl(t, 0.075 * s, 0.03 * s, 0.13 * s, this.m.brass, 0, 0.21 * s, 0, 18);  // cup
      t.position.set(x, 0.77, z); disp.add(t);
    };
    mkTrophy(0.28, -0.02, 1.0);
    mkTrophy(0.62, 0.04, 0.8);
    // a standing engraved plaque
    const plaque = new THREE.Group();
    this._box(plaque, 0.28, 0.22, 0.02, this.m.woodDark, 0, 0.11, 0);
    this._box(plaque, 0.21, 0.15, 0.012, this.m.brass, 0, 0.12, 0.014);
    plaque.position.set(1.0, 0.77, -0.02); plaque.rotation.y = -0.18; disp.add(plaque);

    this.level.add(disp);
    this._static(-3.5, this.FRONT - 0.6, 1.3, 0.31, 0.8);

    // ---- paintings: two over the display table, one on the right wall ----
    this._painting(-4.7, 2.45, this.FRONT - 0.05, 1.05, 0.78, Math.PI, 1);
    this._painting(-2.3, 2.45, this.FRONT - 0.05, 1.05, 0.78, Math.PI, 2);
    this._painting(this.RIGHT - 0.05, 2.3, 1.5, 1.15, 0.85, -Math.PI / 2, 3); 
  }

  // a framed landscape painting; rotY turns the canvas to face into the room
  _painting(x, y, z, w, h, rotY, seed) {
    const g = new THREE.Group();
    this._box(g, w + 0.12, h + 0.12, 0.06, this.m.woodDark, 0, 0, 0);   // frame
    const tex = canvasTex(256, 192, (c, cw, ch) => {
      const sky = c.createLinearGradient(0, 0, 0, ch * 0.62);
      sky.addColorStop(0, '#22344f'); sky.addColorStop(1, '#8494aa');
      c.fillStyle = sky; c.fillRect(0, 0, cw, ch * 0.62);
      c.fillStyle = 'rgba(244,238,206,0.9)';
      c.beginPath(); c.arc(cw * (0.28 + seed * 0.14), ch * 0.24, 16, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2b3a26';
      c.beginPath(); c.moveTo(0, ch * 0.62);
      for (let i = 0; i <= 10; i++) c.lineTo(i * cw / 10, ch * 0.62 - Math.sin(i * 0.7 + seed) * 16 - 4);
      c.lineTo(cw, ch); c.lineTo(0, ch); c.closePath(); c.fill();
      c.fillStyle = '#1d291a';
      c.beginPath(); c.moveTo(0, ch * 0.8);
      for (let i = 0; i <= 10; i++) c.lineTo(i * cw / 10, ch * 0.8 - Math.sin(i * 0.5 + seed * 2) * 12);
      c.lineTo(cw, ch); c.lineTo(0, ch); c.closePath(); c.fill();
    });
    const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    art.position.z = 0.035; g.add(art);
    g.position.set(x, y, z); g.rotation.y = rotY;
    this.level.add(g);
    return g;
  }

  // =========================================================
  // EVIDENCE MARKERS — numbered tents placed at each exhibit.
  // (The old white chalk body-outline was removed: around the
  //  body we now keep only the body, the blood and the casing.)
  // =========================================================
  _buildEvidenceMarkers() {
    // evidence tents (1 - 5) scattered at the clue positions
    const tentMat = new THREE.MeshStandardMaterial({ color: 0xf2eaf0, roughness: 0.7, side: THREE.DoubleSide });
    this._tent = (x, z, n) => {
      const g = new THREE.Group();
      const a = this._box(g, 0.11, 0.16, 0.012, tentMat, 0, 0.08, 0.03); a.rotation.x = -0.32;
      const b = this._box(g, 0.11, 0.16, 0.012, tentMat, 0, 0.08, -0.03); b.rotation.x = 0.32;
      const t = canvasTex(64, 64, (c) => {
        c.clearRect(0, 0, 64, 64);
        c.fillStyle = '#141414'; c.font = 'bold 44px sans-serif'; c.textAlign = 'center';
        c.fillText(String(n), 32, 48);
      }, { alpha: true });
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
      lab.position.set(0, 0.085, 0.038); g.add(lab);
      g.position.set(x, 0, z);
      this.level.add(g);
      return g;
    };
    this._tent(-2.35, -2.72, 1);   // casing
    this._tent(-1.6, -5.2, 2);     // glasses
    this._tent(1.05, -0.85, 3);    // hair fibres (guest chair)
    this._tent(3.3, -2.85, 4);     // handkerchief
    this._tent(-4.25, -4.35, 5);   // phone
  }

  // =========================================================
  // THE BODY — Dr. Thabo Nkosi, single entry wound, left chest
  // Now the rigged characters/professor.glb model (laid on his back over the
  // blood pool) instead of the old segment-by-segment primitive build.
  // =========================================================
  _buildBody() {
    const g = new THREE.Group();
    this.bodyGroup = g;
    // ---- place him: on the floor in front of the desk, half turned ----
    g.position.set(-1.45, 0, -2.35);
    g.rotation.y = -0.5;
    this.level.add(g);

    // The lay-down lives on this PARENT group, never on the FBX object itself:
    // the embedded clip drives the object's own transform, so tipping the object
    // directly just lets the animation stand him back up. A parent the mixer can
    // never see keeps him flat while the animation plays inside him.
    //   rotation.x -> tips him flat (head toward -z)
    //   rotation.z -> rolls him about his long axis (face down vs face up)

    // ---- the victim, Dr. Thabo Nkosi, loaded from characters/professor.glb ----
    //      Shadows are enabled in the callback because the constructor's shadow
    //      pass has already run by the time this async load lands.
const lay = new THREE.Group();   // no rotation any more
g.add(lay);

Promise.all([
  new GLTFLoader().loadAsync(professorURL),
  fetch(professorPoseURL).then((r) => r.json()),
]).then(([gltf, pose]) => {
  const object = gltf.scene;
  object.animations = [THREE.AnimationClip.parse(pose)];   // his lying-down pose
  object.scale.setScalar(0.01);
  object.traverse((o) => {
    if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; }
  });
  lay.add(object);

  const clips = object.animations || [];
  console.log('[lvl1] professor clips:',
    clips.map((c) => `${c.name} (${c.duration.toFixed(2)}s)`));

  if (clips.length) {
    // pick the longest clip in case the file also holds a 0-second T-pose clip
    const clip = clips.reduce((a, b) => (b.duration > a.duration ? b : a));
    this.mixer = new THREE.AnimationMixer(object);
    const action = this.mixer.clipAction(clip);
    action.play();
    action.time = clip.duration;   // jump to the final, lying-down frame
    action.paused = true;          // and hold it there
    this.mixer.update(0);          // apply that pose now
  }

  // Cull skinned meshes against the final lying pose, not the FBX bind pose.
  g.updateMatrixWorld(true);
  object.traverse(o => { if (o.isSkinnedMesh) o.computeBoundingSphere(); });

  // measure the LYING pose, then centre over the blood pool
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  const cen = box.getCenter(new THREE.Vector3());
  g.position.x += -1.45 - cen.x;
  g.position.z += -2.35 - cen.z;
  g.position.y += -box.min.y;
}).catch((err) => console.error('Error loading professor model:', err));

    // ---- pooled blood under the chest + a hand print ----
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.42, 28),
      new THREE.MeshStandardMaterial({ color: 0x3d0a0a, roughness: 0.22, transparent: true, opacity: 0.92, polygonOffset: true, polygonOffsetFactor: -2 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(-1.28, 0.016, -2.2); pool.scale.set(1, 1.35, 1);
    pool.rotation.z = 0.4; pool.userData.noShadow = true; this.level.add(pool);
    for (let i = 0; i < 14; i++) {
      const a = rng() * 6.28, r = 0.3 + rng() * 0.55;
      const blob = new THREE.Mesh(new THREE.CircleGeometry(0.03 + rng() * 0.07, 12), this.m.bloodDark);
      blob.rotation.x = -Math.PI / 2;
      blob.position.set(-1.28 + Math.cos(a) * r, 0.014, -2.2 + Math.sin(a) * r);
      blob.userData.noShadow = true; this.level.add(blob);
    }
    // a smear where the left hand dragged
    const smear = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x3a0c0c, roughness: 0.4, transparent: true, opacity: 0.75 }));
    smear.rotation.x = -Math.PI / 2; smear.rotation.z = -0.6;
    smear.position.set(-1.9, 0.015, -1.95); smear.userData.noShadow = true; this.level.add(smear);

    // the body is solid and blocks the examine ray
    this._static(-1.45, -2.3, 0.62, 0.95, 0.45);

    // body is examinable (not a collectable clue)
    this.bodyHit = this._ghost(this.level, 1.3, 0.5, 1.9, -1.45, 0.25, -2.35);
    this.bodyHit.userData.body = true;
  }

  // =========================================================
  // CLUES
  // =========================================================
  // Auras were removed: this is a working scene, not a treasure hunt. Clues
  // are found by looking. The dummy keeps every old reference safe.
  _addAura(pos, r, color) {
    return {
      visible: false, position: pos.clone ? pos.clone() : new THREE.Vector3(),
      material: { uniforms: { uFocus: { value: 0 } } },
    };
  }

  _addClue(id, group, hitSize, pos, auraR, opts = {}) {
    const hit = this._ghost(this.level, hitSize[0], hitSize[1], hitSize[2], pos.x, pos.y, pos.z);
    const clue = {
      id, def: CASE.clues[id], group, hit, pos: pos.clone(),
      uv: !!opts.uv, lit: true, found: false, photo: false,
      tool: CLUE_TOOL[id] || 'bag',
      onCollect: opts.onCollect || null,
      // `follow` clues sit on a pushable object, so their hit box and aura
      // have to track the object's world position every frame
      follow: opts.follow || null,
      aura: this._addAura(pos, auraR, opts.uv ? 0x9a6aff : 0xffd27a),
    };
    hit.userData.clue = clue;
    this.clues.push(clue);
    return clue;
  }

  _uvMesh(tex, w, h, pos, rotZ, tint) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: UV_VERT, fragmentShader: UV_FRAG,
      uniforms: {
        uTime: this.uv.uTime, uUvOn: this.uv.uUvOn, uUvCos: this.uv.uUvCos,
        uUvPos: this.uv.uUvPos, uUvDir: this.uv.uUvDir,
        uMap: { value: tex }, uTint: { value: new THREE.Color(tint || 0xff5a7a) },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    if (!this._uvMats) this._uvMats = [];
    this._uvMats.push(mat);
    const geo = new THREE.PlaneGeometry(w, h); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    if (rotZ) m.rotation.y = rotZ;
    m.userData.noShadow = true;
    this.level.add(m);
    return m;
  }

  _buildClues() {
    // ---- 1. bullet casing under the reach of his right hand ----
    // (scaled ~5x life size — a real 9mm casing is invisible at room scale,
    //  and the glow aura has to have something to sit around)
    {
      const g = new THREE.Group();
      const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.16, 14), this.m.brass);
      casing.rotation.z = Math.PI / 2 - 0.2; casing.position.set(0, 0.052, 0); g.add(casing);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.024, 14), this.m.brass);
      rim.rotation.z = Math.PI / 2 - 0.2; rim.position.set(-0.078, 0.052, 0.008); g.add(rim);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.3, metalness: 0.8 }));
      tip.position.set(0.086, 0.052, -0.01); tip.scale.set(0.7, 1, 1); g.add(tip);
      g.position.set(-2.02, 0, -3.0);
      g.rotation.y = 0.9;
      g.scale.setScalar(0.5); 
      this.level.add(g);
      this._addClue('casing', g, [0.3, 0.2, 0.3], new THREE.Vector3(-2.02, 0.08, -3.0), 0.17,
        { onCollect: () => { g.visible = false; } });
    }

    // ---- 2. two whiskey glasses (his on the desk, the guest's beside it) ----
    {
      const g = new THREE.Group();
      const tumbler = (x, y, z, fill, tipped) => {
        const c = new THREE.Group();
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.032, 0.095, 18, 1, true),
          new THREE.MeshPhysicalMaterial({
            color: 0xe8f0f6, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.4,
            side: THREE.DoubleSide, transmission: 0.7, thickness: 0.3,
          }));
        w.position.y = 0.048; c.add(w);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.008, 18), this.m.glass);
        base.position.y = 0.004; c.add(base);
        if (fill > 0) {
          const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.031, 0.03 * fill, 16), this.m.whiskey);
          liq.position.y = 0.008 + 0.015 * fill; c.add(liq);
        }
        c.position.set(x, y, z);
        if (tipped) { c.rotation.z = 1.45; c.rotation.y = 0.5; c.position.y = y + 0.03; }
        g.add(c); return c;
      };
      // the victim's, on the desk, still a finger left
      tumbler(-1.85, 0.8, -4.95, 1, false);
      // the guest's, on the side cabinet, half drunk and dried
      const guest = tumbler(7.72, 0.91, -6.15, 0, false);
      guest.scale.setScalar(1.05);
      this.level.add(g);
      this._addClue('glass', g, [0.5, 0.45, 0.5], new THREE.Vector3(-1.85, 0.92, -4.95), 0.22,
        { onCollect: () => { g.visible = false; } });
    }

    // ---- 3. brown hair fibres on the guest chair (deliberately easy to spot) ----
    {
      const g = new THREE.Group();
      const hairMat = new THREE.MeshStandardMaterial({
        color: 0x4a2a12, roughness: 0.35, emissive: 0x2c1708, emissiveIntensity: 0.7,
      });
      // several long, thick strands fanned across the seat + over the front edge
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const spread = 0.12 + rng() * 0.05;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(a) * spread, 0, Math.sin(a) * spread - 0.02),
          new THREE.Vector3(Math.cos(a) * spread * 0.3, 0.03 * (i % 2 ? 1 : -1), 0.05),
          new THREE.Vector3(-Math.cos(a) * spread * 0.6, 0.01, -0.04),
          new THREE.Vector3(-Math.cos(a) * spread, 0.014, Math.sin(a) * spread * 0.5 + 0.07),
        ]);
        const strand = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.013, 6, false), hairMat);
        strand.rotation.y = rng() * 6.28;
        strand.userData.noShadow = true;
        g.add(strand);
      }
      // anchored to the guest chair seat so it moves with it
      g.scale.setScalar(0.5);
      g.position.set(0, 0.535, 0.02);
      this.guestChair.group.add(g);
      this._addClue('hair', g, [0.9, 0.5, 0.9],
        new THREE.Vector3(1.5, 0.58, -1.4), 0.36,
        { follow: this.guestChair.group, onCollect: () => { g.visible = false; } });
    }

    // ---- 4. monogrammed handkerchief, stiff with dried blood ----
    {
      const tex = canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = '#ece7dc'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(190,185,175,${rng() * 0.5})`; g.fillRect(rng() * w, rng() * h, 3, 2); }
        g.strokeStyle = '#b9b2a4'; g.lineWidth = 2;
        for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, i * 44 + 10); g.lineTo(w, i * 44 + 14); g.stroke(); }
        g.fillStyle = '#7d1414'; g.beginPath(); g.ellipse(w * 0.72, h * 0.78, 52, 40, 0.4, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#4c0c0c'; g.beginPath(); g.ellipse(w * 0.74, h * 0.8, 26, 20, 0.2, 0, Math.PI * 2); g.fill();
        // Stitched with THIS run's killer's initials (it used to say K.P. every time),
        // with the first letter soaked out by blood: the player must find it elsewhere.
        const mono = killerOf(getCase()).initials;
        g.font = 'italic bold 34px serif';
        g.strokeStyle = '#6a6458'; g.lineWidth = 4;
        g.strokeText(mono, 18, 46); g.fillStyle = '#3a352c';
        g.fillText(mono, 18, 46);
        g.fillStyle = '#6e1212'; g.beginPath(); g.ellipse(30, 34, 22, 20, 0.3, 0, Math.PI * 2); g.fill();
      });
      const cloth = new THREE.Group();
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.3),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide }));
      plane.rotation.x = -Math.PI / 2; plane.rotation.z = 0.7;
      plane.position.y = 0.012; cloth.add(plane);
      // fold it into a rumpled triangle
      const fold = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.16),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide }));
      fold.rotation.x = -Math.PI / 2; fold.rotation.z = -0.4; fold.position.set(0.05, 0.02, -0.03);
      cloth.add(fold);
      cloth.position.set(2.95, 0, -3.15);
      this.level.add(cloth);
      this._addClue('handkerchief', cloth, [0.44, 0.16, 0.44], new THREE.Vector3(2.95, 0.06, -3.15), 0.17,
        { onCollect: () => { cloth.visible = false; } });
    }

    // ---- 5. his phone on the desk, last message still on screen ----
    {
      const screenTex = canvasTex(224, 448, (g, w, h) => {
        g.fillStyle = '#0b0f16'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#1a2230'; g.fillRect(0, 0, w, 44);
        g.fillStyle = '#fff'; g.font = 'bold 18px sans-serif'; g.fillText('Unknown', 12, 29);
        const msgs = [
          { me: false, t: '22:48', s: 'Exam scripts. Your office, tonight.' },
          { me: true, t: '23:19', s: 'Just locked up the Staff Common Room. Heading to my office.' },
          { me: false, t: '23:31', s: 'Coming up the back stairs. Tell no one.' },
        ];
        let y = 60; g.font = '14px sans-serif';
        for (const m of msgs) {
          const lines = wrapText(g, m.s, 150); const bh = lines.length * 18 + 26, bw = 172;
          const x = m.me ? w - 10 - bw : 10;
          g.fillStyle = m.me ? '#2563eb' : '#2a3140'; g.fillRect(x, y, bw, bh);
          g.fillStyle = '#fff'; lines.forEach((l, i) => g.fillText(l, x + 8, y + 18 + i * 18));
          g.fillStyle = 'rgba(255,255,255,0.55)'; g.font = '10px sans-serif'; g.fillText(m.t, x + 8, y + bh - 6); g.font = '14px sans-serif';
          y += bh + 10;
        }
        g.fillStyle = '#7a1f1f'; g.font = 'bold 13px sans-serif'; g.fillText('MISSED CALLS: 3  (23:36, 23:41, 23:44)', 10, h - 14);
      });
      const g = new THREE.Group(); g.position.set(-3.75, 0.82, -4.75); g.rotation.y = -0.5;
      this._box(g, 0.1, 0.016, 0.2, new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.3 }), 0, 0, 0);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.088, 0.176), new THREE.MeshBasicMaterial({ map: screenTex }));
      screen.rotation.x = -Math.PI / 2; screen.position.y = 0.009; screen.userData.noShadow = true; g.add(screen);
      this.level.add(g);
      const pl = new THREE.PointLight(0x7aa8ff, 0.9, 2.8, 2); pl.position.set(-3.75, 0.98, -4.75); this.level.add(pl);
      this._addClue('phone', g, [0.4, 0.26, 0.4], new THREE.Vector3(-3.75, 0.9, -4.75), 0.19,
        { onCollect: () => { g.visible = false; } });
    }

    // ---- 6. wiped blood trail + a dying scrawl — UV ONLY (shader reveal) ----
    {
      const printTex = canvasTex(64, 128, (g, w, h) => {
        g.fillStyle = '#fff';
        g.beginPath(); g.ellipse(32, 42, 20, 36, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(32, 102, 14, 20, 0, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 6; i++) g.fillRect(14, 16 + i * 10, 36, 2);
      });
      // the trail runs from the guest chair straight out through the door
      // (the door sits on the back wall at x = 7, z = -D/2)
      const start = new THREE.Vector2(1.7, -1.75), mid = new THREE.Vector2(4.3, -4.3), end = new THREE.Vector2(6.6, -6.6);
      const seg = (a, b, n, offset) => {
        const dir = b.clone().sub(a).normalize();
        const perp = new THREE.Vector2(-dir.y, dir.x);
        for (let i = 0; i < n; i++) {
          const p = a.clone().lerp(b, i / (n - 1)).addScaledVector(perp, (i % 2 ? 1 : -1) * 0.13);
          const m = this._uvMesh(printTex, 0.15, 0.32, new THREE.Vector3(p.x, 0.022, p.y),
            Math.atan2(-dir.x, -dir.y), 0xff4a6a);
          m.scale.x = i % 2 ? 1 : -1;
          if (offset) m.position.add(offset);
        }
      };
      seg(start, mid, 5);
      seg(mid, end, 6);
      // drag smear where the bloody hand wiped the sill on the way out
      const smearTex = canvasTex(256, 64, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        for (let i = 0; i < 220; i++) {
          g.fillStyle = `rgba(255,255,255,${0.15 + rng() * 0.4})`;
          g.fillRect(rng() * w, h * 0.2 + rng() * h * 0.6, 6 + rng() * 22, 1 + rng() * 3);
        }
      });
      this._uvMesh(smearTex, 1.1, 0.3, new THREE.Vector3(6.0, 0.024, -6.1), 0.8);

      // the dying scrawl: a letter dragged on its side beside his hand
      const scrawlTex = canvasTex(256, 256, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.strokeStyle = '#fff'; g.lineWidth = 22; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(60, 60); g.lineTo(150, 190); g.lineTo(60, 200);      // a wobbly "K"
        g.moveTo(150, 70); g.lineTo(70, 170);
        g.stroke();
        g.globalAlpha = 0.5; g.lineWidth = 8;
        for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(50 + rng() * 130, 40 + rng() * 170); g.lineTo(60 + rng() * 130, 50 + rng() * 170); g.stroke(); }
      });
      this._uvMesh(scrawlTex, 0.7, 0.7, new THREE.Vector3(-0.85, 0.026, -1.5), -0.6);

      const dummy = new THREE.Group();   // the trail stays visible once found
      this._addClue('trail', dummy, [0.7, 0.16, 0.7], new THREE.Vector3(4.3, 0.08, -4.3), 0.36, { uv: true });
    }
  }

  // ================= SCENE CAMERA =================
  // [Q] raise, wheel zoom, click shoot. Photograph every clue BEFORE lifting
  // it — the lift is refused without a sharp photo on film. The UV trail is
  // collected by its photograph (taken with the torch on).
  _buildCamera() {
    this.photoCam = new PhotoCamera({
      scene: this.scene,
      renderer: this.renderer,
      opts: { film: 12, maxDist: 14, lockDist: 5 },
      getTargets: () => this.clues.filter((c) => !c.found).map((c) => ({
        id: c.id, name: c.def.name, kind: 'evidence', radius: 0.35,
        getPos: (v) => v.copy(c.pos).add(new THREE.Vector3(0, 0.15, 0)),
      })),
      getColliders: () => this.colliders,
      isBlocked: () => !!(window.__uiCapture || this.caseOpen || this.outroOpen),
      clockLabel: () => `23:${String(40 + Math.floor(this.time / 60)).padStart(2, '0')}`,
      onPhoto: (photo) => this._onPhoto(photo),
    });
    if (!this.renderer) console.warn('StreetLevel: no renderer was passed, photos will be blank');
  }
  _onPhoto(photo) {
    const sharp = photo.subjects.filter((s) => s.sharp);
    if (!sharp.length) {
      try { getStats().wastedFilm++; } catch (e) {}
      sfx('wrong');
      this._toast('NOTHING SHARP ON FILM', 'Get closer, centre the exhibit, zoom if you need it. Blanks cost film.', 4000);
      this._updateCounter();
      return;
    }
    sfx('collect');
    for (const s of sharp) {
      const c = this.clues.find((x) => x.id === s.id);
      if (!c || c.photo) continue;
      if (c.id === 'trail' && this.uv.uUvOn.value < 0.35) {
        this._toast('DARK FRAME', 'The film shows bare floorboards. The trail only exists under the UV lamp — [F], then shoot.', 6000);
        continue;
      }
      c.photo = true;
      if (c.id === 'trail') {
        this._toast('TRAIL ON FILM', 'The wiped smear and the scrawled letter are fixed on film. That photograph IS the lift.', 7000);
        this._collect(c);
      } else {
        this.tool = c.tool;   // the belt auto-selects the right instrument; switch by hand and you own the mistake
        this._toast(`ON FILM — ${c.def.name.toUpperCase()}`, `Belt switched to ${TOOLS[c.tool]}. Lift it with [E]. (Change tools by hand and a wrong one contaminates.)`, 6000);
        this._idle = 0;
      }
    }
    this._updateCounter();
  }

  // (The first-person hand/torch rig was removed: this game defines no player
  //  body — no hands, torso or legs. The view is driven purely by the camera
  //  in _applyFirstPerson below.)

  // Take the host camera over if it is still being driven in third person.
  _applyFirstPerson(player) {
    const cam = window.__camera;
    if (!cam || !player || !player.pos) return;
    // If a third-person rig is snapping the camera behind the avatar, we move
    // it back to eye height and orient it by the player's yaw/pitch.
    cam.position.set(player.pos.x, (player.pos.y || 0) + EYE, player.pos.z);
    const yaw = player.yaw || 0, pitch = player.pitch || 0;
    cam.rotation.order = 'YXZ';
    cam.rotation.set(pitch, yaw, 0);
    if (cam.near > 0.08 || cam.near < 0.001) { cam.near = 0.05; cam.updateProjectionMatrix(); }
  }

  // (_updateHands removed — there is no hand rig to animate.)

  // =========================================================
  // UI (DOM)
  // =========================================================
  _buildUI() {
    const mk = (tag, css, parent, html) => {
      const e = document.createElement(tag); e.style.cssText = css;
      if (html !== undefined) e.innerHTML = html;
      (parent || document.body).appendChild(e); return e;
    };
    const ui = this.ui = {};
    ui.root = mk('div', 'position:fixed;inset:0;pointer-events:none;z-index:50;font-family:"Courier New",monospace;color:#f2d9a0;');
    // vignette — sells the "inside someone else's head" feel
    mk('div', 'position:fixed;inset:0;pointer-events:none;z-index:40;background:radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 42%, rgba(0,0,0,.55) 100%);', ui.root);
    // feedback flash — brief red/green wash on right/wrong deductions
    ui.flash = mk('div', 'position:fixed;inset:0;pointer-events:none;z-index:41;opacity:0;', ui.root);
    ui.cross = mk('div', 'position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:rgba(255,235,190,.6);box-shadow:0 0 6px rgba(0,0,0,.8);transition:all .12s;', ui.root);
    ui.counter = mk('div', 'position:absolute;left:18px;top:16px;font-size:15px;letter-spacing:2px;text-shadow:0 0 8px #000;', ui.root);
    ui.objective = mk('div', 'position:absolute;left:18px;top:38px;font-size:11px;letter-spacing:1px;opacity:.65;text-shadow:0 0 8px #000;', ui.root, 'DR. T. NKOSI — DEAD, SINGLE GUNSHOT WOUND');
    ui.quest = mk('div', 'position:absolute;left:18px;top:64px;font-size:12px;line-height:1.7;letter-spacing:1px;text-shadow:0 0 8px #000;max-width:360px;', ui.root);
    ui.hint = mk('div', 'position:absolute;left:18px;bottom:14px;font-size:12px;opacity:.7;text-shadow:0 0 6px #000;', ui.root,
      '[1] bags &nbsp; [2] tweezers &nbsp; [3] swab &nbsp; [Q] camera &nbsp; [E] collect &nbsp; [F] UV &nbsp; [C] file');
    ui.prompt = mk('div', 'position:absolute;left:50%;top:56%;transform:translateX(-50%);font-size:16px;padding:6px 14px;background:rgba(0,0,0,.55);border:1px solid rgba(242,217,160,.45);display:none;text-shadow:0 0 6px #000;', ui.root);
    ui.toast = mk('div', 'position:absolute;left:50%;bottom:11%;transform:translateX(-50%);width:min(640px,88vw);padding:12px 16px;background:rgba(8,8,12,.82);border-left:3px solid #f2b84b;font-size:14px;line-height:1.45;display:none;', ui.root);
    ui.uvTag = mk('div', 'position:absolute;right:18px;top:224px;font-size:13px;letter-spacing:2px;color:#b58cff;display:none;text-shadow:0 0 10px #7a3cff;', ui.root, 'UV LAMP ON');

    ui.case = mk('div', 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(3,4,7,.9);z-index:9999;font-family:"Courier New",monospace;');
    ui.outro = mk('div', 'position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:radial-gradient(ellipse at 50% 45%, rgba(8,10,16,.96), rgba(2,3,5,.99));z-index:10000;font-family:"Courier New",monospace;color:#e9d9b0;pointer-events:auto;');
    this._updateCounter();
  }

  _updateCounter() {
    const n = this.clues.filter((c) => c.found).length;
    const film = this.photoCam ? `  ·  FILM ${this.photoCam.film}` : '';
    this.ui.counter.textContent = `EVIDENCE  ${n} / ${this.clues.length}  ·  ${TOOLS[this.tool]}${film}`;
    this._updateQuest();
  }

  _toast(title, text, ms = 9000) {
    const t = this.ui.toast;
    t.innerHTML = `<div style="font-weight:bold;letter-spacing:2px;color:#f2b84b;margin-bottom:4px">${title}</div>${text}`;
    t.style.display = 'block';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.style.display = 'none'; }, ms);
  }

  _openCaseFile() {
    this.caseOpen = true;
    if (document.exitPointerLock) document.exitPointerLock();
    this.ui.prompt.style.display = 'none';
    const found = this.clues.filter(c => c.found).length;
    const done = found === this.clues.length;
    const rows = this.clues.map(c => c.found
      ? `<div style="margin:14px 0"><b>&#10003; ${c.def.name}</b><p style="margin:4px 0;line-height:1.6">${c.def.note}</p><small>Logged — awaiting lab examination</small></div>`
      : '<div style="margin:14px 0;opacity:.6">&#9633; Exhibit not yet collected</div>').join('');
    this.ui.case.innerHTML = `
      <div class="game-sheet" style="width:min(820px,92vw);max-height:88vh;overflow:auto;box-sizing:border-box">
        <div style="font-size:12px;letter-spacing:2px">CASE FILE #001 — ${found}/${this.clues.length} EXHIBITS LOGGED</div>
        <h2>${CASE.victim}</h2>
        <p>${CASE.role} · ${CASE.found}</p>
        <h3>DETECTIVE’S FIELD NOTES</h3>
        <p>Collect and preserve the evidence. The lab examinations come next.</p>
        ${rows}
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:24px">
          <button id="cf-close" style="font:inherit;padding:10px 18px;cursor:pointer">Back to the room [C]</button>
          ${done ? '<button id="cf-go" style="font:inherit;padding:10px 18px;background:#a1241c;color:#fff;border:0;cursor:pointer">Seal evidence for the station &rarr;</button>' : ''}
        </div>
      </div>`;
    this.ui.case.style.display = 'flex';
    this.ui.case.querySelector('#cf-close').addEventListener('click', () => this._closeCaseFile());
    this.ui.case.querySelector('#cf-go')?.addEventListener('click', () => {
      this._closeCaseFile();
      this._openOutro();
    });
  }

  _flash(color) {
    const f = this.ui.flash;
    if (!f) return;
    f.style.transition = 'none';
    f.style.background = color;
    f.style.opacity = '0.32';
    requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = '0'; });
  }

  _closeCaseFile() {
    this.caseOpen = false;
    this.ui.case.style.display = 'none';
  }

  // End-of-level cutscene: the investigator logs the evidence, takes it to the
  // police station for hands-on lab work -> Level 2.
  _openOutro() {
    if (this.outroOpen) return;
    this.outroOpen = true;
    if (this.caseOpen) this._closeCaseFile();
    if (document.exitPointerLock) document.exitPointerLock();
    if (this.ui.prompt) this.ui.prompt.style.display = 'none';

    const lines = CASE.outro.map((p, i) =>
      `<p style="max-width:min(760px,88vw);margin:0 auto 22px;font-size:18px;line-height:1.6;opacity:0;transform:translateY(10px);animation:outroFade .9s ${(i * 1.2).toFixed(2)}s forwards">${p}</p>`
    ).join('');

    this.ui.outro.innerHTML = `
      <style>@keyframes outroFade{to{opacity:.93;transform:none;}}</style>
      <div style="position:absolute;top:30px;left:0;right:0;letter-spacing:5px;font-size:12px;color:#f2b84b;opacity:.8">
        CASE FILE #001 — EVIDENCE LOGGED
      </div>
      <div style="display:flex;flex-direction:column;justify-content:center">${lines}</div>
      <div style="position:absolute;bottom:9%;left:0;right:0">
        <button id="outro-continue" style="font:inherit;letter-spacing:1px;padding:12px 28px;background:#a1241c;color:#fff;border:0;cursor:pointer;opacity:0;animation:outroFade .7s ${(CASE.outro.length * 1.2).toFixed(2)}s forwards">Seal the evidence for Central Police Station &rarr;</button>
      </div>`;
    this.ui.outro.style.display = 'flex';

    const btn = this.ui.outro.querySelector('#outro-continue');
    if (btn) btn.addEventListener('click', () => this._showLabScreen());
  }

  // Second outro stage: the screen cuts to black while the evidence goes to
  // the station, then offers the next-morning arrival (Level 2).
  _showLabScreen() {
    this.ui.outro.innerHTML = `
      <style>@keyframes labFadeIn{from{opacity:0}to{opacity:1}}</style>
      <div style="position:absolute;inset:0;background:#000;animation:labFadeIn 1.4s forwards"></div>
      <div style="position:relative;max-width:min(720px,88vw);font-size:15px;letter-spacing:4px;color:#f2b84b;opacity:0;animation:labFadeIn 1.2s 1.6s forwards">
        NEXT MORNING — CENTRAL POLICE STATION
      </div>
      <p style="position:relative;max-width:min(680px,86vw);margin:26px auto 0;font-size:19px;line-height:1.7;color:#d7dde8;opacity:0;animation:labFadeIn 1.4s 2.4s forwards">
        The room is sealed and the exhibits are packed. Take them to Central Police Station, greet reception and head to the lab. You will examine the evidence there before taking the completed file to Captain Mabaso.
      </p>
      <div style="position:relative;margin-top:48px;opacity:0;animation:labFadeIn 1s 4s forwards">
        <button id="outro-city" style="font:inherit;letter-spacing:1px;padding:12px 28px;background:#1f6f5c;color:#fff;border:0;cursor:pointer">Travel to Central Police Station — Level 2 &rarr;</button>
      </div>`;

    const btn = this.ui.outro.querySelector('#outro-city');
    if (btn) btn.addEventListener('click', () => {
      if (typeof window.__switchLevel === 'function') window.__switchLevel(CASE.nextLevel);
      else { this.ui.outro.style.display = 'none'; this.outroOpen = false; }
    });
  }

  // =========================================================
  // GUIDANCE — evidence collection HUD + idle nudges
  // =========================================================
  _updateQuest() {
    if (!this.ui?.quest) return;
    const found = this.clues.filter(c => c.found).length;
    const next = found === this.clues.length
      ? 'All exhibits logged. Open [C] and seal the evidence for the station lab.'
      : 'Photograph [Q + click], lower camera [Q], then collect [E]. Use [F] to find traces under UV.';
    this.ui.quest.innerHTML = `<b>SECURE THE OFFICE — ${found}/${this.clues.length}</b><p>${next}</p><span style="opacity:.7">Preserve the evidence. Find the answers in the lab.</span>`;
  }

  _hint() {
    const c = this.clues.find((x) => !x.found && !x.photo) || this.clues.find((x) => !x.found);
    if (!c) return;
    const msg = c.photo
      ? `You already have the ${c.def.name} on film — lift it with ${TOOLS[c.tool]} ([E]).`
      : (CLUE_HINT[c.id] || 'Something in this room still has not been looked at.');
    this._toast('DETECTIVE\'S INSTINCT', msg, 7000);
  }

  // =========================================================
  // INPUT
  // =========================================================
  _handleKey(e) {
    if (window.__loading || window.__paused) return;
    if (e.repeat) return;
    if (this.outroOpen) return;
    if (e.code === 'KeyC') { this.caseOpen ? this._closeCaseFile() : this._openCaseFile(); return; }
    if (this.caseOpen) return;
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
      this.tool = { Digit1: 'bag', Digit2: 'tweezers', Digit3: 'swab' }[e.code];
      sfx('collect');
      this._updateCounter();
      this._toast('TOOL BELT', `Holding ${TOOLS[this.tool]}. Casing, hair and note want tweezers; blood wants the swab; the rest bags.`, 3500);
      return;
    }
    if (e.code === 'KeyF') {
      this.uvOn = !this.uvOn;
      this.ui.uvTag.style.display = this.uvOn ? 'block' : 'none';
    } else if (e.code === 'KeyE') {
      if (this.focus) { this._reachT = 0; this._collect(this.focus); }
      else if (this.focusBody) { this._reachT = 0; this._toast('DR. T. NKOSI (DECEASED)', CASE.body.note, 11000); }
    }
  }

  _collect(c) {
    if (c.found) return;
    // Forensic order: photograph first, then the right instrument.
    if (!c.photo) {
      sfx('wrong');
      this._toast('PHOTOGRAPH FIRST', `Shoot the ${c.def.name} before you touch it — [Q] camera, close and centred. Unphotographed lifts don't hold up.`, 6000);
      return;
    }
    if (c.id !== 'trail' && this.tool !== c.tool) {
      try { getStats().contamination++; } catch (e) {}
      sfx('wrong');
      this._toast('WRONG TOOL — CONTAMINATION LOGGED', `The ${c.def.name} wants ${TOOLS[c.tool]}. You brought ${TOOLS[this.tool]}. Switch with [1] bags · [2] tweezers · [3] swab.`, 6000);
      return;
    }
    c.found = true;
    // remember across levels: the city case file shows what was really logged
    window.__caseProgress = window.__caseProgress || { l1: {} };
    window.__caseProgress.l1[c.id] = true;
    c.aura.visible = false;
    if (c.onCollect) c.onCollect();
    this.focus = null;
    this.ui.prompt.style.display = 'none';
    this._updateCounter();
    sfx('collect');
    this._toast(
      `EVIDENCE ${this.clues.filter((x) => x.found).length}/${this.clues.length} — ${c.def.name.toUpperCase()}`,
      `“${c.def.note}”`,
      11000);
    this._idle = 0;
    // Halfway through the room, the building reminds you you are not alone in it.
    if (!this._scared && this.clues.filter((x) => x.found).length >= 4) {
      this._scared = true; this._dark = 2.6; this._flashT = 0.45;
      clearTimeout(this._scareTimer);
      this._scareTimer = setTimeout(() => {
        if (this.ui) this._toast('FOOTSTEPS', 'Was that someone in the corridor? Stay focused. I still need to finish securing this room.', 9000);
      }, 1800);
    }
    // Six exhibits in: the dead man's phone lights up. Somebody is checking on him.
    if (!this._buzzed && this.clues.filter((x) => x.found).length >= 6) {
      this._buzzed = true;
      clearTimeout(this._buzzTimer);
      this._buzzTimer = setTimeout(() => {
        if (!this.ui) return;
        this._flash('rgba(120,140,255,.35)');
        sfx('wrong');
        this._toast('THE DEAD MAN\u2019S PHONE', 'Another vibration from the evidence bag. Hmm. I wonder who is trying to reach him. I will check the device properly at the lab.', 10000);
      }, 2500);
    }
    if (this.clues.every((x) => x.found)) {
      this.ui.objective.textContent = 'ALL EVIDENCE LOGGED — CLOSE THE ROOM [C]';
    }
  }

  // =========================================================
  // PHYSICS — pushable furniture
  // =========================================================
  _resolve(m, minX, maxX, minZ, maxZ) {
    const ox = Math.min(m.x + m.hx, maxX) - Math.max(m.x - m.hx, minX);
    const oz = Math.min(m.z + m.hz, maxZ) - Math.max(m.z - m.hz, minZ);
    if (ox <= 0 || oz <= 0) return null;
    if (ox < oz) {
      const s = m.x < (minX + maxX) / 2 ? -1 : 1;
      m.x += s * ox; m.vx = 0; return [s * ox, 0];
    }
    const s = m.z < (minZ + maxZ) / 2 ? -1 : 1;
    m.z += s * oz; m.vz = 0; return [0, s * oz];
  }

  _stepMovables(dt, player) {
    const px = player.pos.x, pz = player.pos.z;
    const damp = Math.exp(-4.5 * dt);
    for (const m of this.movables) {
      let pushed = false;

      // 1) player pushes the object (circle vs AABB)
      const cx = Math.max(m.x - m.hx, Math.min(px, m.x + m.hx));
      const cz = Math.max(m.z - m.hz, Math.min(pz, m.z + m.hz));
      let dx = px - cx, dz = pz - cz, d = Math.hypot(dx, dz), nx, nz, pen;
      if (d < PLAYER_R) {
        if (d > 1e-4) { nx = dx / d; nz = dz / d; pen = PLAYER_R - d; }
        else {
          dx = px - m.x; dz = pz - m.z; const dd = Math.hypot(dx, dz) || 1;
          nx = dx / dd; nz = dz / dd; pen = PLAYER_R + Math.min(m.hx, m.hz);
        }
        // light objects move fully, heavy ones resist (player is pushed back a bit)
        m.x -= nx * pen * m.ease; m.z -= nz * pen * m.ease;
        const slide = Math.min(2.5, (pen / Math.max(dt, 1e-3)) * 0.12 * m.ease);
        m.vx = -nx * slide; m.vz = -nz * slide;
        const back = pen * (1 - m.ease);
        if (back > 0) { player.pos.x += nx * back; player.pos.z += nz * back; }
        pushed = true;
      }

      // 2) integrate sliding + friction
      m.x += m.vx * dt; m.z += m.vz * dt;
      m.vx *= damp; m.vz *= damp;

      // 3) collide with walls / furniture / body / other movables
      let corrX = 0, corrZ = 0;
      for (const b of this.colliders) {
        const c = this._resolve(m, b.min.x, b.max.x, b.min.z, b.max.z);
        if (c) { corrX += c[0]; corrZ += c[1]; }
      }
      for (const o of this.movables) {
        if (o === m) continue;
        const c = this._resolve(m, o.x - o.hx, o.x + o.hx, o.z - o.hz, o.z + o.hz);
        if (c) { corrX += c[0]; corrZ += c[1]; }
      }
      // blocked while being pushed -> the player stops too
      if (pushed && (corrX || corrZ)) { player.pos.x += corrX; player.pos.z += corrZ; }

      m.group.position.set(m.x, 0, m.z);
    }
  }

  // =========================================================
  // VIEW (camera ray)
  // =========================================================
  _updateView(player) {
    const cam = window.__camera || (player && player.camera) || null;
    if (cam) {
      cam.getWorldPosition(this._o);
      cam.getWorldDirection(this._d);
      // the ray should start at the eyes, not inside the hand rig
      return true;
    }
    if (player && player.pos && typeof player.yaw === 'number') { // fallback if no camera is exposed
      const p = player.pitch || 0;
      this._o.set(player.pos.x, (player.pos.y || 0) + EYE, player.pos.z);
      this._d.set(-Math.sin(player.yaw) * Math.cos(p), Math.sin(p), -Math.cos(player.yaw) * Math.cos(p)).normalize();
      return true;
    }
    return false;
  }

  _inUV(pos) {
    if (this.uv.uUvOn.value < 0.35) return false;
    const v = this._v.copy(pos).sub(this._o);
    const dist = v.length();
    if (dist > 7) return false;
    return v.divideScalar(dist || 1).dot(this._d) > this.uv.uUvCos.value;
  }

  _updateFocus() {
    const list = [];
    for (const c of this.clues) {
      if (c.follow) {                       // keep chair-mounted evidence in sync
        c.follow.updateMatrixWorld();
        c.follow.getWorldPosition(this._v);
        c.hit.position.copy(this._v);
        c.aura.position.copy(this._v);
        c.pos.copy(this._v);
      }
      c.lit = c.uv ? this._inUV(c.pos) : true;
      c.aura.visible = !c.found && c.lit;
      c.aura.material.uniforms.uFocus.value = 0;
      if (!c.found && c.lit) list.push(c.hit);
    }
    list.push(this.bodyHit);
    for (const o of this.occluders) list.push(o);
    this._rc.set(this._o, this._d);
    this._rc.far = REACH;
    const hits = this._rc.intersectObjects(list, false);
    let hitObj = null;
    for (const h of hits) {
      const o = h.object;
      if (o.userData.clue || o.userData.body) { hitObj = o; break; }
      // the chair's own blocking box must not hide the clue sitting on it
      if (this.clues.some((c) => c.follow && !c.found && o.parent === c.follow)) continue;
      hitObj = o; break;
    }
    const clue = hitObj && hitObj.userData.clue ? hitObj.userData.clue : null;
    this.focus = clue;
    this.focusBody = !clue && !!(hitObj && hitObj.userData.body);
    if (clue) {
      if (!clue.photo) {
        this.ui.prompt.textContent = `[Q]  photograph the ${clue.def.name}`;
      } else if (clue.id === 'trail') {
        this.ui.prompt.textContent = `trail logged on film ✓`;
      } else if (this.tool !== clue.tool) {
        this.ui.prompt.textContent = `[E]  ${clue.def.name} — needs ${TOOLS[clue.tool]} (holding ${TOOLS[this.tool]})`;
      } else {
        this.ui.prompt.textContent = `[E]  lift the ${clue.def.name} (${TOOLS[clue.tool]})`;
      }
      this.ui.prompt.style.display = 'block';
      this.ui.cross.style.transform = 'scale(2)'; this.ui.cross.style.background = 'rgba(255,200,90,.95)';
    } else if (this.focusBody) {
      this.ui.prompt.textContent = '[E]  Examine the body';
      this.ui.prompt.style.display = 'block';
      this.ui.cross.style.transform = 'scale(2)'; this.ui.cross.style.background = 'rgba(255,150,150,.95)';
    } else {
      this.ui.prompt.style.display = 'none';
      this.ui.cross.style.transform = 'scale(1)'; this.ui.cross.style.background = 'rgba(255,235,190,.6)';
    }
  }

  // =========================================================
  // UPDATE — called every frame by the host as update(dt, t, player)
  // =========================================================
  update(deltaTime, t, player) {
    const dt = Math.min(deltaTime, 0.05);
    this.time += dt;
    this.uv.uTime.value = this.time;
    if (this.mixer) this.mixer.update(dt);   // advance the victim's FBX animation

    // ---- first-person camera (no visible hands / torch / feet) ----
    const hasCam = !!(window.__camera && window.__camera.isCamera);
    if (hasCam && player && player.pos) this._applyFirstPerson(player);
    // dim the desk-lamp shade a touch while the UV lamp is out, so the toggle reads
    if (this.lampShadeMat) this.lampShadeMat.emissiveIntensity = this.uvOn ? 0.9 : 1.8;

    // steady night lighting — no lightning, no flicker, no dropouts. The rain
    // still runs down the window panes, but the light level never changes.
    this.winMat.uniforms.uFlash.value = 0;

    // UV lamp — a proper ultraviolet source, not just a torch: a wide violet
    // cone plus an ambient UV wash that blooms around the player while it is on.
    const hasView = this._updateView(player);
    this.uv.uUvOn.value += ((this.uvOn ? 1 : 0) - this.uv.uUvOn.value) * Math.min(1, dt * 10);
    if (hasView) {
      this.uv.uUvPos.value.copy(this._o);
      this.uv.uUvDir.value.copy(this._d);
      this.uvLight.position.copy(this._o).addScaledVector(this._d, 0.2);
      this.uvLight.target.position.copy(this._o).addScaledVector(this._d, 5);
      if (this.uvWash) this.uvWash.position.copy(this._o).addScaledVector(this._d, 1.2);
    }
    this.uvLight.intensity = 60 * this.uv.uUvOn.value;
    if (this.uvWash) this.uvWash.intensity = 4.0 * this.uv.uUvOn.value;

    // physics + interaction
    if (player && player.pos && !this.caseOpen && !this.outroOpen) this._stepMovables(dt, player);
    if (hasView && !this.caseOpen && !this.outroOpen) this._updateFocus();
    if (this.photoCam) this.photoCam.update(dt, this.time);
  }

  // =========================================================
  // DISPOSE
  // =========================================================
  dispose() {
    if (this._look) { this._look.dispose(); this._look = null; }
    clearTimeout(this._toastTimer);
    clearTimeout(this._caseTimer);
    clearTimeout(this._scareTimer);
    clearTimeout(this._buzzTimer);
    if (this._briefing) { this._briefing.cancel(); this._briefing = null; }
    window.removeEventListener('keydown', this._onKey);
    if (this.photoCam) { this.photoCam.dispose(); this.photoCam = null; }
    if (window.__firstPerson) window.__firstPerson = false;
    if (this.ui) {
      if (this.ui.root) this.ui.root.remove();
      if (this.ui.case) this.ui.case.remove();
      if (this.ui.outro) this.ui.outro.remove();
      this.ui = null;
    }
    if (this.level && this.level.parent) this.level.parent.remove(this.level);
    if (this.level) {
      this.level.traverse((o) => {
        if (!o.isMesh && !o.isPoints) return;
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
            for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose();
            m.dispose();
          });
        }
      });
    }
    // give the shared scene back the way we found it
    this.scene.background = this._prevBg || null;
    this.scene.fog = this._prevFog || null;
    this.clues = []; this.movables = []; this.occluders = []; this.colliders = [];
  }

  // legacy arity compat
  _updateLegacy(deltaTime) { return this.update(deltaTime, 0, null); }
}


// ============================================================
// HOW LEVEL 1 LOOKS (applied once from the constructor via
// applyLevel1Look(this); nothing below changes the gameplay)
//   * textures + surface bumps made in code: oak floor, plaster
//     walls, ceiling tiles, wood grain, carpet, fabric, leather,
//     brushed metal, paper; soft reflections
//   * night lighting: ceiling fittings with soft area light,
//     darker corners, warm desk lamp, cold moonlight
//   * the victim's model made matte, blood pool under his chest
//   * furniture on the bare walls
//   * a visible detective with [V] first / third person
//   * one tidy controls bar at the bottom
// ============================================================
// ---------- small seeded noise ----------
let seed = 9001;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
// tileable value noise (period P cells)
function pnoise(x, y, P, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const w = (i) => ((i % P) + P) % P;
  const c = (i, j) => hash(w(xi + i), w(yi + j), s);
  const a = c(0, 0) + (c(1, 0) - c(0, 0)) * u, b = c(0, 1) + (c(1, 1) - c(0, 1)) * u;
  return (a + (b - a) * v) * 2 - 1;
}
function pfbm(x, y, P, s, oct = 4) {
  let a = 0.5, f = 1, sum = 0, n = 0;
  for (let i = 0; i < oct; i++) { sum += a * pnoise(x * f, y * f, P * f, s + i); n += a; a *= 0.5; f *= 2; }
  return sum / n;
}

// Build colour / normal / roughness textures from one function that returns,
// for each pixel (u, v in 0..1): { r, g, b, h (height 0..1), rough (0..1) }
function makeMaps(size, sample, bump, opts = {}) {
  const N = size * size;
  const col = new Uint8ClampedArray(N * 4), hgt = new Float32Array(N), rgh = new Uint8ClampedArray(N * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = sample(x / size, y / size, x, y);
    const i = y * size + x;
    col[i * 4] = p.r; col[i * 4 + 1] = p.g; col[i * 4 + 2] = p.b; col[i * 4 + 3] = 255;
    hgt[i] = p.h;
    const r = clamp(p.rough * 255, 0, 255);
    rgh[i * 4] = r; rgh[i * 4 + 1] = r; rgh[i * 4 + 2] = r; rgh[i * 4 + 3] = 255;
  }
  const nrm = new Uint8ClampedArray(N * 4);
  const at = (x, y) => hgt[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let nx = (at(x - 1, y) - at(x + 1, y)) * bump, ny = (at(x, y - 1) - at(x, y + 1)) * bump;
    const l = Math.hypot(nx, ny, 1);
    const i = (y * size + x) * 4;
    nrm[i] = (nx / l * 0.5 + 0.5) * 255; nrm[i + 1] = (ny / l * 0.5 + 0.5) * 255; nrm[i + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
  }
  const tex = (data, srgb) => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    c.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
    return t;
  };
  return { map: tex(col, true), normalMap: tex(nrm, false), roughnessMap: tex(rgh, false) };
}

// ---------- the surfaces ----------

// varnished oak planks: 4 planks across, staggered ends, grain, worn varnish
function oakFloor() {
  const planks = 4, len = 2;      // tile = 4 planks wide, plank ends staggered twice
  const shade = [];
  for (let i = 0; i < planks * len * 2; i++) shade.push(0.75 + rnd() * 0.4);
  return makeMaps(512, (u, v) => {
    const px = u * planks, col = Math.floor(px), fx = px - col;
    const off = (col % 2) * 0.5;
    const pv = (v + off) * len, row = Math.floor(pv), fy = pv - row;
    const k = shade[(col * len + (row % len)) % shade.length];
    const gap = (fx < 0.02 || fx > 0.98 || fy < 0.006 || fy > 0.994) ? 1 : 0;
    const grain = pfbm(fx * 3 + col * 7.1, (v + off) * 40, 4096, 3 + col, 3);
    const ring = 0.5 + 0.5 * Math.sin((fx * 9 + grain * 2.5) * 3.1);
    const t = k * (0.62 + 0.22 * ring + 0.1 * grain);
    const wear = pfbm(u * 6, v * 6, 6, 77, 3);
    const base = [118, 74, 44];
    const g = gap ? 0.28 : t;
    return {
      r: base[0] * g, g: base[1] * g, b: base[2] * g,
      h: gap ? 0 : 0.6 + 0.08 * ring,
      rough: gap ? 1 : clamp(0.32 + 0.25 * (wear * 0.5 + 0.5) + 0.08 * ring, 0, 1),
    };
  }, 2.2);
}

// painted plaster: soft roller texture, faint scuffs low down
function plasterWall() {
  return makeMaps(512, (u, v) => {
    const n = pfbm(u * 16, v * 16, 16, 11, 4);
    const fine = pnoise(u * 128, v * 128, 128, 5);
    const k = 0.92 + 0.05 * n + 0.02 * fine;
    return { r: 236 * k, g: 236 * k, b: 232 * k, h: 0.5 + 0.35 * n + 0.15 * fine, rough: 0.82 + 0.1 * n };
  }, 1.1);
}

// suspended ceiling tiles (2 x 2 per texture), speckled acoustic surface
function ceilingTiles() {
  return makeMaps(512, (u, v) => {
    const fx = (u * 2) % 1, fy = (v * 2) % 1;
    const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
    const groove = edge < 0.012;
    const dot = hash(Math.floor(u * 512), Math.floor(v * 512), 21) > 0.93;
    const n = pfbm(u * 8, v * 8, 8, 31, 3);
    const k = groove ? 0.45 : (dot ? 0.72 : 0.9 + 0.05 * n);
    return { r: 150 * k, g: 150 * k, b: 146 * k, h: groove ? 0 : (dot ? 0.4 : 0.6 + 0.05 * n), rough: 0.95 };
  }, 2.5);
}

// straight wood grain for desk tops, doors, cabinets
function woodGrain(rgb) {
  return makeMaps(512, (u, v) => {
    const warp = pfbm(u * 2, v * 6, 64, 41, 3);
    const lines = 0.5 + 0.5 * Math.sin((v * 46 + warp * 5) * Math.PI);
    const fine = pnoise(u * 256, v * 24, 256, 43);
    const k = 0.7 + 0.22 * lines + 0.08 * fine;
    return { r: rgb[0] * k, g: rgb[1] * k, b: rgb[2] * k, h: 0.5 + 0.12 * lines + 0.05 * fine, rough: 0.42 + 0.15 * (1 - lines) };
  }, 1.4);
}

// carpet / rug: dense fibre, a darker border band
function carpet(rgb) {
  return makeMaps(512, (u, v) => {
    const fib = hash(Math.floor(u * 512), Math.floor(v * 512), 61);
    const n = pfbm(u * 10, v * 10, 10, 63, 3);
    const e = Math.min(u, 1 - u, v, 1 - v);
    const border = e < 0.06 ? 0.62 : (e < 0.075 ? 1.18 : 1);
    const k = (0.78 + 0.18 * fib + 0.08 * n) * border;
    return { r: rgb[0] * k, g: rgb[1] * k, b: rgb[2] * k, h: 0.3 + 0.7 * fib, rough: 1 };
  }, 3.0);
}

// woven upholstery
function weave(rgb) {
  return makeMaps(256, (u, v, x, y) => {
    const w = ((x >> 1) + (y >> 1)) % 2 ? 0.9 : 1.0;
    const n = pfbm(u * 8, v * 8, 8, 71, 2);
    const k = w * (0.9 + 0.08 * n);
    return { r: rgb[0] * k, g: rgb[1] * k, b: rgb[2] * k, h: w, rough: 0.95 };
  }, 1.2);
}

// leather: pebbled grain with a slight sheen
function leather(rgb) {
  return makeMaps(256, (u, v) => {
    const cell = 1 - Math.abs(pfbm(u * 24, v * 24, 24, 81, 2));
    const k = 0.8 + 0.2 * cell;
    return { r: rgb[0] * k, g: rgb[1] * k, b: rgb[2] * k, h: cell, rough: 0.5 + 0.2 * (1 - cell) };
  }, 2.0);
}

// brushed steel
function brushed() {
  return makeMaps(256, (u, v) => {
    const s = pnoise(u * 4, v * 256, 4, 91);
    const k = 0.85 + 0.1 * s;
    return { r: 170 * k, g: 176 * k, b: 184 * k, h: 0.5 + 0.2 * s, rough: 0.32 + 0.12 * s };
  }, 0.6);
}

// paper: faint fibres
function paper() {
  return makeMaps(256, (u, v) => {
    const n = pnoise(u * 64, v * 64, 64, 95);
    const k = 0.95 + 0.04 * n;
    return { r: 236 * k, g: 230 * k, b: 214 * k, h: 0.5 + 0.2 * n, rough: 0.9 };
  }, 0.5);
}

// swap a material's look in place (every mesh that shares it updates)
function dress(m, maps, extra = {}) {
  if (!m) return;
  if (m.map && m.map.dispose) m.map.dispose();
  m.map = maps.map; m.normalMap = maps.normalMap; m.roughnessMap = maps.roughnessMap;
  m.color.set(0xffffff);
  Object.assign(m, extra);
  if (extra.normalScale !== undefined) m.normalScale = new THREE.Vector2(extra.normalScale, extra.normalScale);
  m.needsUpdate = true;
}

// FBX models arrive with shiny Phong "plastic"; make them matte cloth/skin
function matteModel(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const out = list.map((m) => {
      if (!m || m.isMeshStandardMaterial || m.userData.l1matte) return m;
      const s = new THREE.MeshStandardMaterial({
        map: m.map || null, normalMap: m.normalMap || null, color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
        roughness: 0.82, metalness: 0, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest,
        side: m.side,
      });
      s.userData.l1matte = true;
      m.dispose();
      return s;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
}

// =============================================================
// LIGHTING — a real office at night instead of flat, even light:
//   * the bare white tube sticks become proper recessed ceiling
//     fittings (aluminium frame + louvred diffuser) that give soft
//     area light from above
//   * much less "fill everywhere" light, so corners go darker
//   * the desk lamp becomes the warm focus, with soft shadows
//   * cold blue moonlight from the rainy windows
// =============================================================
function louvreTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f7ff'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = 'rgba(120,130,150,0.55)';
  for (let x = 0; x <= 256; x += 16) g.fillRect(x, 0, 2, 64);   // louvre blades
  g.fillRect(0, 31, 256, 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function relight(level) {
  RectAreaLightUniformsLib.init();
  const root = level.level;
  // 1) turn the flat fills down
  root.children.forEach((o) => {
    if (o.isHemisphereLight) o.intensity = 0.32;
    if (o.isAmbientLight) o.intensity = 0.08;
  });
  if (level.roomFill) { level.roomFill.intensity = 0.7; level.roomFill.position.y = (level.H || 4.2) - 0.4; }
  if (level.backFill) { level.backFill.intensity = 0.6; level.backFill.position.y = (level.H || 4.2) - 0.4; }
  if (level.tube) level.tube.intensity = 0.5;

  // 2) ceiling fittings where the bare tubes were
  const H = level.H || 4.2;
  const frameM = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.7, roughness: 0.35 });
  const diffM = new THREE.MeshStandardMaterial({ map: louvreTexture(), emissive: 0xffffff, emissiveIntensity: 1.25, roughness: 0.6 });
  diffM.emissiveMap = diffM.map;
  const tubes = [];
  root.traverse((o) => { if (o.isMesh && o.material === level.tubeMat) tubes.push(o); });
  for (const t of tubes) {
    t.visible = false;
    const x = t.position.x, z = t.position.z;
    const g = new THREE.Group(); g.position.set(x, H, z); root.add(g);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.07, 0.68), frameM);
    frame.position.y = -0.035; g.add(frame);
    const diff = new THREE.Mesh(new THREE.PlaneGeometry(2.76, 0.56), diffM);
    diff.rotation.x = Math.PI / 2; diff.position.y = -0.072; g.add(diff);
    frame.userData.noShadow = diff.userData.noShadow = true;
    const area = new THREE.RectAreaLight(0xeef3ff, 4.2, 2.7, 0.55);
    area.position.set(x, H - 0.08, z);
    area.lookAt(x, 0, z);
    root.add(area);
  }

  // 3) the desk lamp: warm pool of light with soft shadow edges
  if (level.lamp) {
    level.lamp.color.set(0xffb366);
    level.lamp.intensity = 14;
    level.lamp.distance = 9;
    level.lamp.decay = 2;
    level.lamp.shadow.radius = 4;
  }
  // 4) cold moonlight from the windows
  for (const m of [level.moon, level.moon2]) {
    if (!m) continue;
    m.color.set(0x6f8fd6);
    m.position.y = Math.min(m.position.y, (level.H || 4.2) - 0.25);
    m.penumbra = 1;
    if (m.shadow) m.shadow.radius = 5;
  }
}

// =============================================================
// THE BODY — slide the blood pool (and its drops and the hand
// smear) under his chest, so the wound lines up with the blood.
// =============================================================
function bloodUnderChest(level) {
  const g = level.bodyGroup;
  if (!g) return;
  let chest = null;
  g.traverse((o) => { if (!chest && o.isBone && /Spine2$/.test(o.name)) chest = o; });
  if (!chest) g.traverse((o) => { if (!chest && o.isBone && /Spine1?$/.test(o.name)) chest = o; });
  if (!chest) return;
  g.updateMatrixWorld(true);
  const c = chest.getWorldPosition(new THREE.Vector3());
  const POOL = new THREE.Vector3(-1.28, 0, -2.2);           // where lvl1.js put the pool
  const dx = c.x - POOL.x, dz = c.z - POOL.z;
  if (Math.hypot(dx, dz) < 0.05) return;
  level.level.children.forEach((o) => {
    if (!o.isMesh || o.position.y > 0.03) return;
    const isPool = o.geometry.type === 'CircleGeometry' && Math.hypot(o.position.x - POOL.x, o.position.z - POOL.z) < 1.0;
    const isSmear = o.geometry.type === 'PlaneGeometry' && Math.abs(o.position.x + 1.9) < 0.01 && Math.abs(o.position.z + 1.95) < 0.01;
    if (isPool || isSmear) { o.position.x += dx; o.position.z += dz; }
  });
}

// =============================================================
// FURNISHING — fill the bare walls with what a lecturer's office
// really has. Everything stands against a wall, away from the
// clues, and gets a collider so you can't walk through it.
// =============================================================
function furnish(level) {
  const root = level.level, m = level.m || {};
  const wood = m.woodDark || new THREE.MeshStandardMaterial({ color: 0x3a2618 });
  const metal = m.metal || new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.4 });
  const card = m.cardboard || new THREE.MeshStandardMaterial({ color: 0x9a7448 });
  const box = (p, w, h, d, mt, x, y, z) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mt);
    o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; p.add(o); return o;
  };
  const solid = (x0, x1, z0, z1, h) => level.colliders.push(new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, h, z1)));
  const bookCols = [0x6b1f1f, 0x1f3b5c, 0x2f4a2a, 0x7a5a1e, 0x3a2a4a, 0x8a7a64, 0x222222, 0x5c2c1c, 0x1c4a4a];
  const bookMats = bookCols.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }));

  // ---- bookcases on the left wall ----
  const L = level.LEFT;
  for (const zc of [-3.9, -2.8, -1.7]) {
    const g = new THREE.Group(); g.position.set(L + 0.19, 0, zc); root.add(g);
    box(g, 0.36, 2.2, 0.03, wood, 0, 1.1, -0.5); box(g, 0.36, 2.2, 0.03, wood, 0, 1.1, 0.5);
    box(g, 0.02, 2.2, 1.0, wood, -0.17, 1.1, 0);
    for (let s = 0; s < 6; s++) {
      const y = 0.06 + s * 0.42;
      box(g, 0.36, 0.03, 1.0, wood, 0, y, 0);
      if (s === 5) continue;
      let z = -0.46;
      while (z < 0.44) {
        const t = 0.025 + rnd() * 0.04, h = 0.24 + rnd() * 0.12;
        if (rnd() < 0.08) { z += 0.08; continue; }                    // a gap
        const b = box(g, 0.24 + rnd() * 0.06, h, t, bookMats[Math.floor(rnd() * bookMats.length)], 0.02, y + 0.015 + h / 2, z + t / 2);
        if (rnd() < 0.06) b.rotation.x = 0.18;                        // one leaning
        z += t + 0.004;
      }
    }
    solid(L, L + 0.38, zc - 0.52, zc + 0.52, 2.2);
  }

  // ---- radiators under both windows ----
  const B = level.BACK;
  const radM = new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.5, metalness: 0.2 });
  for (const wx of [-4.0, 3.0]) {
    const g = new THREE.Group(); g.position.set(wx, 0, B + 0.12); root.add(g);
    for (let i = 0; i < 16; i++) box(g, 0.07, 0.6, 0.09, radM, -0.75 + i * 0.1, 0.42, 0);
    box(g, 1.6, 0.04, 0.05, radM, 0, 0.16, 0); box(g, 1.6, 0.04, 0.05, radM, 0, 0.7, 0);
    solid(wx - 0.8, wx + 0.8, B, B + 0.2, 0.75);
  }

  // ---- a wall clock above the door side: stopped at 00:50 ----
  {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const q = c.getContext('2d');
    q.fillStyle = '#f2efe6'; q.beginPath(); q.arc(128, 128, 124, 0, 7); q.fill();
    q.strokeStyle = '#222'; q.lineWidth = 10; q.stroke();
    q.fillStyle = '#222';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; q.fillRect(124 + Math.sin(a) * 96, 124 - Math.cos(a) * 96, 8, 8); }
    const hand = (a, len, w) => { q.lineWidth = w; q.lineCap = 'round'; q.beginPath(); q.moveTo(128, 128); q.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len); q.stroke(); };
    hand((50 / 60) * Math.PI * 2, 92, 6);                  // minutes: 50
    hand(((0 + 50 / 60) / 12) * Math.PI * 2, 60, 9);       // hours: just before 1
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 }));
    face.position.set(5.3, 2.55, B + 0.03); root.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 8, 32), metal);
    rim.position.copy(face.position); root.add(rim);
  }

  // ---- coat stand by the door, his jacket still on it ----
  {
    const g = new THREE.Group(); g.position.set(8.05, 0, -4.7); root.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 10), wood); pole.position.y = 0.9; g.add(pole);
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8), wood);
      leg.position.set(Math.cos(i * 2.1) * 0.15, 0.08, Math.sin(i * 2.1) * 0.15); leg.rotation.z = Math.cos(i * 2.1) * 1.1; leg.rotation.x = -Math.sin(i * 2.1) * 1.1; g.add(leg);
    }
    const jacket = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.55, 4, 10), new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.95 }));
    jacket.scale.set(1, 1, 0.55); jacket.position.set(0, 1.3, 0.1); g.add(jacket);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    solid(7.8, 8.3, -4.95, -4.45, 1.9);
  }

  // ---- a potted plant in the front-left corner ----
  {
    const g = new THREE.Group(); g.position.set(L + 0.5, 0, level.FRONT - 0.5); root.add(g);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 16), new THREE.MeshStandardMaterial({ color: 0x8a4a32, roughness: 0.9 }));
    pot.position.y = 0.21; g.add(pot);
    const leafM = new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 0.7, side: THREE.DoubleSide });
    for (let i = 0; i < 14; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.6), leafM);
      const a = rnd() * Math.PI * 2, tilt = 0.3 + rnd() * 0.6;
      leaf.position.set(Math.cos(a) * 0.08, 0.7 + rnd() * 0.25, Math.sin(a) * 0.08);
      leaf.rotation.set(Math.sin(a) * tilt, -a, Math.cos(a) * tilt);
      g.add(leaf);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    solid(L, L + 0.75, level.FRONT - 0.75, level.FRONT, 1.1);
  }

  // ---- archive boxes stacked against the front wall ----
  {
    const F = level.FRONT;
    const lidM = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.9 });
    const spots = [[0.3, 0, 0.05], [0.82, 0, -0.08], [0.55, 1, 0.2], [1.34, 0, 0.12]];
    for (const [x, layer, r] of spots) {
      const g = new THREE.Group(); g.position.set(x, layer * 0.32, F - 0.22); g.rotation.y = r; root.add(g);
      box(g, 0.45, 0.28, 0.34, card, 0, 0.14, 0);
      box(g, 0.47, 0.04, 0.36, lidM, 0, 0.3, 0);
    }
    solid(0.05, 1.6, F - 0.45, F, 0.66);
  }

  // ---- whiteboard on the front wall, his last lecture still on it ----
  {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const q = c.getContext('2d');
    q.fillStyle = '#f4f6f6'; q.fillRect(0, 0, 512, 256);
    q.strokeStyle = 'rgba(40,70,140,0.85)'; q.fillStyle = 'rgba(40,70,140,0.85)';
    q.font = '22px "Comic Sans MS", cursive';
    q.fillText('INFS2041  -  Graph search', 24, 40);
    q.fillText('BFS: queue      DFS: stack', 24, 82);
    q.fillText('A*:  f(n) = g(n) + h(n)', 24, 124);
    q.lineWidth = 3;
    const nodes = [[360, 150], [430, 110], [440, 200], [300, 210]];
    q.beginPath(); q.moveTo(...nodes[0]); q.lineTo(...nodes[1]); q.moveTo(...nodes[0]); q.lineTo(...nodes[2]); q.moveTo(...nodes[0]); q.lineTo(...nodes[3]); q.stroke();
    for (const n of nodes) { q.beginPath(); q.arc(n[0], n[1], 14, 0, 7); q.stroke(); }
    q.fillStyle = 'rgba(170,40,40,0.8)'; q.fillText('exam: 2 Dec', 24, 222);
    q.fillStyle = 'rgba(0,0,0,0.05)'; for (let i = 0; i < 40; i++) q.fillRect(rnd() * 512, rnd() * 256, 60, 6);   // old wipe marks
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group(); g.position.set(4.4, 1.6, level.FRONT - 0.03); g.rotation.y = Math.PI; root.add(g);
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), new THREE.MeshStandardMaterial({ map: t, roughness: 0.25 }));
    g.add(bd);
    box(g, 2.06, 0.04, 0.03, metal, 0, 0.52, -0.01); box(g, 2.06, 0.04, 0.03, metal, 0, -0.52, -0.01);
    box(g, 0.04, 1.06, 0.03, metal, 1.02, 0, -0.01); box(g, 0.04, 1.06, 0.03, metal, -1.02, 0, -0.01);
    box(g, 1.2, 0.03, 0.08, metal, 0, -0.55, 0.04);                    // marker tray
  }
}

// =============================================================
// CONTROLS BAR — one tidy bar at the bottom instead of three lines
// of overlapping text. Shows key caps, lights up the tool in your
// hand, the UV lamp when it is on and the camera when it is raised.
// The old lines (main.js #hud / #msg and lvl1's hint) are hidden
// while Level 1 runs and put back afterwards.
// =============================================================
function controlsBar(level, getThird) {
  const css = document.createElement('style');
  css.textContent = `
    .l1bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:55;display:flex;gap:10px;align-items:stretch;
      font-family:'Courier New',monospace;pointer-events:none;max-width:calc(100vw - 32px);flex-wrap:wrap;justify-content:center}
    .l1grp{display:flex;gap:4px;align-items:center;background:rgba(8,10,16,.72);border:1px solid #2c3442;border-radius:8px;
      padding:6px 8px;backdrop-filter:blur(3px)}
    .l1lab{font-size:9px;letter-spacing:2px;color:#7d8798;margin-right:4px;writing-mode:vertical-rl;transform:rotate(180deg)}
    .l1k{display:flex;align-items:center;gap:6px;padding:3px 7px 3px 3px;border-radius:5px;color:#c9c2b0;font-size:11px;
      letter-spacing:1px;transition:background .15s,color .15s}
    .l1k b{display:inline-block;min-width:20px;padding:2px 5px;text-align:center;border:1px solid #5a5040;border-bottom-width:3px;
      border-radius:4px;background:#14171e;color:#f2d9a0;font-size:11px}
    .l1k.on{background:rgba(242,184,75,.18);color:#fff}
    .l1k.on b{border-color:#f2b84b;color:#f2b84b}
    .l1k.uv.on{background:rgba(138,43,255,.25)} .l1k.uv.on b{border-color:#b58cff;color:#d7c2ff}
    .l1click{position:fixed;left:50%;top:62%;transform:translateX(-50%);z-index:55;pointer-events:none;font-family:'Courier New',monospace;
      font-size:12px;letter-spacing:3px;color:#f2d9a0;background:rgba(8,10,16,.6);border:1px solid rgba(242,217,160,.35);
      border-radius:20px;padding:7px 16px;display:none}
  `;
  const bar = document.createElement('div'); bar.className = 'l1bar';
  const k = (id, key, label, extra = '') => `<span class="l1k ${extra}" data-k="${id}"><b>${key}</b>${label}</span>`;
  bar.innerHTML =
    `<div class="l1grp"><span class="l1lab">KIT</span>${k('bag', '1', 'Bags')}${k('tweezers', '2', 'Tweezers')}${k('swab', '3', 'Swab')}${k('cam', 'Q', 'Camera')}</div>` +
    `<div class="l1grp"><span class="l1lab">DO</span>${k('e', 'E', 'Collect')}${k('uv', 'F', 'UV lamp', 'uv')}${k('c', 'C', 'Case file')}${k('v', 'V', '1st person')}</div>` +
    `<div class="l1grp">${k('p', 'P', 'Pause')}${k('esc', 'Esc', 'Mouse')}</div>`;
  const click = document.createElement('div'); click.className = 'l1click'; click.textContent = 'CLICK TO LOOK AROUND';
  for (const el of [css, bar, click]) document.body.appendChild(el);
  const chips = {}; bar.querySelectorAll('[data-k]').forEach((e) => { chips[e.dataset.k] = e; });
  const vLabel = chips.v;

  const hidden = [];
  const hide = (el) => { if (el) { hidden.push([el, el.style.visibility]); el.style.visibility = 'hidden'; } };
  hide(document.getElementById('hud'));
  hide(document.getElementById('msg'));
  if (level.ui && level.ui.hint) hide(level.ui.hint);

  let last = '';
  return {
    update() {
      const tool = level.tool, cam = !!(level.photoCam && level.photoCam.isUp), uv = !!level.uvOn, third = getThird();
      const overlay = !!(level.caseOpen || level.outroOpen || window.__uiCapture);
      const free = !document.pointerLockElement && !overlay && !window.__paused;
      const key = [tool, cam, uv, third, overlay, free].join('|');
      if (key === last || !chips.bag) return;
      last = key;
      for (const t of ['bag', 'tweezers', 'swab']) chips[t].classList.toggle('on', tool === t && !cam);
      chips.cam.classList.toggle('on', cam);
      chips.uv.classList.toggle('on', uv);
      vLabel.innerHTML = `<b>V</b>${third ? '3rd person' : '1st person'}`;
      bar.style.display = overlay ? 'none' : 'flex';
      click.style.display = free ? 'block' : 'none';
    },
    dispose() {
      for (const [el, v] of hidden) el.style.visibility = v || '';
      css.remove(); bar.remove(); click.remove();
    },
  };
}

function applyLevel1Look(level) {
  const m = level.m || {};
  seed = 9001;

  // ---- surfaces ----
  const W = level.W || 14.5, D = level.D || 9.5;
  dress(m.floor, oakFloor(), { roughness: 1, metalness: 0, normalScale: 0.9 });
  m.floor && [m.floor.map, m.floor.normalMap, m.floor.roughnessMap].forEach((t) => t.repeat.set(W / 0.72, D / 2.4));
  dress(m.wall, plasterWall(), { roughness: 1, normalScale: 0.35 });
  m.wall && [m.wall.map, m.wall.normalMap, m.wall.roughnessMap].forEach((t) => t.repeat.set(5, 1.4));
  dress(m.ceil, ceilingTiles(), { roughness: 1, normalScale: 0.6 });
  m.ceil && [m.ceil.map, m.ceil.normalMap, m.ceil.roughnessMap].forEach((t) => t.repeat.set(W / 1.2, D / 1.2));
  dress(m.wood, woodGrain([120, 76, 46]), { roughness: 1, normalScale: 0.5 });
  dress(m.woodDark, woodGrain([74, 46, 30]), { roughness: 1, normalScale: 0.5 });
  dress(m.rug, carpet([112, 46, 58]), { roughness: 1, normalScale: 1.2 });
  dress(m.fabric, weave([52, 66, 84]), { roughness: 1, normalScale: 0.8 });
  m.fabric && [m.fabric.map, m.fabric.normalMap, m.fabric.roughnessMap].forEach((t) => t.repeat.set(3, 3));
  dress(m.leather, leather([70, 44, 34]), { roughness: 1, normalScale: 0.7 });
  dress(m.metal, brushed(), { roughness: 1, metalness: 0.85, normalScale: 0.3 });
  dress(m.paper, paper(), { roughness: 1, normalScale: 0.3 });
  if (m.cardboard) { m.cardboard.roughness = 0.95; }
  if (m.brass) { m.brass.roughness = 0.3; }

  // ---- lighting ----
  relight(level);

  // ---- soft reflections from a neutral room environment ----
  let envTarget = null;
  const scene = level.scene;
  const prevEnv = scene ? scene.environment : null;
  const prevEnvI = scene ? scene.environmentIntensity : 1;
  if (scene && level.renderer) {
    try {
      const pm = new THREE.PMREMGenerator(level.renderer);
      envTarget = pm.fromScene(new RoomEnvironment(), 0.04);
      pm.dispose();
      scene.environment = envTarget.texture;
      scene.environmentIntensity = 0.18;      // night office: reflections only, not daylight
    } catch (e) { console.warn('[Level1Look] no environment', e); }
  }

  // ---- the victim model loads later: make it matte when it arrives ----
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    const g = level.bodyGroup;
    let found = false;
    if (g) g.traverse((o) => { if (o.isSkinnedMesh || o.isMesh) found = true; });
    if (found) { matteModel(g); bloodUnderChest(level); clearInterval(timer); }
    else if (tries > 120) clearInterval(timer);
  }, 250);

  // ---- start like you just came in: inside the door, behind the police
  //      tape, looking across the room at the body and the desk ----
  level.spawn.set(6.3, 0, -5.5);
  level.spawnYaw = Math.atan2(6.3 - (-1.45), -5.5 - (-2.35));   // face the body

  // ---- fill the empty office ----
  furnish(level);

  // ---- the player: visible detective + [V] first / third person ----
  const view = attachPlayerView(level, {
    forceFirst: () => !!(level.photoCam && level.photoCam.isUp) || level.caseOpen || level.outroOpen,
    bounds: { L: level.LEFT, R: level.RIGHT, B: level.BACK, F: level.FRONT, H: level.H },
  });
  level._view = view;
  const bar = controlsBar(level, view.isThird);
  const baseUpdate = level.update.bind(level);
  level.update = (dt, t, player) => {           // lvl1 runs first, unchanged
    baseUpdate(dt, t, player);
    view.update(dt, player);
    bar.update();
  };

  return {
    dispose() {
      view.dispose();
      bar.dispose();
      clearInterval(timer);
      if (scene) { scene.environment = prevEnv; scene.environmentIntensity = prevEnvI; }
      if (envTarget) envTarget.dispose();
    },
  };
}
