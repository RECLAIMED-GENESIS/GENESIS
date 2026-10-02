// shaders/scanHighlight.js
// Scanner highlight used in every level: an additive fresnel shell that
// wraps clue meshes while the scanner is on. Glow is strongest at the
// silhouette and pulses gently, so clues read as "alive" from any angle.

import * as THREE from 'three';

const VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 1.8);
  float pulse = 0.78 + 0.22 * sin(uTime * 4.0);
  float alpha = fresnel * uIntensity * pulse;
  gl_FragColor = vec4(uColor, alpha);
}
`;

export function makeScanMaterial(color = 0x7ff5e0) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: 1.0 },
      uTime: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

