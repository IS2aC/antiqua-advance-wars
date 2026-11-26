import { createHash, randomBytes, randomUUID } from 'node:crypto';

/** Accès aux données des joueurs : PostgreSQL en vrai (`pg-store.ts`), mémoire en test. */

export interface User {
  readonly id: string;
  readonly pseudo: string;
  readonly email: string;
  readonly passwordHash: string;
}

/** Profil renvoyé au client (jamais l'empreinte du mot de passe). */
export interface PublicUser {
  readonly id: string;
  readonly pseudo: string;
  readonly email: string;
}

export const toPublic = ({ id, pseudo, email }: User): PublicUser => ({ id, pseudo, email });

export type CreateUserResult =
  { ok: true; user: User } | { ok: false; conflict: 'email' | 'pseudo' };

/** Partie en ligne enregistrée (voir `online.ts`) : l'objet est stocké tel quel en JSON. */
export interface StoredOnlineGame {
  readonly id: string;
  readonly finished: boolean;
  readonly data: unknown;
}

export interface Store {
  createUser(pseudo: string, email: string, passwordHash: string): Promise<CreateUserResult>;
  findUserByEmail(email: string): Promise<User | null>;
  /** Crée une session ; renvoie le jeton à mettre dans le cookie. */
  createSession(userId: string, expiresAt: Date): Promise<string>;
  findUserBySession(token: string): Promise<User | null>;
  deleteSession(token: string): Promise<void>;
  /** Enregistre une partie en ligne (création ou mise à jour). */
  saveOnlineGame(game: StoredOnlineGame): Promise<void>;
  /** Parties en ligne non terminées, à recharger au démarrage. */
  loadOnlineGames(): Promise<unknown[]>;
  close(): Promise<void>;
}

/** Jeton de session : 32 octets aléatoires ; la base n'en garde que l'empreinte SHA-256. */
export const newToken = (): string => randomBytes(32).toString('base64url');
export const tokenHash = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export class MemoryStore implements Store {
  private readonly users = new Map<string, User>();
  private readonly sessions = new Map<string, { userId: string; expiresAt: Date }>();
  private readonly games = new Map<string, StoredOnlineGame>();

  async createUser(pseudo: string, email: string, passwordHash: string): Promise<CreateUserResult> {
    for (const user of this.users.values()) {
      if (user.email === email) return { ok: false, conflict: 'email' };
      if (user.pseudo.toLowerCase() === pseudo.toLowerCase())
        return { ok: false, conflict: 'pseudo' };
    }
    const user: User = { id: randomUUID(), pseudo, email, passwordHash };
    this.users.set(user.id, user);
    return { ok: true, user };
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async createSession(userId: string, expiresAt: Date): Promise<string> {
    const token = newToken();
    this.sessions.set(tokenHash(token), { userId, expiresAt });
    return token;
  }

  async findUserBySession(token: string): Promise<User | null> {
    const session = this.sessions.get(tokenHash(token));
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    return this.users.get(session.userId) ?? null;
  }

  async deleteSession(token: string): Promise<void> {
    this.sessions.delete(tokenHash(token));
  }

  async saveOnlineGame(game: StoredOnlineGame): Promise<void> {
    this.games.set(game.id, structuredClone(game));
  }

  async loadOnlineGames(): Promise<unknown[]> {
    return [...this.games.values()].filter((game) => !game.finished).map((game) => game.data);
  }

  async close(): Promise<void> {}
}
