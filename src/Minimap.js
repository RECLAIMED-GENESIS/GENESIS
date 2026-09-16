// src/Minimap.js
export class Minimap {
    constructor(scene, camera, playerMesh, enemies) {
        this.scene = scene;
        this.camera = camera;
        this.playerMesh = playerMesh;
        this.enemies = enemies;
        
        // Create the canvas for the minimap
        this.canvas = document.createElement('canvas');
        this.canvas.width = 200;
        this.canvas.height = 200;
        this.canvas.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            border: 2px solid #00ffff;
            border-radius: 10px;
            background: rgba(0, 0, 0, 0.7);
            z-index: 100;
            pointer-events: none;
        `;
        
        this.ctx = this.canvas.getContext('2d');
        
        // Map bounds (matches your 20x20 floor)
        this.worldSize = 20;
    }

    show() {
        document.body.appendChild(this.canvas);
    }

    hide() {
        if (this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }

    update() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw border
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(1, 1, this.canvas.width - 2, this.canvas.height - 2);

        // Convert world coordinates to minimap coordinates
        const worldToMap = (x, z) => {
            const mapX = (x / this.worldSize + 0.5) * this.canvas.width;
            const mapY = (z / this.worldSize + 0.5) * this.canvas.height;
            return { x: mapX, y: mapY };
        };

        // Draw enemies (Red dots)
        this.ctx.fillStyle = '#ff0000';
        this.enemies.forEach(enemy => {
            const pos = worldToMap(enemy.body.position.x, enemy.body.position.z);
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw player (Cyan dot)
        this.ctx.fillStyle = '#00ffff';
        const playerPos = worldToMap(this.playerMesh.position.x, this.playerMesh.position.z);
        this.ctx.beginPath();
        this.ctx.arc(playerPos.x, playerPos.y, 5, 0, Math.PI * 2);
        this.ctx.fill();
    }
}