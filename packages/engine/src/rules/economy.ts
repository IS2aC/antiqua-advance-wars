import { TERRAINS } from '../data/terrains';
import { UNITS } from '../data/units';
import { draftPlayer, type Draft } from '../model/draft';
import { actionError, type ActionError } from '../model/errors';
import type { GameEvent, GameState, PlayerId, UnitType } from '../model/types';
import { buildingAt, inBounds, unitAt } from './grid';

/** Revenu d'un joueur : somme des revenus des bâtiments qu'il possède. */
export function incomeFor(state: GameState, playerId: PlayerId): number {
  return state.buildings
    .filter((building) => building.owner === playerId)
    .reduce((total, building) => total + TERRAINS[building.type].income, 0);
}

/** Verse le revenu au joueur courant. */
export function collectIncome(draft: Draft, events: GameEvent[]): void {
  const player = draftPlayer(draft, draft.currentPlayer);
  const amount = incomeFor(draft, player.id);
  player.funds += amount;
  events.push({ type: 'fundsGained', player: player.id, amount, funds: player.funds });
}

/** Production : seulement depuis une caserne possédée et libre, avec assez d'or. */
export function buildError(
  state: GameState,
  x: number,
  y: number,
  unitType: UnitType,
): ActionError | null {
  if (!inBounds(state.map, x, y)) return actionError('OUT_OF_BOUNDS', 'Case hors de la carte.');
  const building = buildingAt(state, x, y);
  if (!building || building.type !== 'caserne') {
    return actionError('NOT_A_BARRACKS', 'Seule une caserne peut produire des unités.');
  }
  if (building.owner !== state.currentPlayer) {
    return actionError('NOT_YOUR_BUILDING', 'Cette caserne ne vous appartient pas.');
  }
  if (unitAt(state, x, y)) return actionError('TILE_OCCUPIED', 'La caserne est occupée.');
  const funds = state.players.find((player) => player.id === state.currentPlayer)?.funds ?? 0;
  if (funds < UNITS[unitType].cost) {
    return actionError('INSUFFICIENT_FUNDS', `Or insuffisant pour : ${UNITS[unitType].name}.`);
  }
  return null;
}

/** Crée l'unité ; elle ne peut ni bouger ni agir le tour de sa production. */
export function resolveBuild(
  draft: Draft,
  events: GameEvent[],
  x: number,
  y: number,
  unitType: UnitType,
): void {
  const player = draftPlayer(draft, draft.currentPlayer);
  const cost = UNITS[unitType].cost;
  const unit = {
    id: draft.nextUnitId,
    type: unitType,
    owner: player.id,
    x,
    y,
    hp: 100,
    hasMoved: true,
    hasActed: true,
  };
  draft.nextUnitId += 1;
  draft.units.push(unit);
  player.funds -= cost;
  player.stats.unitsBuilt += 1;
  events.push({ type: 'unitBuilt', unit: { ...unit }, cost });
}
