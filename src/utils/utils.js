// ============================================================
// utils.js — helpers every level shares
// Noise, procedural canvas textures (no external files needed!)
// ============================================================
import * as THREE from 'three';

// ---------- seeded random (so the map looks the same every load) ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 2D value noise + fractal noise (for terrain) ----------
const _rand = mulberry32(1337);
const _perm = new Uint8Array(512);
{
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(_rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) _perm[i] = p[i & 255];
}
function _val(ix, iy) {
  return _perm[(_perm[ix & 255] + iy) & 255] / 255;
}
export function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = _val(ix, iy),     b = _val(ix + 1, iy);
  const c = _val(ix, iy + 1), d = _val(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
export function fbm2(x, y, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * noise2(x * f, y * f); f *= 2; amp *= 0.5; }
  return v; // roughly 0..1
}

// smoothstep that works even when a > b (handy for "near river" masks)
export function sstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ---------- canvas texture factory ----------
// draw(ctx, size) paints one square canvas; we wrap it as a texture.
export function canvasTexture(size, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// building facade: dark concrete + a grid of windows, some lit, some dark.
// used as BOTH map and emissiveMap, so lit windows glow at night.
export function windowTexture(seed = 42) {
  const rnd = mulberry32(seed);
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#0b0d13';
    g.fillRect(0, 0, s, s);
    const cols = 6, rows = 12, cw = s / cols, ch = s / rows;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const lit = rnd() < 0.34;
      const px = x * cw + cw * 0.22, py = y * ch + ch * 0.2;
      const w = cw * 0.56, h = ch * 0.55;
      if (lit) {
        const warm = 200 + Math.floor(rnd() * 55);
        g.fillStyle = `rgb(${warm},${170 + Math.floor(rnd() * 50)},${100 + Math.floor(rnd() * 60)})`;
      } else {
        g.fillStyle = '#141b2a';
      }
      g.fillRect(px, py, w, h);
    }
  });
}

// wet asphalt: speckled surface + a roughness map
// (dark pixels in the roughness map = smooth = shiny = wet look)
// Base tone raised well above near-black so it actually reads as a
// road under normal lighting instead of blending into the fog/shadow.
export function asphaltTextures() {
  const rnd = mulberry32(7);
  const map = canvasTexture(256, (g, s) => {
    g.fillStyle = '#3a3f48'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 4000; i++) {
      const v = 46 + Math.floor(rnd() * 40);
      g.fillStyle = `rgba(${v},${v + 4},${v + 10},0.6)`;
      g.fillRect(rnd() * s, rnd() * s, 2, 2);
    }
  });
  const roughnessMap = canvasTexture(256, (g, s) => {
    g.fillStyle = '#3c3c3c'; g.fillRect(0, 0, s, s); // mostly smooth
    for (let i = 0; i < 40; i++) {                    // puddles-ish patches
      g.fillStyle = 'rgba(20,20,20,0.8)';
      g.beginPath();
      g.ellipse(rnd() * s, rnd() * s, 10 + rnd() * 30, 8 + rnd() * 20, rnd() * 3, 0, 7);
      g.fill();
    }
  }, { srgb: false });
  return { map, roughnessMap };
}

// road markings: dashed centre line + solid edge lines on transparent-ish
// dark ground, laid over the asphalt as a second decal plane so the road
// reads clearly as a ROAD even in low light.
export function roadMarkingsTexture() {
  return canvasTexture(512, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = 'rgba(0,0,0,0)';
    g.fillRect(0, 0, s, s);
    // dashed centre line running the length (v axis)
    g.fillStyle = '#e8d98a';
    const dashH = s * 0.09, gap = s * 0.06, w = s * 0.02;
    for (let y = 0; y < s; y += dashH + gap) {
      g.fillRect(s / 2 - w / 2, y, w, dashH);
    }
    // solid edge lines
    g.fillStyle = 'rgba(232,217,138,0.85)';
    g.fillRect(s * 0.06, 0, s * 0.012, s);
    g.fillRect(s * 0.94 - s * 0.012, 0, s * 0.012, s);
  }, { srgb: true });
}

// dark metal facility wall panel: riveted plates + glowing seam lines —
// used for the guarded portal facility in Level 2.
export function facilityPanelTexture(seed = 3) {
  const rnd = mulberry32(seed);
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#20242c'; g.fillRect(0, 0, s, s);
    const cols = 3, rows = 5, cw = s / cols, ch = s / rows;
    g.strokeStyle = 'rgba(120,170,200,0.55)'; g.lineWidth = 2;
    for (let x = 0; x <= cols; x++) { g.beginPath(); g.moveTo(x * cw, 0); g.lineTo(x * cw, s); g.stroke(); }
    for (let y = 0; y <= rows; y++) { g.beginPath(); g.moveTo(0, y * ch); g.lineTo(s, y * ch); g.stroke(); }
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const shade = 26 + Math.floor(rnd() * 14);
      g.fillStyle = `rgb(${shade+8},${shade+12},${shade+18})`;
      g.fillRect(x * cw + 4, y * ch + 4, cw - 8, ch - 8);
      g.fillStyle = '#0c0e12';
      for (const [rx, ry] of [[6, 6], [cw - 10, 6], [6, ch - 10], [cw - 10, ch - 10]]) {
        g.beginPath(); g.arc(x * cw + rx, y * ch + ry, 2.4, 0, 7); g.fill();
      }
    }
  });
}

// tech floor: visible panel grid + glowing conduit lines, for interior
// spaces (Level 3 throne room) so the floor is never just flat black.
export function techFloorTexture(seed = 11, glow = '#3fd0ff') {
  const rnd = mulberry32(seed);
  return canvasTexture(512, (g, s) => {
    g.fillStyle = '#232733'; g.fillRect(0, 0, s, s);
    const n = 8, cell = s / n;
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
      const shade = 30 + Math.floor(rnd() * 18);
      g.fillStyle = `rgb(${shade+18},${shade+20},${shade+28})`;
      g.fillRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6);
    }
    g.strokeStyle = glow; g.lineWidth = 2.5; g.globalAlpha = 0.8;
    for (let x = 0; x <= n; x++) {
      if (rnd() > 0.4) continue;
      g.beginPath(); g.moveTo(x * cell, 0); g.lineTo(x * cell, s); g.stroke();
    }
    for (let y = 0; y <= n; y++) {
      if (rnd() > 0.4) continue;
      g.beginPath(); g.moveTo(0, y * cell); g.lineTo(s, y * cell); g.stroke();
    }
    g.globalAlpha = 1;
  });
}

// static night sky: black + stars (Levels 1 & 3 background)
export function starTexture(seed = 99, tint = '#cfe8ff') {
  const rnd = mulberry32(seed);
  return canvasTexture(1024, (g, s) => {
    g.fillStyle = '#020207'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const x = rnd() * s, y = rnd() * s, r = rnd();
      g.globalAlpha = 0.25 + rnd() * 0.75;
      g.fillStyle = r < 0.85 ? '#ffffff' : tint;
      const rad = r < 0.9 ? 1 : 1.8;
      g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  });
}

// grayscale noise texture — fed to the dissolve shader (Level 3)
export function dissolveNoiseTexture(size = 256) {
  return canvasTexture(size, (g, s) => {
    const img = g.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      // tileable-ish fbm: sample noise on a torus using two circle coords
      const a = (x / s) * Math.PI * 2, b = (y / s) * Math.PI * 2;
      const v = fbm2(3 + 2 * Math.cos(a) + 1.3 * Math.cos(b),
                     5 + 2 * Math.sin(a) + 1.3 * Math.sin(b), 4);
      const k = (y * s + x) * 4;
      const c = Math.floor(v * 255);
      img.data[k] = img.data[k + 1] = img.data[k + 2] = c;
      img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
}
