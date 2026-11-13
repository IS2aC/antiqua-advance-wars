import {
  TRANSPARENT,
  blitIndexed,
  createIndexed,
  getIndex,
  opaqueBounds,
  setIndex,
  shiftIndexed,
  type IndexedImage,
} from './image';

/**
 * Nettoyage automatique qui remplace la retouche manuelle (docs/art-bible.md).
 * Chaque fonction renvoie une nouvelle image ou modifie la copie qu'on lui donne.
 */

const NEIGHBORS_8 = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;
const NEIGHBORS_4 = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

/** Supprime les îlots de moins de `minSize` pixels (poussière, franges isolées). */
export function removeSpecks(image: IndexedImage, minSize = 3): number {
  const seen = new Uint8Array(image.width * image.height);
  let removed = 0;
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || image.indices[start] === TRANSPARENT) continue;
    const component: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const current = stack.pop() ?? 0;
      component.push(current);
      const cx = current % image.width;
      const cy = Math.floor(current / image.width);
      for (const [dx, dy] of NEIGHBORS_8) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
        const next = ny * image.width + nx;
        if (seen[next] || image.indices[next] === TRANSPARENT) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    if (component.length < minSize) {
      for (const index of component) image.indices[index] = TRANSPARENT;
      removed += component.length;
    }
  }
  return removed;
}

/**
 * Contour 1 px : tout pixel transparent qui touche (4-voisinage) un pixel opaque
 * qui n'est pas déjà sombre devient couleur de contour. Le contour existant de l'image
 * IA est conservé ; on ne double pas un trait déjà sombre.
 */
export function addOutline(
  image: IndexedImage,
  outlineIndex: number,
  isDark: (index: number) => boolean,
): IndexedImage {
  const result: IndexedImage = { ...image, indices: image.indices.slice() };
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (getIndex(image, x, y) !== TRANSPARENT) continue;
      const touchesLight = NEIGHBORS_4.some(([dx, dy]) => {
        const neighbor = getIndex(image, x + dx, y + dy);
        return neighbor !== TRANSPARENT && !isDark(neighbor);
      });
      if (touchesLight) setIndex(result, x, y, outlineIndex);
    }
  }
  return result;
}

/**
 * Place `content` dans un cadre, centré horizontalement, posé en bas avec une marge
 * (1 px par défaut, la place du contour sous les pieds).
 */
export function placeInFrame(
  content: IndexedImage,
  frameW: number,
  frameH: number,
  bottomMargin = 1,
): IndexedImage {
  const frame = createIndexed(frameW, frameH);
  blitIndexed(
    frame,
    content,
    Math.floor((frameW - content.width) / 2),
    frameH - bottomMargin - content.height,
  );
  return frame;
}

/** Pose les pieds sur la dernière ligne du cadre (la plus basse ligne opaque descend en bas). */
export function dropToFloor(frame: IndexedImage): IndexedImage {
  const bounds = opaqueBounds(frame);
  if (!bounds) return frame;
  const gap = frame.height - (bounds.y + bounds.h);
  return gap === 0 ? frame : shiftIndexed(frame, 0, gap);
}

/** Proportion de pixels opaques dans le coin bas-droit (zone des PV), de 0 à 1. */
export function cornerLoad(frame: IndexedImage, size = 10): number {
  let opaque = 0;
  for (let y = frame.height - size; y < frame.height; y++) {
    for (let x = frame.width - size; x < frame.width; x++) {
      if (getIndex(frame, x, y) !== TRANSPARENT) opaque++;
    }
  }
  return opaque / (size * size);
}

export function countIndices(frame: IndexedImage, predicate: (index: number) => boolean): number {
  let count = 0;
  for (const index of frame.indices) if (index !== TRANSPARENT && predicate(index)) count++;
  return count;
}
