import { expect, test } from '@playwright/test';
import { SAVE_KEY, state, waitForMode, waitForScene } from './helpers';

/** Page de garde : elle mène au jeu dans le bon mode et propose de reprendre la partie. */
test('la page de garde lance une partie contre l’IA', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Alkébulan — Rise of Kingdoms' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Continuer la partie/ })).toBeHidden();
  await expect(page.getByRole('button', { name: /Campagne/ })).toBeDisabled();

  await page.getByRole('link', { name: /Nouvelle partie/ }).click();
  await expect(page).toHaveURL(/jeu\.html\?mode=continuer&repli=ia/);
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  expect((await state(page)).currentPlayer).toBe('koush');

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
  await expect(resume).toContainText("Jour 7 · contre l'IA");
  await expect(resume).toBeFocused();

  await resume.click();
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');
  expect((await state(page)).day).toBe(7);
});
