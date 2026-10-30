import * as THREE from 'three';
import { play as sfx } from '../audio/sfx.js';
const ease = t => { t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t); };

// Floating specimen transfers share source resources, never consume them early.
export class LabHandling {
  constructor(level) {
    this.level=level;this.active=false;this.root=new THREE.Group();this.root.name='Floating laboratory specimens';
    level.level.add(this.root);this.root.visible=false;
    this.from=new THREE.Vector3();this.to=new THREE.Vector3();this.startQ=new THREE.Quaternion();
    this.reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  }
  begin({source,destination,complete}) {
    if(this.active || !source)return false;
    this.active=true;this.time=0;this.complete=complete;this.source=source;
    this.root.visible=true;this.wasVisible=source.visible;this.lifted=false;
    source.updateWorldMatrix(true,true);source.getWorldPosition(this.from);
    this.sample=source.clone(true);source.matrixWorld.decompose(this.sample.position,this.sample.quaternion,this.sample.scale);
    this.startQ.copy(this.sample.quaternion);this.sample.visible=false;this.root.add(this.sample);this.to.copy(destination);
    return true;
  }
  update(dt) {
    if(!this.active)return;
    this.time+=dt;const t=Math.min(1,this.time/(this.reducedMotion ? .45 : 1.5));
    if(t>=.15) {
      if(!this.lifted){this.lifted=true;sfx('pickup');}
      this.source.visible=false;this.sample.visible=true;
      const travel=ease((t-.15)/.7);
      this.sample.position.lerpVectors(this.from,this.to,travel);
      this.sample.position.y+=Math.sin(travel*Math.PI)*(this.reducedMotion ? .03 : .23);
      this.sample.quaternion.copy(this.startQ);
      if(!this.reducedMotion)this.sample.rotateY(Math.PI*2*travel);
    }
    if(t>=1)this.finish();
  }
  finish(cancel=false) {
    if(!this.active)return;
    this.active=false;this.root.visible=false;this.sample?.removeFromParent();this.sample=null;
    this.source.visible=this.wasVisible;
    const complete=this.complete;this.complete=null;this.source=null;
    if(!cancel){sfx('glassPlace');complete?.();}
  }
  dispose(){this.finish(true);this.root.removeFromParent();}
}
