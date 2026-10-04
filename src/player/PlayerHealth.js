// src/player/PlayerHealth.js
// Central player health system — shared across all levels.
// Emits events, controls the top-left HUD bar, handles i-frames and death.

export class PlayerHealth {
    constructor(callbacks = {}) {
    this.maxHp = 100;
    this.hp = 100;
    this.dead = false;
    this.respawnTimer = 0;
    this._hurtCooldown = 0;
    this._iframeDuration = 0.7;
    this._respawnDelay = 2.5;
    this.callbacks = callbacks;

    // HUD bar disabled — HUD.js now owns the health bar
    // this._ensureHudBar();
    // this._updateBar();
}

    // =========================================================
    // HUD
    // =========================================================
    _ensureHudBar() {
        let bar = document.getElementById('player-health-bar');
        if (!bar) {
            // Create container
            const container = document.createElement('div');
            container.id = 'player-health-container';
            Object.assign(container.style, {
                position: 'fixed',
                top: '90px',
                left: '20px',
                width: '240px',
                height: '24px',
                background: 'rgba(0, 0, 0, 0.7)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '4px',
                zIndex: '50',
                pointerEvents: 'none',
                overflow: 'hidden',
                fontFamily: 'monospace',
            });

            // Fill
            bar = document.createElement('div');
            bar.id = 'player-health-bar';
            Object.assign(bar.style, {
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, #00ff88, #00cc66)',
                transition: 'width 0.25s ease, background 0.25s ease',
            });

            container.appendChild(bar);
            document.body.appendChild(container);

            // Label above the bar
            const label = document.createElement('div');
            label.id = 'player-health-label';
            Object.assign(label.style, {
                position: 'fixed',
                top: '72px',
                left: '20px',
                color: '#88ffcc',
                fontSize: '11px',
                letterSpacing: '2px',
                fontFamily: 'monospace',
                pointerEvents: 'none',
                zIndex: '51',
            });
            label.textContent = 'HEALTH';
            document.body.appendChild(label);
        }
        this._barEl = bar;
    }

    _updateBar() {
        if (!this._barEl) return;
        const pct = Math.max(0, (this.hp / this.maxHp) * 100);
        this._barEl.style.width = pct + '%';

        // Color shift by health
        if (pct > 60) {
            this._barEl.style.background = 'linear-gradient(90deg, #00ff88, #00cc66)';
        } else if (pct > 30) {
            this._barEl.style.background = 'linear-gradient(90deg, #ffcc00, #ff9900)';
        } else {
            this._barEl.style.background = 'linear-gradient(90deg, #ff3300, #cc0000)';
        }
    }

    // =========================================================
    // PUBLIC API
    // =========================================================
    takeDamage(amount) {
        if (this.dead || this._hurtCooldown > 0) return false;

        this._hurtCooldown = this._iframeDuration;
        this.hp = Math.max(0, this.hp - amount);
        this._updateBar();

        // Flash the screen red (quick visual feedback)
        this._flashScreen();

        if (this.hp <= 0) {
            this.dead = true;
            this.respawnTimer = this._respawnDelay;
            if (this.callbacks.onDeath) this.callbacks.onDeath();
        }
        return true;
    }

    heal(amount) {
        if (this.dead) return;
        this.hp = Math.min(this.maxHp, this.hp + amount);
        this._updateBar();
    }

    respawn(spawnPos = null) {
        this.dead = false;
        this.hp = this.maxHp;
        this._hurtCooldown = 0;
        this._updateBar();
        if (this.callbacks.onRespawn) this.callbacks.onRespawn(spawnPos);
    }

    update(dt) {
        if (this._hurtCooldown > 0) this._hurtCooldown -= dt;

        if (this.dead) {
            this.respawnTimer -= dt;
            if (this.respawnTimer <= 0) {
                this.respawn(null);
            }
        }
    }

    get isInvulnerable() {
        return this._hurtCooldown > 0;
    }

    _flashScreen() {
        const flash = document.createElement('div');
        Object.assign(flash.style, {
            position: 'fixed',
            top: '0', left: '0',
            width: '100%', height: '100%',
            background: 'rgba(255, 0, 0, 0.25)',
            pointerEvents: 'none',
            zIndex: '9999',
            transition: 'opacity 0.4s ease',
        });
        document.body.appendChild(flash);
        requestAnimationFrame(() => { flash.style.opacity = '0'; });
        setTimeout(() => flash.remove(), 500);
    }

    dispose() {
        const container = document.getElementById('player-health-container');
        const label = document.getElementById('player-health-label');
        if (container) container.remove();
        if (label) label.remove();
        this._barEl = null;
    }
}