import Phaser from 'phaser';
import type { PlayerId, TerrainType, UnitType } from '@antiqua/engine';
import { LOGICAL_HEIGHT } from '../config';
import { GRID } from '../ui/panels';
import { TERRAIN_ATLAS, hasUnitArt, idleAnimation, unitAtlas } from '../view/art';
import { TEAM_COLORS, darken } from '../view/palette';
import { decorFor, figureAnimation, figureAtlas, hasFigure } from './packs';

/**
 * Éléments communs aux scènes de combat et de capture : le décor d'un terrain et les
 * figurants. Les packs de culture sont utilisés quand ils existent, sinon le rendu de la
 * phase A (tuiles de terrain, sprites de carte agrandis).
 */

/** Échelle des sprites de carte et des tuiles en scène. */
export const SCALE = 2;
/** Hauteur du bandeau du haut (le décor passe dessous). */
export const HUD_H = GRID * 7;
const HORIZON = 168;
const DECOR_W = 320;
const SKY = [0x5f9fd8, 0x74afe0, 0x8cbfe6, 0xa6cfeb, 0xbfdcee, 0xd6e8ef] as const;

/** Décor d'horizon par terrain : la tuile qui se répète au loin. */
function horizonFrame(terrain: TerrainType): string | null {
  switch (terrain) {
    case 'foret':
      return 'terrain/foret/0';
    case 'montagne':
      return 'terrain/montagne/0';
    case 'colline':
      return 'terrain/colline/1';
    case 'marais':
      return 'terrain/marais/1';
    case 'desert':
      return null;
    default:
      return 'terrain/foret/2';
  }
}

/** Sol au premier plan par terrain. */
function groundFrame(terrain: TerrainType): string {
  switch (terrain) {
    case 'foret':
    case 'colline':
    case 'desert':
    case 'marais':
      return `terrain/${terrain}/0`;
    case 'montagne':
      return 'terrain/colline/0';
    default:
      return 'terrain/plaine/0';
  }
}

/**
 * Décor du terrain sur la bande [x0, x0 + width] : l'image du pack (répétée en miroir
 * si la bande est plus large qu'une moitié d'écran), sinon ciel en bandes, horizon et sol
 * faits des tuiles du terrain.
 */
export function drawBackdrop(
  scene: Phaser.Scene,
  terrain: TerrainType,
  x0: number,
  width: number,
): Phaser.GameObjects.GameObject[] {
  const decor = decorFor(scene, terrain);
  if (decor) {
    const images: Phaser.GameObjects.GameObject[] = [];
    for (let x = x0, i = 0; x < x0 + width; x += DECOR_W, i++) {
      images.push(
        scene.add
          .image(x, 0, decor)
          .setOrigin(0)
          .setFlipX(i % 2 === 1),
      );
    }
    return images;
  }

  const sky = scene.add.graphics();
  const bandH = Math.ceil((HORIZON - HUD_H + 40) / SKY.length);
  SKY.forEach((color, i) =>
    sky.fillStyle(color, 1).fillRect(x0, HUD_H - 40 + i * bandH, width, bandH),
  );
  sky.fillStyle(SKY[0], 1).fillRect(x0, 0, width, HUD_H - 40);
  const objects: Phaser.GameObjects.GameObject[] = [sky];
  const horizon = horizonFrame(terrain);
  if (horizon) {
    objects.push(
      scene.add
        .tileSprite(x0, HORIZON - 64, width, 64, TERRAIN_ATLAS, horizon)
        .setOrigin(0)
        .setTileScale(SCALE),
    );
  }
  objects.push(
    scene.add
      .tileSprite(x0, HORIZON, width, LOGICAL_HEIGHT - HORIZON, TERRAIN_ATLAS, groundFrame(terrain))
      .setOrigin(0)
      .setTileScale(SCALE),
  );
  return objects;
}

export type FigureSprite = Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;

/**
 * Un figurant debout (pieds en `y`), tourné vers la droite ou la gauche : figurant du pack
 * de culture (64 px), sinon sprite de carte ×2, sinon silhouette de couleur.
 */
export function createFigure(
  scene: Phaser.Scene,
  owner: PlayerId,
  unitType: UnitType,
  x: number,
  y: number,
  facingLeft: boolean,
): { sprite: FigureSprite; pack: boolean } {
  if (hasFigure(scene, owner, unitType)) {
    const sprite = scene.add
      .sprite(x, y, figureAtlas(owner), `figure/${unitType}/idle/0`)
      .setOrigin(0.5, 1)
      .setFlipX(facingLeft)
      .setDepth(y);
    const idle = figureAnimation(owner, unitType, 'idle');
    if (scene.anims.exists(idle)) sprite.play({ key: idle, startFrame: Phaser.Math.Between(0, 3) });
    return { sprite, pack: true };
  }
  if (hasUnitArt(scene, owner)) {
    const sprite = scene.add
      .sprite(x, y, unitAtlas(owner), `unit/${unitType}/idle/0`)
      .setOrigin(0.5, 1)
      .setScale(SCALE)
      .setFlipX(facingLeft)
      .setDepth(y);
    sprite.play({ key: idleAnimation(owner, unitType), startFrame: Phaser.Math.Between(0, 3) });
    return { sprite, pack: false };
  }
  const sprite = scene.add
    .rectangle(x, y, 40, 48, TEAM_COLORS[owner])
    .setOrigin(0.5, 1)
    .setStrokeStyle(2, darken(TEAM_COLORS[owner]))
    .setDepth(y);
  return { sprite, pack: false };
}
