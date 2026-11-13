import { UNITS, isIndirect } from './data/units';
import { cloneState, draftUnit, type Draft } from './model/draft';
import { actionError, type ActionError, type ActionErrorCode } from './model/errors';
import type { Action, GameEvent, GameState, Unit } from './model/types';
import { resetCaptureAt, resolveCapture } from './rules/capture';
import { isInRange, resolveAttack } from './rules/combat';
import { buildError, resolveBuild } from './rules/economy';
import { buildingAt, findUnit, inBounds, samePosition, unitAt } from './rules/grid';
import { findPath } from './rules/movement';
import { endTurn } from './rules/turn';
import { checkGameOver, checkRout } from './rules/victory';

export type ActionResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: ActionError };

type MoveAction = Extract<Action, { type: 'MOVE' }>;
type AttackAction = Extract<Action, { type: 'ATTACK' }>;
type BuildAction = Extract<Action, { type: 'BUILD' }>;

function failure(code: ActionErrorCode, message: string): ActionResult {
  return { ok: false, error: actionError(code, message) };
}

function success(draft: Draft, events: GameEvent[]): ActionResult {
  return { ok: true, state: draft, events };
}

/** Unité du joueur courant qui n'a pas encore agi ce tour. */
function commandableUnit(state: GameState, unitId: number): Unit | ActionResult {
  const unit = findUnit(state, unitId);
  if (!unit) return failure('UNIT_NOT_FOUND', `Unité ${unitId} introuvable.`);
  if (unit.owner !== state.currentPlayer) {
    return failure('NOT_YOUR_UNIT', "Cette unité n'appartient pas au joueur dont c'est le tour.");
  }
  if (unit.hasActed) return failure('UNIT_ALREADY_ACTED', 'Cette unité a déjà agi ce tour.');
  return unit;
}

function isResult(value: Unit | ActionResult): value is ActionResult {
  return 'ok' in value;
}

function move(state: GameState, action: MoveAction): ActionResult {
  const unit = commandableUnit(state, action.unitId);
  if (isResult(unit)) return unit;
  if (unit.hasMoved) return failure('UNIT_ALREADY_MOVED', 'Cette unité a déjà bougé ce tour.');
  const { to } = action;
  if (!inBounds(state.map, to.x, to.y)) return failure('OUT_OF_BOUNDS', 'Case hors de la carte.');
  if (samePosition(to, unit)) {
    return failure('NO_MOVEMENT', "L'unité est déjà sur cette case : utiliser une action.");
  }
  if (unitAt(state, to.x, to.y)) return failure('TILE_OCCUPIED', 'La case est occupée.');
  const path = findPath(state, unit.id, to);
  if (!path) return failure('UNREACHABLE', 'Case hors de portée de déplacement.');

  const draft = cloneState(state);
  const events: GameEvent[] = [];
  const mover = draftUnit(draft, unit.id);
  mover.x = to.x;
  mover.y = to.y;
  mover.hasMoved = true;
  events.push({ type: 'unitMoved', unitId: unit.id, path });
  resetCaptureAt(draft, events, unit.x, unit.y);
  return success(draft, events);
}

function attack(state: GameState, action: AttackAction): ActionResult {
  const unit = commandableUnit(state, action.unitId);
  if (isResult(unit)) return unit;
  const target = findUnit(state, action.targetId);
  if (!target) return failure('TARGET_NOT_FOUND', `Cible ${action.targetId} introuvable.`);
  if (target.owner === unit.owner) return failure('NOT_AN_ENEMY', 'Impossible de viser un allié.');
  if (isIndirect(unit.type) && unit.hasMoved) {
    return failure(
      'CANNOT_FIRE_AFTER_MOVING',
      'Une unité à distance ne tire pas après avoir bougé.',
    );
  }
  if (!isInRange(unit.type, unit, target)) {
    return failure('TARGET_OUT_OF_RANGE', 'Cible hors de portée.');
  }

  const draft = cloneState(state);
  const events: GameEvent[] = [];
  const attacker = draftUnit(draft, unit.id);
  attacker.hasActed = true;
  resolveAttack(draft, events, attacker, draftUnit(draft, target.id));
  checkRout(draft, events);
  checkGameOver(draft, events);
  return success(draft, events);
}

function capture(state: GameState, unitId: number): ActionResult {
  const unit = commandableUnit(state, unitId);
  if (isResult(unit)) return unit;
  if (!UNITS[unit.type].canCapture) {
    return failure('CANNOT_CAPTURE', `${UNITS[unit.type].name} : cette unité ne capture pas.`);
  }
  const building = buildingAt(state, unit.x, unit.y);
  if (!building) return failure('NOT_A_BUILDING', "Il n'y a pas de bâtiment sur cette case.");
  if (building.owner === unit.owner)
    return failure('ALREADY_OWNED', 'Ce bâtiment est déjà à vous.');

  const draft = cloneState(state);
  const events: GameEvent[] = [];
  const capturer = draftUnit(draft, unit.id);
  capturer.hasActed = true;
  const target = draft.buildings.find((b) => samePosition(b, unit));
  if (target) resolveCapture(draft, events, capturer, target);
  checkGameOver(draft, events);
  return success(draft, events);
}

function wait(state: GameState, unitId: number): ActionResult {
  const unit = commandableUnit(state, unitId);
  if (isResult(unit)) return unit;
  const draft = cloneState(state);
  draftUnit(draft, unit.id).hasActed = true;
  return success(draft, [{ type: 'unitWaited', unitId: unit.id }]);
}

function build(state: GameState, action: BuildAction): ActionResult {
  const error = buildError(state, action.x, action.y, action.unitType);
  if (error) return { ok: false, error };
  const draft = cloneState(state);
  const events: GameEvent[] = [];
  resolveBuild(draft, events, action.x, action.y, action.unitType);
  return success(draft, events);
}

function finishTurn(state: GameState): ActionResult {
  const draft = cloneState(state);
  const events: GameEvent[] = [];
  endTurn(draft, events);
  checkRout(draft, events);
  checkGameOver(draft, events);
  return success(draft, events);
}

/**
 * Point d'entrée unique du moteur : applique une action et renvoie le nouvel état
 * et les événements à jouer, ou une erreur typée si l'action est illégale.
 * L'état reçu n'est jamais modifié.
 */
export function applyAction(state: GameState, action: Action): ActionResult {
  if (state.status === 'finished') return failure('GAME_OVER', 'La partie est terminée.');
  switch (action.type) {
    case 'MOVE':
      return move(state, action);
    case 'ATTACK':
      return attack(state, action);
    case 'CAPTURE':
      return capture(state, action.unitId);
    case 'WAIT':
      return wait(state, action.unitId);
    case 'BUILD':
      return build(state, action);
    case 'END_TURN':
      return finishTurn(state);
    default: {
      const unknown: { type?: unknown } = action;
      return failure('UNKNOWN_ACTION', `Action inconnue : ${String(unknown.type)}.`);
    }
  }
}
