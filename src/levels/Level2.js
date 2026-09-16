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
let buildingTexture = null // shared across createBuilding calls

// Where the boss fight / portal actually happen in Pumelela's city.
// TODO(Sibu/Pumelela): confirm these against the final city layout —
// currently set to match createBossArea(125) / createPortal(0,5,145).
const BOSS_ARENA_Z = 125
const PORTAL_POSITION = { x: 0, y: 5, z: 145 }

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
    position: new CANNON.Vec3(0, 1, BOSS_ARENA_Z),
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
    const speedMultiplier = 1 + (1 - miniBoss.health / MINIBOSS_HEALTH) * 2
    miniBoss.body.velocity.x = dir.x * 2.5 * speedMultiplier
    miniBoss.body.velocity.z = dir.z * 2.5 * speedMultiplier
  }

  miniBoss.mesh.position.copy(miniBoss.body.position)
  miniBoss.mesh.quaternion.copy(miniBoss.body.quaternion)

  const pulse = Math.sin(Date.now() * 0.006) * 0.4 + 0.4
  miniBoss.mesh.material.emissiveIntensity = pulse

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

// =============================================================
// CITY ENVIRONMENT (ported from feat/levels — Pumelela's art,
// adapted from class methods into plain functions that add
// directly to the shared game `scene` instead of a private
// this.level group)
// =============================================================

function getBuildingTexture() {
  if (!buildingTexture) {
    const textureLoader = new THREE.TextureLoader()
    buildingTexture = textureLoader.load('/assets/textures/brick.png')
    buildingTexture.wrapS = THREE.RepeatWrapping
    buildingTexture.wrapT = THREE.RepeatWrapping
    buildingTexture.repeat.set(2, 4)
    buildingTexture.colorSpace = THREE.SRGBColorSpace
  }
  return buildingTexture
}

function createSkybox(scene, textureLoader) {
  const skyTexture = textureLoader.load('/assets/textures/skybox1.png')
  skyTexture.colorSpace = THREE.SRGBColorSpace

  const skyMaterial = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  })

  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 64, 32), skyMaterial)
  sky.position.set(0, 0, 0)
  scene.add(sky)
}

function createCityLighting(scene) {
  const ambient = new THREE.AmbientLight(0x625b9c, 2.0)
  scene.add(ambient)

  const sunset = new THREE.DirectionalLight(0xd8d4ff, 1.5)
  sunset.position.set(-60, 80, 40)
  sunset.castShadow = true
  sunset.shadow.mapSize.width = 2048
  sunset.shadow.mapSize.height = 2048
  scene.add(sunset)

  const cyanLight = new THREE.PointLight(0x00d9ff, 40, 70)
  cyanLight.position.set(0, 15, -80)
  scene.add(cyanLight)

  const purpleLight = new THREE.PointLight(0xb000ff, 35, 80)
  purpleLight.position.set(20, 20, 100)
  scene.add(purpleLight)
}

function createRoadAndGround(scene, textureLoader) {
  const roadTexture = textureLoader.load('/assets/textures/Level2-road.png')
  roadTexture.wrapS = THREE.RepeatWrapping
  roadTexture.wrapT = THREE.RepeatWrapping
  roadTexture.repeat.set(1, 8)

  const roadMaterial = new THREE.MeshStandardMaterial({
    map: roadTexture,
    roughness: 0.18,
    metalness: 0.65
  })

  const road = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 260), roadMaterial)
  road.position.set(0, -0.25, 0)
  road.receiveShadow = true
  scene.add(road)

  const groundTexture = textureLoader.load('/assets/textures/ground.png')
  groundTexture.wrapS = THREE.RepeatWrapping
  groundTexture.wrapT = THREE.RepeatWrapping
  groundTexture.repeat.set(80, 80)
  groundTexture.colorSpace = THREE.SRGBColorSpace

  const groundMaterial = new THREE.MeshStandardMaterial({
    map: groundTexture,
    color: 0x777777,
    roughness: 0.95,
    metalness: 0.05
  })

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, -0.01, 0)
  ground.receiveShadow = true
  scene.add(ground)

  const neon = new THREE.MeshStandardMaterial({
    color: 0x00d9ff,
    emissive: 0x00d9ff,
    emissiveIntensity: 5,
    metalness: 0.2,
    roughness: 0.25
  })

  createLongLine(scene, -6.5, neon)
  createLongLine(scene, 6.5, neon)

  for (let z = -125; z < 130; z += 10) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 5), neon)
    line.position.set(0, 0.05, z)
    scene.add(line)
  }
}

function createLongLine(scene, x, material) {
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 260), material)
  line.position.set(x, 0.05, 0)
  scene.add(line)
}

function createCityBlock(scene, z) {
  createBuilding(scene, -16, z - 10, 10, 18 + Math.random() * 10, 12, 0x292442)
  createBuilding(scene, -17, z + 10, 8, 12 + Math.random() * 12, 11, 0x33284c)
  createBuilding(scene, 16, z - 10, 11, 20 + Math.random() * 12, 13, 0x252743)
  createBuilding(scene, 17, z + 10, 9, 15 + Math.random() * 15, 12, 0x39294c)

  createRubble(scene, -10, z - 5)
  createRubble(scene, 10, z + 5)
}

function createCombatZone(scene, z) {
  const arenaMaterial = new THREE.MeshStandardMaterial({
    color: 0x211b38,
    metalness: 0.65,
    roughness: 0.4
  })
  const arena = new THREE.Mesh(new THREE.BoxGeometry(28, 0.35, 28), arenaMaterial)
  arena.position.set(0, -0.05, z)
  scene.add(arena)

  createBuilding(scene, -18, z, 7, 15, 10, 0x302746)
  createBuilding(scene, 18, z, 7, 21, 10, 0x292441)

  createGlowBlock(scene, -12, 1, z - 12)
  createGlowBlock(scene, 12, 1, z - 12)
  createGlowBlock(scene, -12, 1, z + 12)
  createGlowBlock(scene, 12, 1, z + 12)
}

function createIntersection(scene, z) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x29233f,
    roughness: 0.65,
    metalness: 0.45
  })
  const intersection = new THREE.Mesh(new THREE.BoxGeometry(36, 0.35, 32), material)
  intersection.position.set(0, -0.05, z)
  scene.add(intersection)

  createBuilding(scene, -19, z, 7, 10, 12, 0x34294a)
  createBuilding(scene, 19, z, 8, 14, 12, 0x282541)

  for (let i = 0; i < 5; i++) {
    createRubble(scene, -13 + Math.random() * 26, z - 10 + Math.random() * 20)
  }
}

function createUpperCity(scene, z) {
  createBuilding(scene, -17, z - 10, 10, 30, 14, 0x29234a)
  createBuilding(scene, -18, z + 12, 9, 25, 12, 0x35274d)
  createBuilding(scene, 17, z - 10, 11, 34, 14, 0x252849)
  createBuilding(scene, 18, z + 12, 9, 28, 12, 0x39274c)

  createTower(scene, -27, z)
  createTower(scene, 27, z + 15)
}

function createFloatingSection(scene, z) {
  const brokenRoad = new THREE.MeshStandardMaterial({
    color: 0x17142d,
    metalness: 0.7,
    roughness: 0.4
  })
  const road = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 35), brokenRoad)
  road.position.set(0, 0, z)
  scene.add(road)

  createPlatform(scene, -8, 5, z - 12)
  createPlatform(scene, 8, 8, z - 2)
  createPlatform(scene, -7, 11, z + 10)
  createPlatform(scene, 6, 14, z + 20)

  createRubble(scene, -12, z)
  createRubble(scene, 12, z + 15)
}

function createBossArea(scene, z) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x18142f,
    metalness: 0.8,
    roughness: 0.25,
    emissive: 0x160d35,
    emissiveIntensity: 1.5
  })
  const arena = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 0.7, 32), material)
  arena.position.set(0, 0, z)
  scene.add(arena)

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const x = Math.cos(angle) * 22
    const zz = z + Math.sin(angle) * 22
    createBossPillar(scene, x, zz)
  }

  const bossGlow = new THREE.MeshStandardMaterial({
    color: 0xff20c8,
    emissive: 0xff20c8,
    emissiveIntensity: 4
  })
  const bossPlatform = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.5, 8), bossGlow)
  bossPlatform.position.set(0, 0.6, z)
  scene.add(bossPlatform)
}

function createBuilding(scene, x, z, width, height, depth, color) {
  const texture = getBuildingTexture()

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texture,
    roughness: 0.82,
    metalness: 0.12
  })

  const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
  building.position.set(x, height / 2, z)
  building.castShadow = true
  building.receiveShadow = true
  scene.add(building)

  const upperWidth = width * 0.72
  const upperHeight = height * 0.30
  const upperDepth = depth * 0.78

  const upper = new THREE.Mesh(new THREE.BoxGeometry(upperWidth, upperHeight, upperDepth), material)
  upper.position.set(
    x + (Math.random() - 0.5) * width * 0.12,
    height + upperHeight / 2,
    z
  )
  upper.castShadow = true
  upper.receiveShadow = true
  scene.add(upper)

  const topWidth = width * 0.40
  const topHeight = height * 0.12
  const topDepth = depth * 0.45

  const top = new THREE.Mesh(new THREE.BoxGeometry(topWidth, topHeight, topDepth), material)
  top.position.set(
    x + (Math.random() - 0.5) * width * 0.25,
    height + upperHeight + topHeight / 2,
    z
  )
  top.rotation.z = (Math.random() - 0.5) * 0.08
  top.castShadow = true
  top.receiveShadow = true
  scene.add(top)

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x101018,
    roughness: 0.75,
    metalness: 0.45
  })

  for (let i = 0; i < 3; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.35, height * 0.72, 0.35), frameMaterial)
    beam.position.set(
      x - width / 2 - 0.18,
      height * 0.36,
      z - depth / 2 + 1 + i * 2
    )
    beam.castShadow = true
    scene.add(beam)
  }

  const cyan = new THREE.MeshStandardMaterial({
    color: 0x00eaff,
    emissive: 0x00eaff,
    emissiveIntensity: 5
  })
  const pink = new THREE.MeshStandardMaterial({
    color: 0xff20c8,
    emissive: 0xff20c8,
    emissiveIntensity: 4
  })

  for (let i = 0; i < 3; i++) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.5, 1.2, 0.15),
      i % 2 === 0 ? cyan : pink
    )
    panel.position.set(x, 4 + i * 5, z - depth / 2 - 0.08)
    scene.add(panel)
  }

  for (let i = 0; i < 3; i++) {
    const size = 0.5 + Math.random() * 1.2
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), frameMaterial)
    chunk.position.set(
      x + (Math.random() - 0.5) * width,
      height + Math.random() * 2,
      z + (Math.random() - 0.5) * depth
    )
    chunk.rotation.set(Math.random(), Math.random(), Math.random())
    scene.add(chunk)
  }

  createWindows(scene, x, z, width, height, depth)
  createRubble(scene, x, z)
}

function createWindows(scene, x, z, width, height, depth) {
  const cyan = new THREE.MeshStandardMaterial({
    color: 0x00eaff,
    emissive: 0x00eaff,
    emissiveIntensity: 5
  })
  const pink = new THREE.MeshStandardMaterial({
    color: 0xff20c8,
    emissive: 0xff20c8,
    emissiveIntensity: 4
  })

  for (let y = 4; y < height - 2; y += 5) {
    const material = Math.random() > 0.5 ? cyan : pink
    const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(width * 0.45, 1.2, 0.12), material)
    windowMesh.position.set(x, y, z - depth / 2 - 0.08)
    scene.add(windowMesh)
  }
}

function createRubble(scene, x, z) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x3b3450,
    roughness: 0.9
  })

  for (let i = 0; i < 6; i++) {
    const size = 0.5 + Math.random() * 1.5
    const rock = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), material)
    rock.position.set(
      x + (Math.random() - 0.5) * 7,
      size / 2,
      z + (Math.random() - 0.5) * 7
    )
    rock.rotation.y = Math.random() * Math.PI
    rock.rotation.z = Math.random() * 0.5
    scene.add(rock)
  }
}

function createGlowBlock(scene, x, y, z) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x00d9ff,
    emissive: 0x00d9ff,
    emissiveIntensity: 5
  })
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2, 0.4), material)
  block.position.set(x, y, z)
  scene.add(block)
}

function createPlatform(scene, x, y, z) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x3d3470,
    metalness: 0.8,
    roughness: 0.25,
    emissive: 0x171052,
    emissiveIntensity: 1.5
  })
  const platform = new THREE.Mesh(new THREE.BoxGeometry(7, 0.8, 7), material)
  platform.position.set(x, y, z)
  scene.add(platform)

  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x00d9ff,
    emissive: 0x00d9ff,
    emissiveIntensity: 5
  })
  const edge = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.12, 0.15), edgeMaterial)
  edge.position.set(x, y + 0.45, z - 3.5)
  scene.add(edge)
}

function createTower(scene, x, z) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x17142e,
    roughness: 0.7,
    metalness: 0.7
  })
  const tower = new THREE.Mesh(new THREE.BoxGeometry(6, 55, 6), material)
  tower.position.set(x, 27, z)
  scene.add(tower)

  const neon = new THREE.MeshStandardMaterial({
    color: 0xff1bc7,
    emissive: 0xff1bc7,
    emissiveIntensity: 6
  })
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 50, 0.3), neon)
  strip.position.set(x + 3.1, 25, z)
  scene.add(strip)
}

function createBossPillar(scene, x, z) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x241b42,
    metalness: 0.8,
    roughness: 0.3,
    emissive: 0x130b2c,
    emissiveIntensity: 1
  })
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(3, 18, 3), material)
  pillar.position.set(x, 9, z)
  scene.add(pillar)

  const light = new THREE.PointLight(0x00d9ff, 15, 20)
  light.position.set(x, 10, z)
  scene.add(light)
}

function createDistantCity(scene) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x15112b,
    roughness: 1
  })

  for (let i = 0; i < 35; i++) {
    const height = 10 + Math.random() * 40
    const width = 3 + Math.random() * 6
    const side = i % 2 === 0 ? -1 : 1

    const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, width), material)
    building.position.set(
      side * (27 + Math.random() * 35),
      height / 2,
      -135 + Math.random() * 280
    )
    scene.add(building)
  }
}

// Builds the visible portal at Pumelela's chosen spot, styled with
// her octahedron+light look. Visibility/activation is still driven
// by main's activatePortal()/portalActive, not by this function.
function createPortalVisual(scene, x, y, z) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 8,
    metalness: 0.3,
    roughness: 0.15
  })
  const portal = new THREE.Mesh(new THREE.OctahedronGeometry(4, 0), material)
  portal.position.set(x, y, z)
  portal.visible = false
  scene.add(portal)

  const light = new THREE.PointLight(0x00ffff, 80, 35)
  light.position.set(x, y, z)
  scene.add(light)

  return portal
}

function buildCityEnvironment(scene) {
  const textureLoader = new THREE.TextureLoader()

  createSkybox(scene, textureLoader)
  createCityLighting(scene)
  createRoadAndGround(scene, textureLoader)

  createCityBlock(scene, -105)
  createCityBlock(scene, -65)
  createCombatZone(scene, -25)
  createIntersection(scene, 10)
  createUpperCity(scene, 50)
  createFloatingSection(scene, 90)
  createBossArea(scene, BOSS_ARENA_Z)

  createDistantCity(scene)
}

// INIT LEVEL 2
function initLevel2(gameScene, gameCamera, keys, onComplete) {
  scene = gameScene
  camera = gameCamera
  level2Active = true
  onMiniBossDefeated = () => activatePortal()
  onPortalEntry = onComplete

  // =========================================================
  // ART: Pumelela's city (replaces the old placeholder floor)
  // =========================================================
  buildCityEnvironment(scene)

  // =========================================================
  // PHYSICS: invisible collision volumes matching the city's
  // road/ground footprint. TODO(Pumelela/Sibu): tighten these
  // to the real building placements once layout is final —
  // right now only outer bounds + a flat floor are solid, so
  // buildings are currently walk-through.
  // =========================================================

  const floorBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane()
  })
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  physicsWorld.addBody(floorBody)
  setupJump(floorBody)
  unlockLevel2Abilities()

  // Wide boundary walls spanning the full city length instead of
  // the old 30x30 box, so the road (z: -125..145) is playable.
  const wallConfigs = [
    { pos: [0, 3, -135],  rot: [0, 0, 0],           size: [80, 6, 0.5] },
    { pos: [0, 3,  155],  rot: [0, 0, 0],           size: [80, 6, 0.5] },
    { pos: [-40, 3, 10],  rot: [0, Math.PI / 2, 0], size: [290, 6, 0.5] },
    { pos: [ 40, 3, 10],  rot: [0, Math.PI / 2, 0], size: [290, 6, 0.5] },
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

  // Dramatic accent lighting from main, kept alongside the city's
  // own lighting rig
  const pointLight1 = new THREE.PointLight(0x0066ff, 2, 20)
  pointLight1.position.set(-8, 5, -8)
  scene.add(pointLight1)

  const pointLight2 = new THREE.PointLight(0xff0066, 2, 20)
  pointLight2.position.set(8, 5, 8)
  scene.add(pointLight2)

  // Portal — visual from feat/levels, driven by main's logic
  portalMesh = createPortalVisual(scene, PORTAL_POSITION.x, PORTAL_POSITION.y, PORTAL_POSITION.z)

  // Reset player position — spawns at the start of the road, not
  // inside the boss arena
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

  const enemies = getEnemies()
  if (enemies.length === 0 && l2WaveInProgress) {
    l2WaveInProgress = false
    console.log('Level 2 wave complete')
    setTimeout(() => spawnL2Wave(), 2500)
  }

  updateEnemies(delta, playerBody, playerMesh, camera)

  updateMiniBoss(delta)

  checkPortalEntry()

  if (portalActive && portalMesh) {
    portalMesh.rotation.y += 0.008
    portalMesh.rotation.x += 0.0025
    portalMesh.position.y = PORTAL_POSITION.y + Math.sin(performance.now() * 0.002) * 0.5
  }

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