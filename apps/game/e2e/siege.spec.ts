import { expect, test } from '@playwright/test';
import { SAVE_KEY, clickTile, state, waitForMode, waitForScene } from './helpers';

test('la catapulte tire sur un rempart et l’entame', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/jeu.html?mode=deux');
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  const current = await state(page);
  const foot = current.units.find((u) => u.owner === 'koush' && u.type === 'fantassin');
  if (!foot) throw new Error('Fantassin de Koush attendu');
  const id = current.nextUnitId;
  // Catapulte de Koush à la place du fantassin, rempart deux cases au-dessus.
  const wall = { x: foot.x, y: foot.y - 2 };
  const tiles = [...current.map.tiles];
  tiles[wall.y * current.map.width + wall.x] = 'rempart';
  const staged = {
    ...current,
    map: { ...current.map, tiles },
    nextUnitId: id + 1,
    units: [
      ...current.units.filter((u) => u.id !== foot.id && !(u.x === wall.x && u.y === wall.y)),
      {
        id,
        type: 'catapulte',
        owner: 'koush',
        x: foot.x,
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

  await clickTile(page, foot.x, foot.y);
  await waitForMode(page, 'selected');
  await clickTile(page, foot.x, foot.y);
  await waitForMode(page, 'menu');
  await page.keyboard.press('Enter'); // « Abattre le rempart »
  await waitForMode(page, 'targeting');
  await page.keyboard.press('Enter'); // le rempart proposé
  await waitForMode(page, 'idle');
  const after = await state(page);
  expect(after.walls?.[`${wall.x},${wall.y}`]).toBe(65);
  expect(after.units.find((u) => u.id === id)?.hasActed).toBe(true);
  expect(errors).toEqual([]);
});
