/**
 * Combats dessinés (prototype) : art/raw/combat-dessine → apps/game/public/assets/combat-hd.
 *
 * - `peuples/<peuple>/<unité>/poses.png` : 4 poses (repos, attaque, coup reçu, à terre) ;
 * - `peuples/<peuple>/<unité>/<planche>.png` : séquences (repos, attaque, charge, chute,
 *   sonne), 4 images chacune, à la même échelle que les poses ;
 * - `portraits/<peuple>.png` : 4 expressions → une image par expression (256×256) ;
 * - `decors/<nom>.png` : décor recadré en 1920×1152 ;
 * - `reglages.json` : corrections d'échelle par planche et calages par animation.
 * Écrit `manifest.json` (ce qui existe, pour le jeu ; le reste est provisoire) et
 * `A-FAIRE.md` dans le dossier source (ce qui reste à dessiner).
 * Lancement : `pnpm assets:dessin`.
 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { COMBAT_UNITS, PEOPLES } from './combat';
import {
  DRAWN_DECOR_H,
  DRAWN_DECOR_W,
  DRAWN_EXPRESSIONS,
  DRAWN_POSES,
  FIGURE_IDLE_HEIGHT,
  PORTRAIT_SIZE,
  SEQUENCE_CELLS,
  SEQUENCE_SHEETS,
  classifyDrawnPath,
  figureScale,
  layoutSequence,
  separateFrames,
  portraitScale,
  removeBackground,
  splitColumns,
  todoReport,
} from './drawn';
import type { PlacedFrame } from './drawn';
import { loadImage, type Box, type RgbaImage } from './image';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SOURCE = join(ROOT, 'art/raw/combat-dessine');
const OUT = join(ROOT, 'apps/game/public/assets/combat-hd');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

interface PoseInfo {
  readonly w: number;
  readonly h: number;
}

interface AnimInfo {
  readonly frames: number;
  readonly w: number;
  readonly h: number;
  readonly originX: number;
  readonly originY: number;
}

interface DrawnManifest {
  figures: Record<string, Record<string, Record<string, PoseInfo>>>;
  /** Séquences par peuple et unité : images `<anim>-<i>.webp`. */
  anims: Record<string, Record<string, Record<string, AnimInfo>>>;
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

/**
 * Image d'une séquence : le dessin (séparé de ses voisins) posé à sa place dans le cadre
 * commun de l'animation, transparent autour, puis mis à l'échelle.
 */
async function writeFrame(
  placed: PlacedFrame,
  layout: { readonly width: number; readonly height: number },
  w: number,
  h: number,
  output: string,
): Promise<void> {
  const piece = await raw(placed.frame.pixels).png().toBuffer();
  const frame = placed;
  const canvas = await sharp({
    create: {
      width: Math.ceil(layout.width),
      height: Math.ceil(layout.height),
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: piece, left: Math.round(frame.dx), top: Math.round(frame.dy) }])
    .png()
    .toBuffer();
  await sharp(canvas)
    .resize({ width: w, height: h, kernel: 'lanczos3' })
    .webp({ quality: 90, alphaQuality: 100, effort: 5 })
    .toFile(output);
}

interface Settings {
  /** Correction d'échelle par planche : « carthage/fantassin/repos » → 0.92. */
  readonly scales: Record<string, number>;
  /**
   * Calage par animation, en pixels de l'image finale (positif : le personnage recule) :
   * « carthage/fantassin » → { attack: 12 }.
   */
  readonly shifts: Record<string, Record<string, number>>;
}

const numbers = (value: unknown): Record<string, number> =>
  value && typeof value === 'object'
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, number] => typeof entry[1] === 'number',
        ),
      )
    : {};

/**
 * Réglages (`reglages.json`) : ChatGPT ne dessine pas toujours le personnage à la même taille
 * d'une planche à l'autre (« echelles »), et un petit saut entre deux animations se corrige
 * à l'œil (« calages »).
 */
async function readSettings(): Promise<Settings> {
  try {
    const data = JSON.parse(await readFile(join(SOURCE, 'reglages.json'), 'utf8')) as {
      echelles?: unknown;
      calages?: unknown;
    };
    const shifts: Record<string, Record<string, number>> = {};
    for (const [unit, anims] of Object.entries(data.calages ?? {})) shifts[unit] = numbers(anims);
    return { scales: numbers(data.echelles), shifts };
  } catch {
    return { scales: {}, shifts: {} };
  }
}

/** Toutes les images sous `dir`, en chemins relatifs avec des « / ». */
async function listImages(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
      .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split('\\').join('/'))
      .sort();
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  const manifest: DrawnManifest = { figures: {}, anims: {}, portraits: [], decors: [] };
  /** Échelle des poses de chaque unité : les séquences s'y alignent. */
  const poseScales = new Map<string, number>();
  const settings = await readSettings();
  const files = await listImages(SOURCE);
  if (files.length === 0)
    console.log(`[dessin] aucune image dans ${SOURCE} : tout est provisoire.`);
  /** Chemins reconnus, sans extension : pour la liste « à faire ». */
  const present = new Set<string>();

  // Les séquences en dernier : elles prennent l'échelle des poses de leur unité.
  const isSequence = (f: string) =>
    classifyDrawnPath(f, PEOPLES, COMBAT_UNITS)?.kind === 'sequence';
  const ordered = [...files.filter((f) => !isSequence(f)), ...files.filter(isSequence)];
  for (const file of ordered) {
    const role = classifyDrawnPath(file, PEOPLES, COMBAT_UNITS);
    if (!role) {
      console.warn(`[dessin] ${file} : emplacement non reconnu, ignoré (voir A-FAIRE.md).`);
      continue;
    }
    present.add(file.replace(/\.[a-z]+$/i, '').toLowerCase());
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
    const image = removeBackground(source, { pockets: role.kind !== 'portrait' });

    if (role.kind === 'sequence') {
      const key = `${role.people}/${role.unit}`;
      const frames = separateFrames(image, SEQUENCE_CELLS);
      // Sans planche de poses : la première image debout fait la hauteur de référence.
      const base =
        poseScales.get(key) ?? FIGURE_IDLE_HEIGHT / (frames[0]?.box.h ?? FIGURE_IDLE_HEIGHT);
      const fix = settings.scales[`${key}/${role.sheet}`] ?? 1;
      const scale = base * fix;
      const dir = join(OUT, role.people, role.unit);
      await mkdir(dir, { recursive: true });
      const cellWidth = image.width / SEQUENCE_CELLS;
      const anims = ((manifest.anims[role.people] ??= {})[role.unit] ??= {});
      for (const group of SEQUENCE_SHEETS[role.sheet]) {
        const layout = layoutSequence(frames, cellWidth, group);
        const w = Math.max(1, Math.round(layout.width * scale));
        const h = Math.max(1, Math.round(layout.height * scale));
        for (const [i, frame] of layout.frames.entries()) {
          await writeFrame(frame, layout, w, h, join(dir, `${layout.anim}-${i}.webp`));
        }
        // Calage manuel (pixels de l'image finale, positif = le personnage recule).
        const shift = settings.shifts[key]?.[layout.anim] ?? 0;
        anims[layout.anim] = {
          frames: layout.frames.length,
          w,
          h,
          originX: Number((layout.originX + shift / w).toFixed(4)),
          originY: Number(layout.originY.toFixed(4)),
        };
      }
      console.log(
        `[dessin] ${file} → ${role.people}/${role.unit} : ${SEQUENCE_SHEETS[role.sheet].map((g) => g.anim).join(', ')} (×${scale.toFixed(2)}${fix !== 1 ? `, correction ×${fix}` : ''})`,
      );
      continue;
    }

    if (role.kind === 'figure') {
      const frames = separateFrames(image, DRAWN_POSES.length);
      const scale = figureScale(frames.map((frame) => frame.box));
      poseScales.set(`${role.people}/${role.unit}`, scale);
      const dir = join(OUT, role.people, role.unit);
      await mkdir(dir, { recursive: true });
      const poses: Record<string, PoseInfo> = {};
      for (const [i, pose] of DRAWN_POSES.entries()) {
        const frame = frames[i];
        if (frame) {
          poses[pose] = await writePiece(
            frame.pixels,
            { x: 0, y: 0, w: frame.box.w, h: frame.box.h },
            scale,
            join(dir, `${pose}.webp`),
          );
        }
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
  await mkdir(SOURCE, { recursive: true });
  await writeFile(join(SOURCE, 'A-FAIRE.md'), todoReport(present, PEOPLES, COMBAT_UNITS));
  console.log(`[dessin] manifeste écrit, liste à jour : art/raw/combat-dessine/A-FAIRE.md`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
