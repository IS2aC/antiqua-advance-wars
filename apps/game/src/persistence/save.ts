import type { GameState } from '@antiqua/engine';

/**
 * Sauvegarde locale (localStorage), écrite automatiquement à chaque fin de tour.
 * L'état du moteur est un simple objet JSON : on l'enregistre tel quel. Toute lecture ou
 * écriture peut échouer (navigation privée, stockage plein ou bloqué) : on l'ignore et
 * le jeu continue sans sauvegarde.
 */

const KEY = 'antiqua:sauvegarde';
const VERSION = 1;

export interface SaveFile {
  readonly version: number;
  readonly savedAt: string;
  readonly state: GameState;
}

/** Vérification de forme minimale : une sauvegarde abîmée ou d'une autre version est ignorée. */
function isGameState(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Partial<GameState>;
  return (
    typeof state.day === 'number' &&
    typeof state.currentPlayer === 'string' &&
    typeof state.rngSeed === 'number' &&
    state.status === 'playing' &&
    Array.isArray(state.units) &&
    Array.isArray(state.buildings) &&
    Array.isArray(state.players) &&
    typeof state.map === 'object' &&
    state.map !== null &&
    Array.isArray(state.map.tiles) &&
    state.map.tiles.length === state.map.width * state.map.height
  );
}

export function saveGame(state: GameState): boolean {
  try {
    const file: SaveFile = { version: VERSION, savedAt: new Date().toISOString(), state };
    localStorage.setItem(KEY, JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): SaveFile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const file = JSON.parse(raw) as Partial<SaveFile>;
    if (file.version !== VERSION || !isGameState(file.state)) return null;
    return { version: VERSION, savedAt: String(file.savedAt ?? ''), state: file.state };
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Stockage indisponible : rien à effacer.
  }
}
