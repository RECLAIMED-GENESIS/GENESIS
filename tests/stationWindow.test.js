import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildLabWindow, toggleLabCurtains, updateLabWindow, disposeLabWindow, LAB_WINDOW } from '../src/levels/StationWindowView.js';

function lab() {
  const L={level:new THREE.Group(),colliders:[],docs:{lightsOff:false},hits:[],_windowDaylight:{intensity:0},
    _std:color=>new THREE.MeshStandardMaterial({color}),_stationSign(){},
    _box(parent,w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;},
    _hit(x,y,z,w,h,d,interact){this.hits.push({x,y,z,w,h,d,interact});}};
  buildLabWindow(L,L._std(0xdddddd));return L;
}
function advance(L){for(let i=0;i<180;i++)updateLabWindow(L,1/60,{pos:new THREE.Vector3(2.45,0,-5)});}

test('window remains sealed and cord can be reached from the clear lab aisle',()=>{
  const L=lab();const cord=L.hits[0];
  assert.equal(cord.interact.kind,'windowCurtains');
  assert.equal(L.colliders.some(b=>b.containsPoint(new THREE.Vector3(-2,2,-7.15))),true);
  const origin=new THREE.Vector3(cord.x,1.7,-5),target=new THREE.Vector3(cord.x,cord.y,cord.z);
  assert.ok(origin.distanceTo(target)<3.4);
  const ray=new THREE.Ray(origin,target.clone().sub(origin).normalize());
  for(const wall of L.colliders){const hit=ray.intersectBox(wall,new THREE.Vector3());assert.ok(!hit||origin.distanceTo(hit)>origin.distanceTo(target));}
});

test('curtains reverse smoothly, expose rain, close fully, and respect UV lighting',()=>{
  const L=lab();advance(L);assert.equal(L._labWindow.pane.visible,false);
  assert.equal(L._windowDaylight.intensity,.24);
  toggleLabCurtains(L);updateLabWindow(L,.1);const partial=L._labWindow.amount;
  assert.ok(partial>0&&partial<1);
  toggleLabCurtains(L);updateLabWindow(L,.1);assert.ok(L._labWindow.amount<partial);
  toggleLabCurtains(L);advance(L);
  assert.ok(L._labWindow.amount>.999);assert.equal(L._labWindow.pane.visible,true);
  assert.ok(L._windowDaylight.intensity>2.99);
  const [left,right]=L._labWindow.curtains;
  assert.ok(left.position.x<LAB_WINDOW.x-3&&right.position.x>LAB_WINDOW.x+3);
  assert.ok(L._labWindow.rain.uniforms.uTime.value>0);
  L.docs.lightsOff=true;advance(L);assert.ok(L._windowDaylight.intensity<.181);
  toggleLabCurtains(L);advance(L);assert.equal(L._labWindow.pane.visible,false);
  assert.ok(Math.abs(left.position.x-(LAB_WINDOW.x-LAB_WINDOW.width/4))<.03);
});

test('window teardown stops and disconnects rain audio',()=>{
  const L=lab(),calls=[];
  L._labWindow.audio={timer:setInterval(()=>{},1000),source:{stop:()=>calls.push('stop'),disconnect:()=>calls.push('source')},filter:{disconnect:()=>calls.push('filter')},gain:{disconnect:()=>calls.push('gain')}};
  disposeLabWindow(L);disposeLabWindow(L);
  assert.deepEqual(calls,['stop','source','filter','gain']);assert.equal(L._labWindow,null);
});
