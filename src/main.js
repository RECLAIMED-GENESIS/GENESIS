import * as THREE from 'three'
import { initLevel1, updateLevel1 } from './levels/level1_new.js'
import { initLevel2, updateLevel2 } from './levels/Level2.js'
import { initLevel3, updateLevel3, isArchitectDefeated } from './levels/Level3.js'
import { playerMesh } from './player/Player.js'

// =====================================================
// SCENE
// =====================================================

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x111111)

// =====================================================
// CAMERAS
// =====================================================

// Level 1 — orthographic top-down, per the brief:
// "Orthographic (2D-style) camera — nowhere else in the game"
const level1Camera = new THREE.OrthographicCamera(
  -12, 12, 9, -9, 0.1, 1000
)
level1Camera.position.set(0, 20, 0)
level1Camera.rotation.set(-Math.PI / 2, 0, 0)

// Levels 2 & 3 — normal 3D perspective
const perspectiveCamera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
perspectiveCamera.position.set(0, 5, 10)
perspectiveCamera.lookAt(0, 0, 0)

let camera = level1Camera

// =====================================================
// RENDERER
// =====================================================

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)

// =====================================================
// AMBIENT/GLOBAL LIGHTS
// (kept minimal — each level module adds its own lighting rig;
//  this is just a safety fallback so nothing renders pure black
//  for a frame before a level's own lights are added)
// =====================================================

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
scene.add(ambientLight)

// =====================================================
// INPUT
// =====================================================

const keys = {}

window.addEventListener('keydown', (event) => {
  keys[event.code] = true

  // ---------------------------------------------------
  // DEBUG LEVEL SELECTOR
  // Reloads the page and restarts fresh at the chosen level,
  // rather than hot-swapping — see note above about why the
  // old in-place dispose()-based swap doesn't fit this
  // shared-scene/shared-physics-world architecture yet.
  // ---------------------------------------------------

  if (event.code === 'Digit1') goToLevelFresh(1)
  if (event.code === 'Digit2') goToLevelFresh(2)
  if (event.code === 'Digit3') goToLevelFresh(3)
})

window.addEventListener('keyup', (event) => {
  keys[event.code] = false
})

function goToLevelFresh(levelNumber) {
  const url = new URL(window.location.href)
  url.searchParams.set('level', String(levelNumber))
  window.location.href = url.toString()
}

// =====================================================
// MOUSE LOOK — Levels 2 & 3 only (perspective camera).
// Level 1's orthographic top-down camera never uses this.
// =====================================================

let yaw = 0
let pitch = 0
const mouseSensitivity = 0.0025

renderer.domElement.addEventListener('click', () => {
  if (currentLevelNumber === 1) return
  renderer.domElement.requestPointerLock()
})

document.addEventListener('mousemove', (event) => {
  if (currentLevelNumber === 1) return
  if (document.pointerLockElement !== renderer.domElement) return

  yaw -= event.movementX * mouseSensitivity
  pitch -= event.movementY * mouseSensitivity

  const maxPitch = Math.PI / 2 - 0.05
  pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch))

  perspectiveCamera.rotation.order = 'YXZ'
  perspectiveCamera.rotation.y = yaw
  perspectiveCamera.rotation.x = pitch
})

// =====================================================
// RESIZE
// =====================================================

window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight

  const viewHeight = 18
  const viewWidth = viewHeight * aspect
  level1Camera.left = -viewWidth / 2
  level1Camera.right = viewWidth / 2
  level1Camera.top = viewHeight / 2
  level1Camera.bottom = -viewHeight / 2
  level1Camera.updateProjectionMatrix()

  perspectiveCamera.aspect = aspect
  perspectiveCamera.updateProjectionMatrix()

  renderer.setSize(window.innerWidth, window.innerHeight)
})

// =====================================================
// LEVEL STATE / TRANSITIONS
// =====================================================

let currentLevelNumber = 1
const clock = new THREE.Clock()

function goToLevel2() {
  currentLevelNumber = 2
  camera = perspectiveCamera
  yaw = 0
  pitch = 0
  console.log('Transitioning to Level 2')
  initLevel2(scene, camera, keys, () => goToLevel3())
}

function goToLevel3() {
  currentLevelNumber = 3
  camera = perspectiveCamera
  yaw = 0
  pitch = 0
  console.log('Transitioning to Level 3')
  initLevel3(scene, camera, keys, () => {
    console.log('THE ARCHITECT IS DEFEATED — game complete')
    // TODO(Banele): win screen — brief calls for "short ending
    // text and return to menu button"; not built in either branch.
  })
}

function startAtLevel(levelNumber) {
  if (levelNumber === 2) {
    currentLevelNumber = 2
    camera = perspectiveCamera
    initLevel2(scene, camera, keys, () => goToLevel3())
  } else if (levelNumber === 3) {
    currentLevelNumber = 3
    camera = perspectiveCamera
    initLevel3(scene, camera, keys, () => {
      console.log('THE ARCHITECT IS DEFEATED — game complete')
    })
  } else {
    currentLevelNumber = 1
    camera = level1Camera
    initLevel1(scene, camera, keys, () => goToLevel2())
  }
}

// Read ?level=N from the URL (used by the debug selector above);
// defaults to Level 1 for a normal game start.
const params = new URLSearchParams(window.location.search)
const requestedLevel = parseInt(params.get('level'), 10) || 1
startAtLevel(requestedLevel)

// =====================================================
// LEVEL 1 CAMERA FOLLOW
// Orthographic top-down camera tracking playerMesh — see note
// above: this didn't exist in either original branch and needs
// a feel-check against the brief's "side-scrolling arena fighter"
// description (a true side-scroller typically locks one axis).
// =====================================================

function updateLevel1Camera() {
  camera.position.x = THREE.MathUtils.clamp(playerMesh.position.x, -10, 10)
  camera.position.z = THREE.MathUtils.clamp(playerMesh.position.z, -6, 6)
  camera.position.y = 20
  camera.rotation.set(-Math.PI / 2, 0, 0)
}

// =====================================================
// ANIMATION LOOP
// =====================================================

function animate() {
  requestAnimationFrame(animate)
  const delta = Math.min(clock.getDelta(), 0.05)

  if (currentLevelNumber === 1) {
    updateLevel1Camera()
    updateLevel1(delta, keys)
  } else if (currentLevelNumber === 2) {
    updateLevel2(delta, keys)
  } else if (currentLevelNumber === 3) {
    updateLevel3(delta, keys)
  }

  renderer.render(scene, camera)
}

animate()