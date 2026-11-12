import type { Building, GameMap, GameState, Position, TerrainType, Unit } from '../model/types';

export function inBounds(map: GameMap, x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < map.width &&
    y < map.height
  );
}

export function tileIndex(map: GameMap, x: number, y: number): number {
  return y * map.width + x;
}

export function terrainAt(map: GameMap, x: number, y: number): TerrainType | undefined {
  return inBounds(map, x, y) ? map.tiles[tileIndex(map, x, y)] : undefined;
}

/** Terrain d'une case qui doit exister (invariant interne). */
export function terrainOf(map: GameMap, position: Position): TerrainType {
  const terrain = terrainAt(map, position.x, position.y);
  if (terrain === undefined) {
    throw new Error(`Invariant violé : case (${position.x}, ${position.y}) hors de la carte.`);
  }
  return terrain;
}

export function unitAt(state: GameState, x: number, y: number): Unit | undefined {
  return state.units.find((unit) => unit.x === x && unit.y === y);
}

export function buildingAt(state: GameState, x: number, y: number): Building | undefined {
  return state.buildings.find((building) => building.x === x && building.y === y);
}

export function findUnit(state: GameState, unitId: number): Unit | undefined {
  return state.units.find((unit) => unit.id === unitId);
}

/** PV affichés (1 à 10) à partir des PV internes (1 à 100). */
export function displayHp(hp: number): number {
  return Math.ceil(hp / 10);
}

/** Distance de Manhattan entre deux cases. */
export function distance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}
