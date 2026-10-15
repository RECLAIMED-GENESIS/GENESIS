// ============================================================
// investigation.js — Level 2 & 3 state logic & evidence mechanics
// ============================================================
import { SUSPECTS, IDS, normId, getCase } from './case.js';

export const TRUST_START = 3;
export const STAKEOUT_TIME = '14:00';
export const WARRANT_SCORE = 2.0;

export const normEvId = (id) => (id || '').replace(/^(l1|l2|c):/, '');
export { normId };   // re-exported so board UI can share case.js identity rules

export function evidenceLinks(c = getCase()) {
  const K = c.killerId;
  const D = c.decoyId;
  const L = (who, kind, strength) => ({ who: normId(who), kind, strength });

  return {
    handkerchief: [L(K, 'opportunity', 'weak')],
    hair:         [L(K, 'opportunity', 'weak'), L(D, 'opportunity', 'weak')],
    trail:        [L(K, 'opportunity', 'weak')],
    casing:       [L(K, 'means', 'weak')],
    note:         IDS.filter((i) => SUSPECTS[i].motives.includes('marks')).map((i) => L(i, 'motive', 'weak')),
    decoyItem:    [L(D, 'opportunity', 'weak')],
    stub:         [L(K, 'opportunity', 'weak')],
    uvtrail:      [L(K, 'motive', 'weak')],
    gun:          K === 'sipho' ? [L('sipho', 'means', 'weak')] : [],
    photoArrival: [L(K, 'opportunity', 'strong')],
    photoCarry:   [L(K, 'motive', 'strong')],
    photoWound:   [L(K, 'means', 'strong')],
  };
}

export function clears(c = getCase()) {
  return { gun: c.killerId === 'sipho' ? [] : ['sipho'] };
}

export function isCleared(suspectId, board, c = getCase()) {
  suspectId = normId(suspectId);
  const cl = clears(c);
  const rawList = Array.isArray(board) ? board : (board && board[suspectId] ? board[suspectId] : []);
  for (const rawId of rawList) {
    const id = normEvId(rawId);
    if ((cl[id] || []).includes(suspectId)) return true;
  }
  return false;
}

export function tryLink(evidenceId, suspectId, c = getCase()) {
  suspectId = normId(suspectId);
  evidenceId = normEvId(evidenceId);
  const hit = (evidenceLinks(c)[evidenceId] || []).find((l) => normId(l.who) === suspectId);
  if (!hit) return { ok: false };
  return { ok: true, kind: hit.kind, strength: hit.strength };
}

export function strength(suspectId, board, c = getCase()) {
  suspectId = normId(suspectId);
  const list = Array.isArray(board) ? board : (board && board[suspectId] ? board[suspectId] : []);
  const all = evidenceLinks(c);
  const byKind = { means: 0, motive: 0, opportunity: 0 };
  let strong = 0;

  for (const rawId of list) {
    const id = normEvId(rawId);
    for (const l of all[id] || []) {
      if (normId(l.who) !== suspectId) continue;
      const v = l.strength === 'strong' ? 1 : 0.5;
      if (v > byKind[l.kind]) byKind[l.kind] = v;
      if (l.strength === 'strong') strong++;
    }
  }
  const kinds = Object.keys(byKind).filter((k) => byKind[k] > 0);
  const score = byKind.means + byKind.motive + byKind.opportunity;
  return { kinds, score, strong, byKind };
}

export function captainDecision(suspectId, board, c = getCase()) {
  const s = strength(suspectId, board, c);
  if (s.kinds.length >= 2 && s.strong >= 1 && s.score >= WARRANT_SCORE) return { level: 'warrant', ...s };
  if (s.kinds.length >= 3 && s.score >= 1.5) return { level: 'warrant', ...s };
  if (s.score >= 0.5) return { level: 'questioning', ...s };
  return { level: 'none', ...s };
}

export function missing(suspectId, board, c = getCase()) {
  const s = strength(suspectId, board, c);
  const need = ['means', 'motive', 'opportunity'].filter((k) => !s.byKind[k]);
  return { kinds: need, needStrong: s.strong < 1, needScore: s.score < WARRANT_SCORE };
}

export function request(state, suspectId, ask, board, c = getCase()) {
  const d = captainDecision(suspectId, board, c);
  const rank = { none: 0, questioning: 1, warrant: 2 };
  const id = normId(suspectId);
  const next = { ...state, trust: state.trust, held: state.held.slice(), warrants: state.warrants.slice() };

  if (rank[d.level] === 0) {
    next.trust = Math.max(0, state.trust - 1);
    return { granted: false, partial: false, got: 'none', state: next, reassigned: next.trust === 0 };
  }

  if (rank[d.level] >= rank[ask]) {
    if (ask === 'warrant' && !next.warrants.includes(id)) next.warrants.push(id);
    if (!next.held.includes(id)) next.held.push(id);
    return { granted: true, partial: false, got: d.level, state: next, reassigned: false };
  }

  if (!next.held.includes(id)) next.held.push(id);
  return { granted: false, partial: true, got: d.level, state: next, reassigned: false };
}

export const newState = () => ({
  trust: TRUST_START,
  held: [],
  warrants: [],
  board: {},
  photos: [],
});

const FIXED = { '23:19': 'campus', '23:31': 'campus', '23:38': 'garage', '23:40': 'stairs' };

const HONEST = {
  sipho:  { '22:00': 'street', '23:38': 'dome',   '00:30': 'dome' },
  anele:  { '21:15': 'quay',   '23:38': 'quay',   '00:30': 'quay' },
  naledi: { '22:00': 'campus', '23:38': 'road',   '00:30': 'taxi' },
  kyle:   { '22:30': 'library','23:38': 'library','00:30': 'home' },
  mandla: { '22:50': 'bridge', '23:38': 'bridge', '00:30': 'bridge' },
};

const ALIBI_PLACE = [
  [/home and asleep/i, 'home'], [/library/i, 'library'],
  [/walking/i, 'street'],       [/friend/i, 'flat'],
];
const placeOf = (text) => (ALIBI_PLACE.find(([re]) => re.test(text)) || [0, 'home'])[1];

export function timeline(suspectId, c = getCase()) {
  suspectId = normId(suspectId);
  const claim = Object.assign({}, HONEST[suspectId]);
  let truth = Object.assign({}, HONEST[suspectId]);
  if (suspectId === c.killerId) {
    claim['23:38'] = placeOf(c.alibi);
    claim['00:30'] = 'home';
    claim[STAKEOUT_TIME] = 'home';
    truth = Object.assign({}, truth, FIXED, { '00:30': 'clinic', [STAKEOUT_TIME]: 'depot' });
  }
  return { claim, truth };
}

export function factsFrom(board, c = getCase()) {
  const f = [];
  const has = (id) => {
    if (!board) return false;
    if (Array.isArray(board)) return board.some(x => normEvId(x) === id);
    if (typeof board === 'object') {
      return Object.values(board).some(arr => Array.isArray(arr) && arr.some(x => normEvId(x) === id));
    }
    return false;
  };
  if (has('stub'))         f.push({ who: c.killerId, t: '23:38', place: 'garage' });
  if (has('photoArrival')) f.push({ who: c.killerId, t: STAKEOUT_TIME, place: 'depot' });
  if (has('photoWound'))   f.push({ who: c.killerId, t: '00:30', place: 'clinic' });
  return f;
}

export function contradictions(suspectId, board, c = getCase()) {
  suspectId = normId(suspectId);
  const { claim } = timeline(suspectId, c);
  return factsFrom(board, c)
    .filter((x) => normId(x.who) === suspectId && claim[x.t] && claim[x.t] !== x.place)
    .map((x) => ({ t: x.t, claimed: claim[x.t], actual: x.place }));
}

export function stakeoutEvidence(shots, spooked) {
  const out = new Set();
  const map = { arrival: 'photoArrival', carry: 'photoCarry', wound: 'photoWound' };
  for (const s of shots) {
    if (s.subject !== 'killer') continue;
    if (spooked && !s.early) continue;
    if (map[s.phase]) out.add(map[s.phase]);
  }
  return [...out];
}

export const newBoard = () => ({});

export function boardHas(board, suspectId, evidenceId) {
  suspectId = normId(suspectId);
  evidenceId = normEvId(evidenceId);
  return (board[suspectId] || []).map(normEvId).includes(evidenceId);
}

export function boardLink(board, suspectId, evidenceId, c = getCase()) {
  suspectId = normId(suspectId);
  evidenceId = normEvId(evidenceId);
  const r = tryLink(evidenceId, suspectId, c);
  if (!r.ok) return false;
  const cur = board[suspectId] || (board[suspectId] = []);
  if (!cur.includes(evidenceId)) cur.push(evidenceId);
  return true;
}

export function boardSummary(board, c = getCase()) {
  const out = {};
  for (const id of IDS) out[id] = strength(id, board[id] || [], c);
  return out;
}

export function boardSerialize(board) {
  const out = {};
  for (const k of Object.keys(board)) out[k] = board[k].slice();
  return out;
}
