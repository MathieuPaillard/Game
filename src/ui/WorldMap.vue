<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CAMPS, ENCAMPMENT, ENCAMPMENT_GATE, MOUNTAINS, NODE_KINDS, WORLD } from '../game/config'
import {
  aggroRadius,
  armySize,
  bandPosition,
  bandsNearPath,
  campEmptyUntil,
  distance,
  getArmy,
  getBand,
  getBandKind,
  getCamp,
  getHeroDef,
  nodeGatherer,
  patrolLoop,
  raidArrival,
  routeBetween,
  sameTarget,
  siegeOf,
  targetPosition,
  type Band,
  type Battle,
  type GameState,
  type Target,
} from '../game/rules'
import HealthBar from './HealthBar.vue'
import MapGround from './MapGround.vue'
import MapViewport from './MapViewport.vue'
import { formatClock, formatDuration, formatShort } from './format'
import { WORLD_DECOR, WORLD_MAP, mountainLight, mountainPoints, mountainSnow, type Point } from './maps'
import { STATUS_ICONS, fightFx, monstersIcon, shot, type Selection } from './world'

// Les alentours de la cité : les camps, les gisements, les bandes qui patrouillent (avec leur zone
// d'aggro), les raids qui marchent sur la cité, tes armées et leurs batailles. Toucher un repère le
// choisit ; toucher le fond de la carte donne un endroit. On peut aussi tirer une armée du doigt
// jusqu'à un endroit ou une cible : en relâchant, elle reçoit cet ordre.
const props = defineProps<{ state: GameState; now: number; selection: Selection | null; cityName: string }>()

/** L'insigne des chefs du grand campement. */
const CHIEF_BADGES: Partial<Record<string, string>> = { keeper: '🗝️', eliteGuard: '🛡️', warlord: '👑' }

// Le grand campement se repeuple bientôt : dans combien de temps.
const encampmentBack = computed(() => {
  const at = props.state.encampment.resetAt
  return at === null ? null : Math.max(0, at - props.now)
})

// Le relief, qui ne change pas : les massifs de la barrière, et la porte du grand campement.
const MASSIFS = MOUNTAINS.map((massif) => massif.map((p) => `${p.x},${p.y}`).join(' '))
const GATE = ENCAMPMENT_GATE.map((p) => `${p.x},${p.y}`).join(' ')
const GATE_AT = {
  x: ENCAMPMENT_GATE.reduce((sum, p) => sum + p.x, 0) / ENCAMPMENT_GATE.length,
  y: ENCAMPMENT_GATE.reduce((sum, p) => sum + p.y, 0) / ENCAMPMENT_GATE.length,
}
const emit = defineEmits<{
  select: [selection: Selection]
  tap: [point: Point]
  /** Une armée tirée du doigt jusqu'à une cible ou un endroit. */
  command: [army: number, target: Target]
}>()

const city = WORLD.city
const CITY_TARGET: Target = { type: 'city' }
const viewport = ref<InstanceType<typeof MapViewport> | null>(null)

/** Un raid tout près de la cité (ou qui l'assiège) se dessine à cette distance, pour ne pas la cacher. */
const GATE_DISTANCE = 130

/** Où dessiner une bande : là où elle est ; un raid aux portes, devant la cité, du côté d'où il vient. */
function drawnPosition(band: Band, at: number): Point {
  const position = bandPosition(band, at)
  if (!band.raid || distance(position, city) >= GATE_DISTANCE) return position
  const length = distance(band.home, city)
  if (length === 0) return position
  return {
    x: city.x + ((band.home.x - city.x) / length) * GATE_DISTANCE,
    y: city.y + ((band.home.y - city.y) / length) * GATE_DISTANCE,
  }
}

/** Pendant une bataille, l'armée se tient à cette distance de son adversaire : les deux restent bien visibles. */
const FIGHT_GAP = 115

/** L'endroit où dessiner l'adversaire d'une bataille : la bande (ou le raid), ou le camp. */
function foePosition(battle: Battle): Point | null {
  if (battle.band !== null) {
    const band = getBand(props.state, battle.band)
    return band ? drawnPosition(band, props.now) : null
  }
  return battle.foe.type === 'camp' ? getCamp(battle.foe.camp).position : null
}

/**
 * L'endroit où dessiner une armée qui se bat : à côté de son adversaire, à la même hauteur, du côté
 * d'où elle vient (celui de la cité quand elle se bat sur le camp même). Ainsi, les noms (dessous)
 * et les barres de vie (dessus) des deux combattants ne se chevauchent pas.
 */
function apart(position: Point, foe: Point): Point {
  const from = distance(position, foe) > 1 ? position : city
  let side = from.x < foe.x ? -1 : 1
  // Pas en dehors de la carte.
  if (foe.x + side * FIGHT_GAP < 0 || foe.x + side * FIGHT_GAP > WORLD_MAP.width) side = -side
  return { x: foe.x + side * FIGHT_GAP, y: foe.y }
}

/** Où dessiner une armée : là où elle est, ou en face de son adversaire pendant une bataille. */
function armyPosition(army: { id: number; position: Point; status: string }): Point {
  if (army.status !== 'fighting') return army.position
  const battle = props.state.battles.find((b) => b.army === army.id)
  const foe = battle ? foePosition(battle) : null
  return foe ? apart(army.position, foe) : army.position
}

// Ce qu'on vient de choisir vient au milieu de la carte (une fois le panneau ouvert à côté), y compris
// quand la carte s'affiche pour la première fois avec un choix déjà fait.
function focus(selection: Selection | null) {
  if (!selection) return
  const point =
    selection.kind === 'army'
      ? getArmy(props.state, selection.id)?.position
      : targetPosition(props.state, selection.target, props.now)
  if (point) viewport.value?.centerOn(point)
}
watch(() => props.selection, focus, { flush: 'post' })
onMounted(() => focus(props.selection))

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

// Le chemin suivi, montagnes contournées ; tout droit en rouge quand aucun chemin n'y mène.
const routeLine = computed(() => {
  const path = route.value
  if (!path) return null
  const points = routeBetween(props.state, path.from, path.to)
  return { points: (points ?? [path.from, path.to]).map((p) => `${p.x},${p.y}`).join(' '), blocked: points === null }
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
    // Vaincu, le camp reste vide un moment : on voit quand ses monstres reviennent.
    const until = campEmptyUntil(props.state, camp.id, props.now)
    return {
      key: camp.id,
      target,
      ...camp.position,
      name: camp.name,
      level: camp.level,
      icon: until === null ? monstersIcon(camp.defenders) : '⛺',
      back: until === null ? null : until - props.now,
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

const bands = computed(() => {
  const siege = siegeOf(props.state)
  const besieging = siege?.band
  return props.state.bands.map((band) => {
    const target: Target = { type: 'band', band: band.id }
    const battle = props.state.battles.find((b) => b.band === band.id)
    const name = getBandKind(band.kind).name
    const arrival = raidArrival(band)
    const left = arrival === null ? null : Math.max(0, arrival - props.now)
    // Un raid : son état en quelques mots, sous son nom.
    const raidState =
      siege && besieging === band.id
        ? `Siège · manche ${siege.rounds.length + 1}`
        : left === null
          ? 'au combat'
          : `arrive dans ${formatClock(left)}`
    return {
      key: `band-${band.id}`,
      target,
      ...drawnPosition(band, props.now),
      raid: band.raid,
      // Un chef du grand campement garde sa place : pas de ronde, mais un insigne.
      still: band.still,
      chief: band.still ? (CHIEF_BADGES[band.kind] ?? null) : null,
      loop:
        band.raid || band.still
          ? ''
          : patrolLoop(band.home)
              .map((p) => `${p.x},${p.y}`)
              .join(' '),
      radius: aggroRadius(band.level),
      name: band.raid ? `Raid : ${name}` : name,
      sublabel: band.raid ? raidState : null,
      label: band.raid
        ? `Raid : ${name}, niveau ${band.level}, ${besieging === band.id ? 'assiège la cité' : left === null ? 'au combat' : `arrive à la cité dans ${formatDuration(left)}`}`
        : band.still
          ? `${name}, chef du grand campement, niveau ${band.level}${band.since === null ? ', au combat' : ''}`
          : `${name}, bande de niveau ${band.level}${band.since === null ? ', au combat' : ', en patrouille'}`,
      level: band.level,
      icon: monstersIcon(band.monsters),
      danger: dangers.value.has(band.id),
      selected: isSelectedTarget(target) || isOrdered(target),
      fight: battle ? fightFx(battle) : null,
      // Elle avance : sur sa ronde, ou vers la cité.
      walking: band.since !== null && band.since <= props.now,
    }
  })
})
const patrols = computed(() => bands.value.filter((band) => !band.raid && !band.still))
const raids = computed(() => bands.value.filter((band) => band.raid))

const armies = computed(() =>
  props.state.armies.map((army) => {
    const battle = props.state.battles.find((b) => b.army === army.id)
    return {
      key: army.id,
      ...armyPosition(army),
      icon: STATUS_ICONS[army.status],
      hero: army.hero === null ? null : getHeroDef(army.hero),
      size: armySize(army.troops),
      selected: props.selection?.kind === 'army' && props.selection.id === army.id,
      dragged: aim.value?.id === army.id,
      status: army.status,
      fight: battle ? fightFx(battle) : null,
      dragon: army.dragon,
      hasKey: army.key,
    }
  }),
)

// Pendant un siège, les défenseurs de la cité : leur vie, et les coups qu'ils reçoivent.
const cityFight = computed(() => {
  const siege = siegeOf(props.state)
  return siege ? fightFx(siege) : null
})

// Les batailles en cours : une ligne entre l'armée et son adversaire, et le numéro de la manche.
// Pendant un siège, seulement la ligne entre la cité et le raid : le raid dit où en est le siège.
const battles = computed(() =>
  props.state.battles.flatMap((battle) => {
    const army = battle.army === null ? undefined : getArmy(props.state, battle.army)
    const from = battle.siege ? city : army && armyPosition(army)
    if (!from) return []
    const foe = foePosition(battle) ?? from
    return [
      {
        key: battle.id,
        from,
        to: foe,
        x: (from.x + foe.x) / 2,
        y: (from.y + foe.y) / 2,
        siege: battle.siege !== null,
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
    <MapGround id="world" :width="WORLD_MAP.width" :height="WORLD_MAP.height" :patches="WORLD_DECOR.patches" />
    <ellipse :cx="city.x" :cy="city.y" rx="260" ry="190" class="meadow" />
    <path :d="WORLD_DECOR.river" class="river" />
    <path :d="WORLD_DECOR.river" class="river-light" />
    <ellipse v-bind="WORLD_DECOR.lake" class="water" />
    <ellipse
      :cx="WORLD_DECOR.lake.cx - 20"
      :cy="WORLD_DECOR.lake.cy - 12"
      :rx="WORLD_DECOR.lake.rx * 0.6"
      :ry="WORLD_DECOR.lake.ry * 0.45"
      class="water-shine"
    />
    <ellipse v-for="(marsh, i) in WORLD_DECOR.marshes" :key="`marsh-${i}`" v-bind="marsh" class="marsh" />
    <!-- La barrière de montagnes, que rien ne traverse, et le grand campement en son cœur -->
    <circle :cx="ENCAMPMENT.center.x" :cy="ENCAMPMENT.center.y" :r="ENCAMPMENT.radius" class="cirque" />
    <!-- Les massifs se chevauchent : leur contour d'abord, puis leur roche, pour qu'ils ne fassent qu'un. -->
    <polygon v-for="(massif, i) in MASSIFS" :key="`massif-edge-${i}`" :points="massif" class="massif-edge" />
    <polygon v-for="(massif, i) in MASSIFS" :key="`massif-${i}`" :points="massif" class="massif" />
    <g v-for="(peak, i) in WORLD_DECOR.peaks" :key="`peak-${i}`" aria-hidden="true">
      <polygon :points="mountainPoints(peak)" class="rock" />
      <polygon :points="mountainLight(peak)" class="rock-light" />
      <polygon :points="mountainSnow(peak)" class="snow" />
    </g>
    <g
      class="gate"
      role="img"
      :aria-label="state.encampment.gateOpen ? 'Porte du grand campement : ouverte' : 'Porte du grand campement : fermée, il faut sa clef'"
    >
      <polygon v-if="!state.encampment.gateOpen" :points="GATE" class="gate-door" />
      <text class="emoji" font-size="30" :x="GATE_AT.x" :y="GATE_AT.y">{{ state.encampment.gateOpen ? '🔓' : '🔒' }}</text>
    </g>
    <!-- Son nom, sur la crête au-dessus du cirque, où rien ne le cache -->
    <text class="map-label encampment-name" :x="ENCAMPMENT.center.x" :y="ENCAMPMENT.center.y - ENCAMPMENT.radius - 34">
      {{ ENCAMPMENT.name }}
    </text>
    <text
      v-if="encampmentBack !== null"
      class="map-sublabel"
      :x="ENCAMPMENT.center.x"
      :y="ENCAMPMENT.center.y - ENCAMPMENT.radius - 8"
    >
      Se repeuple dans {{ formatClock(encampmentBack) }}
    </text>
    <g v-for="camp in CAMPS" :key="`road-${camp.id}`">
      <line :x1="city.x" :y1="city.y" :x2="camp.position.x" :y2="camp.position.y" class="trail-edge" />
      <line :x1="city.x" :y1="city.y" :x2="camp.position.x" :y2="camp.position.y" class="trail" />
    </g>
    <!-- Le pont de bois sur la rivière, vers le Nid de la vouivre -->
    <g
      :transform="`translate(${WORLD_DECOR.bridge.x} ${WORLD_DECOR.bridge.y}) rotate(${WORLD_DECOR.bridge.angle})`"
      aria-hidden="true"
    >
      <rect x="-46" y="-17" width="92" height="34" rx="5" class="bridge" />
      <line v-for="plank in 7" :key="`plank-${plank}`" :x1="-46 + plank * 11.5" y1="-17" :x2="-46 + plank * 11.5" y2="17" class="plank" />
      <line x1="-46" y1="-17" x2="46" y2="-17" class="rail" />
      <line x1="-46" y1="17" x2="46" y2="17" class="rail" />
    </g>
    <!-- Les rondes des bandes, et le chemin des raids jusqu'à la cité -->
    <polygon v-for="band in patrols" :key="`loop-${band.key}`" :points="band.loop" class="patrol" />
    <line
      v-for="raid in raids"
      :key="`path-${raid.key}`"
      :x1="raid.x"
      :y1="raid.y"
      :x2="city.x"
      :y2="city.y"
      class="raid-path"
    />
    <g v-for="(mountain, i) in WORLD_DECOR.mountains" :key="`mountain-${i}`" aria-hidden="true">
      <ellipse :cx="mountain.x + 10" :cy="mountain.y" :rx="mountain.w * 0.55" :ry="12" class="shade" />
      <polygon :points="mountainPoints(mountain)" class="rock" />
      <polygon :points="mountainLight(mountain)" class="rock-light" />
      <polygon :points="mountainSnow(mountain)" class="snow" />
    </g>
    <g v-for="(tree, i) in WORLD_DECOR.trees" :key="`tree-${i}`" aria-hidden="true">
      <ellipse :cx="tree.x + 5" :cy="tree.y + 20 * tree.size" :rx="16 * tree.size" :ry="6 * tree.size" class="shade" />
      <text :x="tree.x" :y="tree.y" :font-size="44 * tree.size" class="emoji">{{ i % 3 === 0 ? '🌳' : '🌲' }}</text>
    </g>

    <!-- Le chemin : de l'armée vers son but, ou de la cité vers la cible choisie -->
    <polyline v-if="routeLine" :points="routeLine.points" class="route" :class="{ aiming: aim, blocked: routeLine.blocked }" />
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
      <g :key="`city-${cityFight?.round ?? 0}`" :class="{ hit: (cityFight?.round ?? 0) > 0 }">
        <text class="emoji" font-size="104">🏰</text>
      </g>
      <text class="map-label" y="100">{{ cityName }}</text>
      <template v-if="cityFight">
        <HealthBar :ratio="cityFight.ally" :y="-78" :width="96" />
        <text v-if="cityFight.taken > 0" :key="`city-taken-${cityFight.round}`" class="float-damage ally" y="-96">
          −{{ formatShort(cityFight.taken) }}
        </text>
      </template>
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
      :class="{ selected: camp.selected, empty: camp.back !== null }"
      :transform="`translate(${camp.x} ${camp.y})`"
      role="button"
      tabindex="0"
      :aria-label="`${camp.name}, camp de niveau ${camp.level}${camp.back === null ? '' : `, vide : ses monstres reviennent dans ${formatDuration(camp.back)}`}`"
      :aria-pressed="camp.selected"
      :data-target="JSON.stringify(camp.target)"
      @click.stop="select({ kind: 'target', target: camp.target })"
      @keydown.enter.prevent="select({ kind: 'target', target: camp.target })"
      @keydown.space.prevent="select({ kind: 'target', target: camp.target })"
    >
      <ellipse class="spot-base camp-base" rx="66" ry="26" cy="32" />
      <ellipse class="spot-ring" rx="78" ry="33" cy="32" />
      <text v-if="camp.back === null" class="emoji campfire" font-size="26" x="-58" y="22" aria-hidden="true">🔥</text>
      <text class="emoji camp-icon" font-size="70">{{ camp.icon }}</text>
      <text class="map-label" y="74">{{ camp.name }}</text>
      <text class="map-sublabel" y="98">
        {{ camp.back === null ? `Niveau ${camp.level}` : `Vide · revient dans ${formatClock(camp.back)}` }}
      </text>
    </g>

    <!-- Les bandes, en patrouille, et les raids, avec leur zone d'aggro -->
    <g
      v-for="band in bands"
      :key="band.key"
      class="mover spot band"
      :class="{ selected: band.selected, raid: band.raid }"
      :style="{ transform: `translate(${band.x}px, ${band.y}px)` }"
      role="button"
      tabindex="0"
      :aria-label="band.label"
      :aria-pressed="band.selected"
      :data-target="JSON.stringify(band.target)"
      @click.stop="select({ kind: 'target', target: band.target })"
      @keydown.enter.prevent="select({ kind: 'target', target: band.target })"
      @keydown.space.prevent="select({ kind: 'target', target: band.target })"
    >
      <circle :r="band.radius" class="aggro" :class="{ danger: band.danger }" />
      <ellipse class="spot-base band-base" rx="34" ry="13" cy="20" />
      <ellipse class="spot-ring" rx="44" ry="19" cy="20" />
      <g class="walker" :class="{ walking: band.walking, hurry: band.raid }">
        <g :key="`band-hit-${band.fight?.round ?? 0}`" :class="{ hit: (band.fight?.round ?? 0) > 0 }">
          <text class="emoji" font-size="44">{{ band.icon }}</text>
        </g>
      </g>
      <g transform="translate(26 -22)">
        <circle r="14" class="badge level" />
        <text class="badge-text">{{ band.level }}</text>
      </g>
      <g v-if="band.chief" transform="translate(-28 -22)">
        <circle r="15" class="badge key-badge" />
        <text class="emoji" font-size="18">{{ band.chief }}</text>
      </g>
      <text class="map-label" y="50">{{ band.name }}</text>
      <text v-if="band.sublabel" class="map-sublabel raid-state" y="72">{{ band.sublabel }}</text>
      <template v-if="band.fight">
        <HealthBar :ratio="band.fight.foe" :y="-54" foe />
        <text v-if="band.fight.dealt > 0" :key="`band-dealt-${band.fight.round}`" class="float-damage foe" y="-70">
          −{{ formatShort(band.fight.dealt) }}
        </text>
      </template>
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
      :aria-label="`Ton armée de ${army.size} troupes${army.hero ? `, menée par ${army.hero.name}` : ''}${army.dragon ? ', avec le dragon' : ''}`"
      :aria-pressed="army.selected"
      :data-army="army.key"
      @pointerdown="onArmyPointerDown(army.key, $event)"
      @click.stop="select({ kind: 'army', id: army.key })"
      @keydown.enter.prevent="select({ kind: 'army', id: army.key })"
      @keydown.space.prevent="select({ kind: 'army', id: army.key })"
    >
      <circle r="34" class="spot-ring army-ring" />
      <g class="walker" :class="{ walking: army.status === 'marching' }">
        <g :key="`army-hit-${army.fight?.round ?? 0}`" :class="{ hit: (army.fight?.round ?? 0) > 0 }">
          <circle r="26" class="army-dot" />
          <text class="emoji" :class="{ swing: army.status === 'gathering' }" font-size="28">{{ army.icon }}</text>
        </g>
      </g>
      <g v-if="army.hero" transform="translate(28 -24)">
        <circle r="17" class="badge" />
        <text class="emoji" font-size="20">{{ army.hero.icon }}</text>
      </g>
      <g v-if="army.dragon" transform="translate(-28 -24)">
        <circle r="17" class="badge dragon-badge" />
        <text class="emoji" font-size="20">🐉</text>
      </g>
      <g v-if="army.hasKey" transform="translate(30 20)">
        <circle r="15" class="badge key-badge" />
        <text class="emoji" font-size="18">🗝️</text>
      </g>
      <text class="map-label" y="-44">{{ army.size }}</text>
      <template v-if="army.fight">
        <HealthBar :ratio="army.fight.ally" :y="-74" />
        <text v-if="army.fight.taken > 0" :key="`army-taken-${army.fight.round}`" class="float-damage ally" y="-90">
          −{{ formatShort(army.fight.taken) }}
        </text>
      </template>
    </g>

    <!-- Les batailles en cours -->
    <g v-for="battle in battles" :key="`battle-${battle.key}`" class="battle" aria-hidden="true">
      <line :x1="battle.from.x" :y1="battle.from.y" :x2="battle.to.x" :y2="battle.to.y" class="clash" />
      <g v-if="battle.round > 0" :key="`sparks-${battle.round}`">
        <circle r="6" class="spark ally" :cx="battle.from.x" :cy="battle.from.y" :style="shot(battle.from, battle.to)" />
        <circle r="6" class="spark foe" :cx="battle.to.x" :cy="battle.to.y" :style="shot(battle.to, battle.from)" />
      </g>
      <g v-if="!battle.siege" :transform="`translate(${battle.x} ${battle.y})`">
        <g :key="`bump-${battle.round}`" class="bump">
          <circle r="19" class="clash-mark" />
          <text class="emoji" font-size="21">⚔️</text>
        </g>
        <!-- La manche en cours, en petit, sur les épées croisées -->
        <g transform="translate(16 -15)">
          <circle :r="battle.round + 1 > 9 ? 13 : 11" class="badge level" />
          <text class="badge-text round-number">{{ battle.round + 1 }}</text>
        </g>
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

/* Un camp vaincu, vide en attendant le retour de ses monstres : ses tentes pâlissent. */
.camp.empty .camp-icon {
  opacity: 0.55;
}

.camp-base {
  fill: var(--map-camp);
}

.band-base,
.node-base {
  fill: var(--map-camp);
  opacity: 0.85;
}

/* Le pont de bois, ses planches et ses rambardes. */
.bridge {
  fill: #7a5a3a;
}

.plank {
  stroke: #5b4029;
  stroke-width: 2;
}

.rail {
  stroke: #4a3220;
  stroke-width: 5;
  stroke-linecap: round;
}

/* Les chemins de terre, avec leurs bas-côtés. */
.trail-edge {
  stroke: var(--map-road-edge);
  stroke-width: 14;
  stroke-linecap: round;
  opacity: 0.45;
}

/* Le reflet du ciel sur le lac, qui miroite doucement. */
.water-shine {
  fill: var(--map-water-light);
  opacity: 0.25;
  animation: shimmer 5s ease-in-out infinite alternate;
}

@keyframes shimmer {
  from {
    opacity: 0.12;
  }
  to {
    opacity: 0.32;
  }
}

/* Un feu de camp qui vacille. */
.campfire {
  transform-box: fill-box;
  transform-origin: 50% 90%;
  animation: flicker 0.9s ease-in-out infinite alternate;
}

@keyframes flicker {
  from {
    transform: scale(0.88, 0.8);
    opacity: 0.75;
  }
  to {
    transform: scale(1.05, 1.12);
    opacity: 1;
  }
}

/* Un raid : sa zone d'aggro bat comme une alarme, en deux temps (moins coûteux à repeindre). */
.band.raid .aggro {
  animation: alarm 1.2s steps(2, jump-none) infinite alternate;
}

@keyframes alarm {
  from {
    opacity: 0.5;
  }
  to {
    opacity: 1;
  }
}

/* La ronde d'une bande, en pointillés discrets. */
.patrol {
  fill: none;
  stroke: var(--ember);
  stroke-width: 2;
  stroke-dasharray: 4 10;
  opacity: 0.45;
}

/* Le chemin d'un raid jusqu'à la cité : une ligne rouge, qu'on voit de loin. */
.raid-path {
  stroke: var(--ember);
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 16 12;
  opacity: 0.75;
  pointer-events: none;
}

/* Un raid : son socle et son niveau sont rouges. */
.band.raid .band-base {
  fill: var(--map-aggro-badge);
  stroke: var(--ember);
  stroke-width: 3;
}

.raid-state {
  fill: var(--ember);
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
  fill: none;
  stroke: var(--gilt);
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 2 14;
  opacity: 0.9;
  pointer-events: none;
}

/* Pendant qu'on tire une armée, le trait est plein. */
/* Aucun chemin n'y mène : le trait reste droit, et rouge. */
.route.blocked {
  stroke: var(--ember);
}

/* La barrière de montagnes : un massif de roche sombre, ourlé d'ombre. */
.massif-edge {
  fill: var(--map-massif);
  stroke: var(--map-shade);
  stroke-width: 14;
  stroke-linejoin: round;
}

.massif {
  fill: var(--map-massif);
}

/* Le sol battu du grand campement, au fond de son cirque. */
.cirque {
  fill: var(--map-dirt);
  opacity: 0.5;
}

.gate-door {
  fill: var(--map-wall);
  stroke: var(--map-halo);
  stroke-width: 3;
}

.encampment-name {
  font-size: 30px;
}

.key-badge {
  fill: var(--stone);
  stroke: var(--gilt);
  stroke-width: 2;
}

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

.dragon-badge {
  stroke: var(--ember);
}

.round-number {
  font-size: 14px;
}

.clash-mark {
  fill: var(--stone);
  stroke: var(--ember);
  stroke-width: 3;
}
</style>
