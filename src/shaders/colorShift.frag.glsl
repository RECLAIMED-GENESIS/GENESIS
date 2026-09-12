// ============================================================
// FRAGMENT SHADER  (runs once per pixel)
// ============================================================
// Task 1 - GLSL basics: a fragment shader that CHANGES COLOUR
// OVER TIME using a UNIFORM.
//
// UNIFORM   -> shared value set from JavaScript.
// VARYING   -> interpolated value received from the vertex shader.
// gl_FragColor -> the final RGBA colour of this pixel.
// ------------------------------------------------------------

precision mediump float;

// --- Uniforms (set from JS) ---
uniform float uTime;    // elapsed time in seconds -> drives the animation
uniform vec3  uColorA;  // first colour of the blend
uniform vec3  uColorB;  // second colour of the blend
uniform float uSpeed;   // how fast the colour cycles

// --- Varyings (from the vertex shader) ---
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  // sin() returns a value in [-1, 1]; map it to [0, 1] so it can
  // be used as a blend factor that oscillates over TIME.
  float mixer = sin(uTime * uSpeed) * 0.5 + 0.5;

  // Add a subtle gradient across the surface using the uv varying
  // so different parts of the mesh shift slightly out of phase.
  mixer = clamp(mixer + vUv.y * 0.25, 0.0, 1.0);

  // Blend between the two colours -> the colour changes over time.
  vec3 color = mix(uColorA, uColorB, mixer);

  // Fake a little lighting using the normal for depth.
  float light = dot(normalize(vNormal), normalize(vec3(0.5, 1.0, 0.5)));
  light = light * 0.5 + 0.5; // remap [-1,1] -> [0,1]

  gl_FragColor = vec4(color * light, 1.0);
}
