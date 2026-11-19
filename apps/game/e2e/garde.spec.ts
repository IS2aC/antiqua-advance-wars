import { expect, test } from '@playwright/test';
import { SAVE_KEY, state, waitForMode, waitForScene } from './helpers';

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

  await page.getByRole('link', { name: /À deux joueurs/ }).click();
  // Duel : son peuple parmi les 4, puis celui de l'IA parmi les 3 autres.
  const choice = page.getByRole('dialog', { name: 'Choisis ton peuple' });
  await expect(choice).toBeVisible();
  await expect(choice.getByRole('link')).toHaveCount(4);
  await choice.getByRole('link', { name: /Empire ashanti/ }).click();
  const rival = page.getByRole('dialog', { name: "Choisis le peuple de l'IA" });
  await expect(rival.getByRole('link')).toHaveCount(3);
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
  await page.getByRole('link', { name: /À quatre joueurs/ }).click();
  const choice = page.getByRole('dialog', { name: 'Choisis ton peuple' });
  await expect(choice.getByRole('link')).toHaveCount(4);
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
  await page.getByRole('link', { name: /À quatre joueurs/ }).click();
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
  await page.getByRole('link', { name: /À deux joueurs/ }).click();
  await page.getByRole('dialog', { name: 'Choisis ton peuple' }).getByRole('link').first().click();
  await expect(page.getByRole('dialog', { name: "Choisis le peuple de l'IA" })).toBeVisible();
  await page.keyboard.press('Escape');
  const choice = page.getByRole('dialog', { name: 'Choisis ton peuple' });
  await expect(choice.getByRole('link')).toHaveCount(4);
  await page.keyboard.press('Escape');
  await expect(choice).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
});

test('duel sur la côte : carte avec mer et ports, peuples au choix', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
  await page.reload();
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
