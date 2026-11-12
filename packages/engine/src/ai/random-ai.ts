import { UNITS, UNIT_TYPES, isIndirect } from '../data/units';
import type { Action, GameState, Position, Unit } from '../model/types';
import { mulberry32 } from '../rng';
import { canCapture } from '../rules/capture';
import { targetsInRange } from '../rules/combat';
import { distance, unitAt } from '../rules/grid';
import { reachableTiles } from '../rules/movement';

/**
 * Joueur aléatoire « orienté objectif », utilisé par le match en ligne de commande et
 * les tests. Ce n'est pas l'IA du jeu (étape 6) : il doit seulement produire des
 * actions légales variées et finir des parties. Sa graine est séparée de celle de l'état.
 */
export interface AgentDecision {
  readonly action: Action;
  readonly seed: number;
}

interface Random {
  next(): number;
  pick<T>(items: readonly T[]): T | undefined;
}

function objectivesFor(state: GameState, unit: Unit, random: Random): Position[] {
  const enemies = state.units.filter((other) => other.owner !== unit.owner);
  if (!UNITS[unit.type].canCapture) return enemies;
  // Les unités de capture visent les bâtiments à prendre ; une fois sur deux, le QG adverse.
  const buildings = state.buildings.filter((building) => {
    const occupant = unitAt(state, building.x, building.y);
    const blocked =
      occupant !== undefined && occupant.owner === unit.owner && occupant.id !== unit.id;
    return building.owner !== unit.owner && !blocked;
  });
  const headquarters = buildings.filter((building) => building.type === 'qg');
  if (headquarters.length > 0 && random.next() < 0.5) return headquarters;
  return buildings.length > 0 ? buildings : enemies;
}

function closestTo<T extends Position>(
  tiles: readonly T[],
  objectives: readonly Position[],
): T | undefined {
  let best: T | undefined;
  let bestGap = Infinity;
  for (const tile of tiles) {
    const gap = Math.min(...objectives.map((objective) => distance(tile, objective)));
    if (gap < bestGap) {
      best = tile;
      bestGap = gap;
    }
  }
  return best;
}

function commandUnit(state: GameState, unit: Unit, random: Random): Action {
  const targets = targetsInRange(state, unit.id);
  const capturable = canCapture(state, unit.id);
  const holdPosition = capturable || (isIndirect(unit.type) && targets.length > 0);

  if (!unit.hasMoved && !holdPosition && random.next() < 0.9) {
    const tiles = reachableTiles(state, unit.id).filter((tile) => tile.cost > 0);
    const objectives = objectivesFor(state, unit, random);
    const destination =
      objectives.length > 0 && random.next() < 0.75
        ? closestTo(tiles, objectives)
        : random.pick(tiles);
    if (destination) {
      return { type: 'MOVE', unitId: unit.id, to: { x: destination.x, y: destination.y } };
    }
  }

  if (capturable) return { type: 'CAPTURE', unitId: unit.id };
  const target = random.pick(targets);
  if (target) return { type: 'ATTACK', unitId: unit.id, targetId: target.id };
  return { type: 'WAIT', unitId: unit.id };
}

function chooseBuild(state: GameState, random: Random): Action | null {
  const me = state.currentPlayer;
  const funds = state.players.find((player) => player.id === me)?.funds ?? 0;
  const barracks = state.buildings.filter(
    (building) =>
      building.type === 'caserne' &&
      building.owner === me &&
      !unitAt(state, building.x, building.y),
  );
  for (const building of barracks) {
    const affordable = UNIT_TYPES.filter((type) => UNITS[type].cost <= funds);
    const unitType = random.pick(affordable);
    if (unitType && random.next() < 0.85) {
      return { type: 'BUILD', x: building.x, y: building.y, unitType };
    }
  }
  return null;
}

/** Choisit la prochaine action légale du joueur courant. */
export function chooseRandomAction(state: GameState, seed: number): AgentDecision {
  let current = seed;
  const random: Random = {
    next() {
      const draw = mulberry32(current);
      current = draw.seed;
      return draw.value;
    },
    pick(items) {
      return items.length === 0 ? undefined : items[Math.floor(this.next() * items.length)];
    },
  };

  const ready = state.units.find((unit) => unit.owner === state.currentPlayer && !unit.hasActed);
  const action: Action = ready
    ? commandUnit(state, ready, random)
    : (chooseBuild(state, random) ?? { type: 'END_TURN' });
  return { action, seed: current };
}
