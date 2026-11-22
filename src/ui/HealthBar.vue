<script setup lang="ts">
import { computed } from 'vue'

// Une petite barre de vie, posée sur la carte au-dessus d'un combattant : dorée pour tes troupes,
// rouge pour les monstres. Elle se vide doucement à chaque manche.
const props = withDefaults(defineProps<{ ratio: number; y: number; foe?: boolean; width?: number }>(), {
  foe: false,
  width: 64,
})
const scale = computed(() => Math.min(1, Math.max(0, props.ratio)))
</script>

<template>
  <g class="health" :transform="`translate(${-width / 2} ${y})`" aria-hidden="true">
    <rect :width="width" height="10" rx="5" class="health-back" />
    <rect
      :width="width"
      height="10"
      rx="5"
      class="health-fill"
      :class="{ foe }"
      :style="{ transform: `scaleX(${scale})` }"
    />
  </g>
</template>
