// ============================================================
// LEVEL 1 — THE GROVE VILLAGE (twilight blossom garden)
// Sorini arrives at a Japanese village at twilight.
// He must find 5 hidden GENESIS fragments by exploring the
// village and talking to its inhabitants. Once all 5 are
// collected, a portal tears open at the shrine.
//
// What's here:
//   * custom dusk sky shader (gradient + stars + moon + clouds)
//   * rolling terrain with a winding stepping-stone path
//   * torii gates aligned to the path tangent
//   * instanced blossom trees (one draw call for all canopies)
//   * stone lanterns with warm flickering lights
//   * koi pond with a custom ripple/water shader
//   * fireflies (GPU-animated point shader)
//   * falling blossom petals (instanced, animated on CPU)
//   * shrine platform at the end of the path
//   * Japanese house, 3 market stalls, 5 NPCs with hints
//   * 5 glowing GENESIS fragments to collect
//   * portal that opens at the shrine once all 5 are found
// ============================================================
import * as THREE from 'three';
import { VillageNPCs } from '../player/villageNPCs.js';

// ---------- noise ----------
function hash2(x, y) {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return v - Math.floor(v);
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}
function fbm(x, y, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += vnoise(x * f, y * f) * amp; f *= 2; amp *= 0.5; }
  return v;
}
function sstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ---------- shaders ----------
const SKY_VERT = `
varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = `
uniform float uTime;
varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.1, 1.0);
  vec3 horizon = vec3(0.98, 0.55, 0.32);
  vec3 rose    = vec3(0.55, 0.30, 0.52);
  vec3 zenith  = vec3(0.10, 0.08, 0.28);
  vec3 col = mix(horizon, rose, smoothstep(0.0, 0.22, h));
  col = mix(col, zenith, smoothstep(0.18, 0.65, h));
  float cl = noise(d.xz / max(d.y + 0.25, 0.12) * 1.4 + uTime * 0.008);
  col += vec3(0.9, 0.5, 0.45) * smoothstep(0.55, 0.85, cl) * (1.0 - smoothstep(0.05, 0.35, h)) * 0.25;
  float star = hash(floor(d.xz / max(d.y, 0.05) * 90.0));
  float tw = 0.5 + 0.5 * sin(uTime * 2.0 + star * 40.0);
  col += vec3(step(0.994, star)) * tw * smoothstep(0.25, 0.7, h);
  vec3 moonDir = normalize(vec3(-0.45, 0.55, -0.6));
  float md = dot(d, moonDir);
  float disc = smoothstep(0.9992, 0.9996, md);
  float halo = pow(max(md, 0.0), 220.0) * 0.5;
  col += vec3(0.95, 0.95, 0.85) * (disc * 0.9 + halo);
  gl_FragColor = vec4(col, 1.0);
}`;

const WATER_VERT = `
uniform float uTime;
varying vec2 vP;
varying vec3 vView;
void main(){
  vP = position.xy;
  vec3 pos = position;
  pos.z += sin(position.x * 1.6 + uTime * 1.4) * 0.05
         + cos(position.y * 1.9 + uTime * 1.1) * 0.05;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const WATER_FRAG = `
uniform float uTime;
varying vec2 vP;
varying vec3 vView;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main(){
  float r = length(vP) / 9.0;
  float n1 = noise(vP * 1.3 + uTime * 0.35);
  float n2 = noise(vP * 2.7 - uTime * 0.5);
  float ripple = n1 * 0.6 + n2 * 0.4;
  vec3 deep = vec3(0.09, 0.10, 0.30);
  vec3 skyRef = vec3(0.85, 0.48, 0.45);
  float fres = pow(1.0 - abs(vView.z), 2.0);
  vec3 col = mix(deep, skyRef, fres * 0.75 + ripple * 0.15);
  float glint = pow(noise(vP * 5.0 + uTime * 0.8), 12.0);
  col += vec3(1.0, 0.8, 0.5) * glint * 2.0;
  col *= 0.75 + 0.25 * smoothstep(1.0, 0.3, r);
  gl_FragColor = vec4(col, 0.92);
}`;

const FIREFLY_VERT = `
uniform float uTime;
attribute float seed;
varying float vSeed;
void main(){
  vSeed = seed;
  vec3 p = position;
  p.x += sin(uTime * 0.31 + seed * 17.0) * 1.6;
  p.y += sin(uTime * 0.23 + seed * 29.0) * 0.9;
  p.z += cos(uTime * 0.27 + seed * 13.0) * 1.6;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float pulse = 0.6 + 0.4 * sin(uTime * 2.2 + seed * 40.0);
  gl_PointSize = (3.2 * pulse) * (160.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FIREFLY_FRAG = `
varying float vSeed;
uniform float uTime;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.06, d);
  a *= 0.55 + 0.45 * sin(uTime * 2.2 + vSeed * 40.0);
  gl_FragColor = vec4(vec3(0.75, 1.0, 0.35) * 1.6, a);
}`;

export class StreetLevel {
  constructor(sceneOrRenderer = null, rendererMaybe = null) {
    let outerScene = null;
    let renderer = null;
    if (sceneOrRenderer && sceneOrRenderer.isScene) {
      outerScene = sceneOrRenderer;
      renderer = rendererMaybe;
    } else if (sceneOrRenderer && sceneOrRenderer.isWebGLRenderer) {
      renderer = sceneOrRenderer;
    } else if (rendererMaybe && rendererMaybe.isWebGLRenderer) {
      renderer = rendererMaybe;
    }
    if (outerScene) {
      this.scene = outerScene;
      if (!this.scene.background) this.scene.background = new THREE.Color(0x1a1030);
      if (this.scene.fog === null || this.scene.fog === undefined) this.scene.fog = new THREE.FogExp2(0x3a2050, 0.011);
    } else {
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x1a1030);
      this.scene.fog = new THREE.FogExp2(0x3a2050, 0.011);
    }

    this.name = 'LEVEL 1 — THE GROVE VILLAGE';
    this.colliders = [];
    this.level = new THREE.Group();
    this.root = this.level;
    this.scene.add(this.level);

    this.time = 0;
    this.timeMats = [];
    this.lanternMats = [];
    this.spawn = new THREE.Vector3(0, this._h(0, 62), 62);
    this.spawnYaw = Math.PI;   // face down the path (toward -z)

    this.createSky();
    this.createLighting();
    this.createTerrain();
    this.createPath();
    this.createToriiGates();
    this.createTrees();
    this.createLanterns();
    this.createPond();
    this.createShrine();
    this.createFireflies();
    this.createPetals();
    this._buildColliders();

    // shadows on everything built so far
    this.level.traverse((o) => {
      if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; }
    });

    // ── Village NPCs, stalls, house, fragments, portal ──────
    // switchLevel is exposed on window by main.js so the portal
    // callback can trigger level 2 from inside villageNPCs.js
    this.villageNPCs = new VillageNPCs(
      this.level,
      this._h.bind(this),
      this.pathX.bind(this),
      () => {
        // all 5 fragments collected → walk into portal → go to level 2
        setTimeout(() => {
          if (typeof window.__switchLevel === 'function') window.__switchLevel(2);
        }, 1200);
      }
    );
  }

  // the path wanders gently; everything aligns to it
  pathX(z) { return Math.sin(z * 0.03) * 8; }

  // ONE analytic height function — terrain mesh AND gameplay use it
  _h(x, z) {
    let h = (fbm(x * 0.02 + 3.1, z * 0.02 + 7.7) - 0.5) * 2.4;
    h += (fbm(x * 0.08, z * 0.08, 2) - 0.5) * 0.4;
    const dp = Math.hypot(x - 14, z - 18);
    h = h * (1 - sstep(12, 6, dp)) + (-0.8) * sstep(12, 6, dp);
    const dPath = Math.abs(x - this.pathX(z));
    h = h * (1 - sstep(7, 2.5, dPath)) + 0.05 * sstep(7, 2.5, dPath);
    h = h * (1 - sstep(9, 4, Math.hypot(x, z - 62))) + 0.05 * sstep(9, 4, Math.hypot(x, z - 62));
    h = h * (1 - sstep(10, 5, Math.hypot(x - this.pathX(-58), z + 58))) + 0.1 * sstep(10, 5, Math.hypot(x - this.pathX(-58), z + 58));
    return h;
  }
  _addBoxCollider(cx, cz, hw, hd, h, baseY = 0) {
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(cx - hw, baseY, cz - hd),
      new THREE.Vector3(cx + hw, baseY + h, cz + hd)));
  }

  _buildColliders() {
    // torii gate pillars (aligned with the gate rotation in createToriiGates)
    for (const gz of [42, 16, -12, -38]) {
      const gx = this.pathX(gz);
      const dz = 0.6;
      const angle = Math.atan2(this.pathX(gz - dz) - this.pathX(gz + dz), -2 * dz);
      for (const side of [-1, 1]) {
        const px = gx + side * 2.1 * Math.cos(angle);
        const pz = gz - side * 2.1 * Math.sin(angle);
        this._addBoxCollider(px, pz, 0.4, 0.4, 4.4, this._h(gx, gz));
      }
    }
    // koi pond — keep Sorini out of the water
    // koi pond — only block the deepest center (smaller collider)
// so player can walk to the water's edge
    this._addBoxCollider(14, 18, 5.5, 5.5, 1.2, -1.0);
    // Japanese house
    const hx = this.pathX(40) - 9;
    this._addBoxCollider(hx, 40, 3.7, 3.2, 4, this._h(hx, 40));
    // market stalls
    const s1x = this.pathX(30) - 5;
    this._addBoxCollider(s1x, 30, 1.8, 1.0, 3, this._h(s1x, 30));
    const s2x = this.pathX(18) + 5;
    this._addBoxCollider(s2x, 18, 1.8, 1.0, 3, this._h(s2x, 18));
    const s3x = this.pathX(6) + 5;
    this._addBoxCollider(s3x, 6, 1.8, 1.0, 3, this._h(s3x, 6));
    // shrine pillars only — the centre stays open so the portal/altar are reachable
    const sx = this.pathX(-58), sz = -58, sy = this._h(sx, sz);
    for (const [cx, cz] of [[-2.8, -2.3], [2.8, -2.3], [-2.8, 2.3], [2.8, 2.3]]) {
      this._addBoxCollider(sx + cx, sz + cz, 0.4, 0.4, 4, sy);
    }
    // NPCs
    for (const [nx, nz] of [
      [this.pathX(30) - 6, 30], [this.pathX(18) + 6, 18], [this.pathX(6) + 6, 6],
      [this.pathX(-10) - 4, -10], [this.pathX(-48) + 3, -48],
    ]) {
      this._addBoxCollider(nx, nz, 0.45, 0.45, 2.2, this._h(nx, nz));
    }
  }

  getSurfaceHeight(x, z) { return this._h(x, z); }
  groundHeight(x, z) { return this._h(x, z); }
  terrainHeight(x, z) { return this._h(x, z); }

  // =========================================================
  // SKY
  // =========================================================
  createSky() {
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      uniforms: { uTime: { value: 0 } }, side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.timeMats.push(this.skyMat);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 24), this.skyMat);
    this.scene.add(this.sky);
  }

  // =========================================================
  // LIGHTING
  // =========================================================
  createLighting() {
    this.scene.add(new THREE.HemisphereLight(0x8a6fd0, 0x2e1f3f, 0.7));
    const sun = new THREE.DirectionalLight(0xffb27a, 1.9);
    sun.position.set(70, 32, -30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, far: 260 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    this.level.add(sun);
    this.sun = sun;
  }

  // =========================================================
  // TERRAIN
  // =========================================================
  createTerrain() {
    const geo = new THREE.PlaneGeometry(260, 260, 110, 110);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cGrass = new THREE.Color(0x2e5c3a), cMoss = new THREE.Color(0x4a7a44),
          cPath = new THREE.Color(0x6a5a48), cDusk = new THREE.Color(0x3a4a6a), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this._h(x, z);
      pos.setY(i, h);
      const n = fbm(x * 0.05 + 11, z * 0.05 + 4, 3);
      tmp.lerpColors(cGrass, cMoss, n);
      tmp.lerp(cDusk, sstep(0.8, 2.2, h) * 0.5);
      const dPath = Math.abs(x - this.pathX(z));
      tmp.lerp(cPath, 1 - sstep(2.5, 5.5, dPath));
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    this.level.add(terrain);
  }

  // =========================================================
  // STEPPING-STONE PATH
  // =========================================================
  createPath() {
    const pts = [];
    for (let z = 62; z >= -58; z -= 10) pts.push(new THREE.Vector3(this.pathX(z), 0, z));
    const curve = new THREE.CatmullRomCurve3(pts);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9a94a8, roughness: 0.7, metalness: 0.05 });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xffc46a, emissiveIntensity: 2 });
    const stoneGeo = new THREE.CylinderGeometry(0.75, 0.85, 0.11, 7);
    const count = Math.floor(curve.getLength() / 1.7);
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(p.x + Math.sin(i * 7.3) * 0.25, this._h(p.x, p.z) - 0.03, p.z);
      stone.rotation.y = Math.atan2(tan.x, tan.z) + Math.sin(i * 3.1) * 0.3;
      this.level.add(stone);
      if (i % 5 === 2) {
        const rune = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.24, 6), glowMat);
        rune.position.set(p.x, this._h(p.x, p.z) + 0.1, p.z);
        rune.userData.noShadow = true;
        this.level.add(rune);
      }
    }
  }

  // =========================================================
  // TORII GATES
  // =========================================================
  createToriiGates() {
    const vermilion = new THREE.MeshStandardMaterial({ color: 0xd8503c, roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a1420, roughness: 0.6 });
    for (const gz of [42, 16, -12, -38]) {
      const gx = this.pathX(gz);
      const dz = 0.6;
      const angle = Math.atan2(this.pathX(gz - dz) - this.pathX(gz + dz), -2 * dz);
      const gate = new THREE.Group();
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 4.4, 10), vermilion);
        pillar.position.set(side * 2.1, 2.2, 0);
        gate.add(pillar);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.34, 0.42), vermilion);
      top.position.y = 4.55; top.rotation.z = 0.02;
      gate.add(top);
      const second = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.26, 0.34), vermilion);
      second.position.y = 3.85;
      gate.add(second);
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x201008, emissive: 0xffb45e, emissiveIntensity: 1.4 }));
      plaque.position.y = 4.15; plaque.userData.noShadow = true;
      gate.add(plaque);
      gate.position.set(gx, this._h(gx, gz), gz);
      gate.rotation.y = angle;
      this.level.add(gate);
    }
  }

  // =========================================================
  // BLOSSOM TREES
  // =========================================================
  createTrees() {
    const N = 46;
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 3.2, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3228, roughness: 0.9 });
    const canGeo = new THREE.IcosahedronGeometry(1.9, 1);
    const canMat = new THREE.MeshStandardMaterial({
      color: 0xe88bb0, roughness: 0.8, emissive: 0xa04070, emissiveIntensity: 0.25, flatShading: true,
    });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N);
    const cans = new THREE.InstancedMesh(canGeo, canMat, N * 3);
    const M = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(),
          S = new THREE.Vector3(), E = new THREE.Euler();
    let placed = 0, guard = 0;
    let ci = 0;
    while (placed < N && guard++ < 2000) {
      const x = (Math.random() - 0.5) * 220, z = (Math.random() - 0.5) * 220;
      if (Math.abs(x - this.pathX(z)) < 5) continue;
      if (Math.hypot(x - 14, z - 18) < 14) continue;
      if (Math.hypot(x, z - 62) < 8 || Math.hypot(x - this.pathX(-58), z + 58) < 12) continue;
      const y = this._h(x, z);
      const s = 0.8 + Math.random() * 1.3;
      V.set(x, y + 1.6 * s, z); S.set(s, s, s); E.set(0, Math.random() * 6.3, (Math.random() - 0.5) * 0.12);
      Q.setFromEuler(E);
      M.compose(V, Q, S);
      trunks.setMatrixAt(placed, M);
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * Math.PI * 2, r = k === 0 ? 0 : 0.9 + Math.random() * 0.5;
        const cs = s * (1.1 - k * 0.18) * (0.8 + Math.random() * 0.4);
        V.set(x + Math.cos(a) * r * s, y + (3.1 + k * 0.75) * s, z + Math.sin(a) * r * s);
        S.set(cs, cs * 0.85, cs);
        Q.setFromEuler(E);
        M.compose(V, Q, S);
        cans.setMatrixAt(ci++, M);
      }
      placed++;
      // trunk collider so Sorini can't walk through trees
      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(x - 0.55, y, z - 0.55),
        new THREE.Vector3(x + 0.55, y + 3.4 * s, z + 0.55)));
    }
    this.level.add(trunks, cans);
    this.canopyMat = canMat;
  }

  // =========================================================
  // STONE LANTERNS
  // =========================================================
  createLanterns() {
    const stone = new THREE.MeshStandardMaterial({ color: 0x8a8496, roughness: 0.8 });
    for (let i = 0; i < 6; i++) {
      const z = 48 - i * 20;
      const side = i % 2 ? 1 : -1;
      const x = this.pathX(z) + side * 2.6;
      const y = this._h(x, z);
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.7), stone);
      base.position.y = 0.12; g.add(base);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 8), stone);
      pillar.position.y = 0.7; g.add(pillar);
      const glowMat = new THREE.MeshStandardMaterial({
        color: 0x3a2410, emissive: 0xffb45e, emissiveIntensity: 2.2,
      });
      this.lanternMats.push({ mat: glowMat, phase: i * 1.3 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), glowMat);
      box.position.y = 1.35; box.userData.noShadow = true; g.add(box);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.4, 4), stone);
      roof.position.y = 1.78; roof.rotation.y = Math.PI / 4; g.add(roof);
      g.position.set(x, y, z);
      this.level.add(g);
      this._addBoxCollider(x, z, 0.5, 0.5, 2, y);
      if (i === 1 || i === 4) {
        const l = new THREE.PointLight(0xffb45e, 6, 10, 1.8);
        l.position.set(x, y + 1.4, z);
        this.level.add(l);
      }
    }
  }

  // =========================================================
  // KOI POND
  // =========================================================
  createPond() {
    const px = 14, pz = 18;
    this.waterMat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT, fragmentShader: WATER_FRAG,
      uniforms: { uTime: { value: 0 } }, transparent: true, fog: false,
    });
    this.timeMats.push(this.waterMat);
    const water = new THREE.Mesh(new THREE.CircleGeometry(9, 48), this.waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(px, -0.25, pz);
    water.userData.noShadow = true;
    this.level.add(water);

    const padMat = new THREE.MeshStandardMaterial({ color: 0x2e6b3e, roughness: 0.7 });
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 5.5;
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.5 + Math.random() * 0.5, 10), padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(px + Math.cos(a) * r, -0.2, pz + Math.sin(a) * r);
      pad.userData.noShadow = true;
      this.level.add(pad);
    }
    const lotus = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 6),
      new THREE.MeshStandardMaterial({ color: 0xff9ec4, emissive: 0xd84f88, emissiveIntensity: 1.2 }));
    lotus.position.set(px + 1.5, -0.05, pz - 1);
    lotus.userData.noShadow = true;
    this.level.add(lotus);
  }

  // =========================================================
  // SHRINE
  // =========================================================
  createShrine() {
    const sx = this.pathX(-58), sz = -58, sy = this._h(sx, sz);
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2033, roughness: 0.6 });
    const g = new THREE.Group();
    const platform = new THREE.Mesh(new THREE.BoxGeometry(7, 0.7, 6), wood);
    platform.position.y = 0.35; g.add(platform);
    for (const [cx, cz] of [[-2.8, -2.3], [2.8, -2.3], [-2.8, 2.3], [2.8, 2.3]]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.2, 8), wood);
      pillar.position.set(cx, 2.3, cz); g.add(pillar);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.4, 4), roofMat);
    roof.position.y = 5; roof.rotation.y = Math.PI / 4; g.add(roof);
    const innerGlow = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.8, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x2a1808, emissive: 0xffc98a, emissiveIntensity: 2.4 }));
    innerGlow.position.set(0, 1.9, 2.85); innerGlow.userData.noShadow = true; g.add(innerGlow);
    g.position.set(sx, sy, sz);
    this.level.add(g);
    const light = new THREE.PointLight(0xffc98a, 14, 22, 1.7);
    light.position.set(sx, sy + 2.2, sz + 2);
    this.level.add(light);
  }

  // =========================================================
  // FIREFLIES
  // =========================================================
  createFireflies() {
    const N = 220;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const z = 60 - Math.random() * 125;
      const x = this.pathX(z) + (Math.random() - 0.5) * 30;
      pos[i * 3] = x;
      pos[i * 3 + 1] = this._h(x, z) + 0.6 + Math.random() * 3.2;
      pos[i * 3 + 2] = z;
      seed[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.fireflyMat = new THREE.ShaderMaterial({
      vertexShader: FIREFLY_VERT, fragmentShader: FIREFLY_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.timeMats.push(this.fireflyMat);
    this.fireflies = new THREE.Points(geo, this.fireflyMat);
    this.level.add(this.fireflies);
  }

  // =========================================================
  // FALLING BLOSSOM PETALS
  // =========================================================
  createPetals() {
    const N = 160;
    this.petals = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.14, 0.14),
      new THREE.MeshBasicMaterial({ color: 0xffc4d8, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
      N);
    this.petals.userData.noShadow = true;
    this.petalData = [];
    for (let i = 0; i < N; i++) {
      const z = 65 - Math.random() * 130;
      const x = this.pathX(z) + (Math.random() - 0.5) * 44;
      this.petalData.push({
        x, z, y: this._h(x, z) + 2 + Math.random() * 7,
        speed: 0.5 + Math.random() * 0.7, sway: Math.random() * 6.3, rot: Math.random() * 6.3,
      });
    }
    this.level.add(this.petals);
    this._petalM = new THREE.Matrix4();
    this._petalQ = new THREE.Quaternion();
    this._petalE = new THREE.Euler();
    this._petalS = new THREE.Vector3(1, 1, 1);
    this._petalV = new THREE.Vector3();
  }

  // =========================================================
  // UPDATE — called every frame by main.js as update(dt, t, player)
  // =========================================================
  update(deltaTime, t, player) {
    this.time += deltaTime;
    for (const m of this.timeMats) m.uniforms.uTime.value = this.time;

    // lantern candle flicker
    for (const l of this.lanternMats) {
      l.mat.emissiveIntensity = 2 + Math.sin(this.time * 6 + l.phase) * 0.35 + Math.sin(this.time * 17 + l.phase * 2) * 0.2;
    }

    // petals drift down and recycle
    for (let i = 0; i < this.petalData.length; i++) {
      const p = this.petalData[i];
      p.y -= p.speed * deltaTime;
      p.sway += deltaTime;
      const ground = this._h(p.x, p.z);
      if (p.y < ground + 0.1) { p.y = ground + 4 + Math.random() * 5; }
      this._petalV.set(p.x + Math.sin(p.sway) * 0.8, p.y, p.z + Math.cos(p.sway * 0.8) * 0.6);
      this._petalE.set(p.sway * 0.7, p.rot + p.sway, p.sway);
      this._petalQ.setFromEuler(this._petalE);
      this._petalM.compose(this._petalV, this._petalQ, this._petalS);
      this.petals.setMatrixAt(i, this._petalM);
    }
    this.petals.instanceMatrix.needsUpdate = true;

    // village NPCs, fragments and portal
    if (this.villageNPCs && player) {
      this.villageNPCs.update(deltaTime, this.time, player);
    }
  }

  // =========================================================
  // DISPOSE
  // =========================================================
  dispose(outerScene = null) {
    // clean up village system first (removes DOM elements too)
    if (this.villageNPCs) { this.villageNPCs.dispose(); this.villageNPCs = null; }

    if (this.level && this.level.parent) this.level.parent.remove(this.level);
    if (this.sky && this.sky.parent) this.sky.parent.remove(this.sky);
    if (this.fireflies && this.fireflies.parent) this.fireflies.parent.remove(this.fireflies);

    if (this.level) {
      this.level.traverse((object) => {
        if (!object.isMesh && !object.isPoints) return;
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => {
            for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose();
            m.dispose();
          });
        }
      });
    }
    if (this.sky) {
      if (this.sky.geometry) this.sky.geometry.dispose();
      if (this.sky.material) {
        if (this.sky.material.map) this.sky.material.map.dispose();
        this.sky.material.dispose();
      }
    }
    this.sky = null; this.fireflies = null; this.petals = null;
    this.timeMats = []; this.lanternMats = []; this.petalData = [];
    this.colliders = [];
  }

  // legacy arity compat
  _updateLegacy(deltaTime) { return this.update(deltaTime, 0, null); }
}

