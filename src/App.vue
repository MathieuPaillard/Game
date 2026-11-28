<script setup lang="ts">
import { watch } from 'vue'
import AccountView from './ui/AccountView.vue'
import GameScreen from './ui/GameScreen.vue'
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
  elsewhere,
  busy,
  login,
  register,
  logout,
  retry,
  playLocally,
  playHere,
  showAccount,
  chooseRace,
  upgrade,
  research,
  train,
  recruit,
  learn,
  claim,
  cast,
  hatch,
  march,
  order,
  dismiss,
  heal,
  setTrial,
  restart,
  dismissAwayReport,
  dismissNotice,
} = useGame()

// Chaque écran s'ouvre en haut de la page : l'écran précédent (le compte…) a pu être défilé.
watch(
  () => `${screen.value}:${state.value === null}`,
  () => window.scrollTo(0, 0),
  { flush: 'post' },
)
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
  <GameScreen
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
    @recruit="recruit"
    @learn="learn"
    @claim="claim"
    @cast="cast"
    @hatch="hatch"
    @march="march"
    @order="order"
    @dismiss="dismiss"
    @heal="heal"
    @trial="setTrial"
    @restart="restart"
    @dismiss-away="dismissAwayReport"
    @dismiss-notice="dismissNotice"
    @logout="logout"
    @go-online="showAccount"
  />
  <div v-if="elsewhere" class="elsewhere" role="dialog" aria-modal="true" aria-labelledby="elsewhere-title">
    <section class="plaque elsewhere-box">
      <h2 id="elsewhere-title" class="plaque-name">Ta partie est ouverte ailleurs</h2>
      <p>
        Elle se joue dans un autre onglet de ce navigateur. Pour ne rien perdre, elle ne se joue que dans un onglet à
        la fois : celui-ci attend.
      </p>
      <button class="btn" type="button" @click="playHere">Jouer ici</button>
    </section>
  </div>
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

.elsewhere {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(0 0 0 / 0.6);
}

.elsewhere-box {
  max-width: 26rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.connecting-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
</style>
