import './gameUI.css';

// Shared presentation; levels retain their own controls and visibility state.
export function styleLevelUI(level, number) {
  document.body.dataset.level = String(number);
  const ui = level.ui || {};
  for (const node of Object.values(ui)) {
    if (node instanceof HTMLElement && node.tagName !== 'STYLE') node.classList.add('game-layer');
  }
  const roles = {
    timer: 'timer', counter: 'status', objective: 'subtitle', quest: 'objective',
    prompt: 'prompt', toast: 'toast', carry: 'carry', hint: 'controls',
    overlay: 'file', overlayInner: 'sheet', device: 'modal', captain: 'modal',
    captainInner: 'dialogue', case: 'modal', outro: 'modal', recon: 'modal',
    hud: 'status', end: 'modal',
  };
  for (const [key, role] of Object.entries(roles)) ui[key]?.classList.add(`game-${role}`);
  if (ui.toast) { ui.toast.setAttribute('role', 'status'); ui.toast.setAttribute('aria-live', 'polite'); }
  if (ui.prompt) ui.prompt.setAttribute('role', 'status');
  for (const key of ['bars', 'title', 'box']) level.story?.[key]?.classList.add('game-layer');
}
