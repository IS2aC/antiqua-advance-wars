import { movementCost } from '../data/terrains';
import { UNITS } from '../data/units';
import type { Draft } from '../model/draft';
import type { GameEvent, UnitType } from '../model/types';
import { terrainOf, unitAt } from './grid';
import { defeatPlayer } from './victory';

/** Jours à tenir selon la difficulté. */
export const SIEGE_DAYS = { facile: 10, normal: 15, difficile: 20 } as const;
export type SiegeDifficulty = keyof typeof SIEGE_DAYS;

/** Une vague tous les 3 jours. */
export const WAVE_EVERY = 3;

/** Composition de la vague n (1, 2, 3…) : de plus en plus lourde. */
export function waveUnits(wave: number): UnitType[] {
  const units: UnitType[] = ['fantassin', 'fantassin', 'lancier'];
  if (wave >= 2) units.push('archers', 'catapulte');
  if (wave >= 3) units.push('char', 'cavalerie');
  if (wave >= 4) units.push('lancier', 'catapulte');
  if (wave >= 5) units.push('char', 'char');
  return units;
}

/**
 * Début de tour en défense de forteresse : le défenseur gagne quand le jour dépasse
 * `untilDay` ; au tour de l'assaillant, une vague arrive tous les 3 jours par les cases
 * d'entrée libres (une unité par case, terrain praticable pour elle).
 */
export function startSiegeTurn(draft: Draft, events: GameEvent[]): void {
  const siege = draft.siege;
  if (!siege || draft.status !== 'playing') return;
  if (draft.day > siege.untilDay) {
    for (const player of draft.players) {
      if (player.id !== siege.defender) defeatPlayer(draft, events, player.id, 'siege');
    }
    return;
  }
  const attacker = draft.currentPlayer;
  if (attacker === siege.defender || draft.day % WAVE_EVERY !== 0) return;
  const wave = draft.day / WAVE_EVERY;
  const free = siege.entries.filter((tile) => !unitAt(draft, tile.x, tile.y));
  const arrived: Draft['units'] = [];
  for (const type of waveUnits(wave)) {
    const index = free.findIndex(
      (tile) => movementCost(terrainOf(draft.map, tile), UNITS[type].moveType) !== null,
    );
    const tile = free[index];
    if (!tile) break;
    free.splice(index, 1);
    const unit = {
      id: draft.nextUnitId,
      type,
      owner: attacker,
      x: tile.x,
      y: tile.y,
      hp: 100,
      hasMoved: false,
      hasActed: false,
    };
    draft.nextUnitId += 1;
    draft.units.push(unit);
    arrived.push(unit);
  }
  if (arrived.length > 0) {
    events.push({
      type: 'reinforcements',
      player: attacker,
      wave,
      units: arrived.map((u) => ({ ...u })),
    });
  }
}
