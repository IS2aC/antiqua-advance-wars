import { describe, expect, it } from 'vitest';
import { CAPTURE_POINTS, buildingAt, canCapture } from '../src/index';
import { C, K, act, endRound, errorOf, eventsOfType, play, setup } from './helpers';

const VILLAGE_ROWS = ['V....', '.....'];
const enemyFarAway = { type: 'fantassin', owner: C, x: 4, y: 1 } as const;

describe('capture', () => {
  it('retire les PV affichés de l’unité aux 20 points du bâtiment', () => {
    const state = setup(VILLAGE_ROWS, {
      units: [{ type: 'fantassin', owner: K, x: 0, y: 0 }, enemyFarAway],
    });
    expect(canCapture(state, 1)).toBe(true);
    const { state: next, events } = act(state, { type: 'CAPTURE', unitId: 1 });
    expect(events).toEqual([{ type: 'captureProgress', unitId: 1, x: 0, y: 0, capturePoints: 10 }]);
    expect(buildingAt(next, 0, 0)).toMatchObject({ owner: null, capturePoints: 10 });
    expect(next.units[0]?.hasActed).toBe(true);
  });

  it('une unité blessée capture moins vite', () => {
    const state = setup(VILLAGE_ROWS, {
      units: [{ type: 'lancier', owner: K, x: 0, y: 0, hp: 45 }, enemyFarAway],
    });
    const next = act(state, { type: 'CAPTURE', unitId: 1 }).state;
    expect(buildingAt(next, 0, 0)?.capturePoints).toBe(15);
  });

  it('le bâtiment change de camp au deuxième tour', () => {
    let state = setup(VILLAGE_ROWS, {
      units: [{ type: 'fantassin', owner: K, x: 0, y: 0 }, enemyFarAway],
    });
    state = endRound(act(state, { type: 'CAPTURE', unitId: 1 }).state);
    const { state: next, events } = act(state, { type: 'CAPTURE', unitId: 1 });
    expect(eventsOfType(events, 'buildingCaptured')).toEqual([
      { type: 'buildingCaptured', x: 0, y: 0, building: 'village', owner: K, previousOwner: null },
    ]);
    expect(buildingAt(next, 0, 0)).toMatchObject({ owner: K, capturePoints: CAPTURE_POINTS });
    expect(canCapture(next, 1)).toBe(false);
  });

  it('repart à 20 si l’unité bouge', () => {
    let state = setup(VILLAGE_ROWS, {
      units: [{ type: 'fantassin', owner: K, x: 0, y: 0 }, enemyFarAway],
    });
    state = endRound(act(state, { type: 'CAPTURE', unitId: 1 }).state);
    const { state: next, events } = act(state, { type: 'MOVE', unitId: 1, to: { x: 1, y: 0 } });
    expect(eventsOfType(events, 'captureReset')).toEqual([{ type: 'captureReset', x: 0, y: 0 }]);
    expect(buildingAt(next, 0, 0)?.capturePoints).toBe(CAPTURE_POINTS);
  });

  it('repart à 20 si l’unité meurt', () => {
    let state = setup(VILLAGE_ROWS, {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0, hp: 20 },
        { type: 'char', owner: C, x: 1, y: 0 },
      ],
    });
    state = play(state, [{ type: 'CAPTURE', unitId: 1 }, { type: 'END_TURN' }]).state;
    expect(buildingAt(state, 0, 0)?.capturePoints).toBe(18);
    const { state: next, events } = act(state, { type: 'ATTACK', unitId: 2, targetId: 1 });
    expect(events.map((event) => event.type)).toEqual([
      'attackResolved',
      'unitDestroyed',
      'captureReset',
    ]);
    expect(buildingAt(next, 0, 0)?.capturePoints).toBe(CAPTURE_POINTS);
  });

  it('refuse les captures illégales', () => {
    const state = setup(['V.V..', '.....'], {
      owners: { '2,0': K },
      units: [
        { type: 'archers', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: K, x: 1, y: 0 },
        { type: 'fantassin', owner: K, x: 2, y: 0 },
        enemyFarAway,
      ],
    });
    expect(errorOf(state, { type: 'CAPTURE', unitId: 1 })).toBe('CANNOT_CAPTURE');
    expect(errorOf(state, { type: 'CAPTURE', unitId: 2 })).toBe('NOT_A_BUILDING');
    expect(errorOf(state, { type: 'CAPTURE', unitId: 3 })).toBe('ALREADY_OWNED');
    expect(canCapture(state, 1)).toBe(false);
    expect(canCapture(state, 99)).toBe(false);
  });

  it('capturer le QG adverse fait gagner la partie', () => {
    let state = setup(['Q....', '....Q'], {
      owners: { '0,0': C, '4,1': K },
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: C, x: 3, y: 1 },
      ],
    });
    state = endRound(act(state, { type: 'CAPTURE', unitId: 1 }).state);
    const { state: next, events } = act(state, { type: 'CAPTURE', unitId: 1 });
    expect(events.slice(-2)).toEqual([
      { type: 'playerDefeated', player: C, reason: 'hq' },
      { type: 'gameOver', winner: K },
    ]);
    expect(next.status).toBe('finished');
    expect(next.winner).toBe(K);
    expect(errorOf(next, { type: 'END_TURN' })).toBe('GAME_OVER');
  });
});
