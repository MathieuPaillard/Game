<script setup lang="ts">
// Le panneau qui s'ouvre à côté de la carte (ou sous elle, quand l'écran est tenu en hauteur) :
// il montre ce qu'on vient de toucher, et ce qu'on peut en faire.
defineProps<{ label: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <aside class="panel" :aria-label="label">
    <header class="panel-head">
      <p class="eyebrow">{{ label }}</p>
      <button class="panel-close" type="button" aria-label="Fermer le panneau" @click="emit('close')">✕</button>
    </header>
    <div class="panel-body">
      <slot />
    </div>
  </aside>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--night);
  /* Les listes de plaques s'adaptent à la largeur du panneau, pas à celle de l'écran. */
  container: panel / inline-size;
}

.panel-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem 0.35rem 0.9rem;
  padding-right: max(0.5rem, env(safe-area-inset-right, 0px));
  background: var(--stone-raised);
  border-bottom: 1px solid var(--seam);
}

.panel-close {
  flex: none;
  width: 2.5rem;
  height: 2.5rem;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--parchment);
  font: 700 1.1rem/1 var(--font-body);
  cursor: pointer;
}

.panel-close:hover {
  background: var(--seam);
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 0.9rem;
  padding-right: max(0.9rem, env(safe-area-inset-right, 0px));
}

/* La première plaque du panneau est la fiche de ce qu'on a touché : pas besoin de l'encadrer encore. */
.panel-body > :deep(.plaque:first-child) {
  padding: 0;
  background: none;
  border: 0;
}
</style>
