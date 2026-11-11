<script setup lang="ts">
import CityView from './ui/CityView.vue'
import RaceChoice from './ui/RaceChoice.vue'
import { useGame } from './ui/useGame'

const { state, now, awayReport, chooseRace, upgrade, train, attack, restart, dismissAwayReport } = useGame()
</script>

<template>
  <RaceChoice v-if="!state" @choose="chooseRace" />
  <CityView
    v-else
    :state="state"
    :now="now"
    :away-report="awayReport"
    @upgrade="upgrade"
    @train="train"
    @attack="attack"
    @restart="restart"
    @dismiss-away="dismissAwayReport"
  />
</template>
