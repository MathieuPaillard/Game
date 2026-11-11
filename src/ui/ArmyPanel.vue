<script setup lang="ts">
import { computed } from 'vue'
import { COUNTER_BONUS, UNITS, type UnitId } from '../game/config'
import { armySize, getUnit, maxTrainingBatch, type GameState } from '../game/rules'
import UnitCard from './UnitCard.vue'
import { formatDuration } from './format'

const props = defineProps<{ state: GameState; now: number }>()
const emit = defineEmits<{ train: [unit: UnitId, count: number] }>()

const training = computed(() => props.state.training)
const progress = computed(() => {
  const t = training.value
  if (!t) return 0
  return Math.min(1, Math.max(0, (props.now - t.startedAt) / (t.endsAt - t.startedAt)))
})
const away = computed(() => (props.state.expedition ? armySize(props.state.expedition.troops) : 0))
const counterPercent = Math.round((COUNTER_BONUS - 1) * 100)
</script>

<template>
  <section class="army" aria-labelledby="army-title">
    <h2 id="army-title" class="section-title">Armée</h2>

    <p v-if="state.levels.barracks === 0" class="notice">
      Pour entraîner des troupes, construis d’abord la Caserne dans l’onglet Cité. Elle se débloque au Château
      niveau 2.
    </p>

    <template v-else>
      <p>
        Troupes dans la cité : <strong>{{ armySize(state.troops) }}</strong>
        <template v-if="away"> · en campagne : <strong>{{ away }}</strong></template>
      </p>
      <p class="muted">
        Caserne niveau {{ state.levels.barracks }} : jusqu’à {{ maxTrainingBatch(state) }} troupes par
        entraînement. Chaque troupe inflige {{ counterPercent }} % de dégâts en plus à la famille qu’elle domine.
      </p>

      <div v-if="training" class="training" role="status">
        <div class="progress"><span class="progress-fill" :style="{ width: `${progress * 100}%` }"></span></div>
        <p>
          {{ getUnit(training.unit).name }} : {{ training.count }} en entraînement ·
          {{ formatDuration(training.endsAt - now) }}
        </p>
      </div>

      <div class="grid">
        <UnitCard
          v-for="unit in UNITS"
          :key="unit.id"
          :unit="unit"
          :state="state"
          @train="(count) => emit('train', unit.id, count)"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.army {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.training {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--stone);
  border: 1px solid var(--gilt);
  border-radius: var(--radius);
  font-variant-numeric: tabular-nums;
}
</style>
