<script setup lang="ts">
import { computed } from 'vue'
import {
  RAID_CASTLE_LEVEL,
  RAID_PLUNDER_SHARE,
  WALL_GUARDS_PER_LEVEL,
  WALL_HEALTH_PER_LEVEL,
  WOUNDED_SHARE,
  type MonsterId,
} from '../game/config'
import {
  allySurvivors,
  armySize,
  foeSurvivors,
  getMonster,
  protectedAmount,
  raidsHeldUntil,
  siegeOf,
  spellBonus,
  wallGuards,
  type GameState,
  type Monsters,
} from '../game/rules'
import { foeName } from './battleLog'
import { formatAmount, formatArmy, formatDuration } from './format'
import { bandName, incomingRaids, monstersIcon } from './world'

// La défense de la cité, sous la fiche des Remparts : ses gardes, ce qui est à l'abri des pillards,
// le prochain raid, et le siège quand il a lieu.
const props = defineProps<{ state: GameState; now: number }>()
const emit = defineEmits<{ showRaid: [band: number] }>()

const level = computed(() => props.state.levels.walls)
const guards = computed(() => wallGuards(props.state))
const healthBonus = computed(() => Math.round(WALL_HEALTH_PER_LEVEL * level.value * 100))
const defenders = computed(() => armySize(props.state.troops))
const safe = computed(() => protectedAmount(props.state))
const plunderPercent = Math.round(RAID_PLUNDER_SHARE * 100)
const woundedPercent = Math.round(WOUNDED_SHARE * 100)

/** Les monstres encore debout, en quelques mots. */
function monstersText(monsters: Monsters): string {
  return (Object.entries(monsters) as [MonsterId, number][])
    .filter(([, count]) => count > 0)
    .map(([id, count]) => `${getMonster(id).icon} ${getMonster(id).name} ${count}`)
    .join(' · ')
}

// Le siège en cours : ce qui reste de tes défenseurs, et de chaque raid aux portes (et les armées
// venues aider la cité, qui se battent aussi).
const siege = computed(() => {
  const battle = siegeOf(props.state)
  const city = battle?.allies.find((ally) => ally.army === null)
  if (!battle || !city) return null
  const { troops, guards: guardsLeft } = allySurvivors(city)
  return {
    raids: battle.foes.flatMap((foe) => (foe.band === null ? [] : [foe.band])),
    round: battle.round + 1,
    foe: battle.foes.map((foe) => foeName(foe.foe)).join(', '),
    troops: formatArmy(troops),
    guards: guardsLeft,
    foes: battle.foes.map((foe) => monstersText(foeSurvivors(foe))).filter(Boolean).join(' · '),
    helpers: battle.allies.filter((ally) => ally.army !== null).length,
  }
})

// Les raids en route (sauf ceux qui assiègent la cité), du plus proche au plus lointain.
const raids = computed(() =>
  incomingRaids(props.state)
    .filter(({ band }) => !siege.value?.raids.includes(band.id))
    .map(({ band, arrival }) => ({
      id: band.id,
      name: bandName(band),
      icon: monstersIcon(band.monsters),
      left: arrival === null ? null : Math.max(0, arrival - props.now),
    })),
)
// Le prochain raid : la Brume d'oubli le retient jusqu'à ce qu'elle se lève.
const veil = computed(() => {
  const until = raidsHeldUntil(props.state)
  return until === null ? null : Math.max(0, until - props.now)
})
const nextRaid = computed(() => {
  const at = props.state.nextRaidAt
  if (at === null) return null
  return Math.max(0, Math.max(at, raidsHeldUntil(props.state) ?? 0) - props.now)
})
// L'Égide des remparts : les défenseurs ont plus de vie pendant les sièges.
const aegis = computed(() => Math.round(spellBonus(props.state, 'siegeHealth') * 100))
</script>

<template>
  <section class="plaque" aria-labelledby="defense-title">
    <h3 id="defense-title" class="plaque-name">Défense de la cité</h3>

    <div v-if="siege" class="siege" role="status">
      <p>
        <strong>La cité est assiégée !</strong> {{ siege.foe }} · manche {{ siege.round }}.
      </p>
      <p>
        Tes défenseurs : {{ siege.troops || 'plus aucune troupe' }}<template v-if="siege.guards">
          + 🧱 {{ siege.guards }} gardes</template
        >
      </p>
      <p>En face : {{ siege.foes || 'personne' }}</p>
      <p v-if="siege.helpers">
        {{ siege.helpers > 1 ? `${siege.helpers} de tes armées frappent` : 'Une de tes armées frappe' }} les raids de
        l’extérieur.
      </p>
      <p class="muted">
        Pendant le siège, tes troupes restent aux remparts : elles ne peuvent ni sortir de la cité ni être renvoyées.
      </p>
    </div>

    <ul class="facts">
      <li v-if="level > 0">
        <span aria-hidden="true">🧱</span> <strong>{{ guards }} gardes</strong> veillent sur les murs, toujours au
        complet au début d’un siège ({{ WALL_GUARDS_PER_LEVEL }} de plus à chaque niveau).
      </li>
      <li v-else>
        <span aria-hidden="true">🧱</span> Aucun garde : construis les Remparts, chaque niveau en ajoute
        {{ WALL_GUARDS_PER_LEVEL }}.
      </li>
      <li v-if="healthBonus > 0">
        <span aria-hidden="true">❤️</span> Tes troupes ont <strong>+{{ healthBonus }} % de vie</strong> quand elles
        défendent la cité.
      </li>
      <li>
        <span aria-hidden="true">🪖</span> <strong>{{ formatAmount(defenders) }} troupes</strong> dans la cité : elles
        se battent aussi aux portes.
      </li>
      <li>
        <span aria-hidden="true">🏰</span> Le Château met <strong>{{ formatAmount(safe) }}</strong> de chaque
        ressource à l’abri des pillards.
      </li>
    </ul>

    <ul v-if="raids.length" class="raids" aria-label="Raids en route">
      <li v-for="raid in raids" :key="raid.id" class="raid">
        <span aria-hidden="true">{{ raid.icon }}</span>
        <span class="raid-text">
          <strong>{{ raid.name }}</strong>
          <span v-if="raid.left !== null"> · arrive dans {{ formatDuration(raid.left) }}</span>
          <span v-else> · se bat en chemin</span>
        </span>
        <button type="button" class="btn-quiet" @click="emit('showRaid', raid.id)">Voir</button>
      </li>
    </ul>
    <p v-if="veil !== null" class="magic">
      <span aria-hidden="true">🌫️</span> La Brume d’oubli cache la cité : aucun raid ne partira avant
      {{ formatDuration(veil) }}.
    </p>
    <p v-if="aegis > 0" class="magic">
      <span aria-hidden="true">🛡️</span> L’Égide des remparts veille : +{{ aegis }} % de vie pour les défenseurs
      pendant les sièges.
    </p>
    <p v-if="nextRaid !== null && !siege">Prochain raid : il partira dans {{ formatDuration(nextRaid) }}.</p>
    <p v-else-if="nextRaid === null" class="muted">
      Les raids commenceront quand le Château atteindra le niveau {{ RAID_CASTLE_LEVEL }}.
    </p>

    <p class="muted">
      Un raid marche droit sur la cité : arrête-le en chemin avec une armée, ou laisse tes troupes et les gardes le
      repousser aux portes. Repoussé, il laisse son butin dans tes réserves. Victorieux, il emporte
      {{ plunderPercent }} % de ce qui n’est pas à l’abri. {{ woundedPercent }} % des défenseurs qui tombent ne sont
      que blessés : ils vont à l’Hôpital, s’il y reste des lits.
    </p>
  </section>
</template>

<style scoped>
.siege {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--ember);
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
}

.siege strong {
  color: var(--ember);
}

.facts,
.raids {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-variant-numeric: tabular-nums;
}

.raid {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid var(--ember);
  border-radius: 6px;
}

.raid-text {
  flex: 1;
  min-width: 0;
}

/* Un sort de défense qui veille sur la cité. */
.magic {
  color: var(--gilt);
}
</style>
