// ============================================================
// cityCast.js — witness testimonies & suspect reactions
// ============================================================
import { SUSPECTS, normId, reaction } from './case.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const BASE_NPCS = [
  {
    id: 'sipho', name: 'Sipho Ndlovu', role: 'Night watchman',
    spot: [-42.2, 0, -15.5],
    sitting: true, sitFace: Math.PI / 2,
    hair: 0x14110f, long: false, bandage: false,
    coat: 0x2e3a2a, pants: 0x1c1e22, skin: 0x7a5641,
    where: '"From ten to midnight I walk the east side. After twelve I sit behind this dome where the wind cannot reach me. I heard nothing. I always hear nothing." — yet he is the only one who was under the dome the whole night.',
    relate: '"The lecturer paid me to look the other way at the back gate. Everybody in this city has a price, and he knew his."',
    react: 'He does not flinch. "I know. Somebody carried it through the gate at half ten and carried it out again at twenty-two to twelve. I did not write the name down." Too calm — and he volunteers a timestamp nobody asked for.',
    follow: [
      {
        req: 'c:gun',
        q: 'The pistol behind your dome.',
        a: '"Yes. Mine. Case-hardened, unregistered — it fires .40. The slug that opened your lecturer was a 9mm, I read that from the cleaner\'s radio. Check the chamber yourself if you do not believe an old watchman. I was paid to guard a dome, not to hunt lecturers."',
        log: 'Sipho\'s pistol is .40 — the office casing was 9mm. The gun is real, the bullet does not match.',
        route: { requestion: 'sipho', hint: 'He knows more than he first said.' },
      },
    ],
  },
  {
    id: 'anele', name: 'Anele Mahlangu', role: 'Department administrator',
    spot: [6.8, 0, 6],
    sitting: true, sitFace: Math.PI / 2,
    hair: 0x4a2c17, long: true, bandage: false,
    coat: 0x53324a, pants: 0x23242a, skin: 0x8a6248,
    where: '"Quarter past nine I was already down at the water. I sell fish on the quay now, I have a licence. The trader beside me can vouch for me — my hands have not touched university paper since half past seven that evening."',
    relate: '"I typed his letters. I locked the Staff Common Room with him — his last message, 23:19, that was after I left. I was the last person to see him whole, and I will carry that whichever way this breaks."',
    react: 'She goes very still and looks down at the water. "I saw the police tape from the bridge." Her voice does not shake; her hands do, on the railing. She asks WHEN, not WHO — innocent people ask who.',
    follow: [
      {
        req: 'l1:hair',
        when: (c) => c.decoyId === 'anele',
        q: 'Brown hair on the guest chair.',
        a: '"Half the women in this department have brown hair. That was my office chair? Check the armrests — I touched nothing but the door handle when we locked up. I did not sit opposite Thabo while he drank. Ask who sat there. Ask whose handkerchief was on the floor beside that chair."',
        log: 'Anele was locked out of the building at 23:19 with the victim — her own account matches his final message. The fish trader confirms it.',
      },
    ],
  },
  {
    id: 'naledi', name: 'Prof. Naledi Dube', role: 'Head of Department',
    spot: [-11.5, 0, 24.2],
    sitting: true, sitFace: Math.PI / 2,
    hair: 0x14110f, long: false, bandage: false,
    coat: 0x30425c, pants: 0x20242c, skin: 0x6f4d3a,
    where: '"Marks board ran late in the faculty until ten. Then I walked to the taxi rank along this road. Alone. There is no receipt for that; there is no CCTV on this street."',
    relate: '"Thabo came to me the day before he died. He said he would report the altered marks to the board. I asked him to wait until after the meeting. He would not. We parted badly at noon, and by midnight he was the only one left who could still speak."',
    react: '"That — that is impossible. I saw him at noon." Her hand flies to her mouth. She checks the road behind her twice in five seconds, and asks: "Is my name on something? Because if it is, I would rather hear it from you than read it."',
    follow: [
      {
        req: 'l1:note',
        q: 'The torn note: three names, one of them lying.',
        a: '"If I had doctored those marks to shelter my nephew, the note would have vanished with Thabo, not survived under a moving box. I did not kill him, detective. I did the second-worst thing — I begged him to keep quiet, and he refused."',
        log: 'Naledi admits she pressured the victim to delay his report — motive without means. Her hands were never near the gun or the chair.',
        route: { witness: 'mandla', hint: 'She names the student who filed the altered marks — he drinks at the taxi bridge.' },
      },
      {
        req: 'c:stub',
        q: 'Parking stub stamped 23:38.',
        a: '"Mine was in the workshop all week — that is why I took the road home. Whatever your stub belongs to, it is not mine. Ask the student body who parked faculty-side after hours."',
      },
    ],
  },
  {
    id: 'kyle', name: 'Kyle Pretorius', role: 'PhD student & tutor',
    spot: [6.85, 0, -2.0],
    leaning: true, face: Math.PI / 2,
    hair: 0x4a2c17, long: true, bandage: false,
    coat: 0x414b3c, pants: 0x22232a, skin: 0x8a6248,
    where: '"Home. Asleep by eleven — I have an eight o\'clock tutorial." He says it too fast, and he has clearly rehearsed it.',
    relate: '"Thabo was my supervisor. He was going to ruin me — I mean — he WAS a good man."',
    react: 'The news lands like a handshake. "I — I see." He repeats it twice. His right hand twitches toward his pocket and stays there.',
    honest: {
      where: '"At the library until it closed, then straight home. The librarian stamps every card, ask her."',
      relate: '"Thabo was my supervisor. A hard marker and a fair man. I tutored scripts for him, I heard the rumours about the marks, and I kept my head down."',
      react: '"Dead?" He sits down on the nearest ledge. "He emailed me about a draft at six. I do not understand."',
    },
    follow: [],
  },
  {
    id: 'mandla', name: 'Mandla Dlamini', role: 'Taxi rank fixer',
    spot: 'random', hair: 0x4a2c17, long: false, bandage: false,
    coat: 0x4c3524, pants: 0x2b2118, skin: 0x5d4436,
    where: '"Ten to three, drinking, in this city, for cash. I saw plenty from the footbridge and I will sell you what I saw."',
    relate: '"The lecturer? Never met him. I know his FACE from the campus gate."',
    react: 'He shrugs, easy as rain. "A lot of men die in October." "But if you want the name of who walked fast down those back stairs, that costs extra."',
    follow: [
      {
        req: 'always',
        q: 'What did you see from the bridge?',
        a: (c) => '"Twenty to twelve, a young person came down the back stairs — dark t-shirt, walking fast."' +
          (c.killerId === 'anele' ? '' : ' And the fish she sold that night? "The lady at the water. My invoice is her alibi."'),
        log: (c) => 'An unrelated witness puts a fast-walking young person on the back stairs at 23:40' +
          (c.killerId === 'anele' ? '.' : ', and independently alibis the woman at the water.'),
      },
      {
        req: 'c:stub',
        q: 'The parking stub, stamped 23:38.',
        a: 'He whistles through his teeth. "Faculty exit stamp. 23:38. Whoever punched that ticket was on that campus while your lecturer was already cooling on his own floor."',
      },
      {
        req: 'c:uvtrail',
        q: 'The kerb scrawl: DEPOT — HE KNOWS.',
        a: '"I know the depot. Half this city knows the depot. But I saw him there once — two weeks back, meeting a woman in the parking bays."',
        log: 'A second witness places the victim at the depot meeting point two weeks before the killing.',
        route: { hint: 'The depot parking bays. 14:00.' },
      },
    ],
  },
];

export const CITY_CLUES = {
  gun: {
    name: 'Unregistered pistol (.40)',
    note: 'A service pistol with the serial filed to scratches, hidden under a tarp behind the glass dome.',
  },
  uvtrail: {
    name: 'UV: bootprints & scrawl',
    note: 'Under the torch: bootprints and scrawled text "DEPOT — HE KNOWS".',
  },
  stub: {
    name: 'Parking exit stub, 23:38',
    note: 'A faculty-garage exit ticket, timestamped 23:38.',
  },
};

export const SPOTS = [
  [-9.5, 0, -6],
  [-8.6, 0, -34],
  [-13.5, 0, 11],
  [4.5, 0, -24],
  [-10.5, 0, -52],
];

export function makeCast(c) {
  return BASE_NPCS.map((base) => {
    const id = normId(base.id);
    const s = SUSPECTS[id];
    const guilty = id === c.killerId;
    const d = { ...base, id };
    d.bandage = guilty;
    d.woundHand = c.woundHand;
    d.guilty = guilty;

    if (id === 'kyle' && !guilty) {
      d.where = base.honest.where;
      d.relate = base.honest.relate;
      d.react = base.honest.react;
    }

    if (!guilty) {
      d.follow = (base.follow || [])
        .filter((f) => !f.when || f.when(c))
        .map((f) => ({
          ...f,
          a: typeof f.a === 'function' ? f.a(c) : f.a,
          log: typeof f.log === 'function' ? f.log(c) : f.log,
        }));
      return d;
    }

    d.where = `"${c.alibi}" ${cap(s.he)} says it too fast, and ${s.he} has clearly rehearsed it.`;
    if (id === 'kyle') {
      d.react = `The news lands like a handshake. "I — I see." His ${c.woundHand} hand, the bandaged one, twitches toward his pocket.`;
    } else {
      d.react = `${base.react} ${cap(s.his)} ${c.woundHand} hand is wrapped in a fresh dressing.`;
    }

    const R = (key) => reaction(id, key, c).text;
    d.follow = [
      {
        req: 'l1:handkerchief',
        q: `Show ${s.him} the handkerchief: ${s.initials}, with dried blood.`,
        a: `${R('handkerchief')} Then comes the excuse: a nail at the garage.`,
        log: `${s.initials} flinched at the monogram. The cut is on the front of the ${c.woundHand} hand.`,
      },
      {
        req: 'always',
        q: `Ask about the dressing on ${s.his} ${c.woundHand} hand.`,
        a: R('look'),
        log: `The dressing was done at the clinic within hours of the killing.`,
      },
      {
        req: 'c:stub',
        q: `Show ${s.him} the parking stub: 23:38.`,
        a: R('stub'),
        log: `${s.name}'s alibi broke at the stub: faculty exit at 23:38.`,
      },
      {
        req: 'l1:hair',
        q: 'The hair fibres on the guest chair.',
        a: R('hair'),
        log: `${s.name} touched ${s.his} hair when the fibres came up.`,
      },
      {
        req: 'l1:casing',
        q: 'The 9mm casing under the bookshelf.',
        a: R('casing'),
        log: `${s.name} would not meet your eye over the 9mm.`,
      },
      {
        req: 'l1:trail',
        q: 'The wiped blood trail.',
        a: R('trail'),
        log: `${s.name} glanced at ${s.his} sleeve cuff.`,
      },
      {
        req: 'c:uvtrail',
        q: 'The UV scrawl: "DEPOT — HE KNOWS".',
        a: R('uvtrail'),
        log: `${s.name} studied the scrawl too long.`,
        route: { spawn: 'stub', where: 'the quay south of the café', hint: 'Check the road by the bollard.' },
      },
    ];
    return d;
  });
}
