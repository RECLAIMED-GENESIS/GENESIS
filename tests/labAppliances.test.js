import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { updateAppliances, interactAppliance, dnaCanRun } from '../src/levels/LabAppliances.js';
import { installLabExtras } from '../src/levels/LabExtras.js';
import { LabHandling } from '../src/levels/LabHandling.js';
class Lab {}
installLabExtras(Lab);

test('real analyser workflow requires opening, loading, closing and latching before RUN',()=>{
  const L=new Lab();Object.assign(L,{level:new THREE.Group(),bio:{lysis:true},cyber:{},trace:{},docs:{},_toast(){},_refreshCounter(){},_dnaDoor:new THREE.Group(),_dnaSeat:new THREE.Vector3(1,1,1)});
  L._dnaDoor.rotation.z=-Math.PI/2;L._cartridgeMesh=new THREE.Mesh(new THREE.BoxGeometry(.18,.06,.12),new THREE.MeshBasicMaterial());L.level.add(L._cartridgeMesh);L._handling=new LabHandling(L);
  L._interactExtra({kind:'cartridge'});assert.equal(L._handling.active,false);assert.equal(dnaCanRun(L.bio),false);
  L._interactExtra({kind:'dnaHatch'});updateAppliances(L,1,0);assert.equal(L.bio.hatchOpen,true);
  L._interactExtra({kind:'cartridge'});assert.equal(L._handling.active,true);assert.equal(L.bio.loaded,undefined);
  L._handling.update(2);assert.equal(L.bio.loaded,true);
  L._interactExtra({kind:'dnaControl'});assert.equal(L.bio.running,undefined);
  L._interactExtra({kind:'dnaHatch'});L._interactExtra({kind:'seqrun'});assert.equal(L.bio.running,undefined,'door must finish closing');
  updateAppliances(L,1,1);L._interactExtra({kind:'dnaControl'});assert.equal(L.bio.running,true);
  L._interactExtra({kind:'dnaHatch'});assert.equal(L.bio.hatchOpen,false,'running chamber remains locked');
  L.bio.running=false;L.bio.ready=true;L._interactExtra({kind:'dnaControl'});assert.equal(L.bio.matched,true);
  L._handling.dispose();
});

test('fridge door and racks animate, and closing retracts all racks',()=>{
  const L={_fridgeDoor:new THREE.Group(),_fridgeLight:{intensity:0},_fridgeRacks:[new THREE.Group()],bio:{}};
  interactAppliance(L,{kind:'fridge'});assert.equal(L._fridgeDoor.rotation.y,0);
  updateAppliances(L,.1,0);assert.ok(L._fridgeDoor.rotation.y>0&&L._fridgeDoor.rotation.y<1.7);assert.ok(L._fridgeLight.intensity>0);
  interactAppliance(L,{kind:'fridgeRack',index:0});updateAppliances(L,.5,0);assert.ok(L._fridgeRacks[0].position.x>.2);
  interactAppliance(L,{kind:'fridge'});updateAppliances(L,1,0);assert.ok(L._fridgeRacks[0].position.x<.001);assert.ok(L._fridgeDoor.rotation.y<.01);
});

test('touching lab fixtures changes their visible state without popups',()=>{
  const L={bio:{},_waterStream:{visible:false,scale:{}},_waterRipple:{visible:false,scale:{setScalar(){}},material:{}},_binHinge:new THREE.Group(),_hoodSash:new THREE.Group(),_balanceWeight:new THREE.Group(),_pipettes:[new THREE.Group()],_drawBalance(){this.drawn=true;}};
  for(const kind of ['sink','bin','hood','balance','pipettes','centrifuge'])assert.equal(interactAppliance(L,{kind}),true);
  updateAppliances(L,.2,.2);
  assert.equal(L._waterStream.visible,true);assert.ok(L._binHinge.rotation.x<0);assert.ok(L._hoodSash.position.y>0);assert.equal(L.drawn,true);assert.ok(L._pipettes[0].position.y>0);assert.ok(L._centriSpin>0);
  interactAppliance(L,{kind:'sink'});updateAppliances(L,.1,.3);assert.equal(L._waterStream.visible,false);
});
