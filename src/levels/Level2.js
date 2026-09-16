import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { physicsWorld } from '../physics/PhysicsWorld.js'
import { playerBody } from '../player/PlayerPhysics.js'
import { playerMesh, attackIndicator, updatePlayer, setupJump, unlockLevel2Abilities, getGameOver, getPlayerHealth, getPlayerMaxHealth } from '../player/Player.js'
import { spawnEnemy, updateEnemies, getEnemies } from '../enemies/Enemy.js'
import { getIsAttacking, getAttackType, getHitboxBody, damagePlayer } from '../player/Player.js'
import { initHUD, updateHUD, showGameOver } from '../ui/HUD.js'

// MINI BOSS
let miniBoss = null
const MINIBOSS_HEALTH = 80
let miniBossAlive = false
let miniBossDefeated = false
let onMiniBossDefeated = null

// LEVEL STATE
let scene = null
let camera = null
let level2Active = false
let enemiesSpawned = false

// ENEMY WAVE FOR LEVEL 2
const level2Waves = [
  { spawns: [
    { type: 'fast' }, { type: 'fast' },
    { type: 'normal' }, { type: 'normal' }
  ]},
  { spawns: [
    { type: 'heavy' }, { type: 'heavy' },
    { type: 'fast' }, { type: 'fast' }, { type: 'fast' }
  ]},
  { spawns: [
    { type: 'tank' },
    { type: 'heavy' }, { type: 'heavy' },
    { type: 'fast' }, { type: 'fast' }
  ]}
]

let currentL2Wave = 0
let l2WaveInProgress = false

function spawnL2Wave() {
  if (currentL2Wave >= level2Waves.length) {
    console.log('All Level 2 waves done - mini boss spawns')
    setTimeout(() => spawnMiniBoss(), 2000)
    return
  }

  l2WaveInProgress = true
  const config = level2Waves[currentL2Wave]
  currentL2Wave++
  console.log('Level 2 wave', currentL2Wave, 'starting')

  config.spawns.forEach(s => {
    spawnEnemy(scene, s.type, null)
  })
}

// MINI BOSS
function spawnMiniBoss() {
  if (miniBossAlive) return
  miniBossAlive = true
  console.log('Mini boss spawns')

  const geo = new THREE.BoxGeometry(2, 2, 2)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x9900ff,
    emissive: 0x6600cc,
    emissiveIntensity: 0.4
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  scene.add(mesh)

  const body = new CANNON.Body({
    mass: 3,
    shape: new CANNON.Box(new CANNON.Vec3(1, 1, 1)),
    position: new CANNON.Vec3(0, 1, -7),
    linearDamping: 0.95
  })
  physicsWorld.addBody(body)

  miniBoss = {
    mesh,
    body,
    health: MINIBOSS_HEALTH,
    attackTimer: 0,
    chargeTimer: 3,
    isCharging: false,
    chargeDir: new CANNON.Vec3(),
    dashTimer: 6,
    isDashing: false,
    dashDir: new CANNON.Vec3()
  }
}

function removeMiniBoss() {
  if (!miniBoss) return
  miniBossDefeated = true

  scene.remove(miniBoss.mesh)
  physicsWorld.removeBody(miniBoss.body)
  miniBoss.mesh.geometry.dispose()
  miniBoss.mesh.material.dispose()
  miniBoss = null
  miniBossAlive = false

  console.log('Mini boss defeated - portal to Level 3 opens')
  if (onMiniBossDefeated) onMiniBossDefeated()
}

function updateMiniBoss(delta) {
  if (!miniBoss) return

  const dir = new CANNON.Vec3(
    playerBody.position.x - miniBoss.body.position.x,
    0,
    playerBody.position.z - miniBoss.body.position.z
  )
  dir.normalize()

  // Attack pattern 1 - charge
  miniBoss.chargeTimer -= delta
  if (miniBoss.chargeTimer <= 0 && !miniBoss.isCharging && !miniBoss.isDashing) {
    miniBoss.isCharging = true
    miniBoss.chargeDir = dir.clone()
    miniBoss.chargeTimer = 4
    console.log('Mini boss charging')
    setTimeout(() => {
      if (miniBoss) miniBoss.isCharging = false
    }, 500)
  }

  // Attack pattern 2 - side dash
  miniBoss.dashTimer -= delta
  if (miniBoss.dashTimer <= 0 && !miniBoss.isDashing && !miniBoss.isCharging) {
    miniBoss.isDashing = true
    // Dash sideways relative to player direction
    miniBoss.dashDir = new CANNON.Vec3(-dir.z, 0, dir.x)
    miniBoss.dashTimer = 6
    console.log('Mini boss side dash')
    setTimeout(() => {
      if (miniBoss) miniBoss.isDashing = false
    }, 400)
  }

  if (miniBoss.isCharging) {
    miniBoss.body.velocity.x = miniBoss.chargeDir.x * 15
    miniBoss.body.velocity.z = miniBoss.chargeDir.z * 15
  } else if (miniBoss.isDashing) {
    miniBoss.body.velocity.x = miniBoss.dashDir.x * 10
    miniBoss.body.velocity.z = miniBoss.dashDir.z * 10
  } else {
    // Health based speed
    const speedMultiplier = 1 + (1 - miniBoss.health / MINIBOSS_HEALTH) * 2
    miniBoss.body.velocity.x = dir.x * 2.5 * speedMultiplier
    miniBoss.body.velocity.z = dir.z * 2.5 * speedMultiplier
  }

  miniBoss.mesh.position.copy(miniBoss.body.position)
  miniBoss.mesh.quaternion.copy(miniBoss.body.quaternion)

  // Pulse emissive
  const pulse = Math.sin(Date.now() * 0.006) * 0.4 + 0.4
  miniBoss.mesh.material.emissiveIntensity = pulse

  // Attack player
  miniBoss.attackTimer -= delta
  if (miniBoss.attackTimer <= 0) {
    const distToPlayer = new THREE.Vector3(
      playerBody.position.x - miniBoss.body.position.x,
      0,
      playerBody.position.z - miniBoss.body.position.z
    ).length()

    if (distToPlayer < 2.5) {
      damagePlayer(3, miniBoss.body)
    }
    miniBoss.attackTimer = 1.2
  }

  // Check if player hits mini boss
  const hitboxBody = getHitboxBody()
  const isAttacking = getIsAttacking()
  const attackType = getAttackType()

  if (isAttacking) {
    const hitboxPos = new THREE.Vector3(
      hitboxBody.position.x,
      hitboxBody.position.y,
      hitboxBody.position.z
    )
    const bossPos = new THREE.Vector3(
      miniBoss.body.position.x,
      miniBoss.body.position.y,
      miniBoss.body.position.z
    )

    if (hitboxPos.distanceTo(bossPos) < 2) {
      const damage = attackType === 'punch' ? 0.5 : 1
      miniBoss.health -= damage

      const knockback = new CANNON.Vec3(dir.x * -3, 1, dir.z * -3)
      miniBoss.body.applyImpulse(knockback)

      console.log('Mini boss hit, health:', Math.ceil(miniBoss.health), '/', MINIBOSS_HEALTH)

      if (miniBoss.health <= 0) removeMiniBoss()
    }
  }
}

// PORTAL
let portalMesh = null
let portalActive = false
let onPortalEntry = null

function activatePortal() {
  portalActive = true
  portalMesh.visible = true
  console.log('Portal to Level 3 open')
}

function checkPortalEntry() {
  if (!portalActive) return
  const distance = portalMesh.position.distanceTo(playerMesh.position)
  if (distance < 2.5) {
    console.log('ENTERING LEVEL 3')
    if (onPortalEntry) onPortalEntry()
  }
}

// INIT LEVEL 2
function initLevel2(gameScene, gameCamera, keys, onComplete) {
  scene = gameScene
  camera = gameCamera
  level2Active = true
  onMiniBossDefeated = () => activatePortal()
  onPortalEntry = onComplete

  // Floor
  const floorGeo = new THREE.PlaneGeometry(30, 30)
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.8
  })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const floorBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane()
  })
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  physicsWorld.addBody(floorBody)
  setupJump(floorBody)
  unlockLevel2Abilities()

  // Walls - larger arena for Level 2
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x16213e,
    transparent: true,
    opacity: 0.4
  })

  const wallConfigs = [
    { pos: [0, 3, -15],  rot: [0, 0, 0],           size: [32, 6, 0.5] },
    { pos: [0, 3,  15],  rot: [0, 0, 0],           size: [32, 6, 0.5] },
    { pos: [-15, 3, 0],  rot: [0, Math.PI / 2, 0], size: [32, 6, 0.5] },
    { pos: [ 15, 3, 0],  rot: [0, Math.PI / 2, 0], size: [32, 6, 0.5] },
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

  // Some cover objects - ruined city feel
  const coverPositions = [
    [-5, 0.75, -5], [5, 0.75, -5],
    [-8, 0.75, 3],  [8, 0.75, 3],
    [-3, 0.75, 8],  [3, 0.75, 8],
    [0, 0.75, -10]
  ]

  coverPositions.forEach(([x, y, z]) => {
    const coverGeo = new THREE.BoxGeometry(2, 1.5, 2)
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x0f3460 })
    const cover = new THREE.Mesh(coverGeo, coverMat)
    cover.position.set(x, y, z)
    cover.castShadow = true
    cover.receiveShadow = true
    scene.add(cover)

    const coverBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(1, 0.75, 1))
    })
    coverBody.position.set(x, y, z)
    physicsWorld.addBody(coverBody)
  })

  // Dramatic lighting
  const pointLight1 = new THREE.PointLight(0x0066ff, 2, 20)
  pointLight1.position.set(-8, 5, -8)
  scene.add(pointLight1)

  const pointLight2 = new THREE.PointLight(0xff0066, 2, 20)
  pointLight2.position.set(8, 5, 8)
  scene.add(pointLight2)

  // Portal
  const portalGeo = new THREE.TorusGeometry(2, 0.3, 16, 100)
  const portalMat = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 0.8
  })
  portalMesh = new THREE.Mesh(portalGeo, portalMat)
  portalMesh.position.set(0, 2, -13)
  portalMesh.visible = false
  scene.add(portalMesh)

  // Reset player position
  playerBody.position.set(0, 3, 0)
  playerBody.velocity.set(0, 0, 0)
  playerBody.angularVelocity.set(0, 0, 0)

  // Start first wave
  setTimeout(() => spawnL2Wave(), 1000)

  console.log('Level 2 started')
}

function updateLevel2(delta, keys) {
  if (getGameOver()) {
    showGameOver()
    return
  }

  // Full 3D third person camera
  const offset = new THREE.Vector3(0, 6, 10)
  offset.applyQuaternion(playerMesh.quaternion)
  camera.position.lerp(
    new THREE.Vector3(
      playerMesh.position.x,
      playerMesh.position.y + 6,
      playerMesh.position.z + 10
    ),
    0.1
  )
  camera.lookAt(playerMesh.position)

  updatePlayer(delta, keys, camera)

  // Wave complete check
  const enemies = getEnemies()
  if (enemies.length === 0 && l2WaveInProgress) {
    l2WaveInProgress = false
    console.log('Level 2 wave complete')
    setTimeout(() => spawnL2Wave(), 2500)
  }

  updateEnemies(delta, playerBody, playerMesh, camera)

  updateMiniBoss(delta)

  checkPortalEntry()

  if (portalActive) portalMesh.rotation.z += 0.01

  physicsWorld.step(1 / 60, delta, 3)

  updateHUD(
    getPlayerHealth(),
    getPlayerMaxHealth(),
    0,
    currentL2Wave,
    level2Waves.length,
    miniBossAlive
  )
}

function isMiniBossAlive() { return miniBossAlive }

export { initLevel2, updateLevel2, isMiniBossAlive }