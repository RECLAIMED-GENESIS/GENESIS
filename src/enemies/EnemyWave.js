import * as CANNON from 'cannon-es';
import { spawnEnemy, enemies } from './Enemy.js';

export const TOTAL_WAVES = 7;
export let currentWave = 0;
export let waveInProgress = false;

export const waveConfigs = [
    { spawns: [{ type: 'normal' }, { type: 'normal' }, { type: 'normal' }] },
    { spawns: [{ type: 'fast' }, { type: 'fast' }, { type: 'fast' }, { type: 'fast' }, { type: 'normal' }] },
    { spawns: [{ type: 'heavy' }, { type: 'heavy' }, { type: 'normal' }, { type: 'normal' }] },
    { spawns: [{ type: 'fast' }, { type: 'fast' }, { type: 'fast' }, { type: 'heavy' }, { type: 'heavy' }] },
    { spawns: [{ type: 'tank' }, { type: 'tank' }, { type: 'normal' }, { type: 'normal' }, { type: 'normal' }] },
    { spawns: [
        { type: 'fast',  pos: new CANNON.Vec3(-9, 1, -9) },
        { type: 'fast',  pos: new CANNON.Vec3( 9, 1, -9) },
        { type: 'fast',  pos: new CANNON.Vec3(-9, 1,  9) },
        { type: 'fast',  pos: new CANNON.Vec3( 9, 1,  9) },
        { type: 'heavy', pos: new CANNON.Vec3(-9, 1,  0) },
        { type: 'heavy', pos: new CANNON.Vec3( 9, 1,  0) },
        { type: 'normal',pos: new CANNON.Vec3( 0, 1, -9) },
        { type: 'normal',pos: new CANNON.Vec3( 0, 1,  9) },
    ]},
    { spawns: [
        { type: 'tank' },
        { type: 'heavy' }, { type: 'heavy' },
        { type: 'fast' },  { type: 'fast' }, { type: 'fast' },
        { type: 'normal'},{ type: 'normal'},{ type: 'normal' }
    ]}
];

/**
 * Spawn next wave and update HUD.
 */
export function spawnWave(scene, updateHUD, hudArgs) {
    currentWave++;
    waveInProgress = true;
    const config = waveConfigs[currentWave - 1];
    config.spawns.forEach(s => spawnEnemy(scene, s.type, s.pos || null));
    if (updateHUD && hudArgs) updateHUD(...hudArgs());
}

export function onWaveComplete(deps) {
    const { scene, spawnFragment, audioManager, updateHUD, hudArgs, spawnCommander } = deps;
    // spawnFragment is CANNON.Vec3 callback
    spawnFragment(new CANNON.Vec3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10));
    if (currentWave < TOTAL_WAVES) {
        setTimeout(() => spawnWave(scene, updateHUD, hudArgs), 3000);
    } else {
        setTimeout(() => spawnCommander(), 2000);
    }
}

export function notifyWaveEmpty(deps) {
    waveInProgress = false;
    onWaveComplete(deps);
}

export function resetWaves() {
    currentWave = 0;
    waveInProgress = false;
}

export function setWaveInProgress(v) { waveInProgress = v; }
