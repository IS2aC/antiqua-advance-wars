import { describe, expect, it } from 'vitest';
import {
  FIGURE_IDLE_HEIGHT,
  borderColors,
  classifyDrawnPath,
  todoReport,
  feetCenterX,
  layoutSequence,
  separateFrames,
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

describe('classifyDrawnPath', () => {
  const peoples = ['koush', 'carthage'];
  const units = ['fantassin', 'archers'];
  it('reconnaît poses, séquences, portraits et décors par leur dossier', () => {
    expect(classifyDrawnPath('peuples/carthage/fantassin/poses.png', peoples, units)).toEqual({
      kind: 'figure',
      people: 'carthage',
      unit: 'fantassin',
    });
    expect(classifyDrawnPath('peuples/koush/archers/attaque.png', peoples, units)).toEqual({
      kind: 'sequence',
      people: 'koush',
      unit: 'archers',
      sheet: 'attaque',
    });
    expect(classifyDrawnPath('portraits/koush.png', peoples, units)).toEqual({
      kind: 'portrait',
      people: 'koush',
    });
    expect(classifyDrawnPath('decors/savane.webp', peoples, units)).toEqual({
      kind: 'decor',
      name: 'savane',
    });
  });
  it('reconnaît les planches communes à tous les peuples', () => {
    expect(classifyDrawnPath('unites/archers/poses.png', peoples, units)).toEqual({
      kind: 'figure',
      people: null,
      unit: 'archers',
    });
    expect(classifyDrawnPath('unites/fantassin/sonne.png', peoples, units)).toEqual({
      kind: 'sequence',
      people: null,
      unit: 'fantassin',
      sheet: 'sonne',
    });
    expect(classifyDrawnPath('unites/fantassin/danse.png', peoples, units)).toBeNull();
    expect(classifyDrawnPath('unites/elephant/poses.png', peoples, units)).toBeNull();
  });
  it('ignore les emplacements inconnus', () => {
    expect(classifyDrawnPath('peuples/rome/fantassin/poses.png', peoples, units)).toBeNull();
    expect(classifyDrawnPath('peuples/koush/elephant/poses.png', peoples, units)).toBeNull();
    expect(classifyDrawnPath('peuples/koush/archers/danse.png', peoples, units)).toBeNull();
    expect(classifyDrawnPath('photo.png', peoples, units)).toBeNull();
  });
});

describe('todoReport', () => {
  it('compte les planches présentes et liste ce qui manque', () => {
    const report = todoReport(
      new Set([
        'unites/archers/poses',
        'unites/archers/repos',
        'peuples/koush/fantassin/poses',
        'portraits/koush',
        'decors/savane',
      ]),
      ['koush'],
      ['archers', 'fantassin'],
    );
    expect(report).toContain('**Planches communes : 2 / 12**');
    expect(report).toContain('| Archers | ✅ | ✅ | · | · | · | · |');
    expect(report).toContain('| Fantassin | (Koush) | · | · | · | · | · |');
    expect(report).toContain('- `peuples/koush/fantassin/poses`');
    expect(report).toContain('✅ Koush');
    expect(report).toContain('savane');
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
  it('garde la position de chaque dessin dans sa case et ancre aux pieds', () => {
    // Deux cases de 50 px ; le second dessin est 6 px plus à droite dans sa case.
    const sheet = image(100, 40, (x, y) => {
      const first = x >= 10 && x < 20 && y >= 10 && y < 40;
      const second = x >= 66 && x < 76 && y >= 10 && y < 40;
      return first || second ? INK : [0, 0, 0, 0];
    });
    const frames = separateFrames(sheet, 2);
    expect(feetCenterX(sheet, frames[0]!.box)).toBeCloseTo(14.5);
    const layout = layoutSequence(frames, 50, { anim: 'run', from: 0, count: 2 });
    expect(layout.width).toBe(16);
    expect(layout.frames.map((f) => f.dx)).toEqual([0, 6]);
    expect(layout.originX).toBeCloseTo(4.5 / 16);
    expect(layout.originY).toBe(1);
  });

  it('sépare des dessins dont les cadres se chevauchent', () => {
    // Case 1 : un corps (10..30) ; case 2 : un corps (60..80) avec une traînée qui
    // déborde dans la case 1 (40..58), reliée à lui. Aucune colonne vide entre les deux.
    const sheet = image(100, 40, (x, y) => {
      const body1 = x >= 10 && x < 30 && y >= 5 && y < 40;
      const body2 = x >= 60 && x < 80 && y >= 5 && y < 40;
      const trail = x >= 25 && x < 60 && y >= 20 && y < 22 && x >= 40;
      const foot1 = x >= 30 && x < 45 && y >= 37 && y < 40;
      return body1 || body2 || trail || foot1 ? INK : [0, 0, 0, 0];
    });
    const [a, b] = separateFrames(sheet, 2);
    expect(a!.box).toEqual({ x: 10, y: 5, w: 35, h: 35 });
    expect(b!.box).toEqual({ x: 40, y: 5, w: 40, h: 35 });
    // Le pied du premier dessin (x 40..44, en bas) n'apparaît pas dans le second.
    const alphaIn = (f: typeof b, x: number, y: number) =>
      f!.pixels.data[((y - f!.box.y) * f!.box.w + (x - f!.box.x)) * 4 + 3];
    expect(alphaIn(b, 42, 38)).toBe(0);
    expect(alphaIn(b, 42, 21)).toBe(255);
  });
});

describe('morceaux détachés', () => {
  it('garde un bout de lance qui déborde chez le voisin avec son dessin', () => {
    // Case 1 (0..50) : un corps (10..30) et un bout de lance détaché (32..70) dont le centre
    // tombe dans la case 2. Case 2 : un corps (80..95).
    const sheet = image(100, 40, (x, y) => {
      const body1 = x >= 10 && x < 30 && y >= 5 && y < 40;
      const spear = x >= 32 && x < 70 && y >= 15 && y < 17;
      const body2 = x >= 80 && x < 95 && y >= 5 && y < 40;
      return body1 || spear || body2 ? INK : [0, 0, 0, 0];
    });
    const [a, b] = separateFrames(sheet, 2);
    expect(a!.box).toEqual({ x: 10, y: 5, w: 60, h: 35 });
    expect(b!.box).toEqual({ x: 80, y: 5, w: 15, h: 35 });
  });
});

describe('pieds', () => {
  it('ignore la hampe de lance posée au sol', () => {
    // Hampe fine (x 2..4) et deux pieds larges (x 10..20 et 30..40), tout en bas.
    const feet = image(50, 20, (x, y) => {
      if (y < 17) return [0, 0, 0, 0];
      const spear = x >= 2 && x < 4;
      const foot = (x >= 10 && x < 20) || (x >= 30 && x < 40);
      return spear || foot ? INK : [0, 0, 0, 0];
    });
    expect(feetCenterX(feet, { x: 0, y: 0, w: 50, h: 20 })).toBeCloseTo(24.5);
  });
});

describe('repère partagé', () => {
  it('cale une animation sur une autre image de la planche', () => {
    // Case 0 : dessin en l'air (bas à y 20) ; case 1 : dessin posé (bas à y 40), 4 px plus à droite.
    const sheet = image(100, 40, (x, y) => {
      const air = x >= 10 && x < 20 && y >= 5 && y < 20;
      const seated = x >= 64 && x < 74 && y >= 20 && y < 40;
      return air || seated ? INK : [0, 0, 0, 0];
    });
    const frames = separateFrames(sheet, 2);
    const layout = layoutSequence(frames, 50, { anim: 'sit', from: 0, count: 2, anchorFrom: 1 });
    // Cadre commun : x 10..24 (local), y 5..40 ; repère = pieds du dessin posé (x 18.5, y 40).
    expect(layout.originX).toBeCloseTo((18.5 - 10) / 14);
    expect(layout.originY).toBe(1);
  });
});
