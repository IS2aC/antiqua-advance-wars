import type { PlayerId } from '@antiqua/engine';
import { clearSave, loadGame } from './persistence/save';
import type { BattleData } from './scenes/BattleScene';

/**
 * Lancement depuis la page de garde : `jeu.html?mode=ia|deux|continuer`.
 * - ia : nouvelle partie, le joueur commande Koush, l'IA Carthage ;
 * - deux : nouvelle partie à deux sur le même écran ;
 * - continuer : reprend la sauvegarde ; sans sauvegarde, nouvelle partie du mode `repli`.
 * Sans paramètre, le jeu affiche son propre écran titre.
 */
export type LaunchMode = 'ia' | 'deux' | 'continuer';

/** En partie contre l'IA, le joueur commande Koush et l'IA Carthage. */
export const AI_OPPONENT: PlayerId = 'carthage';

function newGame(mode: string | null): BattleData | null {
  if (mode === 'ia') return { aiPlayers: [AI_OPPONENT] };
  if (mode === 'deux') return {};
  return null;
}

export function battleFromUrl(search: string = window.location.search): BattleData | null {
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  if (mode === 'continuer') {
    const save = loadGame();
    if (save) return { state: save.state, aiPlayers: save.aiPlayers };
    return newGame(params.get('repli'));
  }
  const data = newGame(mode);
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
