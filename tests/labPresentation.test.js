import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabCarry } from '../src/levels/LabCarry.js';
import { buildLabFurniture, labFurnitureMaterials } from '../src/levels/LabFurniture.js';
import { ExaminationProgress } from '../src/game/examinationProgress.js';

function lab() {
  const L = { level: new THREE.Group(), cyber: { staged: 'carried' }, carried: { id: 'phone' }, docs: { lightsOff: true }, colliders: [], _uiBusy: () => false,
    _beam: new THREE.SpotLight(), _beamPool: new THREE.Mesh(new THREE.CircleGeometry(.1), new THREE.MeshBasicMaterial({ transparent: true })) };
  for (const name of ['_phoneProp', '_wandProp', '_phoneCradleProp']) { L[name] = new THREE.Mesh(new THREE.BoxGeometry(.1,.02,.2), new THREE.MeshBasicMaterial()); L.level.add(L[name]); }
  L._phoneProp.position.set(0,.95,4); L._wandProp.position.set(7,.98,-3); L._phoneCradleProp.position.set(-7,.99,1.7);
  return L;
}
test('phone visibly travels to the carry anchor and returns to its cradle', () => {
  const L = lab(), carry = new LabCarry(L), player = { pos: new THREE.Vector3(), yaw: 0, pitch: -.5 }, camera = new THREE.PerspectiveCamera();
  const view = { isThird: () => true, getCarryAnchor(v) { v.set(.3,1.2,-.4); return true; } };
  carry.update(.05, player, camera, view); assert.equal(carry.phase, 'pickup');
  for (let i=0;i<10;i++) carry.update(.05, player, camera, view);
  assert.equal(carry.phase,'held'); assert.equal(carry.items.phone.visible,true); assert.ok(carry.items.phone.position.distanceTo(new THREE.Vector3(.3,1.2,-.47)) < .02);
  L.carried=null; L.cyber.staged='cradle'; carry.update(.05,player,camera,view); assert.equal(L._phoneCradleProp.visible,false);
  for(let i=0;i<10;i++)carry.update(.05,player,camera,view);
  assert.equal(carry.phase,'idle'); assert.equal(carry.items.phone.visible,false); assert.equal(L._phoneCradleProp.visible,true);
  carry.dispose();
});
test('UV beam follows aim, reaches surfaces, and switches off in a device or when put down', () => {
  const L=lab(); L.carried={id:'uvwand'}; const carry=new LabCarry(L), player={pos:new THREE.Vector3(),yaw:0,pitch:-.5}, camera=new THREE.PerspectiveCamera();
  camera.position.set(0,1.7,0);
  carry.update(.5,player,camera); assert.ok(L._beam.intensity>0); assert.equal(L._beamPool.visible,true);
  assert.ok(Math.abs(L._beam.target.position.y-.012)<.00001);
  L.docs.lightsOff=false;carry.update(.05,player,camera);assert.equal(L._beam.intensity,0);assert.equal(L._beamPool.visible,false);
  L.docs.lightsOff=true;carry.update(.05,player,camera);assert.ok(L._beam.intensity>0);
  L._uiBusy=()=>true;carry.update(.05,player,camera);assert.equal(L._beam.intensity,0);assert.equal(carry.items.uvwand.visible,false);
  L._uiBusy=()=>false; L.carried=null; carry.update(.05,player,camera);assert.equal(L._beam.intensity,0);
  carry.dispose();
});
test('held phone can flourish again and settles without spinning forever', () => {
  const L=lab(),carry=new LabCarry(L),player={pos:new THREE.Vector3(),yaw:0},camera=new THREE.PerspectiveCamera();
  carry.update(1,player,camera);assert.equal(carry.flourish,1);
  carry.spin();assert.equal(carry.flourish,0);
  carry.update(.3,player,camera);assert.ok(carry.flourish>0&&carry.flourish<1);
  const mid=carry.items.phone.quaternion.clone();
  carry.update(.7,player,camera);assert.equal(carry.flourish,1);assert.ok(mid.angleTo(carry.items.phone.quaternion)>.5);
  carry.reducedMotion=true;carry.spin();assert.equal(carry.flourish,1);
  carry.dispose();
});
test('workstation geometry keeps the evidence worktop and circulation footprint', () => {
  const parent=new THREE.Group();const root=buildLabFurniture(parent,labFurnitureMaterials());
  const bounds=new THREE.Box3().setFromObject(root);
  assert.ok(bounds.min.x>=-1.701&&bounds.max.x<=1.701);assert.ok(bounds.min.z>=-.851&&bounds.max.z<=.851);
  const top=root.getObjectByName('Rounded chemical-resistant worktop');assert.equal(top.position.y,.9);
  assert.ok(root.children.filter(o=>o.name==='Drawer front').length===3);
  const knee=new THREE.Vector3(0,.5,.4);
  for(const mesh of root.children) assert.equal(new THREE.Box3().setFromObject(mesh).containsPoint(knee),false);
});
test('all examination features must be inspected before explicit recording', () => {
  const progress=new ExaminationProgress(['rim','print']);
  assert.equal(progress.record(),false);
  for(let i=0;i<10;i++)progress.inspect('rim',.05);
  assert.equal(progress.ready,false);assert.equal(progress.record(),false);
  progress.inspect('unknown',10);progress.inspect('print',NaN);assert.equal(progress.coverage.print,0);
  for(let i=0;i<10;i++)progress.inspect('print',.05);
  assert.equal(progress.ready,true);assert.equal(progress.recorded,false);assert.equal(progress.record(),true);
  assert.equal(new ExaminationProgress(['rim','print'],true).ready,true);
});
