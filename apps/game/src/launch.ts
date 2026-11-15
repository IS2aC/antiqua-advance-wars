import type { PlayerId } from '@antiqua/engine';
import { clearSave, loadGame } from './persistence/save';
import { MAPS, mapFromParam, type MapId } from './maps';
import type { BattleData } from './scenes/BattleScene';

/**
 * Lancement depuis la page de garde : `jeu.html?mode=ia|deux|continuer&carte=…`.
 * - ia : nouvelle partie, le joueur commande Koush, l'IA tous les autres peuples ;
 * - deux : nouvelle partie à plusieurs sur le même écran (autant de joueurs que la carte) ;
 * - carte : identifiant de `maps.ts` (`gue-du-nil` par défaut, `carrefour` à 4 peuples) ;
 * - continuer : reprend la sauvegarde ; sans sauvegarde, nouvelle partie du mode `repli`.
 * Sans paramètre, le jeu affiche son propre écran titre.
 */
export type LaunchMode = 'ia' | 'deux' | 'continuer';

/** En partie contre l'IA, le joueur commande Koush. */
export const HUMAN_PLAYER: PlayerId = 'koush';

/** Camps joués par l'IA sur une carte : tous sauf Koush. */
export const aiPlayersOf = (map: MapId): PlayerId[] =>
  MAPS[map].players.filter((player) => player !== HUMAN_PLAYER);

function newGame(mode: string | null, map: MapId): BattleData | null {
  if (mode === 'ia') return { aiPlayers: aiPlayersOf(map), map };
  if (mode === 'deux') return { map };
  return null;
}

export function battleFromUrl(search: string = window.location.search): BattleData | null {
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  if (mode === 'continuer') {
    const save = loadGame();
    if (save) return { state: save.state, aiPlayers: save.aiPlayers };
    return newGame(params.get('repli'), mapFromParam(params.get('carte')));
  }
  const data = newGame(mode, mapFromParam(params.get('carte')));
  if (data) {
    // Nouvelle partie : l'ancienne sauvegarde est abandonnée.
    clearSave();
    // Recharger la page reprend la partie (sauvegardée à chaque fin de tour) au lieu
    // d'en recommencer une.
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'continuer');
    url.searchParams.set('repli', mode ?? 'ia');
    window.history.replaceState(null, '', url);
  }
  return data;
}

/** Retour à la page de garde. */
export function goToCover(): void {
  window.location.assign('./');
}
