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
};

export const TEAM_COLORS: Readonly<Record<PlayerId, number>> = {
  koush: 0x3a73d1,
  carthage: 0xd13a2e,
  kemet: 0xe0b02a,
  aksoum: 0x3a9a4a,
};

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
};

export const BUILDING_LABELS = { village: 'V', caserne: 'C', qg: 'QG' } as const;

/** Assombrit une couleur (unités ayant agi). */
export function darken(color: number, factor = 0.45): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

export const FONT_FAMILY = 'monospace';
