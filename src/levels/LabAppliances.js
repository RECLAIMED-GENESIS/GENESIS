import * as THREE from 'three';
import { play as sfx } from '../audio/sfx.js';

function label(L,parent,text,x,y,z,w=.32,h=.08,rotation=0) {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const g=canvas.getContext('2d');g.fillStyle='#e4e8df';g.fillRect(0,0,512,128);g.fillStyle='#293f43';g.font='bold 35px sans-serif';g.textAlign='center';g.fillText(text,256,78,490);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map,roughness:.8}));
  mesh.position.set(x,y,z);mesh.rotation.y=rotation;parent.add(mesh);return mesh;
}

export function dressFridge(L,fr) {
  L._fridgeRacks=[];
  const metal=L._std(0x98a6a8,.35,.65),poly=L._std(0x91aaa5,.7,0),glass=new THREE.MeshStandardMaterial({color:0xd1e5e8,transparent:true,opacity:.45,roughness:.18,depthWrite:false});
  for(let s=0;s<3;s++) {
    const rack=new THREE.Group();rack.position.set(0,.52+s*.45,0);fr.add(rack);rack.userData.pulled=false;L._fridgeRacks.push(rack);
    L._box(rack,.47,.025,.48,poly,0,.012,0);
    for(const z of [-.23,.23])L._box(rack,.47,.06,.02,poly,0,.045,z);
    for(let i=0;i<8;i++) {
      const vial=new THREE.Group();vial.position.set(-.16+(i%4)*.105,.03,i<4?-.11:.11);rack.add(vial);
      const tube=new THREE.Mesh(new THREE.CylinderGeometry(.024,.02,.16,12),glass);tube.position.y=.08;vial.add(tube);
      const fluid=new THREE.Mesh(new THREE.CylinderGeometry(.019,.016,.06,12),L._std(s===1?0xc8aa79:0x93b7bd,.5,0));fluid.position.y=.04;vial.add(fluid);
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(.027,.027,.025,12),L._std([0x4e829b,0xa68b52,0x70917c][s]));cap.position.y=.172;vial.add(cap);
      label(L,vial,String(s+1)+'-'+String(i+1),.025,.085,0,.055,.04,Math.PI/2);
    }
    label(L,rack,['REFERENCE / A','REAGENTS / B','CONTROLS / C'][s],.245,.06,0,.4,.07,Math.PI/2);
    const hit=L._hit(-9.12,.65+s*.45,-.9,.3,.25,.52,{kind:'fridgeRack',index:s,when:()=>L._fridgeOpen});
    hit.name='Sample rack interaction';
  }
  for(const z of [-.17,.15]) {
    L._box(fr,.45,.17,.25,L._std(0xd7dccc),-.02,.22,z);
    label(L,fr,'SEALED STORAGE',.213,.23,z,.23,.055,Math.PI/2);
  }
  for(const y of [.52,.97,1.42])L._box(fr,.58,.012,.012,metal,.01,y,.29);
  L._fridgeLight=new THREE.PointLight(0xd7efff,0,1.8,2);L._fridgeLight.position.set(.18,1.73,0);fr.add(L._fridgeLight);
  L._box(fr,.015,.08,.4,new THREE.MeshStandardMaterial({color:0xe2f0ff,emissive:0xc7e9ff,emissiveIntensity:.6}),-.3,1.72,0);
  for(const y of [.35,.8,1.25]) {
    L._box(L._fridgeDoor,.07,.05,.53,poly,-.07,y,.35);
    L._box(L._fridgeDoor,.015,.1,.53,poly,-.11,y+.04,.35);
  }
  L._fridgeDoor.children[0].userData.interact={kind:'fridge'};
}

export function connectDnaAnalyser(L,model) {
  L._dnaModel=model;
  const upper=model.getObjectByName('Main001'),lower=model.getObjectByName('Main002');
  if(upper)upper.rotation.z=0;
  L._dnaDoor=lower;
  if(lower)lower.rotation.z=L.bio.hatchOpen?-.825822:-Math.PI/2;
  model.updateMatrixWorld(true);
  const screen=model.getObjectByName('Main_ScreenKeyboard_0');
  if(screen) {
    const bounds=new THREE.Box3().setFromObject(screen),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    L.level.attach(L._bioDisplay);L._bioDisplay.position.copy(center);L._bioDisplay.position.z=bounds.max.z+.003;
    L._bioDisplay.scale.set(size.x,size.y/.4,1);L._bioDisplay.rotation.set(0,0,0);
    L._bioDisplay.userData.interact={kind:'dnaDisplay'};
  }
  const keyboard=model.getObjectByName('Main003_ScreenKeyboard_0');
  if(keyboard) keyboard.userData.interact={kind:'dnaControl'};
  const bodyBounds=new THREE.Box3().setFromObject(model);
  // The supplied model's lower chamber is on the right of its operator screen.
  const chamber=model.getObjectByName('Main_Fuses_0');
  const chamberBounds=chamber?new THREE.Box3().setFromObject(chamber):bodyBounds;
  L._dnaSeat=new THREE.Vector3((chamberBounds.min.x+chamberBounds.max.x)/2,bodyBounds.min.y+.18,chamberBounds.max.z-.025);
  // The visible door and the exposed chamber both work the compartment; the
  // door swings clear of the cabinet, so a cabinet-only hitbox can open it
  // but never close it again.
  for(const part of [lower,chamber])part?.traverse(o=>{ if(o.isMesh)o.userData.interact={kind:'dnaHatch'}; });
  const chamberSize=chamberBounds.getSize(new THREE.Vector3());
  L._dnaHatchHit=L._hit(L._dnaSeat.x,(chamberBounds.min.y+chamberBounds.max.y)/2,chamberBounds.max.z+.02,
    Math.max(.36,chamberSize.x+.1),Math.max(.3,chamberSize.y+.1),.12,{kind:'dnaHatch'});
  if(L._coach)L._coach.targets.push(...[L._dnaHatchHit,keyboard,L._bioDisplay].filter(Boolean));
  for(const hit of L._legacyDnaControls||[])delete hit.userData.interact;
  if(L._coach)L._coach.targets=L._coach.targets.filter(o=>o.userData.interact);
  for(const mesh of L._legacyDnaButtons||[])mesh.visible=false;
  L._bioBody.visible=false;L._bioSlot.visible=false;
  if(L._helixBase)L._helixBase.visible=false;
  L._syncProps();
}

export function dnaCanRun(bio,doorSettled=true) {
  return !!bio.loaded&&!bio.hatchOpen&&!bio.running&&!bio.ready&&doorSettled;
}

export function updateAppliances(L,dt,t) {
  if(L._fridgeDoor)L._fridgeDoor.rotation.y=THREE.MathUtils.damp(L._fridgeDoor.rotation.y,L._fridgeOpen?1.7:0,7,dt);
  if(L._fridgeLight)L._fridgeLight.intensity=THREE.MathUtils.damp(L._fridgeLight.intensity,L._fridgeOpen?1.2:0,8,dt);
  for(const rack of L._fridgeRacks||[])rack.position.x=THREE.MathUtils.damp(rack.position.x,L._fridgeOpen && rack.userData.pulled ? .24 : 0,8,dt);
  if(L._hoodSash)L._hoodSash.position.y=THREE.MathUtils.damp(L._hoodSash.position.y,L._hoodOpen?2.15:1.5,7,dt);
  if(L._waterStream){L._waterStream.visible=!!L._tapOn;L._waterStream.scale.x=1+Math.sin(t*29)*.1;}
  if(L._waterRipple){L._waterRipple.visible=!!L._tapOn;L._waterRipple.scale.setScalar(.65+(t*1.4%1)*.6);L._waterRipple.material.opacity=.3*(1-(t*1.4%1));}
  if(L._binHinge)L._binHinge.rotation.x=THREE.MathUtils.damp(L._binHinge.rotation.x,L._binOpen?-1.15:0,8,dt);
  if(L._dnaDoor)L._dnaDoor.rotation.z=THREE.MathUtils.damp(L._dnaDoor.rotation.z,L.bio.hatchOpen?-.825822:-Math.PI/2,8,dt);
  if(L._centriLid){L._centriLid.material.transparent=true;L._centriLid.material.opacity=L._centriSpin > 0 ? .28 : .8;}
  if(L._rotor)L._rotor.visible=true;
  if(L._balanceWeight)L._balanceWeight.position.y=THREE.MathUtils.damp(L._balanceWeight.position.y,L._balanceLoaded?1.055:1.2,8,dt);
  if(L._pipettes)for(let i=0;i<L._pipettes.length;i++) {
    const p=L._pipettes[i],selected=L._pipetteSelected===i;
    p.position.y=THREE.MathUtils.damp(p.position.y,selected?1.34:1.12,8,dt);
    p.rotation.z=THREE.MathUtils.damp(p.rotation.z,selected?-.4:0,8,dt);
  }
}

export function interactAppliance(L,it) {
  switch(it.kind) {
    case 'fridge':L._fridgeOpen=!L._fridgeOpen;if(!L._fridgeOpen)for(const r of L._fridgeRacks||[])r.userData.pulled=false;sfx('door');return true;
    case 'fridgeRack':if(L._fridgeOpen){const r=L._fridgeRacks[it.index];r.userData.pulled=!r.userData.pulled;sfx('setDown');}return true;
    case 'hood':L._hoodOpen=!L._hoodOpen;sfx('door');return true;
    case 'sink':L._tapOn=!L._tapOn;sfx('waterTap');return true;
    case 'bin':L._binOpen=!L._binOpen;sfx('door');return true;
    case 'centrifuge':L._centriSpin=L._centriSpin>0?0:8;sfx(L._centriSpin?'instrumentStart':'setDown');return true;
    case 'pipettes':L._pipetteSelected=((L._pipetteSelected??-1)+1)%5;if(L._pipetteSelected===4)L._pipetteSelected=-1;sfx('pickup');return true;
    case 'balance':L._balanceLoaded=!L._balanceLoaded;L._drawBalance?.();sfx('glassPlace');return true;
    default:return false;
  }
}
