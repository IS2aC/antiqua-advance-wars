import { movementCost } from '../data/terrains';
import { UNITS } from '../data/units';
import type { GameState, Position, Unit } from '../model/types';
import { findUnit, inBounds, tileIndex } from './grid';

export interface ReachableTile {
  readonly x: number;
  readonly y: number;
  /** Points de mouvement dépensés pour atteindre la case. */
  readonly cost: number;
}

/** Ordre fixe des voisins : garantit des chemins déterministes. */
const DIRECTIONS: readonly Position[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

interface Exploration {
  readonly dist: readonly number[];
  readonly prev: readonly number[];
  readonly occupants: ReadonlyMap<number, Unit>;
}

/**
 * Dijkstra borné aux points de mouvement de l'unité.
 * Les alliés se traversent, les ennemis bloquent, les terrains infranchissables sont exclus.
 */
function explore(state: GameState, unit: Unit): Exploration {
  const { map } = state;
  const size = map.width * map.height;
  const { move, moveType } = UNITS[unit.type];
  const dist = new Array<number>(size).fill(Infinity);
  const prev = new Array<number>(size).fill(-1);
  const done = new Array<boolean>(size).fill(false);
  const occupants = new Map<number, Unit>();
  for (const other of state.units) occupants.set(tileIndex(map, other.x, other.y), other);

  dist[tileIndex(map, unit.x, unit.y)] = 0;

  for (;;) {
    let current = -1;
    let best = Infinity;
    for (let index = 0; index < size; index++) {
      const candidate = dist[index] ?? Infinity;
      if (!done[index] && candidate < best) {
        best = candidate;
        current = index;
      }
    }
    if (current === -1) break;
    done[current] = true;

    const cx = current % map.width;
    const cy = Math.floor(current / map.width);
    for (const direction of DIRECTIONS) {
      const nx = cx + direction.x;
      const ny = cy + direction.y;
      if (!inBounds(map, nx, ny)) continue;
      const next = tileIndex(map, nx, ny);
      const occupant = occupants.get(next);
      if (occupant && occupant.owner !== unit.owner) continue;
      const terrain = map.tiles[next];
      if (terrain === undefined) continue;
      const cost = movementCost(terrain, moveType);
      if (cost === null) continue;
      const total = best + cost;
      if (total <= move && total < (dist[next] ?? Infinity)) {
        dist[next] = total;
        prev[next] = current;
      }
    }
  }

  return { dist, prev, occupants };
}

function canStop(exploration: Exploration, index: number, unit: Unit): boolean {
  const occupant = exploration.occupants.get(index);
  return occupant === undefined || occupant.id === unit.id;
}

/** Cases où l'unité peut terminer son déplacement, case de départ comprise (coût 0). */
export function reachableTiles(state: GameState, unitId: number): ReachableTile[] {
  const unit = findUnit(state, unitId);
  if (!unit) return [];
  const exploration = explore(state, unit);
  const tiles: ReachableTile[] = [];
  exploration.dist.forEach((cost, index) => {
    if (cost === Infinity || !canStop(exploration, index, unit)) return;
    tiles.push({ x: index % state.map.width, y: Math.floor(index / state.map.width), cost });
  });
  return tiles;
}

/**
 * Chemin le moins coûteux, case par case, de la position de l'unité (incluse) jusqu'à `to`.
 * Renvoie `null` si la case n'est pas une destination légale.
 */
export function findPath(state: GameState, unitId: number, to: Position): Position[] | null {
  const unit = findUnit(state, unitId);
  if (!unit || !inBounds(state.map, to.x, to.y)) return null;
  const exploration = explore(state, unit);
  const target = tileIndex(state.map, to.x, to.y);
  if (exploration.dist[target] === Infinity || !canStop(exploration, target, unit)) return null;

  const path: Position[] = [];
  for (let index = target; index !== -1; index = exploration.prev[index] ?? -1) {
    path.unshift({ x: index % state.map.width, y: Math.floor(index / state.map.width) });
  }
  return path;
}
