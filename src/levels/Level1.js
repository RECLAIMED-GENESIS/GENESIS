import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
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
const FRAGMENTS_NEEDED = 8 // TODO: brief says 3 — confirm with team and update
const fragments = []

let terminalActive = false
let terminalVisible = false
let terminalMesh = null
let screenMesh = null
let portalActive = false
let portalMesh = null
let floorBody = null

// Templates cloned out of Level1.glb at spawn time (set once the model loads)
let fragmentTemplate = null
let portalTemplateGroup = null // all meshes tagged as portal parts, kept together

function spawnFragment(position) {
  let fragmentMesh

  if (fragmentTemplate) {
    fragmentMesh = fragmentTemplate.clone()
    fragmentMesh.material = fragmentTemplate.material // clone() shares material by default; explicit for clarity
  } else {
    // Fallback primitive in case the model hasn't loaded / has no fragment mesh yet
    const fragmentGeo = new THREE.OctahedronGeometry(0.4)
    const fragmentMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 0.5
    })
    fragmentMesh = new THREE.Mesh(fragmentGeo, fragmentMat)
  }

  fragmentMesh.position.set(position.x, 1, position.z)
  fragmentMesh.visible = true
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
  if (terminalMesh) terminalMesh.visible = true
  if (screenMesh) screenMesh.visible = true
  console.log('Terminal appeared - walk up and press E to insert fragments')
}

function activatePortal() {
  portalActive = true
  if (portalMesh) portalMesh.visible = true
  if (portalTemplateGroup) {
    portalTemplateGroup.forEach(part => { part.visible = true })
  }
  console.log('Portal is open')
}

let onLevel1Complete = null

function initLevel1(gameScene, gameCamera, keys, onComplete) {
  onLevel1Complete = onComplete
  scene = gameScene
  camera = gameCamera

  // =========================================================
  // FALLBACK PHYSICS FLOOR + WALLS
  // (Invisible collision volumes — visuals come from Level1.glb.
  //  Sized to match Pumelela's arena; adjust bounds once the model
  //  is final, or replace with bodies generated from the model's
  //  bounding box.)
  // =========================================================

  floorBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane()
  })
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  physicsWorld.addBody(floorBody)
  setupJump(floorBody)

  const wallConfigs = [
    { pos: [0, 2.5, -10], rot: [0, 0, 0],           size: [20, 5, 0.5] },
    { pos: [0, 2.5,  10], rot: [0, 0, 0],           size: [20, 5, 0.5] },
    { pos: [-10, 2.5, 0], rot: [0, Math.PI / 2, 0], size: [20, 5, 0.5] },
    { pos: [ 10, 2.5, 0], rot: [0, Math.PI / 2, 0], size: [20, 5, 0.5] },
  ]

  wallConfigs.forEach(({ pos, rot, size }) => {
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

  // =========================================================
  // TERMINAL (not part of the Blender level yet — hand-built
  // until Pumelela adds a TERMINAL-tagged object to Level1.glb)
  // =========================================================

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

  // Fallback portal (used until/unless the model supplies portal parts)
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

  // =========================================================
  // LOAD PUMELELA'S BLENDER LEVEL (art only — no gameplay
  // logic lives in this callback)
  // =========================================================

  loadLevelArt(scene)
}

function loadLevelArt(scene) {
  const loader = new GLTFLoader()

  loader.load(
    '/assets/models/Level1.glb',
    (gltf) => {
      const model = gltf.scene
      model.position.set(0, 0, 0)

      const portalParts = []

      model.traverse((object) => {
        if (!object.isMesh) return

        object.castShadow = true
        object.receiveShadow = true

        const materialName = object.material?.name || ''

        switch (materialName) {
          // --- Floor ---
          case 'PIXEL_FLOOR':
          case 'PIXEL_FLOOR_LIGHT':
          case 'PIXEL_FLOOR_DARK':
            // visual only — collision handled by floorBody above
            break

          // --- Decorative background labourers/guards (brief calls
          // for "background labourers" — these are NOT the real
          // combat enemies, which come from Enemy.js/EnemyWave.js) ---
          case 'ENEMY_RED':
          case 'ENEMY_DARK':
          case 'ENEMY_RED_LIGHT':
            object.userData.isBackgroundNPC = true
            break

          // --- Glitch fragment template: pull the first one out as
          // a clone source, hide any others placed in the scene so
          // they don't act as free static pickups ---
          case 'GLITCH_FRAGMENT_ORANGE':
          case 'GLITCH_FRAGMENT_CORE':
            if (!fragmentTemplate) {
              fragmentTemplate = object.clone()
            }
            object.visible = false
            break

          // --- Portal: keep in the scene, start hidden, driven by
          // activatePortal()/portalActive exactly like the old
          // torus mesh was ---
          case 'PORTAL_CYAN':
          case 'PORTAL_CORE':
          case 'PORTAL_FRAME':
            object.visible = false
            portalParts.push(object)
            break

          default:
            break
        }
      })

      portalTemplateGroup = portalParts
      scene.add(model)

      console.log('Level 1 art loaded:', {
        fragmentTemplateFound: !!fragmentTemplate,
        portalParts: portalParts.length
      })
    },
    (progress) => {
      if (progress.total > 0) {
        const percent = Math.round((progress.loaded / progress.total) * 100)
        console.log('Level 1 art loading:', percent + '%')
      }
    },
    (error) => {
      console.error('ERROR: Could not load Level1.glb — falling back to primitive floor/walls only.')
      console.error(error)
    }
  )
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
    if (portalTemplateGroup) {
      portalTemplateGroup.forEach(part => { part.rotation.y += 0.01 })
    }
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