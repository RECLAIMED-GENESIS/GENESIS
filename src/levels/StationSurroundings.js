// Interior evidence transport cases and labels.
import * as THREE from 'three';

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
    const lid=new THREE.Group();lid.position.set(0,.04,-.45);lid.rotation.x=-2.85;c.add(lid);
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
