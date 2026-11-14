/**
 * Combats dessinés (prototype) : art/raw/proto-combat → apps/game/public/assets/combat-hd.
 *
 * - `<peuple>-<unité>.png` : 4 poses (repos, attaque, coup reçu, à terre) → une image par pose ;
 * - `portrait-<peuple>.png` : 4 expressions → une image par expression (256×256) ;
 * - `decor-<nom>.png` : décor recadré en 1920×1152.
 * Plus `manifest.json`, que le jeu lit pour savoir ce qui existe (le reste est provisoire).
 * Lancement : `pnpm assets:dessin`.
 */
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { COMBAT_UNITS, PEOPLES } from './combat';
import {
  DRAWN_DECOR_H,
  DRAWN_DECOR_W,
  DRAWN_EXPRESSIONS,
  DRAWN_POSES,
  PORTRAIT_SIZE,
  classifyDrawnFile,
  figureScale,
  portraitScale,
  removeBackground,
  splitColumns,
} from './drawn';
import { loadImage, type Box, type RgbaImage } from './image';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SOURCE = join(ROOT, 'art/raw/proto-combat');
const OUT = join(ROOT, 'apps/game/public/assets/combat-hd');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

interface PoseInfo {
  readonly w: number;
  readonly h: number;
}

interface DrawnManifest {
  figures: Record<string, Record<string, Record<string, PoseInfo>>>;
  portraits: string[];
  decors: string[];
}

function raw(image: RgbaImage) {
  return sharp(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.length), {
    raw: { width: image.width, height: image.height, channels: 4 },
  });
}

/** Découpe un morceau, le met à l'échelle et l'écrit en WebP ; renvoie sa taille finale. */
async function writePiece(
  image: RgbaImage,
  box: Box,
  scale: number,
  output: string,
): Promise<PoseInfo> {
  const w = Math.max(1, Math.round(box.w * scale));
  const h = Math.max(1, Math.round(box.h * scale));
  // Passage par un PNG intermédiaire : sharp n'enchaîne pas extract puis resize sur du brut.
  const piece = await raw(image)
    .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
    .png()
    .toBuffer();
  await sharp(piece)
    .resize({ width: w, height: h, kernel: 'lanczos3' })
    .webp({ quality: 90, alphaQuality: 100, effort: 5 })
    .toFile(output);
  return { w, h };
}

async function main(): Promise<void> {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  const manifest: DrawnManifest = { figures: {}, portraits: [], decors: [] };
  let files: string[] = [];
  try {
    files = (await readdir(SOURCE)).filter((f) => IMAGE_EXTENSIONS.has(extname(f).toLowerCase()));
  } catch {
    console.log(`[dessin] ${SOURCE} absent : tout restera provisoire.`);
  }

  for (const file of files.sort()) {
    const role = classifyDrawnFile(parse(file).name, PEOPLES, COMBAT_UNITS);
    if (!role) {
      console.warn(`[dessin] ${file} : nom non reconnu, ignoré (voir docs/proto-combat.md).`);
      continue;
    }
    const input = join(SOURCE, file);

    if (role.kind === 'decor') {
      await sharp(input)
        .resize({ width: DRAWN_DECOR_W, height: DRAWN_DECOR_H, fit: 'cover', position: 'centre' })
        .webp({ quality: 85, effort: 5 })
        .toFile(join(OUT, `decor-${role.name}.webp`));
      manifest.decors.push(role.name);
      console.log(`[dessin] ${file} → décor « ${role.name} »`);
      continue;
    }

    const source = await loadImage(input);
    const image = removeBackground(source, { pockets: role.kind === 'figure' });

    if (role.kind === 'figure') {
      const boxes = splitColumns(image, DRAWN_POSES.length);
      const scale = figureScale(boxes);
      const dir = join(OUT, role.people, role.unit);
      await mkdir(dir, { recursive: true });
      const poses: Record<string, PoseInfo> = {};
      for (const [i, pose] of DRAWN_POSES.entries()) {
        const box = boxes[i];
        if (box) poses[pose] = await writePiece(image, box, scale, join(dir, `${pose}.webp`));
      }
      (manifest.figures[role.people] ??= {})[role.unit] = poses;
      console.log(
        `[dessin] ${file} → ${role.people}/${role.unit} : ${Object.keys(poses).length} poses (×${scale.toFixed(2)})`,
      );
      continue;
    }

    // Cadre carré pris en haut : la tête et le haut des épaules.
    const boxes = splitColumns(image, DRAWN_EXPRESSIONS.length).map((box) => ({
      ...box,
      h: Math.min(box.h, box.w),
    }));
    const scale = portraitScale(boxes);
    const dir = join(OUT, 'portraits', role.people);
    await mkdir(dir, { recursive: true });
    for (const [i, expression] of DRAWN_EXPRESSIONS.entries()) {
      const box = boxes[i];
      if (!box) continue;
      // Chaque expression est posée en bas et au centre d'un carré transparent.
      const tmp = join(dir, `${expression}.tmp.webp`);
      const size = await writePiece(image, box, scale, tmp);
      await sharp({
        create: {
          width: PORTRAIT_SIZE,
          height: PORTRAIT_SIZE,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          {
            input: tmp,
            left: Math.round((PORTRAIT_SIZE - size.w) / 2),
            top: PORTRAIT_SIZE - size.h,
          },
        ])
        .webp({ quality: 90, alphaQuality: 100 })
        .toFile(join(dir, `${expression}.webp`));
      await rm(tmp);
    }
    manifest.portraits.push(role.people);
    console.log(`[dessin] ${file} → portraits « ${role.people} »`);
  }

  await writeFile(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[dessin] manifeste écrit : ${OUT}/manifest.json`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
