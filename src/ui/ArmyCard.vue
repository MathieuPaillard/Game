<script setup lang="ts">
import { computed } from 'vue'
import { ENCIRCLED_ATTACK_MALUS, REAR_ATTACK_BONUS, RESOURCES, RESOURCE_IDS, SIDE_ATTACK_BONUS, type MonsterId } from '../game/config'
import {
  allySurvivors,
  armyBattle,
  attackersOf,
  carryCapacity,
  encircled,
  fighterOf,
  flankOf,
  foeSurvivors,
  relativeSlot,
  dragonLevel,
  getHero,
  getHeroDef,
  getMonster,
  loadSize,
  marchDuration,
  targetPosition,
  type FieldArmy,
  type FoeFighter,
  type GameState,
  type Monsters,
  type Target,
} from '../game/rules'
import { foeName } from './battleLog'
import { formatAmount, formatArmy, formatDuration } from './format'
import { STATUS_ICONS, armyStatusText, bandName, chasers } from './world'

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
const fighting = computed(() => armyBattle(props.state, props.army.id))
// Les bandes qui la poursuivent (sans celles de sa mêlée).
const hunters = computed(() =>
  chasers(props.state, props.army.id)
    .filter((band) => !fighting.value?.battle.foes.some((foe) => foe.band === band.id))
    .map(bandName),
)

// Le temps qu'il lui reste à marcher.
const eta = computed(() => {
  const order = props.army.order
  if (props.army.status !== 'marching' || !order) return null
  const to = targetPosition(props.state, order, props.now)
  return to ? marchDuration(props.state, props.army.position, to, props.army.hero) : null
})

/** Les monstres encore debout, en quelques mots. */
function monstersText(monsters: Monsters): string {
  return (Object.entries(monsters) as [MonsterId, number][])
    .filter(([, count]) => count > 0)
    .map(([id, count]) => `${getMonster(id).icon} ${getMonster(id).name} ${count}`)
    .join(' · ')
}

const FLANK_TEXTS = { front: 'de face', side: 'de côté', rear: 'de dos' }
const sidePercent = Math.round(SIDE_ATTACK_BONUS * 100)
const rearPercent = Math.round(REAR_ATTACK_BONUS * 100)
const malusPercent = Math.round(ENCIRCLED_ATTACK_MALUS * 100)

// Au combat : sa cible (et d'où elle la frappe), ceux qui la frappent (et d'où), et si elle est encerclée.
const fight = computed(() => {
  const current = fighting.value
  if (!current) return null
  const { battle, ally } = current
  const target = fighterOf(battle, ally.target) as FoeFighter | undefined
  const flank = target ? flankOf(relativeSlot(battle, ally)) : 'front'
  const attackers = (attackersOf(battle, ally.ref) as FoeFighter[]).map((foe) => ({
    key: foe.ref,
    name: foeName(foe.foe),
    from: FLANK_TEXTS[flankOf(relativeSlot(battle, foe))],
  }))
  return {
    round: battle.round,
    troops: formatArmy(allySurvivors(ally).troops),
    target: target ? { name: foeName(target.foe), monsters: monstersText(foeSurvivors(target)) } : null,
    flank,
    attackers,
    encircled: encircled(battle, ally.ref),
    // D'autres adversaires dans la mêlée : on peut s'y tourner.
    others: battle.foes.length > 1,
  }
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
    <p v-if="army.key" class="hint">
      <span aria-hidden="true">🗝️</span> Ton armée porte la clef du campement : mène-la au seuil de la porte, à l’est du
      cirque, pour l’ouvrir. Si elle tombe ou rentre à la cité, la clef retourne à son gardien.
    </p>
    <p v-if="hunters.length" class="warning" role="status">
      Poursuivie par : {{ hunters.join(', ') }}.
      {{
        hunters.length > 1
          ? 'Plus rapides que ton armée, ces bandes ne renonceront qu’en s’éloignant trop de leur repaire.'
          : 'Plus rapide que ton armée, cette bande ne renoncera qu’en s’éloignant trop de son repaire.'
      }}
    </p>
    <p v-if="eta !== null">Arrivée dans {{ formatDuration(eta) }}.</p>
    <div v-if="fight" class="fight">
      <p>
        <strong>Manche {{ fight.round + 1 }}</strong> : une manche toutes les quelques secondes, jusqu’à ce qu’un camp
        tombe.
      </p>
      <p>Tes troupes : {{ fight.troops || 'aucune' }}</p>
      <p v-if="fight.target">
        Elle frappe {{ fight.target.name }}, {{ FLANK_TEXTS[fight.flank] }}<template v-if="fight.flank === 'side'">
          (+{{ sidePercent }} % d’attaque)</template
        ><template v-else-if="fight.flank === 'rear'"> (+{{ rearPercent }} % d’attaque)</template> :
        {{ fight.target.monsters || 'plus personne' }}
      </p>
      <p v-else class="muted">Elle attend une place : huit troupes entourent déjà chaque adversaire.</p>
      <p v-if="fight.attackers.length">
        La frappent :
        <template v-for="(attacker, i) in fight.attackers" :key="attacker.key"
          >{{ i > 0 ? ', ' : '' }}{{ attacker.name }} ({{ attacker.from }})</template
        >.
      </p>
      <p v-if="fight.encircled" class="warning" role="status">
        Encerclée : frappée d’au moins trois côtés, elle perd {{ malusPercent }} % de son attaque.
      </p>
      <p v-if="fight.others" class="hint">
        Touche un autre adversaire de la mêlée : ton armée se tourne vers lui, sans quitter le combat.
      </p>
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

.warning {
  font-size: 0.9rem;
  color: var(--ember);
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
