import { buildApp } from './app';
import { PgStore } from './pg-store';

/** Serveur des comptes et de la présence. Configuration par variables d'environnement. */
// En développement, la base de compose.local.yml (mot de passe par défaut).
const DEV_DATABASE = 'postgres://alkebulan:alkebulan-dev@localhost:5432/alkebulan';
const production = process.env.NODE_ENV === 'production';
// Docker : PGHOST, PGUSER, PGPASSWORD, PGDATABASE (mot de passe quelconque, sans encodage) ;
// sinon DATABASE_URL.
const usePgEnv = process.env.DATABASE_URL === undefined && process.env.PGHOST !== undefined;
const databaseUrl = process.env.DATABASE_URL ?? (production ? undefined : DEV_DATABASE);
if (!usePgEnv && !databaseUrl) {
  console.error(
    'Base introuvable : PGHOST, PGUSER, PGPASSWORD, PGDATABASE, ou DATABASE_URL ' +
      '(ex. postgres://alkebulan:motdepasse@localhost:5432/alkebulan)',
  );
  process.exit(1);
}

const store = await PgStore.connect(usePgEnv ? undefined : databaseUrl);
const app = await buildApp({
  store,
  secureCookie: production && process.env.COOKIE_SECURE !== 'false',
  logger: true,
});
await app.listen({ host: process.env.HOST ?? '0.0.0.0', port: Number(process.env.PORT ?? 3000) });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void app.close().then(() => process.exit(0)));
}
