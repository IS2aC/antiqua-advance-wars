import type Phaser from 'phaser';
import type { Position } from '@antiqua/engine';
import { TILE_SIZE } from '../config';
import { ATTACK_ZONE_COLOR, MOVE_ZONE_COLOR } from './palette';

const T = TILE_SIZE;
const key = (tile: Position) => `${tile.x},${tile.y}`;

/** Zones translucides : déplacement en bleu, attaque en rouge (hors zone bleue). */
export class RangeOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(5);
  }

  show(move: readonly Position[], attack: readonly Position[]): void {
    const g = this.graphics.clear();
    const moveKeys = new Set(move.map(key));
    g.fillStyle(MOVE_ZONE_COLOR, 0.45);
    for (const tile of move) g.fillRect(tile.x * T + 1, tile.y * T + 1, T - 2, T - 2);
    g.fillStyle(ATTACK_ZONE_COLOR, 0.45);
    for (const tile of attack) {
      if (!moveKeys.has(key(tile))) g.fillRect(tile.x * T + 1, tile.y * T + 1, T - 2, T - 2);
    }
  }

  /** Cibles possibles d'une attaque : cases rouges encadrées. */
  showTargets(targets: readonly Position[]): void {
    const g = this.graphics.clear();
    g.fillStyle(ATTACK_ZONE_COLOR, 0.5);
    g.lineStyle(2, ATTACK_ZONE_COLOR, 1);
    for (const tile of targets) {
      g.fillRect(tile.x * T + 1, tile.y * T + 1, T - 2, T - 2);
      g.strokeRect(tile.x * T + 1, tile.y * T + 1, T - 2, T - 2);
    }
  }

  clear(): void {
    this.graphics.clear();
  }
}
