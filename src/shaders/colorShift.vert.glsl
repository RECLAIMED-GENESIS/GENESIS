// ============================================================
// VERTEX SHADER  (runs once per vertex)
// ============================================================
// Task 1 - GLSL basics: ATTRIBUTES and VARYINGS
//
// ATTRIBUTE  -> per-vertex input data.
//   Three.js automatically feeds these built-in attributes in:
//     - position : vec3  (the vertex position)
//     - normal   : vec3  (the vertex normal)
//     - uv       : vec2  (texture coordinates)
//   They are already declared for us by Three.js, so we do NOT
//   re-declare them here.
//
// VARYING    -> a value we send from the vertex shader to the
//   fragment shader. It is INTERPOLATED across the surface of
//   the triangle between vertices.
//
// UNIFORM    -> a value shared by every vertex/fragment for a
//   single draw call (set from JavaScript).
// ------------------------------------------------------------

// Uniform driven by JavaScript - we gently wobble the mesh over time.
uniform float uTime;

// Varyings handed over to the fragment shader.
varying vec2 vUv;      // interpolated texture coordinates
varying vec3 vNormal;  // interpolated vertex normal

void main() {
  // Pass the built-in attributes through to the fragment shader
  // as varyings so they get interpolated across each face.
  vUv = uv;
  vNormal = normal;

  // Small animated displacement so you can SEE the vertex shader
  // doing work (attributes -> position). This is optional flavour.
  vec3 displaced = position + normal * sin(uTime + position.y * 2.0) * 0.05;

  // gl_Position is a required output: the vertex in clip space.
  // modelViewMatrix and projectionMatrix are provided by Three.js.
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
