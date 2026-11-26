import type { PlayerId, TerrainType, UnitType } from '@antiqua/engine';

/**
 * Couleurs PROVISOIRES des placeholders (carrés de couleur). Elles disparaissent à
 * l'étape 4, quand l'atlas produit par le pipeline remplace ces formes.
 */
export const TERRAIN_COLORS: Readonly<Record<TerrainType, number>> = {
  plaine: 0xb8b04a,
  foret: 0x4e7a32,
  colline: 0x9aa250,
  montagne: 0x8a5a3a,
  desert: 0xe0c890,
  marais: 0x5e7a5a,
  route: 0xc8a878,
  riviere: 0x3a78c8,
  pont: 0xa07040,
  village: 0xb8b04a,
  caserne: 0xb8b04a,
  qg: 0xb8b04a,
  port: 0xb8b04a,
  mer: 0x2a5ea8,
  rempart: 0x8a7a68,
  breche: 0xa89478,
  tour: 0x9a8a72,
  douves: 0x2e6a9a,
};

/**
 * Rampes d'équipe des sprites, du plus sombre au plus clair : les mêmes que le pipeline
 * (`tools/asset-pipeline/src/palette.ts`, `docs/art-bible.md`). Les dessins des combats sont
 * recolorés sur ces rampes : une unité a la même couleur sur la carte et en combat.
 */
export const TEAM_RAMPS: Readonly<Record<PlayerId, readonly [number, number, number, number]>> = {
  carthage: [0x4a1218, 0x8e1f24, 0xd13a2e, 0xf2735a],
  koush: [0x16234a, 0x24418e, 0x3a73d1, 0x73b4f2],
  ashanti: [0x4a3512, 0x8e6a1f, 0xd1a72e, 0xf2d65a],
  almoravides: [0x123a1e, 0x1f6e34, 0x2eae4e, 0x6fde85],
  dahomey: [0x2e1240, 0x5a2380, 0x8a3fc4, 0xc38af0],
  sosso: [0x4a2208, 0x8e4214, 0xd9711e, 0xf7ae5e],
};

/** Couleur d'équipe : le ton moyen-clair de la rampe, le plus présent sur les sprites. */
export const TEAM_COLORS: Readonly<Record<PlayerId, number>> = {
  koush: TEAM_RAMPS.koush[2],
  carthage: TEAM_RAMPS.carthage[2],
  ashanti: TEAM_RAMPS.ashanti[2],
  almoravides: TEAM_RAMPS.almoravides[2],
  dahomey: TEAM_RAMPS.dahomey[2],
  sosso: TEAM_RAMPS.sosso[2],
};

/**
 * Couleurs communes à tous les soldats, relevées sur l'atlas des unités (les 4 peuples
 * partagent les mêmes sprites, seule la rampe d'équipe change). Mêmes valeurs dans
 * `art/specs/couleurs.json` pour la génération des dessins.
 */
export const SPRITE_COLORS = {
  skin: 0xc65922,
  skinShade: 0x9f5021,
  hair: 0x4d1f0f,
  gold: 0xd69625,
  goldLight: 0xfac777,
  cream: 0xefd6a8,
  wood: 0x9f5021,
  stone: 0x816a4c,
} as const;

export const NEUTRAL_COLOR = 0xd8d0c0;
export const OUTLINE_COLOR = 0x2b1b17;
export const MOVE_ZONE_COLOR = 0x4a9cff;
export const ATTACK_ZONE_COLOR = 0xff4a3a;
export const CURSOR_COLOR = 0xfff4c8;
export const PANEL_COLOR = 0x1a1410;
export const TEXT_COLOR = '#fff4c8';
export const DISABLED_TEXT_COLOR = '#7a6e5a';

/** Lettres affichées sur les placeholders d'unités. */
export const UNIT_LABELS: Readonly<Record<UnitType, string>> = {
  fantassin: 'F',
  lancier: 'L',
  archers: 'A',
  cavalerie: 'Cv',
  char: 'Ch',
  catapulte: 'Ca',
  convoi: 'Co',
  bateau: 'Ba',
};

export const BUILDING_LABELS = { village: 'V', caserne: 'C', qg: 'QG', port: 'P' } as const;

/** Assombrit une couleur (unités ayant agi). */
export function darken(color: number, factor = 0.45): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

export const FONT_FAMILY = 'monospace';
