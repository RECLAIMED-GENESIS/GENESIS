// Station-only streetscape, using the supplied blue-sky image.
import * as THREE from 'three';

export function buildStationSurroundings(L) {
  const skyMap=new THREE.TextureLoader().load('/assets/textures/station-clouds-sky.jpg',texture=> {
    if(L._environmentDisposed)texture.dispose();
  });
  skyMap.colorSpace=THREE.SRGBColorSpace;L._environmentTextures.add(skyMap);
  const skyMaterial=new THREE.MeshBasicMaterial({map:skyMap,side:THREE.BackSide,depthWrite:false,fog:false});
  // This photograph is not a panorama. Crossfade its two edges through a
  // shared centre sample so the longitude wrap has identical colour on both sides.
  skyMaterial.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        float longitude = fract(vMapUv.x);
        float latitude = clamp(vMapUv.y * 2.0 - 1.0, 0.0, 1.0);
        float photoV = mix(0.04, 0.98, latitude);
        vec4 photo = texture2D(map, vec2(longitude, photoV));
        vec4 overlap = texture2D(map, vec2(fract(longitude + 0.5), photoV));
        float edgeBlend = 1.0 - smoothstep(0.0, 0.15, min(longitude, 1.0 - longitude));
        vec4 skyColour = mix(photo, overlap, edgeBlend);
        // All longitudes meet at the pole: fade to one blue there, avoiding a pinch.
        vec4 zenith = texture2D(map, vec2(0.5, 0.98));
        skyColour = mix(skyColour, zenith, smoothstep(0.78, 0.98, latitude));
        // A uniform haze below the horizon avoids stretching the bottom photo row.
        vec4 horizon = texture2D(map, vec2(0.5, 0.04));
        skyColour = mix(horizon, skyColour, smoothstep(0.46, 0.54, vMapUv.y));
        diffuseColor *= skyColour;
      #endif
    `);
  };
  skyMaterial.customProgramCacheKey=()=> 'station-continuous-photo-sky-v1';
  const sky=new THREE.Mesh(new THREE.SphereGeometry(450,64,32),skyMaterial);
  sky.rotation.y=Math.PI; // Face the blue/cloud portion toward the public road.
  sky.name='Station blue sky';sky.userData.noShadow=true;sky.renderOrder=-100;L.level.add(sky);
  L.scene.background=new THREE.Color(0x8ec8ed);
  L.scene.fog=new THREE.Fog(0xb3d2e4,65,200);
  const sun=new THREE.DirectionalLight(0xfff4dd,1.1);sun.position.set(92,85,-38);sun.castShadow=false;L.level.add(sun);
  // Existing fixtures illuminate the rooms; the ambient sky now reads as daytime.
  L._hemi.color.setHex(0xcce4f7);L._hemi.intensity=1.15;
  const asphalt=L._stationMaterial('asphalt',0x777d8b);
  const pavement=L._stationMaterial('tile',0x9da6ae), dark=L._std(0x26303a,.9,0);
  const ground=(w,d,mat,x,z,y)=> {
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);
    const uv=m.geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/12,uv.getY(i)*d/12);
    m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.receiveShadow=true;L.level.add(m);return m;
  };
  ground(320,320,L._std(0x4b555c,.95,0),0,25,-.06);
  ground(240,12,asphalt,0,39,-.025);
  ground(240,3,pavement,0,31.5,.025);
  ground(240,3,pavement,0,46.5,.025);
  const box=(w,h,d,mat,x,y,z)=>L._box(L.level,w,h,d,mat,x,y,z);
  for(const z of [33,45])box(240,.15,.18,L._std(0xb3b2b1),0,.04,z);
  const marking=L._std(0xbebbb0,.9,0);
  for(let x=-110;x<110;x+=8)box(3,.008,.12,marking,x,0,39);
  // Background buildings are beyond the existing playable forecourt boundary.
  const windows=[], panes=new THREE.MeshStandardMaterial({color:0x344f65,emissive:0x93b5c4,emissiveIntensity:.35,roughness:.4,metalness:.25});
  const buildings=[[-47,64,13,18,15],[-28,67,15,24,17],[-7,64,15,13,14],[15,69,18,22,17],[39,64,15,17,16],[60,70,18,27,18],[-38,4,13,15,15],[39,1,14,20,14],[-43,-24,17,26,17],[43,-29,16,29,17]];
  for(let i=0;i<buildings.length;i++) {
    const [x,z,w,h,d]=buildings[i];
    const wall=L._stationMaterial(i%3===0?'brick':'plaster',[0x667582,0x85776f,0x596876][i%3]);
    box(w,h,d,wall,x,h/2,z);box(w+.3,.35,d+.3,dark,x,h+.15,z);
    box(w,.65,d+.2,dark,x,3,z);
    // Front and side windows batch into a single instanced draw.
    for(let y=4.8;y<h-1;y+=3.2) {
      for(let xx=-w/2+1.6;xx<w/2-1;xx+=3)windows.push([x+xx,y,z-d/2-.025,0]);
      for(let zz=-d/2+1.5;zz<d/2-1;zz+=3)windows.push([x+(x<0?w/2+.025:-w/2-.025),y,z+zz,Math.PI/2]);
    }
    box(w*.35,1.1,d*.3,dark,x+w*.2,h+.7,z);
  }
  const windowMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.35,1.65),panes,windows.length);
  panes.side=THREE.DoubleSide;
  const dummy=new THREE.Object3D(), color=new THREE.Color();
  windows.forEach(([x,y,z,angle],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,angle,0);dummy.updateMatrix();windowMesh.setMatrixAt(i,dummy.matrix);windowMesh.setColorAt(i,color.setHex(i%5===0?0xffd29d:0x6d8b9e));});
  windowMesh.userData.noShadow=true;L.level.add(windowMesh);
  const lampMetal=L._std(0x303b47,.6,.5), lampGlow=new THREE.MeshBasicMaterial({color:0xffd9a3});
  for(const x of [-30,-15,0,15,30]) {
    box(.12,5.2,.12,lampMetal,x,2.6,46.8);box(1.5,.09,.12,lampMetal,x+.7,5.15,46.8);
    box(.8,.07,.35,lampGlow,x+1.1,5.08,46.8);
  }
  // Low planting beds keep the entrance visible and give the forecourt an edge.
  const leaves=L._std(0x3b6252,.95,0), bark=L._std(0x65513d,.95,0);
  for(const [x,z] of [[-17,21],[17,20],[-25,32],[26,32],[-19,48],[22,48]]) {
    box(2.4,.55,1.4,L._stationMaterial('brick',0x999b92),x,.275,z);
    box(2.2,.05,1.2,L._std(0x343b30),x,.56,z);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.11,.16,2.6,6),bark);trunk.position.set(x,1.8,z);L.level.add(trunk);
    const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.1,1),leaves);crown.position.set(x,3.2,z);crown.scale.set(1,1.3,.8);L.level.add(crown);
    // Only the two beds within the playable forecourt need collision.
    if(Math.abs(x)<22&&z<30)L.colliders.push(new THREE.Box3(new THREE.Vector3(x-1.2,0,z-.7),new THREE.Vector3(x+1.2,3,z+.7)));
  }
  L._stationSign('CENTRAL DISTRICT',-13,1.1,29.65,3,Math.PI,'CITY CENTRE  /  GENESIS WATERFRONT');
  for(const x of [-14,-12])box(.08,1.5,.08,dark,x,.75,29.65);
  buildStreetActivity(L);
}

export function buildEvidenceCases(L) {
  const shell=L._std(0x28373b,.6,.2),rim=L._std(0x9da7a8,.4,.6),foam=L._std(0x172121,.95,0);
  const box=(p,w,h,d,m,x,y,z)=>L._box(p,w,h,d,m,x,y,z);
  L._intakeCases=[];
  for(const x of [-1.93,.38]) {
    const c=new THREE.Group();c.name='Open evidence transport case';c.position.set(x,.945,4.6);L.level.add(c);L._intakeCases.push(c);
    box(c,2.25,.025,.9,shell,0,0,0);box(c,2.15,.012,.8,foam,0,.02,0);
    for(const xx of [-1.125,1.125])box(c,.045,.12,.9,rim,xx,.04,0);
    for(const zz of [-.45,.45])box(c,2.25,.12,.045,rim,0,.04,zz);
    for(const xx of [-.385,.385])box(c,.025,.06,.8,foam,xx,.03,0);
    box(c,.4,.055,.12,shell,0,0,.51);
    for(const xx of [-.8,.8])box(c,.12,.08,.06,rim,xx,.04,.48);
    const lid=new THREE.Group();lid.position.set(0,.04,-.45);lid.rotation.x=-1.95;c.add(lid);
    box(lid,2.25,.055,.9,shell,0,0,.45);box(lid,2.12,.012,.78,foam,0,.034,.45);
  }
  const labels=['01 CASING','02 GLASS','03 HAIR','04 FABRIC','05 PHONE','06 UV TRAIL'];
  for(let i=0;i<labels.length;i++) {
    const cv=document.createElement('canvas');cv.width=256;cv.height=64;const g=cv.getContext('2d');
    g.fillStyle='#e1dec9';g.fillRect(0,0,256,64);g.fillStyle='#273b42';g.font='bold 26px monospace';g.textAlign='center';g.fillText(labels[i],128,42);
    const map=new THREE.CanvasTexture(cv);map.colorSpace=THREE.SRGBColorSpace;L._environmentTextures.add(map);
    const tag=new THREE.Mesh(new THREE.PlaneGeometry(.63,.14),new THREE.MeshBasicMaterial({map}));tag.position.set(-2.7+i*.77,1,5.08);L.level.add(tag);
  }
  if(L._phoneProp) {
    const sleeve=new THREE.Mesh(new THREE.BoxGeometry(.23,.035,.34),new THREE.MeshStandardMaterial({color:0xb0c7c7,transparent:true,opacity:.19,roughness:.45,depthWrite:false}));sleeve.position.y=.025;sleeve.userData.noShadow=true;L._phoneProp.add(sleeve);
    box(L._phoneProp,.2,.008,.035,L._std(0xb69c6d),0,.044,-.145);
  }
  // Paperwork lives upright in a file case at the clear end of the intake desk.
  const file=new THREE.Group();file.name='Intake file case';file.position.set(2.4,.95,4.45);L.level.add(file);
  box(file,.85,.035,.65,shell,0,0,0);
  for(const x of [-.42,.42])box(file,.035,.44,.65,shell,x,.22,0);
  box(file,.85,.44,.035,shell,0,.22,-.31);
  for(let i=0;i<4;i++) {
    box(file,.74,.33,.035,L._std(i%2?0xb9a77a:0x788b88),0,.19,-.18+i*.12);
    box(file,.18,.04,.035,L._std(0xd8d2b8),-.23+i*.14,.375,-.18+i*.12);
  }
}


// Background activity stays on the pavements and two road lanes, away from the entry.
function buildStreetActivity(L) {
  L._parkingOfficers=[];
  for(const [x,z,angle] of [[12,24.2,Math.PI/2],[12.6,24.8,-Math.PI/2],[-12,25.2,Math.PI/3]]){
    const person=L._stationOfficer(x,z,'Arriving patrol officer',angle);
    L._parkingOfficers.push(person);
    L.colliders.push(new THREE.Box3(new THREE.Vector3(x-.25,0,z-.25),new THREE.Vector3(x+.25,1.85,z+.25)));
  }
  L._streetWalkers=[];
  for(let i=0;i<8;i++){
    const speed=(i%2?1:-1)*(.65+(i%3)*.12);
    const person=L._stationOfficer(-70+i*20,i%2?46.1:31.3,'City pedestrian '+i,speed>0?Math.PI/2:-Math.PI/2,[0x8d5d42,0x64756c,0x80708c,0xad9566][i%4]);
    person.scale.setScalar(.92+(i%3)*.04);
    person.traverse(o=>{if(o.isMesh){o.castShadow=false;o.userData.noShadow=true;}});
    L._streetWalkers.push({person,speed,phase:i});
  }
  // Lightweight civilian sedans share wheels and glass; no extra shadow passes.
  const tire=new THREE.MeshStandardMaterial({color:0x191b1d,roughness:.95});
  const glass=new THREE.MeshStandardMaterial({color:0x344b5d,roughness:.3,metalness:.4});
  const wheelGeometry=new THREE.CylinderGeometry(.32,.32,.2,12);
  L._streetCars=[];
  for(let i=0;i<6;i++){
    const speed=i%2?-5.5:6.5;
    const car=new THREE.Group();car.name='Passing city car';car.position.set(-95+i*35,0,i%2?41.8:36.2);car.rotation.y=speed>0?Math.PI/2:-Math.PI/2;
    L.level.add(car);
    const paint=L._std([0x8d3934,0xbfc5c8,0x3c596e,0xafa080,0x45464c,0x627762][i],.45,.25);
    L._box(car,1.7,.52,3.9,paint,0,.65,0);
    L._box(car,1.5,.58,1.9,glass,0,1.16,-.15);
    L._box(car,1.55,.08,1.95,paint,0,1.49,-.15);
    for(const x of [-.6,.6]){
      L._box(car,.35,.16,.06,new THREE.MeshBasicMaterial({color:0xffedbf}),x,.72,1.98);
      L._box(car,.3,.14,.06,new THREE.MeshBasicMaterial({color:0x9e3026}),x,.72,-1.98);
    }
    const wheels=[];
    for(const x of [-.84,.84])for(const z of [-1.2,1.2]){
      const wheel=new THREE.Mesh(wheelGeometry,tire);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.32,z);car.add(wheel);wheels.push(wheel);
    }
    car.traverse(o=>{if(o.isMesh){o.castShadow=false;o.userData.noShadow=true;}});
    L._streetCars.push({mesh:car,speed,wheels});
  }
}
