/**
 * Planches des combats dessinés : les images d'une unité (poses et séquences) regroupées
 * en un seul fichier, détourées au plus juste, avec leur description au format atlas de
 * Phaser (JSON « hash », images rognées). Une vingtaine de fichiers par duel au lieu de 300.
 */
import { readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp, { type WebpOptions } from 'sharp';

/** Largeur maximale d'une planche (les GPU mobiles acceptent 4096 dans les deux sens). */
const MAX_WIDTH = 2048;
const MAX_HEIGHT = 4096;
/** Marge transparente autour de chaque image : pas de bavure du voisin au filtrage. */
const PADDING = 2;

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Cadre des pixels visibles (alpha > 0) ; image vide : un pixel. */
export function alphaBounds(data: Uint8Array, width: number, height: number): Box {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Rangement en étagères : les plus hautes d'abord, de gauche à droite, nouvelle étagère
 * quand la ligne est pleine. Renvoie la position de chaque boîte et la taille de la planche.
 */
export function packShelves(
  sizes: readonly { readonly w: number; readonly h: number }[],
  maxWidth: number,
  padding: number,
): { positions: { x: number; y: number }[]; width: number; height: number } {
  const order = sizes.map((_, i) => i).sort((a, b) => (sizes[b]?.h ?? 0) - (sizes[a]?.h ?? 0));
  const positions: { x: number; y: number }[] = sizes.map(() => ({ x: 0, y: 0 }));
  let x = padding;
  let y = padding;
  let shelf = 0;
  let width = 0;
  for (const i of order) {
    const size = sizes[i];
    if (!size) continue;
    if (x + size.w + padding > maxWidth && x > padding) {
      y += shelf + padding;
      x = padding;
      shelf = 0;
    }
    positions[i] = { x, y };
    x += size.w + padding;
    shelf = Math.max(shelf, size.h);
    width = Math.max(width, x);
  }
  return { positions, width, height: y + shelf + padding };
}

interface Piece {
  readonly name: string;
  readonly source: { readonly w: number; readonly h: number };
  readonly trim: Box;
  readonly pixels: Buffer;
}

/**
 * Regroupe les images `.webp` du dossier d'une unité en `atlas.webp` + `atlas.json`, puis
 * supprime les images séparées. Le nom de chaque image (sans extension) devient son cadre.
 */
export async function packUnitDir(
  dir: string,
  webp: WebpOptions,
): Promise<{ frames: number; width: number; height: number }> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.webp') && f !== 'atlas.webp');
  const pieces: Piece[] = [];
  for (const file of files.sort()) {
    const { data, info } = await sharp(join(dir, file))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const trim = alphaBounds(data, info.width, info.height);
    const pixels = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .extract({ left: trim.x, top: trim.y, width: trim.w, height: trim.h })
      .png()
      .toBuffer();
    pieces.push({
      name: file.replace(/\.webp$/, ''),
      source: { w: info.width, h: info.height },
      trim,
      pixels,
    });
  }
  const { positions, width, height } = packShelves(
    pieces.map((p) => ({ w: p.trim.w, h: p.trim.h })),
    MAX_WIDTH,
    PADDING,
  );
  if (height > MAX_HEIGHT) {
    throw new Error(`Planche trop haute (${height} px > ${MAX_HEIGHT}) : ${dir}`);
  }
  await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(
      pieces.map((piece, i) => ({
        input: piece.pixels,
        left: positions[i]?.x ?? 0,
        top: positions[i]?.y ?? 0,
      })),
    )
    .webp(webp)
    .toFile(join(dir, 'atlas.webp'));

  const frames: Record<string, unknown> = {};
  pieces.forEach((piece, i) => {
    const at = positions[i] ?? { x: 0, y: 0 };
    frames[piece.name] = {
      frame: { x: at.x, y: at.y, w: piece.trim.w, h: piece.trim.h },
      rotated: false,
      trimmed: true,
      spriteSourceSize: piece.trim,
      sourceSize: piece.source,
    };
  });
  const json = { frames, meta: { image: 'atlas.webp', size: { w: width, h: height }, scale: 1 } };
  await writeFile(join(dir, 'atlas.json'), `${JSON.stringify(json)}\n`);
  for (const file of files) await rm(join(dir, file));
  return { frames: pieces.length, width, height };
}
