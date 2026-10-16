// ============================================================
// briefing.js — typed radio/dispatch briefing shown at the start of a level.
// Waits for the level card to clear, freezes the player (window.__uiCapture),
// types each line, and hands the mouse back on dismiss.
//   Space / Enter / click = next (finishes typing first)   Esc = skip all
// ============================================================
export function showBriefing({ kicker = 'DISPATCH', stamp = '', speaker = '', lines = [], accent = '#f2b84b', onDone } = {}) {
  let dead = false, root = null, poll = 0, typeT = 0;
  let idx = 0, typing = false, full = '';
  let lineEl = null, nextEl = null;

  const teardown = () => {
    dead = true;
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
    try {
      const cv = document.querySelector('body > canvas');
      if (cv && cv.requestPointerLock) {
        const p = cv.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) { /* needs a user gesture; the click-to-capture prompt covers it */ }
    if (onDone) onDone();
  };
  const type = (text) => {
    clearInterval(typeT);
    full = text; typing = true;
    let i = 0;
    lineEl.textContent = '';
    nextEl.style.visibility = 'hidden';
    nextEl.textContent = idx >= lines.length - 1 ? '[ Space ] to work' : '[ Space ] continue';
    typeT = setInterval(() => {
      i += 1;
      lineEl.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(typeT); typing = false; nextEl.style.visibility = 'visible'; }
    }, 22);
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
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); advance(); }
  }

  const build = () => {
    if (dead) return;
    window.__uiCapture = true;
    if (document.exitPointerLock) document.exitPointerLock();
    root = document.createElement('div');
    root.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;flex-direction:column;justify-content:flex-end;' +
      'background:linear-gradient(180deg,rgba(2,3,6,.45) 0%,rgba(2,3,6,.9) 62%,#020306 100%);' +
      'font-family:"Courier Prime","Courier New",monospace;color:#e9d9b0;cursor:pointer';
    root.innerHTML = `
      <style>@keyframes brBlink{50%{opacity:0}} @keyframes brIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}</style>
      <div style="padding:0 6vw 7vh;max-width:860px;animation:brIn .6s ease both">
        <div style="display:flex;gap:14px;align-items:baseline;margin-bottom:10px">
          <b style="letter-spacing:4px;color:${accent};font-size:13px">${kicker}</b>
          <span style="opacity:.55;font-size:12px;letter-spacing:2px">${stamp}</span>
        </div>
        ${speaker ? `<div style="opacity:.7;font-size:12px;letter-spacing:2px;margin-bottom:8px">${speaker}</div>` : ''}
        <p id="br-line" style="font-size:19px;line-height:1.65;min-height:5.2em;margin:0 0 16px"></p>
        <div style="display:flex;justify-content:space-between;font-size:12px;opacity:.7">
          <span id="br-next" style="animation:brBlink 1.2s steps(2) infinite"></span>
          <span>[ Esc ] skip</span>
        </div>
      </div>`;
    document.body.appendChild(root);
    lineEl = root.querySelector('#br-line');
    nextEl = root.querySelector('#br-next');
    root.addEventListener('click', advance);
    window.addEventListener('keydown', onKey, true);
    type(lines[0] || '');
  };

  // Wait for the level card / fade veil to clear before appearing.
  let waited = 0;
  poll = setInterval(() => {
    waited += 120;
    const shellOn = document.querySelector('.gs-screen.on') || document.querySelector('#gs-veil.on');
    if (!shellOn || waited > 15000) { clearInterval(poll); build(); }
  }, 120);

  return { cancel };
}

export default { showBriefing };
