import { expect, type Page } from '@playwright/test';
import type { GameState } from '@antiqua/engine';

/** Crochets exposés par le jeu en mode développement (voir BattleScene et main.ts). */
interface DebugWindow {
  __ANTIQUA__?: { state(): GameState; mode(): string };
  __ANTIQUA_GAME__?: {
    canvas: HTMLCanvasElement;
    scene: {
      isActive(key: string): boolean;
      getScene(key: string): { cameras: { main: { scrollX: number; scrollY: number } } };
    };
  };
}

export const SAVE_KEY = 'antiqua:sauvegarde';
const TILE = 32;
const LOGICAL_WIDTH = 640;

export async function waitForScene(
  page: Page,
  key: 'Title' | 'Battle' | 'Combat' | 'Capture',
): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        (k) => (window as DebugWindow).__ANTIQUA_GAME__?.scene.isActive(k) ?? false,
        key,
      ),
    )
    .toBe(true);
}

export async function state(page: Page): Promise<GameState> {
  return page.evaluate(() => {
    const hook = (window as DebugWindow).__ANTIQUA__;
    if (!hook) throw new Error('Crochet de debug absent : le jeu tourne-t-il en mode dev ?');
    return hook.state();
  });
}

export async function waitForMode(page: Page, mode: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => (window as DebugWindow).__ANTIQUA__?.mode()))
    .toBe(mode);
}

/** Point écran (pixels de page) d'un point logique du jeu (640×384), caméra comprise ou non. */
async function toScreen(
  page: Page,
  x: number,
  y: number,
  world: boolean,
): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ({ x, y, world }) => {
      const game = (window as DebugWindow).__ANTIQUA_GAME__;
      if (!game) throw new Error('Jeu introuvable');
      const rect = game.canvas.getBoundingClientRect();
      const zoom = rect.width / 640;
      const camera = game.scene.getScene('Battle').cameras.main;
      const sx = world ? camera.scrollX : 0;
      const sy = world ? camera.scrollY : 0;
      return { x: rect.left + (x - sx) * zoom, y: rect.top + (y - sy) * zoom };
    },
    { x, y, world },
  );
}

/** Clique au centre d'une case de la carte (après l'avoir survolée, comme un joueur). */
export async function clickTile(page: Page, x: number, y: number): Promise<void> {
  const point = await toScreen(page, x * TILE + TILE / 2, y * TILE + TILE / 2, true);
  await page.mouse.move(point.x, point.y);
  await page.waitForTimeout(150);
  // La caméra a pu défiler au survol : on recalcule avant de cliquer.
  const settled = await toScreen(page, x * TILE + TILE / 2, y * TILE + TILE / 2, true);
  await page.mouse.click(settled.x, settled.y);
}

/** Clique sur le bouton « Fin de tour » du HUD (en haut à droite). */
export async function clickEndTurnButton(page: Page): Promise<void> {
  const point = await toScreen(page, LOGICAL_WIDTH - 4 - 52, 4 + 12, false);
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
}
