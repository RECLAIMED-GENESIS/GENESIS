import * as THREE from 'three';
import { nextLabStep } from '../game/labProcedure.js';
import './labCoach.css';

export class LabCoach {
  constructor(level) {
    this.level = level;
    this.enabled = true;
    this.expanded = false;
    this.elapsed = 0;
    this.last = '';
    this.highlights = [];
    this.targets = [];
    level.level.traverse(o => { if (o.userData.interact) this.targets.push(o); });
    const card = document.createElement('aside');
    card.className = 'lab-coach game-layer';
    card.setAttribute('aria-label', 'Current objective');
    card.id = 'lab-guidance';
    card.hidden = true;
    card.innerHTML = '<div class="lc-kicker">NEXT OBJECTIVE <span class="lc-progress"></span></div><h3></h3><p class="lc-instruction" aria-live="polite"></p><code hidden></code><div class="lc-navigation"></div><small>H to collapse help</small>';
    this.card = level.ui.coach = card;
    this.title = card.querySelector('h3');
    this.text = card.querySelector('p');
    this.command = card.querySelector('code');
    this.nav = card.querySelector('.lc-navigation');
    this.progress = card.querySelector('.lc-progress');
    const toggle = document.createElement('button');
    toggle.className = 'lab-guide-toggle game-layer';
    toggle.innerHTML = '<kbd>H</kbd> Help';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'lab-guidance');
    toggle.addEventListener('click', () => this.toggle());
    this.button = level.ui.coachToggle = toggle;
    document.body.append(card, toggle);
    const material = new THREE.MeshBasicMaterial({ color: 0xe8b45b, transparent: true, opacity: .85, depthWrite: false, side: THREE.DoubleSide });
    this.marker = new THREE.Mesh(new THREE.RingGeometry(.12, .16, 32), material);
    this.marker.userData.noShadow = true;
    this.marker.name = 'Current lab procedure marker';
    this.marker.visible = false;
    level.level.add(this.marker);
    this.position = new THREE.Vector3();
  }
  toggle() {
    this.expanded = !this.expanded;
    this.card.classList.toggle('lc-expanded', this.expanded);
    this.button.innerHTML = this.expanded ? '<kbd>H</kbd> Hide help' : '<kbd>H</kbd> Help';
    this.button.setAttribute('aria-expanded', String(this.expanded));
    this.clearHighlights();
    this.update(0, this.player);
  }

  clearHighlights() {
    for (const node of this.highlights) node.classList.remove('lab-coach-target');
    this.highlights = [];
  }
  update(dt, player) {
    if (!this.enabled) return;
    const L = this.level;
    this.player = player;
    L.ui.quest.style.visibility = 'hidden';
    const busy = L._uiBusy();
    document.body.classList.toggle('lab-coach-panel', busy && this.expanded);
    document.body.dataset.labPanel = String(busy || !!L._captainTalking);
    this.card.hidden = !this.expanded || !!L._captainTalking;
    this.card.classList.toggle('lc-in-panel', busy);
    const step = nextLabStep(L);
    const key = `${step.id}:${Object.keys(L.reports).length}`;
    if (this.last !== key) {
      this.title.textContent = step.title;
      this.text.textContent = step.text;
      this.command.textContent = step.command || '';
      this.command.hidden = !step.command;
      this.card.classList.toggle('lc-urgent', !!step.urgent);
      this.progress.textContent = `${Object.keys(L.reports).length}/4 reports filed`;
      this.last = key;
    }
    this.command.hidden = !step.command;
    if (this.text.textContent !== step.text) this.text.textContent = step.text;
    // Device panels rebuild after each action. Refresh outlines without changing focus.
    this.elapsed += dt;
    if (this.elapsed >= .15) {
      this.elapsed = 0;
      this.clearHighlights();
      if (busy && this.expanded && step.selector) {
        this.highlights = [...document.querySelectorAll(step.selector)].filter(n => n.getClientRects().length && !n.disabled);
        for (const node of this.highlights) node.classList.add('lab-coach-target');
      }
    }
    const target = this.targets.find(o => o.userData.interact?.kind === step.target);
    this.marker.visible = this.expanded && !!target && !busy && !L._captainTalking;
    if (!target || !player) { this.nav.textContent = step.remaining !== undefined ? `Sequencer: ${step.remaining}s remaining` : ''; return; }
    target.getWorldPosition(this.position);
    let route = '';
    // Route through real doorways instead of pointing players through walls.
    if (player.pos.z > 19.6 && this.position.z < 19) {
      this.position.set(0, 1.4, 19.4); route = 'Main entrance';
    } else if (player.pos.z > 7.4 && this.position.z < 7) {
      this.position.set(-5, 1.4, 6.8); route = 'Lab doorway';
    } else if (player.pos.z < 6.5 && this.position.z > 7.4) {
      this.position.set(-5, 1.4, 7.5); route = 'Return to the corridor';
    } else if (player.pos.x < 9.8 && this.position.x > 10.4 && this.position.z > 7) {
      this.position.set(10, 1.4, 12); route = 'Captain’s office doorway';
    }
    const dx = this.position.x - player.pos.x, dz = this.position.z - player.pos.z;
    const distance = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, -dz) + (player.yaw || 0);
    const turn = Math.atan2(Math.sin(angle), Math.cos(angle));
    const direction = Math.abs(turn) > 2.3 ? 'Turn around' : turn > .4 ? 'Turn right' : turn < -.4 ? 'Turn left' : 'Ahead';
    if (busy) this.nav.textContent = step.remaining !== undefined ? `${step.remaining}s remaining` : (this.highlights.length ? 'Use the outlined control.' : 'Esc returns to the room.');
    else this.nav.textContent = `${route || (distance < 2.6 ? 'Look at the marked item' : direction)} · ${distance.toFixed(1)} m`;
    this.marker.position.copy(this.position);
    this.marker.position.y += .28;
    if (window.__camera) this.marker.quaternion.copy(window.__camera.quaternion);
  }
  dispose() {
    this.clearHighlights();
    document.body.classList.remove('lab-coach-panel');
    delete document.body.dataset.labPanel;
    this.marker.removeFromParent();
    this.marker.geometry.dispose(); this.marker.material.dispose();
    this.card.remove(); this.button.remove();
  }
}
