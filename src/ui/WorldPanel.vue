<script setup lang="ts">
import { computed } from 'vue'
import { CAMPS, RESOURCES, RESOURCE_IDS, UNIT_IDS, type Army, type CampId, type MonsterId, type Resources } from '../game/config'
import { getCamp, getMonster, getUnit, type GameState } from '../game/rules'
import CampCard from './CampCard.vue'
import { formatAgo, formatAmount, formatDuration } from './format'

const props = defineProps<{ state: GameState; now: number }>()
const emit = defineEmits<{ attack: [camp: CampId, troops: Army] }>()

const march = computed(() => {
  const e = props.state.expedition
  if (!e) return null
  const camp = getCamp(e.camp).name
  return e.result
    ? { label: `Retour de : ${camp}`, start: e.arrivesAt, end: e.returnsAt }
    : { label: `En route vers : ${camp}`, start: e.departedAt, end: e.arrivesAt }
})
const progress = computed(() => {
  const m = march.value
  if (!m) return 0
  return Math.min(1, Math.max(0, (props.now - m.start) / (m.end - m.start)))
})

function armyText(army: Army): string {
  return UNIT_IDS.filter((id) => army[id] > 0)
    .map((id) => `${getUnit(id).icon} ${getUnit(id).name} ${army[id]}`)
    .join(' · ')
}

function monstersText(monsters: Partial<Record<MonsterId, number>>): string {
  return (Object.entries(monsters) as [MonsterId, number][])
    .filter(([, count]) => count > 0)
    .map(([id, count]) => `${getMonster(id).icon} ${getMonster(id).name} ${count}`)
    .join(' · ')
}

function lootText(loot: Partial<Resources>): string {
  return RESOURCE_IDS.filter((id) => loot[id])
    .map((id) => `${RESOURCES[id].icon} ${formatAmount(loot[id] ?? 0)}`)
    .join(' · ')
}
</script>

<template>
  <div class="world">
    <section v-if="march" class="march" role="status">
      <p>
        <strong>{{ march.label }}</strong> · {{ formatDuration(march.end - now) }}
      </p>
      <div class="progress"><span class="progress-fill" :style="{ width: `${progress * 100}%` }"></span></div>
    </section>

    <section class="block" aria-labelledby="camps-title">
      <h2 id="camps-title" class="section-title">Camps de monstres</h2>
      <p class="muted">
        Ton armée met du temps à atteindre le camp, puis la bataille se joue toute seule. En cas de victoire,
        elle rapporte le butin.
      </p>
      <div class="grid">
        <CampCard
          v-for="camp in CAMPS"
          :key="camp.id"
          :camp="camp"
          :state="state"
          @attack="(troops) => emit('attack', camp.id, troops)"
        />
      </div>
    </section>

    <section class="block" aria-labelledby="reports-title">
      <h2 id="reports-title" class="section-title">Rapports de bataille</h2>
      <p v-if="state.reports.length === 0" class="muted">Aucune bataille pour l’instant.</p>
      <ol v-else class="reports">
        <li v-for="report in state.reports" :key="report.at" class="report">
          <p>
            <strong :class="report.victory ? 'won' : 'lost'">{{ report.victory ? 'Victoire' : 'Défaite' }}</strong>
            · {{ getCamp(report.camp).name }} <span class="muted">· {{ formatAgo(now - report.at) }}</span>
          </p>
          <p>Envoyés : {{ armyText(report.sent) }}</p>
          <p>Pertes : {{ armyText(report.lost) || 'aucune' }}</p>
          <p>Monstres vaincus : {{ monstersText(report.enemyLost) || 'aucun' }}</p>
          <p v-if="report.victory">Butin : {{ lootText(report.loot) }}</p>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.world {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.march {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--stone);
  border: 1px solid var(--gilt);
  border-radius: var(--radius);
  font-variant-numeric: tabular-nums;
}

.reports {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.report {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.9rem 1rem;
  background: var(--stone);
  border: 1px solid var(--seam);
  border-radius: var(--radius);
  font-variant-numeric: tabular-nums;
}

.won {
  color: var(--gilt);
}

.lost {
  color: var(--ember);
}
</style>
