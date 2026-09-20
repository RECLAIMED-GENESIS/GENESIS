// ============================================================
// villageNPCs.js — Village NPCs, stalls, fragment pickups
// for Level 1 — THE GROVE VILLAGE
//
// Usage (inside StreetLevel constructor, after terrain is built):
//   import { VillageNPCs } from './villageNPCs.js';
//   this.villageNPCs = new VillageNPCs(this.level, this._h.bind(this), this.pathX.bind(this));
//
// Call every frame:
//   this.villageNPCs.update(dt, t, player);
//
// Call on dispose:
//   this.villageNPCs.dispose();
// ============================================================

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// ─────────────────────────────────────────────────────────────
// DIALOGUE SYSTEM  (DOM overlay, shared across all NPCs)
// ─────────────────────────────────────────────────────────────
function ensureDialogueBox() {
  let box = document.getElementById('dialogue');
  if (!box) {
    box = document.createElement('div');
    box.id = 'dialogue';
    Object.assign(box.style, {
      display:         'none',
      position:        'fixed',
      bottom:          '90px',
      left:            '50%',
      transform:       'translateX(-50%)',
      background:      'rgba(0,0,0,0.78)',
      color:           '#f0e6c8',
      fontFamily:      'Georgia, serif',
      fontSize:        '1.05rem',
      lineHeight:      '1.55',
      padding:         '14px 26px',
      border:          '1px solid #c8a96e',
      borderRadius:    '6px',
      maxWidth:        '520px',
      textAlign:       'center',
      pointerEvents:   'none',
      transition:      'opacity 0.4s',
      zIndex:          '100',
    });
    document.body.appendChild(box);
  }
  return box;
}

let _dialogueTimer = null;
export function showDialogue(text, duration = 4500) {
  const box = ensureDialogueBox();
  box.innerText = text;
  box.style.display = 'block';
  box.style.opacity  = '1';
  clearTimeout(_dialogueTimer);
  _dialogueTimer = setTimeout(() => {
    box.style.opacity = '0';
    setTimeout(() => { box.style.display = 'none'; }, 420);
  }, duration);
}

// ─────────────────────────────────────────────────────────────
// FRAGMENT COUNTER HUD  (separate pill above the main HUD)
// ─────────────────────────────────────────────────────────────
function ensureFragmentHUD() {
  let el = document.getElementById('fragmentHUD');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fragmentHUD';
    Object.assign(el.style, {
      position:   'fixed',
      top:        '14px',
      right:      '14px',
      background: 'rgba(0,0,0,0.65)',
      color:      '#c8f0ff',
      fontFamily: 'monospace',
      fontSize:   '0.95rem',
      padding:    '6px 14px',
      border:     '1px solid #4af',
      borderRadius: '4px',
      pointerEvents: 'none',
      zIndex:     '100',
    });
    document.body.appendChild(el);
  }
  return el;
}

// ─────────────────────────────────────────────────────────────
// PORTAL  (torus + swirling glow, appears at shrine after 5/5)
// ─────────────────────────────────────────────────────────────
const PORTAL_VERT = `
uniform float uTime;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec3 pos = position;
  // gentle ripple on the disc surface
  pos.z += sin(pos.x * 3.0 + uTime * 2.5) * 0.06
         + cos(pos.y * 2.8 + uTime * 1.9) * 0.06;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`;

const PORTAL_FRAG = `
uniform float uTime;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
}
void main(){
  vec2 c = vUv - 0.5;
  float r = length(c);
  float angle = atan(c.y, c.x);
  // swirling rings
  float swirl = noise(vec2(r*5.0 - uTime*1.2, angle*2.0 + uTime*0.8));
  float ring  = smoothstep(0.48,0.38,r) * smoothstep(0.05,0.18,r);
  vec3 col = mix(vec3(0.0,0.6,1.0), vec3(0.4,0.0,1.0), swirl);
  col += vec3(0.2,0.8,1.0) * pow(swirl, 3.0) * 2.0;
  float alpha = ring * (0.7 + 0.3*swirl);
  gl_FragColor = vec4(col, alpha);
}`;

// ─────────────────────────────────────────────────────────────
// GLOWING FRAGMENT PICKUP  (small emissive orb)
// ─────────────────────────────────────────────────────────────
function makeFragment(color = 0x44ccff) {
  const geo  = new THREE.SphereGeometry(0.22, 12, 12);
  const mat  = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2.8,
    roughness: 0.2,
    metalness: 0.4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.noShadow = true;

  // small point light so it illuminates surroundings
  const light = new THREE.PointLight(color, 3, 5, 2);
  mesh.add(light);
  return mesh;
}

// ─────────────────────────────────────────────────────────────
// NPC  (X_Bot with Idle animation)
// ─────────────────────────────────────────────────────────────
class NPC {
  constructor(parent, position, hint, onApproach = null) {
    this.hint       = hint;
    this.onApproach = onApproach;   // optional extra callback (e.g. give fragment)
    this.triggered  = false;
    this.group      = new THREE.Group();
    this.group.position.copy(position);
    parent.add(this.group);

    this.triggerRadius = 4.5;
    this._loadModel();
  }

  _loadModel() {
    const loader = new FBXLoader();
    // Load the base character
    loader.load('./../../assets/models/enemy/X_Bot.fbx', (fbx) => {
      fbx.scale.setScalar(0.013);   // FBX units → metres
      fbx.traverse(o => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      this.group.add(fbx);
      this.fbx = fbx;

      // Load idle animation
      const animLoader = new FBXLoader();
      animLoader.load('./../../assets/models/enemy/Dwarf Idle.fbx', (anim) => {
        this.mixer = new THREE.AnimationMixer(fbx);
        const clip = anim.animations[0];
        if (clip) this.mixer.clipAction(clip).play();
      });
    }, undefined, (err) => {
      // fallback: simple capsule placeholder if FBX fails
      console.warn('NPC model failed, using placeholder', err);
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.3, 1.2, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x8866aa })
      );
      body.position.y = 0.9;
      this.group.add(body);
    });
  }

  update(dt, playerPos) {
    if (this.mixer) this.mixer.update(dt);

    // face the player
    const dx = playerPos.x - this.group.position.x;
    const dz = playerPos.z - this.group.position.z;
    if (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1) {
      this.group.rotation.y = Math.atan2(dx, dz);
    }

    // proximity trigger
    const dist = playerPos.distanceTo(this.group.position);
    if (dist < this.triggerRadius && !this.triggered) {
      this.triggered = true;
      showDialogue(this.hint);
      if (this.onApproach) this.onApproach();
    }
    // reset so hint can show again if player walks away and returns
    if (dist > this.triggerRadius + 2) this.triggered = false;
  }

  dispose() {
    if (this.mixer) this.mixer.stopAllAction();
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────
// STALL  (food or item — box frame, cone roof, hanging lantern)
// ─────────────────────────────────────────────────────────────
function makeStall(parent, x, y, z, roofColor = 0x8b1a1a, label = 'food') {
  const g       = new THREE.Group();
  const wood    = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.7 });
  const counter = new THREE.MeshStandardMaterial({ color: 0x7a5c3a, roughness: 0.8 });

  // base counter
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 1.4), counter);
  base.position.y = 0.45; g.add(base);

  // back wall
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 0.12), wood);
  back.position.set(0, 1.65, -0.7); g.add(back);

  // side walls
  for (const sx of [-1.54, 1.54]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 1.4), wood);
    side.position.set(sx, 1.65, 0); g.add(side);
  }

  // roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 1.9), roofMat);
  roof.position.set(0, 2.88, 0.1); g.add(roof);

  // hanging lantern
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xff9933, emissive: 0xff6600, emissiveIntensity: 1.8,
  });
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), lanternMat);
  lantern.position.set(0, 2.6, 0.6); g.add(lantern);
  const light = new THREE.PointLight(0xff9933, 4, 6, 2);
  light.position.copy(lantern.position); g.add(light);

  // food/item props on counter
  if (label === 'food') {
    // bowls
    for (let i = -1; i <= 1; i++) {
      const bowl = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xeeeedd, roughness: 0.6 })
      );
      bowl.position.set(i * 0.8, 0.96, 0.1);
      bowl.rotation.x = Math.PI;
      g.add(bowl);
    }
  } else {
    // item stall — small crates / boxes
    for (let i = -1; i <= 1; i++) {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.35, 0.35),
        new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.8 })
      );
      crate.position.set(i * 0.6, 1.08, 0.1); g.add(crate);
    }
  }

  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// ─────────────────────────────────────────────────────────────
// JAPANESE HOUSE
// ─────────────────────────────────────────────────────────────
function makeHouse(parent, x, y, z) {
  const g       = new THREE.Group();
  const wall    = new THREE.MeshStandardMaterial({ color: 0xd4c5a0, roughness: 0.85 });
  const wood    = new THREE.MeshStandardMaterial({ color: 0x4a2e12, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.7 });

  // main body
  const body = new THREE.Mesh(new THREE.BoxGeometry(7, 3.5, 6), wall);
  body.position.y = 1.75; g.add(body);

  // raised floor border
  const floor = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.3, 6.4), wood);
  floor.position.y = 0.15; g.add(floor);

  // roof — two-layer pagoda style
  const roof1 = new THREE.Mesh(new THREE.ConeGeometry(5.8, 1.8, 4), roofMat);
  roof1.position.y = 4.6; roof1.rotation.y = Math.PI / 4; g.add(roof1);
  const roof2 = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.4, 4), roofMat);
  roof2.position.y = 6.1; roof2.rotation.y = Math.PI / 4; g.add(roof2);

  // decorative ridge cap
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 6), wood);
  ridge.position.y = 7.1; g.add(ridge);

  // sliding door panel (dark wood frame + light panel)
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.12), wood);
  doorFrame.position.set(0, 1.6, 3.06); g.add(doorFrame);
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xf0e8d0, roughness: 0.5, transparent: true, opacity: 0.85 }));
  doorPanel.position.set(0, 1.6, 3.1); g.add(doorPanel);

  // window shutters x2
  for (const wx of [-2.5, 2.5]) {
    const shutter = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.1), wood);
    shutter.position.set(wx, 2.1, 3.06); g.add(shutter);
  }

  // interior warm glow through door/window
  const glow = new THREE.PointLight(0xffc880, 3.5, 8, 2);
  glow.position.set(0, 1.8, 2.5); g.add(glow);

  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// ─────────────────────────────────────────────────────────────
// MAIN CLASS
// ─────────────────────────────────────────────────────────────
export class VillageNPCs {
  /**
   * @param {THREE.Group}  levelGroup  — the level's root group (this.level in StreetLevel)
   * @param {Function}     heightFn    — this._h.bind(this)
   * @param {Function}     pathXFn     — this.pathX.bind(this)
   * @param {Function}     onAllFound  — called when all 5 fragments are collected
   */
  constructor(levelGroup, heightFn, pathXFn, onAllFound = null) {
    this.group      = levelGroup;
    this._h         = heightFn;
    this.pathX      = pathXFn;
    this.onAllFound = onAllFound;

    this.fragmentsFound = 0;
    this.totalFragments = 5;
    this.npcs           = [];
    this.fragments      = [];   // { mesh, collected }
    this.portalMesh     = null;
    this.portalMat      = null;
    this.portalActive   = false;
    this.portalTimer    = 0;
    this._time          = 0;

    this._hudEl = ensureFragmentHUD();
    this._updateHUD();

    this._build();
  }

  // ── build everything ──────────────────────────────────────
  _build() {
    this._buildHouse();
    this._buildStalls();
    this._buildNPCs();
    this._buildFragments();
  }

  _buildHouse() {
    const hx = this.pathX(40) - 9;
    const hy = this._h(hx, 40);
    makeHouse(this.group, hx, hy, 40);
  }

  _buildStalls() {
    // Stall 1 — Ramen (food), left of path near z=30
    const s1x = this.pathX(30) - 5;
    makeStall(this.group, s1x, this._h(s1x, 30), 30, 0x8b1a1a, 'food');

    // Stall 2 — Dumplings (food), right of path near z=18
    const s2x = this.pathX(18) + 5;
    makeStall(this.group, s2x, this._h(s2x, 18), 18, 0x1a3a8b, 'food');

    // Stall 3 — Item stall, right of path near z=6
    const s3x = this.pathX(6) + 5;
    makeStall(this.group, s3x, this._h(s3x, 6), 6, 0x2a6b2a, 'item');
  }

  _buildNPCs() {
    // NPC positions mirror their stalls / landmarks
    const npcDefs = [
      {
        z: 30, side: -6,
        hint: '"A stranger came through here many years ago... left something glowing in the pond. I never went near it."',
      },
      {
        z: 18, side: +6,
        hint: '"One of the lanterns down the path glows blue. Has done for as long as I can remember. My father told me never to touch it."',
      },
      {
        z: 6, side: +6,
        hint: null,   // handled in onApproach — gives fragment 3 directly
        onApproach: () => this._collectFragment(2),  // index 2 = fragment 3
      },
      {
        z: -10, side: -4,   // fisherman near the pond
        hint: '"There is a blossom petal frozen in the air above the cherry trees. Thirty years I have watched it. It never falls."',
      },
      {
        z: -48, side: +3,   // shrine keeper on the steps
        hint: '"The altar stone has been warm for weeks. Whatever you seek... it knows you are coming, young one."',
      },
    ];

    for (const def of npcDefs) {
      const nx = this.pathX(def.z) + def.side;
      const ny = this._h(nx, def.z);
      const pos = new THREE.Vector3(nx, ny, def.z);

      const hint = def.hint
        ?? '"I found this near the great gate long ago. It has been glowing ever since. You look like you need it more than I do."';

      const npc = new NPC(this.group, pos, hint, def.onApproach ?? null);
      this.npcs.push(npc);
    }
  }

  _buildFragments() {
    // Fragment positions:
    // 0 — Lotus in koi pond
    // 1 — Blue lantern (wrong colour) on path
    // 2 — Given by NPC 3 (merchant), not placed in world
    // 3 — Frozen blossom petal above trees
    // 4 — Shrine altar stone (activated last)

    const defs = [
      { x: 14,                     z: 18,   y: 0.6,  color: 0x44ffcc },  // pond lotus
      { x: this.pathX(-5) + 3,     z: -5,   y: 1.4,  color: 0x4466ff },  // blue lantern
      // index 2 is given by NPC — skipped here, collected via _collectFragment(2)
      { x: this.pathX(-15) - 6,    z: -15,  y: 4.0,  color: 0xff44aa },  // frozen petal
      { x: this.pathX(-58),        z: -58,  y: 2.2,  color: 0xffdd00 },  // shrine altar
    ];

    // sparse array — slot 2 is placeholder (undefined), handled separately
    this.fragments = new Array(5).fill(null);

    const worldIndices = [0, 1, 3, 4]; // fragment indices that exist in the world
    defs.forEach((def, i) => {
      const fi = worldIndices[i];
      const mesh = makeFragment(def.color);
      const gy   = this._h(def.x, def.z);
      mesh.position.set(def.x, gy + def.y, def.z);
      mesh.layers.enable(1);   // visible on minimap
      this.group.add(mesh);
      this.fragments[fi] = { mesh, collected: false };
    });

    // fragment 2 (given by NPC) — no mesh, just mark slot as needing collection
    this.fragments[2] = { mesh: null, collected: false };
  }

  // ── collect ───────────────────────────────────────────────
  _collectFragment(index) {
    const f = this.fragments[index];
    if (!f || f.collected) return;
    f.collected = true;
    this.fragmentsFound++;
    this._updateHUD();

    if (f.mesh) {
      // flash then remove
      f.mesh.material.emissiveIntensity = 8;
      setTimeout(() => {
        f.mesh.parent && f.mesh.parent.remove(f.mesh);
        f.mesh.geometry.dispose();
        f.mesh.material.dispose();
      }, 300);
    }

    showDialogue(
      this.fragmentsFound < this.totalFragments
        ? `GENESIS Fragment ${this.fragmentsFound}/${this.totalFragments} acquired.`
        : 'Fragment sequence complete. GENESIS Node 1 — unlocked.\n\n"Sorini... we see you."',
      this.fragmentsFound < this.totalFragments ? 3000 : 6000
    );

    if (this.fragmentsFound === this.totalFragments) {
      setTimeout(() => this._openPortal(), 1800);
    }
  }

  _checkFragmentProximity(playerPos) {
    const PICK_R = 2.2;
    this.fragments.forEach((f, i) => {
      if (!f || f.collected || !f.mesh) return;
      if (playerPos.distanceTo(f.mesh.position) < PICK_R) {
        this._collectFragment(i);
      }
    });
  }

  // ── portal ────────────────────────────────────────────────
  _openPortal() {
    this.portalActive = true;
    this.portalTimer  = 0;

    // torus ring
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0x0044ff, emissive: 0x0088ff, emissiveIntensity: 3,
      roughness: 0.2, metalness: 0.8,
    });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.18, 16, 60), torusMat);

    // swirling disc
    this.portalMat = new THREE.ShaderMaterial({
      vertexShader:   PORTAL_VERT,
      fragmentShader: PORTAL_FRAG,
      uniforms:       { uTime: { value: 0 } },
      transparent:    true,
      depthWrite:     false,
      side:           THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.9, 48), this.portalMat);

    // portal light
    const pLight = new THREE.PointLight(0x0088ff, 20, 18, 1.8);

    const px = this.pathX(-58);
    const pz = -58;
    const py = this._h(px, pz) + 2.5;

    this.portalMesh = new THREE.Group();
    this.portalMesh.add(torus, disc, pLight);
    this.portalMesh.position.set(px, py, pz);
    this.portalMesh.rotation.y = Math.PI / 6;
    this.group.add(this.portalMesh);

    showDialogue('"Sorini... we see you. Step through."', 5000);
  }

  // ── HUD ───────────────────────────────────────────────────
  _updateHUD() {
    const filled = '◆'.repeat(this.fragmentsFound);
    const empty  = '◇'.repeat(this.totalFragments - this.fragmentsFound);
    this._hudEl.innerText = `FRAGMENTS  ${filled}${empty}  ${this.fragmentsFound}/${this.totalFragments}`;
  }

  // ── update (call every frame from level.update) ───────────
  update(dt, t, player) {
    this._time += dt;
    const pPos = player.pos;

    // animate floating fragments
    this.fragments.forEach((f) => {
      if (!f || f.collected || !f.mesh) return;
      f.mesh.position.y += Math.sin(this._time * 2.0 + f.mesh.position.x) * 0.002;
      f.mesh.rotation.y += dt * 1.2;
    });

    // check pickup proximity
    this._checkFragmentProximity(pPos);

    // update NPCs
    for (const npc of this.npcs) npc.update(dt, pPos);

    // portal animation
    if (this.portalActive && this.portalMesh) {
      this.portalMat.uniforms.uTime.value = this._time;
      this.portalMesh.rotation.y += dt * 0.4;

      // walk into portal → trigger level switch after short delay
      const px = this.pathX(-58);
      const pz = -58;
      const dist = Math.hypot(pPos.x - px, pPos.z - pz);
      if (dist < 2.5) {
        this.portalTimer += dt;
        if (this.portalTimer > 1.2 && this.onAllFound) {
          this.onAllFound();
          this.onAllFound = null;   // fire once
        }
      } else {
        this.portalTimer = 0;
      }
    }
  }

  // ── dispose ───────────────────────────────────────────────
  dispose() {
    for (const npc of this.npcs) npc.dispose();
    this.npcs = [];

    this.fragments.forEach(f => {
      if (!f || !f.mesh) return;
      f.mesh.geometry?.dispose();
      f.mesh.material?.dispose();
    });
    this.fragments = [];

    if (this.portalMesh) {
      this.portalMesh.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }

    const box = document.getElementById('dialogue');
    if (box) box.remove();
    const hud = document.getElementById('fragmentHUD');
    if (hud) hud.remove();
  }
}
