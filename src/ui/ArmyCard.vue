<script setup lang="ts">
import { computed } from 'vue'
import { RESOURCES, RESOURCE_IDS, type MonsterId } from '../game/config'
import {
  battleSurvivors,
  carryCapacity,
  dragonLevel,
  getHero,
  getHeroDef,
  getMonster,
  loadSize,
  marchDuration,
  targetPosition,
  type FieldArmy,
  type GameState,
  type Target,
} from '../game/rules'
import { formatAmount, formatArmy, formatDuration } from './format'
import { STATUS_ICONS, armyStatusText } from './world'

// La fiche d'une armée dehors : où elle en est, et ce qu'elle porte. Pour lui donner un ordre, on
// touche la carte : elle part aussitôt.
const props = defineProps<{ state: GameState; now: number; army: FieldArmy }>()
const emit = defineEmits<{ order: [target: Target] }>()

const CITY: Target = { type: 'city' }

const status = computed(() => armyStatusText(props.state, props.army))
// Le héros qui la mène, s'il y en a un.
const hero = computed(() => {
  const id = props.army.hero
  const recruited = id === null ? undefined : getHero(props.state, id)
  return recruited ? { def: getHeroDef(recruited.id), level: recruited.level } : null
})
const battle = computed(() => props.state.battles.find((b) => b.army === props.army.id))

// Le temps qu'il lui reste à marcher.
const eta = computed(() => {
  const order = props.army.order
  if (props.army.status !== 'marching' || !order) return null
  const to = targetPosition(props.state, order, props.now)
  return to ? marchDuration(props.state, props.army.position, to, props.army.hero) : null
})

// Au combat : ce qui reste de chaque côté.
const fight = computed(() => {
  if (!battle.value) return null
  const { troops, monsters } = battleSurvivors(battle.value)
  const foes = (Object.entries(monsters) as [MonsterId, number][])
    .filter(([, count]) => count > 0)
    .map(([id, count]) => `${getMonster(id).icon} ${getMonster(id).name} ${count}`)
    .join(' · ')
  return { round: battle.value.rounds.length, troops: formatArmy(troops), foes }
})

const capacity = computed(() => carryCapacity(props.state, props.army.troops, props.army.hero))
const carried = computed(() => loadSize(props.army.load))
const load = computed(() =>
  RESOURCE_IDS.filter((id) => (props.army.load[id] ?? 0) >= 1).map((id) => ({
    id,
    amount: props.army.load[id] ?? 0,
  })),
)
</script>

<template>
  <article class="plaque" aria-labelledby="army-title">
    <header class="plaque-head">
      <span class="plaque-icon" aria-hidden="true">{{ STATUS_ICONS[army.status] }}</span>
      <div>
        <h2 id="army-title" class="plaque-name">Ton armée</h2>
        <p class="plaque-level">{{ status }}</p>
      </div>
    </header>

    <p v-if="hero">
      Menée par <span aria-hidden="true">{{ hero.def.icon }}</span> <strong>{{ hero.def.name }}</strong>
      (niveau {{ hero.level }})
    </p>
    <p v-if="army.dragon"><span aria-hidden="true">🐉</span> Le dragon l’accompagne (niveau {{ dragonLevel(state) }}).</p>
    <p v-if="eta !== null">Arrivée dans {{ formatDuration(eta) }}.</p>
    <div v-if="fight" class="fight" role="status">
      <p>
        <strong>Manche {{ fight.round + 1 }}</strong> : une manche toutes les quelques secondes, jusqu’à ce qu’un camp
        tombe.
      </p>
      <p>Tes troupes : {{ fight.troops || 'aucune' }}</p>
      <p>En face : {{ fight.foes || 'personne' }}</p>
    </div>
    <p v-else>Troupes : {{ formatArmy(army.troops) }}</p>
    <p>
      Charge : {{ formatAmount(carried) }} / {{ formatAmount(capacity) }}
      <template v-if="load.length">
        —
        <span v-for="item in load" :key="item.id" class="load-item">
          <span aria-hidden="true">{{ RESOURCES[item.id].icon }}</span> {{ formatAmount(item.amount) }}
          <span class="sr-only">{{ RESOURCES[item.id].name }}</span>
        </span>
      </template>
    </p>

    <p v-if="army.status === 'fighting'" class="muted">
      Pendant la bataille, ton armée ne reçoit qu’un ordre : battre en retraite. Elle quitte alors le combat, sans
      butin.
    </p>
    <p v-else class="hint">
      Touche la carte : ton armée y va aussitôt. Touche un camp, une bande ou un gisement pour l’attaquer ou y
      récolter. Tu peux aussi la faire glisser du doigt jusqu’à sa destination.
    </p>

    <div class="plaque-foot actions">
      <button
        v-if="army.status === 'fighting'"
        class="btn btn-danger"
        type="button"
        @click="emit('order', CITY)"
      >
        Battre en retraite
      </button>
      <button v-else-if="army.order?.type !== 'city'" class="btn" type="button" @click="emit('order', CITY)">
        Rentrer à la cité
      </button>
    </div>
  </article>
</template>

<style scoped>
.fight {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--ember);
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
}

.load-item {
  margin-right: 0.6rem;
  font-variant-numeric: tabular-nums;
}

.hint {
  color: var(--gilt);
}

.actions {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
</style>
