import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, SESSION_COOKIE } from '../src/app';
import { MemoryStore } from '../src/store';

let app: FastifyInstance | null = null;
afterEach(async () => {
  await app?.close();
  app = null;
});

async function start() {
  app = await buildApp({ store: new MemoryStore(), secureCookie: false });
  return app;
}

const signup = (server: FastifyInstance, payload: Record<string, string>) =>
  server.inject({ method: 'POST', url: '/api/inscription', payload });

const sessionOf = (response: { cookies: { name: string; value: string }[] }) =>
  response.cookies.find((c) => c.name === SESSION_COOKIE)?.value ?? '';

const AMINA = { pseudo: 'Amina', email: 'Amina@Exemple.org', motDePasse: 'tabouret-dor' };

describe('comptes', () => {
  it('inscrit un joueur, ouvre sa session et ne renvoie jamais le mot de passe', async () => {
    const server = await start();
    const response = await signup(server, AMINA);
    expect(response.statusCode).toBe(201);
    expect(response.json().joueur).toMatchObject({ pseudo: 'Amina', email: 'amina@exemple.org' });
    expect(response.body).not.toContain('tabouret');
    const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    const me = await server.inject({
      url: '/api/moi',
      cookies: { [SESSION_COOKIE]: sessionOf(response) },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().joueur.pseudo).toBe('Amina');
  });

  it('refuse un formulaire invalide', async () => {
    const server = await start();
    expect((await signup(server, { ...AMINA, email: 'pas-un-email' })).statusCode).toBe(400);
    expect((await signup(server, { ...AMINA, motDePasse: 'court' })).statusCode).toBe(400);
    expect((await signup(server, { ...AMINA, pseudo: 'a' })).statusCode).toBe(400);
  });

  it('refuse un email ou un pseudo déjà pris', async () => {
    const server = await start();
    await signup(server, AMINA);
    const sameEmail = await signup(server, {
      ...AMINA,
      pseudo: 'Autre',
      email: 'amina@exemple.org',
    });
    expect(sameEmail.statusCode).toBe(409);
    const samePseudo = await signup(server, { ...AMINA, pseudo: 'AMINA', email: 'b@exemple.org' });
    expect(samePseudo.statusCode).toBe(409);
    expect(samePseudo.json().erreur).toMatch(/pseudo/);
  });

  it('connecte avec le bon mot de passe seulement', async () => {
    const server = await start();
    await signup(server, AMINA);
    const login = (motDePasse: string) =>
      server.inject({
        method: 'POST',
        url: '/api/connexion',
        payload: { email: 'AMINA@exemple.org', motDePasse },
      });
    expect((await login('mauvais-mot')).statusCode).toBe(401);
    const ok = await login('tabouret-dor');
    expect(ok.statusCode).toBe(200);
    expect(sessionOf(ok)).not.toBe('');
  });

  it('déconnecte : la session ne vaut plus rien', async () => {
    const server = await start();
    const token = sessionOf(await signup(server, AMINA));
    const cookies = { [SESSION_COOKIE]: token };
    expect(
      (await server.inject({ method: 'POST', url: '/api/deconnexion', cookies })).statusCode,
    ).toBe(204);
    expect((await server.inject({ url: '/api/moi', cookies })).statusCode).toBe(401);
  });

  it('limite les essais de connexion', async () => {
    const server = await start();
    let last = 0;
    for (let i = 0; i < 21; i += 1) {
      last = (
        await server.inject({
          method: 'POST',
          url: '/api/connexion',
          payload: { email: 'x@y.z', motDePasse: 'nimporte' },
        })
      ).statusCode;
    }
    expect(last).toBe(429);
  });
});
