/// <reference types="vite/client" />

// Les réglages lus au moment de construire le jeu (fichier .env, ou variables d'environnement).
interface ImportMetaEnv {
  /** L'adresse du serveur, s'il n'est pas sur le même site que le jeu (pour l'appli Android, plus tard). */
  readonly VITE_SERVER_URL?: string
  /** « true » : le jeu se joue seulement sur l'appareil, sans serveur (la page de démo). */
  readonly VITE_LOCAL_ONLY?: string
}
