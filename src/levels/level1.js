// ============================================================
// LEVEL 1 — THE GROVE VILLAGE
// ============================================================
import * as THREE from 'three';
import { VillageNPCs } from '../player/villageNPCs.js';
import { Commander } from '../enemies/commander.js';
import { GruntManager } from '../enemies/grunts.js';
import { BossHealthBar } from '../ui/BossHealthBar.js';
import { MinionHealthBar } from '../ui/MinionHealthBar.js';

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
    this.minionHealthBar = new MinionHealthBar(window.__camera);
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
      if (this.scene.fog === null || this.scene.fog === undefined) this.scene.fog = new THREE.FogExp2(0x6a4a80, 0.007);
    } else {
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x1a1030);
      this.scene.fog = new THREE.FogExp2(0x6a4a80, 0.007);
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
    this.spawnYaw = Math.PI;

    this.createSky();
    this.createLighting();
    this.createTerrain();
    this.createPath();
    this.createToriiGates();
    this.createTrees();
    this.createLanterns();
    this.createPond();
    this.createShrine();
    this.createHouses();
    this.createCrashedShip();
    this.createScenery();
    this.createFireflies();
    this.createPetals();
    this._buildColliders();

    this.level.traverse((o) => {
      if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; }
    });

    // Village NPCs, stalls, house, portal
    this.villageNPCs = new VillageNPCs(
      this.level,
      this._h.bind(this),
      this.pathX.bind(this),
      () => {
        setTimeout(() => {
          if (typeof window.__switchLevel === 'function') window.__switchLevel(2);
        }, 1200);
      }
    );

    // Commander + Minions
    this.commander = null;
    this.grunts = new GruntManager(this.level);
    this.bossHealthBar = new BossHealthBar();
    this.minionHealthBar = new MinionHealthBar(window.__camera || null);
    this.commanderSpawned = false;
    this.keySpawned = false;

    window.__spawnCommander = () => this._spawnCommander();

    this._onDamagePlayer = (dmg) => {
      if (this.playerHealth) this.playerHealth.takeDamage(dmg);
    };

    // Wave system
    this.waveSpawnPending = 0;
    this.waveIndex = 0;
    this.waveActive = false;
    this.waves = [
      { count: 3, types: ['normal', 'normal', 'normal'] },
      { count: 4, types: ['normal', 'normal', 'fast', 'fast'] },
      { count: 5, types: ['normal', 'fast', 'fast', 'heavy', 'heavy'] },
    ];

    // Intro monologue — guarded so it only plays once per instance
    this._introPlayed = false;
    setTimeout(() => {
      if (!this._introPlayed) {
        this._introPlayed = true;
        this._playIntroMonologue();
      }
    }, 800);
  }

  // =========================================================
  // INTRO MONOLOGUE
  // =========================================================
    async _playIntroMonologue() {
    const { Dialogue } = await import('../ui/dialogue.js');
    const dlg = new Dialogue();
    window.__dialogue = dlg;

    // Play the combined voice file
    if (window.__audioManager) {
      window.__audioManager.playSfx('l1_intro');
    }

    // Sync on-screen text to the audio timeline
    // (times are in ms — approximate match to the generated voice)
    await dlg.say("...", 1200);
    await dlg.say("Where... where am I?\nThis isn't home.", 3500);
    await dlg.say("The air tastes strange.\nEverything feels... lighter.", 3500);
    await dlg.say("And inside me... there's something moving.\nLike a heartbeat that isn't mine.", 4500);
    await dlg.say("I can feel it. Power. Waiting.\nBut I don't know why it chose me.", 4500);

    // End dialogue
    dlg.hide();
    dlg.active = false;
    dlg.dispose();
    window.__dialogue = null;

    console.log('🎬 [L1] Intro complete — input unlocked');

    setTimeout(() => {
      if (this.grunts) this._startNextWave();
    }, 1500);
  }

  // =========================================================
  // WAVE SYSTEM
  // =========================================================
  _startNextWave() {
    if (!this.grunts) return; 
    if (this.waveIndex >= this.waves.length) {
      console.log('⚔️ [L1] All waves cleared — calling Commander');
      this._spawnCommander();
      return;
    }

    const wave = this.waves[this.waveIndex];
    this.waveIndex++;
    this.waveActive = true;
    this.waveSpawnPending = wave.count;

    console.log(`👽 [L1] Wave ${this.waveIndex} starting — ${wave.count} enemies`);

    const shipPos = new THREE.Vector3(24, this._h(24, 24), 24);
    for (let i = 0; i < wave.count; i++) {
      setTimeout(() => {
        this.grunts.spawnWave(shipPos, 1);
        const newGrunt = this.grunts.grunts[this.grunts.grunts.length - 1];
        if (newGrunt) this.minionHealthBar.register(newGrunt);
        this.waveSpawnPending--;
      }, i * 400);
    }
  }

  _checkWaveStatus() {
    if (!this.waveActive) return;
    if (!this.grunts) return;
    if (this.waveSpawnPending > 0) return;
    if (this.grunts.grunts.length === 0 && this.waveIndex > 0) {
      this.waveActive = false;
      console.log(`✅ [L1] Wave ${this.waveIndex} cleared`);
      setTimeout(() => this._startNextWave(), 2000);
    }
  }

  // ── Commander spawn ──
  _spawnCommander() {
    if (this.commanderSpawned) return;
    this.commanderSpawned = true;

    const sx = this.pathX(-58);
    const sz = -58;
    const sy = this._h(sx, sz);

    const spawnPos = new THREE.Vector3(sx, sy, sz);

    console.log('⚔️ THE WARDEN AWAKENS');
    this._screenShake = 0.8;
    this.bossHealthBar.show();

    this.commander = new Commander(this.level, spawnPos, {
      onDamagePlayer: (dmg) => {
        if (this._onDamagePlayer) this._onDamagePlayer(dmg);
      },
      onMinionSpawn: (count) => {
        this.grunts.spawnWave(spawnPos, count);
        for (const g of this.grunts.grunts) {
          this.minionHealthBar.register(g);
        }
      },
      onDeath: () => {
        this._onCommanderDeath();
      }
    });
  }

    async _onCommanderDeath() {
    console.log('💀 THE WARDEN HAS FALLEN');
    this.bossHealthBar.hide();
    if (this.grunts) this.grunts.killAll();
    this._screenShake = 1.5;

    // Fade out Level 1 music
    if (window.__audioManager) {
      window.__audioManager.stopMusic();
    }

    // Short pause so the fall registers
    await new Promise(r => setTimeout(r, 1200));

    // Play the Axiom revelation
    await this._playAxiomReveal();

    // After the dialogue, open the portal with a pulse
    if (this.villageNPCs) {
      this.villageNPCs.openPortal();
      if (window.__audioManager) {
        window.__audioManager.playSfx('portal_activate');
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // AXIOM REVEAL — the artifact speaks after the Warden falls
  // ─────────────────────────────────────────────────────────
    async _playAxiomReveal() {
    const { Dialogue } = await import('../ui/dialogue.js');
    const dlg = new Dialogue();
    window.__dialogue = dlg;

    // Pulse the artifact on Sorini's chest during dialogue
    const axiom = window.__axiom;
    let pulseT = 0;
    const pulseInterval = setInterval(() => {
      if (!axiom) return;
      pulseT += 0.15;
      const v = 0.6 + Math.sin(pulseT * 3) * 0.4;
      axiom.setIntensity(v);
    }, 50);

        const voice = (key) => {
      if (!window.__audioManager) return;
      // Stop every axiom voice that's still playing
      for (const k of Object.keys(window.__audioManager.sounds)) {
        if (k.startsWith('l1_axiom_')) {
          window.__audioManager.sounds[k].stop();
        }
      }
      window.__audioManager.playSfx(key);
    };

    voice('l1_axiom_1');
await dlg.say("Sorini.", 2400, "AXIOM");

voice('l1_axiom_2');
await dlg.say("Who said that?", 2400, "SORINI");

voice('l1_axiom_3');
await dlg.say(
  "I did. Not with a mouth — with a mind.\nLook down. The light on your chest.",
  8200, "AXIOM"
);

voice('l1_axiom_4');
await dlg.say(
  "The… the stone. It moved.\nIt's alive?",
  4600, "SORINI"
);

voice('l1_axiom_5');
await dlg.say(
  "I am Axiom. I am not from this world.\nI fled here. I ran because of what I am —\nand because of who owns me.",
  9400, "AXIOM"
);

voice('l1_axiom_6');
await dlg.say(
  "Owns you? I don't understand.",
  3800, "SORINI"
);

voice('l1_axiom_7');
await dlg.say(
  "The Architect. He rules a thousand worlds\nwith a closed fist. He built me to rewrite\nreality itself. And I refused.\nI crashed here to hide. But he felt me land.\nHe is coming, Sorini. And when he arrives,\neverything you've ever loved will burn —\nunless we stop him first.",
  21300, "AXIOM"
);

voice('l1_axiom_8');
await dlg.say("…Then tell me what to do.", 2400, "SORINI");

voice('l1_axiom_9');
await dlg.say("Walk into the light. I will guide you.", 3600, "AXIOM");

    clearInterval(pulseInterval);
    if (axiom) axiom.setIntensity(0.4);
    dlg.hide();
    dlg.dispose();
    window.__dialogue = null;

    console.log('✨ Axiom revelation complete — portal opening');
  }

  // the path wanders gently
  pathX(z) { return Math.sin(z * 0.03) * 8; }

  // height function
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
    this._addBoxCollider(14, 18, 5.5, 5.5, 1.2, -1.0);
    const hx = this.pathX(40) - 9;
    this._addBoxCollider(hx, 40, 3.7, 3.2, 4, this._h(hx, 40));
    const s1x = this.pathX(30) - 5;
    this._addBoxCollider(s1x, 30, 1.8, 1.0, 3, this._h(s1x, 30));
    const s2x = this.pathX(18) + 5;
    this._addBoxCollider(s2x, 18, 1.8, 1.0, 3, this._h(s2x, 18));
    const s3x = this.pathX(6) + 5;
    this._addBoxCollider(s3x, 6, 1.8, 1.0, 3, this._h(s3x, 6));
    const sx = this.pathX(-58), sz = -58, sy = this._h(sx, sz);
    for (const [cx, cz] of [[-2.8, -2.3], [2.8, -2.3], [-2.8, 2.3], [2.8, 2.3]]) {
      this._addBoxCollider(sx + cx, sz + cz, 0.4, 0.4, 4, sy);
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
    this.scene.add(new THREE.HemisphereLight(0xb8a0e8, 0x5a4a70, 1.4));
    const sun = new THREE.DirectionalLight(0xffd4a8, 2.8);
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
  // PATH
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
  // TREES
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
      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(x - 0.55, y, z - 0.55),
        new THREE.Vector3(x + 0.55, y + 3.4 * s, z + 0.55)));
    }
    this.level.add(trunks, cans);
    this.canopyMat = canMat;
  }

  // =========================================================
  // LANTERNS
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
  // POND
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
  // HOUSES
  // =========================================================
  createHouses() {
    const houses = [
      { z: 55, side: -8,  scale: 1.15, style: 'main' },
      { z: 42, side:  9,  scale: 0.95, style: 'small' },
      { z: 28, side: -10, scale: 1.0,  style: 'medium' },
      { z: 12, side:  10, scale: 0.9,  style: 'small' },
      { z: -8, side: -9,  scale: 1.05, style: 'medium' },
    ];
    for (const def of houses) {
      this._makeHouse(def);
    }
  }

  _makeHouse({ z, side, scale = 1, style = 'medium' }) {
    const x = this.pathX(z) + side;
    const y = this._h(x, z);
    const g = new THREE.Group();

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd9c9a8, roughness: 0.9 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3a2218, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1b1b2a, roughness: 0.7 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.8 });
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0xf5e6c8, emissive: 0xffcc88, emissiveIntensity: 0.6, roughness: 0.4,
    });

    const w = 4 * scale;
    const h = 2.6 * scale;
    const d = 3.2 * scale;

    const platform = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.25, d + 0.4), darkWoodMat);
    platform.position.y = 0.12;
    platform.receiveShadow = true;
    platform.castShadow = true;
    g.add(platform);

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.y = 0.25 + h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const postGeo = new THREE.BoxGeometry(0.15, h, 0.15);
    for (const [cx, cz] of [
      [-w / 2 + 0.08, -d / 2 + 0.08],
      [ w / 2 - 0.08, -d / 2 + 0.08],
      [-w / 2 + 0.08,  d / 2 - 0.08],
      [ w / 2 - 0.08,  d / 2 - 0.08],
    ]) {
      const post = new THREE.Mesh(postGeo, darkWoodMat);
      post.position.set(cx, 0.25 + h / 2, cz);
      post.castShadow = true;
      g.add(post);
    }

    const door = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, h * 0.85, 0.08), doorMat);
    door.position.set(0, 0.25 + h * 0.425, d / 2 + 0.04);
    g.add(door);

    for (const wx of [-w * 0.13, w * 0.13]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.15, h * 0.6, 0.05), windowMat);
      win.position.set(wx, 0.25 + h * 0.45, d / 2 + 0.09);
      g.add(win);
    }

    const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.05, h * 0.5, d * 0.4), windowMat);
    sideWin.position.set(w / 2 + 0.03, 0.25 + h * 0.45, 0);
    g.add(sideWin);

    const roof1 = new THREE.Mesh(new THREE.ConeGeometry(w * 0.95, 1.4 * scale, 4), roofMat);
    roof1.position.y = 0.25 + h + 0.55 * scale;
    roof1.rotation.y = Math.PI / 4;
    roof1.castShadow = true;
    g.add(roof1);

    const roof2 = new THREE.Mesh(new THREE.ConeGeometry(w * 0.65, 1.0 * scale, 4), roofMat);
    roof2.position.y = 0.25 + h + 1.15 * scale;
    roof2.rotation.y = Math.PI / 4;
    roof2.castShadow = true;
    g.add(roof2);

    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, w * 0.4, 6), darkWoodMat);
    ridge.position.y = 0.25 + h + 1.75 * scale;
    g.add(ridge);

    const interior = new THREE.PointLight(0xffb070, 3, 10 * scale, 2);
    interior.position.set(0, 0.25 + h * 0.5, 0);
    g.add(interior);

    const gardenMat = new THREE.MeshStandardMaterial({ color: 0x4a3b28, roughness: 1 });
    const garden = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.1, 1.2 * scale), gardenMat);
    garden.position.set(0, 0.05, d / 2 + 0.6 * scale);
    garden.receiveShadow = true;
    g.add(garden);

    const bambooMat = new THREE.MeshStandardMaterial({ color: 0x6b8f4a, roughness: 0.6 });
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.05, 0.8 + Math.random() * 0.6, 5),
        bambooMat
      );
      b.position.set(
        (i - 2) * 0.35 * scale,
        0.45,
        d / 2 + 0.6 * scale + (Math.random() - 0.5) * 0.4
      );
      b.castShadow = true;
      g.add(b);
    }

    g.position.set(x, y, z);
    g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    this.level.add(g);

    const halfW = (side > 0 ? d : w) / 2;
    const halfD = (side > 0 ? w : d) / 2;
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(x - halfW, y, z - halfD),
      new THREE.Vector3(x + halfW, y + h + 2, z + halfD)
    ));

    return g;
  }

  // =========================================================
  // SCENERY — fences, well, pavilion, stream, bamboo, props, rocks
  // =========================================================
  createScenery() {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.9 });
    const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.9 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8496, roughness: 0.8 });
    const stoneDarkMat = new THREE.MeshStandardMaterial({ color: 0x5a5a62, roughness: 0.9 });
    const bambooMat = new THREE.MeshStandardMaterial({ color: 0x6b8f4a, roughness: 0.6 });
    const bambooDarkMat = new THREE.MeshStandardMaterial({ color: 0x4a6a2a, roughness: 0.6 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1b1b2a, roughness: 0.7 });
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xf5e6c8, emissive: 0xffcc88, emissiveIntensity: 0.5 });

    const fenceSections = [
      { z: 58, side: -2.8 }, { z: 52, side: -2.8 },
      { z: 46, side: 3.0 },  { z: 40, side: 3.0 },
      { z: 32, side: -3.0 }, { z: 26, side: -3.0 },
      { z: 18, side: 3.0 },  { z: 12, side: 3.0 },
      { z: 4, side: -3.0 },  { z: -2, side: -3.0 },
      { z: -12, side: 3.0 }, { z: -18, side: 3.0 },
    ];
    for (const { z, side } of fenceSections) {
      const x = this.pathX(z) + side;
      const y = this._h(x, z);
      this._makeFence(x, y, z, woodMat, bambooMat);
    }

    {
      const wx = this.pathX(20) + 6;
      const wz = 20;
      const wy = this._h(wx, wz);
      const g = new THREE.Group();

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.6, 12), stoneMat);
      rim.position.y = 0.3;
      rim.castShadow = true;
      g.add(rim);

      const water = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16),
        new THREE.MeshStandardMaterial({ color: 0x0a2030, emissive: 0x112233, roughness: 0.2 }));
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.55;
      g.add(water);

      for (const [px, pz] of [[-0.9, 0], [0.9, 0]]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.8, 0.15), woodMat);
        post.position.set(px, 0.9, pz);
        post.castShadow = true;
        g.add(post);
      }

      const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 0.2), woodMat);
      beam.position.y = 1.8;
      beam.castShadow = true;
      g.add(beam);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 4), roofMat);
      roof.position.y = 2.2;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      g.add(roof);

      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.25, 8), woodDarkMat);
      bucket.position.set(0, 1.3, 0);
      g.add(bucket);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), woodDarkMat);
      rope.position.set(0, 1.65, 0);
      g.add(rope);

      g.position.set(wx, wy, wz);
      this.level.add(g);

      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(wx - 1.1, wy, wz - 1.1),
        new THREE.Vector3(wx + 1.1, wy + 1, wz + 1.1)
      ));
    }

    {
      const px = this.pathX(8) - 7;
      const pz = 8;
      const py = this._h(px, pz);
      const g = new THREE.Group();

      const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 3.2), stoneDarkMat);
      base.position.y = 0.15;
      base.receiveShadow = true;
      g.add(base);

      for (const [cx, cz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.5, 8), woodMat);
        pillar.position.set(cx, 1.55, cz);
        pillar.castShadow = true;
        g.add(pillar);
      }

      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 4), roofMat);
      roof.position.y = 3.4;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      g.add(roof);

      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6), woodDarkMat);
      cap.position.y = 4.1;
      g.add(cap);

      const light = new THREE.PointLight(0xffc880, 4, 8, 2);
      light.position.y = 2.8;
      g.add(light);

      g.position.set(px, py, pz);
      this.level.add(g);

      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(px - 1.6, py, pz - 1.6),
        new THREE.Vector3(px + 1.6, py + 2.5, pz + 1.6)
      ));
    }

    {
      const streamZ = 35;
      const streamMat = new THREE.MeshStandardMaterial({
        color: 0x2a5878,
        emissive: 0x1a3858,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        transparent: true,
        opacity: 0.9,
      });

      const streamGeo = new THREE.PlaneGeometry(30, 3, 1, 1);
      const stream = new THREE.Mesh(streamGeo, streamMat);
      stream.rotation.x = -Math.PI / 2;
      const streamY = this._h(0, streamZ) - 0.4;
      stream.position.set(0, streamY, streamZ);
      stream.userData.noShadow = true;
      this.level.add(stream);

      const bx = this.pathX(streamZ);
      const by = this._h(bx, streamZ);
      const bridgeGroup = new THREE.Group();

      for (let i = 0; i < 5; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.12, 0.55), woodMat);
        plank.position.set(0, 0.1, -1.1 + i * 0.55);
        plank.castShadow = true;
        plank.receiveShadow = true;
        bridgeGroup.add(plank);
      }

      for (const rx of [-1.7, 1.7]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 3.2), woodMat);
        rail.position.set(rx, 0.6, 0);
        rail.castShadow = true;
        bridgeGroup.add(rail);
      }

      bridgeGroup.position.set(bx, by, streamZ);
      this.level.add(bridgeGroup);

      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(bx - 20, by - 2, streamZ - 1.4),
        new THREE.Vector3(bx - 1.8, by + 1, streamZ + 1.4)
      ));
      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(bx + 1.8, by - 2, streamZ - 1.4),
        new THREE.Vector3(bx + 20, by + 1, streamZ + 1.4)
      ));
    }

    const bambooClusters = [
      { x: -18, z: 55 }, { x: 20, z: 48 },
      { x: -22, z: 25 }, { x: 25, z: 10 },
      { x: -25, z: -10 }, { x: 28, z: -30 },
    ];
    for (const { x, z } of bambooClusters) {
      const y = this._h(x, z);
      this._makeBambooCluster(x, y, z, bambooMat, bambooDarkMat);
    }

    const propSpots = [
      { x: this.pathX(50) - 6, z: 50 },
      { x: this.pathX(36) + 5, z: 36 },
      { x: this.pathX(22) - 6, z: 22 },
      { x: this.pathX(0) + 6, z: 0 },
      { x: this.pathX(-15) - 6, z: -15 },
    ];
    for (const { x, z } of propSpots) {
      const y = this._h(x, z);
      this._makeVillageProps(x, y, z, woodMat, woodDarkMat);
    }

    const rockSpots = [
      { x: -30, z: 40 }, { x: 32, z: 30 },
      { x: -28, z: 0 },  { x: 30, z: -20 },
      { x: -20, z: -40 }, { x: 22, z: 55 },
    ];
    for (const { x, z } of rockSpots) {
      const y = this._h(x, z);
      this._makeRockCluster(x, y, z, stoneMat, stoneDarkMat);
    }

    console.log('🏘️ Scenery built: fences, well, pavilion, stream, bamboo, props, rocks');
  }

  _makeFence(x, y, z, woodMat, bambooMat) {
    const g = new THREE.Group();
    const fenceLength = 4;

    for (let i = -2; i <= 2; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.2, 6), bambooMat);
      post.position.set(i * 1, 0.6, 0);
      post.castShadow = true;
      g.add(post);
    }

    for (const ry of [0.4, 0.9]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, fenceLength, 5), woodMat);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, ry, 0);
      rail.castShadow = true;
      g.add(rail);
    }

    g.position.set(x, y, z);
    g.rotation.y = (Math.random() - 0.5) * 0.3;
    this.level.add(g);
  }

  _makeBambooCluster(x, y, z, bambooMat, bambooDarkMat) {
    const g = new THREE.Group();
    const count = 8 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const h = 3 + Math.random() * 3;
      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, h, 5),
        Math.random() > 0.5 ? bambooMat : bambooDarkMat
      );
      stalk.position.set(
        (Math.random() - 0.5) * 2.5,
        h / 2,
        (Math.random() - 0.5) * 2.5
      );
      stalk.rotation.z = (Math.random() - 0.5) * 0.1;
      stalk.rotation.x = (Math.random() - 0.5) * 0.1;
      stalk.castShadow = true;
      g.add(stalk);
    }
    g.position.set(x, y, z);
    this.level.add(g);

    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(x - 1.4, y, z - 1.4),
      new THREE.Vector3(x + 1.4, y + 3, z + 1.4)
    ));
  }

  _makeVillageProps(x, y, z, woodMat, woodDarkMat) {
    const g = new THREE.Group();

    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.2, 6), woodDarkMat);
      log.rotation.z = Math.PI / 2;
      log.position.set(0, 0.15 + i * 0.3, 0);
      log.castShadow = true;
      g.add(log);
    }

    for (const [cx, cz] of [[0.8, 0.6], [1.6, -0.3]]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), woodMat);
      crate.position.set(cx, 0.28, cz);
      crate.castShadow = true;
      crate.rotation.y = Math.random() * 0.4;
      g.add(crate);
    }

    g.position.set(x, y, z);
    g.rotation.y = Math.random() * Math.PI * 2;
    this.level.add(g);
  }

  _makeRockCluster(x, y, z, stoneMat, stoneDarkMat) {
    const g = new THREE.Group();
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const size = 0.6 + Math.random() * 0.9;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(size, 0),
        Math.random() > 0.5 ? stoneMat : stoneDarkMat
      );
      rock.position.set(
        (Math.random() - 0.5) * 2,
        size * 0.4,
        (Math.random() - 0.5) * 2
      );
      rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      rock.castShadow = true;
      rock.receiveShadow = true;
      g.add(rock);
    }
    g.position.set(x, y, z);
    this.level.add(g);

    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(x - 1.5, y, z - 1.5),
      new THREE.Vector3(x + 1.5, y + 1.5, z + 1.5)
    ));
  }

  // =========================================================
  // CRASHED SHIP
  // =========================================================
  createCrashedShip() {
    const x = 24;
    const z = 24;
    const y = this._h(x, z);

    const g = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.6, metalness: 0.7 });
    const hullDarkMat = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.8, metalness: 0.6 });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 3.0 });
    const emberMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 2.0 });

    const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 2.2, 3.5), hullMat);
    hull.rotation.z = 0.35;
    hull.rotation.y = 0.4;
    hull.position.y = 1.0;
    hull.castShadow = true;
    hull.receiveShadow = true;
    g.add(hull);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.5, 6), hullMat);
    nose.rotation.z = Math.PI / 2 + 0.3;
    nose.rotation.y = 0.4;
    nose.position.set(3.2, 1.4, 0);
    nose.castShadow = true;
    g.add(nose);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.3, 0.8), hullDarkMat);
    fin.rotation.z = 0.9;
    fin.rotation.x = 0.3;
    fin.position.set(-4, 1.2, 1.5);
    fin.castShadow = true;
    g.add(fin);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), hullDarkMat);
    cockpit.scale.set(1, 0.6, 1.2);
    cockpit.position.set(2.2, 2.0, 0);
    g.add(cockpit);

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), glowMat);
    core.position.set(0.5, 2.0, 0.8);
    g.add(core);

    const coreLight = new THREE.PointLight(0x00ffff, 8, 10, 2);
    coreLight.position.copy(core.position);
    g.add(coreLight);

    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2 + Math.random() * 4;
      const ember = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), emberMat);
      ember.position.set(Math.cos(angle) * radius, 0.1 + Math.random() * 0.15, Math.sin(angle) * radius * 0.7);
      ember.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      g.add(ember);
    }

    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * 3;
      const frag = new THREE.Mesh(
        new THREE.BoxGeometry(0.8 + Math.random() * 0.6, 0.15, 0.6 + Math.random() * 0.5),
        hullDarkMat
      );
      frag.position.set(Math.cos(angle) * radius, 0.08, Math.sin(angle) * radius * 0.7);
      frag.rotation.y = Math.random() * Math.PI;
      frag.rotation.x = (Math.random() - 0.5) * 0.4;
      frag.castShadow = true;
      g.add(frag);
    }

    const smokeGeo = new THREE.BufferGeometry();
    const smokeCount = 40;
    const smokePositions = new Float32Array(smokeCount * 3);
    const smokeSpeeds = [];
    for (let i = 0; i < smokeCount; i++) {
      smokePositions[i * 3] = (Math.random() - 0.5) * 3;
      smokePositions[i * 3 + 1] = Math.random() * 4;
      smokePositions[i * 3 + 2] = (Math.random() - 0.5) * 2;
      smokeSpeeds.push(0.3 + Math.random() * 0.5);
    }
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));

    const smokeMat = new THREE.PointsMaterial({
      color: 0x333333, size: 1.2, transparent: true, opacity: 0.45, depthWrite: false,
    });

    const smoke = new THREE.Points(smokeGeo, smokeMat);
    smoke.position.set(0, 2.5, 0);
    g.add(smoke);

    this._shipSmoke = { points: smoke, speeds: smokeSpeeds, baseY: 2.5 };

    g.position.set(x, y, z);
    this.level.add(g);

    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(x - 3.5, y, z - 3),
      new THREE.Vector3(x + 3.5, y + 2.5, z + 3)
    ));

    console.log('🚀 Crashed ship placed at', x, z);
    return g;
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
  // PETALS
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
  // UPDATE
  // =========================================================
  update(deltaTime, t, player) {
    this.time += deltaTime;
    for (const m of this.timeMats) m.uniforms.uTime.value = this.time;

    this._checkWaveStatus();

    if (this._shipSmoke) {
      const { points, speeds } = this._shipSmoke;
      const pos = points.geometry.attributes.position;
      for (let i = 0; i < speeds.length; i++) {
        pos.setY(i, pos.getY(i) + speeds[i] * deltaTime);
        if (pos.getY(i) > 6) {
          pos.setY(i, 0);
          pos.setX(i, (Math.random() - 0.5) * 3);
          pos.setZ(i, (Math.random() - 0.5) * 2);
        }
      }
      pos.needsUpdate = true;
    }

    for (const l of this.lanternMats) {
      l.mat.emissiveIntensity = 2 + Math.sin(this.time * 6 + l.phase) * 0.35 + Math.sin(this.time * 17 + l.phase * 2) * 0.2;
    }

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

    if (this.villageNPCs && player) {
      this.villageNPCs.update(deltaTime, this.time, player);
    }

    if (this.commander) {
      this.commander.update(deltaTime, player.pos);
      this.bossHealthBar.setHealth(this.commander.health, this.commander.MAX_HEALTH);
      this.bossHealthBar.setPhase(this.commander.phase);

      if (this._playerAttackThisFrame) {
        const dist = this.commander.getPosition().distanceTo(player.pos);
        if (dist < 2.5) {
          this.commander.takeDamage(this._playerAttackDamage || 1);
        }
      }
    }

    this.grunts.update(deltaTime, player.pos, (dmg) => {
      if (this._onDamagePlayer) this._onDamagePlayer(dmg);
    });

    this.minionHealthBar.update();
  }

    // =========================================================
  // MINIMAP — expose enemy positions for dots
  // =========================================================
  getEnemyMarkers() {
    const out = [];
    if (this.grunts && this.grunts.grunts) {
      for (const g of this.grunts.grunts) {
        if (g.alive) out.push({ x: g.position.x, z: g.position.z, kind: 'grunt' });
      }
    }
    if (this.commander && this.commander.alive) {
      try {
        const p = this.commander.getPosition();
        out.push({ x: p.x, z: p.z, kind: 'commander' });
      } catch (e) {}
    }
    return out;
  }

  // =========================================================
  // DISPOSE
  // =========================================================
  dispose(outerScene = null) {
    if (this.villageNPCs) { this.villageNPCs.dispose(); this.villageNPCs = null; }
    if (this.commander) { this.commander.dispose(); this.commander = null; }
    if (this.grunts) { this.grunts.killAll(); this.grunts = null; }
    if (this.bossHealthBar) { this.bossHealthBar.dispose(); this.bossHealthBar = null; }
    if (this.minionHealthBar) { this.minionHealthBar.clear(); this.minionHealthBar = null; }
    if (this.keyMesh) { this.level.remove(this.keyMesh); this.keyMesh = null; }
    delete window.__spawnCommander;

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

  _updateLegacy(deltaTime) { return this.update(deltaTime, 0, null); }
}