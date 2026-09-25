// ============================================================
// endings.js — the three Level 3 endings
// Each shows a fade-to-black overlay with text, then offers
// a restart back to Level 1.
// ============================================================

function fadeToBlack(durationMs = 1200) {
  return new Promise((resolve) => {
    let overlay = document.getElementById('endOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'endOverlay';
      Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        background: '#000',
        opacity: '0',
        transition: `opacity ${durationMs}ms ease-in-out`,
        pointerEvents: 'none',
        zIndex: '500',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        color: '#c8e8ff',
        fontFamily: 'Georgia, serif',
        textAlign: 'center',
        padding: '40px',
      });
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    overlay.style.pointerEvents = 'auto';
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      setTimeout(resolve, durationMs + 100);
    });
  });
}

function showEndingText(lines, durationMs = 6000) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('endOverlay');
    if (!overlay) return resolve();

    overlay.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.maxWidth = '640px';
    wrap.style.opacity = '0';
    wrap.style.transition = 'opacity 1.2s';
    wrap.style.fontSize = '1.35rem';
    wrap.style.lineHeight = '1.9';

    lines.forEach((line) => {
      const p = document.createElement('p');
      p.innerText = line;
      p.style.margin = '18px 0';
      wrap.appendChild(p);
    });

    overlay.appendChild(wrap);
    requestAnimationFrame(() => { wrap.style.opacity = '1'; });

    setTimeout(() => {
      wrap.style.opacity = '0';
      setTimeout(resolve, 1400);
    }, durationMs);
  });
}

function showRestartButton() {
  return new Promise((resolve) => {
    const overlay = document.getElementById('endOverlay');
    if (!overlay) return resolve();

    const btn = document.createElement('button');
    btn.innerText = 'RESTART';
    Object.assign(btn.style, {
      marginTop: '40px',
      background: 'transparent',
      color: '#8fd0ff',
      border: '1px solid #8fd0ff',
      borderRadius: '4px',
      padding: '14px 40px',
      fontSize: '1rem',
      fontFamily: 'Georgia, serif',
      letterSpacing: '4px',
      cursor: 'pointer',
      opacity: '0',
      transition: 'opacity 0.8s, background 0.2s',
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(80,180,255,0.15)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
    });
    btn.addEventListener('click', () => {
      // Reload the page to restart from Level 1
      window.location.reload();
    });
    overlay.appendChild(btn);
    requestAnimationFrame(() => { btn.style.opacity = '1'; });
  });
}

function clearOverlay() {
  const overlay = document.getElementById('endOverlay');
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
}

// ─────────────────────────────────────────────────────────────
// ENDING 1 — Attack
// Player tries to attack the Architect. White flash, then black.
// ─────────────────────────────────────────────────────────────
export async function endingAttack() {
  // White flash
  const flash = document.createElement('div');
  Object.assign(flash.style, {
    position: 'fixed',
    inset: '0',
    background: '#ffffff',
    opacity: '1',
    zIndex: '600',
    pointerEvents: 'none',
    transition: 'opacity 0.6s',
  });
  document.body.appendChild(flash);
  requestAnimationFrame(() => { flash.style.opacity = '0'; });
  setTimeout(() => flash.remove(), 800);

  await new Promise((r) => setTimeout(r, 600));

  await fadeToBlack(1400);
  await showEndingText([
    'The Architect does not resist.',
    'He only smiles — the same patient, knowing smile he wore the day he made you.',
    'The blade stops an inch from his throat.',
    'It is not courage that holds your hand. It is the question you cannot answer:',
    '"What if he was right?"',
  ], 8000);

  await showEndingText([
    'The Architect\'s final words are lost to the void.',
    'The GENESIS device hums somewhere far below, still waiting.',
  ], 6000);

  await showRestartButton();
}

// ─────────────────────────────────────────────────────────────
// ENDING 2 — Learn (with a final destroy/become choice)
// ─────────────────────────────────────────────────────────────
export async function endingLearn(dialogue) {
  await fadeToBlack(1400);

  await showEndingText([
    '"GENESIS is not a weapon," the Architect says.',
    '"It is a seed. Every world it touches learns to want more than it has.',
    'The village. The city. The moon. It has already begun."',
  ], 8000);

  await showEndingText([
    '"You are the first of them, Sorini. The prototype that survived."',
  ], 4000);

  // Final choice — destroy or become
  dialogue.container.style.zIndex = '700';
  dialogue.container.style.display = 'block';
  dialogue.textEl.style.opacity = '1';
  dialogue.textEl.innerText = 'What do you choose?';
  dialogue.choicesEl.innerHTML = '';

  const choice = await new Promise((resolve) => {
    const choices = [
      'Destroy GENESIS.',
      'Become the next Architect.',
    ];
    choices.forEach((label, i) => {
      const btn = document.createElement('button');
      btn.innerText = `${i + 1}.  ${label}`;
      Object.assign(btn.style, {
        background: 'rgba(20,40,60,0.85)',
        color: '#c8e8ff',
        border: '1px solid #4a9eff',
        borderRadius: '4px',
        padding: '10px 24px',
        fontSize: '1rem',
        fontFamily: 'Georgia, serif',
        cursor: 'pointer',
        minWidth: '320px',
        marginTop: '12px',
      });
      btn.addEventListener('click', () => resolve(i));
      dialogue.choicesEl.appendChild(btn);
    });
  });

  dialogue.hide();
  dialogue.container.style.zIndex = '200';

  if (choice === 0) {
    // Destroy GENESIS
    await showEndingText([
      'You raise your hand. The GENESIS core tears itself apart from within.',
      'The Architect closes his eyes.',
      '"I always wondered which of you would choose this," he says.',
      '"I am glad it was you."',
      '',
      'The moon is silent again. The signal is dead.',
      'Somewhere on Earth, a thousand people wake up missing something they never knew they had.',
    ], 12000);
    await showEndingText([
      'GENESIS: DESTROYED.',
    ], 4000);
  } else {
    // Become the Architect
    await showEndingText([
      'You step forward. You sit beside him.',
      'The Architect rests a hand on your shoulder — the first time he has ever touched you.',
      '"You will do better than I did," he says.',
      'His eyes dim. He does not breathe again.',
      '',
      'You look out across the lunar plain.',
      'Somewhere on Earth, someone is picking up a weapon against you.',
      'They do not know yet. They will learn.',
    ], 13000);
    await showEndingText([
      'GENESIS: ASCENDANT.',
    ], 4000);
  }

  await showRestartButton();
}

// ─────────────────────────────────────────────────────────────
// ENDING 3 — Silence
// Player says nothing. The Architect accepts and leaves.
// ─────────────────────────────────────────────────────────────
export async function endingSilence() {
  await new Promise((r) => setTimeout(r, 1500));

  await fadeToBlack(1600);

  await showEndingText([
    '"I understand," the Architect says quietly.',
    'He stands. He is not tall. He is not imposing. He is only tired.',
    'He walks past you — close enough that you could touch him.',
    'Neither of you does.',
  ], 9000);

  await showEndingText([
    'A door you did not see opens in the back of the throne room.',
    'He steps through. The door closes behind him.',
    '',
    'You are alone in the monument.',
    'The throne is empty. The Architect is gone.',
    'The GENESIS device is still running.',
  ], 11000);

  await showEndingText([
    'The Architect is gone. GENESIS remains.',
  ], 5000);

  await showRestartButton();
}