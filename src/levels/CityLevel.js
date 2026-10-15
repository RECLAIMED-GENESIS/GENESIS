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
// This module wraps the legacy Level2.js street scene (adding street props:
// passing traffic, lit street lamps, a café terrace with its shop sign,
// and seats for some witnesses) and drives
// the first-person camera itself, exactly like Level 1 does. The player is a pure camera: no body.
//
// RANDOM CASE: the killer is rolled once per run (game/case.js). Everything that depends
// on who did it (alibi, bandage, reactions) is generated in game/cityCast.js.
// PHOTO CAMERA: [Q] raise, wheel zoom, click shoot (game/photoCamera.js).
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
import { getStats } from '../game/stats.js';
import { getCase, applyCaseToStory } from '../game/case.js';
import { makeCast, CITY_CLUES, SPOTS } from '../game/cityCast.js';
import { PhotoCamera, PHOTO } from '../game/photoCamera.js';
import { play as sfx } from '../audio/sfx.js';
import { EvidenceBoard } from '../game/EvidenceBoard.js';
import { CaptainScene } from '../game/CaptainScene.js';
import { newState, boardLink, boardSummary, captainDecision, request as caseRequest, TRUST_START, evidenceLinks } from '../game/investigation.js';
const EYE = 1.7;
const REACH = 3.0;

// small canvas-texture helper (same idea as Level 1's)
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// (the five witnesses, the city clues and the roaming-witness spots live in game/cityCast.js)

// ------------------------------------------------------------
export class CityLevel {
  constructor(sceneOrRenderer = null, rendererMaybe = null) {
    this.scene = (sceneOrRenderer && sceneOrRenderer.isScene) ? sceneOrRenderer : new THREE.Scene();
    this.renderer = rendererMaybe || (sceneOrRenderer && sceneOrRenderer.isWebGLRenderer ? sceneOrRenderer : null) || window.__renderer || null;

    // ---- this run's case: who did it, the alibi, the wounded hand ----
    this.case = getCase();
    applyCaseToStory(CASE, this.case);   // Level 1's clue text now matches the killer

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

    // ---- random placements for the roaming witness ----
    // Clone the definitions per instance: questioning state, hit boxes and
    // groups attach to the clones, so losing and restarting Level 2 wipes
    // everything clean instead of resuming with five already-heard witnesses.
    this.npcs = makeCast(this.case);
    const spots = SPOTS.map((a) => new THREE.Vector3(a[0], a[1], a[2]));
    const idx = [...spots.keys()].sort(() => Math.random() - 0.5);
    const pick = [idx[0], idx[1]];
    let p = 0;
    for (const def of this.npcs) {
      def.pos = (def.spot === 'random') ? spots[pick[p++]].clone() : new THREE.Vector3(def.spot[0], def.spot[1], def.spot[2]);
    }

    this._buildUvLight();
    this._buildCityLights();
    this._buildTerrace();
    this._buildWaterfront();
    this._buildStreetLamps();
    this._brightenStreet();
    this._buildNpcs();
    this._buildTraffic();
    this._buildClues();
    this._buildUI();
    this._buildCamera();

    // ---- case board state (persists across restarts) ----
    const saved = (window.__caseProgress && window.__caseProgress.board) || null;
    this.state = saved
      ? { trust: window.__caseProgress.trust ?? TRUST_START,
          held: window.__caseProgress.held || [],
          warrants: window.__caseProgress.warrants || [],
          board: saved,
          photos: window.__caseProgress.photos || [] }
      : newState();

    this.board = new EvidenceBoard({
      getEvidence: () => this._evidenceList(),
      getSuspects: () => this.npcs.map((n) => ({ id: n.id, name: n.name, role: n.role })),
      getBoard: () => this.state.board,
      getSummary: () => boardSummary(this.state.board, this.case),
      tryLink: (eid, sid) => {
        const ok = boardLink(this.state.board, sid, eid, this.case);
        if (!ok) getStats().falsePresentations++;
        return ok;
      },
      onChange: (o) => { if (o && o.failed) sfx('deflect'); else sfx('correct'); this._saveState(); this._refreshTrustHud(); },
      onTakeToCaptain: (sid) => { this.board.close(); this.captain.open(sid); },
      onClose: () => {},
    });

    this.captain = new CaptainScene({
      getSuspect: (id) => this.npcs.find((n) => n.id === id) || { name: id, role: '' },
      getSummaryFor: (id) => boardSummary(this.state.board, this.case)[id] || { kinds: [], score: 0, byKind: {} },
      getTrust: () => this.state.trust,
      applyAsk: (id, ask) => {
        const r = caseRequest(this.state, id, ask, this.state.board[id] || [], this.case);
        this.state = r.state;
        this._saveState();
        if (r.granted && r.got === 'warrant') {
          // stakeout unlocks
          this._stakeoutUnlocked = true;
          setTimeout(() => this._offerStakeout(id), 2800);
        }
        if (r.reassigned) { setTimeout(() => this._reassigned(), 2800); }
        if (r.partial || (r.granted && r.got === 'questioning')) {
          if (!this.state.held.includes(id)) this.state.held.push(id);
          this._saveState();
        }
        return r;
      },
      onDone: () => {},
      onReassigned: () => this._reassigned(),
    });
    this._refreshTrustHud();

    this.city.traverse((o) => { if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; } });

    window.__firstPerson = true;     // host camera stands down
    this._onKey = (e) => this._handleKey(e);
    window.addEventListener('keydown', this._onKey);

    // The lab dossier carries the run forward: two names, one killer hiding.
    this.labDossier = (window.__caseProgress && window.__caseProgress.lab) || null;
    const _labNames = this.labDossier && this.labDossier.names && this.labDossier.names.length
      ? this.labDossier.names.join('  ·  ')
      : null;
    this._parkedAt = new THREE.Vector3(12, 0, 38);
    this._buildStakeoutCar();
    this._startArrivalRide(_labNames);
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
    const headY = def.sitting ? 1.33 : (def.leaning ? 1.62 : 1.66);
    const headZ = def.leaning ? 0.12 : 0;
    if (def.sitting) {
      // ---- seated: thighs forward onto the seat, shins down, hands on knees ----
      const thighG = new THREE.BoxGeometry(0.13, 0.13, 0.44);
      for (const sx of [-0.1, 0.1]) {
        const th = new THREE.Mesh(thighG, pants);
        th.position.set(sx, 0.48, 0.2); g.add(th);
        cyl(0.055, 0.05, 0.44, pants, sx, 0.24, 0.4);   // shins
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.24), coat);
        shoe.position.set(sx, 0.035, 0.44); g.add(shoe);
      }
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 0.24), coat);
      torso.position.set(0, 0.84, 0); g.add(torso);
      for (const sx of [-0.225, 0.225]) {               // arms leaning to the knees
        const a = cyl(0.05, 0.045, 0.6, coat, sx, 0.8, 0.16);
        a.rotation.x = -0.56;
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
        hand.position.set(sx > 0 ? 0.2 : -0.2, 0.55, 0.33); g.add(hand);
      }
      cyl(0.05, 0.06, 0.1, skin, 0, 1.2, 0);            // neck
    } else {
      // ---- standing: legs always straight ----
      cyl(0.07, 0.06, 0.85, pants, -0.1, 0.45, 0);
      cyl(0.07, 0.06, 0.85, pants, 0.1, 0.45, 0);
      if (def.leaning) {
        // ---- leaning on a rail: chest tipped forward, arms out, hands on the bar ----
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 0.24), coat);
        torso.position.set(0, 1.14, 0.05); torso.rotation.x = 0.15; g.add(torso);
        // one continuous limb per side: shoulder joint -> hand on the rail,
        // hands resting side by side (nearly touching) on the bar
        for (const sx of [-0.22, 0.22]) {
          const S = new THREE.Vector3(sx, 1.35, 0.05);
          const H = new THREE.Vector3(Math.sign(sx) * 0.06, 1.0, 0.52);
          const d = H.clone().sub(S);
          const a = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, d.length(), 10), coat);
          a.position.copy(S).addScaledVector(d, 0.5);
          a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
          g.add(a);
          const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
          hand.position.copy(H); g.add(hand);
        }
        cyl(0.05, 0.06, 0.1, skin, 0, 1.48, 0.08);      // neck
      } else {
        // ---- standing straight: torso, arms ----
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 0.24), coat);
        torso.position.set(0, 1.16, 0); g.add(torso);
        cyl(0.05, 0.045, 0.6, coat, -0.25, 1.12, 0);
        cyl(0.05, 0.045, 0.6, coat, 0.25, 1.12, 0);
        const lh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
        lh.position.set(-0.25, 0.8, 0); g.add(lh);
        const rh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
        rh.position.set(0.25, 0.8, 0); g.add(rh);
        cyl(0.05, 0.06, 0.1, skin, 0, 1.52, 0);         // neck
      }
    }
    // head + hair (lowered when seated, tipped forward when leaning)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), skin);
    head.position.set(0, headY, headZ); g.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.126, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    cap.position.set(0, headY + 0.015, headZ - 0.008); cap.scale.set(1, 1.05, 1.06); g.add(cap);
    if (def.long) {   // a panel of long hair down the back
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.06), hair);
      back.position.set(0, headY - 0.16, headZ - 0.115); g.add(back);
    }
    if (def.bandage) {  // the fresh wound, wrapped
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.07, 10),
        new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 1 }));
      const sgn = def.woundHand === 'left' ? -1 : 1;     // the hand the case says was hurt
      if (def.sitting) wrap.position.set(0.2 * sgn, 0.55, 0.33);
      else if (def.leaning) wrap.position.set(0.25 * sgn, 1.0, 0.52);
      else wrap.position.set(0.25 * sgn, 0.8, 0.01);
      g.add(wrap);
    }
    g.position.copy(def.pos);
    return g;
  }

  _buildNpcs() {
    for (const def of this.npcs) {
      const g = this._person(def);
      g.rotation.y = (typeof def.face === 'number') ? def.face
        : (typeof def.sitFace === 'number') ? def.sitFace : Math.PI;
      this.city.add(g);
      const hitH = def.sitting ? 1.5 : 1.8;
      const hitY = def.sitting ? 0.72 : 0.9;
      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.8, hitH, 0.8),
        new THREE.MeshBasicMaterial());
      hit.position.set(def.pos.x, hitY, def.pos.z);
      hit.visible = false; hit.userData.noShadow = true;
      hit.userData.npc = def;
      this.city.add(hit);
      def.group = g; def.hit = hit;
      def.questioned = false; def.asked = {}; def._phase = Math.random() * 6.28;
      this.npcObjs.push(def);
    }
  }

  // =========================================================
  // STAKEOUT CAR + ARRIVAL RIDE (Option A: the car is your office)
  // A scripted 22s drive-in down the street, then the parked unmarked car
  // is your observation post: dossier recap, radio log, long lens.
  // =========================================================
  _buildStakeoutCar() {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: 0x232830, roughness: 0.35, metalness: 0.6 });
    const glassM = new THREE.MeshStandardMaterial({ color: 0x0d1218, roughness: 0.15, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 4.4), paint);
    body.position.y = 0.65; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.2), glassM);
    cab.position.set(0, 1.1, -0.2); g.add(cab);
    const wheelG = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14);
    const wheelM = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.9 });
    for (const [x, z] of [[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.4], [0.85, -1.4]]) {
      const w = new THREE.Mesh(wheelG, wheelM);
      w.rotation.z = Math.PI / 2; w.position.set(x, 0.33, z); g.add(w);
    }
    // headlights dark — stakeout discipline; dash glows faintly instead
    const lampM = new THREE.MeshStandardMaterial({ color: 0x30363e, roughness: 0.4 });
    for (const x of [-0.6, 0.6]) {
      const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), lampM);
      lamp.position.set(x, 0.68, 2.21); g.add(lamp);
    }
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x1d3a2a }));
    dash.position.set(0, 0.95, 0.9); dash.rotation.x = -0.4; g.add(dash);
    g.position.copy(this._parkedAt);
    g.rotation.y = Math.PI + 0.25;   // nose toward the street
    this.city.add(g);
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(this._parkedAt.x - 1.2, 0, this._parkedAt.z - 2.4),
      new THREE.Vector3(this._parkedAt.x + 1.2, 1.5, this._parkedAt.z + 2.4)));
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 4.8), new THREE.MeshBasicMaterial());
    hit.visible = false; hit.position.set(this._parkedAt.x, 0.9, this._parkedAt.z);
    hit.userData.post = true;
    this.city.add(hit);
    this._postHit = hit;
  }

  _startArrivalRide(labNames) {
    this.ride = {
      active: true, t: 0, dur: 22,
      from: new THREE.Vector3(0, 2.1, 110),
      to: new THREE.Vector3(this._parkedAt.x - 1.5, 1.9, this._parkedAt.z + 6),
      look: new THREE.Vector3(0, 1.5, 20),
      lines: [
        [0, 'Unmarked car. Engine low. The city slides past the glass.'],
        [5, 'Wipers going. Two photos paper-clipped to the sun visor.'],
        [10, labNames ? 'Two names from the lab: ' + labNames + '. One killed him. One ran.' : 'Five people know something about tonight.'],
        [15, 'Radio: "keep it dark, keep it quiet. No sirens until the captain says."'],
        [19, 'Engine off. This is your post now.'],
      ],
      shown: 0,
    };
    window.__uiCapture = true;
    if (document.exitPointerLock) document.exitPointerLock();
    const root = document.createElement('div');
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60;font-family:"Courier New",monospace;';
    root.innerHTML =
      '<div style="position:absolute;top:0;left:0;right:0;height:10vh;background:#000"></div>' +
      '<div style="position:absolute;bottom:0;left:0;right:0;height:10vh;background:#000"></div>' +
      '<div class="ride-cap" style="position:absolute;bottom:12vh;left:0;right:0;text-align:center;color:#e9d9b0;font-size:16px;letter-spacing:1px;text-shadow:0 2px 6px #000;padding:0 8vw"></div>' +
      '<div style="position:absolute;top:11vh;right:4vw;pointer-events:auto"><button class="ride-skip" style="font:inherit;padding:8px 18px;background:rgba(10,14,20,.7);color:#e9d9b0;border:1px solid #3c4656;cursor:pointer">SKIP RIDE &gt;&gt;</button></div>';
    document.body.appendChild(root);
    this.ride.ui = root;
    root.querySelector('.ride-skip').addEventListener('click', () => this._endRide(true));
  }

  _endRide(skipped) {
    if (!this.ride || !this.ride.active) return;
    this.ride.active = false;
    if (this.ride.ui) { this.ride.ui.remove(); this.ride.ui = null; }
    window.__uiCapture = false;
    const p = this._ridePlayer;
    if (p && p.pos) {
      p.pos.set(this._parkedAt.x - 2.5, 0, this._parkedAt.z + 1);
      p.vel.set(0, 0, 0);
      p.yaw = Math.PI / 2 - 0.3;
      p.pitch = 0;
    }
    const names = this.labDossier && this.labDossier.names && this.labDossier.names.length
      ? this.labDossier.names.join('  ·  ') : null;
    this._toast('OBSERVATION POST',
      (names ? 'The lab gave you two names: ' + names + '. Watch them before you speak to them. ' : 'Question the street. ') +
      'The car is your post — [E] on it for the dossier and the radio. [Q] camera · [B] board · [C] file', 11000);
  }

  _openPost() {
    this.caseOpen = true;   // reuse the case overlay flag so input stays frozen
    window.__uiCapture = true;
    if (document.exitPointerLock) document.exitPointerLock();
    const lab = this.labDossier;
    const names = lab && lab.names ? lab.names : [];
    this.ui.case.innerHTML = `
      <div style="max-width:min(760px,94vw);margin:6vh auto;font-family:'Courier New',monospace;color:#e9d9b0;background:rgba(8,10,16,.96);border:1px solid #3c4656;padding:26px 30px">
        <h2 style="letter-spacing:3px;color:#f2b84b">STAKEOUT CAR — DASH</h2>
        <p><b>NAMES ON THE VISOR:</b> ${names.length ? names.join(' · ') : '—'}${names.length === 2 ? ' — one killed him, one ran. The lab cannot say which.' : ''}</p>
        <p><b>WEAPON:</b> ${(lab && lab.weapon) || '—'} &nbsp; <b>WINDOW:</b> ${(lab && lab.window) || '—'}</p>
        <p><b>DEPOT:</b> ${(lab && lab.depot) || '—'} &nbsp; <b>TEMPERAMENT:</b> ${(lab && lab.temperament) || '—'}</p>
        <h3 style="color:#7fd4ff">RADIO LOG</h3>
        <ul style="line-height:1.8">
          <li>"…movement near the bridge, one figure, unhurried."</li>
          <li>"…terrace is quiet. Somebody keeps checking the road."</li>
          <li>"…captain says: paper first. Nobody gets touched on a hunch."</li>
        </ul>
        <p style="opacity:.7">Watch their routines through the lens before you walk up. The nervous one is not always the guilty one.</p>
        <button id="post-close" style="font:inherit;padding:10px 24px;background:#1f6f5c;color:#fff;border:0;cursor:pointer">Back to the street [C]</button>
      </div>`;
    this.ui.case.style.display = 'flex';
    this.ui.case.querySelector('#post-close').addEventListener('click', () => this._closeCase());
  }

  // =========================================================
  // CAFÉ TERRACE — tables + chairs outside, seats for witnesses
  // (west sidewalk, clear of the traffic lanes)
  // =========================================================
  _buildTerrace() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x3d2c1c, roughness: 0.9 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.5, metalness: 0.6 });
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xd9d4c4, roughness: 0.7 });

    // chair faces local +Z (backrest on the local -Z side)
    const makeChair = (x, z, rotY) => {
      const ch = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.45), wood);
      seat.position.y = 0.45; ch.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.06), wood);
      back.position.set(0, 0.75, -0.2); ch.add(back);
      const legG = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8);
      for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
        const leg = new THREE.Mesh(legG, woodDark);
        leg.position.set(lx, 0.225, lz); ch.add(leg);
      }
      ch.position.set(x, 0, z); ch.rotation.y = rotY;
      this.city.add(ch);
      return ch;
    };

    const makeTable = (x, z) => {
      const t = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 18), wood);
      top.position.y = 0.72; t.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.68, 10), iron);
      leg.position.y = 0.37; t.add(leg);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.05, 14), iron);
      base.position.y = 0.03; t.add(base);
      // cups left on the table
      const cupG = new THREE.CylinderGeometry(0.035, 0.03, 0.09, 10);
      for (const [cx, cz] of [[0.2, 0.1], [-0.15, -0.2]]) {
        const cup = new THREE.Mesh(cupG, cupMat);
        cup.position.set(cx, 0.79, cz); t.add(cup);
      }
      t.position.set(x, 0, z);
      this.city.add(t);
      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(x - 0.55, 0, z - 0.55),
        new THREE.Vector3(x + 0.55, 0.8, z + 0.55)));
      return t;
    };

    // Table A: Naledi sits west of it, facing the table and the road (+X)
    const nal = this.npcs.find((n) => n.id === 'naledi');
    makeTable(-10.6, 24.2);
    makeChair(nal.pos.x, nal.pos.z, Math.PI / 2);   // Naledi's own chair
    makeChair(-9.7, 24.2, -Math.PI / 2);            // empty guest chair
    // Table B: two empty chairs
    makeTable(-11.0, 28.8);
    makeChair(-11.9, 28.8, Math.PI / 2);
    makeChair(-10.1, 28.8, -Math.PI / 2);

    // crate the watchman sits on (Anele has a public bench by the water)
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x5a4630, roughness: 1 });
    for (const id of ['sipho']) {
      const def = this.npcs.find((n) => n.id === id);
      if (!def) continue;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), crateMat);
      crate.position.set(def.pos.x, 0.225, def.pos.z);
      this.city.add(crate);
    }

    // chalk menu board facing the road and the incoming player
    const boardTex = canvasTex(256, 192, (g2, w, h) => {
      g2.fillStyle = '#14181e'; g2.fillRect(0, 0, w, h);
      g2.strokeStyle = '#e8dcc0'; g2.lineWidth = 6; g2.strokeRect(8, 8, w - 16, h - 16);
      g2.fillStyle = '#f2d9a0'; g2.textAlign = 'center';
      g2.font = 'bold 44px "Courier New", monospace';
      g2.fillText('CAFÉ', w / 2, 62);
      g2.font = '24px "Courier New", monospace'; g2.fillStyle = '#d7dde8';
      g2.fillText('FISH · CHIPS', w / 2, 108);
      g2.fillText('COFFEE', w / 2, 142);
    });
    const board = new THREE.Group();
    for (const sx of [-0.35, 0.35]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), woodDark);
      leg.position.set(sx, 0.5, 0); board.add(leg);
    }
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.7, 0.05),
      new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }));
    panel.position.y = 1.05; panel.rotation.x = -0.08; board.add(panel);
    board.position.set(-9.3, 0, 21.0); board.rotation.y = Math.PI / 4;
    this.city.add(board);
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(-9.8, 0, 20.5), new THREE.Vector3(-8.8, 1.4, 21.5)));

    // warm lamp over the terrace
    const lamp = new THREE.PointLight(0xffb36b, 10, 13, 1.7);
    lamp.position.set(-11, 2.6, 26.5);
    this.city.add(lamp);

    // illuminated CAFÉ sign on the tower face behind the terrace
    // (west spire tower, east face at x -15) so the building reads as a coffee shop
    const signTex = canvasTex(1024, 256, (g2, w, h) => {
      g2.fillStyle = '#0d1117'; g2.fillRect(0, 0, w, h);
      g2.strokeStyle = '#f2b84b'; g2.lineWidth = 8; g2.strokeRect(10, 10, w - 20, h - 20);
      g2.textAlign = 'center';
      g2.fillStyle = '#ffd9a0'; g2.font = 'bold 120px "Courier New", monospace';
      g2.fillText('CAFÉ', w / 2, 140);
      g2.fillStyle = '#d7dde8'; g2.font = '44px "Courier New", monospace';
      g2.fillText('FISH · CHIPS · COFFEE — OPEN LATE', w / 2, 205);
    });
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex, emissive: 0xffffff, emissiveMap: signTex,
      emissiveIntensity: 1.2, roughness: 0.8 });
    const signBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.15, 4.4), woodDark);
    signBack.position.set(-14.8, 3.1, 26.2); this.city.add(signBack);
    const signFace = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.95), signMat);
    signFace.rotation.y = Math.PI / 2;
    signFace.position.set(-14.53, 3.1, 26.2); this.city.add(signFace);

    // blade sign jutting toward the street so walkers see it coming either way
    const bladeTex = canvasTex(256, 128, (g2, w, h) => {
      g2.fillStyle = '#0d1117'; g2.fillRect(0, 0, w, h);
      g2.strokeStyle = '#f2b84b'; g2.lineWidth = 6; g2.strokeRect(6, 6, w - 12, h - 12);
      g2.fillStyle = '#ffd9a0'; g2.textAlign = 'center';
      g2.font = 'bold 56px "Courier New", monospace';
      g2.fillText('CAFÉ', w / 2, 84);
    });
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.06), iron);
    bracket.position.set(-14.4, 3.75, 22.5); this.city.add(bracket);
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7),
      new THREE.MeshStandardMaterial({ map: bladeTex, emissive: 0xffffff,
        emissiveMap: bladeTex, emissiveIntensity: 1.2,
        side: THREE.DoubleSide, roughness: 0.8 }));
    blade.position.set(-14.3, 3.3, 22.5); this.city.add(blade);
  }

  // =========================================================
  // STREET LAMPS — the legacy lamps only cover z <= 25 (west)
  // / z <= 0 (east), leaving the whole south road dark; these
  // fill the gameplay stretch. Real point lights, no shadows.
  // =========================================================
  _buildStreetLamps() {
    const metal = new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.55, metalness: 0.6 });
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x2a2d33, emissive: 0xffe2b0, emissiveIntensity: 3 });
    const poleG = new THREE.CylinderGeometry(0.09, 0.13, 5.0, 10);
    const baseG = new THREE.CylinderGeometry(0.16, 0.22, 0.4, 10);
    const armG = new THREE.BoxGeometry(1.3, 0.09, 0.09);
    const headG = new THREE.BoxGeometry(0.55, 0.12, 0.26);

    const mkLamp = (x, z) => {
      const g = new THREE.Group();
      const dir = x > 0 ? -1 : 1;      // arm reaches toward the road
      const base = new THREE.Mesh(baseG, metal); base.position.y = 0.2; g.add(base);
      const pole = new THREE.Mesh(poleG, metal); pole.position.y = 2.8; g.add(pole);
      const arm = new THREE.Mesh(armG, metal); arm.position.set(dir * 0.6, 5.25, 0); g.add(arm);
      const head = new THREE.Mesh(headG, headMat); head.position.set(dir * 1.2, 5.2, 0); g.add(head);
      const pl = new THREE.PointLight(0xffd9a0, 16, 20, 1.8);
      pl.position.set(dir * 1.2, 5.0, 0); g.add(pl);
      g.position.set(x, 0, z);
      this.city.add(g);
      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(x - 0.25, 0, z - 0.25),
        new THREE.Vector3(x + 0.25, 5.0, z + 0.25)));
    };
    
	  // player spawns at z=45 and looks toward -z; fill the whole run
mkLamp(-8.6,  90);
mkLamp( 8.6,  72);
mkLamp(-8.6,  54);
mkLamp( 8.6,  36);
mkLamp(-8.6,  18);
mkLamp( 8.6,   0);
mkLamp(-8.6, -18);
mkLamp( 8.6, -36);
mkLamp(-8.6, -54);
mkLamp( 8.6, -72);
mkLamp(-8.6, -94);
  }

  // =========================================================
  // BASE LIGHTING — lift the night scene so nothing gameplay-
  // relevant needs the UV torch to be seen (UV stays reserved
  // for the one UV-only clue). No shadows: cheap fill only.
  // =========================================================
  _buildCityLights() {
    const hemi = new THREE.HemisphereLight(0x8a90c8, 0x1c1728, 0.85);
    this.city.add(hemi);
    const fill = new THREE.DirectionalLight(0x9fb2ff, 0.5);
    fill.position.set(-40, 60, 80);
    this.city.add(fill);
    // warm pool over the quay benches and cool pool at the dome;
    // the road itself is covered by the street lamps below
    for (const [color, i, d, x, y, z] of [
      [0xffc98a, 9, 13, 6.0, 2.8, 4.0],
      [0xbfd4ff, 9, 15, -42.0, 3.2, -16.0],
    ]) {
      const pl = new THREE.PointLight(color, i, d, 1.8);
      pl.position.set(x, y, z);
      this.city.add(pl);
    }
  }

  // =========================================================
  // WATERFRONT — public benches, a quay railing and the boats
  // out on the water (sea level is y -6, east of x 10.5)
  // =========================================================
  _buildWaterfront() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x3d2c1c, roughness: 0.9 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.5, metalness: 0.6 });

    // bench seats along Z so the sitter faces the water (+X);
    // seat top at 0.45 to match the seated pose
    const makeBench = (x, z) => {
      const b = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 1.8), wood);
      seat.position.y = 0.41; b.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.8), wood);
      back.position.set(-0.28, 0.7, 0); b.add(back);
      const supG = new THREE.BoxGeometry(0.5, 0.37, 0.12);
      for (const sz of [-0.7, 0.7]) {
        const sup = new THREE.Mesh(supG, woodDark);
        sup.position.set(0, 0.185, sz); b.add(sup);
      }
      b.position.set(x, 0, z);
      this.city.add(b);
      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(x - 0.4, 0, z - 1.0),
        new THREE.Vector3(x + 0.4, 0.9, z + 1.0)));
      return b;
    };

    // Anele's bench, plus an empty one further along the quay
    // (id spelling: the cast normalises 'anale' -> 'anele'; accept either)
    const an = this.npcs.find((n) => n.id === 'anele' || n.id === 'anale') || this.npcs[1];
    makeBench(an.pos.x, an.pos.z);
    makeBench(6.8, 10.5);

    // quay railing: posts + two bars at x 7.4, z -6..14
    const rail = new THREE.Group();
    const postG = new THREE.BoxGeometry(0.08, 1.05, 0.08);
    for (let z = -6; z <= 14; z += 2) {
      const p = new THREE.Mesh(postG, iron);
      p.position.set(7.4, 0.525, z); rail.add(p);
    }
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 20), iron);
    topBar.position.set(7.4, 1.0, 4); rail.add(topBar);
    const midBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 20), iron);
    midBar.position.set(7.4, 0.6, 4); rail.add(midBar);
    this.city.add(rail);
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(7.3, 0, -6), new THREE.Vector3(7.5, 1.1, 14)));

    // ---- boats riding at sea level (y -6), gently bobbing ----
    this.boats = [];
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x27333d, roughness: 0.7 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xd9d4c4, roughness: 0.8 });
    const winMat = new THREE.MeshStandardMaterial({
      color: 0xffc27a, emissive: 0xffbe78, emissiveIntensity: 1.6 });

    const mkBoat = (x, z, rotY, phase) => {
      const b = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 5.0), hullMat);
      hull.position.y = 0.45; b.add(hull);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 5.2), trimMat);
      rim.position.y = 1.0; b.add(rim);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.6), trimMat);
      cab.position.set(0, 1.5, -0.5); b.add(cab);
      const lampM = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), winMat);
      lampM.position.set(0, 1.6, 0.35); b.add(lampM);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.0, 8), trimMat);
      mast.position.set(0, 2.4, -0.5); b.add(mast);
      b.position.set(x, -6, z); b.rotation.y = rotY;
      b.userData = { baseY: -6, phase, bobF: 0.8, bobA: 0.15 };
      this.city.add(b); this.boats.push(b);
    };
    mkBoat(26, -4, 0.4, 0);
    mkBoat(34, 22, -0.5, 2.1);

    // distant ship: dark hull, lit window strip, funnel
    const s = new THREE.Group();
    const sHull = new THREE.Mesh(new THREE.BoxGeometry(7, 3.5, 24), hullMat);
    sHull.position.y = 1.35; s.add(sHull);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.5, 18), winMat);
    strip.position.y = 2.6; s.add(strip);
    const castle = new THREE.Mesh(new THREE.BoxGeometry(5, 2.5, 4), trimMat);
    castle.position.set(0, 4.2, -8); s.add(castle);
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 2.5, 10), hullMat);
    funnel.position.set(0, 6, -8); s.add(funnel);
    s.position.set(75, -6, -45); s.rotation.y = 0.25;
    s.userData = { baseY: -6, phase: 1.2, bobF: 0.5, bobA: 0.2 };
    this.city.add(s); this.boats.push(s);
  }

  // =========================================================
  // TRAFFIC — low-poly cars passing on the road (ambient only:
  // no collision, no interaction, left-hand traffic)
  // =========================================================
  _buildTraffic() {
    this.cars = [];
    const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14);
    wheelGeo.rotateZ(Math.PI / 2);                 // axle along X: spin via rotation.x
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.9 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.2, metalness: 0.6 });
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xfff2c0, emissive: 0xffedb5, emissiveIntensity: 4 });
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff2a1a, emissive: 0xff2015, emissiveIntensity: 3 });
    const tyreG = wheelGeo;

    const mkCar = (color, laneX, z0, speed, dir) => {
      const g = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 3.9), bodyMat);
      body.position.y = 0.62; g.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2.0), glassMat);
      cabin.position.set(0, 1.12, -0.2); g.add(cabin);
      const wheels = [];
      for (const [wx, wz] of [[-0.82, 1.3], [0.82, 1.3], [-0.82, -1.3], [0.82, -1.3]]) {
        const w = new THREE.Mesh(tyreG, wheelMat);
        w.position.set(wx, 0.33, wz); g.add(w); wheels.push(w);
      }
      const hlG = new THREE.BoxGeometry(0.28, 0.14, 0.06);
      for (const sx of [-0.55, 0.55]) {            // headlights (local +Z = front)
        const hl = new THREE.Mesh(hlG, headMat);
        hl.position.set(sx, 0.66, 1.96); g.add(hl);
        const tl = new THREE.Mesh(hlG, tailMat);   // taillights
        tl.position.set(sx, 0.66, -1.96); g.add(tl);
      }
      g.position.set(laneX, 0, z0);
      if (dir < 0) g.rotation.y = Math.PI;
      g.userData = { speed, dir, wheels };
      this.city.add(g);
      this.cars.push(g);
    };

    // east lane (+X) heads +Z, west lane heads -Z; staggered so they keep passing
    mkCar(0xc9a227, 2.5, -60, 9, 1);    // taxi
    mkCar(0x8c1f28, 2.5, 30, 11, 1);
    mkCar(0x3a3f45, 2.5, 110, 9.5, 1);
    mkCar(0x2b5f9e, -2.5, 60, 8, -1);
    mkCar(0x9aa0a8, -2.5, -20, 10, -1);
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
    // stub built here, but withheld until a crack tells you where to look
    const stubClue = this._addClue('stub', stub, [0.5, 0.3, 0.5], new THREE.Vector3(-7.0, 0.1, 39.5));
    stubClue.deferred = true;
    this.city.remove(stub);          // was added by _addClue — pull it back out
    this.city.remove(stubClue.hit);

    // faint proximity glints (harder than L1: no permanent auras)
    for (const c of this.clues) {
      if (c.deferred) continue;      // a withheld clue gets no glow either
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
  // PHOTO CAMERA — [Q] raise, wheel zoom, click shoot.
  // Targets: every witness (kind 'person', tag 'killer' for the real one, never
  // shown to the player) and every clue not yet collected.
  // =========================================================
  _buildCamera() {
    this._ptargets = [];
    for (const n of this.npcObjs) {
      this._ptargets.push({
        id: n.id, name: n.name, kind: 'person', radius: 0.45,
        tag: n.guilty ? 'killer' : null,
        getPos: (v) => v.set(n.pos.x, n.sitting ? 1.15 : 1.5, n.pos.z),
      });
    }
    for (const c of this.clues) {
      this._ptargets.push({
        id: c.id, name: c.def.name, kind: 'evidence', radius: 0.3, clue: c,
        getPos: (v) => v.set(c.pos.x, 0.2, c.pos.z),
      });
    }
    this.photoCam = new PhotoCamera({
      scene: this.scene,
      renderer: this.renderer,
      getTargets: () => this._ptargets.filter((t) => !t.clue || (!t.clue.found && !t.clue.deferred)),
      getColliders: () => this.colliders,
      isBlocked: () => !!(window.__uiCapture || this.dialogueOpen || this.caseOpen || this.suspectsOpen || this.verdictOpen),
      clockLabel: () => {
        const m = Math.floor(this.time / 60), sec = Math.floor(this.time % 60);
        return `T+${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      },
      onPhoto: (photo) => this._onPhoto(photo),
    });
    if (!this.renderer) console.warn('CityLevel: no renderer was passed, photos will be blank');
  }

  _onPhoto(photo) {
    const sharpPeople = photo.subjects.filter((s) => s.kind === 'person' && s.sharp);
    const sharpAny = photo.subjects.some((s) => s.sharp);
    if (!sharpAny) getStats().wastedFilm++;
    sfx('collect');
    // metadata only (the pictures stay in memory) so Continue keeps the record
    window.__caseProgress = window.__caseProgress || { l1: {} };
    const rec = window.__caseProgress.photos = window.__caseProgress.photos || [];
    rec.push({ id: photo.id, time: photo.time, subjects: photo.subjects.map((s) => ({ id: s.id, kind: s.kind, tag: s.tag, sharp: s.sharp, dist: s.dist })) });
    const left = this.photoCam.film;
    if (sharpPeople.length) this._toast(`PHOTO ${photo.id} — ${sharpPeople.map((s) => s.name).join(', ')}`, `${left} shots left`, 2500);
    else if (sharpAny) this._toast(`PHOTO ${photo.id} — EVIDENCE`, `${left} shots left`, 2500);
    else this._toast(`PHOTO ${photo.id} — NOTHING IN FOCUS`, 'Centre the subject in the frame and get closer (zoom helps at range).', 3500);
    this._updateCounter();
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
    ui.flash = mk('div', 'position:fixed;inset:0;pointer-events:none;z-index:49;opacity:0;', ui.root);
    ui.prompt = mk('div', 'position:absolute;left:50%;bottom:22%;transform:translateX(-50%);font-size:15px;letter-spacing:1px;text-shadow:0 1px 3px #000;display:none;', ui.root);
    ui.counter = mk('div', 'position:absolute;left:18px;top:16px;font-size:13px;letter-spacing:1px;opacity:.85;', ui.root, '');
    ui.trust = mk('div', 'position:absolute;left:18px;top:64px;font-size:13px;letter-spacing:1px;opacity:.85;', ui.root, '');
    ui.uvTag = mk('div', 'position:absolute;right:18px;top:224px;font-size:13px;letter-spacing:2px;color:#b58cff;display:none;text-shadow:0 0 10px #7a3cff;', ui.root, 'UV LAMP ON');
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
    const film = this.photoCam ? `${this.photoCam.film}/${PHOTO.film}` : `${PHOTO.film}/${PHOTO.film}`;
    this.ui.counter.innerHTML = `WITNESSES QUESTIONED ${qn}/5 &nbsp;·&nbsp; CITY EVIDENCE ${cn}/3 &nbsp;·&nbsp; FILM ${film}<br><span style="opacity:.6">[Q] camera · wheel zoom · click shoot</span>`;
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

_brightenStreet() {
  // warm sky fill so the whole length of the road reads
  const warm = new THREE.HemisphereLight(0xb0b8e0, 0x2a2038, 1.3);
  this.city.add(warm);

  // soft over-the-shoulder sun so silhouettes cast and volumes read
  const sun = new THREE.DirectionalLight(0xffe0b0, 0.65);
  sun.position.set(30, 70, 20);
  sun.target.position.set(0, 0, 20);
  sun.castShadow = false;
  this.city.add(sun, sun.target);

  // emissive kerb strips — the visual cue that there IS a road at night
  const kerb = new THREE.MeshStandardMaterial({
    color: 0x151a26, emissive: 0xffca80, emissiveIntensity: 0.55, roughness: 0.9
  });
  for (const sx of [-8.3, 8.3]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 240), kerb);
    s.position.set(sx, 0.03, 0);
    s.userData.noShadow = true;
    this.city.add(s);
  }
}

  // =========================================================
  // DIALOGUE
  // =========================================================
  _openDialogue(npc) {
    this.currentNpc = npc;
    this.dialogueOpen = true;
    this.presentMode = false;
    window.__uiCapture = true;           // main.js stops feeding keys to movement
    if (document.exitPointerLock) document.exitPointerLock();
    this._renderDialogue();
    this.ui.dialogue.style.display = 'block';
  }

  _renderDialogue() {
    const npc = this.currentNpc;
    if (!npc) return;
    if (this.presentMode) return this._renderEvidencePicker();

    // Evidence-gated follow-ups are NOT listed as questions — the player must
    // choose to present that evidence (see _renderEvidencePicker). Only
    // 'always'/'b:' follow-ups remain askable directly — unless a cracked
    // story (_reopen) has opened that question up to be asked outright.
    const asks = npc.follow.filter((f) => this._reqOk(f.req) &&
      (f.req === 'always' || f.req.startsWith('b:') || npc._reopen));
    const items = [
      { q: 'Where were you last night, 22:00 to 01:00?', key: 'where' },
      { q: 'What was your relationship with Dr. Nkosi?', key: 'relate' },
      { q: 'Tell him: Dr. Nkosi was found dead.', key: 'react' },
      ...asks.map((f) => ({ q: f.q, key: `f${npc.follow.indexOf(f)}` })),
      { q: 'Present evidence from the case file…', key: '__present' },
    ];
    npc._items = items;
    const hist = npc.history || (npc.history = []);
    const cracks = npc.cracks ? ` &nbsp;·&nbsp; <span style="color:#f2b84b">${npc.cracks} contradiction${npc.cracks > 1 ? 's' : ''} cracked</span>` : '';
    this.ui.dialogue.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
        <b style="letter-spacing:2px;color:#f2b84b">${npc.name.toUpperCase()} — ${npc.role.toUpperCase()}${cracks}</b>
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
      const present = it.key === '__present';
      b.style.cssText = present
        ? 'font:inherit;text-align:left;padding:7px 12px;background:#241d10;color:#f2b84b;border:1px solid #f2b84b66;cursor:pointer'
        : 'font:inherit;text-align:left;padding:7px 12px;background:#141a24;color:#e9d9b0;border:1px solid #33405266;cursor:pointer';
      b.innerHTML = `<b style="color:#7fd4ff">${i + 1}.</b> ${it.q}`;
      b.addEventListener('click', () => this._ask(i));
      qs.appendChild(b);
    });
    const log = this.ui.dialogue.querySelector('#dlg-log');
    if (log) log.scrollTop = log.scrollHeight;
  }

  // The evidence-picker: everything the player has logged, offered as proof
  // against the witness currently being questioned.
  _renderEvidencePicker() {
    const npc = this.currentNpc;
    const items = this._evidenceList();
    const hist = npc.history || [];
    this.ui.dialogue.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
        <b style="letter-spacing:2px;color:#f2b84b">${npc.name.toUpperCase()} — PRESENT EVIDENCE</b>
        <span style="font-size:12px;opacity:.7">${items.length <= 9 ? '[1-' + items.length + '] present · ' : ''}[Esc] back to questions</span>
      </div>
      <div id="dlg-log" style="font-size:14px;line-height:1.55;margin-bottom:12px;max-height:22vh;overflow:auto">
        ${hist.length ? hist.map((h) => `<p style="margin:0 0 10px"><i style="color:#9fb2cc">▸ ${h.q}</i><br>${h.a}</p>`).join('')
        : `<p style="margin:0;color:#9fb2cc">Choose what to put in front of them. The right document cracks a lie; the wrong one costs you.</p>`}
      </div>
      <div id="dlg-qs" style="display:flex;flex-direction:column;gap:6px"></div>`;
    const qs = this.ui.dialogue.querySelector('#dlg-qs');
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.style.cssText = 'font:inherit;text-align:left;padding:7px 12px;background:#141a24;color:#e9d9b0;border:1px solid #33405266;cursor:pointer';
      b.innerHTML = `${i < 9 ? `<b style="color:#f2b84b">${i + 1}.</b> ` : ''}${it.name} <span style="opacity:.5;font-size:12px">— ${it.from === 'l1' ? 'the office' : 'the city'}</span>`;
      b.addEventListener('click', () => this._presentEvidence(it));
      qs.appendChild(b);
    });
    if (!items.length) {
      const p = document.createElement('p');
      p.style.cssText = 'opacity:.6;font-size:13px;margin:0';
      p.textContent = 'Your case file is empty.';
      qs.appendChild(p);
    }
    const log = this.ui.dialogue.querySelector('#dlg-log');
    if (log) log.scrollTop = log.scrollHeight;
  }

  _evidenceList() {
    const list = [];
    const prog = window.__caseProgress && window.__caseProgress.l1;
    for (const id of Object.keys(CASE.clues)) if (!prog || prog[id]) list.push({ id, from: 'l1', name: CASE.clues[id].name });
    for (const id of Object.keys(this.collected)) list.push({ id, from: 'c', name: CITY_CLUES[id].name });
    return list;
  }

  // Show one piece of evidence to the current witness. If a follow-up is
  // gated on exactly this evidence, it cracks open; otherwise the witness
  // deflects and the run takes a rank penalty.
  _presentEvidence(it) {
    const npc = this.currentNpc;
    if (!npc || !it) return;
    let idx = -1;
    for (let i = 0; i < npc.follow.length; i++) {
      const f = npc.follow[i];
      if (f.req === `${it.from}:${it.id}` && !npc.asked['f' + i]) { idx = i; break; }
    }
    if (idx >= 0) {
      npc.cracks = (npc.cracks || 0) + 1;
      sfx('crack');
      this._flash('rgba(242,184,75,.35)');
      const f = npc.follow[idx];
      if (f.route) this._applyRoute(f.route, npc);
      this._answerItem(npc, { q: npc.follow[idx].q, key: 'f' + idx });
      return;
    }
    getStats().falsePresentations++;
    sfx('deflect');
    this._flash('rgba(161,36,28,.35)');
    const lines = [
      'They look at it, then back at you. "And? Should that mean something to me?"',
      '"You are waving paper at the wrong person, detective."',
      'A slow headshake. "That proves nothing about me."',
    ];
    npc.history.push({ q: `Shown: ${it.name}`, a: lines[(Math.random() * lines.length) | 0] });
    this._renderDialogue();
  }

  _flash(color) {
    const f = this.ui.flash;
    if (!f) return;
    f.style.transition = 'none';
    f.style.background = color;
    f.style.opacity = '0.3';
    requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = '0'; });
  }

  _ask(i) {
    const npc = this.currentNpc;
    const it = npc._items[i];
    if (!it) return;
    if (it.key === '__present') { this.presentMode = true; this._renderDialogue(); return; }
    this._answerItem(npc, it);
  }

  _answerItem(npc, it) {
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
    this.presentMode = false;
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
  // CASE BOARD — strings from evidence to mugshots; the
  // captain decides what the paper supports; a granted
  // warrant authorises the stakeout (the depot, 14:00).
  // =========================================================
  _saveState() {
    window.__caseProgress = window.__caseProgress || { l1: {} };
    // _onPhoto() writes the metadata record straight to __caseProgress —
    // keep this.state.photos pointing at it instead of clobbering it
    this.state.photos = window.__caseProgress.photos || this.state.photos;
    window.__caseProgress.board = this.state.board;
    window.__caseProgress.trust = this.state.trust;
    window.__caseProgress.held = this.state.held;
    window.__caseProgress.warrants = this.state.warrants;
    window.__caseProgress.photos = this.state.photos;
    if (typeof window.__saveRun === 'function') window.__saveRun();
  }

  _refreshTrustHud() {
    if (!this.ui || !this.ui.trust || !this.state) return;
    const t = this.state.trust;
    const links = Object.values(this.state.board).reduce((a, b) => a + b.length, 0);
    this.ui.trust.innerHTML =
      `TRUST <span style="color:#f2b84b">${'●'.repeat(t)}</span><span style="opacity:.3">${'○'.repeat(Math.max(0, 3 - t))}</span>` +
      ` &nbsp;·&nbsp; LINKS ${links}`;
  }

  _openBoard() { this.board.open(); }

  _offerStakeout(id) {
    const s = this.npcs.find((n) => n.id === id);
    this._toast('WARRANT SIGNED',
      `A stakeout is authorised on ${s ? s.name : id}. Go to the depot at 14:00.  [Y] accept · [N] keep investigating`,
      12000);
    this._stakeoutTarget = id;
  }

  _reassigned() {
    // Captain took the file. Level 3 will start with a worse hand.
    this._toast('CASE REASSIGNED',
      'The captain has taken the file. The cells will still hear you — but you will not be signing anything.',
      12000);
    window.__caseProgress = window.__caseProgress || { l1: {} };
    window.__caseProgress.reassigned = true;
    this._saveState();
  }

  // A cracked follow-up can carry a route: reveal a hidden clue, name
  // another witness, or unlock a question the person was sitting on.
  _applyRoute(route, fromNpc) {
    if (route.spawn && !this.collected[route.spawn]) {
      // re-show the clue the level built but hid, if it was deferred
      const clue = this.clues.find((c) => c.id === route.spawn);
      if (clue && clue.deferred) {
        clue.deferred = false;
        this.city.add(clue.group); this.city.add(clue.hit);
      }
      this._toast('A LEAD OPENS', route.hint || 'Something you were told points at a place.', 9000);
      this.logs.extra.push(`${fromNpc.name} → ${route.hint || 'a place worth looking at'}`);
    }
    if (route.witness) {
      this.logs.extra.push(`${fromNpc.name} names ${route.witness} — worth finding.`);
      this._toast('A NAME', route.hint || `${route.witness} knows something.`, 9000);
    }
    if (route.requestion) {
      const t = this.npcs.find((n) => n.id === route.requestion);
      if (t) {
        t._reopen = true;               // evidence-gated follows become askable directly
        this.logs.extra.push(route.hint ? `${fromNpc.name} — ${route.hint}` : `${fromNpc.name} says ${t.name} is holding back.`);
      }
    }
    if (route.hint && !route.spawn && !route.witness) {
      this.logs.extra.push(route.hint);
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
    // Lab dossier handoff: the two names + facts Level 2 produced.
    const lab = (window.__caseProgress && window.__caseProgress.lab) || null;
    const labHtml = lab
      ? `<h3>THE LAB — DOSSIER (${(lab.names || []).length} NAMES)</h3><ul>` +
        `<li><b>Names:</b> ${(lab.names || []).join(' · ') || '—'} — one killed him, one ran. The lab cannot say which.</li>` +
        `<li><b>Weapon:</b> ${lab.weapon || '—'}</li>` +
        `<li><b>Window:</b> ${lab.window || '—'}</li>` +
        `<li><b>Depot:</b> ${lab.depot || '—'}</li>` +
        `<li><b>Temperament:</b> ${lab.temperament || '—'}</li>` +
        `<li><b>Memo:</b> ${lab.memo || '—'}</li></ul>`
      : '<h3>THE LAB — DOSSIER</h3><ul><li style="opacity:.5">No lab dossier on file (arrived without Level 2).</li></ul>';

    const btnState = this.allQuestioned
      ? '<button id="sf-go" style="font:inherit;letter-spacing:1px;padding:12px 26px;background:#a1241c;color:#fff;border:0;cursor:pointer">Compile the suspect list — three names &rarr;</button>'
      : `<button disabled style="font:inherit;letter-spacing:1px;padding:12px 26px;background:#2a2f3a;color:#8b93a3;border:0">Suspect list — locked (question all 5 witnesses: ${this.npcObjs.filter((n) => n.questioned).length}/5)</button>`;

    this.ui.case.innerHTML = `
      <div style="max-width:min(980px,94vw);margin:4vh auto;font-family:'Courier New',monospace;color:#e9d9b0;padding-bottom:6vh">
        <h2 style="letter-spacing:4px;color:#f2b84b">CASE FILE #001 — <span style="color:#7fd4ff">THE CITY</span></h2>
        <p><b>VICTIM:</b> ${CASE.victim} — ${CASE.role}. ${CASE.found}. One gunshot, left chest, at close range.</p>
        <h3>THE OFFICE — EVIDENCE LOGGED (${l1Keys.length})</h3><ul>${l1Html}</ul>
        ${labHtml}
        <h3>THE CITY — EVIDENCE LOGGED (${Object.keys(this.collected).length}/3)</h3><ul>${cityHtml}</ul>
        <h3>STATEMENTS — WHERE THEY WERE</h3><ul>${li(this.logs.statements)}</ul>
        <h3>RELATIONSHIPS WITH THE VICTIM</h3><ul>${li(this.logs.relationships)}</ul>
        <h3>REACTIONS ON HEARING OF DEATH</h3><ul>${li(this.logs.reactions)}</ul>
        <h3>CONTRADICTIONS & LEADS</h3><ul>${li(this.logs.extra)}</ul>
        <h3>PHOTOGRAPHS (${this.photoCam ? this.photoCam.photos.length : 0}/${PHOTO.film})</h3><ul>${li(this._photoLines())}</ul>
        <div style="margin-top:18px">${btnState}</div>
        <p style="opacity:.6;margin-top:14px">[C] close — read it as often as you like; the witnesses remember you.</p>
      </div>`;
    this.ui.case.style.display = 'flex';
    const go = this.ui.case.querySelector('#sf-go');
    if (go) go.addEventListener('click', () => { this._closeCase(); this._openSuspects(); });
  }

  _photoLines() {
    if (!this.photoCam) return [];
    return this.photoCam.photos.map((p) => {
      const who = p.subjects.map((s) => `${s.name || s.id}${s.sharp ? '' : ' (soft)'}`);
      return `#${p.id} ${p.time}: ${who.length ? who.join(', ') : 'nothing in frame'}`;
    });
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
        <p>Name the three who will be brought in for Dr. Nkosi's death. There is no second list. Whoever you leave off walks free, and whoever you bring in will be questioned in the cells.</p>
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

    // hand the picks and the record of who was questioned to Level 3
    window.__caseProgress = window.__caseProgress || { l1: {} };
    window.__caseProgress.picks = picks.slice();
    window.__caseProgress.questioned = this.npcObjs.filter((n) => n.questioned).map((n) => n.id);
    window.__caseProgress.city = Object.assign({}, window.__caseProgress.city, this.collected);

    const nameOf = (id) => (this.npcs.find((n) => n.id === id) || { name: id }).name;

    this.ui.verdict.innerHTML = `
      <h2 style="letter-spacing:4px;color:#f2b84b;max-width:80vw">THE LIST IS SEALED</h2>
      <p style="max-width:min(720px,88vw);line-height:1.7;font-size:16px">
        ${picks.map(nameOf).join(', ')} will be taken to the station and put in the cells.<br><br>
        Everyone else is free to go. There is no second list.
      </p>
      <div style="margin-top:26px">
        <button id="vd-go" style="font:inherit;padding:12px 26px;background:#a1241c;color:#fff;border:0;cursor:pointer">Take them in &rarr;</button>
      </div>`;
    this.ui.verdict.style.display = 'flex';

    const go = this.ui.verdict.querySelector('#vd-go');
    if (go) go.addEventListener('click', () => {
      // Three levels only: the street hands straight to the depot stakeout.
      if (typeof window.__switchLevel === 'function') window.__switchLevel('depot');
      else this._closeVerdict();
    });
  }

  _closeVerdict() {
    this.verdictOpen = false;
    window.__uiCapture = false;
    this.ui.verdict.style.display = 'none';
  }

  _restart() {
    if (typeof window.__switchLevel === 'function') window.__switchLevel(3);
    else this._closeVerdict();
  }

  // =========================================================
  // INPUT
  // =========================================================
  _handleKey(e) {
    if (e.repeat) return;
    // the board and the captain own their overlays
    if ((this.board && this.board.open_) || (this.captain && this.captain.open_)) return;
    if (this.verdictOpen) return;
    if (this.caseOpen) { if (e.code === 'KeyC' || e.code === 'Escape') this._closeCase(); return; }
    if (this.suspectsOpen) { if (e.code === 'Escape') this._closeSuspects(); return; }
    if (this.dialogueOpen) {
      const m = e.code.match(/^Digit([1-9])$/);
      if (m) {
        if (this.presentMode) this._presentEvidence(this._evidenceList()[Number(m[1]) - 1]);
        else this._ask(Number(m[1]) - 1);
        return;
      }
      if (this.presentMode && e.code === 'Escape') { this.presentMode = false; this._renderDialogue(); return; }
      if (e.code === 'KeyE' || e.code === 'Escape' || e.code === 'KeyC') this._closeDialogue();
      return;
    }
    if (e.code === 'KeyB' && !this.dialogueOpen && !this.caseOpen) { this._openBoard(); return; }
    if (e.code === 'KeyY' && this._stakeoutTarget) {
      window.__caseProgress = window.__caseProgress || { l1: {} };
      window.__caseProgress.stakeoutTarget = this._stakeoutTarget;
      if (typeof window.__switchLevel === 'function') window.__switchLevel('depot');
      return;
    }
    if (e.code === 'KeyN' && this._stakeoutTarget) { this._stakeoutTarget = null; return; }
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
      else if (f.post) this._openPost();
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
    window.__caseProgress = window.__caseProgress || { l1: {} };
    window.__caseProgress.city = window.__caseProgress.city || {};
    window.__caseProgress.city[c.id] = true;
    c.hit.userData = {};                    // no longer interactable
    this.city.remove(c.hit);
    if (c.glint) this.city.remove(c.glint.mesh);
    sfx('collect');
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
    for (const c of this.clues) if (!c.found && !c.deferred) targets.push(c.hit);
    if (this._postHit) targets.push(this._postHit);
    const hits = this._rc.intersectObjects(targets, false);
    if (!hits.length) { this.ui.prompt.style.display = 'none'; return; }
    // smallest target wins (car post sits near NPC/clue boxes)
    const vol = (o) => {
      const p = (o.geometry && o.geometry.parameters) || {};
      return ((p.width || 1) * (p.height || 1) * (p.depth || 1));
    };
    hits.sort((a, b) => vol(a.object) - vol(b.object));
    const ud = hits[0].object.userData;
    if (ud.npc) {
      this.focus = { npc: ud.npc };
      this.ui.prompt.textContent = `[E] Question — ${ud.npc.name}`;
      this.ui.prompt.style.display = 'block';
    } else if (ud.post) {
      this.focus = { post: true };
      this.ui.prompt.textContent = `[E] Stakeout car — dossier & radio`;
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
    if (this.ride && this.ride.active) {
      if (player) this._ridePlayer = player;
      this._updateRide(dt);
    } else {
      if (hasCam && player && player.pos) this._applyFirstPerson(player);
    }
    if (this.photoCam) this.photoCam.update(dt, this.time);

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

    // ambient traffic: loop along the road, spin the wheels
    if (this.cars) {
      for (const c of this.cars) {
        const u = c.userData;
        c.position.z += u.dir * u.speed * dt;
        if (c.position.z > 138) c.position.z = -138;
        else if (c.position.z < -138) c.position.z = 138;
        for (const w of u.wheels) w.rotation.x -= (u.speed * dt) / 0.33;
      }
    }

    // boats ride the swell
    if (this.boats) {
      for (const b of this.boats) {
        const u = b.userData;
        b.position.y = u.baseY + Math.sin(this.time * u.bobF + u.phase) * u.bobA;
        b.rotation.z = Math.sin(this.time * u.bobF * 0.8 + u.phase) * 0.02;
      }
    }

    const overlay = this.caseOpen || this.dialogueOpen || this.suspectsOpen || this.verdictOpen;
    if (overlay) { this.ui.prompt.style.display = 'none'; this.focus = null; }
    else if (hasCam && !(this.ride && this.ride.active)) this._updateFocus(cam);
    else if (this.ride && this.ride.active) { this.ui.prompt.style.display = 'none'; this.focus = null; }
  }

  _updateRide(dt) {
    const r = this.ride;
    const cam = window.__camera;
    if (!cam || !cam.isCamera) return;
    r.t += dt;
    const k = Math.min(1, r.t / r.dur);
    const e = k * k * (3 - 2 * k);
    cam.position.lerpVectors(r.from, r.to, e);
    cam.rotation.order = 'YXZ';
    const pan = Math.sin(r.t * 0.25) * 6;
    cam.lookAt(r.look.x + pan, r.look.y, r.look.z);
    if (r.ui) {
      const cap = r.ui.querySelector('.ride-cap');
      while (r.shown < r.lines.length && r.t >= r.lines[r.shown][0]) {
        if (cap) cap.textContent = r.lines[r.shown][1];
        r.shown++;
      }
    }
    if (k >= 1) {
      const p = this._ridePlayer;
      if (p && p.pos) {
        p.pos.set(this._parkedAt.x - 2.5, 0, this._parkedAt.z + 1);
        p.vel.set(0, 0, 0);
        p.yaw = Math.PI / 2 - 0.3;   // face the street from the car
        p.pitch = 0;
      }
      this._endRide(false);
    }
  }

  // =========================================================
  // DISPOSE
  // =========================================================
  dispose() {
    clearTimeout(this._toastTimer);
    if (this.ride && this.ride.ui) { this.ride.ui.remove(); this.ride.ui = null; }
    if (this.board) { this.board.dispose(); this.board = null; }
    if (this.captain) { this.captain.dispose(); this.captain = null; }
    if (this.photoCam) { this.photoCam.dispose(); this.photoCam = null; }
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
