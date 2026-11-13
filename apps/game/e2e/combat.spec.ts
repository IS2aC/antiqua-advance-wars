import { expect, test, type Page } from '@playwright/test';
import { SAVE_KEY, clickTile, state, waitForMode, waitForScene } from './helpers';

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

/** Compte les lancements de la scène de combat (écouteur posé dans la page). */
async function countCombatScenes(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __combats: number;
      __ANTIQUA_GAME__: {
        scene: { getScene(key: string): { events: { on(e: string, f: () => void): void } } };
      };
    };
    w.__combats = 0;
    w.__ANTIQUA_GAME__.scene.getScene('Combat').events.on('create', () => {
      w.__combats += 1;
    });
  });
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

test('une attaque joue la scène de combat, puis la partie reprend', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.removeItem('antiqua:options'));
  const { defenderId } = await stageDuel(page);
  await countCombatScenes(page);

  await attack(page);
  await waitForScene(page, 'Combat');
  // La scène se termine seule et rend la main à la carte.
  await waitForMode(page, 'idle');
  expect(await page.evaluate(() => (window as unknown as { __combats: number }).__combats)).toBe(1);
  const hit = (await state(page)).units.find((u) => u.id === defenderId);
  expect(hit?.hp ?? 0).toBeLessThan(100);
  expect(errors).toEqual([]);
});

test('Entrée passe la scène de combat', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('antiqua:options'));
  await stageDuel(page);
  await attack(page);
  await waitForScene(page, 'Combat');
  const started = Date.now();
  await page.keyboard.press('Enter');
  await waitForMode(page, 'idle');
  // Sans passer, la scène dure plus de deux secondes.
  expect(Date.now() - started).toBeLessThan(1500);
});

test('scènes de combat désactivées dans la pause : animation courte sur la carte', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.removeItem('antiqua:options'));
  await stageDuel(page);
  await countCombatScenes(page);

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
  expect(await page.evaluate(() => (window as unknown as { __combats: number }).__combats)).toBe(0);
});
