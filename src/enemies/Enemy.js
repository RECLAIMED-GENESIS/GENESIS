import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { physicsWorld } from '../physics/PhysicsWorld.js'
import { getIsAttacking, getAttackType, getHitboxBody, damagePlayer, healPlayer } from '../player/Player.js'

const ENEMY_TYPES = {
  normal: {
    color: 0xff0000,
    size: 1,
    health: 10,
    speed: 1.5,
    damage: 1,
    attackRate: 1.5
  },
  fast: {
    color: 0xff6600,
    size: 0.7,
    health: 6,
    speed: 3,
    damage: 1,
    attackRate: 1.2
  },
  heavy: {
    color: 0x990000,
    size: 1.4,
    health: 25,
    speed: 0.8,
    damage: 2,
    attackRate: 2.5
  },
  tank: {
    color: 0x660000,
    size: 1.8,
    health: 40,
    speed: 0.6,
    damage: 2,
    attackRate: 3.0
  }
}

const enemies = []

function spawnEnemy(scene, type = 'normal', spawnPos = null) {
  const config = ENEMY_TYPES[type]
  const s = config.size

  const enemyGeo = new THREE.BoxGeometry(s, s, s)
  const enemyMat = new THREE.MeshStandardMaterial({ color: config.color })
  const enemyMesh = new THREE.Mesh(enemyGeo, enemyMat)
  enemyMesh.castShadow = true
  scene.add(enemyMesh)

  const barContainer = document.createElement('div')
  barContainer.style.cssText = `
    position: fixed;
    width: 50px;
    height: 6px;
    background: #333;
    border: 1px solid #666;
    pointer-events: none;
    z-index: 50;
  `
  const barFill = document.createElement('div')
  barFill.style.cssText = `
    width: 100%;
    height: 100%;
    background: #ff0000;
  `
  barContainer.appendChild(barFill)
  document.body.appendChild(barContainer)

  const pos = spawnPos || new CANNON.Vec3(
    (Math.random() - 0.5) * 16,
    1,
    (Math.random() - 0.5) * 16
  )

  const enemyBody = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Box(new CANNON.Vec3(s / 2, s / 2, s / 2)),
    position: pos,
    linearDamping: 0.9
  })
  physicsWorld.addBody(enemyBody)

  enemies.push({
    mesh: enemyMesh,
    body: enemyBody,
    health: config.health,
    maxHealth: config.health,
    speed: config.speed,
    damage: config.damage,
    attackRate: config.attackRate,
    attackTimer: 0,
    type,
    barContainer,
    barFill,
    scene
  })
}

function removeEnemy(enemy, onAllDefeated) {
  enemy.scene.remove(enemy.mesh)
  physicsWorld.removeBody(enemy.body)
  enemy.mesh.geometry.dispose()
  enemy.mesh.material.dispose()
  document.body.removeChild(enemy.barContainer)
  enemies.splice(enemies.indexOf(enemy), 1)

  // 25% chance to drop health
  if (Math.random() < 0.25) {
    healPlayer(3)
    console.log('Enemy dropped health')
  }

  if (enemies.length === 0 && onAllDefeated) {
    onAllDefeated()
  }
}

function updateEnemies(delta, playerBody, playerMesh, camera) {
  const hitboxBody = getHitboxBody()
  const isAttacking = getIsAttacking()
  const attackType = getAttackType()

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i]

    const dir = new CANNON.Vec3(
      playerBody.position.x - enemy.body.position.x,
      0,
      playerBody.position.z - enemy.body.position.z
    )
    dir.normalize()

    enemy.body.velocity.x = dir.x * enemy.speed
    enemy.body.velocity.z = dir.z * enemy.speed

    enemy.mesh.position.copy(enemy.body.position)
    enemy.mesh.quaternion.copy(enemy.body.quaternion)

    // Update health bar position
    const enemyScreenPos = enemy.mesh.position.clone()
    enemyScreenPos.y += 1
    enemyScreenPos.project(camera)

    const x = (enemyScreenPos.x * 0.5 + 0.5) * window.innerWidth
    const y = (-enemyScreenPos.y * 0.5 + 0.5) * window.innerHeight

    enemy.barContainer.style.left = (x - 25) + 'px'
    enemy.barContainer.style.top = (y - 20) + 'px'

    const healthPercent = (enemy.health / enemy.maxHealth) * 100
    enemy.barFill.style.width = Math.max(0, healthPercent) + '%'

    if (healthPercent > 50) {
      enemy.barFill.style.background = '#00ff00'
    } else if (healthPercent > 25) {
      enemy.barFill.style.background = '#ffff00'
    } else {
      enemy.barFill.style.background = '#ff0000'
    }

    // Enemy attacks player
    enemy.attackTimer -= delta
    if (enemy.attackTimer <= 0) {
      const distToPlayer = new THREE.Vector3(
        playerBody.position.x - enemy.body.position.x,
        0,
        playerBody.position.z - enemy.body.position.z
      ).length()

      if (distToPlayer < 1.5) {
        damagePlayer(enemy.damage, enemy.body)
      }
      enemy.attackTimer = enemy.attackRate
    }

    // Check if player hitbox hits enemy
    if (isAttacking) {
      const hitboxPos = new THREE.Vector3(
        hitboxBody.position.x,
        hitboxBody.position.y,
        hitboxBody.position.z
      )
      const enemyPos = new THREE.Vector3(
        enemy.body.position.x,
        enemy.body.position.y,
        enemy.body.position.z
      )

      // Charge attack has a bigger hit range
      const hitRange = attackType === 'charge' ? 3.0 : 1.2
      const damage = attackType === 'punch' ? 2 : attackType === 'kick' ? 4 : 10

      if (hitboxPos.distanceTo(enemyPos) < hitRange) {
        enemy.health -= damage

        // Charge sends enemies flying
        const knockbackForce = attackType === 'charge' ? 12 : 5
        const knockback = new CANNON.Vec3(dir.x * -knockbackForce, 3, dir.z * -knockbackForce)
        enemy.body.applyImpulse(knockback)

        if (enemy.health <= 0) removeEnemy(enemy, null)
      }
    }
  }
}

function getEnemies() { return enemies }

export { spawnEnemy, removeEnemy, updateEnemies, getEnemies }
