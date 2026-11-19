import type { Draft } from '../model/draft';
import type { GameEvent } from '../model/types';
import { MAX_HP } from './merge';

/** PV internes rendus à chaque tour sur un village à soi (2 PV affichés). */
export const VILLAGE_HEAL = 20;

/**
 * Début de tour : chaque unité du joueur courant posée sur un village qui lui appartient
 * regagne 2 PV (plafond 10), gratuitement. Caserne et QG ne soignent pas.
 */
export function healOnVillages(draft: Draft, events: GameEvent[]): void {
  for (const unit of draft.units) {
    if (unit.owner !== draft.currentPlayer || unit.hp >= MAX_HP) continue;
    const village = draft.buildings.find(
      (b) => b.type === 'village' && b.x === unit.x && b.y === unit.y && b.owner === unit.owner,
    );
    if (!village) continue;
    unit.hp = Math.min(MAX_HP, unit.hp + VILLAGE_HEAL);
    events.push({ type: 'unitHealed', unitId: unit.id, x: unit.x, y: unit.y, hp: unit.hp });
  }
}
