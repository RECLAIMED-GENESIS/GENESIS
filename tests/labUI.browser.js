// Run in the Vite preview with an active lab:
// (await import('/tests/labUI.browser.js')).checkLabUI(__level())
export function checkLabUI(L) {
  L._briefing?.cancel();
  const passed = [];
  const check = (condition, message) => { if (!condition) throw new Error(message); passed.push(message); };
  const savedBio = { ...L.bio }, savedCamera = window.__camera, savedEvidence = L.collected.handkerchief;
  L.collected.handkerchief = true;
  window.__camera = null; // Exercise UI and timers without moving the player's view.
  try {
    check(!L._coach.expanded && L._coach.card.hidden && !L._coach.marker.visible, 'Guidance and world marker start off');
    check(getComputedStyle(L._coach.text).display === 'none', 'Long instructions are hidden during normal play');
    L._coach.toggle();
    check(L._coach.button.getAttribute('aria-expanded') === 'true', 'Help can be expanded');
    check(!L._coach.card.hidden, 'Requesting help reveals the guidance card');
    L._coach.toggle();
    check(L._coach.card.hidden && !L._coach.marker.visible && !L._coach.highlights.length, 'H hides all guidance again');
    L._openOverlay(L._intakePanel());
    check(document.body.dataset.labPanel === 'true' && L._coach.card.hidden, 'Opening a file hides the walking HUD and coach');
    const before = L.ui.overlayInner.innerHTML;
    L.bio.cut = true; L.bio.lysis = true; L.bio.loaded = true;
    L.bio.running = true; L.bio.ready = false; L.bio.t = 179.9;
    Object.getPrototypeOf(L).update.call(L, .2, 0, null);
    check(L.bio.ready && L.ui.overlayInner.innerHTML === before, 'DNA completion leaves an unrelated open file intact');
    L.ui.overlay.querySelector('.lab-panel-close').click();
    check(!window.__uiCapture && document.body.dataset.labPanel === 'false', 'Back to lab releases file input capture');
    L.bio.cut = true; L.bio.lysis = true; L.bio.loaded = true;
    L.bio.running = true; L.bio.ready = false; L.bio.t = 179.9;
    L._openOverlay(L._bioPanel(), 'biology');
    Object.getPrototypeOf(L).update.call(L, .2, 0, null);
    check(!!L.ui.overlayInner.querySelector('#bio-match-btn'), 'Active biology report refreshes when sequencing completes');
    L._closeOverlay();
    for (let i = 0; i < 3; i++) {
      L._openDevice('terminal');
      check(typeof L.ui.deviceInner.onclick === 'function', `Terminal has one replaceable click handler on opening ${i + 1}`);
      const input = L.ui.deviceInner.querySelector('#tm-in'); input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
      check(document.activeElement === L.ui.device.querySelector('.lab-panel-close'), 'Tab can leave the terminal input for the close control');
      L.ui.device.querySelector('.lab-panel-close').click();
      check(!window.__uiCapture && L.ui.deviceInner.onclick === null, 'Closing the terminal releases capture and removes its handler');
    }
    check(!L.focus && L.ui.prompt.style.display === 'none', 'Closing a panel clears stale interaction prompts');
    return passed;
  } finally {
    L._closeOverlay(); L._closeDevice(); Object.assign(L.bio, savedBio); L.collected.handkerchief = savedEvidence;
    window.__camera = savedCamera; clearTimeout(L._toastTimer); L.ui.toast.style.opacity = 0;
    L._coach.update(0, L._coach.player);
  }
}
