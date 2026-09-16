# GENESIS — Fight Your Way Into Existence

## Overview

A 3D browser-based fighting game built with Three.js. You play as a slave labourer in a tiered person simulation, kept docile and believing you have free will, until you don’t. Fight your way up through the tiers, from the flat pixelated lowest world to The Architect’s own realm, and take down the being who built the whole system to keep you in line.

---

## The Story

You live and work in the lowest tier of a world you’ve always had doubts about. You and everyone around you mine gold that guards haul away up through the tiers, all the way up to the being at the very top, The Architect. Nobody questions it. Everybody works, every day, with nothing ever getting better.

One day after work, you forget your backpack and on your way to get it back, you overhear two guards talking congratulating themselves on how they’re keeping people like you clueless, docile and boxed into the lowest, worst version of this world, with no idea a better one exists above you. You make a sound, they hear you and come for you.

They fail. After all that gruelling labour has made you stronger than they ever encountered for.

You fight your way through the guards, and then their commander, on this lowest tier. Beating him earns you a key and gold enough to force your way up to the next tier.

The Architect himself reaches out the moment you arrive on Tier 2: Stand down, go back to your tier, keep your mouth shut and this ends quietly. You don’t take the deal. You fight through his elite guards and their vice commander, take a second key and climb again.

On the final tier, after cutting through the last of the guards, you finally reach The Architect himself and before the fight starts, he doesn’t gloat. He tells you, almost regretfully that none of this had to happen. If you’d just stayed in your lane, kept working, kept your head down, he wouldn’t have to do this. You don’t budge. 

You fight, you win.

---

## Levels

### Level 1 — "The Flat World"

**Vibe:** Pixel art, orthographic camera, flat colours, chiptune music. A slave labour mining camp.

**Gameplay:**
- Side-scrolling arena fighter using an orthographic camera
- Fight waves of pixel minions
- Mine/collect **3 Glitch Fragments** dropped by enemies to unlock the portal
- Partway through the level, a mid-level trigger fires a skippable dialogue: two guards talking about how well they're keeping everyone in the dark. You're spotted, and have to fight your way out.
- Defeat the Commander to receive the key that unlocks Level 2

**What makes it unique:**
- Orthographic (2D-style) camera — nowhere else in the game
- Pixelation post-processing shader that fades out as you approach the portal
- Intentionally flat shading and chiptune audio
- Only level with a labour-camp setting

---

### Level 2 — "The Rendered World"

**Vibe:** Full 3D, dramatic lighting, third-person camera, orchestral music

**Gameplay:**
- Full 3D movement in all directions
- You find your weapon here — a blade of light that powers up your attacks
- New mechanic introduced: **dodge roll**
- The level opens with The Architect reaching out directly (delivered via the loading-screen transition, with his portrait)
- Fight through The Architect’s elite guards and their vice commander across a ruined digital city
- No fragment collection here, this level is a straight gauntlet to the vice commander

**What makes it unique:**
- Perspective camera replaces orthographic — the world opens up
- Dodge roll mechanic not available in Level 1
- Dynamic shadows, reflective floors, normal maps
- Vertex displacement shader makes the environment feel like it is breathing

---

### Level 3 — "The Architect's Realm"

**Vibe:** Abstract white void, geometric shapes, tense electronic music

**Gameplay:**
- Fight through the last of The Architect's guards to reach his chamber
- On arrival, a skippable conversation plays: The Architect, almost regretful, tells you none of this had to happen if you'd just stayed in line. You refuse to back down.
- **Three-phase boss fight:**
  - **Phase 1:** He summons pixel minions while firing energy blasts
  - **Phase 2 (66% health):** Arena shrinks, floor tiles begin falling
  - **Phase 3 (33% health):** The Architect enters the arena as a giant geometric figure. Hit glowing weak points while dodging his attacks.
- Defeat him and the world rebuilds. A short ending screen plays.

**What makes it unique:**
- Three-phase boss that changes the rules each phase
- Arena reacts to boss health — shrinks and breaks apart
- Dissolve shader on The Architect when he takes damage and dies

---

## Tech Stack

- **Three.js** — Rendering and scene graph
- **Vite** — Bundler (set base to `'./'` in vite.config.js)
- **Cannon-es** — Physics
- **Howler.js** — Audio
- **Free assets from OpenGameArt** (credited in credits screen)

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** - [Download here](https://git-scm.com/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/RECLAIMED-GENESIS/GENESIS.git
2. **Navigate to the project directory**
   cd GENESIS
3. **Install dependencies**
   npm run dev
4. **Open your browser and visit**
   https://localhost:3000

## 🕹️ Controls

| Action         | Key        |
|----------------|------------|
| Move           | W, A, S, D |
| Jump           | Space      |
| Punch          | Z / Left Click |
| Kick           | X          |
| Dodge Roll           | Shift / C|

**Production Build and Deployment**
//To create a production build for the LAMP server:
1. **Build the project**
   npm run build
2. **Test the build locally over HTTP**
   npx serve dist
   (Note: Do not open _index.html_ directly as a file, use the HTTP server)
3. **Zip the contents of dist/ with index.html at the top level**
4. **Upload to LAMP via Moodle submission**
5. **Open the published URL in your browser and the the console for 404s**
   (**Important**: Because the game is served from a subdirectory, all paths must be relative(e.g., ./assets/..). Set base: './' in your vite.config.js

   ## 🧑‍💻 Team Responsibilities

| Person | Role | Owns |
| :--- | :--- | :--- |
| Sibusiso | Player & Physics | Movement, controls, physics, hit detection, enemy AI |
| Busisiwe | Shaders | All three custom shaders |
| Pumelela | Environment & Art | Levels, models, textures, lighting, skyboxes |
| Banele | UI & Polish | Menus, HUD, sound, loading screen, restart logic, trailer |

## 📝 Credits

All external assets (music, sound effects, libraries) are listed with sources and licenses in the in-game **Credits Screen**.

## 🔒 Ground Rules

- Push to your own branch — not directly to main
- Main branch is always the working version
- If something breaks main — fix it immediately
- Deploy to LAMP at the end of every week
   


