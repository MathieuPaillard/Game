<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  CAMPS,
  ENCAMPMENT,
  ENCAMPMENT_GATE,
  ENCAMPMENT_TRAPS,
  MOUNTAINS,
  NODE_KINDS,
  WATCH_RADIUS,
  WORLD,
  type CampId,
} from '../game/config'
import {
  aggroRadius,
  armyBattle,
  armySize,
  bandBattle,
  bandPosition,
  bandsNearPath,
  campEmptyUntil,
  canChase,
  distance,
  encircled,
  fighterOf,
  fighterPosition,
  getArmy,
  getBand,
  foeLevel,
  getBandKind,
  getHeroDef,
  nodeGatherer,
  patrolLoop,
  raidArrival,
  routeBetween,
  sameTarget,
  siegeOf,
  sightRadius,
  targetPosition,
  watchtower,
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

// Les alentours de la cité : les camps, les gisements, les bandes qui patrouillent (avec la zone où
// elles voient venir une armée, et leur poursuite), les raids qui marchent sur la cité, tes armées et
// leurs batailles. Toucher un repère le choisit ; toucher le fond de la carte donne un endroit. On peut
// aussi tirer une armée du doigt jusqu'à un endroit ou une cible : en relâchant, elle reçoit cet ordre.
const props = defineProps<{ state: GameState; now: number; selection: Selection | null; cityName: string }>()

/** L'insigne des chefs du grand campement, et de sa tour de guet. */
const CHIEF_BADGES: Partial<Record<string, string>> = { keeper: '🗝️', eliteGuard: '🛡️', warlord: '👑', watchtower: '👁️' }

// La tour de guet, tant qu'elle tient : ce qu'elle voit.
const tower = computed(() => watchtower(props.state)?.home ?? null)

// Les pièges du grand campement déjà déclenchés : ils se voient, jusqu'au repeuplement. (Les autres restent cachés.)
const sprungTraps = computed(() =>
  props.state.encampment.resetAt === null
    ? []
    : props.state.encampment.sprung.flatMap((i) => (ENCAMPMENT_TRAPS[i] ? [{ key: i, ...ENCAMPMENT_TRAPS[i] }] : [])),
)

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

/**
 * Pendant une mêlée, chacun se tient à sa place autour de sa cible (l'une des huit directions), à
 * cette distance : un peu plus loin en hauteur, pour que les noms (dessous) et les barres de vie
 * (dessus) ne se chevauchent pas. Autour de la cité, les raids se tiennent devant ses murs.
 */
function slotOffsets(width: number, height: number): Point[] {
  return [0, 1, 2, 3, 4, 5, 6, 7].map((slot) => ({
    x: Math.round(Math.cos((slot * Math.PI) / 4) * width),
    y: Math.round(Math.sin((slot * Math.PI) / 4) * height),
  }))
}
const SLOT_OFFSETS = slotOffsets(130, 160)
const CITY_SLOT_OFFSETS = slotOffsets(150, 150)

/**
 * Où dessiner chaque combattant d'une mêlée : chacun autour de sa cible, à sa place. Restent où ils
 * sont : la cité, ceux qui attendent une place, et le monstre qui riposte contre une de tes armées
 * (c'est elle qui se tient autour de lui).
 */
function battleLayout(battle: Battle): Map<string, Point> {
  const layout = new Map<string, Point>()
  const place = (ref: string, visiting: Set<string>): Point => {
    const known = layout.get(ref)
    if (known) return known
    const fighter = fighterOf(battle, ref)
    const target = fighter && fighterOf(battle, fighter.target)
    let point = fighterPosition(props.state, ref, props.now)
    const stays =
      !fighter || !target || ref === 'city' || visiting.has(ref) || (target.target === ref && target.ref !== 'city' && 'foe' in fighter)
    if (!stays) {
      visiting.add(ref)
      const center = place(target.ref, visiting)
      const offset = (target.ref === 'city' ? CITY_SLOT_OFFSETS : SLOT_OFFSETS)[fighter.slot]
      point = { x: center.x + offset.x, y: center.y + offset.y }
    }
    layout.set(ref, point)
    return point
  }
  for (const fighter of [...battle.allies, ...battle.foes]) place(fighter.ref, new Set())
  return layout
}

/** La place de chaque combattant de chaque mêlée, par son nom (`army:12`, `band:34`, `camp:wolfDen`, `city`). */
const placed = computed(() => {
  const all = new Map<string, Point>()
  for (const battle of props.state.battles) for (const [ref, point] of battleLayout(battle)) all.set(ref, point)
  return all
})

/** Où dessiner une armée : là où elle est, ou à sa place dans sa mêlée. */
function armyPosition(army: { id: number; position: Point }): Point {
  return placed.value.get(`army:${army.id}`) ?? army.position
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
      // Le cône du dragon vient de toucher ses défenseurs : la manche où il les a touchés, sinon null.
      flames: campFlames(camp.id),
    }
  }),
)

function campFlames(camp: CampId): number | null {
  for (const battle of props.state.battles) {
    const foe = battle.foes.find((f) => f.camp === camp)
    if (foe && battle.round > 0 && foe.burned === battle.round) return battle.round
  }
  return null
}

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
  return props.state.bands.map((band) => {
    const target: Target = { type: 'band', band: band.id }
    const fighting = bandBattle(props.state, band.id)
    const battle = fighting?.battle
    const besieging = siege !== undefined && battle?.id === siege.id
    const name = getBandKind(band.kind).name
    // Le niveau que voit le joueur : son palier compris (une bande du palier II commence au niveau 5).
    const level = foeLevel(band.kind, band.level)
    const arrival = raidArrival(band)
    const left = arrival === null ? null : Math.max(0, arrival - props.now)
    // Un raid : son état en quelques mots, sous son nom.
    const raidState =
      siege && besieging
        ? `Siège · manche ${siege.round + 1}`
        : left === null
          ? 'au combat'
          : `arrive dans ${formatClock(left)}`
    // Une bande qui a quitté sa ronde : elle poursuit une de tes armées, ou elle y retourne.
    const hunting = !battle && band.chase !== null && band.chase.army !== null
    const returning = !battle && band.chase !== null && band.chase.army === null
    const doing = battle ? 'au combat' : hunting ? 'poursuit ton armée' : returning ? 'regagne sa ronde' : 'en patrouille'
    const chief = band.kind === 'watchtower' ? 'tour de guet du grand campement' : 'chef du grand campement'
    return {
      key: `band-${band.id}`,
      target,
      ...(placed.value.get(`band:${band.id}`) ?? drawnPosition(band, props.now)),
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
      // Une bande en patrouille prend en chasse l'armée qu'elle voit : son cercle, c'est sa vue. Les
      // chefs et les raids attaquent ce qui entre dans leur zone d'aggro.
      radius: canChase(band) ? sightRadius(band.level) : aggroRadius(band.level),
      name: band.raid ? `Raid : ${name}` : name,
      sublabel: band.raid ? raidState : hunting ? 'Te poursuit !' : returning ? 'Regagne sa ronde' : null,
      label: band.raid
        ? `Raid : ${name}, niveau ${level}, ${besieging ? 'assiège la cité' : left === null ? 'au combat' : `arrive à la cité dans ${formatDuration(left)}`}`
        : band.still
          ? `${name}, ${chief}, niveau ${level}${battle ? ', au combat' : ''}`
          : `${name}, bande de niveau ${level}, ${doing}`,
      level,
      icon: monstersIcon(band.monsters),
      danger: dangers.value.has(band.id),
      selected: isSelectedTarget(target) || isOrdered(target),
      fight: fighting ? fightFx(fighting.battle, fighting.foe) : null,
      hunting,
      // Au grand campement, les cercles se chevauchent tous : on n'en trace le bord que pour la bande
      // choisie, ou celles qui guettent le chemin.
      faint: band.encampment,
      // Elle avance : sur sa ronde, vers la cité, ou à la poursuite d'une armée (en courant).
      walking: (band.since !== null && band.since <= props.now) || hunting || returning,
      hurry: band.raid || hunting,
    }
  })
})

// Les poursuites : une ligne entre chaque bande lancée à la poursuite d'une armée, et cette armée.
const chases = computed(() =>
  props.state.bands.flatMap((band) => {
    const chase = band.chase
    const army = chase?.army === null || chase?.army === undefined ? undefined : getArmy(props.state, chase.army)
    if (!chase || !army || bandBattle(props.state, band.id)) return []
    return [{ key: band.id, from: chase.position, to: armyPosition(army) }]
  }),
)
const patrols = computed(() => bands.value.filter((band) => !band.raid && !band.still))
const raids = computed(() => bands.value.filter((band) => band.raid))

const armies = computed(() =>
  props.state.armies.map((army) => {
    const fighting = armyBattle(props.state, army.id)
    return {
      key: army.id,
      ...armyPosition(army),
      icon: STATUS_ICONS[army.status],
      hero: army.hero === null ? null : getHeroDef(army.hero),
      size: armySize(army.troops),
      selected: props.selection?.kind === 'army' && props.selection.id === army.id,
      dragged: aim.value?.id === army.id,
      status: army.status,
      fight: fighting ? fightFx(fighting.battle, fighting.ally) : null,
      // Attaquée d'au moins trois côtés : son attaque baisse.
      surrounded: fighting ? encircled(fighting.battle, fighting.ally.ref) : false,
      dragon: army.dragon,
      hasKey: army.key,
    }
  }),
)

// Pendant un siège, les défenseurs de la cité : leur vie, et les coups qu'ils reçoivent.
const cityFight = computed(() => {
  const siege = siegeOf(props.state)
  const city = siege?.allies.find((ally) => ally.army === null)
  return siege && city ? fightFx(siege, city) : null
})

/**
 * Les coups de chaque mêlée : une ligne entre chaque combattant et sa cible (une seule pour deux
 * combattants qui se font face), où volent les étincelles.
 */
const clashes = computed(() =>
  props.state.battles.flatMap((battle) =>
    [...battle.allies, ...battle.foes].flatMap((fighter) => {
      const target = fighterOf(battle, fighter.target)
      if (!target) return []
      // Deux combattants qui se font face : une seule ligne, tracée depuis le tien.
      if (target.target === fighter.ref && 'foe' in fighter) return []
      const from = placed.value.get(fighter.ref)
      const to = placed.value.get(target.ref)
      if (!from || !to) return []
      return [{ key: `${battle.id}-${fighter.ref}`, from, to, round: battle.round }]
    }),
  ),
)

// Les épées croisées de chaque mêlée, avec le numéro de la manche : entre ta première troupe et sa
// cible (pendant un siège, le raid dit déjà où en est le siège).
const battles = computed(() =>
  props.state.battles.flatMap((battle) => {
    const first = battle.allies[0]
    const target = first && fighterOf(battle, first.target)
    const from = first && placed.value.get(first.ref)
    const to = target && placed.value.get(target.ref)
    if (!first || first.army === null || !from || !to) return []
    return [{ key: battle.id, x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, round: battle.round }]
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
    <!-- Ce que voit la tour de guet du grand campement : les armées qui y entrent mettent ses patrouilles en alerte -->
    <circle v-if="tower" :cx="tower.x" :cy="tower.y" :r="WATCH_RADIUS" class="watch-zone" />
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
        <HealthBar :ratio="cityFight.ratio" :y="-78" :width="96" />
        <text v-if="cityFight.taken > 0" :key="`city-taken-${cityFight.round}`" class="float-damage ally" y="-96">
          −{{ formatShort(cityFight.taken) }}
        </text>
        <text v-if="cityFight.healed > 0" :key="`city-healed-${cityFight.round}`" class="float-damage heal" y="-120">
          +{{ formatShort(cityFight.healed) }}
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
      <text v-if="camp.flames !== null" :key="`camp-burned-${camp.flames}`" class="emoji flame-burst" font-size="56">🔥</text>
      <text class="map-label" y="74">{{ camp.name }}</text>
      <text class="map-sublabel" y="98">
        {{ camp.back === null ? `Niveau ${camp.level}` : `Vide · revient dans ${formatClock(camp.back)}` }}
      </text>
    </g>

    <!-- Les pièges déclenchés du grand campement -->
    <g
      v-for="trap in sprungTraps"
      :key="`trap-${trap.key}`"
      :transform="`translate(${trap.x} ${trap.y})`"
      class="trap"
      role="img"
      aria-label="Piège déclenché : désarmé jusqu’au repeuplement du campement"
    >
      <circle r="22" class="trap-base" />
      <text class="emoji" font-size="28">🪤</text>
    </g>

    <!-- Ce que voit chaque bande en patrouille, et la zone d'aggro des chefs et des raids : sous les
         poursuites, pour qu'elles restent nettes -->
    <g
      v-for="band in bands"
      :key="`zone-${band.key}`"
      class="mover zone"
      :class="{ raid: band.raid }"
      :style="{ transform: `translate(${band.x}px, ${band.y}px)` }"
      aria-hidden="true"
    >
      <circle
        :r="band.radius"
        class="aggro"
        :class="{ danger: band.danger, faint: band.faint && !band.danger && !band.selected }"
      />
    </g>

    <!-- Les poursuites : la bande court vers l'armée qu'elle a repérée (le trait file vers l'armée) -->
    <g v-for="chase in chases" :key="`chase-${chase.key}`" aria-hidden="true">
      <line :x1="chase.from.x" :y1="chase.from.y" :x2="chase.to.x" :y2="chase.to.y" class="chase-halo" />
      <line :x1="chase.from.x" :y1="chase.from.y" :x2="chase.to.x" :y2="chase.to.y" class="chase-line" />
    </g>

    <!-- Qui frappe qui, dans chaque mêlée -->
    <line
      v-for="clash in clashes"
      :key="`clash-${clash.key}`"
      :x1="clash.from.x"
      :y1="clash.from.y"
      :x2="clash.to.x"
      :y2="clash.to.y"
      class="clash"
      aria-hidden="true"
    />

    <!-- Les bandes, en patrouille, et les raids -->
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
      <ellipse class="spot-base band-base" rx="34" ry="13" cy="20" />
      <ellipse class="spot-ring" rx="44" ry="19" cy="20" />
      <g class="walker" :class="{ walking: band.walking, hurry: band.hurry }">
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
      <!-- Elle a repéré une de tes armées -->
      <g v-if="band.hunting" transform="translate(-28 -22)" class="alert-badge">
        <circle r="14" class="badge hunt-badge" />
        <text class="badge-text">!</text>
      </g>
      <text class="map-label" y="50">{{ band.name }}</text>
      <text v-if="band.sublabel" class="map-sublabel raid-state" y="72">{{ band.sublabel }}</text>
      <template v-if="band.fight">
        <HealthBar :ratio="band.fight.ratio" :y="-54" foe />
        <text v-if="band.fight.taken > 0" :key="`band-dealt-${band.fight.round}`" class="float-damage foe" y="-70">
          −{{ formatShort(band.fight.taken) }}
        </text>
        <!-- Le cône de flammes du dragon l'a touchée ; un dragon de Givre l'affaiblit pour la manche suivante -->
        <text v-if="band.fight.burned" :key="`band-burned-${band.fight.round}`" class="emoji flame-burst" font-size="46">
          🔥
        </text>
        <text v-if="band.fight.chilled" class="emoji" font-size="20" x="30" y="-34">❄️</text>
      </template>
    </g>

    <!-- Tes armées : on les touche pour les choisir, ou on les tire jusqu'à leur destination -->
    <g
      v-for="army in armies"
      :key="army.key"
      class="mover spot army"
      :class="{ selected: army.selected, dragged: army.dragged, surrounded: army.surrounded }"
      :style="{ transform: `translate(${army.x}px, ${army.y}px)` }"
      role="button"
      tabindex="0"
      :aria-label="`Ton armée de ${army.size} troupes${army.hero ? `, menée par ${army.hero.name}` : ''}${army.dragon ? ', avec le dragon' : ''}${army.surrounded ? ', encerclée' : ''}`"
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
        <HealthBar :ratio="army.fight.ratio" :y="-74" />
        <text v-if="army.fight.taken > 0" :key="`army-taken-${army.fight.round}`" class="float-damage ally" y="-90">
          −{{ formatShort(army.fight.taken) }}
        </text>
        <text v-if="army.fight.healed > 0" :key="`army-healed-${army.fight.round}`" class="float-damage heal" y="-114">
          +{{ formatShort(army.fight.healed) }}
        </text>
      </template>
    </g>

    <!-- Les mêlées en cours : les étincelles des coups, et les épées croisées avec le numéro de la manche -->
    <g v-for="clash in clashes" :key="`sparks-${clash.key}`" class="battle" aria-hidden="true">
      <g v-if="clash.round > 0" :key="`sparks-${clash.round}`">
        <circle r="6" class="spark ally" :cx="clash.from.x" :cy="clash.from.y" :style="shot(clash.from, clash.to)" />
        <circle r="6" class="spark foe" :cx="clash.to.x" :cy="clash.to.y" :style="shot(clash.to, clash.from)" />
      </g>
    </g>
    <g v-for="battle in battles" :key="`battle-${battle.key}`" class="battle" aria-hidden="true">
      <g :transform="`translate(${battle.x} ${battle.y})`">
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
.zone.raid .aggro {
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

.aggro.faint {
  stroke: none;
  opacity: 0.55;
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

/* Ce que voit la tour de guet : un grand cercle discret. */
.watch-zone {
  fill: var(--map-aggro);
  stroke: var(--ember);
  stroke-width: 3;
  stroke-dasharray: 4 14;
  opacity: 0.35;
  pointer-events: none;
}

/* Une bande lancée à la poursuite d'une armée : un trait rouge cerné de sombre, de la bande à sa
   proie, dont les tirets filent vers l'armée ; et un « ! » sur la bande. */
.chase-halo,
.chase-line {
  stroke-linecap: round;
  pointer-events: none;
}

.chase-halo {
  stroke: var(--map-halo);
  stroke-width: 14;
}

.chase-line {
  stroke: var(--ember);
  stroke-width: 7;
  stroke-dasharray: 20 10;
  animation: chase-flow 0.6s linear infinite;
}

@keyframes chase-flow {
  from {
    stroke-dashoffset: 30;
  }
  to {
    stroke-dashoffset: 0;
  }
}

.hunt-badge {
  fill: var(--ember);
  stroke: var(--map-halo);
}

/* Un piège déclenché : il reste là, désarmé, jusqu'au repeuplement. */
.trap-base {
  fill: var(--stone);
  stroke: var(--ember);
  stroke-width: 3;
  opacity: 0.9;
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
  pointer-events: none;
}

/* Une armée encerclée (attaquée d'au moins trois côtés) : son anneau rougit, et bat comme une alarme. */
.army.surrounded .army-ring {
  stroke: var(--ember);
  stroke-width: 8;
  animation: alarm 1.2s steps(2, jump-none) infinite alternate;
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
