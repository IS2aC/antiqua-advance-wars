import type Phaser from 'phaser';
import type { Position } from '@antiqua/engine';
import { TILE_SIZE } from '../config';
import { CURSOR_COLOR, OUTLINE_COLOR } from './palette';

const T = TILE_SIZE;

/** Curseur de case : coins clignotants, suit la souris et le clavier. */
export class Cursor {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private tile: Position = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(30);
    this.draw();
    scene.tweens.add({
      targets: this.graphics,
      alpha: 0.55,
      duration: 450,
      yoyo: true,
      repeat: -1,
    });
  }

  get position(): Position {
    return this.tile;
  }

  moveTo(tile: Position): void {
    this.tile = tile;
    this.graphics.setPosition(tile.x * T, tile.y * T);
  }

  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
  }

  private draw(): void {
    const g = this.graphics;
    const arm = 8;
    for (const [color, width] of [
      [OUTLINE_COLOR, 4],
      [CURSOR_COLOR, 2],
    ] as const) {
      g.lineStyle(width, color, 1);
      for (const [cx, cy, sx, sy] of [
        [1, 1, 1, 1],
        [T - 1, 1, -1, 1],
        [1, T - 1, 1, -1],
        [T - 1, T - 1, -1, -1],
      ] as const) {
        g.lineBetween(cx, cy, cx + arm * sx, cy);
        g.lineBetween(cx, cy, cx, cy + arm * sy);
      }
    }
  }
}
