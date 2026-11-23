<script setup lang="ts">
import { HEROES, type HeroId } from '../game/config'
import type { GameState } from '../game/rules'
import HeroCard from './HeroCard.vue'

defineProps<{ state: GameState }>()
const emit = defineEmits<{ recruit: [hero: HeroId]; learn: [hero: HeroId, skill: string] }>()
</script>

<template>
  <section class="heroes" aria-labelledby="heroes-title">
    <h2 id="heroes-title" class="section-title">Héros</h2>
    <p class="muted">
      Un héros mène une armée : tu le choisis au moment d’envoyer tes troupes, en touchant une cible aux alentours. Il
      gagne de l’expérience pour chaque monstre vaincu, et chaque niveau lui donne un point de compétence à
      placer. Il ne meurt jamais : si son armée tombe, il revient à la cité.
    </p>
    <div class="grid">
      <HeroCard
        v-for="hero in HEROES"
        :key="hero.id"
        :hero="hero"
        :state="state"
        @recruit="emit('recruit', hero.id)"
        @learn="(skill) => emit('learn', hero.id, skill)"
      />
    </div>
  </section>
</template>

<style scoped>
.heroes {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
