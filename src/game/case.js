// ============================================================
// case.js — randomized procedural case generator & story helpers
// ============================================================
import { normEvId } from './investigation.js';

export const SUSPECTS = {
  sipho:  { id: 'sipho',  name: 'Sipho Ndlovu',     role: 'Night watchman',          he: 'he',  him: 'him', his: 'his', initials: 'S.N.', hairName: 'black', hairLong: false, gun: '.40',
            motives: ['gate'], secret: 'opened the back gate for money' },
  anele:  { id: 'anele',  name: 'Anele Mahlangu',   role: 'Department administrator', he: 'she', him: 'her', his: 'her', initials: 'A.M.', hairName: 'brown', hairLong: true,  gun: null,
            motives: ['ledger', 'marks'], secret: 'was moving a stolen ledger on the quay' },
  naledi: { id: 'naledi', name: 'Prof. Naledi Dube', role: 'Head of Department',      he: 'she', him: 'her', his: 'her', initials: 'N.D.', hairName: 'black', hairLong: false, gun: null,
            motives: ['marks', 'nephew'], secret: 'pressured the victim to delay his report on the altered marks' },
  kyle:   { id: 'kyle',   name: 'Kyle Pretorius',   role: 'PhD student & tutor',     he: 'he',  him: 'him', his: 'his', initials: 'K.P.', hairName: 'brown', hairLong: true,  gun: null,
            motives: ['marks', 'contract'], secret: 'tutored the scripts that were altered' },
  mandla: { id: 'mandla', name: 'Mandla Dlamini',   role: 'Taxi rank fixer',         he: 'he',  him: 'him', his: 'his', initials: 'M.D.', hairName: 'brown', hairLong: false, gun: null,
            motives: ['debt'], secret: 'sells what he sees from the footbridge, and sold it twice' },
};

export const IDS = Object.keys(SUSPECTS);
export const normId = (id) => (id === 'anale' ? 'anele' : (id || ''));

export const MOTIVES = {
  marks:    (v) => `Dr. Nkosi was about to report the altered exam marks, and that memo would have ended ${v.his} career.`,
  contract: (v) => `${v.name} was one signature away from losing ${v.his} funding, and the supervisor holding the pen was about to withdraw it.`,
  ledger:   (v) => `The lecturer had seen ${v.name} with the missing departmental ledger and meant to say so.`,
  nephew:   (v) => `${v.name} had altered the marks to shelter a relative, and the lecturer would not stay quiet.`,
  gate:     (v) => `${v.name} had been paid to leave the back gate open, and Nkosi was going to expose who paid.`,
  debt:     (v) => `${v.name} owed the wrong people money, and the lecturer's depot meeting would have exposed the debt.`,
};

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

export function generateCase(seed = (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0, opts = {}) {
  const rng = makeRng(seed);

  const depotBays = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10'];
  const depotCars = [
    { color: 0x1e2a44, style: 'sedan' },
    { color: 0x6a1f22, style: 'pickup' },
    { color: 0x2e3a2a, style: 'hatch' },
    { color: 0x3a3f45, style: 'van' },
  ];

  let killerId = opts.forceKiller && SUSPECTS[opts.forceKiller] ? opts.forceKiller : pick(rng, IDS);
  if (!opts.forceKiller && opts.avoid === killerId) killerId = pick(rng, IDS.filter((i) => i !== opts.avoid));

  const k = SUSPECTS[killerId];
  const motive = pick(rng, k.motives);

  const others = IDS.filter((i) => i !== killerId);
  const sameHair = others.filter((i) => SUSPECTS[i].hairName === k.hairName && SUSPECTS[i].hairLong === k.hairLong);
  const decoyId = sameHair.length ? pick(rng, sameHair) : pick(rng, others);

  const gun = killerId === 'sipho' ? '9mm' : '.40';
  const woundHand = pick(rng, ['right', 'left']);

  const alibi = pick(rng, [
    'Home and asleep by eleven.',
    'At the library until it closed, then straight home.',
    'Walking the east side of the city the whole night.',
    'At a friend\'s flat watching the match.',
  ]);

  return {
    seed,
    killerId,
    motive,
    decoyId,
    gun,
    woundHand,
    alibi,
    proofKeys: ['handkerchief', 'stub', 'look'],
    proofNeeded: 2,
    version: 2,
    stakeout: {
      depotName: 'Dockside Depot 4',
      bay: pick(rng, depotBays),
      car: pick(rng, depotCars),
      carried: pick(rng, ['a flat metal case', 'a courier bag', 'a sealed evidence box']),
      arrivalFrom: rng() < 0.5 ? 'north' : 'south',
    },
  };
}

export function getCase() {
  if (typeof window === 'undefined') return generateCase();
  const prog = (window.__caseProgress = window.__caseProgress || { l1: {} });
  if (prog.case && prog.case.version === 2 && SUSPECTS[prog.case.killerId]) return prog.case;

  let avoid = null;
  try { avoid = localStorage.getItem('genesis.lastKiller'); } catch (e) {}

  const forced = new URLSearchParams(location.search).get('killer');
  prog.case = generateCase(undefined, { avoid, forceKiller: forced });
  try { localStorage.setItem('genesis.lastKiller', prog.case.killerId); } catch (e) {}
  return prog.case;
}

export const killerOf = (c = getCase()) => SUSPECTS[c.killerId];
export const isKiller = (id, c = getCase()) => normId(id) === c.killerId;

export function level1Clues(c = getCase()) {
  const k = killerOf(c);
  return {
    hair: {
      name: `${cap(k.hairName)} hair fibres (guest chair)`,
      note: 'A few strands caught in the chair. Easy to miss. I wonder whether the microscope will give me something to work with.',
    },
    handkerchief: {
      name: 'Monogrammed handkerchief',
      note: 'There is a stain on this cloth, and some stitching in the corner. Hmm. I will need a closer look back at the lab.',
    },
    trail: {
      name: 'Wiped blood trail (UV)',
      note: 'Something shows up under the UV light. Let me photograph it as it is. I wonder what I will make of it at the lab.',
    },
    casing: {
      name: 'Bullet casing',
      note: 'Hmm, a casing. This could be useful. I will bag it carefully and see what the lab can tell me.',
    },
  };
}

export function applyCaseToStory(CASE, c = getCase()) {
  const gen = level1Clues(c);
  for (const key of Object.keys(gen)) CASE.clues[key] = Object.assign({}, CASE.clues[key], gen[key]);
  const guest = (CASE.deductions || []).find((d) => d.id === 'guest');
  if (guest) {
    guest.answer = level1GuestAnswer(c);
    // The monogram is blood-soaked: it takes the scrawled first letter (UV trail) to read the whole name.
    guest.needs = ['hair', 'handkerchief', 'trail'];
  }
  return CASE;
}

export function level1GuestAnswer(c = getCase()) {
  const k = killerOf(c);
  const len = k.hairLong ? 'long' : 'short';
  return `Someone with ${len} ${k.hairName} hair, close enough to the muzzle to be spattered with blood that was not the victim's — and carrying monogrammed linen: "${k.initials}"`;
}

export function reaction(id, clueKey, c = getCase(), overrides = {}) {
  id = normId(id);
  clueKey = normEvId(clueKey);
  const o = overrides[id] && overrides[id][clueKey];
  if (o) return o;

  const s = SUSPECTS[id];
  const k = killerOf(c);
  const guilty = id === c.killerId;
  const hairMatch = s.hairName === k.hairName && s.hairLong === k.hairLong;

  switch (clueKey) {
    case 'handkerchief':
      return guilty
        ? R('strong', `${s.name} reads the monogram and the colour leaves ${s.his} face. "Anyone could have ${s.initials} stitched on a handkerchief." Then ${s.he} looks at ${s.his} own ${c.woundHand} hand.`)
        : R('clear', `"${k.initials}" ${s.he === 'she' ? 'She' : 'He'} shakes ${s.his} head. "I am ${s.initials} — that cloth is not mine."`);
    case 'hair':
      if (guilty) return R('partial', `${s.name} touches ${s.his} own hair before ${s.he} can stop. "Half this building has ${k.hairName} hair," ${s.he} says.`);
      return hairMatch
        ? R('partial', `The same ${s.hairName} hair as the fibres. "Half this building has it. Ask who sat in that chair." ${cap(s.he)} does not blink.`)
        : R('clear', `"Mine is ${s.hairLong ? 'long' : 'short'} and ${s.hairName}. Those fibres are ${k.hairLong ? 'long' : 'short'} and ${k.hairName}." That is not ${s.him}.`);
    case 'stub':
      return guilty
        ? R('strong', `"Faculty exit. 23:38." ${s.name} says it back like a line ${s.he} no longer believes. "I told you: ${c.alibi.charAt(0).toLowerCase() + c.alibi.slice(1)}"`)
        : R('clear', `${s.name} has an answer for the garage ticket and it checks out: ${s.he === 'she' ? 'she' : 'he'} was nowhere near the faculty exit at 23:38.`);
    case 'look':
      return guilty
        ? R('strong', `The ${c.woundHand} hand is freshly dressed, the skin sealed with clinic glue. A cut on the front of the hand does not come from a nail.`)
        : R('none', `${s.name}'s hands are steady and unmarked.`);
    case 'gun':
    case 'casing': {
      const owns = s.gun;
      if (clueKey === 'gun' && guilty && owns) {
        return R('partial', `"Mine, and it fires ${owns}. Your slug was a nine." ${s.name} says it a little too smoothly.`);
      }
      if (guilty) return R('partial', `"Nine millimetre." ${s.name} will not meet your eye.`);
      return owns
        ? R('clear', `"Mine is a ${owns}. The slug in your lecturer was a nine." ${cap(s.he)} holds your eye.`)
        : R('clear', `"I have never held a gun." ${cap(s.his)} hands do not move.`);
    }
    case 'trail':
      return guilty
        ? R('partial', `${s.name} glances at ${s.his} sleeve cuff, then away. "A smear on a floor. I was not there."`)
        : R('none', `${s.name} looks at the sketch of the trail and shrugs.`);
    case 'phone':
    case 'note':
    case 'uvtrail':
      return guilty
        ? R('partial', `${s.name} studies it a little too long. "Anyone could have written that."`)
        : R('none', `${s.name} frowns. "That does not tell you anything about me."`);
    default:
      return R('none', `${s.name} says nothing useful.`);
  }
}

export function breakdown(id, c = getCase()) {
  id = normId(id);
  const s = SUSPECTS[id];
  if (id === c.killerId) {
    return `The last wall comes down. ${MOTIVES[c.motive](s)} "It was one second," ${s.he} says. "One second and a noise like a book slamming."`;
  }
  return `${s.name} finally breaks. "I ${s.secret}. Charge me with that if you want. I never climbed those stairs."`;
}

export function routeFor(id, spots, c = getCase(), seedOffset = 0) {
  id = normId(id);
  const rng = makeRng((c.seed + seedOffset + id.length * 7919) >>> 0);
  const guilty = id === c.killerId;
  const n = guilty ? 4 : 2;
  const pts = [];
  const pool = spots.slice();
  for (let i = 0; i < n && pool.length; i++) {
    const j = Math.floor(rng() * pool.length);
    pts.push({ x: pool[j].x, z: pool[j].z });
    pool.splice(j, 1);
  }
  return {
    points: pts,
    dwell: guilty ? 14 + rng() * 8 : 40 + rng() * 20,
    evades: guilty,
    evadeAfter: 3.5,
  };
}

export function grade(accusedId, presentedKeysOfKiller, picks, c = getCase()) {
  accusedId = normId(accusedId);
  const killerPicked = picks.map(normId).includes(c.killerId);
  const proof = c.proofKeys.filter((k) => presentedKeysOfKiller[k]).length;
  if (accusedId === c.killerId && proof >= c.proofNeeded) return 'closed';
  if (accusedId === c.killerId) return 'unproven';
  return killerPicked ? 'walked' : 'missing';
}

function R(tag, text) { return { tag, text }; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
