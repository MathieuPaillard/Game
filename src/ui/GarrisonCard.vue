<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { STARVATION_ATTACK_MALUS, UNIT_IDS, type Army } from '../game/config'
import {
  allTroops,
  armySize,
  checkDismiss,
  emptyArmy,
  getUnit,
  netPerHour,
  timeUntilFamine,
  upkeepPerHour,
  type GameState,
} from '../game/rules'
import CountPicker from './CountPicker.vue'
import { formatAmount, formatDuration, formatRate } from './format'

// La garnison : les troupes au repos dans la cité. On y voit ce qu'elles mangent, et on peut en renvoyer.
const props = defineProps<{ state: GameState }>()
const emit = defineEmits<{ dismiss: [troops: Army]; openBarracks: [] }>()

const home = computed(() => UNIT_IDS.filter((id) => props.state.troops[id] > 0))
// Les troupes dehors : toutes les troupes, moins celles de la cité.
const away = computed(() => armySize(allTroops(props.state)) - armySize(props.state.troops))
const upkeep = computed(() => upkeepPerHour(props.state))
const foodRate = computed(() => netPerHour(props.state).food)
const famineIn = computed(() => timeUntilFamine(props.state))
const malusPercent = Math.round(STARVATION_ATTACK_MALUS * 100)

// Renvoi de troupes : le formulaire est replié, et rien n'est sélectionné au départ.
const dismissing = ref(false)
const toDismiss = reactive<Army>(emptyArmy())
const dismissCheck = computed(() => checkDismiss(props.state, { ...toDismiss }))

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
  <article class="plaque">
    <header class="plaque-head">
      <span class="plaque-icon" aria-hidden="true">🪖</span>
      <div>
        <h2 class="plaque-name">Garnison</h2>
        <p class="plaque-level">
          {{ armySize(state.troops) }} dans la cité<template v-if="away"> · {{ away }} dehors</template>
        </p>
      </div>
    </header>

    <p class="muted">Les troupes au repos dans la cité. Pour les envoyer en campagne, touche une cible aux alentours.</p>

    <ul v-if="home.length" class="troops" aria-label="Troupes dans la cité">
      <li v-for="id in home" :key="id">
        <span aria-hidden="true">{{ getUnit(id).icon }}</span> {{ getUnit(id).name }}
        <strong>{{ state.troops[id] }}</strong>
      </li>
    </ul>
    <p v-else>Aucune troupe dans la cité.</p>

    <p>
      Entretien : <strong><span aria-hidden="true">🌾</span> {{ formatAmount(upkeep) }}</strong> de nourriture par
      heure, troupes dehors comprises.
    </p>
    <p v-if="famineIn !== null" class="hungry" role="status">
      <template v-if="state.resources.food >= 1">
        <strong>Famine en vue.</strong> Ton armée mange plus que tes fermes ne produisent ({{ formatRate(foodRate) }}).
        Dans {{ formatDuration(famineIn) }}, tes réserves seront vides : tes troupes auront faim et perdront
        {{ malusPercent }} % de leur attaque.
      </template>
      <template v-else>
        <strong>Famine.</strong> Tes réserves de nourriture sont vides ({{ formatRate(foodRate) }}) : tes troupes ont
        faim et perdent {{ malusPercent }} % de leur attaque.
      </template>
      Améliore ta Ferme, ou renvoie des troupes.
    </p>

    <div class="plaque-foot">
      <form v-if="dismissing" class="dismiss-form" @submit.prevent="confirmDismiss">
        <p class="muted">
          Les troupes renvoyées rentrent chez elles : elles ne mangent plus, mais elles quittent ton armée pour de bon.
        </p>
        <div v-for="id in home" :key="id" class="pick">
          <label :for="`dismiss-${id}`">
            {{ getUnit(id).icon }} {{ getUnit(id).name }} <span class="muted">(max {{ state.troops[id] }})</span>
          </label>
          <CountPicker
            :id="`dismiss-${id}`"
            v-model="toDismiss[id]"
            :max="state.troops[id]"
            :label="`${getUnit(id).name} à renvoyer`"
          />
        </div>
        <p v-if="!dismissCheck.ok" class="reason">{{ dismissCheck.reason }}</p>
        <div class="actions">
          <button class="btn btn-danger" type="submit" :disabled="!dismissCheck.ok">Renvoyer</button>
          <button class="btn-quiet" type="button" @click="dismissing = false">Annuler</button>
        </div>
      </form>
      <div v-else class="actions">
        <button class="btn" type="button" @click="emit('openBarracks')">Entraîner des troupes</button>
        <button v-if="home.length" class="btn-quiet" type="button" @click="openDismiss">Renvoyer des troupes</button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.troops {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.1rem;
  font-variant-numeric: tabular-nums;
}

.hungry strong {
  color: var(--ember);
}

.dismiss-form {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.pick {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
</style>
