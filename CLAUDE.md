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

Vue 3 + TypeScript + Vite single-page app with a French UI. Roadmap step 1 (the solo browser prototype) is implemented. There is no server yet.

- `src/game/` holds the game rules in plain TypeScript, with no Vue, DOM or browser-storage dependency. Keep it that way: this code is meant to move to the server at roadmap step 3, where the server becomes authoritative.
  - `config.ts` holds every number: resources, races and their bonuses, buildings, costs, durations, production, growth factors and the starting state. Balancing changes go here, not in the rules.
  - `rules.ts` is pure functions over an immutable `GameState`. Nothing ticks: `advance(state, now)` derives production and finishes the construction from timestamps. It splits the interval at the construction's end, so the new level only produces after that point. This is what makes offline progress work. Call `advance` before reading or changing state, as `startUpgrade` does.
  - `rules.test.ts` tests the rules without depending on balancing values. It builds states with unlimited resources.
- `src/ui/` is the display layer. `useGame.ts` owns the reactive state, ticks once a second and saves to `localStorage` under a versioned key. Bump `SAVE_VERSION` on incompatible format changes; `loadSave` already back-fills buildings and resources added later. `CityView.vue`, `BuildingCard.vue`, `ResourceBar.vue` and `RaceChoice.vue` render the state.
- Styling: a single dark theme defined as CSS custom properties in `src/style.css`, with scoped component styles. Icons are emoji placeholders set in `config.ts`, to be replaced by real art.

## Game Design

Design decisions live in `docs/conception.md` (in French). It is the source of truth and supersedes the README where they differ. Read it before implementing gameplay, and update it whenever the owner settles a design question. Each item is tagged Décidé, Proposition or À trancher.

In short: a free-for-everyone (no pay-to-win) multiplayer kingdom-building strategy game, in the same genre as Rise of Kingdoms but with a medieval-fantasy setting (several playable races, magic, dragons). Everything runs in real time with durations, combat included: there is no turn-based mode. Progress continues while the player is offline. All content (name, races, heroes, art) must be original; never reuse Rise of Kingdoms' content.

Platform roadmap: web app first, then packaged as an Android app via Ionic/Capacitor. Keep the web stack compatible with that (the Vite build already uses relative asset paths).

## Working with the Owner

The project owner communicates in French and is learning to code. Respond in French, explain technical choices simply, and prefer incremental steps over large opaque changes.
