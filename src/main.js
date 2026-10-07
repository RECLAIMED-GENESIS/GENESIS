<<<<<<< HEAD
// ============================================================
// main.js — bootstrap, player controller, level manager, minimap
// ============================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { StreetLevel } from './levels/lvl1.js';
import { AlienLevel } from './levels/level2.js';
import { ArchitectLevel } from './levels/level3.js';
import { Dialogue } from './ui/Dialogue.js';
import { endingAttack, endingLearn, endingSilence } from './player/endings.js';

// ---------- renderer ----------
=======
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
import { createLevelViewer } from './levels/LevelViewer.js';

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
>>>>>>> 576d964e64e7ab8eae664197919c63677a805956
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
// NOTE: PCFSoftShadowMap was removed in recent three.js versions.
// PCFShadowMap is the modern equivalent.
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

<<<<<<< HEAD
// Surface context-lost events so we can see them in the console
renderer.domElement.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  console.error('[GENESIS] WebGL context lost. Refresh the tab.');
=======
// ============================================
// LEVEL VIEWER (press 1, 2, 3 on the main menu to view a level, Escape to return)
// ============================================
const levelViewer = createLevelViewer(renderer, {
    canEnter: () => uiManager.currentScreen === 'main-menu',
    onEnter: () => {
        uiManager.hideAllScreens();
        uiManager.hideHUD();
    },
    onExit: () => {
        clock.getDelta();
        uiManager.showScreen('main-menu');
    }
});

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
>>>>>>> 576d964e64e7ab8eae664197919c63677a805956
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  console.log('[GENESIS] WebGL context restored.');
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1200);
camera.rotation.order = 'YXZ';
window.__camera = camera;

<<<<<<< HEAD
// ---------- root motion fix ----------
// Mixamo FBX animations exported without "In Place" bake the character's
// forward travel straight into the Hips bone's position keyframes. That
// means the clip itself drags the model across the floor, on top of our
// own WASD movement code also moving it — double motion, plus a visible
// "snap back" every time the clip loops back to frame 0.
// This locks the Hips bone's X/Z to its first-frame value on every key,
// so the clip plays fully in place, while leaving Y untouched so the
// natural up/down footstep bob is preserved.
function stripRootMotion(clip) {
  if (!clip || !clip.tracks) return clip;
  for (const track of clip.tracks) {
    if (!/Hips/i.test(track.name) || !/\.position/i.test(track.name)) continue;
    const v = track.values;
    if (!v || v.length < 3) continue;
    const x0 = v[0], z0 = v[2];
    for (let i = 0; i < v.length; i += 3) {
      v[i] = x0;
      v[i + 2] = z0;
=======
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
>>>>>>> 576d964e64e7ab8eae664197919c63677a805956
    }
  }
  return clip;
}

<<<<<<< HEAD
// ---------- player ----------
const player = {
  pos: new THREE.Vector3(0, 0, 55),
  vel: new THREE.Vector3(),
  yaw: Math.PI,
  pitch: 0,
  grounded: false,
  EYE: 1.7,
  R: 0.4, H: 1.8,
=======
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
>>>>>>> 576d964e64e7ab8eae664197919c63677a805956
};

// ---------- Sorini avatar (third-person Y_Bot) ----------
const soriniGroup = new THREE.Group();
scene.add(soriniGroup);

<<<<<<< HEAD
let soriniMixer  = null;
let soriniActions = {};
let soriniCurrentAction = null;
=======
let minimap = new Minimap(scene, camera, playerMesh, enemies);

function spawnEnemy(type = 'normal', spawnPos = null) {
    const config = ENEMY_TYPES[type];
    const s = config.size;
>>>>>>> 576d964e64e7ab8eae664197919c63677a805956

let _soriniPending = null;   // action requested before its clip finished downloading

function playSoriniAction(name, loop = true) {
  let next = soriniActions[name];
  // fallback chain if a clip failed to load (e.g. Swagger_Walk.fbx)
  if (!next && name === 'walk') next = soriniActions['run'] || soriniActions['fightIdle'];
  if (!next) { _soriniPending = { name, loop }; return; }  // retried when the clip lands
  if (next === soriniCurrentAction) {
    // Already playing. For loops, do nothing. For one-shots that have
    // finished, restart them so the punch/kick/hook can be re-triggered.
    if (next.isRunning()) return;
    next.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.05).play();
    return;
  }
  if (soriniCurrentAction) soriniCurrentAction.fadeOut(0.22);
  next.reset()
    .setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
    .fadeIn(0.22).play();
  if (!loop) next.clampWhenFinished = true;
  soriniCurrentAction = next;
}

<<<<<<< HEAD
// raw clips are cached even when the model hasn't finished loading yet —
// previously any clip that won the download race against Y_Bot.fbx was
// discarded by the `&& soriniMixer` guard and never played again
const soriniClips = {};
=======
function removeEnemy(enemy) {
    scene.remove(enemy.mesh);
    physicsWorld.removeBody(enemy.body);
    enemy.mesh.geometry.dispose();
    enemy.mesh.material.dispose();
    document.body.removeChild(enemy.barContainer);
    enemies.splice(enemies.indexOf(enemy), 1);
    audioManager.playSfx('enemy_death');
>>>>>>> 576d964e64e7ab8eae664197919c63677a805956

function _bindSoriniClip(key) {
  if (!soriniMixer || !soriniClips[key] || soriniActions[key]) return;
  soriniActions[key] = soriniMixer.clipAction(soriniClips[key]);
  if (_soriniPending && _soriniPending.name === key) {
    const p = _soriniPending; _soriniPending = null;
    playSoriniAction(p.name, p.loop);
  }
}

function loadSoriniAnim(path, key, onDone) {
  new FBXLoader().load(path, (fbx) => {
    if (fbx.animations?.[0]) {
      soriniClips[key] = stripRootMotion(fbx.animations[0]);
      _bindSoriniClip(key);
      if (onDone) onDone();
    }
  }, undefined, (e) => console.warn('sorini anim failed:', path, e));
}

// Load Y_Bot model
new FBXLoader().load('./assets/models/player/sorini.fbx', (fbx) => {
  fbx.scale.setScalar(0.013);
  // Offset the model so feet align with player.pos.y (ground level).
  fbx.position.y = -0.13;
  fbx.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  soriniGroup.add(fbx);

  soriniMixer = new THREE.AnimationMixer(fbx);
  // bind every clip that arrived before the model did
  for (const k of Object.keys(soriniClips)) _bindSoriniClip(k);
  // name anything still missing after 8s (wrong file name / case / path)
  setTimeout(() => {
    const want = ['idle', 'fightIdle', 'walk', 'run', 'punch', 'kick', 'hook', 'jump', 'die'];
    const missing = want.filter(k => !soriniClips[k]);
    if (missing.length) console.warn('[Sorini] clips missing:', missing.join(', '));
  }, 8000);

  const base = './assets/models/player/';
  loadSoriniAnim(base + 'Idle.fbx',           'fightIdle', null);
  loadSoriniAnim(base + 'Dying.fbx',          'die',       null);
  // Dwarf Idle = relaxed idle (not fighting stance) — file is in enemy folder
  new FBXLoader().load('./assets/models/enemy/Dwarf Idle.fbx', (fbx2) => {
    if (fbx2.animations?.[0]) {
      soriniClips['idle'] = stripRootMotion(fbx2.animations[0]);
      _bindSoriniClip('idle');
      playSoriniAction('idle');
    }
  }, undefined, (e) => {
    // fallback to fight idle if Dwarf Idle missing
    if (soriniActions['fightIdle']) {
      soriniActions['idle'] = soriniActions['fightIdle'];
      playSoriniAction('idle');
    }
  });
  loadSoriniAnim(base + 'Swagger_Walk.fbx',   'walk',      null);
  loadSoriniAnim(base + 'Running.fbx',        'run',       null);
  loadSoriniAnim(base + 'Punching.fbx',       'punch',     null);
  loadSoriniAnim(base + 'Kicking.fbx',        'kick',      null);
  loadSoriniAnim(base + 'Hook.fbx',           'hook',      null);
  loadSoriniAnim(base + 'Jump.fbx',           'jump',      null);
  loadSoriniAnim(base + 'Left Turn.fbx',      'turnLeft',  null);
  loadSoriniAnim(base + 'Right Turn.fbx',     'turnRight', null);
}, undefined, (e) => console.warn('Y_Bot load failed:', e));

// ---------- input ----------
const keys = {};
let locked = false;
// attack cooldowns
const attackCooldown = { f: 0, g: 0, h: 0 };
let attackLock = false;   // true while a punch/kick/hook swing plays — roots Sorini

<<<<<<< HEAD
addEventListener('keydown', e => {

  // If dialogue is active, route keys to the dialogue system
  if (window.__dialogue && window.__dialogue.active) {
    window.__dialogue.handleKey(e.code);
    return;
  }

  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyR') switchLevel(current);
  if (e.code === 'Digit1') switchLevel(1);
  if (e.code === 'Digit2') switchLevel(2);
  if (e.code === 'Digit3') switchLevel(3);
  if (e.code === 'KeyP' && level && level.setPhase) {
    phase = phase % 3 + 1;
    level.setPhase(phase, timer.getElapsed());
  }

  // ── Jump ── handled here so it fires once per press (not per frame)
  if (e.code === 'Space' && player.grounded && !attackLock) {
    player.vel.y = 12;
  }

  // ── F = Punch ──
  if (e.code === 'KeyF' && attackCooldown.f <= 0) {
    attackCooldown.f = 0.7;
    playSoriniAction('punch', false);
    _triggerAttack();
    _damageCommanderIfClose(1);
  }
  // ── G = Kick ──
  if (e.code === 'KeyG' && attackCooldown.g <= 0) {
    attackCooldown.g = 0.8;
    playSoriniAction('kick', false);
    _triggerAttack();
    _damageCommanderIfClose(2);
  }
  // ── H = Hook ──
  if (e.code === 'KeyH' && attackCooldown.h <= 0) {
    attackCooldown.h = 0.7;
    playSoriniAction('hook', false);
    _triggerAttack();
    _damageCommanderIfClose(2);
  }
});

function _triggerAttack() {
  if (level && typeof level.onMouseClick === 'function') {
    level.onMouseClick(camera, player.pos);
  } else if (level && level.streetEnemies) {
    level.streetEnemies.onMouseClick(camera, player.pos);
  }
}

function _damageCommanderIfClose(damage) {
  if (!level) return;
  // Commander (Level 1)
  if (level.commander && level.commander.alive) {
    const dist = level.commander.getPosition().distanceTo(player.pos);
    if (dist < 2.5) {
      level.commander.takeDamage(damage);
    }
  }
  // Grunts (Level 1)
  if (level.grunts) {
    level.grunts.checkHit(player.pos, 2.2, damage);
  }
}

addEventListener('keyup', e => keys[e.code] = false);
renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  const msg = document.getElementById('msg');
  if (msg) msg.style.display = locked ? 'none' : 'block';
});

addEventListener('mousemove', e => {
  if (!locked) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch - e.movementY * 0.0022));
});

// ---------- levels ----------
const LEVELS = { 1: StreetLevel, 2: AlienLevel, 3: ArchitectLevel };
let level = null, current = 1, phase = 1;
const hud = document.getElementById('hud');

function switchLevel(n) {
  if (level) {
    try {
      if (typeof level.dispose === 'function') level.dispose(scene);
      else {
        if (level.root && level.root.parent) level.root.parent.remove(level.root);
        if (level.level && level.level.parent) level.level.parent.remove(level.level);
      }
    } catch (e) { console.warn('dispose error', e); }
    if (level.root && scene.children.includes(level.root)) scene.remove(level.root);
    if (level.level && scene.children.includes(level.level)) scene.remove(level.level);
    if (level.sky && scene.children.includes(level.sky)) scene.remove(level.sky);
    if (level.stars && scene.children.includes(level.stars)) scene.remove(level.stars);
  }

  // Clean up dialogue from a previous Level 3 session
  if (window.__dialogue) {
    try { window.__dialogue.dispose(); } catch (e) {}
    window.__dialogue = null;
  }

  // ── Flush renderer caches ──
  // Three.js keeps an internal cache of GPU objects. Even after
  // .dispose(), the cache holds references. Clearing it forces the
  // renderer to release texture/buffer memory back to the GPU driver.
  try {
    if (renderer.renderLists) renderer.renderLists.dispose();
    if (renderer.info) renderer.info.reset();
  } catch (e) { console.warn('renderer cache flush failed:', e); }

  current = n; phase = 1;

  try {
    level = new LEVELS[n](scene, renderer);

    // If this is Level 3, wire up the dialogue + endings
    if (n === 3 && level instanceof ArchitectLevel) {
      const dialogue = new Dialogue();
      window.__dialogue = dialogue;
      level.dialogue = dialogue;

      level.onDamagePlayer = (dmg) => {
        console.log(`Player took ${dmg} damage from a guardian.`);
      };

      level.onEndingChosen = (choice) => {
        if (choice === 'attack') {
          dialogue.dispose();
          window.__dialogue = null;
          endingAttack();
        } else if (choice === 'learn') {
          // The learn ending needs the dialogue for the final choice,
          // so pass it in and let it dispose itself.
          endingLearn(dialogue).then(() => {
            window.__dialogue = null;
          });
        } else {
          dialogue.dispose();
          window.__dialogue = null;
          endingSilence();
        }
      };
    }
  } catch (e) {
    console.warn(`Level ${n} primary constructor failed:`, e);
    try { level = new LEVELS[n](scene); } catch (e2) { level = new LEVELS[n](); }
  }

  // If the level used its own scene, hoist things onto the main scene.
  if (level.scene && level.scene !== scene) {
    if (level.scene.background) scene.background = level.scene.background;
    scene.fog = level.scene.fog !== undefined ? level.scene.fog : null;
    if (level.level && level.level.parent === level.scene) {
      level.scene.remove(level.level);
      scene.add(level.level);
    }
    if (level.root && level.root.parent === level.scene) {
      level.scene.remove(level.root);
      scene.add(level.root);
    }
    if (level.sky && level.sky.parent === level.scene) {
      level.scene.remove(level.sky);
      scene.add(level.sky);
    }
    if (level.stars && level.stars.parent === level.scene) {
      level.scene.remove(level.stars);
      scene.add(level.stars);
    }
  }

  // ── Spawn resolution ──
  // Some levels provide getSpawn() instead of a fixed spawn vector.
  if (typeof level.getSpawn === 'function') {
    try { level.spawn = level.getSpawn(); } catch (e) { console.warn('getSpawn failed:', e); }
  }

  if (!level.spawn || !level.spawn.isVector3) {
    console.warn(`Level ${n} missing spawn, using fallback`);
    let fallbackY = 0;
    try {
      if (typeof level.getSurfaceHeight === 'function') fallbackY = level.getSurfaceHeight(0, 55);
      else if (typeof level.groundHeight === 'function') fallbackY = level.groundHeight(0, 55);
      else if (typeof level.terrainHeight === 'function') fallbackY = level.terrainHeight(0, 55);
    } catch (e) { fallbackY = 0; }
    level.spawn = new THREE.Vector3(0, fallbackY + 0.1, 55);
  }

  if (!Array.isArray(level.colliders)) level.colliders = [];
  if (!level.name) level.name = `LEVEL ${n}`;

  player.pos.copy(level.spawn);
  player.vel.set(0, 0, 0);
  player.yaw   = (typeof level.spawnYaw === 'number') ? level.spawnYaw : Math.PI;
  player.pitch = 0;
}

// ── expose switchLevel globally so villageNPCs portal can call it ──
window.__switchLevel = switchLevel;

// ---------- minimap ----------
const mini = new THREE.OrthographicCamera(-55, 55, 55, -55, 1, 300);
mini.layers.set(1);
mini.layers.enable(2);
const marker = new THREE.Mesh(
  new THREE.ConeGeometry(1.1, 2.6, 6),
  new THREE.MeshBasicMaterial({ color: 0x33ffee }));
marker.rotation.order = 'YXZ';
marker.layers.set(2);
scene.add(marker);

// ---------- physics ----------
const GRAV = 30, SPEED = 4.5, SPRINT = 9;
const TURN_SPEED = 2.2; // radians/sec for A/D turning

function stepPlayer(dt) {
  const isSprint = keys.ShiftLeft || keys.ShiftRight;
  const sp = isSprint ? SPRINT : SPEED;

  // A/D turn Sorini left/right (locked during attack swings)
  if (!attackLock) {
    if (keys.KeyA) player.yaw += TURN_SPEED * dt;
    if (keys.KeyD) player.yaw -= TURN_SPEED * dt;
  }

  // W/S move in the direction Sorini faces
  const f = attackLock ? 0 : (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  player.vel.x = sin * f * sp;
  player.vel.z = cos * f * sp;

  // Gravity — jump velocity is set from the keydown handler
  player.vel.y -= GRAV * dt;

  player.pos.addScaledVector(player.vel, dt);

  let g = 0;
  try {
    if (level && typeof level.getSurfaceHeight === 'function') g = level.getSurfaceHeight(player.pos.x, player.pos.z);
    else if (level && typeof level.groundHeight === 'function') g = level.groundHeight(player.pos.x, player.pos.z, player.pos.y);
    else if (level && typeof level.terrainHeight === 'function') g = level.terrainHeight(player.pos.x, player.pos.z);
  } catch (e) { g = 0; }
  if (player.pos.y <= g) { player.pos.y = g; player.vel.y = 0; player.grounded = true; }
  else player.grounded = false;

  const colliders = (level && Array.isArray(level.colliders)) ? level.colliders : [];
  const pMin = new THREE.Vector3(player.pos.x - player.R, player.pos.y, player.pos.z - player.R);
  const pMax = new THREE.Vector3(player.pos.x + player.R, player.pos.y + player.H, player.pos.z + player.R);
  const pb = new THREE.Box3(pMin, pMax);
  for (const c of colliders) {
    if (!c || typeof c.intersectsBox !== 'function') continue;
    if (!c.intersectsBox(pb)) continue;
    const ox = Math.min(pMax.x - c.min.x, c.max.x - pMin.x);
    const oz = Math.min(pMax.z - c.min.z, c.max.z - pMin.z);
    if (ox < oz) player.pos.x += (pMax.x - c.min.x < c.max.x - pMin.x) ? -ox : ox;
    else         player.pos.z += (pMax.z - c.min.z < c.max.z - pMin.z) ? -oz : oz;
    pMin.set(player.pos.x - player.R, player.pos.y, player.pos.z - player.R);
    pMax.set(player.pos.x + player.R, player.pos.y + player.H, player.pos.z + player.R);
  }

  if (player.pos.y < -60) {
    if (level && level.spawn && level.spawn.isVector3) player.pos.copy(level.spawn);
    else player.pos.set(0, 2, 55);
    player.vel.set(0, 0, 0);
  }
}

// ---------- loop ----------
// three.js deprecates Clock in favour of Timer.
const timer = new THREE.Timer();
let _rafId = 0;

// HUD caching — innerHTML writes every frame are expensive.
let _lastHudString = '';

function tick() {
  _rafId = requestAnimationFrame(tick);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t  = timer.getElapsed();

  if (!level) return;

  stepPlayer(dt);
  if (soriniMixer) soriniMixer.update(dt);
  if (typeof level.update === 'function') {
    try { level.update(dt, t, player); }
    catch (e) { console.warn('level.update error', e); }
  }

  // ── Third-person camera — centered directly behind Sorini ──
  const CAM_DIST   = 5.5;
  const CAM_HEIGHT = 2.8;
  const CAM_LOOK_UP = 1.2;
  const camOffX = -Math.sin(player.yaw) * CAM_DIST;
  const camOffZ = -Math.cos(player.yaw) * CAM_DIST;
  camera.position.set(
    player.pos.x + camOffX,
    player.pos.y + CAM_HEIGHT,
    player.pos.z + camOffZ
  );
  if (level && typeof level.getSurfaceHeight === 'function') {
    const camGround = level.getSurfaceHeight(camera.position.x, camera.position.z) + 0.5;
    if (camera.position.y < camGround) camera.position.y = camGround;
  }
  camera.lookAt(player.pos.x, player.pos.y + CAM_LOOK_UP, player.pos.z);

  // ── Sorini avatar ──
  soriniGroup.position.set(player.pos.x, player.pos.y, player.pos.z);
  soriniGroup.rotation.y = player.yaw;

  // ── tick attack cooldowns ──
  for (const k of ['f','g','h']) if (attackCooldown[k] > 0) attackCooldown[k] -= dt;

  // ── Sorini animation state ──
  const isSprint  = keys.ShiftLeft || keys.ShiftRight;
  const isMovingW = keys.KeyW || keys.KeyS;

  const attackNames = ['punch','kick','hook','jump'];
  const currentIsAttack = soriniCurrentAction && attackNames.some(
    n => soriniActions[n] && soriniActions[n] === soriniCurrentAction
  );
  const attackStillPlaying = currentIsAttack &&
    soriniCurrentAction.isRunning() &&
    soriniCurrentAction.loop === THREE.LoopOnce;
  attackLock = attackStillPlaying;

  if (soriniMixer && !attackStillPlaying) {
    if (!player.grounded)             playSoriniAction('jump');
    else if (isSprint && isMovingW)   playSoriniAction('run');
    else if (isMovingW)               playSoriniAction('walk');
    else if (keys.KeyA && !isMovingW) playSoriniAction('turnLeft');
    else if (keys.KeyD && !isMovingW) playSoriniAction('turnRight');
    else                              playSoriniAction('idle');
  }

  marker.position.set(player.pos.x, player.pos.y + 2, player.pos.z);
  marker.rotation.set(Math.PI / 2, player.yaw, 0);

  // ── HUD (cached — only written when the string changes) ──
  const levelName = (level && level.name) ? level.name : `LEVEL ${current}`;
  const hudStr =
    `<b>GENESIS — THE DEVICE</b><br>` +
    `${levelName}${level && level.setPhase ? ' · phase ' + phase : ''}<br>` +
    `1/2/3 levels · R restart | F punch · G kick · H hook | Shift sprint`;
  if (hudStr !== _lastHudString) {
    hud.innerHTML = hudStr;
    _lastHudString = hudStr;
  }

  // ── Main render ──
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.clear();
  renderer.render(scene, camera);

  // ── Minimap render ──
  const S = 200;
  renderer.setScissorTest(true);
  renderer.setViewport(innerWidth - S - 12, 12, S, S);
  renderer.setScissor(innerWidth - S - 12, 12, S, S);
  renderer.setClearColor(0x0a0a14, 1);
  renderer.clearDepth();
  mini.position.set(player.pos.x, 90, player.pos.z);
  mini.up.set(0, 0, -1);
  mini.lookAt(player.pos.x, 0, player.pos.z);
  renderer.render(scene, mini);
  renderer.setScissorTest(false);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

switchLevel(1);
tick();

// ---------- Vite HMR cleanup ----------
// Without this, every hot reload leaks a WebGL context. Browsers cap
// a tab at ~16 contexts, so after a dozen saves WebGL stops working
// until you close the tab.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(_rafId);
    try {
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    } catch (e) { console.warn('HMR renderer dispose failed:', e); }
    try {
      if (level && typeof level.dispose === 'function') level.dispose(scene);
    } catch (e) { console.warn('HMR level dispose failed:', e); }
    try {
      if (window.__dialogue) window.__dialogue.dispose();
    } catch (e) {}
  });
=======
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (levelViewer.isActive()) return;

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
    if (levelViewer.isActive()) return;
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
    if (levelViewer.isActive()) return;

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
>>>>>>> 576d964e64e7ab8eae664197919c63677a805956
}