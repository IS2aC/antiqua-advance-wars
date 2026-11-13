import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DECOR_H,
  DECOR_W,
  FIGURE_FRAME,
  figureLayout,
  findDecors,
  findFigureSheets,
  processDecor,
  processFigure,
} from '../src/combat';
import { hexToRgb, rgbToLab, type Rgb } from '../src/color';
import { TRANSPARENT, createIndexed, setIndex, type IndexedImage } from '../src/image';
import { TEAM_RAMPS, type Palette } from '../src/palette';

const palette = (): Palette => {
  const colors: Rgb[] = [
    [200, 180, 80],
    [90, 140, 200],
    hexToRgb('#2B1B17'),
    ...TEAM_RAMPS.carthage.map(hexToRgb),
  ];
  return { colors, labs: colors.map(rgbToLab), outlineIndex: 2, teamStart: 3 };
};

function fill(image: IndexedImage, x0: number, y0: number, w: number, h: number, value: number) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setIndex(image, x, y, value);
}

describe('gabarit des figurants', () => {
  it('5 lignes d’animation, 18 images nommées figure/<unité>/<anim>/<i>', () => {
    const layout = figureLayout('archers');
    expect(layout.cols).toBe(4);
    expect(layout.rows.map((row) => row.frames)).toEqual([4, 4, 4, 2, 4]);
    expect(layout.rows.map((row) => row.name(0))).toEqual([
      'figure/archers/idle/0',
      'figure/archers/walk/0',
      'figure/archers/attack/0',
      'figure/archers/hit/0',
      'figure/archers/death/0',
    ]);
  });

  it('découpe une planche 4×5 en images 64×64', () => {
    const cell = 100;
    const sheet = createIndexed(cell * 4, cell * 5);
    // Un personnage par case utile (avec un peu de rouge d'équipe), magenta ailleurs.
    figureLayout('fantassin').rows.forEach((row, r) => {
      for (let c = 0; c < row.frames; c++) {
        fill(sheet, c * cell + 30, r * cell + 20, 40, 75, 0);
        fill(sheet, c * cell + 40, r * cell + 40, 20, 10, 5);
      }
    });
    const result = processFigure('koush', 'fantassin', sheet, palette());
    expect(result.frames.size).toBe(18);
    const frame = result.frames.get('figure/fantassin/death/3');
    expect(frame?.width).toBe(FIGURE_FRAME);
    expect(frame?.height).toBe(FIGURE_FRAME);
    expect(result.warnings).toEqual([]);
  });
});

describe('décors', () => {
  it('recadre au format d’une moitié d’écran puis réduit à 320×384', () => {
    const sheet = createIndexed(1024, 1536);
    fill(sheet, 0, 0, 1024, 1536, 0);
    fill(sheet, 0, 768, 1024, 768, 1);
    const result = processDecor('plaine', sheet);
    const frame = result.frames.get('decor/plaine');
    expect([frame?.width, frame?.height]).toEqual([DECOR_W, DECOR_H]);
    expect(frame?.indices.includes(TRANSPARENT)).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it('signale un décor qui laisse du magenta', () => {
    const sheet = createIndexed(320, 384);
    fill(sheet, 0, 0, 320, 200, 0);
    expect(processDecor('foret', sheet).warnings[0]).toMatch(/magenta/);
  });
});

describe('découverte des planches', () => {
  it('trouve les planches par peuple et signale les noms inconnus', async () => {
    const raw = await mkdtemp(join(tmpdir(), 'antiqua-raw-'));
    await mkdir(join(raw, 'peuples/koush/combat'), { recursive: true });
    await mkdir(join(raw, 'peuples/atlantes/combat'), { recursive: true });
    await mkdir(join(raw, 'combat/decors'), { recursive: true });
    for (const file of [
      'peuples/koush/combat/archers.png',
      'peuples/koush/combat/fantassin.png',
      'peuples/koush/combat/dragon.png',
      'peuples/atlantes/combat/fantassin.png',
      'combat/decors/plaine.png',
      'combat/decors/lune.png',
    ]) {
      await writeFile(join(raw, file), '');
    }
    const warnings: string[] = [];
    const sheets = await findFigureSheets(raw, warnings);
    expect([...sheets.keys()]).toEqual(['koush']);
    expect(sheets.get('koush')?.map((s) => s.key)).toEqual(['archers', 'fantassin']);
    const decors = await findDecors(raw, warnings);
    expect(decors.map((d) => d.key)).toEqual(['plaine']);
    expect(warnings).toHaveLength(3);
  });
});
