<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { BUILDINGS, DRAGON_EGG_ICON, DRAGON_HATCH_SECONDS, DRAGON_ICON, RESOURCES } from '../game/config'
import {
  armySize,
  fighterHealth,
  foeSurvivors,
  checkUpgrade,
  constructionOf,
  dragonArmy,
  dragonLevel,
  dragonResting,
  siegeOf,
  skillPoints,
  type GameState,
} from '../game/rules'
import HealthBar from './HealthBar.vue'
import MapGround from './MapGround.vue'
import MapViewport from './MapViewport.vue'
import { formatShort } from './format'
import {
  CITY_DECOR,
  CITY_MAP,
  CITY_PLOTS,
  CITY_SIEGE,
  CITY_SPOTS,
  CITY_WALL,
  mountainLight,
  mountainPoints,
  mountainSnow,
} from './maps'
import type { CitySelection } from './screen'
import { fightFx, monstersIcon } from './world'

// La cité vue d'en haut : chaque bâtiment sur son emplacement, la garnison et les héros. Toucher
// l'un d'eux le choisit ; toucher le fond de la carte ne choisit rien. L'enceinte montre le niveau
// des Remparts ; pendant un siège, les monstres se pressent devant la porte sud.
const props = defineProps<{ state: GameState; now: number; selection: CitySelection | null }>()
const emit = defineEmits<{ select: [selection: CitySelection]; tap: [] }>()

const viewport = ref<InstanceType<typeof MapViewport> | null>(null)
const selectedBuilding = computed(() => (props.selection?.kind === 'building' ? props.selection.id : null))

// Ce qu'on vient de choisir vient au milieu de la carte (une fois le panneau ouvert à côté), y compris
// quand la carte s'affiche pour la première fois avec un choix déjà fait.
function focus(selection: CitySelection | null) {
  if (!selection) return
  viewport.value?.centerOn(selection.kind === 'building' ? CITY_PLOTS[selection.id] : CITY_SPOTS[selection.kind])
}
watch(() => props.selection, focus, { flush: 'post' })

// Un siège commence : la carte se tourne vers la porte sud, entre le mur et les monstres qui s'y pressent.
// (Sinon, au cadrage de départ, on ne voyait que leurs barres de vie dépasser au bas de l'écran.)
const siegeId = computed(() => siegeOf(props.state)?.id ?? null)
function focusSiege() {
  const wall = CITY_PLOTS.walls
  viewport.value?.centerOn({ x: (wall.x + CITY_SIEGE.x) / 2, y: (wall.y + CITY_SIEGE.y) / 2 })
}
watch(siegeId, (id, before) => id !== null && before === null && focusSiege(), { flush: 'post' })
onMounted(() => (props.selection ? focus(props.selection) : siegeId.value !== null && focusSiege()))

// Les bâtiments du bas de la carte sont dessinés en dernier, pour passer devant ceux du haut.
const plots = computed(() =>
  BUILDINGS.map((building, index) => {
    const level = props.state.levels[building.id]
    const works = constructionOf(props.state, building.id) ?? null
    const progress = works ? Math.min(1, Math.max(0, (props.now - works.startedAt) / (works.endsAt - works.startedAt))) : 0
    const big = building.id === 'castle'
    return {
      building,
      ...CITY_PLOTS[building.id],
      level,
      works,
      progress,
      locked: level === 0 && props.state.levels.castle < building.unlockedAtCastleLevel,
      ready: checkUpgrade(props.state, building.id).ok,
      // Le Château est plus grand que les autres bâtiments.
      size: big ? 1.45 : 1,
      // La vie du bâtiment : ce qu'il produit s'envole de temps en temps, et ce qui s'y fait se voit.
      puff: level > 0 && building.produces ? RESOURCES[building.produces].icon : null,
      puffDelay: `${-index * 1.3}s`,
      busy: busy.value[building.id] ?? null,
    }
  }).sort((a, b) => a.y - b.y),
)

const roads = BUILDINGS.filter((b) => b.id !== 'castle').map((b) => ({
  id: b.id,
  from: CITY_PLOTS.castle,
  to: CITY_PLOTS[b.id],
}))

// Les troupes au repos dans la cité, et les héros à ton service.
const garrison = computed(() => formatShort(armySize(props.state.troops)))
const heroes = computed(() => ({
  count: props.state.heroes.length,
  // Un point de compétence attend d'être placé.
  ready: props.state.heroes.some((hero) => skillPoints(hero) > 0),
}))

// L'Aire du dragon : l'œuf qui attend ou éclôt, ou le dragon quand il est chez lui (endormi s'il se repose).
const lair = computed(() => {
  const dragon = props.state.dragon
  if (!dragon) return null
  if (dragon.stage !== 'grown') {
    const at = dragon.stage === 'hatching' ? dragon.hatchAt : null
    const progress =
      at === null ? null : Math.min(1, Math.max(0, 1 - (at - props.now) / (DRAGON_HATCH_SECONDS * 1000)))
    return { icon: DRAGON_EGG_ICON, egg: true, resting: false, progress }
  }
  // Parti avec une armée, il n'est pas dans son aire.
  if (dragonArmy(props.state)) return null
  return { icon: DRAGON_ICON, egg: false, resting: dragonResting(props.state, props.now), progress: null }
})

// Ce qui s'active dans un bâtiment : un entraînement à la Caserne, une recherche à l'Académie, un sort
// lancé depuis la Tour des mages, des blessés en soins à l'Hôpital.
const busy = computed<Partial<Record<string, string>>>(() => ({
  ...(props.state.trainings.length > 0 ? { barracks: '⚔️' } : {}),
  ...(props.state.research ? { academy: '✨' } : {}),
  ...(props.state.spells.length > 0 ? { mageTower: '✨' } : {}),
  ...(props.state.healing ? { hospital: '🩹' } : {}),
}))

// L'enceinte : une palissade tant que les Remparts ne sont pas construits, puis un mur de pierre,
// plus épais à chaque niveau.
const walls = computed(() => {
  const level = props.state.levels.walls
  return { level, width: level > 0 ? 12 + 2 * level : 8 }
})

// Le siège en cours : où en est la bataille, qui attaque (un raid, ou plusieurs), et la vie qui reste
// à chaque camp : tes défenseurs, et tous les raids ensemble.
const siege = computed(() => {
  const battle = siegeOf(props.state)
  const city = battle?.allies.find((ally) => ally.army === null)
  if (!battle || !city) return null
  const raids = battle.foes.map(fighterHealth)
  const start = raids.reduce((sum, health) => sum + health.start, 0)
  const now = raids.reduce((sum, health) => sum + health.now, 0)
  return {
    round: battle.round + 1,
    raids: battle.foes.length,
    icon: monstersIcon(battle.foes[0] ? foeSurvivors(battle.foes[0]) : {}),
    city: fightFx(battle, city),
    foe: {
      ratio: start > 0 ? now / start : 0,
      taken: battle.round > 0 ? battle.foes.reduce((sum, foe) => sum + foe.taken, 0) : 0,
    },
  }
})

/** La largeur d'une étiquette de nombre, selon le nombre de chiffres. */
function pill(text: string | number): number {
  return 20 + 10 * String(text).length
}

function describe(plot: (typeof plots.value)[number]): string {
  const name = plot.building.name
  if (plot.locked) return `${name} : se débloque au Château niveau ${plot.building.unlockedAtCastleLevel}`
  if (plot.level === 0) return `${name} : pas encore construit${lairText(plot.building.id)}`
  return `${name} : niveau ${plot.level}${plot.works ? ', en construction' : ''}${lairText(plot.building.id)}`
}

/** Ce que l'on voit sur l'Aire du dragon, pour les lecteurs d'écran. */
function lairText(id: string): string {
  const dragon = props.state.dragon
  if (id !== 'dragonRoost' || !dragon) return ''
  if (dragon.stage === 'egg') return ', un œuf de dragon attend d’être couvé'
  if (dragon.stage === 'hatching') return ', l’œuf de dragon est en train d’éclore'
  if (!lair.value) return ', le dragon est parti avec une armée'
  return `, le dragon de niveau ${dragonLevel(props.state)}${lair.value.resting ? ' s’y repose, blessé' : ' est là'}`
}
</script>

<template>
  <MapViewport
    ref="viewport"
    :width="CITY_MAP.width"
    :height="CITY_MAP.height"
    :center="CITY_MAP.center"
    :span="800"
    :span-height="600"
    label="Carte de la cité"
    @tap="emit('tap')"
  >
    <defs>
      <pattern id="city-field" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(-14)">
        <rect width="16" height="16" class="field" />
        <line x1="0" y1="8" x2="16" y2="8" class="field-line" />
      </pattern>
    </defs>

    <!-- Le décor -->
    <MapGround id="city" :width="CITY_MAP.width" :height="CITY_MAP.height" :patches="CITY_DECOR.patches" />
    <ellipse :cx="CITY_WALL.cx" :cy="CITY_WALL.cy" :rx="CITY_WALL.rx + 30" :ry="CITY_WALL.ry + 25" class="meadow" />
    <path :d="CITY_DECOR.river" class="river" />
    <path :d="CITY_DECOR.river" class="river-light" />
    <rect
      v-for="(field, i) in CITY_DECOR.fields"
      :key="`field-${i}`"
      :x="field.x"
      :y="field.y"
      :width="field.w"
      :height="field.h"
      rx="6"
      fill="url(#city-field)"
    />
    <ellipse
      v-if="siege"
      :cx="CITY_WALL.cx"
      :cy="CITY_WALL.cy"
      :rx="CITY_WALL.rx"
      :ry="CITY_WALL.ry"
      class="wall-alarm"
      :style="{ strokeWidth: walls.width + 18 }"
    />
    <ellipse
      :cx="CITY_WALL.cx"
      :cy="CITY_WALL.cy"
      :rx="CITY_WALL.rx"
      :ry="CITY_WALL.ry"
      class="wall"
      :class="{ built: walls.level > 0 }"
      :style="{ strokeWidth: walls.width }"
    />
    <ellipse
      v-if="walls.level > 0"
      :cx="CITY_WALL.cx"
      :cy="CITY_WALL.cy"
      :rx="CITY_WALL.rx"
      :ry="CITY_WALL.ry"
      class="merlons"
      :style="{ strokeWidth: walls.width / 2 }"
    />
    <g v-for="road in roads" :key="`road-${road.id}`">
      <line :x1="road.from.x" :y1="road.from.y" :x2="road.to.x" :y2="road.to.y" class="road-edge" />
      <line :x1="road.from.x" :y1="road.from.y" :x2="road.to.x" :y2="road.to.y" class="road" />
    </g>
    <g v-for="(mountain, i) in CITY_DECOR.mountains" :key="`mountain-${i}`" aria-hidden="true">
      <ellipse :cx="mountain.x + 10" :cy="mountain.y" :rx="mountain.w * 0.55" :ry="12" class="shade" />
      <polygon :points="mountainPoints(mountain)" class="rock" />
      <polygon :points="mountainLight(mountain)" class="rock-light" />
      <polygon :points="mountainSnow(mountain)" class="snow" />
    </g>
    <g v-for="(tree, i) in CITY_DECOR.trees" :key="`tree-${i}`" aria-hidden="true">
      <ellipse :cx="tree.x + 5" :cy="tree.y + 18 * tree.size" :rx="15 * tree.size" :ry="6 * tree.size" class="shade" />
      <text :x="tree.x" :y="tree.y" :font-size="40 * tree.size" class="emoji">{{ i % 3 === 0 ? '🌳' : '🌲' }}</text>
    </g>

    <!-- Les bâtiments -->
    <g
      v-for="plot in plots"
      :key="plot.building.id"
      class="spot"
      :class="{ selected: plot.building.id === selectedBuilding, locked: plot.locked, empty: plot.level === 0 }"
      :transform="`translate(${plot.x} ${plot.y}) scale(${plot.size})`"
      role="button"
      tabindex="0"
      :aria-label="describe(plot)"
      :aria-pressed="plot.building.id === selectedBuilding"
      @click.stop="emit('select', { kind: 'building', id: plot.building.id })"
      @keydown.enter.prevent="emit('select', { kind: 'building', id: plot.building.id })"
      @keydown.space.prevent="emit('select', { kind: 'building', id: plot.building.id })"
    >
      <ellipse class="spot-base" rx="66" ry="26" cy="32" />
      <ellipse class="spot-ring" rx="78" ry="33" cy="32" />
      <circle v-if="plot.building.id === 'manaWell' && plot.level > 0" r="46" cy="-4" class="mana-glow" />
      <text class="emoji spot-icon" font-size="70">{{ plot.building.icon }}</text>
      <text v-if="plot.locked" class="emoji" font-size="32">🔒</text>
      <text v-if="plot.works" class="emoji hammer" font-size="30" x="-44" y="-34">🔨</text>
      <text v-if="plot.puff" class="emoji puff" font-size="26" x="-30" y="-30" :style="{ animationDelay: plot.puffDelay }">
        {{ plot.puff }}
      </text>
      <text v-if="plot.busy" class="emoji busy" font-size="28" x="-42" y="-30">{{ plot.busy }}</text>
      <g v-if="plot.building.id === 'dragonRoost' && lair" class="lair" transform="translate(-62 0)">
        <text class="emoji" :class="lair.egg ? 'wobble' : 'breathe'" :font-size="lair.egg ? 34 : 48">{{ lair.icon }}</text>
        <text v-if="lair.resting" class="emoji zzz" font-size="22" x="20" y="-28">💤</text>
      </g>
      <g v-if="plot.level > 0 || plot.ready" transform="translate(38 -36)">
        <circle r="16" class="badge" :class="{ ready: plot.ready }" />
        <text class="badge-text">{{ plot.level > 0 ? plot.level : '+' }}</text>
      </g>
      <text class="map-label" y="74">{{ plot.building.name }}</text>
      <g v-if="plot.works" transform="translate(-50 88)">
        <rect width="100" height="9" rx="4.5" class="bar" />
        <rect :width="100 * plot.progress" height="9" rx="4.5" class="bar-fill" />
      </g>
      <g v-else-if="plot.building.id === 'dragonRoost' && lair?.progress != null" transform="translate(-50 88)">
        <rect width="100" height="9" rx="4.5" class="bar" />
        <rect :width="100 * lair.progress" height="9" rx="4.5" class="bar-fill hatch" />
      </g>
      <text v-else-if="plot.locked" class="map-sublabel" y="96">
        Château niv. {{ plot.building.unlockedAtCastleLevel }}
      </text>
    </g>

    <!-- La garnison : les troupes au repos dans la cité -->
    <g
      class="spot"
      :class="{ selected: selection?.kind === 'garrison' }"
      :transform="`translate(${CITY_SPOTS.garrison.x} ${CITY_SPOTS.garrison.y})`"
      role="button"
      tabindex="0"
      :aria-label="`Garnison : ${garrison} troupes dans la cité`"
      :aria-pressed="selection?.kind === 'garrison'"
      @click.stop="emit('select', { kind: 'garrison' })"
      @keydown.enter.prevent="emit('select', { kind: 'garrison' })"
      @keydown.space.prevent="emit('select', { kind: 'garrison' })"
    >
      <ellipse class="spot-base" rx="44" ry="17" cy="24" />
      <ellipse class="spot-ring" rx="54" ry="23" cy="24" />
      <text class="emoji" font-size="46">🪖</text>
      <g transform="translate(-34 -26)">
        <rect :x="-pill(garrison) / 2" y="-14" :width="pill(garrison)" height="28" rx="14" class="badge" />
        <text class="badge-text">{{ garrison }}</text>
      </g>
      <text class="map-label" y="56">Garnison</text>
    </g>

    <!-- Les héros -->
    <g
      class="spot"
      :class="{ selected: selection?.kind === 'heroes' }"
      :transform="`translate(${CITY_SPOTS.heroes.x} ${CITY_SPOTS.heroes.y})`"
      role="button"
      tabindex="0"
      :aria-label="`Héros : ${heroes.count} à ton service${heroes.ready ? ', un point de compétence à placer' : ''}`"
      :aria-pressed="selection?.kind === 'heroes'"
      @click.stop="emit('select', { kind: 'heroes' })"
      @keydown.enter.prevent="emit('select', { kind: 'heroes' })"
      @keydown.space.prevent="emit('select', { kind: 'heroes' })"
    >
      <ellipse class="spot-base" rx="44" ry="17" cy="24" />
      <ellipse class="spot-ring" rx="54" ry="23" cy="24" />
      <text class="emoji" font-size="46">👑</text>
      <g transform="translate(34 -26)">
        <circle r="16" class="badge" :class="{ ready: heroes.ready }" />
        <text class="badge-text">{{ heroes.count }}</text>
      </g>
      <text class="map-label" y="56">Héros</text>
    </g>

    <!-- Le siège : les monstres devant la porte sud. Le toucher ouvre la défense de la cité. -->
    <g
      v-if="siege"
      class="spot siege"
      :transform="`translate(${CITY_SIEGE.x} ${CITY_SIEGE.y})`"
      role="button"
      tabindex="0"
      :aria-label="`La cité est assiégée : manche ${siege.round}. Voir la défense de la cité.`"
      @click.stop="emit('select', { kind: 'building', id: 'walls' })"
      @keydown.enter.prevent="emit('select', { kind: 'building', id: 'walls' })"
      @keydown.space.prevent="emit('select', { kind: 'building', id: 'walls' })"
    >
      <ellipse class="spot-base siege-base" rx="70" ry="24" cy="26" />
      <ellipse class="spot-ring" rx="82" ry="31" cy="26" />
      <g :key="`siege-hit-${siege.city.round}`" :class="{ hit: siege.city.round > 0 }">
        <text class="emoji" font-size="54" x="-28">{{ siege.icon }}</text>
      </g>
      <g :key="`siege-bump-${siege.city.round}`" class="bump">
        <text class="emoji" font-size="40" x="34" y="-6">⚔️</text>
      </g>
      <text class="map-label siege-label" y="66">
        Siège · manche {{ siege.round }}{{ siege.raids > 1 ? ` · ${siege.raids} raids` : '' }}
      </text>
      <!-- La vie des deux camps : tes défenseurs (en doré), puis les monstres (en rouge) -->
      <HealthBar :ratio="siege.city.ratio" :y="-72" :width="104" />
      <HealthBar :ratio="siege.foe.ratio" :y="-57" :width="104" foe />
      <text v-if="siege.city.taken > 0" :key="`siege-taken-${siege.city.round}`" class="float-damage ally" x="-36" y="-92">
        −{{ formatShort(siege.city.taken) }}
      </text>
      <text v-if="siege.city.healed > 0" :key="`siege-healed-${siege.city.round}`" class="float-damage heal" x="-36" y="-116">
        +{{ formatShort(siege.city.healed) }}
      </text>
      <text v-if="siege.foe.taken > 0" :key="`siege-dealt-${siege.city.round}`" class="float-damage foe" x="36" y="-92">
        −{{ formatShort(siege.foe.taken) }}
      </text>
    </g>
  </MapViewport>
</template>

<style scoped>
/* L'enceinte : une palissade en pointillés, puis un mur plein quand les Remparts sont construits. */
.wall {
  fill: none;
  stroke: var(--map-wall);
  stroke-dasharray: 26 10;
}

.wall.built {
  stroke: var(--map-rock);
  stroke-dasharray: none;
}

/*
 * Pendant un siège, une lueur rouge bat autour du mur. Elle couvre presque toute la cité : en deux
 * temps seulement (steps), sinon un téléphone modeste la repeint à chaque image et ralentit.
 */
.wall-alarm {
  fill: none;
  stroke: var(--ember);
  opacity: 0.45;
  pointer-events: none;
  animation: wall-alarm 1.2s steps(2, jump-none) infinite alternate;
}

@keyframes wall-alarm {
  from {
    opacity: 0.2;
  }
  to {
    opacity: 0.6;
  }
}

/* Les créneaux, par-dessus le mur. */
.merlons {
  fill: none;
  stroke: var(--map-rock-light);
  stroke-dasharray: 10 8;
  pointer-events: none;
}

.siege-base {
  fill: var(--map-aggro-badge);
  stroke: var(--ember);
  stroke-width: 3;
}

.siege-label {
  fill: var(--ember);
}

.road {
  stroke: var(--map-road);
  stroke-width: 14;
  stroke-linecap: round;
  opacity: 0.85;
}

/* Les bas-côtés des routes. */
.road-edge {
  stroke: var(--map-road-edge);
  stroke-width: 22;
  stroke-linecap: round;
  opacity: 0.5;
}

/* Le marteau d'un chantier frappe sans relâche. */
.hammer {
  transform-box: fill-box;
  transform-origin: 85% 85%;
  animation: hammer 0.7s ease-in-out infinite;
}

@keyframes hammer {
  0%,
  100% {
    transform: rotate(0deg);
  }
  45% {
    transform: rotate(-38deg);
  }
}

/* Ce qu'un bâtiment produit s'envole de temps en temps. */
.puff {
  opacity: 0;
  pointer-events: none;
  animation: puff 4.6s ease-out infinite;
}

@keyframes puff {
  0% {
    opacity: 0;
    transform: translateY(0);
  }
  12% {
    opacity: 0.95;
  }
  55%,
  100% {
    opacity: 0;
    transform: translateY(-48px);
  }
}

/* L'œuf de dragon remue ; le dragon respire, endormi s'il se repose. */
.wobble {
  transform-box: fill-box;
  transform-origin: 50% 90%;
  animation: wobble 1.6s ease-in-out infinite;
}

@keyframes wobble {
  0%,
  60%,
  100% {
    transform: rotate(0deg);
  }
  70% {
    transform: rotate(-12deg);
  }
  80% {
    transform: rotate(10deg);
  }
  90% {
    transform: rotate(-5deg);
  }
}

.breathe {
  transform-box: fill-box;
  transform-origin: 50% 80%;
  animation: breathe 3s ease-in-out infinite;
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
}

/* Le dragon blessé dort : ses 💤 vont et viennent, sans jamais disparaître. */
.zzz {
  animation: snooze 2.6s ease-in-out infinite alternate;
}

@keyframes snooze {
  from {
    opacity: 0.55;
  }
  to {
    opacity: 1;
  }
}

.bar-fill.hatch {
  fill: var(--ember);
}

/* Le puits de mana luit doucement. */
.mana-glow {
  fill: #9a7bff;
  opacity: 0.14;
  animation: glow 2.6s ease-in-out infinite alternate;
}

@keyframes glow {
  from {
    opacity: 0.08;
  }
  to {
    opacity: 0.3;
  }
}

/* Un bâtiment au travail : les épées de la Caserne s'agitent, les étincelles de l'Académie et de la
   Tour des mages brillent. */
.busy {
  transform-box: fill-box;
  transform-origin: center;
  animation: busy 1.1s ease-in-out infinite alternate;
}

@keyframes busy {
  from {
    transform: rotate(-12deg) scale(0.9);
    opacity: 0.7;
  }
  to {
    transform: rotate(12deg) scale(1.1);
    opacity: 1;
  }
}

.field {
  fill: var(--map-field);
}

.field-line {
  stroke: var(--map-field-line);
  stroke-width: 3;
}
</style>
