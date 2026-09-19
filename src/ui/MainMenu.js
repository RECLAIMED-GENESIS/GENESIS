// src/ui/MainMenu.js
export function createMainMenu(onPlayClick, onCreditsClick) {
    const container = document.createElement('div');
    container.id = 'main-menu';
    container.className = 'ui-screen';

    container.innerHTML = `
        <div class="menu-content" style="
            background: rgba(0, 0, 0, 0.85);
            padding: 50px 70px;
            border-radius: 16px;
            text-align: center;
            border: 2px solid #00ffff;
            box-shadow: 0 0 60px rgba(0, 255, 255, 0.15);
            font-family: 'Courier New', monospace;
            max-width: 600px;
        ">
            <h1 style="
                font-size: 4.5rem; 
                color: #00ffff; 
                text-shadow: 0 0 30px rgba(0,255,255,0.4); 
                margin: 0 0 5px 0;
                letter-spacing: 8px;
                font-weight: 700;
            ">
                GENESIS
            </h1>
            <p style="
                font-size: 0.9rem; 
                color: #88dddd; 
                letter-spacing: 3px; 
                margin-bottom: 40px;
                text-transform: uppercase;
                opacity: 0.8;
            ">
                Fight Your Way Into Existence
            </p>
            <button id="playBtn" style="
                background: #00ffff;
                border: none;
                color: #000;
                padding: 16px 50px;
                font-size: 1.4rem;
                font-weight: bold;
                cursor: pointer;
                border-radius: 8px;
                transition: all 0.2s ease;
                margin-bottom: 15px;
                width: 220px;
                font-family: 'Courier New', monospace;
                letter-spacing: 2px;
            ">▶ PLAY</button>
            <br>
            <button id="creditsBtn" style="
                background: transparent;
                border: 2px solid #555;
                color: #aaa;
                padding: 10px 30px;
                font-size: 0.9rem;
                cursor: pointer;
                border-radius: 8px;
                transition: all 0.2s ease;
                width: 220px;
                font-family: 'Courier New', monospace;
                letter-spacing: 1px;
            ">CREDITS</button>
            <div style="
                margin-top: 30px;
                font-size: 0.7rem;
                color: #444;
                letter-spacing: 1px;
            ">
                <span style="color: #00ffff;">●</span> THREE.JS <span style="color: #00ffff; margin-left: 15px;">●</span> CANNON-ES
            </div>
        </div>
    `;

    // Hover effects for Play button
    const playBtn = container.querySelector('#playBtn');
    playBtn.addEventListener('mouseenter', () => {
        playBtn.style.background = '#ffffff';
        playBtn.style.transform = 'scale(1.05)';
        playBtn.style.boxShadow = '0 0 40px rgba(0,255,255,0.6)';
    });
    playBtn.addEventListener('mouseleave', () => {
        playBtn.style.background = '#00ffff';
        playBtn.style.transform = 'scale(1)';
        playBtn.style.boxShadow = 'none';
    });

    // Hover effects for Credits button
    const creditsBtn = container.querySelector('#creditsBtn');
    creditsBtn.addEventListener('mouseenter', () => {
        creditsBtn.style.borderColor = '#00ffff';
        creditsBtn.style.color = '#00ffff';
        creditsBtn.style.background = 'rgba(0,255,255,0.1)';
    });
    creditsBtn.addEventListener('mouseleave', () => {
        creditsBtn.style.borderColor = '#555';
        creditsBtn.style.color = '#aaa';
        creditsBtn.style.background = 'transparent';
    });

    // Attach Event Listeners
    playBtn.addEventListener('click', onPlayClick);
    creditsBtn.addEventListener('click', onCreditsClick);

    return container;
}