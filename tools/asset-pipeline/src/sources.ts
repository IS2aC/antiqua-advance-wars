/**
 * Description des planches brutes de art/raw/ : quel fichier contient quoi, et dans
 * quel ordre. C'est le seul fichier à modifier quand une planche est régénérée ou renommée.
 */

export type UnitType = 'fantassin' | 'lancier' | 'archers' | 'cavalerie' | 'char' | 'catapulte';
export type BuildingType = 'village' | 'caserne' | 'qg';

export const UNIT_SHEETS: Readonly<Record<UnitType, string>> = {
  fantassin: 'sprites-unités/fantassins-rouge.png',
  lancier: 'sprites-unités/lancier_lourd-rouge.png',
  archers: 'sprites-unités/archers-rouge.png',
  cavalerie: 'sprites-unités/cavalier_legers-rouge.png',
  // La planche nommée « cavaliers lourds » contient le char de guerre.
  char: 'sprites-unités/cavaliers_lourds-rouge.png',
  catapulte: 'sprites-unités/catapulte-rouge.png',
};

/** Gabarit des planches d'unités (README) : 4×4 cases, une ligne par animation. */
export const UNIT_GRID = { cols: 4, rows: 4 } as const;
export const UNIT_ROWS = [
  { anim: 'idle', direction: null, frames: 3 },
  { anim: 'walk', direction: 'right', frames: 4 },
  { anim: 'walk', direction: 'up', frames: 4 },
  { anim: 'walk', direction: 'down', frames: 4 },
] as const;

/** Tuiles de base : une ligne par terrain, 4 variantes par ligne. */
export const BASE_TILES = {
  file: 'sprites-terrains/tuiles-debase.png',
  rows: ['plaine', 'foret', 'colline', 'montagne', 'desert', 'marais'],
  perRow: 4,
} as const;

/** Routes : 16 pièces d'autotiling, connexions détectées automatiquement. */
export const ROAD_TILES = { file: 'sprites-terrains/routes-pistes.png', count: 16 } as const;

/**
 * Rivière : 16 pièces d'autotiling, puis (ligne du bas) pont route est-ouest, pont route
 * nord-sud, gué vertical, gué horizontal et 4 variantes de rivière étroite nord-sud
 * (rangées à part : plus étroites que les pièces d’autotiling, elles ne s’y mélangent pas).
 */
export const RIVER_TILES = {
  file: 'sprites-terrains/rivière et ponts.png',
  autotiles: 16,
  extras: [
    'pont/ew',
    'pont/ns',
    'gue/ns',
    'gue/ew',
    'riviere-etroite/ns',
    'riviere-etroite/ns',
    'riviere-etroite/ns',
    'riviere-etroite/ns',
  ],
} as const;

/** Bâtiments : pour chaque type, la version neutre puis la version rouge (Carthage). */
export const BUILDING_TILES: {
  readonly file: string;
  readonly order: readonly (readonly [BuildingType, 'neutre' | 'rouge'])[];
} = {
  file: 'sprites-terrains/batiments.png',
  order: [
    ['village', 'neutre'],
    ['village', 'rouge'],
    ['caserne', 'neutre'],
    ['caserne', 'rouge'],
    ['qg', 'neutre'],
    ['qg', 'rouge'],
  ],
};
