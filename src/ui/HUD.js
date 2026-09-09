// src/ui/HUD.js
export function createHUD() {
    const container = document.createElement('div');
    container.id = 'hud';
    container.className = 'hidden';
    container.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        font-family: 'Courier New', monospace;
        z-index: 50;
        pointer-events: none;
        color: white;
    `;

    container.innerHTML = `
        <div style="margin-bottom: 8px; color: #aaa; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">
            ❤️ Health
        </div>
        <div style="
            width: 220px;
            height: 18px;
            background: rgba(0,0,0,0.7);
            border: 1px solid #555;
            border-radius: 4px;
            margin-bottom: 18px;
            overflow: hidden;
        ">
            <div id="healthBar" style="
                width: 100%;
                height: 100%;
                background: #00ff00;
                transition: width 0.15s ease, background 0.3s ease;
                border-radius: 3px;
            "></div>
        </div>

        <div style="margin-bottom: 6px; color: #aaa; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">
            ⚡ Fragments
        </div>
        <div id="fragmentCounter" style="
            color: #00ffff;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 18px;
            text-shadow: 0 0 20px rgba(0,255,255,0.3);
        ">
            0 / 8
        </div>

        <div style="margin-bottom: 6px; color: #aaa; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">
            📡 Wave
        </div>
        <div id="waveCounter" style="
            color: #ffffff;
            font-size: 16px;
            font-weight: bold;
            text-shadow: 0 0 15px rgba(255,255,255,0.2);
        ">
            WAVE 0 / 7
        </div>

        <div id="levelIndicator" style="
            margin-top: 18px;
            color: #ffaa00;
            font-size: 14px;
            letter-spacing: 2px;
            text-transform: uppercase;
            border-top: 1px solid rgba(255,170,0,0.3);
            padding-top: 12px;
            opacity: 0.7;
        ">
            TIER 1 — THE FLAT WORLD
        </div>
    `;

    return container;
}

export function updateHUD(playerHealth, maxHealth, fragmentsCollected, totalFragments, currentWave, totalWaves, levelName) {
    const healthBar = document.getElementById('healthBar');
    const fragmentCounter = document.getElementById('fragmentCounter');
    const waveCounter = document.getElementById('waveCounter');
    const levelIndicator = document.getElementById('levelIndicator');

    if (healthBar) {
        const healthPercent = (playerHealth / maxHealth) * 100;
        healthBar.style.width = Math.max(0, healthPercent) + '%';
        
        if (healthPercent > 50) {
            healthBar.style.background = '#00ff00';
        } else if (healthPercent > 25) {
            healthBar.style.background = '#ffff00';
        } else {
            healthBar.style.background = '#ff0000';
        }
    }

    if (fragmentCounter) {
        fragmentCounter.textContent = fragmentsCollected + ' / ' + totalFragments;
    }

    if (waveCounter) {
        waveCounter.textContent = 'WAVE ' + currentWave + ' / ' + totalWaves;
    }

    if (levelIndicator) {
        levelIndicator.textContent = levelName || 'TIER 1 — THE FLAT WORLD';
    }
}