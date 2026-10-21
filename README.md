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
- Photograph first, lift second — wrong tool means contamination
- Log every clue: handkerchief (blood-soaked monogram), casing, hair, note, diary, wiped UV trail and more
- Pickup notes are the detective’s tentative thoughts; conclusions are left for the Level 2 examinations
- Photograph and collect every exhibit, then open the case file and seal it to travel to the station — no timeline-ordering puzzle

### Level 2 — "The Forensic Lab" ✅ Playable

**Vibe:** Benches, sign-in desk and comparison scope, lab-camera work.

**How to play:**
- Greet Mokoena at reception with E, then go straight to the lab; there is no reception conversation or initial captain handover
- Sign the intake sheet and put on gloves
- Examine the phone, trace evidence, blood, and the casing / UV-trail reconstruction at the four benches
- Shield the phone, recover its PIN on the examiner laptop, unlock the handset and enable airplane mode
- Photograph findings, file all four reports, and sign each page at the report table
- Bring the completed file to Captain Mabaso’s office. “You have brought the evidence” appears, then Level 3 loads automatically

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
- Audio sources are listed in the in-game Credits; Level 2 music is credited to **freemusic**.

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
   npm install
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
   npx serve dist
   ```
   (Do not open _index.html_ directly as a file — use the HTTP server.)
3. **Zip the contents of dist/ with index.html at the top level.**
4. **Upload to LAMP via Moodle submission.**
5. **Open the published URL and check the console for 404s.**
   (**Important:** the game is served from a subdirectory, so all paths must be relative (e.g. `./assets/..`).)

---

## Helping new players with Level 2

Open **Controls & mission guide** from the main menu or Pause (P). The guide includes a short station route, expandable instructions for each bench, optional laptop command help, and troubleshooting. Close a lab device with Esc before opening Pause.

Level 2 now starts with **FIELD TRAINING** enabled. Its amber marker points to the current object, its card gives one action at a time, and device controls receive an outline when relevant. Guidance advances from actual lab actions, supports work completed out of order, and never selects a suspect for the player. Press **H** or use the guidance button to turn it off or back on.

For a first playthrough, explain one loop: **examine → photograph → file → sign**. Demonstrate intake and one bench, then let the player finish the others using the HUD’s NEXT instruction. Explain the phone shielding and airplane-mode steps before they handle it. Avoid revealing suspects or lab results: teach the controls and process, leaving the deductions to the player.

## Station visuals

Level 2 combines daylight shadows, rectangular ceiling lights, two shadow-casting lab task lights, and subdued environment reflections. Rounded resin worktops, metal edging, furniture shadows, and recessed building windows give surfaces depth. UV examination dims the lab fixtures without switching off the office and lobby lights.

## Verification

Run `npm run build` for a production build and `npm test` for lab-guidance progression and lighting lifecycle checks.

## HUD, UI and loading

The office, station and chase share a dark-blue panel style, warm paper text, amber accents, consistent typography, and common positions for status, objectives and controls. The contents remain specific to each level: evidence and tools in the office, reports and lab tasks in the station, and suspect distance during the chase. File panels use the paper styling of the menus.

Every level loads over a dimmed view of its actual scene. The room or environment appears as soon as its geometry is constructed, and models and textures fill in while resources load. Movement and gameplay updates stay suspended until assets and shader preparation finish. The level title appears over the same scene before play begins. Initial application startup uses the GENESIS loading screen before a level exists.

HUD elements are hidden during loading and shell menus. Compact layouts reduce panel size and omit the minimap on smaller windows. Loading animation respects reduced-motion preferences. Walking and sprinting have consistent speed in straight and diagonal directions.

## 🧑‍💻 Team — 404 Found Us

- Banele Mjali
- Busisiwe Mnguni
- Pumelela Mapukata
- Sibusiso Ndunge

## 📝 Credits

### Level 2 — The police station

| Asset | Source |
| :--- | :--- |
| Bricks, wall, carpet, wood floor, road and painted plaster | struffelproductions |
| Police vehicle | low-poly.com |
| Furniture | Sketchfab |
| Music | freemusic |
| Sky | CGTrader |

These attributions apply to **Level 2**. Other music and audio retain the OpenGameArt.org credit shown in-game. Rendering, audio and build tools: Three.js, Howler.js and Vite. Menu typefaces: Big Shoulders Display and Courier Prime.

## 🔒 Ground Rules

- Push to your own branch — not directly to main
- Main branch is always the working version
- If something breaks main — fix it immediately
- Deploy to LAMP at the end of every week
