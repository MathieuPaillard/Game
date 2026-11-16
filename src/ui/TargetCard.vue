<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  NODE_KINDS,
  RESOURCES,
  RESOURCE_IDS,
  STARVATION_ATTACK_MALUS,
  UNIT_IDS,
  WORLD,
  type Army,
  type HeroId,
  type MonsterId,
  type Resources,
} from '../game/config'
import {
  bandLoot,
  bandMonsters,
  bandsNearPath,
  carryCapacity,
  checkMarch,
  checkMarchSlot,
  emptyArmy,
  gatherRate,
  getBand,
  getBandKind,
  getCamp,
  getHeroDef,
  getMonster,
  getNode,
  getUnit,
  heroArmy,
  marchDuration,
  targetPosition,
  timeUntilFamine,
  type GameState,
  type Monsters,
  type Target,
} from '../game/rules'
import { formatAmount, formatDuration } from './format'

// La fiche d'une cible : un camp, une bande de monstres ou un gisement. On y prépare le départ
// d'une armée de la cité : pour attaquer, ou pour récolter, avec un héros à sa tête si on veut.
const props = defineProps<{ target: Target; state: GameState }>()
const emit = defineEmits<{ march: [troops: Army, hero: HeroId | null] }>()

function total(monsters: Monsters): number {
  return Object.values(monsters).reduce((sum, count) => sum + (count ?? 0), 0)
}

/** Ce qu'il faut savoir de la cible (null si elle n'est plus là). */
const info = computed(() => {
  const target = props.target
  if (target.type === 'camp') {
    const camp = getCamp(target.camp)
    return {
      key: camp.id,
      kind: 'camp' as const,
      name: camp.name,
      level: camp.level,
      monsters: camp.defenders,
      loot: camp.loot,
    }
  }
  if (target.type === 'band') {
    const band = getBand(props.state, target.band)
    if (!band) return null
    return {
      key: `band-${band.id}`,
      kind: 'band' as const,
      name: getBandKind(band.kind).name,
      level: band.level,
      monsters: band.monsters,
      loot: bandLoot(band.kind, band.level),
      weakened: total(band.monsters) < total(bandMonsters(band.kind, band.level)),
    }
  }
  if (target.type === 'node') {
    const node = getNode(props.state, target.node)
    if (!node) return null
    return {
      key: `node-${node.id}`,
      kind: 'node' as const,
      name: NODE_KINDS[node.resource].name,
      level: node.level,
      monsters: {} as Monsters,
      loot: {} as Partial<Resources>,
      resource: node.resource,
      remaining: node.remaining,
    }
  }
  return null
})

const open = ref(false)
const selection = reactive<Army>(emptyArmy())
// Le héros qui mènera l'armée (null : aucun), parmi ceux qui attendent à la cité.
const hero = ref<HeroId | null>(null)
const freeHeroes = computed(() =>
  props.state.heroes
    .filter((recruited) => !heroArmy(props.state, recruited.id))
    .map((recruited) => ({ id: recruited.id, level: recruited.level, def: getHeroDef(recruited.id) })),
)
const chosenHero = computed(() => (open.value ? hero.value : null))

const position = computed(() => targetPosition(props.state, props.target))
const march = computed(() =>
  position.value ? marchDuration(props.state, WORLD.city, position.value, chosenHero.value) : 0,
)
const foes = computed(() =>
  (Object.entries(info.value?.monsters ?? {}) as [MonsterId, number][])
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ monster: getMonster(id), count })),
)
const loot = computed(() =>
  RESOURCE_IDS.filter((id) => info.value?.loot[id]).map((id) => ({
    id,
    amount: info.value?.loot[id] ?? 0,
  })),
)
// Les bandes qui patrouillent près du chemin depuis la cité.
const dangers = computed(() =>
  position.value
    ? bandsNearPath(props.state, WORLD.city, position.value, props.target).map(
        (band) => `${getBandKind(band.kind).name} (niv. ${band.level})`,
      )
    : [],
)

const available = computed(() => UNIT_IDS.filter((id) => props.state.troops[id] > 0))
const blocked = computed(() => {
  const slot = checkMarchSlot(props.state, props.target)
  if (!slot.ok) return slot.reason
  if (available.value.length === 0) return 'Aucune troupe dans la cité'
  return null
})
// Pour une récolte : ce que l'armée choisie pourra porter, et en combien de temps elle le ramassera.
const harvest = computed(() => {
  const node = info.value
  if (node?.kind !== 'node') return null
  const troops = { ...selection }
  const amount = Math.min(carryCapacity(props.state, troops, hero.value), node.remaining)
  const rate = gatherRate(props.state, troops, node.resource, hero.value)
  return { amount, seconds: rate > 0 ? amount / rate : 0 }
})
// Les réserves de nourriture seront-elles vides quand l'armée arrivera ?
const hungryOnArrival = computed(() => {
  const famineIn = timeUntilFamine(props.state)
  return info.value?.kind !== 'node' && famineIn !== null && famineIn < march.value
})
const malusPercent = Math.round(STARVATION_ATTACK_MALUS * 100)
const check = computed(() => checkMarch(props.state, props.target, { ...selection }, hero.value))
const reason = computed(() => (check.value.ok ? null : check.value.reason))

/** Un héros fait pour récolter : ses compétences aident à la récolte. */
function gathers(id: HeroId): boolean {
  return getHeroDef(id).skills.some((skill) => skill.effect.kind === 'gatherSpeed' || skill.effect.kind === 'load')
}

/**
 * Ouvre le formulaire, avec toutes les troupes de la cité sélectionnées, et un héros libre à leur
 * tête : un récolteur pour un gisement, un combattant sinon.
 */
function prepare() {
  for (const id of UNIT_IDS) selection[id] = props.state.troops[id]
  const free = freeHeroes.value
  const forNode = info.value?.kind === 'node'
  hero.value = (free.find((h) => gathers(h.id) === forNode) ?? free[0])?.id ?? null
  open.value = true
}

function send() {
  if (!check.value.ok) return
  emit('march', { ...selection }, hero.value)
  open.value = false
}
</script>

<template>
  <article v-if="info" class="plaque">
    <header class="plaque-head">
      <span class="plaque-icon" aria-hidden="true">
        {{ info.kind === 'node' ? NODE_KINDS[info.resource].icon : foes[0]?.monster.icon }}
      </span>
      <div>
        <h3 class="plaque-name">{{ info.name }}</h3>
        <p class="plaque-level">Niveau {{ info.level }} · {{ formatDuration(march) }} de marche</p>
      </div>
    </header>

    <template v-if="info.kind === 'node'">
      <p>
        Un gisement de {{ RESOURCES[info.resource].name.toLowerCase() }} : il en reste
        <strong>{{ formatAmount(info.remaining) }}</strong> {{ RESOURCES[info.resource].icon }}.
      </p>
      <p class="muted">
        Chaque troupe en ramasse {{ formatAmount(NODE_KINDS[info.resource].gatherRate * 60) }} par minute. Quand
        l’armée ne peut plus rien porter, ou que le gisement est vide, elle rentre d’elle-même à la cité.
      </p>
    </template>
    <template v-else>
      <p v-if="info.kind === 'band'" class="muted">
        Une bande de monstres : elle patrouille autour de son repaire et attaque toute armée qui entre dans sa zone
        d’aggro, le cercle rouge sur la carte.<template v-if="info.weakened">
          Une bataille l’a affaiblie : elle n’est plus au complet.</template
        >
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
    </template>

    <p v-if="dangers.length" class="warning">
      Attention : sur le chemin, des bandes patrouillent ({{ dangers.join(', ') }}). Elles attaqueront ton armée si
      elle entre dans leur zone d’aggro.
    </p>

    <div class="plaque-foot">
      <form v-if="open" class="send" @submit.prevent="send">
        <fieldset v-if="freeHeroes.length" class="hero-pick">
          <legend>Héros à la tête de l’armée</legend>
          <ul class="chips">
            <li>
              <button type="button" class="chip" :aria-pressed="hero === null" @click="hero = null">Aucun</button>
            </li>
            <li v-for="h in freeHeroes" :key="h.id">
              <button type="button" class="chip" :aria-pressed="hero === h.id" @click="hero = h.id">
                <span aria-hidden="true">{{ h.def.icon }}</span>
                {{ h.def.name }}
                <span class="chip-tag">niv. {{ h.level }}</span>
              </button>
            </li>
          </ul>
        </fieldset>
        <p v-else-if="state.heroes.length" class="muted">Tes héros mènent déjà d’autres armées.</p>
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
        <p v-if="harvest && harvest.amount > 0" class="muted">
          Ton armée rapportera {{ formatAmount(harvest.amount) }}
          {{ RESOURCES[info.kind === 'node' ? info.resource : 'food'].icon }}, après environ
          {{ formatDuration(harvest.seconds * 1000) }} de récolte.
        </p>
        <p v-if="hungryOnArrival" class="warning">
          Tes réserves de nourriture seront vides à l’arrivée : tes troupes affamées perdront {{ malusPercent }} %
          de leur attaque.
        </p>
        <p v-if="reason" class="reason">{{ reason }}</p>
        <div class="send-actions">
          <button class="btn" type="submit" :disabled="!check.ok">
            {{ info.kind === 'node' ? 'Envoyer récolter' : 'Envoyer l’armée' }}
          </button>
          <button class="btn-quiet" type="button" @click="open = false">Annuler</button>
        </div>
      </form>

      <template v-else>
        <p v-if="blocked" class="reason">{{ blocked }}</p>
        <button class="btn" type="button" :disabled="blocked !== null" @click="prepare">
          {{ info.kind === 'node' ? 'Préparer la récolte' : 'Préparer l’attaque' }}
        </button>
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

.warning {
  font-size: 0.9rem;
  color: var(--ember);
}

.send {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hero-pick {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.hero-pick legend {
  margin-bottom: 0.4rem;
  padding: 0;
  font-weight: 700;
}

.send-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
</style>
