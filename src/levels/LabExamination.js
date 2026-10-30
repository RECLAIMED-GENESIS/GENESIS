import * as THREE from 'three';
import { buildTrailSurface } from './TrailSurface.js';
import { play as sfx } from '../audio/sfx.js';
import { ExaminationProgress } from '../game/examinationProgress.js';
import '../ui/labExamination.css';

const CONFIG = {
  glassscan: { title: 'UV examination', sub: 'Guest glass · sweep the beam across the rim and side', features: ['Rim', 'Fingerprint'], result: 'Partial lip and ridge detail. Insufficient for identification.' },
  trail: { title: 'Trace surface examination', sub: 'Scene exhibit 06 · close-up reconstruction of the recorded floor', features: ['Guest chair', 'Wiped trail', 'Exit'], result: 'The recorded smear runs from the guest chair toward the exit. Compare it with the DNA findings.' },
  casing: { title: 'Casing examination', sub: 'Scene exhibit 01 · rotate the casing and inspect its surfaces', features: ['Case wall', 'Primer', 'Rim'], result: '9 × 19 mm casing. Primer and ejection marks are recorded for comparison; these do not identify its owner.' },
};

export class LabExamination {
  constructor(level, mode) {
    this.level = level; this.mode = mode; this.config = CONFIG[mode]; this.active = null; this.time = 0;
    const recorded = mode === 'glassscan' ? level.trace.glassUV : mode === 'trail' ? level.docs.trailRead : level.docs.casingRead;
    level._examinationProgress ||= {};
    this.progress = level._examinationProgress[mode] ||= new ExaminationProgress(this.config.features, recorded);
    const panel = document.createElement('section'); panel.className = 'lab-examination';
    panel.innerHTML = `<header><div><span class="exam-kicker">FORENSIC SERVICES / EXAMINATION</span><h2>${this.config.title}</h2></div><span class="exam-status"></span></header><p>${this.config.sub}</p><div class="exam-viewport"></div><div class="exam-controls"></div><footer><span class="exam-instruction"></span><button class="exam-record">Record findings</button></footer><p class="exam-result" hidden></p>`;
    level.ui.deviceInner.replaceChildren(panel); this.panel = panel;
    this.viewport = panel.querySelector('.exam-viewport');
    this.status = panel.querySelector('.exam-status'); this.instruction = panel.querySelector('.exam-instruction');
    this.recordButton = panel.querySelector('.exam-record'); this.result = panel.querySelector('.exam-result');
    this.recordButton.addEventListener('click', () => this.record());
    this.buttons = this.config.features.map((id, i) => {
      const button = document.createElement('button'); button.textContent = id; button.dataset.feature = id;
      button.addEventListener('click', () => this.focus(i)); panel.querySelector('.exam-controls').append(button); return button;
    });
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.tabIndex = 0; this.renderer.domElement.setAttribute('aria-label', this.config.sub);
    this.viewport.append(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x101a22);
    this.camera = new THREE.PerspectiveCamera(38, 1.6, .05, 30); this.camera.position.set(0, .35, 3.8); this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0xdce9ed, 0x15222a, 2.2));
    const key = new THREE.DirectionalLight(0xfff1d8, 3); key.position.set(-2, 4, 3); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xb3dbe4, 2); fill.position.set(3, 1, -2); this.scene.add(fill);
    this.object = new THREE.Group(); this.scene.add(this.object);
    this.anchors = []; this.prints = [];
    this.beamPoint = new THREE.Vector3(0, 4, 0); this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -.68);
    this.targetRotation = new THREE.Quaternion(); this.dragging = false;
    if (mode === 'glassscan') this.buildGlass(); else if (mode === 'trail') this.buildTrail(); else this.buildCasing();
    this.beam = new THREE.PointLight(mode === 'casing' ? 0xd5dcce : 0xb8a0ef, 0, 3, 2); this.scene.add(this.beam);
    this.cursor = new THREE.Mesh(new THREE.RingGeometry(.15, .157, 40), new THREE.MeshBasicMaterial({ color: mode === 'glassscan' ? 0xb49aff : 0xc7af7f, transparent: true, opacity: .8, depthTest: false }));
    this.cursor.visible = false; this.scene.add(this.cursor);
    this.viewport.addEventListener('pointermove', event => this.move(event));
    this.viewport.addEventListener('pointerdown', event => { this.dragging = true; this.viewport.setPointerCapture(event.pointerId); this.move(event); });
    this.viewport.addEventListener('pointerup', () => { this.dragging = false; });
    this.viewport.addEventListener('pointercancel', () => { this.dragging = false; });
    this.viewport.addEventListener('pointerleave', () => { if (!this.dragging && mode !== 'casing') this.active = null; });
    this.renderer.domElement.addEventListener('keydown', event => {
      const index = this.config.features.indexOf(this.active);
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); event.stopPropagation(); this.focus((index + (event.key === 'ArrowRight' ? 1 : this.anchors.length - 1) + this.anchors.length) % this.anchors.length);
      }
    });
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.viewport); this.resize();
    this.paintStatus(); this.renderer.render(this.scene, this.camera);
  }
  mesh(geometry, material, position, parent = this.object) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); return mesh;
  }
  material(color, props = {}) { return new THREE.MeshStandardMaterial({ color, roughness: .45, ...props }); }
  buildGlass() {
    const glass = this.material(0xa6c4d1, { transparent: true, opacity: .24, metalness: .18, roughness: .1, side: THREE.DoubleSide, depthWrite: false });
    this.mesh(new THREE.CylinderGeometry(.61, .48, 1.65, 48, 1, true), glass, [0, 0, 0]);
    this.mesh(new THREE.CylinderGeometry(.48, .49, .1, 48), glass, [0, -.8, 0]);
    const rim = this.mesh(new THREE.TorusGeometry(.61, .018, 8, 64), glass, [0, .825, 0]); rim.rotation.x = Math.PI / 2;
    this.mesh(new THREE.CylinderGeometry(.85, .88, .06, 48), this.material(0x26343b), [0, -.9, 0]);
    const makePrint = (kind, w, h, y, z) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256; const g = canvas.getContext('2d');
      g.strokeStyle = '#d8c4ff'; g.lineWidth = 2.2; g.shadowColor = '#9270ff'; g.shadowBlur = 1.5;
      if (kind === 'finger') for (let r = 7; r < 110; r += 7) {
        g.beginPath(); g.ellipse(128, 128, r * .7, r, -.3, -.4 + r / 330, 4.5 - r / 320); g.stroke();
      } else for (let x = 12; x < 244; x += 7) { g.beginPath(); g.moveTo(x, 50); g.quadraticCurveTo(x + 5, 110, x + Math.sin(x) * 4, 190); g.stroke(); }
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: this.progress.recorded ? .7 : 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const print = this.mesh(new THREE.PlaneGeometry(w, h), mat, [kind === 'finger' ? .16 : 0, y, z]);
      this.prints.push(print); this.anchors.push(print.position.clone());
    };
    makePrint('lip', .8, .18, .73, .58); makePrint('finger', .49, .62, -.07, .59);
  }
  buildTrail() { buildTrailSurface(this); }
  buildCasing() {
    this.camera.position.set(0, .2, 3.2); this.camera.lookAt(0, 0, 0);
    const brass = this.material(0xc4a05d, { metalness: .58, roughness: .28 });
    this.mesh(new THREE.CylinderGeometry(.23, .255, 1.16, 48, 1, true), brass, [0, 0, 0]);
    this.mesh(new THREE.CylinderGeometry(.28, .28, .08, 48), brass, [0, -.57, 0]);
    this.mesh(new THREE.CylinderGeometry(.115, .115, .018, 40), this.material(0xb6a995, { metalness: .55 }), [0, -.619, 0]);
    this.mesh(new THREE.SphereGeometry(.035, 16, 8), this.material(0x443d31), [.025, -.635, 0]).scale.y = .18;
    for (let i = 0; i < 5; i++) this.mesh(new THREE.BoxGeometry(.008, .2 + i * .045, .004), this.material(0x806d47), [Math.sin(i * .14) * .13, -.15, .251]);
    this.anchors = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this.rotations = [new THREE.Euler(.25, .3, Math.PI / 2), new THREE.Euler(-Math.PI / 2, 0, .1), new THREE.Euler(-.6, .6, 1.1)].map(e => new THREE.Quaternion().setFromEuler(e));
    this.object.quaternion.copy(this.rotations[0]); this.targetRotation.copy(this.rotations[0]);
  }
  focus(index) {
    this.active = this.config.features[index];
    if (this.mode === 'casing') this.targetRotation.copy(this.rotations[index]);
    else { this.beamPoint.copy(this.anchors[index]); this.cursor.visible = true; }
  }
  move(event) {
    if (this.mode === 'casing') {
      if (this.dragging) { this.object.rotation.y += (event.movementX || 0) * .012; this.object.rotation.x += (event.movementY || 0) * .012; this.targetRotation.copy(this.object.quaternion); this.active = null; }
      return;
    }
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - r.left) / r.width * 2 - 1, -(event.clientY - r.top) / r.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.plane, this.beamPoint)) return;
    const nearest = this.anchors.findIndex(point => point.distanceTo(this.beamPoint) < (this.mode === 'glassscan' ? .35 : .32));
    this.active = nearest < 0 ? null : this.config.features[nearest]; this.cursor.visible = true;
  }
  resize() {
    if (this.disposed) return;
    const width = Math.max(1, this.viewport.clientWidth), height = Math.max(1, this.viewport.clientHeight);
    this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
  }
  update(dt) {
    if (this.disposed) return;
    if (this.mode !== 'casing' && (!this.level.docs.lightsOff || this.level.carried?.id !== 'uvwand')) { this.level._closeDevice(); return; }
    const before = this.config.features.filter(id => this.progress.coverage[id] >= 1).length;
    this.object.quaternion.slerp(this.targetRotation, this.mode === 'casing' ? 1 - Math.exp(-dt * 12) : 0);
    if (this.active && (this.mode !== 'casing' || this.object.quaternion.angleTo(this.targetRotation) < .08)) this.progress.inspect(this.active, dt);
    const after = this.config.features.filter(id => this.progress.coverage[id] >= 1).length;
    if (after > before) sfx('scanMark');
    this.cursor.position.copy(this.beamPoint);
    if (this.mode === 'trail') this.cursor.rotation.x = -Math.PI / 2;
    else this.cursor.position.z += .025;
    this.beam.position.copy(this.beamPoint);
    if (this.mode === 'trail') { this.beam.position.y += .48; this.beam.intensity = 2.5; this.cursor.visible = false; }
    else { this.beam.position.z += .3; this.beam.intensity = this.cursor.visible ? .8 : 0; }
    for (let i = 0; i < this.prints.length; i++) {
      const near = Math.max(0, 1 - this.anchors[i].distanceTo(this.beamPoint) / .6);
      this.prints[i].material.opacity = this.progress.recorded ? .7 : near;
    }
    this.paintStatus(); this.renderer.render(this.scene, this.camera);
  }
  paintStatus() {
    const count = this.config.features.filter(id => this.progress.coverage[id] >= 1).length;
    const key = `${count}:${this.active}:${this.progress.recorded}`;
    if (this.statusKey === key) return; this.statusKey = key;
    this.status.textContent = this.progress.recorded ? 'Recorded' : `${count} / ${this.config.features.length} examined`;
    this.buttons.forEach((button, i) => {
      const id = this.config.features[i], done = this.progress.coverage[id] >= 1;
      button.classList.toggle('examined', done); button.setAttribute('aria-pressed', String(this.active === id));
      button.textContent = `${done ? '✓ ' : ''}${id}`;
    });
    this.recordButton.disabled = !this.progress.ready || this.progress.recorded;
    this.recordButton.textContent = this.progress.recorded ? 'Findings recorded' : 'Record findings';
    this.instruction.textContent = this.progress.ready ? 'Examination complete' : this.mode === 'casing' ? 'Drag to rotate · choose a surface to inspect' : 'Move the beam · or choose a feature below';
    this.result.hidden = !this.progress.recorded; this.result.textContent = this.config.result;
  }
  record() {
    if (this.mode !== 'casing' && (!this.level.docs.lightsOff || this.level.carried?.id !== 'uvwand')) return;
    if (!this.progress.record()) return;
    sfx('record');
    if (this.mode === 'glassscan') this.level.trace.glassUV = true;
    else if (this.mode === 'trail') this.level.docs.trailRead = true;
    else this.level.docs.casingRead = true;
    this.level._refreshCounter(); this.paintStatus();
  }
  dispose() {
    this.disposed = true; this.resizeObserver.disconnect();
    const geometries = new Set(), materials = new Set(), textures = new Set();
    this.scene.traverse(o => { if (!o.isMesh) return; geometries.add(o.geometry); materials.add(o.material); if (o.material.map) textures.add(o.material.map); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.panel.remove();
  }
}
