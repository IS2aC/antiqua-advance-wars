import { buildApp } from './app';
import { MemoryStore } from './store';

/**
 * Serveur sans base de données (comptes et parties en mémoire) : tests de bout en bout du
 * jeu en ligne, en local comme sur la CI. Jamais en production.
 */
const app = await buildApp({ store: new MemoryStore(), secureCookie: false });
await app.listen({ host: '127.0.0.1', port: Number(process.env.PORT ?? 3000) });
