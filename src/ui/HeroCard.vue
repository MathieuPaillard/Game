<script setup lang="ts">
import { computed } from 'vue'
import { HERO_MAX_LEVEL, RESOURCES, RESOURCE_IDS, SKILL_MAX_LEVEL, type HeroDef } from '../game/config'
import { checkRecruit, checkSkill, getHero, heroArmy, skillPoints, xpToNextLevel, type GameState } from '../game/rules'
import { formatAmount } from './format'
import { armyStatusText } from './world'

// La plaque d'un héros : à recruter, ou déjà à ton service, avec son expérience et ses compétences.
const props = defineProps<{ hero: HeroDef; state: GameState }>()
const emit = defineEmits<{ recruit: []; learn: [skill: string] }>()

const recruited = computed(() => getHero(props.state, props.hero.id))
const locked = computed(() => !recruited.value && props.state.levels.castle < props.hero.castleLevel)
const army = computed(() => heroArmy(props.state, props.hero.id))
const points = computed(() => (recruited.value ? skillPoints(recruited.value) : 0))
const maxed = computed(() => recruited.value?.level === HERO_MAX_LEVEL)
const nextXp = computed(() => (recruited.value ? xpToNextLevel(recruited.value.level) : 0))
const progress = computed(() => {
  const hero = recruited.value
  if (!hero) return 0
  return maxed.value ? 1 : Math.min(1, hero.xp / nextXp.value)
})

const recruitCheck = computed(() => checkRecruit(props.state, props.hero.id))
const cost = computed(() =>
  RESOURCE_IDS.filter((id) => props.hero.cost[id]).map((id) => ({ id, amount: props.hero.cost[id] ?? 0 })),
)

const skills = computed(() =>
  props.hero.skills.map((skill) => ({
    skill,
    level: recruited.value?.skills[skill.id] ?? 0,
    canLearn: recruited.value !== undefined && checkSkill(props.state, props.hero.id, skill.id).ok,
  })),
)
</script>

<template>
  <article class="plaque" :class="{ empty: locked, working: army }">
    <header class="plaque-head">
      <span class="plaque-icon" aria-hidden="true">{{ hero.icon }}</span>
      <div>
        <h3 class="plaque-name">{{ hero.name }}</h3>
        <p class="plaque-level">
          {{ hero.title }}<template v-if="recruited"> · Niveau {{ recruited.level }}</template>
        </p>
      </div>
    </header>

    <p class="muted">{{ hero.description }}</p>

    <div v-if="recruited" class="works">
      <div
        class="progress"
        role="progressbar"
        :aria-valuenow="Math.round(progress * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Expérience"
      >
        <span class="progress-fill" :style="{ width: `${progress * 100}%` }"></span>
      </div>
      <p class="works-label">
        <template v-if="maxed">Niveau maximum</template>
        <template v-else>
          Expérience : {{ formatAmount(recruited.xp) }} / {{ formatAmount(nextXp) }} pour le niveau
          {{ recruited.level + 1 }}
        </template>
      </p>
      <p>
        <template v-if="army">Mène une armée · {{ armyStatusText(state, army) }}</template>
        <template v-else>À la cité, prêt à mener une armée.</template>
      </p>
      <p v-if="points > 0" class="points">
        {{ points }} point{{ points > 1 ? 's' : '' }} de compétence à placer.
      </p>
    </div>

    <ul class="skills" aria-label="Compétences">
      <li v-for="item in skills" :key="item.skill.id" class="skill">
        <span class="skill-icon" aria-hidden="true">{{ item.skill.icon }}</span>
        <div class="skill-text">
          <p>
            <strong>{{ item.skill.name }}</strong>
            <span v-if="recruited" class="muted"> · {{ item.level }} / {{ SKILL_MAX_LEVEL }}</span>
          </p>
          <p class="muted">{{ item.skill.description }}</p>
        </div>
        <button
          v-if="item.canLearn"
          class="btn learn"
          type="button"
          :aria-label="`Apprendre ${item.skill.name}`"
          @click="emit('learn', item.skill.id)"
        >
          +1
        </button>
      </li>
    </ul>

    <div v-if="!recruited" class="plaque-foot">
      <ul class="cost" aria-label="Coût">
        <li v-for="item in cost" :key="item.id" :class="{ short: state.resources[item.id] < item.amount }">
          <span aria-hidden="true">{{ RESOURCES[item.id].icon }}</span>
          {{ formatAmount(item.amount) }}
          <span class="sr-only">{{ RESOURCES[item.id].name }}</span>
        </li>
      </ul>
      <p v-if="!recruitCheck.ok" class="reason">{{ recruitCheck.reason }}</p>
      <button class="btn" type="button" :disabled="!recruitCheck.ok" @click="emit('recruit')">Recruter</button>
    </div>
  </article>
</template>

<style scoped>
.points {
  color: var(--gilt);
  font-weight: 700;
}

.skills {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.skill {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.skill-icon {
  flex: none;
  width: 1.75rem;
  font-size: 1.3rem;
  text-align: center;
}

.skill-text {
  flex: 1;
  min-width: 0;
  font-size: 0.95rem;
}

.learn {
  flex: none;
  min-width: 2.75rem;
  padding-inline: 0.6rem;
}
</style>
