// Optional lab window: one procedural rainy-day pane, two pleated curtains,
// and a pull cord. No exterior models, image downloads or cloth simulation.
import * as THREE from 'three';
import { Howler } from 'howler';

export const LAB_WINDOW = { x: -2, width: 8.4, sill: 1.35, top: 3.05 };

export function buildLabWindow(L, wallMat, W = 20, D = 14, H = 3.4) {
  const { x, width, sill, top } = LAB_WINDOW;
  const z = -D / 2 - .15, left = x - width / 2, right = x + width / 2;
  const height = top - sill, middle = (sill + top) / 2;
  const box = (w,h,d,mat,bx,by,bz) => L._box(L.level,w,h,d,mat,bx,by,bz);
  const edge = W / 2 + .3;
  box(left + edge,H,.3,wallMat,(left-edge)/2,H/2,z);
  box(edge-right,H,.3,wallMat,(right+edge)/2,H/2,z);
  box(width,sill,.3,wallMat,x,sill/2,z);
  box(width,H-top,.3,wallMat,x,(H+top)/2,z);
  L.colliders.push(new THREE.Box3(new THREE.Vector3(-edge,0,z-.15),new THREE.Vector3(edge,H,z+.15)));

  const rain = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv;
      void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      float hash(float n){return fract(sin(n*127.1)*43758.5453);}
      void main(){
        // Pale overcast sky above a soft, abstract garden silhouette.
        float cloud=sin(vUv.x*13.0+uTime*.025)*sin(vUv.y*9.0)+sin(vUv.x*29.0-vUv.y*8.0)*.25;
        vec3 col=mix(vec3(.39,.48,.50),vec3(.72,.79,.82),smoothstep(.0,.8,vUv.y));
        col+=cloud*.025;
        float hedge=.16+sin(vUv.x*23.0)*.025+sin(vUv.x*57.0)*.012;
        col=mix(vec3(.22,.32,.30),col,smoothstep(hedge-.035,hedge+.035,vUv.y));
        // Two inexpensive layers of descending beads and their wet trails.
        for(int layer=0;layer<2;layer++){
          float scale=layer==0?1.0:1.7;
          vec2 p=vUv*vec2(65.0,9.0)*scale;
          float lane=floor(p.x), seed=hash(lane+float(layer)*71.0);
          float cy=fract(p.y+uTime*(.6+seed*.7)+seed*11.0);
          float dx=fract(p.x)-(.25+seed*.5+sin(cy*5.0+seed*6.0)*.035);
          float bead=1.0-smoothstep(.12,.30,length(vec2(dx*3.0,(cy-.22)*1.7)));
          float trail=(1.0-smoothstep(.012,.055,abs(dx)))*smoothstep(.22,.3,cy)*(1.0-smoothstep(.6,.95,cy));
          col+=vec3(.14,.18,.20)*bead+vec3(.12)*trail;
          col-=vec3(.07)*(1.0-smoothstep(.015,.06,abs(dx+.045)))*bead;
        }
        gl_FragColor=vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(width,height),rain);
  pane.name='Rain on the lab window'; pane.position.set(x,middle,z-.02);
  pane.userData.noShadow=true; L.level.add(pane);
  const frame=L._std(0x34434a,.6,.3);
  box(width+.16,.08,.18,frame,x,top,z+.06);
  box(width+.3,.06,.4,L._std(0xd0d5d0),x,sill,z+.16);
  for(const bx of [left,right])box(.08,height,.18,frame,bx,middle,z+.06);
  for(const dx of [-2.1,0,2.1])box(.045,height,.12,frame,x+dx,middle,z+.06);

  const cloth=new THREE.MeshStandardMaterial({color:0x526b73,roughness:1,side:THREE.DoubleSide});
  const curtains=[];
  for(const side of [-1,1]){
    const geometry=new THREE.PlaneGeometry(width/2+.04,height+.15,64,1);
    const positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      const px=positions.getX(i);
      positions.setZ(i,Math.sin((px+width/4)*Math.PI*6)*.055);
    }
    geometry.computeVertexNormals();
    const curtain=new THREE.Mesh(geometry,cloth);
    curtain.position.set(x+side*width/4,middle,z+.28);
    curtain.name=side<0?'Left curtain':'Right curtain';
    L.level.add(curtain);curtains.push(curtain);
  }
  box(width+.65,.06,.08,frame,x,top+.12,z+.28);
  // Cord on the clear side of the window, away from the preparation counter.
  const cordX=right+.25,cordZ=z+.42;
  const cord=new THREE.Group();cord.position.set(cordX,0,cordZ);L.level.add(cord);
  L._box(cord,.024,1.2,.024,L._std(0xd9cfac),0,2.45,0);
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.075,.018,6,16),L._std(0xb49961,.5,.3));
  handle.position.y=1.82;cord.add(handle);
  L._hit(cordX,1.95,cordZ,.38,.65,.35,{kind:'windowCurtains'});
  L._stationSign('PULL CORD',cordX,1.48,cordZ,.8,0,'E  /  CURTAINS');
  L._labWindow={open:false,amount:0,time:0,curtains,cord,pane,rain,audio:null};
}

export function toggleLabCurtains(L) {
  const w=L._labWindow;if(!w)return;
  w.open=!w.open;
  // Generate a quiet filtered rain bed on first interaction, through the
  // game's master gain so global volume and mute still apply.
  const ctx=Howler.ctx;
  if(!w.audio && ctx && Howler.masterGain){
    const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1300;
    const gain=ctx.createGain();gain.gain.value=0;
    source.connect(filter);filter.connect(gain);gain.connect(Howler.masterGain);source.start();
    const timer=setInterval(()=>{
      const paused=window.__paused||window.__loading||document.hidden;
      gain.gain.setTargetAtTime(paused?0:(.012+w.amount*.025)*(w.nearby??1),ctx.currentTime,.15);
    },100);
    w.audio={source,filter,gain,timer};
  }
}

export function updateLabWindow(L,dt,player) {
  const w=L._labWindow;if(!w)return;
  w.time+=dt;
  w.amount=THREE.MathUtils.damp(w.amount,w.open?1:0,4,dt);
  const panelWidth=(LAB_WINDOW.width/2+.04)*(1-w.amount*.85);
  w.curtains.forEach((curtain,i)=>{
    curtain.scale.x=1-w.amount*.85;
    curtain.position.x=LAB_WINDOW.x+(i===0?-1:1)*(LAB_WINDOW.width/2-panelWidth/2);
  });
  w.cord.position.y=-Math.sin(w.amount*Math.PI)*.12;
  w.pane.visible=w.amount>.005;
  w.rain.uniforms.uTime.value=w.time;
  if(L._windowDaylight)L._windowDaylight.intensity=3*(.08+.92*w.amount)*(L.docs.lightsOff ? .06 : 1);
  if(player)w.nearby=THREE.MathUtils.clamp(1-Math.hypot(player.pos.x-LAB_WINDOW.x,player.pos.z+7)/18,0,1);
}

export function disposeLabWindow(L) {
  const audio=L._labWindow?.audio;
  if(audio){clearInterval(audio.timer);audio.source.stop();audio.source.disconnect();audio.filter.disconnect();audio.gain.disconnect();}
  L._labWindow=null; // Meshes and materials belong to the level's normal disposer.
}
