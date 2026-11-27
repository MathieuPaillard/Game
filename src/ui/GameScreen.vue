<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  DRAGON_EGG_ICON,
  RESOURCES,
  TRIAL_BOOST,
  RESOURCE_IDS,
  SECOND_CONSTRUCTION_CASTLE_LEVEL,
  type Army,
  type BuildingId,
  type HeroId,
  type SpellId,
  type TechId,
  type UnitId,
} from '../game/config'
import {
  armySize,
  checkOrder,
  currentQuest,
  getArmy,
  getBand,
  getBuilding,
  getHeroDef,
  getNode,
  getRace,
  getSpell,
  getTech,
  getUnit,
  maxArmies,
  maxConstructions,
  netPerHour,
  questProgress,
  siegeOf,
  skillPoints,
  timeUntilFamine,
  type GameState,
  type Target,
} from '../game/rules'
import AccountLine from './AccountLine.vue'
import ArmyCard from './ArmyCard.vue'
import type { AwayReport } from './away'
import BuildingCard from './BuildingCard.vue'
import CityMap from './CityMap.vue'
import DefenseCard from './DefenseCard.vue'
import DragonCard from './DragonCard.vue'
import GarrisonCard from './GarrisonCard.vue'
import HeroPanel from './HeroPanel.vue'
import NoticeBar from './NoticeBar.vue'
import QuestBanner from './QuestBanner.vue'
import ReportsPanel from './ReportsPanel.vue'
import ResearchPanel from './ResearchPanel.vue'
import ResourceBar from './ResourceBar.vue'
import SidePanel from './SidePanel.vue'
import SpellList from './SpellList.vue'
import TargetCard from './TargetCard.vue'
import TrainingList from './TrainingList.vue'
import WorldMap from './WorldMap.vue'
import { formatAmount, formatClock, formatDuration } from './format'
import type { Point } from './maps'
import type { CitySelection, Panel } from './screen'
import { STATUS_ICONS, armyStatusText, incomingRaids, type Selection } from './world'

// L'écran de jeu, pensé pour le mode paysage : la carte (la cité, ou ses alentours) remplit l'écran.
// Par-dessus : les ressources en haut, des boutons aux coins, et ce qui est en cours sur les côtés.
// Toucher quelque chose sur la carte ouvre son panneau, à côté de la carte.
const props = defineProps<{
  state: GameState
  now: number
  awayReport: AwayReport | null
  notice: string | null
  offline: boolean
  /** Le joueur connecté, ou null pour une partie sans compte. */
  player: string | null
}>()
const emit = defineEmits<{
  upgrade: [building: BuildingId]
  research: [tech: TechId]
  train: [unit: UnitId, count: number]
  recruit: [hero: HeroId]
  learn: [hero: HeroId, skill: string]
  claim: [quest: string]
  cast: [spell: SpellId]
  hatch: []
  march: [target: Target, troops: Army, hero: HeroId | null, dragon: boolean]
  order: [army: number, target: Target]
  dismiss: [troops: Army]
  trial: [on: boolean]
  restart: []
  dismissAway: []
  dismissNotice: []
  logout: []
  goOnline: []
}>()

const CITY: Target = { type: 'city' }

// --- Ce qu'on regarde : la cité ou ses alentours, et le panneau ouvert ---

const view = ref<'city' | 'world'>('city')
const opened = ref<Panel | null>(null)

// Une armée rentrée, une bande vaincue, un gisement épuisé : leur panneau se referme.
const panel = computed<Panel | null>(() => {
  const current = opened.value
  if (!current) return null
  if (current.kind === 'army') return getArmy(props.state, current.id) ? current : null
  if (current.kind === 'target') {
    const target = current.target
    if (target.type === 'band' && !getBand(props.state, target.band)) return null
    if (target.type === 'node' && !getNode(props.state, target.node)) return null
  }
  return current
})

const citySelection = computed<CitySelection | null>(() => {
  const current = panel.value
  return current && (current.kind === 'building' || current.kind === 'garrison' || current.kind === 'heroes')
    ? current
    : null
})
const worldSelection = computed<Selection | null>(() => {
  const current = panel.value
  return current && (current.kind === 'target' || current.kind === 'army') ? current : null
})
const buildingId = computed(() => (panel.value?.kind === 'building' ? panel.value.id : null))
const target = computed(() => (panel.value?.kind === 'target' ? panel.value.target : null))
const selectedArmy = computed(() => (panel.value?.kind === 'army' ? getArmy(props.state, panel.value.id) : undefined))

/** Un panneau neuf à chaque nouveau contenu : il s'ouvre toujours en haut de sa page. */
const panelKey = computed(() => {
  const current = panel.value
  if (!current) return ''
  if (current.kind === 'building' || current.kind === 'army') return `${current.kind}-${current.id}`
  return current.kind === 'target' ? `target-${targetKey(current.target)}` : current.kind
})

const PANEL_LABELS: Record<Panel['kind'], string> = {
  building: 'Bâtiment',
  garrison: 'Garnison',
  heroes: 'Héros',
  target: 'Aux alentours',
  army: 'Armée',
  quest: 'Objectif',
  reports: 'Rapports',
  menu: 'Menu',
}

/** Ouvre un panneau, et montre la carte qui va avec. */
function open(next: Panel | null) {
  opened.value = next
  if (!next) return
  if (next.kind === 'building' || next.kind === 'garrison') view.value = 'city'
  if (next.kind === 'target' || next.kind === 'army') view.value = 'world'
  if (next.kind === 'reports') seenReportAt.value = props.state.reports[0]?.at ?? 0
}

/** Les boutons de l'écran : un second appui referme le panneau. */
function toggle(kind: 'heroes' | 'quest' | 'reports' | 'menu') {
  open(panel.value?.kind === kind ? null : { kind })
}

function switchView() {
  view.value = view.value === 'city' ? 'world' : 'city'
  opened.value = null
}

function targetKey(t: Target): string {
  switch (t.type) {
    case 'camp':
      return t.camp
    case 'band':
      return `band-${t.band}`
    case 'node':
      return `node-${t.node}`
    default:
      return t.type
  }
}

// --- Un message bref, en haut de la carte : un ordre impossible, par exemple ---

const toast = ref<{ text: string; good: boolean } | null>(null)
let toastTimer = 0
function flash(text: string, good = false) {
  toast.value = { text, good }
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = null), 4000)
}

// --- Les alentours : toucher, c'est ordonner ---

/**
 * Un ordre pour une armée dehors. Il part aussitôt, sans rien valider. Une armée qui se bat ne
 * bat en retraite que par son bouton (`forced`) : un toucher malheureux ne doit pas la dégager.
 */
function command(armyId: number, to: Target, forced = false) {
  const army = getArmy(props.state, armyId)
  if (!army) return
  open({ kind: 'army', id: armyId })
  if (army.status === 'fighting' && !forced) {
    flash('Ton armée se bat. Pour la dégager, touche « Battre en retraite ».')
    return
  }
  const check = checkOrder(props.state, armyId, to)
  if (!check.ok) {
    flash(`${check.reason}.`)
    return
  }
  emit('order', armyId, to)
}

/** Un repère touché sur la carte des alentours. */
function selectInWorld(selection: Selection) {
  const army = selectedArmy.value
  if (selection.kind === 'army') {
    // Toucher de nouveau l'armée choisie la lâche.
    open(army?.id === selection.id ? null : selection)
  } else if (army) {
    command(army.id, selection.target)
  } else if (selection.target.type === 'city') {
    switchView()
  } else {
    open(selection)
  }
}

/** Le sol touché : l'armée choisie y va ; sinon, on ne regarde plus rien. */
function tapWorld(point: Point) {
  const army = selectedArmy.value
  if (army) command(army.id, { type: 'point', x: Math.round(point.x), y: Math.round(point.y) })
  else open(null)
}

// Une nouvelle armée sort de la cité : on la choisit dès qu'elle apparaît, pour la suivre et la diriger.
let knownArmies: number[] | null = null
function march(to: Target, troops: Army, hero: HeroId | null, dragon: boolean) {
  knownArmies = props.state.armies.map((army) => army.id)
  emit('march', to, troops, hero, dragon)
  void nextTick(() => (knownArmies = null))
}
watch(
  () => props.state.armies,
  (armies) => {
    const before = knownArmies
    if (!before) return
    const fresh = armies.find((army) => !before.includes(army.id))
    if (fresh) open({ kind: 'army', id: fresh.id })
  },
)

// --- Ce qui est affiché par-dessus la carte ---

const race = computed(() => getRace(props.state.race))
const cityName = computed(() => `Cité des ${race.value.name}`)
const rates = computed(() => netPerHour(props.state))
// La famine ne s'affiche sur la carte que lorsqu'elle approche : avant, le débit rouge du registre suffit.
const FAMINE_ALERT_MS = 2 * 60 * 60 * 1000
const famine = computed(() => {
  const left = timeUntilFamine(props.state)
  if (left === null || left > FAMINE_ALERT_MS) return null
  return props.state.resources.food >= 1 ? `Famine dans ${formatDuration(left)}` : 'Famine : tes troupes ont faim'
})

// Un raid marche sur la cité, ou l'assiège : l'alerte reste en haut de l'écran jusqu'à la fin.
const raidAlert = computed(() => {
  const siege = siegeOf(props.state)
  if (siege) return { siege: true, band: siege.band, text: `Cité assiégée · manche ${siege.rounds.length + 1}` }
  const first = incomingRaids(props.state)[0]
  if (!first) return null
  const left = first.arrival === null ? null : Math.max(0, first.arrival - props.now)
  return {
    siege: false,
    band: first.band.id,
    text: left === null ? 'Raid : bataille en chemin' : `Raid dans ${formatClock(left)}`,
    label: left === null ? undefined : `Un raid arrive à la cité dans ${formatDuration(left)}`,
  }
})

/** L'alerte touchée : pendant un siège, la défense de la cité ; sinon, le raid sur la carte des alentours. */
function onRaidAlert() {
  const alert = raidAlert.value
  if (!alert) return
  if (alert.siege) open({ kind: 'building', id: 'walls' })
  else if (alert.band !== null) open({ kind: 'target', target: { type: 'band', band: alert.band } })
}

/** Depuis la défense de la cité : voir un raid sur la carte des alentours. */
function showRaid(band: number) {
  open({ kind: 'target', target: { type: 'band', band } })
}

const quest = computed(() => {
  const def = currentQuest(props.state)
  if (!def) return null
  const { current, target: goal } = questProgress(props.state, def)
  return { def, done: current >= goal, current: Math.min(current, goal), goal }
})

/** L'étiquette de l'objectif : atteint, un toucher suffit pour recevoir la récompense ; sinon, elle ouvre sa page. */
function onQuestChip() {
  const current = quest.value
  if (!current?.done) {
    toggle('quest')
    return
  }
  const reward = RESOURCE_IDS.filter((id) => current.def.reward[id])
    .map((id) => `${RESOURCES[id].icon} ${formatAmount(current.def.reward[id] ?? 0)}`)
    .join('  ')
  const gift = current.def.gift === 'dragonEgg' ? `, et ${DRAGON_EGG_ICON} un œuf de dragon !` : ''
  emit('claim', current.def.id)
  flash(`Objectif atteint : ${current.def.name}. Récompense reçue : ${reward}${gift}`, true)
}

/** Ce qui est en cours dans la cité : chaque étiquette ouvre le bâtiment concerné. */
const activities = computed(() => {
  const state = props.state
  const list: { key: string; icon: string; label: string; endsAt: number; building: BuildingId }[] = []
  for (const works of state.constructions) {
    const building = getBuilding(works.building)
    list.push({
      key: `build-${building.id}`,
      icon: `🔨${building.icon}`,
      label: `${building.name} : niveau ${works.targetLevel} en construction`,
      endsAt: works.endsAt,
      building: building.id,
    })
  }
  if (state.research) {
    const tech = getTech(state.research.tech)
    list.push({
      key: 'research',
      icon: `📜${tech.icon}`,
      label: `Recherche : ${tech.name}`,
      endsAt: state.research.endsAt,
      building: 'academy',
    })
  }
  for (const training of state.trainings) {
    const unit = getUnit(training.unit)
    list.push({
      key: `train-${unit.id}`,
      icon: `⚔️${unit.icon}`,
      label: `Entraînement : ${unit.name} +${training.count}`,
      endsAt: training.endsAt,
      building: 'barracks',
    })
  }
  // L'œuf de dragon qui éclôt.
  const hatchAt = state.dragon?.stage === 'hatching' ? state.dragon.hatchAt : null
  if (hatchAt !== null && hatchAt !== undefined) {
    list.push({
      key: 'dragon-hatch',
      icon: DRAGON_EGG_ICON,
      label: 'Éclosion du dragon',
      endsAt: hatchAt,
      building: 'dragonRoost',
    })
  }
  for (const active of state.spells) {
    const spell = getSpell(active.spell)
    list.push({
      key: `spell-${spell.id}`,
      icon: `🪄${spell.icon}`,
      label: `Sort en cours : ${spell.name}`,
      endsAt: active.endsAt,
      building: 'mageTower',
    })
  }
  return list
})

const armies = computed(() =>
  props.state.armies.map((army) => ({
    id: army.id,
    icon: STATUS_ICONS[army.status],
    hero: army.hero === null ? null : getHeroDef(army.hero).icon,
    size: armySize(army.troops),
    status: armyStatusText(props.state, army),
  })),
)

// Les points dorés des boutons : quelque chose attend le joueur.
const heroesWaiting = computed(() => props.state.heroes.some((hero) => skillPoints(hero) > 0))
const seenReportAt = ref(props.state.reports[0]?.at ?? 0)
const newReport = computed(() => (props.state.reports[0]?.at ?? 0) > seenReportAt.value)
const elsewhereBusy = computed(() =>
  view.value === 'city'
    ? props.state.armies.length > 0 || props.state.bands.some((band) => band.raid)
    : props.state.constructions.length > 0,
)

const awayGains = computed(() =>
  RESOURCE_IDS.filter((id) => (props.awayReport?.gains[id] ?? 0) >= 1).map((id) => ({
    id,
    amount: props.awayReport?.gains[id] ?? 0,
  })),
)
const confirmingRestart = ref(false)

// --- Le mode paysage ---

const HINT_KEY = 'royaume-astuce-paysage'
const rotateHint = ref(false)
function dismissRotateHint() {
  rotateHint.value = false
  try {
    localStorage.setItem(HINT_KEY, '1')
  } catch {
    // Stockage indisponible : l'astuce reviendra à la prochaine visite, tant pis.
  }
}

const canFullscreen = document.fullscreenEnabled === true
const fullscreen = ref(false)
function onFullscreenChange() {
  fullscreen.value = document.fullscreenElement !== null
}

/** Le plein écran, quand le navigateur le permet. Sur téléphone, il peut aussi bloquer l'écran en paysage. */
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await document.documentElement.requestFullscreen()
    const orientation = screen.orientation as ScreenOrientation & { lock?: (kind: string) => Promise<void> }
    await orientation.lock?.('landscape')
  } catch {
    // Refusé par le navigateur : on reste comme on est.
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && panel.value) open(null)
}

onMounted(() => {
  let seen = false
  try {
    seen = localStorage.getItem(HINT_KEY) === '1'
  } catch {
    // Stockage indisponible.
  }
  rotateHint.value = !seen && window.matchMedia('(orientation: portrait) and (pointer: coarse)').matches
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('fullscreenchange', onFullscreenChange)
})
onBeforeUnmount(() => {
  window.clearTimeout(toastTimer)
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})
</script>

<template>
  <div class="game">
    <header class="topbar">
      <p class="city-name">{{ cityName }}</p>
      <p v-if="state.trial" class="trial-badge">
        <span aria-hidden="true">🧪</span> Essai ×{{ TRIAL_BOOST }}
        <span class="sr-only">: le mode d’essai renforce tes troupes</span>
      </p>
      <ResourceBar :resources="state.resources" :rates="rates" />
    </header>

    <div class="body">
      <main class="stage">
        <!-- Chaque carte garde sa vue (où l'on regardait, et le zoom) quand on passe à l'autre. -->
        <KeepAlive>
          <CityMap
            v-if="view === 'city'"
            :state="state"
            :now="now"
            :selection="citySelection"
            @select="open"
            @tap="open(null)"
          />
          <WorldMap
            v-else
            :state="state"
            :now="now"
            :selection="worldSelection"
            :city-name="cityName"
            @select="selectInWorld"
            @tap="tapWorld"
            @command="command"
          />
        </KeepAlive>

        <div class="hud">
          <!-- En haut à gauche : l'objectif, les alertes, et ce qui est en cours dans la cité -->
          <div class="hud-left">
            <button
              v-if="quest"
              type="button"
              class="hud-chip"
              :class="{ ready: quest.done }"
              :aria-pressed="panel?.kind === 'quest'"
              @click="onQuestChip"
            >
              <span aria-hidden="true">{{ quest.done ? '🎁' : '🎯' }}</span>
              <span class="text">{{ quest.done ? 'Recevoir la récompense' : quest.def.name }}</span>
              <span v-if="!quest.done" class="tag">{{ formatAmount(quest.current) }}/{{ formatAmount(quest.goal) }}</span>
            </button>
            <button
              v-if="raidAlert"
              type="button"
              class="hud-chip alert raid-alert"
              :aria-label="raidAlert.label"
              @click="onRaidAlert"
            >
              <span aria-hidden="true">{{ raidAlert.siege ? '⚔️' : '🔥' }}</span>
              <span class="text">{{ raidAlert.text }}</span>
            </button>
            <button v-if="famine" type="button" class="hud-chip alert" @click="open({ kind: 'garrison' })">
              <span aria-hidden="true">🌾</span>
              <span class="text">{{ famine }}</span>
            </button>
            <button v-if="rotateHint" type="button" class="hud-chip rotate-hint" @click="dismissRotateHint">
              <span aria-hidden="true">📱</span>
              <span class="text">Tourne l’écran : jeu en paysage</span>
              <span class="tag" aria-hidden="true">✕</span>
            </button>
            <ul v-if="activities.length" class="activities" aria-label="En cours dans la cité">
              <li v-for="activity in activities" :key="activity.key">
                <button
                  type="button"
                  class="hud-chip"
                  :aria-label="`${activity.label}, encore ${formatDuration(activity.endsAt - now)}`"
                  :title="activity.label"
                  @click="open({ kind: 'building', id: activity.building })"
                >
                  <span aria-hidden="true">{{ activity.icon }}</span>
                  <span class="tag">{{ formatClock(activity.endsAt - now) }}</span>
                </button>
              </li>
            </ul>
          </div>

          <!-- En haut à droite, aux alentours : tes armées -->
          <div v-if="view === 'world'" class="hud-right">
            <p class="hud-chip static">Armées dehors : {{ state.armies.length }} / {{ maxArmies(state) }}</p>
            <ul v-if="armies.length" class="army-list" aria-label="Tes armées dehors">
              <li v-for="army in armies" :key="army.id">
                <button
                  type="button"
                  class="hud-chip army-chip"
                  :aria-pressed="selectedArmy?.id === army.id"
                  @click="selectInWorld({ kind: 'army', id: army.id })"
                >
                  <span aria-hidden="true">{{ army.icon }}</span>
                  <span v-if="army.hero" aria-hidden="true">{{ army.hero }}</span>
                  <span>{{ army.size }}</span>
                  <span class="text tag">{{ army.status }}</span>
                </button>
              </li>
            </ul>
          </div>

          <!-- Les messages : connexion perdue, ordre refusé -->
          <div class="hud-toasts">
            <NoticeBar :notice="notice" :offline="offline" @dismiss="emit('dismissNotice')" />
            <p v-if="toast" class="toast" :class="{ good: toast.good }" role="status">{{ toast.text }}</p>
          </div>


          <!-- En bas à gauche : passer de la cité aux alentours -->
          <div class="hud-bl">
            <button type="button" class="hud-btn big" @click="switchView">
              <span class="icon" aria-hidden="true">{{ view === 'city' ? '🗺️' : '🏰' }}</span>
              <span>{{ view === 'city' ? 'Alentours' : 'Cité' }}</span>
              <span v-if="elsewhereBusy" class="dot"><span class="sr-only">(en cours)</span></span>
            </button>
          </div>

          <!-- En bas à droite : les pages du jeu -->
          <nav class="hud-br" aria-label="Pages du jeu">
            <button
              type="button"
              class="hud-btn"
              :aria-label="heroesWaiting ? 'Héros (points de compétence à placer)' : 'Héros'"
              :aria-pressed="panel?.kind === 'heroes'"
              @click="toggle('heroes')"
            >
              <span class="icon" aria-hidden="true">👑</span>
              <span>Héros</span>
              <span v-if="heroesWaiting" class="dot"></span>
            </button>
            <button
              type="button"
              class="hud-btn"
              :aria-label="newReport ? 'Rapports (nouveau rapport)' : 'Rapports'"
              :aria-pressed="panel?.kind === 'reports'"
              @click="toggle('reports')"
            >
              <span class="icon" aria-hidden="true">📜</span>
              <span>Rapports</span>
              <span v-if="newReport" class="dot"></span>
            </button>
            <button
              type="button"
              class="hud-btn"
              aria-label="Menu"
              :aria-pressed="panel?.kind === 'menu'"
              @click="toggle('menu')"
            >
              <span class="icon" aria-hidden="true">☰</span>
              <span>Menu</span>
            </button>
          </nav>
        </div>
      </main>

      <SidePanel v-if="panel" :key="panelKey" class="side" :label="PANEL_LABELS[panel.kind]" @close="open(null)">
        <template v-if="buildingId">
          <BuildingCard
            :key="buildingId"
            :building="getBuilding(buildingId)"
            :state="state"
            :now="now"
            @upgrade="emit('upgrade', buildingId)"
          />
          <template v-if="buildingId === 'castle'">
            <p>
              Chantiers en cours :
              <strong>{{ state.constructions.length }} / {{ maxConstructions(state) }}</strong
              ><template v-if="maxConstructions(state) === 1">
                · un second chantier s’ouvrira au Château niveau {{ SECOND_CONSTRUCTION_CASTLE_LEVEL }}</template
              >.
            </p>
            <p class="muted">{{ race.name }} : {{ race.bonuses.join(' · ') }}</p>
          </template>
          <TrainingList
            v-else-if="buildingId === 'barracks' && state.levels.barracks > 0"
            :state="state"
            :now="now"
            @train="(unit, count) => emit('train', unit, count)"
          />
          <ResearchPanel
            v-else-if="buildingId === 'academy' && state.levels.academy > 0"
            :state="state"
            :now="now"
            @research="(tech) => emit('research', tech)"
          />
          <SpellList
            v-else-if="buildingId === 'mageTower' && state.levels.mageTower > 0"
            :state="state"
            :now="now"
            @cast="(spell) => emit('cast', spell)"
          />
          <DefenseCard v-else-if="buildingId === 'walls'" :state="state" :now="now" @show-raid="showRaid" />
          <DragonCard
            v-else-if="buildingId === 'dragonRoost'"
            :state="state"
            :now="now"
            @hatch="emit('hatch')"
            @show-army="(id) => open({ kind: 'army', id })"
          />
        </template>

        <GarrisonCard
          v-else-if="panel.kind === 'garrison'"
          :state="state"
          @dismiss="(troops) => emit('dismiss', troops)"
          @open-barracks="open({ kind: 'building', id: 'barracks' })"
        />

        <HeroPanel
          v-else-if="panel.kind === 'heroes'"
          :state="state"
          @recruit="(hero) => emit('recruit', hero)"
          @learn="(hero, skill) => emit('learn', hero, skill)"
        />

        <TargetCard
          v-else-if="target"
          :key="targetKey(target)"
          :target="target"
          :state="state"
          :now="now"
          @march="(troops, hero, dragon) => march(target!, troops, hero, dragon)"
          @order="(army) => command(army, target!)"
        />

        <ArmyCard
          v-else-if="selectedArmy"
          :key="selectedArmy.id"
          :state="state"
          :now="now"
          :army="selectedArmy"
          @order="(to) => command(selectedArmy!.id, to, true)"
        />

        <template v-else-if="panel.kind === 'quest'">
          <QuestBanner :state="state" @claim="(id) => emit('claim', id)" />
          <p v-if="!quest">Tous les objectifs sont atteints. Bravo, ton royaume est bien lancé !</p>
        </template>

        <ReportsPanel v-else-if="panel.kind === 'reports'" :state="state" :now="now" />

        <section v-else-if="panel.kind === 'menu'" class="menu" aria-labelledby="menu-title">
          <h2 id="menu-title" class="section-title">{{ cityName }}</h2>
          <p class="muted">{{ race.bonuses.join(' · ') }}</p>
          <AccountLine :player="player" @logout="emit('logout')" @go-online="emit('goOnline')" />
          <p class="muted">
            Le jeu est pensé pour le mode paysage : sur téléphone, tourne l’écran. Touche un bâtiment, une troupe
            ou un lieu sur la carte pour agir.
          </p>
          <button v-if="canFullscreen" class="btn" type="button" @click="toggleFullscreen">
            {{ fullscreen ? 'Quitter le plein écran' : 'Plein écran' }}
          </button>
          <div v-if="player === null" class="trial">
            <p class="muted">
              Mode d’essai : tes troupes et ton dragon frappent et encaissent {{ TRIAL_BOOST }} fois plus, pour tester
              seul ce qui demandera plusieurs joueurs. Il n’existe que dans les parties sans compte.
            </p>
            <button class="btn-quiet" type="button" :aria-pressed="state.trial" @click="emit('trial', !state.trial)">
              {{ state.trial ? 'Couper le mode d’essai' : 'Activer le mode d’essai' }}
            </button>
          </div>
          <div class="restart">
            <button v-if="!confirmingRestart" class="btn-quiet" type="button" @click="confirmingRestart = true">
              Recommencer une partie
            </button>
            <template v-else>
              <p>Ta cité sera effacée pour de bon.</p>
              <button class="btn btn-danger" type="button" @click="emit('restart')">Effacer et recommencer</button>
              <button class="btn-quiet" type="button" @click="confirmingRestart = false">Annuler</button>
            </template>
          </div>
        </section>
      </SidePanel>
    </div>

    <!-- Le résumé de ce qui s'est passé pendant l'absence du joueur -->
    <div v-if="awayReport" class="modal" role="dialog" aria-modal="true" aria-labelledby="away-title">
      <section class="modal-card">
        <h2 id="away-title">Bon retour !</h2>
        <p>Pendant ton absence ({{ formatDuration(awayReport.duration) }}), ton royaume a produit :</p>
        <ul class="gains">
          <li v-for="gain in awayGains" :key="gain.id">
            <span aria-hidden="true">{{ RESOURCES[gain.id].icon }}</span> +{{ formatAmount(gain.amount) }}
            <span class="sr-only">{{ RESOURCES[gain.id].name }}</span>
          </li>
        </ul>
        <ul v-if="awayReport.events.length" class="away-events">
          <li v-for="(event, i) in awayReport.events" :key="i">{{ event }}</li>
        </ul>
        <button class="btn" type="button" @click="emit('dismissAway')">Continuer</button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.game {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--night);
}

/* Le registre des ressources, en haut de l'écran. */
.topbar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.35rem;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
  background: var(--stone-raised);
  border-bottom: 1px solid var(--seam);
}

.city-name {
  font: 700 1.4rem/1 var(--font-display);
  white-space: nowrap;
}

/* Le mode d'essai est actif : on le voit toujours, pour ne pas le confondre avec le vrai jeu. */
.trial-badge {
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--gilt);
  border-radius: 999px;
  color: var(--gilt);
  font-size: 0.8rem;
  white-space: nowrap;
}

.trial {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
}

@media (max-width: 46rem) {
  .city-name {
    display: none;
  }
}

/* La carte, et le panneau à côté d'elle. */
.body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.stage {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  container: stage / inline-size;
  /* Les boutons de la carte se rangent à droite du grand bouton rond. */
  --map-controls-left: calc(max(16px, env(safe-area-inset-left, 0px)) + 5rem);
  --map-controls-bottom: 1.1rem;
}

.side {
  flex: none;
  width: min(24rem, 46%);
  border-left: 1px solid var(--seam);
}

/* Écran tenu en hauteur : le panneau passe sous la carte. */
@media (orientation: portrait) {
  .body {
    flex-direction: column;
  }

  .side {
    width: auto;
    height: 54%;
    border-left: 0;
    border-top: 1px solid var(--seam);
  }
}

/* --- Ce qui est posé sur la carte : seuls les boutons arrêtent le doigt --- */

.hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* Les messages qui passent (.toast) laissent passer le doigt vers la carte. */
.hud button,
.hud :deep(.notice) {
  pointer-events: auto;
}

.hud-left,
.hud-right {
  position: absolute;
  top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

/* Les deux colonnes se partagent la largeur, marges comprises : elles ne se chevauchent jamais. */
.hud-left {
  left: max(16px, env(safe-area-inset-left, 0px));
  align-items: flex-start;
  max-width: min(18rem, calc(58% - 1.5rem));
}

.hud-right {
  right: max(16px, env(safe-area-inset-right, 0px));
  align-items: flex-end;
  max-width: min(15rem, calc(42% - 1.5rem));
}

.activities,
.army-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  max-width: 100%;
}

.army-list {
  flex-direction: column;
  align-items: flex-end;
}

.army-list li {
  max-width: 100%;
}

.hud-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 100%;
  min-height: 2.1rem;
  padding: 0.25rem 0.7rem;
  border: 1px solid var(--seam);
  border-radius: 999px;
  background: var(--hud);
  color: var(--parchment);
  font: 700 0.84rem/1.2 var(--font-body);
  font-variant-numeric: tabular-nums;
  box-shadow: var(--shadow);
  cursor: pointer;
}

.hud-chip.static {
  cursor: default;
  font-weight: 400;
  color: var(--faded);
}

.hud-chip .text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hud-chip .tag {
  color: var(--faded);
  font-weight: 400;
}

.hud-chip:hover:not(.static) {
  border-color: var(--faded);
}

.hud-chip.ready,
.hud-chip[aria-pressed='true'] {
  border-color: var(--gilt);
}

.hud-chip.ready {
  color: var(--gilt);
}

.hud-chip.alert {
  border-color: var(--ember);
}

/* Un raid : l'alerte se voit de loin. */
.hud-chip.raid-alert {
  color: var(--ember);
  border-width: 2px;
}

/* Les messages se posent en bas de la carte, au-dessus des boutons : en haut, ils cachaient l'objectif et l'alerte de raid. */
.hud-toasts {
  position: absolute;
  bottom: 4.4rem;
  left: 50%;
  z-index: 3;
  width: min(26rem, calc(100% - 2rem));
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.toast {
  padding: 0.6rem 0.9rem;
  background: var(--stone);
  border: 1px solid var(--ember);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.toast.good {
  border-color: var(--gilt);
}

/* L'astuce « tourne ton téléphone » ne se montre que lorsque l'écran est tenu en hauteur. */
.rotate-hint {
  display: none;
}

@media (orientation: portrait) {
  .rotate-hint {
    display: inline-flex;
  }
}

.hud-bl,
.hud-br {
  position: absolute;
  bottom: 0.6rem;
  display: flex;
  gap: 0.4rem;
}

.hud-bl {
  left: max(16px, env(safe-area-inset-left, 0px));
}

.hud-br {
  right: max(16px, env(safe-area-inset-right, 0px));
}

.hud-btn {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  width: 3.4rem;
  height: 3.4rem;
  border: 1px solid var(--seam);
  border-radius: 12px;
  background: var(--hud);
  color: var(--parchment);
  font: 700 0.64rem/1 var(--font-body);
  box-shadow: var(--shadow);
  cursor: pointer;
}

.hud-btn .icon {
  font-size: 1.4rem;
  line-height: 1.1;
}

.hud-btn:hover {
  border-color: var(--faded);
}

.hud-btn[aria-pressed='true'] {
  border-color: var(--gilt);
}

.hud-btn.big {
  width: 4.4rem;
  height: 4.4rem;
  border-color: var(--gilt);
  border-radius: 50%;
  font-size: 0.7rem;
}

.hud-btn.big .icon {
  font-size: 1.8rem;
}

/* Quand le panneau laisse peu de place à la carte, les boutons des pages se font plus petits. */
@container stage (max-width: 33rem) {
  .hud-br .hud-btn {
    width: 2.9rem;
    height: 2.9rem;
  }

  .hud-br .hud-btn > span:not(.icon):not(.dot) {
    display: none;
  }
}

.dot {
  position: absolute;
  top: 0.3rem;
  right: 0.3rem;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: var(--gilt);
  box-shadow: 0 0 0 2px var(--stone-raised);
}

/* --- Le menu --- */

.menu {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.8rem;
}

.restart {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--seam);
  width: 100%;
}

/* --- « Bon retour » --- */

.modal {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 1rem;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
  background: rgba(8, 10, 16, 0.72);
}

.modal-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.6rem;
  width: min(30rem, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: 1.1rem;
  background: var(--stone);
  border: 1px solid var(--gilt);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.modal-card h2 {
  font: 700 1.7rem/1.1 var(--font-display);
  color: var(--gilt);
}

.gains {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.away-events {
  margin: 0;
  padding-left: 1.1rem;
}
</style>
