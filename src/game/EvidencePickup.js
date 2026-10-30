import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { play as sfx } from '../audio/sfx.js';

const smooth = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// A visual collection sequence: reach with the selected tool, lift the actual
// exhibit, place it inside a transparent bag, then close the evidence seal.
export class EvidencePickup {
  constructor(parent, { reducedMotion = false } = {}) {
    this.parent = parent; this.reducedMotion = reducedMotion; this.active = false;
    this.root = new THREE.Group(); this.root.name = 'Evidence collection animation'; this.root.visible = false; parent.add(this.root);
    this.resources = [];
    const mat = (color, props = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .45, ...props }); this.resources.push(m); return m; };
    const film = mat(0xcce2df, { transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide });
    const steel = mat(0x9bafb5, { metalness: .75, roughness: .28 }), blue = mat(0x85b5ce), white = mat(0xe6e5d6);
    const box = (p, w, h, d, m, x = 0, y = 0, z = 0) => {
      const geometry = new RoundedBoxGeometry(w, h, d, 2, Math.min(.008, h / 4, d / 4)); this.resources.push(geometry);
      const mesh = new THREE.Mesh(geometry, m); mesh.position.set(x, y, z); p.add(mesh); return mesh;
    };
    this.bag = new THREE.Group(); this.bag.name = 'Transparent evidence bag'; this.root.add(this.bag);
    box(this.bag, .34, .43, .11, film);
    for (const x of [-.169, .169]) box(this.bag, .006, .43, .12, blue, x);
    box(this.bag, .34, .008, .12, blue, 0, -.215);
    box(this.bag, .23, .1, .002, white, 0, -.1, .058);
    for (let i = 0; i < 4; i++) box(this.bag, .16 - i * .018, .003, .002, steel, -.015, -.074 - i * .018, .06);
    this.seal = box(this.bag, .34, .018, .12, mat(0xba7653), 0, .218); this.seal.scale.x = .01;
    this.tool = new THREE.Group(); this.root.add(this.tool);
    this.tweezers = new THREE.Group(); this.tool.add(this.tweezers);
    this.jaws = [-1, 1].map(side => {
      const jaw = box(this.tweezers, .012, .23, .018, steel, side * .025, .1);
      jaw.rotation.z = side * -.11; return jaw;
    });
    this.swab = new THREE.Group(); this.tool.add(this.swab);
    box(this.swab, .012, .3, .012, blue, 0, .14);
    this.tip = box(this.swab, .026, .055, .026, white, 0, -.025);
    this.tip.material = white.clone(); this.resources.push(this.tip.material);
    this.origin = new THREE.Vector3(); this.hand = new THREE.Vector3(); this.pack = new THREE.Vector3();
    this.startQ = new THREE.Quaternion(); this.targetQ = new THREE.Quaternion();
  }
  begin(clue, tool) {
    if (this.active || !clue?.group || tool === 'camera') return false;
    this.clue = clue; this.kind = tool; this.active = true; this.time = 0; this.lifted = false; this.sealed = false;
    const original = clue.group; original.updateWorldMatrix(true, true);
    this.exhibit = original.clone(true);
    original.matrixWorld.decompose(this.exhibit.position, this.exhibit.quaternion, this.exhibit.scale);
    this.exhibit.visible = true; this.exhibit.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.exhibit);
    bounds.getCenter(this.origin);
    const holder = new THREE.Group(); holder.name = `Collected exhibit: ${clue.id}`;
    holder.add(this.exhibit); this.exhibit.position.sub(this.origin); this.exhibit.updateMatrixWorld(true);
    this.sample = holder; holder.position.copy(this.origin); holder.visible = false; this.root.add(holder);
    const size = bounds.getSize(new THREE.Vector3());
    // Big cloth exhibits fold to fit the bag; phones retain their actual shape.
    this.packScale = Math.min(1, .27 / Math.max(size.x, size.y, size.z, .001));
    this.tweezers.visible = tool === 'tweezers'; this.swab.visible = tool === 'swab';
    this.seal.scale.x = .01; this.tip.material.color.setHex(0xe6e5d6);
    this.root.visible = true;
    return true;
  }
  lift() {
    if (this.lifted) return;
    this.lifted = true; this.clue.onCollect?.(); this.sample.visible = true; sfx('pickup');
  }
  update(dt, player, camera, view) {
    if (!this.active || !player?.pos || !camera) return;
    this.time += dt / (this.reducedMotion ? .4 : 2.6);
    const t = Math.min(1, this.time), yaw = player.yaw || 0;
    if (view?.isThird() && view.getCarryAnchor?.(this.hand)) {
      this.pack.set(.5, 1.15, -.35).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(player.pos);
    } else {
      this.hand.set(.25, -.24, -.48).applyQuaternion(camera.quaternion).add(camera.position);
      this.pack.set(-.08, -.28, -.62).applyQuaternion(camera.quaternion).add(camera.position);
    }
    this.root.visible = true;
    this.bag.position.copy(this.pack); this.bag.rotation.y = yaw;
    this.bag.scale.setScalar(.75 + .25 * smooth(t / .15));
    if (t < .3) {
      this.tool.position.lerpVectors(this.hand, this.origin, smooth(t / .3));
      this.tool.position.y += .08 * Math.sin(t / .3 * Math.PI);
    } else {
      this.lift();
      this.sample.position.lerpVectors(this.origin, this.pack, smooth((t - .3) / .43));
      this.sample.position.y += .17 * Math.sin(Math.min(1, (t - .3) / .43) * Math.PI);
      this.sample.scale.setScalar(THREE.MathUtils.lerp(1, this.packScale, smooth((t - .5) / .22)));
      this.tool.position.copy(this.sample.position);
      if (this.kind === 'swab') this.tip.material.color.setHex(0x793c36);
    }
    this.targetQ.setFromEuler(new THREE.Euler(Math.PI / 2, yaw, 0, 'YXZ'));
    this.sample.quaternion.slerpQuaternions(this.startQ, this.targetQ, smooth((t - .4) / .32));
    if (!this.reducedMotion && t > .3 && t < .72) this.sample.rotateY(Math.PI * 2 * smooth((t - .3) / .42));
    this.tool.rotation.set(-.45, yaw, 0);
    if (t > .76 && !this.sealed) { this.sealed = true; sfx('bagSeal'); }
    for (const [i, jaw] of this.jaws.entries()) jaw.position.x = (i ? 1 : -1) * THREE.MathUtils.lerp(.025, .007, smooth((t - .2) / .1));
    if (t > .72) {
      this.tool.position.lerpVectors(this.pack, this.hand, smooth((t - .72) / .12));
      this.seal.scale.x = Math.max(.01, smooth((t - .76) / .1));
      this.sample.position.copy(this.bag.position);
    }
    if (t > .88) {
      const drop = smooth((t - .88) / .12) * .5;
      this.bag.position.y -= drop; this.sample.position.y -= drop;
    }
    if (t >= 1) this.finish();
  }
  finish() {
    if (!this.active) return;
    this.lift(); this.sample.removeFromParent(); this.sample = this.exhibit = this.clue = null;
    this.active = false; this.root.visible = false;
  }
  dispose() { this.finish(); this.root.removeFromParent(); this.resources.forEach(resource => resource.dispose()); }
}
