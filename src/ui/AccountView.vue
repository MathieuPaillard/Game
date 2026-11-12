<script setup lang="ts">
import { ref } from 'vue'

// L'entrée du jeu : se connecter, créer un compte, ou jouer sans compte sur cet appareil.
defineProps<{ busy: boolean; notice: string | null; offline: boolean }>()
const emit = defineEmits<{
  login: [name: string, password: string]
  register: [name: string, password: string]
  local: []
  clear: []
}>()

const mode = ref<'login' | 'register'>('login')
const name = ref('')
const password = ref('')

function switchTo(next: 'login' | 'register') {
  mode.value = next
  emit('clear')
}

function submit() {
  if (mode.value === 'login') emit('login', name.value, password.value)
  else emit('register', name.value, password.value)
}
</script>

<template>
  <main class="wrap account">
    <header class="account-head">
      <p class="eyebrow">Royaume en chantier</p>
      <h1>Entre dans le royaume</h1>
      <p class="muted">Avec un compte, ta cité est gardée sur le serveur : tu la retrouves sur tous tes appareils.</p>
    </header>

    <form class="plaque account-form" @submit.prevent="submit">
      <div class="modes" role="group" aria-label="Connexion ou nouveau compte">
        <button type="button" class="mode" :aria-pressed="mode === 'login'" @click="switchTo('login')">
          J’ai un compte
        </button>
        <button type="button" class="mode" :aria-pressed="mode === 'register'" @click="switchTo('register')">
          Créer un compte
        </button>
      </div>

      <label class="input">
        <span>Nom de joueur</span>
        <input
          v-model="name"
          name="username"
          autocomplete="username"
          autocapitalize="off"
          spellcheck="false"
          required
          minlength="3"
          maxlength="20"
        />
      </label>
      <p v-if="mode === 'register'" class="hint">
        De 3 à 20 caractères : des lettres, des chiffres, des espaces ou des tirets. Les autres joueurs le verront.
      </p>

      <label class="input">
        <span>Mot de passe</span>
        <input
          v-model="password"
          type="password"
          name="password"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          required
          :minlength="mode === 'register' ? 8 : undefined"
          maxlength="200"
        />
      </label>
      <p v-if="mode === 'register'" class="hint">
        8 caractères au moins. Retiens-le bien : sans adresse e-mail, il ne peut pas être récupéré.
      </p>

      <p v-if="offline" class="error" role="alert">Le serveur ne répond pas. Vérifie ta connexion, puis réessaie.</p>
      <p v-else-if="notice" class="error" role="alert">{{ notice }}</p>

      <button class="btn" type="submit" :disabled="busy">
        {{ busy ? 'Un instant…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte' }}
      </button>
    </form>

    <section class="local" aria-labelledby="local-title">
      <h2 id="local-title">Sans compte</h2>
      <p class="muted">Ta partie reste sur cet appareil, sans passer par le serveur.</p>
      <button class="btn-quiet" type="button" @click="emit('local')">Jouer sans compte</button>
    </section>
  </main>
</template>

<style scoped>
.account {
  padding-block: 2.5rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  max-width: 30rem;
}

.account-head {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.account-form {
  gap: 1rem;
}

.modes {
  display: flex;
  border-bottom: 1px solid var(--seam);
}

.mode {
  flex: 1 1 0;
  padding-block: 0.6rem;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  color: var(--faded);
  font: 700 0.95rem/1.2 var(--font-body);
  cursor: pointer;
}

.mode:hover {
  color: var(--parchment);
}

.mode[aria-pressed='true'] {
  color: var(--parchment);
  border-bottom-color: var(--gilt);
}

.input {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 700;
}

.input input {
  width: 100%;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--seam);
  border-radius: 6px;
  background: var(--night);
  color: var(--parchment);
  font: 400 1rem/1.2 var(--font-body);
}

.input input:focus-visible {
  outline: 2px solid var(--gilt);
  outline-offset: 1px;
}

.hint {
  margin-top: -0.5rem;
  font-size: 0.85rem;
  color: var(--faded);
}

.error {
  color: var(--ember);
  font-weight: 700;
}

.local {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--seam);
}

.local h2 {
  font: 700 1.4rem/1.1 var(--font-display);
}
</style>
