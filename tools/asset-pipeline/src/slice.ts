import { TRANSPARENT, type Box, type IndexedImage } from './image';

/** Découpe une planche en grille régulière (cases rangées ligne par ligne). */
export function gridCells(width: number, height: number, cols: number, rows: number): Box[] {
  const cells: Box[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = Math.round((col * width) / cols);
      const y = Math.round((row * height) / rows);
      cells.push({
        x,
        y,
        w: Math.round(((col + 1) * width) / cols) - x,
        h: Math.round(((row + 1) * height) / rows) - y,
      });
    }
  }
  return cells;
}

/**
 * Grille dont les limites entre lignes suivent les bandes vides de la planche : l'IA ne place
 * pas toujours ses lignes pile sur les quarts de l'image, et une crête ou une lance qui
 * dépasse dans la case du dessus y laisserait un éclat. Chaque limite est cherchée à ±15 %
 * de la hauteur d'une case autour de sa place régulière : la ligne de pixels la plus vide,
 * la plus proche de la place régulière à égalité.
 */
export function bandedGridCells(image: IndexedImage, cols: number, rows: number): Box[] {
  const filled = (y: number) => opaqueCount(image, { x: 0, y: 0, w: image.width, h: 1 }, 'row', y);
  const step = image.height / rows;
  const reach = Math.round(step * 0.15);
  const bounds = [0];
  for (let row = 1; row < rows; row++) {
    const nominal = Math.round(row * step);
    let best = nominal;
    let bestCount = filled(nominal);
    for (let offset = 1; offset <= reach; offset++) {
      for (const y of [nominal - offset, nominal + offset]) {
        if (y <= 0 || y >= image.height) continue;
        const count = filled(y);
        if (count < bestCount) {
          best = y;
          bestCount = count;
        }
      }
    }
    bounds.push(best);
  }
  bounds.push(image.height);
  return gridCells(image.width, image.height, cols, rows).map((cell, index) => {
    const row = Math.floor(index / cols);
    const top = bounds[row] ?? cell.y;
    return { ...cell, y: top, h: (bounds[row + 1] ?? cell.y + cell.h) - top };
  });
}

function opaqueCount(image: IndexedImage, region: Box, axis: 'row' | 'col', at: number): number {
  let count = 0;
  if (axis === 'row') {
    for (let x = region.x; x < region.x + region.w; x++) {
      if (image.indices[at * image.width + x] !== TRANSPARENT) count++;
    }
  } else {
    for (let y = region.y; y < region.y + region.h; y++) {
      if (image.indices[y * image.width + at] !== TRANSPARENT) count++;
    }
  }
  return count;
}

/** Plages [début, fin) où le profil dépasse `threshold`, en tolérant des trous de `gap`. */
function runs(profile: readonly number[], threshold: number, gap: number): [number, number][] {
  const result: [number, number][] = [];
  let start = -1;
  let lastHit = -1;
  profile.forEach((value, index) => {
    if (value > threshold) {
      if (start < 0) start = index;
      lastHit = index;
    } else if (start >= 0 && index - lastHit > gap) {
      result.push([start, lastHit + 1]);
      start = -1;
    }
  });
  if (start >= 0) result.push([start, lastHit + 1]);
  return result;
}

/**
 * Boîte englobante du contenu d'une zone. Les lignes et colonnes presque vides
 * (poussière, franges) sont ignorées.
 */
export function contentBox(image: IndexedImage, region: Box, noise = 2): Box | null {
  const rows = Array.from({ length: region.h }, (_, i) =>
    opaqueCount(image, region, 'row', region.y + i),
  );
  const cols = Array.from({ length: region.w }, (_, i) =>
    opaqueCount(image, region, 'col', region.x + i),
  );
  const ys = rows.flatMap((count, i) => (count > noise ? [i] : []));
  const xs = cols.flatMap((count, i) => (count > noise ? [i] : []));
  const [y0, y1, x0, x1] = [ys[0], ys.at(-1), xs[0], xs.at(-1)];
  if (y0 === undefined || y1 === undefined || x0 === undefined || x1 === undefined) return null;
  return { x: region.x + x0, y: region.y + y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Détecte les éléments d'une planche séparés par du fond : bandes horizontales, puis
 * segments dans chaque bande. Résultat rangé ligne par ligne, de gauche à droite.
 */
export function detectBlobs(image: IndexedImage, minSize = 40): Box[] {
  const whole = { x: 0, y: 0, w: image.width, h: image.height };
  const rowProfile = Array.from({ length: image.height }, (_, y) =>
    opaqueCount(image, whole, 'row', y),
  );
  const blobs: Box[] = [];
  for (const [y0, y1] of runs(rowProfile, 3, 2)) {
    const band = { x: 0, y: y0, w: image.width, h: y1 - y0 };
    const colProfile = Array.from({ length: image.width }, (_, x) =>
      opaqueCount(image, band, 'col', x),
    );
    for (const [x0, x1] of runs(colProfile, 3, 2)) {
      const box = contentBox(image, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      if (box && box.w >= minSize && box.h >= minSize) blobs.push(box);
    }
  }
  return blobs;
}
