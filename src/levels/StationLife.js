// Level 2 corridors, attached precinct wings and observable officer routines.
import * as THREE from 'three';

export function buildStationLayout(L) {
  const plaster=L._stationMaterial('plaster'),brick=L._stationMaterial('brick'),trim=L._std(0x263a42,.7,.15);
  const box=(w,h,d,m,x,y,z)=>L._box(L.level,w,h,d,m,x,y,z);
  const floor=(w,d,x,z,y,material,ceiling=false)=> {
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),material);
    const uv=m.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/3,uv.getY(i)*d/3);
    m.rotation.x=ceiling?Math.PI/2:-Math.PI/2;m.position.set(x,y,z);L.level.add(m);
  };
  // Reception's back wall leaves a generous central entrance to the cross-corridor.
  L._stationWall(-5.65,14,8.7,.18,plaster);
  L._stationWall(5.65,14,8.7,.18,plaster);
  box(2.6,.45,.18,plaster,0,3.175,14);
  // Separate lab and office branches, leaving the full east/west aisle at z=12.
  L._stationWall(-2,9,.18,4,plaster);
  L._stationWall(2,9,.18,4,plaster);
  for(const x of [-2,2])box(.22,.1,4,trim,x,.85,9);
  L._stationSign('STAFF CORRIDOR',0,2.95,14.12,2.3,0,'FORENSICS  /  OPERATIONS  /  CAPTAIN');
  L._stationSign('← FORENSICS     CAPTAIN →',0,2.4,7.34,3.7,0,'OFFICERS’ WORKSPACE THROUGH THE LEFT WING');
  L._stationSign('OPERATIONS',-9.95,2.9,12,2.2,Math.PI/2,'WORKSTATIONS / DUTY OFFICERS');

  // A walkable west wing, physically joined to the existing corridor.
  floor(12,11,-16.2,12.5,0,L._stationMaterial('carpet'));
  floor(12,11,-16.2,12.5,3.4,plaster,true);
  L._stationWall(-22.35,12.5,.3,11.3,brick);
  L._stationWall(-16.2,7,12.6,.3,brick);
  // Solid front of the new wing replaces the old low forecourt wall.
  L._stationWall(-16.2,18,12.6,.3,brick);
  box(12.8,.18,11.6,trim,-16.2,3.52,12.5);
  // Upper office volumes and windows make the precinct read as joined buildings.
  for(const [x,z,w,d,h] of [[-16.2,12.5,12.6,11.3,4.3],[15.15,12,10.3,10.3,3.2]]) {
    box(w,h,d,brick,x,3.6+h/2,z);box(w+.3,.2,d+.3,trim,x,3.6+h+.1,z);
    for(let xx=-w/2+1.4;xx<w/2-1;xx+=2.6) {
      box(1.55,1.65,.08,trim,x+xx,5.5,z+d/2+.04);
      box(1.35,1.45,.09,new THREE.MeshStandardMaterial({color:0x4a6977,emissive:0x25404b,emissiveIntensity:.35,roughness:.4}),x+xx,5.5,z+d/2+.06);
    }
  }
  L._stationSign('OPERATIONS WING',-16.2,2.8,18.18,5,0,'CENTRAL DISTRICT / INVESTIGATIONS');
  // Ground floor office windows and plinth on the west wing's street frontage.
  for(const x of [-19.5,-15.5]) {
    box(2.8,1.4,.1,trim,x,1.7,18.19);
    box(2.6,1.2,.11,L._std(0x5e7d89,.4,.25),x,1.7,18.21);
  }
  L._stationSign('CENTRAL DISTRICT / DUTY BOARD',-16.2,2.2,7.18,5,0,'PATROL 01–04  /  RADIO CHECK  /  SHIFT HANDOVER');
  L._stationSign('PROTECT THE SCENE',-22.17,2,10,2.5,Math.PI/2,'SECURE  •  RECORD  •  PRESERVE');
  L._stationSign('SERVICE • INTEGRITY • RESPECT',-16.2,2.2,17.82,4,Math.PI,'CENTRAL POLICE STATION');
  // Framed district street plan, distinct from the case evidence boards.
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#dbd8c7';ctx.fillRect(0,0,640,480);
  ctx.fillStyle='#243c48';ctx.font='bold 30px sans-serif';ctx.fillText('CENTRAL DISTRICT / PATROL SECTORS',20,42);
  for(let row=0;row<4;row++)for(let col=0;col<6;col++){
    ctx.fillStyle=['#9aa99c','#c0b7a1','#a9b5bb'][(row+col)%3];ctx.fillRect(24+col*100,75+row*85,78,62);
  }
  ctx.strokeStyle='#588eaa';ctx.lineWidth=20;ctx.beginPath();ctx.moveTo(20,430);ctx.bezierCurveTo(180,300,390,410,620,220);ctx.stroke();
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  box(.08,2.2,3,trim,-22.16,2,15);
  const display=new THREE.Mesh(new THREE.PlaneGeometry(2.8,2.0),new THREE.MeshStandardMaterial({map,roughness:.9}));
  display.position.set(-22.1,2,15);display.rotation.y=Math.PI/2;L.level.add(display);
  L._workDeskSpots=[[-18.6,9],[-13.8,9],[-18.6,15],[-13.8,15]];
  L._stationWorkers=[];
  for(let i=0;i<4;i++) {
    const [x,z]=L._workDeskSpots[i];
    const officer=L._stationOfficer(x,z+1.1,'Duty officer '+(i+1),Math.PI);
    officer.position.y=-.35;
    L._stationWorkers.push({person:officer,task:['typing','writing','radio','talking','typing'][i],phase:i*1.7});
  }
  L._extraCeilingFixtures=[[-18,10],[-13,10],[-18,15],[-13,15],[6,9]];
  for(const [x,z] of [[-18,12],[-13,12],[6,9]]) {
    const light=new THREE.PointLight(0xe4edf4,22,13,1.7);light.position.set(x,3.05,z);L.level.add(light);
    const fixture=box(2,.06,.2,new THREE.MeshBasicMaterial({color:0xf0f4ed}),x,3.3,z);
    (L._ceilingFallbacks ||= []).push(fixture);
  }
  // Desk furniture loads later; reserve matching collision now for predictable routes.
  for(const [x,z] of L._workDeskSpots)L.colliders.push(new THREE.Box3(new THREE.Vector3(x-1.15,0,z-.65),new THREE.Vector3(x+1.15,1,z+.65)));

}

function pose(person,time,task) {
  const limbs=person.userData.limbs||[];
  for(const {arm,leg,knee,side} of limbs) {
    leg.rotation.x=task==='walking'?Math.sin(time*7)*.35*side:task==='working'?-Math.PI/2:0;
    if(knee)knee.rotation.x=task==='working'?Math.PI/2:0;
    arm.rotation.x=task==='walking'?-Math.sin(time*7)*.3*side:task==='working'?-1.05+Math.sin(time*5+side)*.07:task==='phone'&&side===1?-2.2:0;
    arm.rotation.z=task==='phone'&&side===1?-.15:0;
  }
}

export function updateStationLife(L,dt) {
  L._officerClock=(L._officerClock||0)+dt;
  if(L.captain){
    pose(L.captain,L._officerClock,'working');
    L.captain.userData.head.rotation.y=Math.sin(L._officerClock*.5)*.12;
  }
  for(const worker of L._stationWorkers) {
    const t=L._officerClock+worker.phase;pose(worker.person,t,'working');
    const limbs=worker.person.userData.limbs;
    if(worker.task==='radio')limbs[1].arm.rotation.x=-1.7-Math.sin(t*.7)*.25;
    if(worker.task==='talking')limbs[0].arm.rotation.x=-.55+Math.sin(t*1.5)*.3;
    if(worker.task==='writing')limbs[1].arm.rotation.x=-.9+Math.sin(t*3)*.12;
    worker.person.userData.head.rotation.y=Math.sin(t*.55)*.12;
  }
  for(const [i,officer] of (L._parkingOfficers||[]).entries()){
    pose(officer,L._officerClock,'standing');
    officer.userData.head.rotation.y=Math.sin(L._officerClock*.6+i)*.18;
    officer.userData.limbs[i%2].arm.rotation.x=-.4+Math.sin(L._officerClock*1.1+i)*.25;
  }
  for(const walker of L._streetWalkers||[]){
    walker.person.position.x+=walker.speed*dt;
    if(walker.person.position.x>105)walker.person.position.x=-105;
    if(walker.person.position.x< -105)walker.person.position.x=105;
    pose(walker.person,L._officerClock+walker.phase,'walking');
  }
  for(const car of L._streetCars||[]){
    car.mesh.position.x+=car.speed*dt;
    if(car.mesh.position.x>110)car.mesh.position.x=-110;
    if(car.mesh.position.x< -110)car.mesh.position.x=110;
    for(const wheel of car.wheels)wheel.rotation.x+=car.speed*dt/.32;
  }
}
