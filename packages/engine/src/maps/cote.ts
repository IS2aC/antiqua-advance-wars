import type { MapDefinition, PlayerId, UnitType } from '../model/types';
import { parseAsciiMap, rotateRows } from './ascii';

/**
 * Carte côtière — « La Côte des Comptoirs » (20×14), symétrique par rotation de 180°.
 * Un bras de mer traverse le centre d'ouest en est ; on passe à pied par les deux isthmes
 * des bords, ou en bateau. Chaque camp a un port sur la mer (P) qui produit les bateaux.
 * On décrit la moitié nord (QG en haut à droite) ; la moitié sud s'en déduit.
 *
 * Légende : voir ASCII_LEGEND. Q, C, V, P = bâtiments du camp ; v = village neutre ;
 * w = mer.
 */
const NORTH_HALF = [
  'F..h.F..F..MMV..F.hM',
  '.F..s..h...Mh..C.Q.F',
  '..F...=========.....',
  'h..F..v.....F..d.C..',
  '..Mh.F..s..F..V.F.h.',
  '.F...vP...h.hdd...VF',
  '....wwwwwwwwwwww.h..',
];

export const COTE_ROWS: readonly string[] = [...NORTH_HALF, ...rotateRows(NORTH_HALF)];

const NORTH: PlayerId = 'carthage';
const SOUTH: PlayerId = 'koush';

function buildDefinition(): MapDefinition {
  const parsed = parseAsciiMap(COTE_ROWS);
  const half = NORTH_HALF.length;
  const northUnits: readonly { type: UnitType; x: number; y: number }[] = [
    { type: 'fantassin', x: 16, y: 1 },
    { type: 'fantassin', x: 17, y: 2 },
  ];
  const mirror = (x: number, y: number) => ({
    x: parsed.width - 1 - x,
    y: parsed.height - 1 - y,
  });

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
