// Les échanges avec le serveur du jeu (voir server/app.ts pour la liste des adresses).

import type { Action } from '../game/actions'
import type { RaceId } from '../game/config'
import type { GameState } from '../game/rules'

/** L'adresse du serveur. Vide (le cas normal) : le serveur est sur le même site que le jeu. */
const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? ''

/** La page de démo sur claude.ai n'a pas de serveur : on n'y joue que sur l'appareil. */
export const ONLINE_AVAILABLE = import.meta.env.VITE_LOCAL_ONLY !== 'true'

export interface Session {
  token: string
  player: { name: string }
}

/** Une erreur à montrer au joueur. `status` vaut 0 quand le serveur n'a pas répondu du tout. */
export class ServerError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const UNREACHABLE = 'Le serveur ne répond pas. Vérifie ta connexion, puis réessaie.'

// L'écart entre l'horloge de cet appareil et celle du serveur, qui fait foi.
let clockOffset = 0

/** L'heure du serveur, estimée d'après ses réponses. */
export function serverNow(): number {
  return Date.now() + clockOffset
}

async function call<T>(method: string, path: string, options: { token?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  const sentAt = Date.now()
  let response: Response
  try {
    response = await fetch(`${SERVER_URL}/api/${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      // Sans réponse au bout de 15 secondes, on abandonne : le jeu réessaiera.
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new ServerError(0, UNREACHABLE)
  }
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const fallback = response.status >= 500 ? UNREACHABLE : 'Le serveur a refusé la demande.'
    throw new ServerError(response.status, typeof data.error === 'string' ? data.error : fallback)
  }
  // L'heure du serveur correspond à peu près au milieu de l'aller-retour.
  if (typeof data.now === 'number') clockOffset = data.now - (sentAt + Date.now()) / 2
  return data as T
}

export const server = {
  register: (name: string, password: string) => call<Session>('POST', 'accounts', { body: { name, password } }),
  login: (name: string, password: string) => call<Session>('POST', 'sessions', { body: { name, password } }),
  logout: (token: string) => call<void>('DELETE', 'sessions/current', { token }),
  /** La partie telle qu'elle était à la dernière visite (null si la race n'est pas encore choisie). */
  game: (token: string) =>
    call<{ player: { name: string }; game: GameState | null; now: number }>('GET', 'game', { token }),
  start: (token: string, race: RaceId) => call<{ game: GameState; now: number }>('POST', 'game', { token, body: { race } }),
  act: (token: string, action: Action) =>
    call<{ ok: boolean; reason?: string; game: GameState; now: number }>('POST', 'game/actions', { token, body: action }),
  restart: (token: string) => call<void>('DELETE', 'game', { token }),
}
