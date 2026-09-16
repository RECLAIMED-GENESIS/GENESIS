import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { physicsWorld } from '../physics/PhysicsWorld.js';
import { getPlayerBody, playerState, flashPlayer } from '../player/Player.js';
import { combatState, getHitboxBody } from '../player/PlayerPhysics.js';

export const COMMANDER_HEALTH = 20;

let commander = null;
let commanderAlive = false;
let commanderDefeated = false;

export function getCommander() { return commander; }
export function isCommanderAlive() { return commanderAlive; }

export function spawnCommander(scene, onDefeated) {
    if (commanderAlive) return;
    commanderAlive = true;

    const commanderGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const commanderMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff2200, emissiveIntensity: 0.3 });
    const commanderMesh = new THREE.Mesh(commanderGeo, commanderMat);
    commanderMesh.castShadow = true;
    scene.add(commanderMesh);

    const commanderBody = new CANNON.Body({
        mass: 2,
        shape: new CANNON.Box(new CANNON.Vec3(0.75, 0.75, 0.75)),
        position: new CANNON.Vec3(0, 1, -7),
        linearDamping: 0.95
    });
    physicsWorld.addBody(commanderBody);

    commander = {
        mesh: commanderMesh,
        body: commanderBody,
        health: COMMANDER_HEALTH,
        attackTimer: 0,
        chargeTimer: 4,
        isCharging: false,
        chargeDir: new CANNON.Vec3(),
        onDefeated
    };
}

export function removeCommander(scene, audioManager, spawnFragment, showTerminal) {
    if (!commander) return;
    commanderDefeated = true;
    if (spawnFragment) spawnFragment(commander.body.position);
    scene.remove(commander.mesh);
    physicsWorld.removeBody(commander.body);
    commander.mesh.geometry.dispose();
    commander.mesh.material.dispose();
    commander = null;
    commanderAlive = false;
    audioManager?.playSfx('portal_activate');
    if (showTerminal) showTerminal();
}

export function updateCommander(delta, deps) {
    if (!commander) return;
    const { audioManager, updateHUD, hudArgs, scene, spawnFragment, showTerminal } = deps;
    const playerBody = getPlayerBody();
    if (!playerBody) return;

    const dir = new CANNON.Vec3(playerBody.position.x - commander.body.position.x, 0, playerBody.position.z - commander.body.position.z);
    dir.normalize();

    commander.chargeTimer -= delta;
    if (commander.chargeTimer <= 0 && !commander.isCharging) {
        commander.isCharging = true;
        commander.chargeDir = dir.clone();
        commander.chargeTimer = 5;
        setTimeout(() => { if (commander) commander.isCharging = false; }, 600);
    }

    if (commander.isCharging) {
        commander.body.velocity.x = commander.chargeDir.x * 12;
        commander.body.velocity.z = commander.chargeDir.z * 12;
    } else {
        const speedMultiplier = 1 + (1 - commander.health / COMMANDER_HEALTH) * 1.5;
        commander.body.velocity.x = dir.x * 2 * speedMultiplier;
        commander.body.velocity.z = dir.z * 2 * speedMultiplier;
    }

    commander.mesh.position.copy(commander.body.position);
    commander.mesh.quaternion.copy(commander.body.quaternion);

    const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.3;
    commander.mesh.material.emissiveIntensity = pulse;

    commander.attackTimer -= delta;
    if (commander.attackTimer <= 0) {
        const distToPlayer = new THREE.Vector3(playerBody.position.x - commander.body.position.x, 0, playerBody.position.z - commander.body.position.z).length();
        if (distToPlayer < 2 && !playerState.invincible) {
            playerState.health -= 2;
            playerState.invincible = true;
            playerState.invincibleTimer = 1.0;
            flashPlayer();
            if (updateHUD && hudArgs) updateHUD(...hudArgs());
            if (playerState.health <= 0) import('../player/Player.js').then(m => m.triggerGameOver());
        }
        commander.attackTimer = 1.5;
    }

    if (combatState.isAttacking) {
        const hitboxBody = getHitboxBody();
        if (!hitboxBody) return;
        const hitboxPos = new THREE.Vector3(hitboxBody.position.x, hitboxBody.position.y, hitboxBody.position.z);
        const commanderPos = new THREE.Vector3(commander.body.position.x, commander.body.position.y, commander.body.position.z);
        if (hitboxPos.distanceTo(commanderPos) < 1.5) {
            const damage = combatState.attackType === 'punch' ? 1 : 2;
            commander.health -= damage;
            audioManager?.playSfx('boss_hit');
            const knockback = new CANNON.Vec3(dir.x * -2, 1, dir.z * -2);
            commander.body.applyImpulse(knockback);
            if (commander.health <= 0) {
                removeCommander(scene, audioManager, spawnFragment, showTerminal);
            }
        }
    }
}

export function clearCommander(scene) {
    if (!commander) return;
    scene.remove(commander.mesh);
    physicsWorld.removeBody(commander.body);
    commander.mesh.geometry.dispose();
    commander.mesh.material.dispose();
    commander = null;
    commanderAlive = false;
    commanderDefeated = false;
}

export function resetBoss() {
    commander = null;
    commanderAlive = false;
    commanderDefeated = false;
}
