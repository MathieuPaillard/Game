<script setup lang="ts">
import { ONLINE_AVAILABLE } from './api'

// Où est gardée la partie : sur le serveur (joueur connecté), ou sur cet appareil.
defineProps<{ player: string | null }>()
const emit = defineEmits<{ logout: []; goOnline: [] }>()
</script>

<template>
  <p v-if="player" class="account-line">
    <span>Ton compte : <strong>{{ player }}</strong>. Ta partie est gardée sur le serveur.</span>
    <button class="btn-quiet" type="button" @click="emit('logout')">Se déconnecter</button>
  </p>
  <p v-else-if="ONLINE_AVAILABLE" class="account-line">
    <span>Partie sans compte, gardée sur cet appareil.</span>
    <button class="btn-quiet" type="button" @click="emit('goOnline')">Jouer en ligne</button>
  </p>
</template>

<style scoped>
.account-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.75rem;
  color: var(--faded);
}

.account-line strong {
  color: var(--parchment);
}
</style>
