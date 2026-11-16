<script setup lang="ts">
import { computed } from 'vue'
import { RESOURCES, RESOURCE_IDS, STARVATION_ATTACK_MALUS, type MonsterId, type Resources } from '../game/config'
import { getHeroDef, getMonster, type GameState, type HeroGain } from '../game/rules'
import { OUTCOME_NAMES, describeBattle, foeName } from './battleLog'
import { formatAgo, formatAmount, formatArmy, formatDuration } from './format'

// Les derniers rapports de bataille, du plus récent au plus ancien, avec le journal de chaque combat.
const props = defineProps<{ state: GameState; now: number }>()

const malusPercent = Math.round(STARVATION_ATTACK_MALUS * 100)
// Le journal de chaque rapport, dans le même ordre que les rapports.
const stories = computed(() => props.state.reports.map(describeBattle))

function monstersText(monsters: Partial<Record<MonsterId, number>>): string {
  return (Object.entries(monsters) as [MonsterId, number][])
    .filter(([, count]) => count > 0)
    .map(([id, count]) => `${getMonster(id).icon} ${getMonster(id).name} ${count}`)
    .join(' · ')
}

/** Ce qu'a gagné le héros : « Ysolde de Valcourt gagne 40 XP et passe au niveau 3 ! » */
function heroText(gain: HeroGain): string {
  const hero = getHeroDef(gain.hero)
  const levelUp = gain.levelsGained > 0 ? ` et passe au niveau ${gain.level} !` : '.'
  return `${hero.icon} ${hero.name} gagne ${formatAmount(gain.xp)} XP${levelUp}`
}

function lootText(loot: Partial<Resources>): string {
  return RESOURCE_IDS.filter((id) => loot[id])
    .map((id) => `${RESOURCES[id].icon} ${formatAmount(loot[id] ?? 0)}`)
    .join(' · ')
}
</script>

<template>
  <section class="reports-panel" aria-labelledby="reports-title">
    <h2 id="reports-title" class="section-title">Rapports de bataille</h2>
    <p v-if="state.reports.length === 0" class="muted">Aucune bataille pour l’instant.</p>
    <ol v-else class="reports">
      <li v-for="(report, index) in state.reports" :key="`${report.at}-${report.army}-${index}`" class="report">
        <p>
          <strong :class="report.outcome === 'victory' ? 'won' : 'lost'">{{ OUTCOME_NAMES[report.outcome] }}</strong>
          · {{ foeName(report.foe) }}
          <template v-if="report.ambush">· <strong class="lost">embuscade</strong></template>
          <span class="muted">· {{ formatAgo(now - report.at) }}</span>
        </p>
        <p class="muted">
          {{ report.rounds.length }} manche{{ report.rounds.length > 1 ? 's' : '' }}, en
          {{ formatDuration(report.at - report.startedAt) }}.
        </p>
        <p>Envoyés : {{ formatArmy(report.sent) }}</p>
        <p>Pertes : {{ formatArmy(report.lost) || 'aucune' }}</p>
        <p>Monstres vaincus : {{ monstersText(report.enemyLost) || 'aucun' }}</p>
        <p v-if="report.outcome === 'victory'">Butin : {{ lootText(report.loot) }}</p>
        <p v-if="report.hero" :class="{ won: report.hero.levelsGained > 0 }">{{ heroText(report.hero) }}</p>
        <p v-if="report.starving" class="lost">Tes troupes avaient faim : {{ malusPercent }} % d’attaque en moins.</p>
        <details v-if="report.rounds.length" class="journal">
          <summary>Journal du combat</summary>
          <div class="journal-body">
            <p class="muted">{{ stories[index].advantages }}</p>
            <ol class="rounds">
              <li v-for="round in stories[index].rounds" :key="round.title">
                <strong>{{ round.title }}.</strong> {{ round.text }}
              </li>
            </ol>
            <p>
              <strong>{{ stories[index].ending }}</strong>
            </p>
          </div>
        </details>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.reports-panel {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
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

.journal {
  margin-top: 0.4rem;
}

.journal summary {
  width: fit-content;
  padding-block: 0.25rem;
  color: var(--gilt);
  font-weight: 700;
  cursor: pointer;
}

.journal summary:focus-visible {
  outline: 2px solid var(--parchment);
  outline-offset: 2px;
}

.journal-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.5rem;
}

.rounds {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.won {
  color: var(--gilt);
}

.lost {
  color: var(--ember);
}
</style>
