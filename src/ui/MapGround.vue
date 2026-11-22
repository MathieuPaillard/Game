<script setup lang="ts">
import type { Patch } from './maps'

// Le sol d'une carte : la couleur de la campagne, des taches plus claires ou plus sombres, et des
// touffes d'herbe dessinées en motif. Le tout reste discret, sous le reste du décor.
defineProps<{ id: string; width: number; height: number; patches: Patch[] }>()
</script>

<template>
  <defs>
    <pattern :id="`${id}-grass`" width="96" height="96" patternUnits="userSpaceOnUse">
      <path
        class="tuft"
        d="M8 20 l3 -9 M13 20 l1 -10 M17 20 l-2 -8
           M52 46 l3 -8 M57 46 l1 -9 M61 46 l-2 -7
           M28 78 l2 -7 M32 78 l1 -8
           M78 18 l2 -6 M82 18 l1 -7
           M84 80 l3 -8 M89 80 l1 -9"
      />
      <circle cx="40" cy="24" r="1.8" class="speck" />
      <circle cx="70" cy="62" r="1.5" class="speck" />
      <circle cx="12" cy="56" r="1.6" class="speck" />
      <circle cx="60" cy="90" r="1.4" class="speck" />
    </pattern>
  </defs>
  <rect :width="width" :height="height" class="ground" />
  <ellipse
    v-for="(patch, i) in patches"
    :key="`patch-${i}`"
    :cx="patch.cx"
    :cy="patch.cy"
    :rx="patch.rx"
    :ry="patch.ry"
    :class="patch.light ? 'patch-light' : 'patch-dark'"
  />
  <rect :width="width" :height="height" :fill="`url(#${id}-grass)`" class="grass" />
</template>
