// Level 2 environment only: supplied PBR surfaces, furniture and live lab dressing.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildStationSurroundings, buildEvidenceCases } from './StationSurroundings.js';

const SURFACES = {
  tile: 'Tiles051', plaster: 'PaintedPlaster005', brick: 'Bricks082A',
  wood: 'WoodFloor041', carpet: 'Carpet006', asphalt: 'Road007',
};

export function stationMaterial(level, kind, color) {
  level._environmentTextures ||= new Set();
  level._stationMaps ||= {};
  if (!level._stationMaps[kind]) {
    const loader = new THREE.TextureLoader();
    const maps = {};
    for (const [slot, suffix] of [['map', 'Color'], ['normalMap', 'NormalGL'], ['roughnessMap', 'Roughness']]) {
      const texture = loader.load(`/assets/textures/${SURFACES[kind]}_1K-JPG_${suffix}.jpg`, tex => {
        if (level._environmentDisposed) tex.dispose();
      }, undefined, () => console.warn(`[station] Missing ${kind} ${suffix} texture`));
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 4;
      if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      texture.userData.stationSurface = true;
      texture.userData.stationKind = kind;
      level._environmentTextures.add(texture);
      maps[slot] = texture;
    }
    level._stationMaps[kind] = maps;
  }
  const material = new THREE.MeshStandardMaterial({ color, ...level._stationMaps[kind],
    normalScale: new THREE.Vector2(kind === 'brick' ? 0.65 : 0.3, kind === 'brick' ? 0.65 : 0.3),
    roughness: 1, metalness: 0 });
  // The supplied plaster is ochre and heavily chipped. Keep its surface detail,
  // but paint the station a subdued neutral; soften the busy tile albedo as well.
  if (kind === 'plaster' || kind === 'tile') {
    material.onBeforeCompile = shader => {
      const remap = kind === 'plaster'
        ? 'sampledDiffuseColor.rgb = vec3(0.68) + vec3(dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))) * 0.16;'
        : 'sampledDiffuseColor.rgb = mix(vec3(0.38, 0.43, 0.44), sampledDiffuseColor.rgb, 0.22);';
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
        THREE.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;', remap + '\n diffuseColor *= sampledDiffuseColor;'));
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\n roughnessFactor = max(roughnessFactor, ' + (kind === 'plaster' ? '0.9' : '0.65') + ');');
    };
    material.customProgramCacheKey = () => `station-painted-${kind}`;
  }
  return material;
}

function releaseModel(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(o => {
    if (!o.isMesh) return;
    geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      materials.add(m);
      for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}

export function buildStationEnvironment(L) {
  buildStationSurroundings(L);
  buildEvidenceCases(L);
  const steel = L._std(0x84979c, 0.38, 0.6), trim = L._std(0x263b44, 0.65, 0.25);
  const pale = L._stationMaterial('plaster', 0xe2e7e2), wood = L._stationMaterial('wood');
  const box = (w,h,d,mat,x,y,z) => L._box(L.level,w,h,d,mat,x,y,z);
  const floor = (w,d,mat,x,z,y=.018) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);
    const uv=m.geometry.attributes.uv;
    for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*w/2,uv.getY(i)*d/2);
    m.rotation.x=-Math.PI/2; m.position.set(x,y,z);m.receiveShadow=true;L.level.add(m);return m;
  };
  // Architectural layers: plinth, cornice, recessed entry and a covered approach.
  for (const x of [-5.8,5.8]) {
    box(8.4,.28,.38,trim,x,.14,19);
    box(8.4,.16,.42,pale,x,2.67,19);
  }
  box(20.6,.16,12.6,trim,0,3.54,13);
  box(20.3,1.8,.35,L._stationMaterial('brick'),0,4.25,19);
  box(20.6,.16,.5,trim,0,5.2,19);
  box(10.5,.16,10.6,trim,15.1,3.54,12);
  box(6,.18,2.4,trim,0,2.91,20.1);
  for(const x of [-2.7,2.7]) {
    L._stationWall(x,21,.14,.14,steel,2.85);
    box(.2,2.75,.2,trim,x/2.7*1.55,1.375,19);
  }
  box(3.2,.12,.24,steel,0,2.7,19);
  floor(3,1.6,L._stationMaterial('carpet',0x8c9797),0,19.1);
  // Glazed facade panels with frames and internal blinds (the walls retain collision).
  const glazing = new THREE.MeshStandardMaterial({color:0x3d6775,roughness:.25,metalness:.45});
  for (const x of [-6,6]) {
    box(3.7,1.65,.12,trim,x,1.65,19.18);
    box(3.5,1.45,.13,glazing,x,1.65,19.2);
    box(.045,1.5,.16,steel,x,1.65,19.24);
    for(let j=0;j<7;j++)box(3.45,.035,.15,pale,x,1.05+j*.19,19.25);
    box(3.95,.12,.32,pale,x,.8,19.22);
  }
  // Interior wainscot, skirting and rail give scale without obstructing circulation.
  for(const [x,z,w,d] of [[-9.96,9,.06,3.7],[-9.96,16,.06,5.7],[0,18.81,19.6,.06],[19.96,12,.06,9.6],[15,16.81,9.6,.06]]) {
    // Entrance wall is split to leave its opening clear.
    if(z===18.81) {for(const xx of [-5.8,5.8]) {box(8.3,.8,d,pale,xx,.4,z);box(8.3,.06,.09,trim,xx,.85,z);} }
    else { box(w,.8,d,pale,x,.4,z);box(w+.02,.06,d+.02,trim,x,.85,z);box(w+.03,.12,d+.03,trim,x,.06,z); }
  }
  // Lab door frame and legible bench identifiers, no extra evidence or actions.
  for(const x of [-6.04,-3.96])box(.08,2.8,.4,steel,x,1.4,7.15);
  box(2.2,.1,.4,steel,-5,2.8,7.15);
  for(const [text,x,z] of [['DIGITAL FORENSICS',-6.8,1.6],['TRACE ANALYSIS',6.8,1.6],['DNA / BIOLOGY',-6.8,-2.6],['SCENE RECONSTRUCTION',6.8,-2.6]]) {
    L._stationSign(text,x,.69,z+.865,2.8,0,'FORENSIC SERVICES  /  AUTHORISED EXAMINERS');
  }
  // Sealable bench storage, keeping worktops and all physical interactions unchanged.
  for(const [x,z] of [[-6.8,1.6],[6.8,1.6],[-6.8,-2.6],[6.8,-2.6]]) {
    box(3,.7,1.4,pale,x,.45,z);
    box(2.9,.1,1.25,trim,x,.1,z);
    for(const dx of [-1,-.33,.33,1]) {
      box(.62,.61,.035,pale,x+dx,.47,z+.72);
      box(.24,.025,.045,steel,x+dx,.69,z+.75);
    }
  }
  floor(5.6,4.6,L._stationMaterial('carpet',0xc5c9c7),15,10.3);
  // Lobby waiting seats with upholstered pads and metal rails.
  for(const x of [5,6.2,7.4]) {
    box(.78,.1,.65,L._stationMaterial('carpet',0x3f5963),x,.56,17.18);
    box(.78,.5,.08,L._stationMaterial('carpet',0x3f5963),x,.83,17.41);
    for(const dx of [-.38,.38])box(.045,.1,.7,steel,x+dx,.73,17.18);
  }
  // Noticeboard: case-neutral station paperwork, no new collectible clues.
  box(3.1,1.5,.08,wood,-9.92,2.02,14.5).rotation.y=Math.PI/2;
  for(let i=0;i<4;i++) {
    const paper=box(.5,.64,.02,L._std(i===0?0xd3bf82:0xe5e4d7),-9.85,2.02,13.5+i*.65);
    paper.rotation.y=Math.PI/2;
  }
  // Move the entire filing unit to the blank wall opposite the captain's desk.
  const files=new THREE.Group();files.name='Captain filing shelves';
  files.position.set(15,0,16.45);files.rotation.y=Math.PI;L.level.add(files);
  const fileBox=(w,h,d,mat,x,y,z)=>L._box(files,w,h,d,mat,x,y,z);
  for(const y of [.25,.9,1.55,2.2])fileBox(3.4,.07,.45,wood,0,y,0);
  fileBox(3.4,2.2,.05,wood,0,1.1,-.23);
  for(const x of [-1.72,1.72])fileBox(.07,2.24,.5,wood,x,1.12,0);
  for(let i=0;i<13;i++)for(const y of [.61,1.26,1.91]){
    fileBox(.17,.57,.28,L._std([0x38535a,0x8b6e51,0x777b67][i%3]),-1.5+i*.24,y,.04);
    fileBox(.1,.12,.008,L._std(0xddd9c7),-1.5+i*.24,y+.1,.185);
  }
  L.colliders.push(new THREE.Box3(new THREE.Vector3(13.24,0,16.18),new THREE.Vector3(16.76,2.24,16.72)));

  // Framed service medals on the east wall, clear of the filing cabinet.
  const awards=new THREE.Group();awards.name='Captain service medals';
  awards.position.set(19.86,2.15,11.6);awards.rotation.y=-Math.PI/2;L.level.add(awards);
  const gold=L._std(0xc4a45c,.42,.65),velvet=L._std(0x203548,.95,0);
  L._box(awards,2,1.35,.08,wood,0,0,0);
  L._box(awards,1.88,1.23,.035,gold,0,0,.05);
  L._box(awards,1.79,1.14,.025,velvet,0,0,.075);
  for(const [i,x] of [-.55,0,.55].entries()){
    L._box(awards,.18,.3,.025,L._std([0x963d39,0x395a89,0x557a63][i]),x,.18,.105);
    L._box(awards,.035,.3,.03,gold,x,.18,.12);
    const medal=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.035,i===1?6:24),gold);
    medal.rotation.x=Math.PI/2;medal.position.set(x,-.1,.12);awards.add(medal);
    L._box(awards,.32,.08,.02,gold,x,-.38,.105);
  }
  L._stationSign('SERVICE COMMENDATIONS',19.79,1.26,11.6,2,-Math.PI/2,'CAPTAIN R. MABASO / CENTRAL DISTRICT');

  // HVAC extraction: rotating blades sit behind a fixed safety grille.
  const fan = new THREE.Group();fan.position.set(8.4,2.68,-6.94);L.level.add(fan);
  const blades=new THREE.Group();fan.add(blades);L._environmentFan=blades;
  for(let i=0;i<4;i++) {
    const blade=L._box(blades,.15,.43,.025,steel,0,.16,.03);blade.rotation.z=i*Math.PI/2;
    blade.position.set(-Math.sin(i*Math.PI/2)*.16,Math.cos(i*Math.PI/2)*.16,.03);
  }
  for(let i=-3;i<=3;i++)L._box(fan,.65,.018,.02,trim,0,i*.1,.1);
  L._box(fan,.74,.74,.03,pale,0,0,-.04);
  // Visible instrument LEDs reflect the actual acquisition and DNA run states.
  L._environmentLEDs=[];
  for(const [x,y,z,state] of [[-7.3,1.82,-2.08,'dna'],[-7.4,1.14,1.52,'digital']]) {
    const mat=new THREE.MeshBasicMaterial({color:0x52aa8a});
    const led=box(.045,.045,.025,mat,x,y,z);led.userData.noShadow=true;
    L._environmentLEDs.push({mat,state,mesh:led});
  }
  // Supply trolley parked against the wall; main aisles stay clear.
  const cart=new THREE.Group();cart.position.set(2.6,0,-5.9);L.level.add(cart);
  for(const y of [.25,.82])L._box(cart,1.2,.04,.65,steel,0,y,0);
  for(const x of [-.55,.55]) for(const z of [-.28,.28]) {
    L._box(cart,.035,.85,.035,steel,x,.45,z);
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.05,10),trim);
    wheel.rotation.z=Math.PI/2;wheel.position.set(x,.1,z);cart.add(wheel);
  }
  for(let i=0;i<3;i++)L._box(cart,.3,.18,.38,pale,-.38+i*.38,.94,0);
  L.colliders.push(new THREE.Box3(new THREE.Vector3(1.95,0,-6.3),new THREE.Vector3(3.25,1.15,-5.5)));

  // Share each loaded model across instances, with deterministic size and placement.
  const loader=new GLTFLoader();
  L._environmentModels=[];
  const load=(file,place)=>loader.loadAsync(`/assets/models/station/${file}`).then(gltf=> {
    if(L._environmentDisposed){releaseModel(gltf.scene);return;}
    L._environmentModels.push(gltf.scene);
    place(gltf.scene);
  }).catch(error=>console.warn(`[station] ${file} could not load; keeping fallback geometry`,error));
  const instance=(template,name,x,y,z,width,rotation=0,collide=false,fit='footprint')=> {
    const object=template.clone(true);object.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(new THREE.Vector3());
    const scale=width/(fit==='height'?size.y:Math.max(size.x,size.z));
    const holder=new THREE.Group();holder.name=name;holder.add(object);object.scale.multiplyScalar(scale);
    object.position.x-=((bounds.min.x+bounds.max.x)/2)*scale;
    object.position.z-=((bounds.min.z+bounds.max.z)/2)*scale;
    object.position.y-=bounds.min.y*scale;
    holder.position.set(x,y,z);holder.rotation.y=rotation;L.level.add(holder);holder.updateMatrixWorld(true);
    object.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;o.userData.noShadow=true;}});
    if(collide)L.colliders.push(new THREE.Box3().setFromObject(holder));
    return holder;
  };
  L._environmentReady=Promise.all([
    load('patrol-car.glb',model=> {
      const car=instance(model,'Imported police patrol car',10,0,26,4.3,0);
      for(const mesh of L._patrolFallbacks||[])mesh.visible=false;
      L._patrolCollider.setFromObject(car);
      // A cheap contact shadow grounds the parked car without another shadow light.
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
      const ctx=canvas.getContext('2d'),shade=ctx.createRadialGradient(64,64,20,64,64,64);
      shade.addColorStop(0,'rgba(0,0,0,.55)');shade.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=shade;ctx.fillRect(0,0,128,128);
      const texture=new THREE.CanvasTexture(canvas);L._environmentTextures.add(texture);
      const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.2,4.6),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
      shadow.rotation.x=-Math.PI/2;shadow.position.set(10,.012,26);shadow.userData.noShadow=true;L.level.add(shadow);
      for(const [x,z,rotation] of [[14,26,Math.PI], [18,26,0], [-10,26,Math.PI], [-18,26,0]]) {
        instance(model,'Parked police patrol car',x,0,z,4.3,rotation,true);
        const contact=shadow.clone();contact.position.set(x,.012,z);L.level.add(contact);
      }
    }),
    load('microscope.glb',model=> {
      // This download includes a presentation cube and a cable trailing down it.
      // Remove those two meshes so the actual microscope sits on our worktop.
      for(const name of ['group1310875503','group2089885585']) {
        const part=model.getObjectByName(name);
        if(part) { part.removeFromParent(); (L._environmentDiscarded ||= []).push(part); }
      }
      // The supplied microscope has 108 mesh primitives; batch its static pieces
      // by material to avoid adding a hundred draw calls for one instrument.
      model.updateMatrixWorld(true);
      const batches=new Map(), compact=new THREE.Group();
      model.traverse(o=> {
        if(!o.isMesh) return;
        const key=o.material.uuid+Object.keys(o.geometry.attributes).sort().join(',')+!!o.geometry.index;
        if(!batches.has(key))batches.set(key,{material:o.material,geometries:[]});
        batches.get(key).geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
      });
      for(const batch of batches.values()) {
        const merged=mergeGeometries(batch.geometries);
        if(merged) {
          compact.add(new THREE.Mesh(merged,batch.material));
          batch.geometries.forEach(g=>g.dispose());
        } else for(const g of batch.geometries)compact.add(new THREE.Mesh(g,batch.material));
      }
      (L._environmentDerivedModels ||= []).push(compact);
      instance(compact,'Omax forensic microscope',6.1,.94,1.6,.75,Math.PI,false,'height');
      for(const mesh of L._scopeFallbacks||[])mesh.visible=false;
    }),
    load('dna-analyser.glb',model=> {
      instance(model,'Forensic DNA analyser',-7.3,.94,-2.6,1.25);
      L._bioBody.visible=false; L._bioSlot.visible=false;
      // Keep the live case results on a separate operator display, rather than
      // replacing the imported machine's textured housing with a canvas.
      L._bioDisplay.position.set(.6,1.3,.36);
      L._bioDisplay.scale.set(.65,.65,1);
      L._environmentLEDs.find(led=>led.state==='dna').mesh.position.set(-5.94,1.18,-2.21);
      const parent=L._bioDisplay.parent;
      L._box(parent,.7,.3,.05,trim,.6,1.3,.32);
      L._box(parent,.055,.3,.055,steel,.6,1.1,.28);
      L._box(parent,.35,.03,.24,trim,.6,.96,.28);
    }),
    load('lab-equipment.glb',model=> {
      instance(model,'Biology sample rack',-6.05,.94,-3,.45,-Math.PI/2);
      instance(model,'Preparation sample rack',-7.7,.94,-6.65,.4,-Math.PI/2);
    }),
    load('wanted-poster.glb',model=> {
      instance(model,'Archived public wanted notice',2.5,1,18.68,1,Math.PI/2,false,'height');
      L._stationSign('ARCHIVED PUBLIC NOTICE',2.5,2.3,18.65,2,Math.PI,'NOT PART OF THE CURRENT CASE');
    }),
    load('desk.glb',model=> {
      const captainDesk=instance(model,'Captain imported desk',15,0,9.7,3.1,Math.PI,true);
      if(L._captainDesk)L._captainDesk.visible=false;
      const seatOfficer=(desk,officer)=>{
        const chair=desk.getObjectByName('Chair'),screen=desk.getObjectByName('Computer_Screen')||desk.getObjectByName('Computer Screen');
        if(!chair||!screen)return;
        const seat=new THREE.Box3().setFromObject(chair),center=seat.getCenter(new THREE.Vector3());
        const monitor=new THREE.Box3().setFromObject(screen).getCenter(new THREE.Vector3());
        const forward=new THREE.Vector3(monitor.x-center.x,0,monitor.z-center.z).normalize();
        officer.position.set(center.x+forward.x*.08,seat.min.y+seat.getSize(new THREE.Vector3()).y*.43-.82,center.z+forward.z*.08);
        officer.rotation.y=Math.atan2(forward.x,forward.z);
      };
      seatOfficer(captainDesk,L.captain);
      for(const [i,[x,z]] of (L._workDeskSpots||[]).entries()) {
        const desk=instance(model,'Officer workstation',x,0,z,2.3,0);
        seatOfficer(desk,L._stationWorkers[i].person);
      }
    }),
    load('file-cabinet.glb',model=> {
      for(const [x,z,rotation] of [[12,7.65,0],[13,7.65,0],[-8.9,8.5,Math.PI/2],[19.5,14.7,-Math.PI/2]])
        instance(model,'Station filing cabinet',x,0,z,.75,rotation,true);
    }),
    load('fluorescent-fixture.glb',model=> {
      for(const [x,z] of [[-6,2.5],[0,2.5],[6,2.5],[0,-3.5],[0,15],[-5,9],[15,12],...(L._extraCeilingFixtures||[])]) {
        const fixture=instance(model,'Fluorescent ceiling fixture',x,0,z,2.2,Math.PI/2);
        const bounds=new THREE.Box3().setFromObject(fixture);
        fixture.position.y=3.38-bounds.max.y;
      }
      for(const m of L._ceilingFallbacks||[])m.visible=false;
    }),
  ]);
}

export function updateStationEnvironment(L,dt,t) {
  if(L._environmentFan)L._environmentFan.rotation.z-=dt*3;
  for(const led of L._environmentLEDs||[]) {
    const running=led.state==='dna'?L.bio.running:L.cyber.unitRunning;
    const ready=led.state==='dna'?L.bio.ready:L.cyber.unitDone;
    led.mat.color.setHex(running?(Math.sin(t*5)>0?0xf4bb52:0x6c5732):ready?0x62e5ab:0x356758);
  }
}

export function disposeStationEnvironment(L) {
  L._environmentDisposed=true;
  for(const texture of L._environmentTextures||[])texture.dispose();
  // Includes textures embedded in the GLBs, which the legacy disposer did not own.
  for(const models of [L._environmentModels,L._environmentDerivedModels,L._environmentDiscarded])
    for(const model of models||[])releaseModel(model);
}
