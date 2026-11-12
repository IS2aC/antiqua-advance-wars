import { describe, expect, it } from 'vitest';
import { distance, findPath, movementCost, reachableTiles } from '../src/index';
import type { UnitType } from '../src/index';
import { C, K, act, errorOf, play, setup } from './helpers';

const keys = (tiles: readonly { x: number; y: number }[]) => tiles.map((t) => `${t.x},${t.y}`);
const costAt = (tiles: readonly { x: number; y: number; cost: number }[], x: number, y: number) =>
  tiles.find((tile) => tile.x === x && tile.y === y)?.cost;

describe('déplacement — coûts de terrain', () => {
  it.each<[UnitType, number | undefined]>([
    ['fantassin', 2],
    ['archers', 2],
    ['lancier', 1],
    ['cavalerie', undefined],
    ['char', undefined],
    ['catapulte', undefined],
  ])('montagne pour %s : coût %s', (type, expected) => {
    const state = setup(['.M.'], { units: [{ type, owner: K, x: 0, y: 0 }] });
    expect(costAt(reachableTiles(state, 1), 1, 0)).toBe(expected);
  });

  it('table de coûts de la montagne', () => {
    expect(movementCost('montagne', 'pied')).toBe(2);
    expect(movementCost('montagne', 'lourd')).toBe(1);
    expect(movementCost('montagne', 'monture')).toBeNull();
    expect(movementCost('montagne', 'roues')).toBeNull();
  });

  it('la rivière se passe à pied mais pas à cheval', () => {
    const cavalry = setup(['.~.'], { units: [{ type: 'cavalerie', owner: K, x: 0, y: 0 }] });
    expect(keys(reachableTiles(cavalry, 1))).toEqual(['0,0']);
    const infantry = setup(['.~.'], { units: [{ type: 'fantassin', owner: K, x: 0, y: 0 }] });
    expect(costAt(reachableTiles(infantry, 1), 1, 0)).toBe(2);
    expect(costAt(reachableTiles(infantry, 1), 2, 0)).toBe(3);
  });

  it('la forêt coûte 3 aux roues', () => {
    const state = setup(['FFFF'], { units: [{ type: 'char', owner: K, x: 0, y: 0 }] });
    const tiles = reachableTiles(state, 1);
    expect(costAt(tiles, 1, 0)).toBe(3);
    expect(costAt(tiles, 2, 0)).toBe(6);
    expect(costAt(tiles, 3, 0)).toBeUndefined();
  });

  it('borne la portée aux points de mouvement', () => {
    const state = setup(['..........'], { units: [{ type: 'cavalerie', owner: K, x: 0, y: 0 }] });
    const xs = reachableTiles(state, 1).map((tile) => tile.x);
    expect(Math.max(...xs)).toBe(7);
  });
});

describe('déplacement — unités', () => {
  it('traverse un allié sans pouvoir s’arrêter dessus', () => {
    const state = setup(['.....'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: K, x: 1, y: 0 },
      ],
    });
    expect(keys(reachableTiles(state, 1))).toEqual(['0,0', '2,0', '3,0']);
  });

  it('est bloqué par un ennemi', () => {
    const state = setup(['.....'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: C, x: 1, y: 0 },
      ],
    });
    expect(keys(reachableTiles(state, 1))).toEqual(['0,0']);
  });

  it('renvoie une liste vide pour une unité inconnue', () => {
    const state = setup(['...'], { units: [{ type: 'fantassin', owner: K, x: 0, y: 0 }] });
    expect(reachableTiles(state, 99)).toEqual([]);
  });
});

describe('findPath', () => {
  const state = setup(['...', '...', '...'], {
    units: [
      { type: 'fantassin', owner: K, x: 0, y: 0 },
      { type: 'fantassin', owner: K, x: 1, y: 1 },
    ],
  });

  it('renvoie le chemin case par case, départ inclus', () => {
    const path = findPath(state, 1, { x: 2, y: 1 });
    expect(path).not.toBeNull();
    expect(path?.[0]).toEqual({ x: 0, y: 0 });
    expect(path?.at(-1)).toEqual({ x: 2, y: 1 });
    expect(path).toHaveLength(4);
    path?.slice(1).forEach((step, index) => {
      const previous = path[index];
      if (previous) expect(distance(previous, step)).toBe(1);
    });
  });

  it('refuse les destinations illégales', () => {
    expect(findPath(state, 1, { x: 1, y: 1 })).toBeNull(); // allié
    expect(findPath(state, 1, { x: 2, y: 2 })).toBeNull(); // trop loin (coût 4)
    expect(findPath(state, 1, { x: 5, y: 0 })).toBeNull(); // hors carte
    expect(findPath(state, 99, { x: 1, y: 0 })).toBeNull(); // unité inconnue
  });
});

describe('action MOVE', () => {
  const state = setup(['.....', '.....'], {
    units: [
      { type: 'fantassin', owner: K, x: 0, y: 0 },
      { type: 'fantassin', owner: K, x: 1, y: 0 },
      { type: 'fantassin', owner: C, x: 4, y: 1 },
    ],
  });

  it('déplace l’unité et émet le chemin', () => {
    const { state: next, events } = act(state, { type: 'MOVE', unitId: 1, to: { x: 2, y: 0 } });
    expect(next.units[0]).toMatchObject({ x: 2, y: 0, hasMoved: true, hasActed: false });
    expect(events).toEqual([
      { type: 'unitMoved', unitId: 1, path: findPath(state, 1, { x: 2, y: 0 }) },
    ]);
  });

  it('refuse les déplacements illégaux avec une erreur typée', () => {
    expect(errorOf(state, { type: 'MOVE', unitId: 99, to: { x: 0, y: 1 } })).toBe('UNIT_NOT_FOUND');
    expect(errorOf(state, { type: 'MOVE', unitId: 3, to: { x: 3, y: 1 } })).toBe('NOT_YOUR_UNIT');
    expect(errorOf(state, { type: 'MOVE', unitId: 1, to: { x: -1, y: 0 } })).toBe('OUT_OF_BOUNDS');
    expect(errorOf(state, { type: 'MOVE', unitId: 1, to: { x: 0.5, y: 0 } })).toBe('OUT_OF_BOUNDS');
    expect(errorOf(state, { type: 'MOVE', unitId: 1, to: { x: 0, y: 0 } })).toBe('NO_MOVEMENT');
    expect(errorOf(state, { type: 'MOVE', unitId: 1, to: { x: 1, y: 0 } })).toBe('TILE_OCCUPIED');
    expect(errorOf(state, { type: 'MOVE', unitId: 1, to: { x: 4, y: 0 } })).toBe('UNREACHABLE');
  });

  it('une unité ne bouge qu’une fois, et plus du tout après avoir agi', () => {
    const moved = act(state, { type: 'MOVE', unitId: 1, to: { x: 0, y: 1 } }).state;
    expect(errorOf(moved, { type: 'MOVE', unitId: 1, to: { x: 1, y: 1 } })).toBe(
      'UNIT_ALREADY_MOVED',
    );
    const waited = play(state, [{ type: 'WAIT', unitId: 1 }]).state;
    expect(errorOf(waited, { type: 'MOVE', unitId: 1, to: { x: 0, y: 1 } })).toBe(
      'UNIT_ALREADY_ACTED',
    );
  });
});
