<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RESOURCES, RESOURCE_IDS, UNITS, type LineId, type UnitId } from '../game/config'
import {
  checkTraining,
  getRace,
  getUnit,
  lineTraining,
  maxTrainingBatch,
  rankNumeral,
  rankOpen,
  trainingCost,
  trainingDuration,
  type GameState,
} from '../game/rules'
import CountPicker from './CountPicker.vue'
import { formatAmount, formatDuration } from './format'

// Une troupe de la Caserne, avec ses rangs : on choisit lequel entraîner.
const props = defineProps<{ line: LineId; state: GameState; now: number }>()
const emit = defineEmits<{ train: [unit: UnitId, count: number] }>()

const ranks = computed(() => UNITS.filter((unit) => unit.line === props.line))
/** Un rang qu'on peut entraîner : ouvert par sa grande recherche, et à la portée de la Caserne. */
const trainable = (rank: number) => {
  const unit = ranks.value[rank - 1]
  return rankOpen(props.state, rank) && props.state.levels.barracks >= unit.barracksLevel
}
/** Le rang le plus haut qu'on peut entraîner. */
const best = computed(() => Math.max(1, ...ranks.value.filter((unit) => trainable(unit.rank)).map((unit) => unit.rank)))
/** Les rangs montrés : ceux qu'on peut entraîner, et le suivant, pour donner envie (rien de plus tant que le rang I attend la Caserne). */
const shown = computed(() => ranks.value.filter((unit) => unit.rank <= (trainable(1) ? best.value + 1 : 1)))

// Par défaut, le meilleur rang ; quand un nouveau rang s'ouvre, on le choisit.
const chosen = ref(best.value)
watch(best, (rank) => (chosen.value = rank))
const unit = computed(() => ranks.value[chosen.value - 1])

const count = ref(10)
// Tant que le champ est vide ou faux, on affiche le coût de zéro troupe.
const amount = computed(() => (Number.isInteger(count.value) && count.value > 0 ? count.value : 0))
const locked = computed(() => !trainable(unit.value.rank))

// L'entraînement en cours pour cette troupe, quel que soit son rang.
const training = computed(() => lineTraining(props.state, props.line) ?? null)
const progress = computed(() => {
  const t = training.value
  if (!t) return 0
  return Math.min(1, Math.max(0, (props.now - t.startedAt) / (t.endsAt - t.startedAt)))
})

const check = computed(() => checkTraining(props.state, unit.value.id, count.value))
const reason = computed(() => (check.value.ok ? null : check.value.reason))
const cost = computed(() => {
  const c = trainingCost(unit.value, amount.value)
  return RESOURCE_IDS.filter((id) => c[id]).map((id) => ({ id, amount: c[id] ?? 0 }))
})
const duration = computed(() => trainingDuration(props.state, unit.value, amount.value))
/** Les troupes de tous les rangs dans la cité. */
const atHome = computed(() => ranks.value.reduce((sum, rank) => sum + props.state.troops[rank.id], 0))
</script>

<template>
  <article class="plaque" :class="{ empty: locked, working: training }">
    <header class="plaque-head">
      <span class="plaque-icon" aria-hidden="true">{{ unit.icon }}</span>
      <div>
        <h3 class="plaque-name">{{ unit.name }}</h3>
        <p class="plaque-level">
          Rang {{ rankNumeral(unit.rank) }} · {{ state.troops[unit.id] }} dans la cité<template
            v-if="atHome > state.troops[unit.id]"
          >
            (tous rangs : {{ atHome }})</template
          >
        </p>
      </div>
    </header>

    <ul v-if="shown.length > 1" class="chips ranks" aria-label="Rang">
      <li v-for="rank in shown" :key="rank.id">
        <button
          type="button"
          class="chip"
          :class="{ closed: !trainable(rank.rank) }"
          :aria-pressed="chosen === rank.rank"
          :title="rank.name"
          @click="chosen = rank.rank"
        >
          {{ rankNumeral(rank.rank) }}
          <span v-if="!trainable(rank.rank)" aria-hidden="true">🔒</span>
          <span v-else-if="state.troops[rank.id] > 0" class="chip-tag">{{ state.troops[rank.id] }}</span>
        </button>
      </li>
    </ul>

    <p class="muted">{{ unit.description }}</p>
    <p v-if="unit.race" class="race-unit">
      Troupe propre aux {{ getRace(unit.race).name }} · se bat comme les {{ getUnit(unit.family).name }}
    </p>

    <ul class="stats">
      <li v-if="unit.heal">Soigne <strong>{{ unit.heal }}</strong> par manche</li>
      <li>Attaque <strong>{{ unit.attack }}</strong></li>
      <li>Vie <strong>{{ unit.health }}</strong></li>
      <li>Mange <strong>{{ unit.upkeepPerHour }}</strong> <span aria-hidden="true">🌾</span>/h</li>
      <li>Fort contre les <strong>{{ getUnit(unit.strongAgainst).name }}</strong></li>
    </ul>

    <div class="plaque-foot">
      <div v-if="training" class="works" role="status">
        <div class="progress"><span class="progress-fill" :style="{ width: `${progress * 100}%` }"></span></div>
        <p class="works-label">
          {{ training.count }} {{ getUnit(training.unit).name }} en entraînement · {{ formatDuration(training.endsAt - now) }}
        </p>
      </div>

      <template v-else>
        <CountPicker
          :id="`train-${line}`"
          v-model="count"
          :min="1"
          :max="maxTrainingBatch(state)"
          :label="`${unit.name} à entraîner`"
        />
        <ul class="cost" aria-label="Coût">
          <li v-for="item in cost" :key="item.id" :class="{ short: state.resources[item.id] < item.amount }">
            <span aria-hidden="true">{{ RESOURCES[item.id].icon }}</span>
            {{ formatAmount(item.amount) }}
            <span class="sr-only">{{ RESOURCES[item.id].name }}</span>
          </li>
          <li class="muted"><span aria-hidden="true">⏱</span> {{ formatDuration(duration) }}</li>
        </ul>
        <p v-if="reason" class="reason">{{ reason }}</p>
        <button class="btn" type="button" :disabled="!check.ok" @click="emit('train', unit.id, count)">Entraîner</button>
      </template>
    </div>
  </article>
</template>

<style scoped>
.race-unit {
  color: var(--gilt);
  font-weight: 700;
}

.stats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
}

.ranks .chip {
  min-width: 2.6rem;
  justify-content: center;
  font-family: var(--font-display);
}

/* Un rang encore fermé : on peut le regarder, pas l'entraîner. */
.ranks .chip.closed {
  color: var(--faded);
  border-style: dashed;
}
</style>
