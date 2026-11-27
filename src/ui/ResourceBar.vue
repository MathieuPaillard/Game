<script setup lang="ts">
import { RESOURCES, RESOURCE_IDS, type ResourceId, type Resources } from '../game/config'
import { formatAmount, formatRate, formatShort } from './format'

// Le registre des ressources, en haut de l'écran de jeu.
// `rates` : ce que la cité gagne vraiment par heure (production moins entretien des troupes).
// `capacity` : ce que gardent les réserves de chaque ressource (l'Entrepôt) ; pleine, une réserve ne grandit plus.
const props = defineProps<{ resources: Resources; rates: Resources; capacity: number }>()

/** La réserve est pleine et sa production s'arrête (une réserve qui baisse ne l'est plus pour longtemps). */
function full(id: ResourceId): boolean {
  return props.resources[id] >= props.capacity && props.rates[id] > 0
}

/** Ce que la réserve remplit de sa place, de 0 à 1. */
function fill(id: ResourceId): number {
  return Math.min(1, props.resources[id] / props.capacity)
}
</script>

<template>
  <ul class="ledger" aria-label="Ressources">
    <li
      v-for="id in RESOURCE_IDS"
      :key="id"
      class="res"
      :class="{ full: full(id), nearly: fill(id) >= 0.9 }"
      :title="`${RESOURCES[id].name} : ${formatAmount(resources[id])} sur ${formatAmount(capacity)} (Entrepôt)`"
    >
      <span class="res-icon" aria-hidden="true">{{ RESOURCES[id].icon }}</span>
      <span class="res-text">
        <span class="sr-only">{{ RESOURCES[id].name }} :</span>
        <span class="res-amount">{{ formatShort(resources[id]) }}</span>
        <span class="sr-only">sur {{ formatAmount(capacity) }}</span>
        <span v-if="full(id)" class="res-rate">plein</span>
        <span v-else class="res-rate" :class="{ negative: rates[id] < -0.5 }">{{ formatRate(rates[id]) }}</span>
        <span class="res-room" aria-hidden="true"><span :style="{ width: `${fill(id) * 100}%` }"></span></span>
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

/* La place de la réserve : un mince trait qui se remplit. */
.res-room {
  display: block;
  height: 2px;
  margin-top: 2px;
  border-radius: 1px;
  background: var(--seam);
  overflow: hidden;
}

.res-room > span {
  display: block;
  height: 100%;
  background: var(--faded);
}

/* Presque pleine, puis pleine : la production va s'arrêter, puis s'arrête. Il faut agrandir l'Entrepôt. */
.res.nearly .res-room > span {
  background: var(--gilt);
}

.res.full .res-amount,
.res.full .res-rate {
  color: var(--gilt);
}

.res.full .res-rate {
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

  .res-room {
    align-self: stretch;
  }

  .res-amount {
    font-size: 0.9rem;
  }
}
</style>
