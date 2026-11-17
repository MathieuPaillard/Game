<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { CAMPS, NODE_KINDS, WORLD } from '../game/config'
import {
  aggroRadius,
  armySize,
  bandPosition,
  bandsNearPath,
  getArmy,
  getBand,
  getBandKind,
  getHeroDef,
  nodeGatherer,
  patrolLoop,
  sameTarget,
  targetPosition,
  type GameState,
  type Target,
} from '../game/rules'
import MapViewport from './MapViewport.vue'
import { formatShort } from './format'
import { WORLD_DECOR, WORLD_MAP, mountainLight, mountainPoints, type Point } from './maps'
import { STATUS_ICONS, monstersIcon, type Selection } from './world'

// Les alentours de la cité : les camps, les gisements, les bandes qui patrouillent (avec leur zone
// d'aggro), tes armées et leurs batailles. Toucher un repère le choisit ; toucher le fond de la carte
// donne un endroit. On peut aussi tirer une armée du doigt jusqu'à un endroit ou une cible : en
// relâchant, elle reçoit cet ordre.
const props = defineProps<{ state: GameState; now: number; selection: Selection | null; cityName: string }>()
const emit = defineEmits<{
  select: [selection: Selection]
  tap: [point: Point]
  /** Une armée tirée du doigt jusqu'à une cible ou un endroit. */
  command: [army: number, target: Target]
}>()

const city = WORLD.city
const CITY_TARGET: Target = { type: 'city' }
const viewport = ref<InstanceType<typeof MapViewport> | null>(null)

// Ce qu'on vient de choisir vient au milieu de la carte (une fois le panneau ouvert à côté).
watch(
  () => props.selection,
  (selection) => {
    if (!selection) return
    const point =
      selection.kind === 'army'
        ? getArmy(props.state, selection.id)?.position
        : targetPosition(props.state, selection.target, props.now)
    if (point) viewport.value?.centerOn(point)
  },
  { flush: 'post' },
)

const selectedArmy = computed(() =>
  props.selection?.kind === 'army' ? getArmy(props.state, props.selection.id) : undefined,
)
const isSelectedTarget = (target: Target) =>
  props.selection?.kind === 'target' && sameTarget(props.selection.target, target)
/** La cible que vise l'armée choisie : elle ressort sur la carte. */
function isOrdered(target: Target): boolean {
  const order = selectedArmy.value?.order
  return order !== null && order !== undefined && sameTarget(order, target)
}

// --- Tirer une armée du doigt (ou à la souris) jusqu'à sa destination ---

/** L'armée qu'on est en train de tirer, et l'endroit de la carte sous le doigt. */
const aim = ref<{ id: number; to: Point } | null>(null)
let drag: { id: number; x: number; y: number; moved: boolean } | null = null
// Juste après avoir relâché une armée, le « clic » qui suit ne compte pas comme un toucher.
let justDragged = false

function onArmyPointerDown(id: number, e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  // La carte ne doit pas glisser : c'est l'armée qu'on tire.
  e.stopPropagation()
  drag = { id, x: e.clientX, y: e.clientY, moved: false }
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', stopDrag)
}

function onDragMove(e: PointerEvent) {
  if (!drag || !viewport.value) return
  // En dessous de quelques pixels, c'est un simple toucher.
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 10) return
  drag.moved = true
  aim.value = { id: drag.id, to: viewport.value.toWorld(e.clientX, e.clientY) }
}

function stopDrag() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', stopDrag)
  drag = null
  aim.value = null
}

function onDragEnd(e: PointerEvent) {
  const current = drag
  const to = aim.value?.to
  stopDrag()
  if (!current?.moved || !to) return
  justDragged = true
  window.setTimeout(() => (justDragged = false), 0)
  // Relâchée sur un repère (camp, bande, gisement, cité) : c'est sa cible. Sinon, elle va à cet endroit.
  const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-target]')
  const target = under ? (JSON.parse(under.getAttribute('data-target') ?? 'null') as Target | null) : null
  emit('command', current.id, target ?? { type: 'point', x: Math.round(to.x), y: Math.round(to.y) })
}

onBeforeUnmount(stopDrag)

function onTap(point: Point) {
  if (!justDragged) emit('tap', point)
}

function select(selection: Selection) {
  if (!justDragged) emit('select', selection)
}

// --- Le chemin dessiné : celui de l'armée tirée, de l'armée choisie, ou vers la cible choisie ---

const route = computed<{ from: Point; to: Point; target: Target | null } | null>(() => {
  if (aim.value) {
    const army = getArmy(props.state, aim.value.id)
    return army ? { from: army.position, to: aim.value.to, target: null } : null
  }
  const selection = props.selection
  if (!selection) return null
  if (selection.kind === 'army') {
    const army = selectedArmy.value
    if (!army?.order || army.status !== 'marching') return null
    const to = targetPosition(props.state, army.order, props.now)
    return to ? { from: army.position, to, target: army.order } : null
  }
  const to = targetPosition(props.state, selection.target, props.now)
  return to ? { from: city, to, target: selection.target } : null
})

// Le but d'une marche vers un simple endroit de la carte : un repère doré.
const goal = computed(() => {
  if (aim.value) return aim.value.to
  const target = route.value?.target
  return target?.type === 'point' ? { x: target.x, y: target.y } : null
})

// Les bandes qui patrouillent près de ce chemin : l'armée risque d'y être attaquée.
const dangers = computed(() => {
  const path = route.value
  if (!path) return new Set<number>()
  return new Set(bandsNearPath(props.state, path.from, path.to, path.target ?? undefined).map((band) => band.id))
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
      selected: isSelectedTarget(target) || isOrdered(target),
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
      selected: isSelectedTarget(target) || isOrdered(target),
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
      selected: isSelectedTarget(target) || isOrdered(target),
    }
  }),
)

const armies = computed(() =>
  props.state.armies.map((army) => ({
    key: army.id,
    ...army.position,
    icon: STATUS_ICONS[army.status],
    hero: army.hero === null ? null : getHeroDef(army.hero),
    size: armySize(army.troops),
    selected: props.selection?.kind === 'army' && props.selection.id === army.id,
    dragged: aim.value?.id === army.id,
  })),
)

// Les batailles en cours : une ligne entre l'armée et la bande, et le numéro de la manche.
const battles = computed(() =>
  props.state.battles.flatMap((battle) => {
    const army = battle.army === null ? undefined : getArmy(props.state, battle.army)
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
</script>

<template>
  <MapViewport
    ref="viewport"
    :width="WORLD_MAP.width"
    :height="WORLD_MAP.height"
    :center="WORLD_MAP.center"
    :span="900"
    :span-height="560"
    label="Carte des alentours"
    @tap="onTap"
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

    <!-- Le chemin : de l'armée vers son but, ou de la cité vers la cible choisie -->
    <line
      v-if="route"
      :x1="route.from.x"
      :y1="route.from.y"
      :x2="route.to.x"
      :y2="route.to.y"
      class="route"
      :class="{ aiming: aim }"
    />
    <g v-if="goal" :transform="`translate(${goal.x} ${goal.y})`" class="goal" aria-hidden="true">
      <circle r="14" class="plan-mark" />
      <circle r="4" class="plan-dot" />
    </g>

    <!-- La cité : la toucher y fait entrer, ou y fait rentrer l'armée choisie -->
    <g
      class="spot city"
      :class="{ selected: isOrdered(CITY_TARGET) }"
      :transform="`translate(${city.x} ${city.y})`"
      role="button"
      tabindex="0"
      :aria-label="selectedArmy ? `${cityName} : y faire rentrer ton armée` : `${cityName} : entrer dans la cité`"
      :data-target="JSON.stringify(CITY_TARGET)"
      @click.stop="select({ kind: 'target', target: CITY_TARGET })"
      @keydown.enter.prevent="select({ kind: 'target', target: CITY_TARGET })"
      @keydown.space.prevent="select({ kind: 'target', target: CITY_TARGET })"
    >
      <ellipse class="spot-base" rx="84" ry="32" cy="46" />
      <ellipse class="spot-ring" rx="96" ry="40" cy="46" />
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
      :data-target="JSON.stringify(node.target)"
      @click.stop="select({ kind: 'target', target: node.target })"
      @keydown.enter.prevent="select({ kind: 'target', target: node.target })"
      @keydown.space.prevent="select({ kind: 'target', target: node.target })"
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
      class="spot camp"
      :class="{ selected: camp.selected }"
      :transform="`translate(${camp.x} ${camp.y})`"
      role="button"
      tabindex="0"
      :aria-label="`${camp.name}, camp de niveau ${camp.level}`"
      :aria-pressed="camp.selected"
      :data-target="JSON.stringify(camp.target)"
      @click.stop="select({ kind: 'target', target: camp.target })"
      @keydown.enter.prevent="select({ kind: 'target', target: camp.target })"
      @keydown.space.prevent="select({ kind: 'target', target: camp.target })"
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
      :data-target="JSON.stringify(band.target)"
      @click.stop="select({ kind: 'target', target: band.target })"
      @keydown.enter.prevent="select({ kind: 'target', target: band.target })"
      @keydown.space.prevent="select({ kind: 'target', target: band.target })"
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

    <!-- Tes armées : on les touche pour les choisir, ou on les tire jusqu'à leur destination -->
    <g
      v-for="army in armies"
      :key="army.key"
      class="mover spot army"
      :class="{ selected: army.selected, dragged: army.dragged }"
      :style="{ transform: `translate(${army.x}px, ${army.y}px)` }"
      role="button"
      tabindex="0"
      :aria-label="`Ton armée de ${army.size} troupes${army.hero ? `, menée par ${army.hero.name}` : ''}`"
      :aria-pressed="army.selected"
      :data-army="army.key"
      @pointerdown="onArmyPointerDown(army.key, $event)"
      @click.stop="select({ kind: 'army', id: army.key })"
      @keydown.enter.prevent="select({ kind: 'army', id: army.key })"
      @keydown.space.prevent="select({ kind: 'army', id: army.key })"
    >
      <circle r="34" class="spot-ring army-ring" />
      <circle r="26" class="army-dot" />
      <text class="emoji" font-size="28">{{ army.icon }}</text>
      <g v-if="army.hero" transform="translate(28 -24)">
        <circle r="17" class="badge" />
        <text class="emoji" font-size="20">{{ army.hero.icon }}</text>
      </g>
      <text class="map-label" y="-44">{{ army.size }}</text>
    </g>

    <!-- Les batailles en cours -->
    <g v-for="battle in battles" :key="`battle-${battle.key}`" class="battle" aria-hidden="true">
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

/* La zone d'aggro : un cercle rouge, plus marqué si le chemin choisi passe tout près. On touche la
   bande elle-même pour la choisir : toucher sa zone, c'est toucher le sol. */
.aggro {
  fill: var(--map-aggro);
  stroke: var(--ember);
  stroke-width: 3;
  stroke-dasharray: 12 9;
  opacity: 0.8;
  pointer-events: none;
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
  pointer-events: none;
}

/* Pendant qu'on tire une armée, le trait est plein. */
.route.aiming {
  stroke-dasharray: none;
  stroke-width: 6;
}

.goal,
.battle {
  pointer-events: none;
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

.army {
  cursor: grab;
}

.army.dragged {
  cursor: grabbing;
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
