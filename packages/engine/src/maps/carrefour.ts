import type { MapDefinition, PlayerId, UnitType } from '../model/types';
import { parseAsciiMap, quarterTurnRows } from './ascii';

/**
 * Carte à 4 peuples — « Le Carrefour des Royaumes » (20×20), symétrique par quart de tour.
 * On décrit le quart en haut à gauche (Koush) ; les trois autres s'en déduisent en tournant
 * dans le sens des aiguilles d'une montre : Carthage en haut à droite, les Almoravides en bas
 * à droite, les Ashanti en bas à gauche. Une rivière sépare chaque royaume de ses deux
 * voisins, franchie par une route et un pont ; au centre, 4 villages neutres à disputer.
 *
 * Légende : voir ASCII_LEGEND. Q, C, V = bâtiments du camp ; v = village neutre.
 */
const QUARTER = [
  'F.h..F.M.~',
  '.V.....h.~',
  'h.Q======B',
  '..=C..F..~',
  '.F=..h.V.~',
  'F.=.s..F.~',
  '.C=..F..d~',
  '..=.h..v..',
  'M.=..F..dh',
  'h.=..d.h.v',
];

export const CARREFOUR_ROWS: readonly string[] = quarterTurnRows(QUARTER);

/** Dans l'ordre du jeu, qui est aussi celui des quarts (sens des aiguilles d'une montre). */
const PLAYERS: readonly PlayerId[] = ['koush', 'carthage', 'almoravides', 'ashanti'];

function buildDefinition(): MapDefinition {
  const parsed = parseAsciiMap(CARREFOUR_ROWS);
  const half = QUARTER.length;
  const ownerAt = (x: number, y: number): PlayerId => {
    const quarter = y < half ? (x < half ? 0 : 1) : x < half ? 3 : 2;
    return PLAYERS[quarter] ?? 'koush';
  };
  // Unités de départ du quart en haut à gauche, tournées pour les autres.
  const start: readonly { type: UnitType; x: number; y: number }[] = [
    { type: 'fantassin', x: 3, y: 1 },
    { type: 'fantassin', x: 1, y: 3 },
  ];
  const size = parsed.width;
  const turns = (x: number, y: number) => [
    { x, y },
    { x: size - 1 - y, y: x },
    { x: size - 1 - x, y: size - 1 - y },
    { x: y, y: size - 1 - x },
  ];

  return {
    name: 'Le Carrefour des Royaumes',
    width: parsed.width,
    height: parsed.height,
    tiles: parsed.tiles,
    buildings: parsed.buildings.map((cell) => ({
      type: cell.type,
      x: cell.x,
      y: cell.y,
      owner: cell.char === 'v' ? null : ownerAt(cell.x, cell.y),
    })),
    units: start.flatMap((unit) =>
      turns(unit.x, unit.y).map((cell, index) => ({
        type: unit.type,
        ...cell,
        owner: PLAYERS[index] ?? 'koush',
      })),
    ),
    players: PLAYERS,
    startingFunds: 2000,
  };
}

export const CARREFOUR: MapDefinition = buildDefinition();
