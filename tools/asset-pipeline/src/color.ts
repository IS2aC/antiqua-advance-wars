export type Rgb = readonly [number, number, number];
export type Lab = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Teinte en degrés (0–360), saturation et valeur (0–1). */
export function rgbToHsv([r, g, b]: Rgb): { h: number; s: number; v: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max / 255 };
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Conversion sRGB → CIELAB (D65), pour comparer les couleurs comme l'œil. */
export function rgbToLab(rgb: Rgb): Lab {
  const [r, g, b] = rgb.map(linear) as [number, number, number];
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function labDistance(a: Lab, b: Lab): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

/**
 * Fond magenta (#FF00FF) et ses franges : rouge et bleu forts et proches, vert faible.
 * Les planches IA ne sont jamais d'un magenta pur.
 */
export function isBackground(r: number, g: number, b: number): boolean {
  return r > 110 && b > 110 && g < 0.62 * Math.min(r, b) && Math.abs(r - b) < 90;
}

/**
 * Rouge d'équipe : teinte rouge franche et très saturée. La peau, le bois et l'or,
 * plus orangés ou moins saturés, n'en font pas partie.
 */
export function isTeamRed(r: number, g: number, b: number): boolean {
  const { h, s, v } = rgbToHsv([r, g, b]);
  return (h >= 345 || h <= 14) && s >= 0.66 && v >= 0.28;
}
