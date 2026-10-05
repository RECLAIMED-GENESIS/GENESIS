// ============================================================
// LEVEL 1 — THE VICTIM'S OFFICE
// A lecturer is found dead in his office late at night.
// One room, dim lighting, no NPCs. Find 6 clues (press E),
// then the CASE FILE screen explains how / when he died and
// points to the place he was last seen.
//
// Controls added by this level (the PLAYER itself is untouched —
// it is still the one created in main.js):
//   E  examine / collect the clue you are looking at
//   F  toggle UV torch (reveals hidden evidence)
//   C  open / close the case file
//
// Rubric coverage
//   * Player controls  – uses the existing player (player.pos),
//                        first-person look-at raycast + interaction
//   * Physics          – static Box3 colliders for walls/furniture
//                        (level.colliders, same format as before) AND
//                        pushable objects (chairs, boxes, bin) with
//                        sliding, friction, wall/furniture collision
//   * Shaders          – (1) UV torch reveal shader for hidden marks
//                        (2) pulsing fresnel "evidence glow" aura
//                        (3) rainy window shader with lightning
//
// The class name / public interface is the same as the old level
// (constructor, spawn, spawnYaw, colliders, update, dispose,
// getSurfaceHeight...) so main.js does not need to change.
// ============================================================
import * as THREE from 'three';

// ------------------------------------------------------------
// CASE DATA  — edit the story here
// ------------------------------------------------------------
const CASE = {
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
  clues: {
    cup: {
      name: 'Broken teacup',
      note: 'A teacup, shattered beside the body. The spilled tea has dried to a sticky film and smells sharply bitter, as if something chemical was stirred in.',
      finding: 'Tea laced with something bitter. No wounds: he collapsed mid-drink.',
    },
    phone: {
      name: 'His phone',
      note: 'Screen still lit. 23:05 Unknown: "Exam scripts. Your office, tonight." 23:19 Dr Nkosi: "Just locked up the Staff Common Room. Heading to my office." 23:31 Unknown: "Coming up the back stairs. Tell no one."',
      finding: 'Last message at 23:31. He expected a secret visitor, having just left the Staff Common Room.',
    },
    note: {
      name: 'Torn note',
      note: 'Hidden under the box of exam scripts. Handwritten, ripped in half: "...the marks were changed before the board met. Three names on the list, and one of them is lying to you."',
      finding: 'Someone altered exam marks. Three people could have done it; one is lying.',
    },
    keycard: {
      name: 'Staff access card',
      note: 'A staff card with the name rubbed off. The door log on the back reads: BACK STAIRS, 23:38.',
      finding: 'The visitor came through the back-stair door at 23:38, seven minutes after that last message.',
    },
    prints: {
      name: 'Wet footprints (UV)',
      note: 'Under the UV light: damp prints from the door to the guest chair, then a hurried, longer-strided trail back out. The visitor sat, talked, and left in a hurry.',
      finding: 'The visitor sat in the guest chair, shared tea with him, then fled.',
    },
    drawer: {
      name: 'Desk drawer',
      note: 'Bottom drawer: a foam cut-out in the shape of a USB drive, labelled "EXAM SCRIPTS - BACKUP". It is empty. Someone took the drive.',
      finding: 'The missing backup drive links the murder to the marks scandal.',
    },
  },
};

const REACH = 3.2;       // how far the player can examine things
const PLAYER_R = 0.38;   // radius used when the player pushes objects

// ------------------------------------------------------------
// small helpers
// ------------------------------------------------------------
let _seed = 1337;
const rng = () => (_seed = (_seed * 16807) % 2147483647) / 2147483647;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
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
varying vec2 vUv; varying vec3 vWorld;
void main(){
  vec3 toP = vWorld - uUvPos;
  float dist = length(toP);
  float c = dot(toP / max(dist, 0.001), uUvDir);
  float cone = smoothstep(uUvCos, uUvCos + 0.05, c);
  float atten = 1.0 / (1.0 + 0.12 * dist * dist);
  float a = texture2D(uMap, vUv).a * cone * atten * uUvOn;
  float shimmer = 0.85 + 0.15 * sin(uTime * 3.0 + vWorld.x * 4.0 + vWorld.z * 3.0);
  vec3 col = mix(vec3(0.35, 0.55, 1.0), vec3(0.8, 0.5, 1.0), vUv.y);
  gl_FragColor = vec4(col * a * 2.4 * shimmer, a);
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
  float a = fres * pulse * (0.55 + uFocus * 1.3);
  gl_FragColor = vec4(uColor * a * 1.5, a);
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
    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x07080d, 0.025);

    this.name = "LEVEL 1 — THE VICTIM'S OFFICE";
    this.colliders = [];
    this.level = new THREE.Group();
    this.root = this.level;
    this.scene.add(this.level);

    this.time = 0;
    this.spawn = new THREE.Vector3(6.5, 0, 5.0);
    this.spawnYaw = Math.PI;

    // room: x -6..6, z -4.5..4.5, height 3.4
    // Larger office: x -9..9, z -6.5..6.5, height 3.6
        this.W = 18;
        this.D = 13;
        this.H = 3.6;

    this.clues = [];
    this.movables = [];
    this.occluders = [];       // invisible boxes that block the examine ray
    this.timeMats = [];
    this.uvOn = false;
    this.caseOpen = false;
    this.focus = null;
    this._nextFlash = 6;
    this._flashT = 0;
    this._drawerT = -1;

    // temp vectors
    this._o = new THREE.Vector3(); this._d = new THREE.Vector3(0, 0, -1);
    this._v = new THREE.Vector3(); this._rc = new THREE.Raycaster();

    // shared UV uniforms (every UV-reactive material references these objects)
    this.uv = {
      uTime: { value: 0 },
      uUvOn: { value: 0 },
      uUvCos: { value: Math.cos(0.42) },
      uUvPos: { value: new THREE.Vector3() },
      uUvDir: { value: new THREE.Vector3(0, 0, -1) },
    };

    this._makeMaterials();
    this._buildRoom();
    this._buildLighting();
    this._buildFurniture();
    this._buildBody();
    this._buildClues();
    this._buildUI();

    // shadows on everything built so far
    this.level.traverse((o) => {
      if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; }
    });
    this.level.updateMatrixWorld(true);

    this._onKey = (e) => this._handleKey(e);
    window.addEventListener('keydown', this._onKey);

    this._toast('INVESTIGATE', 'Find all 6 clues.  [E] examine   [F] UV torch   [C] case file', 7000);
  }

  // ---------- gameplay helpers (same names the old level exposed) ----------
  getSurfaceHeight() { return 0; }
  groundHeight() { return 0; }
  terrainHeight() { return 0; }
  _h() { return 0; }

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
          g.fillStyle = `hsl(${22 + rng() * 6}, ${32 + rng() * 10}%, ${14 + rng() * 9}%)`;
          g.fillRect(col * 64 + 1, y + 1, 62, len - 2);
          g.fillStyle = 'rgba(0,0,0,0.25)';
          for (let k = 0; k < 5; k++) g.fillRect(col * 64 + 4 + rng() * 54, y + rng() * len, 1, 10 + rng() * 30);
          y += len;
        }
      }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(3, 2.25);

    this.m = {
      floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.05 }),
      wall: new THREE.MeshStandardMaterial({ color: 0x2b2e37, roughness: 0.95 }),
      ceil: new THREE.MeshStandardMaterial({ color: 0x15161b, roughness: 1 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x4a2f20, roughness: 0.6 }),
      woodDark: new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.7 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x77808c, roughness: 0.4, metalness: 0.7 }),
      fabric: new THREE.MeshStandardMaterial({ color: 0x2c3a4a, roughness: 0.95 }),
      cardboard: new THREE.MeshStandardMaterial({ color: 0x9a7448, roughness: 0.9 }),
      paper: new THREE.MeshStandardMaterial({ color: 0xd9d2bf, roughness: 0.9 }),
      porcelain: new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.3 }),
      rug: new THREE.MeshStandardMaterial({ color: 0x4a2630, roughness: 1 }),
      ghost: null,
    };
  }

  _box(parent, w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
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
  // ROOM
  // =========================================================
  _buildRoom() {
    const { W, D, H } = this;
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
    wall(0, D / 2 + 0.15, W + 0.6, 0.3);    // front (door)
    wall(-W / 2 - 0.15, 0, 0.3, D);         // left
    wall(W / 2 + 0.15, 0, 0.3, D);          // right

    // wainscot + baseboard
    const wain = this.m.woodDark;
    this._box(this.level, W, 1.0, 0.04, wain, 0, 0.5, -D / 2 + 0.02);
    this._box(this.level, W, 1.0, 0.04, wain, 0, 0.5, D / 2 - 0.02);
    this._box(this.level, 0.04, 1.0, D, wain, -W / 2 + 0.02, 0.5, 0);
    this._box(this.level, 0.04, 1.0, D, wain, W / 2 - 0.02, 0.5, 0);

    // rug
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.8), this.m.rug);
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.008, -0.2);
    rug.userData.noShadow = true; this.level.add(rug);

    // ---- door (front wall, x = 3.5) ----
    const door = new THREE.Group(); door.position.set(3.5, 0, D / 2 - 0.06);
    this._box(door, 1.0, 2.2, 0.06, this.m.wood, 0, 1.1, 0);
    this._box(door, 0.1, 2.3, 0.1, this.m.woodDark, -0.58, 1.15, 0);
    this._box(door, 0.1, 2.3, 0.1, this.m.woodDark, 0.58, 1.15, 0);
    this._box(door, 1.26, 0.1, 0.1, this.m.woodDark, 0, 2.28, 0);
    this._box(door, 0.04, 0.04, 0.12, this.m.metal, 0.38, 1.05, 0.05);
    const leak = new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0xbfdcff, emissiveIntensity: 2.2 });
    const strip = this._box(door, 0.96, 0.012, 0.02, leak, 0, 0.012, 0.05);
    strip.userData.noShadow = true;
    this.level.add(door);

    // ---- window (back wall, x = 3.8) ----
    this.winMat = new THREE.ShaderMaterial({
      vertexShader: WIN_VERT, fragmentShader: WIN_FRAG,
      uniforms: { uTime: this.uv.uTime, uFlash: { value: 0 } },
    });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.3), this.winMat);
    pane.position.set(3.8, 1.9, -D / 2 + 0.02); pane.userData.noShadow = true;
    this.level.add(pane);
    const fr = this.m.woodDark;
    this._box(this.level, 2.1, 0.1, 0.12, fr, 3.8, 2.6, -D / 2 + 0.05);
    this._box(this.level, 2.1, 0.1, 0.12, fr, 3.8, 1.2, -D / 2 + 0.05);
    this._box(this.level, 0.1, 1.5, 0.12, fr, 2.8, 1.9, -D / 2 + 0.05);
    this._box(this.level, 0.1, 1.5, 0.12, fr, 4.8, 1.9, -D / 2 + 0.05);
    this._box(this.level, 0.05, 1.3, 0.1, fr, 3.8, 1.9, -D / 2 + 0.05);
    this._box(this.level, 1.9, 0.05, 0.1, fr, 3.8, 1.9, -D / 2 + 0.05);

    // diploma frames on the back wall
    for (let i = 0; i < 3; i++) {
      this._box(this.level, 0.5, 0.38, 0.03, this.m.woodDark, -3.6 + i * 0.7, 2.0, -D / 2 + 0.03);
      this._box(this.level, 0.42, 0.3, 0.035, this.m.paper, -3.6 + i * 0.7, 2.0, -D / 2 + 0.04);
    }
    // corkboard on the right wall
    this._box(this.level, 0.04, 1.0, 1.6, this.m.woodDark, W / 2 - 0.03, 1.7, 1.8);
    this._box(this.level, 0.03, 0.9, 1.5, new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1 }), W / 2 - 0.05, 1.7, 1.8);
    for (let i = 0; i < 6; i++) {
      const p = this._box(this.level, 0.01, 0.22, 0.17, this.m.paper, W / 2 - 0.07, 1.5 + rng() * 0.45, 1.25 + rng() * 1.1);
      p.rotation.x = (rng() - 0.5) * 0.3;
    }
  }

  // =========================================================
  // LIGHTING — dim; the desk lamp, a cold window and the door leak
  // =========================================================
_buildLighting() {
  // ----------------------------------------------------------
  // General nighttime atmosphere
  // ----------------------------------------------------------
  this.level.add(
    new THREE.HemisphereLight(
      0x263653,   // cool blue sky/night light
      0x100c09,   // warm/dark ground bounce
      0.75
    )
  );

  // Very soft overall fill so corners are still visible
  this.roomFill = new THREE.PointLight(
    0x7187b5,
    1.8,
    18,
    2
  );
  this.roomFill.position.set(0, 2.8, 0);
  this.level.add(this.roomFill);

  // ----------------------------------------------------------
  // Desk lamp — warm focal light
  // ----------------------------------------------------------
  this.lamp = new THREE.PointLight(
    0xffc27a,
    7,
    10,
    1.5
  );

  this.lamp.position.set(-0.8, 1.35, -3.15);
  this.lamp.castShadow = true;
  this.lamp.shadow.mapSize.set(512, 512);
  this.lamp.shadow.bias = -0.003;

  this.level.add(this.lamp);

  // ----------------------------------------------------------
  // Moonlight coming through the window
  // ----------------------------------------------------------
  this.moon = new THREE.SpotLight(
    0x6384c0,
    20,
    18,
    Math.PI / 3.0,
    0.85,
    1.2
  );

  this.moon.position.set(3.8, 3.0, -5.5);
  this.moon.target.position.set(0, 0, 0);

  this.moon.castShadow = true;
  this.moon.shadow.mapSize.set(512, 512);

  this.level.add(this.moon, this.moon.target);

  // ----------------------------------------------------------
  // Soft secondary blue light deeper in the room
  // ----------------------------------------------------------
  this.backFill = new THREE.PointLight(
    0x4d638f,
    1.5,
    11,
    2
  );

  this.backFill.position.set(-4.5, 2.0, -1.5);
  this.level.add(this.backFill);

  // ----------------------------------------------------------
  // Light leaking under the door
  // ----------------------------------------------------------
  const leak = new THREE.PointLight(
    0x9fc0ff,
    1.8,
    5.5,
    2
  );

  leak.position.set(3.5, 0.2, 5.7);
  this.level.add(leak);

  // ----------------------------------------------------------
  // UV torch
  // ----------------------------------------------------------
  this.uvLight = new THREE.SpotLight(
    0x7a3cff,
    0,
    10,
    0.42,
    0.55,
    1.4
  );

  this.level.add(this.uvLight, this.uvLight.target);
}

  // =========================================================
  // FURNITURE
  // =========================================================
  _chair(x, z, rotY) {
    const g = new THREE.Group();
    this._box(g, 0.5, 0.08, 0.5, this.m.fabric, 0, 0.48, 0);
    this._box(g, 0.5, 0.55, 0.06, this.m.fabric, 0, 0.8, -0.23);
    for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
      this._box(g, 0.05, 0.46, 0.05, this.m.metal, lx, 0.23, lz);
    }
    g.rotation.y = rotY;
    this.level.add(g);
    return this._movable(g, x, z, 0.28, 0.28, 1.05, 1.0, 'chair');
  }

  _movable(group, x, z, hx, hz, h, ease, name) {
    group.position.set(x, 0, z);
    this.level.add(group);
    // invisible proxy, child of the group so it follows it; blocks the examine ray
    const proxy = this._ghost(group, hx * 2, h, hz * 2, 0, h / 2, 0);
    // proxy must not inherit the chair's rotation when measuring AABB, but ray blocking is fine either way
    this.occluders.push(proxy);
    const m = { group, x, z, hx, hz, h, ease, name, vx: 0, vz: 0 };
    this.movables.push(m);
    return m;
  }

  _bookcase(z0) {
    const g = new THREE.Group();
    const w = 2.4, d = 0.45, h = 2.3;
    this._box(g, w, h, 0.04, this.m.woodDark, 0, h / 2, -d / 2 + 0.02);
    this._box(g, 0.05, h, d, this.m.wood, -w / 2, h / 2, 0);
    this._box(g, 0.05, h, d, this.m.wood, w / 2, h / 2, 0);
    for (let i = 0; i < 5; i++) this._box(g, w, 0.04, d, this.m.wood, 0, 0.1 + i * 0.55, 0);
    this._box(g, w, 0.05, d, this.m.wood, 0, h, 0);
    // books (one instanced mesh)
    const per = 22, rows = 4;
    const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), per * rows);
    const M = new THREE.Matrix4(), c = new THREE.Color();
    let k = 0;
    for (let r = 0; r < rows; r++) {
      let x = -w / 2 + 0.1;
      for (let i = 0; i < per && x < w / 2 - 0.1; i++) {
        const bw = 0.04 + rng() * 0.05, bh = 0.28 + rng() * 0.16;
        M.compose(new THREE.Vector3(x + bw / 2, 0.12 + r * 0.55 + bh / 2, -0.02),
          new THREE.Quaternion(), new THREE.Vector3(bw, bh, 0.28));
        books.setMatrixAt(k, M);
        c.setHSL(rng(), 0.35, 0.18 + rng() * 0.15); books.setColorAt(k, c);
        k++; x += bw + 0.005;
      }
    }
    books.count = k; books.instanceMatrix.needsUpdate = true;
    if (books.instanceColor) books.instanceColor.needsUpdate = true;
    g.add(books);
    g.position.set(-W_HALF + 0.25, 0, z0);
    g.rotation.y = Math.PI / 2; // front faces +x
    this.level.add(g);
    this._static(-W_HALF + 0.25, z0, 0.225, 1.2, h);
  }

  _buildFurniture() {
    // ---- desk (back wall, faces the door) ----
    const desk = new THREE.Group();
    desk.position.set(0, 0, -2.9);
    this._box(desk, 2.3, 0.05, 1.05, this.m.wood, 0, 0.765, 0);
    this._box(desk, 0.5, 0.74, 0.9, this.m.woodDark, -0.9, 0.37, 0);
    this._box(desk, 0.5, 0.74, 0.9, this.m.woodDark, 0.9, 0.37, 0);
    this._box(desk, 1.3, 0.5, 0.04, this.m.woodDark, 0, 0.45, -0.43);
    // desk lamp
    this._box(desk, 0.18, 0.03, 0.18, this.m.metal, -0.8, 0.8, -0.25);
    this._box(desk, 0.03, 0.5, 0.03, this.m.metal, -0.8, 1.05, -0.25).rotation.z = 0.15;
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.2, 14, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x2f4a38, emissive: 0xffc27a, emissiveIntensity: 1.6, side: THREE.DoubleSide }));
    shade.position.set(-0.8, 1.27, -0.25); shade.userData.noShadow = true; desk.add(shade);
    // closed laptop, papers, a clean second cup
    this._box(desk, 0.34, 0.02, 0.24, this.m.metal, -0.3, 0.8, 0.05);
    this._box(desk, 0.24, 0.03, 0.32, this.m.paper, 0.15, 0.8, -0.1).rotation.y = 0.2;
    const cup2 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.07, 14), this.m.porcelain);
    cup2.position.set(0.0, 0.825, 0.3); desk.add(cup2);
    this.level.add(desk);
    this._static(0, -2.9, 1.15, 0.525, 0.78);
    this.desk = desk;

    // ---- chairs (pushable) ----
    this.victimChair = this._chair(0.1, -3.95, 0);       // behind the desk, faces +z
    this.guestChair = this._chair(0.5, -1.5, Math.PI);   // visitor's chair, faces the desk

    // ---- bookcases (left wall), filing cabinet (right wall) ----
    this._bookcase(-2.6);
    this._bookcase(0.3);

    const cab = new THREE.Group();
    this._box(cab, 0.7, 1.35, 0.6, this.m.metal, 0, 0.675, 0);
    for (let i = 0; i < 3; i++) {
      this._box(cab, 0.62, 0.38, 0.02, new THREE.MeshStandardMaterial({ color: 0x59616c, roughness: 0.5, metalness: 0.5 }), 0, 0.22 + i * 0.42, 0.3);
      this._box(cab, 0.2, 0.03, 0.03, this.m.woodDark, 0, 0.3 + i * 0.42, 0.33);
    }
    cab.position.set(W_HALF - 0.35, 0, -1.6);
    cab.rotation.y = -Math.PI / 2; // front faces -x
    this.level.add(cab);
    this._static(W_HALF - 0.35, -1.6, 0.3, 0.35, 1.35);

    // ---- pushable boxes / bin ----
    const mkBox = (w, h, d, label) => {
      const g = new THREE.Group();
      this._box(g, w, h, d, this.m.cardboard, 0, h / 2, 0);
      this._box(g, w + 0.01, 0.04, 0.12, new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.6 }), 0, h + 0.002, 0);
      if (label) this._box(g, 0.3, 0.2, 0.01, this.m.paper, 0, h * 0.55, d / 2 + 0.006);
      return g;
    };
    // this big box hides the torn note
    this.noteBox = this._movable(mkBox(0.9, 0.55, 0.8, true), -3.2, -1.2, 0.45, 0.4, 0.58, 0.55, 'box');
    this._movable(mkBox(0.7, 0.5, 0.6, true), -4.7, 2.6, 0.35, 0.3, 0.52, 0.55, 'box');
    this._movable(mkBox(0.5, 0.4, 0.5, false), -2.3, 3.4, 0.25, 0.25, 0.42, 0.8, 'box');

    const bin = new THREE.Group();
    const binMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.38, 14, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }));
    binMesh.position.y = 0.19; bin.add(binMesh);
    for (let i = 0; i < 3; i++) {
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), this.m.paper);
      ball.position.set((rng() - 0.5) * 0.15, 0.36, (rng() - 0.5) * 0.15); bin.add(ball);
    }
    this._movable(bin, 1.75, -2.45, 0.2, 0.2, 0.4, 1.0, 'bin');
  }

  // =========================================================
  // THE BODY (stylised, no gore)
  // =========================================================
_buildBody() {
  const g = new THREE.Group();

  // ----------------------------------------------------------
  // Materials
  // ----------------------------------------------------------
  const suit = new THREE.MeshStandardMaterial({
    color: 0x252b36,
    roughness: 0.82
  });

  const suitDark = new THREE.MeshStandardMaterial({
    color: 0x171c24,
    roughness: 0.9
  });

  const shirt = new THREE.MeshStandardMaterial({
    color: 0xd5d4cc,
    roughness: 0.88
  });

  const skin = new THREE.MeshStandardMaterial({
    color: 0x6d4a38,
    roughness: 0.72
  });

  const skinDark = new THREE.MeshStandardMaterial({
    color: 0x563829,
    roughness: 0.8
  });

  const shoe = new THREE.MeshStandardMaterial({
    color: 0x100d0c,
    roughness: 0.35,
    metalness: 0.05
  });

  const hair = new THREE.MeshStandardMaterial({
    color: 0x17120f,
    roughness: 0.95
  });

  // ----------------------------------------------------------
  // Torso
  // ----------------------------------------------------------
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.55, 6, 12),
    suit
  );

  torso.scale.set(1.0, 0.55, 1.25);
  torso.position.set(0, 0.23, 0);
  torso.rotation.x = Math.PI / 2;
  g.add(torso);

  // Shirt visible at chest
  const shirtPanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.035, 0.34),
    shirt
  );

  shirtPanel.position.set(0, 0.43, -0.13);
  g.add(shirtPanel);

  // Tie
  const tie = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.035, 0.22),
    new THREE.MeshStandardMaterial({
      color: 0x222b3d,
      roughness: 0.8
    })
  );

  tie.position.set(0, 0.45, -0.18);
  g.add(tie);

  // ----------------------------------------------------------
  // Neck
  // ----------------------------------------------------------
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.085, 0.12, 12),
    skin
  );

  neck.position.set(0, 0.25, -0.43);
  neck.rotation.x = Math.PI / 2;
  g.add(neck);

  // ----------------------------------------------------------
  // Head
  // ----------------------------------------------------------
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 18, 14),
    skin
  );

  head.scale.set(0.9, 1.0, 1.05);
  head.position.set(0, 0.25, -0.57);
  g.add(head);

  // Hair
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.165, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
    hair
  );

  hairCap.position.set(0, 0.29, -0.57);
  g.add(hairCap);

  // Ear
  const ear1 = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 10, 8),
    skinDark
  );

  ear1.position.set(-0.145, 0.25, -0.57);
  g.add(ear1);

  const ear2 = ear1.clone();
  ear2.position.x = 0.145;
  g.add(ear2);

  // ----------------------------------------------------------
  // Arms
  // ----------------------------------------------------------
  const upperArmGeo = new THREE.CapsuleGeometry(0.075, 0.38, 5, 10);
  const foreArmGeo = new THREE.CapsuleGeometry(0.065, 0.30, 5, 10);

  // Right arm — naturally bent
  const rightUpper = new THREE.Mesh(upperArmGeo, suit);
  rightUpper.position.set(0.32, 0.22, -0.03);
  rightUpper.rotation.z = -0.65;
  rightUpper.rotation.x = 0.25;
  g.add(rightUpper);

  const rightFore = new THREE.Mesh(foreArmGeo, suit);
  rightFore.position.set(0.51, 0.14, -0.20);
  rightFore.rotation.z = -0.95;
  rightFore.rotation.x = 0.15;
  g.add(rightFore);

  const rightHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 12, 10),
    skin
  );

  rightHand.scale.set(0.85, 0.7, 1.0);
  rightHand.position.set(0.66, 0.08, -0.34);
  g.add(rightHand);

  // Left arm — resting on the floor
  const leftUpper = new THREE.Mesh(upperArmGeo, suit);
  leftUpper.position.set(-0.32, 0.20, 0.02);
  leftUpper.rotation.z = 0.55;
  leftUpper.rotation.x = -0.15;
  g.add(leftUpper);

  const leftFore = new THREE.Mesh(foreArmGeo, suitDark);
  leftFore.position.set(-0.50, 0.12, 0.04);
  leftFore.rotation.z = 0.8;
  g.add(leftFore);

  const leftHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 12, 10),
    skin
  );

  leftHand.position.set(-0.63, 0.065, 0.08);
  g.add(leftHand);

  // ----------------------------------------------------------
  // Legs
  // ----------------------------------------------------------
  const legGeo = new THREE.CapsuleGeometry(0.095, 0.48, 5, 10);

  const leftLeg = new THREE.Mesh(legGeo, suit);
  leftLeg.position.set(-0.13, 0.105, 0.55);
  leftLeg.rotation.x = -0.02;
  leftLeg.rotation.z = -0.04;
  g.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, suit);
  rightLeg.position.set(0.13, 0.105, 0.60);
  rightLeg.rotation.x = 0.04;
  rightLeg.rotation.z = 0.05;
  g.add(rightLeg);

  // ----------------------------------------------------------
  // Shoes
  // ----------------------------------------------------------
  const leftShoe = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 8),
    shoe
  );

  leftShoe.scale.set(0.85, 0.45, 1.35);
  leftShoe.position.set(-0.13, 0.055, 0.91);
  g.add(leftShoe);

  const rightShoe = leftShoe.clone();
  rightShoe.position.set(0.14, 0.055, 0.97);
  g.add(rightShoe);

  // ----------------------------------------------------------
  // Put the victim into the scene
  // ----------------------------------------------------------
  g.position.set(-1.0, 0, -0.45);
  g.rotation.y = 0.35;

  this.level.add(g);

  // Collider around the body
  this._static(
    -1.0,
    -0.15,
    0.58,
    0.95,
    0.38
  );
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
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat);
    m.position.copy(pos); m.userData.noShadow = true;
    this.level.add(m);
    return m;
  }

  _addClue(id, group, hitSize, pos, auraR, opts = {}) {
    const hit = this._ghost(this.level, hitSize[0], hitSize[1], hitSize[2], pos.x, pos.y, pos.z);
    const clue = {
      id, def: CASE.clues[id], group, hit, pos: pos.clone(),
      uv: !!opts.uv, lit: false, found: false, onCollect: opts.onCollect || null,
      aura: this._addAura(pos, auraR, opts.uv ? 0x9a6aff : 0xffd27a),
    };
    hit.userData.clue = clue;
    this.clues.push(clue);
    return clue;
  }

  _buildClues() {
    // ---- 1. broken teacup next to the body ----
    {
      const g = new THREE.Group(); g.position.set(-0.25, 0, -0.6);
      const stain = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24),
        new THREE.MeshStandardMaterial({ color: 0x2a1608, roughness: 0.2, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }));
      stain.rotation.x = -Math.PI / 2; stain.position.y = 0.014; stain.userData.noShadow = true; g.add(stain);
      for (let i = 0; i < 9; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.04 + rng() * 0.05, 0.012, 0.03 + rng() * 0.04), this.m.porcelain);
        const a = rng() * 6.28, r = rng() * 0.26;
        s.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
        s.rotation.set((rng() - 0.5) * 0.4, rng() * 6.28, (rng() - 0.5) * 0.4); g.add(s);
      }
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 6, 10, Math.PI), this.m.porcelain);
      handle.position.set(0.1, 0.03, 0.08); handle.rotation.x = Math.PI / 2; g.add(handle);
      this.level.add(g);
      this._addClue('cup', g, [0.7, 0.3, 0.7], new THREE.Vector3(-0.25, 0.15, -0.6), 0.34);
    }

    // ---- 2. phone on the desk with the last message ----
    {
      const screenTex = canvasTex(224, 448, (g, w, h) => {
        g.fillStyle = '#0b0f16'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#1a2230'; g.fillRect(0, 0, w, 44);
        g.fillStyle = '#fff'; g.font = 'bold 18px sans-serif'; g.fillText('Unknown', 12, 29);
        const msgs = [
          { me: false, t: '23:05', s: 'Exam scripts. Your office, tonight.' },
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
      });
      const g = new THREE.Group(); g.position.set(0.55, 0.79, -2.85); g.rotation.y = 0.4;
      this._box(g, 0.075, 0.012, 0.155, new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.3 }), 0, 0, 0);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.136), new THREE.MeshBasicMaterial({ map: screenTex }));
      screen.rotation.x = -Math.PI / 2; screen.position.y = 0.0065; screen.userData.noShadow = true; g.add(screen);
      this.level.add(g);
      const pl = new THREE.PointLight(0x7aa8ff, 0.9, 2.4, 2); pl.position.set(0.55, 0.95, -2.85); this.level.add(pl);
      this._addClue('phone', g, [0.3, 0.2, 0.3], new THREE.Vector3(0.55, 0.85, -2.85), 0.12);
    }

    // ---- 3. torn note, hidden UNDER the pushable box ----
    {
      const tex = canvasTex(256, 256, (g, w, h) => {
        g.beginPath(); g.moveTo(10, 14);
        for (let x = 10; x < 246; x += 14) g.lineTo(x, 10 + rng() * 8);
        g.lineTo(246, 120);
        for (let y = 120; y < 244; y += 14) g.lineTo(240 - rng() * 10, y);
        for (let x = 246; x > 10; x -= 14) g.lineTo(x, 238 + rng() * 10); // jagged torn bottom
        g.lineTo(10, 244); g.closePath();
        g.fillStyle = '#d8d0b8'; g.fill();
        g.clip();
        g.fillStyle = '#2a2a3a'; g.font = '22px cursive, serif';
        ['...the marks were', 'changed before the', 'board met. Three names', 'on the list, and one of', 'them is lying to you.'].forEach((l, i) => g.fillText(l, 22, 56 + i * 34));
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3),
        new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = 0.5; mesh.position.set(-3.2, 0.014, -1.2);
      mesh.userData.noShadow = true;
      this.level.add(mesh);
      const c = this._addClue('note', mesh, [0.4, 0.06, 0.4], new THREE.Vector3(-3.2, 0.04, -1.2), 0.22,
        { onCollect: () => { mesh.visible = false; } });
      c.aura.position.y = 0.06;
    }

    // ---- 4. key card dropped near the door ----
    {
      const g = new THREE.Group(); g.position.set(2.5, 0.012, 1.7); g.rotation.y = 0.7;
      this._box(g, 0.085, 0.004, 0.054, new THREE.MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.4 }), 0, 0, 0);
      this._box(g, 0.085, 0.0045, 0.014, new THREE.MeshStandardMaterial({ color: 0x1f7a4a, emissive: 0x0f5a30, emissiveIntensity: 0.8 }), 0, 0.0005, -0.015);
      this.level.add(g);
      this._addClue('keycard', g, [0.35, 0.12, 0.35], new THREE.Vector3(2.5, 0.05, 1.7), 0.16,
        { onCollect: () => { g.visible = false; } });
    }

    // ---- 5. wet footprints — UV ONLY (shader reveal) ----
    {
      const tex = canvasTex(64, 128, (g, w, h) => {
        g.fillStyle = '#fff';
        g.beginPath(); g.ellipse(32, 42, 20, 36, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(32, 102, 14, 20, 0, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 6; i++) g.fillRect(14, 16 + i * 10, 36, 2);   // tread gaps
      });
      const mat = new THREE.ShaderMaterial({
        vertexShader: UV_VERT, fragmentShader: UV_FRAG,
        uniforms: { ...this.uv, uMap: { value: tex } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      this.uvMat = mat;
      const geo = new THREE.PlaneGeometry(0.15, 0.32); geo.rotateX(-Math.PI / 2);
      const start = new THREE.Vector2(3.5, 3.5), end = new THREE.Vector2(1.05, -1.1);
      const dir = end.clone().sub(start).normalize();
      const perp = new THREE.Vector2(-dir.y, dir.x);
      const print = (p, heading, side) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(p.x, 0.02, p.y);
        m.rotation.y = Math.atan2(-heading.x, -heading.y);
        m.scale.x = side;
        m.userData.noShadow = true; this.level.add(m);
      };
      const IN = 8;
      for (let i = 0; i < IN; i++) {
        const p = start.clone().lerp(end, i / (IN - 1)).addScaledVector(perp, (i % 2 ? 1 : -1) * 0.12);
        print(p, dir, i % 2 ? 1 : -1);
      }
      const back = dir.clone().multiplyScalar(-1), pb = new THREE.Vector2(-back.y, back.x);
      for (let i = 1; i <= 6; i++) {
        const p = end.clone().lerp(start, i / 6).add(new THREE.Vector2(0.38, 0.1)).addScaledVector(pb, (i % 2 ? 1 : -1) * 0.14);
        print(p, back, i % 2 ? 1 : -1);
      }
      const hole = new THREE.Group(); // dummy group for the clue (prints stay visible once found)
      this._addClue('prints', hole, [0.55, 0.1, 0.55], new THREE.Vector3(1.05, 0.05, -1.1), 0.3, { uv: true });
    }

    // ---- 6. desk drawer with something missing ----
    {
      const g = new THREE.Group();
      g.position.set(0.9, 0.2, -2.9 + 0.47);        // local to level (desk is at z -2.9)
      this._box(g, 0.4, 0.2, 0.04, this.m.wood, 0, 0, 0);
      this._box(g, 0.12, 0.025, 0.03, this.m.metal, 0, 0.02, 0.03);
      this._box(g, 0.38, 0.1, 0.42, this.m.woodDark, 0, -0.02, -0.23);
      this._box(g, 0.34, 0.01, 0.38, new THREE.MeshStandardMaterial({ color: 0x2d3238, roughness: 1 }), 0, 0.035, -0.23);
      this._box(g, 0.1, 0.012, 0.04, new THREE.MeshStandardMaterial({ color: 0x050607 }), 0, 0.04, -0.2);
      this._box(g, 0.025, 0.012, 0.025, new THREE.MeshStandardMaterial({ color: 0x050607 }), -0.06, 0.04, -0.2);
      const label = canvasTex(128, 48, (c, w, h) => {
        c.fillStyle = '#e8e2cf'; c.fillRect(0, 0, w, h); c.fillStyle = '#222'; c.font = 'bold 13px monospace';
        c.fillText('EXAM SCRIPTS', 14, 20); c.fillText('- BACKUP -', 24, 38);
      });
      const lm = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.045), new THREE.MeshBasicMaterial({ map: label }));
      lm.rotation.x = -Math.PI / 2; lm.position.set(0, 0.043, -0.33); lm.userData.noShadow = true; g.add(lm);
      this.level.add(g);
      this.drawerGroup = g; this.drawerBaseZ = g.position.z;
      this._addClue('drawer', g, [0.46, 0.3, 0.14], new THREE.Vector3(0.9, 0.2, -2.9 + 0.52), 0.3,
        { onCollect: () => { this._drawerT = 0; } });
    }
  }

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
    ui.cross = mk('div', 'position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:rgba(255,235,190,.65);transition:all .12s;', ui.root);
    ui.counter = mk('div', 'position:absolute;left:18px;top:16px;font-size:15px;letter-spacing:2px;text-shadow:0 0 8px #000;', ui.root);
    ui.hint = mk('div', 'position:absolute;left:18px;bottom:14px;font-size:12px;opacity:.7;text-shadow:0 0 6px #000;', ui.root,
      '[E] examine &nbsp; [F] UV torch &nbsp; [C] case file');
    ui.prompt = mk('div', 'position:absolute;left:50%;top:56%;transform:translateX(-50%);font-size:16px;padding:6px 14px;background:rgba(0,0,0,.55);border:1px solid rgba(242,217,160,.45);display:none;text-shadow:0 0 6px #000;', ui.root);
    ui.toast = mk('div', 'position:absolute;left:50%;bottom:11%;transform:translateX(-50%);width:min(620px,88vw);padding:12px 16px;background:rgba(8,8,12,.82);border-left:3px solid #f2b84b;font-size:14px;line-height:1.45;display:none;', ui.root);
    ui.uvTag = mk('div', 'position:absolute;right:18px;top:16px;font-size:13px;letter-spacing:2px;color:#b58cff;display:none;text-shadow:0 0 10px #7a3cff;', ui.root, 'UV TORCH ON');

    ui.case = mk('div', 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(3,4,7,.9);z-index:9999;font-family:"Courier New",monospace;');
    this._updateCounter();
  }

  _updateCounter() {
    const n = this.clues.filter((c) => c.found).length;
    this.ui.counter.textContent = `CLUES  ${n} / ${this.clues.length}`;
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
    const how = has('cup') ? 'Poisoned tea. No wounds; he collapsed where he stood.' : unk;
    const when = has('phone') && has('keycard')
      ? 'Between 23:40 and midnight. The visitor arrived at 23:38 and the tea had barely cooled.'
      : (has('phone') || has('keycard') ? 'After 23:31 — one more piece is needed to narrow it down.' : unk);
    const last = has('phone') ? `${CASE.lastSeenPlace}. He locked it up around 23:19 and walked up to his office.` : unk;

    const rows = this.clues.map((c) => c.found
      ? `<div style="margin:6px 0"><b>&#10003; ${c.def.name}</b><br><span style="opacity:.85">${c.def.finding}</span></div>`
      : `<div style="margin:6px 0;opacity:.45">&#9633; Unfound clue</div>`).join('');
    const sus = CASE.suspects.map((s) => `<li><b>${s.name}</b> — ${s.role}</li>`).join('');

    this.ui.case.innerHTML = `
      <div style="position:relative;width:min(780px,92vw);max-height:88vh;overflow:auto;background:#d9cba4;color:#1b1610;padding:28px 34px;box-shadow:0 0 60px #000;border-top:10px solid #b89b5e;">
        <div style="position:absolute;right:26px;top:22px;border:3px solid #a1241c;color:#a1241c;padding:2px 10px;transform:rotate(8deg);font-weight:bold;letter-spacing:3px;">CONFIDENTIAL</div>
        <div style="font-size:12px;letter-spacing:3px;opacity:.7">CASE FILE #001 ${done ? '— COMPLETE' : '— IN PROGRESS'}</div>
        <h2 style="margin:6px 0 2px;font-size:26px">${CASE.victim}</h2>
        <div style="opacity:.8">${CASE.role} &nbsp;|&nbsp; ${CASE.found}</div>
        <hr style="border:0;border-top:1px dashed #6b5a34;margin:16px 0">
        <div style="display:grid;grid-template-columns:110px 1fr;gap:8px 12px;font-size:15px">
          <b>HOW</b><div>${how}</div>
          <b>WHEN</b><div>${when}</div>
          <b>LAST SEEN</b><div>${last}</div>
        </div>
        <hr style="border:0;border-top:1px dashed #6b5a34;margin:16px 0">
        <b>EVIDENCE</b>${rows}
        <hr style="border:0;border-top:1px dashed #6b5a34;margin:16px 0">
        <b>PERSONS OF INTEREST</b>
        <ul style="margin:6px 0 0 18px;padding:0">${sus}</ul>
        <div style="margin-top:22px;display:flex;gap:12px;justify-content:flex-end">
          ${done ? '' : '<button id="cf-close" style="font:inherit;padding:9px 18px;background:#1b1610;color:#d9cba4;border:0;cursor:pointer">Back to the room [C]</button>'}
          ${done ? `<button id="cf-go" style="font:inherit;padding:10px 20px;background:#a1241c;color:#fff;border:0;cursor:pointer;letter-spacing:1px">Follow the lead: ${CASE.lastSeenPlace} &rarr;</button>` : ''}
        </div>
      </div>`;
    this.ui.case.style.display = 'flex';

    const close = this.ui.case.querySelector('#cf-close');
    if (close) close.addEventListener('click', () => this._closeCaseFile());
    const go = this.ui.case.querySelector('#cf-go');
    if (go) go.addEventListener('click', () => {
      this.ui.case.style.display = 'none';
      if (typeof window.__switchLevel === 'function') window.__switchLevel(CASE.nextLevel);
      else this._closeCaseFile();
    });
  }

  _closeCaseFile() {
    this.caseOpen = false;
    this.ui.case.style.display = 'none';
    if (this._lockEl && this._lockEl.requestPointerLock) { try { this._lockEl.requestPointerLock(); } catch (e) { /* needs user gesture */ } }
  }

  // =========================================================
  // INPUT
  // =========================================================
  _handleKey(e) {
    if (e.repeat) return;
    if (e.code === 'KeyC') { this.caseOpen ? this._closeCaseFile() : this._openCaseFile(); return; }
    if (this.caseOpen) return;
    if (e.code === 'KeyF') {
      this.uvOn = !this.uvOn;
      this.ui.uvTag.style.display = this.uvOn ? 'block' : 'none';
    } else if (e.code === 'KeyE' && this.focus) {
      this._collect(this.focus);
    }
  }

  _collect(c) {
    if (c.found) return;
    c.found = true;
    c.aura.visible = false;
    if (c.onCollect) c.onCollect();
    this.focus = null;
    this.ui.prompt.style.display = 'none';
    this._updateCounter();
    this._toast(`CLUE ${this.clues.filter((x) => x.found).length}/${this.clues.length} — ${c.def.name.toUpperCase()}`, c.def.note, 10000);
    if (this.clues.every((x) => x.found)) {
      clearTimeout(this._caseTimer);
      this._caseTimer = setTimeout(() => this._openCaseFile(), 4500);
    }
  }

  // =========================================================
  // PHYSICS — pushable objects
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
      return true;
    }
    if (player && player.pos && typeof player.yaw === 'number') { // fallback if no camera is exposed
      const p = player.pitch || 0;
      this._o.set(player.pos.x, player.pos.y + 1.6, player.pos.z);
      this._d.set(Math.sin(player.yaw) * Math.cos(p), Math.sin(p), Math.cos(player.yaw) * Math.cos(p)).normalize();
      return true;
    }
    return false;
  }

  _inUV(pos) {
    if (this.uv.uUvOn.value < 0.4) return false;
    const v = this._v.copy(pos).sub(this._o);
    const dist = v.length();
    if (dist > 6) return false;
    return v.divideScalar(dist || 1).dot(this._d) > this.uv.uUvCos.value;
  }

  _updateFocus() {
    const list = [];
    for (const c of this.clues) {
      c.lit = c.uv ? this._inUV(c.pos) : true;
      c.aura.visible = !c.found && c.lit;
      c.aura.material.uniforms.uFocus.value = 0;
      if (!c.found && c.lit) list.push(c.hit);
    }
    for (const o of this.occluders) list.push(o);
    this._rc.set(this._o, this._d);
    this._rc.far = REACH;
    const hits = this._rc.intersectObjects(list, false);
    const clue = hits.length && hits[0].object.userData.clue ? hits[0].object.userData.clue : null;
    this.focus = clue;
    if (clue) {
      clue.aura.material.uniforms.uFocus.value = 1;
      this.ui.prompt.textContent = `[E]  ${clue.def.name}`;
      this.ui.prompt.style.display = 'block';
      this.ui.cross.style.transform = 'scale(2)'; this.ui.cross.style.background = 'rgba(255,200,90,.95)';
    } else {
      this.ui.prompt.style.display = 'none';
      this.ui.cross.style.transform = 'scale(1)'; this.ui.cross.style.background = 'rgba(255,235,190,.65)';
    }
  }

  // =========================================================
  // UPDATE — called every frame by main.js as update(dt, t, player)
  // =========================================================
  update(deltaTime, t, player) {
    const dt = Math.min(deltaTime, 0.05);
    this.time += dt;
    this.uv.uTime.value = this.time;

    // lightning through the window + lamp flicker
    this._nextFlash -= dt;
    if (this._nextFlash <= 0) { this._flashT = 0.4; this._nextFlash = 9 + rng() * 12; }
    this._flashT = Math.max(0, this._flashT - dt);
    const flash = this._flashT > 0 ? (0.5 + 0.5 * Math.sin(this._flashT * 45)) * Math.min(1, this._flashT * 4) : 0;
    this.winMat.uniforms.uFlash.value = flash * 0.9;
    this.moon.intensity = 16 + flash * 60;
    this.lamp.intensity = 6 + Math.sin(this.time * 9) * 0.12 + Math.sin(this.time * 23) * 0.08;

    // UV torch
    const hasView = this._updateView(player);
    this.uv.uUvOn.value += ((this.uvOn ? 1 : 0) - this.uv.uUvOn.value) * Math.min(1, dt * 10);
    if (hasView) {
      this.uv.uUvPos.value.copy(this._o);
      this.uv.uUvDir.value.copy(this._d);
      this.uvLight.position.copy(this._o);
      this.uvLight.target.position.copy(this._o).add(this._d);
    }
    this.uvLight.intensity = 34 * this.uv.uUvOn.value;

    // drawer slide animation
    if (this._drawerT >= 0 && this._drawerT < 1) {
      this._drawerT = Math.min(1, this._drawerT + dt / 0.6);
      const e = 1 - Math.pow(1 - this._drawerT, 3);
      this.drawerGroup.position.z = this.drawerBaseZ + 0.36 * e;
    }

    // physics + interaction
    if (player && player.pos && !this.caseOpen) this._stepMovables(dt, player);
    if (hasView && !this.caseOpen) this._updateFocus();
  }

  // =========================================================
  // DISPOSE
  // =========================================================
  dispose() {
    clearTimeout(this._toastTimer);
    clearTimeout(this._caseTimer);
    window.removeEventListener('keydown', this._onKey);
    if (this.ui) {
      if (this.ui.root) this.ui.root.remove();
      if (this.ui.case) this.ui.case.remove();
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

const W_HALF = 9;; // half room width (used by furniture placement)