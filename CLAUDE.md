# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install`: install dependencies. Node.js `>=22.18.0` is required: Node runs the server's TypeScript directly and provides its SQLite database.
- `npm run dev`: the game with hot reload (http://localhost:5173). It forwards `/api` requests to port 3000, so run `npm run server` in a second terminal to play online. Without the server, only "Jouer sans compte" works.
- `npm run server`: the game server on port 3000, restarting on code changes. Its database is `data/royaume.db`, which git ignores.
- `npm start`: production server, with the API plus the built game from `dist/` (run `npm run build` first). Environment variables: `PORT`, `DATABASE_FILE`, `STATIC_DIR`.
- `npm test`: run the tests once (Vitest), covering the game rules and the server. `npm run test:watch` re-runs them on save.
- `npx vitest run server/app.test.ts -t "<test name>"`: run a single test.
- `npm run build`: type-check (`npm run typecheck`: `vue-tsc` for the client, `tsc -p tsconfig.server.json` for the server and the rules), then build the game into `dist/`. There is no linter yet.

npm 10 can crash with `Cannot read properties of null (reading 'edgesOut')` when it resolves the dev dependencies from scratch (vitest's optional peers), for example when adding a package. `npm install --legacy-peer-deps` works around it. Installing from the existing `package-lock.json` is unaffected.

## Architecture

A Vue 3 + TypeScript + Vite single-page app with a French UI, plus a Node.js server (Hono and SQLite) that holds player accounts and their games. Roadmap steps 1 and 2 are implemented (city, troops, monster camps, research), with pannable maps of the city and its surroundings. Step 3 is under way: accounts and online games work, but the game is not hosted anywhere yet.

- `src/game/` holds the game rules in plain TypeScript, with no Vue, DOM or browser-storage dependency. Both the browser and the server run this code, so keep it that way. Node runs these files directly by stripping their types. Imports inside `src/game/` and `server/` therefore keep their `.ts` extension, and only erasable TypeScript is allowed: no `enum`, no parameter properties (`tsconfig.server.json` enforces this).
  - `config.ts` holds every number: resources, races and their bonuses, buildings, troops, monsters and camps, costs, durations, production, growth factors and the starting state. Balancing changes go here, not in the rules.
  - `rules.ts` is pure functions over an immutable `GameState`. Nothing ticks: `advance(state, now)` replays the scheduled events (construction end, research end, training ends, army arrivals and returns) in time order, accruing net production (production minus troop food upkeep, never below zero) up to each one, then up to `now`. When food is empty and upkeep exceeds production, troops are starving (`isStarving`): nobody deserts, but a battle fought while starving applies `STARVATION_ATTACK_MALUS` to the attackers. `trainings` holds at most one training per troop type, so the four types train in parallel. `expeditions` holds at most one army per camp, up to `maxExpeditions` (1 + the Commandement tech). Research effects are data in `TECHS` (`TechEffect` kinds) and are read through `techBonus(state, kind, resource?)`, which production, durations, battles and march slots all use. Players can dismiss troops (`dismissTroops`) to cut upkeep, which also avoids a soft-lock (no food means no Château upgrade, which caps the farms). This is what makes offline progress work, and advancing in one jump or second by second gives the same result (a test checks it). Each player action (`startUpgrade`, `startResearch`, `startTraining`, `startExpedition`, `dismissTroops`) advances first, then validates with its `check*` function, which returns the reason shown in the UI.
  - `actions.ts` turns player orders into data (`Action`: upgrade, research, train, attack, dismiss). `performAction(state, action, now)` advances, checks and applies an order, and returns the refusal reason if it is impossible. `parseAction` validates untrusted JSON (known ids, integer counts, no other fields) before the server uses it.
  - `save.ts`: `restoreState` rebuilds a stored game field by field, defaulting what older saves lack and dropping fields the game no longer has. The browser save and the server database both go through it, so a new state field must get its default there.
  - `battle.ts` is the deterministic battle simulation: simultaneous rounds, damage spread across the enemy groups by head count, and a bonus against the family named in `strongAgainst`. Monsters fight as one of the four troop families. `fight` also returns a per-round log, which `resolveArrival` turns into the report's `rounds` (damage and losses per round) for the combat log.
  - The tests (`*.test.ts`) avoid depending on balancing values: they build states with unlimited resources, or groups with fixed stats.
- `server/` is the authoritative game server. The client never sends a state, only actions, and the server applies them with the rules above.
  - `app.ts` builds the Hono app and its JSON routes, listed at the top of the file: accounts, sessions, `GET`/`POST`/`DELETE /api/game` and `POST /api/game/actions`. It also serves `dist/` with cache headers. `GET /api/game` returns the game as it was at the last visit and saves it advanced to now, so the client can build the "Bon retour" summary. A request that changes a game loads, applies and saves with no `await` in between, so concurrent requests cannot interleave. Keep it that way.
  - `auth.ts` checks names and passwords and handles tokens. Names are 3 to 20 letters, digits, spaces, hyphens or apostrophes, unique regardless of case (`nameKey`). Passwords need at least 8 characters and are stored as scrypt hashes with OWASP settings. Session tokens are random, stored only as SHA-256 hashes, sent as `Authorization: Bearer`, and expire after 30 days unused. After 10 wrong passwords for a name, `app.ts` locks that name for 15 minutes (in memory).
  - `db.ts` wraps `node:sqlite` with three tables: `accounts`, `sessions`, and `games` (the state as JSON). A schema change goes in a new entry at the end of `MIGRATIONS`, tracked with `PRAGMA user_version`.
  - `main.ts` starts the server from the environment variables.
  - `app.test.ts` runs the whole app in memory, with a fake clock and light scrypt settings. It sets states directly with `giveGame` instead of depending on balancing values.
- `src/ui/` is the display layer. `useGame.ts` owns the reactive state and ticks once a second.
  - A game lives either online or on the device. Online, the session is kept in `localStorage` and the server decides. Without an account, `storage.ts` saves the game under a versioned key; bump `SAVE_VERSION` on incompatible format changes.
  - Online play: each order is applied locally right away with `performAction`, then sent to the server, whose answer replaces the state. Requests go through a queue one at a time, and only the last answer in line is applied. `api.ts` wraps `fetch` and estimates the server clock (`serverNow`), which drives the timers online. The client re-syncs every minute, when the tab becomes visible again, and every 10 seconds while the server is unreachable.
  - `away.ts` builds the "Bon retour" summary.
  - Screens:
    - `AccountView.vue`: log in, create an account, or "Jouer sans compte".
    - `RaceChoice.vue`: pick a race.
    - `CityView.vue`: the sticky resource bar and four tabs:
      - Cité: `CityMap`, building chips and the selected `BuildingCard`.
      - Armée: `ArmyPanel`, and `UnitCard`, which shows its own training progress.
      - Recherches: `ResearchPanel`, `TechCard`.
      - Alentours: `WorldPanel`, with `WorldMap`, camp chips, marching armies, the selected `CampCard`, and battle reports with a collapsible combat log whose French text comes from `battleLog.ts`.
  - Shared pieces: `NoticeBar.vue` shows a lost connection or a refused order, and `AccountLine.vue` offers logout or going online.
  - Build settings: `VITE_LOCAL_ONLY=true` builds a game without online play, for the claude.ai demo, which cannot reach a server. `VITE_SERVER_URL` points the client at a server on another origin; the Android app will need it later, along with CORS on the server.
- Maps are plain SVG, no library. `MapViewport.vue` handles panning and zooming (pointer events for drag and pinch, wheel, keyboard, on-screen buttons) and renders its slot in world units; a tap only counts as a selection when the pointer did not drag. `maps.ts` holds the layouts (building plots, camp spots) and the deterministic decor. `CityMap.vue` and `WorldMap.vue` draw the scenes; marching armies are interpolated from their timestamps.
- Styling: a single dark theme defined as CSS custom properties in `src/style.css`, which also holds the shared card (`.plaque`), grid, progress and form styles; component styles are scoped. Icons are emoji placeholders set in `config.ts`. `docs/graphismes.md` holds the art style guide and the list of images (with file names) that will replace them.

## Game Design

Design decisions live in `docs/conception.md` (in French). It is the source of truth and supersedes the README where they differ. Read it before implementing gameplay, and update it whenever the owner settles a design question. Each item is tagged Décidé, Proposition or À trancher.

In short: a free-for-everyone (no pay-to-win) multiplayer kingdom-building strategy game, in the same genre as Rise of Kingdoms but with a medieval-fantasy setting (several playable races, magic, dragons). Everything runs in real time with durations, combat included: there is no turn-based mode. Progress continues while the player is offline. All content (name, races, heroes, art) must be original; never reuse Rise of Kingdoms' content.

Platform roadmap: web app first, then packaged as an Android app via Ionic/Capacitor. Keep the web stack compatible with that (the Vite build already uses relative asset paths).

## Working with the Owner

The project owner communicates in French and is learning to code. Respond in French, explain technical choices simply, and prefer incremental steps over large opaque changes.
