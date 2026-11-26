import { expect, test } from './fixtures';
import { SAVE_KEY, clickTile, state, waitForMode, waitForScene } from './helpers';

test('sur la côte : un fantassin monte dans un bateau depuis le rivage, puis débarque', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/jeu.html?mode=deux&carte=cote');
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  const current = await state(page);
  expect(current.map.name).toBe('La Côte des Comptoirs');
  const foot = current.units.find((u) => u.owner === 'koush' && u.type === 'fantassin');
  if (!foot) throw new Error('Fantassin de Koush attendu');
  const boatId = current.nextUnitId;
  // Fantassin sur le rivage sud (5, 11), bateau de Koush sur la mer juste au-dessus (5, 10).
  const staged = {
    ...current,
    nextUnitId: boatId + 1,
    units: [
      ...current.units.map((u) => (u.id === foot.id ? { ...u, x: 5, y: 11 } : u)),
      {
        id: boatId,
        type: 'bateau',
        owner: 'koush',
        x: 5,
        y: 10,
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

  await clickTile(page, 5, 11);
  await waitForMode(page, 'selected');
  await clickTile(page, 5, 10);
  await waitForMode(page, 'menu');
  await page.keyboard.press('Enter'); // « Embarquer »
  await waitForMode(page, 'idle');
  let after = await state(page);
  expect(after.units.find((u) => u.id === boatId)?.cargo?.map((u) => u.id)).toEqual([foot.id]);

  await clickTile(page, 5, 10);
  await waitForMode(page, 'selected');
  await clickTile(page, 5, 10);
  await waitForMode(page, 'menu');
  // Le bateau peut tirer : « Débarquer » vient après « Attaquer » s'il y a une cible.
  await page.keyboard.press('Enter'); // « Débarquer » (aucune cible à portée)
  await page.keyboard.press('Enter'); // seule case de terre voisine
  await waitForMode(page, 'menu');
  await page.keyboard.press('Enter'); // « Attendre »
  await waitForMode(page, 'idle');
  after = await state(page);
  expect(after.units.find((u) => u.id === foot.id)).toMatchObject({ x: 5, y: 11, hasActed: true });
  expect(errors).toEqual([]);
});
