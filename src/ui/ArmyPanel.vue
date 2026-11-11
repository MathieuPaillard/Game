<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { COUNTER_BONUS, STARVATION_ATTACK_MALUS, UNITS, UNIT_IDS, type Army, type UnitId } from '../game/config'
import {
  armySize,
  checkDismiss,
  emptyArmy,
  getUnit,
  isStarving,
  maxTrainingBatch,
  upkeepPerHour,
  type GameState,
} from '../game/rules'
import UnitCard from './UnitCard.vue'
import { formatAmount, formatDuration } from './format'

const props = defineProps<{ state: GameState; now: number }>()
const emit = defineEmits<{ train: [unit: UnitId, count: number]; dismiss: [troops: Army] }>()

const training = computed(() => props.state.training)
const progress = computed(() => {
  const t = training.value
  if (!t) return 0
  return Math.min(1, Math.max(0, (props.now - t.startedAt) / (t.endsAt - t.startedAt)))
})
const away = computed(() => (props.state.expedition ? armySize(props.state.expedition.troops) : 0))
const upkeep = computed(() => upkeepPerHour(props.state))
const starving = computed(() => isStarving(props.state))
const counterPercent = Math.round((COUNTER_BONUS - 1) * 100)
const malusPercent = Math.round(STARVATION_ATTACK_MALUS * 100)

// Renvoi de troupes : le formulaire est replié, et rien n'est sélectionné au départ.
const dismissing = ref(false)
const toDismiss = reactive<Army>(emptyArmy())
const home = computed(() => UNIT_IDS.filter((id) => props.state.troops[id] > 0))
const dismissCheck = computed(() => checkDismiss(props.state, { ...toDismiss }))
const dismissReason = computed(() => (dismissCheck.value.ok ? null : dismissCheck.value.reason))

function openDismiss() {
  for (const id of UNIT_IDS) toDismiss[id] = 0
  dismissing.value = true
}

function confirmDismiss() {
  if (!dismissCheck.value.ok) return
  emit('dismiss', { ...toDismiss })
  dismissing.value = false
}
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
      <p>
        Entretien : <strong><span aria-hidden="true">🌾</span> {{ formatAmount(upkeep) }}</strong> de nourriture
        par heure, troupes en campagne comprises.
      </p>
      <p v-if="starving" class="hungry">
        Tes troupes ont faim : elles perdent {{ malusPercent }} % de leur attaque au combat, tant que tes fermes ne
        produisent pas assez.
      </p>

      <div v-if="home.length" class="dismiss">
        <form v-if="dismissing" class="dismiss-form" @submit.prevent="confirmDismiss">
          <p class="muted">
            Les troupes renvoyées rentrent chez elles : elles ne mangent plus, mais elles quittent ton armée pour
            de bon.
          </p>
          <label v-for="id in home" :key="id" class="field" :for="`dismiss-${id}`">
            <span>
              {{ getUnit(id).icon }} {{ getUnit(id).name }} <span class="muted">(max {{ state.troops[id] }})</span>
            </span>
            <input
              :id="`dismiss-${id}`"
              v-model.number="toDismiss[id]"
              type="number"
              min="0"
              :max="state.troops[id]"
              inputmode="numeric"
            />
          </label>
          <p v-if="dismissReason" class="reason">{{ dismissReason }}</p>
          <div class="dismiss-actions">
            <button class="btn btn-danger" type="submit" :disabled="!dismissCheck.ok">Renvoyer</button>
            <button class="btn-quiet" type="button" @click="dismissing = false">Annuler</button>
          </div>
        </form>
        <button v-else class="btn-quiet" type="button" @click="openDismiss">Renvoyer des troupes</button>
      </div>

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

.hungry {
  color: var(--ember);
}

.dismiss-form {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem;
  background: var(--stone);
  border: 1px solid var(--seam);
  border-radius: var(--radius);
}

.dismiss-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
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
