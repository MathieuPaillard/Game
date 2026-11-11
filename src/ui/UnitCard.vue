<script setup lang="ts">
import { computed, ref } from 'vue'
import { RESOURCES, RESOURCE_IDS, type UnitDef } from '../game/config'
import { checkTraining, getUnit, maxTrainingBatch, trainingCost, trainingDuration, type GameState } from '../game/rules'
import { formatAmount, formatDuration } from './format'

const props = defineProps<{ unit: UnitDef; state: GameState }>()
const emit = defineEmits<{ train: [count: number] }>()

const count = ref(10)
// Tant que le champ est vide ou faux, on affiche le coût de zéro troupe.
const amount = computed(() => (Number.isInteger(count.value) && count.value > 0 ? count.value : 0))
const locked = computed(() => props.state.levels.barracks < props.unit.barracksLevel)

const check = computed(() => checkTraining(props.state, props.unit.id, count.value))
const reason = computed(() => (check.value.ok ? null : check.value.reason))
const cost = computed(() => {
  const c = trainingCost(props.unit, amount.value)
  return RESOURCE_IDS.filter((id) => c[id]).map((id) => ({ id, amount: c[id] ?? 0 }))
})
const duration = computed(() => trainingDuration(props.state, props.unit, amount.value))
</script>

<template>
  <article class="plaque" :class="{ empty: locked }">
    <header class="plaque-head">
      <span class="plaque-icon" aria-hidden="true">{{ unit.icon }}</span>
      <div>
        <h3 class="plaque-name">{{ unit.name }}</h3>
        <p class="plaque-level">{{ state.troops[unit.id] }} dans la cité</p>
      </div>
    </header>

    <p class="muted">{{ unit.description }}</p>

    <ul class="stats">
      <li>Attaque <strong>{{ unit.attack }}</strong></li>
      <li>Vie <strong>{{ unit.health }}</strong></li>
      <li>Fort contre les <strong>{{ getUnit(unit.strongAgainst).name }}</strong></li>
    </ul>

    <div class="plaque-foot">
      <label class="field" :for="`train-${unit.id}`">
        <span>Nombre à entraîner</span>
        <input
          :id="`train-${unit.id}`"
          v-model.number="count"
          type="number"
          min="1"
          :max="maxTrainingBatch(state)"
          inputmode="numeric"
        />
      </label>
      <ul class="cost" aria-label="Coût">
        <li v-for="item in cost" :key="item.id" :class="{ short: state.resources[item.id] < item.amount }">
          <span aria-hidden="true">{{ RESOURCES[item.id].icon }}</span>
          {{ formatAmount(item.amount) }}
          <span class="sr-only">{{ RESOURCES[item.id].name }}</span>
        </li>
        <li class="muted"><span aria-hidden="true">⏱</span> {{ formatDuration(duration) }}</li>
      </ul>
      <p v-if="reason" class="reason">{{ reason }}</p>
      <button class="btn" type="button" :disabled="!check.ok" @click="emit('train', count)">Entraîner</button>
    </div>
  </article>
</template>

<style scoped>
.stats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
}
</style>
