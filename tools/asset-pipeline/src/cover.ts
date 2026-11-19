/**
 * Images de la page de garde : art/static → apps/game/public/assets/garde.
 *
 * Les sources (illustration de jaquette, logo) font plusieurs Mo en PNG. On produit des
 * WebP redimensionnés à la taille d'affichage maximale (écran 2×), plus petits d'un ordre
 * de grandeur. Lancement : `pnpm assets:cover`.
 *
 * Écran de choix du peuple : portrait du dirigeant découpé dans la planche du peuple
 * (`art/reference/peuples/<peuple>.png`) et écusson (`art/static/peuples/<peuple>-ecusson.png`,
 * fond blanc rendu transparent) → `peuples/<peuple>-roi.webp` et `-ecusson.webp`.
 */
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SOURCE = join(ROOT, 'art/static');
const OUT = join(ROOT, 'apps/game/public/assets/garde');

interface CoverImage {
  readonly source: string;
  readonly output: string;
  /** Largeur maximale en pixels (l'image n'est jamais agrandie). */
  readonly width: number;
  readonly quality: number;
}

const IMAGES: readonly CoverImage[] = [
  { source: 'jacquette-illusté.png', output: 'jaquette.webp', width: 1086, quality: 80 },
  { source: 'logo-alkebulan.png', output: 'logo.webp', width: 768, quality: 85 },
];

/** Cadre du portrait du dirigeant dans chaque planche de peuple (1536×864). */
const KING_CROPS: Readonly<
  Record<string, { left: number; top: number; width: number; height: number }>
> = {
  koush: { left: 30, top: 95, width: 570, height: 640 },
  carthage: { left: 10, top: 130, width: 600, height: 570 },
  almoravides: { left: 40, top: 150, width: 600, height: 490 },
  ashanti: { left: 12, top: 152, width: 488, height: 530 },
};

/** Fond blanc relié aux bords → transparent (le blanc à l'intérieur de l'écusson reste). */
export function clearWhiteBackground(data: Buffer, width: number, height: number): void {
  const isWhite = (i: number) =>
    (data[i * 4] ?? 0) > 232 && (data[i * 4 + 1] ?? 0) > 232 && (data[i * 4 + 2] ?? 0) > 232;
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  while (stack.length > 0) {
    const i = stack.pop() ?? 0;
    if (seen[i] || !isWhite(i)) continue;
    seen[i] = 1;
    data[i * 4 + 3] = 0;
    const x = i % width;
    if (x > 0) stack.push(i - 1);
    if (x < width - 1) stack.push(i + 1);
    if (i >= width) stack.push(i - width);
    if (i < width * (height - 1)) stack.push(i + width);
  }
}

async function writePeoples(): Promise<void> {
  const out = join(OUT, 'peuples');
  await mkdir(out, { recursive: true });
  for (const [people, crop] of Object.entries(KING_CROPS)) {
    await sharp(join(ROOT, 'art/reference/peuples', `${people}.png`))
      .extract(crop)
      .resize({ width: 480, height: 560, fit: 'cover', position: 'top' })
      .webp({ quality: 82, effort: 6 })
      .toFile(join(out, `${people}-roi.webp`));
    const { data, info } = await sharp(join(SOURCE, 'peuples', `${people}-ecusson.png`))
      .resize(256, 256)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    clearWhiteBackground(data, info.width, info.height);
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .trim()
      .webp({ quality: 88, alphaQuality: 100, effort: 6 })
      .toFile(join(out, `${people}-ecusson.webp`));
    console.log(`[garde] ${people} : portrait du dirigeant et écusson`);
  }
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  await writePeoples();
  for (const image of IMAGES) {
    const input = join(SOURCE, image.source);
    const output = join(OUT, image.output);
    await sharp(input)
      .resize({ width: image.width, withoutEnlargement: true })
      .webp({ quality: image.quality, alphaQuality: 100, effort: 6 })
      .toFile(output);
    const before = (await stat(input)).size;
    const after = (await stat(output)).size;
    console.log(
      `[garde] ${image.source} → ${image.output} (${Math.round(before / 1024)} Ko → ${Math.round(after / 1024)} Ko)`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
