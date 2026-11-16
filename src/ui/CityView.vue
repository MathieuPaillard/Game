<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  BUILDINGS,
  RESOURCES,
  RESOURCE_IDS,
  SECOND_CONSTRUCTION_CASTLE_LEVEL,
  STARVATION_ATTACK_MALUS,
  type Army,
  type BuildingId,
  type HeroId,
  type SpellId,
  type TechId,
  type UnitId,
} from '../game/config'
import {
  constructionOf,
  currentQuest,
  getBuilding,
  getRace,
  getSpell,
  maxConstructions,
  netPerHour,
  questDone,
  skillPoints,
  timeUntilFamine,
  type GameState,
  type Target,
} from '../game/rules'
import AccountLine from './AccountLine.vue'
import ArmyPanel from './ArmyPanel.vue'
import type { AwayReport } from './away'
import BuildingCard from './BuildingCard.vue'
import CityMap from './CityMap.vue'
import HeroPanel from './HeroPanel.vue'
import NoticeBar from './NoticeBar.vue'
import QuestBanner from './QuestBanner.vue'
import ResearchPanel from './ResearchPanel.vue'
import ResourceBar from './ResourceBar.vue'
import SpellList from './SpellList.vue'
import WorldPanel from './WorldPanel.vue'
import { formatAmount, formatDuration, formatRate } from './format'

const props = defineProps<{
  state: GameState
  now: number
  awayReport: AwayReport | null
  notice: string | null
  offline: boolean
  /** Le joueur connecté, ou null pour une partie sans compte. */
  player: string | null
}>()
const emit = defineEmits<{
  upgrade: [building: BuildingId]
  research: [tech: TechId]
  train: [unit: UnitId, count: number]
  recruit: [hero: HeroId]
  learn: [hero: HeroId, skill: string]
  claim: [quest: string]
  cast: [spell: SpellId]
  march: [target: Target, troops: Army, hero: HeroId | null]
  order: [army: number, target: Target]
  dismiss: [troops: Army]
  restart: []
  dismissAway: []
  dismissNotice: []
  logout: []
  goOnline: []
}>()

type Tab = 'city' | 'army' | 'heroes' | 'research' | 'world'
const tab = ref<Tab>('city')
// Un point doré signale l'onglet où quelque chose est en cours, ou attend le joueur.
const IN_PROGRESS = '(en cours)'
const questReady = computed(() => {
  const quest = currentQuest(props.state)
  return quest !== null && questDone(props.state, quest)
})
const tabs = computed(() => [
  {
    id: 'city' as const,
    label: 'Cité',
    dot:
      props.state.constructions.length > 0 ? IN_PROGRESS : questReady.value ? '(récompense à recevoir)' : null,
  },
  { id: 'army' as const, label: 'Armée', dot: props.state.trainings.length > 0 ? IN_PROGRESS : null },
  {
    id: 'heroes' as const,
    label: 'Héros',
    dot: props.state.heroes.some((hero) => skillPoints(hero) > 0) ? '(points de compétence à placer)' : null,
  },
  { id: 'research' as const, label: 'Recherches', dot: props.state.research !== null ? IN_PROGRESS : null },
  { id: 'world' as const, label: 'Alentours', dot: props.state.armies.length > 0 ? IN_PROGRESS : null },
])

// Le bâtiment choisi sur la carte (ou dans la liste), dont on montre la fiche.
const selected = ref<BuildingId>('castle')
const buildingChips = computed(() =>
  BUILDINGS.map((building) => {
    const level = props.state.levels[building.id]
    const busy = constructionOf(props.state, building.id) !== undefined
    const locked = level === 0 && props.state.levels.castle < building.unlockedAtCastleLevel
    return { building, busy, tag: busy ? 'chantier' : locked ? '🔒' : level > 0 ? `niv. ${level}` : 'à bâtir' }
  }),
)

const race = computed(() => getRace(props.state.race))
// Les sorts en cours, et le temps qu'il leur reste.
const activeSpells = computed(() =>
  props.state.spells.map((active) => {
    const spell = getSpell(active.spell)
    return { spell, left: Math.min(spell.durationSeconds * 1000, Math.max(0, active.endsAt - props.now)) }
  }),
)
const rates = computed(() => netPerHour(props.state))
const famineIn = computed(() => timeUntilFamine(props.state))
const malusPercent = Math.round(STARVATION_ATTACK_MALUS * 100)
const awayGains = computed(() =>
  RESOURCE_IDS.filter((id) => (props.awayReport?.gains[id] ?? 0) >= 1).map((id) => ({
    id,
    amount: props.awayReport?.gains[id] ?? 0,
  })),
)
const confirmingRestart = ref(false)
</script>

<template>
  <div class="top">
    <ResourceBar :resources="state.resources" :rates="rates" />
    <nav class="wrap tabs" aria-label="Sections du jeu">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        class="tab"
        :class="{ active: tab === t.id }"
        :aria-pressed="tab === t.id"
        @click="tab = t.id"
      >
        {{ t.label }}
        <span v-if="t.dot" class="tab-dot"><span class="sr-only">{{ t.dot }}</span></span>
      </button>
    </nav>
  </div>

  <main class="wrap city">
    <header class="city-head">
      <h1>Cité des {{ race.name }}</h1>
      <p class="muted">{{ race.bonuses.join(' · ') }}</p>
      <p v-if="activeSpells.length" class="spells-line">
        Sorts en cours :
        <span v-for="item in activeSpells" :key="item.spell.id" class="spell-chip">
          <span aria-hidden="true">{{ item.spell.icon }}</span> {{ item.spell.name }}
          <span class="muted">({{ formatDuration(item.left) }})</span>
        </span>
      </p>
    </header>

    <NoticeBar :notice="notice" :offline="offline" @dismiss="emit('dismissNotice')" />

    <p v-if="famineIn !== null" class="famine" role="status">
      <template v-if="state.resources.food >= 1">
        <strong>Famine en vue.</strong>
        Ton armée mange plus de nourriture que tes fermes n’en produisent ({{ formatRate(rates.food) }}). Dans
        {{ formatDuration(famineIn) }}, tes réserves seront vides et tes troupes auront faim : elles perdront
        {{ malusPercent }} % de leur attaque au combat.
      </template>
      <template v-else>
        <strong>Famine.</strong>
        Tes réserves de nourriture sont vides ({{ formatRate(rates.food) }}) : tes troupes ont faim et perdent
        {{ malusPercent }} % de leur attaque au combat.
      </template>
      Améliore ta Ferme, ou renvoie des troupes depuis l’onglet Armée.
    </p>

    <section v-if="awayReport" class="away" aria-labelledby="away-title">
      <h2 id="away-title">Bon retour !</h2>
      <p>Pendant ton absence ({{ formatDuration(awayReport.duration) }}), ton royaume a produit :</p>
      <ul class="gains">
        <li v-for="gain in awayGains" :key="gain.id">
          <span aria-hidden="true">{{ RESOURCES[gain.id].icon }}</span> +{{ formatAmount(gain.amount) }}
          <span class="sr-only">{{ RESOURCES[gain.id].name }}</span>
        </li>
      </ul>
      <ul v-if="awayReport.events.length" class="away-events">
        <li v-for="(event, i) in awayReport.events" :key="i">{{ event }}</li>
      </ul>
      <button class="btn" type="button" @click="emit('dismissAway')">Continuer</button>
    </section>

    <section v-if="tab === 'city'" class="tab-city" aria-labelledby="city-title">
      <h2 id="city-title" class="sr-only">Ta cité</h2>
      <QuestBanner :state="state" @claim="(quest) => emit('claim', quest)" />
      <CityMap :state="state" :now="now" :selected="selected" @select="selected = $event" />
      <p class="muted">
        Chantiers en cours : <strong>{{ state.constructions.length }} / {{ maxConstructions(state) }}</strong
        ><template v-if="maxConstructions(state) === 1">
          · un second chantier s’ouvrira au Château niveau {{ SECOND_CONSTRUCTION_CASTLE_LEVEL }}</template
        >.
      </p>
      <ul class="chips" aria-label="Bâtiments">
        <li v-for="chip in buildingChips" :key="chip.building.id">
          <button
            type="button"
            class="chip"
            :aria-pressed="selected === chip.building.id"
            @click="selected = chip.building.id"
          >
            <span aria-hidden="true">{{ chip.building.icon }}</span>
            {{ chip.building.name }}
            <span class="chip-tag" :class="{ busy: chip.busy }">{{ chip.tag }}</span>
          </button>
        </li>
      </ul>
      <BuildingCard
        :building="getBuilding(selected)"
        :state="state"
        :now="now"
        @upgrade="emit('upgrade', selected)"
      />
      <SpellList v-if="selected === 'mageTower'" :state="state" :now="now" @cast="(spell) => emit('cast', spell)" />
    </section>
    <ArmyPanel
      v-else-if="tab === 'army'"
      :state="state"
      :now="now"
      @train="(unit, count) => emit('train', unit, count)"
      @dismiss="(troops) => emit('dismiss', troops)"
    />
    <HeroPanel
      v-else-if="tab === 'heroes'"
      :state="state"
      @recruit="(hero) => emit('recruit', hero)"
      @learn="(hero, skill) => emit('learn', hero, skill)"
    />
    <ResearchPanel
      v-else-if="tab === 'research'"
      :state="state"
      :now="now"
      @research="(tech) => emit('research', tech)"
    />
    <WorldPanel
      v-else
      :state="state"
      :now="now"
      :city-name="`Cité des ${race.name}`"
      @march="(target, troops, hero) => emit('march', target, troops, hero)"
      @order="(army, target) => emit('order', army, target)"
    />

    <footer class="city-foot">
      <AccountLine :player="player" @logout="emit('logout')" @go-online="emit('goOnline')" />
      <div class="restart">
        <button v-if="!confirmingRestart" class="btn-quiet" type="button" @click="confirmingRestart = true">
          Recommencer une partie
        </button>
        <template v-else>
          <p>Ta cité sera effacée pour de bon.</p>
          <button class="btn btn-danger" type="button" @click="emit('restart')">Effacer et recommencer</button>
          <button class="btn-quiet" type="button" @click="confirmingRestart = false">Annuler</button>
        </template>
      </div>
    </footer>
  </main>
</template>

<style scoped>
/* Le registre des ressources et les onglets restent accrochés en haut de l'écran. */
.top {
  position: sticky;
  top: env(safe-area-inset-top, 0px);
  z-index: 5;
  background: var(--stone-raised);
  border-bottom: 1px solid var(--seam);
}

.tabs {
  display: flex;
  gap: 0.25rem;
}

.tab {
  flex: 1 1 0;
  max-width: 12rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding-block: 0.65rem;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--faded);
  font: 700 0.95rem/1.2 var(--font-body);
  cursor: pointer;
}

.tab:hover {
  color: var(--parchment);
}

.tab.active {
  color: var(--parchment);
  border-bottom-color: var(--gilt);
}

.tab-dot {
  flex: none;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--gilt);
}

/* Cinq onglets sur un petit téléphone : on resserre un peu. */
@media (max-width: 30rem) {
  .tabs {
    gap: 0;
  }

  .tab {
    gap: 0.2rem;
    font-size: 0.85rem;
  }
}

@media (max-width: 22rem) {
  .tab {
    font-size: 0.78rem;
  }

  .tab-dot {
    width: 0.35rem;
    height: 0.35rem;
  }
}

.tab-city {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.city {
  padding-block: 1.5rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.city-head {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.spells-line {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
  color: var(--gilt);
  font-variant-numeric: tabular-nums;
}

.spell-chip {
  white-space: nowrap;
}

.famine {
  padding: 0.8rem 1rem;
  background: var(--stone);
  border: 1px solid var(--ember);
  border-radius: var(--radius);
}

.famine strong {
  color: var(--ember);
}

.away {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 1rem;
  background: var(--stone);
  border: 1px solid var(--gilt);
  border-radius: var(--radius);
}

.away h2 {
  font: 700 1.6rem/1.1 var(--font-display);
  color: var(--gilt);
}

.gains {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.away-events {
  margin: 0;
  padding-left: 1.1rem;
}

.city-foot {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--seam);
}

.restart {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
</style>
