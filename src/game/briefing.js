import { storyStyle } from './storyStyle.js';
// ============================================================
// briefing.js — typed radio/dispatch briefing shown at the start of a level.
// Waits for the level card to clear, freezes the player (window.__uiCapture),
// types each line, and hands the mouse back on dismiss.
//   Enter / click = next (finishes typing first)   Esc = skip all
// ============================================================
export function showBriefing({ kicker = 'DISPATCH', stamp = '', speaker = '', lines = [], accent = '#f2b84b', objective = '', onDone } = {}) {
  let dead = false, root = null, poll = 0, typeT = 0;
  let idx = 0, typing = false, full = '';
  let lineEl = null, nextEl = null;

  const teardown = () => {
    dead = true;
    if (root) delete document.body.dataset.briefing;
    clearInterval(poll);
    clearInterval(typeT);
    window.removeEventListener('keydown', onKey, true);
    if (root) { root.remove(); root = null; }
  };
  // Called by the level's dispose(): never leave the game frozen.
  const cancel = () => {
    if (root) window.__uiCapture = false;
    teardown();
  };
  const finish = () => {
    if (dead) return;
    teardown();
    window.__uiCapture = false;
    if (onDone) onDone();
  };
  const type = (text) => {
    clearInterval(typeT);
    full = text; typing = true;
    let i = 0;
    lineEl.textContent = '';
    nextEl.style.visibility = 'visible';
    root.querySelector('.d').innerHTML = lines.map((_, k) => `<span class="${k === idx ? '' : 'dim'}">●</span>`).join('');
    nextEl.textContent = idx >= lines.length - 1 ? '[ENTER] BEGIN ▸' : '[ENTER] NEXT ▸';
    typeT = setInterval(() => {
      i += 1;
      lineEl.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(typeT); typing = false; nextEl.style.visibility = 'visible'; }
    }, 1000 / 55);
  };
  const advance = () => {
    if (!root) return;
    if (typing) {
      clearInterval(typeT); typing = false;
      lineEl.textContent = full; nextEl.style.visibility = 'visible';
      return;
    }
    if (idx >= lines.length - 1) { finish(); return; }
    idx += 1;
    type(lines[idx]);
  };
  function onKey(e) {
    if (!root) return;
    e.stopImmediatePropagation();      // nothing leaks through to the level or the pause handler
    if (e.code === 'Escape') { finish(); return; }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); advance(); }
  }

  const build = () => {
    if (dead) return;
    window.__uiCapture = true;
    document.body.dataset.briefing = 'true';
    if (document.exitPointerLock) document.exitPointerLock();
    root = document.createElement('div');
    root.style.cssText = 'position:fixed;inset:0;z-index:10001;cursor:pointer';
    root.innerHTML = `
      <style>${storyStyle}</style>
      <div class="ch-bars"></div>
      <div class="ch-title">${kicker}${stamp ? ` · ${stamp}` : ''}</div>
      <div class="ch-story">
        <div id="br-line" class="t"></div>
        <div class="f"><span class="d"></span><span id="br-next" class="n"></span></div>
      </div>`;
    document.body.appendChild(root);
    lineEl = root.querySelector('#br-line');
    nextEl = root.querySelector('#br-next');
    root.addEventListener('click', advance);
    window.addEventListener('keydown', onKey, true);
    type(lines[0] || '');
  };

  // Wait for the level card / fade veil to clear before appearing.
  poll = setInterval(() => {
    const shellOn = document.querySelector('.gs-screen.on') || document.querySelector('#gs-veil.on');
    if (!window.__loading && !shellOn) { clearInterval(poll); build(); }
  }, 120);

  return { cancel };
}

export default { showBriefing };
