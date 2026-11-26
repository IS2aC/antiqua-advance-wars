import { expect, test } from './fixtures';
import { SAVE_KEY, clickTile, state, waitForMode, waitForScene } from './helpers';

test('fusionner deux fantassins blessés : 3 + 7 PV donnent 10 PV', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/jeu.html?mode=deux');
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  const current = await state(page);
  const [first, second] = current.units.filter(
    (u) => u.owner === 'koush' && u.type === 'fantassin',
  );
  if (!first || !second) throw new Error('Deux fantassins de Koush attendus');
  // Le premier à 3 PV, le second à 7 PV, posé juste à côté.
  const staged = {
    ...current,
    units: current.units.map((u) => {
      if (u.id === first.id) return { ...u, hp: 30 };
      if (u.id === second.id) return { ...u, hp: 70, x: first.x + 1, y: first.y };
      return u;
    }),
  };
  await page.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), {
    key: SAVE_KEY,
    save: { version: 1, savedAt: '', state: staged, aiPlayers: [] },
  });
  await page.goto('/jeu.html?mode=continuer');
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');

  await clickTile(page, first.x, first.y);
  await waitForMode(page, 'selected');
  await clickTile(page, first.x + 1, first.y);
  await waitForMode(page, 'menu');
  await page.keyboard.press('Enter'); // « Fusionner »
  await waitForMode(page, 'idle');

  const after = await state(page);
  expect(after.units.find((u) => u.id === first.id)).toBeUndefined();
  expect(after.units.find((u) => u.id === second.id)).toMatchObject({ hp: 100, hasActed: true });
  expect(errors).toEqual([]);
});
