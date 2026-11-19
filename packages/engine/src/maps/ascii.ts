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
  w: 'mer',
  P: 'port',
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
  return terrain === 'village' || terrain === 'caserne' || terrain === 'qg' || terrain === 'port';
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

/**
 * Carte carrée symétrique par quart de tour, à partir de son quart en haut à gauche
 * (`quarter` : n lignes de n cases) : on obtient 2n × 2n cases, chaque quart étant le
 * précédent tourné de 90° dans le sens des aiguilles d'une montre.
 */
export function quarterTurnRows(quarter: readonly string[]): string[] {
  const n = quarter.length;
  const size = 2 * n;
  const grid: string[][] = Array.from({ length: size }, () => Array<string>(size).fill('?'));
  quarter.forEach((row, y) => {
    if (row.length !== n) throw new Error(`Quart de carte : ligne ${y} de ${row.length} cases.`);
    [...row].forEach((char, x) => {
      // Haut gauche, haut droite, bas droite, bas gauche (sens des aiguilles d'une montre).
      for (const [cx, cy] of [
        [x, y],
        [size - 1 - y, x],
        [size - 1 - x, size - 1 - y],
        [y, size - 1 - x],
      ] as const) {
        const line = grid[cy];
        if (line) line[cx] = char;
      }
    });
  });
  return grid.map((line) => line.join(''));
}
