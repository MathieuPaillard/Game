// Ce que le jeu garde dans le navigateur : la partie sans compte, et la session du joueur connecté.
// Le stockage peut être indisponible (navigation privée…) : on joue alors quand même, sans rien garder.

import type { GameState } from '../game/rules'
import { restoreState } from '../game/save'
import type { Session } from './api'

const SAVE_KEY = 'royaume-sauvegarde'
// Une partie qui n'a pas pu être reprise est mise de côté ici, plutôt qu'effacée.
const DAMAGED_KEY = 'royaume-sauvegarde-abimee'
// À augmenter si le format de la sauvegarde change de façon incompatible :
// les anciennes sauvegardes ne peuvent alors plus être reprises.
const SAVE_VERSION = 1
const SESSION_KEY = 'royaume-session'

/**
 * La partie sans compte, telle qu'elle était à la dernière visite, ou null s'il n'y en a pas.
 * 'damaged' : il y en avait une, mais illisible (abîmée, ou d'une version trop ancienne) ; elle est
 * alors mise de côté, pour que le joueur puisse en commencer une autre.
 */
export function loadLocalGame(): GameState | 'damaged' | null {
  const raw = readRaw(SAVE_KEY)
  if (raw === null) return null
  let save: { version?: number; state?: unknown } | null = null
  try {
    save = JSON.parse(raw)
  } catch {
    // Ce n'est même pas du JSON.
  }
  const state = save?.version === SAVE_VERSION ? restoreState(save.state) : null
  if (state) return state
  setAsideLocalGame()
  return 'damaged'
}

/** Met de côté la partie sans compte, qu'on ne peut pas reprendre : elle n'est pas perdue pour autant. */
export function setAsideLocalGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) localStorage.setItem(DAMAGED_KEY, raw)
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // Stockage indisponible : il n'y a rien à mettre de côté.
  }
}

/** Garde la partie sans compte. Renvoie false si le navigateur a refusé (stockage plein ou interdit). */
export function saveLocalGame(state: GameState | null): boolean {
  return write(SAVE_KEY, state && { version: SAVE_VERSION, state })
}

export function loadSession(): Session | null {
  const session = read(SESSION_KEY) as Session | null
  return typeof session?.token === 'string' && typeof session.player?.name === 'string' ? session : null
}

export function saveSession(session: Session | null) {
  write(SESSION_KEY, session)
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function read(key: string): unknown {
  try {
    const raw = readRaw(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): boolean {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value))
    else localStorage.removeItem(key)
    return true
  } catch {
    // Stockage indisponible : on continue sans.
    return false
  }
}
