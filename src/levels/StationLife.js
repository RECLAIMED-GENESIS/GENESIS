// Level 2 corridors, attached precinct wings and observable officer routines.
import * as THREE from 'three';

export function buildStationLayout(L) {
  const box=(w,h,d,m,x,y,z)=>L._box(L.level,w,h,d,m,x,y,z);
  // Keep the passage open across both room approaches.
  L._stationSign('← FORENSICS     CAPTAIN →',0,2.4,7.34,3.7,0,'COMPLETE LAB REPORTS BEFORE VISITING THE CAPTAIN');

  // Only the passage, the lab and the captain's office remain active.
  L._workDeskSpots = [];
  L._stationWorkers = [];
  L._extraCeilingFixtures = [[6,9]];
  const light = new THREE.PointLight(0xe4edf4,22,13,1.7);
  light.position.set(6,3.05,9); L.level.add(light);
  const fixture = box(2,.06,.2,new THREE.MeshBasicMaterial({color:0xf0f4ed}),6,3.3,9);
  (L._ceilingFallbacks ||= []).push(fixture);

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
