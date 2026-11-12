/** Erreurs typées renvoyées pour toute action illégale (jamais d'exception). */
export type ActionErrorCode =
  | 'GAME_OVER'
  | 'UNKNOWN_ACTION'
  | 'UNIT_NOT_FOUND'
  | 'NOT_YOUR_UNIT'
  | 'UNIT_ALREADY_MOVED'
  | 'UNIT_ALREADY_ACTED'
  | 'OUT_OF_BOUNDS'
  | 'NO_MOVEMENT'
  | 'TILE_OCCUPIED'
  | 'UNREACHABLE'
  | 'TARGET_NOT_FOUND'
  | 'NOT_AN_ENEMY'
  | 'CANNOT_FIRE_AFTER_MOVING'
  | 'TARGET_OUT_OF_RANGE'
  | 'CANNOT_CAPTURE'
  | 'NOT_A_BUILDING'
  | 'ALREADY_OWNED'
  | 'NOT_A_BARRACKS'
  | 'NOT_YOUR_BUILDING'
  | 'INSUFFICIENT_FUNDS';

export interface ActionError {
  readonly code: ActionErrorCode;
  /** Message lisible, en français. */
  readonly message: string;
}

export function actionError(code: ActionErrorCode, message: string): ActionError {
  return { code, message };
}
