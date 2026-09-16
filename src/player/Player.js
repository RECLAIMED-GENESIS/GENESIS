import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { physicsWorld } from '../physics/PhysicsWorld.js';

export const PLAYER_MAX_HEALTH = 10;
export const PLAYER_FLASH_DURATION = 0.1;

export let playerMesh = null;
export let playerBody = null;

// mutable player state — imported by reference
export const playerState = {
    health: PLAYER_MAX_HEALTH,
    maxHealth: PLAYER_MAX_HEALTH,
    invincible: false,
    invincibleTimer: 0,
    flashing: false,
    flashTimer: 0,
    canJump: false,
    gameOver: false,
    // arena bounds for damping/clamping (Task 3)
    bounds: { minX: -9, maxX: 9, minZ: -9, maxZ: 9 }
};

let gameOverDiv = null;
let onGameOverCallback = null;

/**
 * Create player mesh + body. Must be called after physicsWorld exists.
 * @param {THREE.Scene} scene
 * @returns {{ mesh: THREE.Mesh, body: CANNON.Body }}
 */
export function createPlayer(scene) {
    const playerGeo = new THREE.BoxGeometry(1, 1, 1);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0x00ffff });
    playerMesh = new THREE.Mesh(playerGeo, playerMat);
    playerMesh.castShadow = true;
    scene.add(playerMesh);

    playerBody = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
        position: new CANNON.Vec3(0, 3, 0),
        linearDamping: 0.9
    });
    physicsWorld.addBody(playerBody);

    return { mesh: playerMesh, body: playerBody };
}

export function getPlayerMesh() { return playerMesh; }
export function getPlayerBody() { return playerBody; }

/**
 * Flash player red when hit.
 */
export function flashPlayer() {
    playerState.flashing = true;
    playerState.flashTimer = PLAYER_FLASH_DURATION;
    if (playerMesh) {
        playerMesh.material.color.set(0xff0000);
        playerMesh.material.emissive.set(0xff0000);
        playerMesh.material.emissiveIntensity = 1;
    }
}

export function updatePlayerFlash(delta) {
    if (!playerState.flashing) return;
    playerState.flashTimer -= delta;
    if (playerState.flashTimer <= 0) {
        playerState.flashing = false;
        if (playerMesh) {
            playerMesh.material.color.set(0x00ffff);
            playerMesh.material.emissive.set(0x000000);
            playerMesh.material.emissiveIntensity = 0;
        }
    }
}

export function updateInvincibility(delta) {
    if (playerState.invincible) {
        playerState.invincibleTimer -= delta;
        if (playerState.invincibleTimer <= 0) playerState.invincible = false;
    }
}

export function takeDamage(amount) {
    if (playerState.invincible || playerState.gameOver) return false;
    playerState.health -= amount;
    playerState.invincible = true;
    playerState.invincibleTimer = 0.5;
    flashPlayer();
    if (playerState.health <= 0) {
        triggerGameOver();
    }
    return true;
}

export function triggerGameOver() {
    if (playerState.gameOver) return;
    playerState.gameOver = true;
    if (gameOverDiv) gameOverDiv.style.display = 'flex';
    if (onGameOverCallback) onGameOverCallback();
}

export function createGameOverScreen(onRestart, getUIManager, getAudioManager) {
    onGameOverCallback = () => {
        if (getUIManager) getUIManager()?.hideHUD();
        if (getAudioManager) getAudioManager()?.stopMusic();
    };

    gameOverDiv = document.createElement('div');
    gameOverDiv.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        font-family: monospace;
        z-index: 100;
    `;
    gameOverDiv.innerHTML = `
        <h1 style="color: #ff0000; font-size: 48px; margin-bottom: 20px;">GAME OVER</h1>
        <p style="font-size: 20px; margin-bottom: 40px; color: #aaaaaa;">You were defeated</p>
        <button id="restartBtn" style="
            background: #ff0000;
            color: white;
            border: none;
            padding: 15px 40px;
            font-size: 20px;
            font-family: monospace;
            cursor: pointer;
            border-radius: 8px;
        ">RESTART</button>
    `;
    document.body.appendChild(gameOverDiv);
    document.getElementById('restartBtn').addEventListener('click', () => onRestart());
    return gameOverDiv;
}

export function hideGameOver() {
    if (gameOverDiv) gameOverDiv.style.display = 'none';
}

export function resetPlayer() {
    playerState.health = PLAYER_MAX_HEALTH;
    playerState.invincible = false;
    playerState.invincibleTimer = 0;
    playerState.flashing = false;
    playerState.gameOver = false;
    playerState.canJump = false;
    if (playerBody) {
        playerBody.position.set(0, 3, 0);
        playerBody.velocity.set(0, 0, 0);
    }
    if (playerMesh) {
        playerMesh.material.color.set(0x00ffff);
        playerMesh.material.emissive.set(0x000000);
        playerMesh.material.emissiveIntensity = 0;
    }
    hideGameOver();
}

export function clampToArena() {
    if (!playerBody) return;
    // Keep player within bounds — Task 3 requirement
    const b = playerState.bounds;
    if (playerBody.position.x < b.minX) {
        playerBody.position.x = b.minX;
        playerBody.velocity.x = 0;
    }
    if (playerBody.position.x > b.maxX) {
        playerBody.position.x = b.maxX;
        playerBody.velocity.x = 0;
    }
    if (playerBody.position.z < b.minZ) {
        playerBody.position.z = b.minZ;
        playerBody.velocity.z = 0;
    }
    if (playerBody.position.z > b.maxZ) {
        playerBody.position.z = b.maxZ;
        playerBody.velocity.z = 0;
    }
}
