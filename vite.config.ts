import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // Chemins relatifs dans le build : le jeu fonctionne même hors de la racine
  // d'un site, et plus tard dans l'appli Android.
  base: './',
})
