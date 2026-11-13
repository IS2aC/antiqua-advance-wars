import type Phaser from 'phaser';
import type { GameState, Unit } from '@antiqua/engine';
import { UnitSprite } from './UnitSprite';

/** Associe chaque unité de l'état à son sprite. */
export class UnitLayer {
  private readonly sprites = new Map<number, UnitSprite>();

  constructor(
    private readonly scene: Phaser.Scene,
    state: GameState,
  ) {
    for (const unit of state.units) this.add(unit);
  }

  get(unitId: number): UnitSprite | undefined {
    return this.sprites.get(unitId);
  }

  add(unit: Unit): UnitSprite {
    const sprite = new UnitSprite(this.scene, unit);
    this.sprites.set(unit.id, sprite);
    return sprite;
  }

  forget(unitId: number): void {
    this.sprites.delete(unitId);
  }

  /** Recale tous les sprites sur l'état (positions, PV, unités grisées, apparitions, disparitions). */
  sync(state: GameState): void {
    const alive = new Set(state.units.map((unit) => unit.id));
    for (const [id, sprite] of this.sprites) {
      if (!alive.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
    for (const unit of state.units) {
      const sprite = this.sprites.get(unit.id) ?? this.add(unit);
      if (!sprite.animating) sprite.placeAt(unit);
      sprite.update(unit);
    }
  }
}
