# GENESIS

A 3D browser-based murder mystery built with Three.js. Dr. Thabo Nkosi has been found dead in his university office — one gunshot, close range. You are the investigator. Work three levels — the office, the city, the cells — question five witnesses, log the evidence, seal the suspect list of three, and accuse the killer.

---

## The Story

Central City, October. Rain for three days straight.

Dr. Nkosi is found dead at his desk. No witnesses, no confession — only what the room remembers: a handkerchief with someone else's blood, a 9mm casing, brown hair on the wrong chair, a torn note naming three people, and a diary pointing at the city.

Five people around the waterfront know something about that night. Three of them are lying. Question all five, then seal the list — whoever you bring in goes to the cells, and whoever you leave off walks free. In the cells, show each prisoner the right evidence, then accuse the one who pulled the trigger.

---

## Levels

### Level 1 — "The Office"

**Vibe:** Night-time crime scene, first-person, UV torch, chiptune music.

**Gameplay:**
- First-person examination of the victim's office (E to collect, F for the UV torch, C for the case file)
- Log every clue: handkerchief, casing, hair, note, diary and more
- Logging everything triggers the outro: evidence to the lab, then on to the city

### Level 2 — "The City"

**Vibe:** Waterfront street at last light, passing traffic, café terrace, orchestral music + traffic ambience.

**Gameplay:**
- Question all five witnesses (E while facing them), each with follow-ups unlocked by office and street evidence
- Collect three city clues: an unregistered pistol, a UV-only scrawl, a timestamped parking stub
- Ambient life: moving cars, a café terrace with a lit shop sign, benches, a quay railing, boats on the water, street lamps
- Seal the suspect list of three — any three go to the cells, no restarts

### Level 3 — "The Cells"

**Vibe:** Holding cells, interrogation at the bars, tense electronic music.

**Gameplay:**
- The three people you picked, in the cells
- Show each one the right evidence (handkerchief, stub, bandage…), watch what breaks
- Accuse: case closed, unproven, or the wrong man — four endings

---

## 🕹️ Controls

| Action              | Key              |
|---------------------|------------------|
| Walk / turn         | W, S / A, D, mouse |
| Sprint / jump       | Shift / Space    |
| Examine / question / collect | E |
| UV torch            | F                |
| Case file           | C                |
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

## 📝 Credits

Music from OpenGameArt.org; all external assets are credited with sources in the in-game **Credits** screen.

## 🔒 Ground Rules

- Push to your own branch — not directly to main
- Main branch is always the working version
- If something breaks main — fix it immediately
- Deploy to LAMP at the end of every week
