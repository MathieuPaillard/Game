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
  armySize,
  bandLoot,
  bandMonsters,
  bandsNearPath,
  carryCapacity,
  checkDragon,
  checkMarch,
  checkMarchSlot,
  dragonLevel,
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
  raidArrival,
  raidLoot,
  raidMonsters,
  siegeOf,
  targetPosition,
  timeUntilFamine,
  type GameState,
  type Monsters,
  type Target,
} from '../game/rules'
import CountPicker from './CountPicker.vue'
import { formatAmount, formatDuration } from './format'
import { STATUS_ICONS, armyStatusText, bandName } from './world'

// La fiche d'une cible : un camp, une bande de monstres (ou un raid en marche vers la cité) ou un
// gisement. On y compose une nouvelle armée, qui part aussitôt de la cité, ou on y envoie d'un geste
// une armée déjà dehors.
const props = defineProps<{ target: Target; state: GameState; now: number }>()
const emit = defineEmits<{ march: [troops: Army, hero: HeroId | null, dragon: boolean]; order: [army: number] }>()

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
    const full = band.raid ? raidMonsters(band.kind, band.level) : bandMonsters(band.kind, band.level)
    return {
      key: `band-${band.id}`,
      kind: 'band' as const,
      name: band.raid ? `Raid : ${getBandKind(band.kind).name}` : getBandKind(band.kind).name,
      level: band.level,
      monsters: band.monsters,
      loot: band.raid ? raidLoot(band.kind, band.level) : bandLoot(band.kind, band.level),
      weakened: total(band.monsters) < total(full),
      raid: band.raid,
      arrival: raidArrival(band),
      besieging: siegeOf(props.state)?.band === band.id,
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
const gathering = computed(() => info.value?.kind === 'node')

// --- La nouvelle armée : toutes les troupes de la cité, et un héros libre à leur tête ---

/** Un héros fait pour récolter : ses compétences aident à la récolte. */
function gathers(id: HeroId): boolean {
  return getHeroDef(id).skills.some((skill) => skill.effect.kind === 'gatherSpeed' || skill.effect.kind === 'load')
}

const freeHeroes = computed(() =>
  props.state.heroes
    .filter((recruited) => !heroArmy(props.state, recruited.id))
    .map((recruited) => ({ id: recruited.id, level: recruited.level, def: getHeroDef(recruited.id) })),
)
const selection = reactive<Army>({ ...props.state.troops })
// Par défaut : un récolteur pour un gisement, un combattant sinon.
const hero = ref<HeroId | null>(
  (freeHeroes.value.find((h) => gathers(h.id) === gathering.value) ?? freeHeroes.value[0])?.id ?? null,
)

// Le dragon, s'il est né : il part par défaut pour un combat, s'il est dans son aire et en forme.
const dragon = computed(() => {
  if (props.state.dragon?.stage !== 'grown') return null
  const check = checkDragon(props.state)
  return { level: dragonLevel(props.state), ok: check.ok, reason: check.ok ? null : check.reason }
})
const withDragon = ref(!gathering.value && checkDragon(props.state).ok)
const takeDragon = computed(() => withDragon.value && dragon.value?.ok === true)

const position = computed(() => targetPosition(props.state, props.target))
const march = computed(() => (position.value ? marchDuration(props.state, WORLD.city, position.value, hero.value) : 0))
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
// Les bandes (et les raids) près du chemin depuis la cité.
const dangers = computed(() =>
  position.value ? bandsNearPath(props.state, WORLD.city, position.value, props.target).map(bandName) : [],
)

const available = computed(() => UNIT_IDS.filter((id) => props.state.troops[id] > 0))
const blocked = computed(() => {
  const slot = checkMarchSlot(props.state, props.target)
  if (!slot.ok) return slot.reason
  if (available.value.length === 0) return 'Aucune troupe dans la cité : entraîne-en à la Caserne.'
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
  return !gathering.value && famineIn !== null && famineIn < march.value
})
const malusPercent = Math.round(STARVATION_ATTACK_MALUS * 100)
const check = computed(() => checkMarch(props.state, props.target, { ...selection }, hero.value, takeDragon.value))

function send() {
  if (check.value.ok) emit('march', { ...selection }, hero.value, takeDragon.value)
}

// --- Les armées déjà dehors : un geste suffit pour les envoyer ici ---

const fieldArmies = computed(() =>
  props.state.armies
    .filter((army) => army.status !== 'fighting')
    .map((army) => ({
      id: army.id,
      icon: STATUS_ICONS[army.status],
      hero: army.hero === null ? null : getHeroDef(army.hero).icon,
      size: armySize(army.troops),
      status: armyStatusText(props.state, army),
    })),
)
</script>

<template>
  <article v-if="info" class="plaque">
    <header class="plaque-head">
      <span class="plaque-icon" aria-hidden="true">
        {{ info.kind === 'node' ? NODE_KINDS[info.resource].icon : foes[0]?.monster.icon }}
      </span>
      <div>
        <h2 class="plaque-name">{{ info.name }}</h2>
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
      <template v-if="info.kind === 'band' && info.raid">
        <p v-if="info.besieging" class="warning" role="status">
          Ce raid assiège ta cité : tes troupes et les gardes des Remparts se battent aux portes.
        </p>
        <p v-else-if="info.arrival !== null" class="warning" role="status">
          Ce raid marche sur ta cité : il l’atteindra dans <strong>{{ formatDuration(info.arrival - now) }}</strong>.
        </p>
        <p v-else class="warning" role="status">Ce raid se bat en chemin contre une de tes armées.</p>
        <p class="muted">
          Arrête-le en chemin avec une armée, ou laisse tes troupes et les gardes des Remparts le repousser aux
          portes. En chemin, il attaque toute armée qui entre dans sa zone d’aggro.<template v-if="info.weakened">
            Une bataille l’a affaibli : il n’est plus au complet.</template
          >
        </p>
      </template>
      <p v-else-if="info.kind === 'band'" class="muted">
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
      Attention : des monstres rôdent sur le chemin depuis la cité ({{ dangers.join(', ') }}). Ils attaqueront
      ton armée si elle entre dans leur zone d’aggro.
    </p>

    <section v-if="fieldArmies.length" class="field-armies" aria-labelledby="field-title">
      <h3 id="field-title" class="sub-title">Envoyer une armée déjà dehors</h3>
      <ul class="chips">
        <li v-for="army in fieldArmies" :key="army.id">
          <button type="button" class="chip" @click="emit('order', army.id)">
            <span aria-hidden="true">{{ army.icon }}</span>
            <span v-if="army.hero" aria-hidden="true">{{ army.hero }}</span>
            {{ army.size }}
            <span class="chip-tag">{{ army.status }}</span>
          </button>
        </li>
      </ul>
    </section>

    <form v-if="!blocked" class="send" @submit.prevent="send">
      <h3 class="sub-title">Nouvelle armée, depuis la cité</h3>
      <fieldset v-if="freeHeroes.length" class="hero-pick">
        <legend>Héros à sa tête</legend>
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

      <div v-if="dragon" class="dragon-pick">
        <button
          type="button"
          class="chip"
          :aria-pressed="takeDragon"
          :disabled="!dragon.ok"
          @click="withDragon = !withDragon"
        >
          <span aria-hidden="true">🐉</span>
          Emmener le dragon
          <span class="chip-tag">niv. {{ dragon.level }}</span>
        </button>
        <p v-if="dragon.reason" class="muted">{{ dragon.reason }}.</p>
      </div>

      <div v-for="id in available" :key="id" class="pick">
        <label :for="`send-${info.key}-${id}`">
          {{ getUnit(id).icon }} {{ getUnit(id).name }} <span class="muted">(max {{ state.troops[id] }})</span>
        </label>
        <CountPicker
          :id="`send-${info.key}-${id}`"
          v-model="selection[id]"
          :max="state.troops[id]"
          :label="`${getUnit(id).name} à envoyer`"
        />
      </div>

      <p v-if="harvest && harvest.amount > 0 && info.kind === 'node'" class="muted">
        Ton armée rapportera {{ formatAmount(harvest.amount) }} {{ RESOURCES[info.resource].icon }}, après environ
        {{ formatDuration(harvest.seconds * 1000) }} de récolte.
      </p>
      <p v-if="hungryOnArrival" class="warning">
        Tes réserves de nourriture seront vides à l’arrivée : tes troupes affamées perdront {{ malusPercent }} % de
        leur attaque.
      </p>
      <p v-if="!check.ok" class="reason">{{ check.reason }}</p>
      <button class="btn" type="submit" :disabled="!check.ok">
        {{ info.kind === 'node' ? 'Récolter' : info.kind === 'band' && info.raid ? 'Intercepter' : 'Attaquer' }}
      </button>
    </form>
    <p v-else class="reason">{{ blocked }}</p>
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

.sub-title {
  font: 700 1rem/1.2 var(--font-body);
}

.field-armies,
.send {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--seam);
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
  color: var(--faded);
}

.pick {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.dragon-pick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
</style>
