<script setup lang="ts">
import { RESOURCES, RESOURCE_IDS, type Resources } from '../game/config'
import { formatShort } from './format'

defineProps<{ resources: Resources; production: Resources }>()
</script>

<template>
  <div class="ledger">
    <ul class="wrap ledger-row" aria-label="Ressources">
      <li v-for="id in RESOURCE_IDS" :key="id" class="res">
        <span class="res-head">
          <span class="res-icon" aria-hidden="true">{{ RESOURCES[id].icon }}</span>
          <span class="res-name">{{ RESOURCES[id].name }}</span>
        </span>
        <span class="res-amount">{{ formatShort(resources[id]) }}</span>
        <span class="res-rate">+{{ formatShort(production[id]) }}/h</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ledger {
  position: sticky;
  top: env(safe-area-inset-top, 0px);
  z-index: 5;
  background: var(--stone-raised);
  border-bottom: 1px solid var(--seam);
}

.ledger-row {
  list-style: none;
  margin-block: 0;
  padding-block: 0.6rem;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.5rem;
}

.res {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  min-width: 0;
  text-align: center;
}

.res-head {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.res-icon {
  font-size: 1.25rem;
  line-height: 1.2;
}

.res-name {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--faded);
}

.res-amount {
  font-size: 1.05rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.res-rate {
  font-size: 0.75rem;
  color: var(--faded);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Sur téléphone, on ne garde que l'icône : le nom reste lisible par les lecteurs d'écran. */
@media (max-width: 39.99rem) {
  .res-name {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
}
</style>
