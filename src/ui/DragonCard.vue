<script setup lang="ts">
import { computed } from 'vue'
import {
  DRAGON_BREATH_EVERY,
  DRAGON_BREATH_TARGETS,
  DRAGON_EGG_ICON,
  DRAGON_HATCH_COST,
  DRAGON_HATCH_SECONDS,
  DRAGON_ICON,
  DRAGON_MAX_LEVEL,
  DRAGON_UPKEEP_PER_LEVEL,
  RESOURCES,
  RESOURCE_IDS,
} from '../game/config'
import {
  checkHatch,
  dragonArmy,
  dragonAttack,
  dragonLevel,
  dragonMaxHealth,
  dragonNature,
  dragonResting,
  dragonXpForLevel,
  type GameState,
} from '../game/rules'
import { formatAmount, formatDuration } from './format'
import { dragonOfNature } from './world'

// Le dragon, sous la fiche de l'Aire du dragon : l'œuf à couver, l'éclosion, puis le dragon lui-même
// (son niveau, son expérience, ses forces, ce qu'il mange, et où il se trouve).
const props = defineProps<{ state: GameState; now: number }>()
const emit = defineEmits<{ hatch: []; showArmy: [id: number] }>()

const dragon = computed(() => props.state.dragon)
const level = computed(() => dragonLevel(props.state))
const roost = computed(() => props.state.levels.dragonRoost)
const hatch = computed(() => checkHatch(props.state))
const cost = RESOURCE_IDS.filter((id) => DRAGON_HATCH_COST[id]).map((id) => ({ id, amount: DRAGON_HATCH_COST[id] ?? 0 }))

// L'éclosion : le temps qui reste, et où en est la barre.
const hatching = computed(() => {
  const at = dragon.value?.stage === 'hatching' ? dragon.value.hatchAt : null
  if (at === null || at === undefined) return null
  const left = Math.max(0, at - props.now)
  return { left, progress: Math.min(1, Math.max(0, 1 - left / (DRAGON_HATCH_SECONDS * 1000))) }
})

// L'expérience vers le niveau suivant ; ou bien son aire le retient.
const growth = computed(() => {
  const current = dragon.value
  if (current?.stage !== 'grown') return null
  if (level.value >= DRAGON_MAX_LEVEL) return { kind: 'max' as const }
  const from = dragonXpForLevel(level.value)
  const to = dragonXpForLevel(level.value + 1)
  if (current.xp >= to) return { kind: 'held' as const }
  return { kind: 'xp' as const, current: current.xp - from, needed: to - from, ratio: (current.xp - from) / (to - from) }
})

// Sa nature, et ce que touche son cône de flammes.
const nature = computed(() => dragonNature(props.state))
const coneFoes = computed(() => 1 + DRAGON_BREATH_TARGETS + (nature.value?.extraTargets ?? 0))
// « Dragon de Givre », « Dragon d’Orage ».
const natureTitle = computed(() => {
  const title = nature.value ? dragonOfNature(nature.value) : ''
  return title.charAt(0).toUpperCase() + title.slice(1)
})

const army = computed(() => dragonArmy(props.state))
const rest = computed(() => {
  const until = dragon.value?.restUntil ?? null
  return until !== null && dragonResting(props.state, props.now) ? until - props.now : null
})
</script>

<template>
  <section class="plaque" aria-labelledby="dragon-title">
    <h3 id="dragon-title" class="plaque-name">Le dragon</h3>

    <template v-if="!dragon">
      <p>
        <span aria-hidden="true">{{ DRAGON_EGG_ICON }}</span> Aucun œuf pour l’instant. Les anciens parlent d’un œuf de
        dragon, gardé par les vouivres au Nid de la vouivre, de l’autre côté de la rivière.
      </p>
      <p class="muted">Un objectif te mènera jusqu’à lui.</p>
    </template>

    <template v-else-if="dragon.stage === 'egg'">
      <p><span aria-hidden="true">{{ DRAGON_EGG_ICON }}</span> Un œuf de dragon attend d’être couvé.</p>
      <ul class="cost" aria-label="Coût">
        <li v-for="item in cost" :key="item.id" :class="{ short: state.resources[item.id] < item.amount }">
          <span aria-hidden="true">{{ RESOURCES[item.id].icon }}</span> {{ formatAmount(item.amount) }}
          <span class="sr-only">{{ RESOURCES[item.id].name }}</span>
        </li>
        <li class="muted"><span aria-hidden="true">⏱</span> {{ formatDuration(DRAGON_HATCH_SECONDS * 1000) }}</li>
      </ul>
      <p v-if="!hatch.ok" class="reason">{{ hatch.reason }}</p>
      <button class="btn" type="button" :disabled="!hatch.ok" @click="emit('hatch')">Couver l’œuf</button>
    </template>

    <template v-else-if="hatching">
      <p><span aria-hidden="true">{{ DRAGON_EGG_ICON }}</span> L’œuf se fendille : il éclora dans {{ formatDuration(hatching.left) }}.</p>
      <div class="progress" role="progressbar" :aria-valuenow="Math.round(hatching.progress * 100)" aria-valuemin="0" aria-valuemax="100" aria-label="Éclosion">
        <span class="progress-fill" :style="{ width: `${hatching.progress * 100}%` }"></span>
      </div>
    </template>

    <template v-else>
      <p class="dragon-line">
        <span class="dragon-icon" aria-hidden="true">{{ DRAGON_ICON }}</span>
        <span>
          <strong>Niveau {{ level }}</strong>
          <span class="muted"> · attaque {{ formatAmount(dragonAttack(level)) }} · vie {{ formatAmount(dragonMaxHealth(state)) }}</span>
        </span>
      </p>
      <p v-if="nature" class="nature">
        <span aria-hidden="true">{{ nature.icon }}</span> <strong>{{ natureTitle }}</strong> ·
        {{ nature.description }}
      </p>
      <div v-if="growth?.kind === 'xp'" class="xp">
        <div class="progress" role="progressbar" :aria-valuenow="Math.round(growth.ratio * 100)" aria-valuemin="0" aria-valuemax="100" aria-label="Expérience">
          <span class="progress-fill" :style="{ width: `${growth.ratio * 100}%` }"></span>
        </div>
        <p class="muted">Expérience : {{ formatAmount(growth.current) }} / {{ formatAmount(growth.needed) }}, pour le niveau {{ level + 1 }}.</p>
      </div>
      <p v-else-if="growth?.kind === 'held'" class="hint">
        Il a l’expérience du niveau suivant, mais son aire le retient au niveau {{ roost }} : agrandis l’Aire du dragon.
      </p>
      <p v-else class="muted">Il a atteint le niveau maximum.</p>
      <p class="muted">
        Toutes les {{ DRAGON_BREATH_EVERY }} manches, il crache un cône de flammes sur la cible de son armée et les
        adversaires les plus proches ({{ coneFoes }} au plus).
      </p>
      <p class="muted">
        Il se bat comme un mage : les archers le dominent. Il mange
        {{ formatAmount(DRAGON_UPKEEP_PER_LEVEL * level) }} de nourriture par heure.
      </p>

      <p v-if="rest !== null" class="reason" role="status">Blessé, il se repose encore {{ formatDuration(rest) }} dans son aire.</p>
      <div v-else-if="army" class="with-army">
        <p>Il accompagne une de tes armées.</p>
        <button class="btn-quiet" type="button" @click="emit('showArmy', army.id)">Voir l’armée</button>
      </div>
      <p v-else>
        Dans son aire, il défendra la cité si un raid l’assiège. Pour l’emmener au combat, touche une cible aux
        alentours.
      </p>
    </template>
  </section>
</template>

<style scoped>
.nature strong {
  color: var(--gilt);
}

.dragon-line {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-variant-numeric: tabular-nums;
}

.dragon-icon {
  font-size: 2.2rem;
  line-height: 1;
}

.xp {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.hint {
  color: var(--gilt);
}

.with-army {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
</style>
