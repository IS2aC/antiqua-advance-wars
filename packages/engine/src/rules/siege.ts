import { UNITS } from '../data/units';
import type { Draft } from '../model/draft';
import { actionError, type ActionError } from '../model/errors';
import type { GameEvent, GameState, Position, Unit } from '../model/types';
import { maxRangeFrom } from './combat';
import { distance, inBounds, terrainOf } from './grid';

/** Solidité d'un rempart intact ; une catapulte en retire 35 par tir (brèche au 3ᵉ). */
export const WALL_HP = 100;
export const WALL_DAMAGE = 35;

const key = (p: Position) => `${p.x},${p.y}`;

/** Solidité restante d'un rempart. */
export function wallHp(state: GameState, at: Position): number {
  return state.walls?.[key(at)] ?? WALL_HP;
}

/** Seule la catapulte abat les remparts : à portée, sans avoir bougé ce tour. */
export function wallFireError(state: GameState, unit: Unit, at: Position): ActionError | null {
  if (unit.type !== 'catapulte') {
    return actionError(
      'CANNOT_BREACH',
      `${UNITS[unit.type].name} : seule la catapulte abat un rempart.`,
    );
  }
  if (!inBounds(state.map, at.x, at.y) || terrainOf(state.map, at) !== 'rempart') {
    return actionError('CANNOT_BREACH', 'Il n’y a pas de rempart sur cette case.');
  }
  if (unit.hasMoved) {
    return actionError(
      'CANNOT_FIRE_AFTER_MOVING',
      'Une unité à distance ne tire pas après avoir bougé.',
    );
  }
  const gap = distance(unit, at);
  if (gap < UNITS[unit.type].minRange || gap > maxRangeFrom(state, unit.type, unit)) {
    return actionError('TARGET_OUT_OF_RANGE', 'Rempart hors de portée.');
  }
  return null;
}

/** Remparts que l'unité peut viser d'où elle est. */
export function wallsInRange(state: GameState, unit: Unit): Position[] {
  const walls: Position[] = [];
  state.map.tiles.forEach((terrain, index) => {
    if (terrain !== 'rempart') return;
    const at = { x: index % state.map.width, y: Math.floor(index / state.map.width) };
    if (!wallFireError(state, unit, at)) walls.push(at);
  });
  return walls;
}

/**
 * Tir sur le rempart : il perd de la solidité ; à zéro, la case devient une brèche
 * (la carte est remplacée par une copie modifiée, jamais modifiée sur place).
 */
export function resolveWallFire(draft: Draft, events: GameEvent[], unit: Unit, at: Position): void {
  const hp = Math.max(0, wallHp(draft, at) - WALL_DAMAGE);
  const shooter = draft.units.find((u) => u.id === unit.id);
  if (shooter) shooter.hasActed = true;
  if (hp > 0) {
    draft.walls = { ...(draft.walls ?? {}), [key(at)]: hp };
    events.push({ type: 'wallDamaged', unitId: unit.id, x: at.x, y: at.y, hp });
    return;
  }
  const rest = { ...(draft.walls ?? {}) };
  delete rest[key(at)];
  draft.walls = rest;
  const tiles = [...draft.map.tiles];
  tiles[at.y * draft.map.width + at.x] = 'breche';
  draft.map = { ...draft.map, tiles };
  events.push({ type: 'wallDamaged', unitId: unit.id, x: at.x, y: at.y, hp: 0 });
  events.push({ type: 'wallBreached', x: at.x, y: at.y });
}
