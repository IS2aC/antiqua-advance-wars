import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { SAVE_KEY, state, waitForMode, waitForScene } from './helpers';

/** Menu principal → Battle (les modes de bataille). */
async function openBattle(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Battle/ }).click();
  await expect(page.getByRole('navigation', { name: 'Battle' })).toBeVisible();
}

/** Page de garde : elle mène au jeu dans le bon mode et propose de reprendre la partie. */
test('à deux joueurs : on choisit son peuple et celui de l’IA', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Alkébulan — Rise of Kingdoms' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Continuer la partie/ })).toBeHidden();
  await expect(page.getByRole('button', { name: /Campagne/ })).toBeDisabled();
  await expect(page.getByText('Testeur')).toBeVisible();
  await expect(page.getByText('3 joueurs en ligne')).toBeVisible();

  await openBattle(page);
  await expect(page.getByRole('button', { name: /J1 vs J2 online/ })).toBeDisabled();
  await page.getByRole('link', { name: /J1 vs CPU/ }).click();
  // Duel : son peuple parmi les 4, puis celui de l'IA parmi les 3 autres.
  const choice = page.getByRole('dialog', { name: 'Choisis ton peuple' });
  await expect(choice).toBeVisible();
  await expect(choice.getByRole('link')).toHaveCount(6);
  await choice.getByRole('link', { name: /Empire ashanti/ }).click();
  const rival = page.getByRole('dialog', { name: "Choisis le peuple de l'IA" });
  await expect(rival.getByRole('link')).toHaveCount(5);
  await expect(rival.getByRole('link', { name: /Empire ashanti/ })).toHaveCount(0);
  await rival.getByRole('link', { name: /Almoravides/ }).click();
  await expect(page).toHaveURL(/jeu\.html\?mode=continuer.*repli=ia/);
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  const current = await state(page);
  expect(current.map.name).toBe('Le Gué du Nil');
  expect(current.players.map((player) => player.id)).toEqual(['ashanti', 'almoravides']);
  expect(current.currentPlayer).toBe('ashanti');

  // Recharger reprend la partie avec les mêmes peuples.
  await page.reload();
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  expect((await state(page)).players.map((player) => player.id)).toEqual([
    'ashanti',
    'almoravides',
  ]);

  expect(errors).toEqual([]);
});

test('la page de garde propose de continuer une partie sauvegardée', async ({ page }) => {
  await page.goto('/jeu.html?mode=deux');
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  const current = await state(page);
  await page.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), {
    key: SAVE_KEY,
    save: {
      version: 1,
      savedAt: new Date().toISOString(),
      state: { ...current, day: 7 },
      aiPlayers: ['carthage'],
    },
  });

  await page.goto('/');
  const resume = page.getByRole('link', { name: /Continuer la partie/ });
  await expect(resume).toBeVisible();
  await expect(resume).toContainText("Le Gué du Nil · jour 7 · contre l'IA");
  await expect(resume).toBeFocused();

  await resume.click();
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  expect((await state(page)).day).toBe(7);
});

test('la page de garde lance la carte à 4 royaumes, Koush contre 3 IA', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await openBattle(page);
  await page.getByRole('link', { name: /J1 vs 3 CPU/ }).click();
  const choice = page.getByRole('dialog', { name: 'Choisis ton peuple' });
  await expect(choice.getByRole('link')).toHaveCount(6);
  await choice.getByRole('link', { name: /Royaume de Koush/ }).click();
  await expect(page).toHaveURL(/carte=carrefour/);
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  const current = await state(page);
  expect(current.map.name).toBe('Le Carrefour des Royaumes');
  expect(current.players.map((player) => player.id)).toEqual([
    'koush',
    'carthage',
    'almoravides',
    'ashanti',
  ]);
  expect(current.currentPlayer).toBe('koush');

  // Recharger reprend la même carte.
  await page.reload();
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  expect((await state(page)).map.name).toBe('Le Carrefour des Royaumes');

  expect(errors).toEqual([]);
});

test('on peut choisir un autre peuple : Carthage contre 3 IA', async ({ page }) => {
  await page.goto('/');
  await openBattle(page);
  await page.getByRole('link', { name: /J1 vs 3 CPU/ }).click();
  const choice = page.getByRole('dialog', { name: 'Choisis ton peuple' });
  // Au clavier : flèche droite vers Carthage, puis Entrée.
  await expect(choice.getByRole('link', { name: /Royaume de Koush/ })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(choice.getByRole('link', { name: /Carthage/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/peuple=carthage/);
  await waitForScene(page, 'Battle');
  // L'IA joue Koush (premier à jouer), puis la main revient à Carthage.
  await expect
    .poll(
      async () => {
        const current = await state(page);
        const mode = await page.evaluate(() =>
          (window as unknown as { __ANTIQUA__?: { mode(): string } }).__ANTIQUA__?.mode(),
        );
        return `${current.currentPlayer}/${mode}`;
      },
      { timeout: 120_000 },
    )
    .toBe('carthage/idle');
});

test('Échap revient au choix de son peuple, puis ferme sans lancer de partie', async ({ page }) => {
  await page.goto('/');
  await openBattle(page);
  await page.getByRole('link', { name: /J1 vs CPU/ }).click();
  await page.getByRole('dialog', { name: 'Choisis ton peuple' }).getByRole('link').first().click();
  await expect(page.getByRole('dialog', { name: "Choisis le peuple de l'IA" })).toBeVisible();
  await page.keyboard.press('Escape');
  const choice = page.getByRole('dialog', { name: 'Choisis ton peuple' });
  await expect(choice.getByRole('link')).toHaveCount(6);
  await page.keyboard.press('Escape');
  await expect(choice).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
});

test('duel sur la côte : carte avec mer et ports, peuples au choix', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
  await page.reload();
  await openBattle(page);
  await page.getByRole('link', { name: /Duel sur la côte/ }).click();
  await page
    .getByRole('dialog', { name: 'Choisis ton peuple' })
    .getByRole('link', { name: /Carthage/ })
    .click();
  await page
    .getByRole('dialog', { name: "Choisis le peuple de l'IA" })
    .getByRole('link', { name: /Koush/ })
    .click();
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  const current = await state(page);
  expect(current.map.name).toBe('La Côte des Comptoirs');
  expect(current.players.map((player) => player.id)).toEqual(['carthage', 'koush']);
  expect(current.buildings.filter((b) => b.type === 'port')).toHaveLength(2);
});

test('défense de forteresse : peuples, difficulté, compte à rebours', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
  await page.reload();
  await openBattle(page);
  await page.getByRole('link', { name: /Défense de forteresse/ }).click();
  await page
    .getByRole('dialog', { name: 'Choisis ton peuple' })
    .getByRole('link', { name: /Koush/ })
    .click();
  await page
    .getByRole('dialog', { name: "Choisis le peuple de l'IA" })
    .getByRole('link', { name: /Carthage/ })
    .click();
  const levels = page.getByRole('dialog', { name: 'Choisis la difficulté' });
  await expect(levels.getByRole('link')).toHaveCount(3);
  await levels.getByRole('link', { name: /Facile/ }).click();
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  const current = await state(page);
  expect(current.map.name).toBe('La Forteresse');
  expect(current.siege).toMatchObject({ defender: 'koush', untilDay: 10 });
});

test('Sosso sur la carte à 4 royaumes : il prend le premier camp, contre 3 IA', async ({
  page,
}) => {
  await page.goto('/');
  await openBattle(page);
  await page.getByRole('link', { name: /J1 vs 3 CPU/ }).click();
  await page
    .getByRole('dialog', { name: 'Choisis ton peuple' })
    .getByRole('link', { name: /Royaume de Sosso/ })
    .click();
  await expect(page).toHaveURL(/peuple=sosso/);
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  const current = await state(page);
  expect(current.players.map((player) => player.id)).toEqual([
    'sosso',
    'carthage',
    'almoravides',
    'ashanti',
  ]);
  expect(current.currentPlayer).toBe('sosso');
});

test('duel : Dahomey contre Sosso', async ({ page }) => {
  await page.goto('/');
  await openBattle(page);
  await page.getByRole('link', { name: /J1 vs CPU/ }).click();
  await page
    .getByRole('dialog', { name: 'Choisis ton peuple' })
    .getByRole('link', { name: /Royaume du Dahomey/ })
    .click();
  await page
    .getByRole('dialog', { name: "Choisis le peuple de l'IA" })
    .getByRole('link', { name: /Royaume de Sosso/ })
    .click();
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  expect((await state(page)).players.map((player) => player.id)).toEqual(['dahomey', 'sosso']);
});
