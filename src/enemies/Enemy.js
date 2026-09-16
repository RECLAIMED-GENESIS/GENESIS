import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { physicsWorld } from '../physics/PhysicsWorld.js';
import { getPlayerBody, playerState, takeDamage, flashPlayer } from '../player/Player.js';
import { combatState, getHitboxBody } from '../player/PlayerPhysics.js';

export const ENEMY_TYPES = {
    normal: { color: 0xff0000, size: 1, health: 5, speed: 2, damage: 1, attackRate: 1.0 },
    fast:   { color: 0xff6600, size: 0.7, health: 2, speed: 4, damage: 1, attackRate: 0.8 },
    heavy:  { color: 0x990000, size: 1.4, health: 12, speed: 1, damage: 2, attackRate: 2.0 },
    tank:   { color: 0x660000, size: 1.8, health: 20, speed: 0.8, damage: 3, attackRate: 2.5 }
};

export const enemies = [];

/**
 * Spawn a single enemy.
 * @param {THREE.Scene} scene
 * @param {string} type
 * @param {CANNON.Vec3|null} spawnPos
 * @param {Function} onEnemyRemoved optional callback when count hits 0
 */
export function spawnEnemy(scene, type = 'normal', spawnPos = null) {
    const config = ENEMY_TYPES[type];
    const s = config.size;

    const enemyGeo = new THREE.BoxGeometry(s, s, s);
    const enemyMat = new THREE.MeshStandardMaterial({ color: config.color });
    const enemyMesh = new THREE.Mesh(enemyGeo, enemyMat);
    enemyMesh.castShadow = true;
    scene.add(enemyMesh);

    const barContainer = document.createElement('div');
    barContainer.style.cssText = `
        position: fixed;
        width: 50px;
        height: 6px;
        background: #333;
        border: 1px solid #666;
        pointer-events: none;
        z-index: 50;
    `;
    const barFill = document.createElement('div');
    barFill.style.cssText = `width: 100%; height: 100%; background: #ff0000;`;
    barContainer.appendChild(barFill);
    document.body.appendChild(barContainer);

    const pos = spawnPos || new CANNON.Vec3((Math.random() - 0.5) * 16, 1, (Math.random() - 0.5) * 16);

    const enemyBody = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Box(new CANNON.Vec3(s / 2, s / 2, s / 2)),
        position: pos,
        linearDamping: 0.9
    });
    physicsWorld.addBody(enemyBody);

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
        barFill
    });
}

export function removeEnemy(enemy, scene, audioManager, onEmptyWave) {
    scene.remove(enemy.mesh);
    physicsWorld.removeBody(enemy.body);
    enemy.mesh.geometry.dispose();
    enemy.mesh.material.dispose();
    if (enemy.barContainer?.parentNode) document.body.removeChild(enemy.barContainer);
    enemies.splice(enemies.indexOf(enemy), 1);
    audioManager?.playSfx('enemy_death');
    if (enemies.length === 0 && onEmptyWave) onEmptyWave();
}

export function clearAllEnemies(scene) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        scene.remove(e.mesh);
        physicsWorld.removeBody(e.body);
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        if (e.barContainer?.parentNode) e.barContainer.parentNode.removeChild(e.barContainer);
    }
    enemies.length = 0;
}

/**
 * Per-frame update for all enemies — movement, health bars, player damage, hitbox checks.
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {number} delta
 * @param {Object} deps
 */
export function updateEnemies(scene, camera, delta, { audioManager, updateHUD, hudArgs, onEnemyKilled }) {
    const playerBody = getPlayerBody();
    const hitboxBody = getHitboxBody();
    if (!playerBody) return;

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        const dir = new CANNON.Vec3(playerBody.position.x - enemy.body.position.x, 0, playerBody.position.z - enemy.body.position.z);
        dir.normalize();

        enemy.body.velocity.x = dir.x * enemy.speed;
        enemy.body.velocity.z = dir.z * enemy.speed;

        enemy.mesh.position.copy(enemy.body.position);
        enemy.mesh.quaternion.copy(enemy.body.quaternion);

        // health bar screen pos
        const enemyScreenPos = enemy.mesh.position.clone();
        enemyScreenPos.y += 1;
        enemyScreenPos.project(camera);
        const x = (enemyScreenPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-enemyScreenPos.y * 0.5 + 0.5) * window.innerHeight;
        enemy.barContainer.style.left = (x - 25) + 'px';
        enemy.barContainer.style.top = (y - 20) + 'px';
        const healthPercent = (enemy.health / enemy.maxHealth) * 100;
        enemy.barFill.style.width = Math.max(0, healthPercent) + '%';
        enemy.barFill.style.background = healthPercent > 50 ? '#00ff00' : healthPercent > 25 ? '#ffff00' : '#ff0000';

        // attack player
        enemy.attackTimer -= delta;
        if (enemy.attackTimer <= 0) {
            const dist = new THREE.Vector3(playerBody.position.x - enemy.body.position.x, 0, playerBody.position.z - enemy.body.position.z).length();
            if (dist < 1.5 && !playerState.invincible) {
                playerState.health -= enemy.damage;
                playerState.invincible = true;
                playerState.invincibleTimer = 0.5;
                flashPlayer();
                if (updateHUD && hudArgs) updateHUD(...hudArgs());
                if (playerState.health <= 0) {
                    // triggerGameOver imported via Player
                    import('../player/Player.js').then(m => m.triggerGameOver());
                }
            }
            enemy.attackTimer = enemy.attackRate;
        }

        // player hitbox hits enemy
        if (combatState.isAttacking && hitboxBody) {
            const hitboxPos = new THREE.Vector3(hitboxBody.position.x, hitboxBody.position.y, hitboxBody.position.z);
            const enemyPos = new THREE.Vector3(enemy.body.position.x, enemy.body.position.y, enemy.body.position.z);
            if (hitboxPos.distanceTo(enemyPos) < 1.2) {
                const damage = combatState.attackType === 'punch' ? 1 : 2;
                enemy.health -= damage;
                audioManager?.playSfx('punch_hit');
                const knockback = new CANNON.Vec3(dir.x * -5, 2, dir.z * -5);
                enemy.body.applyImpulse(knockback);
                if (enemy.health <= 0) {
                    if (onEnemyKilled) onEnemyKilled(enemy);
                    else removeEnemy(enemy, scene, audioManager, null);
                }
            }
        }
    }
}
