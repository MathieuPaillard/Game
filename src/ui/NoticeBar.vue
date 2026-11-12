<script setup lang="ts">
// Les messages du serveur : une connexion perdue, ou un ordre refusé.
defineProps<{ notice: string | null; offline: boolean }>()
const emit = defineEmits<{ dismiss: [] }>()
</script>

<template>
  <p v-if="offline" class="notice" role="status">
    <span>
      <strong>Connexion perdue.</strong> Le serveur ne répond pas : le jeu réessaie tout seul. Tes derniers ordres
      ne lui sont peut-être pas parvenus.
    </span>
  </p>
  <p v-if="notice" class="notice" role="alert">
    <span>{{ notice }}</span>
    <button class="btn-quiet" type="button" @click="emit('dismiss')">Fermer</button>
  </p>
</template>

<style scoped>
.notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem 1rem;
  padding: 0.8rem 1rem;
  background: var(--stone);
  border: 1px solid var(--ember);
  border-radius: var(--radius);
}

.notice strong {
  color: var(--ember);
}
</style>
