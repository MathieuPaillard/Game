<script setup lang="ts">
import { computed } from 'vue'
import { CAMPS, type CampId, type MonsterId } from '../game/config'
import { armySize, getMonster, type GameState } from '../game/rules'
import MapViewport from './MapViewport.vue'
import { formatDuration } from './format'
import { CAMP_SPOTS, WORLD_CITY, WORLD_DECOR, WORLD_MAP, mountainLight, mountainPoints } from './maps'

// Les alentours de la cité : les camps de monstres, et les armées en marche.
const props = defineProps<{ state: GameState; now: number; selected: CampId; cityName: string }>()
const emit = defineEmits<{ select: [camp: CampId] }>()

const camps = computed(() =>
  CAMPS.map((camp) => ({
    camp,
    ...CAMP_SPOTS[camp.id],
    icon: getMonster(Object.keys(camp.defenders)[0] as MonsterId).icon,
    targeted: props.state.expeditions.some((e) => e.camp === camp.id),
  })).sort((a, b) => a.y - b.y),
)

// Chaque armée avance en ligne droite entre la cité et son camp, selon l'heure.
const armies = computed(() =>
  props.state.expeditions.map((expedition) => {
    const spot = CAMP_SPOTS[expedition.camp]
    const outward = !expedition.result
    const start = outward ? expedition.departedAt : expedition.arrivesAt
    const end = outward ? expedition.arrivesAt : expedition.returnsAt
    const t = Math.min(1, Math.max(0, (props.now - start) / (end - start)))
    const from = outward ? WORLD_CITY : spot
    const to = outward ? spot : WORLD_CITY
    return {
      key: expedition.camp,
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      label: `${outward ? 'Aller' : 'Retour'} · ${formatDuration(end - props.now)}`,
      size: armySize(expedition.result?.survivors ?? expedition.troops),
    }
  }),
)
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
    <ellipse :cx="WORLD_CITY.x" :cy="WORLD_CITY.y" rx="260" ry="190" class="meadow" />
    <path :d="WORLD_DECOR.river" class="river" />
    <path :d="WORLD_DECOR.river" class="river-light" />
    <ellipse v-bind="WORLD_DECOR.lake" class="water" />
    <ellipse v-for="(marsh, i) in WORLD_DECOR.marshes" :key="`marsh-${i}`" v-bind="marsh" class="marsh" />
    <line
      v-for="spot in camps"
      :key="`road-${spot.camp.id}`"
      :x1="WORLD_CITY.x"
      :y1="WORLD_CITY.y"
      :x2="spot.x"
      :y2="spot.y"
      class="trail"
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

    <!-- La cité -->
    <g :transform="`translate(${WORLD_CITY.x} ${WORLD_CITY.y})`" aria-hidden="true">
      <ellipse class="spot-base" rx="84" ry="32" cy="46" />
      <text class="emoji" font-size="104">🏰</text>
      <text class="map-label" y="100">{{ cityName }}</text>
    </g>

    <!-- Les camps -->
    <g
      v-for="spot in camps"
      :key="spot.camp.id"
      class="spot"
      :class="{ selected: spot.camp.id === selected }"
      :transform="`translate(${spot.x} ${spot.y})`"
      role="button"
      tabindex="0"
      :aria-label="`${spot.camp.name}, niveau ${spot.camp.level}${spot.targeted ? ', une armée y est envoyée' : ''}`"
      :aria-pressed="spot.camp.id === selected"
      @click="emit('select', spot.camp.id)"
      @keydown.enter.prevent="emit('select', spot.camp.id)"
      @keydown.space.prevent="emit('select', spot.camp.id)"
    >
      <ellipse class="spot-base camp-base" rx="66" ry="26" cy="32" />
      <ellipse class="spot-ring" rx="78" ry="33" cy="32" />
      <text class="emoji" font-size="70">{{ spot.icon }}</text>
      <g v-if="spot.targeted" transform="translate(40 -38)">
        <circle r="18" class="badge ready" />
        <text class="emoji" font-size="20">⚔️</text>
      </g>
      <text class="map-label" y="74">{{ spot.camp.name }}</text>
      <text class="map-sublabel" y="98">Niveau {{ spot.camp.level }}</text>
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

.army {
  transition: transform 1s linear;
}

.army-dot {
  fill: var(--gilt);
  stroke: var(--gilt-deep);
  stroke-width: 3;
}
</style>
