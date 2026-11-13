import { describe, expect, it } from 'vitest';
import { GUE_DU_NIL, applyAction, chooseRandomAction, createGame } from '../src/index';
import type { GameState } from '../src/index';
import { C, K, play, setup } from './helpers';

describe('partie complète scriptée', () => {
  it('se joue jusqu’à la capture du QG adverse', () => {
    const state = setup(['Q...Q'], {
      owners: { '0,0': K, '4,0': C },
      units: [
        { type: 'fantassin', owner: K, x: 2, y: 0 },
        { type: 'fantassin', owner: C, x: 0, y: 0 },
      ],
    });
    const { state: end, events } = play(state, [
      // Jour 1 — Koush entre dans le QG de Carthage et entame la capture.
      { type: 'MOVE', unitId: 1, to: { x: 4, y: 0 } },
      { type: 'CAPTURE', unitId: 1 },
      { type: 'END_TURN' },
      // Jour 1 — Carthage attend sur le QG de Koush.
      { type: 'WAIT', unitId: 2 },
      { type: 'END_TURN' },
      // Jour 2 — Koush termine la capture.
      { type: 'CAPTURE', unitId: 1 },
    ]);
    expect(end.status).toBe('finished');
    expect(end.winner).toBe(K);
    expect(end.day).toBe(2);
    expect(events.at(-1)).toEqual({ type: 'gameOver', winner: K });
  });
});

/** Joue une partie avec le joueur aléatoire ; échoue à la première action illégale. */
function randomMatch(seed: number, maxDays = 30): { state: GameState; actions: number } {
  let state = createGame(GUE_DU_NIL, { seed });
  let agentSeed = seed ^ 0x5bd1e995;
  let actions = 0;
  while (state.status === 'playing' && state.day <= maxDays) {
    const decision = chooseRandomAction(state, agentSeed);
    agentSeed = decision.seed;
    const result = applyAction(state, decision.action);
    if (!result.ok) {
      throw new Error(`Graine ${seed}, action ${actions} : ${result.error.code}`);
    }
    state = result.state;
    actions += 1;
  }
  return { state, actions };
}

describe('parties aléatoires sur « Le Gué du Nil »', () => {
  it('30 jours sans action illégale, sur plusieurs graines', () => {
    const outcomes = [1, 2, 3, 4, 5, 6].map((seed) => randomMatch(seed));
    for (const { state, actions } of outcomes) {
      expect(actions).toBeGreaterThan(100);
      expect(state.status === 'finished' || state.day > 30).toBe(true);
      // La partie a vraiment vécu : des pertes et des bâtiments neutres pris.
      expect(state.players.every((player) => player.stats.unitsLost > 0)).toBe(true);
      expect(state.buildings.filter((building) => building.owner === null).length).toBeLessThan(4);
    }
  });

  it('peuvent aller jusqu’à la victoire (graine 10)', () => {
    const { state } = randomMatch(10);
    expect(state.status).toBe('finished');
    expect(state.winner).not.toBeNull();
  });

  it('sont reproductibles avec la même graine', () => {
    expect(randomMatch(7, 10).state).toEqual(randomMatch(7, 10).state);
  });
});
