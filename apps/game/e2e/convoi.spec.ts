import { expect, test } from '@playwright/test';
import { SAVE_KEY, clickTile, state, waitForMode, waitForScene } from './helpers';

test('un fantassin monte dans un convoi, puis le convoi le dépose à côté', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/jeu.html?mode=deux');
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  const current = await state(page);
  const foot = current.units.find((u) => u.owner === 'koush' && u.type === 'fantassin');
  if (!foot) throw new Error('Fantassin de Koush attendu');
  const nextId = Math.max(...current.units.map((u) => u.id)) + 1;
  // Un convoi de Koush posé juste à droite du fantassin.
  const staged = {
    ...current,
    nextUnitId: nextId + 1,
    units: [
      ...current.units,
      {
        id: nextId,
        type: 'convoi',
        owner: 'koush',
        x: foot.x + 1,
        y: foot.y,
        hp: 100,
        hasMoved: false,
        hasActed: false,
      },
    ],
  };
  await page.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), {
    key: SAVE_KEY,
    save: { version: 1, savedAt: '', state: staged, aiPlayers: [] },
  });
  await page.goto('/jeu.html?mode=continuer');
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');

  // Embarquer : le fantassin vise le convoi.
  await clickTile(page, foot.x, foot.y);
  await waitForMode(page, 'selected');
  await clickTile(page, foot.x + 1, foot.y);
  await waitForMode(page, 'menu');
  await page.keyboard.press('Enter'); // « Embarquer »
  await waitForMode(page, 'idle');
  let after = await state(page);
  expect(after.units.find((u) => u.id === foot.id)).toBeUndefined();
  expect(after.units.find((u) => u.id === nextId)?.cargo?.map((u) => u.id)).toEqual([foot.id]);

  // Débarquer : le convoi, sans bouger, dépose le fantassin sur la première case proposée.
  await clickTile(page, foot.x + 1, foot.y);
  await waitForMode(page, 'selected');
  await clickTile(page, foot.x + 1, foot.y);
  await waitForMode(page, 'menu');
  await page.keyboard.press('Enter'); // « Débarquer »
  await page.keyboard.press('Enter'); // première case voisine
  await waitForMode(page, 'menu'); // le convoi peut encore attendre
  await page.keyboard.press('Enter'); // « Attendre »
  await waitForMode(page, 'idle');
  after = await state(page);
  const landed = after.units.find((u) => u.id === foot.id);
  expect(landed?.hasActed).toBe(true);
  expect(Math.abs((landed?.x ?? 0) - (foot.x + 1)) + Math.abs((landed?.y ?? 0) - foot.y)).toBe(1);
  expect(after.units.find((u) => u.id === nextId)?.cargo).toBeUndefined();
  expect(errors).toEqual([]);
});
