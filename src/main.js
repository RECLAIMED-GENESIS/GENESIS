// src/main.js - COMPLETE WITH UI + LOADING SCREEN + AUDIO
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Minimap } from './Minimap.js';
import { AudioManager } from './audio/AudioManager.js';
import { loadAllAudio } from './audio/loadAudio.js';
import { UIManager } from './ui/UIManager.js';
import { createMainMenu } from './ui/MainMenu.js';
import { createHUD, updateHUD } from './ui/HUD.js';
import { createLoadingScreen, updateLoadingScreen } from './ui/LoadingScreen.js';

// ============================================
// AUDIO SYSTEM
// ============================================
const audioManager = new AudioManager();
loadAllAudio(audioManager);
console.log('🎵 Audio system ready');

// ============================================
// UI SYSTEM INITIALIZATION
// ============================================
const uiManager = new UIManager();

// Create and register HUD
const hudElement = createHUD();
uiManager.registerScreen('hud', hudElement);

// Create and register Loading Screen
const loadingScreenElement = createLoadingScreen();
uiManager.registerScreen('loading', loadingScreenElement);

// Create and register Main Menu
const mainMenuElement = createMainMenu(
    // onPlayClick
    () => {
        console.log('🎮 Game Started!');
        audioManager.playLevelMusic(1);
        
        // Show loading screen first
        uiManager.showScreen('loading');
        updateLoadingScreen(
            'LEVEL 1',
            'THE FLAT WORLD',
            'The slave labour camp. Fight your way through the guards and collect the Gold Fragments.',
            0,
            'Initializing...'
        );
        
        // Simulate loading progress
        let progress = 0;
        const loadInterval = setInterval(() => {
            progress += Math.random() * 15 + 5;
            if (progress >= 100) {
                progress = 100;
                clearInterval(loadInterval);
                updateLoadingScreen(
                    'LEVEL 1',
                    'THE FLAT WORLD',
                    'The slave labour camp. Fight your way through the guards and collect the Gold Fragments.',
                    100,
                    'Ready!',
                    true
                );
                // Wait for Continue button
                const continueBtn = document.getElementById('continueBtn');
                if (continueBtn) {
                    continueBtn.onclick = () => {
                      if (gameOver) {
                        resetGame();
                      }
                        uiManager.hideAllScreens();
                        uiManager.showHUD();
                        if (!gameStarted) {
                            gameStarted = true;
                            spawnWave();
                            animate();
                        }
                    };
                }
            } else {
                const statuses = ['Loading assets...', 'Building world...', 'Spawning enemies...', 'Almost ready...'];
                const statusIndex = Math.floor(Math.random() * statuses.length);
                updateLoadingScreen(
                    'LEVEL 1',
                    'THE FLAT WORLD',
                    'The slave labour camp. Fight your way through the guards and collect the Gold Fragments.',
                    progress,
                    statuses[statusIndex % statuses.length]
                );
            }
        }, 200);
    },
  
          // onCreditsClick
    () => {
        console.log('📋 Credits clicked');
        const creditsDiv = document.createElement('div');
        creditsDiv.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.95);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            font-family: 'Courier New', monospace;
            z-index: 200;
            overflow-y: auto;
            padding: 20px;
        `;
        creditsDiv.innerHTML = `
            <h1 style="color: #00ffff; font-size: 36px; margin-bottom: 30px;">CREDITS</h1>
            
            <div style="text-align: left; font-size: 16px; line-height: 2; color: #aaa; max-width: 600px;">
                <h2 style="color: #ffffff; font-size: 20px; margin-bottom: 10px;">LIBRARIES</h2>
                <p>● Three.js (MIT) - <a href="https://threejs.org" style="color: #00ffff;">threejs.org</a></p>
                <p>● Cannon-es (MIT) - <a href="https://github.com/pmndrs/cannon-es" style="color: #00ffff;">pmndrs/cannon-es</a></p>
                <p>● Howler.js (MIT) - <a href="https://howlerjs.com" style="color: #00ffff;">howlerjs.com</a></p>
                <p>● Vite (MIT) - <a href="https://vitejs.dev" style="color: #00ffff;">vitejs.dev</a></p>

                <h2 style="color: #ffffff; font-size: 20px; margin-top: 20px; margin-bottom: 10px;">SOUND EFFECTS & MUSIC (OpenGameArt)</h2>
                <p>● Punch SFX by DavidW (CC-BY 3.0) - <a href="https://opengameart.org/content/punch-sfx" style="color: #00ffff;">Link</a></p>
                <p>● Spell Sounds Starter Pack by p0ss (CC-BY-SA 3.0) - <a href="https://opengameart.org/content/spell-sounds-starter-pack" style="color: #00ffff;">Link</a></p>
                <p>● A Kinda Cool Sound Effect by Spring Spring (CC0) - <a href="https://opengameart.org/content/a-kinda-cool-sound-effect" style="color: #00ffff;">Link</a></p>
                <p>● Tactical Weapons and Tactics Sound Pack by XCVG (CC-BY 3.0) - <a href="https://opengameart.org/content/tactical-weapons-and-tactics-sound-pack" style="color: #00ffff;">Link</a></p>
                <p>● 37 hits/punches by independent.nu (CC-BY 3.0) - <a href="https://opengameart.org/content/37-hitspunches" style="color: #00ffff;">Link</a></p>

                <h2 style="color: #ffffff; font-size: 20px; margin-top: 20px; margin-bottom: 10px;">TEAM MEMBERS</h2>
                <p>● Banele - UI, Audio, Deployment</p>
                <p>● Busisiwe - Shaders</p>
                <p>● Pumelela - Environment, Art</p>
                <p>● Sibusiso - Player, Controls, Physics</p>
            </div>
            
            <button onclick="this.parentElement.remove()" style="
                margin-top: 40px;
                background: #00ffff;
                border: none;
                color: #000;
                padding: 12px 40px;
                font-size: 18px;
                font-family: 'Courier New', monospace;
                cursor: pointer;
                border-radius: 8px;
            ">BACK</button>
        `;
        document.body.appendChild(creditsDiv);
    }
    
);
uiManager.registerScreen('main-menu', mainMenuElement);
uiManager.showScreen('main-menu');

// ============================================
// GAME FLAG
// ============================================
let gameStarted = false;


// ============================================
// PHYSICS WORLD
// ============================================
const physicsWorld = new CANNON.World({
    gravity: new CANNON.Vec3(0, -15, 0)
});

// ============================================
// SCENE
// ============================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

// ============================================
// CAMERA
// ============================================
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

// ============================================
// RENDERER
// ============================================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ============================================
// LIGHTS
// ============================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
scene.add(dirLight);

// ============================================
// FLOOR
// ============================================
const floorGeo = new THREE.PlaneGeometry(20, 20);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const floorBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane()
});
floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
physicsWorld.addBody(floorBody);

// ============================================
// ARENA WALLS
// ============================================
const wallMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    transparent: true,
    opacity: 0.3
});

const wallConfigs = [
    { pos: [0, 2.5, -10], rot: [0, 0, 0], size: [20, 5, 0.5] },
    { pos: [0, 2.5, 10], rot: [0, 0, 0], size: [20, 5, 0.5] },
    { pos: [-10, 2.5, 0], rot: [0, Math.PI / 2, 0], size: [20, 5, 0.5] },
    { pos: [10, 2.5, 0], rot: [0, Math.PI / 2, 0], size: [20, 5, 0.5] },
];

wallConfigs.forEach(({ pos, rot, size }) => {
    const wallGeo = new THREE.BoxGeometry(...size);
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(...pos);
    wall.rotation.set(...rot);
    scene.add(wall);

    const wallBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(
            new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)
        )
    });
    wallBody.position.set(...pos);
    wallBody.quaternion.setFromEuler(...rot);
    physicsWorld.addBody(wallBody);
});

// ============================================
// PLAYER
// ============================================
const playerGeo = new THREE.BoxGeometry(1, 1, 1);
const playerMat = new THREE.MeshStandardMaterial({ color: 0x00ffff });
const playerMesh = new THREE.Mesh(playerGeo, playerMat);
playerMesh.castShadow = true;
scene.add(playerMesh);

const playerBody = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
    position: new CANNON.Vec3(0, 3, 0),
    linearDamping: 0.9
});
physicsWorld.addBody(playerBody);



// ============================================
// PLAYER HEALTH
// ============================================
let playerFlashTimer = 0;
const PLAYER_FLASH_DURATION = 0.1;
let playerFlashing = false;
let playerHealth = 10;
const PLAYER_MAX_HEALTH = 10;
let playerInvincible = false;
let playerInvincibleTimer = 0;

// ============================================
// GAME OVER
// ============================================
let gameOver = false;

const gameOverDiv = document.createElement('div');
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

document.getElementById('restartBtn').addEventListener('click', () => {
    resetGame(); // 
});

function flashPlayer() {
    playerFlashing = true;
    playerFlashTimer = PLAYER_FLASH_DURATION;
    playerMesh.material.color.set(0xff0000);
    playerMesh.material.emissive.set(0xff0000);
    playerMesh.material.emissiveIntensity = 1;
}

function triggerGameOver() {
    if (gameOver) return;
    gameOver = true;
    audioManager.stopMusic();
    gameOverDiv.style.display = 'flex';
    uiManager.hideHUD();
}

// ============================================
// COMBAT SETUP
// ============================================
let isAttacking = false;
let attackType = null;
let attackTimer = 0;
const ATTACK_DURATION = 0.2;

const attackGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const attackMatPunch = new THREE.MeshStandardMaterial({
    color: 0xff4400,
    emissive: 0xff4400
});
const attackMatKick = new THREE.MeshStandardMaterial({
    color: 0xffff00,
    emissive: 0xffff00
});
const attackIndicator = new THREE.Mesh(attackGeo, attackMatPunch);
attackIndicator.visible = false;
scene.add(attackIndicator);

const hitboxBody = new CANNON.Body({
    type: CANNON.Body.KINEMATIC,
    shape: new CANNON.Box(new CANNON.Vec3(0.6, 0.5, 0.6)),
    collisionFilterGroup: 2,
    collisionFilterMask: 4
});
physicsWorld.addBody(hitboxBody);

// ============================================
// FRAGMENTS
// ============================================
const fragments = [];
let fragmentsCollected = 0;
const FRAGMENTS_NEEDED = 8;

function spawnFragment(position) {
    const fragmentGeo = new THREE.OctahedronGeometry(0.4);
    const fragmentMat = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.5
    });
    const fragmentMesh = new THREE.Mesh(fragmentGeo, fragmentMat);
    fragmentMesh.position.set(position.x, 1, position.z);
    scene.add(fragmentMesh);
    fragments.push(fragmentMesh);
}

function checkFragmentCollection() {
    for (let i = fragments.length - 1; i >= 0; i--) {
        const fragment = fragments[i];
        const distance = fragment.position.distanceTo(playerMesh.position);

        if (distance < 1.5) {
            scene.remove(fragment);
            fragment.geometry.dispose();
            fragment.material.dispose();
            fragments.splice(i, 1);
            fragmentsCollected++;
            audioManager.playSfx('fragment_collected');
            updateHUD(
                playerHealth,
                PLAYER_MAX_HEALTH,
                fragmentsCollected,
                FRAGMENTS_NEEDED,
                currentWave,
                TOTAL_WAVES
            );
        }
    }
}

// ============================================
// TERMINAL
// ============================================
let terminalActive = false;
let terminalVisible = false;

const terminalGeo = new THREE.BoxGeometry(1.5, 2, 0.5);
const terminalMat = new THREE.MeshStandardMaterial({
    color: 0x003333,
    emissive: 0x00ffff,
    emissiveIntensity: 0.2
});
const terminalMesh = new THREE.Mesh(terminalGeo, terminalMat);
terminalMesh.position.set(0, 1, -8);
terminalMesh.visible = false;
scene.add(terminalMesh);

const screenGeo = new THREE.PlaneGeometry(1, 1.2);
const screenMat = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 0.8
});
const screenMesh = new THREE.Mesh(screenGeo, screenMat);
screenMesh.position.set(0, 1.2, -7.74);
screenMesh.visible = false;
scene.add(screenMesh);

function showTerminal() {
    terminalVisible = true;
    terminalMesh.visible = true;
    screenMesh.visible = true;
}

function activateTerminal() {
    if (fragmentsCollected < FRAGMENTS_NEEDED) return;
    terminalActive = true;
    activatePortal();
}

function checkTerminalInteraction() {
    if (!terminalVisible || terminalActive) return;
    const distance = terminalMesh.position.distanceTo(playerMesh.position);
    if (distance < 3 && keys['KeyE']) {
        activateTerminal();
    }
}

// ============================================
// PORTAL
// ============================================
let portalActive = false;

const portalGeo = new THREE.TorusGeometry(2, 0.3, 16, 100);
const portalMat = new THREE.MeshStandardMaterial({
    color: 0x9900ff,
    emissive: 0x9900ff,
    emissiveIntensity: 0.8
});
const portalMesh = new THREE.Mesh(portalGeo, portalMat);
portalMesh.position.set(0, 2, -9);
portalMesh.visible = false;
scene.add(portalMesh);

function activatePortal() {
    portalActive = true;
    portalMesh.visible = true;
    audioManager.playSfx('portal_activate');
}

function checkPortalEntry() {
    if (!portalActive) return;
    const distance = portalMesh.position.distanceTo(playerMesh.position);
    if (distance < 2.5) {
        console.log('🚪 ENTERING LEVEL 2');
        // TODO: Actual level transition
    }
}

// ============================================
// COMMANDER
// ============================================
let commander = null;
const COMMANDER_HEALTH = 20;
let commanderAlive = false;
let commanderDefeated = false;

function spawnCommander() {
    if (commanderAlive) return;
    commanderAlive = true;

    const commanderGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const commanderMat = new THREE.MeshStandardMaterial({
        color: 0xff6600,
        emissive: 0xff2200,
        emissiveIntensity: 0.3
    });
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
        chargeDir: new CANNON.Vec3()
    };
}

function removeCommander() {
    if (!commander) return;
    commanderDefeated = true;
    spawnFragment(commander.body.position);
    scene.remove(commander.mesh);
    physicsWorld.removeBody(commander.body);
    commander.mesh.geometry.dispose();
    commander.mesh.material.dispose();
    commander = null;
    commanderAlive = false;
    audioManager.playSfx('portal_activate');
    showTerminal();
}

function updateCommander(delta) {
    if (!commander) return;

    const dir = new CANNON.Vec3(
        playerBody.position.x - commander.body.position.x,
        0,
        playerBody.position.z - commander.body.position.z
    );
    dir.normalize();

    commander.chargeTimer -= delta;
    if (commander.chargeTimer <= 0 && !commander.isCharging) {
        commander.isCharging = true;
        commander.chargeDir = dir.clone();
        commander.chargeTimer = 5;
        setTimeout(() => {
            if (commander) commander.isCharging = false;
        }, 600);
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
        const distToPlayer = new THREE.Vector3(
            playerBody.position.x - commander.body.position.x,
            0,
            playerBody.position.z - commander.body.position.z
        ).length();

        if (distToPlayer < 2 && !playerInvincible) {
            playerHealth -= 2;
            playerInvincible = true;
            playerInvincibleTimer = 1.0;
            flashPlayer();
            updateHUD(
                playerHealth,
                PLAYER_MAX_HEALTH,
                fragmentsCollected,
                FRAGMENTS_NEEDED,
                currentWave,
                TOTAL_WAVES
            );
            if (playerHealth <= 0) triggerGameOver();
        }
        commander.attackTimer = 1.5;
    }

    if (isAttacking) {
        const hitboxPos = new THREE.Vector3(
            hitboxBody.position.x,
            hitboxBody.position.y,
            hitboxBody.position.z
        );
        const commanderPos = new THREE.Vector3(
            commander.body.position.x,
            commander.body.position.y,
            commander.body.position.z
        );

        if (hitboxPos.distanceTo(commanderPos) < 1.5) {
            const damage = attackType === 'punch' ? 1 : 2;
            commander.health -= damage;
            audioManager.playSfx('boss_hit');
            const knockback = new CANNON.Vec3(dir.x * -2, 1, dir.z * -2);
            commander.body.applyImpulse(knockback);
            if (commander.health <= 0) {
                removeCommander();
            }
        }
    }
}

// ============================================
// ENEMY TYPES
// ============================================
const ENEMY_TYPES = {
    normal: {
        color: 0xff0000,
        size: 1,
        health: 5,
        speed: 2,
        damage: 1,
        attackRate: 1.0
    },
    fast: {
        color: 0xff6600,
        size: 0.7,
        health: 2,
        speed: 4,
        damage: 1,
        attackRate: 0.8
    },
    heavy: {
        color: 0x990000,
        size: 1.4,
        health: 12,
        speed: 1,
        damage: 2,
        attackRate: 2.0
    },
    tank: {
        color: 0x660000,
        size: 1.8,
        health: 20,
        speed: 0.8,
        damage: 3,
        attackRate: 2.5
    }
};

const enemies = [];

let minimap = new Minimap(scene, camera, playerMesh, enemies);

function spawnEnemy(type = 'normal', spawnPos = null) {
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
    barFill.style.cssText = `
        width: 100%;
        height: 100%;
        background: #ff0000;
    `;
    barContainer.appendChild(barFill);
    document.body.appendChild(barContainer);

    const pos = spawnPos || new CANNON.Vec3(
        (Math.random() - 0.5) * 16,
        1,
        (Math.random() - 0.5) * 16
    );

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

function removeEnemy(enemy) {
    scene.remove(enemy.mesh);
    physicsWorld.removeBody(enemy.body);
    enemy.mesh.geometry.dispose();
    enemy.mesh.material.dispose();
    document.body.removeChild(enemy.barContainer);
    enemies.splice(enemies.indexOf(enemy), 1);
    audioManager.playSfx('enemy_death');

    if (enemies.length === 0 && waveInProgress) {
        waveInProgress = false;
        onWaveComplete();
    }
}

// ============================================
// WAVE SYSTEM
// ============================================
let currentWave = 0;
const TOTAL_WAVES = 7;
let waveInProgress = false;

const waveConfigs = [
    { spawns: [
        { type: 'normal' }, { type: 'normal' }, { type: 'normal' }
    ]},
    { spawns: [
        { type: 'fast' }, { type: 'fast' }, { type: 'fast' },
        { type: 'fast' }, { type: 'normal' }
    ]},
    { spawns: [
        { type: 'heavy' }, { type: 'heavy' },
        { type: 'normal' }, { type: 'normal' }
    ]},
    { spawns: [
        { type: 'fast' }, { type: 'fast' }, { type: 'fast' },
        { type: 'heavy' }, { type: 'heavy' }
    ]},
    { spawns: [
        { type: 'tank' }, { type: 'tank' },
        { type: 'normal' }, { type: 'normal' }, { type: 'normal' }
    ]},
    { spawns: [
        { type: 'fast',   pos: new CANNON.Vec3(-9, 1, -9) },
        { type: 'fast',   pos: new CANNON.Vec3( 9, 1, -9) },
        { type: 'fast',   pos: new CANNON.Vec3(-9, 1,  9) },
        { type: 'fast',   pos: new CANNON.Vec3( 9, 1,  9) },
        { type: 'heavy',  pos: new CANNON.Vec3(-9, 1,  0) },
        { type: 'heavy',  pos: new CANNON.Vec3( 9, 1,  0) },
        { type: 'normal', pos: new CANNON.Vec3( 0, 1, -9) },
        { type: 'normal', pos: new CANNON.Vec3( 0, 1,  9) },
    ]},
    { spawns: [
        { type: 'tank' },
        { type: 'heavy' }, { type: 'heavy' },
        { type: 'fast' },  { type: 'fast' }, { type: 'fast' },
        { type: 'normal' },{ type: 'normal' },{ type: 'normal' }
    ]}
];

function spawnWave() {
    currentWave++;
    waveInProgress = true;
    const config = waveConfigs[currentWave - 1];
    config.spawns.forEach(s => {
        spawnEnemy(s.type, s.pos || null);
    });
    updateHUD(
        playerHealth,
        PLAYER_MAX_HEALTH,
        fragmentsCollected,
        FRAGMENTS_NEEDED,
        currentWave,
        TOTAL_WAVES
    );
}

function onWaveComplete() {
    spawnFragment(new CANNON.Vec3(
        (Math.random() - 0.5) * 10,
        0,
        (Math.random() - 0.5) * 10
    ));

    if (currentWave < TOTAL_WAVES) {
        setTimeout(() => spawnWave(), 3000);
    } else {
        setTimeout(() => spawnCommander(), 2000);
    }
}

// ============================================
// INPUT
// ============================================
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (e.code === 'KeyZ' && !isAttacking) {
        isAttacking = true;
        attackType = 'punch';
        attackTimer = ATTACK_DURATION;
        attackIndicator.material = attackMatPunch;
        attackIndicator.visible = true;
        audioManager.playSfx('punch_hit');
    }

    if (e.code === 'KeyX' && !isAttacking) {
        isAttacking = true;
        attackType = 'kick';
        attackTimer = ATTACK_DURATION;
        attackIndicator.material = attackMatKick;
        attackIndicator.visible = true;
        audioManager.playSfx('punch_hit');
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

window.addEventListener('click', () => {
    if (!isAttacking) {
        isAttacking = true;
        attackType = 'punch';
        attackTimer = ATTACK_DURATION;
        attackIndicator.material = attackMatPunch;
        attackIndicator.visible = true;
        audioManager.playSfx('punch_hit');
    }
});

// ============================================
// JUMP
// ============================================
let canJump = false;

playerBody.addEventListener('collide', (e) => {
    if (e.body === floorBody) canJump = true;
});

// ============================================
// RESIZE
// ============================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================
// CLOCK
// ============================================
const clock = new THREE.Clock();

// ============================================
// ANIMATION LOOP
// ============================================
function animate() {
    requestAnimationFrame(animate);
    if (gameOver) return;

    const delta = clock.getDelta();

    // Player movement
    const speed = 5;
    const velocity = new CANNON.Vec3();

    if (keys['KeyA'] || keys['ArrowLeft'])  velocity.x = -speed;
    if (keys['KeyD'] || keys['ArrowRight']) velocity.x =  speed;
    if (keys['KeyW'] || keys['ArrowUp'])    velocity.z = -speed;
    if (keys['KeyS'] || keys['ArrowDown'])  velocity.z =  speed;

    playerBody.velocity.x = velocity.x;
    playerBody.velocity.z = velocity.z;

    if (velocity.x !== 0 || velocity.z !== 0){
        const angle = Math.atan2(velocity.x, velocity.z);
        playerBody.quaternion.setFromEuler(0, angle, 0);
    }

    // Jump
    if (keys['Space'] && canJump) {
        playerBody.velocity.y = 7;
        canJump = false;
    }

    // Invincibility timer
    if (playerInvincible) {
        playerInvincibleTimer -= delta;
        if (playerInvincibleTimer <= 0) playerInvincible = false;
    }

    // Player flash when hit
    if (playerFlashing) {
        playerFlashTimer -= delta;
        if (playerFlashTimer <= 0) {
            playerFlashing = false;
            playerMesh.material.color.set(0x00ffff);
            playerMesh.material.emissive.set(0x000000);
            playerMesh.material.emissiveIntensity = 0;
        }
    }

    // Combat
    if (isAttacking) {
        attackTimer -= delta;

        const forward = new THREE.Vector3(
            velocity.x,
            0,
            velocity.z
        );

        if (forward.length() === 0) {
            forward.set(0, 0, -1);
            forward.applyQuaternion(playerMesh.quaternion);
        } else {
            forward.normalize();
        }

        forward.multiplyScalar(1.2);
        const hitboxPos = playerMesh.position.clone().add(forward);
        hitboxPos.y = attackType === 'punch'
            ? playerMesh.position.y + 0.2
            : playerMesh.position.y - 0.2;

        hitboxBody.position.set(hitboxPos.x, hitboxPos.y, hitboxPos.z);
        attackIndicator.position.copy(hitboxPos);

        if (attackTimer <= 0) {
            isAttacking = false;
            attackType = null;
            attackIndicator.visible = false;
        }
    }

    // Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        const dir = new CANNON.Vec3(
            playerBody.position.x - enemy.body.position.x,
            0,
            playerBody.position.z - enemy.body.position.z
        );
        dir.normalize();

        enemy.body.velocity.x = dir.x * enemy.speed;
        enemy.body.velocity.z = dir.z * enemy.speed;

        enemy.mesh.position.copy(enemy.body.position);
        enemy.mesh.quaternion.copy(enemy.body.quaternion);

        // Update enemy health bar position
        const enemyScreenPos = enemy.mesh.position.clone();
        enemyScreenPos.y += 1;
        enemyScreenPos.project(camera);

        const x = (enemyScreenPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-enemyScreenPos.y * 0.5 + 0.5) * window.innerHeight;

        enemy.barContainer.style.left = (x - 25) + 'px';
        enemy.barContainer.style.top = (y - 20) + 'px';

        const healthPercent = (enemy.health / enemy.maxHealth) * 100;
        enemy.barFill.style.width = Math.max(0, healthPercent) + '%';

        if (healthPercent > 50) {
            enemy.barFill.style.background = '#00ff00';
        } else if (healthPercent > 25) {
            enemy.barFill.style.background = '#ffff00';
        } else {
            enemy.barFill.style.background = '#ff0000';
        }

        // Enemy attacks player
        enemy.attackTimer -= delta;
        if (enemy.attackTimer <= 0) {
            const distToPlayer = new THREE.Vector3(
                playerBody.position.x - enemy.body.position.x,
                0,
                playerBody.position.z - enemy.body.position.z
            ).length();

            if (distToPlayer < 1.5 && !playerInvincible) {
                playerHealth -= enemy.damage;
                playerInvincible = true;
                playerInvincibleTimer = 0.5;
                flashPlayer();
                updateHUD(
                    playerHealth,
                    PLAYER_MAX_HEALTH,
                    fragmentsCollected,
                    FRAGMENTS_NEEDED,
                    currentWave,
                    TOTAL_WAVES
                );
                if (playerHealth <= 0) triggerGameOver();
            }
            enemy.attackTimer = enemy.attackRate;
        }

        // Check if player hitbox hits enemy
        if (isAttacking) {
            const hitboxPos = new THREE.Vector3(
                hitboxBody.position.x,
                hitboxBody.position.y,
                hitboxBody.position.z
            );
            const enemyPos = new THREE.Vector3(
                enemy.body.position.x,
                enemy.body.position.y,
                enemy.body.position.z
            );

            if (hitboxPos.distanceTo(enemyPos) < 1.2) {
                const damage = attackType === 'punch' ? 1 : 2;
                enemy.health -= damage;
                audioManager.playSfx('punch_hit');

                const knockback = new CANNON.Vec3(dir.x * -5, 2, dir.z * -5);
                enemy.body.applyImpulse(knockback);

                if (enemy.health <= 0) removeEnemy(enemy);
            }
        }
    }

    // Commander
    updateCommander(delta);

    // Fragments and terminal and portal
    checkFragmentCollection();
    checkTerminalInteraction();
    checkPortalEntry();

    fragments.forEach(f => f.rotation.y += 0.02);
    if (terminalVisible) {
        const pulse = Math.sin(Date.now() * 0.003) * 0.3 + 0.5;
        screenMesh.material.emissiveIntensity = pulse;
    }
    if (portalActive) portalMesh.rotation.z += 0.01;

    // Step physics
    physicsWorld.step(1 / 60, delta, 3);

    // Sync player
    playerMesh.position.copy(playerBody.position);
    playerMesh.quaternion.copy(playerBody.quaternion);

    // Camera follows player
    camera.position.x = playerMesh.position.x;
    camera.position.y = playerMesh.position.y + 5;
    camera.position.z = playerMesh.position.z + 10;
    camera.lookAt(playerMesh.position);
    updateHUD(
        playerHealth,
        PLAYER_MAX_HEALTH,
        fragmentsCollected,
        FRAGMENTS_NEEDED,
        currentWave,
        TOTAL_WAVES
    );
        // Update minimap (Level 2 & 3 only)
    if (currentWave >= 4) {
        minimap.show();
        minimap.update();
    } else {
        minimap.hide();
    }

    renderer.render(scene, camera);
}



// NOTE: spawnWave() and animate() are now called from the PLAY button callback
// Do NOT call them here anymore.
function resetGame() {
    // Reset game state flags
    gameStarted = false;
    gameOver = false;
    currentWave = 0;
    waveInProgress = false;
    playerHealth = PLAYER_MAX_HEALTH;
    fragmentsCollected = 0;
    playerInvincible = false;
    playerInvincibleTimer = 0;
    playerFlashing = false;
    isAttacking = false;
    attackType = null;
    commanderAlive = false;
    commanderDefeated = false;
    commander = null;
    terminalVisible = false;
    terminalActive = false;
    portalActive = false;
    
    // Reset player body
    playerBody.position.set(0, 3, 0);
    playerBody.velocity.set(0, 0, 0);
    playerMesh.material.color.set(0x00ffff);
    playerMesh.material.emissive.set(0x000000);
    playerMesh.material.emissiveIntensity = 0;

    // Remove all enemies from scene and physics world
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        scene.remove(enemy.mesh);
        physicsWorld.removeBody(enemy.body);
        enemy.mesh.geometry.dispose();
        enemy.mesh.material.dispose();
        if (enemy.barContainer && enemy.barContainer.parentNode) {
            enemy.barContainer.parentNode.removeChild(enemy.barContainer);
        }
    }
    enemies.length = 0;

    // Remove all fragments
    for (let i = fragments.length - 1; i >= 0; i--) {
        const fragment = fragments[i];
        scene.remove(fragment);
        fragment.geometry.dispose();
        fragment.material.dispose();
    }
    fragments.length = 0;

    // Remove commander mesh if it exists
    if (commander) {
        scene.remove(commander.mesh);
        physicsWorld.removeBody(commander.body);
        commander.mesh.geometry.dispose();
        commander.mesh.material.dispose();
        commander = null;
    }

    // Hide specific objects
    terminalMesh.visible = false;
    screenMesh.visible = false;
    portalMesh.visible = false;
    attackIndicator.visible = false;

    // Hide UI elements
    gameOverDiv.style.display = 'none';

    // Restart music
    audioManager.stopMusic();
    audioManager.playLevelMusic(1);

    // Reset HUD
    updateHUD(
        playerHealth,
        PLAYER_MAX_HEALTH,
        fragmentsCollected,
        FRAGMENTS_NEEDED,
        currentWave,
        TOTAL_WAVES
    );

    // Show main menu again
    uiManager.hideAllScreens();
    uiManager.showScreen('main-menu');

    console.log('🔄 Game reset complete');
}