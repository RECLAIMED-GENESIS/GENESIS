import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { physicsWorld } from '../physics/PhysicsWorld.js'
import { getIsAttacking, getAttackType, getHitboxBody, damagePlayer } from '../player/Player.js'

let commander = null
const COMMANDER_HEALTH = 50
let commanderAlive = false
let commanderDefeated = false
let onCommanderDefeated = null

function spawnCommander(scene, onDefeated) {
  if (commanderAlive) return
  commanderAlive = true
  onCommanderDefeated = onDefeated
  console.log('Commander spawns')

  const commanderGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5)
  const commanderMat = new THREE.MeshStandardMaterial({
    color: 0xff6600,
    emissive: 0xff2200,
    emissiveIntensity: 0.3
  })
  const commanderMesh = new THREE.Mesh(commanderGeo, commanderMat)
  commanderMesh.castShadow = true
  scene.add(commanderMesh)

  const commanderBody = new CANNON.Body({
    mass: 2,
    shape: new CANNON.Box(new CANNON.Vec3(0.75, 0.75, 0.75)),
    position: new CANNON.Vec3(0, 1, -7),
    linearDamping: 0.95
  })
  physicsWorld.addBody(commanderBody)

  commander = {
    mesh: commanderMesh,
    body: commanderBody,
    health: COMMANDER_HEALTH,
    attackTimer: 0,
    chargeTimer: 4,
    isCharging: false,
    chargeDir: new CANNON.Vec3(),
    scene
  }
}

function removeCommander(spawnFragment) {
  if (!commander) return
  commanderDefeated = true

  spawnFragment(commander.body.position)

  commander.scene.remove(commander.mesh)
  physicsWorld.removeBody(commander.body)
  commander.mesh.geometry.dispose()
  commander.mesh.material.dispose()
  commander = null
  commanderAlive = false

  console.log('Commander defeated')
  if (onCommanderDefeated) onCommanderDefeated()
}

function updateCommander(delta, playerBody, spawnFragment) {
  if (!commander) return

  const dir = new CANNON.Vec3(
    playerBody.position.x - commander.body.position.x,
    0,
    playerBody.position.z - commander.body.position.z
  )
  dir.normalize()

  commander.chargeTimer -= delta
  if (commander.chargeTimer <= 0 && !commander.isCharging) {
    commander.isCharging = true
    commander.chargeDir = dir.clone()
    commander.chargeTimer = 5
    setTimeout(() => {
      if (commander) commander.isCharging = false
    }, 600)
  }

  if (commander.isCharging) {
    commander.body.velocity.x = commander.chargeDir.x * 12
    commander.body.velocity.z = commander.chargeDir.z * 12
  } else {
    const speedMultiplier = 1 + (1 - commander.health / COMMANDER_HEALTH) * 1.5
    commander.body.velocity.x = dir.x * 2 * speedMultiplier
    commander.body.velocity.z = dir.z * 2 * speedMultiplier
  }

  commander.mesh.position.copy(commander.body.position)
  commander.mesh.quaternion.copy(commander.body.quaternion)

  const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.3
  commander.mesh.material.emissiveIntensity = pulse

  commander.attackTimer -= delta
  if (commander.attackTimer <= 0) {
    const distToPlayer = new THREE.Vector3(
      playerBody.position.x - commander.body.position.x,
      0,
      playerBody.position.z - commander.body.position.z
    ).length()

    if (distToPlayer < 2) {
      damagePlayer(1, commander.body)
    }
    commander.attackTimer = 2.0
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
    const commanderPos = new THREE.Vector3(
      commander.body.position.x,
      commander.body.position.y,
      commander.body.position.z
    )

    if (hitboxPos.distanceTo(commanderPos) < 1.5) {
      const damage = attackType === 'punch' ? 0.5 : attackType === 'kick' ? 1 : 3
      commander.health -= damage

      const knockback = new CANNON.Vec3(dir.x * -2, 1, dir.z * -2)
      commander.body.applyImpulse(knockback)

      if (commander.health <= 0) {
        removeCommander(spawnFragment)
      }
    }
  }
}

function isCommanderAlive() { return commanderAlive }

export { spawnCommander, updateCommander, isCommanderAlive }
