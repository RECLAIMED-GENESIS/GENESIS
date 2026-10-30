import './labPresentation.css';

// Keep document/device chrome separate from content: bench actions rebuild the
// content frequently, but the close control and keyboard navigation stay put.
export function installLabPresentation(level) {
  const { ui } = level;
  ui.root.classList.add('lab-hud');
  ui.toast.classList.add('lab-notification');
  document.body.append(ui.toast);
  ui.toast.setAttribute('role', 'status');
  ui.toast.setAttribute('aria-live', 'polite');
  for (const [key, title, close] of [
    ['overlay', 'Evidence file', () => level._closeOverlay()],
    ['device', 'Examination', () => level._closeDevice()],
  ]) {
    const panel = ui[key];
    panel.classList.add('lab-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', title);
    const bar = document.createElement('div');
    bar.className = 'lab-panel-bar';
    const label = document.createElement('span'); label.textContent = title;
    const button = document.createElement('button');
    button.className = 'lab-panel-close'; button.type = 'button';
    button.innerHTML = 'Back to lab <kbd>Esc</kbd>';
    button.addEventListener('click', close);
    bar.append(label, button); panel.prepend(bar);
    panel.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = [...panel.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')]
        .filter(node => !node.disabled && node.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    });
  }
  level._syncLabPresentation = () => {
    document.body.dataset.labPanel = String(level._uiBusy() || !!level._captainTalking);
    ui.prompt.style.display = 'none';
    level.focus = null;
    level._coach?.update(0, level._coach.player);
  };
}
