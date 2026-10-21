import * as THREE from 'three';

// Exploration camera. Levels still examine evidence from the detective's eyes;
// the trailing view lies on that same sightline, preserving aim and reach.
export class PlayerCamera {
  constructor(scene, camera) {
    this.camera = camera;
    this.mode = 'first';
    this.eye = new THREE.Vector3(); this.direction = new THREE.Vector3();
    this.back = new THREE.Vector3(); this.hit = new THREE.Vector3();
    this.box = new THREE.Box3(); this.ray = new THREE.Ray();
    this.avatar = new THREE.Group(); this.avatar.name = 'DetectiveAvatar';
    const coat = new THREE.MeshStandardMaterial({ color: 0x6c604e, roughness: 0.95 });
    const trousers = new THREE.MeshStandardMaterial({ color: 0x242c35, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x815a42, roughness: 0.85 });
    const box = (w,h,d,material,x,y,z,parent=this.avatar) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
      mesh.position.set(x,y,z); mesh.castShadow = true; parent.add(mesh); return mesh;
    };
    box(.48,.58,.28,coat,0,1.02,0);
    box(.52,.25,.3,coat,0,.72,0);
    box(.49,.055,.29,trousers,0,.85,0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.13,16,12),skin);
    head.position.y=1.46; this.avatar.add(head);
    box(.3,.065,.29,trousers,0,1.57,0);
    box(.12,.035,.12,new THREE.MeshStandardMaterial({color:0xc3a96b,metalness:.5,roughness:.45}),-.13,1.15,-.15);
    this.limbs=[];
    for(const side of [-1,1]) {
      const leg=new THREE.Group();leg.position.set(side*.14,.67,0);this.avatar.add(leg);
      box(.17,.55,.2,trousers,0,-.27,0,leg);box(.19,.12,.32,trousers,0,-.61,-.05,leg);
      const arm=new THREE.Group();arm.position.set(side*.31,1.25,0);this.avatar.add(arm);
      box(.14,.45,.18,coat,0,-.2,0,arm);box(.12,.14,.14,skin,0,-.48,0,arm);
      this.limbs.push({leg,arm,side});
    }
    this.avatar.visible=false; scene.add(this.avatar);
  }

  setMode(mode) { this.mode = mode === 'third' ? 'third' : 'first'; }

  prepare(player) {
    this.avatar.visible=false;
    this.eye.set(player.pos.x,player.pos.y+(player.EYE || 1.7),player.pos.z);
    this.camera.position.copy(this.eye);
    this.camera.rotation.order='YXZ';
    this.camera.rotation.set(player.pitch,player.yaw,0);
  }

  present(player, level, time, blocked = false) {
    this.avatar.visible=false;
    if(this.mode !== 'third' || blocked || level?.photoCam?.up || level?.ride?.active) return;
    this.eye.set(player.pos.x,player.pos.y+(player.EYE || 1.7),player.pos.z);
    // Leave cinematic cameras alone even when they do not capture the UI.
    if(this.camera.position.distanceToSquared(this.eye) > .01) return;
    this.eye.copy(this.camera.position);
    this.camera.getWorldDirection(this.direction);
    this.back.copy(this.direction).negate();this.ray.set(this.eye,this.back);
    let distance=3;
    for(const collider of level?.colliders || []) {
      this.box.copy(collider).expandByScalar(.22);
      if(this.box.containsPoint(this.eye)) {distance=0;break;}
      if(this.ray.intersectBox(this.box,this.hit)) distance=Math.min(distance,Math.max(0,this.eye.distanceTo(this.hit)-.05));
    }
    this.camera.position.copy(this.eye).addScaledVector(this.back,distance);
    this.avatar.position.copy(player.pos);this.avatar.rotation.y=player.yaw;
    // Hide the body when the camera is forced into it or aims steeply up.
    this.avatar.visible=distance > .8 && player.pitch < .65;
    const speed=player.vel ? Math.hypot(player.vel.x,player.vel.z) : 0;
    for(const {leg,arm,side} of this.limbs) {
      const swing=Math.sin(time*9)*Math.min(speed/5,1)*.4*side;
      leg.rotation.x=swing;arm.rotation.x=-swing;
    }
  }

  dispose() {
    this.avatar.removeFromParent();
    const materials=new Set();
    this.avatar.traverse(o=>{if(o.isMesh){o.geometry.dispose();materials.add(o.material);}});
    materials.forEach(m=>m.dispose());
  }
}
