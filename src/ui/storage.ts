// Ce que le jeu garde dans le navigateur : la partie sans compte, et la session du joueur connecté.
// Le stockage peut être indisponible (navigation privée…) : on joue alors quand même, sans rien garder.

import type { GameState } from '../game/rules'
import { restoreState } from '../game/save'
import type { Session } from './api'

const SAVE_KEY = 'royaume-sauvegarde'
// À augmenter si le format de la sauvegarde change de façon incompatible :
// les anciennes sauvegardes sont alors ignorées.
const SAVE_VERSION = 1
const SESSION_KEY = 'royaume-session'

/** La partie sans compte, telle qu'elle était à la dernière visite. */
export function loadLocalGame(): GameState | null {
  const save = read(SAVE_KEY) as { version?: number; state?: unknown } | null
  return save?.version === SAVE_VERSION ? restoreState(save.state) : null
}

export function saveLocalGame(state: GameState | null) {
  write(SAVE_KEY, state && { version: SAVE_VERSION, state })
}

export function loadSession(): Session | null {
  const session = read(SESSION_KEY) as Session | null
  return typeof session?.token === 'string' && typeof session.player?.name === 'string' ? session : null
}

export function saveSession(session: Session | null) {
  write(SESSION_KEY, session)
}

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value))
    else localStorage.removeItem(key)
  } catch {
    // Stockage indisponible : tant pis, on continue sans.
  }
}
