import { describe, expect, it } from 'vitest';
import { C, K, act, eventsOfType, errorOf, play, setup } from './helpers';

const lastStand = (day: number) =>
  setup(['.....'], {
    day,
    units: [
      { type: 'char', owner: K, x: 0, y: 0 },
      { type: 'fantassin', owner: C, x: 1, y: 0, hp: 10 },
    ],
  });

describe('victoire par déroute', () => {
  it('pas de déroute au jour 1 : elle tombe au début du jour 2', () => {
    const { state: afterAttack, events } = act(lastStand(1), {
      type: 'ATTACK',
      unitId: 1,
      targetId: 2,
    });
    expect(eventsOfType(events, 'gameOver')).toEqual([]);
    expect(afterAttack.status).toBe('playing');

    const carthageTurn = act(afterAttack, { type: 'END_TURN' }).state;
    expect(carthageTurn.status).toBe('playing');

    const { state: day2, events: day2Events } = act(carthageTurn, { type: 'END_TURN' });
    expect(day2.day).toBe(2);
    expect(day2Events.slice(-2)).toEqual([
      { type: 'playerDefeated', player: C, reason: 'rout' },
      { type: 'gameOver', winner: K },
    ]);
    expect(day2.winner).toBe(K);
  });

  it('à partir du jour 2, détruire la dernière unité fait gagner aussitôt', () => {
    const { state, events } = act(lastStand(2), { type: 'ATTACK', unitId: 1, targetId: 2 });
    expect(events.at(-1)).toEqual({ type: 'gameOver', winner: K });
    expect(state.status).toBe('finished');
    expect(state.players.find((player) => player.id === C)?.defeated).toBe(true);
  });

  it('plus aucune action après la fin de partie', () => {
    const { state } = play(lastStand(2), [{ type: 'ATTACK', unitId: 1, targetId: 2 }]);
    expect(errorOf(state, { type: 'WAIT', unitId: 1 })).toBe('GAME_OVER');
    expect(errorOf(state, { type: 'END_TURN' })).toBe('GAME_OVER');
  });
});
