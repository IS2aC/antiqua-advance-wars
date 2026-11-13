import type { MoveType, UnitType } from '../model/types';

/** Caractéristiques d'une unité. Valeurs : docs/game-design.md, table « Unités ». */
export interface UnitStats {
  readonly name: string;
  readonly cost: number;
  readonly move: number;
  readonly moveType: MoveType;
  readonly minRange: number;
  readonly maxRange: number;
  readonly canCapture: boolean;
}

export const UNIT_TYPES: readonly UnitType[] = [
  'fantassin',
  'lancier',
  'archers',
  'cavalerie',
  'char',
  'catapulte',
];

export const UNITS: Readonly<Record<UnitType, UnitStats>> = {
  fantassin: {
    name: 'Fantassin',
    cost: 1000,
    move: 3,
    moveType: 'pied',
    minRange: 1,
    maxRange: 1,
    canCapture: true,
  },
  lancier: {
    name: 'Lancier lourd',
    cost: 2500,
    move: 2,
    moveType: 'lourd',
    minRange: 1,
    maxRange: 1,
    canCapture: true,
  },
  archers: {
    name: 'Archers',
    cost: 3000,
    move: 3,
    moveType: 'pied',
    minRange: 2,
    maxRange: 2,
    canCapture: false,
  },
  cavalerie: {
    name: 'Cavalerie légère',
    cost: 4000,
    move: 7,
    moveType: 'monture',
    minRange: 1,
    maxRange: 1,
    canCapture: false,
  },
  char: {
    name: 'Char de guerre',
    cost: 7000,
    move: 6,
    moveType: 'roues',
    minRange: 1,
    maxRange: 1,
    canCapture: false,
  },
  catapulte: {
    name: 'Catapulte',
    cost: 6000,
    move: 4,
    moveType: 'roues',
    minRange: 2,
    maxRange: 3,
    canCapture: false,
  },
};

/** Une unité à tir indirect ne tire pas après avoir bougé et ne riposte jamais. */
export function isIndirect(type: UnitType): boolean {
  return UNITS[type].maxRange > 1;
}
