import type Phaser from 'phaser';
import type { Position } from '@antiqua/engine';
import { TILE_SIZE } from '../config';
import { CURSOR_COLOR, OUTLINE_COLOR } from './palette';

const T = TILE_SIZE;
const center = (tile: Position) => ({ x: tile.x * T + T / 2, y: tile.y * T + T / 2 });

/** Flèche du chemin de déplacement, dessinée pendant le survol. */
export class PathArrow {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(6);
  }

  show(path: readonly Position[]): void {
    const g = this.graphics.clear();
    if (path.length < 2) return;
    const points = path.map(center);
    for (const [color, width] of [
      [OUTLINE_COLOR, 8],
      [CURSOR_COLOR, 4],
    ] as const) {
      g.lineStyle(width, color, 1);
      g.beginPath();
      points.forEach((point, index) =>
        index === 0 ? g.moveTo(point.x, point.y) : g.lineTo(point.x, point.y),
      );
      g.strokePath();
    }

    const end = points[points.length - 1];
    const before = points[points.length - 2];
    if (!end || !before) return;
    const dx = Math.sign(end.x - before.x);
    const dy = Math.sign(end.y - before.y);
    const size = 7;
    // Pointe de flèche orientée dans le sens du dernier pas.
    const tip = { x: end.x + dx * size, y: end.y + dy * size };
    const left = { x: end.x - dy * size, y: end.y + dx * size };
    const right = { x: end.x + dy * size, y: end.y - dx * size };
    g.fillStyle(OUTLINE_COLOR, 1);
    g.fillTriangle(
      tip.x + dx * 2,
      tip.y + dy * 2,
      left.x - dy * 2,
      left.y + dx * 2,
      right.x + dy * 2,
      right.y - dx * 2,
    );
    g.fillStyle(CURSOR_COLOR, 1);
    g.fillTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);
  }

  clear(): void {
    this.graphics.clear();
  }
}
