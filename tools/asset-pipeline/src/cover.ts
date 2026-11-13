/**
 * Images de la page de garde : art/static → apps/game/public/assets/garde.
 *
 * Les sources (illustration de jaquette, logo) font plusieurs Mo en PNG. On produit des
 * WebP redimensionnés à la taille d'affichage maximale (écran 2×), plus petits d'un ordre
 * de grandeur. Lancement : `pnpm assets:cover`.
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
  { source: 'logo-alkebulan.png', output: 'logo.webp', width: 900, quality: 88 },
];

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
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
