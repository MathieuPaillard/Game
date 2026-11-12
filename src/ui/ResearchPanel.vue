<script setup lang="ts">
import { TECHS, type TechId } from '../game/config'
import type { GameState } from '../game/rules'
import TechCard from './TechCard.vue'

defineProps<{ state: GameState; now: number }>()
const emit = defineEmits<{ research: [tech: TechId] }>()
</script>

<template>
  <section class="research" aria-labelledby="research-title">
    <h2 id="research-title" class="section-title">Recherches</h2>

    <p v-if="state.levels.academy === 0" class="notice">
      Pour faire des recherches, construis d’abord l’Académie dans l’onglet Cité. Elle se débloque au Château
      niveau 3.
    </p>

    <template v-else>
      <p class="muted">
        Académie niveau {{ state.levels.academy }} : une recherche à la fois, et aucune recherche ne peut dépasser
        le niveau de l’Académie.
      </p>
      <div class="grid">
        <TechCard
          v-for="tech in TECHS"
          :key="tech.id"
          :tech="tech"
          :state="state"
          :now="now"
          @research="emit('research', tech.id)"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.research {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
