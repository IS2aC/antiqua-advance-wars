import sharp from 'sharp';

/** Image RGBA en mémoire (4 octets par pixel, ligne par ligne). */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/** Image en indices de palette ; -1 = transparent. */
export interface IndexedImage {
  readonly width: number;
  readonly height: number;
  readonly indices: Int16Array;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const TRANSPARENT = -1;

export async function loadImage(path: string): Promise<RgbaImage> {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
  };
}

export async function encodePng(image: RgbaImage): Promise<Buffer> {
  const buffer = Buffer.from(image.data.buffer, image.data.byteOffset, image.data.length);
  return sharp(buffer, { raw: { width: image.width, height: image.height, channels: 4 } })
    .png()
    .toBuffer();
}

export function createIndexed(width: number, height: number): IndexedImage {
  return { width, height, indices: new Int16Array(width * height).fill(TRANSPARENT) };
}

export function getIndex(image: IndexedImage, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return TRANSPARENT;
  return image.indices[y * image.width + x] ?? TRANSPARENT;
}

export function setIndex(image: IndexedImage, x: number, y: number, value: number): void {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  image.indices[y * image.width + x] = value;
}

/** Copie `source` dans `target` en (dx, dy) ; les pixels transparents ne recouvrent rien. */
export function blitIndexed(
  target: IndexedImage,
  source: IndexedImage,
  dx: number,
  dy: number,
): void {
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const value = getIndex(source, x, y);
      if (value !== TRANSPARENT) setIndex(target, x + dx, y + dy, value);
    }
  }
}

/** Boîte englobante des pixels opaques, ou null si l'image est vide. */
export function opaqueBounds(image: IndexedImage): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (getIndex(image, x, y) === TRANSPARENT) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Décale le contenu de l'image (ce qui sort du cadre est perdu). */
export function shiftIndexed(image: IndexedImage, dx: number, dy: number): IndexedImage {
  const shifted = createIndexed(image.width, image.height);
  blitIndexed(shifted, image, dx, dy);
  return shifted;
}

export function unionBox(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null;
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
