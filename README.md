# GENESIS — Read the Room. Close the Case.

A 3D browser-based murder mystery built with Three.js. Dr. Thabo Nkosi has been found dead in his university office — one gunshot, close range. You are the investigator. Work three levels — the office, the lab and the chase through Genesis — log the evidence and catch the suspect.

---

## The Story

Central City, October. Rain for three days straight.

Dr. Nkosi is found dead at his desk. No witnesses, no confession — only what the room remembers: a handkerchief with someone else's blood, a 9mm casing, brown hair on the wrong chair, a torn note naming three people, and a diary pointing at the city.

The lab names the suspect, and the trail leads to Genesis — an abandoned beachfront city the criminals have made their own. He sees you coming and runs. Catch him before the bridge.

---

## Levels

### Level 1 — "The Office" ✅ Playable

**Vibe:** Night-time crime scene, first-person, UV torch, chiptune music.

**How to play:**
- Move with WASD, look with the mouse (click the scene once to capture the mouse), Shift to sprint, Space to jump
- Work the kit: Q camera, 1 bags, 2 tweezers, 3 swab, E to collect, F for the UV torch, C for the case file
- Photograph first, lift second — wrong tool means contamination. Valid pickups animate the chosen tool, lift the exhibit into a transparent evidence bag and close its seal in either camera view.
- Log all six exhibits: phone, guest glass, casing, hair, handkerchief and the photographed UV trail
- Pickup notes are the detective’s tentative thoughts; conclusions are left for the Level 2 examinations
- Photograph and collect every exhibit, then open the case file and seal it to travel to the station — no timeline-ordering puzzle

### Level 2 — "The Forensic Lab" ✅ Playable

**Vibe:** Benches, intake paperwork and hands-on forensic analysis.

**How to play:**
- Start in the passage between the lab and captain’s office, then enter the marked lab
- Sign the intake sheet and put on gloves
- Examine the phone, trace evidence, blood, and the casing / UV-trail reconstruction at the four benches
- Shield the phone, recover its PIN on the examiner laptop, unlock the handset and enable airplane mode
- Examine the guest glass with the movable UV beam, rotate and inspect the casing, and explore the recorded UV trail reconstruction. Inspect every marked feature and press **Record findings**. Partial examination progress survives closing the view.
- For DNA: prepare the sample, open the analyser’s lower compartment, load the cartridge, close it, then use its keyboard to start and later compare the results.
- File all four reports and sign each page at the report table
- Bring the completed file to Captain Mabaso’s office. Advance the acknowledgement dialogue to begin Level 3

### Level 3 — "Genesis" ✅ Playable

**Vibe:** GENESIS, the beachfront city that was never finished. The money ran out before the cave could be brought down, so criminals took over the construction site and turned it into a trap for police.

**How to play:**
- The suspect runs; you chase him on foot down the construction street and into the old mine cave
- A / D change lane, Space jump, V switch first / third person
- Cones get knocked over, barriers and bags trip you, skips, pipes, drums and rocks stop you until you change lane
- Catch him before he crosses the cave bridge, or he cuts it down behind him

---

## 🕹️ Controls

| Action              | Key              |
|---------------------|------------------|
| Walk / look         | WASD / mouse |
| Sprint / jump       | Shift / Space    |
| Examine / question / collect | E |
| Office kit          | Q camera, 1 bags, 2 tweezers, 3 swab |
| Office UV torch     | F                |
| Office case file    | C                |
| Lab report folder   | E at the report table |
| Lab guidance (off by default) | H |
| Spin carried lab equipment | X |
| First / third person | V               |
| Chase: lane / jump | A, D / Space     |
| Pause               | P or pause button |
| Release mouse       | Esc |
| Restart level       | R                |

Progress auto-saves on every level change. **Continue** restarts the saved level; it does not restore every mid-level action.

---

## Tech Stack

- **Three.js** — Rendering and scene graph
- **Vite** — Bundler (base set to `'./'` in vite.config.js for subdirectory hosting)
- **Cannon-es** — Physics
- **Howler.js** — Audio (menu theme, per-level music, city traffic ambience, UI clicks)
- Audio sources and unresolved provenance are listed in the in-game Credits and asset source audit.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** - [Download here](https://git-scm.com/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/RECLAIMED-GENESIS/GENESIS.git
   ```
2. **Navigate to the project directory:**
   ```bash
   cd GENESIS
   ```
3. **Install dependencies:**
   ```bash
   npm ci
   ```
4. **Run the dev server:**
   ```bash
   npm run dev
   ```
5. **Open your browser and visit:**
   ```
   http://localhost:5173/
   ```

### Production build and deployment (LAMP)

1. **Build the project:**
   ```bash
   npm run build
   ```
2. **Test the build locally over HTTP:**
   ```bash
   npm run preview
   ```
   (Do not open _index.html_ directly as a file — use the HTTP server.)
3. **Zip the contents of dist/ with index.html at the top level.**
4. **Upload to LAMP via Moodle submission.**
5. **Open the published URL and check the console for 404s.**
   (**Important:** the game is served from a subdirectory, so all paths must be relative (e.g. `./assets/..`).)

See [SUBMISSION.md](SUBMISSION.md) for the final package names, verification record and hand-in instructions. [Sibu.md](Sibu.md) records Sibu’s contribution and AI use.

---

## Helping new players with Level 2

Open **Controls & mission guide** from the main menu or Pause (P). The guide includes a short station route, expandable instructions for each bench, optional laptop command help, and troubleshooting. Close a lab device with Esc before opening Pause.

Level 2 guidance starts off. Press **H** or the Help button to reveal the objective, route marker, detailed instructions and relevant device highlights; press H again to hide all guidance. Guidance follows actual lab actions, supports work completed out of order, and leaves deductions to the player. Devices and files have a **Back to lab** button; Esc also closes them.

For a first playthrough, explain one loop: **examine → file → sign**. Demonstrate intake and one bench, then let the player finish the others using the HUD’s NEXT instruction. Explain the phone shielding and airplane-mode steps before they handle it. Avoid revealing suspects or lab results: teach the controls and process, leaving the deductions to the player.

## Station visuals

The imported DNA analyser now uses its own screen and keyboard. Open its lower sample compartment, load the prepared cartridge, close the door and start analysis at the keyboard; the compartment stays locked during a run. The screen shows live progress and acquisition traces, then reference results. The generic machine remains a fallback if the model fails to load.

The sample fridge has labelled sliding vial racks, sealed boxes, door shelves and an interior light. Its door, the hood sash and bin lid animate. The tap runs visible water; the centrifuge rotor turns under its lid; pipettes lift from their rack; the balance accepts a calibration weight and changes its display. These fixture interactions do not award case progress.

Evidence and equipment float through pickup and placement with a short spin flourish; no procedural hands are shown. Press **X** while holding the phone or UV wand to replay the spin. Reduced-motion settings skip the flourish. Microscope slides and DNA samples are committed after placement. The trace surface view uses textured flooring, irregular dark stains, wipe streaks and a movable inspection light, labelled as a reconstruction. Both UV examinations require lights off and a carried wand, including repeat examinations.

Synthesized interaction effects cover camera shutter, pickup, bag sealing, placement, gloves, switches, UV activation, scan confirmation, recording, doors and instrument startup. They use the existing effects-volume and mute settings. Corridor staff doors have painted panels, privacy glazing, metal hardware and locked-room signage; the lab and captain routes remain clear.

The forensic lab uses pale mineral walls, recessed drawer pedestals, rounded graphite worktops, wall-mounted storage, speckled resin flooring and daylight through the rain-streaked window. The Faraday enclosure has a hinged lid; carried phones and UV wands animate between the bench and the detective, and the UV beam follows the player’s aim when the lights are dimmed. Surface wear is subtle so the evidence and instruments remain the focus.

Level 2 combines daylight shadows, rectangular ceiling lights, two shadow-casting lab task lights, and subdued environment reflections. Rounded resin worktops, metal edging, furniture shadows, and recessed building windows give surfaces depth. UV examination dims the lab fixtures without switching off the office and lobby lights.

## Verification

Run `npm run build` for a production build and `npm test` for lab-guidance progression and lighting lifecycle checks. On a disposable Level 2 run in the Vite development server, run `(await import('/tests/labUI.browser.js')).checkLabUI(__level())` in the browser console to check help, dialog closing, keyboard focus, repeated terminal opening and background DNA completion.

Instrument regression checks are available in `tests/labInstruments.browser.js`; Level 1 collection checks are in `tests/evidenceCollection.browser.js`. Run these on disposable development playthroughs.

## HUD, UI and loading

The office, station and chase share muted teal panels, warm paper text, restrained amber accents, rounded controls and readable sans-serif typography with the main menu, pause menu and settings. Status, objectives and controls use common positions. The contents remain specific to each level: evidence and tools in the office, reports and lab tasks in the station, and suspect distance during the chase. File panels use the paper styling of the menus.

Every level loads over a dimmed view of its actual scene. The room or environment appears as soon as its geometry is constructed, and models and textures fill in while resources load. Movement and gameplay updates stay suspended until assets and shader preparation finish. The level title appears over the same scene before play begins. Initial application startup uses the GENESIS loading screen before a level exists.

HUD elements are hidden during loading and shell menus. Compact layouts reduce panel size. Levels 1 and 2 use the main view without a minimap. Loading animation respects reduced-motion preferences. Walking and sprinting have consistent speed in straight and diagonal directions.

## 🧑‍💻 Team — 404 Found Us

- Busisiwe Mnguni
- Pumelela Mapukata
- Sibusiso Ndunge

## 📝 Credits

The in-game Credits screen lists specific creators, original source links, licences and modifications. The same evidence and outstanding questions are recorded in [ASSET-CREDITS.md](public/ASSET-CREDITS.md); library notices ship in [THIRD-PARTY-LICENSES.txt](public/THIRD-PARTY-LICENSES.txt).

Credits state the available creator, source and licence details. Missing information is labelled as not recorded; the source records preserve the remaining provenance uncertainties.

## 🔒 Ground Rules

- Push to your own branch — not directly to main
- Main branch is always the working version
- If something breaks main — fix it immediately
- Deploy to LAMP at the end of every week
