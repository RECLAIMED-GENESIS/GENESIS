// case.js
// Every clue, suspect and answer of The Last Order lives here.
// Story text only ever changes in this file, never in level code.
// Person A owns the Level 1 entries. B and C fill in their own sections.

export const CASE_TITLE = 'THE LAST ORDER';

// ---- Level 1: Haru's house ------------------------------------------------
export const CLUES = {
  clock: {
    level: 1,
    name: 'The Stopped Clock',
    question: 'When did he die?',
    detail: 'The wall clock died at 6:10 PM. Whatever happened in this room, happened at dusk.',
    file: 'The clock in the main room was stopped at 6:10. The mechanism is intact — it was stopped by hand, or by the fall. Time of death: dusk, 6:10.',
  },
  slip: {
    level: 1,
    name: 'The Delivery Slip',
    question: 'Was he alive after the argument?',
    detail: 'A bean delivery signed by Haru himself at 5:40. He was alive after the first visitor left.',
    file: 'The slip is signed in Haru\'s hand: 5:40 PM. He took a delivery less than half an hour before he died. The first visitor\'s argument did not kill him.',
  },
  cups: {
    level: 1,
    name: 'Two Cups',
    question: 'Was the killer a stranger?',
    detail: 'Haru poured coffee for a guest he expected. One cup was never touched. The bean bag carries the Ember Café seal of Neon Street.',
    file: 'Two cups on the low table, one untouched. Haru served his killer and sat down with them. The bean bag bears the Ember Café seal — a café in Neon Street. His weekly order.',
  },
  canePrints: {
    level: 1,
    name: 'The Old Prints',
    question: 'Who came first?',
    detail: 'Dried, scuffed three-toed prints with cane tip marks. An earlier visitor who limps.',
    file: 'Three-toed prints, dried and scuffed, each with the dot of a cane tip beside it. An off-world visitor who limps came through the hall earlier that day.',
  },
  coffeePrints: {
    level: 1,
    name: 'The Fresh Prints',
    question: 'Who came later?',
    detail: 'Narrow three-toed prints dusted with coffee grounds. An even stride, no cane.',
    file: 'A second set of prints, still fresh, dusted with ground coffee. An even stride and no cane — a later visitor who works with coffee. They walked from the table to the study corner, and to the back door.',
  },
  compartment: {
    level: 1,
    name: 'The Hidden Compartment',
    question: 'How was the shard taken?',
    detail: 'A hollow under the tatami, opened without force. The shard is gone. Haru opened it for someone he trusted.',
    file: 'Under a loose tatami mat: a hidden compartment, pried open without a mark of force. The Bureau shard Haru kept from his service is gone. He opened it himself, for someone he trusted.',
  },

  // ---- Level 2: Neon Street (B fills in) ----------------------------------
  // valeAlibi / dexStatement / noriStatement / gateLog / permitPlate

  // ---- Level 3: accusation (C fills in) -----------------------------------
};

export const SUSPECTS = {
  // B fills in: vale, dex, nori — statements, guilt hooks and innocent truths.
};

export function cluesForLevel(n) {
  return Object.keys(CLUES).filter((id) => CLUES[id].level === n);
}

