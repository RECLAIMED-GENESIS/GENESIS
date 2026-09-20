// ============================================================
// LEVEL 2 — THEIR WORLD
// Open alien landscape: fbm heightmap terrain, meandering energy
// river (custom shader), floating islands, jump pads, crystal
// fields (instanced!), a portal gate, and an animated nebula sky.
// Movement is fully 3D: pads launch you up onto the islands.
// ============================================================
import * as THREE from 'three';
import { fbm2, sstep, mulberry32, facilityPanelTexture, techFloorTexture } from './../utils/utils.js';
import { NebulaSkyMaterial, EnergyMaterial, PortalMaterial, ForceFieldMaterial } from '../shaders/shaders.js';

export class AlienLevel {
  constructor(scene) {
    this.name = 'LEVEL 2 — THEIR WORLD';
    this.root = new THREE.Group();
    scene.add(this.root);
    this.colliders = [];
    this.timeMats = [];
    this.islands = [];   // { mesh, r }  bobbing walkable islands
    this.pads = [];      // { x, y, z, ring }  jump pads

    scene.fog = new THREE.FogExp2(0x0b0618, 0.0042);
    scene.background = new THREE.Color(0x0b0618);

    // ---- DYNAMIC SKY: animated nebula shader dome ----
    this.skyMat = NebulaSkyMaterial();
    this.timeMats.push(this.skyMat);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 24), this.skyMat);
    this.root.add(sky); // layer 0 only -> hidden from minimap

    // ---- LIGHTS ----
    this.root.add(new THREE.HemisphereLight(0x9a7cff, 0x2a1642, 1.1));
    const sun = new THREE.DirectionalLight(0x9fd8ff, 2.2);
    sun.position.set(80, 120, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, far: 350 });
    this.root.add(sun);
    // fake fill from the opposite side so the far side of terrain/islands
    // isn't pitch black — cheap, no shadow map, just for readability
    const fill = new THREE.DirectionalLight(0xff6fd8, 0.5);
    fill.position.set(-90, 60, -60);
    this.root.add(fill);

    // ---- FACILITY SITE: computed before terrain so we can flatten a pad for it ----
    this.facilityZ = -195;
    this.facilityX = this.riverX(this.facilityZ);
    this.facilityY = 1.5; // flat pad height, matches the spawn-flat convention below

    // ---- TERRAIN (must use the SAME height function for collision!) ----
    const geo = new THREE.PlaneGeometry(500, 500, 140, 140);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cLow = new THREE.Color(0x1a0f2e), cMid = new THREE.Color(0x51266b),
          cHigh = new THREE.Color(0x2f8f8a), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.terrainHeight(x, z);
      pos.setY(i, h);
      const t = sstep(-8, 24, h);
      tmp.lerpColors(cLow, cMid, Math.min(1, t * 1.4));
      if (t > 0.6) tmp.lerp(cHigh, (t - 0.6) / 0.4);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    terrain.receiveShadow = true;
    this._add(terrain);

    // ---- ENERGY RIVER: meanders along the valley (custom shader) ----
    this.riverMat = EnergyMaterial();
    this.timeMats.push(this.riverMat);
    const rgeo = new THREE.PlaneGeometry(12, 470, 3, 120);
    rgeo.rotateX(-Math.PI / 2);
    const rpos = rgeo.attributes.position;
    for (let i = 0; i < rpos.count; i++) {
      const z = rpos.getZ(i);
      rpos.setX(i, rpos.getX(i) + this.riverX(z)); // follow the curve
      rpos.setY(i, -1.1);
    }
    const river = new THREE.Mesh(rgeo, this.riverMat);
    this._add(river);

    // ---- FLOATING ISLANDS (walkable tops — jump pads reach them) ----
    const islandDefs = [
      { x: 18,  z: -30,  r: 9,  y: 11 },
      { x: -16, z: -80,  r: 11, y: 17 },
      { x: 20,  z: -130, r: 8,  y: 23 },
    ];
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x3a2a55, roughness: 0.9, flatShading: true,
    });
    const crysMat = new THREE.MeshStandardMaterial({
      color: 0x2a0a2e, emissive: 0xff4fd8, emissiveIntensity: 1.6, roughness: 0.3,
    });
    for (const d of islandDefs) {
      const g = new THREE.IcosahedronGeometry(d.r, 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {          // stretch into a stalactite underside
        const y = p.getY(i);
        if (y < 0) p.setY(i, y * 1.9 - (y * y) / d.r * 0.8);
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, rockMat);
      m.scale.y = 0.55;
      m.position.set(d.x, d.y, d.z);
      m.castShadow = true; m.receiveShadow = true;
      this._add(m);
      for (let k = 0; k < 4; k++) {                // glowing crystals on top
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2 + k * 0.3, 5), crysMat);
        const a = k * 1.7;
        c.position.set(d.x + Math.cos(a) * d.r * 0.45, d.y + d.r * 0.55 + 1, d.z + Math.sin(a) * d.r * 0.45);
        c.rotation.set((Math.random() - 0.5) * 0.4, a, (Math.random() - 0.5) * 0.4);
        this._add(c);
      }
      this.islands.push({ mesh: m, r: d.r, baseY: d.y, phase: Math.random() * 6 });
    }

    // ---- JUMP PADS: launch the player up to the islands ----
    const padSpots = [
      { x: 10, z: -18 },  // -> island 1
      { x: -8, z: -66 },  // -> island 2
      { x: 12, z: -116 }, // -> island 3
      { x: 0,  z: 120 },  // fun pad near spawn
    ];
    const padBaseMat = new THREE.MeshStandardMaterial({
      color: 0x0a2a2e, emissive: 0x22ffee, emissiveIntensity: 1.2, roughness: 0.4,
    });
    for (const s of padSpots) {
      const y = this.terrainHeight(s.x, s.z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.5, 20), padBaseMat.clone());
      base.position.set(s.x, y + 0.25, s.z);
      this._add(base);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.18, 10, 32),
        padBaseMat.clone());
      ring.rotation.x = Math.PI / 2;
      ring.position.set(s.x, y + 0.7, s.z);
      this._add(ring);
      this.pads.push({ x: s.x, y, z: s.z, ring, base });
    }

    // ---- CRYSTAL FIELD: 300 plants, ONE draw call (InstancedMesh) ----
    const rnd = mulberry32(555);
    const inst = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.6, 2.8, 5),
      new THREE.MeshStandardMaterial({
        color: 0x1c0a24, emissive: 0xd94fff, emissiveIntensity: 1.1, roughness: 0.35,
      }), 300);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(),
          V = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler();
    let placed = 0;
    while (placed < 300) {
      const x = (rnd() - 0.5) * 440, z = (rnd() - 0.5) * 440;
      const h = this.terrainHeight(x, z);
      if (h < -2 || Math.abs(x - this.riverX(z)) < 10) continue; // not in the river
      const sc = 0.5 + rnd() * 1.8;
      V.set(x, h + 1.2 * sc, z); S.set(sc, sc, sc); E.set(0, rnd() * 6.3, (rnd() - 0.5) * 0.25);
      Q.setFromEuler(E);
      M.compose(V, Q, S);
      inst.setMatrixAt(placed++, M);
    }
    inst.castShadow = true;
    this._add(inst);

    // ============================================================
    // ---- THE FACILITY: a guarded alien installation housing the portal ----
    // Outer defensive wall ring with corner watch-pylons, a roofed inner
    // chamber with a visible tech floor and support pillars, one entrance
    // gap facing the approach. The portal lives INSIDE, not out in the open.
    // ============================================================
    const gx = this.facilityX, gz = this.facilityZ, gy = this.facilityY;
    const entranceAngle = Math.atan2(150 - gz, 0 - gx); // faces roughly back toward spawn/river path

    const wallMat = new THREE.MeshStandardMaterial({
      map: facilityPanelTexture(3), color: 0xffffff, roughness: 0.55, metalness: 0.7,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x0a2a2e, emissive: 0x22ffee, emissiveIntensity: 1.1, roughness: 0.4,
    });

    // outer wall: a ring of tall panel segments with one gap = the entrance
    const OUTER_R = 34, WALL_SEG = 20, ENTRANCE_WIDTH = 2; // in segment-index units
    this.facilityWalls = [];
    for (let i = 0; i < WALL_SEG; i++) {
      const a = (i / WALL_SEG) * Math.PI * 2;
      let da = a - entranceAngle;
      da = Math.atan2(Math.sin(da), Math.cos(da)); // wrap to [-PI,PI]
      if (Math.abs(da) < (ENTRANCE_WIDTH / WALL_SEG) * Math.PI) continue; // leave the entrance open
      const seg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 16, (Math.PI * 2 * OUTER_R) / WALL_SEG + 0.3), wallMat);
      seg.position.set(gx + Math.cos(a) * OUTER_R, gy + 8, gz + Math.sin(a) * OUTER_R);
      seg.rotation.y = -a;
      seg.castShadow = true; seg.receiveShadow = true;
      this._add(seg);
      this.colliders.push(new THREE.Box3().setFromObject(seg));
    }
    // corner watch-pylons: taller, lit, spaced around the ring — reads as "guarded"
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 22, 8), wallMat);
      pylon.position.set(gx + Math.cos(a) * (OUTER_R + 2), gy + 11, gz + Math.sin(a) * (OUTER_R + 2));
      pylon.castShadow = true;
      this._add(pylon);
      this.colliders.push(new THREE.Box3().setFromObject(pylon));
      const beacon = new THREE.PointLight(0x33ddff, 26, 30, 1.8);
      beacon.position.set(pylon.position.x, gy + 22, pylon.position.z);
      this.root.add(beacon);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), trimMat);
      cap.position.set(pylon.position.x, gy + 22, pylon.position.z);
      this._add(cap);
    }

    // roof: a low dome over the whole facility, with an open oculus above
    // the portal so its glow still bleeds upward
    const roof = new THREE.Mesh(
      new THREE.SphereGeometry(OUTER_R + 1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42),
      new THREE.MeshStandardMaterial({ map: facilityPanelTexture(4), color: 0xffffff, roughness: 0.6, metalness: 0.6, side: THREE.DoubleSide })
    );
    roof.position.set(gx, gy + 15, gz);
    roof.castShadow = true;
    this._add(roof);

    // interior floor: visible tech-panel plate, NOT flat black
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(OUTER_R - 2, OUTER_R - 2, 0.6, 48),
      new THREE.MeshStandardMaterial({ map: techFloorTexture(21, '#3fd0ff'), roughness: 0.5, metalness: 0.4 })
    );
    floor.position.set(gx, gy - 0.3, gz);
    floor.receiveShadow = true;
    this._add(floor);

    // interior support pillars holding up the roof, ringed with glow strips
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = gx + Math.cos(a) * (OUTER_R - 7), pz = gz + Math.sin(a) * (OUTER_R - 7);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 15, 10), wallMat);
      pillar.position.set(px, gy + 7, pz);
      pillar.castShadow = true;
      this._add(pillar);
      this.colliders.push(new THREE.Box3().setFromObject(pillar));
      const strip = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.25, 10), trimMat);
      strip.position.set(px, gy + 3.5, pz);
      this._add(strip);
    }

    // ---- PORTAL GATE, now sheltered inside the facility ----
    const gate = new THREE.Mesh(new THREE.TorusGeometry(10, 1.6, 14, 48),
      new THREE.MeshStandardMaterial({
        color: 0x2a2208, emissive: 0xffc94f, emissiveIntensity: 0.7,
        metalness: 0.9, roughness: 0.25,
      }));
    gate.position.set(gx, gy + 11, gz);
    gate.castShadow = true;
    this._add(gate);
    this.portalMat = PortalMaterial();
    this.timeMats.push(this.portalMat);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(8.6, 40), this.portalMat);
    disc.position.copy(gate.position);
    this._add(disc);
    const gateLight = new THREE.PointLight(0xa44fff, 70, 50, 1.6);
    gateLight.position.set(gx, gy + 11, gz);
    this.root.add(gateLight);
    this.exitPosition = gate.position.clone(); // for main.js level-complete checks

    // entrance archway — the one deliberate gap in the wall ring, marked
    // with a force-field "door" so it still reads as guarded, not open
    this.doorMat = ForceFieldMaterial();
    this.timeMats.push(this.doorMat);
    const doorX = gx + Math.cos(entranceAngle) * (OUTER_R - 0.5);
    const doorZ = gz + Math.sin(entranceAngle) * (OUTER_R - 0.5);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(9, 13), this.doorMat);
    door.position.set(doorX, gy + 6.5, doorZ);
    door.rotation.y = -entranceAngle + Math.PI / 2;
    this._add(door);

    // ---- DECOYS: dormant false gates earlier along the river ----
    // Same silhouette, no shader/light/glow — dead ends meant to eat your time.
    const decoyMat = new THREE.MeshStandardMaterial({ color: 0x2a2208, roughness: 0.6, metalness: 0.6 });
    for (const dz of [-40, -95]) {
      const dx = this.riverX(dz) + (dz === -40 ? 20 : -22);
      const dy = this.terrainHeight(dx, dz);
      const decoy = new THREE.Mesh(new THREE.TorusGeometry(9, 1.3, 12, 36), decoyMat);
      decoy.position.set(dx, dy + 10, dz);
      decoy.castShadow = true;
      this._add(decoy);
    }

    this.spawn = new THREE.Vector3(0, this.terrainHeight(0, 150), 150);
  }

  riverX(z) { return Math.sin(z * 0.015) * 25; }

  // ONE height function — used by the mesh AND by player collision
  terrainHeight(x, z) {
    let h = fbm2(x * 0.006 + 7.3, z * 0.006 + 2.1, 5) * 30 - 10;
    h += Math.abs(fbm2(x * 0.02 + 1.7, z * 0.02 + 4.2, 3) - 0.5) * 12;
    const dRiver = Math.abs(x - this.riverX(z));          // carve the river valley
    h = h * (1 - sstep(16, 6, dRiver)) + (-2.5) * sstep(16, 6, dRiver);
    const dSpawn = Math.hypot(x, z - 150);                // flat spot at spawn
    h = h * (1 - sstep(26, 10, dSpawn)) + 1.5 * sstep(26, 10, dSpawn);
    const dFacility = Math.hypot(x - this.facilityX, z - this.facilityZ); // flat pad for the facility
    h = h * (1 - sstep(40, 22, dFacility)) + this.facilityY * sstep(40, 22, dFacility);
    return h;
  }

  // highest walkable surface at (x,z) that is at/below the player's feet
  groundHeight(x, z, feetY = Infinity) {
    let g = -1000;
    const th = this.terrainHeight(x, z);
    if (th <= feetY + 1) g = th;
    for (const isl of this.islands) {
      const dx = x - isl.mesh.position.x, dz = z - isl.mesh.position.z;
      const top = isl.mesh.position.y + isl.r * 0.55;
      if (dx * dx + dz * dz < isl.r * isl.r * 0.72 && top <= feetY + 1 && top > g) g = top;
    }
    return g;
  }

  update(dt, t, player) {
    for (const m of this.timeMats) m.uniforms.uTime.value = t;
    // islands bob — they are alive
    for (const isl of this.islands) {
      isl.mesh.position.y = isl.baseY + Math.sin(t * 0.5 + isl.phase) * 0.9;
      isl.mesh.rotation.y += dt * 0.03;
    }
    // jump pads pulse + launch
    for (const p of this.pads) {
      const s = 1 + Math.sin(t * 3 + p.x) * 0.08;
      p.ring.scale.set(s, s, 1);
      p.base.material.emissiveIntensity = 1 + Math.sin(t * 3 + p.x) * 0.5;
      if (player) {
        const dx = player.pos.x - p.x, dz = player.pos.z - p.z;
        const dy = player.pos.y - p.y;
        if (dx * dx + dz * dz < 2.6 * 2.6 && Math.abs(dy) < 2 && player.vel.y <= 0) {
          player.vel.y = 20; // launch!
        }
      }
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
    scene.remove(this.root);
    scene.fog = null;
    scene.background = null;
  }
}
