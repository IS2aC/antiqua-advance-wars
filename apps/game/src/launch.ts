import { FACTIONS, SIEGE_DAYS, type PlayerId, type SiegeDifficulty } from '@antiqua/engine';
import { clearSave, loadGame } from './persistence/save';
import { MAPS, mapFromParam, type MapId } from './maps';
import type { BattleData } from './scenes/BattleScene';

/**
 * Lancement depuis la page de garde : `jeu.html?mode=ia|deux|continuer&carte=…`.
 * - ia : nouvelle partie, le joueur commande le peuple choisi (`peuple=`, Koush par défaut),
 *   l'IA tous les autres ; sur une carte à 2 camps, `adversaire=` choisit le peuple de l'IA
 *   (n'importe lequel des 4 : la carte est réattribuée, le joueur prend le premier camp) ;
 * - deux : nouvelle partie à plusieurs sur le même écran (autant de joueurs que la carte) ;
 * - carte : identifiant de `maps.ts` (`gue-du-nil` par défaut, `carrefour` à 4 peuples) ;
 * - continuer : reprend la sauvegarde ; sans sauvegarde, nouvelle partie du mode `repli`.
 * Sans paramètre, le jeu affiche son propre écran titre.
 */
export type LaunchMode = 'ia' | 'deux' | 'continuer';

/** En partie contre l'IA, peuple du joueur quand l'URL n'en choisit pas. */
export const DEFAULT_HUMAN: PlayerId = 'koush';

/** Peuple choisi (`peuple=`), s'il joue sur cette carte ; sinon le premier de la carte. */
export function humanFromParam(value: string | null, map: MapId): PlayerId {
  const players = MAPS[map].players;
  const found = players.find((player) => player === value);
  return found ?? (players.includes(DEFAULT_HUMAN) ? DEFAULT_HUMAN : (players[0] ?? DEFAULT_HUMAN));
}

/** Camps joués par l'IA sur une carte : tous sauf celui du joueur. */
export const aiPlayersOf = (map: MapId, human: PlayerId = DEFAULT_HUMAN): PlayerId[] =>
  MAPS[map].players.filter((player) => player !== human);

const isPeople = (value: string | null): value is PlayerId =>
  value !== null && Object.hasOwn(FACTIONS, value);

/**
 * Duel contre l'IA avec deux peuples choisis (`peuple=` et `adversaire=`, différents) sur
 * une carte à 2 camps ; sinon null (les peuples de la carte).
 */
export function duelPeoples(map: MapId, params: URLSearchParams): [PlayerId, PlayerId] | null {
  const human = params.get('peuple');
  const rival = params.get('adversaire');
  if (MAPS[map].players.length !== 2 || !isPeople(human) || !isPeople(rival)) return null;
  return human === rival ? null : [human, rival];
}

/** Défense de forteresse : jours à tenir d'après `difficulte=` (normal par défaut). */
function siegeDaysOf(map: MapId, params: URLSearchParams): { siegeDays?: number } {
  if (!MAPS[map].siege) return {};
  const level = params.get('difficulte');
  const days =
    level !== null && Object.hasOwn(SIEGE_DAYS, level)
      ? SIEGE_DAYS[level as SiegeDifficulty]
      : SIEGE_DAYS.normal;
  return { siegeDays: days };
}

function newGame(mode: string | null, params: URLSearchParams): BattleData | null {
  const map = mapFromParam(params.get('carte'));
  if (mode === 'ia') {
    const duel = duelPeoples(map, params);
    if (duel) return { aiPlayers: [duel[1]], map, peoples: duel, ...siegeDaysOf(map, params) };
    return { aiPlayers: aiPlayersOf(map, humanFromParam(params.get('peuple'), map)), map };
  }
  if (mode === 'deux') return { map };
  return null;
}

export function battleFromUrl(search: string = window.location.search): BattleData | null {
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  if (mode === 'continuer') {
    const save = loadGame();
    if (save) return { state: save.state, aiPlayers: save.aiPlayers };
    return newGame(params.get('repli'), params);
  }
  const data = newGame(mode, params);
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
