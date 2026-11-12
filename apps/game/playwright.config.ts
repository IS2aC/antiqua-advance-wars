import { defineConfig } from '@playwright/test';

/** Tests de bout en bout : le jeu tourne sur le serveur de dev Vite (crochets de debug actifs). */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
    // 1300×800 : zoom ×2 du jeu (640×384).
    viewport: { width: 1300, height: 800 },
    launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
