import { buildApp } from './app';
import { PgStore } from './pg-store';

/** Serveur des comptes et de la présence. Configuration par variables d'environnement. */
// En développement, la base de compose.local.yml (mot de passe par défaut).
const DEV_DATABASE = 'postgres://alkebulan:alkebulan-dev@localhost:5432/alkebulan';
const production = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL ?? (production ? undefined : DEV_DATABASE);
if (!databaseUrl) {
  console.error(
    'DATABASE_URL manquant (ex. postgres://alkebulan:motdepasse@localhost:5432/alkebulan)',
  );
  process.exit(1);
}

const store = await PgStore.connect(databaseUrl);
const app = await buildApp({
  store,
  secureCookie: production && process.env.COOKIE_SECURE !== 'false',
  logger: true,
});
await app.listen({ host: process.env.HOST ?? '0.0.0.0', port: Number(process.env.PORT ?? 3000) });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void app.close().then(() => process.exit(0)));
}
