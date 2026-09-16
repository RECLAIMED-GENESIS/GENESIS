import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { getPlayerMesh } from '../player/Player.js';

/**
 * Level 1 — The Flat World
 * Handles fragments, terminal and portal logic.
 * Floor/walls are created by PhysicsWorld, but Level ties them together.
 */

export const FRAGMENTS_NEEDED = 8;

export const fragments = [];
export let fragmentsCollected = 0;

let terminalMesh = null;
let screenMesh = null;
let terminalVisible = false;
let terminalActive = false;

let portalMesh = null;
let portalActive = false;

export function getTerminalMesh() { return terminalMesh; }
export function getPortalMesh() { return portalMesh; }
export function isTerminalVisible() { return terminalVisible; }
export function isPortalActive() { return portalActive; }
export function getFragmentsCollected() { return fragmentsCollected; }

export function initLevel1(scene) {
    // Terminal
    const terminalGeo = new THREE.BoxGeometry(1.5, 2, 0.5);
    const terminalMat = new THREE.MeshStandardMaterial({ color: 0x003333, emissive: 0x00ffff, emissiveIntensity: 0.2 });
    terminalMesh = new THREE.Mesh(terminalGeo, terminalMat);
    terminalMesh.position.set(0, 1, -8);
    terminalMesh.visible = false;
    scene.add(terminalMesh);

    const screenGeo = new THREE.PlaneGeometry(1, 1.2);
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.8 });
    screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.set(0, 1.2, -7.74);
    screenMesh.visible = false;
    scene.add(screenMesh);

    // Portal
    const portalGeo = new THREE.TorusGeometry(2, 0.3, 16, 100);
    const portalMat = new THREE.MeshStandardMaterial({ color: 0x9900ff, emissive: 0x9900ff, emissiveIntensity: 0.8 });
    portalMesh = new THREE.Mesh(portalGeo, portalMat);
    portalMesh.position.set(0, 2, -9);
    portalMesh.visible = false;
    scene.add(portalMesh);
}

export function spawnFragment(scene, position) {
    const fragmentGeo = new THREE.OctahedronGeometry(0.4);
    const fragmentMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.5 });
    const fragmentMesh = new THREE.Mesh(fragmentGeo, fragmentMat);
    fragmentMesh.position.set(position.x, 1, position.z);
    scene.add(fragmentMesh);
    fragments.push(fragmentMesh);
}

export function checkFragmentCollection(scene, audioManager, updateHUD, hudArgs) {
    const playerMesh = getPlayerMesh();
    if (!playerMesh) return;
    for (let i = fragments.length - 1; i >= 0; i--) {
        const fragment = fragments[i];
        const distance = fragment.position.distanceTo(playerMesh.position);
        if (distance < 1.5) {
            scene.remove(fragment);
            fragment.geometry.dispose();
            fragment.material.dispose();
            fragments.splice(i, 1);
            fragmentsCollected++;
            audioManager?.playSfx('fragment_collected');
            if (updateHUD && hudArgs) updateHUD(...hudArgs());
        }
    }
}

export function showTerminal() {
    terminalVisible = true;
    if (terminalMesh) terminalMesh.visible = true;
    if (screenMesh) screenMesh.visible = true;
}

export function activateTerminal(activatePortalFn) {
    if (fragmentsCollected < FRAGMENTS_NEEDED) return;
    terminalActive = true;
    activatePortalFn();
}

export function checkTerminalInteraction(keys, activatePortalFn) {
    if (!terminalVisible || terminalActive) return;
    const playerMesh = getPlayerMesh();
    if (!playerMesh || !terminalMesh) return;
    const distance = terminalMesh.position.distanceTo(playerMesh.position);
    if (distance < 3 && keys['KeyE']) {
        activateTerminal(activatePortalFn);
    }
}

export function activatePortal(audioManager) {
    portalActive = true;
    if (portalMesh) portalMesh.visible = true;
    audioManager?.playSfx('portal_activate');
}

export function checkPortalEntry() {
    if (!portalActive) return;
    const playerMesh = getPlayerMesh();
    if (!playerMesh || !portalMesh) return;
    const distance = portalMesh.position.distanceTo(playerMesh.position);
    if (distance < 2.5) {
        console.log('🚪 ENTERING LEVEL 2');
    }
}

export function updateLevelVisuals() {
    fragments.forEach(f => f.rotation.y += 0.02);
    if (terminalVisible && screenMesh) {
        const pulse = Math.sin(Date.now() * 0.003) * 0.3 + 0.5;
        screenMesh.material.emissiveIntensity = pulse;
    }
    if (portalActive && portalMesh) portalMesh.rotation.z += 0.01;
}

export function clearFragments(scene) {
    for (let i = fragments.length - 1; i >= 0; i--) {
        const f = fragments[i];
        scene.remove(f);
        f.geometry.dispose();
        f.material.dispose();
    }
    fragments.length = 0;
}

export function resetLevel1(scene) {
    clearFragments(scene);
    fragmentsCollected = 0;
    terminalVisible = false;
    terminalActive = false;
    portalActive = false;
    if (terminalMesh) terminalMesh.visible = false;
    if (screenMesh) screenMesh.visible = false;
    if (portalMesh) portalMesh.visible = false;
}

export function setFragmentsCollected(v) { fragmentsCollected = v; }
export function getScreenMesh() { return screenMesh; }
