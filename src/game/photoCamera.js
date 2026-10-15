// ============================================================
// photoCamera.js — the detective's camera (src/game/photoCamera.js)
//
//   Q            raise / lower the camera
//   mouse wheel  zoom (only while it is raised)
//   left click   take a photo (needs the pointer locked, so the first click
//                that locks the mouse never wastes film)
//
// What it gives the game
//   * a viewfinder drawn by a CUSTOM SHADER (vertex + fragment): vignette,
//     film grain, corner brackets, a reticle that tightens and turns green
//     when something worth photographing is framed, and a shutter flash.
//     All driven by uniforms: time, raise amount, lock amount, flash.
//   * real photos: the 3D scene is rendered into a render target from the
//     player's viewpoint, graded and shown as a polaroid that "develops".
//   * for each photo, a list of WHAT was framed (people / evidence ids),
//     so the evidence board and the stakeout can use photos as proof.
//
// The module knows nothing about Level 2. The level tells it what can be
// photographed through getTargets() and listens through onPhoto().
// ============================================================
import * as THREE from 'three';

export const PHOTO = {
  film: 12,            // shots per level
  W: 320, H: 240,      // photo size (4:3, small on purpose: cheap, and it looks like film)
  frameH: 0.7,         // viewfinder frame height as a fraction of half the screen
  maxDist: 32,         // furthest a subject can be and still count as "in the photo"
  lockDist: 22,        // furthest a subject can be and still be SHARP
  zoomFov: 0.42,       // fully zoomed fov = base fov * this
  zoomRange: 0.9,      // fully zoomed, maxDist and lockDist grow by this fraction (x1.9)
};

// ------------------------------------------------------------
// PURE LOGIC — which targets are inside the viewfinder?
// No renderer, no DOM: unit-testable with plain three.js maths.
//
//   targets   [{ id, kind, tag?, radius?, getPos(outVec3) }]
//   colliders [THREE.Box3]  anything that blocks line of sight
//
// Returns the visible ones, closest to the centre first:
//   { target, dist, x, y, centered, sharp }
// ------------------------------------------------------------
const _v = new THREE.Vector3();
const _o = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _hit = new THREE.Vector3();
const _ray = new THREE.Ray();

export function frameSubjects(cam, targets, colliders = [], opts = {}) {
  const maxDist = opts.maxDist ?? PHOTO.maxDist;
  const lockDist = opts.lockDist ?? PHOTO.lockDist;
  const aspect = cam.aspect || 1;
  // frame half-extents in NDC: a 4:3 box whose height is `frameH`
  const hy = opts.frameH ?? PHOTO.frameH;
  const hx = Math.min(0.95, (hy * 4 / 3) / aspect);

  // the camera is not in the scene graph, so refresh its matrices by hand
  cam.updateMatrixWorld();
  cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  _o.setFromMatrixPosition(cam.matrixWorld);

  const out = [];
  for (const t of targets) {
    t.getPos(_v);
    const dist = _o.distanceTo(_v);
    if (dist > maxDist || dist < 0.3) continue;

    _v.project(cam);                                   // NDC; z > 1 means behind
    if (_v.z > 1 || Math.abs(_v.x) > hx || Math.abs(_v.y) > hy) continue;
    const nx = _v.x, ny = _v.y;

    // line of sight: does a wall or building sit between the lens and the subject?
    t.getPos(_v);
    _dir.copy(_v).sub(_o).normalize();
    _ray.set(_o, _dir);
    const radius = t.radius ?? 0.5;
    let blocked = false;
    for (const b of colliders) {
      if (!b || !b.isBox3 || b.containsPoint(_o)) continue;   // a box we stand inside never blocks
      if (_ray.intersectBox(b, _hit) && _o.distanceTo(_hit) < dist - radius) { blocked = true; break; }
    }
    if (blocked) continue;

    const centered = Math.abs(nx) < hx * 0.45 && Math.abs(ny) < hy * 0.45;
    out.push({ target: t, dist, x: nx, y: ny, centered, sharp: centered && dist <= lockDist });
  }
  out.sort((a, b) => (a.x * a.x + a.y * a.y) - (b.x * b.x + b.y * b.y));
  return out;
}

// ------------------------------------------------------------
// SHADER — the viewfinder (screen-space quad parked in front of the lens)
// ------------------------------------------------------------
const VF_VERT = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const VF_FRAG = `
varying vec2 vUv;
uniform float uTime, uUp, uFlash, uLock, uAspect, uFrameH;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main(){
  // q: x scaled by aspect so lengths are true on screen, y in -1..1
  vec2 q = vec2((vUv.x * 2.0 - 1.0) * uAspect, vUv.y * 2.0 - 1.0);
  vec2 fr = vec2(uFrameH * 4.0 / 3.0, uFrameH);          // 4:3 frame half-extents
  vec2 ad = abs(q);

  // outside the frame is dimmed, plus an overall vignette
  vec2 d = ad - fr;
  float outside = step(0.0, max(d.x, d.y));
  float vig = smoothstep(0.4, 1.6, length(q));
  float a = (outside * 0.55 + vig * 0.35) * uUp;

  // film grain, re-rolled every frame
  float g = hash(vUv * vec2(1280.0, 720.0) + fract(uTime) * 37.0);
  a += (g - 0.5) * 0.07 * uUp;

  // corner brackets
  float arm = 0.14, th = 0.006;
  float bracket =
      step(abs(ad.y - fr.y), th) * step(fr.x - arm, ad.x) * step(ad.x, fr.x) +
      step(abs(ad.x - fr.x), th) * step(fr.y - arm, ad.y) * step(ad.y, fr.y);

  // centre reticle: ring tightens and turns green when a subject is locked
  float r = length(q);
  float ringR = mix(0.17, 0.085, uLock);
  float ring = smoothstep(0.005, 0.0, abs(r - ringR));
  float xhair = step(abs(q.x), 0.002) * step(abs(q.y), 0.03) +
                step(abs(q.y), 0.002) * step(abs(q.x), 0.03);
  vec3 tint = mix(vec3(0.95, 0.94, 0.88), vec3(0.35, 1.0, 0.55), uLock);
  float mark = clamp(bracket + ring * 0.9 + xhair, 0.0, 1.0) * uUp;

  // blinking REC dot, top-left of the frame
  float rec = step(length(q - vec2(-fr.x + 0.06, fr.y - 0.06)), 0.013) * step(0.5, fract(uTime * 0.8)) * uUp;

  vec3 col = mix(vec3(0.0), tint, mark);
  col = mix(col, vec3(1.0, 0.18, 0.18), rec);
  a = clamp(max(a, max(mark, rec)), 0.0, 1.0);

  // shutter flash covers everything and fades out
  col = mix(col, vec3(1.0), uFlash);
  a = max(a, uFlash);

  gl_FragColor = vec4(col, a);
}`;

// ------------------------------------------------------------
// THE CAMERA
// ------------------------------------------------------------
export class PhotoCamera {
  /**
   * @param {object} o
   *  scene, renderer          THREE.Scene / WebGLRenderer
   *  getCamera()              the first-person camera (default window.__camera)
   *  getTargets()             [{ id, kind, tag?, radius?, getPos(out) }] right now
   *  getColliders()           [THREE.Box3] that block line of sight
   *  isBlocked()              true while a menu or dialogue owns the keyboard
   *  onPhoto(photo)           called after every shot
   *  clockLabel()             string for the photo timestamp
   */
  constructor(o) {
    this.scene = o.scene;
    this.renderer = o.renderer;
    this.getCamera = o.getCamera || (() => window.__camera);
    this.getTargets = o.getTargets || (() => []);
    this.getColliders = o.getColliders || (() => []);
    this.isBlocked = o.isBlocked || (() => false);
    this.onPhoto = o.onPhoto || (() => {});
    this.clockLabel = o.clockLabel || (() => '');
    this.opts = Object.assign({}, PHOTO, o.opts || {});

    this.up = false;
    this.upT = 0;            // eased 0..1
    this.zoom = 0;           // target zoom 0..1
    this.zoomT = 0;          // eased
    this.lock = 0;           // eased 0..1, 1 = something sharp is framed
    this.flash = 0;
    this.cooldown = 0;
    this.film = this.opts.film;
    this.photos = [];
    this.framed = [];        // result of the last frameSubjects() while raised
    this.baseFov = null;
    this.time = 0;

    this._buildOverlay();
    this._buildUI();

    this._onKey = (e) => {
      if (e.repeat || e.code !== 'KeyQ' || this.isBlocked()) return;
      this.toggle();
    };
    this._onClick = () => {
      if (!this.up || this.isBlocked()) return;
      if (!document.pointerLockElement) return;        // that click is for locking the mouse
      this.shoot();
    };
    this._onWheel = (e) => {
      if (!this.up || this.isBlocked()) return;
      this.zoom = Math.max(0, Math.min(1, this.zoom - Math.sign(e.deltaY) * 0.2));
    };
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('click', this._onClick);
    window.addEventListener('wheel', this._onWheel, { passive: true });
  }

  // zooming in lets you shoot from further away: the frame is narrower, but
  // the subject stays sharp out to a longer range
  _frameOpts() {
    const k = 1 + this.opts.zoomRange * this.zoomT;
    return Object.assign({}, this.opts, {
      maxDist: this.opts.maxDist * k,
      lockDist: this.opts.lockDist * k,
    });
  }

  // ---------- viewfinder overlay ----------
  _buildOverlay() {
    this.uniforms = {
      uTime: { value: 0 }, uUp: { value: 0 }, uFlash: { value: 0 },
      uLock: { value: 0 }, uAspect: { value: 1 }, uFrameH: { value: this.opts.frameH },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VF_VERT, fragmentShader: VF_FRAG,
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false,
    });
    this.overlay = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    this.overlay.renderOrder = 9999;
    this.overlay.frustumCulled = false;
    this.overlay.visible = false;
    this.overlay.userData.noShadow = true;
    this.scene.add(this.overlay);
  }

  // ---------- DOM: film counter + polaroid tray ----------
  _buildUI() {
    const root = document.createElement('div');
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:52;font-family:"Courier New",monospace;';
    root.innerHTML = `
      <div class="pc-film" style="position:absolute;left:50%;bottom:7%;transform:translateX(-50%);
           color:#f2e9c9;font-size:13px;letter-spacing:2px;opacity:0;transition:opacity .25s;text-shadow:0 1px 3px #000"></div>
      <div class="pc-tray" style="position:absolute;right:18px;top:240px;display:flex;flex-direction:column;gap:10px;align-items:flex-end"></div>`;
    document.body.appendChild(root);
    this.ui = { root, film: root.querySelector('.pc-film'), tray: root.querySelector('.pc-tray') };

    if (!document.getElementById('pc-style')) {
      const st = document.createElement('style');
      st.id = 'pc-style';
      st.textContent = `
        @keyframes pc-slide { from { transform: translateX(120%) rotate(6deg); opacity: 0 } to { transform: translateX(0) rotate(var(--r)); opacity: 1 } }
        @keyframes pc-develop { 0% { filter: brightness(.15) saturate(0) blur(6px) } 60% { filter: brightness(.7) saturate(.4) blur(2px) } 100% { filter: none } }
        .pc-polaroid { background:#f4efe2; padding:6px 6px 22px; width:128px; box-shadow:0 6px 18px rgba(0,0,0,.6);
                       transform: rotate(var(--r)); animation: pc-slide .45s ease-out; position: relative }
        .pc-polaroid img { display:block; width:116px; height:87px; background:#111; animation: pc-develop 2.6s ease-out forwards }
        .pc-polaroid .cap { position:absolute; left:8px; right:8px; bottom:4px; font-size:10px; color:#4a4538; display:flex; justify-content:space-between }`;
      document.head.appendChild(st);
    }
    this._refreshFilm();
  }

  _refreshFilm() {
    if (!this.ui) return;
    this.ui.film.textContent = this.film > 0
      ? '\u25A0 '.repeat(Math.min(this.film, 12)).trim()
      : 'OUT OF FILM';
    this.ui.film.style.opacity = this.upT > 0.5 ? 1 : 0;
  }

  // ---------- public ----------
  toggle() {
    this.up = !this.up;
    if (!this.up) this.zoom = 0;
    this._refreshFilm();
  }
  get isUp() { return this.up; }

  update(dt, t) {
    if (!this.overlay) return;                         // disposed
    this.time = t;
    const cam = this.getCamera();
    if (!cam || !cam.isCamera) return;
    if (this.baseFov === null) this.baseFov = cam.fov;

    // ease the raise and the zoom
    this.upT += ((this.up ? 1 : 0) - this.upT) * Math.min(1, dt * 9);
    this.zoomT += (this.zoom - this.zoomT) * Math.min(1, dt * 6);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.flash = Math.max(0, this.flash - dt * 3.2);

    const fov = this.baseFov * (1 - (1 - this.opts.zoomFov) * this.zoomT * (this.up ? 1 : 0));
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }

    // what is in the frame right now?
    let lockWant = 0;
    if (this.up && !this.isBlocked()) {
      this.framed = frameSubjects(cam, this.getTargets(), this.getColliders(), this._frameOpts());
      if (this.framed.length && this.framed[0].sharp) lockWant = 1;
    } else this.framed = [];
    this.lock += (lockWant - this.lock) * Math.min(1, dt * 10);

    // park the viewfinder quad just in front of the lens
    const visible = this.upT > 0.01 || this.flash > 0.01;
    this.overlay.visible = visible;
    if (visible) {
      const d = 0.2;
      cam.getWorldDirection(_dir);
      this.overlay.position.copy(cam.position).addScaledVector(_dir, d);
      this.overlay.quaternion.copy(cam.quaternion);
      const h = 2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
      this.overlay.scale.set(h * cam.aspect, h, 1);
      const u = this.uniforms;
      u.uTime.value = t;
      u.uUp.value = this.upT;
      u.uFlash.value = this.flash;
      u.uLock.value = this.lock;
      u.uAspect.value = cam.aspect;
    }
    this._refreshFilm();
  }

  shoot() {
    const cam = this.getCamera();
    if (!this.up || !cam || this.film <= 0 || this.cooldown > 0) return null;
    this.film--;
    this.cooldown = 0.6;
    this.flash = 1;

    const seen = frameSubjects(cam, this.getTargets(), this.getColliders(), this._frameOpts());
    const photo = {
      id: this.photos.length + 1,
      time: this.clockLabel(),
      zoom: this.zoomT,
      flash: true,
      image: this._capture(cam),
      // metadata only: this is what gets saved. The image stays in memory.
      subjects: seen.map((s) => ({
        id: s.target.id, kind: s.target.kind, tag: s.target.tag || null,
        name: s.target.name || null,
        sharp: s.sharp, dist: Math.round(s.dist * 10) / 10,
      })),
    };
    this.photos.push(photo);
    this._addPolaroid(photo);
    this._refreshFilm();
    try { this.onPhoto(photo); } catch (e) { console.warn('onPhoto failed', e); }
    return photo;
  }

  // ---------- capture: render the scene into a small texture, grade it ----------
  _capture(cam) {
    const { W, H } = this.opts;
    try {
      if (!this._rt) this._rt = new THREE.WebGLRenderTarget(W, H);
      if (!this._pcam) this._pcam = new THREE.PerspectiveCamera(60, W / H, 0.1, 1200);
      const pc = this._pcam;
      cam.updateMatrixWorld();
      pc.position.setFromMatrixPosition(cam.matrixWorld);
      pc.quaternion.copy(cam.quaternion);
      pc.fov = cam.fov; pc.near = cam.near; pc.far = cam.far; pc.aspect = W / H;
      pc.layers.mask = cam.layers.mask;
      pc.updateProjectionMatrix(); pc.updateMatrixWorld();

      const r = this.renderer;
      const prevRT = r.getRenderTarget();
      const prevScissor = r.getScissorTest();
      const wasVisible = this.overlay.visible;
      this.overlay.visible = false;                    // the photo has no viewfinder in it
      r.setScissorTest(false);
      r.setRenderTarget(this._rt);
      r.clear();
      r.render(this.scene, pc);
      const buf = new Uint8Array(W * H * 4);
      r.readRenderTargetPixels(this._rt, 0, 0, W, H, buf);
      r.setRenderTarget(prevRT);
      r.setScissorTest(prevScissor);
      this.overlay.visible = wasVisible;

      return this._toDataURL(buf, W, H);
    } catch (e) {
      console.warn('photo capture failed', e);
      try { this.renderer.setRenderTarget(null); } catch (e2) { /* ignore */ }
      return null;
    }
  }

  // render targets hold LINEAR colour with no tone mapping, so brighten with a
  // gamma curve, flip (GL rows run bottom-up), and give it a warm film grade.
  _toDataURL(buf, W, H) {
    if (!this._lut) {
      this._lut = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        const v = Math.pow(i / 255, 1 / 2.2);
        this._lut[i] = Math.min(255, Math.round(255 * (v * 1.08)));   // slight lift for the night
      }
    }
    const lut = this._lut;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const src = (H - 1 - y) * W * 4;
      const dst = y * W * 4;
      for (let x = 0; x < W; x++) {
        const i = src + x * 4, j = dst + x * 4;
        const r = lut[buf[i]], gg = lut[buf[i + 1]], b = lut[buf[i + 2]];
        img.data[j] = Math.min(255, r * 1.05 + 6);          // warm
        img.data[j + 1] = gg;
        img.data[j + 2] = Math.max(0, b * 0.9);
        img.data[j + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.82);
  }

  // ---------- polaroid tray ----------
  _addPolaroid(photo) {
    if (!this.ui) return;
    const el = document.createElement('div');
    el.className = 'pc-polaroid';
    el.style.setProperty('--r', `${(Math.random() * 8 - 4).toFixed(1)}deg`);
    const tags = photo.subjects.filter((s) => s.kind === 'person' && s.sharp).length;
    el.innerHTML = `<img alt=""><div class="cap"><span>${photo.time || ''}</span><span>${tags ? '\u25CF'.repeat(Math.min(tags, 3)) : ''}</span></div>`;
    if (photo.image) el.querySelector('img').src = photo.image;
    this.ui.tray.prepend(el);
    while (this.ui.tray.children.length > 4) this.ui.tray.lastChild.remove();
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('click', this._onClick);
    window.removeEventListener('wheel', this._onWheel);
    const cam = this.getCamera();
    if (cam && cam.isCamera && this.baseFov !== null) { cam.fov = this.baseFov; cam.updateProjectionMatrix(); }
    if (this.overlay) {
      this.scene.remove(this.overlay);
      this.overlay.geometry.dispose();
      this.overlay.material.dispose();
      this.overlay = null;
    }
    if (this._rt) { this._rt.dispose(); this._rt = null; }
    if (this.ui) { this.ui.root.remove(); this.ui = null; }
  }
}
