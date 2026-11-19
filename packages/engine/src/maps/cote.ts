import type { MapDefinition, PlayerId, UnitType } from '../model/types';
import { parseAsciiMap } from './ascii';

/**
 * Carte côtière — « La Côte des Comptoirs » (20×14), symétrique en miroir nord/sud.
 * La mer couvre 60 % de la carte : seules les deux côtes (nord et sud) sont habitées, et
 * un unique couloir de terre longe le bord ouest. Les troupes à pied passent par ce
 * couloir ; sinon, il faut prendre la mer depuis son port (P), qui produit les bateaux.
 * On décrit la moitié nord (QG en haut à droite) ; la moitié sud est son reflet.
 *
 * Légende : voir ASCII_LEGEND. Q, C, V, P = bâtiments du camp ; v = village neutre ;
 * w = mer.
 */
const NORTH_HALF = [
  'F..h.F..V..MM..h.Q.F',
  '.F...h.....M..C...F.',
  '..V...hP..wwwwwwwwww',
  '..wwwwwwwwwwwwwwwwww',
  '.vwwwwwwwwwwwwwwwwww',
  '.wwwwwwwwwwwwwwwwwww',
  '.wwwwwwwwwwwwwwwwwww',
];

export const COTE_ROWS: readonly string[] = [...NORTH_HALF, ...[...NORTH_HALF].reverse()];

const NORTH: PlayerId = 'carthage';
const SOUTH: PlayerId = 'koush';

function buildDefinition(): MapDefinition {
  const parsed = parseAsciiMap(COTE_ROWS);
  const half = NORTH_HALF.length;
  const northUnits: readonly { type: UnitType; x: number; y: number }[] = [
    { type: 'fantassin', x: 16, y: 1 },
    { type: 'fantassin', x: 17, y: 1 },
  ];
  // Reflet nord/sud : même colonne, ligne opposée.
  const mirror = (x: number, y: number) => ({ x, y: parsed.height - 1 - y });

  return {
    name: 'La Côte des Comptoirs',
    width: parsed.width,
    height: parsed.height,
    tiles: parsed.tiles,
    buildings: parsed.buildings.map((cell) => ({
      type: cell.type,
      x: cell.x,
      y: cell.y,
      owner: cell.char === 'v' ? null : cell.y < half ? NORTH : SOUTH,
    })),
    units: [
      ...northUnits.map((unit) => ({ ...unit, ...mirror(unit.x, unit.y), owner: SOUTH })),
      ...northUnits.map((unit) => ({ ...unit, owner: NORTH })),
    ],
    // Le camp du sud joue en premier.
    players: [SOUTH, NORTH],
    startingFunds: 2000,
  };
}

export const COTE: MapDefinition = buildDefinition();
