import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

// Load the GLSL source as raw text via Vite's `?raw` suffix.
import vertexShader from './pixelate.vert.glsl?raw'
import fragmentShader from './pixelate.frag.glsl?raw'

/**
 * Shader definition for the pixelation post-process.
 *
 * This object follows the exact shape Three.js expects for a ShaderPass:
 *   { uniforms, vertexShader, fragmentShader }.
 *
 * UNIFORMS
 *   tDiffuse    -> the rendered scene texture (auto-filled by ShaderPass)
 *   uPixelSize  -> size of each blocky pixel (THIS is the task's control)
 *   uResolution -> render target size, needed to build the pixel grid
 *   uFade       -> 0 = pixel art, 1 = clear (Task 3 portal transition)
 */
export const PixelationShader = {
  uniforms: {
    tDiffuse:    { value: null },
    uPixelSize:  { value: 8 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uFade:       { value: 0 }
  },
  vertexShader,
  fragmentShader
}

/**
 * Creates a ShaderPass that pixelates whatever was rendered before it.
 * @param {number} [pixelSize=8] initial blocky-pixel size
 * @returns {ShaderPass}
 */
export function createPixelationPass(pixelSize = 8) {
  const pass = new ShaderPass(PixelationShader)
  pass.uniforms.uPixelSize.value = pixelSize
  return pass
}

/**
 * Owns the post-processing pipeline for a scene:
 *   RenderPass (draw the scene) -> PixelationPass (make it pixel art).
 *
 * Usage in any scene (including the real Level 1 later):
 *   const fx = new PixelationEffect(scene, camera, renderer, 8)
 *   ... in the render loop:  fx.render()
 *   ... on resize:           fx.setSize(w, h)
 */
export class PixelationEffect {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {THREE.WebGLRenderer} renderer
   * @param {number} [pixelSize=8]
   */
  constructor(scene, camera, renderer, pixelSize = 8) {
    this.renderer = renderer

    this.composer = new EffectComposer(renderer)
    this.composer.addPass(new RenderPass(scene, camera))

    this.pixelationPass = createPixelationPass(pixelSize)
    this.composer.addPass(this.pixelationPass)

    // Match the current drawing-buffer size so the pixel grid is correct.
    const size = renderer.getSize(new THREE.Vector2())
    this.setSize(size.x, size.y)
  }

  /** Change the blocky-pixel size at runtime. */
  setPixelSize(pixelSize) {
    this.pixelationPass.uniforms.uPixelSize.value = pixelSize
  }

  /**
   * Set the pixel-art -> clear blend (Task 3).
   * @param {number} fade 0 = full pixel art, 1 = fully clear
   */
  setFade(fade) {
    this.pixelationPass.uniforms.uFade.value = fade
  }

  /** Keep the pixel grid in sync with the canvas size (call on resize). */
  setSize(width, height) {
    this.composer.setSize(width, height)
    this.pixelationPass.uniforms.uResolution.value.set(width, height)
  }

  /** Render the scene through the post-processing chain. */
  render() {
    this.composer.render()
  }
}
