<script setup lang="ts">
import { RESOURCES, RESOURCE_IDS, type Resources } from '../game/config'
import { formatRate, formatShort } from './format'

// Le registre des ressources, en haut de l'écran de jeu.
// `rates` : ce que la cité gagne vraiment par heure (production moins entretien des troupes).
defineProps<{ resources: Resources; rates: Resources }>()
</script>

<template>
  <ul class="ledger" aria-label="Ressources">
    <li v-for="id in RESOURCE_IDS" :key="id" class="res">
      <span class="res-icon" aria-hidden="true">{{ RESOURCES[id].icon }}</span>
      <span class="res-text">
        <span class="sr-only">{{ RESOURCES[id].name }} :</span>
        <span class="res-amount">{{ formatShort(resources[id]) }}</span>
        <span class="res-rate" :class="{ negative: rates[id] < -0.5 }">{{ formatRate(rates[id]) }}</span>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.ledger {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  justify-content: flex-end;
  gap: 0.2rem clamp(0.5rem, 2vw, 1.4rem);
  min-width: 0;
}

.res {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.res-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.res-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.res-amount {
  font-size: 0.98rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.res-rate {
  font-size: 0.7rem;
  color: var(--faded);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* La nourriture baisse : l'entretien des troupes dépasse la production. */
.res-rate.negative {
  color: var(--ember);
  font-weight: 700;
}

/* Écran étroit (téléphone tenu en hauteur) : chaque ressource sur une colonne, l'icône au-dessus. */
@media (max-width: 34rem) {
  .ledger {
    flex: 1;
    justify-content: space-between;
    gap: 0.2rem;
  }

  .res {
    flex-direction: column;
    gap: 0.05rem;
    text-align: center;
  }

  .res-text {
    align-items: center;
  }

  .res-amount {
    font-size: 0.9rem;
  }
}
</style>
