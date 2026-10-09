// src/player/chestArtifact.js
// Iron-Man-style Axiom artifact embedded in a character's chest.
//
// Attaches a glowing reactor — dark housing disc, emissive cyan ring,
// white-hot octahedron core and a point light — to the rig's upper
// chest bone so it follows every animation. Sizing is configured in
// world metres and converted to bone units via the root's scale; the
// chest frame (up / side / front) is derived from the pose itself, so
// it works on any Mixamo rig regardless of bone-axis conventions.
//
// Used by the main menu scene today; the in-game avatar later.
import * as THREE from 'three';

function normalizeName(name) {
  return name.replace(/^mixamorig[:_]?/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

export function attachChestArtifact(root, opts = {}) {
  const {
    radius      = 0.095,   // reactor disc radius, world metres
    chestDepth  = 0.115,   // how deep the disc sits inside the chest, world metres
    chestHeight = 0.02,    // upward nudge from the bone origin
    lightRange  = 2.5,     // point-light falloff radius, metres
  } = opts;

  // ── Locate the bones we need (normalized Mixamo names) ──
  const bones = {};
  root.traverse((o) => {
    if (!o.isBone) return;
    const n = normalizeName(o.name);
    if (!bones[n]) bones[n] = o;
  });
  const chest = bones.spine2 || bones.spine1 || bones.spine || bones.chest;
  if (!chest) return null;

  const scale = Math.abs(root.scale.x) || 1;
  const u = 1 / scale;   // bone-space units per world metre

  // ── Chest frame in world space, from the current pose ──
  const v3 = (b) => b.getWorldPosition(new THREE.Vector3());
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3(1, 0, 0);
  if (bones.head && bones.hips) {
    up.copy(v3(bones.head)).sub(v3(bones.hips)).normalize();
  }
  if (bones.rightshoulder && bones.leftshoulder) {
    side.copy(v3(bones.rightshoulder)).sub(v3(bones.leftshoulder)).normalize();
  }
  // cross(up, side) points out of the chest for a +Z-facing rig
  const front = new THREE.Vector3().crossVectors(up, side).normalize();

  // Express that frame in the chest bone's local space, so offsets
  // are immune to how the rig's bone axes happen to be oriented.
  const qInv = chest.getWorldQuaternion(new THREE.Quaternion()).invert();
  const frontL = front.clone().applyQuaternion(qInv).normalize();
  const upL = up.clone().applyQuaternion(qInv).normalize();

  // ── Disc placement — embedded, not resting on the surface ──
  // Fixed depth from the chest bone so the reactor sits inside her
  // outfit like an arc reactor.
  const depth = chestDepth;

  // ── Reactor assembly — the group's local +Z is the face axis ──
  const group = new THREE.Group();
  group.name = 'chest-artifact';
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), frontL);
  group.position.copy(upL.multiplyScalar(chestHeight * u))
               .addScaledVector(frontL, depth * u);

  const r = radius * u;

  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x10161f, metalness: 0.9, roughness: 0.32,
  });
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x04222c, emissive: 0x00d9f2, emissiveIntensity: 2.0,
    metalness: 0.25, roughness: 0.4,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x0a2630, emissive: 0x9ff2ff, emissiveIntensity: 3.0,
  });

  const housing = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, r * 0.34, 28), housingMat);
  housing.rotation.x = Math.PI / 2;   // disc faces +Z
  group.add(housing);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r * 0.82, r * 0.13, 12, 36), ringMat);
  ring.position.z = r * 0.2;
  group.add(ring);

  const coreSpin = new THREE.Group();   // spun by the caller
  coreSpin.position.z = r * 0.26;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.44), coreMat);
  core.scale.z = 0.55;
  coreSpin.add(core);
  group.add(coreSpin);

  const light = new THREE.PointLight(0x77e6ff, 2.4, lightRange, 2);
  light.position.z = r * 0.6;
  group.add(light);

  chest.add(group);
  return { group, housing, ring, core, coreSpin, light, bone: chest };
}
