import { connectionMask, isRoadColor, isWaterColor } from './autotile';
import {
  addOutline,
  cornerLoad,
  countIndices,
  dropToFloor,
  placeInFrame,
  removeSpecks,
} from './autofix';
import { downscaleMajority, estimatePixelSize } from './downscale';
import type { Box, IndexedImage } from './image';
import type { Palette } from './palette';
import { contentBox, detectBlobs, gridCells } from './slice';
import {
  BASE_TILES,
  BUILDING_TILES,
  RIVER_TILES,
  ROAD_TILES,
  UNIT_GRID,
  UNIT_ROWS,
  type UnitType,
} from './sources';

/** Taille utile d'une unité (30 px) dans son cadre de 32 : 1 px de marge pour le contour. */
const UNIT_FRAME = 32;
const UNIT_USEFUL = 30;
const TILE = 32;
const BUILDING_W = 32;
const BUILDING_H = 64;

export interface ProcessedFrames {
  readonly frames: Map<string, IndexedImage>;
  readonly warnings: string[];
  readonly info: string[];
}

function isDarkFactory(palette: Palette): (index: number) => boolean {
  return (index) => (palette.labs[index]?.[0] ?? 100) < 24;
}

/**
 * Unité : même échelle pour toutes ses images (sinon l'animation « respire »), centrage
 * par ligne d'animation, contour, pieds sur la dernière ligne.
 */
export function processUnit(
  type: UnitType,
  sheet: IndexedImage,
  palette: Palette,
): ProcessedFrames {
  const frames = new Map<string, IndexedImage>();
  const warnings: string[] = [];
  const cells = gridCells(sheet.width, sheet.height, UNIT_GRID.cols, UNIT_GRID.rows);
  const isDark = isDarkFactory(palette);

  const rows = UNIT_ROWS.map((row, r) => {
    const rowCells = cells.slice(r * UNIT_GRID.cols, r * UNIT_GRID.cols + row.frames);
    const local: Box[] = [];
    rowCells.forEach((cell, i) => {
      const box = contentBox(sheet, cell);
      if (!box) warnings.push(`${type} : case ${r + 1}.${i + 1} vide`);
      else local.push({ x: box.x - cell.x, y: box.y - cell.y, w: box.w, h: box.h });
    });
    const union = local.reduce<Box | null>((acc, b) => {
      if (!acc) return b;
      const x = Math.min(acc.x, b.x);
      const y = Math.min(acc.y, b.y);
      return {
        x,
        y,
        w: Math.max(acc.x + acc.w, b.x + b.w) - x,
        h: Math.max(acc.y + acc.h, b.y + b.h) - y,
      };
    }, null);
    return { row, rowCells, union };
  });

  const largest = Math.max(...rows.map(({ union }) => (union ? Math.max(union.w, union.h) : 0)));
  const scale = largest / UNIT_USEFUL;
  const firstCell = cells[0];
  const pixelSize = firstCell ? estimatePixelSize(sheet, firstCell) : 0;

  for (const { row, rowCells, union } of rows) {
    if (!union) continue;
    rowCells.forEach((cell, i) => {
      const region = { x: cell.x + union.x, y: cell.y + union.y, w: union.w, h: union.h };
      const small = downscaleMajority(
        sheet,
        region,
        Math.max(1, Math.round(union.w / scale)),
        Math.max(1, Math.round(union.h / scale)),
      );
      removeSpecks(small, 3);
      const frame = dropToFloor(
        addOutline(placeInFrame(small, UNIT_FRAME, UNIT_FRAME), palette.outlineIndex, isDark),
      );
      const name =
        row.direction === null
          ? `unit/${type}/${row.anim}/${i}`
          : `unit/${type}/${row.anim}/${row.direction}/${i}`;
      frames.set(name, frame);
      const load = cornerLoad(frame);
      if (load > 0.5) warnings.push(`${name} : coin des PV chargé à ${Math.round(load * 100)} %`);
    });
  }

  const idle = frames.get(`unit/${type}/idle/0`);
  const teamPixels = idle ? countIndices(idle, (index) => index >= palette.teamStart) : 0;
  if (idle && teamPixels < 8) {
    warnings.push(
      `${type} : presque pas de rouge d'équipe détecté (${teamPixels} px) — les couleurs de camp seront peu visibles`,
    );
  }
  return {
    frames,
    warnings,
    info: [
      `${type} : échelle 1/${scale.toFixed(1)}, gros pixel IA ≈ ${pixelSize} px, ${teamPixels} px d'équipe`,
    ],
  };
}

function expectCount(
  label: string,
  blobs: readonly Box[],
  expected: number,
  warnings: string[],
): void {
  if (blobs.length !== expected) {
    warnings.push(`${label} : ${blobs.length} éléments détectés au lieu de ${expected}`);
  }
}

/** Tuile : la zone détectée est ramenée à 32×32 (déformée si la case IA n'est pas carrée). */
function tileFrom(sheet: IndexedImage, box: Box, label: string, warnings: string[]): IndexedImage {
  const ratio = box.w / box.h;
  if (ratio > 1.3 || ratio < 0.77) {
    warnings.push(
      `${label} : case IA non carrée (${box.w}×${box.h}), tuile déformée — à régénérer en carré`,
    );
  }
  return downscaleMajority(sheet, box, TILE, TILE);
}

export function processBaseTiles(sheet: IndexedImage): ProcessedFrames {
  const frames = new Map<string, IndexedImage>();
  const warnings: string[] = [];
  const blobs = detectBlobs(sheet);
  expectCount('tuiles de base', blobs, BASE_TILES.rows.length * BASE_TILES.perRow, warnings);
  blobs.forEach((box, index) => {
    const terrain = BASE_TILES.rows[Math.floor(index / BASE_TILES.perRow)];
    if (!terrain) return;
    const name = `terrain/${terrain}/${index % BASE_TILES.perRow}`;
    frames.set(name, tileFrom(sheet, box, name, warnings));
  });
  return { frames, warnings, info: [] };
}

/** Ajoute une pièce d'autotiling sous `terrain/<type>/<masque>` (variantes : -2, -3…). */
function addVariant(frames: Map<string, IndexedImage>, base: string, frame: IndexedImage): string {
  let name = base;
  for (let n = 2; frames.has(name); n++) name = `${base}-${n}`;
  frames.set(name, frame);
  return name;
}

export function processRoads(sheet: IndexedImage, palette: Palette): ProcessedFrames {
  const frames = new Map<string, IndexedImage>();
  const warnings: string[] = [];
  const blobs = detectBlobs(sheet);
  expectCount('routes', blobs, ROAD_TILES.count, warnings);
  const masks: string[] = [];
  for (const box of blobs) {
    const tile = tileFrom(sheet, box, 'route', warnings);
    const mask = connectionMask(tile, palette.colors, isRoadColor);
    masks.push(mask);
    addVariant(frames, `terrain/route/${mask}`, tile);
  }
  return { frames, warnings, info: [`routes : connexions détectées ${masks.join(' ')}`] };
}

export function processRiver(sheet: IndexedImage, palette: Palette): ProcessedFrames {
  const frames = new Map<string, IndexedImage>();
  const warnings: string[] = [];
  const blobs = detectBlobs(sheet);
  expectCount('rivière', blobs, RIVER_TILES.autotiles + RIVER_TILES.extras.length, warnings);
  const masks: string[] = [];
  blobs.forEach((box, index) => {
    const label =
      index < RIVER_TILES.autotiles
        ? 'rivière'
        : `rivière (${RIVER_TILES.extras[index - RIVER_TILES.autotiles] ?? '?'})`;
    const tile = tileFrom(sheet, box, label, warnings);
    if (index < RIVER_TILES.autotiles) {
      const mask = connectionMask(tile, palette.colors, isWaterColor);
      masks.push(mask);
      addVariant(frames, `terrain/riviere/${mask}`, tile);
      return;
    }
    const extra = RIVER_TILES.extras[index - RIVER_TILES.autotiles];
    if (extra) addVariant(frames, `terrain/${extra}`, tile);
  });
  return { frames, warnings, info: [`rivière : connexions détectées ${masks.join(' ')}`] };
}

/** Bâtiments 32×64 : largeur ramenée à 30 px + contour, ancrés en bas. */
export function processBuildings(sheet: IndexedImage, palette: Palette): ProcessedFrames {
  const frames = new Map<string, IndexedImage>();
  const warnings: string[] = [];
  const blobs = detectBlobs(sheet);
  expectCount('bâtiments', blobs, BUILDING_TILES.order.length, warnings);
  const isDark = isDarkFactory(palette);
  blobs.forEach((box, index) => {
    const entry = BUILDING_TILES.order[index];
    if (!entry) return;
    const [type, version] = entry;
    const scale = box.w / (BUILDING_W - 2);
    const height = Math.min(BUILDING_H - 2, Math.round(box.h / scale));
    const small = downscaleMajority(sheet, box, BUILDING_W - 2, height);
    removeSpecks(small, 3);
    const frame = dropToFloor(
      addOutline(placeInFrame(small, BUILDING_W, BUILDING_H), palette.outlineIndex, isDark),
    );
    frames.set(`building/${type}/${version}`, frame);
  });
  return { frames, warnings, info: [] };
}
