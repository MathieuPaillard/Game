<script setup lang="ts">
import { computed } from 'vue'
import { QUESTS, RESOURCES, RESOURCE_IDS } from '../game/config'
import { currentQuest, questDone, questProgress, type GameState } from '../game/rules'
import { formatAmount } from './format'

// L'objectif du moment : ce qu'il faut faire, où on en est, et la récompense à recevoir.
const props = defineProps<{ state: GameState }>()
const emit = defineEmits<{ claim: [quest: string] }>()

const quest = computed(() => currentQuest(props.state))
/** Les objectifs se suivent : celui du moment vient après ceux déjà récompensés. */
const number = computed(() => props.state.quests.length + 1)
const progress = computed(() => (quest.value ? questProgress(props.state, quest.value) : null))
const ratio = computed(() => (progress.value ? Math.min(1, progress.value.current / progress.value.target) : 0))
const done = computed(() => (quest.value ? questDone(props.state, quest.value) : false))
const reward = computed(() => {
  const r = quest.value?.reward ?? {}
  return RESOURCE_IDS.filter((id) => r[id]).map((id) => ({ id, amount: r[id] ?? 0 }))
})
</script>

<template>
  <section v-if="quest && progress" class="quest" :class="{ done }" aria-labelledby="quest-title">
    <p class="eyebrow">Objectif {{ number }} sur {{ QUESTS.length }}</p>
    <h2 id="quest-title" class="quest-name">{{ quest.name }}</h2>
    <p>{{ quest.description }}</p>
    <div class="quest-progress">
      <div
        class="progress"
        role="progressbar"
        :aria-valuenow="Math.round(ratio * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Avancement"
      >
        <span class="progress-fill" :style="{ width: `${ratio * 100}%` }"></span>
      </div>
      <span class="count">
        {{ formatAmount(Math.min(progress.current, progress.target)) }} / {{ formatAmount(progress.target) }}
      </span>
    </div>
    <div class="quest-foot">
      <p class="reward">
        Récompense :
        <span v-for="item in reward" :key="item.id" class="reward-item">
          <span aria-hidden="true">{{ RESOURCES[item.id].icon }}</span> {{ formatAmount(item.amount) }}
          <span class="sr-only">{{ RESOURCES[item.id].name }}</span>
        </span>
      </p>
      <button v-if="done" class="btn" type="button" @click="emit('claim', quest.id)">Recevoir la récompense</button>
    </div>
  </section>
</template>

<style scoped>
.quest {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.9rem 1rem;
  background: var(--stone);
  border: 1px solid var(--seam);
  border-radius: var(--radius);
}

.quest.done {
  border-color: var(--gilt);
}

.quest-name {
  font: 700 1.35rem/1.1 var(--font-display);
}

.quest-progress {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.quest-progress .progress {
  flex: 1;
}

.count {
  flex: none;
  font-variant-numeric: tabular-nums;
  color: var(--faded);
}

.quest-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem 1rem;
}

.reward {
  font-variant-numeric: tabular-nums;
}

.reward-item {
  margin-left: 0.5rem;
  white-space: nowrap;
}
</style>
