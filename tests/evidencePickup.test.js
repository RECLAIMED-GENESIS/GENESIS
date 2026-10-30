import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EvidencePickup } from '../src/game/EvidencePickup.js';

for (const tool of ['bag', 'tweezers', 'swab']) test(`${tool}: reach, lift once, package and clean up without disposing the exhibit`, () => {
  const level = new THREE.Group(), original = new THREE.Mesh(new THREE.BoxGeometry(.12, .02, .24), new THREE.MeshStandardMaterial());
  original.position.set(1, .9, -1); level.add(original);
  let lifted = 0, disposed = 0; original.geometry.addEventListener('dispose', () => disposed++);
  const clue = { id: 'phone', group: original, onCollect() { lifted++; original.visible = false; } };
  const animation = new EvidencePickup(level), camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.7, 0);
  const player = { pos: new THREE.Vector3(), yaw: 0 };
  const view = { isThird: () => true, getCarryAnchor(out) { out.set(.3, 1.2, -.5); return true; } };
  assert.equal(animation.begin(clue, tool), true);
  assert.equal(animation.begin(clue, tool), false);
  animation.update(.4, player, camera, view); assert.equal(lifted, 0); assert.equal(original.visible, true);
  animation.update(.5, player, camera, view); assert.equal(lifted, 1); assert.equal(original.visible, false); assert.equal(animation.sample.visible, true);
  for (let i = 0; i < 40; i++) animation.update(.05, player, camera, view);
  assert.equal(animation.active, false); assert.equal(animation.root.visible, false); assert.equal(lifted, 1);
  animation.dispose(); assert.equal(disposed, 0);
});
test('disposing mid-pickup settles collection once and photo evidence is never physically lifted', () => {
  const root = new THREE.Group(), group = new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1), new THREE.MeshBasicMaterial()); root.add(group);
  let calls = 0; const clue = { group, onCollect() { calls++; } }, animation = new EvidencePickup(root);
  assert.equal(animation.begin(clue, 'camera'), false); assert.equal(calls, 0);
  animation.begin(clue, 'bag'); animation.dispose(); animation.dispose(); assert.equal(calls, 1);
});
