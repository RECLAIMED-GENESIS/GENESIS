// src/main.js — thin orchestrator, SIBU tasks delegated to modules
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Minimap } from './Minimap.js';
import { AudioManager } from './audio/AudioManager.js';
import { loadAllAudio } from './audio/loadAudio.js';
import { UIManager } from './ui/UIManager.js';
import { createMainMenu } from './ui/MainMenu.js';
import { createHUD, updateHUD } from './ui/HUD.js';
import { createLoadingScreen, updateLoadingScreen } from './ui/LoadingScreen.js';
import { showCredits } from './ui/Credits.js';

// SIBU — Physics & Player modules (Tasks 2-5)
import { physicsWorld, createFloor, createArenaWalls, stepPhysics } from './physics/PhysicsWorld.js';
import { createPlayer, playerState, PLAYER_MAX_HEALTH, getPlayerMesh, getPlayerBody, createGameOverScreen, hideGameOver, resetPlayer, updatePlayerFlash, updateInvincibility } from './player/Player.js';
import { initCombat, getHitboxBody, getAttackIndicator, handleMovement, updateCombat, setupInput, resetCombat, combatState } from './player/PlayerPhysics.js';

// ============================================
// AUDIO
// ============================================
const audioManager = new AudioManager();
loadAllAudio(audioManager);
console.log('🎵 Audio system ready');

// ============================================
// UI
// ============================================
const uiManager = new UIManager();
const hudElement = createHUD();
uiManager.registerScreen('hud', hudElement);
const loadingScreenElement = createLoadingScreen();
uiManager.registerScreen('loading', loadingScreenElement);

let gameStarted = false;

const mainMenuElement = createMainMenu(
    () => {
        console.log('🎮 Game Started!');
        audioManager.playLevelMusic(1);
        uiManager.showScreen('loading');
        updateLoadingScreen('LEVEL 1','THE FLAT WORLD','The slave labour camp. Fight your way through the guards and collect the Gold Fragments.',0,'Initializing...');
        let progress = 0;
        const loadInterval = setInterval(() => {
            progress += Math.random() * 15 + 5;
            if (progress >= 100) {
                progress = 100; clearInterval(loadInterval);
                updateLoadingScreen('LEVEL 1','THE FLAT WORLD','The slave labour camp. Fight your way through the guards and collect the Gold Fragments.',100,'Ready!',true);
                const continueBtn = document.getElementById('continueBtn');
                if (continueBtn) continueBtn.onclick = () => {
                    if (playerState.gameOver) resetGame();
                    uiManager.hideAllScreens(); uiManager.showHUD();
                    if (!gameStarted) { gameStarted = true; spawnWave(); animate(); }
                };
            } else {
                const statuses = ['Loading assets...','Building world...','Spawning enemies...','Almost ready...'];
                updateLoadingScreen('LEVEL 1','THE FLAT WORLD','The slave labour camp. Fight your way through the guards and collect the Gold Fragments.',progress,statuses[Math.floor(Math.random()*statuses.length)]);
            }
        }, 200);
    },
    () => showCredits()
);
uiManager.registerScreen('main-menu', mainMenuElement);
uiManager.showScreen('main-menu');

// ============================================
// SCENE / CAMERA / RENDERER
// ============================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
camera.lookAt(0,0,0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5,10,5); dirLight.castShadow = true; scene.add(dirLight);

// ============================================
// PHYSICS WORLD — Task 2 (delegated)
// ============================================
const { body: floorBody } = createFloor(scene);
createArenaWalls(scene);

// ============================================
// PLAYER — Tasks 3-5 (delegated)
// ============================================
const { mesh: playerMesh, body: playerBody } = createPlayer(scene);
const { attackIndicator, hitboxBody } = initCombat(scene, physicsWorld);

// Game Over screen (Player.js)
createGameOverScreen(() => resetGame(), () => uiManager, () => audioManager);

// ============================================
// FRAGMENTS / TERMINAL / PORTAL (kept in main for now — belongs to Level1.js per structure)
// ============================================
const fragments = [];
let fragmentsCollected = 0;
const FRAGMENTS_NEEDED = 8;
function spawnFragment(position) {
    const g = new THREE.OctahedronGeometry(0.4);
    const m = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(g,m); mesh.position.set(position.x,1,position.z); scene.add(mesh); fragments.push(mesh);
}
function checkFragmentCollection() {
    for (let i=fragments.length-1;i>=0;i--) {
        const f=fragments[i];
        if (f.position.distanceTo(playerMesh.position) < 1.5) {
            scene.remove(f); f.geometry.dispose(); f.material.dispose(); fragments.splice(i,1);
            fragmentsCollected++; audioManager.playSfx('fragment_collected');
            updateHUD(playerState.health, PLAYER_MAX_HEALTH, fragmentsCollected, FRAGMENTS_NEEDED, currentWave, TOTAL_WAVES);
        }
    }
}
let terminalActive=false, terminalVisible=false;
const terminalMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5,2,0.5), new THREE.MeshStandardMaterial({ color:0x003333, emissive:0x00ffff, emissiveIntensity:0.2 }));
terminalMesh.position.set(0,1,-8); terminalMesh.visible=false; scene.add(terminalMesh);
const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(1,1.2), new THREE.MeshStandardMaterial({ color:0x00ffff, emissive:0x00ffff, emissiveIntensity:0.8 }));
screenMesh.position.set(0,1.2,-7.74); screenMesh.visible=false; scene.add(screenMesh);
function showTerminal(){ terminalVisible=true; terminalMesh.visible=true; screenMesh.visible=true; }
function activateTerminal(){ if(fragmentsCollected<FRAGMENTS_NEEDED) return; terminalActive=true; activatePortal(); }
function checkTerminalInteraction(){ if(!terminalVisible||terminalActive) return; if(terminalMesh.position.distanceTo(playerMesh.position)<3 && keys['KeyE']) activateTerminal(); }
let portalActive=false;
const portalMesh = new THREE.Mesh(new THREE.TorusGeometry(2,0.3,16,100), new THREE.MeshStandardMaterial({ color:0x9900ff, emissive:0x9900ff, emissiveIntensity:0.8 }));
portalMesh.position.set(0,2,-9); portalMesh.visible=false; scene.add(portalMesh);
function activatePortal(){ portalActive=true; portalMesh.visible=true; audioManager.playSfx('portal_activate'); }
function checkPortalEntry(){ if(!portalActive) return; if(portalMesh.position.distanceTo(playerMesh.position)<2.5) console.log('🚪 ENTERING LEVEL 2'); }

// ============================================
// COMMANDER / ENEMIES / WAVES (kept in main — maps to Enemy.js / EnemyWave.js / Boss.js per structure)
// ============================================
let commander=null; const COMMANDER_HEALTH=20; let commanderAlive=false;
function spawnCommander(){
    if(commanderAlive) return; commanderAlive=true;
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.5,1.5), new THREE.MeshStandardMaterial({ color:0xff6600, emissive:0xff2200, emissiveIntensity:0.3 }));
    mesh.castShadow=true; scene.add(mesh);
    const body=new CANNON.Body({ mass:2, shape:new CANNON.Box(new CANNON.Vec3(0.75,0.75,0.75)), position:new CANNON.Vec3(0,1,-7), linearDamping:0.95 });
    physicsWorld.addBody(body); commander={ mesh, body, health:COMMANDER_HEALTH, attackTimer:0, chargeTimer:4, isCharging:false, chargeDir:new CANNON.Vec3() };
}
function removeCommander(){
    if(!commander) return; spawnFragment(commander.body.position); scene.remove(commander.mesh); physicsWorld.removeBody(commander.body);
    commander.mesh.geometry.dispose(); commander.mesh.material.dispose(); commander=null; commanderAlive=false; audioManager.playSfx('portal_activate'); showTerminal();
}
function updateCommander(delta){
    if(!commander) return;
    const dir=new CANNON.Vec3(playerBody.position.x-commander.body.position.x,0,playerBody.position.z-commander.body.position.z); dir.normalize();
    commander.chargeTimer-=delta;
    if(commander.chargeTimer<=0 && !commander.isCharging){ commander.isCharging=true; commander.chargeDir=dir.clone(); commander.chargeTimer=5; setTimeout(()=>{if(commander) commander.isCharging=false;},600); }
    if(commander.isCharging){ commander.body.velocity.x=commander.chargeDir.x*12; commander.body.velocity.z=commander.chargeDir.z*12; }
    else { const sm=1+(1-commander.health/COMMANDER_HEALTH)*1.5; commander.body.velocity.x=dir.x*2*sm; commander.body.velocity.z=dir.z*2*sm; }
    commander.mesh.position.copy(commander.body.position); commander.mesh.quaternion.copy(commander.body.quaternion);
    commander.mesh.material.emissiveIntensity=Math.sin(Date.now()*0.005)*0.3+0.3;
    commander.attackTimer-=delta;
    if(commander.attackTimer<=0){
        const dist=new THREE.Vector3(playerBody.position.x-commander.body.position.x,0,playerBody.position.z-commander.body.position.z).length();
        if(dist<2 && !playerState.invincible){
            playerState.health-=2; playerState.invincible=true; playerState.invincibleTimer=1.0;
            // flash handled via Player.js
            const { flashPlayer } = awaitImportHack(); // fallback inline
            playerMesh.material.color.set(0xff0000); playerMesh.material.emissive.set(0xff0000); playerMesh.material.emissiveIntensity=1; playerState.flashing=true; playerState.flashTimer=0.1;
            updateHUD(playerState.health, PLAYER_MAX_HEALTH, fragmentsCollected, FRAGMENTS_NEEDED, currentWave, TOTAL_WAVES);
            if(playerState.health<=0) { playerState.gameOver=true; audioManager.stopMusic(); document.querySelector('[id="restartBtn"]')?.parentElement?.style && (document.body.querySelector=()=>{}); }
        }
        commander.attackTimer=1.5;
    }
    // hitbox vs commander
    if(combatState.isAttacking){
        const hp=new THREE.Vector3(hitboxBody.position.x,hitboxBody.position.y,hitboxBody.position.z);
        const cp=new THREE.Vector3(commander.body.position.x,commander.body.position.y,commander.body.position.z);
        if(hp.distanceTo(cp)<1.5){
            const dmg=combatState.attackType==='punch'?1:2; commander.health-=dmg; audioManager.playSfx('boss_hit');
            commander.body.applyImpulse(new CANNON.Vec3(dir.x*-2,1,dir.z*-2)); if(commander.health<=0) removeCommander();
        }
    }
}
function awaitImportHack(){ return {}; }

const ENEMY_TYPES={ normal:{color:0xff0000,size:1,health:5,speed:2,damage:1,attackRate:1.0}, fast:{color:0xff6600,size:0.7,health:2,speed:4,damage:1,attackRate:0.8}, heavy:{color:0x990000,size:1.4,health:12,speed:1,damage:2,attackRate:2.0}, tank:{color:0x660000,size:1.8,health:20,speed:0.8,damage:3,attackRate:2.5} };
const enemies=[];
let minimap=new Minimap(scene,camera,playerMesh,enemies);
function spawnEnemy(type='normal', spawnPos=null){
    const cfg=ENEMY_TYPES[type], s=cfg.size;
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(s,s,s), new THREE.MeshStandardMaterial({color:cfg.color})); mesh.castShadow=true; scene.add(mesh);
    const barContainer=document.createElement('div'); barContainer.style.cssText=`position:fixed;width:50px;height:6px;background:#333;border:1px solid #666;pointer-events:none;z-index:50;`;
    const barFill=document.createElement('div'); barFill.style.cssText=`width:100%;height:100%;background:#ff0000;`; barContainer.appendChild(barFill); document.body.appendChild(barContainer);
    const pos=spawnPos||new CANNON.Vec3((Math.random()-0.5)*16,1,(Math.random()-0.5)*16);
    const body=new CANNON.Body({ mass:1, shape:new CANNON.Box(new CANNON.Vec3(s/2,s/2,s/2)), position:pos, linearDamping:0.9 });
    physicsWorld.addBody(body); enemies.push({ mesh, body, health:cfg.health, maxHealth:cfg.health, speed:cfg.speed, damage:cfg.damage, attackRate:cfg.attackRate, attackTimer:0, type, barContainer, barFill });
}
function removeEnemy(enemy){
    scene.remove(enemy.mesh); physicsWorld.removeBody(enemy.body); enemy.mesh.geometry.dispose(); enemy.mesh.material.dispose();
    if(enemy.barContainer?.parentNode) document.body.removeChild(enemy.barContainer);
    enemies.splice(enemies.indexOf(enemy),1); audioManager.playSfx('enemy_death');
    if(enemies.length===0 && waveInProgress){ waveInProgress=false; onWaveComplete(); }
}
let currentWave=0; const TOTAL_WAVES=7; let waveInProgress=false;
const waveConfigs=[
    {spawns:[{type:'normal'},{type:'normal'},{type:'normal'}]},
    {spawns:[{type:'fast'},{type:'fast'},{type:'fast'},{type:'fast'},{type:'normal'}]},
    {spawns:[{type:'heavy'},{type:'heavy'},{type:'normal'},{type:'normal'}]},
    {spawns:[{type:'fast'},{type:'fast'},{type:'fast'},{type:'heavy'},{type:'heavy'}]},
    {spawns:[{type:'tank'},{type:'tank'},{type:'normal'},{type:'normal'},{type:'normal'}]},
    {spawns:[{type:'fast',pos:new CANNON.Vec3(-9,1,-9)},{type:'fast',pos:new CANNON.Vec3(9,1,-9)},{type:'fast',pos:new CANNON.Vec3(-9,1,9)},{type:'fast',pos:new CANNON.Vec3(9,1,9)},{type:'heavy',pos:new CANNON.Vec3(-9,1,0)},{type:'heavy',pos:new CANNON.Vec3(9,1,0)},{type:'normal',pos:new CANNON.Vec3(0,1,-9)},{type:'normal',pos:new CANNON.Vec3(0,1,9)}]},
    {spawns:[{type:'tank'},{type:'heavy'},{type:'heavy'},{type:'fast'},{type:'fast'},{type:'fast'},{type:'normal'},{type:'normal'},{type:'normal'}]}
];
function spawnWave(){ currentWave++; waveInProgress=true; const cfg=waveConfigs[currentWave-1]; cfg.spawns.forEach(s=>spawnEnemy(s.type,s.pos||null)); updateHUD(playerState.health,PLAYER_MAX_HEALTH,fragmentsCollected,FRAGMENTS_NEEDED,currentWave,TOTAL_WAVES); }
function onWaveComplete(){ spawnFragment(new CANNON.Vec3((Math.random()-0.5)*10,0,(Math.random()-0.5)*10)); if(currentWave<TOTAL_WAVES) setTimeout(()=>spawnWave(),3000); else setTimeout(()=>spawnCommander(),2000); }

// ============================================
// INPUT — delegated to PlayerPhysics.js for movement/combat, plus E key kept here
// ============================================
const keys={};
setupInput(keys, ()=>audioManager);

// ============================================
// RESIZE / CLOCK
// ============================================
window.addEventListener('resize', ()=>{ camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
const clock=new THREE.Clock();

// ============================================
// ANIMATION LOOP — SIBU tasks use helpers
// ============================================
function animate(){
    requestAnimationFrame(animate);
    if(playerState.gameOver) return;
    const delta=clock.getDelta();

    // Task 3 & 4: movement + jump (damping + bounds inside handleMovement, ground check via Player.js)
    const velocity = handleMovement(keys, delta);
    updateInvincibility(delta);
    updatePlayerFlash(delta);
    updateCombat(delta, velocity);

    // Enemies (kept inline — maps to enemies/Enemy.js per structure)
    for(let i=enemies.length-1;i>=0;i--){
        const e=enemies[i];
        const dir=new CANNON.Vec3(playerBody.position.x-e.body.position.x,0,playerBody.position.z-e.body.position.z); dir.normalize();
        e.body.velocity.x=dir.x*e.speed; e.body.velocity.z=dir.z*e.speed;
        e.mesh.position.copy(e.body.position); e.mesh.quaternion.copy(e.body.quaternion);
        const sp=e.mesh.position.clone(); sp.y+=1; sp.project(camera);
        e.barContainer.style.left=((sp.x*0.5+0.5)*window.innerWidth-25)+'px';
        e.barContainer.style.top=((-sp.y*0.5+0.5)*window.innerHeight-20)+'px';
        const hp=(e.health/e.maxHealth)*100; e.barFill.style.width=Math.max(0,hp)+'%'; e.barFill.style.background=hp>50?'#00ff00':hp>25?'#ffff00':'#ff0000';
        e.attackTimer-=delta;
        if(e.attackTimer<=0){
            const dist=new THREE.Vector3(playerBody.position.x-e.body.position.x,0,playerBody.position.z-e.body.position.z).length();
            if(dist<1.5 && !playerState.invincible){
                playerState.health-=e.damage; playerState.invincible=true; playerState.invincibleTimer=0.5;
                playerState.flashing=true; playerState.flashTimer=0.1; playerMesh.material.color.set(0xff0000); playerMesh.material.emissive.set(0xff0000); playerMesh.material.emissiveIntensity=1;
                updateHUD(playerState.health,PLAYER_MAX_HEALTH,fragmentsCollected,FRAGMENTS_NEEDED,currentWave,TOTAL_WAVES);
                if(playerState.health<=0){ playerState.gameOver=true; audioManager.stopMusic(); uiManager.hideHUD(); document.querySelector('div[style*="GAME OVER"]')?.parentElement; }
            }
            e.attackTimer=e.attackRate;
        }
        if(combatState.isAttacking){
            const hp3=new THREE.Vector3(hitboxBody.position.x,hitboxBody.position.y,hitboxBody.position.z);
            const ep=new THREE.Vector3(e.body.position.x,e.body.position.y,e.body.position.z);
            if(hp3.distanceTo(ep)<1.2){
                const dmg=combatState.attackType==='punch'?1:2; e.health-=dmg; audioManager.playSfx('punch_hit');
                e.body.applyImpulse(new CANNON.Vec3(dir.x*-5,2,dir.z*-5)); if(e.health<=0) removeEnemy(e);
            }
        }
    }

    updateCommander(delta);
    checkFragmentCollection(); checkTerminalInteraction(); checkPortalEntry();
    fragments.forEach(f=>f.rotation.y+=0.02);
    if(terminalVisible) screenMesh.material.emissiveIntensity=Math.sin(Date.now()*0.003)*0.3+0.5;
    if(portalActive) portalMesh.rotation.z+=0.01;

    stepPhysics(delta);
    playerMesh.position.copy(playerBody.position); playerMesh.quaternion.copy(playerBody.quaternion);
    camera.position.x=playerMesh.position.x; camera.position.y=playerMesh.position.y+5; camera.position.z=playerMesh.position.z+10; camera.lookAt(playerMesh.position);
    updateHUD(playerState.health,PLAYER_MAX_HEALTH,fragmentsCollected,FRAGMENTS_NEEDED,currentWave,TOTAL_WAVES);
    if(currentWave>=4){ minimap.show(); minimap.update(); } else minimap.hide();
    renderer.render(scene,camera);
}

function resetGame(){
    gameStarted=false; playerState.gameOver=false; currentWave=0; waveInProgress=false;
    resetPlayer(); resetCombat();
    fragmentsCollected=0; terminalVisible=false; terminalActive=false; portalActive=false; commander=null; commanderAlive=false;
    // clear enemies
    for(let i=enemies.length-1;i>=0;i--){ const e=enemies[i]; scene.remove(e.mesh); physicsWorld.removeBody(e.body); e.mesh.geometry.dispose(); e.mesh.material.dispose(); if(e.barContainer?.parentNode) e.barContainer.parentNode.removeChild(e.barContainer); }
    enemies.length=0;
    for(let i=fragments.length-1;i>=0;i--){ const f=fragments[i]; scene.remove(f); f.geometry.dispose(); f.material.dispose(); } fragments.length=0;
    if(commander){ scene.remove(commander.mesh); physicsWorld.removeBody(commander.body); commander.mesh.geometry.dispose(); commander.mesh.material.dispose(); commander=null; }
    terminalMesh.visible=false; screenMesh.visible=false; portalMesh.visible=false; if(attackIndicator) attackIndicator.visible=false; hideGameOver();
    audioManager.stopMusic(); audioManager.playLevelMusic(1);
    updateHUD(playerState.health,PLAYER_MAX_HEALTH,fragmentsCollected,FRAGMENTS_NEEDED,currentWave,TOTAL_WAVES);
    uiManager.hideAllScreens(); uiManager.showScreen('main-menu');
    console.log('🔄 Game reset');
}
