// Wood wainscot for interior walls: lower half is slatted wood (textures taken from
// wood_wall.glb), the upper half is the wall's own brick, split by a dark cap rail.
//
// Wood Wall by Kim Kaurin, CC-BY-4.0
// https://sketchfab.com/3d-models/wood-wall-5a03ec82ebd9457094ea699e3da8af70
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const WOOD_PANEL = {
  url: './assets/models/station/wood_wall.glb',
  height: 1.2,          // wood from the floor up to here; brick above
  tint: 0xb4804d,       // the GLB colour map is grayscale, so this is the wood colour
  rail: 0x3a2a1e,       // cap rail + skirting
  tile: 2,              // metres covered by one repeat of the GLB texture
  inset: 0.02,          // panel sits this far in front of the wall face
};

// Lab (LabLevel._buildRoom) interior faces. axis 'z' = wall plane z=at running along x,
// axis 'x' = wall plane x=at running along z. facing = which way the panel looks (into the room).
export const LAB_WOOD_RUNS = [
  { axis: 'z', at: -7, from: -10, to: 10, facing: 1 },   // north (back) wall
  { axis: 'x', at: -10, from: -7, to: 7, facing: 1 },    // west wall
  { axis: 'x', at: 10, from: -7, to: 7, facing: -1 },    // east wall
  { axis: 'z', at: 7, from: -10, to: -6, facing: -1 },   // south wall, left of the doorway
  { axis: 'z', at: 7, from: -4, to: 10, facing: -1 },    // south wall, right of the doorway
];

export function buildWoodWainscot(L, runs = LAB_WOOD_RUNS, opts = {}) {
  const cfg = { ...WOOD_PANEL, ...opts };
  const group = new THREE.Group(); group.name = 'Wood wainscot';
  const wood = new THREE.MeshStandardMaterial({ color: cfg.tint, roughness: 0.8, metalness: 0 });
  const dark = new THREE.MeshStandardMaterial({ color: cfg.rail, roughness: 0.55, metalness: 0 });

  for (const run of runs) {
    const len = run.to - run.from, mid = (run.from + run.to) / 2;
    const alongZ = run.axis === 'x';                       // run extends along z
    const place = (mesh, y, off) => {
      const d = run.at + run.facing * off;
      mesh.position.set(alongZ ? d : mid, y, alongZ ? mid : d);
      group.add(mesh); return mesh;
    };

    // Panel face: UVs in metres / tile, offset per run so neighbouring walls don't repeat.
    const face = new THREE.PlaneGeometry(len, cfg.height);
    const uv = face.attributes.uv;
    const shift = (run.from + run.at * 1.7) / cfg.tile;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * len / cfg.tile + shift, uv.getY(i) * cfg.height / cfg.tile);
    }
    const panel = place(new THREE.Mesh(face, wood), cfg.height / 2, cfg.inset);
    panel.rotation.y = alongZ ? (run.facing > 0 ? Math.PI / 2 : -Math.PI / 2) : (run.facing > 0 ? 0 : Math.PI);

    // Cap rail on top, skirting board at the bottom.
    const strip = (h, depth, y, mat) => {
      const g = alongZ ? new THREE.BoxGeometry(depth, h, len) : new THREE.BoxGeometry(len, h, depth);
      return place(new THREE.Mesh(g, mat), y, cfg.inset + depth / 2 - 0.005);
    };
    strip(0.06, 0.07, cfg.height + 0.03, dark);
    strip(0.12, 0.04, 0.06, dark);
  }

  // Wood is part of the room's surface; it receives shadows but doesn't cast them.
  group.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.userData.noShadow = true; } });
  L.level.add(group);
  // disposeStationEnvironment() runs releaseModel() over this list, which frees
  // the group's geometries, materials and every texture they reference.
  (L._environmentDerivedModels ||= []).push(group);

  // Pull the PBR maps out of the GLB. Until they arrive the panel shows plain tinted wood.
  new GLTFLoader().loadAsync(cfg.url).then(gltf => {
    let src = null;
    gltf.scene.traverse(o => { if (!src && o.isMesh) src = o.material; });
    if (!src) return;
    const maps = { map: src.map, normalMap: src.normalMap, aoMap: src.aoMap, roughnessMap: src.roughnessMap };
    for (const t of Object.values(maps)) {
      if (!t) continue;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
      (L._environmentTextures ||= new Set()).add(t);
    }
    if (L._environmentDisposed) { Object.values(maps).forEach(t => t?.dispose()); return; }
    Object.assign(wood, maps);
    wood.roughness = 0.74;                      // matches the GLB's roughnessFactor
    wood.normalScale.set(0.9, 0.9);
    wood.needsUpdate = true;
    src.dispose();
  }).catch(err => console.warn('[station] wood_wall.glb could not load; keeping plain wood', err));

  return group;
}
