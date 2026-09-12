import * as THREE from 'three'
import { ColorShiftMesh } from './ColorShiftMaterial.js'

/**
 * Task 1 - standalone demo scene.
 *
 * Boots a tiny Three.js scene that shows the colour-shift ShaderMaterial
 * running live. This file is intentionally self-contained: it does NOT
 * touch the main game (main.js) so the shader work can be developed and
 * previewed on its own.
 *
 * Run with:  npm run dev   then open  /shader-demo.html
 */
export function startShaderDemo(container = document.body) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x111111)

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  )
  camera.position.set(0, 0, 4)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.appendChild(renderer.domElement)

  // The shader demo mesh (adds itself to the scene).
  const colorShift = new ColorShiftMesh(scene, {
    colorA: '#00ffff',
    colorB: '#ff00aa',
    speed: 1.5
  })

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  const clock = new THREE.Clock()

  function animate() {
    requestAnimationFrame(animate)
    const delta = clock.getDelta()

    // Push time into the shader uniforms so the colour animates.
    colorShift.update(delta)

    renderer.render(scene, camera)
  }

  animate()

  return { scene, camera, renderer, colorShift }
}

// Auto-start when this module is loaded by the demo page.
startShaderDemo()
