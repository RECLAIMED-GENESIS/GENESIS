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
- Move with W/S, turn with A/D + mouse (click the scene once to capture the mouse), Shift to sprint, Space to jump
- Work the kit: Q camera, 1 bags, 2 tweezers, 3 swab, E to collect, F for the UV torch, C for the case file
- Photograph first, lift second — wrong tool means contamination
- Log every clue: handkerchief (blood-soaked monogram), casing, hair, note, diary, wiped UV trail and more
- Logging everything triggers the outro: evidence to the lab

### Level 2 — "The Forensic Lab" ✅ Playable

**Vibe:** Benches, sign-in desk and comparison scope, lab-camera work.

**How to play:**
- Move with WASD + mouse, E to use benches, C for the case file, F for UV where needed
- Sign evidence in, wear gloves, shield the phone and read the microscope yourself
- Name two people from eight objects; confirm the city depot 14:00 appointment
- File the dossier to hand the case to the city

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
| Walk / turn         | W, S / A, D, mouse |
| Sprint / jump       | Shift / Space    |
| Examine / question / collect | E |
| Office kit          | Q camera, 1 bags, 2 tweezers, 3 swab |
| UV torch            | F                |
| Case file           | C                |
| First / third person | V               |
| Chase: lane / jump | A, D / Space     |
| Pause               | P, Esc, or ⏸ button |
| Restart level       | R                |

Progress auto-saves on every level change — **Continue** on the main menu picks up where you left off.

---

## Tech Stack

- **Three.js** — Rendering and scene graph
- **Vite** — Bundler (base set to `'./'` in vite.config.js for subdirectory hosting)
- **Cannon-es** — Physics
- **Howler.js** — Audio (menu theme, per-level music, city traffic ambience, UI clicks)
- Music from **OpenGameArt.org** (credited in-game)

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

## 🧑‍💻 Team — 404 Found Us

| Person | Role |
| :--- | :--- |
| Banele Mjali | UI & Polish |
| Busisiwe Mnguni | Shaders & Effects |
| Pumelela Mapukata | Environment & Art |
| Sibusiso Ndunge | Player & Physics |

### This pass
- Forensic-sim rebuild: tool-based office kit, physical lab benches, blood-soaked monogram + UV-trail deduction, city arrival ride, depot-stakeout finale
- Shell: rain-streaked menu art, paper case-file sheets, level cards, pointer-lock + pause polish, direct Open-the-Case start (story intro removed)

## 📝 Credits

Music from OpenGameArt.org; all external assets are credited with sources in the in-game **Credits** screen.

## 🔒 Ground Rules

- Push to your own branch — not directly to main
- Main branch is always the working version
- If something breaks main — fix it immediately
- Deploy to LAMP at the end of every week
