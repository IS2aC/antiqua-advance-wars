import { TRANSPARENT, createIndexed, type Box, type IndexedImage } from './image';

/**
 * Réduit la zone `box` à `outW`×`outH` par vote majoritaire par bloc : chaque pixel
 * final prend la couleur de palette la plus fréquente de son bloc (jamais de moyenne,
 * jamais de bilinéaire). Un bloc majoritairement transparent reste transparent.
 */
export function downscaleMajority(
  source: IndexedImage,
  box: Box,
  outW: number,
  outH: number,
): IndexedImage {
  const result = createIndexed(outW, outH);
  const counts = new Map<number, number>();
  for (let oy = 0; oy < outH; oy++) {
    const y0 = box.y + Math.floor((oy * box.h) / outH);
    const y1 = Math.max(y0 + 1, box.y + Math.floor(((oy + 1) * box.h) / outH));
    for (let ox = 0; ox < outW; ox++) {
      const x0 = box.x + Math.floor((ox * box.w) / outW);
      const x1 = Math.max(x0 + 1, box.x + Math.floor(((ox + 1) * box.w) / outW));
      counts.clear();
      let total = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (x < 0 || y < 0 || x >= source.width || y >= source.height) continue;
          const value = source.indices[y * source.width + x] ?? TRANSPARENT;
          counts.set(value, (counts.get(value) ?? 0) + 1);
          total++;
        }
      }
      if ((counts.get(TRANSPARENT) ?? 0) * 2 > total) continue;
      let best = TRANSPARENT;
      let bestCount = 0;
      for (const [value, count] of counts) {
        if (value !== TRANSPARENT && count > bestCount) {
          best = value;
          bestCount = count;
        }
      }
      result.indices[oy * outW + ox] = best;
    }
  }
  return result;
}

/**
 * Taille estimée du « gros pixel » de l'image IA : longueur de plage horizontale la plus
 * fréquente (≥ 2) entre changements de couleur. Indicatif, affiché dans le rapport.
 */
export function estimatePixelSize(source: IndexedImage, box: Box): number {
  const histogram = new Map<number, number>();
  for (let y = box.y; y < box.y + box.h; y += 3) {
    let run = 1;
    for (let x = box.x + 1; x < box.x + box.w; x++) {
      const same =
        source.indices[y * source.width + x] === source.indices[y * source.width + x - 1];
      if (same) run++;
      else {
        if (run >= 2 && run <= 40) histogram.set(run, (histogram.get(run) ?? 0) + 1);
        run = 1;
      }
    }
  }
  let best = 1;
  let bestCount = 0;
  for (const [size, count] of histogram) {
    if (count > bestCount) {
      best = size;
      bestCount = count;
    }
  }
  return best;
}
