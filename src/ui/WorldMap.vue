<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CAMPS, NODE_KINDS, WORLD } from '../game/config'
import {
  aggroRadius,
  armySize,
  bandPosition,
  bandsNearPath,
  getArmy,
  getBand,
  getBandKind,
  nodeGatherer,
  patrolLoop,
  sameTarget,
  targetPosition,
  type GameState,
  type Target,
} from '../game/rules'
import MapViewport from './MapViewport.vue'
import { formatShort } from './format'
import { WORLD_DECOR, WORLD_MAP, mountainLight, mountainPoints } from './maps'
import { STATUS_ICONS, monstersIcon, type Selection } from './world'

// Les alentours de la cité : les camps, les gisements, les bandes qui patrouillent (avec leur zone
// d'aggro), tes armées et leurs batailles. Toucher un repère le choisit ; toucher le fond de la carte
// donne un endroit, où envoyer l'armée choisie.
const props = defineProps<{
  state: GameState
  now: number
  selection: Selection
  /** Le prochain ordre envisagé pour l'armée choisie, s'il y en a un. */
  plan: Target | null
  cityName: string
}>()
const emit = defineEmits<{ select: [selection: Selection]; tap: [point: { x: number; y: number }] }>()

const city = WORLD.city
const viewport = ref<InstanceType<typeof MapViewport> | null>(null)

// Quand on choisit une armée ou une cible (sur la carte ou dans les listes), la carte se centre dessus.
watch(
  () => props.selection,
  (selection) => {
    const point =
      selection.kind === 'army'
        ? getArmy(props.state, selection.id)?.position
        : targetPosition(props.state, selection.target, props.now)
    if (point) viewport.value?.centerOn(point)
  },
)

/** Avec une armée choisie, toucher la cité prépare son retour ; sinon, c'est un simple toucher sur la carte. */
const armyChosen = computed(() => props.selection.kind === 'army')
const cityPlanned = computed(() => props.plan?.type === 'city')

function goHome() {
  if (armyChosen.value) emit('select', { kind: 'target', target: { type: 'city' } })
}

function onCityClick(e: MouseEvent) {
  if (!armyChosen.value) return
  e.stopPropagation()
  goHome()
}

const isSelectedTarget = (target: Target) =>
  props.selection.kind === 'target' && sameTarget(props.selection.target, target)

/** D'où part le chemin dessiné : de l'armée choisie, ou de la cité. */
const pathStart = computed(() => {
  const selection = props.selection
  if (selection.kind === 'army') return getArmy(props.state, selection.id)?.position ?? city
  return city
})

/** Où mène le chemin dessiné : vers l'ordre envisagé pour l'armée, ou vers la cible choisie. */
const pathTarget = computed<Target | null>(() =>
  props.selection.kind === 'army' ? props.plan : props.selection.target,
)

const path = computed(() => {
  const target = pathTarget.value
  const to = target && targetPosition(props.state, target, props.now)
  return to ? { x1: pathStart.value.x, y1: pathStart.value.y, x2: to.x, y2: to.y } : null
})

// Les bandes qui patrouillent près de ce chemin : l'armée risque d'y être attaquée.
const dangers = computed(() => {
  const target = pathTarget.value
  const to = target && targetPosition(props.state, target, props.now)
  if (!target || !to) return new Set<number>()
  return new Set(bandsNearPath(props.state, pathStart.value, to, target).map((band) => band.id))
})

const camps = computed(() =>
  CAMPS.map((camp) => {
    const target: Target = { type: 'camp', camp: camp.id }
    return {
      key: camp.id,
      target,
      ...camp.position,
      name: camp.name,
      level: camp.level,
      icon: monstersIcon(camp.defenders),
      selected: isSelectedTarget(target),
    }
  }),
)

const nodes = computed(() =>
  props.state.nodes.map((node) => {
    const target: Target = { type: 'node', node: node.id }
    return {
      key: `node-${node.id}`,
      target,
      ...node.position,
      name: NODE_KINDS[node.resource].name,
      icon: NODE_KINDS[node.resource].icon,
      level: node.level,
      remaining: formatShort(node.remaining),
      busy: nodeGatherer(props.state, node.id)?.status === 'gathering',
      selected: isSelectedTarget(target) || (props.plan !== null && sameTarget(props.plan, target)),
    }
  }),
)

const bands = computed(() =>
  props.state.bands.map((band) => {
    const target: Target = { type: 'band', band: band.id }
    return {
      key: `band-${band.id}`,
      target,
      ...bandPosition(band, props.now),
      loop: patrolLoop(band.home)
        .map((p) => `${p.x},${p.y}`)
        .join(' '),
      radius: aggroRadius(band.level),
      name: getBandKind(band.kind).name,
      level: band.level,
      icon: monstersIcon(band.monsters),
      fighting: band.since === null,
      danger: dangers.value.has(band.id),
      selected: isSelectedTarget(target) || (props.plan !== null && sameTarget(props.plan, target)),
    }
  }),
)

const armies = computed(() =>
  props.state.armies.map((army) => ({
    key: army.id,
    ...army.position,
    icon: STATUS_ICONS[army.status],
    size: armySize(army.troops),
    selected: props.selection.kind === 'army' && props.selection.id === army.id,
  })),
)

// Les batailles en cours : une ligne entre l'armée et la bande, et le numéro de la manche.
const battles = computed(() =>
  props.state.battles.flatMap((battle) => {
    const army = getArmy(props.state, battle.army)
    if (!army) return []
    const band = battle.band === null ? undefined : getBand(props.state, battle.band)
    const foe = band ? bandPosition(band, props.now) : army.position
    return [
      {
        key: battle.id,
        from: army.position,
        to: foe,
        x: (army.position.x + foe.x) / 2,
        y: (army.position.y + foe.y) / 2,
        round: battle.rounds.length,
      },
    ]
  }),
)

// L'endroit choisi pour l'armée, quand on a touché le fond de la carte.
const pointPlan = computed(() => (props.plan?.type === 'point' ? props.plan : null))
</script>

<template>
  <MapViewport
    ref="viewport"
    :width="WORLD_MAP.width"
    :height="WORLD_MAP.height"
    :center="WORLD_MAP.center"
    :span="1100"
    label="Carte des alentours"
    @tap="emit('tap', $event)"
  >
    <!-- Le décor -->
    <rect :width="WORLD_MAP.width" :height="WORLD_MAP.height" class="ground" />
    <ellipse :cx="city.x" :cy="city.y" rx="260" ry="190" class="meadow" />
    <path :d="WORLD_DECOR.river" class="river" />
    <path :d="WORLD_DECOR.river" class="river-light" />
    <ellipse v-bind="WORLD_DECOR.lake" class="water" />
    <ellipse v-for="(marsh, i) in WORLD_DECOR.marshes" :key="`marsh-${i}`" v-bind="marsh" class="marsh" />
    <line
      v-for="camp in CAMPS"
      :key="`road-${camp.id}`"
      :x1="city.x"
      :y1="city.y"
      :x2="camp.position.x"
      :y2="camp.position.y"
      class="trail"
    />
    <!-- Les rondes des bandes -->
    <polygon v-for="band in bands" :key="`loop-${band.key}`" :points="band.loop" class="patrol" />
    <g v-for="(mountain, i) in WORLD_DECOR.mountains" :key="`mountain-${i}`">
      <polygon :points="mountainPoints(mountain)" class="rock" />
      <polygon :points="mountainLight(mountain)" class="rock-light" />
    </g>
    <text
      v-for="(tree, i) in WORLD_DECOR.trees"
      :key="`tree-${i}`"
      :x="tree.x"
      :y="tree.y"
      :font-size="44 * tree.size"
      class="emoji"
      aria-hidden="true"
    >
      🌲
    </text>

    <!-- Le chemin vers la cible choisie, ou vers le prochain ordre de l'armée choisie -->
    <line v-if="path" v-bind="path" class="route" />
    <g v-if="pointPlan" :transform="`translate(${pointPlan.x} ${pointPlan.y})`" aria-hidden="true">
      <circle r="14" class="plan-mark" />
      <circle r="4" class="plan-dot" />
    </g>

    <!-- La cité : avec une armée choisie, la toucher prépare son retour -->
    <g
      :class="{ spot: armyChosen, selected: cityPlanned }"
      :transform="`translate(${city.x} ${city.y})`"
      :role="armyChosen ? 'button' : undefined"
      :tabindex="armyChosen ? 0 : undefined"
      :aria-label="armyChosen ? `${cityName} : y faire rentrer ton armée` : undefined"
      :aria-hidden="armyChosen ? undefined : 'true'"
      @click="onCityClick"
      @keydown.enter.prevent="goHome"
      @keydown.space.prevent="goHome"
    >
      <ellipse class="spot-base" rx="84" ry="32" cy="46" />
      <ellipse v-if="armyChosen" class="spot-ring" rx="96" ry="40" cy="46" />
      <text class="emoji" font-size="104">🏰</text>
      <text class="map-label" y="100">{{ cityName }}</text>
    </g>

    <!-- Les gisements -->
    <g
      v-for="node in nodes"
      :key="node.key"
      class="spot node"
      :class="{ selected: node.selected }"
      :transform="`translate(${node.x} ${node.y})`"
      role="button"
      tabindex="0"
      :aria-label="`${node.name}, niveau ${node.level}, ${node.remaining} à récolter`"
      :aria-pressed="node.selected"
      @click.stop="emit('select', { kind: 'target', target: node.target })"
      @keydown.enter.prevent="emit('select', { kind: 'target', target: node.target })"
      @keydown.space.prevent="emit('select', { kind: 'target', target: node.target })"
    >
      <ellipse class="spot-base node-base" rx="38" ry="15" cy="22" />
      <ellipse class="spot-ring" rx="48" ry="21" cy="22" />
      <text class="emoji" font-size="44">{{ node.icon }}</text>
      <g transform="translate(28 -24)">
        <circle r="14" class="badge" />
        <text class="badge-text">{{ node.level }}</text>
      </g>
      <text v-if="node.busy" class="emoji" font-size="24" x="-30" y="-24">⛏️</text>
      <text class="map-label" y="52">{{ node.name }}</text>
      <text class="map-sublabel" y="74">{{ node.remaining }}</text>
    </g>

    <!-- Les camps -->
    <g
      v-for="camp in camps"
      :key="camp.key"
      class="spot"
      :class="{ selected: camp.selected }"
      :transform="`translate(${camp.x} ${camp.y})`"
      role="button"
      tabindex="0"
      :aria-label="`${camp.name}, camp de niveau ${camp.level}`"
      :aria-pressed="camp.selected"
      @click.stop="emit('select', { kind: 'target', target: camp.target })"
      @keydown.enter.prevent="emit('select', { kind: 'target', target: camp.target })"
      @keydown.space.prevent="emit('select', { kind: 'target', target: camp.target })"
    >
      <ellipse class="spot-base camp-base" rx="66" ry="26" cy="32" />
      <ellipse class="spot-ring" rx="78" ry="33" cy="32" />
      <text class="emoji" font-size="70">{{ camp.icon }}</text>
      <text class="map-label" y="74">{{ camp.name }}</text>
      <text class="map-sublabel" y="98">Niveau {{ camp.level }}</text>
    </g>

    <!-- Les bandes, en patrouille, avec leur zone d'aggro -->
    <g
      v-for="band in bands"
      :key="band.key"
      class="mover spot band"
      :class="{ selected: band.selected }"
      :style="{ transform: `translate(${band.x}px, ${band.y}px)` }"
      role="button"
      tabindex="0"
      :aria-label="`${band.name}, bande de niveau ${band.level}${band.fighting ? ', au combat' : ', en patrouille'}`"
      :aria-pressed="band.selected"
      @click.stop="emit('select', { kind: 'target', target: band.target })"
      @keydown.enter.prevent="emit('select', { kind: 'target', target: band.target })"
      @keydown.space.prevent="emit('select', { kind: 'target', target: band.target })"
    >
      <circle :r="band.radius" class="aggro" :class="{ danger: band.danger }" />
      <ellipse class="spot-base band-base" rx="34" ry="13" cy="20" />
      <ellipse class="spot-ring" rx="44" ry="19" cy="20" />
      <text class="emoji" font-size="44">{{ band.icon }}</text>
      <g transform="translate(26 -22)">
        <circle r="14" class="badge level" />
        <text class="badge-text">{{ band.level }}</text>
      </g>
      <text class="map-label" y="50">{{ band.name }}</text>
    </g>

    <!-- Tes armées -->
    <g
      v-for="army in armies"
      :key="army.key"
      class="mover spot army"
      :class="{ selected: army.selected }"
      :style="{ transform: `translate(${army.x}px, ${army.y}px)` }"
      role="button"
      tabindex="0"
      :aria-label="`Ton armée de ${army.size} troupes`"
      :aria-pressed="army.selected"
      @click.stop="emit('select', { kind: 'army', id: army.key })"
      @keydown.enter.prevent="emit('select', { kind: 'army', id: army.key })"
      @keydown.space.prevent="emit('select', { kind: 'army', id: army.key })"
    >
      <circle r="34" class="spot-ring army-ring" />
      <circle r="26" class="army-dot" />
      <text class="emoji" font-size="28">{{ army.icon }}</text>
      <text class="map-label" y="-44">{{ army.size }}</text>
    </g>

    <!-- Les batailles en cours -->
    <g v-for="battle in battles" :key="`battle-${battle.key}`" aria-hidden="true">
      <line :x1="battle.from.x" :y1="battle.from.y" :x2="battle.to.x" :y2="battle.to.y" class="clash" />
      <g :transform="`translate(${battle.x} ${battle.y})`">
        <circle r="24" class="clash-mark" />
        <text class="emoji" font-size="26">⚔️</text>
        <text class="map-label" y="40">Manche {{ battle.round + 1 }}</text>
      </g>
    </g>
  </MapViewport>
</template>

<style scoped>
.water {
  fill: var(--map-water);
}

.marsh {
  fill: var(--map-marsh);
}

.trail {
  stroke: var(--map-road);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 18 14;
  opacity: 0.8;
}

.camp-base {
  fill: var(--map-camp);
}

.band-base,
.node-base {
  fill: var(--map-camp);
  opacity: 0.85;
}

/* La ronde d'une bande, en pointillés discrets. */
.patrol {
  fill: none;
  stroke: var(--ember);
  stroke-width: 2;
  stroke-dasharray: 4 10;
  opacity: 0.45;
}

/* La zone d'aggro : un cercle rouge, plus marqué si le chemin choisi passe tout près. */
.aggro {
  fill: var(--map-aggro);
  stroke: var(--ember);
  stroke-width: 3;
  stroke-dasharray: 12 9;
  opacity: 0.8;
}

.aggro.danger {
  stroke-width: 6;
  opacity: 1;
}

.route {
  stroke: var(--gilt);
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 2 14;
  opacity: 0.9;
}

.plan-mark {
  fill: none;
  stroke: var(--gilt);
  stroke-width: 4;
}

.plan-dot {
  fill: var(--gilt);
}

.badge.level {
  fill: var(--map-aggro-badge);
  stroke: var(--ember);
}

/* Les bandes et les armées glissent d'une seconde à l'autre. */
.mover {
  transition: transform 1s linear;
}

.army-dot {
  fill: var(--gilt);
  stroke: var(--gilt-deep);
  stroke-width: 3;
}

.army-ring {
  stroke-width: 6;
}

.clash {
  stroke: var(--ember);
  stroke-width: 4;
  stroke-dasharray: 8 6;
}

.clash-mark {
  fill: var(--stone);
  stroke: var(--ember);
  stroke-width: 3;
}
</style>
