import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function labFloorMaterial() {
  const size = 128, data = new Uint8Array(size * size * 4); let seed = 8191;
  for (let i = 0; i < size * size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const grain = (seed >>> 24) / 255, fleck = grain > .975 ? -20 : (grain - .5) * 6;
    data[i * 4] = 157 + fleck; data[i * 4 + 1] = 165 + fleck; data[i * 4 + 2] = 159 + fleck; data[i * 4 + 3] = 255;
  }
  const map = new THREE.DataTexture(data, size, size); map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map, roughness: .52, metalness: .03 });
}

export function buildLabArchitecture(L) {
  const root = new THREE.Group(); root.name = 'Laboratory architectural finishes'; L.level.add(root);
  const shell = L._std(0xbac6b9, .65, .08), trim = L._std(0x354c50, .55, .12), metal = L._std(0x8a9f9f, .35, .6);
  const diffuser = new THREE.MeshStandardMaterial({ color: 0xe8e4cf, emissive: 0xd4ddcf, emissiveIntensity: .6, roughness: .65 });
  const box = (w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(.018, h / 4, d / 4)), material);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  for (const x of [-9.73, 9.73]) for (const z of [1.6, -2.6]) {
    const facing = x < 0 ? 1 : -1;
    box(.44, .66, 2.8, shell, x, 2.5, z);
    for (const dz of [-.7, .7]) {
      box(.035, .6, 1.34, shell, x + facing * .235, 2.5, z + dz);
      box(.045, .18, .026, metal, x + facing * .265, 2.43, z + dz - .48);
    }
    box(.46, .055, 2.82, trim, x, 2.14, z);
    const light = box(.3, .014, 2.5, diffuser, x + facing * .04, 2.105, z); light.userData.noShadow = true;
    L.colliders.push(new THREE.Box3(new THREE.Vector3(x - .26, 2.1, z - 1.41), new THREE.Vector3(x + .26, 2.83, z + 1.41)));
  }
  // Slim structural ceiling rails establish scale above the clear circulation route.
  for (const z of [-4.5, 4]) box(19.95, .065, .09, shell, 0, 3.355, z);
  // Flush inlaid borders distinguish the work bays from the central circulation zone.
  for (const x of [-4.7, 4.7]) box(.035, .003, 8.5, trim, x, .004, -.4);
  // A restrained wall panel above the entrance ties the lab to the station signage.
  box(4.6, .55, .035, trim, 3.4, 2.65, 6.975);
  L._stationSign('CENTRAL / FORENSIC SERVICES', 3.4, 2.65, 6.951, 4, Math.PI);
  (L._labFixtureDiffusers ||= []).push(diffuser);
}
