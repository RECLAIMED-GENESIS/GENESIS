// ============================================================
// LabExtras.js — adds to LabLevel (installed by LabLevel.js):
//   1. A properly dressed lab: chemical cabinet, fume hood, fridge, sink +
//      eyewash, prep counter (centrifuge, pipettes, balance), whiteboard,
//      gas cylinders, biohazard bin, posters, lab coats.
//   2. The phone crack: an examiner LAPTOP with a real terminal. You dump
//      the lock hash from the cabled handset and crack it with hashcat
//      yourself, then walk to the phone and type the PIN.
//   3. Every bench action is a physical prop you use with [E] — no more
//      bench panels with buttons: strand + cover slip, guest glass under
//      the wand, linen + lysis tube + cartridge + sequencer buttons,
//      trail prints, casing tray, and a clipboard at each bench
//      for filing the report.
// ============================================================
import * as THREE from 'three';
import { dressFridge, interactAppliance, dnaCanRun } from './LabAppliances.js';
import { SUSPECTS, IDS } from '../game/case.js';
import { getStats } from '../game/stats.js';
import { play as sfx } from '../audio/sfx.js';

const PIN_HASH = 'a14ac55a4f27472c5d894ec1c3c743d2';   // md5("1610")
const PS = 'analyst@examiner-01:~$ ';

const CHEMS = [
  ['ETHANOL 95%', 0xdfe9ee, 'Flammable. Precipitates DNA. Tonight\u2019s cartridge kit does not need it.'],
  ['ACETONE', 0xe8eef0, 'Degreaser and solvent. It also eats gloves \u2014 never near the evidence.'],
  ['ISOPROPANOL 70%', 0xe4ecee, 'Bench wipe-down between exhibits. Cross-contamination is how cases die.'],
  ['METHANOL', 0xd8e4ea, 'Toxic and flammable. Stays in the cabinet.'],
  ['LUMINOL', 0x8fb4ff, 'Presumptive blood test \u2014 glows blue. The stains here are already visible.'],
  ['PHENOLPHTHALEIN', 0xf0b6d8, 'Kastle\u2013Meyer reagent: turns pink when blood is present.'],
  ['NINHYDRIN', 0xe8a060, 'Develops prints on paper. Keep it away from the scene exhibits unless an examination calls for it.'],
  ['CYANOACRYLATE', 0xe6e6c8, 'Superglue fuming for latent prints on non-porous surfaces.'],
  ['SODIUM HYPOCHLORITE 10%', 0xe8e6a8, 'Bleach. Decontaminates the benches after biological work.'],
  ['LYSIS BUFFER', 0xb8d8a8, 'Breaks open cells to release DNA. Tonight\u2019s tube already has its dose.'],
  ['TBE BUFFER 1X', 0xbcd0e8, 'Running buffer for electrophoresis. Cartridge systems hide it from you.'],
  ['PROTEINASE K', 0xd8d0b8, 'Enzyme that digests proteins. Kept cold \u2014 this bottle is empty.'],
  ['DISTILLED H\u2082O', 0xe0f0ff, 'Just water. The most-used bottle in the building.'],
  ['HCl 1 M', 0xe8e8a0, 'Hydrochloric acid. Corrosive. Eyewash is by the sink.'],
  ['FORMALIN 10%', 0xd8d8d0, 'Tissue fixative. Not on tonight\u2019s list. Hopefully not on anybody\u2019s.'],
  ['GENTIAN VIOLET', 0x8a5ac8, 'Stains fibres and prints purple. A classic.'],
  ['HYDROGEN PEROXIDE 3%', 0xe6f0f4, 'Lifts old blood from fabric. Also bleaches evidence \u2014 careful.'],
  ['EVIDENCE TAPE (SEALED)', 0xe8c84a, 'Not a chemical. You are standing in the right place to need it.'],
];

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { tex: t, ctx: g, canvas: c };
}

const extras = {
  // ======================================================================
  // DRESSING
  // ======================================================================
  _bottle(parent, x, y, z, idx, faceRot) {
    const [name, col] = CHEMS[idx % CHEMS.length];
    const g = new THREE.Group(); g.position.set(x, y, z);
    const h = 0.22 + (idx % 3) * 0.07, r = 0.055 + (idx % 2) * 0.012;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.2, metalness: 0.05, transparent: true, opacity: 0.82 }));
    body.position.y = h / 2; g.add(body);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.04, 10), this._std(idx % 4 === 0 ? 0xa1241c : 0x1c1f25, 0.6, 0.1));
    cap.position.y = h + 0.02; g.add(cap);
    const lab = canvasTex(96, 64, (c, w, hh) => {
      c.fillStyle = '#f2efe4'; c.fillRect(0, 0, w, hh);
      c.fillStyle = idx % 5 === 0 ? '#a1241c' : '#1c222b'; c.fillRect(0, 0, w, 10);
      c.fillStyle = '#1c222b'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center';
      const words = name.split(' '); const mid = Math.ceil(words.length / 2);
      c.fillText(words.slice(0, mid).join(' '), w / 2, 30); c.fillText(words.slice(mid).join(' '), w / 2, 46);
    });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.75, h * 0.5), new THREE.MeshBasicMaterial({ map: lab.tex }));
    label.position.set(Math.sin(faceRot) * (r + 0.002), h * 0.5, Math.cos(faceRot) * (r + 0.002));
    label.rotation.y = faceRot; label.userData.noShadow = true; g.add(label);
    parent.add(g); return g;
  },

  _buildLabProps() {
    const L = this.level;
    const wood = this._std(0x78918b, 0.65, 0.08), steel = this._std(0x9aa3ad, 0.35, 0.7), white = this._std(0xe6e9ec, 0.5, 0.1);
    const dark = this._std(0x23272e, 0.6, 0.3);
    const block = (x0, x1, z0, z1, h = 2.4) => this.colliders.push(new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, h, z1)));

    // ---- chemical cabinet (east wall), bottles face the room (-x) ----
    const cab = new THREE.Group(); cab.position.set(9.6, 0, -0.4); L.add(cab);
    this._box(cab, 0.04, 2.1, 2.2, wood, 0.23, 1.05, 0);                       // back
    this._box(cab, 0.5, 2.1, 0.04, wood, 0, 1.05, -1.1); this._box(cab, 0.5, 2.1, 0.04, wood, 0, 1.05, 1.1);
    const shelfY = [0.25, 0.85, 1.45, 2.05];
    shelfY.forEach((y) => this._box(cab, 0.5, 0.04, 2.2, wood, 0, y, 0));
    this._cabHits = [];this._chemBottles=[];
    let bi = 0;
    [0.25, 0.85, 1.45].forEach((y, row) => {
      for (let i = 0; i < 6; i++) {
        this._chemBottles.push(this._bottle(cab, 0.02, y + 0.02, -0.9 + i * 0.36, bi++, -Math.PI / 2));
      }
      this._hit(9.6, y + 0.22, -0.4, 0.5, 0.5, 2.2, { kind: 'chemshelf', row, i: 0 });
    });
    block(9.35, 9.9, -1.5, 0.7, 2.1);

    // ---- fume hood (east wall) ----
    const hood = new THREE.Group(); hood.position.set(9.35, 0, -5.0); L.add(hood);
    this._box(hood, 0.9, 0.9, 1.5, white, 0.1, 0.45, 0);
    this._box(hood, 0.9, 0.05, 1.5, dark, 0.1, 0.925, 0);
    this._box(hood, 0.05, 1.5, 1.5, steel, 0.5, 1.7, 0);
    this._box(hood, 0.9, 0.05, 1.5, steel, 0.1, 2.45, 0);
    this._box(hood, 0.9, 1.5, 0.05, steel, 0.1, 1.7, -0.75); this._box(hood, 0.9, 1.5, 0.05, steel, 0.1, 1.7, 0.75);
    this._box(hood, 0.3, 0.9, 0.3, steel, 0.25, 2.9, 0);                         // duct
    const beaker = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 14), new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.45, roughness: 0.1 }));
    beaker.position.set(0.12, 1.05, -0.2); hood.add(beaker);
    const flask = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 14), new THREE.MeshStandardMaterial({ color: 0xf0d8a0, transparent: true, opacity: 0.55, roughness: 0.1 }));
    flask.position.set(0.1, 1.08, 0.25); hood.add(flask);
    this._hoodSash = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.05, 1.42),
      new THREE.MeshStandardMaterial({ color: 0xcfe8f4, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1 }));
    this._hoodSash.position.set(-0.32, 1.5, 0); hood.add(this._hoodSash);
    this._hoodOpen = false;
    this._hit(9.0, 1.5, -5.0, 0.5, 1.2, 1.5, { kind: 'hood' });
    block(8.9, 9.95, -5.8, -4.2, 2.5);

    // ---- fridge (west wall) with a swinging door ----
    const fr = new THREE.Group(); fr.position.set(-9.4, 0, -0.9); L.add(fr);
    this._box(fr, 0.04, 1.9, 0.7, white, -0.33, 0.95, 0);
    this._box(fr, 0.7, 1.9, 0.04, white, 0, 0.95, -0.33); this._box(fr, 0.7, 1.9, 0.04, white, 0, 0.95, 0.33);
    this._box(fr, 0.7, 0.04, 0.7, white, 0, 1.9, 0); this._box(fr, 0.7, 0.04, 0.7, white, 0, 0.02, 0);
    [0.5, 0.95, 1.4].forEach((y) => this._box(fr, 0.62, 0.025, 0.62, steel, 0, y, 0));
    this._fridgeDoor = new THREE.Group(); this._fridgeDoor.position.set(0.34, 0, -0.35); fr.add(this._fridgeDoor);
    this._box(this._fridgeDoor, 0.05, 1.86, 0.7, white, 0, 0.95, 0.35);
    this._box(this._fridgeDoor, 0.04, 0.5, 0.04, steel, 0.05, 1.1, 0.6);
    const tag = canvasTex(128, 64, (c, w, h) => {
      c.fillStyle = '#f6efd0'; c.fillRect(0, 0, w, h); c.fillStyle = '#a1241c'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center';
      c.fillText('BIOHAZARD', w / 2, 24); c.fillStyle = '#222'; c.font = '11px sans-serif'; c.fillText('CASE #001 SAMPLES', w / 2, 42); c.fillText('4\u00b0C \u2014 SIGN OUT', w / 2, 56);
    });
    const tagM = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), new THREE.MeshBasicMaterial({ map: tag.tex }));
    tagM.rotation.y = Math.PI / 2; tagM.position.set(0.08, 1.4, 0.35); tagM.userData.noShadow = true; this._fridgeDoor.add(tagM);
    this._fridgeOpen = false;
    dressFridge(this,fr);
    // The swung-open door leaves the cabinet hitbox, so the door itself is
    // clickable too — otherwise the fridge can be opened but not closed.
    this._fridgeDoor.traverse((o) => { if (o.isMesh) o.userData.interact = { kind: 'fridge' }; });
    this._hit(-9.05, 1.0, -0.9, 0.5, 1.8, 0.8, { kind: 'fridge' });
    block(-9.8, -9.05, -1.25, -0.55, 1.95);

    // ---- sink counter + eyewash (west wall) ----
    const sink = new THREE.Group(); sink.position.set(-9.6, 0, -5.4); L.add(sink);
    this._box(sink, 0.6, 0.78, 1.4, white, 0, 0.39, 0);
    for(const x of [-.26,.28])this._box(sink,.1,.04,1.42,dark,x,.92,0);
    this._box(sink,.46,.04,.22,dark,.01,.92,-.6);this._box(sink,.46,.04,.66,dark,.01,.92,.38);
    this._box(sink,.4,.02,.55,steel,.02,.83,-.25);
    for(const x of [-.18,.22])this._box(sink,.015,.1,.55,steel,x,.88,-.25);
    for(const z of [-.525,.025])this._box(sink,.4,.1,.015,steel,.02,.88,z);
    this._waterStream=new THREE.Mesh(new THREE.CylinderGeometry(.006,.009,.36,10),new THREE.MeshStandardMaterial({color:0xa6d4df,transparent:true,opacity:.55,roughness:.1}));
    this._waterStream.position.set(-.04,1.04,-.25);sink.add(this._waterStream);this._waterStream.visible=false;
    this._waterRipple=new THREE.Mesh(new THREE.RingGeometry(.025,.035,24),new THREE.MeshBasicMaterial({color:0xb9e1eb,transparent:true,opacity:.3,side:THREE.DoubleSide}));
    this._waterRipple.rotation.x=-Math.PI/2;this._waterRipple.position.set(-.04,.845,-.25);sink.add(this._waterRipple);this._waterRipple.visible=false;
    const fct = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), steel); fct.position.set(-0.2, 1.1, -0.25); sink.add(fct);
    this._box(sink, 0.18, 0.03, 0.03, steel, -0.12, 1.25, -0.25);
    const ew = new THREE.Group(); ew.position.set(-9.88, 1.15, -4.1); L.add(ew);
    this._box(ew, 0.12, 0.3, 0.5, this._std(0x2a9d6a, 0.5, 0.1), 0, 0, 0);
    for (const dz of [-0.12, 0.12]) { const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), white); hd.rotation.z = Math.PI / 2; hd.position.set(0.09, 0.05, dz); ew.add(hd); }
    this._hit(-9.5, 1.0, -4.8, 0.7, 0.9, 2.3, { kind: 'sink' });
    block(-9.95, -9.25, -6.15, -4.65, 1.0);

    // ---- prep counter (north wall): centrifuge, pipettes, balance, flasks ----
    const pc = new THREE.Group(); pc.position.set(-7.95, 0, -6.65); L.add(pc);
    this._box(pc, 2.7, 0.9, 0.6, wood, 0, 0.45, 0);
    this._box(pc, 2.74, 0.04, 0.64, dark, 0, 0.92, 0);
    for (let i = -3; i <= 3; i++) this._box(pc, 0.02, 0.8, 0.02, dark, i * 0.38, 0.45, 0.31);
    // centrifuge
    this._centri = new THREE.Group(); this._centri.position.set(-1.0, 0.94, 0); pc.add(this._centri);
    this._box(this._centri, 0.5, 0.22, 0.46, this._std(0xc5ccd4, 0.4, 0.4), 0, 0.11, 0);
    this._centriLid = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20), this._std(0x3a3f47, 0.4, 0.6));
    this._centriLid.position.set(0, 0.25, 0); this._centri.add(this._centriLid);
    this._rotor = new THREE.Group(); this._rotor.position.set(0, 0.235, 0); this._centri.add(this._rotor);
    this._rotor.visible = false;
    this._box(this._rotor, 0.34, 0.02, 0.04, steel, 0, 0, 0); this._box(this._rotor, 0.04, 0.02, 0.34, steel, 0, 0, 0);
    for(let i=0;i<4;i++){const angle=i*Math.PI/2;const tube=new THREE.Mesh(new THREE.CylinderGeometry(.025,.018,.045,12),this._std(0x548694));tube.position.set(Math.cos(angle)*.12,0,Math.sin(angle)*.12);this._rotor.add(tube);}
    this._centriSpin = 0;
    // pipette rack
    this._box(pc, 0.4, 0.04, 0.2, dark, -0.1, 0.96, 0.05);
    this._pipettes=[];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.3, 8), this._std([0xe8c84a, 0x2a5f80, 0xa1241c, 0x3fa87a][i], 0.5, 0.1));
      p.position.set(-0.24 + i * 0.09, 1.12, 0.05); pc.add(p);this._pipettes.push(p);
    }
    // balance
    this._box(pc, 0.32, 0.06, 0.26, this._std(0xd8dce0, 0.4, 0.4), 0.55, 0.97, 0);
    this._box(pc, 0.18, 0.012, 0.18, steel, 0.55, 1.015, 0);
    this._balDisp = this._box(pc, 0.12, 0.04, 0.02, this._std(0x0a141c, 0.3, 0.2), 0.55, 0.98, 0.14);
    this._balanceWeight=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,.07,16),steel);this._balanceWeight.position.set(.55,1.2,0);pc.add(this._balanceWeight);
    const balance=canvasTex(256,80,()=>{});this._balanceTex=balance.tex;
    this._balDisp.material=new THREE.MeshBasicMaterial({map:balance.tex});
    this._drawBalance=()=>{const g=balance.ctx;g.fillStyle='#112b29';g.fillRect(0,0,256,80);g.fillStyle='#b8e2c7';g.font='bold 45px monospace';g.fillText(this._balanceLoaded?'10.000 g':'0.000 g',10,57);balance.tex.needsUpdate=true;};this._drawBalance();
    // flasks
    for (let i = 0; i < 3; i++) {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 14), new THREE.MeshStandardMaterial({ color: [0xbfe6ff, 0xf0d8a0, 0xd8f0c8][i], transparent: true, opacity: 0.5, roughness: 0.1 }));
      fl.position.set(0.95 + i * 0.22, 1.06, -0.05); pc.add(fl);
    }
    this._hit(-8.95, 1.1, -6.65, 0.6, 0.45, 0.55, { kind: 'centrifuge' });
    this._hit(-8.1, 1.1, -6.6, 0.5, 0.5, 0.4, { kind: 'pipettes' });
    this._hit(-7.4, 1.0, -6.65, 0.4, 0.2, 0.4, { kind: 'balance' });
    block(-9.3, -6.6, -6.95, -6.35, 1.0);
    // wall shelf over the counter with more reagents
    const ws = new THREE.Group(); ws.position.set(-8.0, 1.75, -6.85); L.add(ws);
    this._box(ws, 2.6, 0.04, 0.26, wood, 0, 0, 0);
    for (let i = 0; i < 7; i++) this._chemBottles.push(this._bottle(ws, -1.1 + i * 0.36, 0.02, 0, 6 + i * 2, 0));
    this._hit(-8.0, 2.0, -6.8, 2.6, 0.5, 0.35, { kind: 'chemshelf', row: 3, i: 0 });

    // ---- whiteboard (south wall) ----
    const wb = canvasTex(768, 320, (c, w, h) => {
      c.fillStyle = '#f4f6f6'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#b8bec4'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
      c.fillStyle = '#1c3a8a'; c.font = 'bold 30px "Courier New",monospace'; c.fillText('CASE #001 \u2014 NKOSI, T.', 24, 48);
      c.fillStyle = '#222'; c.font = '22px "Courier New",monospace';
      ['23:19  locked Staff Common Room', '23:31  last msg: \u201ccoming up the back stairs\u201d', '00:50  found by the night cleaner',
        'ONE SHOT \u00b7 < 1 m \u00b7 9 mm'].forEach((t, i) => c.fillText(t, 24, 92 + i * 32));
      c.fillStyle = '#a1241c'; c.font = 'bold 22px "Courier New",monospace';
      c.fillText('6 EXHIBITS / 4 LAB REPORTS', 24, 248);
      c.fillStyle = '#2a7a4a'; c.font = '18px "Courier New",monospace'; c.fillText('shift ends 17:00 \u2014 sign every page', 24, 288);
      c.strokeStyle = '#a1241c'; c.lineWidth = 3; c.beginPath(); c.arc(640, 120, 70, 0, 7); c.stroke();
      c.fillStyle = '#a1241c'; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.fillText('?', 640, 140);
    });
    const wbM = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.33), new THREE.MeshBasicMaterial({ map: wb.tex }));
    wbM.position.set(-8.1, 1.85, 6.94); wbM.rotation.y = Math.PI; wbM.userData.noShadow = true; L.add(wbM);
    this._box(L, 3.3, 0.06, 0.06, steel, -8.1, 1.16, 6.9);
    this._hit(-8.1, 1.85, 6.85, 3.3, 1.4, 0.3, { kind: 'whiteboard' });

    // ---- lab coats, biohazard bin, gas cylinders, posters ----
    for (let i = 0; i < 3; i++) {
      this._box(L, 0.5, 1.0, 0.12, white, 6.4 + i * 0.7, 1.4, 6.9);
      this._box(L, 0.04, 0.04, 0.12, steel, 6.4 + i * 0.7, 1.95, 6.9);
    }
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.7, 16,1,true), new THREE.MeshStandardMaterial({color:0xa1241c,roughness:.65,side:THREE.DoubleSide}));
    bin.position.set(9.2, 0.35, 6.3); L.add(bin);
    this._box(L,.3,.06,.3,dark,9.2,.12,6.3);
    this._binHinge=new THREE.Group();this._binHinge.position.set(9.2,.72,6.08);L.add(this._binHinge);
    this._box(this._binHinge,.48,.035,.48,this._std(0x1c1f25,.5,.2),0,0,.22);
    this._hit(9.2, 0.5, 6.3, 0.7, 1.0, 0.7, { kind: 'bin' });
    block(8.9, 9.5, 6.0, 6.6, 0.8);
    [[-9.4, 6.4, 0x2a6a9a], [-9.0, 6.5, 0x5a6a5a]].forEach(([x, z, col]) => {
      const cy = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.5, 14), this._std(col, 0.4, 0.5)); cy.position.set(x, 0.75, z); L.add(cy);
      const cap2 = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), this._std(col, 0.4, 0.5)); cap2.position.set(x, 1.5, z); L.add(cap2);
    });
    block(-9.6, -8.8, 6.2, 6.7, 1.7);
    const poster = (z, title, sub, col) => {
      const p = canvasTex(256, 360, (c, w, h) => {
        c.fillStyle = col; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center';
        title.split('|').forEach((t, i) => c.fillText(t, w / 2, 60 + i * 36));
        c.font = '17px sans-serif'; sub.split('|').forEach((t, i) => c.fillText(t, w / 2, 200 + i * 28));
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.87), new THREE.MeshBasicMaterial({ map: p.tex }));
      m.position.set(-9.98, 1.85, z); m.rotation.y = Math.PI / 2; m.userData.noShadow = true; L.add(m);
    };
    poster(3.5, 'CHAIN|OF|CUSTODY', 'bag \u00b7 tag \u00b7 sign|every transfer|every time', '#3a4a6a');
    poster(4.4, 'GLOVES|ON', 'bare hands =|contamination|logged', '#a1241c');
    poster(-3.8, 'NO FOOD|OR DRINK', 'not even the|captain\u2019s coffee', '#2a6a4a');
  },

  // ======================================================================
  // PHYSICAL BENCHES
  // ======================================================================
  _buildPhysicalBenches() {
    const L = this.level;
    const std = (c, r = 0.6, m = 0.1) => this._std(c, r, m);

    // ---------- CYBER: laptop with a real screen, phone in the cradle ----------
    const lap = new THREE.Group(); lap.position.set(-6.5, 0.94, 1.95); L.add(lap);
    this._box(lap, 0.4, 0.02, 0.28, std(0x2c3038, 0.4, 0.6), 0, 0.01, 0);
    this._box(lap, 0.3, 0.004, 0.1, std(0x14171c, 0.8, 0.1), 0, 0.022, 0.05);
    const scr = new THREE.Group(); scr.position.set(0, 0.02, -0.14); scr.rotation.x = -0.28; lap.add(scr);
    this._box(scr, 0.4, 0.26, 0.012, std(0x1c1f25, 0.4, 0.5), 0, 0.13, 0);
    const lt = canvasTex(320, 200, (c, w, h) => { c.fillStyle = '#0a0e12'; c.fillRect(0, 0, w, h); });
    this._lapCtx = lt.ctx; this._lapTex = lt.tex;
    const lscreen = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.225), new THREE.MeshBasicMaterial({ map: lt.tex }));
    lscreen.position.set(0, 0.13, 0.008); lscreen.userData.noShadow = true; scr.add(lscreen);
    this._drawLaptop();
    this._hit(-6.5, 1.12, 1.95, 0.55, 0.42, 0.4, { kind: 'laptop' });

    // the handset in the cradle (only visible once you seat it)
    this._phoneCradleProp = new THREE.Group();
    this._box(this._phoneCradleProp, 0.12, 0.014, 0.24, std(0x0c0e12, 0.3, 0.2), 0, 0, 0);
    this._box(this._phoneCradleProp, 0.1, 0.004, 0.2, new THREE.MeshBasicMaterial({ color: 0x16324a }), 0, 0.009, 0);
    this._phoneCradleProp.position.set(-7.4, 0.99, 1.75); this._phoneCradleProp.visible = false; L.add(this._phoneCradleProp);
    this._hit(-7.4, 1.1, 1.75, 0.35, 0.3, 0.45, { kind: 'handset', when: () => this.cyber.staged === 'cradle' });

    // analyst's printed cheat card by the laptop
    this._box(L, 0.2, 0.004, 0.28, std(0xf2efe4, 0.9, 0), -6.1, 0.945, 2.25);
    this._hit(-6.1, 1.0, 2.25, 0.3, 0.2, 0.35, { kind: 'cheatcard' });

    // ---------- TRACE: strand, cover slip, guest glass, clipboard ----------
    this._strandSrc = new THREE.Group(); this._strandSrc.position.set(7.72, 0.962, 2.22); L.add(this._strandSrc);
    this._box(this._strandSrc, 0.2, 0.004, 0.14, std(0xe4e8ec, 0.4, 0.1), 0, 0, 0);
    this._box(this._strandSrc, 0.14, 0.003, 0.012, std(0x4a2c17, 0.9, 0), 0, 0.004, 0);
    this._hit(7.72, 1.0, 2.22, 0.3, 0.2, 0.25, { kind: 'strand' });
    this._coverSrc = new THREE.Group(); this._coverSrc.position.set(7.98, 0.962, 2.22); L.add(this._coverSrc);
    this._box(this._coverSrc, 0.1, 0.008, 0.1, new THREE.MeshStandardMaterial({ color: 0xcfe8f4, transparent: true, opacity: 0.5, roughness: 0.05 }), 0, 0, 0);
    this._hit(7.98, 1.0, 2.22, 0.2, 0.2, 0.2, { kind: 'cover' });
    this._box(L,.28,.025,.23,std(0x283338,.5,.5),6.1,1.22,1.6);
    this._strandOn = this._box(L, 0.14, 0.003, 0.012, std(0x4a2c17, 0.9, 0), 6.1, 1.24, 1.6); this._strandOn.visible = false;
    this._box(this._strandOn,.2,.004,.14,new THREE.MeshStandardMaterial({color:0xcfe8f4,transparent:true,opacity:.5,roughness:.12}),0,-.004,0);
    this._coverOn = this._box(L, 0.1, 0.008, 0.1, new THREE.MeshStandardMaterial({ color: 0xcfe8f4, transparent: true, opacity: 0.5, roughness: 0.05 }), 6.1, 1.245, 1.6); this._coverOn.visible = false;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.11, 14), new THREE.MeshStandardMaterial({ color: 0xdfe9ee, transparent: true, opacity: 0.45, roughness: 0.05 }));
    glass.position.set(8.1, 1.02, 1.2); L.add(glass);
    this._glassProp = glass;
    this._hit(8.1, 1.02, 1.2, 0.2, 0.22, 0.2, { kind: 'tglass' });
    this._box(L, 0.3, 0.015, 0.22, std(0x8a6a3a, 0.8, 0.1), 7.2, 0.97, 1.0);
    this._box(L, 0.24, 0.004, 0.17, std(0xf2efe4, 0.9, 0), 7.2, 0.98, 1.0);
    this._hit(7.2, 1.0, 1.0, 0.35, 0.2, 0.28, { kind: 'tracepad' });
    // the whole microscope body counts as "look through it" (knobs + turret are smaller, so they still win)
    this._hit(6.1, 1.25, 1.62, 0.55, 0.95, 0.55, { kind: 'eyepiece' });

    // ---------- BIO: linen, lysis tube, cartridge, RUN/MATCH buttons, clipboard ----------
    this._linen = new THREE.Group(); this._linen.position.set(-6.65, 0.96, -2.0); L.add(this._linen);
    this._box(this._linen, 0.24, 0.01, 0.2, std(0xf4f0e6, 0.95, 0), 0, 0, 0);
    this._box(this._linen, 0.07, 0.012, 0.06, std(0x7a1a1a, 0.9, 0), 0.04, 0.003, -0.02);
    this._hit(-6.65, 1.0, -2.0, 0.34, 0.2, 0.3, { kind: 'cut' });
    this._swatch = this._box(L, 0.05, 0.01, 0.04, std(0x7a1a1a, 0.9, 0), -6.35, .97, -2.1); this._swatch.visible = false;
    const tube=new THREE.Mesh(new THREE.CylinderGeometry(.04,.033,.15,16,1,true),new THREE.MeshStandardMaterial({color:0xd4e8ea,transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide,roughness:.12}));
    tube.name='Open lysis tube';tube.position.set(-6.1,1.035,-2.1);L.add(tube);
    this._lysisFluid=new THREE.Mesh(new THREE.CylinderGeometry(.031,.028,.06,16),std(0xa3cad0,.3,0));
    this._lysisFluid.position.set(-6.1,.995,-2.1);L.add(this._lysisFluid);
    this._hit(-6.1, 1.0, -2.1, 0.5, 0.35, 0.3, { kind: 'lysis' });
    this._cartridgeHit = this._hit(-5.5, 1.0, -2.9, 0.4, 0.25, 0.3, { kind: 'cartridge' });
    this._legacyDnaButtons=[];this._legacyDnaControls=[];
    const btn = (x, col, kind) => {
      this._legacyDnaButtons.push(this._box(L, 0.1, 0.05, 0.05, std(col, 0.4, 0.2), x, 1.18, -2.08));
      this._legacyDnaControls.push(this._hit(x, 1.18, -2.06, 0.14, 0.12, 0.1, { kind }));
    };
    btn(-7.7, 0x2a9d6a, 'seqrun'); btn(-7.54, 0x2a5f80, 'seqmatch');
    this._box(L, 0.3, 0.015, 0.22, std(0x8a6a3a, 0.8, 0.1), -8.2, 0.97, -2.4);
    this._box(L, 0.24, 0.004, 0.17, std(0xf2efe4, 0.9, 0), -8.2, 0.98, -2.4);
    this._hit(-8.2, 1.0, -2.4, 0.35, 0.2, 0.28, { kind: 'biopad' });

    // ---------- DOCS: trail prints, casing tray, clipboard ----------
    const trail = new THREE.Group(); trail.position.set(7.8, 0.962, -2.95); L.add(trail);
    this._box(trail, 0.36, 0.004, 0.28, std(0xf2efe4, 0.9, 0), 0, 0, 0);
    this._box(trail, 0.3, 0.004, 0.22, std(0x1a2230, 0.6, 0), 0, 0.004, 0);
    for (let i = 0; i < 5; i++) this._box(trail, 0.03, 0.003, 0.012, new THREE.MeshBasicMaterial({ color: 0xb58cff }), -0.1 + i * 0.05, 0.008, i % 2 ? 0.02 : -0.02);
    this._hit(7.8, 0.98, -2.95, 0.42, 0.15, 0.34, { kind: 'trailprints' });
    this._hit(8.15, 0.99, -2.2, 0.25, 0.15, 0.2, { kind: 'casingtray' });
    this._box(L, 0.3, 0.015, 0.22, std(0x8a6a3a, 0.8, 0.1), 5.35, 0.97, -2.05);
    this._box(L, 0.24, 0.004, 0.17, std(0xf2efe4, 0.9, 0), 5.35, 0.98, -2.05);
    this._hit(5.35, 1.0, -2.05, 0.35, 0.2, 0.28, { kind: 'docspad' });

    // second wall switch right by the reconstruction bench (east wall) so you don't have to cross the room
    this._box(L, 0.04, 0.16, 0.1, std(0xd8d2c2, 0.6, 0), 9.96, 1.5, -3.0);
    this._box(L, 0.02, 0.05, 0.03, new THREE.MeshBasicMaterial({ color: 0xffd36a }), 9.93, 1.5, -3.0);
    this._hit(9.85, 1.5, -3.0, 0.35, 0.4, 0.4, { kind: 'lightswitch' });
    this._buildHelix();
  },

  // keeps every prop in step with the lab state (called from _refreshCounter)
  _syncProps() {
    const c = this.cyber, t = this.trace, b = this.bio;
    if (this._phoneCradleProp) this._phoneCradleProp.visible = c.staged === 'cradle';
    if (this._strandSrc) this._strandSrc.visible = !t.strand;
    if (this._strandOn) this._strandOn.visible = !!t.strand;
    if (this._coverSrc) this._coverSrc.visible = !t.cover;
    if (this._coverOn) this._coverOn.visible = !!t.cover;
    if (this._linen) this._linen.visible = true;
    if (this._swatch) this._swatch.visible = !!b.cut && !b.lysis;
    this._lysisFluid?.material.color.setHex(b.lysis ? 0x986a72 : 0xa3cad0);
    if (this._cartridgeMesh) {
      if (b.loaded) { if(this._dnaSeat)this._cartridgeMesh.position.copy(this._cartridgeMesh.parent.worldToLocal(this._dnaSeat.clone()));else this._cartridgeMesh.position.set(-0.5, 1.12, 0.52); }
      else this._cartridgeMesh.position.set(1.3, 0.99, -0.3);
    }
    this._drawLaptop();
    this._drawBio();
    if (this._helixPairs) {
      const prog = b.ready ? 1 : b.running ? Math.min(1, b.t / 180) : b.loaded ? 0.1 : 0;
      const n = Math.floor(this._helixPairs.length * prog);
      this._helixPairs.forEach((p, i) => { p.visible = i < n; });
      this._helix.visible = !this._dnaModel && n > 0;
      if (this._helixRung) this._helixRung.color.setHex(b.matched ? 0xffd36a : 0xcfe8ff);
    }
    if (this._glassProp) { this._glassProp.material.emissive.setHex(0x6a4acf); this._glassProp.material.emissiveIntensity = 0; }
  },

  // ---------- blood → DNA: a double helix that builds above the sequencer as it reads ----------
  _buildHelix() {
    const L = this.level, N = 28, R = 0.07, STEP = 0.022;
    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.025, 24), new THREE.MeshStandardMaterial({ color: 0x1c2630, emissive: 0x2a5f80, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0.5 }));
    baseMesh.position.set(-6.3, 0.975, -2.95); L.add(baseMesh);this._helixBase=baseMesh;
    this._helix = new THREE.Group(); this._helix.position.set(-6.3, 1.03, -2.95); this._helix.visible = false; L.add(this._helix);
    const sphereG = new THREE.SphereGeometry(0.016, 10, 8);
    const matA = new THREE.MeshBasicMaterial({ color: 0x4aa8ff }), matB = new THREE.MeshBasicMaterial({ color: 0xffa24a });
    this._helixRung = new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.75 });
    const rungG = new THREE.CylinderGeometry(0.004, 0.004, R * 2, 6);
    this._helixPairs = [];
    for (let i = 0; i < N; i++) {
      const pair = new THREE.Group(); pair.position.y = i * STEP; pair.rotation.y = -i * 0.45; pair.visible = false;
      const a = new THREE.Mesh(sphereG, matA); a.position.x = R; pair.add(a);
      const b2 = new THREE.Mesh(sphereG, matB); b2.position.x = -R; pair.add(b2);
      const rung = new THREE.Mesh(rungG, this._helixRung); rung.rotation.z = Math.PI / 2; pair.add(rung);
      this._helix.add(pair); this._helixPairs.push(pair);
    }
    this._hit(-6.3, 1.3, -2.95, 0.3, 0.7, 0.3, { kind: 'helix',when:()=>!this._dnaModel });
  },

  // ---------- laptop screen (3D) ----------
  _drawLaptop() {
    const g = this._lapCtx; if (!g) return;
    const T = this.cyber.term;
    g.fillStyle = '#0a0e12'; g.fillRect(0, 0, 320, 200);
    g.font = '11px monospace'; g.textBaseline = 'top';
    const lines = T && T.lines.length ? T.lines.slice(-14) : [];
    if (!lines.length) { g.fillStyle = '#3a4a58'; g.fillText('examiner-01 — idle', 8, 8); g.fillText('[E] to open the terminal', 8, 24); }
    lines.forEach((ln, i) => {
      g.fillStyle = /1610|Cracked/.test(ln) ? '#7fd4a0' : '#9fb4c0';
      g.fillText(ln.slice(0, 52), 8, 6 + i * 13);
    });
    if (this._lapTex) this._lapTex.needsUpdate = true;
  },

  // ---------- sequencer display (3D) ----------
  _drawBio() {
    const g = this._bioCtx; if (!g) return;
    const b = this.bio, W = 512, H = 205;
    g.fillStyle = '#0a141c'; g.fillRect(0, 0, W, H);
    g.textBaseline = 'top'; g.font = 'bold 22px monospace';
    const txt = (s, y, col = '#7fd4a0', f = 20) => { g.fillStyle = col; g.font = f + 'px monospace'; g.fillText(s, 16, y); };
    if (!this.collected.handkerchief) { txt('NO SAMPLE', 20, '#a05a4a'); this._bioTex.needsUpdate = true; return; }
    if (!b.loaded) txt('DNA ANALYSER  \u00b7  IDLE', 16, '#4a7f60'), txt(b.cut ? (b.lysis ? 'seat the cartridge' : 'lyse the swatch') : 'prepare a sample', 52, '#7fd4a0', 22);
    else if (b.running && !b.ready) {
      const pct = Math.min(100, Math.round((b.t / 180) * 100));
      txt('RUN  ' + pct + '%', 16, '#7fd4a0', 26); txt(this._dnaStage(), 56, '#9fb4c0', 20);
      g.strokeStyle = '#2a5f80'; g.strokeRect(16, 100, W - 32, 22); g.fillStyle = '#2a5f80'; g.fillRect(16, 100, (W - 32) * pct / 100, 22);
      g.strokeStyle='#80c9bb';g.lineWidth=2;g.beginPath();
      for(let x=0;x<W-32;x++){const peak=Math.pow(Math.max(0,Math.sin(x*.11+b.t*.2)),18);const y=175-peak*(12+30*Math.abs(Math.sin(x*.032)));if(x===0)g.moveTo(x+16,y);else g.lineTo(x+16,y);}g.stroke();
    } else if (!b.ready) txt('CARTRIDGE SEATED', 16), txt('press RUN (green)', 56, '#9fb4c0', 20);
    else {
      txt('PROFILE 16/16 \u00b7 HIGH CONF.', 8, '#7fd4a0', 18);
      for (let i = 0; i < 16; i++) {
        const h = 14 + ((this.case.seed >> (i % 24)) + i * 37) % 52;
        g.fillStyle = '#2a5f80'; g.fillRect(16 + i * 30, 96 - h, 22, h);
      }
      if (!b.matched) txt('press MATCH (blue)', 112, '#9fb4c0', 20);
      else {
        txt('CONSISTENT WITH', 104, '#e8c84a', 18);
        txt(this.witness.name.toUpperCase(), 126, '#e8c84a', 22);
        txt('NOT THE VICTIM \u00b7 2 DONORS', 160, '#9fb4c0', 16);
      }
    }
    this._bioTex.needsUpdate = true;
  },

  // ======================================================================
  // INTERACTIONS
  // ======================================================================
  _interactFlavor(it) {
    if(interactAppliance(this,it))return true;
    const say = (a, b, ms = 5500) => { sfx('collect'); this._toast(a, b, ms); return true; };
    switch (it.kind) {
      case 'chemshelf': {
        this._chemI = this._chemI || {};
        const base = it.row * 6;
        const n = (this._chemI[it.row] = ((this._chemI[it.row] ?? -1) + 1) % 6);
        const bottle=this._chemBottles[(base+n)%this._chemBottles.length];
        this._handling.begin({source:bottle,destination:bottle.getWorldPosition(new THREE.Vector3()),complete:()=>{}});return true;
      }
      case 'whiteboard':
        return say('THE BOARD', 'Mabaso\u2019s handwriting: 23:19 locked the common room, 23:31 last message, 00:50 found. Six exhibits: casing, glass, hair, handkerchief, phone and UV trail. Four reports to complete.', 7000);
      case 'cheatcard':
        return say('ANALYST\u2019S CARD',
          'hashcat \u2014 <b>-m</b> hash mode (0 = MD5) \u00b7 <b>-a 3</b> mask attack \u00b7 mask: <b>?d</b> = one digit, <b>?l</b> letter.<br>Usage: <code>hashcat -m &lt;mode&gt; -a 3 &lt;hashfile&gt; &lt;mask&gt;</code><br>The dump tool header tells you the hash type. Four-digit PIN = four masks.', 11000);
      default: return false;
    }
  },

  _interactExtra(it) {
    const c = this.cyber, t = this.trace, b = this.bio, d = this.docs;
    const say = (a, m, ms = 5000) => { this._toast(a, m, ms); return true; };
    switch (it.kind) {
      // ---------------- CYBER ----------------
      case 'laptop':
        if (!this.collected.phone) return say('EXAMINER LAPTOP', 'No phone was collected at the scene \u2014 nothing to analyse.', 4000);
        this._openDevice('terminal'); return true;
      case 'handset':
        if (c.staged !== 'cradle') return true;
        this._openDevice('phone'); return true;
      // ---------------- TRACE ----------------
      case 'strand':
        if (!this.collected.hair) return say('HAIR STRAND', 'No hair was collected at the scene.', 3500);
        if (t.strand) return true;
        this._checkGloves('the hair fibres');
        this._handling.begin({source:this._strandSrc, destination:this._strandOn.getWorldPosition(new THREE.Vector3()), complete:()=>{
          t.strand=true; sfx('collect'); this._refreshCounter();
        }}); return true;
      case 'cover':
        if (!t.strand) return say('COVER SLIP', 'Strand first \u2014 a cover slip on an empty stage is just glass.', 3500);
        if (t.cover) return true;
        this._handling.begin({source:this._coverSrc, destination:this._coverOn.getWorldPosition(new THREE.Vector3()), complete:()=>{
          t.cover=true; sfx('collect'); this._refreshCounter();
        }}); return true;
      case 'tglass':
        if (!this.collected.glass) return say('GUEST GLASS', 'The glass was never collected.', 3500);
        if (!(this.carried && this.carried.id === 'uvwand')) return say('GUEST GLASS', 'Smudges, nothing you can read by eye. Fetch the UV wand from the reconstruction bench and examine it under UV.', 5000);
        if (!d.lightsOff) return say('UV EXAMINATION', 'Switch the lab lights off before scanning the glass.', 3500);
        this._openDevice('glassscan'); return true;
      case 'tracepad':
        return this._fileTrace();
      // ---------------- BIO ----------------
      case 'cut':
        if (!this.collected.handkerchief) return say('HANDKERCHIEF', 'It was never collected \u2014 no blood, no profile.', 3500);
        if (b.cut) return say('LINEN', 'Swatch already cut.', 2500);
        this._checkGloves('the stained linen');
        b.cut = true; sfx('collect'); this._refreshCounter();
        return say('SWATCH CUT', 'A clean square from the stained corner. Into the lysis tube on the rack.', 4500);
      case 'lysis':
        if (!b.cut) return say('LYSIS TUBE', 'Nothing to lyse yet. Cut a swatch from the linen first.', 3500);
        if (b.lysis) return say('LYSIS TUBE', 'Already in buffer.', 2500);
        this._handling.begin({source:this._swatch, destination:new THREE.Vector3(-6.1,1.02,-2.1), complete:()=>{
          b.lysis=true; sfx('collect'); this._refreshCounter();
        }}); return true;
      case 'cartridge':
        if (!b.lysis) return say('CARTRIDGE', 'Needs a lysed sample first.', 3500);
        if (b.loaded) return say('CARTRIDGE', 'Already in the sequencer.', 2500);
        if(this._dnaDoor&&!b.hatchOpen)return say('SAMPLE COMPARTMENT','Open the analyser compartment first.',2200);
        this._handling.begin({source:this._cartridgeMesh, destination:this._dnaSeat||new THREE.Vector3(-7.3,1.12,-2.08), complete:()=>{
          b.loaded=true; sfx('collect'); this._refreshCounter();
        }}); return true;
      case 'dnaHatch':
        if(b.running)return say('COMPARTMENT LOCKED','Run in progress.',1800);
        b.hatchOpen=!b.hatchOpen;sfx('door');return true;
      case 'dnaDisplay':this._openOverlay(this._bioPanel(),'biology');return true;
      case 'dnaControl':return this._interactExtra({kind:b.ready?'seqmatch':'seqrun'});
      case 'seqrun':
        if (!b.loaded) return say('SEQUENCER', 'No cartridge loaded.', 3000);
        if (b.running || b.ready) return say('SEQUENCER', b.ready ? 'Run finished.' : 'Already running \u2014 about three minutes. Work another bench.', 3500);
        if(!dnaCanRun(b,!this._dnaDoor||Math.abs(this._dnaDoor.rotation.z+Math.PI/2)<.03))return say('CLOSE COMPARTMENT','Close the sample door and let it latch before starting.',2200);
        b.running = true; b.t = 0; sfx('instrumentStart'); this._refreshCounter();return true;
      case 'seqmatch':
        if (!b.ready) return say('SEQUENCER', b.running ? 'Not finished \u2014 ' + this._dnaStage().toLowerCase() + '.' : 'No profile yet.', 3500);
        if (b.matched) return true;
        b.matched = true; sfx('correct'); this._refreshCounter();
        return true;
      case 'biopad':
        return this._fileDna();
      case 'helix':
        if (!this.collected.handkerchief) return say('DNA DISPLAY', 'No sample \u2014 nothing to show.', 3000);
        if (!b.loaded) return say('DNA DISPLAY', 'Idle. Prepare a sample and load the cartridge.', 3500);
        if (!b.ready) return say('DNA DISPLAY', 'The strand builds as the sequencer reads it \u2014 ' + this._dnaStage().toLowerCase() + '.', 4500);
        return say('DNA PROFILE', 'Full double helix resolved: 16 STR loci read. ' + (b.matched ? 'Gold rungs = loci matched to a known reference.' : 'Press MATCH on the sequencer to compare it against the references.'), 6500);
      // ---------------- DOCS ----------------
      case 'trailprints':
        if (!this.collected.trail) return say('TRAIL PHOTOS', 'Not collected at the scene.', 3500);
        this._openDevice('trail'); return true;
      case 'casingtray':
        if (!this.collected.casing) return say('CASING TRAY', 'Empty \u2014 the casing was not collected.', 3500);
        this._openDevice('casing'); return true;
      case 'docspad':
        return this._fileDocs();
      default: return false;
    }
  },

  _promptExtra(it) {
    const c = this.cyber, t = this.trace, b = this.bio, d = this.docs;
    switch (it.kind) {
      case 'chemshelf': return '[E] Read the next bottle';
      case 'hood': return '[E] ' + (this._hoodOpen ? 'Lower the sash' : 'Raise the sash');
      case 'fridge': return '[E] ' + (this._fridgeOpen ? 'Close the fridge' : 'Open the sample fridge');
      case 'fridgeRack':return '[E] Slide sample rack in / out';
      case 'dnaHatch':return this.bio.running?'Sample compartment locked':'[E] '+(this.bio.hatchOpen?'Close sample compartment':'Open sample compartment');
      case 'dnaControl':return this.bio.running?'Analysis running':this.bio.ready?'[E] Compare references':'[E] Start analysis';
      case 'dnaDisplay':return '[E] Read analyser results';
      case 'sink': return '[E] '+(this._tapOn?'Turn tap off':'Run water');
      case 'centrifuge': return '[E] Centrifuge';
      case 'pipettes': return '[E] Pipette rack';
      case 'balance': return '[E] '+(this._balanceLoaded?'Lift calibration weight':'Weigh calibration weight');
      case 'whiteboard': return '[E] Read the whiteboard';
      case 'bin': return '[E] '+(this._binOpen?'Close bin lid':'Open bin lid');
      case 'cheatcard': return '[E] Read the analyst\u2019s card';
      case 'laptop': return c.staged === 'cradle' ? '[E] Open the laptop \u2014 crack the lock' : '[E] Open the laptop';
      case 'handset': return c.unlocked ? '[E] Pick up the handset \u2014 read his apps' : '[E] Pick up the handset \u2014 type the PIN';
      case 'strand': return t.strand ? '' : '[E] Lay the strand on the stage';
      case 'cover': return t.cover ? '' : '[E] Lower a cover slip';
      case 'tglass': return this.trace.glassUV ? '[E] Review the UV scan' : (this.carried && this.carried.id === 'uvwand' ? '[E] Scan the glass under UV' : '[E] Guest glass (needs the UV wand)');
      case 'helix': return '[E] Read the DNA display';
      case 'tracepad': return this.reports.micro ? 'Clipboard (trace report filed)' : '[E] Clipboard \u2014 file the trace report';
      case 'cut': return b.cut ? 'Linen (swatch cut)' : '[E] Cut a swatch from the stained linen';
      case 'lysis': return b.lysis ? 'Lysis tube (loaded)' : '[E] Drop the swatch in lysis buffer';
      case 'cartridge': return b.loaded ? 'Cartridge (seated)' : '[E] Seat the cartridge in the sequencer';
      case 'seqrun': return '[E] RUN';
      case 'seqmatch': return '[E] MATCH against the references';
      case 'biopad': return this.reports.dna ? 'Clipboard (DNA report filed)' : '[E] Clipboard \u2014 file the DNA report';
      case 'trailprints': return '[E] Study the UV trail prints';
      case 'casingtray': return '[E] Inspect the casing';
      case 'docspad': return this.reports.docs ? 'Clipboard (reconstruction filed)' : '[E] Clipboard \u2014 file the reconstruction report';
      default: return undefined;
    }
  },

  // ---------- report filing (moved off the old panels) ----------
  _fileTrace() {
    const t = this.trace;
    if (t.reported) { this._toast('TRACE REPORT', 'Already filed.', 2500); return true; }
    if (!t.strand || !t.cover) { this._toast('TRACE REPORT', 'Nothing to file yet \u2014 prep the slide and compare under the eyepiece.', 4000); return true; }
    if (!this._traceClaimComplete()) { this._toast('TRACE REPORT', 'The comparison is not finished \u2014 follow the recipe in the eyepiece, then record your claim.', 5000); return true; }
    t.reported = true;
    const pick = SUSPECTS[t.claimPick];
    const kl = this.killer.hairLong ? 'long' : 'short';
    const claimLine = t.claim === 'absolute'
      ? 'Analyst claims <b>positive identification of ' + pick.name + '</b> \u2014 this overstates hair comparison science.'
      : t.claim === 'consistent'
        ? 'Analyst concludes the unknown hair is <b>consistent with ' + pick.name + '</b> (' + pick.role + ') \u2014 hedged, as comparison work requires.'
        : 'Analyst records the comparison as <b>inconclusive</b>.';
    const verdLines = Object.keys(t.verdicts).map((id) => (SUSPECTS[id] ? SUSPECTS[id].name : id) + ': ' + t.verdicts[id]).join('; ');
    this.reports.micro = {
      body: 'Hair (item #3): ' + kl + ', ' + this.killer.hairName + ', single donor. Examined at 40x against racked knowns \u2014 verdicts: ' + verdLines + '.<br>' + claimLine + '<br>' +
        'Guest glass (item #2): partial print, <b>insufficient for identification</b>. Dry, cracked skin, right index finger.',
      signed: false,
    };
    if (t.claim === 'consistent' && t.claimPick) this.dossier.names.add(pick.name);
    if (t.claim === 'inconclusive') this._toast('FILED WEAK', 'Inconclusive is honest \u2014 but the captain still needs a name from somewhere.', 5000);
    else this._toast('PAGE FILED', 'Trace page is in the case folder.', 3500);
    sfx('correct'); this._refreshCounter(); this._checkCaptainReady();
    return true;
  },
  _fileDna() {
    const b = this.bio;
    if (b.reported) { this._toast('DNA REPORT', 'Already filed.', 2500); return true; }
    if (!b.matched) { this._toast('DNA REPORT', b.ready ? 'Run the reference match on the sequencer first.' : 'No profile yet \u2014 the sequencer has not finished.', 4000); return true; }
    b.reported = true;
    this.reports.dna = { body: 'Sample: dried blood, item #4 (handkerchief). Full 16-locus STR profile, high confidence.<br>' + this._bioMatchText() + '<br>Trail photo (item #6): the bleeder walked \u2014 steady stride, no drag. Whoever left was calm.', signed: false };
    this.dossier.names.add(this.killer.name);
    this.dossier.names.add(this.witness.name);
    this.dossier.temperament = 'walked out, steady, calm';
    sfx('correct'); this._refreshCounter(); this._checkCaptainReady();
    this._toast('PAGE FILED', 'DNA page names a second person. Two people were in that room.', 4500);
    return true;
  },
  _fileDocs() {
    if (this.docs.reported) { this._toast('RECONSTRUCTION REPORT', 'Already filed.', 2500); return true; }
    if (!this._docsReady()) {
      this._toast('EXAMINE THE SCENE EVIDENCE', 'Use [E] on the casing tray and the UV trail print before filing.', 4500); return true;
    }
    this.docs.reported = true;
    this.reports.docs = {
      body: 'Original scene exhibit #1: 9×19mm casing. Calibre established; no individual weapon or owner can be identified without comparison.<br>' +
        'Original scene exhibit #6: the UV photograph records a wiped blood trail from the guest chair toward the exit and the letter beside the body. Compare this with the handkerchief monogram and the DNA report.<br>' +
        'These are examinations of the six office exhibits. The meeting place and time are recovered from the phone, not from additional documents.',
      signed: false,
    };
    this.dossier.weapon = '9×19mm; individual weapon not yet identified';
    sfx('correct'); this._refreshCounter(); this._checkCaptainReady();
    this._toast('PAGE FILED', 'Scene reconstruction filed. Sign its page at the report table.', 4500);
    return true;
  },

  // ======================================================================
  // THE LAPTOP TERMINAL — you type, hashcat (simulated) answers
  // ======================================================================
  _termState() {
    const c = this.cyber;
    if (!c.term) c.term = { lines: [], hist: [], hi: 0, busy: false, files: { 'README.txt': true, 'notes.txt': true }, timers: [] };
    return c.term;
  },
  _termSay(...ls) {
    const T = this._termState();
    T.lines.push(...ls);
    if (T.lines.length > 400) T.lines.splice(0, T.lines.length - 400);
    this._termPaint();
  },
  _termPaint() {
    this._drawLaptop();
    if (this._deviceMode !== 'terminal' || !this.ui || !this.ui.deviceInner) return;
    const out = this.ui.deviceInner.querySelector('#tm-out');
    if (!out) return;
    out.textContent = this._termState().lines.join('\n');
    out.scrollTop = out.scrollHeight;
  },
  _termPlay(steps, done) {
    const T = this._termState();
    T.busy = true;
    let at = 0;
    for (const [dt, line] of steps) {
      at += dt;
      T.timers.push(setTimeout(() => this._termSay(line), at));
    }
    T.timers.push(setTimeout(() => {
      T.busy = false; T.timers = [];
      if (done) done();
      this._termSetPrompt();
    }, at + 120));
    this._termSetPrompt();
  },
  _termStop() {
    const T = this.cyber && this.cyber.term;
    if (!T) return;
    if (T.busy) { T.timers.forEach(clearTimeout); T.timers = []; T.busy = false; T.lines.push('^C', '[session aborted]'); }
    this._drawLaptop();
  },
  _termSetPrompt() {
    if (this._deviceMode !== 'terminal') return;
    const inp = this.ui.deviceInner.querySelector('#tm-in'); if (!inp) return;
    const T = this._termState();
    inp.disabled = T.busy;
    if (!T.busy) inp.focus();
    const ps = this.ui.deviceInner.querySelector('#tm-ps'); if (ps) ps.style.opacity = T.busy ? 0.3 : 1;
  },

  _renderTerminal() {
    const el = this.ui.deviceInner;
    const T = this._termState();
    if (!T.lines.length) {
      T.lines.push('examiner-01  \u00b7  forensic workstation  \u00b7  new here? type:  cat README.txt',
        this.cyber.staged === 'cradle' ? '[link] handset on /dev/cradle0 (shielded, cabled)' : '[link] /dev/cradle0: no device',
        '');
    }
    el.innerHTML =
      '<div style="width:min(880px,94vw);background:#0b0f14;border:12px solid #1c1f25;border-bottom-width:28px;border-radius:10px 10px 4px 4px;box-shadow:0 24px 70px #000">' +
      '<div style="background:#141a22;color:#7a8794;font-size:11px;padding:4px 10px;display:flex;justify-content:space-between"><span>examiner-01 \u2014 terminal</span><span>[Esc] close the lid</span></div>' +
      '<pre id="tm-out" style="margin:0;height:min(54vh,440px);overflow:auto;padding:10px 12px;color:#c8d3dc;font:13px/1.45 \'Courier New\',monospace;white-space:pre-wrap;word-break:break-all"></pre>' +
      '<div style="display:flex;border-top:1px solid #1f2a35;padding:7px 12px;font:13px \'Courier New\',monospace;color:#e8eef3"><span id="tm-ps" style="color:#7fd4a0;white-space:pre">' + PS + '</span>' +
      '<input id="tm-in" autocomplete="off" autocapitalize="off" spellcheck="false" style="flex:1;background:transparent;border:0;outline:0;color:#e8eef3;font:inherit;margin-left:6px"></div></div>';
    const inp = el.querySelector('#tm-in');
    el.onclick = (event) => {
      if (!T.busy && event.target.closest('#tm-out') === null && inp.isConnected) inp.focus();
    };
    inp.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'Tab') return; // close / dialog focus navigation
      e.stopPropagation();
      if (e.code === 'Enter') {
        const v = inp.value; inp.value = '';
        if (v.trim()) { T.hist.push(v); T.hi = T.hist.length; }
        this._termRun(v);
      } else if (e.code === 'ArrowUp') { e.preventDefault(); if (T.hi > 0) inp.value = T.hist[--T.hi] || ''; }
      else if (e.code === 'ArrowDown') { e.preventDefault(); T.hi = Math.min(T.hist.length, T.hi + 1); inp.value = T.hist[T.hi] || ''; }
    });
    this._termPaint(); this._termSetPrompt();
  },

  _termRun(line) {
    const T = this._termState(), c = this.cyber;
    this._termSay(PS + line);
    const parts = line.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return;
    const cmd = parts[0], args = parts.slice(1);
    const say = (...l) => this._termSay(...l);
    switch (cmd) {
      case 'help': case '?':
        say('commands:', '  ls                       list files', '  cat <file>               print a file',
          '  lockdump <dev> -o <file> read the lock credential record off the handset',
          '  hashcat ...              password recovery (see: hashcat --help)', '  clear / exit', '');
        return;
      case 'clear': T.lines.length = 0; this._termPaint(); return;
      case 'exit': case 'quit': this._closeDevice(); return;
      case 'ls': say(Object.keys(T.files).join('   '), ''); return;
      case 'cat': {
        const f = args[0];
        if (!f) { say('cat: missing file', ''); return; }
        if (!T.files[f]) { say('cat: ' + f + ': No such file or directory', ''); return; }
        if (f === 'README.txt') say('EXAMINER-01 \u2014 handset procedure', '',
          '1. Phone shielded in the faraday box, seated in the cradle, cabled.', '',
          '2. DUMP the lock record off the handset:', '     lockdump /dev/cradle0 -o lock.hash', '',
          '3. READ the dump header: it names the hash type and the passcode policy.', '',
          '4. CRACK it offline:', '     hashcat -m <mode> -a 3 lock.hash <mask>',
          '       -m  hash mode   (0 = MD5, 100 = SHA1, 1400 = SHA-256)', '       -a 3  mask attack (tries every combination the mask allows)',
          '       mask: one token per character   ?d digit  ?l lower  ?u upper  ?a any', '       e.g. a 3-digit code = ?d?d?d', '',
          '5. Show a cracked result any time:', '     hashcat --show lock.hash', '',
          '6. Type the PIN on the HANDSET yourself. Airplane mode FIRST once unlocked.', '   Three wrong tries on the handset wipes it.', '');
        else if (f === 'notes.txt') say('Passcode policy on this handset family: numeric only, exactly 4 digits.', 'Three wrong tries on the handset wipes it \u2014 never guess on the phone if you can crack offline.', 'hashcat mask: ?d = one digit.', '');
        else if (f === 'lock.hash') say(PIN_HASH, '');
        else say('(binary)', '');
        return;
      }
      case 'lockdump': {
        if (c.staged !== 'cradle') { say('lockdump: /dev/cradle0: no device (is the phone shielded, seated and cabled?)', ''); return; }
        if (T.files['lock.hash']) { say('lock.hash already exists \u2014 lock record already dumped.', ''); return; }
        this._termPlay([
          [200, '[+] opening /dev/cradle0 (shielded, no radio)'], [500, '[+] reading keybag ...'], [600, '[+] 1 credential record found'],
          [400, '    policy ....: numeric, length 4'], [200, '    hash type .: MD5 (hashcat mode 0)'], [300, '[+] wrote lock.hash'], [100, ''],
        ], () => { T.files['lock.hash'] = true; sfx('collect'); this._drawUnit('LINKED', 'record dumped'); });
        return;
      }
      case 'hashcat': { this._termHashcat(args); return; }
      case 'md5sum': case 'echo': say('(not installed on the examiner image)', ''); return;
      default: say('bash: ' + cmd + ': command not found  (try: help)', '');
    }
  },

  _termHashcat(args) {
    const T = this._termState(), c = this.cyber;
    const say = (...l) => this._termSay(...l);
    if (!args.length || args.includes('--help') || args.includes('-h')) {
      say('hashcat (v6.2.6) \u2014 usage: hashcat [options] <hashfile> [mask]', '  -m <n>   hash mode   (0 = MD5, 100 = SHA1, 1400 = SHA-256)', '  -a <n>   attack mode (0 = wordlist, 3 = mask / brute-force)',
        '  --show   show cracked results', 'mask:  ?d digit \u00b7 ?l lower \u00b7 ?u upper \u00b7 ?a any', 'e.g.   hashcat -m 0 -a 3 file.hash ?l?l?l', '');
      return;
    }
    if (args.includes('--show')) {
      if (c.cracked) say(PIN_HASH + ':1610', ''); else say('(nothing cracked yet)', '');
      return;
    }
    // parse -m / -a (accepts "-m 0" and "-m0")
    let mode = null, atk = null, file = null, mask = null;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-m') mode = args[++i]; else if (/^-m\d+$/.test(a)) mode = a.slice(2);
      else if (a === '-a') atk = args[++i]; else if (/^-a\d+$/.test(a)) atk = a.slice(2);
      else if (a.startsWith('-')) continue;
      else if (a.includes('?')) mask = a;
      else file = a;
    }
    if (!file) { say('hashcat: no hash or hashfile specified', ''); return; }
    if (!T.files[file] || file !== 'lock.hash') { say('hashcat: ' + file + ': No such file or directory', ''); return; }
    if (mode === null) { say('hashcat: no hash mode (-m) given \u2014 auto-detect is off. The dump header names the type.', ''); return; }
    if (mode !== '0') { say('Hash \'' + file + '\': Token length exception', 'No hashes loaded.', '(wrong -m for this hash \u2014 check the lockdump header)', ''); return; }
    if (atk !== '3') {
      if (atk === '0' || atk === null) say('hashcat: no wordlist given for attack mode 0 \u2014 a PIN is not a word. Think mask (-a 3).', '');
      else say('hashcat: attack mode ' + atk + ' is not useful here.', '');
      return;
    }
    if (!mask) { say('hashcat: mask attack (-a 3) needs a mask, e.g. ?d?d?d', ''); return; }
    const toks = mask.match(/\?[dlusa]|[^?]/g) || [];
    const space = toks.reduce((n, tk) => n * ({ '?d': 10, '?l': 26, '?u': 26, '?s': 33, '?a': 95 }[tk] || 1), 1);
    const head = [[150, 'hashcat (v6.2.6) starting'], [300, '* Device #1: examiner-01 GPU, 8192/16384 MB, 28MCU'], [250, 'Hashes: 1 digests; 1 unique digests, 1 unique salts'],
      [250, 'Hash.Mode........: 0 (MD5)'], [100, 'Guess.Mask.......: ' + mask + ' [' + toks.length + ']'], [100, 'Keyspace.........: ' + space]];
    const prog = (p) => [550, 'Progress.........: ' + Math.floor(space * p) + '/' + space + ' (' + (p * 100).toFixed(2) + '%)'];
    const works = toks.length === 4 && toks.every((tk) => tk === '?d' || tk === '?a');
    if (works) {
      const slow = toks.some((tk) => tk === '?a');
      const ps = slow ? [0.07, 0.19, 0.33, 0.48, 0.61, 0.78] : [0.21, 0.58, 0.97];
      const steps = head.concat(ps.map(prog));
      steps.push([600, 'Status...........: Cracked'], [150, 'Recovered........: 1/1 (100.00%) Digests'], [200, PIN_HASH + ':1610'], [100, ''], [100, 'Started/Stopped: done']);
      this._termPlay(steps, () => {
        c.cracked = true; c.unitDone = true; sfx('correct');
        this._drawUnit('LOCK CRACKED', 'see the laptop');
        this._toast('CRACKED', 'hashcat recovered the passcode. Now walk to the handset in the cradle and type it \u2014 yourself.', 7000);
      });
    } else {
      const steps = head.concat([prog(0.5), prog(1.0)], [[500, 'Status...........: Exhausted'], [100, 'Recovered........: 0/1 (0.00%) Digests'],
        [100, toks.length === 4 ? '(that mask cannot produce this PIN \u2014 check notes.txt for the passcode policy)' : '(mask length does not match the passcode policy \u2014 check notes.txt)'], [100, '']]);
      this._termPlay(steps);
    }
  },
};

export function installLabExtras(LabLevel) {
  Object.assign(LabLevel.prototype, extras);
}
export default { installLabExtras };
