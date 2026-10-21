// Lab north-wall window: a real opening cut through the wall, a framed see-through
// pane, and a daytime scene outside (path, hedge, trees, distant buildings, the
// station's photo sky). Replaces the old opaque "court" panel in LabLevel._buildRoom.
import * as THREE from 'three';
import { buildCityBlock } from './StationBuildings.js';

export const LAB_WINDOW = {
  x: -2,          // centre of the window along the wall
  width: 8.4,
  sill: 1.35,     // above the wood wainscot (1.2 m)
  top: 3.05,
  scenery: true,
};

export function buildLabWindow(L, wallMat, W = 20, D = 14, H = 3.4) {
  const { x, width, sill, top } = LAB_WINDOW;
  const z = -D / 2 - 0.15, t = 0.3;
  const xl = -W / 2 - 0.3, xr = W / 2 + 0.3;           // wall ends (matches the old W + 0.6 wall)
  const x0 = x - width / 2, x1 = x + width / 2;
  const open = top - sill, yMid = (sill + top) / 2;

  // Wall around the opening: left, right, below, above.
  const seg = (w, h, cx, cy) => L._box(L.level, w, h, t, wallMat, cx, cy, z);
  seg(x0 - xl, H, (xl + x0) / 2, H / 2);
  seg(xr - x1, H, (x1 + xr) / 2, H / 2);
  seg(width, sill, x, sill / 2);
  seg(width, H - top, x, (top + H) / 2);
  // One solid collider for the whole wall: nobody walks through a window.
  L.colliders.push(new THREE.Box3(
    new THREE.Vector3(xl, 0, z - t / 2), new THREE.Vector3(xr, H, z + t / 2)));

  // Frame, mullions and inner sill.
  const frame = L._std(0x3a3f47, 0.6, 0.4), sillMat = L._std(0xe9e8e1, 0.5, 0.1);
  const bar = (w, h, d, bx, by, bz) => L._box(L.level, w, h, d, frame, bx, by, bz);
  bar(width, 0.08, 0.14, x, sill + 0.04, z);
  bar(width, 0.08, 0.14, x, top - 0.04, z);
  for (const bx of [x0 + 0.04, x1 - 0.04]) bar(0.08, open, 0.14, bx, yMid, z);
  for (const dx of [-3, 0, 3]) bar(0.06, open, 0.1, x + dx, yMid, z);
  bar(width, 0.05, 0.1, x, yMid + 0.3, z);             // transom
  L._box(L.level, width + 0.3, 0.05, 0.45, sillMat, x, sill + 0.025, z + 0.2);

  // Almost-clear glass.
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(width, open),
    new THREE.MeshStandardMaterial({
      color: 0xd8ecf7, transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0, depthWrite: false,
    }));
  glass.position.set(x, yMid, z + 0.04); glass.userData.noShadow = true; glass.renderOrder = 2;
  L.level.add(glass);

  if (LAB_WINDOW.scenery) buildOutside(L);
}

function buildOutside(L) {
  const grass = L._std(0x5d7f52, 0.95, 0), path = L._std(0x9a9d98, 0.9, 0);
  const hedgeMat = L._std(0x35573f, 0.95, 0), bark = L._std(0x65513d, 0.95, 0);
  const leaves = [L._std(0x3b6252, 0.95, 0), L._std(0x4a7358, 0.95, 0), L._std(0x56804f, 0.95, 0)];
  const flat = (w, d, mat, px, py, pz) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(px, py, pz); m.receiveShadow = true; L.level.add(m); return m;
  };
  flat(240, 120, grass, 0, -0.03, -67);                // lawn out to the fog
  flat(70, 3, path, 0, -0.02, -8.8);                   // footpath along the building
  const hedge = L._box(L.level, 46, 0.9, 0.9, hedgeMat, 0, 0.45, -12.5); hedge.userData.noShadow = true;

  // Trees share two geometries.
  const trunkGeo = new THREE.CylinderGeometry(0.11, 0.17, 2.6, 6);
  const crownGeo = new THREE.IcosahedronGeometry(1.1, 2);
  const trees = [[-23, -17, 1.2], [-13, -23, 1.5], [-5, -19, 1.0], [5, -26, 1.6], [13, -18, 1.1],
    [22, -22, 1.4], [1, -36, 1.8], [-17, -38, 1.7], [18, -40, 1.6]];
  trees.forEach(([tx, tz, s], i) => {
    const g = new THREE.Group(); g.position.set(tx, 0, tz); g.scale.setScalar(s); L.level.add(g);
    const trunk = new THREE.Mesh(trunkGeo, bark); trunk.position.y = 1.3; g.add(trunk);
    const crown = new THREE.Mesh(crownGeo, leaves[i % 3]); crown.position.y = 3.3; crown.scale.set(1.2, 1.4, 1.1); g.add(crown);
    g.traverse(o => { if (o.isMesh) o.userData.noShadow = true; });
  });

  // A skyline of buildings behind the lawn, facing the station (+z face is the "street" face).
  buildCityBlock(L, [[-24, -58, 22, 17, 14], [6, -64, 20, 24, 14], [34, -56, 18, 15, 14]]);
}
