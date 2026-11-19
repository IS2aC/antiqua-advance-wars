import { describe, expect, it } from 'vitest';
import {
  FORTERESSE,
  SIEGE_DAYS,
  applyAction,
  assignPeoples,
  chooseGreedyAction,
  createGame,
  reachableTiles,
  waveUnits,
  type GameState,
} from '../src/index';

const endTurn = (state: GameState) => {
  const result = applyAction(state, { type: 'END_TURN' });
  if (!result.ok) throw new Error(result.error.code);
  return result;
};

describe('défense de forteresse', () => {
  it('le mode n’existe que si on donne une durée', () => {
    expect(createGame(FORTERESSE, { seed: 1 }).siege).toBeUndefined();
    const state = createGame(FORTERESSE, { seed: 1, siegeDays: SIEGE_DAYS.normal });
    expect(state.siege).toMatchObject({ defender: 'koush', untilDay: 15 });
    expect(state.currentPlayer).toBe('koush');
  });

  it('la citadelle est fermée par les remparts et les douves, sauf par les ponts', () => {
    const state = createGame(FORTERESSE, { seed: 1, siegeDays: 10 });
    const inside = state.units.find((u) => u.owner === 'koush')!;
    // Depuis l'intérieur, on peut sortir (au moins jusqu'au pont nord en plusieurs tours).
    expect(reachableTiles(state, inside.id).length).toBeGreaterThan(1);
    const t = (x: number, y: number) => state.map.tiles[y * state.map.width + x];
    expect([t(9, 2), t(9, 3), t(10, 10), t(10, 11)]).toEqual(['pont', 'plaine', 'plaine', 'pont']);
    expect([t(4, 3), t(15, 10)]).toEqual(['tour', 'tour']);
  });

  it('une vague arrive au tour de l’assaillant tous les 3 jours, de plus en plus lourde', () => {
    expect(waveUnits(1)).toEqual(['fantassin', 'fantassin', 'lancier']);
    expect(waveUnits(3)).toContain('char');
    let state = createGame(FORTERESSE, { seed: 1, siegeDays: 10 });
    const before = state.units.filter((u) => u.owner === 'carthage').length;
    let waves = 0;
    while (state.day <= 3) {
      const { state: next, events } = endTurn(state);
      waves += events.filter((e) => e.type === 'reinforcements').length;
      state = next;
    }
    expect(waves).toBe(1);
    expect(state.units.filter((u) => u.owner === 'carthage').length).toBe(before + 3);
  });

  it('le défenseur gagne quand il a tenu jusqu’au dernier jour', () => {
    const state = createGame(FORTERESSE, { seed: 1, siegeDays: 3 });
    let last = endTurn(state);
    while (last.state.status === 'playing') last = endTurn(last.state);
    expect(last.events).toContainEqual({
      type: 'playerDefeated',
      player: 'carthage',
      reason: 'siege',
    });
    expect(last.state.winner).toBe('koush');
    expect(last.state.day).toBe(4);
  });

  it('les peuples choisis prennent les rôles de la carte', () => {
    const map = assignPeoples(FORTERESSE, ['ashanti', 'almoravides']);
    const state = createGame(map, { seed: 1, siegeDays: 10 });
    expect(state.siege?.defender).toBe('ashanti');
  });

  it('l’IA joue l’assaut plusieurs jours sans action illégale', () => {
    let state = createGame(FORTERESSE, { seed: 2, siegeDays: SIEGE_DAYS.facile });
    for (let i = 0; i < 600 && state.status === 'playing' && state.day <= 7; i++) {
      const result = applyAction(state, chooseGreedyAction(state));
      if (!result.ok) throw new Error(result.error.code);
      state = result.state;
    }
    expect(state.day).toBeGreaterThan(4);
  });
});
