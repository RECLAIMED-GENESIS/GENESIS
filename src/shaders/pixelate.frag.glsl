// ============================================================
// POST-PROCESSING FRAGMENT SHADER  (pixelation)
// ============================================================
// Task 2 - make the whole scene look like pixel art.
//
// Idea:
//   1. The already-rendered scene is handed to us as a texture
//      (tDiffuse) by the post-processing pipeline.
//   2. Instead of sampling it at the exact pixel, we SNAP the
//      texture coordinate to a coarse grid of "big pixels".
//   3. Every fragment inside one grid cell reads the SAME colour,
//      which produces the chunky pixel-art look.
//
// The grid size is driven by the uPixelSize uniform (in screen
// pixels), so we can turn the effect up/down from JavaScript.
//
// Task 3 adds uFade: it smoothly blends the result from full
// pixel art (uFade = 0) to a clear image (uFade = 1). This lets the
// world sharpen as the player approaches / activates the portal.
// ------------------------------------------------------------

precision mediump float;

uniform sampler2D tDiffuse;   // the rendered scene (ShaderPass convention)
uniform float     uPixelSize; // width/height of each blocky "pixel"
uniform vec2      uResolution;// render target size in pixels
uniform float     uFade;      // 0 = pixel art, 1 = fully clear

varying vec2 vUv;

void main() {
  // Guard against a zero/negative pixel size (would divide by zero).
  float pixelSize = max(uPixelSize, 1.0);

  // How many big pixels fit across the screen on each axis.
  vec2 pixelCount = uResolution / pixelSize;

  // Snap the uv to the lower-left corner of its cell, then step to
  // the cell CENTRE so we sample a stable colour for the whole block.
  vec2 cellUv = floor(vUv * pixelCount) / pixelCount;
  vec2 sampleUv = cellUv + (0.5 / pixelCount);

  // The chunky pixel-art colour and the sharp, un-pixelated colour.
  vec4 pixelated = texture2D(tDiffuse, sampleUv);
  vec4 clear = texture2D(tDiffuse, vUv);

  // Blend toward the clear image as uFade goes 0 -> 1.
  float fade = clamp(uFade, 0.0, 1.0);
  gl_FragColor = mix(pixelated, clear, fade);
}
