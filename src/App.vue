<script setup lang="ts">
import AccountView from './ui/AccountView.vue'
import CityView from './ui/CityView.vue'
import RaceChoice from './ui/RaceChoice.vue'
import { useGame } from './ui/useGame'

const {
  screen,
  player,
  state,
  now,
  awayReport,
  notice,
  offline,
  busy,
  login,
  register,
  logout,
  retry,
  playLocally,
  showAccount,
  chooseRace,
  upgrade,
  research,
  train,
  attack,
  dismiss,
  restart,
  dismissAwayReport,
  dismissNotice,
} = useGame()
</script>

<template>
  <AccountView
    v-if="screen === 'account'"
    :busy="busy"
    :notice="notice"
    :offline="offline"
    @login="login"
    @register="register"
    @local="playLocally"
    @clear="dismissNotice"
  />
  <main v-else-if="screen === 'connecting'" class="wrap connecting">
    <template v-if="offline || notice">
      <h1>Le royaume est injoignable</h1>
      <p class="muted">{{ notice ?? 'Le serveur ne répond pas. Vérifie ta connexion : le jeu réessaie tout seul.' }}</p>
      <div class="connecting-actions">
        <button class="btn" type="button" @click="retry">Réessayer</button>
        <button class="btn-quiet" type="button" @click="logout">Se déconnecter</button>
      </div>
    </template>
    <p v-else class="muted" role="status">Connexion au royaume…</p>
  </main>
  <RaceChoice
    v-else-if="!state"
    :busy="busy"
    :notice="notice"
    :offline="offline"
    :player="player"
    @choose="chooseRace"
    @logout="logout"
    @go-online="showAccount"
    @dismiss-notice="dismissNotice"
  />
  <CityView
    v-else
    :state="state"
    :now="now"
    :away-report="awayReport"
    :notice="notice"
    :offline="offline"
    :player="player"
    @upgrade="upgrade"
    @research="research"
    @train="train"
    @attack="attack"
    @dismiss="dismiss"
    @restart="restart"
    @dismiss-away="dismissAwayReport"
    @dismiss-notice="dismissNotice"
    @logout="logout"
    @go-online="showAccount"
  />
</template>

<style scoped>
.connecting {
  padding-block: 2.5rem 3rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  max-width: 34rem;
}

.connecting-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
</style>
