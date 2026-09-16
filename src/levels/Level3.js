import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { physicsWorld } from '../physics/PhysicsWorld.js'
import { playerBody } from '../player/PlayerPhysics.js'
import { playerMesh, updatePlayer, setupJump, getGameOver, getPlayerHealth, getPlayerMaxHealth, getIsAttacking, getAttackType, getHitboxBody, damagePlayer } from '../player/Player.js'
import { initHUD, updateHUD, showGameOver } from '../ui/HUD.js'

let scene = null
let camera = null

const maxBossHealth = 100
let bossHealth = 100

let tiles = []
let weakPoints = []
let bossLights = []
let energyRings = []
let shards = []
let architect = null
let voidFloor = null
let particles = null

let phaseTwoStarted = false
let phaseThreeStarted = false
let bossDefeated = false
let onLevel3Complete = null

// TODO(Sibu): Phase 1 boss projectile attacks — brief calls for
// "energy blasts toward player position" as CANNON bodies that
// despawn on contact with player or floor. Not implemented yet
// in either branch; currently the boss only takes damage, it
// never attacks back in Phase 1.
let blastTimer = 3

// =============================================================
// SCENE BUILD (ported from feat/levels' Level3 class methods —
// unchanged visuals, just writing into the shared `scene` instead
// of a private this.level group)
// =============================================================

function createLighting() {
  const ambient = new THREE.AmbientLight(0xffffff, 1.8)
  scene.add(ambient)

  const mainLight = new THREE.DirectionalLight(0xffffff, 3.5)
  mainLight.position.set(40, 100, 50)
  mainLight.castShadow = true
  mainLight.shadow.mapSize.width = 2048
  mainLight.shadow.mapSize.height = 2048
  mainLight.shadow.camera.left = -100
  mainLight.shadow.camera.right = 100
  mainLight.shadow.camera.top = 100
  mainLight.shadow.camera.bottom = -100
  scene.add(mainLight)
}

function createVoidFloor() {
  const geometry = new THREE.PlaneGeometry(1000, 1000)
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1.0,
    metalness: 0.0
  })
  const floor = new THREE.Mesh(geometry, material)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -8
  floor.receiveShadow = true
  scene.add(floor)
  voidFloor = floor
}

function createArena() {
  tiles = []

  const tileSize = 5
  const gap = 0.08
  const columns = 12
  const rows = 12

  const totalWidth = columns * tileSize
  const totalLength = rows * tileSize
  const startX = -totalWidth / 2 + tileSize / 2
  const startZ = -totalLength / 2 + tileSize / 2

  for (let x = 0; x < columns; x++) {
    for (let z = 0; z < rows; z++) {
      const geometry = new THREE.BoxGeometry(tileSize - gap, 0.6, tileSize - gap)
      const material = new THREE.MeshStandardMaterial({
        color: (x + z) % 2 === 0 ? 0xf4f4f4 : 0xe8e8e8,
        roughness: 0.65,
        metalness: 0.15
      })
      const tile = new THREE.Mesh(geometry, material)
      tile.position.set(startX + x * tileSize, 0, startZ + z * tileSize)
      tile.castShadow = true
      tile.receiveShadow = true
      scene.add(tile)

      tiles.push({ mesh: tile, x, z, fallen: false, velocity: 0 })
    }
  }
}

function createArenaBorder() {
  const borderMaterial = new THREE.MeshStandardMaterial({
    color: 0xd7d7d7,
    roughness: 0.5,
    metalness: 0.4
  })

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(65, 2, 1), borderMaterial)
  backWall.position.set(0, -0.2, -31)
  scene.add(backWall)

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 65), borderMaterial)
  leftWall.position.set(-31, -0.2, 0)
  scene.add(leftWall)

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 65), borderMaterial)
  rightWall.position.set(31, -0.2, 0)
  scene.add(rightWall)

  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(65, 2, 1), borderMaterial)
  frontWall.position.set(0, -0.2, 31)
  scene.add(frontWall)

  // Physics bounds matching the visual border, so the player can't
  // walk off the tile arena. (Not present in either original branch.)
  const arenaWallConfigs = [
    { pos: [0, 1, -31], rot: [0, 0, 0],           size: [65, 4, 1] },
    { pos: [0, 1,  31], rot: [0, 0, 0],           size: [65, 4, 1] },
    { pos: [-31, 1, 0], rot: [0, Math.PI / 2, 0], size: [65, 4, 1] },
    { pos: [ 31, 1, 0], rot: [0, Math.PI / 2, 0], size: [65, 4, 1] },
  ]

  arenaWallConfigs.forEach(({ pos, rot, size }) => {
    const wallBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2))
    })
    wallBody.position.set(...pos)
    wallBody.quaternion.setFromEuler(...rot)
    physicsWorld.addBody(wallBody)
  })
}

function createVoidGeometry() {
  const material = new THREE.MeshStandardMaterial({
    color: 0xe0e0e0,
    roughness: 0.4,
    metalness: 0.5
  })

  const positions = [
    [-70, 35, -100],
    [70, 50, -120],
    [-110, 20, -170],
    [110, 40, -180],
    [-150, 65, -250],
    [150, 75, -280]
  ]

  positions.forEach((position, index) => {
    const width = 8 + (index % 3) * 5
    const height = 25 + (index % 4) * 15
    const depth = 8 + (index % 2) * 6

    const geometry = new THREE.BoxGeometry(width, height, depth)
    const object = new THREE.Mesh(geometry, material.clone())
    object.position.set(position[0], height / 2 - 5, position[2])
    object.rotation.y = index * 0.35
    object.castShadow = true
    scene.add(object)
  })

  shards = []
  for (let i = 0; i < 18; i++) {
    const geometry = new THREE.IcosahedronGeometry(2 + Math.random() * 5, 0)
    const shard = new THREE.Mesh(geometry, material.clone())
    shard.position.set(
      (Math.random() - 0.5) * 180,
      15 + Math.random() * 70,
      -60 - Math.random() * 220
    )
    shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
    shard.userData.rotationSpeed = 0.1 + Math.random() * 0.3
    scene.add(shard)
    shards.push(shard)
  }
}

function createArchitect() {
  architect = new THREE.Group()
  architect.position.set(0, 20, -25)
  scene.add(architect)

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xbfc4c9,
    roughness: 0.3,
    metalness: 0.5
  })
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x777d84,
    roughness: 0.4,
    metalness: 0.65
  })

  const body = new THREE.Mesh(new THREE.BoxGeometry(14, 28, 8), bodyMaterial)
  body.position.y = 0
  body.castShadow = true
  body.receiveShadow = true
  architect.add(body)

  const chest = new THREE.Mesh(new THREE.BoxGeometry(10, 13, 1.5), darkMaterial)
  chest.position.set(0, 2, -4.5)
  chest.castShadow = true
  architect.add(chest)

  const head = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), bodyMaterial)
  head.position.y = 20
  head.castShadow = true
  architect.add(head)

  const crown = new THREE.Mesh(new THREE.BoxGeometry(5, 8, 5), darkMaterial)
  crown.position.y = 29
  crown.castShadow = true
  architect.add(crown)

  const shoulderGeometry = new THREE.BoxGeometry(6, 6, 8)
  const leftShoulder = new THREE.Mesh(shoulderGeometry, bodyMaterial)
  leftShoulder.position.set(-9, 9, 0)
  architect.add(leftShoulder)

  const rightShoulder = new THREE.Mesh(shoulderGeometry, bodyMaterial)
  rightShoulder.position.set(9, 9, 0)
  architect.add(rightShoulder)

  const armGeometry = new THREE.BoxGeometry(4, 25, 4)
  const leftArm = new THREE.Mesh(armGeometry, bodyMaterial)
  leftArm.position.set(-10, -4, 0)
  leftArm.rotation.z = -0.08
  leftArm.castShadow = true
  architect.add(leftArm)

  const rightArm = new THREE.Mesh(armGeometry, bodyMaterial)
  rightArm.position.set(10, -4, 0)
  rightArm.rotation.z = 0.08
  rightArm.castShadow = true
  architect.add(rightArm)

  const handGeometry = new THREE.BoxGeometry(5, 7, 5)
  const leftHand = new THREE.Mesh(handGeometry, darkMaterial)
  leftHand.position.set(-10, -17, 0)
  architect.add(leftHand)

  const rightHand = new THREE.Mesh(handGeometry, darkMaterial)
  rightHand.position.set(10, -17, 0)
  architect.add(rightHand)

  const legGeometry = new THREE.BoxGeometry(5, 22, 5)
  const leftLeg = new THREE.Mesh(legGeometry, bodyMaterial)
  leftLeg.position.set(-4, -24, 0)
  leftLeg.castShadow = true
  architect.add(leftLeg)

  const rightLeg = new THREE.Mesh(legGeometry, bodyMaterial)
  rightLeg.position.set(4, -24, 0)
  rightLeg.castShadow = true
  architect.add(rightLeg)

  const footGeometry = new THREE.BoxGeometry(6, 4, 9)
  const leftFoot = new THREE.Mesh(footGeometry, darkMaterial)
  leftFoot.position.set(-4, -36, -1)
  architect.add(leftFoot)

  const rightFoot = new THREE.Mesh(footGeometry, darkMaterial)
  rightFoot.position.set(4, -36, -1)
  architect.add(rightFoot)
}

function createWeakPoints() {
  const cyanMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x00ffff,
    emissiveIntensity: 12,
    metalness: 0.1,
    roughness: 0.2
  })
  const purpleMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xff00ff,
    emissiveIntensity: 12,
    metalness: 0.1,
    roughness: 0.2
  })

  const chestCore = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), cyanMaterial)
  chestCore.position.set(0, 2, -5)
  architect.add(chestCore)
  weakPoints.push(chestCore)

  const headCore = new THREE.Mesh(new THREE.OctahedronGeometry(1.8, 0), purpleMaterial)
  headCore.position.set(0, 20, -5.2)
  architect.add(headCore)
  weakPoints.push(headCore)

  const leftCore = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), cyanMaterial.clone())
  leftCore.position.set(-10, -4, -2.5)
  architect.add(leftCore)
  weakPoints.push(leftCore)

  const rightCore = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), purpleMaterial.clone())
  rightCore.position.set(10, -4, -2.5)
  architect.add(rightCore)
  weakPoints.push(rightCore)
}

function createEnergyRings() {
  const cyanMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide
  })
  const purpleMaterial = new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide
  })

  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(30, 0.35, 8, 64), cyanMaterial)
  ring1.position.set(0, 15, -35)
  ring1.rotation.x = Math.PI / 2
  scene.add(ring1)
  energyRings.push(ring1)

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(22, 0.25, 8, 64), purpleMaterial)
  ring2.position.set(0, 18, -38)
  ring2.rotation.x = Math.PI / 2
  scene.add(ring2)
  energyRings.push(ring2)

  const ring3 = new THREE.Mesh(new THREE.TorusGeometry(14, 0.2, 8, 64), cyanMaterial)
  ring3.position.set(0, 15, -32)
  scene.add(ring3)
  energyRings.push(ring3)
}

function createBossLights() {
  const cyanLight = new THREE.PointLight(0x00ffff, 180, 90)
  cyanLight.position.set(0, 5, -30)
  scene.add(cyanLight)
  bossLights.push(cyanLight)

  const purpleLight = new THREE.PointLight(0xff00ff, 150, 80)
  purpleLight.position.set(-15, 20, -30)
  scene.add(purpleLight)
  bossLights.push(purpleLight)

  const cyanLight2 = new THREE.PointLight(0x00ffff, 150, 80)
  cyanLight2.position.set(15, 20, -30)
  scene.add(cyanLight2)
  bossLights.push(cyanLight2)
}

function createParticles() {
  const particleGeometry = new THREE.BufferGeometry()
  const positions = []

  for (let i = 0; i < 250; i++) {
    positions.push(
      (Math.random() - 0.5) * 160,
      Math.random() * 100,
      -Math.random() * 250
    )
  }

  particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

  const particleMaterial = new THREE.PointsMaterial({
    color: 0x9b9b9b,
    size: 0.35,
    transparent: true,
    opacity: 0.45
  })

  particles = new THREE.Points(particleGeometry, particleMaterial)
  scene.add(particles)
}

// =============================================================
// BOSS STATE / DAMAGE
// =============================================================

function damageBoss(amount) {
  bossHealth -= amount
  bossHealth = Math.max(0, bossHealth)

  console.log('ARCHITECT HP:', bossHealth)

  if (bossHealth <= 66 && bossHealth > 33) {
    startPhaseTwo()
  }

  if (bossHealth <= 33 && bossHealth > 0) {
    startPhaseThree()
  }

  if (bossHealth <= 0 && !bossDefeated) {
    bossDefeated = true
    console.log('THE ARCHITECT IS DEFEATED')
    if (onLevel3Complete) onLevel3Complete()
  }
}

function startPhaseTwo() {
  if (phaseTwoStarted) return
  phaseTwoStarted = true
  console.log('ARCHITECT PHASE 2')

  for (let i = 0; i < 15; i++) {
    const index = Math.floor(Math.random() * tiles.length)
    dropTile(index)
  }
}

function startPhaseThree() {
  if (phaseThreeStarted) return
  phaseThreeStarted = true
  console.log('ARCHITECT PHASE 3')

  for (const point of weakPoints) {
    point.material.emissiveIntensity = 25
  }

  for (const ring of energyRings) {
    ring.userData.phaseThree = true
  }
}

function dropTile(index) {
  if (!tiles[index]) return

  const tileData = tiles[index]
  if (tileData.fallen) return

  tileData.fallen = true
  tileData.velocity = 2
  tileData.mesh.userData.falling = true
}

// Weak-point hit detection — same pattern as Level 2's mini boss
// (getIsAttacking/getHitboxBody/getAttackType), since nothing in
// either original branch actually connected player attacks to
// bossHealth.
function checkWeakPointHits() {
  if (!getIsAttacking() || !architect) return

  const hitboxBody = getHitboxBody()
  const hitboxPos = new THREE.Vector3(
    hitboxBody.position.x,
    hitboxBody.position.y,
    hitboxBody.position.z
  )

  const attackType = getAttackType()
  const damage = attackType === 'punch' ? 1 : 2

  for (const point of weakPoints) {
    const worldPos = new THREE.Vector3()
    point.getWorldPosition(worldPos)

    if (hitboxPos.distanceTo(worldPos) < 3) {
      damageBoss(damage)
      break // one weak point per attack swing
    }
  }
}

// =============================================================
// INIT / UPDATE
// =============================================================

function initLevel3(gameScene, gameCamera, keys, onComplete) {
  scene = gameScene
  camera = gameCamera
  onLevel3Complete = onComplete

  bossHealth = 100
  phaseTwoStarted = false
  phaseThreeStarted = false
  bossDefeated = false
  tiles = []
  weakPoints = []
  bossLights = []
  energyRings = []
  shards = []

  createLighting()
  createVoidFloor()
  createArena()
  createArenaBorder()
  createVoidGeometry()
  createArchitect()
  createWeakPoints()
  createEnergyRings()
  createBossLights()
  createParticles()

  // Flat static floor under the tile arena, matching voidFloor's
  // y = -8. Falling tiles are purely visual (per the brief — "on
  // trigger, enable gravity, tile falls, remove from scene after
  // it falls") so no physics body per tile yet; that's Sibu's
  // still-open Phase 2 physics task.
  const floorBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane()
  })
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  floorBody.position.y = 0.3
  physicsWorld.addBody(floorBody)
  setupJump(floorBody)

  playerBody.position.set(0, 3, 15)
  playerBody.velocity.set(0, 0, 0)
  playerBody.angularVelocity.set(0, 0, 0)

  initHUD()

  console.log("🏛️ Level 3 — The Architect's Realm")
}

function updateLevel3(delta, keys) {
  if (getGameOver()) {
    showGameOver()
    return
  }

  const time = performance.now() * 0.001

  updatePlayer(delta, keys, camera)

  // Architect breathing / floating
  if (architect) {
    architect.position.y = 20 + Math.sin(time * 0.8) * 0.35
    architect.rotation.y = Math.sin(time * 0.25) * 0.03
  }

  // Weak point pulse
  const pulse = 9 + Math.sin(time * 5) * 5
  for (const point of weakPoints) {
    point.material.emissiveIntensity = phaseThreeStarted ? 25 : pulse
    const scale = 1 + Math.sin(time * 4) * 0.12
    point.scale.set(scale, scale, scale)
  }

  // Energy rings
  if (energyRings[0]) {
    const speedMul = energyRings[0].userData.phaseThree ? 2 : 1
    energyRings[0].rotation.z += deltaTimeSafe(delta) * 0.15 * speedMul
    energyRings[0].rotation.y += deltaTimeSafe(delta) * 0.2 * speedMul
  }
  if (energyRings[1]) {
    const speedMul = energyRings[1].userData.phaseThree ? 2 : 1
    energyRings[1].rotation.z -= deltaTimeSafe(delta) * 0.25 * speedMul
    energyRings[1].rotation.y += deltaTimeSafe(delta) * 0.15 * speedMul
  }
  if (energyRings[2]) {
    const speedMul = energyRings[2].userData.phaseThree ? 2 : 1
    energyRings[2].rotation.x += deltaTimeSafe(delta) * 0.2 * speedMul
    energyRings[2].rotation.y += deltaTimeSafe(delta) * 0.3 * speedMul
  }

  // Floating shards
  for (const shard of shards) {
    shard.rotation.x += delta * shard.userData.rotationSpeed
    shard.rotation.y += delta * shard.userData.rotationSpeed * 0.7
  }

  // Boss lights follow health
  const healthPercent = bossHealth / maxBossHealth
  for (const light of bossLights) {
    light.intensity = 180 * healthPercent
  }

  // Falling tiles
  for (const tileData of tiles) {
    if (!tileData.fallen) continue

    tileData.velocity += 20 * delta
    tileData.mesh.position.y -= tileData.velocity * delta
    tileData.mesh.rotation.x += delta * 1.5
    tileData.mesh.rotation.z += delta * 0.8

    // Once a fallen tile is well below the arena, remove it —
    // per the brief: "remove tile from scene after it falls"
    if (tileData.mesh.position.y < -40 && !tileData.removed) {
      tileData.removed = true
      scene.remove(tileData.mesh)
      tileData.mesh.geometry.dispose()
      tileData.mesh.material.dispose()
    }
  }

  checkWeakPointHits()

  // TODO(Sibu): Phase 1 energy blasts toward player, as CANNON
  // projectile bodies that despawn on contact with player/floor.
  // blastTimer left in place as the hook point for that system.
  blastTimer -= delta
  if (blastTimer <= 0 && !phaseTwoStarted) {
    blastTimer = 3
    // spawnEnergyBlast(architect position, playerBody.position) — not implemented
  }

  physicsWorld.step(1 / 60, delta, 3)

  updateHUD(
    getPlayerHealth(),
    getPlayerMaxHealth(),
    0,
    1,
    1,
    !bossDefeated
  )
}

// Guards against a zero/undefined delta on the very first frame,
// same safety the original class's performance.now()-based update
// didn't need but this delta-driven version does.
function deltaTimeSafe(delta) {
  return delta || 0
}

function isArchitectDefeated() {
  return bossDefeated
}

export { initLevel3, updateLevel3, isArchitectDefeated }