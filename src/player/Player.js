import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { physicsWorld } from '../physics/PhysicsWorld.js'
import { playerBody } from './PlayerPhysics.js'

// PLAYER MESH
const playerGeo = new THREE.BoxGeometry(1, 1, 1)
const playerMat = new THREE.MeshStandardMaterial({ color: 0x00ffff })
const playerMesh = new THREE.Mesh(playerGeo, playerMat)
playerMesh.castShadow = true

// PLAYER HEALTH
let playerHealth = 30
const PLAYER_MAX_HEALTH = 30
let playerInvincible = false
let playerInvincibleTimer = 0
let playerFlashTimer = 0
const PLAYER_FLASH_DURATION = 0.1
let playerFlashing = false

// JUMP
let canJump = false

function enableJump() {
  canJump = true
}

// GAME OVER STATE
let gameOver = false

function flashPlayer() {
  playerFlashing = true
  playerFlashTimer = PLAYER_FLASH_DURATION
  playerMesh.material.color.set(0xff0000)
  playerMesh.material.emissive.set(0xff0000)
  playerMesh.material.emissiveIntensity = 1
}

function triggerGameOver() {
  if (gameOver) return
  gameOver = true
}

function getGameOver() {
  return gameOver
}

function getPlayerHealth() {
  return playerHealth
}

function getPlayerMaxHealth() {
  return PLAYER_MAX_HEALTH
}

function damagePlayer(amount, enemyBody) {
  if (playerInvincible) return

  playerHealth -= amount
  playerInvincible = true
  playerInvincibleTimer = 1.0
  flashPlayer()

  if (enemyBody) {
    const knockbackDir = new CANNON.Vec3(
      playerBody.position.x - enemyBody.position.x,
      0,
      playerBody.position.z - enemyBody.position.z
    )
    knockbackDir.normalize()
    playerBody.applyImpulse(
      new CANNON.Vec3(
        knockbackDir.x * 6,
        2,
        knockbackDir.z * 6
      )
    )
  }

  if (playerHealth <= 0) triggerGameOver()
}

function healPlayer(amount) {
  playerHealth = Math.min(playerHealth + amount, PLAYER_MAX_HEALTH)
  console.log('Healed, player health:', playerHealth)
  playerMesh.material.emissive.set(0x00ff00)
  playerMesh.material.emissiveIntensity = 0.5
  setTimeout(() => {
    playerMesh.material.emissive.set(0x000000)
    playerMesh.material.emissiveIntensity = 0
  }, 300)
}

// COMBAT
let isAttacking = false
let attackType = null
let attackTimer = 0
const ATTACK_DURATION = 0.2

// CHARGED ATTACK
let isCharging = false
let chargeHoldTimer = 0
const CHARGE_THRESHOLD = 1.0
let chargeReady = false
let level2Unlocked = false

function unlockLevel2Abilities() {
  level2Unlocked = true
  console.log('Blade of light unlocked')
}

const attackGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5)
const attackMatPunch = new THREE.MeshStandardMaterial({
  color: 0xff4400,
  emissive: 0xff4400
})
const attackMatKick = new THREE.MeshStandardMaterial({
  color: 0xffff00,
  emissive: 0xffff00
})
const attackMatCharge = new THREE.MeshStandardMaterial({
  color: 0x00ffff,
  emissive: 0x00ffff,
  emissiveIntensity: 1
})
const attackIndicator = new THREE.Mesh(attackGeo, attackMatPunch)
attackIndicator.visible = false

const hitboxBody = new CANNON.Body({
  type: CANNON.Body.KINEMATIC,
  shape: new CANNON.Box(new CANNON.Vec3(0.6, 0.5, 0.6)),
  collisionFilterGroup: 2,
  collisionFilterMask: 4
})
physicsWorld.addBody(hitboxBody)

// DODGE ROLL
let isDodging = false
let dodgeTimer = 0
let dodgeCooldown = 0
const DODGE_DURATION = 0.3
const DODGE_COOLDOWN = 1.0
const DODGE_SPEED = 12
let dodgeDir = new CANNON.Vec3()

function startDodge(velocity) {
  if (isDodging || dodgeCooldown > 0) return
  isDodging = true
  dodgeTimer = DODGE_DURATION
  dodgeCooldown = DODGE_COOLDOWN

  if (velocity.x !== 0 || velocity.z !== 0) {
    dodgeDir.set(velocity.x, 0, velocity.z)
  } else {
    dodgeDir.set(0, 0, -1)
  }

  const len = Math.sqrt(dodgeDir.x * dodgeDir.x + dodgeDir.z * dodgeDir.z)
  dodgeDir.x /= len
  dodgeDir.z /= len

  playerInvincible = true
  playerInvincibleTimer = DODGE_DURATION
}

function getIsAttacking() { return isAttacking }
function getAttackType() { return attackType }
function getHitboxBody() { return hitboxBody }
function getIsDodging() { return isDodging }
function isLevel2Unlocked() { return level2Unlocked }

function setupCombatInput() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyZ' && !isAttacking && !isCharging) {
      if (level2Unlocked) {
        // Start charging
        isCharging = true
        chargeHoldTimer = 0
        chargeReady = false
        attackIndicator.material = attackMatCharge
        attackIndicator.scale.set(1, 1, 1)
        attackIndicator.visible = true
      } else {
        isAttacking = true
        attackType = 'punch'
        attackTimer = ATTACK_DURATION
        attackIndicator.material = attackMatPunch
        attackIndicator.visible = true
      }
    }

    if (e.code === 'KeyX' && !isAttacking) {
      isAttacking = true
      attackType = 'kick'
      attackTimer = ATTACK_DURATION
      attackIndicator.material = attackMatKick
      attackIndicator.visible = true
    }
  })

  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyZ' && isCharging) {
      isCharging = false
      chargeReady = false

      isAttacking = true
      attackIndicator.visible = true

      if (chargeHoldTimer >= CHARGE_THRESHOLD) {
        attackType = 'charge'
        attackTimer = 0.5
        attackIndicator.material = attackMatCharge
        attackIndicator.scale.set(3, 1, 1)
        attackIndicator.material.emissiveIntensity = 2
        console.log('CHARGE ATTACK released')
      } else {
        attackType = 'punch'
        attackTimer = ATTACK_DURATION
        attackIndicator.material = attackMatPunch
        attackIndicator.scale.set(1, 1, 1)
      }
    }
  })

  window.addEventListener('click', () => {
    if (!isAttacking && !isCharging) {
      isAttacking = true
      attackType = 'punch'
      attackTimer = ATTACK_DURATION
      attackIndicator.material = attackMatPunch
      attackIndicator.visible = true
    }
  })
}

function setupJump(floorBody) {
  playerBody.addEventListener('collide', (e) => {
    if (e.body === floorBody) {
      canJump = true
    }
  })
}

function updatePlayer(delta, keys, camera) {
  if (gameOver) return

  const speed = 5
  const velocity = new CANNON.Vec3()

  if (!isDodging) {
    if (keys['KeyA'] || keys['ArrowLeft'])  velocity.x = -speed
    if (keys['KeyD'] || keys['ArrowRight']) velocity.x =  speed
    if (keys['KeyW'] || keys['ArrowUp'])    velocity.z = -speed
    if (keys['KeyS'] || keys['ArrowDown'])  velocity.z =  speed

    playerBody.velocity.x = velocity.x
    playerBody.velocity.z = velocity.z

    if (velocity.x !== 0 || velocity.z !== 0) {
      const angle = Math.atan2(velocity.x, velocity.z)
      playerBody.quaternion.setFromEuler(0, angle, 0)
    }

    if ((keys['ShiftLeft'] || keys['KeyC']) && !isDodging && dodgeCooldown <= 0) {
      startDodge(velocity)
    }
  } else {
    playerBody.velocity.x = dodgeDir.x * DODGE_SPEED
    playerBody.velocity.z = dodgeDir.z * DODGE_SPEED

    dodgeTimer -= delta
    if (dodgeTimer <= 0) isDodging = false
  }

  // Jump
  if (keys['Space'] && canJump) {
    playerBody.velocity.y = 7
    canJump = false
  }

  // Dodge cooldown
  if (dodgeCooldown > 0) dodgeCooldown -= delta

  // Invincibility timer
  if (playerInvincible) {
    playerInvincibleTimer -= delta
    if (playerInvincibleTimer <= 0) playerInvincible = false
  }

  // Flash timer
  if (playerFlashing) {
    playerFlashTimer -= delta
    if (playerFlashTimer <= 0) {
      playerFlashing = false
      playerMesh.material.color.set(0x00ffff)
      playerMesh.material.emissive.set(0x000000)
      playerMesh.material.emissiveIntensity = 0
    }
  }

  // Charge hold timer
  if (isCharging) {
    chargeHoldTimer += delta
    const chargeScale = Math.min(1 + chargeHoldTimer * 2, 3)
    attackIndicator.scale.set(chargeScale, 1, 1)

    if (chargeHoldTimer >= CHARGE_THRESHOLD && !chargeReady) {
      chargeReady = true
      attackIndicator.material.emissiveIntensity = 2
      console.log('Charge ready - release Z')
    }

    const forward = new THREE.Vector3(velocity.x, 0, velocity.z)
    if (forward.length() === 0) {
      forward.set(0, 0, -1)
      forward.applyQuaternion(playerMesh.quaternion)
    } else {
      forward.normalize()
    }
    forward.multiplyScalar(1.2)

    const indicatorPos = playerMesh.position.clone().add(forward)
    indicatorPos.y = playerMesh.position.y + 0.2
    attackIndicator.position.copy(indicatorPos)
    hitboxBody.position.set(indicatorPos.x, indicatorPos.y, indicatorPos.z)
  }

  // Combat
  if (isAttacking) {
    attackTimer -= delta

    const forward = new THREE.Vector3(velocity.x, 0, velocity.z)

    if (forward.length() === 0) {
      forward.set(0, 0, -1)
      forward.applyQuaternion(playerMesh.quaternion)
    } else {
      forward.normalize()
    }

    forward.multiplyScalar(1.2)

    const hitboxPos = playerMesh.position.clone().add(forward)
    hitboxPos.y = attackType === 'punch' || attackType === 'charge'
      ? playerMesh.position.y + 0.2
      : playerMesh.position.y - 0.2

    hitboxBody.position.set(hitboxPos.x, hitboxPos.y, hitboxPos.z)
    attackIndicator.position.copy(hitboxPos)

    if (attackTimer <= 0) {
      isAttacking = false
      attackType = null
      attackIndicator.visible = false
      attackIndicator.scale.set(1, 1, 1)
      attackIndicator.material.emissiveIntensity = 1
    }
  }

  // Sync mesh with physics body
  playerMesh.position.copy(playerBody.position)
  playerMesh.quaternion.copy(playerBody.quaternion)

  // Camera follows player
  camera.position.x = playerMesh.position.x
  camera.position.y = playerMesh.position.y + 5
  camera.position.z = playerMesh.position.z + 10
  camera.lookAt(playerMesh.position)
}

export {
  playerMesh,
  attackIndicator,
  playerHealth,
  PLAYER_MAX_HEALTH,
  getGameOver,
  getPlayerHealth,
  getPlayerMaxHealth,
  damagePlayer,
  healPlayer,
  getIsAttacking,
  getAttackType,
  getHitboxBody,
  getIsDodging,
  setupCombatInput,
  setupJump,
  unlockLevel2Abilities,
  isLevel2Unlocked,
  updatePlayer
}
