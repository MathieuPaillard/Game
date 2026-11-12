// La base de données du serveur : un simple fichier SQLite, géré par Node.js lui-même.
// Trois tables : les comptes, les sessions (qui est connecté) et les parties.

import { DatabaseSync } from 'node:sqlite'
import type { GameState } from '../src/game/rules.ts'

/**
 * Les versions successives de la base. Pour la faire évoluer, on ajoute une étape à la fin de
 * la liste, sans jamais modifier les précédentes : chaque base est mise à jour au démarrage.
 */
const MIGRATIONS = [
  `CREATE TABLE accounts (
     id INTEGER PRIMARY KEY,
     name TEXT NOT NULL,
     name_key TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     created_at INTEGER NOT NULL
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     used_at INTEGER NOT NULL
   );
   CREATE INDEX sessions_by_account ON sessions (account_id);
   CREATE TABLE games (
     account_id INTEGER PRIMARY KEY REFERENCES accounts (id) ON DELETE CASCADE,
     state TEXT NOT NULL,
     saved_at INTEGER NOT NULL
   );`,
]

export interface Account {
  id: number
  name: string
}

export type Store = ReturnType<typeof openStore>

/** Ouvre la base (`:memory:` pour une base éphémère, dans les tests) et la met à jour si besoin. */
export function openStore(file: string) {
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  migrate(db)

  const sql = {
    createAccount: db.prepare(
      `INSERT INTO accounts (name, name_key, password_hash, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (name_key) DO NOTHING RETURNING id`,
    ),
    findAccount: db.prepare('SELECT id, name, password_hash FROM accounts WHERE name_key = ?'),
    createSession: db.prepare('INSERT INTO sessions (token_hash, account_id, created_at, used_at) VALUES (?, ?, ?, ?)'),
    findSession: db.prepare(
      `SELECT accounts.id, accounts.name FROM sessions JOIN accounts ON accounts.id = sessions.account_id
       WHERE sessions.token_hash = ? AND sessions.used_at >= ?`,
    ),
    touchSession: db.prepare('UPDATE sessions SET used_at = ? WHERE token_hash = ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    deleteOldSessions: db.prepare('DELETE FROM sessions WHERE used_at < ?'),
    loadGame: db.prepare('SELECT state FROM games WHERE account_id = ?'),
    saveGame: db.prepare(
      `INSERT INTO games (account_id, state, saved_at) VALUES (?, ?, ?)
       ON CONFLICT (account_id) DO UPDATE SET state = excluded.state, saved_at = excluded.saved_at`,
    ),
    deleteGame: db.prepare('DELETE FROM games WHERE account_id = ?'),
  }

  return {
    /** Crée un compte, ou renvoie null si le nom est déjà pris. */
    createAccount(name: string, nameKey: string, passwordHash: string, now: number): Account | null {
      const row = sql.createAccount.get(name, nameKey, passwordHash, now)
      return row ? { id: Number(row.id), name } : null
    },

    findAccount(nameKey: string): (Account & { passwordHash: string }) | null {
      const row = sql.findAccount.get(nameKey)
      return row ? { id: Number(row.id), name: String(row.name), passwordHash: String(row.password_hash) } : null
    },

    createSession(tokenHash: string, accountId: number, now: number) {
      sql.createSession.run(tokenHash, accountId, now, now)
    },

    /** Le compte de cette session, si elle existe et a servi depuis `since`. */
    findSession(tokenHash: string, since: number): Account | null {
      const row = sql.findSession.get(tokenHash, since)
      return row ? { id: Number(row.id), name: String(row.name) } : null
    },

    touchSession(tokenHash: string, now: number) {
      sql.touchSession.run(now, tokenHash)
    },

    deleteSession(tokenHash: string) {
      sql.deleteSession.run(tokenHash)
    },

    /** Oublie les sessions qui n'ont plus servi depuis `before`. */
    deleteOldSessions(before: number) {
      sql.deleteOldSessions.run(before)
    },

    /** La partie enregistrée (à relire avec restoreState), ou null s'il n'y en a pas. */
    loadGame(accountId: number): unknown {
      const row = sql.loadGame.get(accountId)
      return row ? JSON.parse(String(row.state)) : null
    },

    saveGame(accountId: number, state: GameState, now: number) {
      sql.saveGame.run(accountId, JSON.stringify(state), now)
    },

    deleteGame(accountId: number) {
      sql.deleteGame.run(accountId)
    },

    close() {
      db.close()
    },
  }
}

function migrate(db: DatabaseSync) {
  const version = Number(db.prepare('PRAGMA user_version').get()?.user_version ?? 0)
  for (let step = version; step < MIGRATIONS.length; step++) {
    // Chaque étape s'applique en entier, ou pas du tout.
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[step])
      db.exec(`PRAGMA user_version = ${step + 1}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}
