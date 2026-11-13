import { expect, test } from '@playwright/test';
import {
  SAVE_KEY,
  clickEndTurnButton,
  clickTile,
  state,
  waitForMode,
  waitForScene,
} from './helpers';

/**
 * Parcours complet d'un tour sur « Le Gué du Nil » : nouvelle partie, production,
 * déplacement, attaque (après reprise d'une sauvegarde), fin de tour et sauvegarde auto.
 */
test('lancer une partie, produire, déplacer, attaquer, finir le tour', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/jeu.html');
  await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
  await page.reload();

  // Écran titre sans sauvegarde : « Contre l'IA », puis « À deux joueurs ».
  await waitForScene(page, 'Title');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');

  // 1. Production d'un fantassin dans la caserne de Koush (4, 12).
  await clickTile(page, 4, 12);
  await waitForMode(page, 'menu');
  await page.keyboard.press('Enter');
  await waitForMode(page, 'idle');
  let current = await state(page);
  const built = current.units.find((unit) => unit.x === 4 && unit.y === 12);
  expect(built).toMatchObject({ owner: 'koush', type: 'fantassin', hasActed: true });
  expect(current.players.find((p) => p.id === 'koush')?.funds).toBe(1000);

  // 2. Déplacement du fantassin (3, 12) vers (5, 11), puis « Attendre ».
  const mover = current.units.find((unit) => unit.x === 3 && unit.y === 12);
  expect(mover).toBeDefined();
  await clickTile(page, 3, 12);
  await waitForMode(page, 'selected');
  await clickTile(page, 5, 11);
  await waitForMode(page, 'menu');
  await page.keyboard.press('ArrowUp'); // « Attendre » est le dernier choix
  await page.keyboard.press('Enter');
  await waitForMode(page, 'idle');
  current = await state(page);
  expect(current.units.find((unit) => unit.id === mover?.id)).toMatchObject({
    x: 5,
    y: 11,
    hasMoved: true,
    hasActed: true,
  });

  // 3. Attaque : on reprend une sauvegarde où un fantassin de Carthage est au contact.
  const defender = current.units.find((unit) => unit.owner === 'carthage');
  const attacker = current.units.find((unit) => unit.owner === 'koush' && !unit.hasActed);
  expect(defender && attacker).toBeTruthy();
  if (!defender || !attacker) return;
  const target = { x: attacker.x, y: attacker.y - 1 };
  const staged = {
    ...current,
    units: current.units.map((unit) => (unit.id === defender.id ? { ...unit, ...target } : unit)),
  };
  await page.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), {
    key: SAVE_KEY,
    save: { version: 1, savedAt: new Date().toISOString(), state: staged },
  });
  await page.reload();
  await waitForScene(page, 'Title');
  await page.keyboard.press('Enter'); // « Continuer » est le premier choix
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');

  await clickTile(page, attacker.x, attacker.y);
  await waitForMode(page, 'selected');
  await clickTile(page, attacker.x, attacker.y); // même case : ordres sans bouger
  await waitForMode(page, 'menu');
  await page.keyboard.press('Enter'); // « Attaquer »
  await waitForMode(page, 'targeting');
  await clickTile(page, target.x, target.y);
  await waitForMode(page, 'idle');
  current = await state(page);
  const hit = current.units.find((unit) => unit.id === defender.id);
  expect(hit?.hp ?? 0).toBeLessThan(100);
  expect(current.units.find((unit) => unit.id === attacker.id)?.hasActed ?? true).toBe(true);

  // 4. Fin de tour : au tour de Carthage, la partie est sauvegardée automatiquement.
  await clickEndTurnButton(page);
  await expect.poll(async () => (await state(page)).currentPlayer).toBe('carthage');
  await waitForMode(page, 'idle');
  const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  expect(JSON.parse(saved ?? '{}').state?.currentPlayer).toBe('carthage');

  expect(errors).toEqual([]);
});

/**
 * Contre l'IA : le joueur finit son premier tour, Carthage joue seule (déplacements,
 * production), puis la main revient à Koush au jour 2. La sauvegarde garde le mode.
 */
test('contre l’IA : Carthage joue son tour puis rend la main', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/jeu.html');
  await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
  await page.reload();
  await waitForScene(page, 'Title');
  await page.keyboard.press('Enter'); // « Contre l'IA »
  await waitForScene(page, 'Battle');
  await waitForMode(page, 'idle');

  const before = await state(page);
  const carthageBefore = before.units.filter((unit) => unit.owner === 'carthage');

  await clickEndTurnButton(page);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { __ANTIQUA__: { mode(): string } }).__ANTIQUA__.mode(),
      ),
    )
    .toBe('ai');
  // Le bouton du HUD accélère le tour de l'IA.
  await clickEndTurnButton(page);

  await expect
    .poll(
      async () => {
        const current = await state(page);
        return `${current.currentPlayer}/${current.day}`;
      },
      { timeout: 60_000 },
    )
    .toBe('koush/2');
  await waitForMode(page, 'idle');

  const after = await state(page);
  const carthageAfter = after.units.filter((unit) => unit.owner === 'carthage');
  // L'IA a produit (2 000 or au départ) et déplacé ses fantassins de départ.
  expect(carthageAfter.length).toBeGreaterThan(carthageBefore.length);
  const moved = carthageBefore.filter((unit) => {
    const now = after.units.find((candidate) => candidate.id === unit.id);
    return now && (now.x !== unit.x || now.y !== unit.y);
  });
  expect(moved.length).toBeGreaterThan(0);

  const saved = JSON.parse(
    (await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)) ?? '{}',
  );
  expect(saved.aiPlayers).toEqual(['carthage']);
  expect(saved.state?.currentPlayer).toBe('koush');
  expect(errors).toEqual([]);
});
