# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install`: install dependencies (Node.js `^20.19.0 || >=22.12.0`).
- `npm run dev`: dev server with hot reload (http://localhost:5173).
- `npm test`: run the game-rules tests once (Vitest). `npm run test:watch` re-runs them on save.
- `npx vitest run src/game/rules.test.ts -t "<test name>"`: run a single test.
- `npm run build`: type-check (`vue-tsc`), then production build into `dist/`. There is no linter yet.

npm 10 can crash with `Cannot read properties of null (reading 'edgesOut')` when it resolves the dev dependencies from scratch (vitest's optional peers), for example when adding a package. `npm install --legacy-peer-deps` works around it. Installing from the existing `package-lock.json` is unaffected.

## Architecture

Vue 3 + TypeScript + Vite single-page app with a French UI. Roadmap step 1 (the solo browser prototype) and most of step 2 (barracks, four troop types, monster camps, battle reports) are implemented; research (Académie) is next. There is no server yet.

- `src/game/` holds the game rules in plain TypeScript, with no Vue, DOM or browser-storage dependency. Keep it that way: this code is meant to move to the server at roadmap step 3, where the server becomes authoritative.
  - `config.ts` holds every number: resources, races and their bonuses, buildings, troops, monsters and camps, costs, durations, production, growth factors and the starting state. Balancing changes go here, not in the rules.
  - `rules.ts` is pure functions over an immutable `GameState`. Nothing ticks: `advance(state, now)` replays the scheduled events (construction end, training end, army arrival, army return) in time order, accruing net production (production minus troop food upkeep, never below zero) up to each one, then up to `now`. When food is empty and upkeep exceeds production, troops are starving (`isStarving`): nobody deserts, but a battle fought while starving applies `STARVATION_ATTACK_MALUS` to the attackers. Players can dismiss troops (`dismissTroops`) to cut upkeep, which also avoids a soft-lock (no food means no Château upgrade, which caps the farms). This is what makes offline progress work, and advancing in one jump or second by second gives the same result (a test checks it). Each player action (`startUpgrade`, `startTraining`, `startExpedition`, `dismissTroops`) advances first, then validates with its `check*` function, which returns the reason shown in the UI.
  - `battle.ts` is the deterministic battle simulation: simultaneous rounds, damage spread across the enemy groups by head count, and a bonus against the family named in `strongAgainst`. Monsters fight as one of the four troop families.
  - `rules.test.ts` and `battle.test.ts` avoid depending on balancing values: they build states with unlimited resources, or groups with fixed stats.
- `src/ui/` is the display layer. `useGame.ts` owns the reactive state, ticks once a second and saves to `localStorage` under a versioned key. Bump `SAVE_VERSION` on incompatible format changes; `loadSave` rebuilds the state field by field, defaulting what older saves lack and dropping fields the game no longer has, so a new state field must be added there with its default. `CityView.vue` holds the sticky resource bar and three tabs: Cité (`BuildingCard`), Armée (`ArmyPanel`, `UnitCard`) and Alentours (`WorldPanel`, `CampCard`, battle reports).
- Styling: a single dark theme defined as CSS custom properties in `src/style.css`, which also holds the shared card (`.plaque`), grid, progress and form styles; component styles are scoped. Icons are emoji placeholders set in `config.ts`. `docs/graphismes.md` holds the art style guide and the list of images (with file names) that will replace them.

## Game Design

Design decisions live in `docs/conception.md` (in French). It is the source of truth and supersedes the README where they differ. Read it before implementing gameplay, and update it whenever the owner settles a design question. Each item is tagged Décidé, Proposition or À trancher.

In short: a free-for-everyone (no pay-to-win) multiplayer kingdom-building strategy game, in the same genre as Rise of Kingdoms but with a medieval-fantasy setting (several playable races, magic, dragons). Everything runs in real time with durations, combat included: there is no turn-based mode. Progress continues while the player is offline. All content (name, races, heroes, art) must be original; never reuse Rise of Kingdoms' content.

Platform roadmap: web app first, then packaged as an Android app via Ionic/Capacitor. Keep the web stack compatible with that (the Vite build already uses relative asset paths).

## Working with the Owner

The project owner communicates in French and is learning to code. Respond in French, explain technical choices simply, and prefer incremental steps over large opaque changes.
