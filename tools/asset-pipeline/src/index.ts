/**
 * Pipeline d'assets d'Alkébulan (`pnpm assets:build`) :
 * planches brutes (art/raw) → palette → quantification → découpe → réduction 32 px →
 * nettoyage automatique → couleurs d'équipe → atlas Phaser (apps/game/public/assets/atlas)
 * + rapport de contrôle (tools/asset-pipeline/report.html).
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBackground, isTeamRed, rgbToHex, type Rgb } from './color';
import { encodePng, loadImage, type IndexedImage, type RgbaImage } from './image';
import { packAtlas, type AtlasFrame } from './pack';
import {
  FACTIONS,
  factionColors,
  loadOrCreatePalette,
  type Faction,
  type Palette,
} from './palette';
import {
  processBaseTiles,
  processBuildings,
  processRiver,
  processRoads,
  processUnit,
  type ProcessedFrames,
} from './process';
import { quantize, toRgba } from './quantize';
import { renderReport, type ReportImage } from './report';
import {
  BASE_TILES,
  BUILDING_TILES,
  RIVER_TILES,
  ROAD_TILES,
  UNIT_SHEETS,
  type UnitType,
} from './sources';
import { DIRECTIONS, maskName } from './autotile';
import { findDecors, findFigureSheets, processDecor, processFigure } from './combat';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RAW = join(ROOT, 'art/raw');
const CLEAN = join(ROOT, 'art/clean');
const PALETTE_PNG = join(ROOT, 'art/palette/antiqua-32.png');
const OUT = join(ROOT, 'apps/game/public/assets/atlas');
const REPORT = join(ROOT, 'tools/asset-pipeline/report.html');

const SAMPLES_PER_SHEET = 40_000;

/** Échantillons de couleurs, en nombre égal par planche (les grandes tuiles n'écrasent pas les unités). */
function sampleColors(images: readonly RgbaImage[]): Rgb[] {
  const samples: Rgb[] = [];
  for (const image of images) {
    const pixels = image.width * image.height;
    const step = Math.max(1, Math.floor(pixels / SAMPLES_PER_SHEET));
    for (let i = 0; i < pixels; i += step) {
      const r = image.data[i * 4] ?? 0;
      const g = image.data[i * 4 + 1] ?? 0;
      const b = image.data[i * 4 + 2] ?? 0;
      if (isBackground(r, g, b) || isTeamRed(r, g, b)) continue;
      samples.push([r, g, b]);
    }
  }
  return samples;
}

/** Une frame de art/clean/<nom>.png remplace la sortie automatique (même taille exigée). */
async function applyCleanOverrides(
  processed: ProcessedFrames,
  palette: Palette,
  team: boolean,
): Promise<void> {
  for (const [name, frame] of processed.frames) {
    const path = join(CLEAN, `${name}.png`);
    if (!existsSync(path)) continue;
    const clean = quantize(await loadImage(path), palette, { team });
    if (clean.width !== frame.width || clean.height !== frame.height) {
      processed.warnings.push(
        `${name} : art/clean ignoré (${clean.width}×${clean.height} au lieu de ${frame.width}×${frame.height})`,
      );
      continue;
    }
    processed.frames.set(name, clean);
    processed.info.push(`${name} : remplacé par art/clean`);
  }
}

async function writeAtlas(key: string, frames: readonly AtlasFrame[]): Promise<void> {
  const { png, json } = await packAtlas(frames, `${key}.png`);
  await writeFile(join(OUT, `${key}.png`), png);
  await writeFile(join(OUT, `${key}.json`), `${JSON.stringify(json, null, 1)}\n`);
}

const asAtlasFrames = (frames: Map<string, IndexedImage>, colors: readonly Rgb[]): AtlasFrame[] =>
  [...frames].map(([name, frame]) => ({ name, image: toRgba(frame, colors) }));

async function reportImage(
  label: string,
  frame: IndexedImage,
  colors: readonly Rgb[],
): Promise<ReportImage> {
  return { label, png: await encodePng(toRgba(frame, colors)) };
}

function allMasks(): string[] {
  const masks: string[] = [];
  for (let bits = 0; bits < 16; bits++)
    masks.push(maskName(DIRECTIONS.map((_, i) => Boolean(bits & (1 << i)))));
  return masks;
}

function autotileSummary(kind: string, frames: Map<string, IndexedImage>, prefix: string) {
  const found = [...frames.keys()]
    .filter((n) => n.startsWith(prefix))
    .map((n) => n.slice(prefix.length));
  const bases = new Set(found.map((n) => n.replace(/-\d+$/, '')));
  return { kind, found, missing: allMasks().filter((mask) => !bases.has(mask)) };
}

async function main(): Promise<void> {
  const started = Date.now();
  const unitTypes = Object.keys(UNIT_SHEETS) as UnitType[];
  const load = (file: string) => loadImage(join(RAW, file));

  const unitSheets = new Map<UnitType, RgbaImage>();
  for (const type of unitTypes) unitSheets.set(type, await load(UNIT_SHEETS[type]));
  const baseSheet = await load(BASE_TILES.file);
  const roadSheet = await load(ROAD_TILES.file);
  const riverSheet = await load(RIVER_TILES.file);
  const buildingSheet = await load(BUILDING_TILES.file);

  const { palette, created } = await loadOrCreatePalette(PALETTE_PNG, async () =>
    sampleColors([...unitSheets.values(), baseSheet, roadSheet, riverSheet, buildingSheet]),
  );

  const warnings: string[] = [];
  const info: string[] = [];
  const collect = (processed: ProcessedFrames) => {
    warnings.push(...processed.warnings);
    info.push(...processed.info);
    return processed;
  };

  // Unités et bâtiments : rouges d'équipe repérés ; terrains : jamais.
  const units = new Map<UnitType, ProcessedFrames>();
  for (const [type, sheet] of unitSheets) {
    const processed = processUnit(type, quantize(sheet, palette, { team: true }), palette);
    await applyCleanOverrides(processed, palette, true);
    units.set(type, collect(processed));
  }
  const terrain = new Map<string, IndexedImage>();
  for (const processed of [
    processBaseTiles(quantize(baseSheet, palette, { team: false })),
    processRoads(quantize(roadSheet, palette, { team: false }), palette),
    processRiver(quantize(riverSheet, palette, { team: false }), palette),
  ]) {
    await applyCleanOverrides(processed, palette, false);
    collect(processed);
    for (const [name, frame] of processed.frames) terrain.set(name, frame);
  }
  const buildings = collect(
    processBuildings(quantize(buildingSheet, palette, { team: true }), palette),
  );
  await applyCleanOverrides(buildings, palette, true);

  // Scènes de combat : figurants par peuple et décors, découverts dans art/raw.
  const figures = new Map<Faction, Map<string, IndexedImage>>();
  for (const [people, sheets] of await findFigureSheets(RAW, warnings)) {
    const frames = new Map<string, IndexedImage>();
    for (const sheet of sheets) {
      const processed = processFigure(
        people,
        sheet.key,
        quantize(await loadImage(sheet.path), palette, { team: true }),
        palette,
      );
      await applyCleanOverrides(processed, palette, true);
      collect(processed);
      for (const [name, frame] of processed.frames) frames.set(name, frame);
    }
    figures.set(people, frames);
  }
  const decors = new Map<string, IndexedImage>();
  for (const decor of await findDecors(RAW, warnings)) {
    const processed = collect(
      processDecor(decor.key, quantize(await loadImage(decor.path), palette, { team: false })),
    );
    for (const [name, frame] of processed.frames) decors.set(name, frame);
  }

  // ——— Atlas ———
  // On vide le dossier sans le supprimer : un serveur de dev Vite en cours le surveille.
  await mkdir(OUT, { recursive: true });
  for (const file of await readdir(OUT))
    await rm(join(OUT, file), { recursive: true, force: true });
  await writeAtlas('terrain', asAtlasFrames(terrain, palette.colors));

  const buildingFrames: AtlasFrame[] = [];
  for (const [name, frame] of buildings.frames) {
    if (name.endsWith('/neutre')) {
      buildingFrames.push({ name, image: toRgba(frame, palette.colors) });
      continue;
    }
    for (const faction of FACTIONS) {
      buildingFrames.push({
        name: name.replace(/\/rouge$/, `/${faction}`),
        image: toRgba(frame, factionColors(palette, faction)),
      });
    }
  }
  await writeAtlas('buildings', buildingFrames);

  for (const faction of FACTIONS) {
    const colors = factionColors(palette, faction);
    await writeAtlas(
      `units-${faction}`,
      [...units.values()].flatMap((processed) => asAtlasFrames(processed.frames, colors)),
    );
  }

  // Figurants : un atlas par peuple, dans sa couleur. Décors : une image chacun (320×384,
  // trop grands pour partager un atlas). combat.json dit au jeu ce qui existe.
  for (const [people, frames] of figures) {
    await writeAtlas(`combat-${people}`, asAtlasFrames(frames, factionColors(palette, people)));
  }
  for (const [name, frame] of decors) {
    await writeFile(
      join(OUT, `${name.replace('/', '-')}.png`),
      await encodePng(toRgba(frame, palette.colors)),
    );
  }
  const manifest = {
    peoples: Object.fromEntries(
      [...figures].map(([people, frames]) => [
        people,
        [...new Set([...frames.keys()].map((name) => name.split('/')[1]))].sort(),
      ]),
    ),
    decors: [...decors.keys()].map((name) => name.split('/')[1]).sort(),
  };
  await writeFile(join(OUT, 'combat.json'), `${JSON.stringify(manifest, null, 1)}\n`);

  // ——— Rapport ———
  const colorsOf = (faction: Faction) => factionColors(palette, faction);
  const unitReports = [];
  for (const [type, processed] of units) {
    const red = [];
    const blue = [];
    for (const [name, frame] of processed.frames) {
      red.push(await reportImage(name, frame, colorsOf('carthage')));
      blue.push(await reportImage(name, frame, colorsOf('koush')));
    }
    unitReports.push({ type, red, blue });
  }
  const idleUnits: ReportImage[] = [];
  for (const [type, processed] of units) {
    const idle = processed.frames.get(`unit/${type}/idle/0`);
    if (idle) idleUnits.push(await reportImage(type, idle, colorsOf('carthage')));
  }
  const baseTerrains: ReportImage[] = [];
  const terrainImages: ReportImage[] = [];
  for (const [name, frame] of terrain) {
    const image = await reportImage(name, frame, palette.colors);
    terrainImages.push(image);
    if (
      /^terrain\/[a-z]+\/0$/.test(name) ||
      name === 'terrain/route/ew' ||
      name === 'terrain/riviere/ns'
    )
      baseTerrains.push(image);
  }
  const buildingImages: ReportImage[] = [];
  for (const frame of buildingFrames) {
    if (frame.name.endsWith('/kemet') || frame.name.endsWith('/aksoum')) continue;
    buildingImages.push({ label: frame.name, png: await encodePng(frame.image) });
  }

  await writeFile(
    REPORT,
    renderReport({
      palette: palette.colors.map((color, index) => ({
        hex: rgbToHex(color),
        role:
          index === palette.outlineIndex ? 'contour' : index >= palette.teamStart ? 'équipe' : '',
      })),
      paletteCreated: created,
      units: unitReports,
      idleOnTerrain: { units: idleUnits, terrains: baseTerrains },
      terrain: terrainImages,
      seams: baseTerrains,
      buildings: buildingImages,
      combat: {
        figures: await Promise.all(
          [...figures].map(async ([people, frames]) => ({
            people,
            images: await Promise.all(
              [...frames].map(([name, frame]) =>
                reportImage(name, frame, factionColors(palette, people)),
              ),
            ),
          })),
        ),
        decors: await Promise.all(
          [...decors].map(([name, frame]) => reportImage(name, frame, palette.colors)),
        ),
      },
      autotiles: [
        autotileSummary('route', terrain, 'terrain/route/'),
        autotileSummary('rivière', terrain, 'terrain/riviere/'),
      ],
      warnings,
      info,
    }),
  );

  const frameCount =
    terrain.size +
    buildingFrames.length +
    [...units.values()].reduce((n, p) => n + p.frames.size, 0) * FACTIONS.length;
  console.log(
    `[assets] ${frameCount} frames, ${FACTIONS.length + 2} atlas → apps/game/public/assets/atlas`,
  );
  console.log(
    `[assets] palette : ${created ? 'créée' : 'chargée'} (${PALETTE_PNG.replace(`${ROOT}/`, '')})`,
  );
  console.log(
    `[assets] combat : ${figures.size} peuple(s) (${[...figures.keys()].join(', ') || 'aucun'}), ${decors.size} décor(s)`,
  );
  for (const line of info) console.log(`  · ${line}`);
  for (const line of warnings) console.log(`  ! ${line}`);
  console.log(
    `[assets] rapport : tools/asset-pipeline/report.html (${((Date.now() - started) / 1000).toFixed(1)} s)`,
  );
}

main().catch((error: unknown) => {
  console.error('[assets] échec :', error);
  process.exitCode = 1;
});
