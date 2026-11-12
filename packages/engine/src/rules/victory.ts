import type { Draft } from '../model/draft';
import type { DefeatReason, GameEvent, PlayerId } from '../model/types';

/** Victoire par déroute possible à partir de ce jour (docs/game-design.md). */
export const ROUT_FROM_DAY = 2;

/**
 * Marque un joueur comme vaincu. Au Stage 1 (2 joueurs), la partie s'arrête aussitôt ;
 * le retrait des unités d'un joueur vaincu viendra avec les parties à 3 ou 4.
 */
export function defeatPlayer(
  draft: Draft,
  events: GameEvent[],
  playerId: PlayerId,
  reason: DefeatReason,
): void {
  const player = draft.players.find((candidate) => candidate.id === playerId);
  if (!player || player.defeated) return;
  player.defeated = true;
  events.push({ type: 'playerDefeated', player: playerId, reason });
}

/** Un joueur sans aucune unité à partir du jour 2 est vaincu. */
export function checkRout(draft: Draft, events: GameEvent[]): void {
  if (draft.day < ROUT_FROM_DAY) return;
  for (const player of draft.players) {
    if (player.defeated) continue;
    if (!draft.units.some((unit) => unit.owner === player.id)) {
      defeatPlayer(draft, events, player.id, 'rout');
    }
  }
}

/** Termine la partie quand il ne reste qu'un joueur (ou aucun). */
export function checkGameOver(draft: Draft, events: GameEvent[]): void {
  if (draft.status === 'finished') return;
  const alive = draft.players.filter((player) => !player.defeated);
  if (alive.length > 1) return;
  draft.status = 'finished';
  draft.winner = alive[0]?.id ?? null;
  events.push({ type: 'gameOver', winner: draft.winner });
}
