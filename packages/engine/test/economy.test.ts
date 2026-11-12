import { describe, expect, it } from 'vitest';
import { buildError, incomeFor, unitAt } from '../src/index';
import { C, K, act, endRound, errorOf, eventsOfType, setup } from './helpers';

const ROWS = ['QCV..', '.....', '..C..'];
const base = () =>
  setup(ROWS, {
    owners: { '0,0': K, '1,0': K, '2,0': K, '2,2': C },
    units: [
      { type: 'fantassin', owner: K, x: 4, y: 0 },
      { type: 'fantassin', owner: C, x: 4, y: 2 },
    ],
  });

const funds = (state: ReturnType<typeof base>, id: string) =>
  state.players.find((player) => player.id === id)?.funds;

describe('revenus', () => {
  it('1 000 d’or par bâtiment possédé', () => {
    expect(incomeFor(base(), K)).toBe(3000);
    expect(incomeFor(base(), C)).toBe(1000);
  });

  it('aucun revenu au jour 1, puis versé au début de chaque tour', () => {
    const state = base();
    const { state: carthageTurn, events } = act(state, { type: 'END_TURN' });
    expect(eventsOfType(events, 'fundsGained')).toEqual([]);
    expect(funds(carthageTurn, C)).toBe(2000);

    const { state: day2, events: day2Events } = act(carthageTurn, { type: 'END_TURN' });
    expect(day2.day).toBe(2);
    expect(eventsOfType(day2Events, 'fundsGained')).toEqual([
      { type: 'fundsGained', player: K, amount: 3000, funds: 5000 },
    ]);
  });
});

describe('production (BUILD)', () => {
  it('produit une unité qui ne peut pas agir ce tour', () => {
    const state = base();
    const { state: next, events } = act(state, {
      type: 'BUILD',
      x: 1,
      y: 0,
      unitType: 'fantassin',
    });
    const built = unitAt(next, 1, 0);
    expect(built).toMatchObject({ id: 3, owner: K, hp: 100, hasMoved: true, hasActed: true });
    expect(events).toEqual([{ type: 'unitBuilt', unit: built, cost: 1000 }]);
    expect(funds(next, K)).toBe(1000);
    expect(next.nextUnitId).toBe(4);
    expect(next.players[0]?.stats.unitsBuilt).toBe(1);
    expect(errorOf(next, { type: 'MOVE', unitId: 3, to: { x: 1, y: 1 } })).toBe(
      'UNIT_ALREADY_ACTED',
    );
    const later = endRound(next);
    expect(act(later, { type: 'MOVE', unitId: 3, to: { x: 1, y: 1 } }).state.units).toHaveLength(3);
  });

  it('refuse les productions illégales', () => {
    const state = base();
    const build = (x: number, y: number, unitType: 'fantassin' | 'archers' = 'fantassin') =>
      errorOf(state, { type: 'BUILD', x, y, unitType });
    expect(build(9, 9)).toBe('OUT_OF_BOUNDS');
    expect(build(2, 0)).toBe('NOT_A_BARRACKS');
    expect(build(3, 0)).toBe('NOT_A_BARRACKS');
    expect(build(2, 2)).toBe('NOT_YOUR_BUILDING');
    expect(build(1, 0, 'archers')).toBe('INSUFFICIENT_FUNDS');
    const occupied = act(state, { type: 'BUILD', x: 1, y: 0, unitType: 'fantassin' }).state;
    expect(errorOf(occupied, { type: 'BUILD', x: 1, y: 0, unitType: 'fantassin' })).toBe(
      'TILE_OCCUPIED',
    );
    expect(buildError(state, 1, 0, 'fantassin')).toBeNull();
  });
});
