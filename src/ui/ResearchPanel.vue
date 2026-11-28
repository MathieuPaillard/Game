<script setup lang="ts">
import { computed } from 'vue'
import { MAX_RANK, TECHS, type TechId } from '../game/config'
import { rankNumeral, type GameState } from '../game/rules'
import TechCard from './TechCard.vue'

// Les recherches de l'Académie, cercle par cercle : le premier, puis un nouveau tous les 10 niveaux.
const props = defineProps<{ state: GameState; now: number }>()
const emit = defineEmits<{ research: [tech: TechId] }>()

const ORDINALS = ['Premier', 'Deuxième', 'Troisième', 'Quatrième', 'Cinquième']

const circles = computed(() =>
  Array.from({ length: MAX_RANK }, (_, i) => {
    const techs = TECHS.filter((tech) => tech.circle === i + 1)
    const opensAt = Math.min(...techs.map((tech) => tech.unlockedAtAcademyLevel))
    return {
      circle: i + 1,
      name: `${ORDINALS[i]} cercle`,
      techs,
      opensAt,
      open: props.state.levels.academy >= opensAt,
      done: techs.every((tech) => props.state.techs[tech.id] >= tech.maxLevel),
    }
  }),
)
/** Les cercles ouverts, et le suivant, qu'on annonce. */
const opened = computed(() => circles.value.filter((c) => c.open))
const next = computed(() => circles.value.find((c) => !c.open) ?? null)
</script>

<template>
  <section class="research" aria-labelledby="research-title">
    <h2 id="research-title" class="section-title">Recherches</h2>

    <p v-if="state.levels.academy === 0" class="notice">
      Pour faire des recherches, construis d’abord l’Académie dans la cité. Elle se débloque au Château
      niveau 3.
    </p>

    <template v-else>
      <p class="muted">
        Académie niveau {{ state.levels.academy }} : une recherche à la fois. Au premier cercle, aucune recherche ne
        dépasse le niveau de l’Académie ; dans les suivants, chaque niveau en demande deux de plus.
      </p>

      <details v-for="c in opened" :key="c.circle" class="circle" :open="!c.done">
        <summary>
          <span class="circle-name">{{ c.name }}</span>
          <span class="muted">{{ c.circle === 1 ? 'Académie 1' : `Académie ${c.opensAt}` }}{{ c.done ? ' · terminé' : '' }}</span>
        </summary>
        <div class="grid">
          <TechCard
            v-for="tech in c.techs"
            :key="tech.id"
            :tech="tech"
            :state="state"
            :now="now"
            @research="emit('research', tech.id)"
          />
        </div>
      </details>

      <p v-if="next" class="next muted">
        Le {{ next.name.toLowerCase() }} s’ouvre à l’Académie niveau {{ next.opensAt }} : la grande recherche du rang
        {{ rankNumeral(next.circle) }}, et {{ next.techs.length - 1 }} recherches plus puissantes.
      </p>
    </template>
  </section>
</template>

<style scoped>
.research {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.circle {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.circle > summary {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.2rem 0.6rem;
  margin-bottom: 0.8rem;
  cursor: pointer;
}

.circle-name {
  font: 700 1.15rem/1.2 var(--font-display);
  color: var(--gilt);
}

.next {
  border-top: 1px dashed var(--seam);
  padding-top: 0.8rem;
}
</style>
