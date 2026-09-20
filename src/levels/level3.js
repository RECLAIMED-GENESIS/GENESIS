// ============================================================
// LEVEL 3 — THE ARCHITECT'S REALM
// An Apokolips/Darkseid-coded throne-void: black monolithic
// architecture, an Omega-branded floor, fire pits, and a distant
// colossus silhouette watching from beyond the ring. High CONTRAST
// on purpose — near-black stone against molten orange-red glow —
// so it reads as oppressive without going flat-dark/unreadable.
// Three phases, driven by boss HP:
//   Phase 1 ORDER    — pristine floor + orbiting omega-shard spiral
//   Phase 2 FRACTURE — outer ring splits into drifting wedges,
//                      satellite platforms appear (jump between them)
//   Phase 3 COLLAPSE — floor dissolves (custom dissolve shader),
//                      debris ring orbits, the fire pits flare
// Call setPhase(1|2|3) from your boss logic.
// Press P in the demo to preview the phases.
// ============================================================
import * as THREE from 'three';
import { dissolveNoiseTexture, starTexture, techFloorTexture, facilityPanelTexture } from '../utils/utils.js';
import { NebulaSkyMaterial, GodRayMaterial, DissolveMaterial } from '../shaders/shaders.js';

export class ArchitectLevel {
  constructor(scene) {
    this.name = "LEVEL 3 — THE ARCHITECT'S REALM";
    this.root = new THREE.Group();
    scene.add(this.root);
    this.colliders = [];
    this.phase = 1;
    this.timeMats = [];
    this.wedges = [];     // outer ring pieces (phase 2)
    this.satellites = []; // small platforms (phase 2)
    this.shards = [];     // dissolving floor pieces (phase 3)
    this.phase3Start = -1;

    scene.fog = new THREE.FogExp2(0x0a0503, 0.0065);
    scene.background = new THREE.Color(0x0a0503);

    // void sky: molten, ominous nebula — near-black with deep red/orange fire
    // bleeding through, instead of the cool purple of a "neutral" void
    this.skyMat = NebulaSkyMaterial({ cA: 0x060302, cB: 0x3a0d05, cC: 0x8a2a06 });
    this.timeMats.push(this.skyMat);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 24), this.skyMat);
    this.root.add(sky);

    // ---- LIGHTS ----
    // Deliberately high-contrast: cool dim ambient as a floor so nothing
    // is pure black, one hard warm key overhead (the "judgment" light),
    // and a molten rim/fill from below so silhouettes read against the dark.
    this.root.add(new THREE.AmbientLight(0x2a2440, 0.55));
    this.root.add(new THREE.HemisphereLight(0x4a3550, 0x0c0604, 0.6));
    const spot = new THREE.SpotLight(0xffcfa0, 520, 130, 0.55, 0.55, 1.3);
    spot.position.set(0, 46, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    this.root.add(spot, spot.target);
    const under = new THREE.PointLight(0xff4a1f, 90, 70, 1.8);
    under.position.set(0, -6, 0);
    this.root.add(under);
    // cold rim light from the far side — keeps the "hero" side of geometry
    // from vanishing into the fire-glow, classic high-contrast villain lighting
    const rim = new THREE.DirectionalLight(0x6a8fff, 0.45);
    rim.position.set(-50, 30, -70);
    this.root.add(rim);

    // ---- MAIN PLATFORM: visible tech-panel floor, not flat black ----
    this.platformMat = new THREE.MeshStandardMaterial({
      map: techFloorTexture(77, '#ff6a2a'), color: 0x8a7a70, roughness: 0.45, metalness: 0.6,
    });
    this.platform = new THREE.Mesh(new THREE.CylinderGeometry(24, 26, 3, 64), this.platformMat);
    this.platform.position.y = 0;         // top surface at y = 1.5
    this.platform.receiveShadow = true;
    this._add(this.platform);

    const ringGlow = new THREE.Mesh(new THREE.TorusGeometry(24.3, 0.3, 8, 80),
      new THREE.MeshStandardMaterial({ color: 0x150800, emissive: 0xff5a1a, emissiveIntensity: 1.4 }));
    ringGlow.rotation.x = Math.PI / 2;
    ringGlow.position.y = 1.6;
    this._add(ringGlow);

    // ---- OMEGA GLYPH etched into the floor, glowing molten orange ----
    // Two concentric rings + four "spoke" bars — reads as a brand/sigil
    // from above without needing a texture.
    const glyphMat = new THREE.MeshStandardMaterial({
      color: 0x150800, emissive: 0xff6a1f, emissiveIntensity: 1.2, roughness: 0.4, metalness: 0.6,
    });
    const gRingOuter = new THREE.Mesh(new THREE.TorusGeometry(16, 0.35, 8, 64), glyphMat);
    gRingOuter.rotation.x = Math.PI / 2; gRingOuter.position.y = 1.52;
    this._add(gRingOuter);
    const gRingInner = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.3, 8, 48), glyphMat);
    gRingInner.rotation.x = Math.PI / 2; gRingInner.position.y = 1.52;
    this._add(gRingInner);
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 6.5), glyphMat);
      const a = i * Math.PI / 2;
      bar.position.set(Math.cos(a) * 13.2, 1.52, Math.sin(a) * 13.2);
      bar.rotation.y = a;
      this._add(bar);
    }

    // ---- OMEGA-SHARD SPIRAL of orbiting cubes (fiery instead of gold) ----
    this.spiral = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({
      color: 0x3a1408, emissive: 0xff7a2a, emissiveIntensity: 0.55,
      metalness: 0.85, roughness: 0.35,
    });
    for (let i = 0; i < 42; i++) {
      const th = i * 0.42;
      const r = 3 + th * 0.85;
      const c = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), gold);
      c.position.set(Math.cos(th) * r, 3 + th * 0.35, Math.sin(th) * r);
      c.userData.th = th;
      this.spiral.add(c);
    }
    this._add(this.spiral);

    // ---- GOD RAY cone over the centre ----
    this.rayMat = GodRayMaterial();
    this.timeMats.push(this.rayMat);
    const ray = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 9, 44, 32, 1, true), this.rayMat);
    ray.position.y = 24;
    this._add(ray);

    // ---- FIRE PITS: molten gaps ringing the platform ----
    const fireMat = new THREE.MeshStandardMaterial({
      color: 0x1a0800, emissive: 0xff5518, emissiveIntensity: 2.0, roughness: 0.6,
    });
    this.firePits = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const pit = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20), fireMat.clone());
      pit.rotation.x = -Math.PI / 2;
      pit.position.set(Math.cos(a) * 30, -0.3, Math.sin(a) * 30);
      pit.userData.phase = i * 0.8;
      this.firePits.push(pit);
      this.root.add(pit); // atmosphere only, not on minimap
      const glow = new THREE.PointLight(0xff5518, 22, 24, 2);
      glow.position.set(pit.position.x, 2, pit.position.z);
      this.root.add(glow);
      pit.userData.light = glow;
    }

    // ============================================================
    // ---- THE THRONE ROOM: an enclosed chamber, not an open void ----
    // Solid wall ring + domed roof with an oculus (the god-ray shaft
    // pours through it), interior monolith-pillars, wall consoles for
    // the "tech stuff" read, and an explicit throne + fire braziers.
    // ============================================================
    const ROOM_R = 40; // wall radius — platform (24-26) sits well inside it
    const ENTRY_ANGLE = Math.PI / 2; // where the player walks in from (spawn is at +z)

    const wallMat = new THREE.MeshStandardMaterial({
      map: facilityPanelTexture(9), color: 0x3a2018, roughness: 0.7, metalness: 0.5,
    });
    const slitMat = new THREE.MeshStandardMaterial({ color: 0x200800, emissive: 0xff7a2a, emissiveIntensity: 1.8 });

    // solid wall ring, one gap left open for the entrance corridor
    const WALL_SEG = 24, ENTRY_WIDTH = 2.4;
    this.wallSegs = [];
    for (let i = 0; i < WALL_SEG; i++) {
      const a = (i / WALL_SEG) * Math.PI * 2;
      let da = a - ENTRY_ANGLE;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < (ENTRY_WIDTH / WALL_SEG) * Math.PI) continue; // entrance gap
      const seg = new THREE.Mesh(new THREE.BoxGeometry(2, 34, (Math.PI * 2 * ROOM_R) / WALL_SEG + 0.4), wallMat);
      seg.position.set(Math.cos(a) * ROOM_R, 15, Math.sin(a) * ROOM_R);
      seg.rotation.y = -a;
      seg.castShadow = true; seg.receiveShadow = true;
      this.root.add(seg); // walls are atmosphere/bounds, not on minimap
    }

    // interior monolith-pillars, set just inside the walls — the
    // "watching eye" slits still read, now as part of a real room
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const h = 30 + (i % 3) * 4;
      const mono = new THREE.Mesh(new THREE.BoxGeometry(4, h, 4), wallMat);
      mono.position.set(Math.cos(a) * (ROOM_R - 4), h / 2 - 2, Math.sin(a) * (ROOM_R - 4));
      mono.castShadow = true;
      this.root.add(mono);
      const slit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.3), slitMat);
      slit.position.set(mono.position.x, h * 0.6 - 2, mono.position.z + 2.1);
      this.root.add(slit);
    }

    // domed roof with an oculus so the god-ray still pours in from "outside"
    const roof = new THREE.Mesh(
      new THREE.SphereGeometry(ROOM_R + 2, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.4),
      new THREE.MeshStandardMaterial({ map: facilityPanelTexture(10), color: 0x352018, roughness: 0.75, metalness: 0.4, side: THREE.DoubleSide })
    );
    roof.position.y = 32;
    this.root.add(roof);

    // ---- TECH CONSOLES: banked around the walls — "open space, tech stuff" ----
    const consoleMat = new THREE.MeshStandardMaterial({
      map: techFloorTexture(31, '#ff8a3a'), color: 0x8a7a70, roughness: 0.4, metalness: 0.6,
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.35;
      if (Math.abs(Math.atan2(Math.sin(a - ENTRY_ANGLE), Math.cos(a - ENTRY_ANGLE))) < 0.5) continue; // keep entry clear
      const console_ = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.6, 2), consoleMat);
      console_.position.set(Math.cos(a) * (ROOM_R - 8), 1.3, Math.sin(a) * (ROOM_R - 8));
      console_.rotation.y = -a + Math.PI;
      console_.castShadow = true;
      this.root.add(console_);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.4), slitMat);
      screen.position.set(console_.position.x + Math.cos(a) * -0.1, 2.7, console_.position.z + Math.sin(a) * -0.1);
      screen.rotation.y = console_.rotation.y;
      this.root.add(screen);
    }

    // ---- THE THRONE, flanked by fire braziers ----
    const throneMat = new THREE.MeshStandardMaterial({ color: 0x0e0705, roughness: 0.6, metalness: 0.7, emissive: 0x3a1006, emissiveIntensity: 0.3 });
    this.throne = new THREE.Group();
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 1.4, 24), throneMat);
    dais.position.y = 0.7;
    this.throne.add(dais);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(7, 1.2, 6), throneMat);
    seat.position.y = 2.4;
    this.throne.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(7.5, 11, 1.2), throneMat);
    back.position.set(0, 7, -2.8);
    this.throne.add(back);
    for (const ax of [-3.6, 3.6]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1, 1.6, 5.5), throneMat);
      arm.position.set(ax, 3.4, -0.2);
      this.throne.add(arm);
    }
    // omega crest set into the throne back
    const crest = new THREE.Mesh(new THREE.TorusGeometry(2, 0.3, 8, 24), slitMat);
    crest.position.set(0, 9.5, -3.35);
    this.throne.add(crest);
    this.throne.position.set(0, 1.5, -(ROOM_R - 12));
    this.throne.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.root.add(this.throne);

    // fire braziers flanking the throne
    const brazierMat = new THREE.MeshStandardMaterial({ color: 0x1a0a04, roughness: 0.6, metalness: 0.5 });
    const flameMat = new THREE.MeshStandardMaterial({ color: 0x1a0800, emissive: 0xff5518, emissiveIntensity: 2.2, roughness: 0.5 });
    this.braziers = [];
    for (const bx of [-6.5, 6.5]) {
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1, 3.2, 10), brazierMat);
      pedestal.position.set(this.throne.position.x + bx, 1.5 + 1.6, this.throne.position.z + 1.5);
      pedestal.castShadow = true;
      this.root.add(pedestal);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 0.8, 1, 10), brazierMat);
      bowl.position.set(pedestal.position.x, pedestal.position.y + 1.9, pedestal.position.z);
      this.root.add(bowl);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 8), flameMat.clone());
      flame.position.set(bowl.position.x, bowl.position.y + 1.4, bowl.position.z);
      flame.userData.phase = Math.random() * 6;
      this.braziers.push(flame);
      this.root.add(flame);
      const light = new THREE.PointLight(0xff5518, 20, 22, 2);
      light.position.set(bowl.position.x, bowl.position.y + 2, bowl.position.z);
      this.root.add(light);
      flame.userData.light = light;
    }

    // ---- THE ARCHITECT: colossus statue, now INSIDE as the throne-back centerpiece ----
    // Scaled to actually fit under the dome, looming directly behind/above
    // the throne rather than sitting far off in the fog.
    this.colossus = new THREE.Group();
    const colMat = new THREE.MeshStandardMaterial({ color: 0x050303, roughness: 1, emissive: 0x2a0c05, emissiveIntensity: 0.5 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6.5, 16, 8), colMat);
    torso.position.y = 8;
    this.colossus.add(torso);
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(13, 3, 6), colMat);
    shoulders.position.y = 15.5;
    this.colossus.add(shoulders);
    const head = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), colMat);
    head.position.y = 20;
    this.colossus.add(head);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3a1a });
    for (const ex of [-1.2, 1.2]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.4), eyeMat);
      eye.position.set(ex, 20.3, 2.6);
      this.colossus.add(eye);
    }
    this.colossus.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.colossus.position.set(0, 1.5, this.throne.position.z - 3); // rises directly behind the throne
    this.root.add(this.colossus); // backdrop, off minimap

    // ---- PHASE 2: outer ring wedges (pre-built, hidden) ----
    const wedgeGeo = new THREE.CylinderGeometry(34, 36, 2.5, 10, 1, false, 0, (Math.PI * 2) / 18);
    for (let i = 0; i < 18; i++) {
      const w = new THREE.Mesh(wedgeGeo, this.platformMat);
      w.position.y = -1.5;
      w.rotation.y = i * (Math.PI * 2) / 18;
      w.visible = false;
      // each wedge drifts outward + tumbles when released
      const a = i * (Math.PI * 2) / 18;
      w.userData.vel = new THREE.Vector3(Math.cos(a) * (1.5 + (i % 3)), 0.4 + (i % 4) * 0.3, Math.sin(a) * (1.5 + (i % 3)));
      w.userData.spin = (i % 2 ? 1 : -1) * 0.15;
      this.wedges.push(w);
      this._add(w);
    }

    // ---- PHASE 2: satellite platforms (jump between them) ----
    const satDefs = [[30, 7, -10], [-28, 9, 12], [6, 12, 32]];
    for (const [x, y, z] of satDefs) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.2, 1.4, 24), this.platformMat);
      s.position.set(x, y, z);
      s.visible = false;
      s.userData.baseY = y;
      s.userData.phase = Math.random() * 6;
      this.satellites.push(s);
      this._add(s);
    }

    // ---- PHASE 3: dissolving floor shards + debris ring ----
    this.noiseTex = dissolveNoiseTexture();
    const shardGeo = new THREE.CylinderGeometry(23, 23, 0.35, 6, 1, false, 0, (Math.PI * 2) / 12);
    for (let i = 0; i < 12; i++) {
      const mat = DissolveMaterial(this.noiseTex, 0x140a06);
      const s = new THREE.Mesh(shardGeo, mat);
      s.position.y = 1.55;
      s.rotation.y = i * (Math.PI * 2) / 12;
      s.visible = false;
      this.shards.push(s);
      this._add(s);
    }
    this.debris = new THREE.InstancedMesh(
      new THREE.TetrahedronGeometry(0.9),
      new THREE.MeshStandardMaterial({ color: 0x161009, emissive: 0xff5518, emissiveIntensity: 0.25, roughness: 0.6, metalness: 0.5 }), 140);
    {
      const M = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < 140; i++) {
        const a = Math.random() * Math.PI * 2, r = 42 + Math.random() * 30;
        V.set(Math.cos(a) * r, (Math.random() - 0.5) * 24, Math.sin(a) * r);
        Q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3));
        M.compose(V, Q, S);
        this.debris.setMatrixAt(i, M);
      }
    }
    this.debris.visible = false;
    this.root.add(this.debris); // debris stays off the minimap (layer 0)

    this.spawn = new THREE.Vector3(0, 1.5, 10);
  }

  // ---- THE BOSS HOOK: drive this from boss HP ----
  setPhase(n, t = 0) {
    this.phase = n;
    if (n >= 2) for (const w of this.wedges) w.visible = true;
    if (n >= 2) for (const s of this.satellites) s.visible = true;
    if (n >= 3) {
      this.phase3Start = t;
      this.platform.visible = false;      // replaced by dissolving shards
      for (const s of this.shards) s.visible = true;
      this.debris.visible = true;
    }
  }

  groundHeight(x, z, feetY = Infinity) {
    let g = -1000;
    if (this.phase < 3 && x * x + z * z < 24 * 24 && 1.5 <= feetY + 1) g = 1.5;
    for (const s of this.satellites) {
      if (!s.visible) continue;
      const dx = x - s.position.x, dz = z - s.position.z;
      const top = s.position.y + 0.7;
      if (dx * dx + dz * dz < 5.5 * 5.5 && top <= feetY + 1 && top > g) g = top;
    }
    return g;
  }

  update(dt, t, player) {
    for (const m of this.timeMats) m.uniforms.uTime.value = t;
    // fire pits flicker like real flame, not a clean sine pulse
    for (const p of this.firePits) {
      const n = Math.sin(t * 9 + p.userData.phase) * Math.sin(t * 3.7 + p.userData.phase);
      const k = 1.6 + Math.max(0, n) * 1.2;
      p.material.emissiveIntensity = k;
      p.userData.light.intensity = 14 + Math.max(0, n) * 16;
    }
    // throne braziers flicker
    for (const f of this.braziers) {
      const n = Math.sin(t * 8.3 + f.userData.phase) * Math.sin(t * 3.1 + f.userData.phase);
      f.material.emissiveIntensity = 1.8 + Math.max(0, n) * 1.4;
      f.userData.light.intensity = 16 + Math.max(0, n) * 14;
    }
    // omega-shard spiral orbits the arena
    this.spiral.rotation.y += dt * 0.18;
    this.spiral.children.forEach((c, i) => {
      c.rotation.x += dt * (0.3 + (i % 5) * 0.1);
      c.rotation.y += dt * 0.2;
    });
    if (this.phase >= 2) {
      for (const w of this.wedges) {          // released ring pieces drift + tumble
        w.position.addScaledVector(w.userData.vel, dt);
        w.rotation.y += w.userData.spin * dt;
        w.rotation.x += w.userData.spin * 0.6 * dt;
      }
      for (const s of this.satellites)        // platforms bob
        s.position.y = s.userData.baseY + Math.sin(t * 0.7 + s.userData.phase) * 0.6;
    }
    if (this.phase >= 3 && this.phase3Start >= 0) {
      // floor dissolves as the fight goes on (0 -> 0.5 keeps walkable holes)
      const d = Math.min(0.5, (t - this.phase3Start) * 0.06);
      for (const s of this.shards) s.material.uniforms.uDissolve.value = d;
      this.debris.rotation.y += dt * 0.05;
    }
  }

  _add(obj) {
    obj.traverse ? obj.traverse(o => o.layers && o.layers.enable(1))
                 : obj.layers && obj.layers.enable(1);
    this.root.add(obj);
  }

  dispose(scene) {
    this.root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
          for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose();
          m.dispose();
        });
      }
    });
    this.noiseTex.dispose();
    scene.remove(this.root);
    scene.fog = null;
    scene.background = null;
  }
}
