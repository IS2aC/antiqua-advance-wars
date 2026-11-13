import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173 },
  // Les deux pages sont analysées dès le démarrage : sinon Vite découvre Phaser au premier
  // passage sur jeu.html et recharge la page en cours de route.
  optimizeDeps: { entries: ['index.html', 'jeu.html'] },
  build: {
    target: 'es2022',
    // Deux pages : la page de garde (index.html) et le jeu (jeu.html).
    rollupOptions: {
      input: {
        garde: fileURLToPath(new URL('./index.html', import.meta.url)),
        jeu: fileURLToPath(new URL('./jeu.html', import.meta.url)),
      },
    },
    chunkSizeWarningLimit: 2000,
  },
});
