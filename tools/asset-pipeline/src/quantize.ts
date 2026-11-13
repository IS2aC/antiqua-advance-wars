import { isBackground, isTeamRed, labDistance, rgbToLab, type Rgb } from './color';
import { TRANSPARENT, type IndexedImage, type RgbaImage } from './image';
import type { Palette } from './palette';

export interface QuantizeOptions {
  /** Repère les rouges d'équipe et les envoie sur les 4 rouges réservés (unités, bâtiments). */
  readonly team: boolean;
}

/**
 * Remplace chaque pixel par la couleur la plus proche de la palette (distance Lab).
 * Fond magenta → transparent ; alpha binaire. Les rouges d'équipe ne prennent que les
 * 4 rouges réservés (choisis par luminosité), qui ne servent à rien d'autre.
 */
export function quantize(
  image: RgbaImage,
  palette: Palette,
  options: QuantizeOptions,
): IndexedImage {
  const indices = new Int16Array(image.width * image.height);
  const cache = new Map<number, number>();
  const generalEnd = palette.teamStart;
  const teamLightness = palette.labs.slice(palette.teamStart).map((lab) => lab[0]);

  const nearestGeneral = (rgb: Rgb): number => {
    const lab = rgbToLab(rgb);
    let best = 0;
    let bestDistance = Infinity;
    for (let index = 0; index < generalEnd; index++) {
      const candidate = palette.labs[index];
      if (!candidate) continue;
      const d = labDistance(lab, candidate);
      if (d < bestDistance) {
        bestDistance = d;
        best = index;
      }
    }
    return best;
  };

  const nearestTeam = (rgb: Rgb): number => {
    const lightness = rgbToLab(rgb)[0];
    let best = 0;
    teamLightness.forEach((value, k) => {
      if (Math.abs(value - lightness) < Math.abs((teamLightness[best] ?? 0) - lightness)) best = k;
    });
    return palette.teamStart + best;
  };

  for (let i = 0; i < indices.length; i++) {
    const r = image.data[i * 4] ?? 0;
    const g = image.data[i * 4 + 1] ?? 0;
    const b = image.data[i * 4 + 2] ?? 0;
    const a = image.data[i * 4 + 3] ?? 0;
    if (a < 128 || isBackground(r, g, b)) {
      indices[i] = TRANSPARENT;
      continue;
    }
    const key = (r << 16) | (g << 8) | b;
    let index = cache.get(key);
    if (index === undefined) {
      index =
        options.team && isTeamRed(r, g, b) ? nearestTeam([r, g, b]) : nearestGeneral([r, g, b]);
      cache.set(key, index);
    }
    indices[i] = index;
  }
  return { width: image.width, height: image.height, indices };
}

/** Rendu RGBA d'une image indexée avec un jeu de couleurs (palette d'une faction). */
export function toRgba(image: IndexedImage, colors: readonly Rgb[]): RgbaImage {
  const data = new Uint8ClampedArray(image.width * image.height * 4);
  image.indices.forEach((index, i) => {
    if (index === TRANSPARENT) return;
    const color = colors[index];
    if (!color) return;
    data.set([color[0], color[1], color[2], 255], i * 4);
  });
  return { width: image.width, height: image.height, data };
}
