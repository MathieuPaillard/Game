<script setup lang="ts">
import { computed, ref } from 'vue'
import { BUILDINGS, RESOURCES, RESOURCE_IDS, type BuildingId } from '../game/config'
import { getBuilding, getRace, productionPerHour, type GameState } from '../game/rules'
import BuildingCard from './BuildingCard.vue'
import ResourceBar from './ResourceBar.vue'
import { formatAmount, formatDuration } from './format'
import type { AwayReport } from './useGame'

const props = defineProps<{ state: GameState; now: number; awayReport: AwayReport | null }>()
const emit = defineEmits<{ upgrade: [building: BuildingId]; restart: []; dismissAway: [] }>()

const race = computed(() => getRace(props.state.race))
const production = computed(() => productionPerHour(props.state))
const awayGains = computed(() =>
  RESOURCE_IDS.filter((id) => (props.awayReport?.gains[id] ?? 0) >= 1).map((id) => ({
    id,
    amount: props.awayReport?.gains[id] ?? 0,
  })),
)
const confirmingRestart = ref(false)
</script>

<template>
  <ResourceBar :resources="state.resources" :production="production" />

  <main class="wrap city">
    <header class="city-head">
      <h1>Cité des {{ race.name }}</h1>
      <p class="muted">{{ race.bonuses.join(' · ') }}</p>
    </header>

    <section v-if="awayReport" class="away" aria-labelledby="away-title">
      <h2 id="away-title">Bon retour !</h2>
      <p>Pendant ton absence ({{ formatDuration(awayReport.duration) }}), ton royaume a produit :</p>
      <ul class="gains">
        <li v-for="gain in awayGains" :key="gain.id">
          <span aria-hidden="true">{{ RESOURCES[gain.id].icon }}</span> +{{ formatAmount(gain.amount) }}
          <span class="sr-only">{{ RESOURCES[gain.id].name }}</span>
        </li>
      </ul>
      <p v-if="awayReport.finished">
        {{ getBuilding(awayReport.finished.building).name }} : le niveau {{ awayReport.finished.level }} est terminé.
      </p>
      <button class="btn" type="button" @click="emit('dismissAway')">Continuer</button>
    </section>

    <section class="buildings" aria-label="Bâtiments">
      <BuildingCard
        v-for="building in BUILDINGS"
        :key="building.id"
        :building="building"
        :state="state"
        :now="now"
        @upgrade="emit('upgrade', building.id)"
      />
    </section>

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

.buildings {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
}

@media (min-width: 38rem) {
  .buildings {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 58rem) {
  .buildings {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
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
