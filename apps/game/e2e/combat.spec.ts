import { expect, test, type Page } from '@playwright/test';
import {
  SAVE_KEY,
  clickTile,
  state,
  waitForDrawnCombat,
  waitForMode,
  waitForScene,
} from './helpers';

/**
 * Prépare un duel : partie à deux, puis un fantassin de Carthage placé au contact du
 * fantassin de Koush en (2, 11). On reprend cette partie par « Continuer ».
 */
async function stageDuel(page: Page): Promise<{ attackerId: number; defenderId: number }> {
  await page.goto('/jeu.html?mode=deux');
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  const current = await state(page);
  const attacker = current.units.find((u) => u.owner === 'koush' && u.x === 2 && u.y === 11);
  const defender = current.units.find((u) => u.owner === 'carthage');
  if (!attacker || !defender) throw new Error('Unités de départ introuvables');
  const staged = {
    ...current,
    units: current.units.map((u) => (u.id === defender.id ? { ...u, x: 2, y: 10 } : u)),
  };
  await page.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), {
    key: SAVE_KEY,
    save: { version: 1, savedAt: '', state: staged, aiPlayers: [] },
  });
  await page.goto('/jeu.html?mode=continuer');
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  return { attackerId: attacker.id, defenderId: defender.id };
}

async function attack(page: Page): Promise<void> {
  await clickTile(page, 2, 11);
  await waitForMode(page, 'selected');
  await clickTile(page, 2, 11);
  await waitForMode(page, 'menu');
  await page.keyboard.press('Enter'); // « Attaquer »
  await waitForMode(page, 'targeting');
  await clickTile(page, 2, 10);
}

test('une attaque joue le combat dessiné, puis la partie reprend', async ({ page }) => {
  // Le combat se joue en entier, sans être passé : long en WebGL logiciel.
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.removeItem('antiqua:options'));
  const { defenderId } = await stageDuel(page);

  await attack(page);
  await waitForDrawnCombat(page);
  // La scène se termine seule et rend la main à la carte.
  // WebGL logiciel de la CI : un combat complet peut dépasser 30 s.
  await expect(page.locator('#combat-dessine')).toBeHidden({ timeout: 90_000 });
  await waitForMode(page, 'idle');
  const hit = (await state(page)).units.find((u) => u.id === defenderId);
  expect(hit?.hp ?? 0).toBeLessThan(100);
  expect(errors).toEqual([]);
});

test('Entrée passe le combat dessiné', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('antiqua:options'));
  await stageDuel(page);
  await attack(page);
  await waitForDrawnCombat(page);
  const started = Date.now();
  await page.keyboard.press('Enter');
  await expect(page.locator('#combat-dessine')).toBeHidden();
  await waitForMode(page, 'idle');
  // Sans passer, le combat dure bien plus longtemps (plus de 30 s sur la CI, en WebGL
  // logiciel ; passer y prend 3 à 4 s).
  expect(Date.now() - started).toBeLessThan(8000);
});

test('scènes de combat désactivées dans la pause : animation courte sur la carte', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.removeItem('antiqua:options'));
  await stageDuel(page);

  // Pause → « Scènes de combat » (2ᵉ choix) bascule sur « non », puis Échap pour reprendre.
  await page.keyboard.press('Escape');
  await waitForMode(page, 'paused');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await waitForMode(page, 'idle');
  const options = await page.evaluate(() => localStorage.getItem('antiqua:options'));
  expect(JSON.parse(options ?? '{}').combatScenes).toBe(false);

  await attack(page);
  await waitForMode(page, 'idle');
  // Le combat dessiné (préparé dès l'ouverture de la partie) ne s'est pas affiché.
  await expect(page.locator('#combat-dessine')).toBeHidden();
});
