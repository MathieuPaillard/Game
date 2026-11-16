<script setup lang="ts">
import { computed } from 'vue'
import { RESOURCES, RESOURCE_IDS, SPELLS, type SpellId } from '../game/config'
import { checkCast, type GameState } from '../game/rules'
import { formatAmount, formatDuration } from './format'

// Les sorts de la Tour des mages : ceux qu'on peut lancer, ceux qui agissent, ceux à débloquer.
const props = defineProps<{ state: GameState; now: number }>()
const emit = defineEmits<{ cast: [spell: SpellId] }>()

const spells = computed(() =>
  SPELLS.map((spell) => {
    const active = props.state.spells.find((s) => s.spell === spell.id)
    return {
      spell,
      // L'écran avance d'une seconde à la fois : le temps restant ne dépasse jamais la durée du sort.
      left: active ? Math.min(spell.durationSeconds * 1000, Math.max(0, active.endsAt - props.now)) : null,
      ok: checkCast(props.state, spell.id).ok,
      locked: props.state.levels.mageTower < spell.towerLevel,
      cost: RESOURCE_IDS.filter((id) => spell.cost[id]).map((id) => ({ id, amount: spell.cost[id] ?? 0 })),
    }
  }),
)
</script>

<template>
  <section class="plaque" aria-labelledby="spells-title">
    <h3 id="spells-title" class="plaque-name">Sorts</h3>
    <p class="muted">
      Un sort agit tout de suite, pour toute la cité ou pour toutes tes armées, pendant sa durée. Un même sort
      ne se lance pas deux fois à la fois.
    </p>
    <ul class="spell-list">
      <li v-for="item in spells" :key="item.spell.id" class="spell" :class="{ running: item.left !== null }">
        <span class="spell-icon" aria-hidden="true">{{ item.spell.icon }}</span>
        <div class="spell-text">
          <p>
            <strong>{{ item.spell.name }}</strong>
            <span class="muted"> · {{ formatDuration(item.spell.durationSeconds * 1000) }}</span>
          </p>
          <p class="muted">{{ item.spell.description }}</p>
          <p v-if="item.left !== null" class="left" role="status">Agit encore {{ formatDuration(item.left) }}</p>
          <p v-else-if="item.locked" class="reason">Se débloque à la Tour des mages niveau {{ item.spell.towerLevel }}</p>
          <ul v-else class="cost" aria-label="Coût">
            <li v-for="c in item.cost" :key="c.id" :class="{ short: state.resources[c.id] < c.amount }">
              <span aria-hidden="true">{{ RESOURCES[c.id].icon }}</span> {{ formatAmount(c.amount) }}
              <span class="sr-only">{{ RESOURCES[c.id].name }}</span>
            </li>
          </ul>
        </div>
        <button
          v-if="item.left === null && !item.locked"
          class="btn cast"
          type="button"
          :disabled="!item.ok"
          :aria-label="`Lancer ${item.spell.name}`"
          @click="emit('cast', item.spell.id)"
        >
          Lancer
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.spell-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.spell {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.spell-icon {
  flex: none;
  width: 2rem;
  font-size: 1.5rem;
  text-align: center;
}

.spell-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.spell.running .spell-icon {
  filter: drop-shadow(0 0 6px var(--gilt));
}

.left {
  color: var(--gilt);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.cast {
  flex: none;
}
</style>
