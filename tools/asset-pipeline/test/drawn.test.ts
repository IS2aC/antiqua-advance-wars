import { describe, expect, it } from 'vitest';
import {
  FIGURE_IDLE_HEIGHT,
  borderColors,
  classifyDrawnFile,
  feetCenterX,
  layoutSequence,
  figureScale,
  removeBackground,
  splitColumns,
  trimBox,
} from '../src/drawn';
import type { RgbaImage } from '../src/image';

type Rgba = readonly [number, number, number, number];

function image(width: number, height: number, fill: (x: number, y: number) => Rgba): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4);
  }
  return { width, height, data };
}

const alphaAt = (img: RgbaImage, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3];

const MAGENTA: Rgba = [255, 0, 255, 255];
const INK: Rgba = [30, 20, 15, 255];
const CREAM: Rgba = [250, 245, 230, 255];

describe('classifyDrawnFile', () => {
  const peoples = ['koush', 'carthage'];
  const units = ['fantassin', 'archers'];
  it('reconnaît poses, portraits et décors', () => {
    expect(classifyDrawnFile('carthage-fantassin', peoples, units)).toEqual({
      kind: 'figure',
      people: 'carthage',
      unit: 'fantassin',
    });
    expect(classifyDrawnFile('portrait-koush', peoples, units)).toEqual({
      kind: 'portrait',
      people: 'koush',
    });
    expect(classifyDrawnFile('decor-savane', peoples, units)).toEqual({
      kind: 'decor',
      name: 'savane',
    });
  });
  it('ignore les noms inconnus', () => {
    expect(classifyDrawnFile('rome-fantassin', peoples, units)).toBeNull();
    expect(classifyDrawnFile('koush-elephant', peoples, units)).toBeNull();
    expect(classifyDrawnFile('photo', peoples, units)).toBeNull();
  });
});

describe('removeBackground', () => {
  it('retire un fond magenta uni mais garde le clair entouré de contour', () => {
    // Carré d'encre 10×10 au milieu, avec un intérieur crème (comme une tunique).
    const src = image(30, 30, (x, y) => {
      if (x >= 10 && x < 20 && y >= 10 && y < 20) {
        return x === 10 || x === 19 || y === 10 || y === 19 ? INK : CREAM;
      }
      return MAGENTA;
    });
    const out = removeBackground(src);
    expect(alphaAt(out, 0, 0)).toBe(0);
    expect(alphaAt(out, 5, 15)).toBe(0);
    expect(alphaAt(out, 10, 10)).toBe(255);
    expect(alphaAt(out, 15, 15)).toBe(255);
  });

  it('retire un faux damier de transparence', () => {
    const src = image(32, 32, (x, y) => {
      if (x >= 12 && x < 20 && y >= 12 && y < 20) return INK;
      return (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0
        ? [255, 255, 255, 255]
        : [204, 204, 204, 255];
    });
    expect(borderColors(src).length).toBeGreaterThanOrEqual(2);
    const out = removeBackground(src);
    expect(alphaAt(out, 0, 0)).toBe(0);
    expect(alphaAt(out, 4, 0)).toBe(0);
    expect(alphaAt(out, 15, 15)).toBe(255);
  });

  it('ne touche pas une image déjà transparente', () => {
    const src = image(10, 10, (x) => (x < 5 ? [0, 0, 0, 0] : INK));
    expect(removeBackground(src)).toBe(src);
  });
});

describe('splitColumns', () => {
  /** Quatre « personnages » séparés par des colonnes vides. */
  const sheet = image(200, 50, (x, y) => {
    const inFigure = [10, 60, 110, 160].some((start) => x >= start && x < start + 30);
    return inFigure && y >= 5 && y < 45 ? INK : [0, 0, 0, 0];
  });

  it('suit les colonnes vides', () => {
    const boxes = splitColumns(sheet, 4);
    expect(boxes.map((b) => b.x)).toEqual([10, 60, 110, 160]);
    expect(boxes.every((b) => b.w === 30 && b.h === 40 && b.y === 5)).toBe(true);
  });

  it('fusionne un morceau détaché (lance) avec son voisin le plus proche', () => {
    const withSpear = image(220, 50, (x, y) => {
      const inFigure = [10, 60, 110, 160].some((start) => x >= start && x < start + 30);
      const spear = x >= 192 && x < 200 && y >= 5 && y < 45;
      return (inFigure || spear) && y >= 5 && y < 45 ? INK : [0, 0, 0, 0];
    });
    const boxes = splitColumns(withSpear, 4);
    expect(boxes).toHaveLength(4);
    expect(boxes[3]).toMatchObject({ x: 160, w: 40 });
  });

  it('retombe sur des colonnes égales si les poses se touchent', () => {
    const solid = image(200, 50, (_x, y) => (y >= 5 && y < 45 ? INK : [0, 0, 0, 0]));
    const boxes = splitColumns(solid, 4);
    expect(boxes.map((b) => b.x)).toEqual([0, 50, 100, 150]);
  });
});

describe('cadrage', () => {
  it('trimBox serre le dessin', () => {
    const src = image(20, 20, (x, y) => (x >= 3 && x < 8 && y >= 4 && y < 15 ? INK : [0, 0, 0, 0]));
    expect(trimBox(src, { x: 0, y: 0, w: 20, h: 20 })).toEqual({ x: 3, y: 4, w: 5, h: 11 });
  });
  it('la pose de repos donne l’échelle de toutes les poses', () => {
    expect(figureScale([{ x: 0, y: 0, w: 100, h: 840 }])).toBe(FIGURE_IDLE_HEIGHT / 840);
  });
});

describe('poches de fond enfermées', () => {
  /** Anneau d'encre fermé, posé sur un fond (damier ou uni), intérieur = `inside`. */
  const ring = (outside: (x: number, y: number) => Rgba, inside: (x: number, y: number) => Rgba) =>
    image(40, 40, (x, y) => {
      const inBox = x >= 8 && x < 32 && y >= 8 && y < 32;
      const edge = x === 8 || x === 31 || y === 8 || y === 31;
      if (inBox && edge) return INK;
      return inBox ? inside(x, y) : outside(x, y);
    });
  const checker = (x: number, y: number): Rgba =>
    (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 ? [255, 255, 255, 255] : [204, 204, 204, 255];

  it('retire un damier enfermé (entre l’arc et la corde)', () => {
    const out = removeBackground(ring(checker, checker), { pockets: true });
    expect(alphaAt(out, 20, 20)).toBe(0);
    expect(alphaAt(out, 8, 8)).toBe(255);
  });

  it('garde une tunique crème unie enfermée', () => {
    const out = removeBackground(
      ring(checker, () => CREAM),
      { pockets: true },
    );
    expect(alphaAt(out, 20, 20)).toBe(255);
  });

  it('retire du magenta enfermé', () => {
    const out = removeBackground(
      ring(
        () => MAGENTA,
        () => MAGENTA,
      ),
      { pockets: true },
    );
    expect(alphaAt(out, 20, 20)).toBe(0);
  });
});

describe('séquences « caméra fixe »', () => {
  it('reconnaît les planches de séquence', () => {
    expect(classifyDrawnFile('carthage-fantassin-attaque', ['carthage'], ['fantassin'])).toEqual({
      kind: 'sequence',
      people: 'carthage',
      unit: 'fantassin',
      sheet: 'attaque',
    });
    expect(classifyDrawnFile('carthage-fantassin-danse', ['carthage'], ['fantassin'])).toBeNull();
  });

  it('garde la position de chaque dessin dans sa case et ancre aux pieds', () => {
    // Deux cases de 50 px ; le second dessin est 6 px plus à droite dans sa case.
    const sheet = image(100, 40, (x, y) => {
      const first = x >= 10 && x < 20 && y >= 10 && y < 40;
      const second = x >= 66 && x < 76 && y >= 10 && y < 40;
      return first || second ? INK : [0, 0, 0, 0];
    });
    const boxes = splitColumns(sheet, 2);
    expect(feetCenterX(sheet, boxes[0]!)).toBeCloseTo(14.5);
    const layout = layoutSequence(sheet, boxes, 50, { anim: 'run', from: 0, count: 2 });
    expect(layout.width).toBe(16);
    expect(layout.frames.map((f) => f.dx)).toEqual([0, 6]);
    expect(layout.originX).toBeCloseTo(4.5 / 16);
    expect(layout.originY).toBe(1);
  });
});
