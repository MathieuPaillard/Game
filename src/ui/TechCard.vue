<script setup lang="ts">
import { computed } from 'vue'
import { RESOURCES, RESOURCE_IDS, type TechDef } from '../game/config'
import { checkResearch, researchCost, researchDuration, type GameState } from '../game/rules'
import { formatAmount, formatDuration } from './format'

const props = defineProps<{ tech: TechDef; state: GameState; now: number }>()
const emit = defineEmits<{ research: [] }>()

const level = computed(() => props.state.techs[props.tech.id])
const target = computed(() => level.value + 1)
const maxed = computed(() => level.value >= props.tech.maxLevel)
const locked = computed(() => props.state.levels.academy < props.tech.unlockedAtAcademyLevel)

const running = computed(() => (props.state.research?.tech === props.tech.id ? props.state.research : null))
const progress = computed(() => {
  const r = running.value
  if (!r) return 0
  return Math.min(1, Math.max(0, (props.now - r.startedAt) / (r.endsAt - r.startedAt)))
})

const check = computed(() => checkResearch(props.state, props.tech.id))
const reason = computed(() => (check.value.ok ? null : check.value.reason))
const cost = computed(() => {
  const c = researchCost(props.tech, target.value)
  return RESOURCE_IDS.filter((id) => c[id]).map((id) => ({ id, amount: c[id] ?? 0 }))
})
const duration = computed(() => researchDuration(props.tech, target.value))

/** L'effet cumulé des niveaux déjà atteints : « +20 % », « −10 % » ou « +1 armée ». */
const effectNow = computed(() => {
  const effect = props.tech.effect
  const total = effect.perLevel * level.value
  if (effect.kind === 'armies') return `+${total} armée${total > 1 ? 's' : ''} en campagne`
  const percent = Math.round(total * 100)
  return effect.kind === 'marchSpeed' || effect.kind === 'constructionSpeed' ? `−${percent} %` : `+${percent} %`
})
</script>

<template>
  <article class="plaque" :class="{ empty: locked, working: running }">
    <header class="plaque-head">
      <span class="plaque-icon" aria-hidden="true">{{ tech.icon }}</span>
      <div>
        <h3 class="plaque-name">{{ tech.name }}</h3>
        <p class="plaque-level">Niveau {{ level }} / {{ tech.maxLevel }}</p>
      </div>
    </header>

    <p class="muted">{{ tech.description }}.</p>
    <p v-if="level > 0">Effet actuel : <strong>{{ effectNow }}</strong></p>

    <div class="plaque-foot">
      <div v-if="running" class="works" role="status">
        <div class="progress"><span class="progress-fill" :style="{ width: `${progress * 100}%` }"></span></div>
        <p class="works-label">
          Niveau {{ running.targetLevel }} en recherche · {{ formatDuration(running.endsAt - now) }}
        </p>
      </div>

      <p v-else-if="maxed" class="muted">Niveau maximum atteint</p>

      <template v-else>
        <ul class="cost" aria-label="Coût">
          <li v-for="item in cost" :key="item.id" :class="{ short: state.resources[item.id] < item.amount }">
            <span aria-hidden="true">{{ RESOURCES[item.id].icon }}</span>
            {{ formatAmount(item.amount) }}
            <span class="sr-only">{{ RESOURCES[item.id].name }}</span>
          </li>
          <li class="muted"><span aria-hidden="true">⏱</span> {{ formatDuration(duration) }}</li>
        </ul>
        <p v-if="reason" class="reason">{{ reason }}</p>
        <button class="btn" type="button" :disabled="!check.ok" @click="emit('research')">
          Rechercher le niveau {{ target }}
        </button>
      </template>
    </div>
  </article>
</template>
