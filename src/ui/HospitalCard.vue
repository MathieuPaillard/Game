<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import {
  HEAL_COST_SHARE,
  HEAL_TIME_SHARE,
  RESOURCES,
  RESOURCE_IDS,
  UNIT_IDS,
  WOUNDED_SHARE,
  type Army,
} from '../game/config'
import {
  armySize,
  checkHealing,
  emptyArmy,
  freeBeds,
  getUnit,
  healingCost,
  healingDuration,
  hospitalBeds,
  type GameState,
} from '../game/rules'
import CountPicker from './CountPicker.vue'
import { formatAmount, formatArmy, formatDuration } from './format'

// L'hôpital, sous sa fiche : ses lits, les blessés qui attendent, et leurs soins.
const props = defineProps<{ state: GameState; now: number }>()
const emit = defineEmits<{ heal: [troops: Army] }>()

const beds = computed(() => hospitalBeds(props.state))
const occupied = computed(() => beds.value - freeBeds(props.state))
const woundedIds = computed(() => UNIT_IDS.filter((id) => props.state.wounded[id] > 0))
const woundedPercent = Math.round(WOUNDED_SHARE * 100)
const costPercent = Math.round(HEAL_COST_SHARE * 100)
const timePercent = Math.round(HEAL_TIME_SHARE * 100)

// Les blessés à soigner : tous, par défaut. Le choix ne revient à « tous » que si les blessés changent.
const chosen = reactive<Army>(emptyArmy())
watch(
  () => UNIT_IDS.map((id) => props.state.wounded[id]).join(','),
  () => {
    for (const id of UNIT_IDS) chosen[id] = props.state.wounded[id]
  },
  { immediate: true },
)
const selection = computed<Army>(() => {
  const army = emptyArmy()
  for (const id of UNIT_IDS) army[id] = Math.min(chosen[id], props.state.wounded[id])
  return army
})
const count = computed(() => armySize(selection.value))
const check = computed(() => checkHealing(props.state, selection.value))
const cost = computed(() => {
  const c = healingCost(selection.value)
  return RESOURCE_IDS.filter((id) => c[id]).map((id) => ({ id, amount: c[id] ?? 0 }))
})
const duration = computed(() => healingDuration(props.state, selection.value))

// Les blessés en soins, et le temps qu'il leur reste.
const healing = computed(() => {
  const h = props.state.healing
  if (!h) return null
  const span = Math.max(1, h.endsAt - h.startedAt)
  return {
    troops: formatArmy(h.troops),
    left: Math.max(0, h.endsAt - props.now),
    progress: Math.min(1, Math.max(0, (props.now - h.startedAt) / span)),
  }
})

function heal() {
  if (check.value.ok) emit('heal', { ...selection.value })
}
</script>

<template>
  <section class="plaque" aria-labelledby="hospital-title">
    <h3 id="hospital-title" class="plaque-name">Blessés et soins</h3>
    <p class="muted">
      {{ woundedPercent }} % des troupes qui tombent au combat ne sont que blessées : elles attendent ici qu’on les
      soigne, s’il reste un lit. Les autres meurent. Les soigner coûte {{ costPercent }} % de leur entraînement et
      prend {{ timePercent }} % de son temps.
    </p>

    <div class="beds">
      <p>
        <span aria-hidden="true">🛏️</span> Lits occupés : <strong>{{ occupied }} / {{ beds }}</strong>
      </p>
      <div class="progress" aria-hidden="true">
        <span class="progress-fill" :style="{ width: `${beds ? (occupied / beds) * 100 : 0}%` }"></span>
      </div>
    </div>
    <p v-if="beds > 0 && occupied >= beds" class="reason">
      L’hôpital est plein : les prochains blessés mourront. Soigne ceux qui attendent, ou agrandis l’Hôpital.
    </p>

    <div v-if="healing" class="works" role="status">
      <div class="progress"><span class="progress-fill" :style="{ width: `${healing.progress * 100}%` }"></span></div>
      <p class="works-label">En soins : {{ healing.troops }} · {{ formatDuration(healing.left) }}</p>
    </div>

    <form v-if="woundedIds.length" class="heal-form" @submit.prevent="heal">
      <h4 class="group-title">Blessés qui attendent</h4>
      <div v-for="id in woundedIds" :key="id" class="pick">
        <label :for="`heal-${id}`">
          {{ getUnit(id).icon }} {{ getUnit(id).name }}
          <span class="muted">({{ state.wounded[id] }} blessé{{ state.wounded[id] > 1 ? 's' : '' }})</span>
        </label>
        <CountPicker
          :id="`heal-${id}`"
          v-model="chosen[id]"
          :max="state.wounded[id]"
          :label="`${getUnit(id).name} à soigner`"
        />
      </div>
      <ul v-if="count > 0" class="cost" aria-label="Coût des soins">
        <li v-for="c in cost" :key="c.id" :class="{ short: state.resources[c.id] < c.amount }">
          <span aria-hidden="true">{{ RESOURCES[c.id].icon }}</span> {{ formatAmount(c.amount) }}
          <span class="sr-only">{{ RESOURCES[c.id].name }}</span>
        </li>
        <li class="muted"><span aria-hidden="true">⏱</span> {{ formatDuration(duration) }}</li>
      </ul>
      <p v-if="!check.ok" class="reason">{{ check.reason }}</p>
      <button class="btn" type="submit" :disabled="!check.ok">
        Soigner{{ count > 0 ? ` ${count} blessé${count > 1 ? 's' : ''}` : '' }}
      </button>
    </form>
    <p v-else-if="!healing" class="muted">Aucun blessé pour l’instant.</p>
  </section>
</template>

<style scoped>
.beds {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-variant-numeric: tabular-nums;
}

.heal-form {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.group-title {
  margin: 0.2rem 0 0;
  font: 700 1rem/1.3 var(--font-body);
}

.pick {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
</style>
