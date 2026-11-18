import { describe, expect, it } from 'vitest';
import {
  CARREFOUR,
  CARREFOUR_ROWS,
  applyAction,
  chooseGreedyAction,
  createGame,
  type GameState,
  type PlayerId,
} from '../src/index';
import { quarterTurnRows } from '../src/maps/ascii';

const PEOPLES: readonly PlayerId[] = ['koush', 'carthage', 'almoravides', 'ashanti'];

describe('cartes symétriques par quart de tour', () => {
  it('tourne le quart en haut à gauche dans les trois autres coins', () => {
    expect(quarterTurnRows(['ab', 'cd'])).toEqual(['abca', 'cddb', 'bddc', 'acba']);
  });

  it('rejette un quart qui n’est pas carré', () => {
    expect(() => quarterTurnRows(['abc', 'de'])).toThrow(/ligne 0/);
  });
});

describe('carte « Le Carrefour des Royaumes »', () => {
  it('fait 20×20 cases et reste identique tournée d’un quart de tour', () => {
    expect(CARREFOUR.width).toBe(20);
    expect(CARREFOUR.height).toBe(20);
    const size = CARREFOUR_ROWS.length;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        expect(CARREFOUR_ROWS[x]?.[size - 1 - y]).toBe(CARREFOUR_ROWS[y]?.[x]);
      }
    }
  });

  it('donne à chaque peuple 1 QG, 2 casernes, 2 villages, et laisse 8 villages neutres', () => {
    for (const people of PEOPLES) {
      const owned = CARREFOUR.buildings.filter((building) => building.owner === people);
      expect(owned.map((building) => building.type).sort()).toEqual([
        'caserne',
        'caserne',
        'qg',
        'village',
        'village',
      ]);
    }
    expect(CARREFOUR.buildings.filter((building) => building.owner === null)).toHaveLength(8);
  });

  it('place un QG par coin, dans l’ordre du jeu', () => {
    const hq = (people: PlayerId) =>
      CARREFOUR.buildings.find((building) => building.type === 'qg' && building.owner === people);
    expect(hq('koush')).toMatchObject({ x: 2, y: 2 });
    expect(hq('carthage')).toMatchObject({ x: 17, y: 2 });
    expect(hq('almoravides')).toMatchObject({ x: 17, y: 17 });
    expect(hq('ashanti')).toMatchObject({ x: 2, y: 17 });
  });

  it('démarre avec 4 joueurs, 2 fantassins chacun, Koush en premier', () => {
    const state = createGame(CARREFOUR, { seed: 1 });
    expect(state.players.map((player) => player.id)).toEqual(PEOPLES);
    expect(state.currentPlayer).toBe('koush');
    for (const people of PEOPLES) {
      expect(state.units.filter((unit) => unit.owner === people)).toHaveLength(2);
    }
  });

  it('se joue à 4 IA sans action illégale, et le tour passe par chaque peuple', () => {
    let state: GameState = createGame(CARREFOUR, { seed: 7 });
    const seen = new Set<PlayerId>();
    while (state.status === 'playing' && state.day <= 25) {
      seen.add(state.currentPlayer);
      const action = chooseGreedyAction(state);
      const result = applyAction(state, action);
      if (!result.ok) throw new Error(`${JSON.stringify(action)} → ${result.error.code}`);
      state = result.state;
    }
    expect([...seen].sort()).toEqual([...PEOPLES].sort());
    // Les villages neutres sont disputés.
    expect(state.buildings.filter((building) => building.owner === null).length).toBeLessThan(8);
  }, 60_000);
});
