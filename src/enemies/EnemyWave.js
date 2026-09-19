import * as CANNON from 'cannon-es'
import { spawnEnemy, removeEnemy, getEnemies } from './Enemy.js'
import { healPlayer } from '../player/Player.js'

let currentWave = 0
const TOTAL_WAVES = 7
let waveInProgress = false
let scene = null
let onAllWavesComplete = null

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
]

function spawnWave() {
  currentWave++
  waveInProgress = true
  console.log('Wave', currentWave, 'of', TOTAL_WAVES, 'starting')

  const config = waveConfigs[currentWave - 1]
  config.spawns.forEach(s => {
    spawnEnemy(scene, s.type, s.pos || null)
  })
}

function onWaveComplete(spawnFragment) {
  waveInProgress = false
  console.log('Wave', currentWave, 'complete - fragment dropped')

  // Heal player for surviving the wave
  healPlayer(5)
  console.log('Wave clear bonus heal')

  spawnFragment(new CANNON.Vec3(
    (Math.random() - 0.5) * 10,
    0,
    (Math.random() - 0.5) * 10
  ))

  if (currentWave < TOTAL_WAVES) {
    setTimeout(() => spawnWave(), 3000)
  } else {
    console.log('All waves complete - commander spawns')
    if (onAllWavesComplete) setTimeout(() => onAllWavesComplete(), 2000)
  }
}

function initWaves(gameScene, onComplete) {
  scene = gameScene
  onAllWavesComplete = onComplete
  spawnWave()
}

function getCurrentWave() { return currentWave }
function getTotalWaves() { return TOTAL_WAVES }
function isWaveInProgress() { return waveInProgress }
function setWaveInProgress(val) { waveInProgress = val }

export {
  initWaves,
  onWaveComplete,
  getCurrentWave,
  getTotalWaves,
  isWaveInProgress,
  setWaveInProgress
}
