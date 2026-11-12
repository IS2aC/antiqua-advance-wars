import { rgbToHsv, type Rgb } from './color';
import { getIndex, TRANSPARENT, type IndexedImage } from './image';

/** Lettres de connexion, toujours dans l'ordre n, e, s, w ; « o » = pièce isolée. */
export const DIRECTIONS = ['n', 'e', 's', 'w'] as const;

export function maskName(connections: readonly boolean[]): string {
  const name = DIRECTIONS.filter((_, i) => connections[i]).join('');
  return name === '' ? 'o' : name;
}

export const isRoadColor = ([r, g, b]: Rgb): boolean => {
  const { h, s, v } = rgbToHsv([r, g, b]);
  return h >= 8 && h <= 40 && s >= 0.4 && v >= 0.45;
};

export const isWaterColor = ([r, g, b]: Rgb): boolean => {
  const { h, s } = rgbToHsv([r, g, b]);
  return h >= 160 && h <= 215 && s >= 0.2;
};

/**
 * Détecte de quels côtés une pièce d'autotiling (route, rivière) touche le bord :
 * on regarde le milieu de chaque bord, sur 3 px de profondeur.
 */
export function connectionMask(
  tile: IndexedImage,
  colors: readonly Rgb[],
  isPath: (color: Rgb) => boolean,
  threshold = 0.35,
): string {
  const { width: w, height: h } = tile;
  const from = Math.floor(w * 0.35);
  const to = Math.ceil(w * 0.65);
  const depth = 3;
  const sides: [number, number][][] = [[], [], [], []];
  for (let a = from; a < to; a++) {
    for (let d = 0; d < depth; d++) {
      sides[0]?.push([a, d]);
      sides[1]?.push([w - 1 - d, a]);
      sides[2]?.push([a, h - 1 - d]);
      sides[3]?.push([d, a]);
    }
  }
  const connections = sides.map((points) => {
    const hits = points.filter(([x, y]) => {
      const index = getIndex(tile, x, y);
      const color = index === TRANSPARENT ? undefined : colors[index];
      return color !== undefined && isPath(color);
    }).length;
    return hits / points.length >= threshold;
  });
  return maskName(connections);
}
