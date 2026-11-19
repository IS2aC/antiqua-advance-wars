import { UNITS } from '../data/units';
import type { Draft } from '../model/draft';
import { actionError, type ActionError } from '../model/errors';
import type { GameEvent, GameState, Position, Unit } from '../model/types';
import { resetCaptureAt } from './capture';
import { displayHp, findUnit } from './grid';
import { findPath } from './movement';

/** PV internes maximum d'une unité (10 PV affichés). */
export const MAX_HP = 100;

/**
 * Fusion : une unité rejoint une unité alliée du même type, blessée, en allant sur sa case.
 * Les PV s'additionnent (plafond 10 PV affichés) ; chaque PV affiché en trop rend 10 % du
 * prix de l'unité. L'unité qui reste (la rejointe) a fini son tour.
 */
export function mergeError(state: GameState, unit: Unit, targetId: number): ActionError | null {
  const target = findUnit(state, targetId);
  if (!target) return actionError('TARGET_NOT_FOUND', `Unité ${targetId} introuvable.`);
  if (target.id === unit.id)
    return actionError('CANNOT_MERGE', 'Une unité ne fusionne pas avec elle-même.');
  if (target.owner !== unit.owner) {
    return actionError('CANNOT_MERGE', 'On ne fusionne qu’avec une unité alliée.');
  }
  if (target.type !== unit.type) {
    return actionError('CANNOT_MERGE', 'On ne fusionne que deux unités du même type.');
  }
  if (unit.cargo?.length || target.cargo?.length) {
    return actionError('CANNOT_MERGE', 'Un transport chargé ne fusionne pas.');
  }
  if (target.hp >= MAX_HP) {
    return actionError('CANNOT_MERGE', 'L’unité rejointe a déjà tous ses PV.');
  }
  if (unit.hasMoved) {
    return actionError('UNIT_ALREADY_MOVED', 'Cette unité a déjà bougé ce tour.');
  }
  if (!mergePath(state, unit.id, target)) {
    return actionError('UNREACHABLE', 'Unité hors de portée de déplacement.');
  }
  return null;
}

/**
 * Chemin jusqu'à la case de l'unité rejointe : comme un déplacement, mais en s'arrêtant sur
 * un allié (la case est occupée). On cherche le chemin vers la case comme si elle était libre.
 */
export function mergePath(state: GameState, unitId: number, target: Unit): Position[] | null {
  const without = { ...state, units: state.units.filter((u) => u.id !== target.id) };
  return findPath(without, unitId, target);
}

/** Vrai si l'unité peut rejoindre cette unité alliée ce tour-ci. */
export function canMerge(state: GameState, unitId: number, targetId: number): boolean {
  const unit = findUnit(state, unitId);
  return unit !== undefined && mergeError(state, unit, targetId) === null;
}

/** PV et remboursement d'une fusion, d'après les PV affichés. */
export function mergeOutcome(
  unit: Pick<Unit, 'type' | 'hp'>,
  target: Pick<Unit, 'hp'>,
): { hp: number; refund: number } {
  const hp = Math.min(MAX_HP, unit.hp + target.hp);
  const excess = Math.max(0, displayHp(unit.hp) + displayHp(target.hp) - displayHp(MAX_HP));
  return { hp, refund: (excess * UNITS[unit.type].cost) / 10 };
}

/** Applique la fusion sur la copie de travail (après vérification par `mergeError`). */
export function resolveMerge(
  draft: Draft,
  events: GameEvent[],
  state: GameState,
  unit: Unit,
  target: Unit,
): void {
  const path = mergePath(state, unit.id, target) ?? [unit, target];
  const { hp, refund } = mergeOutcome(unit, target);
  events.push({ type: 'unitMoved', unitId: unit.id, path });
  resetCaptureAt(draft, events, unit.x, unit.y);
  draft.units = draft.units.filter((u) => u.id !== unit.id);
  const joined = draft.units.find((u) => u.id === target.id);
  if (joined) {
    joined.hp = hp;
    joined.hasMoved = true;
    joined.hasActed = true;
  }
  const player = draft.players.find((p) => p.id === unit.owner);
  if (player) player.funds += refund;
  events.push({
    type: 'unitsMerged',
    unitId: unit.id,
    targetId: target.id,
    hp,
    refund,
    funds: player?.funds ?? 0,
  });
}
