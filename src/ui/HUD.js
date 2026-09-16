let healthBar = null
let fragmentCounter = null
let waveCounter = null
let gameOverDiv = null

function initHUD(onRestart) {
  const hudDiv = document.createElement('div')
  hudDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    font-family: monospace;
    z-index: 50;
    pointer-events: none;
  `
  hudDiv.innerHTML = `
    <div style="margin-bottom: 10px; color: white; font-size: 14px;">HEALTH</div>
    <div style="
      width: 200px;
      height: 20px;
      background: #333;
      border: 1px solid #666;
      margin-bottom: 20px;
    ">
      <div id="healthBar" style="
        width: 100%;
        height: 100%;
        background: #00ff00;
        transition: width 0.2s;
      "></div>
    </div>
    <div id="fragmentCounter" style="
      color: #00ffff;
      font-size: 16px;
    ">FRAGMENTS 0 / 8</div>
    <div id="waveCounter" style="
      color: #ffffff;
      font-size: 14px;
      margin-top: 10px;
    ">WAVE 1 / 7</div>
  `
  document.body.appendChild(hudDiv)

  healthBar = document.getElementById('healthBar')
  fragmentCounter = document.getElementById('fragmentCounter')
  waveCounter = document.getElementById('waveCounter')

  // Game over screen
  gameOverDiv = document.createElement('div')
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
  `
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
    ">RESTART</button>
  `
  document.body.appendChild(gameOverDiv)

  document.getElementById('restartBtn').addEventListener('click', () => {
    if (onRestart) onRestart()
    else location.reload()
  })
}

function updateHUD(playerHealth, playerMaxHealth, fragmentsCollected, currentWave, totalWaves, commanderAlive) {
  if (!healthBar) return

  const healthPercent = (playerHealth / playerMaxHealth) * 100
  healthBar.style.width = Math.max(0, healthPercent) + '%'

  if (healthPercent > 50) {
    healthBar.style.background = '#00ff00'
  } else if (healthPercent > 25) {
    healthBar.style.background = '#ffff00'
  } else {
    healthBar.style.background = '#ff0000'
  }

  fragmentCounter.textContent = 'FRAGMENTS ' + fragmentsCollected + ' / 8'
  waveCounter.textContent = commanderAlive
    ? 'COMMANDER'
    : 'WAVE ' + currentWave + ' / ' + totalWaves
}

function showGameOver() {
  if (gameOverDiv) gameOverDiv.style.display = 'flex'
}

export { initHUD, updateHUD, showGameOver }
