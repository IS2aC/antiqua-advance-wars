import type { MapDefinition, PlayerId, Position, UnitType } from '../model/types';
import { parseAsciiMap } from './ascii';

/**
 * Carte de siège — « La Forteresse » (20×14), pour la défense de forteresse.
 * La citadelle du défenseur occupe le centre : remparts (#), tours d'angle (T), douves (o)
 * franchies par deux ponts devant deux portes (nord et sud). Dedans : le QG, une caserne,
 * deux villages. L'assaillant n'a ni bâtiment ni or : une armée de départ, puis des renforts
 * tous les 3 jours par les bords de la carte.
 *
 * Légende : voir ASCII_LEGEND. Q, C, V = bâtiments du défenseur ; v = village neutre.
 */
export const FORTERESSE_ROWS: readonly string[] = [
  'F..h....F...h....F..',
  '.F...v............F.',
  '...ooooooBooooooo...',
  '...oT####.#####To...',
  'h..o#.......F..#o...',
  '...o#.V........#o..h',
  '.v.o#....Q.....#o...',
  '...o#......C...#o.M.',
  '.F.o#........V.#o...',
  '...o#.h........#o.F.',
  '...oT#####.####To...',
  '...oooooooBoooooo...',
  'h..............v...h',
  '..F....h.....F......',
];

const DEFENDER: PlayerId = 'koush';
const ATTACKER: PlayerId = 'carthage';

function buildDefinition(): MapDefinition {
  const parsed = parseAsciiMap(FORTERESSE_ROWS);
  const { width, height, tiles } = parsed;
  const defenders: { type: UnitType; x: number; y: number }[] = [
    { type: 'fantassin', x: 9, y: 5 },
    { type: 'archers', x: 10, y: 6 },
  ];
  const attackers: { type: UnitType; x: number; y: number }[] = [
    { type: 'fantassin', x: 8, y: 12 },
    { type: 'fantassin', x: 12, y: 12 },
    { type: 'lancier', x: 10, y: 13 },
    { type: 'archers', x: 9, y: 13 },
    { type: 'catapulte', x: 11, y: 13 },
    { type: 'fantassin', x: 9, y: 1 },
    { type: 'lancier', x: 10, y: 0 },
    { type: 'archers', x: 8, y: 1 },
    { type: 'cavalerie', x: 1, y: 3 },
    { type: 'fantassin', x: 18, y: 4 },
  ];
  // Renforts : toutes les cases de bord praticables (le moteur choisit celles qui conviennent).
  const entries: Position[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (edge && tiles[y * width + x] === 'plaine') entries.push({ x, y });
    }
  }
  return {
    name: 'La Forteresse',
    width,
    height,
    tiles,
    buildings: parsed.buildings.map((cell) => ({
      type: cell.type,
      x: cell.x,
      y: cell.y,
      owner: cell.char === 'v' ? null : DEFENDER,
    })),
    units: [
      ...defenders.map((unit) => ({ ...unit, owner: DEFENDER })),
      ...attackers.map((unit) => ({ ...unit, owner: ATTACKER })),
    ],
    // Le défenseur joue en premier.
    players: [DEFENDER, ATTACKER],
    startingFunds: 2000,
    siege: { defender: DEFENDER, entries },
  };
}

export const FORTERESSE: MapDefinition = buildDefinition();
