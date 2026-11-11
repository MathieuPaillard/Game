<script setup lang="ts">
import { RACES, type RaceId } from '../game/config'

const emit = defineEmits<{ choose: [race: RaceId] }>()
</script>

<template>
  <main class="wrap choose">
    <header class="choose-head">
      <p class="eyebrow">Nouvelle partie</p>
      <h1>Choisis ta race</h1>
      <p class="muted">Chaque peuple a ses forces. Ton choix vaut pour toute la partie.</p>
    </header>

    <ul class="races">
      <li v-for="race in RACES" :key="race.id" class="race">
        <h2>{{ race.name }}</h2>
        <p class="race-style">{{ race.style }}</p>
        <p class="muted">{{ race.description }}</p>
        <ul class="race-bonuses">
          <li v-for="bonus in race.bonuses" :key="bonus">{{ bonus }}</li>
        </ul>
        <button class="btn" type="button" @click="emit('choose', race.id)">Jouer les {{ race.name }}</button>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.choose {
  padding-block: 2.5rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.choose-head {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 40rem;
}

.eyebrow {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--gilt);
}

.races {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
}

@media (min-width: 36rem) {
  .races {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 60rem) {
  .races {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.race {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.1rem;
  background: var(--stone);
  border: 1px solid var(--seam);
  border-radius: var(--radius);
}

.race h2 {
  font: 700 1.9rem/1 var(--font-display);
}

.race-style {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--gilt);
}

.race-bonuses {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.race .btn {
  margin-top: auto;
}
</style>
