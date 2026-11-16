<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CAMPS,
  MAX_BANDS,
  NODE_KINDS,
  RESOURCES,
  RESOURCE_IDS,
  STARVATION_ATTACK_MALUS,
  type Army,
  type HeroId,
  type MonsterId,
  type Resources,
} from '../game/config'
import {
  armySize,
  getArmy,
  getBand,
  getBandKind,
  getHeroDef,
  getMonster,
  getNode,
  maxArmies,
  nodeGatherer,
  sameTarget,
  type GameState,
  type HeroGain,
  type Target,
} from '../game/rules'
import ArmyCard from './ArmyCard.vue'
import TargetCard from './TargetCard.vue'
import WorldMap from './WorldMap.vue'
import { OUTCOME_NAMES, describeBattle, foeName } from './battleLog'
import { formatAgo, formatAmount, formatArmy, formatDuration } from './format'
import { STATUS_ICONS, armyStatusText, monstersIcon, type Selection } from './world'

const props = defineProps<{ state: GameState; now: number; cityName: string }>()
const emit = defineEmits<{
  march: [target: Target, troops: Army, hero: HeroId | null]
  order: [army: number, target: Target]
}>()

const FIRST_CAMP: Selection = { kind: 'target', target: { type: 'camp', camp: 'wolfDen' } }

// Ce qui est choisi : une cible (dont on montre la fiche), ou une de tes armées (à qui donner des ordres).
const chosen = ref<Selection>(FIRST_CAMP)
// Le prochain ordre envisagé pour l'armée choisie : un endroit touché sur la carte, ou une cible.
const plan = ref<Target | null>(null)

// Une armée rentrée, une bande vaincue, un gisement épuisé : on revient alors au premier camp.
const selection = computed<Selection>(() => {
  const current = chosen.value
  if (current.kind === 'army') return getArmy(props.state, current.id) ? current : FIRST_CAMP
  const target = current.target
  if (target.type === 'band' && !getBand(props.state, target.band)) return FIRST_CAMP
  if (target.type === 'node' && !getNode(props.state, target.node)) return FIRST_CAMP
  return current
})
const selectedArmy = computed(() => {
  const current = selection.value
  return current.kind === 'army' ? getArmy(props.state, current.id) : undefined
})
const selectedTarget = computed(() => (selection.value.kind === 'target' ? selection.value.target : null))

function keyOf(target: Target): string {
  switch (target.type) {
    case 'camp':
      return target.camp
    case 'band':
      return `band-${target.band}`
    case 'node':
      return `node-${target.node}`
    default:
      return target.type
  }
}

const isChosen = (target: Target) => selectedTarget.value !== null && sameTarget(selectedTarget.value, target)

/** Une armée est choisie : toucher une cible en fait son prochain ordre. Sinon, on choisit cette cible. */
function choose(next: Selection) {
  if (selection.value.kind === 'army' && next.kind === 'target') {
    plan.value = next.target
    return
  }
  chosen.value = next
  plan.value = null
}

/** Un endroit touché sur la carte : il devient le prochain ordre de l'armée choisie. */
function tap(point: { x: number; y: number }) {
  if (selection.value.kind !== 'army') return
  plan.value = { type: 'point', x: Math.round(point.x), y: Math.round(point.y) }
}

function order(target: Target) {
  const current = selection.value
  if (current.kind !== 'army') return
  emit('order', current.id, target)
  plan.value = null
}

function closeArmy() {
  chosen.value = FIRST_CAMP
  plan.value = null
}

function march(troops: Army, hero: HeroId | null) {
  const target = selectedTarget.value
  if (target) emit('march', target, troops, hero)
}

// Les pastilles : tes armées, les camps, les bandes (des plus faibles aux plus fortes) et les gisements.
const armyChips = computed(() =>
  props.state.armies.map((army) => ({
    id: army.id,
    icon: STATUS_ICONS[army.status],
    hero: army.hero === null ? null : getHeroDef(army.hero).icon,
    size: armySize(army.troops),
    status: armyStatusText(props.state, army),
  })),
)
const bandChips = computed(() =>
  [...props.state.bands]
    .sort((a, b) => a.level - b.level || a.id - b.id)
    .map((band) => ({
      target: { type: 'band', band: band.id } as Target,
      icon: monstersIcon(band.monsters),
      name: getBandKind(band.kind).name,
      level: band.level,
    })),
)
const nodeChips = computed(() =>
  [...props.state.nodes]
    .sort((a, b) => a.level - b.level || a.id - b.id)
    .map((node) => ({
      target: { type: 'node', node: node.id } as Target,
      icon: NODE_KINDS[node.resource].icon,
      name: NODE_KINDS[node.resource].name,
      level: node.level,
      busy: nodeGatherer(props.state, node.id) !== undefined,
    })),
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
  <div class="world">
    <section class="block" aria-labelledby="world-title">
      <h2 id="world-title" class="section-title">Alentours</h2>
      <p class="muted">
        Armées dehors : <strong>{{ state.armies.length }} / {{ maxArmies(state) }}</strong>. Touche une de tes
        armées, puis la carte pour l’envoyer quelque part, un camp, une bande ou un gisement pour l’attaquer ou y
        récolter, ou la cité pour la faire rentrer. Les bandes patrouillent : si ton armée entre dans leur zone d’aggro (le cercle rouge), elles
        l’attaquent.
      </p>

      <WorldMap
        :state="state"
        :now="now"
        :selection="selection"
        :plan="plan"
        :city-name="cityName"
        @select="choose"
        @tap="tap"
      />

      <ul v-if="armyChips.length" class="chips" aria-label="Tes armées dehors">
        <li v-for="chip in armyChips" :key="chip.id">
          <button
            type="button"
            class="chip army-chip"
            :aria-pressed="selection.kind === 'army' && selection.id === chip.id"
            @click="choose({ kind: 'army', id: chip.id })"
          >
            <span aria-hidden="true">{{ chip.icon }}</span>
            <span v-if="chip.hero" aria-hidden="true">{{ chip.hero }}</span>
            {{ chip.size }}
            <span class="chip-tag busy">{{ chip.status }}</span>
          </button>
        </li>
      </ul>

      <ArmyCard
        v-if="selectedArmy"
        :key="selectedArmy.id"
        :state="state"
        :now="now"
        :army="selectedArmy"
        :plan="plan"
        @order="order"
        @clear-plan="plan = null"
        @close="closeArmy"
      />

      <ul class="chips" aria-label="Camps de monstres">
        <li v-for="camp in CAMPS" :key="camp.id">
          <button
            type="button"
            class="chip"
            :aria-pressed="isChosen({ type: 'camp', camp: camp.id })"
            @click="choose({ kind: 'target', target: { type: 'camp', camp: camp.id } })"
          >
            {{ camp.name }}
            <span class="chip-tag">niv. {{ camp.level }}</span>
          </button>
        </li>
      </ul>

      <p class="muted">Bandes de monstres : {{ state.bands.length }} / {{ MAX_BANDS }}.</p>
      <ul v-if="bandChips.length" class="chips" aria-label="Bandes de monstres">
        <li v-for="chip in bandChips" :key="keyOf(chip.target)">
          <button
            type="button"
            class="chip"
            :aria-pressed="isChosen(chip.target)"
            @click="choose({ kind: 'target', target: chip.target })"
          >
            <span aria-hidden="true">{{ chip.icon }}</span>
            {{ chip.name }}
            <span class="chip-tag">niv. {{ chip.level }}</span>
          </button>
        </li>
      </ul>

      <p class="muted">Gisements de ressources : {{ state.nodes.length }}.</p>
      <ul v-if="nodeChips.length" class="chips" aria-label="Gisements de ressources">
        <li v-for="chip in nodeChips" :key="keyOf(chip.target)">
          <button
            type="button"
            class="chip"
            :aria-pressed="isChosen(chip.target)"
            @click="choose({ kind: 'target', target: chip.target })"
          >
            <span aria-hidden="true">{{ chip.icon }}</span>
            {{ chip.name }}
            <span class="chip-tag" :class="{ busy: chip.busy }">niv. {{ chip.level }}</span>
          </button>
        </li>
      </ul>

      <TargetCard
        v-if="selectedTarget"
        :key="keyOf(selectedTarget)"
        :target="selectedTarget"
        :state="state"
        @march="march"
      />
    </section>

    <section class="block" aria-labelledby="reports-title">
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

.army-chip {
  border-color: var(--gilt);
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
