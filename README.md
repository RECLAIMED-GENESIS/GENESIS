# GENESIS

> *The Axiom chose her. Its maker wants it back.*

GENESIS (pitch title: **RECLAIMED**) is a 3D third-person action brawler that runs
in the browser. Built with Three.js for Computer Graphics and Visualisation
(Wits University). Play through three acts of hand-to-hand combat, face three
bosses, and decide how Sorini's story ends — there are **three endings**.

---

## The Story

A sentient alien core — the **Axiom** — escaped the god-like **Architect** who
built it, and hid itself inside a human girl: **Sorini**. She never asked for
it. But with the Axiom's power thrumming through her fists, she can punch
through armies — and the Architect's armies are coming.

Her journey home crosses three grounds, and every one of them belongs to him.

## The Journey

| Act | Level | What waits |
|-----|-------|------------|
| I   | **The Grove Village** | Sorini wakes in the village the Axiom led her to. Waves of grunts follow, ending with the district boss **THE WARDEN**. |
| II  | **Neon Street** | The city streets turn hostile — mutant packs, alarms, and **THE ENFORCER**, a brawler who fights harder as his health breaks. |
| III | **The Architect's Monument** | The throne hall. Two **Guardians** (blade and fist) bar the way — and when they fall, the Architect rises from his throne *without touching it*, draws his greatsword from thin air, and meets you in a three-phase duel. |

Win the final duel and the game does not end — it **asks**. What do you do
with the god who made your parasite?

- **Strike him down** — end the Architect, and the Axiom's story, in blood.
- **Take his hand** — learn what you carry… and what it can become.
- **Say nothing** — silence. Walk away from god and gift alike.

## Controls

| Input | Action |
|-------|--------|
| `W` / `↑` | Walk forward (hold `Shift` to sprint) |
| `S` / `↓` | Turn Sorini around and walk the other way |
| `A` / `←` · `D` / `→` | Rotate Sorini |
| **Mouse** | Camera look (click the canvas to capture the pointer) |
| `Shift` | Sprint |
| `Space` | Jump |
| `Shift` + `Space` | **Axiom Dash** — burst of the Axiom's power, on a cooldown (unlocks on Level 2) |
| `F` | Punch |
| `G` | Kick (heavier) |
| `H` | Hook (heavier) |
| `R` | Restart the current level |
| `Esc` | Pause menu — resume, restart, a full controls reference, volumes, mouse sensitivity, quit to menu |
| `Space` / `Enter` | Skip the current dialogue line |
| `1` / `2` / `3` | Pick a dialogue/ending choice |

Combat is combo-driven: enemies flinch, bosses have **poise** (they don't
stagger mid-swing), and boss health bars announce **phases** — the Architect
changes tactics twice before he goes down, including evasion once he's
desperate.

## Tech

- **Three.js** — WebGL renderer, FBX character pipeline, animation retargeting
- **Vite** — dev server and production bundler
- **Howler.js** — music, SFX and voice lines (per-level themes, character voice acting)
- **Custom collision** — hand-rolled capsule-vs-AABB system; no physics engine
- **Custom GLSL shaders** — a procedural cratered moon over the village, living
  nebula sky domes behind the menu and the moon monument, god-ray shafts in
  the throne hall, and a dissolve pass that burns defeated grunts away
- **Procedural PBR detail** — canvas-painted normal maps and equirectangular
  environment maps give the monument plaza, the throne hall floor and the
  wet neon street real reflections; zero extra asset files
- **Mixamo** — animation clips, retargeted onto our character rigs at load time
- **git-lfs** — all binary assets (FBX models, audio) are LFS-tracked

## Getting Started

Prerequisites:

- **Node.js ≥ 20.12** (the team standardises on Node 22 — Vite 8 uses `util.styleText`)
- **git-lfs** — required to pull the models and audio

```bash
git clone https://github.com/RECLAIMED-GENESIS/GENESIS.git
cd GENESIS
git lfs pull          # fetch ~150 MB of FBX/audio assets
npm install
npm run dev           # → http://localhost:5173
```

Production build:

```bash
npm run build
npm run preview
```

## Project Structure

```
public/assets/
  models/    character + level FBX assets (lowercase-no-spaces names)
  audio/     music/, sfx/, voices/
src/
  main.js            game bootstrap, player controller, input, combat routing
  levels/            level1.js (village) · level2.js (street) · level3.js (monument)
  player/            architect.js (L3 boss) · guardians.js · endings.js
  enemies/           grunts.js (L1 waves) · commander.js (Warden) · enforcer.js (L2 boss)
  ui/                MainMenu · MenuScene (3D menu) · HUD · BossHealthBar
                      CinematicCamera · PauseMenu · dialogue · LoadingScreen
  audio/             AudioManager (Howler) · loadAudio
  physics/           CollisionSystem (custom AABB/sphere)
  shaders/           custom GLSL — shared library (nebula sky, god rays,
                      dissolve) + moon, river
  utils/             CharacterLoader · AnimationController · utils
                      (procedural textures, normal/env-map generators)
```

## Credits

- **Team RECLAIMED** — design, code, levels, voice recordings
- Character animation clips and prop rigs via [Mixamo](https://www.mixamo.com)
- **Sorini** built on the Kachujin rig; **the Architect** on the Dreyar rig —
  both re-rigged, re-textured and animated in-house

*Active development branch: `feature/banele-commander`*
