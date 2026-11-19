import { describe, expect, it } from 'vitest';
import { canMerge, mergeOutcome } from '../src/index';
import { C, K, act, errorOf, setup } from './helpers';

const ROWS = ['.....', '.....'];
const enemy = { type: 'fantassin', owner: C, x: 4, y: 1 } as const;

describe('fusion', () => {
  it('additionne les PV : 3 + 7 donnent 10, sans remboursement', () => {
    const state = setup(ROWS, {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0, hp: 30 },
        { type: 'fantassin', owner: K, x: 2, y: 0, hp: 70 },
        enemy,
      ],
    });
    expect(canMerge(state, 1, 2)).toBe(true);
    const { state: next, events } = act(state, { type: 'MERGE', unitId: 1, targetId: 2 });
    expect(next.units.find((u) => u.id === 1)).toBeUndefined();
    expect(next.units.find((u) => u.id === 2)).toMatchObject({
      hp: 100,
      x: 2,
      y: 0,
      hasActed: true,
      hasMoved: true,
    });
    expect(events.map((e) => e.type)).toEqual(['unitMoved', 'unitsMerged']);
    expect(events[1]).toMatchObject({ unitId: 1, targetId: 2, hp: 100, refund: 0 });
    expect(next.players.find((p) => p.id === K)?.funds).toBe(
      state.players.find((p) => p.id === K)?.funds,
    );
  });

  it('rembourse 10 % du prix par PV en trop (6 + 7 : 3 PV en trop)', () => {
    const state = setup(ROWS, {
      units: [
        { type: 'lancier', owner: K, x: 0, y: 0, hp: 60 },
        { type: 'lancier', owner: K, x: 1, y: 0, hp: 70 },
        enemy,
      ],
      funds: 500,
    });
    const { state: next, events } = act(state, { type: 'MERGE', unitId: 1, targetId: 2 });
    const cost = 2500; // lancier
    expect(next.units.find((u) => u.id === 2)?.hp).toBe(100);
    expect(events[1]).toMatchObject({ refund: (3 * cost) / 10, funds: 500 + (3 * cost) / 10 });
    expect(next.players.find((p) => p.id === K)?.funds).toBe(500 + (3 * cost) / 10);
  });

  it('compte les PV affichés : 2,5 PV internes valent 1 PV affiché', () => {
    expect(mergeOutcome({ type: 'fantassin', hp: 95 }, { hp: 15 })).toEqual({
      hp: 100,
      refund: (2 * 1000) / 10,
    });
  });

  it('refuse un autre type, un ennemi, une unité intacte ou hors de portée', () => {
    const state = setup(['........', '........'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0, hp: 50 },
        { type: 'archers', owner: K, x: 1, y: 0, hp: 50 },
        { type: 'fantassin', owner: K, x: 0, y: 1, hp: 100 },
        { type: 'fantassin', owner: C, x: 1, y: 1, hp: 50 },
        { type: 'fantassin', owner: K, x: 7, y: 1, hp: 50 },
      ],
    });
    expect(errorOf(state, { type: 'MERGE', unitId: 1, targetId: 2 })).toBe('CANNOT_MERGE');
    expect(errorOf(state, { type: 'MERGE', unitId: 1, targetId: 3 })).toBe('CANNOT_MERGE');
    expect(errorOf(state, { type: 'MERGE', unitId: 1, targetId: 4 })).toBe('CANNOT_MERGE');
    expect(errorOf(state, { type: 'MERGE', unitId: 1, targetId: 1 })).toBe('CANNOT_MERGE');
    expect(errorOf(state, { type: 'MERGE', unitId: 1, targetId: 5 })).toBe('UNREACHABLE');
    expect(errorOf(state, { type: 'MERGE', unitId: 1, targetId: 99 })).toBe('TARGET_NOT_FOUND');
  });

  it('refuse une unité qui a déjà bougé ou agi', () => {
    const state = setup(ROWS, {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0, hp: 50 },
        { type: 'fantassin', owner: K, x: 2, y: 0, hp: 50 },
        enemy,
      ],
    });
    const moved = act(state, { type: 'MOVE', unitId: 1, to: { x: 1, y: 0 } }).state;
    expect(errorOf(moved, { type: 'MERGE', unitId: 1, targetId: 2 })).toBe('UNIT_ALREADY_MOVED');
    const waited = act(state, { type: 'WAIT', unitId: 1 }).state;
    expect(errorOf(waited, { type: 'MERGE', unitId: 1, targetId: 2 })).toBe('UNIT_ALREADY_ACTED');
  });

  it('peut rejoindre une unité qui a déjà agi ; elle reste à sa place', () => {
    let state = setup(ROWS, {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0, hp: 40 },
        { type: 'fantassin', owner: K, x: 1, y: 0, hp: 40 },
        enemy,
      ],
    });
    state = act(state, { type: 'WAIT', unitId: 2 }).state;
    const next = act(state, { type: 'MERGE', unitId: 1, targetId: 2 }).state;
    expect(next.units.find((u) => u.id === 2)).toMatchObject({ hp: 80, x: 1, y: 0 });
  });

  it('remet à zéro la capture du bâtiment quitté', () => {
    let state = setup(['V....', '.....'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0, hp: 100 },
        { type: 'fantassin', owner: K, x: 1, y: 0, hp: 40 },
        enemy,
      ],
    });
    state = act(state, { type: 'CAPTURE', unitId: 1 }).state;
    state = { ...state, units: state.units.map((u) => ({ ...u, hasActed: false })) };
    const { state: next, events } = act(state, { type: 'MERGE', unitId: 1, targetId: 2 });
    expect(events.some((e) => e.type === 'captureReset')).toBe(true);
    expect(next.buildings[0]?.capturePoints).toBe(20);
  });
});
