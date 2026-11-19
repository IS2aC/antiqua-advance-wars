import { describe, expect, it } from 'vitest';
import { canLoad, freeSeats, targetsInRange, unloadTiles } from '../src/index';
import { C, K, act, errorOf, eventsOfType, setup } from './helpers';

const ROWS = ['......', '......', '......'];

/** Convoi de Koush en (2, 1), deux fantassins et des archers autour ; ennemi au loin. */
function convoy() {
  return setup(ROWS, {
    units: [
      { type: 'convoi', owner: K, x: 2, y: 1 },
      { type: 'fantassin', owner: K, x: 1, y: 1 },
      { type: 'lancier', owner: K, x: 3, y: 1 },
      { type: 'archers', owner: K, x: 2, y: 0 },
      { type: 'cavalerie', owner: K, x: 2, y: 2 },
      { type: 'fantassin', owner: C, x: 5, y: 2 },
    ],
  });
}

describe('convoi : embarquer', () => {
  it('une unité à pied monte à bord et a fini son tour', () => {
    const { state, events } = act(convoy(), { type: 'LOAD', unitId: 2, transportId: 1 });
    expect(state.units.find((u) => u.id === 2)).toBeUndefined();
    const carrier = state.units.find((u) => u.id === 1);
    expect(carrier?.cargo?.map((u) => u.id)).toEqual([2]);
    expect(carrier?.cargo?.[0]).toMatchObject({ x: 2, y: 1, hasActed: true });
    expect(events.map((e) => e.type)).toEqual(['unitMoved', 'unitLoaded']);
  });

  it('deux places : la troisième unité est refusée', () => {
    let state = act(convoy(), { type: 'LOAD', unitId: 2, transportId: 1 }).state;
    state = act(state, { type: 'LOAD', unitId: 3, transportId: 1 }).state;
    expect(freeSeats(state.units.find((u) => u.id === 1)!)).toBe(0);
    expect(canLoad(state, 4, 1)).toBe(false);
    expect(errorOf(state, { type: 'LOAD', unitId: 4, transportId: 1 })).toBe('CANNOT_LOAD');
  });

  it('refuse la cavalerie, un transport ennemi ou une unité qui a bougé', () => {
    const state = convoy();
    expect(errorOf(state, { type: 'LOAD', unitId: 5, transportId: 1 })).toBe('CANNOT_LOAD');
    expect(errorOf(state, { type: 'LOAD', unitId: 2, transportId: 6 })).toBe('CANNOT_LOAD');
    const moved = act(state, { type: 'MOVE', unitId: 2, to: { x: 1, y: 0 } }).state;
    expect(errorOf(moved, { type: 'LOAD', unitId: 2, transportId: 1 })).toBe('UNIT_ALREADY_MOVED');
  });
});

describe('convoi : débarquer', () => {
  it('dépose l’unité sur une case voisine libre ; elle a fini son tour', () => {
    let state = act(convoy(), { type: 'LOAD', unitId: 2, transportId: 1 }).state;
    expect(unloadTiles(state, 1, 2)).toEqual([{ x: 1, y: 1 }]);
    const { state: next, events } = act(state, {
      type: 'UNLOAD',
      transportId: 1,
      unitId: 2,
      to: { x: 1, y: 1 },
    });
    expect(next.units.find((u) => u.id === 2)).toMatchObject({ x: 1, y: 1, hasActed: true });
    expect(next.units.find((u) => u.id === 1)?.cargo).toBeUndefined();
    expect(next.units.find((u) => u.id === 1)).toMatchObject({ hasMoved: true, hasActed: false });
    expect(eventsOfType(events, 'unitUnloaded')).toEqual([
      { type: 'unitUnloaded', unitId: 2, transportId: 1, from: { x: 2, y: 1 }, to: { x: 1, y: 1 } },
    ]);
    state = next;
    expect(errorOf(state, { type: 'MOVE', unitId: 1, to: { x: 4, y: 0 } })).toBe(
      'UNIT_ALREADY_MOVED',
    );
  });

  it('refuse une case occupée, lointaine ou une unité absente', () => {
    const state = act(convoy(), { type: 'LOAD', unitId: 2, transportId: 1 }).state;
    const unload = (to: { x: number; y: number }, unitId = 2) =>
      errorOf(state, { type: 'UNLOAD', transportId: 1, unitId, to });
    expect(unload({ x: 3, y: 1 })).toBe('CANNOT_UNLOAD');
    expect(unload({ x: 4, y: 1 })).toBe('CANNOT_UNLOAD');
    expect(unload({ x: 1, y: 1 }, 3)).toBe('CANNOT_UNLOAD');
  });

  it('le convoi transporte ses passagers en se déplaçant', () => {
    let state = act(convoy(), { type: 'LOAD', unitId: 2, transportId: 1 }).state;
    state = act(state, { type: 'MOVE', unitId: 1, to: { x: 4, y: 0 } }).state;
    const { state: next } = act(state, {
      type: 'UNLOAD',
      transportId: 1,
      unitId: 2,
      to: { x: 5, y: 0 },
    });
    expect(next.units.find((u) => u.id === 2)).toMatchObject({ x: 5, y: 0 });
  });
});

describe('convoi : combat', () => {
  it('n’attaque pas, ne riposte pas, et ses passagers périssent avec lui', () => {
    let state = setup(['...'], {
      units: [
        { type: 'convoi', owner: K, x: 1, y: 0, hp: 10 },
        { type: 'fantassin', owner: K, x: 0, y: 0 },
        { type: 'char', owner: C, x: 2, y: 0 },
      ],
    });
    expect(targetsInRange(state, 1)).toEqual([]);
    state = act(state, { type: 'LOAD', unitId: 2, transportId: 1 }).state;
    state = act(state, { type: 'END_TURN' }).state;
    const { state: next, events } = act(state, { type: 'ATTACK', unitId: 3, targetId: 1 });
    expect(eventsOfType(events, 'counterResolved')).toEqual([]);
    expect(next.units.some((u) => u.id === 1 || u.id === 2)).toBe(false);
    expect(next.players.find((p) => p.id === K)?.stats.unitsLost).toBe(2);
  });

  it('un transport chargé ne fusionne pas', () => {
    let state = setup(['....'], {
      units: [
        { type: 'convoi', owner: K, x: 0, y: 0, hp: 50 },
        { type: 'convoi', owner: K, x: 1, y: 0, hp: 50 },
        { type: 'fantassin', owner: K, x: 2, y: 0 },
        { type: 'fantassin', owner: C, x: 3, y: 0 },
      ],
    });
    state = act(state, { type: 'LOAD', unitId: 3, transportId: 2 }).state;
    expect(errorOf(state, { type: 'MERGE', unitId: 1, targetId: 2 })).toBe('CANNOT_MERGE');
  });
});
