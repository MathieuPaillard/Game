<script setup lang="ts">
import { computed } from 'vue'
import { RESOURCES, RESOURCE_IDS, STARVATION_ATTACK_MALUS, UNIT_IDS, type Army, type MonsterId, type Resources } from '../game/config'
import {
  armySize,
  foeLoot,
  getHeroDef,
  getMonster,
  loadSize,
  type BattleReport,
  type GameState,
  type HeroGain,
} from '../game/rules'
import { describeBattle, foesName, reportTitle } from './battleLog'
import { formatAgo, formatAmount, formatArmy, formatDuration } from './format'

// Les derniers rapports de bataille, du plus récent au plus ancien, avec le journal de chaque combat.
// Un siège se raconte du point de vue de la cité : ses défenseurs, ses gardes, ses blessés soignés.
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

/** Ce qu'a vécu le dragon : « 🐉 Le dragon gagne 120 XP et passe au niveau 2 ! » */
function dragonText(report: BattleReport): string {
  const gain = report.dragon
  if (!gain) return ''
  const levelUp = gain.levelsGained > 0 ? ` et passe au niveau ${gain.level} !` : '.'
  // Il se repose quand il est tombé, ou quand il est resté seul : il ne se bat jamais sans escorte.
  const fell = report.rounds.some((round) => round.dragonFell)
  const rest = !gain.wounded
    ? ''
    : fell
      ? ' Blessé, il regagne son aire pour se reposer.'
      : ' Resté seul quand son escorte est tombée, il regagne son aire pour se reposer.'
  return `🐉 Le dragon gagne ${formatAmount(gain.xp)} XP${levelUp}${rest}`
}

/** Pourquoi une victoire dehors n'a pas rapporté tout le butin, ou '' si l'armée a tout emporté. */
function lootLeft(report: BattleReport): string {
  if (report.siege || loadSize(report.loot) >= loadSize(foeLoot(report.foe)) - 0.5) return ''
  const survivors = armySize(report.sent) > armySize(report.lost)
  return survivors ? 'ton armée n’a pas pu tout emporter' : 'plus personne n’était debout pour l’emporter'
}

/** Les défenseurs tombés pendant un siège : ceux qu'on a relevés ensuite, et ceux perdus pour de bon. */
function fallen(report: BattleReport): Army {
  const army = { ...report.lost }
  for (const id of UNIT_IDS) army[id] += report.siege?.healed[id] ?? 0
  return army
}

/** Qui défendait la cité : « 🛡️ Guerriers 30 + 🧱 16 gardes des Remparts ». */
function defendersText(report: BattleReport): string {
  const troops = formatArmy(report.sent)
  const guards = report.siege?.guards ? `🧱 ${report.siege.guards} gardes des Remparts` : ''
  return [troops, guards].filter(Boolean).join(' + ') || 'personne'
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
      <li
        v-for="(report, index) in state.reports"
        :key="`${report.at}-${report.army ?? 'cite'}-${index}`"
        class="report"
        :class="{ siege: report.siege, trap: report.foe.type === 'trap' }"
      >
        <!-- Un piège du grand campement : pas de bataille, seulement des pertes. -->
        <template v-if="report.foe.type === 'trap'">
          <p>
            <strong class="lost">{{ reportTitle(report) }}</strong>
            <span class="muted"> · {{ formatAgo(now - report.at) }}</span>
          </p>
          <p>Ton armée est tombée dans un piège caché du grand campement. Il est désarmé jusqu’au repeuplement.</p>
          <p>Troupes : {{ formatArmy(report.sent) }}</p>
          <p>Pertes : {{ formatArmy(report.lost) || 'aucune' }}</p>
          <p v-if="armySize(report.wounded)" class="muted">
            🩹 Dont blessés, partis à l’Hôpital : {{ formatArmy(report.wounded) }}
          </p>
          <p v-if="armySize(report.lost) >= armySize(report.sent)" class="lost">Toute l’armée est tombée.</p>
          <p v-if="report.dragon?.wounded" class="lost">
            🐉 Resté seul, le dragon regagne son aire pour s’y reposer.
          </p>
        </template>
        <template v-else>
          <p>
            <strong :class="report.outcome === 'victory' ? 'won' : 'lost'">{{ reportTitle(report) }}</strong>
            · {{ foesName(report) }}
            <template v-if="report.ambush">· <strong class="lost">embuscade</strong></template>
            <span class="muted">· {{ formatAgo(now - report.at) }}</span>
          </p>
          <p v-if="report.siege && report.rounds.length === 0" class="muted">
            Personne ne défendait la cité : ni troupes, ni gardes sur les Remparts.
          </p>
          <p v-else class="muted">
            <template v-if="report.siege">Aux portes de la cité : </template>
            {{ report.rounds.length }} manche{{ report.rounds.length > 1 ? 's' : '' }}, en
            {{ formatDuration(report.at - report.startedAt) }}.
          </p>
          <template v-if="report.siege">
            <p>Défenseurs : {{ defendersText(report) }}</p>
            <p v-if="armySize(report.siege.healed)">
              Tombés : {{ formatArmy(fallen(report)) }}
              <span class="muted">
                · relevés après le siège : {{ formatArmy(report.siege.healed) }} · perdus pour de bon :
                {{ formatArmy(report.lost) || 'aucun' }}
              </span>
            </p>
            <p v-else>Pertes : {{ formatArmy(report.lost) || 'aucune' }}</p>
            <p v-if="armySize(report.wounded)" class="muted">
              🩹 Dont blessés, partis à l’Hôpital : {{ formatArmy(report.wounded) }}
            </p>
            <p v-if="report.siege.guardsLost">
              Gardes tombés : {{ report.siege.guardsLost }}
              <span class="muted">· d’autres les remplacent pour le prochain siège</span>
            </p>
          </template>
          <template v-else>
            <p>Envoyés : {{ formatArmy(report.sent) }}</p>
            <p>Pertes : {{ formatArmy(report.lost) || 'aucune' }}</p>
            <p v-if="armySize(report.wounded)" class="muted">
              🩹 Dont blessés, partis à l’Hôpital : {{ formatArmy(report.wounded) }}
            </p>
          </template>
          <p>Monstres vaincus : {{ monstersText(report.enemyLost) || 'aucun' }}</p>
          <p v-if="report.outcome === 'victory'">
            Butin : {{ lootText(report.loot) || 'rien' }}
            <span v-if="report.siege" class="muted">· déjà dans tes réserves</span>
            <span v-else-if="lootLeft(report)" class="muted">· {{ lootLeft(report) }}</span>
          </p>
          <p v-if="report.siege && lootText(report.siege.plunder)" class="lost">
            Pillé : {{ lootText(report.siege.plunder) }}
          </p>
          <p v-if="report.hero" :class="{ won: report.hero.levelsGained > 0 }">{{ heroText(report.hero) }}</p>
          <p v-if="report.dragon" :class="{ won: report.dragon.levelsGained > 0, lost: report.dragon.wounded }">
            {{ dragonText(report) }}
          </p>
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
        </template>
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

/* Un siège : la bataille s'est jouée aux portes de la cité. */
.report.siege {
  border-left: 4px solid var(--map-wall);
}

/* Un piège du grand campement. */
.report.trap {
  border-left: 4px solid var(--ember);
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
