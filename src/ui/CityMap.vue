<script setup lang="ts">
import { computed } from 'vue'
import { BUILDINGS, type BuildingId } from '../game/config'
import { checkUpgrade, type GameState } from '../game/rules'
import MapViewport from './MapViewport.vue'
import { CITY_DECOR, CITY_MAP, CITY_PLOTS, CITY_WALL, mountainLight, mountainPoints } from './maps'

// La cité vue d'en haut : chaque bâtiment sur son emplacement. Toucher un bâtiment le sélectionne.
const props = defineProps<{ state: GameState; now: number; selected: BuildingId }>()
const emit = defineEmits<{ select: [building: BuildingId] }>()

// Les bâtiments du bas de la carte sont dessinés en dernier, pour passer devant ceux du haut.
const plots = computed(() =>
  BUILDINGS.map((building) => {
    const level = props.state.levels[building.id]
    const works = props.state.construction?.building === building.id ? props.state.construction : null
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
    }
  }).sort((a, b) => a.y - b.y),
)

const roads = BUILDINGS.filter((b) => b.id !== 'castle').map((b) => ({
  id: b.id,
  from: CITY_PLOTS.castle,
  to: CITY_PLOTS[b.id],
}))

function describe(plot: (typeof plots.value)[number]): string {
  const name = plot.building.name
  if (plot.locked) return `${name} : se débloque au Château niveau ${plot.building.unlockedAtCastleLevel}`
  if (plot.level === 0) return `${name} : pas encore construit`
  return `${name} : niveau ${plot.level}${plot.works ? ', en construction' : ''}`
}
</script>

<template>
  <MapViewport
    :width="CITY_MAP.width"
    :height="CITY_MAP.height"
    :center="CITY_MAP.center"
    :span="800"
    label="Carte de la cité"
  >
    <defs>
      <pattern id="city-field" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(-14)">
        <rect width="16" height="16" class="field" />
        <line x1="0" y1="8" x2="16" y2="8" class="field-line" />
      </pattern>
    </defs>

    <!-- Le décor -->
    <rect :width="CITY_MAP.width" :height="CITY_MAP.height" class="ground" />
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
    <ellipse :cx="CITY_WALL.cx" :cy="CITY_WALL.cy" :rx="CITY_WALL.rx" :ry="CITY_WALL.ry" class="wall" />
    <line
      v-for="road in roads"
      :key="`road-${road.id}`"
      :x1="road.from.x"
      :y1="road.from.y"
      :x2="road.to.x"
      :y2="road.to.y"
      class="road"
    />
    <g v-for="(mountain, i) in CITY_DECOR.mountains" :key="`mountain-${i}`">
      <polygon :points="mountainPoints(mountain)" class="rock" />
      <polygon :points="mountainLight(mountain)" class="rock-light" />
    </g>
    <text
      v-for="(tree, i) in CITY_DECOR.trees"
      :key="`tree-${i}`"
      :x="tree.x"
      :y="tree.y"
      :font-size="40 * tree.size"
      class="emoji"
      aria-hidden="true"
    >
      🌲
    </text>

    <!-- Les bâtiments -->
    <g
      v-for="plot in plots"
      :key="plot.building.id"
      class="spot"
      :class="{ selected: plot.building.id === selected, locked: plot.locked, empty: plot.level === 0 }"
      :transform="`translate(${plot.x} ${plot.y}) scale(${plot.size})`"
      role="button"
      tabindex="0"
      :aria-label="describe(plot)"
      :aria-pressed="plot.building.id === selected"
      @click="emit('select', plot.building.id)"
      @keydown.enter.prevent="emit('select', plot.building.id)"
      @keydown.space.prevent="emit('select', plot.building.id)"
    >
      <ellipse class="spot-base" rx="66" ry="26" cy="32" />
      <ellipse class="spot-ring" rx="78" ry="33" cy="32" />
      <text class="emoji spot-icon" font-size="70">{{ plot.building.icon }}</text>
      <text v-if="plot.locked" class="emoji" font-size="32">🔒</text>
      <text v-if="plot.works" class="emoji" font-size="30" x="-44" y="-34">🔨</text>
      <g v-if="plot.level > 0 || plot.ready" transform="translate(38 -36)">
        <circle r="16" class="badge" :class="{ ready: plot.ready }" />
        <text class="badge-text">{{ plot.level > 0 ? plot.level : '+' }}</text>
      </g>
      <text class="map-label" y="74">{{ plot.building.name }}</text>
      <g v-if="plot.works" transform="translate(-50 88)">
        <rect width="100" height="9" rx="4.5" class="bar" />
        <rect :width="100 * plot.progress" height="9" rx="4.5" class="bar-fill" />
      </g>
      <text v-else-if="plot.locked" class="map-sublabel" y="96">
        Château niv. {{ plot.building.unlockedAtCastleLevel }}
      </text>
    </g>
  </MapViewport>
</template>

<style scoped>
.wall {
  fill: none;
  stroke: var(--map-wall);
  stroke-width: 10;
  stroke-dasharray: 26 10;
}

.road {
  stroke: var(--map-road);
  stroke-width: 14;
  stroke-linecap: round;
  opacity: 0.85;
}

.field {
  fill: var(--map-field);
}

.field-line {
  stroke: var(--map-field-line);
  stroke-width: 3;
}
</style>
