// src/ui/LoadingScreen.js
export function createLoadingScreen() {
    const container = document.createElement('div');
    container.id = 'loading-screen';
    container.className = 'ui-screen';
    container.style.cssText = `
        background: rgba(0, 0, 0, 0.92);
        flex-direction: column;
        justify-content: center;
        align-items: center;
        font-family: 'Courier New', monospace;
        color: white;
        z-index: 60;
    `;

    container.innerHTML = `
        <div style="
            text-align: center;
            padding: 40px 60px;
            border: 1px solid rgba(0, 255, 255, 0.2);
            border-radius: 12px;
            background: rgba(0, 0, 0, 0.6);
            max-width: 600px;
        ">
            <div id="loadingLevelName" style="
                font-size: 2.5rem;
                color: #00ffff;
                text-shadow: 0 0 30px rgba(0,255,255,0.3);
                margin-bottom: 10px;
                letter-spacing: 4px;
            ">LEVEL 1</div>
            
            <div id="loadingLevelTitle" style="
                font-size: 1.2rem;
                color: #88dddd;
                letter-spacing: 2px;
                margin-bottom: 30px;
                opacity: 0.8;
            ">THE FLAT WORLD</div>
            
            <div id="loadingStoryText" style="
                font-size: 1rem;
                color: #aaaaaa;
                line-height: 1.6;
                margin-bottom: 30px;
                min-height: 60px;
                padding: 0 20px;
                font-style: italic;
            ">Loading...</div>
            
            <div style="
                width: 100%;
                height: 4px;
                background: #1a1a2e;
                border-radius: 2px;
                overflow: hidden;
                margin-bottom: 20px;
            ">
                <div id="loadingProgressBar" style="
                    width: 0%;
                    height: 100%;
                    background: linear-gradient(90deg, #00ffff, #9900ff);
                    transition: width 0.3s ease;
                    border-radius: 2px;
                "></div>
            </div>
            
            <div id="loadingStatus" style="
                font-size: 0.8rem;
                color: #666;
                letter-spacing: 1px;
            ">Initializing...</div>
            
            <div id="loadingContinueBtn" style="
                display: none;
                margin-top: 25px;
            ">
                <button id="continueBtn" style="
                    background: #00ffff;
                    border: none;
                    color: #000;
                    padding: 12px 40px;
                    font-size: 1rem;
                    font-weight: bold;
                    cursor: pointer;
                    border-radius: 8px;
                    font-family: 'Courier New', monospace;
                    transition: all 0.2s ease;
                    letter-spacing: 1px;
                ">▶ CONTINUE</button>
            </div>
        </div>
    `;

    // Hover effect for continue button
    const continueBtn = container.querySelector('#continueBtn');
    if (continueBtn) {
        continueBtn.addEventListener('mouseenter', () => {
            continueBtn.style.background = '#ffffff';
            continueBtn.style.transform = 'scale(1.05)';
            continueBtn.style.boxShadow = '0 0 40px rgba(0,255,255,0.6)';
        });
        continueBtn.addEventListener('mouseleave', () => {
            continueBtn.style.background = '#00ffff';
            continueBtn.style.transform = 'scale(1)';
            continueBtn.style.boxShadow = 'none';
        });
    }

    return container;
}

export function updateLoadingScreen(level, title, storyText, progress, status, showContinue = false) {
    const levelNameEl = document.getElementById('loadingLevelName');
    const levelTitleEl = document.getElementById('loadingLevelTitle');
    const storyTextEl = document.getElementById('loadingStoryText');
    const progressBar = document.getElementById('loadingProgressBar');
    const statusEl = document.getElementById('loadingStatus');
    const continueBtnContainer = document.getElementById('loadingContinueBtn');

    if (levelNameEl) levelNameEl.textContent = level;
    if (levelTitleEl) levelTitleEl.textContent = title;
    if (storyTextEl) storyTextEl.textContent = storyText;
    if (progressBar) progressBar.style.width = Math.min(100, progress) + '%';
    if (statusEl) statusEl.textContent = status;
    if (continueBtnContainer) {
        continueBtnContainer.style.display = showContinue ? 'block' : 'none';
    }
}