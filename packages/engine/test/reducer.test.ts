import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/index';
import type { Action } from '../src/index';
import { C, K, act, deepFreeze, errorOf, play, setup } from './helpers';

const ROWS = ['QC..V', '.....', 'V..CQ'];
const base = () =>
  setup(ROWS, {
    owners: { '0,0': K, '1,0': K, '4,2': C, '3,2': C },
    units: [
      { type: 'fantassin', owner: K, x: 2, y: 1 },
      { type: 'fantassin', owner: C, x: 3, y: 1 },
      { type: 'fantassin', owner: K, x: 4, y: 0 },
    ],
  });

describe('reducer applyAction', () => {
  it('ne modifie jamais l’état reçu', () => {
    const state = deepFreeze(base());
    const snapshot = JSON.stringify(state);
    const actions: Action[] = [
      { type: 'ATTACK', unitId: 1, targetId: 2 },
      { type: 'CAPTURE', unitId: 3 },
      { type: 'BUILD', x: 1, y: 0, unitType: 'fantassin' },
      { type: 'END_TURN' },
      { type: 'MOVE', unitId: 2, to: { x: 3, y: 0 } },
      { type: 'WAIT', unitId: 2 },
      { type: 'END_TURN' },
    ];
    let current = state;
    for (const action of actions) {
      const result = applyAction(current, action);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      current = deepFreeze(result.state);
    }
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('est déterministe : même graine, mêmes actions, même résultat', () => {
    const run = () => act(base(), { type: 'ATTACK', unitId: 1, targetId: 2 });
    expect(run()).toEqual(run());
  });

  it('alterne les joueurs et avance le jour', () => {
    const { state: carthage, events } = act(base(), { type: 'END_TURN' });
    expect(carthage.currentPlayer).toBe(C);
    expect(carthage.day).toBe(1);
    expect(events).toEqual([
      { type: 'turnEnded', player: K },
      { type: 'turnStarted', player: C, day: 1 },
    ]);
    const koush = act(carthage, { type: 'END_TURN' }).state;
    expect(koush.currentPlayer).toBe(K);
    expect(koush.day).toBe(2);
  });

  it('les unités redeviennent disponibles à la fin du tour de leur camp', () => {
    const { state, events } = play(base(), [{ type: 'WAIT', unitId: 1 }]);
    expect(events).toEqual([{ type: 'unitWaited', unitId: 1 }]);
    expect(state.units[0]?.hasActed).toBe(true);
    expect(errorOf(state, { type: 'WAIT', unitId: 1 })).toBe('UNIT_ALREADY_ACTED');
    const next = act(state, { type: 'END_TURN' }).state;
    expect(next.units[0]).toMatchObject({ hasMoved: false, hasActed: false });
  });

  it('refuse de commander une unité adverse ou inconnue', () => {
    expect(errorOf(base(), { type: 'WAIT', unitId: 2 })).toBe('NOT_YOUR_UNIT');
    expect(errorOf(base(), { type: 'CAPTURE', unitId: 99 })).toBe('UNIT_NOT_FOUND');
    expect(errorOf(base(), { type: 'ATTACK', unitId: 2, targetId: 1 })).toBe('NOT_YOUR_UNIT');
  });

  it('renvoie une erreur typée pour une action inconnue', () => {
    const result = applyAction(base(), { type: 'DANCE' } as unknown as Action);
    expect(result).toEqual({
      ok: false,
      error: { code: 'UNKNOWN_ACTION', message: 'Action inconnue : DANCE.' },
    });
  });
});
