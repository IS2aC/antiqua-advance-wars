import { movementCost } from '../data/terrains';
import { UNITS } from '../data/units';
import type { Draft } from '../model/draft';
import { actionError, type ActionError } from '../model/errors';
import type { GameEvent, GameState, Position, Unit } from '../model/types';
import { resetCaptureAt } from './capture';
import { distance, findUnit, inBounds, terrainOf, unitAt } from './grid';
import { mergePath } from './merge';
import { findPath, reachableTiles, type ReachableTile } from './movement';

/** Places libres à bord (0 pour une unité qui ne transporte pas). */
export function freeSeats(transport: Unit): number {
  const spec = UNITS[transport.type].transport;
  return spec ? spec.capacity - (transport.cargo?.length ?? 0) : 0;
}

/**
 * Embarquement : une unité qui n'a pas encore bougé rejoint, sur sa case, un transport
 * allié qui a de la place et l'accepte. Elle a fini son tour.
 */
export function loadError(state: GameState, unit: Unit, transportId: number): ActionError | null {
  const transport = findUnit(state, transportId);
  if (!transport) return actionError('TARGET_NOT_FOUND', `Unité ${transportId} introuvable.`);
  const spec = UNITS[transport.type].transport;
  if (!spec || transport.owner !== unit.owner || transport.id === unit.id) {
    return actionError('CANNOT_LOAD', 'On n’embarque que dans un transport allié.');
  }
  if (!spec.carries.includes(unit.type)) {
    return actionError('CANNOT_LOAD', `${UNITS[unit.type].name} : ce transport ne la prend pas.`);
  }
  if (freeSeats(transport) <= 0) return actionError('CANNOT_LOAD', 'Le transport est plein.');
  if (unit.hasMoved) return actionError('UNIT_ALREADY_MOVED', 'Cette unité a déjà bougé ce tour.');
  if (!loadPath(state, unit, transport)) {
    return actionError('UNREACHABLE', 'Transport hors de portée de déplacement.');
  }
  return null;
}

/**
 * Chemin pour monter à bord : jusqu'à la case du transport si l'unité peut y aller (convoi,
 * bateau au port) ; sinon jusqu'à la case voisine la moins coûteuse, puis un pas sur l'eau.
 */
export function loadPath(state: GameState, unit: Unit, transport: Unit): Position[] | null {
  const terrain = terrainOf(state.map, transport);
  if (movementCost(terrain, UNITS[unit.type].moveType) !== null) {
    return mergePath(state, unit.id, transport);
  }
  let best: { tile: ReachableTile } | null = null;
  for (const tile of reachableTiles(state, unit.id)) {
    if (distance(tile, transport) !== 1) continue;
    if (!best || tile.cost < best.tile.cost) best = { tile };
  }
  if (!best) return null;
  const path = findPath(state, unit.id, best.tile) ?? [unit];
  return [...path, { x: transport.x, y: transport.y }];
}

export function canLoad(state: GameState, unitId: number, transportId: number): boolean {
  const unit = findUnit(state, unitId);
  return unit !== undefined && loadError(state, unit, transportId) === null;
}

export function resolveLoad(
  draft: Draft,
  events: GameEvent[],
  state: GameState,
  unit: Unit,
  transport: Unit,
): void {
  const path = loadPath(state, unit, transport) ?? [unit, transport];
  events.push({ type: 'unitMoved', unitId: unit.id, path });
  resetCaptureAt(draft, events, unit.x, unit.y);
  draft.units = draft.units.filter((u) => u.id !== unit.id);
  const carrier = draft.units.find((u) => u.id === transport.id);
  if (carrier) {
    const passenger: Unit = {
      ...unit,
      x: transport.x,
      y: transport.y,
      hasMoved: true,
      hasActed: true,
    };
    carrier.cargo = [...(carrier.cargo ?? []), passenger];
  }
  events.push({ type: 'unitLoaded', unitId: unit.id, transportId: transport.id });
}

/** Cases voisines libres où l'unité à bord peut être déposée (terrain praticable pour elle). */
export function unloadTiles(state: GameState, transportId: number, unitId: number): Position[] {
  const transport = findUnit(state, transportId);
  const passenger = transport?.cargo?.find((u) => u.id === unitId);
  if (!transport || !passenger) return [];
  const tiles: Position[] = [];
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const) {
    const x = transport.x + dx;
    const y = transport.y + dy;
    if (!inBounds(state.map, x, y) || unitAt(state, x, y)) continue;
    if (movementCost(terrainOf(state.map, { x, y }), UNITS[passenger.type].moveType) === null)
      continue;
    tiles.push({ x, y });
  }
  return tiles;
}

/**
 * Débarquement : le transport (qui n'a pas encore agi) dépose une unité à bord sur une case
 * voisine. Il ne peut plus bouger ensuite, mais peut encore débarquer ou attendre ; l'unité
 * déposée a fini son tour.
 */
export function unloadError(
  state: GameState,
  transport: Unit,
  unitId: number,
  to: Position,
): ActionError | null {
  if (!transport.cargo?.some((u) => u.id === unitId)) {
    return actionError('CANNOT_UNLOAD', 'Cette unité n’est pas à bord.');
  }
  if (
    distance(transport, to) !== 1 ||
    !unloadTiles(state, transport.id, unitId).some((t) => t.x === to.x && t.y === to.y)
  ) {
    return actionError('CANNOT_UNLOAD', 'On débarque sur une case voisine, libre et praticable.');
  }
  return null;
}

export function resolveUnload(
  draft: Draft,
  events: GameEvent[],
  transport: Unit,
  unitId: number,
  to: Position,
): void {
  const carrier = draft.units.find((u) => u.id === transport.id);
  const passenger = carrier?.cargo?.find((u) => u.id === unitId);
  if (!carrier || !passenger) return;
  carrier.cargo = (carrier.cargo ?? []).filter((u) => u.id !== unitId);
  if (carrier.cargo.length === 0) delete carrier.cargo;
  carrier.hasMoved = true;
  draft.units.push({ ...passenger, x: to.x, y: to.y, hasMoved: true, hasActed: true });
  events.push({
    type: 'unitUnloaded',
    unitId,
    transportId: transport.id,
    from: { x: transport.x, y: transport.y },
    to: { x: to.x, y: to.y },
  });
}
