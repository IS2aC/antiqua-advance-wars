/**
 * @antiqua/engine — moteur de règles d'ANTIQUA.
 * TypeScript pur : aucune dépendance graphique, aucun accès au DOM.
 *
 * Usage : `createGame(GUE_DU_NIL, { seed })`, puis `applyAction(state, action)`
 * renvoie le nouvel état et les événements à jouer, ou une erreur typée.
 */

export const ENGINE_VERSION = '0.1.0';

export type * from './model/types';
export type { ActionError, ActionErrorCode } from './model/errors';

export { UNITS, UNIT_TYPES, isIndirect, type UnitStats } from './data/units';
export { TERRAINS, movementCost, type TerrainStats } from './data/terrains';
export { BASE_DAMAGE } from './data/damage-table';
export { FACTIONS, type FactionInfo } from './data/factions';

export { mulberry32, randomInt, type RandomDraw } from './rng';
export {
  buildingAt,
  displayHp,
  distance,
  findUnit,
  inBounds,
  samePosition,
  terrainAt,
  unitAt,
} from './rules/grid';
export { findPath, reachableTiles, type ReachableTile } from './rules/movement';
export {
  MAX_LUCK,
  canCounter,
  computeDamage,
  forecast,
  isInRange,
  targetsInRange,
  threatTiles,
  type DamageRange,
  type Forecast,
} from './rules/combat';
export { CAPTURE_POINTS, canCapture } from './rules/capture';
export { buildError, incomeFor } from './rules/economy';
export { INCOME_FROM_DAY } from './rules/turn';
export { ROUT_FROM_DAY } from './rules/victory';

export { applyAction, type ActionResult } from './reducer';
export { createGame, type GameOptions } from './setup';

export { ASCII_LEGEND, parseAsciiMap, rotateRows, type ParsedAsciiMap } from './maps/ascii';
export { GUE_DU_NIL, GUE_DU_NIL_ROWS } from './maps/gue-du-nil';

export { chooseRandomAction, type AgentDecision } from './ai/random-ai';
