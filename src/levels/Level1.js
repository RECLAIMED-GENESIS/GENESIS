import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { physicsWorld } from '../physics/PhysicsWorld.js'
import { playerBody } from '../player/PlayerPhysics.js'
import { playerMesh, attackIndicator, setupCombatInput, setupJump, updatePlayer, getGameOver, getPlayerHealth, getPlayerMaxHealth, getIsDodging } from '../player/Player.js'
import { updateEnemies, getEnemies } from '../enemies/Enemy.js'
import { initWaves, onWaveComplete, getCurrentWave, getTotalWaves, isWaveInProgress, setWaveInProgress } from '../enemies/EnemyWave.js'
import { spawnCommander, updateCommander, isCommanderAlive } from '../enemies/Boss.js'
import { initHUD, updateHUD, showGameOver } from '../ui/HUD.js'

let scene = null
let camera = null
let fragmentsCollected = 0
const FRAGMENTS_NEEDED = 8
const fragments = []

let terminalActive = false
let terminalVisible = false
let terminalMesh = null
let screenMesh = null
let portalActive = false
let portalMesh = null
let floorBody = null

function spawnFragment(position) {
  const fragmentGeo = new THREE.OctahedronGeometry(0.4)
  const fragmentMat = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 0.5
  })
  const fragmentMesh = new THREE.Mesh(fragmentGeo, fragmentMat)
  fragmentMesh.position.set(position.x, 1, position.z)
  scene.add(fragmentMesh)
  fragments.push(fragmentMesh)
}

function checkFragmentCollection() {
  for (let i = fragments.length - 1; i >= 0; i--) {
    const fragment = fragments[i]
    const distance = fragment.position.distanceTo(playerMesh.position)

    if (distance < 1.5) {
      scene.remove(fragment)
      fragment.geometry.dispose()
      fragment.material.dispose()
      fragments.splice(i, 1)
      fragmentsCollected++
      console.log('Fragment collected:', fragmentsCollected, '/', FRAGMENTS_NEEDED)
    }
  }
}

function showTerminal() {
  terminalVisible = true
  terminalMesh.visible = true
  screenMesh.visible = true
  console.log('Terminal appeared - walk up and press E to insert fragments')
}

function activatePortal() {
  portalActive = true
  portalMesh.visible = true
  console.log('Portal is open')
}

let onLevel1Complete = null

function initLevel1(gameScene, gameCamera, keys, onComplete) {
  onLevel1Complete = onComplete
  scene = gameScene
  camera = gameCamera

  // Floor
  const floorGeo = new THREE.PlaneGeometry(20, 20)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  floorBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane()
  })
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  physicsWorld.addBody(floorBody)
  setupJump(floorBody)

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    transparent: true,
    opacity: 0.3
  })

  const wallConfigs = [
    { pos: [0, 2.5, -10], rot: [0, 0, 0],           size: [20, 5, 0.5] },
    { pos: [0, 2.5,  10], rot: [0, 0, 0],           size: [20, 5, 0.5] },
    { pos: [-10, 2.5, 0], rot: [0, Math.PI / 2, 0], size: [20, 5, 0.5] },
    { pos: [ 10, 2.5, 0], rot: [0, Math.PI / 2, 0], size: [20, 5, 0.5] },
  ]

  wallConfigs.forEach(({ pos, rot, size }) => {
    const wallGeo = new THREE.BoxGeometry(...size)
    const wall = new THREE.Mesh(wallGeo, wallMat)
    wall.position.set(...pos)
    wall.rotation.set(...rot)
    scene.add(wall)

    const wallBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(
        new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)
      )
    })
    wallBody.position.set(...pos)
    wallBody.quaternion.setFromEuler(...rot)
    physicsWorld.addBody(wallBody)
  })

  // Terminal
  const terminalGeo = new THREE.BoxGeometry(1.5, 2, 0.5)
  const terminalMat = new THREE.MeshStandardMaterial({
    color: 0x003333,
    emissive: 0x00ffff,
    emissiveIntensity: 0.2
  })
  terminalMesh = new THREE.Mesh(terminalGeo, terminalMat)
  terminalMesh.position.set(0, 1, -8)
  terminalMesh.visible = false
  scene.add(terminalMesh)

  const screenGeo = new THREE.PlaneGeometry(1, 1.2)
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 0.8
  })
  screenMesh = new THREE.Mesh(screenGeo, screenMat)
  screenMesh.position.set(0, 1.2, -7.74)
  screenMesh.visible = false
  scene.add(screenMesh)

  // Portal
  const portalGeo = new THREE.TorusGeometry(2, 0.3, 16, 100)
  const portalMat = new THREE.MeshStandardMaterial({
    color: 0x9900ff,
    emissive: 0x9900ff,
    emissiveIntensity: 0.8
  })
  portalMesh = new THREE.Mesh(portalGeo, portalMat)
  portalMesh.position.set(0, 2, -9)
  portalMesh.visible = false
  scene.add(portalMesh)

  // Add player and attack indicator to scene
  scene.add(playerMesh)
  scene.add(attackIndicator)

  // Setup input
  setupCombatInput()

  // Init HUD
  initHUD()

  // Start waves
  initWaves(scene, () => {
    spawnCommander(scene, () => {
      showTerminal()
    })
  })
}

function updateLevel1(delta, keys) {
  if (getGameOver()) {
    showGameOver()
    return
  }

  updatePlayer(delta, keys, camera)

  updateEnemies(delta, playerBody, playerMesh, camera)

  updateCommander(delta, playerBody, spawnFragment)

  checkFragmentCollection()

  // Terminal interaction
  if (terminalVisible && !terminalActive) {
    const distance = terminalMesh.position.distanceTo(playerMesh.position)
    if (distance < 3) {
      if (keys['KeyE']) {
        if (fragmentsCollected >= FRAGMENTS_NEEDED) {
          terminalActive = true
          activatePortal()
        } else {
          console.log('Need all fragments first:', fragmentsCollected, '/', FRAGMENTS_NEEDED)
        }
      }
    }
  }

  // Portal entry
  if (portalActive) {
    const distance = portalMesh.position.distanceTo(playerMesh.position)
    if (distance < 2.5) {
      console.log('ENTERING LEVEL 2')
      if (onLevel1Complete) onLevel1Complete()
    }
    portalMesh.rotation.z += 0.01
  }

  // Fragment rotation
  fragments.forEach(f => f.rotation.y += 0.02)

  // Terminal pulse
  if (terminalVisible && screenMesh) {
    const pulse = Math.sin(Date.now() * 0.003) * 0.3 + 0.5
    screenMesh.material.emissiveIntensity = pulse
  }

  // Wave complete check
  const enemies = getEnemies()
  if (enemies.length === 0 && isWaveInProgress()) {
    setWaveInProgress(false)
    onWaveComplete(spawnFragment)
  }

  // Step physics
  physicsWorld.step(1 / 60, delta, 3)

  // Update HUD
  updateHUD(
    getPlayerHealth(),
    getPlayerMaxHealth(),
    fragmentsCollected,
    getCurrentWave(),
    getTotalWaves(),
    isCommanderAlive()
  )
}

export { initLevel1, updateLevel1 }
