import { describe, expect, it } from 'vitest';
import {
  GUE_DU_NIL,
  applyAction,
  chooseGreedyAction,
  chooseRandomAction,
  createGame,
  planTurn,
} from '../src/index';
import type { Action, GameState, PlayerId } from '../src/index';
import { C, K, act, deepFreeze, play, setup } from './helpers';

describe('IA gloutonne : choix d’une action', () => {
  it('attaque la cible qui rapporte le plus (la plus chère, ou détruite)', () => {
    const state = setup(['.....', '.....', '.....'], {
      units: [
        { type: 'char', owner: K, x: 2, y: 1 },
        { type: 'fantassin', owner: C, x: 1, y: 1 },
        { type: 'catapulte', owner: C, x: 3, y: 1 },
      ],
    });
    const attack = planTurn(state).find((action) => action.type === 'ATTACK');
    expect(attack).toEqual({ type: 'ATTACK', unitId: 1, targetId: 3 });
  });

  it('se déplace puis attaque : le déplacement vient d’abord, l’attaque ensuite', () => {
    const state = setup(['......'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0 },
        { type: 'archers', owner: C, x: 3, y: 0, hp: 30 },
      ],
    });
    const move = chooseGreedyAction(state);
    expect(move).toEqual({ type: 'MOVE', unitId: 1, to: { x: 2, y: 0 } });
    const moved = act(state, move).state;
    expect(chooseGreedyAction(moved)).toEqual({ type: 'ATTACK', unitId: 1, targetId: 2 });
  });

  it('capture le bâtiment sur lequel elle se trouve', () => {
    const state = setup(['V....', '.....'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: C, x: 4, y: 1 },
      ],
    });
    expect(chooseGreedyAction(state)).toEqual({ type: 'CAPTURE', unitId: 1 });
  });

  it('va prendre le QG adverse quand la capture gagne la partie', () => {
    let state = setup(['Q..v..Q'], {
      owners: { '0,0': K, '6,0': C },
      units: [
        { type: 'fantassin', owner: K, x: 4, y: 0 },
        { type: 'fantassin', owner: C, x: 0, y: 0 },
      ],
    });
    // Le QG de Carthage est déjà à moitié pris.
    state = {
      ...state,
      buildings: state.buildings.map((b) => (b.x === 6 ? { ...b, capturePoints: 8 } : b)),
    };
    const actions = planTurn(state);
    expect(actions).toEqual([
      { type: 'MOVE', unitId: 1, to: { x: 6, y: 0 } },
      { type: 'CAPTURE', unitId: 1 },
    ]);
    const end = play(state, actions).state;
    expect(end.status).toBe('finished');
    expect(end.winner).toBe(K);
  });

  it('un tireur indirect tire sans bouger', () => {
    const state = setup(['......'], {
      units: [
        { type: 'catapulte', owner: K, x: 0, y: 0 },
        { type: 'lancier', owner: C, x: 3, y: 0 },
      ],
    });
    expect(chooseGreedyAction(state)).toEqual({ type: 'ATTACK', unitId: 1, targetId: 2 });
  });

  it('évite de s’arrêter à portée d’un ennemi qu’elle ne peut pas frapper', () => {
    // La catapulte adverse couvre les cases à distance 2–3 de (6, 0).
    const state = setup(['.......', '.......', '.......'], {
      units: [
        { type: 'archers', owner: K, x: 0, y: 2 },
        { type: 'catapulte', owner: C, x: 6, y: 0 },
      ],
    });
    const action = chooseGreedyAction(state);
    if (action.type !== 'MOVE') throw new Error(`Déplacement attendu, reçu ${action.type}`);
    const gap = Math.abs(action.to.x - 6) + Math.abs(action.to.y - 0);
    expect(gap < 2 || gap > 3).toBe(true);
  });

  it('libère sa caserne pour pouvoir produire', () => {
    const state = setup(['C....', '.....'], {
      owners: { '0,0': K },
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: C, x: 4, y: 1 },
      ],
    });
    const action = chooseGreedyAction(state);
    expect(action.type).toBe('MOVE');
  });

  it('ne modifie jamais l’état reçu', () => {
    const state = deepFreeze(createGame(GUE_DU_NIL, { seed: 3 }));
    expect(() => planTurn(state)).not.toThrow();
  });
});

describe('IA gloutonne : production', () => {
  const barracks = ['C.....', '......'];

  it('produit des fantassins tant qu’il reste des bâtiments à prendre', () => {
    const state = setup(['C..v..', '......'], {
      owners: { '0,0': K },
      funds: 9000,
      units: [{ type: 'fantassin', owner: C, x: 5, y: 1 }],
    });
    expect(chooseGreedyAction(state)).toEqual({
      type: 'BUILD',
      x: 0,
      y: 0,
      unitType: 'fantassin',
    });
  });

  it('répond à la cavalerie adverse par des lanciers', () => {
    const state = setup(barracks, {
      owners: { '0,0': K },
      funds: 3000,
      units: [
        { type: 'fantassin', owner: K, x: 1, y: 1 },
        { type: 'fantassin', owner: K, x: 2, y: 1 },
        { type: 'fantassin', owner: K, x: 3, y: 1 },
        { type: 'fantassin', owner: K, x: 1, y: 0 },
        { type: 'cavalerie', owner: C, x: 5, y: 0 },
        { type: 'cavalerie', owner: C, x: 5, y: 1 },
      ],
    });
    // Les unités de Koush ont déjà joué : il ne reste que la production.
    const ready = {
      ...state,
      units: state.units.map((u) => (u.owner === K ? { ...u, hasMoved: true, hasActed: true } : u)),
    };
    expect(chooseGreedyAction(ready)).toEqual({
      type: 'BUILD',
      x: 0,
      y: 0,
      unitType: 'lancier',
    });
  });

  it('équilibre l’armée : une armée de fantassins se renforce en unités mobiles', () => {
    const state = setup(barracks, {
      owners: { '0,0': K },
      funds: 8000,
      units: [
        { type: 'fantassin', owner: K, x: 1, y: 1 },
        { type: 'fantassin', owner: K, x: 2, y: 1 },
        { type: 'fantassin', owner: K, x: 3, y: 1 },
        { type: 'fantassin', owner: K, x: 1, y: 0 },
        { type: 'fantassin', owner: C, x: 5, y: 1 },
      ],
    });
    const ready = {
      ...state,
      units: state.units.map((u) => (u.owner === K ? { ...u, hasMoved: true, hasActed: true } : u)),
    };
    expect(chooseGreedyAction(ready)).toEqual({ type: 'BUILD', x: 0, y: 0, unitType: 'char' });
  });

  it('finit le tour quand il n’y a plus rien à faire', () => {
    const state = setup(barracks, {
      owners: { '0,0': K },
      funds: 500,
      units: [{ type: 'fantassin', owner: C, x: 5, y: 1 }],
    });
    expect(chooseGreedyAction(state)).toEqual({ type: 'END_TURN' });
    expect(chooseGreedyAction({ ...state, status: 'finished' })).toEqual({ type: 'END_TURN' });
  });
});

type Agent = (state: GameState) => Action;

/** Joue une partie sur « Le Gué du Nil » ; échoue à la première action illégale. */
function match(koush: Agent, carthage: Agent, seed: number, maxDays: number): GameState {
  let state = createGame(GUE_DU_NIL, { seed });
  while (state.status === 'playing' && state.day <= maxDays) {
    const action = (state.currentPlayer === K ? koush : carthage)(state);
    const result = applyAction(state, action);
    if (!result.ok) {
      throw new Error(`Graine ${seed} : ${JSON.stringify(action)} → ${result.error.code}`);
    }
    state = result.state;
  }
  return state;
}

const greedy: Agent = (state) => chooseGreedyAction(state);
const passive: Agent = () => ({ type: 'END_TURN' });
function randomAgent(seed: number): Agent {
  let current = seed;
  return (state) => {
    const decision = chooseRandomAction(state, current);
    current = decision.seed;
    return decision.action;
  };
}

describe('IA gloutonne : parties simulées', () => {
  it('ne produit aucune action illégale sur 200 parties', () => {
    for (let seed = 1; seed <= 200; seed++) {
      // Début de partie contre le joueur aléatoire, de chaque côté à tour de rôle.
      const opponent = randomAgent(seed * 7919);
      const state =
        seed % 2 === 0 ? match(greedy, opponent, seed, 4) : match(opponent, greedy, seed, 4);
      expect(state.players.every((player) => player.stats.unitsBuilt > 0)).toBe(true);
    }
  }, 120_000);

  it.each<[PlayerId, number]>([
    [K, 1],
    [C, 2],
  ])('bat un joueur qui ne fait rien en moins de 20 jours (%s)', (side, seed) => {
    const state = side === K ? match(greedy, passive, seed, 20) : match(passive, greedy, seed, 20);
    expect(state.status).toBe('finished');
    expect(state.winner).toBe(side);
    expect(state.day).toBeLessThan(20);
  });

  it('bat le joueur aléatoire, des deux côtés', () => {
    const asKoush = match(greedy, randomAgent(11), 11, 40);
    const asCarthage = match(randomAgent(12), greedy, 12, 40);
    expect(asKoush.winner).toBe(K);
    expect(asCarthage.winner).toBe(C);
  }, 60_000);

  it('est déterministe : même état, même tour', () => {
    const state = createGame(GUE_DU_NIL, { seed: 5 });
    expect(planTurn(state)).toEqual(planTurn(state));
    expect(planTurn(state).at(-1)).toEqual({ type: 'END_TURN' });
  });
});
