// ============================================================
// LEVEL 2 — THE CITY   (first-person interrogation)
//
// The investigator follows the desk-calendar lead into the city.
// Five people around the waterfront street know something about
// the night Dr. Nkosi died. Question all five (E while looking at
// them), sweep the scene with the UV torch (F), keep the Level 1
// case file open to re-read it (C), collect three city clues, then
// compile the suspect list — the wrong three lose the level.
//
// This module wraps the legacy Level2.js street scene (it adds no
// buildings) and drives the first-person camera itself, exactly
// like Level 1 does. The player is a pure camera: no body.
//
// Difficulty above Level 1:
//   * shorter examine reach (3.0 vs 3.6), no permanent glow markers
//   * two witnesses stand at random spots every run
//   * one key piece of evidence is UV-only
//   * testimonies contradict each other and the Level 1 evidence
//   * a wrong suspect list sends you back to the start of Level 2
// ============================================================
import * as THREE from 'three';
import { Level2 } from './Level2.js';
import { CASE } from './lvl1.js';

const EYE = 1.7;
const REACH = 3.0;
const CORRECT_SUSPECTS = ['kyle', 'sipho', 'naledi'];

// small canvas-texture helper (same idea as Level 1's)
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------
// CITY CASE DATA — the five witnesses and their testimonies
// hair: colour of the visible hair cap; long adds a back panel
// spot: fixed Vector3, or 'random' (picked from SPOTS each run)
// ------------------------------------------------------------
const NPCS = [
  {
    id: 'sipho', name: 'Sipho Ndlovu', role: 'Night watchman',
    spot: new THREE.Vector3(-42.2, 0, -15.5),          // behind the glass dome
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
      },
    ],
  },
  {
    id: 'anale', name: 'Anele Mahlangu', role: 'Department administrator',
    spot: new THREE.Vector3(6.8, 0, 6),                // beside the water
    hair: 0x4a2c17, long: true, bandage: false,
    coat: 0x53324a, pants: 0x23242a, skin: 0x8a6248,
    where: '"Quarter past nine I was already down at the water. I sell fish on the quay now, I have a licence. The trader beside me can vouch for me — my hands have not touched university paper since half past seven that evening."',
    relate: '"I typed his letters. I locked the Staff Common Room with him — his last message, 23:19, that was after I left. I was the last person to see him whole, and I will carry that whichever way this breaks."',
    react: 'She goes very still and looks down at the water. "I saw the police tape from the bridge." Her voice does not shake; her hands do, on the railing. She asks WHEN, not WHO — innocent people ask who.',
    follow: [
      {
        req: 'l1:hair',
        q: 'Brown hair on the guest chair.',
        a: '"Half the women in this department have brown hair. That was my office chair? Check the armrests — I touched nothing but the door handle when we locked up. I did not sit opposite Thabo while he drank. Ask who sat there. Ask whose handkerchief was on the floor beside that chair."',
        log: 'Anele was locked out of the building at 23:19 with the victim — her own account matches his final message. The fish trader confirms it.',
      },
    ],
  },
  {
    id: 'naledi', name: 'Prof. Naledi Dube', role: 'Head of Department',
    spot: new THREE.Vector3(-7.4, 0, 26),              // beside the road, under the spire bridge
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
    spot: 'random', hair: 0x4a2c17, long: true, bandage: true,
    coat: 0x414b3c, pants: 0x22232a, skin: 0x8a6248,
    where: '"Home. Asleep by eleven — I have an eight o\'clock tutorial." He says it too fast, and he has clearly rehearsed it. Nobody in this city is asleep by eleven.',
    relate: '"Thabo was my supervisor. He was going to ruin me — I mean — he WAS a good man. He was going to ruin—"',
    react: 'The news lands like a handshake. "I — I see." He repeats it twice, as though buying seconds. His right hand — the bandaged one — twitches toward his pocket and stays there.',
    follow: [
      {
        req: 'l1:handkerchief',
        q: 'Show him the handkerchief: K.P., with dried blood.',
        a: '"Where did you —" He stops himself. Too late. "It was lost. At the faculty. I cut that hand on a nail at the garage, on my way home from the depot." Except: the garage locks at 20:00, and he said asleep by eleven. And the cut is on the FRONT of the hand — the way a hand bleeds against a pistol barrel, not a nail.',
        log: 'K.P. flinched at the monogram before he could stop himself, and his wound is on the front of the hand — exactly where the office handkerchief said it was NOT the victim\'s.',
      },
      {
        req: 'always',
        q: 'Ask about the bandage on his hand.',
        a: 'The wrap is fresh — the skin under it sealed with clinic glue, and it smells of iodine from the after-hours practice, not of any garage nail. A nail does not get stitched at 00:30.',
        log: 'The bandage was dressed at the after-hours clinic within hours of the killing. Whatever opened that hand happened before the stitching, not after.',
      },
      {
        req: 'c:stub',
        q: 'Show him the parking stub: 23:38, faculty side.',
        a: 'He reads the timestamp four times and says nothing for four seconds. "I — parked — at the faculty that evening. I told you I was home." Four seconds is a verdict on its own.',
        log: 'Kyle\'s alibi died in four seconds: he parked faculty-side at 23:38 — nineteen minutes after the last message, nineteen floors below a man he now claims never to have visited.',
      },
    ],
  },
  {
    id: 'mandla', name: 'Mandla Dlamini', role: 'Taxi rank fixer',
    spot: 'random', hair: 0x4a2c17, long: false, bandage: false,
    coat: 0x4c3524, pants: 0x2b2118, skin: 0x5d4436,
    where: '"Ten to three, drinking, in this city, for cash. I saw plenty from the footbridge and I will sell you what I saw."',
    relate: '"The lecturer? Never met him. I know his FACE from the campus gate — I watch gates, it is what I am for."',
    react: 'He shrugs, easy as rain. "A lot of men die in October." Too relaxed — until he leans in: "But if you want the name of who walked fast down those back stairs, that costs extra."',
    follow: [
      {
        req: 'always',
        q: 'What did you see from the bridge?',
        a: '"Twenty to twelve, a young person came down the back stairs — dark t-shirt, walking fast. Fast is not guilty, friend. But fast is guilty-adjacent." And the fish he sold that night? "The lady at the water. My invoice is her alibi."',
        log: 'An unrelated witness puts a fast-walking young person on the back stairs at 23:40, and independently alibis the woman at the water.',
      },
      {
        req: 'c:stub',
        q: 'The parking stub, stamped 23:38.',
        a: 'He whistles through his teeth. "Faculty exit stamp. 23:38. Whoever punched that ticket was on that campus while your lecturer was already cooling on his own floor."',
      },
    ],
  },
];

// city clue definitions (found in the world, logged with E)
const CITY_CLUES = {
  gun: {
    name: 'Unregistered pistol (.40)',
    note: 'A service pistol with the serial filed to scratches, hidden under a tarp behind the glass dome — exactly where the watchman sits after midnight. It is not the gun that fired the 9mm in the office, but it is a gun, and it is his, and he never mentioned it.',
  },
  uvtrail: {
    name: 'UV: bootprints & scrawl',
    note: 'Under the torch: a drag of muddy bootprints circling the dome\'s back side and, scrawled on the plaza kerb in something that fluoresces like detergent, two words and a place — "DEPOT — HE KNOWS". The victim\'s own diary said the same: city, 14:00, depot.',
  },
  stub: {
    name: 'Parking exit stub, 23:38',
    note: 'A faculty-garage exit ticket, timestamped 23:38, skittered against a roadside bollard. Nineteen minutes after the victim sent "Heading to my office" — someone left that campus in a hurry, and did not know it was the night-cleaner\'s hour.',
  },
};

// two of the five witnesses move between these each run (no new buildings)
const SPOTS = [
  new THREE.Vector3(-9.5, 0, -6),
  new THREE.Vector3(-8.6, 0, -34),
  new THREE.Vector3(-13.5, 0, 11),
  new THREE.Vector3(4.5, 0, -24),
  new THREE.Vector3(-10.5, 0, -52),
];

// ------------------------------------------------------------
export class CityLevel {
  constructor(sceneOrRenderer = null) {
    this.scene = (sceneOrRenderer && sceneOrRenderer.isScene) ? sceneOrRenderer : new THREE.Scene();

    // ---- the legacy street scene, hoisted into our scene ----
    this.inner = new Level2();
    this._prevBg = this.scene.background;
    this._prevFog = this.scene.fog;
    this.scene.background = this.inner.scene.background;
    this.scene.fog = this.inner.scene.fog;
    this.scene.add(this.inner.level);
    this.scene.add(this.inner.sky);
    this.level = this.inner.level;   // so the host can find/remove it
    this.root = this.inner.level;
    this.sky = this.inner.sky;
    this.colliders = Array.isArray(this.inner.colliders) ? this.inner.colliders : [];

    this.name = 'LEVEL 2 — THE CITY';
    this.spawn = new THREE.Vector3(0, 0, 45);
    this.spawnYaw = 0;               // look down the road toward the dome

    this.city = new THREE.Group();
    this.scene.add(this.city);

    this.time = 0;
    this.uvOn = false;
    this.dialogueOpen = false;
    this.caseOpen = false;
    this.suspectsOpen = false;
    this.verdictOpen = false;
    this.currentNpc = null;
    this.collected = {};             // city clue id -> true
    this.logs = { statements: [], relationships: [], reactions: [], extra: [] };
    this.clues = [];
    this.npcObjs = [];
    this.uvMeshes = [];
    this.focus = null;

    this._o = new THREE.Vector3(); this._d = new THREE.Vector3(0, 0, -1);
    this._rc = new THREE.Raycaster(); this._rc.far = REACH;

    // ---- random placements for the two roaming witnesses ----
    // Clone the definitions per instance: questioning state, hit boxes and
    // groups attach to the clones, so losing and restarting Level 2 wipes
    // everything clean instead of resuming with five already-heard witnesses.
    this.npcs = NPCS.map((d) => ({ ...d }));
    const idx = [...SPOTS.keys()].sort(() => Math.random() - 0.5);
    const pick = [idx[0], idx[1]];
    let p = 0;
    for (const def of this.npcs) def.pos = (def.spot === 'random') ? SPOTS[pick[p++]].clone() : def.spot.clone();

    this._buildUvLight();
    this._buildNpcs();
    this._buildClues();
    this._buildUI();

    this.city.traverse((o) => { if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; } });

    window.__firstPerson = true;     // host camera stands down
    this._onKey = (e) => this._handleKey(e);
    window.addEventListener('keydown', this._onKey);

    this._toast('THE CITY — LAST LIGHT',
      'Five people know something about tonight. Question them all.  [E] talk / collect   [F] UV torch   [C] case file', 9000);
  }

  getSurfaceHeight() { return 0; }
  groundHeight() { return 0; }
  terrainHeight() { return 0; }

  // =========================================================
  // NPC bodies — simple humanoids, never player-owned
  // =========================================================
  _person(def) {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: def.skin, roughness: 0.8 });
    const coat = new THREE.MeshStandardMaterial({ color: def.coat, roughness: 0.85 });
    const pants = new THREE.MeshStandardMaterial({ color: def.pants, roughness: 0.9 });
    const hair = new THREE.MeshStandardMaterial({ color: def.hair, roughness: 1 });

    const cyl = (rt, rb, h, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 10), mat);
      m.position.set(x, y, z); g.add(m); return m;
    };
    // legs, torso, arms
    cyl(0.07, 0.06, 0.85, pants, -0.1, 0.45, 0);
    cyl(0.07, 0.06, 0.85, pants, 0.1, 0.45, 0);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 0.24), coat);
    torso.position.set(0, 1.16, 0); g.add(torso);
    cyl(0.05, 0.045, 0.6, coat, -0.25, 1.12, 0);
    cyl(0.05, 0.045, 0.6, coat, 0.25, 1.12, 0);
    const lh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
    lh.position.set(-0.25, 0.8, 0); g.add(lh);
    const rh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
    rh.position.set(0.25, 0.8, 0); g.add(rh);
    // head + hair
    cyl(0.05, 0.06, 0.1, skin, 0, 1.52, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), skin);
    head.position.set(0, 1.66, 0); g.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.126, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    cap.position.set(0, 1.675, -0.008); cap.scale.set(1, 1.05, 1.06); g.add(cap);
    if (def.long) {   // a panel of long hair down the back
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.06), hair);
      back.position.set(0, 1.5, -0.115); g.add(back);
    }
    if (def.bandage) {  // the fresh wound, wrapped
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.07, 10),
        new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 1 }));
      wrap.position.set(0.25, 0.8, 0.01); g.add(wrap);
    }
    g.position.copy(def.pos);
    return g;
  }

  _buildNpcs() {
    for (const def of this.npcs) {
      const g = this._person(def);
      g.rotation.y = Math.PI;       // face along the road initially
      this.city.add(g);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7),
        new THREE.MeshBasicMaterial());
      hit.position.set(def.pos.x, 0.9, def.pos.z);
      hit.visible = false; hit.userData.noShadow = true;
      hit.userData.npc = def;
      this.city.add(hit);
      def.group = g; def.hit = hit;
      def.questioned = false; def.asked = {}; def._phase = Math.random() * 6.28;
      this.npcObjs.push(def);
    }
  }

  // =========================================================
  // CITY CLUES
  // =========================================================
  _addClue(id, group, hitSize, pos) {
    this.city.add(group);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(...hitSize), new THREE.MeshBasicMaterial());
    hit.position.copy(pos); hit.visible = false; hit.userData.noShadow = true;
    this.city.add(hit);
    const clue = { id, def: CITY_CLUES[id], group, hit, pos: pos.clone(), found: false };
    hit.userData.clue = clue;
    this.clues.push(clue);
    return clue;
  }

  _buildClues() {
    // ---- 1. the pistol behind the dome ----
    const gun = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.35, metalness: 0.8 });
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.05, 0.21), metal);
    slide.position.y = 0.06; gun.add(slide);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.065),
      new THREE.MeshStandardMaterial({ color: 0x191512, roughness: 0.8 }));
    grip.position.set(0, -0.01, 0.06); grip.rotation.x = 0.35; gun.add(grip);
    const tarp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.44),
      new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 1 }));
    tarp.position.y = 0.01; gun.add(tarp);
    gun.position.set(-44.2, 0.05, -13.2);
    gun.rotation.y = 0.9;
    this._addClue('gun', gun, [0.6, 0.3, 0.6], new THREE.Vector3(-44.2, 0.15, -13.2));

    // ---- 2. UV-only bootprints + scrawl on the plaza kerb ----
    const scrawlTex = canvasTex(512, 256, (g2, w, h) => {
      g2.clearRect(0, 0, w, h);
      g2.font = 'italic bold 72px "Courier New", monospace';
      g2.fillStyle = '#baf3ff';
      g2.save(); g2.translate(20, 150); g2.rotate(-0.04);
      g2.fillText('DEPOT — HE KNOWS', 0, 0); g2.restore();
      // bootprints dragging toward the road
      g2.fillStyle = 'rgba(150, 230, 255, 0.8)';
      for (let i = 0; i < 6; i++) {
        g2.save();
        g2.translate(60 + i * 70 + (i % 2) * 16, 210 - (i % 2) * 22);
        g2.rotate(0.35);
        g2.beginPath(); g2.ellipse(0, 0, 14, 30, 0, 0, 6.3); g2.fill();
        g2.restore();
      }
    });
    const scrawlMat = new THREE.MeshBasicMaterial({
      map: scrawlTex, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0x9fd4ff,
    });
    const scrawl = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), scrawlMat);
    scrawl.rotation.x = -Math.PI / 2; scrawl.rotation.z = 0.5;
    scrawl.position.set(-42.6, 0.03, -18.6);
    scrawl.userData.noShadow = true;
    this.uvMeshes.push({ mesh: scrawl, mat: scrawlMat, target: 0 });
    const grp = new THREE.Group(); grp.add(scrawl);
    this._addClue('uvtrail', grp, [1.6, 0.5, 1.6], new THREE.Vector3(-42.6, 0.2, -18.6));

    // ---- 3. parking stub against a roadside bollard ----
    const stub = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.15),
      new THREE.MeshStandardMaterial({ color: 0xd9d4c4, roughness: 1, side: THREE.DoubleSide }));
    paper.rotation.x = -Math.PI / 2; paper.rotation.z = 0.7;
    paper.position.y = 0.012; stub.add(paper);
    stub.position.set(-7.0, 0, 39.5);
    this._addClue('stub', stub, [0.5, 0.3, 0.5], new THREE.Vector3(-7.0, 0.1, 39.5));

    // faint proximity glints (harder than L1: no permanent auras)
    for (const c of this.clues) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x33ffee, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat);
      s.position.copy(c.pos); s.userData.noShadow = true;
      this.city.add(s);
      c.glint = { mesh: s, mat };
    }
  }

  // =========================================================
  // UV torch — a single violet spotlight driven by F
  // =========================================================
  _buildUvLight() {
    this.uvLight = new THREE.SpotLight(0x8a4cff, 0, 26, 0.55, 0.45, 1.4);
    this.uvLight.userData.noShadow = true;
    this.uvLight.target = new THREE.Object3D();
    this.scene.add(this.uvLight, this.uvLight.target);
  }

  // =========================================================
  // UI (DOM)
  // =========================================================
  _buildUI() {
    const mk = (tag, css, parent, html) => {
      const e = document.createElement(tag); e.style.cssText = css;
      if (html !== undefined) e.innerHTML = html;
      (parent || document.body).appendChild(e); return e;
    };
    const ui = this.ui = {};
    ui.root = mk('div', 'position:fixed;inset:0;pointer-events:none;z-index:50;font-family:"Courier New",monospace;color:#f2d9a0;');
    ui.prompt = mk('div', 'position:absolute;left:50%;bottom:22%;transform:translateX(-50%);font-size:15px;letter-spacing:1px;text-shadow:0 1px 3px #000;display:none;', ui.root);
    ui.counter = mk('div', 'position:absolute;left:18px;top:16px;font-size:13px;letter-spacing:1px;opacity:.85;', ui.root, '');
    ui.uvTag = mk('div', 'position:absolute;right:18px;top:16px;font-size:13px;letter-spacing:2px;color:#b58cff;display:none;text-shadow:0 0 10px #7a3cff;', ui.root, 'UV LAMP ON');
    ui.toast = mk('div', 'position:absolute;left:50%;top:9%;transform:translate(-50%,0);width:min(680px,92vw);text-align:center;opacity:0;transition:opacity .4s;', ui.root);

    ui.dialogue = mk('div', 'position:fixed;left:50%;bottom:2vh;transform:translateX(-50%);width:min(880px,94vw);max-height:52vh;overflow:auto;display:none;background:rgba(4,6,10,.93);border:1px solid #3c4656;padding:18px 22px;z-index:9500;font-family:"Courier New",monospace;color:#e9d9b0;pointer-events:auto;box-shadow:0 0 40px rgba(0,0,0,.7);');
    ui.case = mk('div', 'position:fixed;inset:0;display:none;align-items:flex-start;justify-content:center;background:rgba(3,4,7,.92);z-index:9999;font-family:"Courier New",monospace;overflow:auto;pointer-events:auto;');
    ui.suspects = mk('div', 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(3,4,7,.94);z-index:9998;overflow:auto;pointer-events:auto;');
    ui.verdict = mk('div', 'position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:rgba(2,3,5,.98);z-index:10000;font-family:"Courier New",monospace;color:#e9d9b0;pointer-events:auto;padding:4vw;');
    this._updateCounter();
  }

  _updateCounter() {
    const qn = this.npcObjs.filter((n) => n.questioned).length;
    const cn = Object.keys(this.collected).length;
    this.ui.counter.innerHTML = `WITNESSES QUESTIONED ${qn}/5 &nbsp;·&nbsp; CITY EVIDENCE ${cn}/3`;
  }

  _toast(title, text, ms = 5000) {
    clearTimeout(this._toastTimer);
    this.ui.toast.innerHTML =
      `<div style="font-size:20px;letter-spacing:3px;color:#f2b84b;margin-bottom:8px;text-shadow:0 0 14px rgba(0,0,0,.9)">${title}</div>` +
      `<div style="font-size:14px;line-height:1.5;background:rgba(6,8,12,.8);border:1px solid #2c3440;padding:10px 16px;display:inline-block">${text}</div>`;
    this.ui.toast.style.opacity = 1;
    this._toastTimer = setTimeout(() => { this.ui.toast.style.opacity = 0; }, ms);
  }

  // =========================================================
  // EVIDENCE / LOG HELPERS
  // =========================================================
  hasL1(id) {
    const p = window.__caseProgress && window.__caseProgress.l1;
    return !p ? true : !!p[id];          // entered the city any other way: assume logged
  }
  hasCity(id) { return !!this.collected[id]; }

  _reqOk(req) {
    if (req === 'always') return true;
    if (req.startsWith('l1:')) return this.hasL1(req.slice(3));
    if (req.startsWith('c:')) return this.hasCity(req.slice(2));
    if (req.startsWith('b:')) {
      // physical tell: the bandage is visible only if you looked closely —
      // revealed by the UV lamp (torch held over the man himself)
      return this.uvEverOn;
    }
    return false;
  }

  // =========================================================
  // DIALOGUE
  // =========================================================
  _openDialogue(npc) {
    this.currentNpc = npc;
    this.dialogueOpen = true;
    window.__uiCapture = true;           // main.js stops feeding keys to movement
    if (document.exitPointerLock) document.exitPointerLock();
    this._renderDialogue();
    this.ui.dialogue.style.display = 'block';
  }

  _renderDialogue() {
    const npc = this.currentNpc;
    const asks = npc.follow.filter((f) => this._reqOk(f.req));
    const items = [
      { q: 'Where were you last night, 22:00 to 01:00?', key: 'where' },
      { q: 'What was your relationship with Dr. Nkosi?', key: 'relate' },
      { q: 'Tell him: Dr. Nkosi was found dead.', key: 'react' },
      ...asks.map((f) => ({ q: f.q, key: `f${npc.follow.indexOf(f)}` })),
    ];
    npc._items = items;
    const hist = npc.history || (npc.history = []);
    this.ui.dialogue.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
        <b style="letter-spacing:2px;color:#f2b84b">${npc.name.toUpperCase()} — ${npc.role.toUpperCase()}</b>
        <span style="font-size:12px;opacity:.7">[1-${items.length}] ask · [E] close</span>
      </div>
      <div id="dlg-log" style="font-size:14px;line-height:1.55;margin-bottom:12px;max-height:22vh;overflow:auto">
        ${hist.length ? hist.map((h) => `<p style="margin:0 0 10px"><i style="color:#9fb2cc">▸ ${h.q}</i><br>${h.a}</p>`).join('')
        : `<p style="margin:0;color:#9fb2cc">"So — you are the one the department hired. Ask, and I decide what tonight is worth."</p>`}
      </div>
      <div id="dlg-qs" style="display:flex;flex-direction:column;gap:6px"></div>`;
    const qs = this.ui.dialogue.querySelector('#dlg-qs');
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.style.cssText = 'font:inherit;text-align:left;padding:7px 12px;background:#141a24;color:#e9d9b0;border:1px solid #33405266;cursor:pointer';
      b.innerHTML = `<b style="color:#7fd4ff">${i + 1}.</b> ${it.q}`;
      b.addEventListener('click', () => this._ask(i));
      qs.appendChild(b);
    });
    const log = this.ui.dialogue.querySelector('#dlg-log');
    if (log) log.scrollTop = log.scrollHeight;
  }

  _ask(i) {
    const npc = this.currentNpc;
    const it = npc._items[i];
    if (!it) return;
    let answer;
    if (it.key === 'where') answer = npc.where;
    else if (it.key === 'relate') answer = npc.relate;
    else if (it.key === 'react') answer = npc.react;
    else answer = npc.follow[Number(it.key.slice(1))].a;

    npc.history.push({ q: it.q, a: answer });
    npc.questioned = true;

    // first-time answers get logged into the case file
    const first = !npc.asked[it.key];
    npc.asked[it.key] = true;
    if (first) {
      if (it.key === 'where') this.logs.statements.push(`${npc.name}: ${npc.where}`);
      if (it.key === 'relate') this.logs.relationships.push(`${npc.name}: ${npc.relate}`);
      if (it.key === 'react') this.logs.reactions.push(`${npc.name}: ${npc.react}`);
      else {
        const f = npc.follow[Number(it.key.slice(1))];
        if (f && f.log) this.logs.extra.push(`${npc.name} — ${f.log}`);
      }
      this._updateCounter();
      this._checkAllQuestioned();
    }
    this._renderDialogue();
  }

  _closeDialogue() {
    this.dialogueOpen = false;
    window.__uiCapture = false;
    this.ui.dialogue.style.display = 'none';
    this.currentNpc = null;
  }

  _checkAllQuestioned() {
    if (this.allQuestioned) return;
    if (this.npcObjs.every((n) => n.questioned)) {
      this.allQuestioned = true;
      this._toast('ALL FIVE HEARD YOU OUT',
        'The city has given its statements. Open the case file [C] and compile the suspect list — three names. Choose well.', 9000);
    }
  }

  // =========================================================
  // CASE FILE (carries Level 1 evidence forward)
  // =========================================================
  _openCase() {
    this.caseOpen = true;
    window.__uiCapture = true;
    if (document.exitPointerLock) document.exitPointerLock();
    const prog = (window.__caseProgress && window.__caseProgress.l1) || null;
    const l1Keys = Object.keys(CASE.clues).filter((k) => !prog || prog[k]);
    const l1Html = l1Keys.length
      ? l1Keys.map((k) => `<li><b>${CASE.clues[k].name}</b> — ${CASE.clues[k].finding}</li>`).join('')
      : '<li>Nothing logged from the office yet.</li>';
    const cityHtml = Object.keys(this.collected).length
      ? Object.keys(this.collected).map((k) => `<li><b>${CITY_CLUES[k].name}</b> — ${CITY_CLUES[k].note}</li>`).join('')
      : '<li>The city has not yet spoken. Three things are out there: a gun, something only UV light will show, and something stamped with a time.</li>';
    const li = (arr) => arr.length ? arr.map((s) => `<li>${s}</li>`).join('') : '<li style="opacity:.5">— none recorded —</li>';

    const btnState = this.allQuestioned
      ? '<button id="sf-go" style="font:inherit;letter-spacing:1px;padding:12px 26px;background:#a1241c;color:#fff;border:0;cursor:pointer">Compile the suspect list — three names &rarr;</button>'
      : `<button disabled style="font:inherit;letter-spacing:1px;padding:12px 26px;background:#2a2f3a;color:#8b93a3;border:0">Suspect list — locked (question all 5 witnesses: ${this.npcObjs.filter((n) => n.questioned).length}/5)</button>`;

    this.ui.case.innerHTML = `
      <div style="max-width:min(980px,94vw);margin:4vh auto;font-family:'Courier New',monospace;color:#e9d9b0;padding-bottom:6vh">
        <h2 style="letter-spacing:4px;color:#f2b84b">CASE FILE #001 — <span style="color:#7fd4ff">THE CITY</span></h2>
        <p><b>VICTIM:</b> ${CASE.victim} — ${CASE.role}. ${CASE.found}. One gunshot, left chest, at close range.</p>
        <h3>THE OFFICE — EVIDENCE LOGGED (${l1Keys.length})</h3><ul>${l1Html}</ul>
        <h3>THE CITY — EVIDENCE LOGGED (${Object.keys(this.collected).length}/3)</h3><ul>${cityHtml}</ul>
        <h3>STATEMENTS — WHERE THEY WERE</h3><ul>${li(this.logs.statements)}</ul>
        <h3>RELATIONSHIPS WITH THE VICTIM</h3><ul>${li(this.logs.relationships)}</ul>
        <h3>REACTIONS ON HEARING OF DEATH</h3><ul>${li(this.logs.reactions)}</ul>
        <h3>CONTRADICTIONS & LEADS</h3><ul>${li(this.logs.extra)}</ul>
        <div style="margin-top:18px">${btnState}</div>
        <p style="opacity:.6;margin-top:14px">[C] close — read it as often as you like; the witnesses remember you.</p>
      </div>`;
    this.ui.case.style.display = 'flex';
    const go = this.ui.case.querySelector('#sf-go');
    if (go) go.addEventListener('click', () => { this._closeCase(); this._openSuspects(); });
  }

  _closeCase() {
    this.caseOpen = false;
    if (!this.suspectsOpen && !this.verdictOpen) window.__uiCapture = false;
    this.ui.case.style.display = 'none';
  }

  // =========================================================
  // SUSPECT LIST — pick 3 of 5; the wrong three lose the level
  // =========================================================
  _openSuspects() {
    this.suspectsOpen = true;
    window.__uiCapture = true;
    const rows = this.npcs.map((n) => `
      <label style="display:block;margin:8px 0;font-size:15px;cursor:pointer">
        <input type="checkbox" class="sf-pick" value="${n.id}" style="transform:scale(1.3);margin-right:10px">
        <b style="color:#f2b84b">${n.name}</b> — ${n.role}
        <span style="opacity:.7">  ${(this.logs.statements.find((s) => s.startsWith(n.name)) || 'unquestioned').slice(0, 96)}…</span>
      </label>`).join('');
    this.ui.suspects.innerHTML = `
      <div style="max-width:min(760px,94vw);font-family:'Courier New',monospace;color:#e9d9b0;background:rgba(8,10,16,.96);border:1px solid #3c4656;padding:26px 30px">
        <h2 style="letter-spacing:3px;color:#f2b84b">THE SUSPECT LIST</h2>
        <p>Name the three who must answer for Dr. Nkosi's death. An innocent name on this list means the real trio walks — and you start the city over.</p>
        ${rows}
        <p id="sf-count" style="color:#7fd4ff;margin-top:12px">Selected: 0 / 3</p>
        <button id="sf-confirm" disabled style="font:inherit;padding:10px 24px;background:#2a2f3a;color:#8b93a3;border:0;margin-right:10px">Confirm the list</button>
        <button id="sf-cancel" style="font:inherit;padding:10px 24px;background:#141a24;color:#e9d9b0;border:1px solid #334052;cursor:pointer">Not yet</button>
      </div>`;
    this.ui.suspects.style.display = 'flex';
    const boxes = [...this.ui.suspects.querySelectorAll('.sf-pick')];
    const conf = this.ui.suspects.querySelector('#sf-confirm');
    const cnt = this.ui.suspects.querySelector('#sf-count');
    const refresh = () => {
      const n = boxes.filter((b) => b.checked).length;
      cnt.textContent = `Selected: ${n} / 3`;
      conf.disabled = n !== 3;
      conf.style.background = n === 3 ? '#a1241c' : '#2a2f3a';
      conf.style.color = n === 3 ? '#fff' : '#8b93a3';
    };
    boxes.forEach((b) => b.addEventListener('change', refresh));
    this.ui.suspects.querySelector('#sf-cancel').addEventListener('click', () => this._closeSuspects());
    conf.addEventListener('click', () => this._verdict(boxes.filter((b) => b.checked).map((b) => b.value)));
  }

  _closeSuspects() {
    this.suspectsOpen = false;
    if (!this.caseOpen && !this.verdictOpen) window.__uiCapture = false;
    this.ui.suspects.style.display = 'none';
  }

  _verdict(picks) {
    this.suspectsOpen = false;
    this.ui.suspects.style.display = 'none';
    this.verdictOpen = true;
    window.__uiCapture = true;
    const right = CORRECT_SUSPECTS;
    const wrong = picks.filter((p) => !right.includes(p));
    const nameOf = (id) => (this.npcs.find((n) => n.id === id) || { name: id }).name;

    if (!wrong.length) {
      this.ui.verdict.innerHTML = `
        <h2 style="letter-spacing:4px;color:#f2b84b;max-width:80vw">THE LIST IS SEALED</h2>
        <p style="max-width:min(720px,88vw);line-height:1.7;font-size:16px">
          ${nameOf('kyle')}, who bled on a handkerchief and lied about a fence.
          ${nameOf('sipho')}, whose unregistered gun kept him silent under the dome.
          ${nameOf('naledi')}, who begged a dead man to keep quiet and could not.<br><br>
          The woman at the water and the fixer on the bridge stay off the list — their alibis
          buy each other. The accusation will be made in front of all three, with the evidence
          laid out name by name. That is <b style="color:#7fd4ff">LEVEL 3 — coming soon</b>.
        </p>
        <div style="margin-top:26px;display:flex;gap:14px">
          <button id="vd-close" style="font:inherit;padding:12px 24px;background:#1f6f5c;color:#fff;border:0;cursor:pointer">Keep working the city</button>
          <button id="vd-again" style="font:inherit;padding:12px 24px;background:#141a24;color:#e9d9b0;border:1px solid #334052;cursor:pointer">Restart the level</button>
        </div>`;
    } else {
      this.ui.verdict.innerHTML = `
        <h2 style="letter-spacing:4px;color:#d34a3f;max-width:80vw">THE LIST BREAKS</h2>
        <p style="max-width:min(720px,88vw);line-height:1.7;font-size:16px">
          You put <b>${wrong.map(nameOf).join(', ')}</b> on it — and the evidence against
          ${wrong.length > 1 ? 'them' : 'that name'} is thin to nothing. Someone with an alibi
          paid in fish and invoices is now on the run from you, while the actual trio heard the
          whole list read out over the radio.<br><br>
          The city closes its doors. You start again from the beginning of Level 2 — this time,
          weigh what each name actually has against it.
        </p>
        <div style="margin-top:26px">
          <button id="vd-restart" style="font:inherit;padding:12px 26px;background:#a1241c;color:#fff;border:0;cursor:pointer">Restart Level 2 &rarr;</button>
        </div>`;
    }
    this.ui.verdict.style.display = 'flex';
    const close = this.ui.verdict.querySelector('#vd-close');
    const again = this.ui.verdict.querySelector('#vd-again');
    const restart = this.ui.verdict.querySelector('#vd-restart');
    if (close) close.addEventListener('click', () => this._closeVerdict());
    if (again) again.addEventListener('click', () => this._restart());
    if (restart) restart.addEventListener('click', () => this._restart());
  }

  _closeVerdict() {
    this.verdictOpen = false;
    window.__uiCapture = false;
    this.ui.verdict.style.display = 'none';
  }

  _restart() {
    if (typeof window.__switchLevel === 'function') window.__switchLevel(2);
    else this._closeVerdict();
  }

  // =========================================================
  // INPUT
  // =========================================================
  _handleKey(e) {
    if (e.repeat) return;
    if (this.verdictOpen) return;
    if (this.caseOpen) { if (e.code === 'KeyC' || e.code === 'Escape') this._closeCase(); return; }
    if (this.suspectsOpen) { if (e.code === 'Escape') this._closeSuspects(); return; }
    if (this.dialogueOpen) {
      const m = e.code.match(/^Digit([1-9])$/);
      if (m) { this._ask(Number(m[1]) - 1); return; }
      if (e.code === 'KeyE' || e.code === 'Escape' || e.code === 'KeyC') this._closeDialogue();
      return;
    }
    if (e.code === 'KeyC') { this._openCase(); return; }
    if (e.code === 'KeyF') {
      this.uvOn = !this.uvOn;
      this.uvEverOn = this.uvOn || this.uvEverOn;
      this.ui.uvTag.style.display = this.uvOn ? 'block' : 'none';
      return;
    }
    if (e.code === 'KeyE') {
      if (!this.focus) return;
      const f = this.focus;
      if (f.npc) this._openDialogue(f.npc);
      else if (f.clue && !f.clue.found) this._collect(f.clue);
    }
  }

  _collect(c) {
    if (c.id === 'uvtrail' && !this.uvOn) {
      this._toast('SOMETHING IS HERE', 'Your fingers brush a scrawl on the kerb that will not show itself in ordinary light. Try the UV torch.', 5000);
      return;
    }
    c.found = true;
    this.collected[c.id] = true;
    c.hit.userData = {};                    // no longer interactable
    this.city.remove(c.hit);
    if (c.glint) this.city.remove(c.glint.mesh);
    this._updateCounter();
    this._toast(`CITY EVIDENCE ${Object.keys(this.collected).length}/3 — ${c.def.name.toUpperCase()}`, c.def.note, 11000);
    if (c.id === 'gun') this.logs.extra.push('An unregistered .40 pistol sat under a tarp where the watchman sits. He never mentioned carrying it.');
  }

  // =========================================================
  // PER-FRAME
  // =========================================================
  _applyFirstPerson(player) {
    const cam = window.__camera;
    if (!cam || !cam.isCamera || !player || !player.pos) return;
    cam.position.set(player.pos.x, (player.pos.y || 0) + EYE, player.pos.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(player.pitch || 0, player.yaw || 0, 0);
  }

  _updateFocus(cam) {
    this.focus = null;
    if (!cam) return;
    cam.getWorldDirection(this._d);
    this._o.copy(cam.position);
    this._rc.set(this._o, this._d);
    this._rc.far = REACH;
    const targets = [];
    for (const n of this.npcObjs) targets.push(n.hit);
    for (const c of this.clues) if (!c.found) targets.push(c.hit);
    const hits = this._rc.intersectObjects(targets, false);
    if (!hits.length) { this.ui.prompt.style.display = 'none'; return; }
    const ud = hits[0].object.userData;
    if (ud.npc) {
      this.focus = { npc: ud.npc };
      this.ui.prompt.textContent = `[E] Question — ${ud.npc.name}`;
      this.ui.prompt.style.display = 'block';
    } else if (ud.clue) {
      this.focus = { clue: ud.clue };
      this.ui.prompt.textContent = `[E] Collect — ${ud.clue.def.name}`;
      this.ui.prompt.style.display = 'block';
    } else this.ui.prompt.style.display = 'none';
  }

  update(dt, t, player) {
    this.time += dt;
    const cam = window.__camera;
    const hasCam = !!(cam && cam.isCamera);
    if (hasCam && player && player.pos) this._applyFirstPerson(player);

    // UV light rides the camera
    if (this.uvLight) {
      this.uvLight.intensity = this.uvOn ? 55 : 0;
      if (hasCam && this.uvOn) {
        cam.getWorldDirection(this._d);
        this.uvLight.position.copy(cam.position);
        this.uvLight.target.position.copy(cam.position).addScaledVector(this._d, 9);
        this.uvLight.target.updateMatrixWorld();
      }
    }

    // UV-only reveals fade in only while lit by the torch beam
    if (hasCam) {
      cam.getWorldDirection(this._d);
      for (const u of this.uvMeshes) {
        const to = u.mesh.position.clone().sub(cam.position);
        const dist = to.length();
        const facing = dist > 0.1 ? to.normalize().dot(this._d) : 1;
        const on = this.uvOn && dist < 15 && facing > 0.55;
        u.target = on ? Math.max(0, Math.min(0.95, 1 - dist / 18)) : 0;
        u.mat.opacity += (this.uvOn ? (u.target - u.mat.opacity) : (-u.mat.opacity)) * Math.min(1, dt * 6);
      }
    }

    // clue glints: faint, proximity-only (harder than Level 1)
    if (player && player.pos) {
      for (const c of this.clues) {
        if (!c.glint || c.found) continue;
        const d = c.pos.distanceTo(player.pos);
        c.glint.mat.opacity = Math.max(0, Math.min(0.22, (7 - d) * 0.05));
      }
      // witnesses turn to watch you when you come close
      for (const n of this.npcObjs) {
        const dx = player.pos.x - n.pos.x, dz = player.pos.z - n.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 6) {
          const want = Math.atan2(dx, dz);
          let cur = n.group.rotation.y;
          let diff = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          n.group.rotation.y = cur + diff * Math.min(1, dt * 2.5);
        }
        n.group.position.y = Math.sin(this.time * 1.3 + n._phase) * 0.012;
      }
    }

    const overlay = this.caseOpen || this.dialogueOpen || this.suspectsOpen || this.verdictOpen;
    if (overlay) { this.ui.prompt.style.display = 'none'; this.focus = null; }
    else if (hasCam) this._updateFocus(cam);
  }

  // =========================================================
  // DISPOSE
  // =========================================================
  dispose() {
    clearTimeout(this._toastTimer);
    window.removeEventListener('keydown', this._onKey);
    window.__firstPerson = false;
    window.__uiCapture = false;
    if (this.scene) {
      this.scene.remove(this.city);
      this.city.traverse((o) => {
        if (o.isMesh) { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); }
      });
      this.scene.remove(this.uvLight); this.scene.remove(this.uvLight.target);
      this.scene.background = this._prevBg;
      this.scene.fog = this._prevFog;
    }
    for (const k of ['root', 'dialogue', 'case', 'suspects', 'verdict']) {
      if (this.ui && this.ui[k]) this.ui[k].remove();
    }
    this.ui = null;
  }
}
