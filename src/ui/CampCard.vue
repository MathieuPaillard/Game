<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RESOURCES, RESOURCE_IDS, UNIT_IDS, type Army, type CampDef, type MonsterId } from '../game/config'
import { checkExpedition, emptyArmy, getMonster, getUnit, type GameState } from '../game/rules'
import { formatAmount, formatDuration } from './format'

const props = defineProps<{ camp: CampDef; state: GameState }>()
const emit = defineEmits<{ attack: [troops: Army] }>()

const open = ref(false)
const selection = reactive<Army>(emptyArmy())
const available = computed(() => UNIT_IDS.filter((id) => props.state.troops[id] > 0))
const defenders = computed(() =>
  (Object.entries(props.camp.defenders) as [MonsterId, number][]).map(([id, count]) => ({
    monster: getMonster(id),
    count,
  })),
)
const loot = computed(() =>
  RESOURCE_IDS.filter((id) => props.camp.loot[id]).map((id) => ({ id, amount: props.camp.loot[id] ?? 0 })),
)
const blocked = computed(() => {
  if (props.state.expedition) return 'Une armée est déjà en campagne'
  if (available.value.length === 0) return 'Aucune troupe dans la cité'
  return null
})
const check = computed(() => checkExpedition(props.state, props.camp.id, { ...selection }))
const reason = computed(() => (check.value.ok ? null : check.value.reason))

/** Ouvre le formulaire, avec toutes les troupes de la cité sélectionnées. */
function prepare() {
  for (const id of UNIT_IDS) selection[id] = props.state.troops[id]
  open.value = true
}

function send() {
  if (!check.value.ok) return
  emit('attack', { ...selection })
  open.value = false
}
</script>

<template>
  <article class="plaque">
    <header class="plaque-head">
      <span class="plaque-icon" aria-hidden="true">{{ defenders[0]?.monster.icon }}</span>
      <div>
        <h3 class="plaque-name">{{ camp.name }}</h3>
        <p class="plaque-level">Niveau {{ camp.level }} · {{ formatDuration(camp.marchSeconds * 1000) }} de marche</p>
      </div>
    </header>

    <ul class="foes" aria-label="Défenseurs">
      <li v-for="d in defenders" :key="d.monster.id">
        <span aria-hidden="true">{{ d.monster.icon }}</span> {{ d.monster.name }} <strong>{{ d.count }}</strong>
        <span class="muted"> · se battent comme des {{ getUnit(d.monster.family).name }}</span>
      </li>
    </ul>

    <p class="loot">
      Butin :
      <span v-for="item in loot" :key="item.id">
        <span aria-hidden="true">{{ RESOURCES[item.id].icon }}</span> {{ formatAmount(item.amount) }}
        <span class="sr-only">{{ RESOURCES[item.id].name }}</span>
      </span>
    </p>

    <div class="plaque-foot">
      <form v-if="open" class="send" @submit.prevent="send">
        <label v-for="id in available" :key="id" class="field" :for="`send-${camp.id}-${id}`">
          <span>
            {{ getUnit(id).icon }} {{ getUnit(id).name }} <span class="muted">(max {{ state.troops[id] }})</span>
          </span>
          <input
            :id="`send-${camp.id}-${id}`"
            v-model.number="selection[id]"
            type="number"
            min="0"
            :max="state.troops[id]"
            inputmode="numeric"
          />
        </label>
        <p v-if="reason" class="reason">{{ reason }}</p>
        <div class="send-actions">
          <button class="btn" type="submit" :disabled="!check.ok">Envoyer l’armée</button>
          <button class="btn-quiet" type="button" @click="open = false">Annuler</button>
        </div>
      </form>

      <template v-else>
        <p v-if="blocked" class="reason">{{ blocked }}</p>
        <button class="btn" type="button" :disabled="blocked !== null" @click="prepare">Préparer l’attaque</button>
      </template>
    </div>
  </article>
</template>

<style scoped>
.foes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.loot {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.9rem;
  font-variant-numeric: tabular-nums;
}

.send {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.send-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
</style>
