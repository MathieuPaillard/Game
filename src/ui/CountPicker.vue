<script setup lang="ts">
// Choisir un nombre : une réglette pour le doigt, et une case pour taper le nombre exact.
const model = defineModel<number>({ required: true })
withDefaults(defineProps<{ id: string; max: number; min?: number; label: string }>(), { min: 0 })
</script>

<template>
  <div class="picker">
    <input
      :id="`${id}-range`"
      v-model.number="model"
      class="range"
      type="range"
      :min="min"
      :max="Math.max(min, max)"
      step="1"
      :aria-label="`${label} (réglette)`"
    />
    <input
      :id="id"
      v-model.number="model"
      class="number"
      type="number"
      :min="min"
      :max="max"
      inputmode="numeric"
      :aria-label="label"
    />
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.range {
  flex: 1;
  min-width: 0;
  height: 2rem;
  accent-color: var(--gilt);
  cursor: pointer;
}

.number {
  flex: none;
  width: 4.6rem;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--seam);
  border-radius: 6px;
  background: var(--night);
  color: var(--parchment);
  font: 700 1rem/1.2 var(--font-body);
  font-variant-numeric: tabular-nums;
}

.number:focus-visible,
.range:focus-visible {
  outline: 2px solid var(--gilt);
  outline-offset: 1px;
}
</style>
