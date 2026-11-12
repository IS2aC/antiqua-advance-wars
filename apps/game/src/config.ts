/** Taille d'une case en pixels logiques. Constante unique : ne jamais coder 32 en dur ailleurs. */
export const TILE_SIZE = 32;

/** Nombre de cases visibles à l'écran. */
export const VIEW_TILES_X = 20;
export const VIEW_TILES_Y = 12;

/** Résolution logique du jeu (640×384). */
export const LOGICAL_WIDTH = TILE_SIZE * VIEW_TILES_X;
export const LOGICAL_HEIGHT = TILE_SIZE * VIEW_TILES_Y;

export const BACKGROUND_COLOR = '#1a1410';

/**
 * Plus grand zoom ENTIER qui tient dans la fenêtre (minimum ×1).
 * Un zoom fractionnaire déformerait les pixels.
 */
export function integerZoom(availableWidth: number, availableHeight: number): number {
  const zoom = Math.floor(
    Math.min(availableWidth / LOGICAL_WIDTH, availableHeight / LOGICAL_HEIGHT),
  );
  return Math.max(1, zoom);
}

/** Durée d'un pas de déplacement, case par case (ms). */
export const MOVE_STEP_MS = 80;
