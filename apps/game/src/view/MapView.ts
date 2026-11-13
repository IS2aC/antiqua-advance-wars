import Phaser from 'phaser';
import { CAPTURE_POINTS, type Building, type GameState, type TerrainType } from '@antiqua/engine';
import { TILE_SIZE } from '../config';
import { BUILDING_ATLAS, TERRAIN_ATLAS, TerrainFrames, buildingFrame, hasArt } from './art';
import { tileText } from './text';
import {
  BUILDING_LABELS,
  NEUTRAL_COLOR,
  OUTLINE_COLOR,
  TEAM_COLORS,
  TERRAIN_COLORS,
  darken,
} from './palette';

const T = TILE_SIZE;

/** Petit motif par terrain, pour distinguer les cases sans sprites. */
function drawTerrainMark(
  g: Phaser.GameObjects.Graphics,
  terrain: TerrainType,
  px: number,
  py: number,
): void {
  const dark = darken(TERRAIN_COLORS[terrain], 0.7);
  switch (terrain) {
    case 'foret':
      g.fillStyle(dark, 1);
      g.fillCircle(px + T * 0.3, py + T * 0.35, T * 0.16);
      g.fillCircle(px + T * 0.68, py + T * 0.5, T * 0.16);
      g.fillCircle(px + T * 0.38, py + T * 0.72, T * 0.14);
      break;
    case 'colline':
      g.fillStyle(dark, 1);
      g.fillTriangle(
        px + T * 0.15,
        py + T * 0.75,
        px + T * 0.5,
        py + T * 0.35,
        px + T * 0.85,
        py + T * 0.75,
      );
      break;
    case 'montagne':
      g.fillStyle(dark, 1);
      g.fillTriangle(
        px + T * 0.1,
        py + T * 0.9,
        px + T * 0.5,
        py + T * 0.1,
        px + T * 0.9,
        py + T * 0.9,
      );
      g.fillStyle(0xf0e8d8, 1);
      g.fillTriangle(
        px + T * 0.4,
        py + T * 0.3,
        px + T * 0.5,
        py + T * 0.1,
        px + T * 0.6,
        py + T * 0.3,
      );
      break;
    case 'desert':
      g.fillStyle(dark, 1);
      g.fillRect(px + T * 0.2, py + T * 0.4, T * 0.3, 2);
      g.fillRect(px + T * 0.5, py + T * 0.7, T * 0.3, 2);
      break;
    case 'marais':
      g.fillStyle(0x3a5a6a, 1);
      g.fillRect(px + T * 0.15, py + T * 0.3, T * 0.4, 3);
      g.fillRect(px + T * 0.45, py + T * 0.65, T * 0.4, 3);
      break;
    case 'riviere':
      g.fillStyle(0x73b4f2, 1);
      g.fillRect(px + T * 0.2, py + T * 0.3, T * 0.25, 2);
      g.fillRect(px + T * 0.55, py + T * 0.65, T * 0.25, 2);
      break;
    case 'pont':
      g.fillStyle(dark, 1);
      for (let i = 1; i < 4; i++) g.fillRect(px, py + (T * i) / 4, T, 2);
      break;
    default:
      break;
  }
}

/**
 * Bâtiment : sprite 32×64 ancré en bas de sa case (le toit et le drapeau débordent sur la
 * case du dessus), ou bloc de couleur avec sa lettre si les atlas manquent.
 */
class BuildingView {
  private readonly image: Phaser.GameObjects.Image | null = null;
  private readonly block: Phaser.GameObjects.Rectangle | null = null;
  private readonly capture: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, building: Building, withArt: boolean) {
    const px = building.x * T;
    const py = building.y * T;
    if (withArt) {
      this.image = scene.add
        .image(px + T / 2, py + T, BUILDING_ATLAS, buildingFrame(building.type, building.owner))
        .setOrigin(0.5, 1)
        .setDepth(2 + building.y / 100);
    } else {
      const inset = building.type === 'village' ? 6 : 4;
      this.block = scene.add
        .rectangle(px + inset, py + inset, T - inset * 2, T - inset * 2, NEUTRAL_COLOR)
        .setOrigin(0)
        .setStrokeStyle(2, OUTLINE_COLOR);
      tileText(scene, px + T / 2, py + T / 2 - 1, BUILDING_LABELS[building.type], 10).setOrigin(
        0.5,
      );
    }
    this.capture = tileText(scene, px + 1, py + 1, '', 8)
      .setOrigin(0)
      .setColor('#ffe066')
      .setDepth(3);
    this.update(building);
  }

  update(building: Building): void {
    this.image?.setFrame(buildingFrame(building.type, building.owner));
    this.block?.setFillStyle(building.owner ? TEAM_COLORS[building.owner] : NEUTRAL_COLOR);
    const capturing = building.capturePoints < CAPTURE_POINTS;
    this.capture.setText(capturing ? String(building.capturePoints) : '');
  }
}

/** Terrain (posé une fois) et bâtiments (mis à jour à chaque capture). */
export class MapView {
  private readonly buildings = new Map<string, BuildingView>();

  constructor(scene: Phaser.Scene, state: GameState) {
    const withArt = hasArt(scene);
    if (withArt) this.drawTiles(scene, state);
    else this.drawPlaceholders(scene, state);
    for (const building of state.buildings) {
      this.buildings.set(`${building.x},${building.y}`, new BuildingView(scene, building, withArt));
    }
  }

  sync(state: GameState): void {
    for (const building of state.buildings) {
      this.buildings.get(`${building.x},${building.y}`)?.update(building);
    }
  }

  /** Tuiles de l'atlas : variantes stables par case, routes et rivière en autotiling. */
  private drawTiles(scene: Phaser.Scene, state: GameState): void {
    const frames = new TerrainFrames(scene);
    const { map } = state;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const frame = frames.frameFor(state, x, y);
        if (frame)
          scene.add
            .image(x * T, y * T, TERRAIN_ATLAS, frame)
            .setOrigin(0)
            .setDepth(0);
      }
    }
  }

  private drawPlaceholders(scene: Phaser.Scene, state: GameState): void {
    const { map } = state;
    const g = scene.add.graphics();
    map.tiles.forEach((terrain, index) => {
      const px = (index % map.width) * T;
      const py = Math.floor(index / map.width) * T;
      g.fillStyle(TERRAIN_COLORS[terrain], 1);
      g.fillRect(px, py, T, T);
      drawTerrainMark(g, terrain, px, py);
    });
    // Liseré de grille discret.
    g.lineStyle(1, OUTLINE_COLOR, 0.25);
    for (let x = 0; x <= map.width; x++) g.lineBetween(x * T + 0.5, 0, x * T + 0.5, map.height * T);
    for (let y = 0; y <= map.height; y++) g.lineBetween(0, y * T + 0.5, map.width * T, y * T + 0.5);
  }
}
