import * as THREE from 'three';
import { play as sfx } from '../audio/sfx.js';

const UP = new THREE.Vector3(0, 0, 1);

// The display copies share the real props' geometry/materials. Source meshes
// remain the authoritative bench objects and own those resources on disposal.
export class LabCarry {
  constructor(level) {
    this.level = level;
    this.root = new THREE.Group(); this.root.name = 'Carried laboratory equipment'; level.level.add(this.root);
    this.items = {};
    for (const [id, source] of [['phone', level._phoneProp], ['uvwand', level._wandProp]]) {
      if (!source) continue;
      const mesh = source.clone(true); mesh.name = `Carried ${id}`; mesh.visible = false;
      mesh.position.set(0, 0, 0); mesh.quaternion.identity(); this.root.add(mesh); this.items[id] = mesh;
    }
    this.id = null; this.phase = 'idle'; this.time = 0; this.elapsed = 0;
    this.from = new THREE.Vector3(); this.target = new THREE.Vector3(); this.forward = new THREE.Vector3();
    this.fromQ = new THREE.Quaternion(); this.toQ = new THREE.Quaternion(); this.euler = new THREE.Euler();
    this.ray = new THREE.Ray(); this.hit = new THREE.Vector3(); this.normal = new THREE.Vector3();
    this.floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.012);
    this.flourish = 0; this.reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  }
  origin(id, out) {
    const L = this.level;
    if (id === 'phone' && L.cyber.staged === 'faraday') return out.set(-5.9, 1.24, 1.8);
    return (id === 'phone' ? L._phoneProp : L._wandProp).getWorldPosition(out);
  }
  spin() {
    if (this.phase !== 'held' || this.flourish < 1 || this.reducedMotion) return;
    this.flourish = 0; sfx('pickup');
  }
  destination(id, out) {
    const L = this.level;
    if (id === 'uvwand') return L._wandProp.getWorldPosition(out);
    if (L.cyber.staged === 'cradle') return L._phoneCradleProp.getWorldPosition(out);
    return out.set(-5.9, 1.12, 1.8);
  }
  update(dt, player, camera, view) {
    if (!player?.pos || !camera) return;
    const L = this.level, wanted = L.carried?.id || null;
    this.elapsed += dt;
    if (wanted !== this.id && wanted && this.items[wanted]) {
      if (this.id) this.items[this.id].visible = false;
      this.id = wanted; this.phase = 'pickup'; this.time = 0; this.flourish = 0; sfx('pickup');
      this.origin(wanted, this.from); this.items[wanted].position.copy(this.from);
      this.fromQ.identity(); this.items[wanted].quaternion.identity();
    } else if (!wanted && this.id && this.phase !== 'place') {
      this.phase = 'place'; this.time = 0;
      this.from.copy(this.items[this.id].position); this.fromQ.copy(this.items[this.id].quaternion);
    }
    const mesh = this.items[this.id];
    if (mesh) {
      const busy = L._uiBusy() || !!L._captainTalking;
      mesh.visible = !busy;
      this.time = Math.min(1, this.time + dt / .44);
      const eased = this.time * this.time * (3 - 2 * this.time);
      const third = view?.isThird() && !busy;
      this.forward.set(-Math.sin(player.yaw || 0), 0, -Math.cos(player.yaw || 0));
      if (this.phase === 'place') {
        this.destination(this.id, this.target); this.toQ.identity();
        if (this.id === 'uvwand') L._wandProp.visible = false;
        else if (L.cyber.staged === 'cradle') L._phoneCradleProp.visible = false;
      } else {
        if (third && view.getCarryAnchor?.(this.target)) this.target.addScaledVector(this.forward, .07);
        else if (third) this.target.set(.32, 1.18, -.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw || 0).add(player.pos);
        else this.target.set(.23, -.26, -.48).applyQuaternion(camera.quaternion).add(camera.position);
        this.target.y += Math.sin(this.elapsed * 2.8) * .008;
        this.euler.set(this.id === 'phone' ? .85 : 0, (player.yaw || 0) + (this.id === 'uvwand' ? Math.PI / 2 : 0), 0, 'YXZ');
        this.toQ.setFromEuler(this.euler);
      }
      mesh.position.lerpVectors(this.from, this.target, this.phase === 'held' ? 1 : eased);
      if (this.phase !== 'held') mesh.position.y += Math.sin(this.time * Math.PI) * .16;
      mesh.quaternion.slerpQuaternions(this.fromQ, this.toQ, this.phase === 'held' ? 1 : eased);
      if (this.phase !== 'place') {
        this.flourish = Math.min(1, this.flourish + dt / .95);
        const spin = this.flourish * this.flourish * (3 - 2 * this.flourish);
        if (!this.reducedMotion && this.flourish < 1) mesh.rotateY(Math.PI * 2 * spin);
        if (!this.reducedMotion && this.phase === 'held') mesh.rotateZ(Math.sin(this.elapsed * 1.6) * .045);
      }
      if (this.time >= 1 && this.phase === 'pickup') this.phase = 'held';
      if (this.time >= 1 && this.phase === 'place') {
        mesh.visible = false;
        if (this.id === 'uvwand') L._wandProp.visible = true;
        else if (L.cyber.staged === 'cradle') L._phoneCradleProp.visible = true;
        sfx('setDown'); this.id = null; this.phase = 'idle';
      }
    }
    if (L._faradayLid) {
      const handling = this.id === 'phone' && L.cyber.staged === 'faraday' && (this.phase === 'pickup' || this.phase === 'place');
      L._faradayLid.rotation.x = THREE.MathUtils.damp(L._faradayLid.rotation.x, handling ? -1.8 : 0, 12, dt);
    }
    this.updateBeam(player, camera);
  }
  updateBeam(player, camera) {
    const L = this.level;
    const active = this.id === 'uvwand' && L.carried?.id === 'uvwand' && L.docs.lightsOff && !L._uiBusy() && !L._captainTalking;
    if (active && !this.beamWasActive) sfx('uvPower');
    this.beamWasActive = active;
    L._beam.intensity = active ? 6 : 0;
    L._beamPool.visible = active;
    if (!active) return;
    const eye = this.fromEye ||= new THREE.Vector3(); eye.copy(player.pos); eye.y += 1.7;
    this.forward.set(0, 0, -1).applyEuler(this.euler.set(player.pitch || 0, player.yaw || 0, 0, 'YXZ'));
    this.ray.set(eye, this.forward);
    this.target.copy(eye).addScaledVector(this.forward, 6);
    let distance = 6; this.normal.set(0, 1, 0); let surface = false;
    if (this.ray.intersectPlane(this.floor, this.hit)) {
      const d = eye.distanceTo(this.hit);
      if (d < distance) { distance = d; this.target.copy(this.hit); surface = true; }
    }
    for (const bounds of L.colliders) {
      if (bounds.containsPoint(eye) || !this.ray.intersectBox(bounds, this.hit)) continue;
      const d = eye.distanceTo(this.hit); if (d >= distance) continue;
      distance = d; this.target.copy(this.hit); surface = true;
      this.normal.set(0, 0, 0);
      let closest = Infinity;
      for (const axis of ['x', 'y', 'z']) for (const [edge, sign] of [['min', -1], ['max', 1]]) {
        const gap = Math.abs(this.hit[axis] - bounds[edge][axis]);
        if (gap < closest) { closest = gap; this.normal.set(0, 0, 0); this.normal[axis] = sign; }
      }
    }
    L._beam.position.copy(this.items.uvwand.position);
    L._beam.target.position.copy(this.target);
    L._beamPool.visible = surface;
    L._beamPool.position.copy(this.target).addScaledVector(this.normal, .014);
    L._beamPool.quaternion.setFromUnitVectors(UP, this.normal);
    L._beamPool.scale.setScalar(Math.max(.7, distance * .8));
    L._beamPool.material.opacity = .12;
  }
  dispose() {
    this.level._beam.intensity = 0; this.level._beamPool.visible = false;
    this.root.removeFromParent();
  }
}
