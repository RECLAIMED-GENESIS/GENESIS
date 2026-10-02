// mystery.js
// The shared case state. Levels register clue objects here; the scanner,
// the interaction code and the HUD all read from this one place.
// Frozen core API — see the team brief, section 5.

import { CLUES } from './case.js';

class Mystery {
  constructor() {
    this.defs = CLUES;
    // id -> { id, object, label }. `object` is what the raycaster and the
    // scanner look at; a clue stops being interactive once collected.
    this.entries = new Map();
    this.collected = new Set();
    this.listeners = new Set();
  }

  registerClue(id, object, label) {
    const def = this.defs[id];
    this.entries.set(id, {
      id,
      object: object || null,
      label: label || (def ? def.name : id),
    });
  }

  // Called by a level on dispose so stale objects never answer a raycast
  // or glow in another level.
  forgetObjects(ids) {
    for (const id of ids) this.entries.delete(id);
  }

  hasClue(id) {
    return this.collected.has(id);
  }

  collectedForLevel(n) {
    let c = 0;
    for (const id of this.collected) {
      if (this.defs[id] && this.defs[id].level === n) c += 1;
    }
    return c;
  }

  totalForLevel(n) {
    let c = 0;
    for (const id in this.defs) {
      if (this.defs[id].level === n) c += 1;
    }
    return c;
  }

  collect(id) {
    if (this.collected.has(id) || !this.defs[id]) return false;
    this.collected.add(id);
    const evt = { type: 'collect', id };
    for (const cb of this.listeners) {
      try { cb(evt); } catch (e) { console.warn('mystery listener failed:', e); }
    }
    return true;
  }

  onChange(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

export const mystery = new Mystery();

