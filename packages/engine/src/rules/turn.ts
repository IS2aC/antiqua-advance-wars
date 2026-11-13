import type { Draft } from '../model/draft';
import type { GameEvent } from '../model/types';
import { collectIncome } from './economy';

/** Le revenu est versé au début de chaque tour, à partir du jour 2 (fin du tour 1 équitable). */
export const INCOME_FROM_DAY = 2;

/**
 * Fin de tour : les unités du joueur sortant redeviennent disponibles (elles s'affichent
 * normalement pendant le tour adverse), puis le joueur suivant non vaincu commence.
 * Le jour avance quand on revient au premier joueur de la liste.
 */
export function endTurn(draft: Draft, events: GameEvent[]): void {
  const ending = draft.currentPlayer;
  for (const unit of draft.units) {
    if (unit.owner !== ending) continue;
    unit.hasMoved = false;
    unit.hasActed = false;
  }
  events.push({ type: 'turnEnded', player: ending });

  const order = draft.players;
  const current = order.findIndex((player) => player.id === ending);
  for (let step = 1; step <= order.length; step++) {
    const index = (current + step) % order.length;
    const candidate = order[index];
    if (!candidate || candidate.defeated) continue;
    if (index <= current) draft.day += 1;
    draft.currentPlayer = candidate.id;
    break;
  }

  events.push({ type: 'turnStarted', player: draft.currentPlayer, day: draft.day });
  if (draft.day >= INCOME_FROM_DAY) collectIncome(draft, events);
}
