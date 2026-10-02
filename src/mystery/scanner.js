// scanner.js
// The Bureau scanner. Toggle with Q. While it is on, every uncollected
// clue inside range and in view is wrapped in a fresnel glow shell and the
// nearest one becomes the examine target for the E key.

import * as THREE from 'three';
import { mystery } from './mystery.js';
import { makeScanMaterial } from '../shaders/scanHighlight.js';

const SCAN_COLOR = 0x7ff5e0;

export class Scanner {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.active = false;
    this.range = 7;
    this.target = null; // clue id nearest to the crosshair
    this._shells = [];  // { id, source, mesh, material }
    this._pos = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  toggle() {
    this.active = !this.active;
    if (!this.active) this.target = null;
    return this.active;
  }

  // Drop every shell. Called on level dispose and after each collection.
  clear() {
    for (const s of this._shells) {
      if (s.mesh.parent) s.mesh.parent.remove(s.mesh);
      s.material.dispose();
    }
    this._shells = [];
    this.target = null;
  }

  // Rebuild shells for the currently registered, uncollected clues.
  sync() {
    this.clear();
    for (const [id, entry] of mystery.entries) {
      if (mystery.hasClue(id) || !entry.object) continue;
      entry.object.traverse((node) => {
        if (!node.isMesh || !node.geometry) return;
        if (node.userData && node.userData.hitbox) return;
        const material = makeScanMaterial(SCAN_COLOR);
        const mesh = new THREE.Mesh(node.geometry, material);
        mesh.matrixAutoUpdate = false;
        mesh.visible = false;
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        this._shells.push({ id, source: node, mesh, material });
      });
    }
  }

  update(dt, t) {
    if (!this.active) return;
    this.camera.getWorldDirection(this._dir);
    let best = null;
    let bestDist = Infinity;
    for (const s of this._shells) {
      let show = false;
      s.source.updateWorldMatrix(true, false);
      s.mesh.matrix.copy(s.source.matrixWorld);
      this._pos.setFromMatrixPosition(s.source.matrixWorld);
      const dist = this._pos.distanceTo(this.camera.position);
      if (dist < this.range) {
        this._pos.sub(this.camera.position).normalize();
        if (this._pos.dot(this._dir) > 0.45) show = true;
      }
      s.mesh.visible = show;
      s.material.uniforms.uTime.value = t;
      if (show && dist < bestDist) { bestDist = dist; best = s.id; }
    }
    this.target = best;
  }
}

