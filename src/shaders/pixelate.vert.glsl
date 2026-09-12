// ============================================================
// POST-PROCESSING VERTEX SHADER  (fullscreen quad)
// ============================================================
// Task 2 - Pixelation.
//
// A post-processing pass does not draw a model; it draws a single
// fullscreen quad and paints every pixel using a fragment shader.
// All this vertex shader does is forward the quad's texture
// coordinates (uv) to the fragment shader as a varying.
// ------------------------------------------------------------

varying vec2 vUv; // screen-space texture coordinate [0..1]

void main() {
  vUv = uv;
  // position / projectionMatrix / modelViewMatrix are supplied by Three.js.
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
