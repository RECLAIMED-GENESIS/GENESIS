// src/ui/UIManager.js
export class UIManager {
    constructor() {
        this.currentScreen = null;
        this.screens = {};

        // The main container for all overlays
        this.container = document.createElement('div');
        this.container.id = 'ui-container';
        document.body.appendChild(this.container);

        // Add a global style to ensure UI layers correctly over the canvas
        this.injectGlobalStyles();
    }
    

    getScreen(name) {
        return this.screens[name] || null;
    }

    injectGlobalStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #ui-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 10;
            }
            #ui-container > * {
                pointer-events: auto;
            }
            .ui-screen {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: none;
                justify-content: center;
                align-items: center;
            }
            .ui-screen.active {
                display: flex;
            }
            .hidden {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    registerScreen(name, element) {
        this.screens[name] = element;
        this.container.appendChild(element);
    }

    showScreen(name) {
        Object.values(this.screens).forEach(screen => screen.classList.remove('active'));
        if (this.screens[name]) {
            this.screens[name].classList.add('active');
            this.currentScreen = name;
        }
    }

    hideAllScreens() {
        Object.values(this.screens).forEach(screen => screen.classList.remove('active'));
        this.currentScreen = null;
    }

    showHUD() {
        if (this.screens['hud']) {
            this.screens['hud'].classList.remove('hidden');
        }
    }

    hideHUD() {
        if (this.screens['hud']) {
            this.screens['hud'].classList.add('hidden');
        }
    }
}