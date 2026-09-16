export function showCredits() {
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

export function createCreditsScreen() {
    // alias for Menu callback compatibility
    return showCredits;
}
