// Detailed street-facing buildings for the station surroundings.
// Replaces the plain "box + window grid" blocks with: shopfronts and awnings, recessed
// framed windows with sills and lintels, balconies, belt courses, pilasters, cornices,
// parapets, rooftop plant, water tanks, wall-mounted AC units and drain pipes.
// Static pieces are merged per material and repeated pieces are instanced, so a
// whole city block costs well under 100 draw calls.
import * as THREE from 'three';
import { own, canvasTexture, mergeInto } from './StationRealism.js';

const rngOf = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

const WALL_TINTS = [0xb8b2a6, 0xc9b79c, 0xa9b5bb, 0xcdbfae, 0x9aa6a0];
const BRICK_TINTS = [0xe3cdbf, 0xd9b9a6, 0xcfc0b8];
const FRAME_COLORS = [0x2b3236, 0xe6e4dc, 0x4a3a2c];
const SHOPS = ['PHARMACY', 'MAMA’S KITCHEN', 'CELL CITY', 'HAIR & BEAUTY', 'BUTCHERY', 'HARDWARE', 'TAILORS', 'CAFÉ NOVA', 'LOANS', 'GENERAL DEALER', 'BOTTLE STORE', 'TYRES & RIMS'];

function makeGlassVariants(L) {
  const mk = (draw, extra = {}) => own(L, new THREE.MeshStandardMaterial({
    map: canvasTexture(L, 128, 160, draw), roughness: 0.16, metalness: 0.4, envMapIntensity: 1.2, ...extra,
  }));
  const sheen = (g, w, h) => {                       // diagonal sky reflection
    const r = g.createLinearGradient(0, 0, w, h);
    r.addColorStop(0, 'rgba(255,255,255,.28)'); r.addColorStop(0.35, 'rgba(255,255,255,0)'); r.addColorStop(1, 'rgba(255,255,255,.08)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  };
  return [
    mk((g, w, h) => { g.fillStyle = '#26404e'; g.fillRect(0, 0, w, h); sheen(g, w, h); }),
    mk((g, w, h) => {                                                       // blinds, half drawn
      g.fillStyle = '#31505f'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h * 0.55; y += 8) { g.fillStyle = '#c9c4b4'; g.fillRect(0, y, w, 6); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, y + 6, w, 2); }
      sheen(g, w, h);
    }),
    mk((g, w, h) => {                                                       // curtains
      g.fillStyle = '#2f4654'; g.fillRect(0, 0, w, h);
      const c = ['#8c5b4f', '#6e7f69', '#a5906b'][Math.floor(Math.random() * 3)];
      for (const [x0, x1] of [[0, w * 0.4], [w * 0.6, w]]) for (let x = x0; x < x1; x += 7) { g.fillStyle = c; g.fillRect(x, 0, 5, h); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 5, 0, 2, h); }
      sheen(g, w, h);
    }),
    mk((g, w, h) => {                                                       // lit office
      const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, '#f2dcae'); r.addColorStop(1, '#d9b57a');
      g.fillStyle = r; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(70,50,30,.35)'; g.fillRect(w * 0.15, h * 0.55, w * 0.7, h * 0.45); sheen(g, w, h);
    }, { emissive: 0x6b4a1d, emissiveIntensity: 0.55 }),
  ];
}

function makeAwning(L, i) {
  const pairs = [['#a8322d', '#efe6d2'], ['#2d5b45', '#efe6d2'], ['#2c4f7c', '#efe6d2'], ['#b9822d', '#efe6d2']];
  const [a, b] = pairs[i % pairs.length];
  return own(L, new THREE.MeshStandardMaterial({
    map: canvasTexture(L, 128, 32, (g, w, h) => { for (let x = 0; x < w; x += 16) { g.fillStyle = (x / 16) % 2 ? b : a; g.fillRect(x, 0, 16, h); } }),
    roughness: 0.9, side: THREE.DoubleSide,
  }));
}

function makeSign(L, text, i) {
  const bg = ['#1e3a2e', '#3a1f1f', '#1d2c47', '#2e2a20', '#222a33'][i % 5];
  return own(L, new THREE.MeshStandardMaterial({
    map: canvasTexture(L, 512, 96, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d9c58a'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = '#f3ead0'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 2, w - 40);
    }), roughness: 0.6,
  }));
}

export function buildCityBlock(L, specs) {
  const root = new THREE.Group(); root.name = 'City block'; L.level.add(root);
  const dummy = new THREE.Object3D();
  const buckets = new Map();
  const add = (mat, geo) => { if (!buckets.has(mat)) buckets.set(mat, []); buckets.get(mat).push(geo); };

  const stone = own(L, L._std(0xd5d0c4, 0.85, 0)), darkTrim = own(L, L._std(0x2c353b, 0.6, 0.3));
  const tar = own(L, L._std(0x2d3033, 0.95, 0)), steel = own(L, L._std(0x8d9a9e, 0.5, 0.6));
  const white = own(L, L._std(0xe8eae6, 0.6, 0.1)), concrete = own(L, L._std(0x9a9c98, 0.9, 0));
  const tankMat = own(L, L._std(0x6a7a85, 0.7, 0.4)), fanDark = own(L, L._std(0x1a1d20, 0.8, 0.3));
  const shopGlass = own(L, new THREE.MeshStandardMaterial({ color: 0x3a5663, roughness: 0.1, metalness: 0.55, envMapIntensity: 1.4 }));
  const glassMats = makeGlassVariants(L);
  const awnings = [0, 1, 2, 3].map(i => makeAwning(L, i));
  const signs = SHOPS.map((t, i) => makeSign(L, t, i));

  const frameList = [], sillList = [], lintelList = [], mullVList = [], mullHList = [], acList = [];
  const frameCol = [], glassLists = [[], [], [], []];
  const matrix = (x, y, z, yaw) => { dummy.position.set(x, y, z); dummy.rotation.set(0, yaw, 0); dummy.updateMatrix(); return dummy.matrix.clone(); };

  specs.forEach(([x, z, w, h, d], i) => {
    const rnd = rngOf(1000 + i * 97);
    const brickBuilding = i % 3 === 0;
    const wallMat = L._stationMaterial(brickBuilding ? 'brick' : 'plaster', brickBuilding ? BRICK_TINTS[i % 3] : WALL_TINTS[i % WALL_TINTS.length]);
    const body = L._box(root, w, h, d, wallMat, x, h / 2, z); body.name = 'Building body';
    const frameColor = new THREE.Color(FRAME_COLORS[Math.floor(rnd() * FRAME_COLORS.length)]);
    const streetFace = z > 39 ? 0 : 1;                       // face index toward the road

    const faces = [
      { n: [0, -1], t: [1, 0], len: w, c: [x, z - d / 2] },
      { n: [0, 1], t: [-1, 0], len: w, c: [x, z + d / 2] },
      { n: [-1, 0], t: [0, 1], len: d, c: [x - w / 2, z] },
      { n: [1, 0], t: [0, -1], len: d, c: [x + w / 2, z] },
    ];
    for (const f of faces) f.yaw = Math.atan2(f.n[0], f.n[1]);
    const at = (f, s, y, off) => [f.c[0] + f.t[0] * s + f.n[0] * off, y, f.c[1] + f.t[1] * s + f.n[1] * off];
    const put = (mat, geo, f, s, y, off, pitch = 0) => {
      const [px, py, pz] = at(f, s, y, off);
      dummy.position.set(px, py, pz); dummy.rotation.set(pitch, f.yaw, 0, 'YXZ'); dummy.updateMatrix();
      geo.applyMatrix4(dummy.matrix); add(mat, geo);
    };

    const floors = Math.max(1, Math.floor((h - 3.6 - 0.8) / 3.2));
    faces.forEach((f, fi) => {
      const isStreet = fi === streetFace;
      // Corner pilasters and belt courses give the facade its structure.
      for (const s of [-f.len / 2 + 0.3, f.len / 2 - 0.3]) put(stone, new THREE.BoxGeometry(0.6, h, 0.16), f, s, h / 2, 0.08);
      for (let k = 0; k <= floors; k++) put(stone, new THREE.BoxGeometry(f.len + 0.3, 0.22, 0.2), f, 0, 3.6 + k * 3.2 - 0.11, 0.1);
      put(darkTrim, new THREE.BoxGeometry(f.len, 0.9, 0.14), f, 0, 0.45, 0.07);            // plinth

      // Upper-floor windows (instanced).
      const bays = Math.max(1, Math.floor((f.len - 1.6) / 3.0));
      const bayAt = (b) => -(bays - 1) * 1.5 + b * 3.0;
      for (let k = 0; k < floors; k++) {
        const base = 3.6 + k * 3.2, cy = base + 1.7;
        for (let b = 0; b < bays; b++) {
          const s = bayAt(b), yaw = f.yaw;
          const [px, , pz] = at(f, s, cy, 0);
          const place = (list, dx, dy, off) => { const [ox, oy, oz] = at(f, s + dx, cy + dy, off); list.push(matrix(ox, oy, oz, yaw)); };
          place(frameList, 0, 0, 0.1); frameCol.push(frameColor);
          const variant = rnd() < 0.12 ? 3 : Math.floor(rnd() * 3);
          place(glassLists[variant], 0, 0, 0.205);
          place(sillList, 0, -1.04, 0.17); place(lintelList, 0, 1.06, 0.13);
          place(mullVList, 0, 0, 0.22); place(mullHList, 0, 0.3, 0.22);
          if (rnd() < 0.16) place(acList, 1.5, -0.5, 0.11);                                // split AC unit
          if (isStreet && k > 0 && rnd() < 0.3) {                                          // balcony
            const [bx, , bz] = at(f, s, 0, 0);
            put(concrete, new THREE.BoxGeometry(2.3, 0.14, 0.9), f, s, base + 0.02, 0.45);
            put(darkTrim, new THREE.BoxGeometry(2.3, 0.05, 0.05), f, s, base + 1.0, 0.88);
            for (let q = -4; q <= 4; q++) put(darkTrim, new THREE.BoxGeometry(0.03, 0.95, 0.03), f, s + q * 0.27, base + 0.5, 0.88);
            put(darkTrim, new THREE.BoxGeometry(0.05, 1.0, 0.9), f, s - 1.15, base + 0.5, 0.45);
            put(darkTrim, new THREE.BoxGeometry(0.05, 1.0, 0.9), f, s + 1.15, base + 0.5, 0.45);
          }
        }
      }

      // Ground floor: shopfront on the street face, smaller windows elsewhere.
      if (isStreet) {
        const shops = Math.max(1, Math.floor(f.len / 4.8)), sw = f.len / shops;
        for (let sIdx = 0; sIdx < shops; sIdx++) {
          const s = -f.len / 2 + sw * (sIdx + 0.5), pick = Math.floor(rnd() * SHOPS.length);
          put(darkTrim, new THREE.BoxGeometry(sw - 0.35, 2.55, 0.14), f, s, 1.45, 0.07);                 // frame
          put(shopGlass, new THREE.BoxGeometry(sw - 0.65, 2.3, 0.06), f, s - 0.3, 1.4, 0.16);            // display glass
          put(darkTrim, new THREE.BoxGeometry(1.0, 2.3, 0.1), f, s + sw / 2 - 0.75, 1.3, 0.14);            // door
          put(white, new THREE.BoxGeometry(0.05, 2.3, 0.04), f, s - 0.3, 1.4, 0.2);
          put(awnings[(sIdx + i) % 4], new THREE.BoxGeometry(sw - 0.4, 0.05, 1.1), f, s, 2.75, 0.62, 0.28);
          put(signs[pick], new THREE.BoxGeometry(sw - 0.4, 0.62, 0.1), f, s, 3.25, 0.1);
        }
      } else {
        for (let b = 0; b < bays; b++) {
          if (b % 2) continue;
          const s = bayAt(b), cy = 2.0;
          const place = (list, dx, dy, off) => { const [ox, oy, oz] = at(f, s + dx, cy + dy, off); list.push(matrix(ox, oy, oz, f.yaw)); };
          place(frameList, 0, 0, 0.1); frameCol.push(frameColor); place(glassLists[Math.floor(rnd() * 3)], 0, 0, 0.205);
          place(sillList, 0, -1.04, 0.17); place(lintelList, 0, 1.06, 0.13); place(mullVList, 0, 0, 0.22); place(mullHList, 0, 0.3, 0.22);
        }
      }
    });

    // Cornice, parapet, roof surface.
    add(stone, new THREE.BoxGeometry(w + 0.5, 0.36, d + 0.5).translate(x, h - 0.18, z));
    for (const [pw, pd, px, pz] of [[w + 0.5, 0.3, x, z - d / 2 - 0.1], [w + 0.5, 0.3, x, z + d / 2 + 0.1], [0.3, d - 0.2, x - w / 2 - 0.1, z], [0.3, d - 0.2, x + w / 2 + 0.1, z]]) {
      add(stone, new THREE.BoxGeometry(pw, 0.7, pd).translate(px, h + 0.35, pz));
      add(concrete, new THREE.BoxGeometry(pw + 0.06, 0.08, pd + 0.1).translate(px, h + 0.74, pz));
    }
    add(tar, new THREE.BoxGeometry(w - 0.4, 0.05, d - 0.4).translate(x, h + 0.03, z));

    // Rooftop plant: HVAC units with fans, water tank, stair core, antenna.
    const rx = () => x + (rnd() - 0.5) * (w - 4), rz = () => z + (rnd() - 0.5) * (d - 4);
    for (let u = 0, n = 1 + Math.floor(rnd() * 3); u < n; u++) {
      const ux = rx(), uz = rz();
      add(steel, new THREE.BoxGeometry(1.8, 1.0, 1.3).translate(ux, h + 0.55, uz));
      for (const dx of [-0.45, 0.45]) add(fanDark, new THREE.CylinderGeometry(0.34, 0.34, 0.05, 14).translate(ux + dx, h + 1.06, uz));
    }
    if (rnd() > 0.4) {
      const tx = rx(), tz = rz();
      for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) add(darkTrim, new THREE.BoxGeometry(0.08, 1.2, 0.08).translate(tx + dx, h + 0.7, tz + dz));
      add(tankMat, new THREE.CylinderGeometry(0.9, 0.9, 1.5, 16).translate(tx, h + 1.95, tz));
      add(darkTrim, new THREE.ConeGeometry(0.95, 0.4, 16).translate(tx, h + 2.9, tz));
    }
    if (rnd() > 0.35) {
      const sx = x + (w / 2 - 2.2) * (rnd() > 0.5 ? 1 : -1), sz = z + (d / 2 - 2.0) * (rnd() > 0.5 ? 1 : -1);
      add(stone, new THREE.BoxGeometry(2.4, 2.4, 2.2).translate(sx, h + 1.2, sz));
      add(darkTrim, new THREE.BoxGeometry(2.6, 0.12, 2.4).translate(sx, h + 2.45, sz));
    }
    if (rnd() > 0.5) {
      const ax = rx(), az = rz();
      add(steel, new THREE.CylinderGeometry(0.03, 0.03, 4, 6).translate(ax, h + 2.0, az));
      add(steel, new THREE.BoxGeometry(1.2, 0.04, 0.04).translate(ax, h + 3.3, az));
      add(steel, new THREE.BoxGeometry(0.8, 0.04, 0.04).translate(ax, h + 2.7, az));
    }
    // Drain pipe down one corner of the street face.
    const sf = faces[streetFace];
    put(steel, new THREE.CylinderGeometry(0.06, 0.06, h, 8), sf, sf.len / 2 - 0.02, h / 2, 0.22);
  });

  mergeInto(L, root, buckets);

  const inst = (geo, mat, list, colors) => {
    if (!list.length) return;
    own(L, geo);
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((mx, k) => m.setMatrixAt(k, mx));
    if (colors) colors.forEach((c, k) => m.setColorAt(k, c));
    m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; m.userData.noShadow = true;
    root.add(m);
  };
  inst(new THREE.BoxGeometry(1.75, 2.0, 0.2), own(L, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.3 })), frameList, frameCol);
  glassLists.forEach((list, v) => inst(new THREE.PlaneGeometry(1.55, 1.8), glassMats[v], list));
  inst(new THREE.BoxGeometry(2.0, 0.09, 0.34), stone, sillList);
  inst(new THREE.BoxGeometry(1.95, 0.12, 0.26), stone, lintelList);
  inst(new THREE.BoxGeometry(0.05, 1.8, 0.03), darkTrim, mullVList);
  inst(new THREE.BoxGeometry(1.55, 0.05, 0.03), darkTrim, mullHList);
  inst(new THREE.BoxGeometry(0.75, 0.28, 0.22), white, acList);

  // Only the building bodies cast sun shadows; every small detail is shadow-free.
  root.traverse(o => { if (o.isMesh && o.name !== 'Building body') o.userData.noShadow = true; });
}
