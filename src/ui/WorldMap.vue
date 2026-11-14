<script setup lang="ts">
import { computed } from 'vue'
import { CAMPS, WORLD, type MonsterId } from '../game/config'
import {
  aggroRadius,
  armySize,
  bandsOnPath,
  expeditionPosition,
  getBandKind,
  getMonster,
  sameTarget,
  targetPosition,
  type GameState,
  type Monsters,
  type Target,
} from '../game/rules'
import MapViewport from './MapViewport.vue'
import { formatDuration } from './format'
import { WORLD_DECOR, WORLD_MAP, mountainLight, mountainPoints } from './maps'

// Les alentours de la cité : les camps, les bandes de monstres et leurs zones d'aggro, et les armées
// en marche. Toucher un camp ou une bande le sélectionne.
const props = defineProps<{ state: GameState; now: number; selected: Target; cityName: string }>()
const emit = defineEmits<{ select: [target: Target] }>()

const city = WORLD.city

/** L'icône d'un groupe de monstres : celle du premier monstre encore debout. */
function iconOf(monsters: Monsters): string {
  const first = (Object.keys(monsters) as MonsterId[]).find((id) => (monsters[id] ?? 0) > 0)
  return first ? getMonster(first).icon : '❔'
}

const isTargeted = (target: Target) => props.state.expeditions.some((e) => sameTarget(e.target, target))

// Les bandes dont l'armée traverserait la zone d'aggro pour atteindre la cible choisie.
const crossed = computed(() => new Set(bandsOnPath(props.state, props.selected).map((band) => band.id)))

const bands = computed(() =>
  props.state.bands.map((band) => ({
    key: `band-${band.id}`,
    target: { type: 'band', band: band.id } as Target,
    ...band.position,
    radius: aggroRadius(band.level),
    crossed: crossed.value.has(band.id),
  })),
)

// Les camps et les bandes, du haut vers le bas de la carte : ceux du bas passent devant.
const spots = computed(() =>
  [
    ...CAMPS.map((camp) => ({
      key: camp.id,
      target: { type: 'camp', camp: camp.id } as Target,
      ...camp.position,
      isBand: false,
      name: camp.name,
      level: camp.level,
      icon: iconOf(camp.defenders),
    })),
    ...props.state.bands.map((band) => ({
      key: `band-${band.id}`,
      target: { type: 'band', band: band.id } as Target,
      ...band.position,
      isBand: true,
      name: getBandKind(band.kind).name,
      level: band.level,
      icon: iconOf(band.monsters),
    })),
  ]
    .map((spot) => ({ ...spot, selected: sameTarget(spot.target, props.selected), targeted: isTargeted(spot.target) }))
    .sort((a, b) => a.y - b.y),
)

// La route que prendrait une armée vers la cible choisie.
const route = computed(() => {
  const to = targetPosition(props.state, props.selected)
  return to && { x1: city.x, y1: city.y, x2: to.x, y2: to.y }
})

// Chaque armée avance en ligne droite, selon l'heure.
const armies = computed(() =>
  props.state.expeditions.map((expedition) => {
    const end = expedition.returning ? expedition.returnsAt : expedition.arrivesAt
    return {
      key: expedition.id,
      ...expeditionPosition(expedition, props.now),
      label: `${expedition.returning ? 'Retour' : 'Aller'} · ${formatDuration(end - props.now)}`,
      size: armySize(expedition.troops),
    }
  }),
)

function describe(spot: (typeof spots.value)[number]): string {
  const what = spot.isBand ? `bande de monstres, niveau ${spot.level}` : `camp de niveau ${spot.level}`
  return `${spot.name}, ${what}${spot.targeted ? ', une armée y est envoyée' : ''}`
}
</script>

<template>
  <MapViewport
    :width="WORLD_MAP.width"
    :height="WORLD_MAP.height"
    :center="WORLD_MAP.center"
    :span="1100"
    label="Carte des alentours"
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

    <!-- Les zones d'aggro : une armée qui y entre est attaquée -->
    <circle
      v-for="band in bands"
      :key="`aggro-${band.key}`"
      :cx="band.x"
      :cy="band.y"
      :r="band.radius"
      class="aggro"
      :class="{ crossed: band.crossed }"
    />

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

    <!-- La route vers la cible choisie -->
    <line v-if="route" v-bind="route" class="route" />

    <!-- La cité -->
    <g :transform="`translate(${city.x} ${city.y})`" aria-hidden="true">
      <ellipse class="spot-base" rx="84" ry="32" cy="46" />
      <text class="emoji" font-size="104">🏰</text>
      <text class="map-label" y="100">{{ cityName }}</text>
    </g>

    <!-- Les camps et les bandes -->
    <g
      v-for="spot in spots"
      :key="spot.key"
      class="spot"
      :class="{ selected: spot.selected, band: spot.isBand }"
      :transform="`translate(${spot.x} ${spot.y})`"
      role="button"
      tabindex="0"
      :aria-label="describe(spot)"
      :aria-pressed="spot.selected"
      @click="emit('select', spot.target)"
      @keydown.enter.prevent="emit('select', spot.target)"
      @keydown.space.prevent="emit('select', spot.target)"
    >
      <template v-if="spot.isBand">
        <ellipse class="spot-base band-base" rx="40" ry="16" cy="24" />
        <ellipse class="spot-ring" rx="50" ry="22" cy="24" />
        <text class="emoji" font-size="50">{{ spot.icon }}</text>
        <g transform="translate(30 -26)">
          <circle r="15" class="badge level" />
          <text class="badge-text">{{ spot.level }}</text>
        </g>
        <text class="map-label" y="58">{{ spot.name }}</text>
      </template>
      <template v-else>
        <ellipse class="spot-base camp-base" rx="66" ry="26" cy="32" />
        <ellipse class="spot-ring" rx="78" ry="33" cy="32" />
        <text class="emoji" font-size="70">{{ spot.icon }}</text>
        <text class="map-label" y="74">{{ spot.name }}</text>
        <text class="map-sublabel" y="98">Niveau {{ spot.level }}</text>
      </template>
      <g v-if="spot.targeted" :transform="spot.isBand ? 'translate(-30 -26)' : 'translate(40 -38)'">
        <circle r="18" class="badge ready" />
        <text class="emoji" font-size="20">⚔️</text>
      </g>
    </g>

    <!-- Les armées en marche -->
    <g
      v-for="army in armies"
      :key="army.key"
      class="army"
      :style="{ transform: `translate(${army.x}px, ${army.y}px)` }"
      aria-hidden="true"
    >
      <circle r="26" class="army-dot" />
      <text class="emoji" font-size="30">🚩</text>
      <text class="map-label" y="-44">{{ army.size }} · {{ army.label }}</text>
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

.band-base {
  fill: var(--map-camp);
  opacity: 0.85;
}

/* Une zone d'aggro : un cercle rouge, plus marqué s'il coupe la route vers la cible choisie. */
.aggro {
  fill: var(--map-aggro);
  stroke: var(--ember);
  stroke-width: 3;
  stroke-dasharray: 12 9;
  opacity: 0.8;
}

.aggro.crossed {
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

.badge.level {
  fill: var(--map-aggro-badge);
  stroke: var(--ember);
}

.army {
  transition: transform 1s linear;
}

.army-dot {
  fill: var(--gilt);
  stroke: var(--gilt-deep);
  stroke-width: 3;
}
</style>
