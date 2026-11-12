import Phaser from 'phaser';
import { CURSOR_COLOR, OUTLINE_COLOR, PANEL_COLOR } from '../view/palette';

/**
 * Panneaux d'interface 9-slice (24×24, coins de 8 px) dessinés en code : pas d'asset
 * à produire, et tout le HUD suit la grille de 8 px.
 */
export const GRID = 8;
const SIZE = 24;
const CORNER = 8;

export type PanelStyle = 'panel' | 'highlight' | 'button';

const STYLES: Readonly<Record<PanelStyle, { fill: number; border: number; inner: number }>> = {
  panel: { fill: PANEL_COLOR, border: CURSOR_COLOR, inner: 0x4a3626 },
  highlight: { fill: 0x5a3e26, border: CURSOR_COLOR, inner: 0x8a6438 },
  button: { fill: 0x3a2a1e, border: 0xd8b060, inner: 0x6a4a2a },
};

const textureKey = (style: PanelStyle) => `ui-${style}`;

/** Génère les textures de panneaux (une fois par jeu). */
export function createPanelTextures(scene: Phaser.Scene): void {
  for (const style of Object.keys(STYLES) as PanelStyle[]) {
    const key = textureKey(style);
    if (scene.textures.exists(key)) continue;
    const { fill, border, inner } = STYLES[style];
    const g = scene.make.graphics({}, false);
    // Contour sombre, bord clair, liseré intérieur, fond ; coins coupés d'un pixel.
    g.fillStyle(OUTLINE_COLOR, 1)
      .fillRect(1, 0, SIZE - 2, SIZE)
      .fillRect(0, 1, SIZE, SIZE - 2);
    g.fillStyle(border, 1)
      .fillRect(2, 1, SIZE - 4, SIZE - 2)
      .fillRect(1, 2, SIZE - 2, SIZE - 4);
    g.fillStyle(inner, 1).fillRect(3, 3, SIZE - 6, SIZE - 6);
    g.fillStyle(fill, 1).fillRect(4, 4, SIZE - 8, SIZE - 8);
    g.generateTexture(key, SIZE, SIZE);
    g.destroy();
  }
}

/** Panneau aux dimensions données (arrondies à la grille de 8 px). */
export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  style: PanelStyle = 'panel',
): Phaser.GameObjects.NineSlice {
  return scene.add
    .nineslice(
      x,
      y,
      textureKey(style),
      undefined,
      snap(width),
      snap(height),
      CORNER,
      CORNER,
      CORNER,
      CORNER,
    )
    .setOrigin(0);
}

/** Arrondit à la grille de 8 px (au supérieur, minimum 24). */
export function snap(value: number): number {
  return Math.max(SIZE, Math.ceil(value / GRID) * GRID);
}
