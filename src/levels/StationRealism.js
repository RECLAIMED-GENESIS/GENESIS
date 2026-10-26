// Procedural grime and painted wall shading for the station interior.
import * as THREE from 'three';

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
