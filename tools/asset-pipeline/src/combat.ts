/**
 * Scènes de combat : packs de culture (figurants 64×64 propres à chaque peuple) et décors
 * par terrain. Tout est découvert dans art/raw : ajouter un peuple, c'est déposer ses
 * planches dans art/raw/peuples/<peuple>/combat/, sans toucher au code.
 *
 *   art/raw/peuples/<peuple>/combat/<unité>.png   planche 4×5, figurant tourné vers la droite
 *   art/raw/combat/decors/<terrain>.png           décor d'une moitié d'écran (320×384)
 *
 * Gabarits et prompts : docs/art-combat.md.
 */
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { downscaleMajority } from './downscale';
import type { IndexedImage } from './image';
import type { Faction, Palette } from './palette';
import { processAnimatedSheet, type ProcessedFrames, type SheetLayout } from './process';
import type { UnitType } from './sources';

export const PEOPLES_DIR = 'peuples';
export const DECORS_DIR = 'combat/decors';

/** Peuples connus du jeu (chacun a sa rampe de couleurs dans palette.ts). */
export const PEOPLES: readonly Faction[] = ['koush', 'carthage', 'kemet', 'aksoum'];

export const COMBAT_UNITS: readonly UnitType[] = [
  'fantassin',
  'lancier',
  'archers',
  'cavalerie',
  'char',
  'catapulte',
];

/** Décors attendus. route → plaine et pont → riviere, côté jeu. */
export const DECOR_TERRAINS = [
  'plaine',
  'foret',
  'colline',
  'montagne',
  'desert',
  'marais',
  'riviere',
  'village',
  'caserne',
  'qg',
] as const;

/** Planche d'un figurant : 4 colonnes × 5 lignes d'animation, cadre de 64 px. */
export const FIGURE_ANIMS = [
  { anim: 'idle', frames: 4 },
  { anim: 'walk', frames: 4 },
  { anim: 'attack', frames: 4 },
  { anim: 'hit', frames: 2 },
  { anim: 'death', frames: 4 },
] as const;
export const FIGURE_FRAME = 64;
const FIGURE_USEFUL = 60;

export const DECOR_W = 320;
export const DECOR_H = 384;

export function figureLayout(unitType: UnitType): SheetLayout {
  return {
    cols: 4,
    rows: FIGURE_ANIMS.map(({ anim, frames }) => ({
      frames,
      name: (i: number) => `figure/${unitType}/${anim}/${i}`,
    })),
    frame: FIGURE_FRAME,
    useful: FIGURE_USEFUL,
  };
}

export interface FoundSheet<K extends string> {
  readonly key: K;
  readonly path: string;
}

async function pngFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter((file) => extname(file).toLowerCase() === '.png').sort();
}

/** Planches de figurants présentes, par peuple ; les noms inconnus sont signalés. */
export async function findFigureSheets(
  rawDir: string,
  warnings: string[],
): Promise<Map<Faction, FoundSheet<UnitType>[]>> {
  const result = new Map<Faction, FoundSheet<UnitType>[]>();
  const root = join(rawDir, PEOPLES_DIR);
  if (!existsSync(root)) return result;
  for (const people of (await readdir(root)).sort()) {
    const dir = join(root, people, 'combat');
    const files = await pngFiles(dir);
    if (files.length === 0) continue;
    if (!PEOPLES.includes(people as Faction)) {
      warnings.push(`peuple inconnu « ${people} » (connus : ${PEOPLES.join(', ')}) : ignoré`);
      continue;
    }
    const sheets: FoundSheet<UnitType>[] = [];
    for (const file of files) {
      const unit = basename(file, extname(file));
      if (COMBAT_UNITS.includes(unit as UnitType)) {
        sheets.push({ key: unit as UnitType, path: join(dir, file) });
      } else {
        warnings.push(
          `${people}/combat/${file} : unité inconnue (attendu : ${COMBAT_UNITS.join(', ')})`,
        );
      }
    }
    result.set(people as Faction, sheets);
  }
  return result;
}

export type DecorTerrain = (typeof DECOR_TERRAINS)[number];

export async function findDecors(
  rawDir: string,
  warnings: string[],
): Promise<FoundSheet<DecorTerrain>[]> {
  const dir = join(rawDir, DECORS_DIR);
  const found: FoundSheet<DecorTerrain>[] = [];
  for (const file of await pngFiles(dir)) {
    const terrain = basename(file, extname(file));
    if (DECOR_TERRAINS.includes(terrain as DecorTerrain)) {
      found.push({ key: terrain as DecorTerrain, path: join(dir, file) });
    } else {
      warnings.push(
        `combat/decors/${file} : terrain inconnu (attendu : ${DECOR_TERRAINS.join(', ')})`,
      );
    }
  }
  return found;
}

/** Figurant d'un peuple : la planche dessinée en rouge réservé, comme les unités de carte. */
export function processFigure(
  people: Faction,
  unitType: UnitType,
  sheet: IndexedImage,
  palette: Palette,
): ProcessedFrames {
  const result = processAnimatedSheet(
    `${people}/${unitType}`,
    sheet,
    palette,
    figureLayout(unitType),
    false,
  );
  return {
    frames: result.frames,
    warnings: result.warnings,
    info: [`figurant ${people}/${unitType} : échelle 1/${result.scale.toFixed(1)}`],
  };
}

/**
 * Décor : recadré au centre au format d'une moitié d'écran (320×384), puis réduit par vote
 * majoritaire. Ni contour ni couleurs d'équipe.
 */
export function processDecor(terrain: DecorTerrain, sheet: IndexedImage): ProcessedFrames {
  const target = DECOR_W / DECOR_H;
  let w = sheet.width;
  let h = sheet.height;
  if (w / h > target) w = Math.round(h * target);
  else h = Math.round(w / target);
  const box = { x: Math.floor((sheet.width - w) / 2), y: Math.floor((sheet.height - h) / 2), w, h };
  const frame = downscaleMajority(sheet, box, DECOR_W, DECOR_H);
  const warnings: string[] = [];
  const transparent = frame.indices.filter((index) => index < 0).length;
  if (transparent > frame.indices.length * 0.02) {
    warnings.push(
      `décor ${terrain} : ${Math.round((transparent / frame.indices.length) * 100)} % de magenta, le décor doit remplir toute l'image`,
    );
  }
  return {
    frames: new Map([[`decor/${terrain}`, frame]]),
    warnings,
    info: [`décor ${terrain} : ${sheet.width}×${sheet.height} recadré ${w}×${h}`],
  };
}
