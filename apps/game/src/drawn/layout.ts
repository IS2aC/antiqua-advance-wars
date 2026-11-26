import type { TerrainType, UnitType } from '@antiqua/engine';

/**
 * Combats dessinés (prototype) : mise en page, sans Phaser. La scène est composée en
 * 1920×1152 (5:3 comme la carte), puis affichée à la taille du jeu.
 */

export const DRAWN_W = 1920;
export const DRAWN_H = 1152;
export const DRAWN_HALF = DRAWN_W / 2;

/** Hauteur à l'écran d'un figurant du premier rang (la pose de repos fait 420 px). */
export const FIGURE_SCREEN_H = 360;
export const FIGURE_SOURCE_H = 420;

/** Poses et expressions, dans l'ordre des planches (docs/proto-combat.md). */
export const POSES = ['idle', 'attack', 'hit', 'down'] as const;
export type Pose = (typeof POSES)[number];
export const EXPRESSIONS = ['neutral', 'shout', 'hurt', 'smile'] as const;
export type Expression = (typeof EXPRESSIONS)[number];

const LARGE_UNITS: ReadonlySet<UnitType> = new Set(['cavalerie', 'char', 'catapulte', 'convoi']);

/**
 * Figurants dessinés : un pour 2 PV (5 au plus) ; montures et engins, un pour 4 PV
 * (3 au plus) ; le bateau, trop large pour en mettre plusieurs, un seul tant qu'il flotte.
 * Les personnages sont grands : 10 à l'écran deviendraient illisibles.
 */
export function drawnFigureCount(unitType: UnitType, hp: number): number {
  if (hp <= 0) return 0;
  if (unitType === 'bateau') return 1;
  return LARGE_UNITS.has(unitType) ? Math.ceil(hp / 4) : Math.ceil(hp / 2);
}

export interface Slot {
  /** Décalage horizontal depuis le centre du groupe, vers l'ennemi = positif. */
  readonly dx: number;
  /** Ligne des pieds. */
  readonly y: number;
  /** Échelle (le second rang est plus petit, donc plus loin). */
  readonly scale: number;
}

/** Premier rang (3), puis second rang (2) : les derniers à tomber sont au premier rang. */
export const SLOTS: readonly Slot[] = [
  { dx: 250, y: 1080, scale: 1 },
  { dx: 0, y: 1080, scale: 1 },
  { dx: -250, y: 1080, scale: 1 },
  { dx: 125, y: 950, scale: 0.82 },
  { dx: -125, y: 950, scale: 0.82 },
];

/** Décors à essayer pour un terrain, du plus précis au plus général. */
export function decorCandidates(terrain: TerrainType): string[] {
  const name =
    terrain === 'route' ||
    terrain === 'pont' ||
    terrain === 'village' ||
    terrain === 'caserne' ||
    terrain === 'qg'
      ? 'plaine'
      : // Le port donne sur la mer ; sans décor de mer, celui du fleuve.
        terrain === 'port'
        ? 'mer'
        : terrain;
  return name === 'mer' ? ['mer', 'riviere', 'savane'] : [name, 'savane'];
}

/**
 * Expression finale d'un camp : blessé s'il est détruit, souriant s'il a perdu moins
 * que l'autre, neutre sinon.
 */
export function finalExpression(
  self: { hpBefore: number; hpAfter: number },
  other: { hpBefore: number; hpAfter: number },
): Expression {
  if (self.hpAfter <= 0) return 'hurt';
  const selfLoss = self.hpBefore - self.hpAfter;
  const otherLoss = other.hpBefore - other.hpAfter;
  return otherLoss > selfLoss ? 'smile' : 'neutral';
}
