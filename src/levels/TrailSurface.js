import * as THREE from 'three';

// A close-up reconstruction of the recorded surface, not a new crime-scene photo.
// Pigmented stains stay dark; the examination light reveals texture and edges.
export function buildTrailSurface(view) {
  let seed=4917;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=1024;
  const g=canvas.getContext('2d'),pixels=g.createImageData(canvas.width,canvas.height);
  for(let y=0;y<1024;y++)for(let x=0;x<1536;x++) {
    const i=(y*1536+x)*4, grain=random()*15, shade=105+grain+Math.sin(x*.004+y*.006)*5;
    pixels.data[i]=shade;pixels.data[i+1]=shade+3;pixels.data[i+2]=shade+1;pixels.data[i+3]=255;
  }
  g.putImageData(pixels,0,0);
  // Worn floor joints and shallow scuffs give the surface its real-world scale.
  for(const x of [440,1000]){g.fillStyle='#3f4846';g.fillRect(x,0,3,1024);g.fillStyle='#a2aaa155';g.fillRect(x+3,0,2,1024);}
  g.fillStyle='#424b48';g.fillRect(0,600,1536,3);
  for(let i=0;i<240;i++) {
    const x=random()*1536,y=random()*1024;g.strokeStyle=`rgba(220,225,216,${random()*.07})`;
    g.lineWidth=.4+random();g.beginPath();g.moveTo(x,y);g.lineTo(x+8+random()*90,y-3-random()*8);g.stroke();
  }
  // Uneven deposits, feathered wiping and fine streaks; no repeated glowing dots.
  for(let i=0;i<1250;i++) {
    const t=random(),x=230+t*1060,y=410+Math.sin(t*2.4)*150;
    const spread=(1-t)*35+12,dx=(random()-.5)*65,dy=(random()-.5)*spread*2;
    g.fillStyle=`rgba(49,20,18,${.025+random()*.09})`;
    g.beginPath();g.ellipse(x+dx,y+dy,2+random()*24,1+random()*6,.12,0,Math.PI*2);g.fill();
  }
  for(let i=0;i<110;i++) {
    const y=400+random()*70;g.strokeStyle=`rgba(63,28,22,${.04+random()*.13})`;g.lineWidth=.5+random()*2;
    g.beginPath();g.moveTo(250+random()*60,y);g.bezierCurveTo(520,y+70,850,y+150,1240+random()*80,y+105);g.stroke();
  }
  for(let i=0;i<60;i++) {
    const x=190+random()*1130,y=380+random()*220;
    g.fillStyle=`rgba(49,20,18,${.12+random()*.22})`;g.beginPath();g.ellipse(x,y,1+random()*3,1+random()*2,random()*3,0,Math.PI*2);g.fill();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  const floor=view.mesh(new THREE.PlaneGeometry(4.8,3.2),view.material(0xffffff,{map,roughness:.82,bumpMap:map,bumpScale:.006}),[0,0,0]);floor.rotation.x=-Math.PI/2;
  // Edge of the guest chair and the exit threshold retain route context.
  const steel=view.material(0x747c78,{metalness:.6,roughness:.45});
  for(const x of [-1.7,-1.3])view.mesh(new THREE.CylinderGeometry(.022,.025,.65,12),steel,[x,.325,-1.4]);
  view.mesh(new THREE.BoxGeometry(.06,.018,2.4),steel,[2.2,.01,.12]);
  const ruler=document.createElement('canvas');ruler.width=512;ruler.height=64;const r=ruler.getContext('2d');
  r.fillStyle='#e3dfce';r.fillRect(0,0,512,64);r.fillStyle='#263131';r.font='18px monospace';
  for(let i=0;i<50;i++){r.fillRect(8+i*10,0,1,i%5?12:23);if(i%5===0)r.fillText(String(i/5),8+i*10,46);}
  const rulerMap=new THREE.CanvasTexture(ruler);rulerMap.colorSpace=THREE.SRGBColorSpace;
  const scale=view.mesh(new THREE.PlaneGeometry(.75,.094),view.material(0xffffff,{map:rulerMap,roughness:.8}),[-.85,.008,.8]);scale.rotation.x=-Math.PI/2;
  view.camera.position.set(0,2.6,1.4);view.camera.lookAt(0,0,0);
  view.plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.025);
  view.anchors=[new THREE.Vector3(-1.5,.025,-.3),new THREE.Vector3(0,.025,.15),new THREE.Vector3(1.55,.025,.3)];
  view.beamPoint.copy(view.anchors[0]);
  view.scene.traverse(o=>{if(o.isHemisphereLight)o.intensity=.55;if(o.isDirectionalLight)o.intensity=.3;});
}
