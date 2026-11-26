import pg from 'pg';
import { newToken, tokenHash, type CreateUserResult, type Store, type User } from './store';

/** Schéma, créé au démarrage s'il manque. Pseudo unique sans tenir compte de la casse. */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS joueurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudo text NOT NULL,
  email text NOT NULL UNIQUE,
  mot_de_passe text NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS joueurs_pseudo_unique ON joueurs (lower(pseudo));
CREATE TABLE IF NOT EXISTS sessions (
  jeton text PRIMARY KEY,
  joueur_id uuid NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
  expire_le timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expire ON sessions (expire_le);
`;

interface UserRow {
  id: string;
  pseudo: string;
  email: string;
  mot_de_passe: string;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  pseudo: row.pseudo,
  email: row.email,
  passwordHash: row.mot_de_passe,
});

export class PgStore implements Store {
  private constructor(private readonly pool: pg.Pool) {}

  static async connect(connectionString: string): Promise<PgStore> {
    const pool = new pg.Pool({ connectionString });
    await pool.query(SCHEMA);
    await pool.query('DELETE FROM sessions WHERE expire_le < now()');
    return new PgStore(pool);
  }

  async createUser(pseudo: string, email: string, passwordHash: string): Promise<CreateUserResult> {
    try {
      const { rows } = await this.pool.query<UserRow>(
        'INSERT INTO joueurs (pseudo, email, mot_de_passe) VALUES ($1, $2, $3) RETURNING *',
        [pseudo, email, passwordHash],
      );
      const row = rows[0];
      if (!row) throw new Error('Insertion du joueur sans résultat');
      return { ok: true, user: toUser(row) };
    } catch (error) {
      // 23505 : violation d'unicité (email ou pseudo déjà pris).
      if (error instanceof pg.DatabaseError && error.code === '23505') {
        return {
          ok: false,
          conflict: error.constraint === 'joueurs_pseudo_unique' ? 'pseudo' : 'email',
        };
      }
      throw error;
    }
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>('SELECT * FROM joueurs WHERE email = $1', [
      email,
    ]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async createSession(userId: string, expiresAt: Date): Promise<string> {
    const token = newToken();
    await this.pool.query(
      'INSERT INTO sessions (jeton, joueur_id, expire_le) VALUES ($1, $2, $3)',
      [tokenHash(token), userId, expiresAt],
    );
    return token;
  }

  async findUserBySession(token: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT j.* FROM sessions s JOIN joueurs j ON j.id = s.joueur_id
       WHERE s.jeton = $1 AND s.expire_le > now()`,
      [tokenHash(token)],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async deleteSession(token: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE jeton = $1', [tokenHash(token)]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
