import { expect, test, type Browser, type Page } from '@playwright/test';
import type { GameState } from '@antiqua/engine';
import { clickEndTurnButton, clickTile, state, waitForMode, waitForScene } from './helpers';

/**
 * Jeu en ligne, deux navigateurs : vrais comptes et vrai serveur (en mémoire, lancé par
 * playwright.config.ts). Amina (Dahomey) crée la partie, Kofi (Sosso) la rejoint.
 */

async function signUp(browser: Browser, name: string, entry = /J1 vs J2 online/): Promise<Page> {
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
  await page.getByRole('button', { name: entry }).click();
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

test('JN : J1 contre 3 IA, un autre joueur prend la place d’une IA avec l’accord de J1', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const amina = await signUp(browser, 'Amina', /JN/);
  await amina.locator('.en-ligne__peuple[data-peuple=koush]').click();
  await amina.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(amina).toHaveURL(/mode=enligne/);
  await waitForScene(amina, 'Battle');
  await waitForMode(amina, 'idle');
  // Seule contre l'IA : pas de minuteur.
  await expect(amina.locator('.enligne-minuteur')).toBeHidden();

  const kofi = await signUp(browser, 'Kofi', /JN/);
  const game = kofi.locator('.en-ligne__partie', { hasText: 'JN ·' });
  await game.getByRole('button', { name: 'Prendre Carthage' }).click();
  await expect(kofi.getByText(/demande envoyée pour Carthage/)).toBeVisible();

  // Amina accepte depuis l'écran de jeu ; Kofi y est emmené.
  await amina.getByRole('button', { name: 'Accepter' }).click();
  await expect(kofi).toHaveURL(/mode=enligne/);
  await waitForScene(kofi, 'Battle');
  await waitForMode(kofi, 'remote');
  const start = await sameState(amina, kofi);
  expect(start.currentPlayer).toBe('koush');
  // Deux joueurs humains : le minuteur de 3 min 30 tourne.
  await expect(amina.locator('.enligne-minuteur')).toContainText(/À toi de jouer · 3:\d\d/);
  await expect(kofi.locator('.enligne-minuteur')).toContainText(/Tour de Amina/);

  await clickEndTurnButton(amina);
  await waitForMode(kofi, 'idle');
  expect((await sameState(amina, kofi)).currentPlayer).toBe('carthage');
  await expect(kofi.locator('.enligne-minuteur')).toContainText(/À toi de jouer/);

  // Après Kofi, les deux IA jouent (sur le serveur), puis la main revient à Amina.
  await clickEndTurnButton(kofi);
  await clickEndTurnButton(amina); // « Accélérer »
  await waitForMode(amina, 'idle', 180_000);
  const back = await sameState(amina, kofi);
  expect(back).toMatchObject({ currentPlayer: 'koush', day: 2 });
});
