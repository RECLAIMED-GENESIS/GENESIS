// ============================================================
// stats.js — per-run performance counters that feed the end rank.
// Lives inside window.__caseProgress so it piggybacks on the
// existing save/Continue flow for free. Levels mutate the
// returned object.
// ============================================================

const DEFAULTS = () => ({
  wrongDeductions: 0,   // Level 1: wrong clue-pair submissions
  falsePresentations: 0, // Level 2: evidence shown that proves nothing
  lawyered: 0,          // Level 3: suspects who shut down after 3 futile shows
  broken: 0,            // Level 3: suspects whose composure hit zero
  wastedFilm: 0,        // Level 2: photos with nothing sharp in frame
  trustLost: 0,          // Level 2: captain trust spent on requests the evidence could not support
  contamination: 0,      // Lab: evidence handled bare-handed (gloves required)
  wipes: 0,              // Lab: devices wiped (wrong PINs / remote wipe)
  wrongExclusions: 0,    // Lab: true donor wrongly excluded on the comparison scope
  timeOverrun: 0,        // Lab: dossier signed after the 17:00 shift end
  elapsedMs: 0,         // accumulated play time across levels
  levelStartAt: 0,      // Date.now() when the current level was built
});

export function getStats() {
  window.__caseProgress = window.__caseProgress || { l1: {} };
  const p = window.__caseProgress;
  p.stats = Object.assign(DEFAULTS(), p.stats || {});
  return p.stats;
}

export default { getStats };
