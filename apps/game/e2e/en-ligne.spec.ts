import { expect, test, type Browser, type Page } from '@playwright/test';
import type { GameState } from '@antiqua/engine';
import { clickEndTurnButton, clickTile, state, waitForMode, waitForScene } from './helpers';

/**
 * Jeu en ligne, deux navigateurs : vrais comptes et vrai serveur (en mémoire, lancé par
 * playwright.config.ts). Amina (Dahomey) crée la partie, Kofi (Sosso) la rejoint.
 */

async function signUp(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const stamp = `${Date.now() % 1_000_000}${Math.floor(Math.random() * 100)}`;
  await page.goto('/');
  await page.getByRole('tab', { name: 'Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`${name}${stamp}`);
  await page.getByLabel('Email').fill(`${name}${stamp}@exemple.org`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await page.getByRole('button', { name: /Battle/ }).click();
  await page.getByRole('button', { name: /J1 vs J2 online/ }).click();
  return page;
}

/** Les deux écrans ont le même état (le moteur est déterministe). */
async function sameState(a: Page, b: Page): Promise<GameState> {
  await expect
    .poll(async () => JSON.stringify(await state(b)))
    .toBe(JSON.stringify(await state(a)));
  return state(a);
}

test('duel en ligne : créer, rejoindre, jouer un coup, passer la main', async ({ browser }) => {
  test.setTimeout(180_000);
  const amina = await signUp(browser, 'Amina');
  await amina.locator('.en-ligne__peuple[data-peuple=dahomey]').click();
  await amina.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(amina.getByText('En attente d’un adversaire…')).toBeVisible();

  const kofi = await signUp(browser, 'Kofi');
  await kofi.locator('.en-ligne__peuple[data-peuple=sosso]').click();
  const open = kofi.locator('.en-ligne__partie', { hasText: 'Royaume du Dahomey' });
  await open.getByRole('button', { name: 'Rejoindre' }).click();

  await expect(amina).toHaveURL(/mode=enligne/);
  await expect(kofi).toHaveURL(/mode=enligne/);
  await Promise.all([waitForScene(amina, 'Battle'), waitForScene(kofi, 'Battle')]);
  await waitForMode(amina, 'idle');
  await waitForMode(kofi, 'remote');
  const start = await sameState(amina, kofi);
  expect(start.players.map((p) => p.id)).toEqual(['dahomey', 'sosso']);

  // Amina déplace une Agojié d'une case, puis « Attendre » : le coup part au serveur.
  const unit = start.units.find((u) => u.owner === 'dahomey');
  if (!unit) throw new Error('Une unité du Dahomey attendue');
  const free = [
    { x: unit.x + 1, y: unit.y },
    { x: unit.x, y: unit.y - 1 },
    { x: unit.x - 1, y: unit.y },
    { x: unit.x, y: unit.y + 1 },
  ].find(
    (t) =>
      !start.units.some((u) => u.x === t.x && u.y === t.y) &&
      ['plaine', 'route', 'foret'].includes(start.map.tiles[t.y * start.map.width + t.x] ?? ''),
  );
  if (!free) throw new Error('Une case libre attendue à côté de l’unité');
  await clickTile(amina, unit.x, unit.y);
  await waitForMode(amina, 'selected');
  await clickTile(amina, free.x, free.y);
  await waitForMode(amina, 'menu');
  await amina.keyboard.press('ArrowUp'); // « Attendre » est le dernier choix
  await amina.keyboard.press('Enter');
  await waitForMode(amina, 'idle');
  const moved = await sameState(amina, kofi);
  expect(moved.units.find((u) => u.id === unit.id)).toMatchObject({ ...free, hasActed: true });

  // Fin de tour : la main passe à Kofi, puis revient à Amina au jour 2.
  await clickEndTurnButton(amina);
  await waitForMode(kofi, 'idle');
  await waitForMode(amina, 'remote');
  expect((await sameState(amina, kofi)).currentPlayer).toBe('sosso');
  await clickEndTurnButton(kofi);
  await waitForMode(amina, 'idle');
  const back = await sameState(amina, kofi);
  expect(back).toMatchObject({ currentPlayer: 'dahomey', day: 2 });
});
