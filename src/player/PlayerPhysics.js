import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { floorBody } from '../physics/PhysicsWorld.js';
import { getPlayerBody, getPlayerMesh, playerState, clampToArena } from './Player.js';

// combat state exported for Enemies/Boss to read
export const combatState = {
    isAttacking: false,
    attackType: null,
    attackTimer: 0,
    ATTACK_DURATION: 0.2
};

let attackIndicator = null;
let hitboxBody = null;
let attackMatPunch = null;
let attackMatKick = null;

/**
 * Setup combat visuals + kinematic hitbox body.
 * @param {THREE.Scene} scene
 * @param {CANNON.World} physicsWorld
 */
export function initCombat(scene, physicsWorld) {
    const attackGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    attackMatPunch = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff4400 });
    attackMatKick = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00 });
    attackIndicator = new THREE.Mesh(attackGeo, attackMatPunch);
    attackIndicator.visible = false;
    scene.add(attackIndicator);

    hitboxBody = new CANNON.Body({
        type: CANNON.Body.KINEMATIC,
        shape: new CANNON.Box(new CANNON.Vec3(0.6, 0.5, 0.6)),
        collisionFilterGroup: 2,
        collisionFilterMask: 4
    });
    physicsWorld.addBody(hitboxBody);

    return { attackIndicator, hitboxBody };
}

export function getHitboxBody() { return hitboxBody; }
export function getAttackIndicator() { return attackIndicator; }

export function triggerAttack(type, audioManager) {
    if (combatState.isAttacking) return;
    combatState.isAttacking = true;
    combatState.attackType = type;
    combatState.attackTimer = combatState.ATTACK_DURATION;
    if (attackIndicator) {
        attackIndicator.material = type === 'punch' ? attackMatPunch : attackMatKick;
        attackIndicator.visible = true;
    }
    audioManager?.playSfx('punch_hit');
}

/**
 * Handle WASD/arrow movement + jump. Call every frame.
 * @param {Object} keys
 * @param {number} delta
 */
export function handleMovement(keys, delta) {
    const body = getPlayerBody();
    const mesh = getPlayerMesh();
    if (!body || !mesh) return new CANNON.Vec3();

    const speed = 5;
    const velocity = new CANNON.Vec3();

    if (keys['KeyA'] || keys['ArrowLeft'])  velocity.x = -speed;
    if (keys['KeyD'] || keys['ArrowRight']) velocity.x =  speed;
    if (keys['KeyW'] || keys['ArrowUp'])    velocity.z = -speed;
    if (keys['KeyS'] || keys['ArrowDown'])  velocity.z =  speed;

    // Apply damping via linearDamping on body + direct assignment; clamp keeps bounds
    body.velocity.x = velocity.x;
    body.velocity.z = velocity.z;

    if (velocity.x !== 0 || velocity.z !== 0) {
        const angle = Math.atan2(velocity.x, velocity.z);
        body.quaternion.setFromEuler(0, angle, 0);
    }

    // Jump — Task 4
    if (keys['Space'] && playerState.canJump) {
        body.velocity.y = 7;
        playerState.canJump = false;
    }

    clampToArena();

    return velocity;
}

export function updateCombat(delta, lastVelocity) {
    if (!combatState.isAttacking) return;
    const mesh = getPlayerMesh();
    if (!mesh || !hitboxBody || !attackIndicator) return;

    combatState.attackTimer -= delta;

    const forward = new THREE.Vector3(lastVelocity.x, 0, lastVelocity.z);
    if (forward.length() === 0) {
        forward.set(0, 0, -1);
        forward.applyQuaternion(mesh.quaternion);
    } else {
        forward.normalize();
    }
    forward.multiplyScalar(1.2);
    const hitboxPos = mesh.position.clone().add(forward);
    hitboxPos.y = combatState.attackType === 'punch' ? mesh.position.y + 0.2 : mesh.position.y - 0.2;

    hitboxBody.position.set(hitboxPos.x, hitboxPos.y, hitboxPos.z);
    attackIndicator.position.copy(hitboxPos);

    if (combatState.attackTimer <= 0) {
        combatState.isAttacking = false;
        combatState.attackType = null;
        attackIndicator.visible = false;
    }
}

export function resetCombat() {
    combatState.isAttacking = false;
    combatState.attackType = null;
    combatState.attackTimer = 0;
    if (attackIndicator) attackIndicator.visible = false;
}

/**
 * Setup ground detection + keyboard listeners. Call once after player created.
 * @param {Object} keys  shared keys map (mutated by listeners)
 * @param {Function} getAudioManager lazy getter for audio
 */
export function setupInput(keys, getAudioManager) {
    const body = getPlayerBody();
    if (body && floorBody) {
        body.addEventListener('collide', (e) => {
            if (e.body === floorBody) playerState.canJump = true;
        });
    }

    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (e.code === 'KeyZ' && !combatState.isAttacking) triggerAttack('punch', getAudioManager());
        if (e.code === 'KeyX' && !combatState.isAttacking) triggerAttack('kick', getAudioManager());
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.addEventListener('click', () => {
        if (!combatState.isAttacking) triggerAttack('punch', getAudioManager());
    });
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!combatState.isAttacking) triggerAttack('kick', getAudioManager());
    });
}

export function hideCombatVisuals() {
    if (attackIndicator) attackIndicator.visible = false;
}
