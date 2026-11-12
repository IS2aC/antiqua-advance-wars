import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { hexToRgb, rgbToHex, rgbToLab, type Lab, type Rgb } from './color';

export type Faction = 'carthage' | 'koush' | 'kemet' | 'aksoum';
export const FACTIONS: readonly Faction[] = ['carthage', 'koush', 'kemet', 'aksoum'];

/** Rampes d'équipe (du plus sombre au plus clair), docs/art-bible.md. Carthage = source. */
export const TEAM_RAMPS: Readonly<Record<Faction, readonly [string, string, string, string]>> = {
  carthage: ['#4A1218', '#8E1F24', '#D13A2E', '#F2735A'],
  koush: ['#16234A', '#24418E', '#3A73D1', '#73B4F2'],
  kemet: ['#4A3512', '#8E6A1F', '#D1A72E', '#F2D65A'],
  aksoum: ['#123A1E', '#1F6E34', '#2EAE4E', '#6FDE85'],
};

export const OUTLINE_HEX = '#2B1B17';
export const PALETTE_SIZE = 32;
const TEAM_SIZE = 4;
/** Couleurs générales = 32 − contour − 4 rouges réservés. */
const GENERAL_SIZE = PALETTE_SIZE - TEAM_SIZE - 1;

/**
 * Palette maître antiqua-32 : 27 couleurs générales tirées des planches, le contour,
 * puis les 4 rouges réservés (indices 28 à 31, utilisés nulle part ailleurs).
 */
export interface Palette {
  readonly colors: readonly Rgb[];
  readonly labs: readonly Lab[];
  readonly outlineIndex: number;
  readonly teamStart: number;
}

function makePalette(general: readonly Rgb[]): Palette {
  const colors = [...general, hexToRgb(OUTLINE_HEX), ...TEAM_RAMPS.carthage.map(hexToRgb)];
  return {
    colors,
    labs: colors.map(rgbToLab),
    outlineIndex: general.length,
    teamStart: general.length + 1,
  };
}

/** Coupe médiane : découpe récursivement la boîte de couleurs la plus étendue. */
export function medianCut(samples: readonly Rgb[], count: number): Rgb[] {
  let boxes: Rgb[][] = [samples.slice()];
  while (boxes.length < count) {
    let bestIndex = -1;
    let bestRange = 0;
    let bestChannel = 0;
    boxes.forEach((box, index) => {
      if (box.length < 2) return;
      for (let channel = 0; channel < 3; channel++) {
        let min = 255;
        let max = 0;
        for (const color of box) {
          min = Math.min(min, color[channel] ?? 0);
          max = Math.max(max, color[channel] ?? 0);
        }
        // Pondérée par la population : les grandes zones (herbe, peau) gagnent des nuances.
        const range = (max - min) * Math.sqrt(box.length);
        if (range > bestRange) {
          bestRange = range;
          bestIndex = index;
          bestChannel = channel;
        }
      }
    });
    if (bestIndex < 0) break;
    const box = boxes[bestIndex] ?? [];
    box.sort((a, b) => (a[bestChannel] ?? 0) - (b[bestChannel] ?? 0));
    const half = Math.floor(box.length / 2);
    boxes = [
      ...boxes.slice(0, bestIndex),
      box.slice(0, half),
      box.slice(half),
      ...boxes.slice(bestIndex + 1),
    ];
  }
  return boxes
    .filter((box) => box.length > 0)
    .map((box) => {
      const sum = [0, 0, 0];
      for (const color of box) for (let c = 0; c < 3; c++) sum[c] = (sum[c] ?? 0) + (color[c] ?? 0);
      return sum.map((s) => Math.round(s / box.length)) as unknown as Rgb;
    })
    .sort((a, b) => rgbToLab(a)[0] - rgbToLab(b)[0]);
}

async function readPaletteStrip(path: string): Promise<Rgb[]> {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const colors: Rgb[] = [];
  for (let x = 0; x < info.width; x++)
    colors.push([data[x * 4] ?? 0, data[x * 4 + 1] ?? 0, data[x * 4 + 2] ?? 0]);
  return colors;
}

/**
 * Charge art/palette/antiqua-32.png s'il existe (palette figée, versionnée), sinon la
 * construit à partir des échantillons et l'écrit avec sa version .gpl (GIMP, Aseprite).
 */
export async function loadOrCreatePalette(
  pngPath: string,
  samples: () => Promise<Rgb[]>,
): Promise<{ palette: Palette; created: boolean }> {
  if (existsSync(pngPath)) {
    const strip = await readPaletteStrip(pngPath);
    return { palette: makePalette(strip.slice(0, GENERAL_SIZE)), created: false };
  }
  const general = medianCut(await samples(), GENERAL_SIZE);
  const palette = makePalette(general);
  await mkdir(dirname(pngPath), { recursive: true });
  const strip = Buffer.alloc(PALETTE_SIZE * 4);
  palette.colors.forEach(([r, g, b], index) => strip.set([r, g, b, 255], index * 4));
  await writeFile(
    pngPath,
    await sharp(strip, { raw: { width: PALETTE_SIZE, height: 1, channels: 4 } })
      .png()
      .toBuffer(),
  );
  const gpl = [
    'GIMP Palette',
    'Name: antiqua-32',
    'Columns: 8',
    '#',
    ...palette.colors.map(([r, g, b], index) => {
      const label =
        index === palette.outlineIndex
          ? 'contour'
          : index >= palette.teamStart
            ? `equipe-${index - palette.teamStart}`
            : rgbToHex([r, g, b]);
      return `${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${label}`;
    }),
  ].join('\n');
  await writeFile(pngPath.replace(/\.png$/, '.gpl'), `${gpl}\n`);
  return { palette, created: true };
}

/** Couleurs RGB de la palette pour une faction (les 4 rouges réservés sont remplacés). */
export function factionColors(palette: Palette, faction: Faction): Rgb[] {
  const colors = [...palette.colors];
  TEAM_RAMPS[faction].forEach((hex, k) => {
    colors[palette.teamStart + k] = hexToRgb(hex);
  });
  return colors;
}
