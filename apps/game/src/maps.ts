import { CARREFOUR, COTE, GUE_DU_NIL, type GameState, type MapDefinition } from '@antiqua/engine';

/**
 * Cartes jouables, par identifiant d'URL (`jeu.html?mode=ia&carte=carrefour`) :
 * « Le Gué du Nil » (Koush contre Carthage), « Le Carrefour des Royaumes » (4 peuples) et
 * « La Côte des Comptoirs » (duel avec un bras de mer, ports et bateaux).
 */
export const MAPS = {
  'gue-du-nil': GUE_DU_NIL,
  carrefour: CARREFOUR,
  cote: COTE,
} as const satisfies Readonly<Record<string, MapDefinition>>;

export type MapId = keyof typeof MAPS;

export const DEFAULT_MAP: MapId = 'gue-du-nil';

const isMapId = (value: string): value is MapId => Object.hasOwn(MAPS, value);

/** Identifiant lu dans l'URL ; inconnu ou absent : la carte par défaut. */
export function mapFromParam(value: string | null): MapId {
  return value !== null && isMapId(value) ? value : DEFAULT_MAP;
}

/** Carte d'une partie en cours (retrouvée par son nom, gardé dans l'état et la sauvegarde). */
export function mapOfState(state: GameState): MapId {
  const found = (Object.keys(MAPS) as MapId[]).find((id) => MAPS[id].name === state.map.name);
  return found ?? DEFAULT_MAP;
}
