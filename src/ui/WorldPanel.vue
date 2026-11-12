<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CAMPS,
  RESOURCES,
  RESOURCE_IDS,
  STARVATION_ATTACK_MALUS,
  type Army,
  type CampId,
  type MonsterId,
  type Resources,
} from '../game/config'
import { getCamp, getMonster, maxExpeditions, type GameState } from '../game/rules'
import CampCard from './CampCard.vue'
import WorldMap from './WorldMap.vue'
import { describeBattle } from './battleLog'
import { formatAgo, formatAmount, formatArmy, formatDuration } from './format'

const props = defineProps<{ state: GameState; now: number; cityName: string }>()
const emit = defineEmits<{ attack: [camp: CampId, troops: Army] }>()

// Le camp choisi sur la carte (ou dans la liste), dont on montre la fiche.
const selected = ref<CampId>('wolfDen')
const selectedCamp = computed(() => getCamp(selected.value))

// Les armées en campagne, avec leur progression.
const marches = computed(() =>
  props.state.expeditions.map((e) => {
    const camp = getCamp(e.camp).name
    const outward = !e.result
    const start = outward ? e.departedAt : e.arrivesAt
    const end = outward ? e.arrivesAt : e.returnsAt
    return {
      key: e.camp,
      label: outward ? `En route vers : ${camp}` : `Retour de : ${camp}`,
      end,
      progress: Math.min(1, Math.max(0, (props.now - start) / (end - start))),
    }
  }),
)

const malusPercent = Math.round(STARVATION_ATTACK_MALUS * 100)
// Le journal de chaque rapport, dans le même ordre que les rapports.
const stories = computed(() => props.state.reports.map(describeBattle))

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
    <section class="block" aria-labelledby="world-title">
      <h2 id="world-title" class="section-title">Alentours</h2>
      <p class="muted">
        Armées en campagne : <strong>{{ state.expeditions.length }} / {{ maxExpeditions(state) }}</strong>. Touche
        un camp pour le voir. Ton armée met du temps à l’atteindre, puis la bataille se joue toute seule.
      </p>

      <WorldMap
        :state="state"
        :now="now"
        :selected="selected"
        :city-name="cityName"
        @select="selected = $event"
      />

      <ul class="chips" aria-label="Camps de monstres">
        <li v-for="camp in CAMPS" :key="camp.id">
          <button type="button" class="chip" :aria-pressed="selected === camp.id" @click="selected = camp.id">
            {{ camp.name }}
            <span class="chip-tag" :class="{ busy: state.expeditions.some((e) => e.camp === camp.id) }">
              niv. {{ camp.level }}
            </span>
          </button>
        </li>
      </ul>

      <ul v-if="marches.length" class="marches" aria-label="Armées en campagne">
        <li v-for="march in marches" :key="march.key" class="march" role="status">
          <p>
            <strong>{{ march.label }}</strong> · {{ formatDuration(march.end - now) }}
          </p>
          <div class="progress">
            <span class="progress-fill" :style="{ width: `${march.progress * 100}%` }"></span>
          </div>
        </li>
      </ul>

      <CampCard
        :key="selectedCamp.id"
        :camp="selectedCamp"
        :state="state"
        @attack="(troops) => emit('attack', selectedCamp.id, troops)"
      />
    </section>

    <section class="block" aria-labelledby="reports-title">
      <h2 id="reports-title" class="section-title">Rapports de bataille</h2>
      <p v-if="state.reports.length === 0" class="muted">Aucune bataille pour l’instant.</p>
      <ol v-else class="reports">
        <li v-for="(report, index) in state.reports" :key="report.at" class="report">
          <p>
            <strong :class="report.victory ? 'won' : 'lost'">{{ report.victory ? 'Victoire' : 'Défaite' }}</strong>
            · {{ getCamp(report.camp).name }} <span class="muted">· {{ formatAgo(now - report.at) }}</span>
          </p>
          <p>Envoyés : {{ formatArmy(report.sent) }}</p>
          <p>Pertes : {{ formatArmy(report.lost) || 'aucune' }}</p>
          <p>Monstres vaincus : {{ monstersText(report.enemyLost) || 'aucun' }}</p>
          <p v-if="report.victory">Butin : {{ lootText(report.loot) }}</p>
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
  gap: 0.9rem;
}

.marches {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.march {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.8rem 1rem;
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
