import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installPoliceStation } from '../src/levels/PoliceStation.js';

class Station {}
installPoliceStation(Station);
function station() {
  const L = new Station();
  Object.assign(L, { level: new THREE.Group(), colliders: [], station: {}, hits: [], reports: {} });
  L._std = L._stationMaterial = () => new THREE.MeshBasicMaterial();
  L._stationSign = () => {};
  L._hit = (...args) => L.hits.push(args.at(-1));
  L._box = (parent, w, h, d, mat, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  L._buildStation();
  return L;
}
test('passage spawn and routes to both rooms stay clear; former reception is sealed', () => {
  const L = station();
  const blocked = (x,z) => L.colliders.some(b => b.clone().expandByScalar(.25).containsPoint(new THREE.Vector3(x,1,z)));
  for (let x=-5; x<=12; x+=.25) assert.equal(blocked(x,12), false, `cross passage at ${x}`);
  for (let z=8; z<=12; z+=.25) assert.equal(blocked(-5,z), false, `lab approach at ${z}`);
  for (let x=-5; x<=8; x+=.25) assert.equal(blocked(x,9), false, `open passage at ${x}`);
  assert.equal(blocked(0,14), true);
  assert.equal(L.hits.some(h => h.kind === 'reception'), false);
  assert.equal(L.hits.filter(h => h.kind === 'stationClosed').length, 4);
  assert.equal(blocked(-10,9), true);
  assert.equal(blocked(5.5,7.3), true);
});
test('captain requires all four signed reports without a reception check-in', () => {
  const L = station();
  assert.equal(L._stationCanDepart(), false);
  for (const key of ['digital','micro','dna','docs']) L.reports[key] = { signed: true };
  assert.equal(L._stationCanDepart(), true);
  L.reports.dna.signed = false;
  assert.equal(L._stationCanDepart(), false);
});
