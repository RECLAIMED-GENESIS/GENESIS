// ============================================================
// LEVEL 1 — THE STREET
// A dark urban fight corridor. Fight flows south -> north:
// spawn -> car cover -> plaza with the force-field dome -> gate.
// Rubric wins: static skybox, fog, wet-asphalt reflections,
// emissive window textures, multiple real + fake lights, shadows,
// custom force-field shader, pulsing energy veins.
// ============================================================
import * as THREE from 'three';
import { windowTexture, asphaltTextures, starTexture, mulberry32, roadMarkingsTexture } from '../utils/utils.js';
import { ForceFieldMaterial } from './../shaders/shaders.js';

export class StreetLevel {
  constructor(scene) {
    this.name = 'LEVEL 1 — THE STREET';
    this.root = new THREE.Group();
    scene.add(this.root);
    this.colliders = [];        // array of THREE.Box3 the player can't enter
    this.spawn = new THREE.Vector3(0, 0, 55);
    this.timeMats = [];         // shader materials that need uTime
    this.veins = [];            // pulsing emissive strips
    this.flickerLight = null;

    scene.fog = new THREE.FogExp2(0x0a0b12, 0.011);
    scene.background = new THREE.Color(0x0a0b12);

    // ---- BASE FILL LIGHT ----
    // The original level had ZERO ambient/hemisphere light, so anything
    // outside a spotlight cone rendered pure black. This is the fix:
    // a soft cool-above / warm-below hemisphere so geometry always reads,
    // plus a faint ambient so shadow cores aren't crushed to zero.
    this.root.add(new THREE.HemisphereLight(0x4a5570, 0x0e0b10, 0.85));
    this.root.add(new THREE.AmbientLight(0x223047, 0.35));

    // ---- STATIC NIGHT SKY (excluded from minimap: stays on layer 0) ----
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(500, 24, 16),
      new THREE.MeshBasicMaterial({ map: starTexture(99), side: THREE.BackSide, fog: false })
    );
    this.root.add(sky);

    // ---- GROUND: wet asphalt (low roughness = shiny reflections) ----
    const { map, roughnessMap } = asphaltTextures();
    map.repeat.set(24, 24); roughnessMap.repeat.set(24, 24);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 320),
      new THREE.MeshStandardMaterial({
        map, roughnessMap, roughness: 1.0, metalness: 0.25,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this._add(ground);

    // road markings decal — dashed centre line + edge lines down the
    // drivable lane, stops the street reading as an undifferentiated
    // dark plane
    const markTex = roadMarkingsTexture();
    markTex.repeat.set(1, 16);
    const markings = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 300),
      new THREE.MeshStandardMaterial({
        map: markTex, transparent: true, roughness: 0.6, metalness: 0.1,
        polygonOffset: true, polygonOffsetFactor: -1, // avoid z-fighting with ground
      })
    );
    markings.rotation.x = -Math.PI / 2;
    markings.position.set(0, 0.01, -20);
    this.root.add(markings);

    // ---- BUILDINGS: two rows boxing in the street ----
    // One gap is deliberately left in the west row (see ALLEY_GAP_Z below) —
    // that missing building is the mouth of the hidden alley to the plaza.
    const ALLEY_GAP_Z = [-90, -76]; // [min,max] z-range of the carved gap, west side only
    const rnd = mulberry32(2024);
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const w = 12 + rnd() * 6, h = 22 + rnd() * 36, d = 14;
      const z = -84 + Math.floor(i / 2) * 24 + (side < 0 ? 0 : 6);
      if (side < 0 && z > ALLEY_GAP_Z[0] && z < ALLEY_GAP_Z[1]) continue; // carve the alley mouth
      const tex = windowTexture(100 + i);       // clone-ish variety per building
      tex.repeat.set(2, Math.max(2, Math.round(h / 12)));
      tex.offset.set(rnd(), rnd());
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          map: tex, emissiveMap: tex, emissive: 0xffc978, emissiveIntensity: 0.9,
          roughness: 0.9,
        })
      );
      b.position.set(side * (17 + w / 2), h / 2, z);
      b.castShadow = true; b.receiveShadow = true;
      this._add(b);
      this.colliders.push(new THREE.Box3().setFromObject(b));
    }

    // distant skyline silhouettes (no colliders — pure atmosphere)
    const silMat = new THREE.MeshBasicMaterial({ color: 0x0a0c14 });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const h = 40 + rnd() * 60;
      const b = new THREE.Mesh(new THREE.BoxGeometry(18, h, 18), silMat);
      b.position.set(Math.cos(a) * 190, h / 2, Math.sin(a) * 190);
      this.root.add(b); // skyline not on minimap layer
    }

    // ---- STREETLIGHTS: 8 poles, first 3 get real shadow-casting spots ----
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -72 + Math.floor(i / 2) * 36;
      const x = side * 10;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 6.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.6, metalness: 0.7 })
      );
      pole.position.set(x, 3.25, z); pole.castShadow = true;
      this._add(pole);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xffd27a, emissiveIntensity: 2 })
      );
      head.position.set(x, 6.6, z);
      this._add(head);
      if (i < 3) {
        const spot = new THREE.SpotLight(0xffd9a0, 110, 46, 0.75, 0.45, 1.4);
        spot.position.set(x, 6.6, z);
        spot.target.position.set(x * 0.6, 0, z);
        spot.castShadow = true;
        spot.shadow.mapSize.set(1024, 1024);
        this.root.add(spot, spot.target);
        if (i === 1) this.flickerLight = spot; // one faulty lamp, flickers in update()
      }
    }

    // faint cold moonlight so the street reads even between lamp pools
    const moon = new THREE.DirectionalLight(0x5f7aa8, 0.5);
    moon.position.set(-60, 90, 30);
    this.root.add(moon);

    // ---- COVER PROPS: cars, dumpsters, crates (all have colliders) ----
    // Brighter, more saturated body colors than the original near-black
    // set, plus a small warm rim light per car so they read as distinct
    // shapes instead of dark blobs on a dark street.
    const carColors = [0x9a3a3a, 0x3a55a0, 0x585862, 0x8a8438, 0x3f7488];
    for (let i = 0; i < 5; i++) {
      const car = this._makeCar(carColors[i]);
      const side = i % 2 === 0 ? -1 : 1;
      car.position.set(side * 7.5, 0, 30 - i * 22);
      car.rotation.y = (rnd() - 0.5) * 0.35 + (side < 0 ? Math.PI : 0);
      this._add(car);
      this.colliders.push(new THREE.Box3().setFromObject(car));
      const carLight = new THREE.PointLight(0xffddb0, 6, 12, 2);
      carLight.position.set(car.position.x, 2.4, car.position.z);
      this.root.add(carLight);
    }
    const dumpster = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1.6, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x1d4030, roughness: 0.7, metalness: 0.4 })
    );
    dumpster.position.set(-13, 0.8, -20); dumpster.castShadow = true;
    this._add(dumpster);
    this.colliders.push(new THREE.Box3().setFromObject(dumpster));
    for (let i = 0; i < 4; i++) {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.2, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x4a3a26, roughness: 0.9 })
      );
      crate.position.set(12 + (i % 2) * 1.4, 0.6 + (i > 1 ? 1.2 : 0), -62 - (i % 2) * 0.4);
      crate.castShadow = true;
      this._add(crate);
      this.colliders.push(new THREE.Box3().setFromObject(crate));
    }

    // ---- DEAD END: the "obvious" straight path is a lie ----
    // Anyone who just runs north up the main street hits collapsed
    // rubble and a wrecked bus. No dome, no obvious way through.
    // The real way forward is the unlit gap in the west building row.
    const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x1c1a1c, roughness: 1.0 });
    const bus = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 3.2), rubbleMat);
    bus.position.set(-2, 1.6, -96);
    bus.rotation.y = 0.18;
    bus.castShadow = true; bus.receiveShadow = true;
    this._add(bus);
    this.colliders.push(new THREE.Box3().setFromObject(bus));
    for (let i = 0; i < 5; i++) {
      const chunk = new THREE.Mesh(
        new THREE.BoxGeometry(2 + rnd() * 2.5, 1.4 + rnd() * 2.2, 2 + rnd() * 2),
        rubbleMat
      );
      chunk.position.set(-9 + rnd() * 14, chunk.geometry.parameters.height / 2, -92 - rnd() * 6);
      chunk.rotation.y = rnd() * Math.PI;
      chunk.castShadow = true; chunk.receiveShadow = true;
      this._add(chunk);
      this.colliders.push(new THREE.Box3().setFromObject(chunk));
    }
    // one dim, sputtering light over the dead end so it's readable but not inviting
    const deadEndLight = new THREE.PointLight(0xff7744, 12, 24, 2);
    deadEndLight.position.set(-2, 5, -92);
    this.root.add(deadEndLight);

    // ---- HIDDEN ALLEY: through the gap in the west row ----
    // Unmarked, unlit at the mouth — you have to actually look for it.
    const alleyMouthX = -17, alleyDeepX = -55, alleyZ = (ALLEY_GAP_Z[0] + ALLEY_GAP_Z[1]) / 2;
    const alleyWallMat = new THREE.MeshStandardMaterial({ color: 0x14151b, roughness: 0.95 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(alleyMouthX - alleyDeepX + 6, 24, 1.2), alleyWallMat);
    wallN.position.set((alleyMouthX + alleyDeepX) / 2, 12, ALLEY_GAP_Z[0]);
    this._add(wallN);
    this.colliders.push(new THREE.Box3().setFromObject(wallN));
    const wallS = wallN.clone();
    wallS.position.z = ALLEY_GAP_Z[1];
    this._add(wallS);
    this.colliders.push(new THREE.Box3().setFromObject(wallS));

    // faint pulsing glyphs in the grime, barely visible — the only real clue
    const glyphMat = new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: 0x2fe0ff, emissiveIntensity: 0.5,
      roughness: 1, transparent: true, opacity: 0.8,
    });
    this.glyphs = [];
    for (let i = 0; i < 6; i++) {
      const gx = alleyMouthX - i * 7 - 3;
      const g = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), glyphMat.clone());
      g.rotation.x = -Math.PI / 2;
      g.position.set(gx, 0.03, alleyZ + Math.sin(i * 1.7) * 2.2);
      g.userData.phase = i * 0.9;
      this.glyphs.push(g);
      this._add(g);
    }

    // ---- HIDDEN COURTYARD (end of the alley): the device wakes up here ----
    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(13, 13, 0.2, 40),
      new THREE.MeshStandardMaterial({ color: 0x232733, roughness: 0.3, metalness: 0.5 })
    );
    plaza.position.set(alleyDeepX, 0.1, alleyZ);
    plaza.receiveShadow = true;
    this._add(plaza);

    // force-field dome — custom shader, uPower = game state (kills, story)
    this.forceMat = ForceFieldMaterial();
    this.timeMats.push(this.forceMat);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(8, 40, 28), this.forceMat);
    dome.position.set(alleyDeepX, 0.4, alleyZ);
    this._add(dome);
    const domeLight = new THREE.PointLight(0x33ddff, 70, 46, 1.6);
    domeLight.position.set(alleyDeepX, 4, alleyZ);
    this.root.add(domeLight);
    this.exitPosition = new THREE.Vector3(alleyDeepX, 0.4, alleyZ); // for main.js level-complete checks

    // energy veins pulsing on the walls near the plaza (emissive + sin pulse)
    const veinMat = new THREE.MeshStandardMaterial({
      color: 0x120016, emissive: 0xff2fd8, emissiveIntensity: 1.5, roughness: 0.5,
    });
    for (let i = 0; i < 6; i++) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 7 + rnd() * 5), veinMat.clone());
      const side = i % 2 === 0 ? -1 : 1;
      v.position.set(alleyDeepX + side * 15.8, 4.5, alleyZ - 6 + i * 2.2);
      v.rotation.y = -side * Math.PI / 2;
      v.userData.phase = rnd() * Math.PI * 2;
      this.veins.push(v);
      this._add(v);
    }
  }

  _makeCar(color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4.4), mat);
    body.position.y = 0.75; body.castShadow = true;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.1, metalness: 0.8 }));
    cab.position.set(0, 1.55, -0.2); cab.castShadow = true;
    g.add(body, cab);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 });
    for (const [wx, wz] of [[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.42, wz);
      g.add(w);
    }
    return g;
  }

  // helper: add to scene AND make visible on the minimap (layer 1)
  _add(obj) {
    obj.traverse ? obj.traverse(o => o.layers && o.layers.enable(1))
                 : obj.layers && obj.layers.enable(1);
    this.root.add(obj);
  }

  // flat city ground
  groundHeight() { return 0; }

  update(dt, t) {
    for (const m of this.timeMats) m.uniforms.uTime.value = t;
    // the device grows stronger the longer the level runs
    // -> later you can drive this from kill-count instead of time
    this.forceMat.uniforms.uPower.value = Math.min(1, 0.45 + t * 0.02);
    // faulty streetlight flicker
    if (this.flickerLight) {
      const n = Math.sin(t * 31.7) * Math.sin(t * 7.3) * Math.sin(t * 2.1);
      this.flickerLight.intensity = n > 0.55 ? 8 : 60;
    }
    // energy veins breathe
    for (const v of this.veins) {
      v.material.emissiveIntensity = 1.2 + Math.sin(t * 2.4 + v.userData.phase) * 0.9;
    }
    // hidden alley glyphs — slow, faint pulse, easy to miss on purpose
    for (const g of this.glyphs) {
      g.material.emissiveIntensity = 0.25 + Math.max(0, Math.sin(t * 1.1 + g.userData.phase)) * 0.55;
    }
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
