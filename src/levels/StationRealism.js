// Level 2 station realism pass: surface grime, architectural trim, contact AO,
// acoustic ceilings, an interior window with daylight, and fixture light pools.
// Everything here is static and merged, so it adds only a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- shared helpers (also used by StationBuildings.js) ----------
export function own(L, o) { (L._realism ||= new Set()).add(o); return o; }

export function canvasTexture(L, w, h, draw, { srgb = true, repeat = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  (L._environmentTextures ||= new Set()).add(t);
  return t;
}

export function mergeInto(L, parent, buckets) {
  // buckets: Map<material, BufferGeometry[]> -> one mesh per material
  for (const [mat, geos] of buckets) {
    if (!geos.length) continue;
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    own(L, merged); own(L, mat);
    parent.add(mesh);
  }
}

// ---------- 1. surface grime (walls, ceilings, floors, exterior buildings) ----------
const NOISE = /* glsl */`
float stHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float stNoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(stHash(i), stHash(i + vec2(1.0, 0.0)), f.x),
             mix(stHash(i + vec2(0.0, 1.0)), stHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

// Interior wall paint. Change WALL_PRESET to restyle every station wall at once.
//   upper = wall colour above the wainscot, lower = painted dado, rail = the chair-rail line.
export const WALL_PRESET = 'teal';
export const WALL_PRESETS = {
  teal:  { upper: 0x5f949b, lower: 0xe4e7e2, rail: 0x25393f },   // calm institutional teal over white
  sage:  { upper: 0x8fb09a, lower: 0xe8eae3, rail: 0x2f4137 },   // soft sage green
  cream: { upper: 0xdccba4, lower: 0xeeebe2, rail: 0x4a3b28 },   // warm cream, brighter and friendlier
  navy:  { upper: 0x4d6a8a, lower: 0xdfe3e8, rail: 0x1b2a3b },   // blue-grey, serious and formal
};

const glslVec = (hex) => { const c = new THREE.Color(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };

const paintGLSL = (p) => `
  vec3 stUp = ${glslVec(p.upper)};
  vec3 stLo = ${glslVec(p.lower)};
  vec3 stRl = ${glslVec(p.rail)};
  float stLum = dot(diffuseColor.rgb, vec3(0.3333)) / 0.77;            // keep the plaster texture detail
  float stDado = 1.0 - smoothstep(0.845, 0.855, vStW.y);               // wainscot below 0.85 m
  float stRail = smoothstep(0.82, 0.83, vStW.y) * (1.0 - smoothstep(0.88, 0.89, vStW.y));
  vec3 stPaint = mix(stUp, stLo, stDado);
  stPaint = mix(stPaint, stRl, stRail);
  diffuseColor.rgb = mix(diffuseColor.rgb, stPaint * stLum, vert);     // walls only, never floors/ceilings`;

const GRIME = (paint) => /* glsl */`{
  vec3 stN = normalize(cross(dFdx(vStW), dFdy(vStW)));
  float vert = 1.0 - abs(stN.y);                       // 1 on walls, 0 on floors/ceilings
  ${paint ? paintGLSL(WALL_PRESETS[WALL_PRESET] || WALL_PRESETS.teal) : ''}
  float along = vStW.x + vStW.z;
  float blotch = stNoise(vec2(along, vStW.y) * 0.35) * 0.6 + stNoise(vec2(along, vStW.y) * 1.7) * 0.4;
  float streak = stNoise(vec2(along * 3.0, vStW.y * 0.12));   // rain / drip streaks
  float baseDirt = 1.0 - smoothstep(0.0, 0.7, vStW.y);        // scuffs and splash at the floor
  float topDirt = smoothstep(2.8, 3.4, vStW.y) * (1.0 - smoothstep(3.4, 3.7, vStW.y)); // ceiling junction
  float tone = 1.0 - vert * (0.30 * baseDirt + 0.10 * topDirt)
                   - mix(0.08, 0.15, vert) * blotch
                   - vert * 0.07 * streak;
  diffuseColor.rgb *= clamp(tone, 0.5, 1.0);
}`;

// opts.paint = true repaints interior walls with the active WALL_PRESET. Only materials made
// with the default (white) plaster tint get it: exterior buildings and furniture keep their own colours.
export function applyGrime(material, kind, opts = {}) {
  if (kind !== 'plaster' && kind !== 'brick' && kind !== 'tile') return material;
  const paint = !!opts.paint && kind === 'plaster';
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStW;\n' + NOISE)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + GRIME(paint));
  };
  material.customProgramCacheKey = () => `${prevKey()}|grime2-${kind}-${paint ? WALL_PRESET : 'plain'}`;
  return material;
}

// ---------- 2. skirting, crown moulding and floor-edge ambient occlusion ----------
function addTrim(L) {
  const base = own(L, L._std(0xdcdfda, 0.55, 0));
  const crown = own(L, L._std(0xe8eae5, 0.6, 0));
  const aoTex = canvasTexture(L, 8, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { srgb: false });
  const aoMat = own(L, new THREE.MeshBasicMaterial({
    map: aoTex, transparent: true, depthWrite: false, fog: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  const baseG = [], crownG = [], aoG = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1);

  for (const b of L.colliders) {
    const sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z;
    if (sy < 3.3 || b.min.y > 0.1 || Math.min(sx, sz) > 0.45) continue;   // full-height walls only
    if (b.min.z >= 18.5) continue;                                          // street facade keeps its own detail
    const alongX = sx >= sz, len = alongX ? sx : sz;
    const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
    for (const sgn of [-1, 1]) {
      const n = alongX ? [0, sgn] : [sgn, 0];
      const fx = alongX ? cx : (sgn > 0 ? b.max.x : b.min.x);
      const fz = alongX ? (sgn > 0 ? b.max.z : b.min.z) : cz;
      const box = (h, t, y, bucket) => {
        const g = alongX ? new THREE.BoxGeometry(len, h, t) : new THREE.BoxGeometry(t, h, len);
        g.translate(fx + n[0] * t / 2, y, fz + n[1] * t / 2); bucket.push(g);
      };
      box(0.14, 0.03, 0.07, baseG);
      box(0.12, 0.07, 3.34, crownG);
      const ao = new THREE.PlaneGeometry(len, 0.6);
      e.set(-Math.PI / 2, Math.atan2(n[0], n[1]), 0, 'YXZ'); q.setFromEuler(e);
      v.set(fx + n[0] * 0.3, 0.022, fz + n[1] * 0.3);
      m4.compose(v, q, s1); ao.applyMatrix4(m4); aoG.push(ao);
    }
  }
  const root = new THREE.Group(); root.name = 'Station trim';
  mergeInto(L, root, new Map([[base, baseG], [crown, crownG]]));
  mergeInto(L, root, new Map([[aoMat, aoG]]));
  root.traverse(o => { o.userData.noShadow = true; });
  L.level.add(root);
}

// ---------- 3. acoustic tile ceilings ----------
function addCeilings(L) {
  const tex = canvasTexture(L, 512, 512, (g, w, h) => {
    g.fillStyle = '#e6e5de'; g.fillRect(0, 0, w, h);
    let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 6000; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '96,94,86'},${r() * 0.13})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    for (let i = 0; i < 160; i++) {            // fissured-tile pin holes
      g.fillStyle = 'rgba(70,68,62,.35)'; g.fillRect(r() * w, r() * h, 2, 2);
    }
    g.strokeStyle = '#8f9493'; g.lineWidth = 7;       // T-bar grid, 0.6 m tiles
    g.strokeRect(0, 0, w, h);
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  }, { repeat: true });
  tex.anisotropy = 8;
  const mat = own(L, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 }));
  const geos = [];
  for (const [x, z, w, d] of [[0, 0, 20, 14], [0, 13, 20, 12], [15, 12, 10, 10], [-16.2, 12.5, 12, 11]]) {
    const g = new THREE.PlaneGeometry(w, d);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 1.2, uv.getY(i) * d / 1.2);
    g.rotateX(Math.PI / 2); g.translate(x, 3.396, z); geos.push(g);   // faces down
  }
  const root = new THREE.Group(); root.name = 'Acoustic ceilings';
  mergeInto(L, root, new Map([[mat, geos]]));
  root.traverse(o => { o.userData.noShadow = true; });
  L.level.add(root);
}

// ---------- 4. lobby window: daylight view, frame, blinds and a sun patch ----------
function addLobbyWindow(L) {
  const X = -6, Y = 1.655, Z = 18.835, W = 3.5, H = 1.45;
  const view = canvasTexture(L, 512, 256, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#79b0de'); sky.addColorStop(0.7, '#cfe3f0'); sky.addColorStop(1, '#e8eef0');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let x = 0; x < w; x += 40) {            // distant street-side buildings
      const bh = 50 + r() * 90; g.fillStyle = `rgba(${95 + r() * 30},${112 + r() * 25},${125 + r() * 25},.9)`;
      g.fillRect(x, h - bh, 36, bh);
    }
    g.fillStyle = '#7d8689'; g.fillRect(0, h - 22, w, 22);       // street
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, w, h / 3);
    // Venetian blind, half raised: slats read as real depth cues.
    for (let y = 0; y < h * 0.34; y += 9) {
      g.fillStyle = '#e9e6dc'; g.fillRect(0, y, w, 7);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, y + 7, w, 2);
    }
    g.fillStyle = '#d7d4c8'; g.fillRect(0, h * 0.34, w, 5);
  });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), own(L, new THREE.MeshBasicMaterial({ map: view, fog: false })));
  pane.position.set(X, Y, Z); pane.rotation.y = Math.PI; pane.userData.noShadow = true; L.level.add(pane);

  const frameMat = own(L, L._std(0xe9e8e1, 0.5, 0.1));
  const frame = [];
  const bar = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); frame.push(g); };
  const fz = Z - 0.04;
  bar(W + 0.2, 0.08, 0.1, X, Y - H / 2 - 0.04, fz);  bar(W + 0.2, 0.08, 0.1, X, Y + H / 2 + 0.04, fz);
  bar(0.08, H + 0.16, 0.1, X - W / 2 - 0.04, Y, fz); bar(0.08, H + 0.16, 0.1, X + W / 2 + 0.04, Y, fz);
  bar(0.05, H, 0.07, X, Y, fz - 0.01); bar(W, 0.05, 0.07, X, Y + 0.22, fz - 0.01);
  bar(W + 0.5, 0.05, 0.3, X, Y - H / 2 - 0.1, Z - 0.16);                                   // deep sill
  const fr = new THREE.Group(); mergeInto(L, fr, new Map([[frameMat, frame]]));
  fr.traverse(o => { o.userData.noShadow = true; }); L.level.add(fr);

  // Sun patch on the floor, with the mullion shadows cut out.
  const sun = canvasTexture(L, 256, 96, (g, w, h) => {
    g.fillStyle = 'rgba(255,238,200,1)'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    g.fillRect(w / 2 - 3, 0, 6, h); g.fillRect(0, h * 0.28, w, 5);
    g.globalCompositeOperation = 'source-over';
    const f = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.55);
    f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = f; g.fillRect(0, 0, w, h);
  });
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.2), own(L, new THREE.MeshBasicMaterial({
    map: sun, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.3, fog: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  })));
  patch.rotation.x = -Math.PI / 2; patch.position.set(X + 1.15, 0.03, 17.6); patch.userData.noShadow = true;
  L.level.add(patch);
}

// ---------- 5. fixture light pools and tube glare ----------
function addLightPools(L) {
  const glow = canvasTexture(L, 128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  }, { srgb: false });
  const poolMat = (color, opacity) => own(L, new THREE.MeshBasicMaterial({
    map: glow, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity, fog: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  }));
  const cool = poolMat(0xdfeaf5, 0.2), warm = poolMat(0xffe0b4, 0.24);
  const spots = [[-6, 2.5], [0, 2.5], [6, 2.5], [0, -3.5], [0, 15], [-5, 9], [15, 12], ...(L._extraCeilingFixtures || [])];
  const coolG = [], warmG = [];
  for (const [x, z] of spots) {
    const isWarm = x > 10;                       // captain's office keeps the warmer tone
    const w = isWarm ? 4.6 : 5.2;
    const g = new THREE.PlaneGeometry(w, w); g.rotateX(-Math.PI / 2); g.translate(x, 0.026, z);
    (isWarm ? warmG : coolG).push(g);
    const sp = new THREE.Sprite(own(L, new THREE.SpriteMaterial({
      map: glow, color: isWarm ? 0xffe2b8 : 0xeaf2ff, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 0.45, fog: false,
    })));
    sp.scale.set(2.2, 0.7, 1); sp.position.set(x, 3.22, z); sp.userData.noShadow = true; L.level.add(sp);
  }
  const root = new THREE.Group(); root.name = 'Light pools';
  mergeInto(L, root, new Map([[cool, coolG], [warm, warmG]]));
  root.traverse(o => { o.userData.noShadow = true; }); L.level.add(root);
}

export function buildStationRealism(L) {
  addTrim(L);
  addCeilings(L);
  addLobbyWindow(L);
  addLightPools(L);
  if (L.scene.environmentIntensity != null) L.scene.environmentIntensity = Math.max(L.scene.environmentIntensity, 0.45);
}

export function disposeStationRealism(L) {
  for (const o of L._realism || []) o.dispose?.();
  L._realism = null;
}
