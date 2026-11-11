<script setup lang="ts">
import { computed } from 'vue'
import { MAX_LEVEL, RESOURCES, RESOURCE_IDS, type BuildingDef } from '../game/config'
import { buildingOutput, checkUpgrade, upgradeCost, upgradeDuration, type GameState } from '../game/rules'
import { formatAmount, formatDuration } from './format'

const props = defineProps<{ building: BuildingDef; state: GameState; now: number }>()
const emit = defineEmits<{ upgrade: [] }>()

const level = computed(() => props.state.levels[props.building.id])
const target = computed(() => level.value + 1)
const maxed = computed(() => level.value >= MAX_LEVEL)

const works = computed(() =>
  props.state.construction?.building === props.building.id ? props.state.construction : null,
)
const remaining = computed(() => (works.value ? works.value.endsAt - props.now : 0))
const progress = computed(() => {
  const w = works.value
  if (!w) return 0
  return Math.min(1, Math.max(0, (props.now - w.startedAt) / (w.endsAt - w.startedAt)))
})

const check = computed(() => checkUpgrade(props.state, props.building.id))
const reason = computed(() => (check.value.ok ? null : check.value.reason))

const cost = computed(() => {
  const c = upgradeCost(props.building, target.value)
  return RESOURCE_IDS.filter((id) => c[id]).map((id) => ({ id, amount: c[id] ?? 0 }))
})
const duration = computed(() => upgradeDuration(props.state, props.building, target.value))
const outputNow = computed(() => buildingOutput(props.state, props.building, level.value))
const outputNext = computed(() => buildingOutput(props.state, props.building, target.value))
</script>

<template>
  <article class="plaque" :class="{ empty: level === 0, working: works, wide: building.id === 'castle' }">
    <header class="plaque-head">
      <span class="plaque-icon" aria-hidden="true">{{ building.icon }}</span>
      <div>
        <h2 class="plaque-name">{{ building.name }}</h2>
        <p class="plaque-level">{{ level > 0 ? `Niveau ${level}` : 'Pas encore construit' }}</p>
      </div>
    </header>

    <p class="muted">{{ building.description }}</p>

    <p v-if="building.produces" class="plaque-output">
      {{ RESOURCES[building.produces].icon }} {{ formatAmount(outputNow) }}/h
      <span v-if="!maxed" class="muted">→ {{ formatAmount(outputNext) }}/h au niveau {{ target }}</span>
    </p>

    <div class="plaque-foot">
      <div v-if="works" class="works" role="status">
        <div class="progress"><span class="progress-fill" :style="{ width: `${progress * 100}%` }"></span></div>
        <p class="works-label">Niveau {{ works.targetLevel }} en construction · {{ formatDuration(remaining) }}</p>
      </div>

      <p v-else-if="maxed" class="muted">Niveau maximum atteint</p>

      <template v-else>
        <ul class="cost" aria-label="Coût">
          <li v-for="item in cost" :key="item.id" :class="{ short: state.resources[item.id] < item.amount }">
            <span aria-hidden="true">{{ RESOURCES[item.id].icon }}</span>
            {{ formatAmount(item.amount) }}
            <span class="sr-only">{{ RESOURCES[item.id].name }}</span>
          </li>
          <li class="muted"><span aria-hidden="true">⏱</span> {{ formatDuration(duration) }}</li>
        </ul>
        <p v-if="reason" class="reason">{{ reason }}</p>
        <button class="btn" type="button" :disabled="!check.ok" @click="emit('upgrade')">
          {{ level === 0 ? 'Construire' : `Améliorer au niveau ${target}` }}
        </button>
      </template>
    </div>
  </article>
</template>

<style scoped>
/* Le Château, cœur de la cité, occupe toute une rangée. */
.plaque.wide {
  grid-column: 1 / -1;
}

.plaque.wide .plaque-foot {
  max-width: 26rem;
}

.plaque-output {
  font-variant-numeric: tabular-nums;
}

.plaque-output .muted {
  font-size: 0.875rem;
}
</style>
