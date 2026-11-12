/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// En développement, le jeu (npm run dev) transmet ses demandes /api au serveur (npm run server).
const proxy = { '/api': 'http://localhost:3000' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // Chemins relatifs dans le build : le jeu fonctionne même hors de la racine
  // d'un site, et plus tard dans l'appli Android.
  base: './',
  server: { proxy },
  preview: { proxy },
  test: {
    // La base de données intégrée à Node.js est encore « expérimentale » : on tait cet avertissement.
    execArgv: ['--disable-warning=ExperimentalWarning'],
  },
})
