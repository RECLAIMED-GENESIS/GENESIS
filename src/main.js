import * as THREE from 'three'
import { initLevel1, updateLevel1 } from './levels/Level1.js'
import { initLevel2, updateLevel2 } from './levels/Level2.js'

// SCENE
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x111111)

// CAMERA
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
camera.position.set(0, 5, 10)
camera.lookAt(0, 0, 0)

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)

// LIGHTS
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

const dirLight = new THREE.DirectionalLight(0xffffff, 1)
dirLight.position.set(5, 10, 5)
dirLight.castShadow = true
scene.add(dirLight)

// INPUT
const keys = {}
window.addEventListener('keydown', (e) => keys[e.code] = true)
window.addEventListener('keyup', (e) => keys[e.code] = false)

// RESIZE
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// CLOCK
const clock = new THREE.Clock()

// LEVEL STATE
let currentLevel = 1

function goToLevel2() {
  currentLevel = 2
  console.log('Transitioning to Level 2')
  initLevel2(scene, camera, keys, () => {
    console.log('Level 2 complete - Level 3 coming soon')
  })
}

// INIT LEVEL 1
initLevel1(scene, camera, keys, () => goToLevel2())

// ANIMATION LOOP
function animate() {
  requestAnimationFrame(animate)
  const delta = clock.getDelta()

  if (currentLevel === 1) {
    updateLevel1(delta, keys)
  } else if (currentLevel === 2) {
    updateLevel2(delta, keys)
  }

  renderer.render(scene, camera)
}

animate()
