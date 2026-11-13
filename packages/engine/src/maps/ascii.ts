import type { BuildingType, TerrainType } from '../model/types';

/**
 * Légende des cartes en texte (une lettre par case).
 * `v` = village neutre ; les autres bâtiments reçoivent leur propriétaire à part.
 */
export const ASCII_LEGEND: Readonly<Record<string, TerrainType>> = {
  '.': 'plaine',
  F: 'foret',
  h: 'colline',
  M: 'montagne',
  d: 'desert',
  s: 'marais',
  '=': 'route',
  '~': 'riviere',
  B: 'pont',
  V: 'village',
  v: 'village',
  C: 'caserne',
  Q: 'qg',
};

export interface AsciiBuildingCell {
  readonly type: BuildingType;
  readonly x: number;
  readonly y: number;
  /** Lettre d'origine, pour attribuer un propriétaire. */
  readonly char: string;
}

export interface ParsedAsciiMap {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly TerrainType[];
  readonly buildings: readonly AsciiBuildingCell[];
}

function isBuilding(terrain: TerrainType): terrain is BuildingType {
  return terrain === 'village' || terrain === 'caserne' || terrain === 'qg';
}

export function parseAsciiMap(rows: readonly string[]): ParsedAsciiMap {
  const width = rows[0]?.length ?? 0;
  const tiles: TerrainType[] = [];
  const buildings: AsciiBuildingCell[] = [];
  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`Ligne ${y} : ${row.length} cases au lieu de ${width}.`);
    }
    [...row].forEach((char, x) => {
      const terrain = ASCII_LEGEND[char];
      if (terrain === undefined) throw new Error(`Lettre inconnue « ${char} » en (${x}, ${y}).`);
      tiles.push(terrain);
      if (isBuilding(terrain)) buildings.push({ type: terrain, x, y, char });
    });
  });
  return { width, height: rows.length, tiles, buildings };
}

/** Rotation de 180° : sert à construire des cartes symétriques à partir d'une moitié. */
export function rotateRows(rows: readonly string[]): string[] {
  return [...rows].reverse().map((row) => [...row].reverse().join(''));
}
