import type { MapDefinition, PlayerId, UnitType } from '../model/types';
import { parseAsciiMap, rotateRows } from './ascii';

/**
 * Carte du Stage 1 — « Le Gué du Nil » (20×14), symétrique par rotation de 180°.
 * On décrit la moitié nord (Carthage, QG en haut à droite) ; la moitié sud (Koush,
 * QG en bas à gauche) s'en déduit. Le fleuve descend au centre en faisant un coude ;
 * les fantassins et lanciers le passent à gué, montures et roues prennent les 2 ponts.
 *
 * Légende : voir ASCII_LEGEND. Q, C, V = bâtiments du camp ; v = village neutre.
 */
const NORTH_HALF = [
  'F..h.F..F~.MMV..F.hM',
  '.F..s..h.~.Mh..C.Q.F',
  '..F...===B========..',
  'h..F..v..~..F..d.C..',
  '..Mh.F..s~.F..V.F.h.',
  '.FM...h..~..hdd...VF',
  'F..F...F.~~.v.h.MM..',
];

export const GUE_DU_NIL_ROWS: readonly string[] = [...NORTH_HALF, ...rotateRows(NORTH_HALF)];

const NORTH: PlayerId = 'carthage';
const SOUTH: PlayerId = 'koush';

function buildDefinition(): MapDefinition {
  const parsed = parseAsciiMap(GUE_DU_NIL_ROWS);
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
    name: 'Le Gué du Nil',
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
    // Koush joue en premier.
    players: [SOUTH, NORTH],
    startingFunds: 2000,
  };
}

export const GUE_DU_NIL: MapDefinition = buildDefinition();
