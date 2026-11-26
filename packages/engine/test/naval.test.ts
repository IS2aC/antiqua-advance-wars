import { describe, expect, it } from 'vitest';
import { canLoad, producesUnit, reachableTiles, targetsInRange } from '../src/index';
import { C, K, act, errorOf, eventsOfType, setup } from './helpers';

// Côte : terre en haut, mer en bas, un port de Koush sur la côte.
const COAST = ['..C...', '.P....', 'wwwwww', 'wwwwww'];

describe('bateau : navigation et production', () => {
  it('navigue sur la mer et le port, jamais sur la terre ferme', () => {
    const state = setup(COAST, {
      units: [
        { type: 'bateau', owner: K, x: 0, y: 2 },
        { type: 'fantassin', owner: C, x: 5, y: 0 },
      ],
      owners: { '1,1': K },
    });
    const tiles = reachableTiles(state, 1);
    expect(tiles.some((t) => t.y === 0)).toBe(false);
    expect(tiles).toContainEqual(expect.objectContaining({ x: 1, y: 1 }));
    expect(tiles).toContainEqual(expect.objectContaining({ x: 4, y: 3 }));
  });

  it('les troupes à pied ne vont pas sur la mer, mais vont au port', () => {
    const state = setup(COAST, {
      units: [
        { type: 'fantassin', owner: K, x: 1, y: 0 },
        { type: 'fantassin', owner: C, x: 5, y: 0 },
      ],
    });
    const tiles = reachableTiles(state, 1);
    expect(tiles.some((t) => t.y >= 2)).toBe(false);
    expect(tiles).toContainEqual(expect.objectContaining({ x: 1, y: 1 }));
  });

  it('le port produit les bateaux, la caserne les troupes', () => {
    expect(producesUnit('port', 'bateau')).toBe(true);
    expect(producesUnit('port', 'fantassin')).toBe(false);
    expect(producesUnit('caserne', 'bateau')).toBe(false);
    const state = setup(COAST, {
      units: [{ type: 'fantassin', owner: C, x: 5, y: 0 }],
      owners: { '1,1': K, '2,0': K },
      funds: 10000,
    });
    const built = act(state, { type: 'BUILD', x: 1, y: 1, unitType: 'bateau' }).state;
    expect(built.units.some((u) => u.type === 'bateau' && u.x === 1 && u.y === 1)).toBe(true);
    expect(errorOf(state, { type: 'BUILD', x: 2, y: 0, unitType: 'bateau' })).toBe(
      'NOT_A_BARRACKS',
    );
    expect(errorOf(state, { type: 'BUILD', x: 1, y: 1, unitType: 'fantassin' })).toBe(
      'NOT_A_BARRACKS',
    );
  });
});

describe('bateau : transport', () => {
  const afloat = () =>
    setup(COAST, {
      units: [
        { type: 'bateau', owner: K, x: 3, y: 2 },
        { type: 'cavalerie', owner: K, x: 3, y: 0 },
        { type: 'fantassin', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: C, x: 5, y: 0 },
      ],
    });

  it('une unité monte à bord depuis la côte (case voisine), même la cavalerie', () => {
    const state = afloat();
    expect(canLoad(state, 2, 1)).toBe(true);
    const { state: next, events } = act(state, { type: 'LOAD', unitId: 2, transportId: 1 });
    const moved = events.find((e) => e.type === 'unitMoved');
    expect(moved && 'path' in moved ? moved.path.at(-1) : null).toEqual({ x: 3, y: 2 });
    expect(moved && 'path' in moved ? moved.path.at(-2) : null).toEqual({ x: 3, y: 1 });
    expect(next.units.find((u) => u.id === 1)?.cargo?.map((u) => u.type)).toEqual(['cavalerie']);
  });

  it('dépose sur la terre ferme seulement', () => {
    let state = act(afloat(), { type: 'LOAD', unitId: 2, transportId: 1 }).state;
    state = { ...state, units: state.units.map((u) => ({ ...u, hasActed: false })) };
    expect(errorOf(state, { type: 'UNLOAD', transportId: 1, unitId: 2, to: { x: 3, y: 3 } })).toBe(
      'CANNOT_UNLOAD',
    );
    const next = act(state, { type: 'UNLOAD', transportId: 1, unitId: 2, to: { x: 3, y: 1 } });
    expect(next.state.units.find((u) => u.id === 2)).toMatchObject({ x: 3, y: 1 });
  });

  it('trois places', () => {
    const state = setup(['....', 'www.'], {
      units: [
        { type: 'bateau', owner: K, x: 1, y: 1 },
        { type: 'fantassin', owner: K, x: 0, y: 0 },
        { type: 'lancier', owner: K, x: 1, y: 0 },
        { type: 'archers', owner: K, x: 2, y: 0 },
        { type: 'fantassin', owner: K, x: 3, y: 0 },
        { type: 'fantassin', owner: C, x: 3, y: 1 },
      ],
    });
    // Le lancier (voisin du bateau) monte d'abord ; les autres passent par sa case.
    let s = act(state, { type: 'LOAD', unitId: 3, transportId: 1 }).state;
    s = act(s, { type: 'LOAD', unitId: 2, transportId: 1 }).state;
    s = act(s, { type: 'LOAD', unitId: 4, transportId: 1 }).state;
    expect(canLoad(s, 5, 1)).toBe(false);
  });
});

describe('bateau : combat', () => {
  it('n’attaque pas : aucune cible, au contact comme à distance', () => {
    const state = setup(['......', 'wwwwww'], {
      units: [
        { type: 'bateau', owner: K, x: 0, y: 1 },
        { type: 'fantassin', owner: C, x: 2, y: 0 },
        { type: 'fantassin', owner: C, x: 0, y: 0 },
      ],
    });
    expect(targetsInRange(state, 1)).toEqual([]);
    expect(errorOf(state, { type: 'ATTACK', unitId: 1, targetId: 3 })).toBe('TARGET_OUT_OF_RANGE');
    expect(errorOf(state, { type: 'ATTACK', unitId: 1, targetId: 2 })).toBe('TARGET_OUT_OF_RANGE');
  });

  it('encaisse les coups sans riposter ; coulé, il emporte ses passagers', () => {
    let state = setup(['...', 'www'], {
      units: [
        { type: 'bateau', owner: K, x: 1, y: 1 },
        { type: 'fantassin', owner: K, x: 0, y: 1 },
        { type: 'lancier', owner: C, x: 1, y: 0 },
      ],
    });
    state = act(state, { type: 'LOAD', unitId: 2, transportId: 1 }).state;
    state = act(state, { type: 'END_TURN' }).state;
    const hit = act(state, { type: 'ATTACK', unitId: 3, targetId: 1 });
    expect(eventsOfType(hit.events, 'counterResolved')).toEqual([]);
    const before = state.units.find((u) => u.id === 1)?.hp ?? 0;
    expect(hit.state.units.find((u) => u.id === 1)?.hp).toBeLessThan(before);
    expect(hit.state.units.find((u) => u.id === 3)?.hp).toBe(
      state.units.find((u) => u.id === 3)?.hp,
    );

    // Presque coulé (1 PV sur 100), le coup suivant le coule, passager compris.
    const weak = {
      ...hit.state,
      units: hit.state.units.map((u) => (u.id === 1 ? { ...u, hp: 1 } : u)),
    };
    const next = act(
      {
        ...weak,
        units: weak.units.map((u) => (u.id === 3 ? { ...u, hasActed: false, hasMoved: false } : u)),
      },
      { type: 'ATTACK', unitId: 3, targetId: 1 },
    ).state;
    expect(next.units.some((u) => u.id === 1 || u.id === 2)).toBe(false);
  });
});
