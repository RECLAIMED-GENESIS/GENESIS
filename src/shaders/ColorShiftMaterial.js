import * as THREE from 'three'

// Vite lets us import a file's raw text with the `?raw` suffix.
// That is how we load our .glsl shader source into JavaScript.
import vertexShader from './colorShift.vert.glsl?raw'
import fragmentShader from './colorShift.frag.glsl?raw'

/**
 * Creates a THREE.ShaderMaterial for the colour-shift effect.
 *
 * UNIFORMS are declared here (JavaScript side) and read inside the
 * .glsl files (GPU side). Their `value` can be updated every frame.
 *
 * @param {object} [options]
 * @param {THREE.ColorRepresentation} [options.colorA] first blend colour
 * @param {THREE.ColorRepresentation} [options.colorB] second blend colour
 * @param {number} [options.speed]    colour cycle speed
 * @returns {THREE.ShaderMaterial}
 */
export function createColorShiftMaterial(options = {}) {
  const {
    colorA = '#00ffff',
    colorB = '#ff00aa',
    speed = 1.5
  } = options

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime:   { value: 0 },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uSpeed:  { value: speed }
    }
  })
}

/**
 * A ready-to-use demo mesh driven by the colour-shift ShaderMaterial.
 * Mirrors the PlayerMesh / EnemyMesh pattern used elsewhere in the project:
 * it adds itself to the scene and exposes an update() for the render loop.
 */
export class ColorShiftMesh {
  /**
   * @param {THREE.Scene} scene
   * @param {object} [options] forwarded to createColorShiftMaterial
   */
  constructor(scene, options = {}) {
    this.scene = scene

    this.geometry = new THREE.IcosahedronGeometry(1, 4)
    this.material = createColorShiftMaterial(options)

    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.scene.add(this.mesh)
  }

  /**
   * Advance the animation. Call this once per frame from the render loop.
   * @param {number} delta seconds since the last frame
   */
  update(delta) {
    // Feed elapsed time into the uTime uniform -> the fragment shader
    // uses it to change colour over time.
    this.material.uniforms.uTime.value += delta
    this.mesh.rotation.y += delta * 0.3
  }

  dispose() {
    this.scene.remove(this.mesh)
    this.geometry.dispose()
    this.material.dispose()
  }
}
