// Le rythme de la progression sur des années : un bâtisseur virtuel, sans armée, passe dans sa cité
// cinq fois par jour (à 8 h, 12 h, 16 h, 20 h et minuit) et lance ce qu'il peut : le Château d'abord,
// l'Entrepôt quand les réserves ne gardent plus assez, puis le bâtiment le plus en retard. À chaque
// palier (Château 10, 20, 30, 40), il monte l'Académie et la Caserne au niveau du palier et mène la
// grande recherche du rang suivant, sans laquelle le Château ne passe pas. Il ne fait pas d'autre
// recherche, et ne vit que de sa production (ni butin, ni récolte) : un joueur qui se bat ira plus vite.
//
//   npm run pacing          (4 ans de jeu, humains)
//   npm run pacing -- 6 orcs
//
// Il dit au bout de combien de jours le Château atteint chaque niveau, et où en sont les autres
// bâtiments. À relancer après avoir changé les coûts, les durées ou la production dans config.ts.

import { BUILDINGS, MAX_LEVEL, MAX_RANK, RACES, RANK_STEP, type BuildingId, type RaceId } from '../src/game/config.ts'
import {
  advance,
  checkResearch,
  checkUpgrade,
  maxConstructions,
  maxLevelOf,
  newGame,
  rankOpen,
  rankTech,
  startResearch,
  startUpgrade,
  type GameState,
} from '../src/game/rules.ts'

const HOUR = 3600_000
const DAY = 24 * HOUR
/** Un matin, à 8 h. */
const T0 = Date.UTC(2026, 0, 1, 8)
/** Les heures de passage, chaque jour. */
const VISITS = [0, 4, 8, 12, 16]
const years = Number(process.argv[2] ?? 4)
const race = (process.argv[3] ?? 'humans') as RaceId
if (!RACES.some((r) => r.id === race)) throw new Error(`Race inconnue : ${race}`)

/** Les bâtiments utiles au bâtisseur : tous, sauf l'Aire du dragon (elle ne sert qu'au dragon). */
const OTHERS = BUILDINGS.map((b) => b.id).filter((id) => id !== 'castle' && id !== 'dragonRoost')

function upgrade(state: GameState, id: BuildingId, now: number): GameState | null {
  return checkUpgrade(state, id).ok ? startUpgrade(state, id, now) : null
}

/** Le prochain rang à ouvrir (null quand ils le sont tous), et le niveau de son palier. */
function nextRank(state: GameState): { rank: number; level: number } | null {
  for (let rank = 2; rank <= MAX_RANK; rank++) {
    if (!rankOpen(state, rank)) return { rank, level: RANK_STEP * (rank - 1) }
  }
  return null
}

/** Lance la grande recherche du prochain rang, dès qu'elle est possible. */
function researchRank(state: GameState, now: number): GameState {
  const next = nextRank(state)
  const tech = next ? rankTech(next.rank) : null
  return tech && checkResearch(state, tech.id).ok ? startResearch(state, tech.id, now) : state
}

/** Ce que le bâtisseur lance à son passage, tant qu'il a un chantier libre et de quoi payer. */
function visit(state: GameState, now: number): GameState {
  let g = researchRank(state, now)
  while (g.constructions.length < maxConstructions(g)) {
    const castle = checkUpgrade(g, 'castle')
    // Le Château d'abord ; trop cher pour les réserves, il faut d'abord l'Entrepôt.
    const first = castle.ok ? 'castle' : castle.reason.startsWith('Tes réserves ne gardent') ? 'warehouse' : null
    const next = first ? upgrade(g, first, now) : null
    if (next) {
      g = next
      continue
    }
    // Puis il prépare le prochain palier : l'Académie et la Caserne à son niveau, pour sa grande recherche.
    const palier = nextRank(g)
    const ready = (['academy', 'barracks'] as BuildingId[])
      .filter((id) => palier && g.levels[id] < palier.level)
      .map((id) => upgrade(g, id, now))
      .find((s) => s !== null)
    if (ready) {
      g = ready
      continue
    }
    // Sinon, le bâtiment le plus en retard (à égalité, dans l'ordre de la liste).
    const lagging = [...OTHERS]
      .filter((id) => g.levels[id] < maxLevelOf(BUILDINGS.find((b) => b.id === id)!))
      .sort((a, b) => g.levels[a] - g.levels[b])
    const other = lagging.map((id) => upgrade(g, id, now)).find((s) => s !== null)
    if (!other) return researchRank(g, now)
    g = other
  }
  return researchRank(g, now)
}

const start = newGame(race, T0, 1)
let game: GameState = { ...start, bands: [], nextBandAt: null, nodes: [], nextNodeAt: null, encampment: { resetAt: null, gateOpen: false, sprung: [] } }
const reached: number[] = []
const snapshots = new Map<number, Record<BuildingId, number>>()
console.log(`Race : ${race} · ${years} ans au plus · passages à 8 h, 12 h, 16 h, 20 h et minuit\n`)

for (let day = 0; day < years * 365 && game.levels.castle < MAX_LEVEL; day++) {
  for (const hour of VISITS) {
    const now = T0 + day * DAY + hour * HOUR
    game = visit(advance(game, now), now)
  }
  // Les raids n'intéressent pas le bâtisseur : on les écarte.
  game = { ...game, nextRaidAt: null, bands: [] }
  const level = game.levels.castle
  if (reached[level] === undefined) {
    for (let l = 1; l <= level; l++) reached[l] ??= day + 1
    snapshots.set(level, { ...game.levels })
  }
}

const when = (days: number) => (days < 60 ? `${days} j` : days < 730 ? `${(days / 30.4).toFixed(1)} mois` : `${(days / 365).toFixed(1)} ans`)
for (let level = 2; level <= MAX_LEVEL; level++) {
  if (reached[level] === undefined) break
  if (level <= 10 || level % 5 === 0) console.log(`Château ${String(level).padStart(2)} : jour ${String(reached[level]).padStart(4)} (${when(reached[level])})`)
}
for (const level of [10, 25, 50]) {
  const levels = snapshots.get(level)
  if (levels) console.log(`\nAu Château ${level} : ${Object.entries(levels).map(([id, l]) => `${id} ${l}`).join(', ')}`)
}
console.log(`\nFin : Château ${game.levels.castle} après ${when(Math.round((game.updatedAt - T0) / DAY))}.`)
