<script setup lang="ts">
import { computed } from 'vue'
import { COUNTER_BONUS, UNITS, type UnitId } from '../game/config'
import { maxTrainingBatch, type GameState } from '../game/rules'
import UnitCard from './UnitCard.vue'

// Les troupes que la Caserne peut entraîner : celles des quatre familles, et celle qui est propre à ta race.
const props = defineProps<{ state: GameState; now: number }>()
const emit = defineEmits<{ train: [unit: UnitId, count: number] }>()

const units = computed(() => UNITS.filter((unit) => !unit.race || unit.race === props.state.race))
const counterPercent = Math.round((COUNTER_BONUS - 1) * 100)
</script>

<template>
  <section class="training" aria-labelledby="training-title">
    <h2 id="training-title" class="section-title">Entraîner des troupes</h2>
    <p class="muted">
      Chaque type de troupe s’entraîne de son côté, jusqu’à {{ maxTrainingBatch(state) }} troupes à la fois. Chaque
      troupe inflige {{ counterPercent }} % de dégâts en plus à la famille qu’elle domine.
    </p>
    <div class="grid">
      <UnitCard
        v-for="unit in units"
        :key="unit.id"
        :unit="unit"
        :state="state"
        :now="now"
        @train="(count) => emit('train', unit.id, count)"
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
