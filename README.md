# Assignment 02 - Mario Platformer

**Student ID:** 111006214  
**Engine:** Cocos Creator 2.4.8  
**Language:** TypeScript  
**Live URL:** https://mariohw2-3d340.web.app

---

## Overview

This is a Mario-style 2D platformer built from scratch using Cocos Creator 2.4.8 and TypeScript. The goal was to implement core platformer mechanics including physics-based movement, enemy AI, a power-up system, a working HUD, and local multiplayer. The game has two playable stages, six scenes total, and is deployed to Firebase Hosting as a web build.

The project went through a full redesign of the codebase structure during development — all scripts are organized into `assets/Script/` for scene-attached components and `assets/Function/` for shared utilities. Every major system (movement, collision, camera, pause, enemy behavior) is separated into its own component.

---

## How to Run

### Option 1 — Play in Browser (recommended)
Open: **https://mariohw2-3d340.web.app**

Works in any modern browser. No installation needed.

### Option 2 — Open in Cocos Creator
1. Download and install **Cocos Creator 2.4.8** (exact version — 2.x and 3.x are not compatible with each other)
2. Launch the Cocos Creator Dashboard
3. Click **Open Other Projects** and select this project folder
4. Wait for assets to import (first open takes a moment)
5. Click the **Play** button in the toolbar

### Option 3 — Run the Web Build Locally
The exported build is in `build/web-desktop/`. You need to serve it through a local HTTP server because browsers block `file://` for canvas games.

Using Python:
```bash
cd build/web-desktop
python3 -m http.server 8080
```
Then open `http://localhost:8080` in a browser.

---

## Controls

### Single Player
| Action | Key |
|--------|-----|
| Move Left | A |
| Move Right | D |
| Jump | W |
| Switch Camera Focus | S |

---

## Gameplay

### Movement and Physics
Movement uses a bitflag enum system so diagonal states (jumping while moving left or right) are handled cleanly. Horizontal acceleration ramps up to a max speed rather than instant velocity changes, which gives the movement a Mario-like feel. Jumping is only allowed when the player has at least one active ground contact, tracked with a counter to handle multi-tile edges correctly.

### Enemies
- **Goomba** — walks in one direction, reverses when it hits a wall. Killed by stomping (jumping on top). Hurts Mario on side contact.
- **Koopa Turtle** — walks like a Goomba but enters a shell when stomped. The shell can be kicked to send it flying across the stage, killing other enemies it hits.
- **Fire Flower** — stationary enemy that bobs up and down. Kills Mario on contact. Cannot be stomped.

### Power-ups
Question boxes contain one of three rewards: a coin, a Super Mushroom, or a Life Mushroom. They only activate when bumped from below. Super Mushroom grows Mario to Big Mario with bigger collider and different animations. Life Mushroom gives an extra life. Mushrooms slide along the ground and reverse direction when hitting walls.

### Scoring
- Coin collected: +100
- Enemy stomped: +100
- Question box bumped: +100
- Mushroom collected: +1000
- Time bonus on stage complete: remaining seconds x 10

High score is saved to `localStorage` and compared on each game over.

### Lives and Death
Mario starts with 5 lives. Taking a hit when Big Mario powers him down instead of killing him. Taking a hit as small Mario loses a life and respawns at the spawn point with a brief invincibility period. Losing all lives triggers the game over scene.

---

## Scene Structure

The game has 6 scenes that flow in this order:

```
Menu
  |
  v
ChooseStage  (pick Stage 1 or Stage 2, single or multiplayer)
  |
  v
LoadStage    (brief loading screen, reads the mode and stage choice)
  |
  v
Stage1 / Stage2   (main gameplay)
  |                 |
  v                 v
GameOver        ChooseStage  (on stage complete)
  |
  v
ChooseStage
```

Stage choice and play mode are passed between scenes using static class properties on `StageController` to avoid Firebase or any backend dependency.

---

## Features Summary

- Physics-based movement with acceleration and max speed cap
- Jump gating via ground contact counter (handles multi-tile surfaces)
- One-way platforms (solid from above only, pass-through from below or sides)
- Big Mario / Small Mario state with collider resize on power-up and power-down
- Death animation that temporarily disables physics and blocks input
- Pause system that freezes all enemy rigid bodies and animations (PausableBody component)
- Lerp-based camera that smoothly follows the player, clamped to not scroll left of origin
- Camera can switch focus between players in multiplayer
- Countdown timer with game-over on timeout
- 6-digit score display
- Volume control (affects both music and effects simultaneously)
- High score persisted in localStorage
- Firebase Hosting deployment with correct MIME types for .js and .wasm

---

## Project Structure

```
HW2_v1/
├── assets/
│   ├── Anime/
│   │   ├── SmallMario/      MarioDead, MarioGoBack, MarioIdle, MarioJump, MarioRun, MarioStop
│   │   ├── BigMario/        BigMarioGoBack, BigMarioIdle, BigMarioJump, BigMarioRun, BigMarioStop
│   │   ├── Coin.anim
│   │   ├── Flower.anim
│   │   ├── GoombaDead.anim, GoombaRun.anim
│   │   ├── QuestionBox.anim
│   │   └── TurtleDead.anim, TurtleRotate.anim, TurtleWalk.anim
│   │
│   ├── Function/
│   │   ├── CollisionTag.ts      enum for physics collider tags (PLAYER, GROUND, ENEMY, etc.)
│   │   ├── InputBindings.ts     PlayerKeyBindings type definition
│   │   └── MovementFlags.ts     bitflag movement enum and helper functions
│   │
│   ├── Map/
│   │   ├── stage1.tmx           Tiled tilemap for Stage 1
│   │   ├── stage2.tmx           Tiled tilemap for Stage 2
│   │   └── stage2Front.tmx      Tiled tilemap for Stage 2 foreground layer
│   │
│   ├── Prefab/
│   │   ├── Mario.prefab         player character prefab
│   │   ├── Map/                 Goomba, Turtle, Flower, coin, PowerMushroom, HealMushroom, QuestionBox
│   │   ├── Menu/                InputLine, InputMenu, MenuButton, RankCount, RankScore, RankUsername
│   │   └── Stage/               Stage1Canvas, Stage2Canvas (HUD and stage config)
│   │
│   ├── Scene/
│   │   ├── Menu.fire
│   │   ├── ChooseStage.fire
│   │   ├── LoadStage.fire
│   │   ├── Stage1.fire
│   │   ├── Stage2.fire
│   │   └── GameOver.fire
│   │
│   ├── Script/
│   │   ├── PlayerController.ts    movement, animation, physics callbacks, power-up state
│   │   ├── StageController.ts     HUD, score, timer, enemy init, pause, win/lose flow
│   │   ├── FollowCamera.ts        lerp camera that follows the active player
│   │   ├── PausableBody.ts        component that freezes a rigid body on pause
│   │   ├── Menu.ts                main menu BGM and scene navigation
│   │   ├── StageSelectScreen.ts   stage select logic and multiplayer prompt
│   │   ├── StageLoadingScreen.ts  reads stage choice and loads the correct scene
│   │   ├── BarrierTag.ts          tags colliders as BARRIER on start
│   │   ├── EnemyTag.ts            tags colliders as ENEMY on start
│   │   ├── GroundTag.ts           tags colliders as GROUND on start
│   │   └── OneWayPlatform.ts      tags colliders as ONE_WAY_PLATFORM on start
│   │
│   ├── audio/          BGM tracks (bgm_1, bgm_2, bgm_3), sound effects (jump, kick, coin, etc.)
│   ├── effects_UI_tiles/  sprite sheets for tiles, items, score digits, UI icons
│   ├── enemies/        Goomba, Turtle, Flower sprite sheets and plists
│   ├── fonts/          white_font and yellow_font bitmap fonts
│   ├── pictures/       UI images (buttons, backgrounds, icons, menu art)
│   └── player/         mario_small and mario_big sprite sheets with plists
│
├── build/web-desktop/   exported web build served by Firebase Hosting
│   ├── index.html
│   ├── main.*.js
│   ├── cocos2d-js-min.*.js
│   ├── physics-min.*.js
│   ├── style-desktop.*.css
│   └── assets/          bundled game assets
│
├── settings/
│   └── project.json     Cocos project settings (start scene, resolution, collision matrix)
│
├── firebase.json        Firebase Hosting config (public dir, MIME headers, cache rules)
├── project.json         Cocos project descriptor
├── tsconfig.json        TypeScript compiler config
├── jsconfig.json        JS config for editor tooling
├── creator.d.ts         Cocos Creator type definitions
├── README.md            this file
└── AI_reference.pdf     AI assistance disclosure document
```

---

## Technical Notes

**Why CollisionTag instead of node names:** Using integer tags on physics colliders instead of checking `node.name` means collision behavior is not affected by any node renaming in the editor.

**Why groundContactCount is an integer:** A single boolean breaks when Mario stands on the corner between two tiles — he briefly loses ground contact on one tile before gaining it on the next, causing a mid-air jump. Counting contacts instead of tracking a boolean prevents this.

**Why PausableBody is a separate component:** Enemy behaviors are set up as closures on rigid body callbacks at runtime, so they have no component of their own that could be paused. PausableBody is attached to each enemy prefab and lets `StageController` call a single `togglePause()` on all of them without knowing their type.

**Static properties for scene passing:** `StageController.stageChoice` and `StageController.playMode` are static class properties. This is the standard Cocos 2.4.x way to pass data between scenes without a persistent node or external storage. The properties survive scene loads because they live on the class itself, not a scene node.

---

## Firebase Deployment

- **Project ID:** mariohw2-3d340
- **URL:** https://mariohw2-3d340.web.app
- **Public directory:** `build/web-desktop`

The `firebase.json` sets explicit `Content-Type` headers for `.js` and `.wasm` files, which are required for browsers to run them correctly. It also sets `Cache-Control: no-cache` so updated builds are served immediately without stale asset issues.

To redeploy after a new build:
```bash
firebase deploy --only hosting --project mariohw2-3d340
```

---

## AI Disclosure

AI assistance (Claude) was used during parts of this project. The full breakdown of what was AI-assisted, what was written personally, and what was done entirely without AI is documented in `AI_reference.pdf`.
