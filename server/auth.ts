// Les comptes : vérifier les noms et les mots de passe, et créer les jetons de session.
// Le serveur n'enregistre jamais un mot de passe : seulement son empreinte, impossible à inverser.

import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

export const NAME_MIN = 3
export const NAME_MAX = 20
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 200

/** Des lettres (accents compris), des chiffres, et entre eux des espaces, tirets ou apostrophes. */
const NAME_PATTERN = /^[\p{L}\p{N}](?:[\p{L}\p{M}\p{N} '’_-]*[\p{L}\p{M}\p{N}])?$/u

/** Le nom tel qu'il s'affiche, sans espaces en trop. */
export function cleanName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ')
}

/** Ce qui rend un nom unique, sans tenir compte des majuscules : « Arthur » et « arthur » sont le même joueur. */
export function nameKey(name: string): string {
  return cleanName(name).normalize('NFKC').toLowerCase()
}

/** Un nom valable ? Sinon, pourquoi ? */
export function checkName(name: string): string | null {
  const length = [...name].length
  if (length < NAME_MIN || length > NAME_MAX) {
    return `Le nom doit faire entre ${NAME_MIN} et ${NAME_MAX} caractères.`
  }
  if (!NAME_PATTERN.test(name)) {
    return 'Le nom ne peut contenir que des lettres, des chiffres, des espaces, des tirets et des apostrophes.'
  }
  return null
}

export function checkPassword(password: string): string | null {
  const length = [...password].length
  if (length < PASSWORD_MIN) return `Le mot de passe doit faire au moins ${PASSWORD_MIN} caractères.`
  if (length > PASSWORD_MAX) return `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX} caractères.`
  return null
}

// --- Les mots de passe ---

/** Les réglages de scrypt : plus ils sont élevés, plus il est long de deviner un mot de passe. */
export interface ScryptParams {
  N: number
  r: number
  p: number
}

/** Les réglages recommandés par l'OWASP : environ 0,15 seconde et 16 Mo de mémoire par mot de passe. */
export const PASSWORD_HASHING: ScryptParams = { N: 2 ** 14, r: 8, p: 5 }

const KEY_LENGTH = 32

function derive(password: string, salt: Buffer, { N, r, p }: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Le même mot de passe tapé sur deux appareils peut être codé de deux façons (les accents) : on unifie.
    scrypt(password.normalize('NFC'), salt, KEY_LENGTH, { N, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    )
  })
}

/** L'empreinte d'un mot de passe, avec son sel (tiré au hasard) et ses réglages, pour pouvoir la vérifier. */
export async function hashPassword(password: string, params = PASSWORD_HASHING): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, params)
  return ['scrypt', params.N, params.r, params.p, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, N, r, p, salt, key] = stored.split('$')
  if (algorithm !== 'scrypt' || !salt || !key) return false
  const expected = Buffer.from(key, 'base64')
  const actual = await derive(password, Buffer.from(salt, 'base64'), { N: Number(N), r: Number(r), p: Number(p) })
  // Une comparaison qui prend toujours le même temps : elle ne laisse rien deviner.
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

// --- Les sessions ---

/** Un jeton de session : 32 octets tirés au hasard, impossibles à deviner. */
export function newToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Le serveur ne garde que l'empreinte des jetons : une copie de la base ne suffirait pas pour se connecter. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
