<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RESOURCES, RESOURCE_IDS, STARVATION_ATTACK_MALUS, UNIT_IDS, type Army, type MonsterId } from '../game/config'
import {
  bandLoot,
  bandMonsters,
  bandsOnPath,
  checkExpedition,
  checkExpeditionSlot,
  emptyArmy,
  getBand,
  getBandKind,
  getCamp,
  getMonster,
  getUnit,
  marchDuration,
  timeUntilFamine,
  type GameState,
  type Monsters,
  type Target,
} from '../game/rules'
import { foeName } from './battleLog'
import { formatAmount, formatDuration } from './format'

// La fiche d'une cible, camp de monstres ou bande : ce qui l'attend, et le départ de l'armée.
const props = defineProps<{ target: Target; state: GameState }>()
const emit = defineEmits<{ attack: [troops: Army] }>()

function total(monsters: Monsters): number {
  return Object.values(monsters).reduce((sum, count) => sum + (count ?? 0), 0)
}

/** Ce qu'il faut savoir de la cible, qu'elle soit un camp ou une bande (null si la bande n'est plus là). */
const info = computed(() => {
  const target = props.target
  if (target.type === 'camp') {
    const camp = getCamp(target.camp)
    return {
      key: camp.id,
      name: camp.name,
      level: camp.level,
      position: camp.position,
      monsters: camp.defenders,
      loot: camp.loot,
      isBand: false,
      weakened: false,
    }
  }
  const band = getBand(props.state, target.band)
  if (!band) return null
  return {
    key: `band-${band.id}`,
    name: getBandKind(band.kind).name,
    level: band.level,
    position: band.position,
    monsters: band.monsters,
    loot: bandLoot(band.kind, band.level),
    isBand: true,
    weakened: total(band.monsters) < total(bandMonsters(band.kind, band.level)),
  }
})

const open = ref(false)
const selection = reactive<Army>(emptyArmy())
const available = computed(() => UNIT_IDS.filter((id) => props.state.troops[id] > 0))
const foes = computed(() =>
  (Object.entries(info.value?.monsters ?? {}) as [MonsterId, number][])
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ monster: getMonster(id), count })),
)
const loot = computed(() =>
  RESOURCE_IDS.filter((id) => info.value?.loot[id]).map((id) => ({ id, amount: info.value?.loot[id] ?? 0 })),
)
const march = computed(() => (info.value ? marchDuration(props.state, info.value.position) : 0))
// Les bandes dont l'armée traversera la zone d'aggro en chemin.
const ambushes = computed(() =>
  bandsOnPath(props.state, props.target).map((band) => foeName({ type: 'band', kind: band.kind, level: band.level })),
)
const blocked = computed(() => {
  const slot = checkExpeditionSlot(props.state, props.target)
  if (!slot.ok) return slot.reason
  if (available.value.length === 0) return 'Aucune troupe dans la cité'
  return null
})
// Les réserves de nourriture seront-elles vides quand l'armée arrivera ?
const hungryOnArrival = computed(() => {
  const famineIn = timeUntilFamine(props.state)
  return famineIn !== null && famineIn < march.value
})
const malusPercent = Math.round(STARVATION_ATTACK_MALUS * 100)
const check = computed(() => checkExpedition(props.state, props.target, { ...selection }))
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
  <article v-if="info" class="plaque">
    <header class="plaque-head">
      <span class="plaque-icon" aria-hidden="true">{{ foes[0]?.monster.icon }}</span>
      <div>
        <h3 class="plaque-name">{{ info.name }}</h3>
        <p class="plaque-level">Niveau {{ info.level }} · {{ formatDuration(march) }} de marche</p>
      </div>
    </header>

    <p v-if="info.isBand" class="muted">
      Une bande de monstres : elle attaque toute armée qui entre dans sa zone d’aggro, le cercle rouge sur la
      carte.<template v-if="info.weakened"> Une bataille l’a affaiblie : elle n’est plus au complet.</template>
    </p>

    <ul class="foes" aria-label="Monstres">
      <li v-for="f in foes" :key="f.monster.id">
        <span aria-hidden="true">{{ f.monster.icon }}</span> {{ f.monster.name }} <strong>{{ f.count }}</strong>
        <span class="muted"> · se battent comme des {{ getUnit(f.monster.family).name }}</span>
      </li>
    </ul>

    <p class="loot">
      Butin :
      <span v-for="item in loot" :key="item.id">
        <span aria-hidden="true">{{ RESOURCES[item.id].icon }}</span> {{ formatAmount(item.amount) }}
        <span class="sr-only">{{ RESOURCES[item.id].name }}</span>
      </span>
    </p>

    <p v-if="ambushes.length" class="ambush">
      Sur le chemin, ton armée traversera la zone d’aggro de : {{ ambushes.join(', ') }}. Elle devra d’abord
      se battre.
    </p>

    <div class="plaque-foot">
      <form v-if="open" class="send" @submit.prevent="send">
        <label v-for="id in available" :key="id" class="field" :for="`send-${info.key}-${id}`">
          <span>
            {{ getUnit(id).icon }} {{ getUnit(id).name }} <span class="muted">(max {{ state.troops[id] }})</span>
          </span>
          <input
            :id="`send-${info.key}-${id}`"
            v-model.number="selection[id]"
            type="number"
            min="0"
            :max="state.troops[id]"
            inputmode="numeric"
          />
        </label>
        <p v-if="hungryOnArrival" class="warning">
          Tes réserves de nourriture seront vides à l’arrivée : tes troupes affamées perdront {{ malusPercent }} %
          de leur attaque.
        </p>
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

.ambush,
.warning {
  font-size: 0.9rem;
  color: var(--ember);
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
