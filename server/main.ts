// Démarre le serveur du jeu : `npm start`, ou `npm run server` pendant le développement
// (il redémarre alors tout seul à chaque modification du code).
//
// Réglages, par variables d'environnement (l'hébergeur fournit souvent PORT lui-même) :
//   PORT           le port à écouter (3000 par défaut) ;
//   DATABASE_FILE  le fichier de la base de données (data/royaume.db par défaut) ;
//   STATIC_DIR     le dossier du jeu construit par `npm run build` (dist par défaut).

import { serve } from '@hono/node-server'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createApp } from './app.ts'
import { openStore } from './db.ts'

const port = Number(process.env.PORT) || 3000
const databaseFile = process.env.DATABASE_FILE || 'data/royaume.db'
const staticDir = process.env.STATIC_DIR || 'dist'
const built = existsSync(staticDir)

mkdirSync(dirname(databaseFile), { recursive: true })
const store = openStore(databaseFile)
const app = createApp({ store, staticDir: built ? staticDir : undefined })

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Le serveur du royaume écoute sur http://localhost:${info.port}`)
  console.log(`Base de données : ${databaseFile}`)
  if (!built) console.log('Le jeu n’est pas encore construit (npm run build) : ouvre-le avec npm run dev.')
})

// Arrêt demandé (Ctrl+C, ou l'hébergeur qui redémarre le serveur) : on ferme proprement la base.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    store.close()
    process.exit(0)
  })
}
