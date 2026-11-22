// Un joueur virtuel suit la chaîne d'objectifs depuis une nouvelle partie, et affiche le temps de
// jeu qu'il lui faut pour chacun. Pratique après avoir changé des chiffres dans config.ts : on
// voit tout de suite si le début de partie devient trop lent, trop rapide, ou si un objectif bloque.
//
//   npm run simulation              (Humains, graine 42)
//   npm run simulation -- orcs 7    (une autre race, une autre graine du hasard)
//
// Ce joueur est simple : il construit ce que demande l'objectif (et économise pour ça), entraîne des
// guerriers, recrute Ysolde et Durgan, fait des recherches, et envoie son armée contre la bande la
// plus proche (ou récolter, ou attaquer un camp, quand l'objectif le demande). Quand un raid marche
// sur la cité, son armée part l'intercepter. Il couve l'œuf de dragon dès qu'il peut, et emmène le
// dragon à chaque combat. Un vrai joueur fera mieux, ou moins bien.

import { CAMPS, QUESTS, RACES, WORLD, type BuildingId, type RaceId } from '../src/game/config.ts'
import {
  advance,
  checkDragon,
  checkHatch,
  checkMarch,
  checkRecruit,
  checkResearch,
  checkSkill,
  checkTraining,
  checkUpgrade,
  claimQuest,
  currentQuest,
  distance,
  dragonLevel,
  emptyArmy,
  getHero,
  hatchEgg,
  learnSkill,
  maxTrainingBatch,
  netPerHour,
  newGame,
  orderArmy,
  questDone,
  questProgress,
  recruitHero,
  startMarch,
  startResearch,
  startTraining,
  startUpgrade,
  type GameState,
  type Target,
} from '../src/game/rules.ts'

const race = (process.argv[2] ?? 'humans') as RaceId
const seed = Number(process.argv[3] ?? 42)
if (!RACES.some((r) => r.id === race)) throw new Error(`Race inconnue : ${race}`)

const T0 = Date.UTC(2026, 0, 1)
/** Le joueur regarde la partie toutes les 10 secondes de jeu. */
const STEP = 10_000
/** Au-delà d'une journée de jeu, on s'arrête. */
const LIMIT = 24 * 3600_000
/** Un objectif qui n'avance plus pendant 4 heures de jeu est considéré comme bloquant. */
const STUCK = 4 * 3600_000
const ECONOMY: BuildingId[] = ['farm', 'sawmill', 'quarry', 'goldMine', 'manaWell']

function time(ms: number): string {
  return `${Math.floor(ms / 3600_000)} h ${String(Math.floor((ms % 3600_000) / 60_000)).padStart(2, '0')} min`
}

function upgrade(state: GameState, id: BuildingId, now: number): GameState | null {
  return checkUpgrade(state, id).ok ? startUpgrade(state, id, now) : null
}

/** Le bâtiment qu'il faut améliorer pour avancer vers ce bâtiment : lui, ou le Château d'abord. */
function nextStep(state: GameState, id: BuildingId): BuildingId {
  const check = checkUpgrade(state, id)
  return !check.ok && check.reason.startsWith('Nécessite le Château') ? 'castle' : id
}

/** Construire : ce que demande l'objectif, puis le Château et l'économie, tant que c'est possible. */
function build(state: GameState, now: number): GameState {
  const goal = currentQuest(state)?.goal
  const wanted: BuildingId[] = []
  if (goal?.kind === 'building') wanted.push(nextStep(state, goal.building))
  // Le dragon ne dépasse pas le niveau de son aire : pour le faire grandir, on agrandit l'aire.
  if (goal?.kind === 'dragonLevel') wanted.push(nextStep(state, 'dragonRoost'))
  if (goal && ['troops', 'victories', 'bands', 'heroLevel'].includes(goal.kind)) wanted.push('barracks')
  if (goal?.kind === 'research') wanted.push('academy')
  // La nourriture d'abord, quand l'armée mange presque tout ce que les fermes produisent.
  if (netPerHour(state).food < 200) wanted.push('farm')
  const economy = [...ECONOMY].sort((a, b) => state.levels[a] - state.levels[b])
  for (const id of [...wanted, 'castle' as const, ...economy, 'barracks' as const, 'academy' as const]) {
    const next = upgrade(state, nextStep(state, id), now)
    if (next) return build(next, now)
  }
  return state
}

/** Un raid en marche vers la cité : le joueur part l'intercepter. */
function incomingRaid(state: GameState): Target | null {
  const raid = state.bands.find((band) => band.raid && band.since !== null)
  return raid ? { type: 'band', band: raid.id } : null
}

/** La bande la plus proche qu'une petite armée peut battre, sinon la Tanière de loups. */
function nearestTarget(state: GameState): Target {
  const bands = state.bands
    .filter((band) => !band.raid && band.level <= Math.max(1, state.levels.castle - 1) && band.since !== null)
    .sort((a, b) => distance(WORLD.city, a.home) - distance(WORLD.city, b.home))
  return bands[0] ? { type: 'band', band: bands[0].id } : { type: 'camp', camp: CAMPS[0].id }
}

function play(state: GameState, now: number): GameState {
  let g = state
  const goal = currentQuest(g)?.goal

  // Un bâtiment demandé mais trop cher : le joueur économise pour lui, sans rien acheter d'autre.
  if (goal?.kind === 'building' && g.constructions.length === 0 && !checkUpgrade(g, goal.building).ok) {
    return upgrade(g, nextStep(g, goal.building), now) ?? g
  }
  g = build(g, now)

  // Les héros : Ysolde pour combattre, Durgan pour récolter.
  for (const hero of ['ysolde', 'durgan'] as const) {
    if (g.levels.barracks > 0 && checkRecruit(g, hero).ok) g = recruitHero(g, hero, now)
  }
  const skills = [
    ['ysolde', 'rally'],
    ['ysolde', 'spears'],
    ['ysolde', 'shieldWall'],
    ['durgan', 'baskets'],
    ['durgan', 'pickaxes'],
  ] as const
  for (const [hero, skill] of skills) {
    if (getHero(g, hero) && checkSkill(g, hero, skill).ok) g = learnSkill(g, hero, skill, now)
  }

  // Une recherche à la fois, la première possible.
  if (g.levels.academy > 0 && !g.research) {
    const tech = (['agriculture', 'forge', 'tools', 'armor', 'command', 'alchemy', 'masonry', 'forcedMarch'] as const).find(
      (id) => checkResearch(g, id).ok,
    )
    if (tech) g = startResearch(g, tech, now)
  }

  // L'œuf de dragon : on le couve dès que l'aire est construite.
  if (checkHatch(g).ok) g = hatchEgg(g, now)

  // Des guerriers, en gardant de quoi manger.
  const count = Math.min(maxTrainingBatch(g), 20 + 15 * g.levels.castle - g.troops.warrior)
  if (count > 0 && g.resources.food > 600 && checkTraining(g, 'warrior', count).ok) {
    g = startTraining(g, 'warrior', count, now)
  }

  // Une armée qui attend rentre à la cité ; la suivante part combattre, ou récolter si l'objectif le demande.
  for (const army of g.armies) {
    if (army.status === 'idle') g = orderArmy(g, army.id, { type: 'city' }, now)
  }
  // Pour repousser un raid, l'armée l'attend à la cité tant qu'il n'est pas en vue.
  const raid = incomingRaid(g)
  const waitForRaid = currentQuest(g)?.goal.kind === 'raids' && !raid
  if (g.armies.length === 0 && g.troops.warrior >= 20 && !waitForRaid) {
    const goal = currentQuest(g)?.goal
    const gathering = !raid && goal?.kind === 'gathered'
    const nodes = [...g.nodes].sort((a, b) => distance(WORLD.city, a.position) - distance(WORLD.city, b.position))
    // Un camp à vaincre : l'armée y va, avec assez de guerriers pour avoir ses chances.
    const camp: Target | null =
      goal?.kind === 'camp' && g.troops.warrior >= 40 * g.levels.castle ? { type: 'camp', camp: goal.camp } : null
    const target: Target =
      raid ?? camp ?? (gathering && nodes[0] ? { type: 'node', node: nodes[0].id } : nearestTarget(g))
    const troops = { ...emptyArmy(), warrior: g.troops.warrior }
    const hero = gathering ? (getHero(g, 'durgan') ? 'durgan' : null) : getHero(g, 'ysolde') ? 'ysolde' : null
    const dragon = !gathering && checkDragon(g).ok
    if (checkMarch(g, target, troops, hero, dragon).ok) g = startMarch(g, target, troops, now, hero, dragon)
  }
  return g
}

let game = newGame(race, T0, seed)
let lastClaim = T0
let famine = 0
let pillages = 0
console.log(`Race : ${race} · graine du hasard : ${seed}\n`)
for (let now = T0 + STEP; now <= T0 + LIMIT; now += STEP) {
  const before = game.updatedAt
  game = advance(game, now)
  if (game.resources.food < 1 && netPerHour(game).food < 0) famine += STEP
  // Les sièges perdus depuis le dernier coup d'œil : la cité a été pillée.
  for (const report of game.reports) {
    if (report.at > before && report.siege && report.outcome === 'defeat') {
      pillages++
      console.log(`${time(report.at - T0).padStart(11)}     (la cité est pillée par un raid de niveau ${report.foe.type === 'band' ? report.foe.level : '?'})`)
    }
  }
  const quest = currentQuest(game)
  if (!quest) break
  if (questDone(game, quest)) {
    game = claimQuest(game, quest.id, now)
    lastClaim = now
    console.log(`${time(now - T0).padStart(11)}  ${QUESTS.indexOf(quest) + 1}. ${quest.name}`)
    continue
  }
  if (now - lastClaim > STUCK) {
    const { current, target } = questProgress(game, quest)
    console.log(`\nBLOQUÉ depuis 4 h sur « ${quest.name} » : ${current} / ${target}`)
    break
  }
  game = play(game, now)
}

console.log(`\nFin : ${time(game.updatedAt - T0)} de jeu, ${game.quests.length} / ${QUESTS.length} objectifs.`)
console.log('Bâtiments :', Object.entries(game.levels).map(([id, level]) => `${id} ${level}`).join(', '))
console.log('Héros :', game.heroes.map((hero) => `${hero.id} niv. ${hero.level}`).join(', ') || 'aucun')
console.log(`Batailles gagnées : ${game.stats.victories} · bandes vaincues : ${game.stats.bandsDefeated}`)
console.log(`Raids repoussés : ${game.stats.raidsRepelled} · pillages subis : ${pillages}`)
console.log(`Dragon : ${game.dragon ? `${game.dragon.stage}, niveau ${dragonLevel(game)}` : 'aucun'}`)
console.log(`Temps passé en famine : ${time(famine)}`)
