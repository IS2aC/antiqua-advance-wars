import { expect, test, type Page } from '@playwright/test';
import { SAVE_KEY, clickTile, state, waitForMode, waitForScene } from './helpers';

/** Clique sur le bouton pause du HUD (à gauche de « Fin de tour »), en coordonnées logiques. */
async function clickPauseButton(page: Page): Promise<void> {
  const point = await page.evaluate(() => {
    const game = (window as unknown as { __ANTIQUA_GAME__: { canvas: HTMLCanvasElement } })
      .__ANTIQUA_GAME__;
    const rect = game.canvas.getBoundingClientRect();
    const zoom = rect.width / 640;
    // Bouton pause : x de 504 à 528, barre en y 4 à 28 (640 − 4 − 104 − 4 − 24).
    return { x: rect.left + 516 * zoom, y: rect.top + 16 * zoom };
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
}

async function savedState(page: Page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  return raw ? (JSON.parse(raw) as { state: Awaited<ReturnType<typeof state>> }).state : null;
}

test('pause : reprendre, sauvegarder et quitter, puis continuer là où on en était', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/jeu.html?mode=deux');
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');

  // Un fantassin produit en plein tour : c'est ce qu'on doit retrouver après la reprise.
  await clickTile(page, 4, 12);
  await waitForMode(page, 'menu');
  await page.keyboard.press('Enter');
  await waitForMode(page, 'idle');

  // Bouton pause, puis « Reprendre » : la partie continue.
  await clickPauseButton(page);
  await waitForMode(page, 'paused');
  await page.keyboard.press('Enter');
  await waitForMode(page, 'idle');

  // Échap ouvre aussi la pause ; « Sauvegarder et quitter » ramène au menu principal.
  await page.keyboard.press('Escape');
  await waitForMode(page, 'paused');
  // Menu : Reprendre, Scènes de combat, Sauvegarder et quitter, Abandonner.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => !url.pathname.endsWith('jeu.html'));
  const saved = await savedState(page);
  expect(saved?.players.find((p) => p.id === 'koush')?.funds).toBe(1000);
  expect(saved?.units.some((u) => u.x === 4 && u.y === 12 && u.hasActed)).toBe(true);

  // « Continuer » reprend exactement ce tour.
  await page.goto('/jeu.html?mode=continuer');
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  const resumed = await state(page);
  expect(resumed.currentPlayer).toBe('koush');
  expect(resumed.players.find((p) => p.id === 'koush')?.funds).toBe(1000);

  expect(errors).toEqual([]);
});

test('pause : abandonner la partie efface la sauvegarde, après confirmation', async ({ page }) => {
  await page.goto('/jeu.html?mode=deux');
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');

  await page.keyboard.press('Escape');
  await waitForMode(page, 'paused');
  await page.keyboard.press('ArrowUp'); // le menu boucle : « Abandonner la partie » est le dernier
  await page.keyboard.press('Enter');
  // Confirmation : « Non, revenir » est proposé en premier.
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => location.pathname)).toContain('jeu.html');
  await waitForMode(page, 'paused');

  // Cette fois on confirme.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter'); // « Oui, abandonner »
  await page.waitForURL((url) => !url.pathname.endsWith('jeu.html'));
  expect(await savedState(page)).toBeNull();
});
