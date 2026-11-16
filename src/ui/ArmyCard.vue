<script setup lang="ts">
import { computed } from 'vue'
import { RESOURCES, RESOURCE_IDS, type MonsterId } from '../game/config'
import {
  bandsNearPath,
  battleSurvivors,
  carryCapacity,
  checkOrder,
  getBandKind,
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
import { STATUS_ICONS, armyStatusText, orderText } from './world'

// La fiche d'une armée dehors : où elle en est, ce qu'elle porte, et ses ordres.
const props = defineProps<{ state: GameState; now: number; army: FieldArmy; plan: Target | null }>()
const emit = defineEmits<{ order: [target: Target]; clearPlan: []; close: [] }>()

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

// Le prochain ordre envisagé : est-il possible, et passe-t-il près de bandes en patrouille ?
const planCheck = computed(() => (props.plan ? checkOrder(props.state, props.army.id, props.plan) : null))
const planText = computed(() => (props.plan ? orderText(props.state, props.plan) : ''))
const planDuration = computed(() => {
  const to = props.plan && targetPosition(props.state, props.plan, props.now)
  return to ? marchDuration(props.state, props.army.position, to, props.army.hero) : null
})
const dangers = computed(() => {
  const plan = props.plan
  const to = plan && targetPosition(props.state, plan, props.now)
  if (!plan || !to) return []
  return bandsNearPath(props.state, props.army.position, to, plan).map(
    (band) => `${getBandKind(band.kind).name} (niv. ${band.level})`,
  )
})
</script>

<template>
  <article class="plaque working" aria-labelledby="army-title">
    <header class="plaque-head">
      <span class="plaque-icon" aria-hidden="true">{{ STATUS_ICONS[army.status] }}</span>
      <div>
        <h3 id="army-title" class="plaque-name">Ton armée</h3>
        <p class="plaque-level">{{ status }}</p>
      </div>
    </header>

    <p v-if="hero">
      Menée par <span aria-hidden="true">{{ hero.def.icon }}</span> <strong>{{ hero.def.name }}</strong>
      (niveau {{ hero.level }})
    </p>
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

    <section v-if="plan" class="plan" aria-label="Nouvel ordre">
      <p>
        <strong>Nouvel ordre :</strong> {{ planText
        }}<template v-if="planDuration !== null"> · {{ formatDuration(planDuration) }} de marche</template>
      </p>
      <p v-if="dangers.length" class="warning">
        Attention : sur le chemin, des bandes patrouillent ({{ dangers.join(', ') }}). Elles attaqueront ton armée
        si elle entre dans leur zone d’aggro.
      </p>
      <p v-if="planCheck && !planCheck.ok" class="reason">{{ planCheck.reason }}</p>
      <div class="actions">
        <button class="btn" type="button" :disabled="!planCheck?.ok" @click="emit('order', plan)">
          Valider l’ordre
        </button>
        <button class="btn-quiet" type="button" @click="emit('clearPlan')">Annuler</button>
      </div>
    </section>
    <p v-else class="muted">
      Touche la carte pour l’envoyer ailleurs, ou un camp, une bande ou un gisement pour l’attaquer ou y récolter.
    </p>

    <div class="plaque-foot actions">
      <button
        v-if="army.order?.type !== 'city' || army.status === 'fighting'"
        class="btn"
        :class="{ 'btn-danger': army.status === 'fighting' }"
        type="button"
        @click="emit('order', CITY)"
      >
        {{ army.status === 'fighting' ? 'Battre en retraite' : 'Rentrer à la cité' }}
      </button>
      <button class="btn-quiet" type="button" @click="emit('close')">Fermer</button>
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

.plan {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--seam);
}

.warning {
  font-size: 0.9rem;
  color: var(--ember);
}

.actions {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
</style>
