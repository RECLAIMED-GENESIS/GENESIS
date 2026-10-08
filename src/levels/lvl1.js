// ============================================================
// LEVEL 1 — THE VICTIM'S OFFICE   (first-person investigation)
//
// A lecturer is found dead in his office late at night. Shot once
// in the chest. One room, dim lighting, no NPCs, no combat.
// Find 8 clues (look at them, press E), then a short cutscene shows the
// investigator logging the evidence and heading for the next lead.
//
// NOTE ABOUT THE CAMERA / CONTROLS
//   This level is purely first-person: the player is never seen, and the view
//   carries no hands, torch or feet. It only takes over window.__camera (see
//   _applyFirstPerson) so the game reads as first person from Level 1 alone,
//   however the host was driving it.
//
// Controls used by this level
//   mouse      look (needs pointer lock)
//   W A S D    walk, Shift sprint, Space jump   (host player controller)
//   E          examine / collect the clue you are looking at
//   F          toggle UV torch (reveals hidden evidence)
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
//                       (3) rainy window shader with lightning
// ============================================================
import * as THREE from 'three';

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
  nextPlace: 'the City',
  // Shown as a short cutscene once every clue is logged: the investigator bags
  // the evidence for the lab, then heads for the city contact the diary names.
  outro: [
    'That is everything this room has to say. One gunshot, a guest who never finished his drink, and a meeting nobody was meant to know about.',
    'I am bagging the casing, the glasses, the fibres and the rest — the lab will confirm what I already suspect.',
    'The diary points somewhere else: a rendezvous in the city, booked for tomorrow afternoon.',
    'Whoever he was going to meet is the one who benefits from him never keeping that appointment.',
    'Evidence to the lab first. Then I follow the trail into the city.',
  ],
  body: {
    name: 'The body',
    note: 'One entry wound, left chest, powder burns on the shirt — fired from well under a metre. Skin already cooling and stiff in the shoulders. He was shot where he sat, then slid off the chair and reached for something he could not quite grab.',
  },
  clues: {
    casing: {
      name: 'Bullet casing',
      note: 'A 9mm casing, brass still bright, skittered under the bookshelf. Ejection marks are clean — the shooter stood to his right, close, and did not fumble the magazine.',
      finding: 'One shot, fired from less than a metre. The killer knew how to handle a gun.',
    },
    glass: {
      name: 'Two whiskey glasses',
      note: 'Two tumblers, not one: the victim\'s on the desk, still a finger of whiskey in it, and a guest\'s on the side cabinet, half drunk and dried out. No glasses were washed. Whoever he was drinking with never finished the night.',
      finding: 'He had a guest, and they drank together. The glass was left where it stood.',
    },
    hair: {
      name: 'Brown hair fibres (guest chair)',
      note: 'Two long brown hairs wound into the seat cushion of the guest chair, and a third on the armrest. Dr Nkosi was bald — his own combings are grey stubble on the jacket collar.',
      finding: 'A person with long brown hair sat in the guest chair, facing him.',
    },
    handkerchief: {
      name: 'Monogrammed handkerchief',
      note: 'Linen, monogrammed "K.P." in the corner, and the tip is stiff with dried blood that is not the victim\'s — no wound of his is on the front of his hand. It lay where the guest stood up.',
      finding: '"K.P." was in this room, close enough to the barrel to be spattered, and wiped a hand.',
    },
    phone: {
      name: 'His phone',
      note: 'Screen still lit. 22:48 Unknown: "Exam scripts. Your office, tonight." 23:19 Dr Nkosi: "Just locked up the Staff Common Room. Heading to my office." 23:31 Unknown: "Coming up the back stairs. Tell no one."',
      finding: 'Last message 23:31. He expected a secret visitor after locking the Staff Common Room.',
    },
    note: {
      name: 'Torn note',
      note: 'Hidden under a moving box, torn in half: "...the marks were changed before the board met. Three names on the list, and one of them is lying to you."',
      finding: 'Somebody altered exam marks. Three people could have done it; one is lying.',
    },
    trail: {
      name: 'Wiped blood trail (UV)',
      note: 'Under the UV torch the floor tells a different story: a smeared trail of dissolved haemoglobin from the guest chair to the door, plus a letter scrawled on its side beside the body. The killer mopped his own spatter in a hurry.',
      finding: 'The shooter stood up from the guest chair and left in a hurry, dragging a little blood with him.',
    },
    calendar: {
      name: 'Desk calendar',
      note: 'A corner-torn desk calendar. Tomorrow\'s date is ringed twice in red ink, a line scribbled under it: "CITY, 14:00 - depot, bring it." Not on any departmental diary, not mentioned to the secretary. He was going to meet someone out there, and only the killer knew the hour.',
      finding: 'A secret meeting was booked in the city for tomorrow afternoon.',
    },
  },
};

const REACH = 3.6;       // how far the player can examine things
const PLAYER_R = 0.38;   // radius used when the player pushes objects
const EYE = 1.66;        // first-person eye height

// ------------------------------------------------------------
// small helpers
// ------------------------------------------------------------
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
    let outerScene = null;
    if (sceneOrRenderer && sceneOrRenderer.isScene) outerScene = sceneOrRenderer;
    this.scene = outerScene || new THREE.Scene();

    // remember what was there so dispose() can restore it
    this._prevBg = this.scene.background;
    this._prevFog = this.scene.fog;
    this.scene.background = new THREE.Color(0x04050a);
    this.scene.fog = new THREE.FogExp2(0x07080e, 0.022);

    this.name = "LEVEL 1 — THE VICTIM'S OFFICE";
    this.colliders = [];
    this.level = new THREE.Group();
    this.root = this.level;
    this.scene.add(this.level);

    this.time = 0;

    // ---- room footprint (bigger office): x -10..10, z -7..7, height 4 ----
    this.W = 20;
    this.D = 14;
    this.H = 4.0;
    this.HALF_W = this.W / 2;
    this.HALF_D = this.D / 2;

    this.spawn = new THREE.Vector3(6.2, 0, 4.6);
    this.spawnYaw = Math.PI * 0.78;   // face across the room toward the desk

    this.clues = [];
    this.movables = [];
    this.occluders = [];       // invisible boxes that block the examine ray
    this.uvOn = false;
    this.caseOpen = false;
    this.outroOpen = false;
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
      uUvCos: { value: Math.cos(0.40) },
      uUvPos: { value: new THREE.Vector3() },
      uUvDir: { value: new THREE.Vector3(0, 0, -1) },
    };

    this._makeMaterials();
    this._buildRoom();
    this._buildLighting();
    this._buildFurniture();
    this._buildChalkOutline();
    this._buildBody();
    this._buildClues();
    // NOTE: no first-person hand/torch rig is built — the view stays clean.
    this._buildUI();

    // shadows on everything built so far
    this.level.traverse((o) => {
      if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; }
    });
    this.level.updateMatrixWorld(true);

    // the third-person avatar is no longer part of this game
    this._hideAvatar();
    window.__firstPerson = true;   // tell any host camera rig to stand down

    this._onKey = (e) => this._handleKey(e);
    window.addEventListener('keydown', this._onKey);

    this._toast('INCIDENT — LECTURER FOUND DEAD', `Find all ${this.clues.length} clues.  [E] examine   [F] UV torch   [C] case file`, 8000);
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
      g.fillStyle = '#2d3038'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(${rng() > 0.5 ? '255,255,255' : '0,0,0'},${rng() * 0.05})`;
        g.fillRect(rng() * w, rng() * h, 2 + rng() * 4, 2 + rng() * 4);
      }
      // damp patch creeping up the wall behind the desk
      const grd = g.createRadialGradient(w * 0.7, h * 0.8, 6, w * 0.7, h * 0.8, w * 0.5);
      grd.addColorStop(0, 'rgba(10,12,16,0.5)'); grd.addColorStop(1, 'rgba(10,12,16,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    });
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(6, 1.6);

    this.m = {
      floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.05 }),
      wall: new THREE.MeshStandardMaterial({ map: wallTex, color: 0x9aa0ad, roughness: 0.95 }),
      ceil: new THREE.MeshStandardMaterial({ color: 0x15161b, roughness: 1 }),
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
  // ROOM  (20m x 14m, 4m high — a real head-of-department office)
  // =========================================================
  _buildRoom() {
    const W = this.W, D = this.D, H = this.H;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this.m.floor);
    floor.rotation.x = -Math.PI / 2; this.level.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this.m.ceil);
    ceil.rotation.x = Math.PI / 2; ceil.position.y = H; this.level.add(ceil);

    // walls (visual + collider). Thickness .3 sits outside the room.
    const wall = (cx, cz, w, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), this.m.wall);
      m.position.set(cx, H / 2, cz); this.level.add(m);
      this._static(cx, cz, w / 2, d / 2, H);
    };
    wall(0, -D / 2 - 0.15, W + 0.6, 0.3);   // back
    wall(0, D / 2 + 0.15, W + 0.6, 0.3);    // front
    wall(-W / 2 - 0.15, 0, 0.3, D + 0.6);   // left
    wall(W / 2 + 0.15, 0, 0.3, D + 0.6);    // right

    // wainscot + cornice around the whole room
    const wain = this.m.woodDark;
    this._box(this.level, W, 1.05, 0.05, wain, 0, 0.52, -D / 2 + 0.03);
    this._box(this.level, W, 1.05, 0.05, wain, 0, 0.52, D / 2 - 0.03);
    this._box(this.level, 0.05, 1.05, D, wain, -W / 2 + 0.03, 0.52, 0);
    this._box(this.level, 0.05, 1.05, D, wain, W / 2 - 0.03, 0.52, 0);
    this._box(this.level, W, 0.12, 0.12, wain, 0, H - 0.16, -D / 2 + 0.06);
    this._box(this.level, 0.12, 0.12, D, wain, -W / 2 + 0.06, H - 0.16, 0);
    this._box(this.level, 0.12, 0.12, D, wain, W / 2 - 0.06, H - 0.16, 0);

    // ceiling tiles (subtle grid, unlit corner feel)
    const tileMat = new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 1 });
    for (let i = -2; i <= 2; i++) {
      const s = this._box(this.level, 0.06, 0.04, D - 0.6, tileMat, i * 4, H - 0.04, 0);
      s.userData.noShadow = true;
    }

    // rug under the conversation area
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.6), this.m.rug);
    rug.rotation.x = -Math.PI / 2; rug.position.set(0.2, 0.01, -1.0);
    rug.userData.noShadow = true; this.level.add(rug);

    // ---- door (back wall, x = 7) — the room is sealed, this is set dressing ----
    const door = new THREE.Group(); door.position.set(7, 0, -D / 2 + 0.08);
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
    const tape = new THREE.Group(); tape.position.set(7, 0, -D / 2 + 0.5);
    for (let i = 0; i < 2; i++) {
      const p = this._box(tape, 0.05, 1.0, 0.05, this.m.metal, (i ? 0.9 : -0.9), 0.5, 0);
      p.userData.noShadow = true;
    }
    const ribbon = this._box(tape, 1.9, 0.16, 0.012, this.m.tape, 0, 0.92, 0);
    ribbon.userData.noShadow = true;
    this.level.add(tape);

    // ---- window (back wall, x = 1.5) : rainy night shader ----
    this.winMat = new THREE.ShaderMaterial({
      vertexShader: WIN_VERT, fragmentShader: WIN_FRAG,
      uniforms: { uTime: this.uv.uTime, uFlash: { value: 0 } },
    });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), this.winMat);
    pane.position.set(1.5, 2.15, -D / 2 + 0.02); pane.userData.noShadow = true;
    this.level.add(pane);
    const fr = this.m.woodDark;
    this._box(this.level, 2.85, 0.12, 0.14, fr, 1.5, 3.02, -D / 2 + 0.06);
    this._box(this.level, 2.85, 0.14, 0.14, fr, 1.5, 1.28, -D / 2 + 0.06);
    this._box(this.level, 0.12, 1.9, 0.14, fr, 0.1, 2.15, -D / 2 + 0.06);
    this._box(this.level, 0.12, 1.9, 0.14, fr, 2.9, 2.15, -D / 2 + 0.06);
    this._box(this.level, 0.06, 1.6, 0.1, fr, 1.5, 2.15, -D / 2 + 0.06);
    this._box(this.level, 2.6, 0.06, 0.1, fr, 1.5, 2.15, -D / 2 + 0.06);
    // curtain on one side of the window
    for (let i = 0; i < 6; i++) {
      const c = this._box(this.level, 0.22, 2.3, 0.08, new THREE.MeshStandardMaterial({ color: 0x1b202a, roughness: 1 }),
        0.35 + i * 0.24, 1.2 + 1.15, -D / 2 + 0.22);
      c.rotation.y = (rng() - 0.5) * 0.2;
    }

    // ---- diplomas + a framed photo on the back wall ----
    for (let i = 0; i < 4; i++) {
      this._box(this.level, 0.56, 0.42, 0.03, this.m.woodDark, -5.6 + i * 0.78, 2.35, -D / 2 + 0.04);
      this._box(this.level, 0.47, 0.34, 0.035, this.m.paper, -5.6 + i * 0.78, 2.35, -D / 2 + 0.05);
    }
    this._box(this.level, 0.8, 0.62, 0.04, this.m.woodDark, -2.4, 2.4, -D / 2 + 0.04);
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
    photo.position.set(-2.4, 2.4, -D / 2 + 0.07); photo.userData.noShadow = true; this.level.add(photo);

    // ---- corkboard + shelf on the right wall ----
    this._box(this.level, 0.05, 1.1, 1.9, this.m.woodDark, W / 2 - 0.04, 1.9, -1.2);
    this._box(this.level, 0.03, 1.0, 1.8, new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1 }), W / 2 - 0.07, 1.9, -1.2);
    for (let i = 0; i < 9; i++) {
      const p = this._box(this.level, 0.012, 0.24, 0.18, this.m.paper, W / 2 - 0.09, 1.55 + rng() * 0.7, -2.0 + rng() * 1.7);
      p.rotation.x = (rng() - 0.5) * 0.35;
    }
    // a photo pinned crookedly, circled in red pen
    const pinned = this._box(this.level, 0.014, 0.3, 0.24, this.m.paper, W / 2 - 0.09, 2.1, -0.9);
    pinned.rotation.x = 0.2;
    this._box(this.level, 0.016, 0.02, 0.32, new THREE.MeshStandardMaterial({ color: 0xa01c1c, emissive: 0x400808, emissiveIntensity: 1 }), W / 2 - 0.1, 2.1, -0.9);

    // ---- skirting of loose papers / a fallen stack near the desk ----
    for (let i = 0; i < 7; i++) {
      const s = this._box(this.level, 0.24 + rng() * 0.08, 0.004, 0.3, this.m.paper,
        -3.6 + rng() * 1.6, 0.006 + i * 0.004, -1.4 + rng() * 1.6);
      s.rotation.y = rng() * 6.28;
    }
  }

  // =========================================================
  // LIGHTING — dim. Desk lamp, dead ceiling tube, moon through rain
  // =========================================================
  _buildLighting() {
    this.level.add(new THREE.HemisphereLight(0x263653, 0x0f0b08, 0.7));

    // two cold fills so the far corners of the big room stay readable
    this.roomFill = new THREE.PointLight(0x6f86b4, 1.6, 22, 2);
    this.roomFill.position.set(-4, 3.2, -2);
    this.level.add(this.roomFill);

    this.backFill = new THREE.PointLight(0x4d638f, 1.5, 16, 2);
    this.backFill.position.set(6, 3.0, 3);
    this.level.add(this.backFill);

    // desk lamp — the warm focal light over the body
    this.lamp = new THREE.PointLight(0xffc27a, 9, 12, 1.6);
    this.lamp.position.set(-2.6, 1.5, -3.4);
    this.lamp.castShadow = true;
    this.lamp.shadow.mapSize.set(512, 512);
    this.lamp.shadow.bias = -0.0035;
    this.level.add(this.lamp);

    // moonlight through the window
    this.moon = new THREE.SpotLight(0x6384c0, 22, 24, Math.PI / 3.2, 0.85, 1.1);
    this.moon.position.set(1.5, 3.1, -6.6);
    this.moon.target.position.set(-1.5, 0, 0.5);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(512, 512);
    this.level.add(this.moon, this.moon.target);

    // the ceiling tube that has been flickering since they cut the power:
    // this is what makes the room feel "late at night"
    this.tubeMat = new THREE.MeshStandardMaterial({ color: 0xdfe7f0, emissive: 0xcfe0ff, emissiveIntensity: 0.9 });
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 10), this.tubeMat);
      t.rotation.z = Math.PI / 2;
      t.position.set(-6 + i * 6, this.H - 0.22, -2 + i * 2.4);
      t.userData.noShadow = true;
      this.level.add(t);
    }
    this.tube = new THREE.PointLight(0xbfd4ff, 2.4, 16, 2);
    this.tube.position.set(4, 3.6, 1.5);
    this.level.add(this.tube);

    // light leaking in from the corridor through the door
    const leak = new THREE.PointLight(0x9fc0ff, 2.2, 7, 2);
    leak.position.set(7, 0.35, -5.9);
    this.level.add(leak);

    // UV torch (follows the head in update)
    this.uvLight = new THREE.SpotLight(0x7a3cff, 0, 12, 0.40, 0.55, 1.3);
    this.level.add(this.uvLight, this.uvLight.target);
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
    const cx = -this.HALF_W + d / 2 + 0.06;
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
    // ---- desk (against the back wall, facing the door) ----
    const desk = new THREE.Group();
    desk.position.set(-2.8, 0, -5.15);
    this._box(desk, 3.2, 0.07, 1.2, this.m.wood, 0, 0.76, 0);
    this._box(desk, 3.24, 0.24, 0.06, this.m.woodDark, 0, 0.62, -0.58);
    this._box(desk, 0.62, 0.72, 1.05, this.m.woodDark, -1.25, 0.36, 0);
    this._box(desk, 0.62, 0.72, 1.05, this.m.woodDark, 1.25, 0.36, 0);
    // modesty panel
    this._box(desk, 1.9, 0.52, 0.05, this.m.woodDark, 0, 0.44, -0.5);
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
    this._static(-2.8, -5.15, 1.6, 0.6, 0.79);
    this.desk = desk;

    // the victim's own chair, still behind the desk
    this._chair(-2.5, -5.9, 0, { leather: true, ease: 0.45 });

    // guest chair — the shooter sat here
    this.guestChair = this._chair(1.5, -1.4, Math.PI * 0.92, { leather: true, ease: 0.7 });

    // a chair tipped over near the reading corner
    this._chair(6.2, 3.2, 0.9, { tipped: true, ease: 1.0 });

    // ---- bookcases (left wall) / cabinet / sideboard ----
    this._bookcase(-3.4);
    this._bookcase(1.6);
    this._filingCabinet(8.9, -2.6, -Math.PI / 2);

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

    // ---- bookshelf reading chair, empty, still warm? (set dressing) ----
    const armchair = new THREE.Group();
    this._box(armchair, 0.9, 0.14, 0.85, this.m.leather, 0, 0.42, 0);
    this._box(armchair, 0.9, 0.75, 0.16, this.m.leather, 0, 0.85, -0.38);
    this._box(armchair, 0.14, 0.34, 0.8, this.m.leather, -0.42, 0.62, 0.02);
    this._box(armchair, 0.14, 0.34, 0.8, this.m.leather, 0.42, 0.62, 0.02);
    for (const [lx, lz] of [[-0.36, -0.32], [0.36, -0.32], [-0.36, 0.32], [0.36, 0.32]]) {
      this._box(armchair, 0.06, 0.36, 0.06, this.m.woodDark, lx, 0.18, lz);
    }
    armchair.position.set(-7.8, 0, 4.2); armchair.rotation.y = -0.9;
    this.level.add(armchair);
    this._static(-7.8, 4.2, 0.5, 0.48, 1.1);

    // ---- pushable boxes / bin ----
    const mkBox = (w, h, d, label) => {
      const g = new THREE.Group();
      this._box(g, w, h, d, this.m.cardboard, 0, h / 2, 0);
      this._box(g, w + 0.01, 0.04, 0.14, new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.6 }), 0, h + 0.002, 0);
      if (label) this._box(g, 0.34, 0.22, 0.012, this.m.paper, 0, h * 0.55, d / 2 + 0.008);
      return g;
    };
    // this box hides the torn note underneath it
    this.noteBox = this._movable(mkBox(0.95, 0.6, 0.85, true), -3.4, -2.3, 0.48, 0.43, 0.62, 0.5, 'box');
    this._movable(mkBox(0.75, 0.55, 0.65, true), -6.4, 2.6, 0.38, 0.33, 0.55, 0.55, 'box');
    this._movable(mkBox(0.55, 0.45, 0.55, false), -8.6, 5.4, 0.28, 0.28, 0.48, 0.8, 'box');
    this._movable(mkBox(0.6, 0.4, 0.5, true), 8.6, 5.6, 0.3, 0.25, 0.42, 0.8, 'box');

    const bin = new THREE.Group();
    const binMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }));
    binMesh.position.y = 0.21; bin.add(binMesh);
    for (let i = 0; i < 4; i++) {
      const crumpled = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), this.m.paper);
      crumpled.position.set((rng() - 0.5) * 0.18, 0.38 + rng() * 0.06, (rng() - 0.5) * 0.18);
      bin.add(crumpled);
    }
    // knocked over, papers spilled
    bin.rotation.z = 1.4; bin.position.y = 0.2;
    this._movable(bin, 5.0, 4.4, 0.22, 0.22, 0.44, 1.0, 'bin');
    for (let i = 0; i < 5; i++) {
      const s = this._box(this.level, 0.22, 0.004, 0.28, this.m.paper, 4.6 + rng() * 1.2, 0.006, 4.0 + rng() * 1.2);
      s.rotation.y = rng() * 6.28;
    }
  }

  // =========================================================
  // CHALK OUTLINE + SPILL — drawn on the floor around the body
  // =========================================================
  _buildChalkOutline() {
    const tex = canvasTex(512, 512, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(238,238,230,0.9)';
      g.lineWidth = 7; g.lineCap = 'round';
      // chalky double-stroke body silhouette, lying with head to the left
      const draw = (ox, oy, s) => {
        g.beginPath();
        g.arc(120 + ox, 256 + oy, 46 * s, 0, Math.PI * 2);              // head
        g.moveTo(162 + ox, 216 + oy); g.lineTo(300 + ox, 206 + oy);      // shoulder line
        g.lineTo(330 + ox, 250 + oy);                                    // hip
        g.moveTo(162 + ox, 300 + oy); g.lineTo(300 + ox, 306 + oy);
        g.lineTo(330 + ox, 266 + oy);
        g.moveTo(250 + ox, 206 + oy); g.lineTo(300 + ox, 120 + oy);      // raised arm
        g.moveTo(300 + ox, 120 + oy); g.lineTo(318 + ox, 96 + oy);
        g.moveTo(250 + ox, 306 + oy); g.lineTo(330 + ox, 400 + oy);      // legs
        g.lineTo(360 + ox, 430 + oy);
        g.moveTo(330 + ox, 262 + oy); g.lineTo(420 + ox, 250 + oy);      // reaching arm
        g.moveTo(420 + ox, 250 + oy); g.lineTo(452 + ox, 244 + oy);
        g.stroke();
      };
      g.globalAlpha = 0.85; draw(0, 0, 1);
      g.globalAlpha = 0.35; draw(4, -3, 1.01);
      // scuff marks and a knee drag
      g.globalAlpha = 0.5; g.lineWidth = 3;
      for (let i = 0; i < 26; i++) {
        g.beginPath();
        const x = 180 + rng() * 260, y = 200 + rng() * 200;
        g.moveTo(x, y); g.lineTo(x + rng() * 26 - 13, y + rng() * 26 - 13);
        g.stroke();
      }
    }, { alpha: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(-1.4, 0.02, -2.35);
    mesh.rotation.z = -0.55;
    mesh.userData.noShadow = true;
    this.level.add(mesh);

    // evidence tents (1 - 7) scattered at the clue positions
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
    this._tent(-2.95, -2.05, 6);   // note
  }

  // =========================================================
  // THE BODY — Dr. Thabo Nkosi, single entry wound, left chest
  // Built segment by segment so the silhouette reads as a real
  // adult male lying on his back (1.82m), not a doll.
  // =========================================================
  _buildBody() {
    const g = new THREE.Group();
    this.bodyGroup = g;

    // ---- materials (cool, waxy post-mortem skin) ----
    const suit = new THREE.MeshStandardMaterial({ color: 0x272d38, roughness: 0.85 });
    const suitDark = new THREE.MeshStandardMaterial({ color: 0x181d25, roughness: 0.9 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xcfcfc6, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x7a5641, roughness: 0.78 });
    const skinGrey = new THREE.MeshStandardMaterial({ color: 0x5d4436, roughness: 0.85 });
    const bald = new THREE.MeshStandardMaterial({ color: 0x6a4a37, roughness: 0.6 });
    const stubble = new THREE.MeshStandardMaterial({ color: 0x2a221d, roughness: 1 });
    const hairSide = new THREE.MeshStandardMaterial({ color: 0x3b3733, roughness: 1 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0x0e0c0b, roughness: 0.32, metalness: 0.08 });
    const sock = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.95 });
    const wound = new THREE.MeshStandardMaterial({ color: 0x300808, roughness: 0.5 });
    const trouser = new THREE.MeshStandardMaterial({ color: 0x222833, roughness: 0.88 });

    const sphere = (r, mat, x, y, z, sx, sy, sz) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), mat);
      m.position.set(x, y, z); m.scale.set(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz);
      g.add(m); return m;
    };
    const limb = (r1, r2, a, b, mat) => {  // tapered limb segment between two points
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      const len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 14, 1), mat);
      m.position.copy(mid);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      g.add(m); return m;
    };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    // ================= torso (lying on his back, along +z) =================
    // pelvis -> belly -> chest -> shoulders, all low to the floor
    sphere(0.23, suit, 0, 0.16, 0.30, 1.25, 0.62, 1.0);
    sphere(0.24, suit, 0, 0.19, 0.05, 1.15, 0.72, 1.05);
    sphere(0.27, suit, 0, 0.21, -0.22, 1.22, 0.8, 1.0);
    sphere(0.26, suit, 0, 0.21, -0.45, 1.35, 0.72, 0.85);

    // open jacket lapels + shirt front
    const shirtFront = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.5), shirt);
    shirtFront.position.set(0, 0.42, -0.25); shirtFront.rotation.x = 0.06; g.add(shirtFront);
    const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.028, 0.42), suitDark);
    lapelL.position.set(-0.13, 0.435, -0.24); lapelL.rotation.y = 0.16; g.add(lapelL);
    const lapelR = lapelL.clone(); lapelR.position.x = 0.13; lapelR.rotation.y = -0.16; g.add(lapelR);
    // collar + loosened tie
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.1), shirt);
    collar.position.set(0, 0.34, -0.55); g.add(collar);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.34), new THREE.MeshStandardMaterial({ color: 0x5b1f24, roughness: 0.85 }));
    tie.position.set(0.05, 0.4, -0.34); tie.rotation.y = 0.35; g.add(tie);
    // shirt buttons line
    this._box(g, 0.012, 0.02, 0.34, new THREE.MeshStandardMaterial({ color: 0xa8a89e, roughness: 0.5 }), 0, 0.435, -0.25);

    // ================= the wound (left chest = +x side as he lies back) =================
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.035, 18), wound);
    hole.rotation.x = -Math.PI / 2; hole.rotation.z = 0.2;
    hole.position.set(0.13, 0.455, -0.3); g.add(hole);
    const abrade = new THREE.Mesh(new THREE.RingGeometry(0.036, 0.075, 20),
      new THREE.MeshStandardMaterial({ color: 0x4a2020, roughness: 0.9, transparent: true, opacity: 0.85 }));
    abrade.rotation.x = -Math.PI / 2; abrade.position.set(0.13, 0.452, -0.3); g.add(abrade);
    // powder burn / singed shirt
    const burn = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20),
      new THREE.MeshStandardMaterial({ color: 0x15110e, roughness: 1, transparent: true, opacity: 0.55 }));
    burn.rotation.x = -Math.PI / 2; burn.position.set(0.135, 0.45, -0.31); g.add(burn);
    // blood running down the shirt toward the floor
    for (let i = 0; i < 5; i++) {
      const drip = new THREE.Mesh(new THREE.BoxGeometry(0.02 + rng() * 0.02, 0.012, 0.09 + rng() * 0.14), this.m.blood);
      drip.position.set(0.1 + rng() * 0.09, 0.44 - i * 0.02, -0.38 + i * 0.08);
      drip.rotation.y = rng() * 0.4; g.add(drip);
    }

    // ================= neck + head (bald, grey stubble) =================
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.085, 0.16, 14), skinGrey);
    neck.position.set(0, 0.24, -0.62); neck.rotation.x = 1.2; g.add(neck);

    const head = sphere(0.115, bald, 0, 0.235, -0.79, 1.0, 0.98, 1.16);
    // face: jaw, cheeks, brow so the head is not a ball
    sphere(0.09, skin, 0, 0.2, -0.85, 1.0, 0.7, 0.85);
    sphere(0.035, skin, -0.055, 0.225, -0.885, 1, 1, 0.8);   // cheek L
    sphere(0.035, skin, 0.055, 0.225, -0.885, 1, 1, 0.8);    // cheek R
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.06, 10), skin);
    nose.position.set(0, 0.235, -0.905); nose.rotation.x = -Math.PI / 2; g.add(nose);
    sphere(0.045, skin, 0, 0.268, -0.888, 1.4, 0.6, 0.7);     // brow ridge
    // closed eyes: lid crease + lash shadow
    for (const sx of [-1, 1]) {
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.008, 0.012), stubble);
      lid.position.set(sx * 0.042, 0.252, -0.898); lid.rotation.y = sx * 0.18; g.add(lid);
      sphere(0.017, skinGrey, sx * 0.042, 0.248, -0.905, 1.2, 0.7, 0.6);
    }
    // mouth, slightly open
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.012, 0.014), new THREE.MeshStandardMaterial({ color: 0x2b1a18, roughness: 1 }));
    mouth.position.set(0.005, 0.192, -0.895); g.add(mouth);
    // ears
    for (const sx of [-1, 1]) sphere(0.028, skin, sx * 0.113, 0.232, -0.78, 0.5, 1.1, 0.9);
    // BALD crown + grey horseshoe of hair at the sides/back (this is the
    // detail that makes the brown hair on the guest chair a clue)
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.118, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.42),
      new THREE.MeshStandardMaterial({ color: 0x75523d, roughness: 0.55 }));
    crown.position.set(0, 0.238, -0.79); crown.scale.set(1, 1, 1.14); g.add(crown);
    for (const sx of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10, 0, Math.PI * 0.55, Math.PI * 0.35, Math.PI * 0.42), hairSide);
      strip.position.set(sx * 0.005, 0.232, -0.79); strip.rotation.y = sx * 1.9; strip.scale.set(1, 0.95, 1.12);
      g.add(strip);
    }
    const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.117, 16, 12, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.5), hairSide);
    backHair.position.set(0, 0.235, -0.79); backHair.scale.set(1.02, 1.0, 1.18); g.add(backHair);
    // stubble on the jaw
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.4), stubble);
    beard.position.set(0, 0.215, -0.81); beard.scale.set(1.05, 0.9, 1.1); g.add(beard);

    // ================= arms =================
    // right arm: flung out to the side, elbow bent, hand open near the casing
    const rSh = V(0.33, 0.3, -0.42), rEl = V(0.56, 0.2, -0.2), rWr = V(0.7, 0.1, -0.55);
    limb(0.082, 0.068, rSh, rEl, suit);
    limb(0.068, 0.056, rEl, rWr, suit);
    sphere(0.075, suit, rSh.x, rSh.y, rSh.z, 1.1, 0.9, 1.1);           // shoulder cap
    sphere(0.062, suit, rEl.x, rEl.y, rEl.z, 1, 1, 1);                  // elbow
    // shirt cuff
    const cuffR = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.055, 0.05, 12), shirt);
    cuffR.position.set(rWr.x, rWr.y + 0.01, rWr.z + 0.06); cuffR.quaternion.setFromUnitVectors(V(0, 1, 0), rWr.clone().sub(rEl).normalize()); g.add(cuffR);
    const rHand = sphere(0.062, skin, rWr.x + 0.02, rWr.y - 0.01, rWr.z - 0.11, 0.75, 0.5, 1.25);
    rHand.rotation.x = -0.3;
    for (let f = 0; f < 4; f++) {   // spread fingers, reached for something
      const fg = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.055, 4, 8), skin);
      fg.position.set(rWr.x + 0.04 + (f - 1.5) * 0.022, rWr.y - 0.02, rWr.z - 0.19);
      fg.rotation.x = Math.PI / 2 - 0.25 + (f - 1.5) * 0.12;
      g.add(fg);
    }
    const thumbR = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.05, 4, 8), skin);
    thumbR.position.set(rWr.x - 0.02, rWr.y - 0.02, rWr.z - 0.13); thumbR.rotation.z = 0.8; g.add(thumbR);

    // left arm: tucked under, mostly hidden by the body
    const lSh = V(-0.33, 0.29, -0.4), lEl = V(-0.52, 0.13, 0.05), lWr = V(-0.42, 0.08, 0.36);
    limb(0.082, 0.068, lSh, lEl, suitDark);
    limb(0.066, 0.054, lEl, lWr, suitDark);
    sphere(0.075, suitDark, lSh.x, lSh.y, lSh.z, 1.1, 0.9, 1.1);
    sphere(0.058, skin, lWr.x - 0.02, lWr.y - 0.01, lWr.z + 0.08, 0.8, 0.5, 1.1);

    // ================= legs =================
    // left leg out straight, right leg bent at the knee (he slid off the chair)
    const hipL = V(-0.13, 0.14, 0.34), knL = V(-0.19, 0.12, 0.78), anL = V(-0.21, 0.1, 1.2);
    limb(0.1, 0.078, hipL, knL, trouser);
    limb(0.076, 0.06, knL, anL, trouser);
    sphere(0.085, trouser, knL.x, knL.y, knL.z);
    const hipR = V(0.14, 0.15, 0.32), knR = V(0.3, 0.24, 0.7), anR = V(0.2, 0.1, 1.06);
    limb(0.1, 0.078, hipR, knR, trouser);
    limb(0.076, 0.06, knR, anR, trouser);
    sphere(0.09, trouser, knR.x, knR.y, knR.z);
    // crease line down each trouser
    const crease = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.8), new THREE.MeshStandardMaterial({ color: 0x171c26, roughness: 0.9 }));
    crease.position.set(-0.19, 0.21, 0.78); crease.rotation.x = 0.06; g.add(crease);
    // socks + shoes
    for (const [a, rot] of [[anL, -0.1], [anR, 0.25]]) {
      const sockM = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.055, 0.1, 12), sock);
      sockM.position.set(a.x, a.y + 0.01, a.z + 0.05); sockM.rotation.x = Math.PI / 2; g.add(sockM);
      const sh = sphere(0.085, shoe, a.x, a.y - 0.005, a.z + 0.16, 0.82, 0.5, 1.5);
      sh.rotation.y = rot;
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.025, 0.28), new THREE.MeshStandardMaterial({ color: 0x08070a, roughness: 1 }));
      sole.position.set(a.x, a.y - 0.045, a.z + 0.16); sole.rotation.y = rot; g.add(sole);
    }

    // ---- place him: on the floor in front of the desk, half turned ----
    g.position.set(-1.45, 0, -2.35);
    g.rotation.y = -0.5;
    this.level.add(g);

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
  _addAura(pos, r, color) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
      uniforms: {
        uTime: this.uv.uTime, uFocus: { value: 0 },
        uColor: { value: new THREE.Color(color) }, uPhase: { value: rng() * 6.28 },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat);
    m.position.copy(pos); m.userData.noShadow = true;
    this.level.add(m);
    return m;
  }

  _addClue(id, group, hitSize, pos, auraR, opts = {}) {
    const hit = this._ghost(this.level, hitSize[0], hitSize[1], hitSize[2], pos.x, pos.y, pos.z);
    const clue = {
      id, def: CASE.clues[id], group, hit, pos: pos.clone(),
      uv: !!opts.uv, lit: true, found: false, onCollect: opts.onCollect || null,
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
      this.level.add(g);
      this._addClue('casing', g, [0.4, 0.26, 0.4], new THREE.Vector3(-2.02, 0.12, -3.0), 0.17,
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
      g.position.set(0, 0.55, 0.02);
      this.guestChair.group.add(g);
      this._addClue('hair', g, [0.62, 0.42, 0.62],
        new THREE.Vector3(1.5, 0.66, -1.4), 0.36,
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
        g.strokeStyle = '#6a6458'; g.lineWidth = 4;
        g.strokeText('K.P.', 18, 46); g.font = 'italic bold 34px serif'; g.fillStyle = '#3a352c';
        g.fillText('K.P.', 18, 46);
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

    // ---- 6. torn note, hidden UNDER the pushable box ----
    {
      const tex = canvasTex(256, 256, (g, w, h) => {
        g.beginPath(); g.moveTo(10, 14);
        for (let x = 10; x < 246; x += 14) g.lineTo(x, 10 + rng() * 8);
        g.lineTo(246, 120);
        for (let y = 120; y < 244; y += 14) g.lineTo(240 - rng() * 10, y);
        for (let x = 246; x > 10; x -= 14) g.lineTo(x, 238 + rng() * 10);
        g.lineTo(10, 244); g.closePath();
        g.fillStyle = '#d8d0b8'; g.fill();
        g.clip();
        g.fillStyle = '#2a2a3a'; g.font = '22px cursive, serif';
        ['...the marks were', 'changed before the', 'board met. Three names', 'on the list, and one of', 'them is lying to you.'].forEach((l, i) => g.fillText(l, 22, 56 + i * 34));
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32),
        new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = 0.5; mesh.position.set(-3.4, 0.016, -2.3);
      mesh.userData.noShadow = true;
      this.level.add(mesh);
      const c = this._addClue('note', mesh, [0.44, 0.08, 0.44], new THREE.Vector3(-3.4, 0.05, -2.3), 0.22,
        { onCollect: () => { mesh.visible = false; } });
      c.aura.position.y = 0.08;
    }

    // ---- 7. wiped blood trail + a dying scrawl — UV ONLY (shader reveal) ----
    {
      const printTex = canvasTex(64, 128, (g, w, h) => {
        g.fillStyle = '#fff';
        g.beginPath(); g.ellipse(32, 42, 20, 36, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(32, 102, 14, 20, 0, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 6; i++) g.fillRect(14, 16 + i * 10, 36, 2);
      });
      const start = new THREE.Vector2(1.7, -1.75), mid = new THREE.Vector2(4.6, 0.6), end = new THREE.Vector2(6.4, 3.6);
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
      this._uvMesh(smearTex, 1.1, 0.3, new THREE.Vector3(3.4, 0.024, -0.4), 0.9);

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
      this._addClue('trail', dummy, [0.7, 0.16, 0.7], new THREE.Vector3(4.6, 0.08, 0.6), 0.36, { uv: true });
    }

    // ---- 8. desk calendar — a circled city meeting booked for tomorrow ----
    {
      const tex = canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = '#efe7d2'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#8a2b25'; g.fillRect(0, 0, w, 50);
        g.fillStyle = '#fff'; g.font = 'bold 28px sans-serif'; g.fillText('OCTOBER', 74, 34);
        const cols = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        g.fillStyle = '#5a5240'; g.font = 'bold 13px sans-serif';
        for (let c = 0; c < 7; c++) g.fillText(cols[c], 34 + c * 30, 74);
        g.font = '15px sans-serif';
        let d = 1;
        for (let row = 0; row < 5; row++) {
          for (let c = 0; c < 7; c++) {
            if (d <= 31) { g.fillStyle = '#3a352c'; g.fillText(String(d), 34 + c * 30, 100 + row * 26); d++; }
          }
        }
        // ring "tomorrow" (the 16th) twice in red
        const dayN = 16, cc = (dayN - 1) % 7, cr = Math.floor((dayN - 1) / 7);
        const gx = 34 + cc * 30 + 6, gy = 100 + cr * 26 - 5;
        g.strokeStyle = '#c0241b'; g.lineWidth = 2.5;
        g.beginPath(); g.ellipse(gx, gy, 13, 11, 0, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.ellipse(gx, gy, 17, 15, 0, 0, Math.PI * 2); g.stroke();
        // handwritten scribble along the bottom
        g.fillStyle = '#2a2f6a'; g.font = 'italic 16px "Segoe Script", cursive';
        g.fillText('CITY, 14:00', 22, 234);
        g.fillText('depot - bring it', 22, 252);
      });
      const g = new THREE.Group();
      g.position.set(-1.3, 0.795, -4.7);
      g.rotation.y = -0.5;
      this._box(g, 0.26, 0.02, 0.18, new THREE.MeshStandardMaterial({ color: 0x2a2334, roughness: 0.85 }), 0, 0.01, 0);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, side: THREE.DoubleSide }));
      face.position.set(0, 0.15, 0.02); face.rotation.x = -0.16; face.userData.noShadow = true; g.add(face);
      this.level.add(g);
      this._addClue('calendar', g, [0.4, 0.4, 0.4], new THREE.Vector3(-1.3, 0.95, -4.7), 0.24,
        { onCollect: () => { g.visible = false; } });
    }
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
    ui.cross = mk('div', 'position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:rgba(255,235,190,.6);box-shadow:0 0 6px rgba(0,0,0,.8);transition:all .12s;', ui.root);
    ui.counter = mk('div', 'position:absolute;left:18px;top:16px;font-size:15px;letter-spacing:2px;text-shadow:0 0 8px #000;', ui.root);
    ui.objective = mk('div', 'position:absolute;left:18px;top:38px;font-size:11px;letter-spacing:1px;opacity:.65;text-shadow:0 0 8px #000;', ui.root, 'DR. T. NKOSI — DEAD, SINGLE GUNSHOT WOUND');
    ui.hint = mk('div', 'position:absolute;left:18px;bottom:14px;font-size:12px;opacity:.7;text-shadow:0 0 6px #000;', ui.root,
      '[E] examine &nbsp; [F] UV torch &nbsp; [C] case file');
    ui.prompt = mk('div', 'position:absolute;left:50%;top:56%;transform:translateX(-50%);font-size:16px;padding:6px 14px;background:rgba(0,0,0,.55);border:1px solid rgba(242,217,160,.45);display:none;text-shadow:0 0 6px #000;', ui.root);
    ui.toast = mk('div', 'position:absolute;left:50%;bottom:11%;transform:translateX(-50%);width:min(640px,88vw);padding:12px 16px;background:rgba(8,8,12,.82);border-left:3px solid #f2b84b;font-size:14px;line-height:1.45;display:none;', ui.root);
    ui.uvTag = mk('div', 'position:absolute;right:18px;top:16px;font-size:13px;letter-spacing:2px;color:#b58cff;display:none;text-shadow:0 0 10px #7a3cff;', ui.root, 'UV LAMP ON');

    ui.case = mk('div', 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(3,4,7,.9);z-index:9999;font-family:"Courier New",monospace;');
    ui.outro = mk('div', 'position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:radial-gradient(ellipse at 50% 45%, rgba(8,10,16,.96), rgba(2,3,5,.99));z-index:10000;font-family:"Courier New",monospace;color:#e9d9b0;pointer-events:auto;');
    this._updateCounter();
  }

  _updateCounter() {
    const n = this.clues.filter((c) => c.found).length;
    this.ui.counter.textContent = `EVIDENCE  ${n} / ${this.clues.length}`;
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
    this._lockEl = document.pointerLockElement || null;
    if (document.exitPointerLock) document.exitPointerLock();
    this.ui.prompt.style.display = 'none';

    const has = (id) => this.clues.find((c) => c.id === id).found;
    const done = this.clues.every((c) => c.found);
    const unk = '<i style="opacity:.55">??? — keep investigating</i>';

    const how = has('casing')
      ? 'A single 9mm round, entry to the left chest at close range. He was shot in the chair he sat in, then slid to the floor and died reaching for something.'
      : unk;
    const when = has('phone') && has('trail')
      ? 'Between 23:38 and 23:52. The visitor came up the back stairs at 23:38; the coffee-ring drying on the side cabinet and the still-warm chair put the shot inside fifteen minutes of that.'
      : (has('phone') ? 'After 23:31 — one more piece is needed to narrow it down.' : unk);
    const guest = has('glass') && has('hair')
      ? 'A guest drank whiskey with him, sat in the guest chair, and left without finishing the glass. Long brown hair in the cushion — the victim was bald.'
      : unk;
    const traces = has('handkerchief') && has('trail')
      ? 'The shooter bled a little from the right hand, wiped himself with his own linen ("K.P."), then mopped the spatter off the floor and walked out towards the back stairs.'
      : unk;
    const last = has('phone') ? `${CASE.lastSeenPlace}. He locked it up at about 23:19 and walked up to his office to meet someone.` : unk;
    const where = has('calendar')
      ? `A private meeting was ringed in his desk diary for tomorrow, 14:00, down at the depot in ${CASE.nextPlace}. It is on no official calendar — the clearest thread we have to pull.`
      : unk;

    const rows = this.clues.map((c) => c.found
      ? `<div style="margin:6px 0"><b>&#10003; ${c.def.name}</b><br><span style="opacity:.85">${c.def.finding}</span></div>`
      : `<div style="margin:6px 0;opacity:.45">&#9633; Unexamined item</div>`).join('');

    this.ui.case.innerHTML = `
      <div style="position:relative;width:min(820px,92vw);max-height:88vh;overflow:auto;background:#d9cba4;color:#1b1610;padding:28px 34px;box-shadow:0 0 60px #000;border-top:10px solid #b89b5e;">
        <div style="position:absolute;right:26px;top:22px;border:3px solid #a1241c;color:#a1241c;padding:2px 10px;transform:rotate(8deg);font-weight:bold;letter-spacing:3px;">CONFIDENTIAL</div>
        <div style="font-size:12px;letter-spacing:3px;opacity:.7">CASE FILE #001 ${done ? '— COMPLETE' : '— IN PROGRESS'}</div>
        <h2 style="margin:6px 0 2px;font-size:26px">${CASE.victim}</h2>
        <div style="opacity:.8">${CASE.role} &nbsp;|&nbsp; ${CASE.found}</div>
        <hr style="border:0;border-top:1px dashed #6b5a34;margin:16px 0">
        <div style="display:grid;grid-template-columns:110px 1fr;gap:8px 12px;font-size:15px">
          <b>CAUSE</b><div>${how}</div>
          <b>WHEN</b><div>${when}</div>
          <b>THE GUEST</b><div>${guest}</div>
          <b>TRACES</b><div>${traces}</div>
          <b>LAST SEEN</b><div>${last}</div>
          <b>WHERE NEXT</b><div>${where}</div>
        </div>
        <hr style="border:0;border-top:1px dashed #6b5a34;margin:16px 0">
        <b>EVIDENCE LOGGED</b>${rows}
        <div style="margin-top:22px;display:flex;gap:12px;justify-content:flex-end">
          ${done ? '' : '<button id="cf-close" style="font:inherit;padding:9px 18px;background:#1b1610;color:#d9cba4;border:0;cursor:pointer">Back to the room [C]</button>'}
          ${done ? `<button id="cf-go" style="font:inherit;padding:10px 20px;background:#a1241c;color:#fff;border:0;cursor:pointer;letter-spacing:1px">All evidence logged — close the room &rarr;</button>` : ''}
        </div>
      </div>`;
    this.ui.case.style.display = 'flex';

    const close = this.ui.case.querySelector('#cf-close');
    if (close) close.addEventListener('click', () => this._closeCaseFile());
    const go = this.ui.case.querySelector('#cf-go');
    if (go) go.addEventListener('click', () => { this._closeCaseFile(); this._openOutro(); });
  }

  _closeCaseFile() {
    this.caseOpen = false;
    this.ui.case.style.display = 'none';
    if (this._lockEl && this._lockEl.requestPointerLock) { try { this._lockEl.requestPointerLock(); } catch (e) { /* needs user gesture */ } }
  }

  // End-of-level cutscene: the investigator logs the evidence, takes it to the
  // lab, and sets off for the city contact the diary named -> Level 2.
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
        <button id="outro-continue" style="font:inherit;letter-spacing:1px;padding:12px 28px;background:#a1241c;color:#fff;border:0;cursor:pointer;opacity:0;animation:outroFade .7s ${(CASE.outro.length * 1.2).toFixed(2)}s forwards">Seal the evidence and send it to the lab &rarr;</button>
      </div>`;
    this.ui.outro.style.display = 'flex';

    const btn = this.ui.outro.querySelector('#outro-continue');
    if (btn) btn.addEventListener('click', () => this._showLabScreen());
  }

  // Second outro stage: the screen cuts to black while the evidence goes to
  // the lab, then offers the jump to the city (Level 2).
  _showLabScreen() {
    this.ui.outro.innerHTML = `
      <style>@keyframes labFadeIn{from{opacity:0}to{opacity:1}}</style>
      <div style="position:absolute;inset:0;background:#000;animation:labFadeIn 1.4s forwards"></div>
      <div style="position:relative;max-width:min(720px,88vw);font-size:15px;letter-spacing:4px;color:#f2b84b;opacity:0;animation:labFadeIn 1.2s 1.6s forwards">
        FORENSIC LAB — CENTRAL CITY
      </div>
      <p style="position:relative;max-width:min(680px,86vw);margin:26px auto 0;font-size:19px;line-height:1.7;color:#d7dde8;opacity:0;animation:labFadeIn 1.4s 2.4s forwards">
        The evidence has been sent to the lab. The results will be available in a few days.
      </p>
      <div style="position:relative;margin-top:48px;opacity:0;animation:labFadeIn 1s 4s forwards">
        <button id="outro-city" style="font:inherit;letter-spacing:1px;padding:12px 28px;background:#1f6f5c;color:#fff;border:0;cursor:pointer">Go to the City to continue the investigation &rarr;</button>
      </div>`;

    const btn = this.ui.outro.querySelector('#outro-city');
    if (btn) btn.addEventListener('click', () => {
      if (typeof window.__switchLevel === 'function') window.__switchLevel(CASE.nextLevel);
      else { this.ui.outro.style.display = 'none'; this.outroOpen = false; }
    });
  }

  // =========================================================
  // INPUT
  // =========================================================
  _handleKey(e) {
    if (e.repeat) return;
    if (this.outroOpen) return;
    if (e.code === 'KeyC') { this.caseOpen ? this._closeCaseFile() : this._openCaseFile(); return; }
    if (this.caseOpen) return;
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
    c.found = true;
    // remember across levels: the city case file shows what was really logged
    window.__caseProgress = window.__caseProgress || { l1: {} };
    window.__caseProgress.l1[c.id] = true;
    c.aura.visible = false;
    if (c.onCollect) c.onCollect();
    this.focus = null;
    this.ui.prompt.style.display = 'none';
    this._updateCounter();
    this._toast(`EVIDENCE ${this.clues.filter((x) => x.found).length}/${this.clues.length} — ${c.def.name.toUpperCase()}`, c.def.note, 11000);
    if (this.clues.every((x) => x.found)) {
      clearTimeout(this._caseTimer);
      this._caseTimer = setTimeout(() => this._openOutro(), 3500);
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
    const hitObj = hits.length ? hits[0].object : null;
    const clue = hitObj && hitObj.userData.clue ? hitObj.userData.clue : null;
    this.focus = clue;
    this.focusBody = !clue && !!(hitObj && hitObj.userData.body);
    if (clue) {
      clue.aura.material.uniforms.uFocus.value = 1;
      this.ui.prompt.textContent = `[E]  ${clue.def.name}`;
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

    // ---- first-person camera (no visible hands / torch / feet) ----
    const hasCam = !!(window.__camera && window.__camera.isCamera);
    if (hasCam && player && player.pos) this._applyFirstPerson(player);
    // dim the desk-lamp shade a touch while the UV lamp is out, so the toggle reads
    if (this.lampShadeMat) this.lampShadeMat.emissiveIntensity = this.uvOn ? 0.9 : 1.8;

    // lightning through the window, flickering tube, dying lamp
    this._nextFlash -= dt;
    if (this._nextFlash <= 0) { this._flashT = 0.45; this._nextFlash = 8 + rng() * 14; }
    this._flashT = Math.max(0, this._flashT - dt);
    const flash = this._flashT > 0 ? (0.5 + 0.5 * Math.sin(this._flashT * 45)) * Math.min(1, this._flashT * 4) : 0;
    this.winMat.uniforms.uFlash.value = flash * 0.9;
    this.moon.intensity = 20 + flash * 70;
    this.lamp.intensity = 8 + Math.sin(this.time * 9) * 0.16 + Math.sin(this.time * 23) * 0.1;
    // the ceiling tube buzzes and drops out every few seconds
    const flick = Math.sin(this.time * 11.5) * Math.sin(this.time * 3.1);
    const dropout = flick < -0.75 ? 0.15 : 1;
    this.tube.intensity = 2.4 * dropout * (0.9 + 0.1 * Math.sin(this.time * 40));
    this.tubeMat.emissiveIntensity = 0.9 * dropout;

    // UV lamp
    const hasView = this._updateView(player);
    this.uv.uUvOn.value += ((this.uvOn ? 1 : 0) - this.uv.uUvOn.value) * Math.min(1, dt * 10);
    if (hasView) {
      this.uv.uUvPos.value.copy(this._o);
      this.uv.uUvDir.value.copy(this._d);
      this.uvLight.position.copy(this._o).addScaledVector(this._d, 0.2);
      this.uvLight.target.position.copy(this._o).addScaledVector(this._d, 4);
    }
    this.uvLight.intensity = 40 * this.uv.uUvOn.value;

    // physics + interaction
    if (player && player.pos && !this.caseOpen && !this.outroOpen) this._stepMovables(dt, player);
    if (hasView && !this.caseOpen && !this.outroOpen) this._updateFocus();
  }

  // =========================================================
  // DISPOSE
  // =========================================================
  dispose() {
    clearTimeout(this._toastTimer);
    clearTimeout(this._caseTimer);
    window.removeEventListener('keydown', this._onKey);
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
