import { describe, expect, it } from 'vitest';
import { connectionMask, isRoadColor, maskName } from '../src/autotile';
import { addOutline, cornerLoad, dropToFloor, removeSpecks } from '../src/autofix';
import { isBackground, isTeamRed, type Rgb } from '../src/color';
import { downscaleMajority } from '../src/downscale';
import { TRANSPARENT, createIndexed, getIndex, setIndex, type IndexedImage } from '../src/image';
import { packAtlas } from '../src/pack';
import { TEAM_RAMPS, factionColors, medianCut, type Palette } from '../src/palette';
import { quantize } from '../src/quantize';
import { detectBlobs } from '../src/slice';
import { hexToRgb, rgbToLab } from '../src/color';

function fill(
  image: IndexedImage,
  x0: number,
  y0: number,
  w: number,
  h: number,
  value: number,
): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setIndex(image, x, y, value);
}

const testPalette = (): Palette => {
  const colors: Rgb[] = [
    [200, 180, 80], // 0 herbe
    [210, 120, 60], // 1 route
    [60, 60, 60], // 2 gris
    hexToRgb('#2B1B17'), // 3 contour
    ...TEAM_RAMPS.carthage.map(hexToRgb), // 4–7 équipe
  ];
  return { colors, labs: colors.map(rgbToLab), outlineIndex: 3, teamStart: 4 };
};

describe('couleurs', () => {
  it('reconnaît le fond magenta et ses franges, pas les couleurs du jeu', () => {
    expect(isBackground(255, 0, 255)).toBe(true);
    expect(isBackground(236, 12, 240)).toBe(true);
    expect(isBackground(140, 30, 130)).toBe(true);
    expect(isBackground(210, 50, 40)).toBe(false); // tissu rouge
    expect(isBackground(150, 150, 150)).toBe(false); // pierre
  });

  it('distingue le rouge d’équipe de la peau, du bois et de l’or', () => {
    expect(isTeamRed(210, 50, 40)).toBe(true);
    expect(isTeamRed(120, 25, 30)).toBe(true);
    expect(isTeamRed(150, 90, 60)).toBe(false); // peau
    expect(isTeamRed(140, 80, 30)).toBe(false); // bois
    expect(isTeamRed(230, 170, 40)).toBe(false); // or
  });
});

describe('quantification et couleurs d’équipe', () => {
  it('envoie le fond en transparent et le rouge sur les rouges réservés', () => {
    const palette = testPalette();
    const data = new Uint8ClampedArray([255, 0, 255, 255, 205, 55, 45, 255, 205, 185, 85, 255]);
    const result = quantize({ width: 3, height: 1, data }, palette, { team: true });
    expect(result.indices[0]).toBe(TRANSPARENT);
    expect(result.indices[1]).toBeGreaterThanOrEqual(palette.teamStart);
    expect(result.indices[2]).toBe(0);
    const terrain = quantize({ width: 3, height: 1, data }, palette, { team: false });
    expect(terrain.indices[1]).toBeLessThan(palette.teamStart);
  });

  it('remplace exactement les 4 rouges par la rampe de la faction', () => {
    const colors = factionColors(testPalette(), 'koush');
    expect(colors.slice(4)).toEqual(TEAM_RAMPS.koush.map(hexToRgb));
    expect(colors.slice(0, 4)).toEqual(testPalette().colors.slice(0, 4));
  });

  it('coupe médiane : le nombre de couleurs demandé, triées par luminosité', () => {
    const samples: Rgb[] = [];
    for (let i = 0; i < 300; i++) samples.push([i % 255, (i * 7) % 255, (i * 13) % 255]);
    const colors = medianCut(samples, 8);
    expect(colors).toHaveLength(8);
    const lightness = colors.map((c) => rgbToLab(c)[0]);
    expect([...lightness].sort((a, b) => a - b)).toEqual(lightness);
  });
});

describe('découpe et réduction', () => {
  it('détecte les éléments séparés par du fond, ligne par ligne', () => {
    const sheet = createIndexed(200, 120);
    fill(sheet, 10, 10, 50, 50, 0);
    fill(sheet, 100, 10, 60, 45, 1);
    fill(sheet, 10, 70, 45, 45, 2);
    expect(detectBlobs(sheet, 20)).toEqual([
      { x: 10, y: 10, w: 50, h: 50 },
      { x: 100, y: 10, w: 60, h: 45 },
      { x: 10, y: 70, w: 45, h: 45 },
    ]);
  });

  it('vote majoritaire par bloc, sans moyenne', () => {
    const source = createIndexed(8, 8);
    fill(source, 0, 0, 8, 8, 0);
    fill(source, 0, 0, 3, 4, 1); // 12 px de 1 sur 16 dans le bloc haut-gauche
    const small = downscaleMajority(source, { x: 0, y: 0, w: 8, h: 8 }, 2, 2);
    expect([...small.indices]).toEqual([1, 0, 0, 0]);
  });

  it('un bloc majoritairement transparent reste transparent', () => {
    const source = createIndexed(4, 4);
    fill(source, 0, 0, 1, 1, 2);
    expect(downscaleMajority(source, { x: 0, y: 0, w: 4, h: 4 }, 1, 1).indices[0]).toBe(
      TRANSPARENT,
    );
  });
});

describe('nettoyage automatique', () => {
  it('supprime les pixels isolés et garde les formes', () => {
    const image = createIndexed(10, 10);
    setIndex(image, 0, 0, 1);
    fill(image, 4, 4, 3, 3, 1);
    expect(removeSpecks(image, 3)).toBe(1);
    expect(getIndex(image, 0, 0)).toBe(TRANSPARENT);
    expect(getIndex(image, 5, 5)).toBe(1);
  });

  it('ajoute un contour autour des pixels clairs, pas autour d’un trait déjà sombre', () => {
    const image = createIndexed(5, 5);
    setIndex(image, 2, 2, 0);
    const outlined = addOutline(image, 3, (index) => index === 3);
    expect(getIndex(outlined, 2, 1)).toBe(3);
    expect(getIndex(outlined, 1, 1)).toBe(TRANSPARENT); // 4-voisinage seulement
    const dark = createIndexed(5, 5);
    setIndex(dark, 2, 2, 3);
    expect(
      getIndex(
        addOutline(dark, 3, (index) => index === 3),
        2,
        1,
      ),
    ).toBe(TRANSPARENT);
  });

  it('pose les pieds sur la dernière ligne et mesure le coin des PV', () => {
    const frame = createIndexed(32, 32);
    fill(frame, 22, 10, 10, 10, 0);
    const dropped = dropToFloor(frame);
    expect(getIndex(dropped, 22, 31)).toBe(0);
    expect(cornerLoad(dropped)).toBe(1);
    expect(cornerLoad(frame)).toBe(0);
  });
});

describe('autotiling', () => {
  it('nomme les masques dans l’ordre n, e, s, w', () => {
    expect(maskName([true, false, true, false])).toBe('ns');
    expect(maskName([false, false, false, false])).toBe('o');
  });

  it('détecte les côtés où la route touche le bord', () => {
    const tile = createIndexed(32, 32);
    fill(tile, 0, 0, 32, 32, 0);
    fill(tile, 12, 0, 8, 20, 1); // route du nord au centre
    fill(tile, 12, 12, 20, 8, 1); // puis vers l'est
    expect(connectionMask(tile, testPalette().colors, isRoadColor)).toBe('ne');
  });
});

describe('atlas', () => {
  it('produit un JSON Phaser avec chaque frame et sa position', async () => {
    const image = { width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4) };
    const { png, json } = await packAtlas(
      [
        { name: 'unit/fantassin/idle/0', image },
        { name: 'unit/fantassin/idle/1', image },
      ],
      'units.png',
    );
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    const frames = (json as { frames: Record<string, { frame: { w: number } }> }).frames;
    expect(Object.keys(frames)).toEqual(['unit/fantassin/idle/0', 'unit/fantassin/idle/1']);
    expect(frames['unit/fantassin/idle/0']?.frame.w).toBe(32);
  });
});
