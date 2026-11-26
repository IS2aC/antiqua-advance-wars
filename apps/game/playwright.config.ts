import { defineConfig } from '@playwright/test';

/** Port du serveur de test (E2E_PORT si 5173 est déjà pris sur la machine). */
const port = Number(process.env.E2E_PORT ?? 5173);
/** Serveur des comptes et du jeu en ligne, en mémoire (`start:memoire`), relayé par Vite. */
const apiPort = Number(process.env.API_PORT ?? 3000);

/** Tests de bout en bout : le jeu tourne sur le serveur de dev Vite (crochets de debug actifs). */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Un seul navigateur à la fois : le WebGL logiciel (SwiftShader) sature le processeur.
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    browserName: 'chromium',
    // 1300×800 : zoom ×2 du jeu (640×384).
    viewport: { width: 1300, height: 800 },
    launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `pnpm --filter @antiqua/server start:memoire`,
      url: `http://localhost:${apiPort}/api/sante`,
      env: { PORT: String(apiPort) },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `pnpm exec vite --port ${port} --strictPort`,
      url: `http://localhost:${port}`,
      env: { API_PORT: String(apiPort) },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
