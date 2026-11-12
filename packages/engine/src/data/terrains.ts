import type { MoveType, TerrainType } from '../model/types';

/** Caractéristiques d'un terrain. Valeurs : docs/game-design.md, table « Terrains ». */
export interface TerrainStats {
  readonly name: string;
  /** Étoiles de défense (0 à 4). */
  readonly defense: number;
  /** Coût de déplacement par type ; `null` = infranchissable. */
  readonly moveCost: Readonly<Record<MoveType, number | null>>;
  /** Or versé chaque tour au propriétaire (bâtiments uniquement). */
  readonly income: number;
}

const ALL_ONE = { pied: 1, lourd: 1, monture: 1, roues: 1 } as const;

export const TERRAINS: Readonly<Record<TerrainType, TerrainStats>> = {
  plaine: { name: 'Plaine', defense: 1, moveCost: ALL_ONE, income: 0 },
  foret: {
    name: 'Forêt',
    defense: 2,
    moveCost: { pied: 1, lourd: 1, monture: 2, roues: 3 },
    income: 0,
  },
  colline: {
    name: 'Colline',
    defense: 2,
    moveCost: { pied: 1, lourd: 1, monture: 2, roues: 3 },
    income: 0,
  },
  montagne: {
    name: 'Montagne',
    defense: 4,
    moveCost: { pied: 2, lourd: 1, monture: null, roues: null },
    income: 0,
  },
  desert: {
    name: 'Désert',
    defense: 1,
    moveCost: { pied: 1, lourd: 1, monture: 2, roues: 2 },
    income: 0,
  },
  marais: {
    name: 'Marais',
    defense: 0,
    moveCost: { pied: 2, lourd: 2, monture: 3, roues: null },
    income: 0,
  },
  route: { name: 'Route', defense: 0, moveCost: ALL_ONE, income: 0 },
  riviere: {
    name: 'Rivière',
    defense: 0,
    moveCost: { pied: 2, lourd: 1, monture: null, roues: null },
    income: 0,
  },
  pont: { name: 'Pont', defense: 0, moveCost: ALL_ONE, income: 0 },
  village: { name: 'Village', defense: 2, moveCost: ALL_ONE, income: 1000 },
  caserne: { name: 'Caserne', defense: 3, moveCost: ALL_ONE, income: 1000 },
  qg: { name: 'QG', defense: 4, moveCost: ALL_ONE, income: 1000 },
};

export function movementCost(terrain: TerrainType, moveType: MoveType): number | null {
  return TERRAINS[terrain].moveCost[moveType];
}
