import { describe, expect, it } from 'vitest'
import { QUESTS, RAID_CASTLE_LEVEL, RAID_FIRST_SECONDS, START_LEVELS } from './config.ts'
import { advance, bandPosition, emptyArmy, emptyTechs, newGame } from './rules.ts'
import { restoreState } from './save.ts'

const T0 = Date.UTC(2026, 0, 1)

describe('restoreState', () => {
  it('relit telle quelle une partie de la version actuelle', () => {
    const game = newGame('elves', T0)
    expect(restoreState(JSON.parse(JSON.stringify(game)))).toEqual(game)
  })

  it('refuse ce qui n’est pas une partie', () => {
    for (const input of [null, 42, 'partie', {}, { race: 'humans' }, { race: 'dragons', updatedAt: T0 }]) {
      expect(restoreState(input)).toBeNull()
    }
    expect(restoreState({ race: 'humans', updatedAt: T0, reports: 'abîmé' })).toBeNull()
  })

  it('ne reprend pas une partie abîmée, qui ferait planter le jeu ou tourner sans fin', () => {
    const game = newGame('humans', T0)
    const band = game.bands[0]
    const broken = [
      { ...game, constructions: [null] },
      { ...game, constructions: [{ building: 'farm', targetLevel: 2, startedAt: T0, endsAt: 'x' }] },
      { ...game, armies: [{}] },
      { ...game, armies: [{ id: 3, troops: {}, position: { x: 1, y: 2 }, order: { type: 'point' }, status: 'marching', load: {}, fought: [] }] },
      { ...game, battles: [{}] },
      { ...game, spells: [{}] },
      { ...game, nodes: [{}] },
      { ...game, resources: { ...game.resources, food: null } },
      { ...game, bands: [{ ...band, since: undefined }] },
      { ...game, nextRaidAt: 'bientôt' },
      { ...game, dragon: { stage: 'grown', hatchAt: null, xp: 'beaucoup', restUntil: null } },
    ]
    for (const saved of broken) expect(restoreState(JSON.parse(JSON.stringify(saved)))).toBeNull()
  })

  it('compte comme réclamé un objectif ajouté plus tard au milieu de la chaîne', () => {
    const ids = QUESTS.map((quest) => quest.id)
    const chain = ids.slice(0, ids.indexOf('castle3') + 1)
    const saved = { ...newGame('humans', T0), quests: chain.filter((id) => id !== 'manaWell') }
    expect(restoreState(saved)!.quests).toEqual(chain)
  })

  it('une partie d’avant le repeuplement des camps n’a aucun camp vide, ni le mode d’essai', () => {
    const { campsCleared: _cleared, trial: _trial, ...old } = newGame('humans', T0)
    expect(restoreState(old)).toMatchObject({ campsCleared: {}, trial: false })
  })

  it('une partie d’avant les sorts qui se rechargent peut relancer chaque sort', () => {
    const { spellsReadyAt: _ready, ...old } = newGame('humans', T0)
    expect(restoreState(old)!.spellsReadyAt).toEqual({})
    // Une heure de recharge abîmée : la partie ne peut pas être reprise.
    expect(restoreState({ ...old, spellsReadyAt: { mist: 'demain' } })).toBeNull()
  })

  it('une partie d’avant le grand campement le voit se peupler dès qu’elle avance', () => {
    const { encampment: _encampment, ...old } = newGame('humans', T0)
    const restored = restoreState({ ...old, bands: [] })!
    expect(restored.encampment).toEqual({ resetAt: T0, gateOpen: false, sprung: [] })
    expect(advance(restored, T0 + 1000).bands.filter((band) => band.encampment).length).toBeGreaterThan(0)
  })

  it('oublie une bande sans monstres, qu’une ancienne version laissait parfois sur la carte', () => {
    const game = newGame('humans', T0)
    const empty = { ...game.bands[0], monsters: { wolf: 0 } }
    expect(restoreState({ ...game, bands: [empty, ...game.bands.slice(1)] })!.bands).toEqual(game.bands.slice(1))
  })

  it('complète une partie enregistrée par une version plus ancienne', () => {
    const training = { unit: 'warrior', count: 5, startedAt: T0, endsAt: T0 + 1000 }
    const old = {
      race: 'dwarves',
      updatedAt: T0,
      resources: { food: 10, wood: 20, stone: 30, gold: 40 },
      levels: { castle: 2 },
      troops: { archer: 3 },
      training,
      expedition: null,
      reports: [{ at: T0, camp: 'wolfDen', victory: true, sent: {}, lost: {} }],
      desertions: 4,
    }
    const state = restoreState(old)
    expect(state).toMatchObject({
      race: 'dwarves',
      resources: { food: 10, wood: 20, stone: 30, gold: 40, mana: 0 },
      levels: { ...START_LEVELS, castle: 2 },
      techs: emptyTechs(),
      troops: { ...emptyArmy(), archer: 3 },
      trainings: [training],
      heroes: [],
      armies: [],
      battles: [],
      stats: { victories: 0, bandsDefeated: 0, gathered: 0, raidsRepelled: 0, campsDefeated: {} },
      quests: [],
      // Avant les créatures légendaires, personne n'avait de dragon.
      dragon: null,
      // Un Château de niveau 2 n'attire pas encore les raids.
      nextRaidAt: null,
      constructions: [],
      research: null,
      spells: [],
    })
    expect(state?.reports[0]).toMatchObject({
      foe: { type: 'camp', camp: 'wolfDen' },
      ambush: false,
      outcome: 'victory',
      startedAt: T0,
      enemies: {},
      enemyLost: {},
      loot: {},
      starving: false,
      rounds: [],
      hero: null,
      siege: null,
      dragon: null,
    })
    // Avant les bandes et les gisements, la carte était vide : ils arrivent peu à peu.
    expect(state).toMatchObject({ bands: [], nextBandAt: T0, nodes: [], nextNodeAt: T0, nextId: 1 })
    const later = advance(state!, T0 + 1000)
    expect(later.bands.filter((band) => !band.encampment)).toHaveLength(1)
    expect(later.nodes).toHaveLength(1)
    // Ce qui n'existe plus dans le jeu est oublié.
    expect(state).not.toHaveProperty('desertions')
    expect(state).not.toHaveProperty('training')
  })

  it('fait rentrer à la cité les armées parties avec une version plus ancienne', () => {
    const old = {
      race: 'humans',
      updatedAt: T0,
      troops: { warrior: 2 },
      resources: { food: 100, wood: 100, stone: 100, gold: 100, mana: 100 },
      expeditions: [
        // Sur le chemin du retour, butin en poche (la toute première version).
        {
          camp: 'goblinCamp',
          troops: { warrior: 10, archer: 0, rider: 0, mage: 0 },
          departedAt: T0 - 2000,
          arrivesAt: T0 - 1000,
          returnsAt: T0 + 5000,
          result: { survivors: { warrior: 7, archer: 0, rider: 0, mage: 0 }, loot: { gold: 80 } },
        },
        // En route vers une bande (la version d'avant les ordres sur la carte).
        {
          id: 4,
          target: { type: 'band', band: 2 },
          troops: { warrior: 0, archer: 3, rider: 0, mage: 0 },
          loot: { wood: 50 },
          returning: false,
        },
      ],
    }
    const state = restoreState(old)
    expect(state?.armies).toEqual([])
    expect(state?.troops).toEqual({ ...emptyArmy(), warrior: 9, archer: 3 })
    expect(state?.resources).toMatchObject({ gold: 180, wood: 150, food: 100 })
  })

  it('reprend le chantier d’une version qui n’en avait qu’un', () => {
    const construction = { building: 'farm', targetLevel: 3, startedAt: T0, endsAt: T0 + 5000 }
    const state = restoreState({ ...newGame('humans', T0), constructions: undefined, construction })!
    expect(state.constructions).toEqual([construction])
    expect(state).not.toHaveProperty('construction')
  })

  it('une bataille d’avant les troupes de race continue, sans troupe de race', () => {
    const four = { warrior: 30, archer: 0, rider: 0, mage: 0 }
    const game = newGame('humans', T0)
    const battle = {
      id: 9,
      army: 5,
      band: null,
      foe: { type: 'camp', camp: 'wolfDen' },
      ambush: false,
      startedAt: T0,
      sent: four,
      enemies: { wolf: 8 },
      armyHealth: { warrior: 1500, archer: 0, rider: 0, mage: 0 },
      foeHealth: { wolf: 320 },
      healthFactor: 1,
      starving: false,
      rounds: [],
    }
    const army = { id: 5, troops: four, position: { x: 560, y: 470 }, order: null, status: 'fighting', load: {}, fought: [] }
    const state = restoreState({ ...game, armies: [army], battles: [battle] })!
    expect(state.armies[0].troops).toEqual({ ...emptyArmy(), warrior: 30 })
    // Elle devient une mêlée à deux : l'armée face au camp.
    expect(state.battles[0].allies[0]).toMatchObject({ ref: 'army:5', target: 'camp:wolfDen', health: { ...emptyArmy(), warrior: 1500 } })
    expect(state.battles[0].foes[0]).toMatchObject({ ref: 'camp:wolfDen', camp: 'wolfDen', target: 'army:5' })
    // La bataille se joue jusqu'au bout, sans valeur absurde.
    const later = advance(state, T0 + 10 * 60_000)
    expect(later.battles).toEqual([])
    expect(later.reports[0].outcome).toBe('victory')
    expect(Object.values(later.reports[0].lost).every(Number.isFinite)).toBe(true)
  })

  it('les armées d’avant les héros partent sans héros', () => {
    const army = {
      id: 5,
      troops: { ...emptyArmy(), warrior: 4 },
      position: { x: 700, y: 600 },
      order: null,
      status: 'idle',
      load: {},
      fought: [],
    }
    const state = restoreState({ ...newGame('orcs', T0), heroes: undefined, armies: [army] })!
    expect(state.heroes).toEqual([])
    expect(state.armies).toEqual([{ ...army, hero: null, dragon: false, key: false, escaped: [] }])
  })

  it('une cité d’avant les raids attire son premier raid si son Château est assez grand', () => {
    const game = newGame('humans', T0)
    const old = {
      ...game,
      levels: { ...game.levels, castle: RAID_CASTLE_LEVEL },
      nextRaidAt: undefined,
      bands: game.bands.map(({ raid: _, ...band }) => band),
      stats: { victories: 2, bandsDefeated: 1, gathered: 0 },
    }
    const state = restoreState(old)!
    expect(state.nextRaidAt).toBe(T0 + RAID_FIRST_SECONDS * 1000)
    expect(state.bands).toEqual(game.bands)
    expect(state.stats).toEqual({ victories: 2, bandsDefeated: 1, gathered: 0, raidsRepelled: 0, campsDefeated: {} })
    // La bataille d'une version d'avant les raids se livrait dehors.
    const fight = {
      id: 9,
      army: 5,
      band: null,
      foe: { type: 'camp', camp: 'wolfDen' },
      ambush: false,
      startedAt: T0,
      sent: { warrior: 10 },
      enemies: { wolf: 6 },
      armyHealth: { warrior: 400 },
      foeHealth: { wolf: 300 },
      healthFactor: 1,
      starving: false,
      rounds: [],
    }
    const battle = { ...game, battles: [fight] }
    expect(restoreState(battle)!.battles[0].allies[0].siege).toBeNull()
    // Un rapport de siège garde son armée vide (null), un très vieux rapport reçoit l'armée 0.
    const reports = [
      { at: T0, army: null, foe: { type: 'band', kind: 'wolves', level: 1, raid: true }, outcome: 'victory' },
      { at: T0, camp: 'wolfDen', victory: true },
    ]
    expect(restoreState({ ...game, reports })!.reports.map((report) => report.army)).toEqual([null, 0])
    // Avec un Château plus petit, aucun raid ne se prépare.
    expect(restoreState({ ...old, levels: { castle: RAID_CASTLE_LEVEL - 1 } })!.nextRaidAt).toBeNull()
  })

  it('fait patrouiller les bandes d’avant les rondes autour de l’endroit où elles étaient', () => {
    const old = {
      race: 'humans',
      updatedAt: T0,
      bands: [{ id: 3, kind: 'goblins', level: 2, position: { x: 900, y: 200 }, monsters: { goblin: 9 } }],
      reports: [
        {
          at: T0,
          army: 4,
          foe: { type: 'band', kind: 'wolves', level: 1 },
          ambush: true,
          victory: false,
          sent: { warrior: 5, archer: 0, rider: 0, mage: 0 },
          lost: { warrior: 5, archer: 0, rider: 0, mage: 0 },
          enemyLost: {},
          loot: {},
        },
      ],
    }
    const state = restoreState(old)!
    expect(state.bands[0]).toMatchObject({
      id: 3,
      kind: 'goblins',
      level: 2,
      home: { x: 900, y: 200 },
      since: T0,
      raid: false,
    })
    expect(bandPosition(state.bands[0], T0 + 10_000)).not.toEqual(bandPosition(state.bands[0], T0))
    expect(state.reports[0]).toMatchObject({ ambush: true, outcome: 'defeat' })
  })
})
