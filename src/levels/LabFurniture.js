import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function labFurnitureMaterials() {
  return {
    top: new THREE.MeshPhysicalMaterial({ color: 0x33464b, roughness: .36, clearcoat: .22, clearcoatRoughness: .45 }),
    cabinet: new THREE.MeshStandardMaterial({ color: 0x78918b, roughness: .56, metalness: .08 }),
    face: new THREE.MeshStandardMaterial({ color: 0xa6b7ac, roughness: .5, metalness: .06 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x94a4a4, roughness: .34, metalness: .72 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x26363c, roughness: .65 }),
    accent: new THREE.MeshStandardMaterial({ color: 0xb7a478, roughness: .5, metalness: .25 }),
  };
}

// Worktop heights and footprints match the original evidence coordinates.
// A pair of pedestals leaves a real knee space instead of a solid cabinet block.
export function buildLabFurniture(parent, materials, { width = 3.4, depth = 1.7, topY = .9, serviceRail = true } = {}) {
  const root = new THREE.Group(); root.name = 'Laboratory workstation furniture'; parent.add(root);
  const box = (name, w, h, d, mat, x, y, z, radius = .012) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 4, h / 4, d / 4)), mat);
    mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  box('Rounded chemical-resistant worktop', width, .09, depth, materials.top, 0, topY, 0, .03);
  box('Brushed worktop edge', width - .05, .022, depth - .035, materials.steel, 0, topY - .045, 0);
  box('Front fascia', width - .12, .075, .055, materials.dark, 0, topY - .09, depth / 2 - .08);
  const pedestalWidth = Math.min(.94, width * .28), cabinetDepth = depth - .24;
  const cabinetHeight = topY - .22;
  for (const side of [-1, 1]) {
    const x = side * (width / 2 - pedestalWidth / 2 - .12);
    box('Recessed toe kick', pedestalWidth - .1, .13, cabinetDepth - .12, materials.dark, x, .095, -.035);
    box('Powder-coated pedestal', pedestalWidth, cabinetHeight, cabinetDepth, materials.cabinet, x, .16 + cabinetHeight / 2, 0);
    const count = side < 0 ? 3 : 1;
    const drawerH = (cabinetHeight - .055) / count;
    for (let i = 0; i < count; i++) {
      const y = .18 + drawerH * (i + .5);
      box(count === 1 ? 'Storage door' : 'Drawer front', pedestalWidth - .045, drawerH - .018, .035, materials.face, x, y, cabinetDepth / 2 + .015);
      box('Recessed handle channel', pedestalWidth * .62, .032, .014, materials.dark, x, y + drawerH / 2 - .045, cabinetDepth / 2 + .038);
      box('Brushed drawer pull', pedestalWidth * .58, .018, .035, materials.steel, x, y + drawerH / 2 - .043, cabinetDepth / 2 + .054);
    }
  }
  box('Rear cross brace', width - .25, .06, .06, materials.steel, 0, .3, -depth / 2 + .16);
  if (serviceRail) {
    box('Rear service rail', width - .12, .14, .075, materials.cabinet, 0, topY + .13, -depth / 2 + .045);
    for (const x of [-width * .3, width * .3]) {
      box('Outlet plate', .19, .095, .012, materials.dark, x, topY + .13, -depth / 2 + .09);
      for (const dx of [-.045, .045]) box('Outlet socket', .025, .04, .006, materials.steel, x + dx, topY + .13, -depth / 2 + .1, .003);
    }
  }
  // Small inset identification strip; room signage supplies the text.
  box('Bench identification accent', .32, .014, .008, materials.accent, -width / 2 + .35, topY - .09, depth / 2 - .047, .002);
  return root;
}

export function buildFaradayEnclosure(parent, materials) {
  const root = new THREE.Group(); root.name = 'Shielded phone enclosure'; root.position.set(.9, .945, .2); parent.add(root);
  const box = (p, w, h, d, mat, x, y, z) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(.012, h / 4, d / 4)), mat);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; p.add(mesh); return mesh;
  };
  box(root,.5,.025,.4,materials.steel,0,.012,0);
  box(root,.44,.008,.34,materials.dark,0,.03,0);
  for(const x of [-.238,.238])box(root,.025,.23,.4,materials.steel,x,.13,0);
  for(const z of [-.188,.188])box(root,.5,.23,.025,materials.steel,0,.13,z);
  for(const x of [-.16,.16])box(root,.045,.07,.025,materials.dark,x,.16,.213);
  const lid=new THREE.Group();lid.name='Faraday hinged lid';lid.position.set(0,.25,-.2);root.add(lid);
  box(lid,.52,.035,.42,materials.steel,0,0,.2);
  box(lid,.46,.012,.36,materials.dark,0,-.024,.2);
  box(lid,.22,.035,.045,materials.dark,0,.035,.2);
  box(lid,.18,.003,.07,materials.accent,0,.02,.33);
  return {root,lid};
}
