import { describe, expect, it } from 'vitest';
import { WALL_DAMAGE, reachableTiles, targetsInRange, wallHp, wallsInRange } from '../src/index';
import { C, K, act, errorOf, eventsOfType, setup } from './helpers';

describe('terrains de siège', () => {
  it('rempart et douves bloquent tout le monde ; le pont passe les douves', () => {
    const state = setup(['.#..', '.o..', '.B..', '....'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 1 },
        { type: 'fantassin', owner: C, x: 3, y: 3 },
      ],
    });
    const tiles = reachableTiles(state, 1);
    expect(tiles.some((t) => t.x === 1 && t.y === 0)).toBe(false);
    expect(tiles.some((t) => t.x === 1 && t.y === 1)).toBe(false);
    expect(tiles.some((t) => t.x === 1 && t.y === 2)).toBe(true);
  });

  it('la tour accueille l’infanterie mais pas les montures ni les roues', () => {
    const state = setup(['.T..', '....'], {
      units: [
        { type: 'archers', owner: K, x: 0, y: 0 },
        { type: 'cavalerie', owner: K, x: 2, y: 0 },
        { type: 'fantassin', owner: C, x: 3, y: 1 },
      ],
    });
    expect(reachableTiles(state, 1).some((t) => t.x === 1 && t.y === 0)).toBe(true);
    expect(reachableTiles(state, 2).some((t) => t.x === 1 && t.y === 0)).toBe(false);
  });

  it('un tireur posté sur une tour porte une case plus loin', () => {
    const state = setup(['T....', '.....'], {
      units: [
        { type: 'archers', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: C, x: 3, y: 0 },
      ],
    });
    expect(targetsInRange(state, 1).map((u) => u.id)).toEqual([2]);
    const flat = setup(['.....', '.....'], {
      units: [
        { type: 'archers', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: C, x: 3, y: 0 },
      ],
    });
    expect(targetsInRange(flat, 1)).toEqual([]);
  });
});

describe('brèche à la catapulte', () => {
  const siege = () =>
    setup(['..#..', '.....'], {
      units: [
        { type: 'catapulte', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: K, x: 2, y: 1 },
        { type: 'fantassin', owner: C, x: 4, y: 0 },
      ],
    });

  it('trois tirs ouvrent une brèche praticable', () => {
    let state = siege();
    expect(wallsInRange(state, state.units[0]!)).toEqual([{ x: 2, y: 0 }]);
    const fire = () => act(state, { type: 'FIRE_WALL', unitId: 1, x: 2, y: 0 });
    let result = fire();
    expect(wallHp(result.state, { x: 2, y: 0 })).toBe(100 - WALL_DAMAGE);
    expect(result.state.units[0]?.hasActed).toBe(true);
    for (let i = 0; i < 2; i++) {
      state = {
        ...result.state,
        units: result.state.units.map((u) => ({ ...u, hasActed: false })),
      };
      result = fire();
    }
    expect(eventsOfType(result.events, 'wallBreached')).toEqual([
      { type: 'wallBreached', x: 2, y: 0 },
    ]);
    expect(result.state.map.tiles[2]).toBe('breche');
    expect(state.map.tiles[2]).toBe('rempart');
    const fresh = {
      ...result.state,
      units: result.state.units.map((u) => ({ ...u, hasActed: false })),
    };
    expect(reachableTiles(fresh, 2).some((t) => t.x === 2 && t.y === 0)).toBe(true);
  });

  it('refuse une autre unité, une case sans rempart, un tir après mouvement ou hors de portée', () => {
    const state = siege();
    expect(errorOf(state, { type: 'FIRE_WALL', unitId: 2, x: 2, y: 0 })).toBe('CANNOT_BREACH');
    expect(errorOf(state, { type: 'FIRE_WALL', unitId: 1, x: 2, y: 1 })).toBe('CANNOT_BREACH');
    const moved = act(state, { type: 'MOVE', unitId: 1, to: { x: 0, y: 1 } }).state;
    expect(errorOf(moved, { type: 'FIRE_WALL', unitId: 1, x: 2, y: 0 })).toBe(
      'CANNOT_FIRE_AFTER_MOVING',
    );
    const far = setup(['.....#', '......'], {
      units: [
        { type: 'catapulte', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: C, x: 0, y: 1 },
      ],
    });
    expect(errorOf(far, { type: 'FIRE_WALL', unitId: 1, x: 5, y: 0 })).toBe('TARGET_OUT_OF_RANGE');
  });
});
