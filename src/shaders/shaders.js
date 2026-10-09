// ============================================================
// shaders.js — every custom ShaderMaterial in the game
// These exist because built-in materials can't do this stuff:
// procedural nebula sky, flowing energy water, swirling portals,
// force fields, god rays, and dissolve effects.
// Each one has a uTime uniform so it's always alive.
// ============================================================
import * as THREE from 'three';

// shared GLSL: hash + value noise + fbm (used by several shaders)
const NOISE_GLSL = `
float hash13(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i+vec3(0,0,0)), hash13(i+vec3(1,0,0)), f.x),
        mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), f.x),
        mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){
  float v = 0.0; float a = 0.5;
  for (int k = 0; k < 4; k++){ v += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return v;
}
`;

// ---------- DYNAMIC SKYBOX: animated nebula + twinkling stars ----------
export function NebulaSkyMaterial({ cA = 0x07040f, cB = 0x3d1163, cC = 0x0e5f6e } = {}) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTime: { value: 0 },
      uA: { value: new THREE.Color(cA) },
      uB: { value: new THREE.Color(cB) },
      uC: { value: new THREE.Color(cC) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vDir = position; // direction from centre = the whole sky
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: NOISE_GLSL + `
      varying vec3 vDir;
      uniform float uTime; uniform vec3 uA, uB, uC;
      void main(){
        vec3 d = normalize(vDir);
        // two fbm layers drifting at different speeds = living sky
        float n1 = fbm(d * 2.6 + vec3(0.0, uTime * 0.008, uTime * 0.012));
        float n2 = fbm(d * 5.2 - vec3(uTime * 0.015, 0.0, 0.0));
        vec3 col = mix(uA, uB, smoothstep(0.25, 0.85, n1));
        col = mix(col, uC, smoothstep(0.55, 0.95, n2) * 0.7);
        // stars: one hash per sky-cell, twinkle with time
        float s = hash13(floor(d * 220.0));
        float tw = 0.5 + 0.5 * sin(uTime * 2.5 + s * 40.0);
        col += vec3(step(0.9975, s)) * tw * 0.9;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// ---------- ENERGY RIVER / WATER (Level 2) ----------
export function EnergyMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NOISE_GLSL + `
      varying vec2 vUv; uniform float uTime;
      void main(){
        // scrolling fbm: stretched so it flows along the river
        vec2 p = vec2(vUv.x * 6.0, vUv.y * 30.0 - uTime * 0.55);
        float n = fbm(vec3(p, uTime * 0.1));
        float streak = smoothstep(0.35, 0.9, n);
        // fade at the river banks
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        vec3 col = mix(vec3(0.05, 0.9, 0.8), vec3(0.9, 0.2, 0.9), streak);
        gl_FragColor = vec4(col * streak, streak * edge * 0.9);
      }`,
  });
}

// ---------- PORTAL (Level 2 boss gate) ----------
export function PortalMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NOISE_GLSL + `
      varying vec2 vUv; uniform float uTime;
      void main(){
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        float ang = atan(c.y, c.x);
        // rotate angle by radius + time = spiral swirl
        float swirl = ang + uTime * 0.8 + r * 6.0;
        float n = fbm(vec3(cos(swirl), sin(swirl), r * 3.0 - uTime * 0.6));
        vec3 col = mix(vec3(0.5, 0.1, 0.9), vec3(0.1, 0.9, 0.9), n);
        float alpha = smoothstep(1.0, 0.7, r);
        gl_FragColor = vec4(col * (0.6 + n), alpha);
      }`,
  });
}

// ---------- FORCE FIELD DOME (Level 1, "the device wakes up") ----------
// uPower is driven by GAME STATE (kills / story progress), not just time.
export function ForceFieldMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 }, uPower: { value: 0.6 } },
    vertexShader: `
      varying vec3 vNormal; varying vec3 vView; varying vec3 vWorld;
      void main(){
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vNormal; varying vec3 vView; varying vec3 vWorld;
      uniform float uTime; uniform float uPower;
      void main(){
        // fresnel rim: edges glow, centre see-through
        float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);
        // faint hex-grid lines pulsing across the surface
        vec2 g = vWorld.xz * 1.4 + vWorld.yy * 0.7;
        vec2 f = abs(fract(g) - 0.5);
        float line = smoothstep(0.48, 0.5, max(f.x, f.y));
        float pulse = 0.6 + 0.4 * sin(uTime * 2.0);
        vec3 col = vec3(0.2, 0.9, 1.0);
        float a = fres * 0.8 + line * 0.25 * pulse;
        gl_FragColor = vec4(col * (0.5 + uPower), a * (0.35 + 0.65 * uPower));
      }`,
  });
}

// ---------- GOD RAY (Level 3 spotlight cone) ----------
export function GodRayMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vNormal; varying vec3 vView;
      void main(){
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec2 vUv; varying vec3 vNormal; varying vec3 vView;
      uniform float uTime;
      void main(){
        // bright at the top (uv.y = 1), fading down; softer at silhouette edges
        float vertical = smoothstep(0.0, 0.4, vUv.y) * (0.4 + 0.6 * vUv.y);
        float rim = abs(dot(normalize(vNormal), normalize(vView)));
        float flicker = 0.85 + 0.1 * sin(uTime * 7.0) + 0.05 * sin(uTime * 13.7);
        gl_FragColor = vec4(vec3(0.85, 0.8, 1.0),
                            vertical * rim * 0.35 * flicker);
      }`,
  });
}

// ---------- DISSOLVE (Level 3 — the world breaks apart) ----------
// uDissolve goes 0 -> 1 as the boss loses HP. Feed it from game state.
export function DissolveMaterial(noiseTex, baseColor = 0x23232e) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: false,
    uniforms: {
      uDissolve: { value: 0 },
      uNoise: { value: noiseTex },
      uBase: { value: new THREE.Color(baseColor) },
      uEdge: { value: new THREE.Color(0xffa726) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uDissolve; uniform sampler2D uNoise;
      uniform vec3 uBase; uniform vec3 uEdge;
      void main(){
        float n = texture2D(uNoise, vUv).r;
        if (n < uDissolve) discard;              // eaten away
        float edge = 1.0 - smoothstep(uDissolve, uDissolve + 0.08, n);
        vec3 col = mix(uBase, uEdge, edge);      // glowing fracture rim
        col *= 0.7 + 0.3 * vUv.y;                // cheap fake shading
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// ---------- DISSOLVE INJECTION (enemy corpse burn-out) ----------
// DissolveMaterial above is for standalone meshes. Skinned characters
// need the standard pipeline (skin + textures + lights), so this helper
// injects the same dissolve math into existing materials via
// onBeforeCompile instead of replacing them. Every material of one model
// shares a single uDissolve uniform object — drive that one value and the
// whole corpse burns away in sync.
export function createNoiseTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.floor(Math.random() * 256);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // Two blur passes turn the white noise into blobby clouds, so the
  // dissolve eats the model in patches instead of as pixel static.
  for (let pass = 0; pass < 2; pass++) {
    ctx.save();
    ctx.filter = 'blur(2px)';
    ctx.drawImage(c, 0, 0);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

let _sharedNoise = null;
export function sharedDissolveNoise() {
  if (!_sharedNoise) _sharedNoise = createNoiseTexture(128);
  return _sharedNoise;
}

export function applyDissolveToModel(root, noiseTex, edgeColor = 0xffa726) {
  const uniforms = { uDissolve: { value: 0 } };
  let touched = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of mats) {
      // Sample the noise with the mesh's own map UVs; materials without
      // a map dissolve as one unit (fine — they're tiny sub-meshes).
      const uvExpr = mat.map ? 'vMapUv' : 'vec2(0.5, 0.5)';
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uDissolve = uniforms.uDissolve;
        shader.uniforms.uNoise = { value: noiseTex };
        shader.uniforms.uEdge = { value: new THREE.Color(edgeColor) };
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            '#include <common>\nuniform float uDissolve;\nuniform sampler2D uNoise;\nuniform vec3 uEdge;'
          )
          .replace(
            '#include <dithering_fragment>',
            `float dN = texture2D(uNoise, ${uvExpr}).r;
             if (dN < uDissolve) discard;
             float dEdge = 1.0 - smoothstep(uDissolve, uDissolve + 0.08, dN);
             gl_FragColor.rgb += uEdge * dEdge * 1.5;
             #include <dithering_fragment>`
          );
      };
      mat.needsUpdate = true;
      touched++;
    }
  });
  return touched ? uniforms : null;
}

