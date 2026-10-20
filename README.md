# GENESIS — Read the Room. Close the Case.

A 3D browser-based murder mystery built with Three.js. Dr. Thabo Nkosi has been found dead in his university office — one gunshot, close range. You are the investigator. Work four levels — the office, the lab, the city, the depot stakeout — question five witnesses, log the evidence, and close the case.

---

## The Story

Central City, October. Rain for three days straight.

Dr. Nkosi is found dead at his desk. No witnesses, no confession — only what the room remembers: a handkerchief with someone else's blood, a 9mm casing, brown hair on the wrong chair, a torn note naming three people, and a diary pointing at the city.

Five people around the waterfront know something about that night. Three of them are lying. Question all five, then seal the list — whoever you bring in goes to the cells, and whoever you leave off walks free. In the cells, show each prisoner the right evidence, then accuse the one who pulled the trigger.

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

### Level 3 — "The City" 🚧 Still in progress

**Vibe:** Waterfront street at last light, passing traffic, café terrace, orchestral music + traffic ambience.

**How to play:**
- Move with WASD + mouse, E to question / collect, C for the case file, B for the evidence board, F for UV
- Question all five witnesses (E while facing them), each with follow-ups unlocked by office and street evidence
- Collect three city clues: an unregistered pistol, a UV-only scrawl, a timestamped parking stub
- Ambient life: moving cars, a café terrace with a lit shop sign, benches, a quay railing, boats on the water, street lamps
- Link evidence on the board (B), ask the captain for a warrant (Y accept / N keep investigating) — authorises the depot stakeout
- _Note: this level is still being built — questioning, board links and the warrant flow may change._

### Level 4 — "The Depot Stakeout" ✅ Finale (needs City warrant)

**Vibe:** 14:00, dockside depot parking bays — finale.

**How to play:**
- Arrive via the City warrant (Y), hold the sightline, follow prompts to close the case

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
| Evidence board (city) | B              |
| Warrant accept / decline | Y / N       |
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
