<script setup lang="ts">
import { computed } from 'vue'
import { RESOURCES, RESOURCE_IDS, SPELLS, type SpellId } from '../game/config'
import { checkCast, type GameState } from '../game/rules'
import { formatAmount, formatDuration } from './format'

// Les sorts de la Tour des mages : ceux qu'on peut lancer, ceux qui agissent, ceux à débloquer.
const props = defineProps<{ state: GameState; now: number }>()
const emit = defineEmits<{ cast: [spell: SpellId] }>()

function rechargeLeft(id: SpellId): number | null {
  const ready = props.state.spellsReadyAt[id]
  return ready !== undefined && ready > props.now ? ready - props.now : null
}

const spells = computed(() =>
  SPELLS.map((spell) => {
    const active = props.state.spells.find((s) => s.spell === spell.id)
    return {
      spell,
      // L'écran avance d'une seconde à la fois : le temps restant ne dépasse jamais la durée du sort.
      left: active ? Math.min(spell.durationSeconds * 1000, Math.max(0, active.endsAt - props.now)) : null,
      // Un sort qui se recharge (la Brume d'oubli) : le temps avant de pouvoir le relancer.
      recharge: rechargeLeft(spell.id),
      ok: checkCast(props.state, spell.id).ok,
      locked: props.state.levels.mageTower < spell.towerLevel,
      cost: RESOURCE_IDS.filter((id) => spell.cost[id]).map((id) => ({ id, amount: spell.cost[id] ?? 0 })),
    }
  }),
)
// Les bienfaits de quelques dizaines de minutes, puis les défenses qui veillent pendant tes absences.
const groups = computed(() => [
  { key: 'boons', title: null, items: spells.value.filter((item) => !item.spell.absence) },
  { key: 'absence', title: 'Pour tes absences', items: spells.value.filter((item) => item.spell.absence) },
])
</script>

<template>
  <section class="plaque" aria-labelledby="spells-title">
    <h3 id="spells-title" class="plaque-name">Sorts</h3>
    <p class="muted">
      Un sort agit tout de suite, pour toute la cité ou pour toutes tes armées, pendant sa durée. Un même sort
      ne se lance pas deux fois à la fois.
    </p>
    <template v-for="group in groups" :key="group.key">
      <h4 v-if="group.title" class="group-title">
        <span aria-hidden="true">🌙</span> {{ group.title }}
        <span class="muted">· lance-les avant de partir : ils veillent toute la nuit</span>
      </h4>
      <ul class="spell-list">
        <li v-for="item in group.items" :key="item.spell.id" class="spell" :class="{ running: item.left !== null }">
          <span class="spell-icon" aria-hidden="true">{{ item.spell.icon }}</span>
          <div class="spell-text">
            <p>
              <strong>{{ item.spell.name }}</strong>
              <span class="muted">
                · <span class="duration">{{ formatDuration(item.spell.durationSeconds * 1000) }}</span></span
              >
            </p>
            <p class="muted">{{ item.spell.description }}</p>
            <p v-if="item.left !== null" class="left" role="status">Agit encore {{ formatDuration(item.left) }}</p>
            <p v-else-if="item.locked" class="reason">Se débloque à la Tour des mages niveau {{ item.spell.towerLevel }}</p>
            <p v-else-if="item.recharge !== null" class="reason">
              Se recharge : de nouveau prêt dans {{ formatDuration(item.recharge) }}
            </p>
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
    </template>
  </section>
</template>

<style scoped>
.group-title {
  margin: 0.4rem 0 0;
  font: 700 1rem/1.3 var(--font-body);
}

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

/* « 8 h » reste sur une ligne : le « h » ne part pas seul à la ligne suivante. */
.duration {
  white-space: nowrap;
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
