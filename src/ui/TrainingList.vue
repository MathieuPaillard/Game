<script setup lang="ts">
import { computed } from 'vue'
import { COUNTER_BONUS, RANK_STEP, UNITS, type UnitId } from '../game/config'
import { maxTrainingBatch, type GameState } from '../game/rules'
import UnitCard from './UnitCard.vue'

// Les troupes que la Caserne peut entraîner : celles des quatre familles, et celles qui sont propres à ta
// race (sa troupe de combat et ses soigneurs). Chaque fiche propose les rangs de sa troupe.
const props = defineProps<{ state: GameState; now: number }>()
const emit = defineEmits<{ train: [unit: UnitId, count: number] }>()

const lines = computed(() =>
  UNITS.filter((unit) => unit.rank === 1 && (!unit.race || unit.race === props.state.race)).map((unit) => unit.line),
)
const counterPercent = Math.round((COUNTER_BONUS - 1) * 100)
</script>

<template>
  <section class="training" aria-labelledby="training-title">
    <h2 id="training-title" class="section-title">Entraîner des troupes</h2>
    <p class="muted">
      Chaque troupe s’entraîne de son côté, un rang à la fois, jusqu’à {{ maxTrainingBatch(state) }} troupes à la fois.
      Chaque troupe inflige {{ counterPercent }} % de dégâts en plus à la famille qu’elle domine. Tous les
      {{ RANK_STEP }} niveaux de Caserne, un nouveau rang s’ouvre, après sa grande recherche à l’Académie : deux fois plus
      fort.
    </p>
    <div class="grid">
      <UnitCard
        v-for="line in lines"
        :key="line"
        :line="line"
        :state="state"
        :now="now"
        @train="(unit, count) => emit('train', unit, count)"
      />
    </div>
  </section>
</template>

<style scoped>
.training {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
</style>
