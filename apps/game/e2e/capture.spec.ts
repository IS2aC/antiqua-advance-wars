import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '@antiqua/engine';
import { SAVE_KEY, clickTile, state, waitForMode, waitForScene } from './helpers';

/** Reprend une partie à deux après avoir modifié son état (unités, bâtiments). */
async function stage(page: Page, patch: (s: GameState) => GameState): Promise<void> {
  await page.goto('/jeu.html?mode=deux');
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  const staged = patch(await state(page));
  await page.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), {
    key: SAVE_KEY,
    save: { version: 1, savedAt: '', state: staged, aiPlayers: [] },
  });
  await page.goto('/jeu.html?mode=continuer');
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
}

/** Ordre « Capturer » pour l'unité de la case (aucun ennemi au contact : c'est le 1er choix). */
async function captureAt(page: Page, x: number, y: number): Promise<void> {
  // Ramène la caméra vers la case visée (la partie commence en bas de la carte).
  for (let i = 0; i < 12; i++) await page.keyboard.press(y < 6 ? 'ArrowUp' : 'ArrowDown');
  await clickTile(page, x, y);
  await waitForMode(page, 'selected');
  await clickTile(page, x, y);
  await waitForMode(page, 'menu');
  await page.keyboard.press('Enter');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('antiqua:options'));
});

test('capturer un village joue la scène de siège, puis la partie reprend', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Fantassin de Koush posé sur le village neutre (7, 7).
  await stage(page, (s) => ({
    ...s,
    units: s.units.map((u) => (u.owner === 'koush' && u.x === 3 ? { ...u, x: 7, y: 7 } : u)),
  }));
  await captureAt(page, 7, 7);
  await waitForScene(page, 'Capture');
  await waitForMode(page, 'idle');
  const village = (await state(page)).buildings.find((b) => b.x === 7 && b.y === 7);
  expect(village?.capturePoints).toBe(10);
  expect(errors).toEqual([]);
});

test('prendre le QG adverse joue l’annexion, puis l’écran de victoire', async ({ page }) => {
  // Fantassin de Koush sur le QG de Carthage (17, 1), capture déjà bien entamée ;
  // les fantassins de Carthage sont éloignés pour que « Capturer » soit le premier choix.
  await stage(page, (s) => ({
    ...s,
    units: s.units.map((u) => {
      if (u.owner === 'koush' && u.x === 3) return { ...u, x: 17, y: 1 };
      if (u.owner === 'carthage') return { ...u, x: 11 + (u.id % 2), y: 4 };
      return u;
    }),
    buildings: s.buildings.map((b) =>
      b.type === 'qg' && b.owner === 'carthage' ? { ...b, capturePoints: 6 } : b,
    ),
  }));
  await captureAt(page, 17, 1);
  await waitForScene(page, 'Capture');
  await waitForMode(page, 'over');
  const end = await state(page);
  expect(end.winner).toBe('koush');
});
