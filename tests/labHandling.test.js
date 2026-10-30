import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabHandling } from '../src/levels/LabHandling.js';

function setup(){
  const level={level:new THREE.Group(),gloves:true};
  const source=new THREE.Mesh(new THREE.BoxGeometry(.1,.01,.1),new THREE.MeshBasicMaterial());
  source.position.set(1,.9,-1);level.level.add(source);
  const handling=new LabHandling(level),camera=new THREE.PerspectiveCamera();camera.position.y=1.7;
  return {level,source,handling,camera,player:{pos:new THREE.Vector3(),yaw:0}};
}
test('floating specimen spins and lands before committing progress once',()=>{
  const {source,handling,camera,player}=setup();let completed=0,disposed=0;
  source.geometry.addEventListener('dispose',()=>disposed++);
  const destination=new THREE.Vector3(2,1,-1);
  assert.equal(handling.begin({source,destination,complete:()=>completed++}),true);
  assert.equal(handling.begin({source,destination}),false);
  handling.update(.2,player,camera);assert.equal(source.visible,true);assert.equal(completed,0);
  handling.update(.4,player,camera);assert.equal(source.visible,false);assert.equal(handling.sample.visible,true);
  assert.ok(handling.sample.quaternion.angleTo(new THREE.Quaternion()) > .1);
  assert.equal(handling.root.children.length,1);
  handling.update(.8,player,camera);assert.ok(handling.sample.position.distanceTo(destination)<.001);assert.equal(completed,0);
  handling.update(.5,player,camera);assert.equal(completed,1);assert.equal(handling.active,false);
  handling.finish();handling.dispose();assert.equal(completed,1);assert.equal(disposed,0);
});
test('cancelled specimen handling restores the original without consuming it',()=>{
  const {source,handling,camera,player}=setup();let completed=false;
  handling.begin({source,destination:new THREE.Vector3(),complete:()=>completed=true});
  handling.update(.8,player,camera);assert.equal(source.visible,false);
  handling.dispose();assert.equal(source.visible,true);assert.equal(completed,false);
});
