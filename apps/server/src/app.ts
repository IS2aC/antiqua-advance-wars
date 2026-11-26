import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { hashPassword, verifyPassword } from './password';
import { Presence } from './presence';
import { toPublic, type Store, type User } from './store';
import { checkLogin, checkSignup } from './validation';

/** Nom du cookie de session (HttpOnly : le JavaScript de la page n'y a jamais accès). */
export const SESSION_COOKIE = 'alk_session';
const SESSION_DAYS = 30;

/** Essais de connexion par adresse IP, sur une fenêtre de 15 minutes. */
const LOGIN_LIMIT = 20;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export interface AppOptions {
  readonly store: Store;
  /** Cookie `Secure` (HTTPS) : vrai en production. */
  readonly secureCookie: boolean;
  readonly logger?: boolean;
}

/**
 * API des comptes, sous `/api` :
 * - POST /api/inscription { pseudo, email, motDePasse } → 201 { joueur }
 * - POST /api/connexion { email, motDePasse } → 200 { joueur }
 * - POST /api/deconnexion → 204
 * - GET /api/moi → 200 { joueur } ou 401
 * - GET /api/presence (WebSocket, connecté) → { type: 'enLigne', nombre }
 */
export async function buildApp({
  store,
  secureCookie,
  logger = false,
}: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger, trustProxy: true, bodyLimit: 16 * 1024 });
  await app.register(cookie);
  await app.register(websocket);
  const presence = new Presence();
  const attempts = new Map<string, { count: number; since: number }>();

  const openSession = async (reply: FastifyReply, user: User) => {
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
    const token = await store.createSession(user.id, expiresAt);
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookie,
      expires: expiresAt,
    });
  };

  const currentUser = async (request: FastifyRequest): Promise<User | null> => {
    const token = request.cookies[SESSION_COOKIE];
    return token ? store.findUserBySession(token) : null;
  };

  const tooManyAttempts = (ip: string): boolean => {
    const now = Date.now();
    const entry = attempts.get(ip);
    if (!entry || now - entry.since > LOGIN_WINDOW_MS) {
      attempts.set(ip, { count: 1, since: now });
      return false;
    }
    entry.count += 1;
    return entry.count > LOGIN_LIMIT;
  };

  app.post('/api/inscription', async (request, reply) => {
    const checked = checkSignup(request.body);
    if (!checked.ok) return reply.code(400).send({ erreur: checked.error });
    const { pseudo, email, password } = checked.value;
    const created = await store.createUser(pseudo, email, await hashPassword(password));
    if (!created.ok) {
      const erreur =
        created.conflict === 'email'
          ? 'Un compte existe déjà avec cet email.'
          : 'Ce pseudo est déjà pris.';
      return reply.code(409).send({ erreur });
    }
    await openSession(reply, created.user);
    return reply.code(201).send({ joueur: toPublic(created.user) });
  });

  app.post('/api/connexion', async (request, reply) => {
    if (tooManyAttempts(request.ip)) {
      return reply.code(429).send({ erreur: 'Trop d’essais. Réessaie dans quelques minutes.' });
    }
    const checked = checkLogin(request.body);
    const user = checked.ok ? await store.findUserByEmail(checked.value.email) : null;
    if (
      !checked.ok ||
      !user ||
      !(await verifyPassword(checked.value.password, user.passwordHash))
    ) {
      return reply.code(401).send({ erreur: 'Email ou mot de passe incorrect.' });
    }
    attempts.delete(request.ip);
    await openSession(reply, user);
    return reply.send({ joueur: toPublic(user) });
  });

  app.post('/api/deconnexion', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await store.deleteSession(token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });

  app.get('/api/moi', async (request, reply) => {
    const user = await currentUser(request);
    if (!user) return reply.code(401).send({ erreur: 'Non connecté.' });
    return reply.send({ joueur: toPublic(user), enLigne: presence.count });
  });

  app.get('/api/sante', async () => ({ ok: true }));

  app.register(async (scope) => {
    scope.get('/api/presence', { websocket: true }, async (socket, request) => {
      const user = await currentUser(request);
      if (!user) {
        socket.close(4401, 'Non connecté');
        return;
      }
      presence.join(socket, user.id);
      socket.on('close', () => presence.leave(socket));
    });
  });

  app.addHook('onClose', async () => {
    await store.close();
  });

  return app;
}
