<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  BUILDINGS,
  RESOURCES,
  RESOURCE_IDS,
  STARVATION_ATTACK_MALUS,
  type Army,
  type BuildingId,
  type CampId,
  type UnitId,
} from '../game/config'
import { getRace, netPerHour, timeUntilFamine, type GameState } from '../game/rules'
import ArmyPanel from './ArmyPanel.vue'
import BuildingCard from './BuildingCard.vue'
import ResourceBar from './ResourceBar.vue'
import WorldPanel from './WorldPanel.vue'
import { formatAmount, formatDuration, formatRate } from './format'
import type { AwayReport } from './useGame'

const props = defineProps<{ state: GameState; now: number; awayReport: AwayReport | null }>()
const emit = defineEmits<{
  upgrade: [building: BuildingId]
  train: [unit: UnitId, count: number]
  attack: [camp: CampId, troops: Army]
  dismiss: [troops: Army]
  restart: []
  dismissAway: []
}>()

type Tab = 'city' | 'army' | 'world'
const tab = ref<Tab>('city')
// Un point doré signale l'onglet où quelque chose est en cours.
const tabs = computed(() => [
  { id: 'city' as const, label: 'Cité', busy: props.state.construction !== null },
  { id: 'army' as const, label: 'Armée', busy: props.state.training !== null },
  { id: 'world' as const, label: 'Alentours', busy: props.state.expedition !== null },
])

const race = computed(() => getRace(props.state.race))
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
        <span v-if="t.busy" class="tab-dot"><span class="sr-only">(en cours)</span></span>
      </button>
    </nav>
  </div>

  <main class="wrap city">
    <header class="city-head">
      <h1>Cité des {{ race.name }}</h1>
      <p class="muted">{{ race.bonuses.join(' · ') }}</p>
    </header>

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

    <section v-if="tab === 'city'" class="grid thirds" aria-label="Bâtiments">
      <BuildingCard
        v-for="building in BUILDINGS"
        :key="building.id"
        :building="building"
        :state="state"
        :now="now"
        @upgrade="emit('upgrade', building.id)"
      />
    </section>
    <ArmyPanel
      v-else-if="tab === 'army'"
      :state="state"
      :now="now"
      @train="(unit, count) => emit('train', unit, count)"
      @dismiss="(troops) => emit('dismiss', troops)"
    />
    <WorldPanel v-else :state="state" :now="now" @attack="(camp, troops) => emit('attack', camp, troops)" />

    <footer class="city-foot">
      <button v-if="!confirmingRestart" class="btn-quiet" type="button" @click="confirmingRestart = true">
        Recommencer une partie
      </button>
      <template v-else>
        <p>Ta cité sera effacée pour de bon.</p>
        <button class="btn btn-danger" type="button" @click="emit('restart')">Effacer et recommencer</button>
        <button class="btn-quiet" type="button" @click="confirmingRestart = false">Annuler</button>
      </template>
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
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--gilt);
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
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--seam);
}
</style>
