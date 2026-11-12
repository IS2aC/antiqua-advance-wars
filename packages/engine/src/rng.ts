/**
 * PRNG mulberry32. La graine est stockée dans l'état de partie et avance à chaque tirage :
 * deux parties lancées avec la même graine et les mêmes actions sont identiques.
 */
export interface RandomDraw {
  /** Valeur dans [0, 1). */
  readonly value: number;
  /** Graine suivante, à réinjecter dans l'état. */
  readonly seed: number;
}

export function mulberry32(seed: number): RandomDraw {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: next };
}

/** Tire un entier dans [0, max). */
export function randomInt(
  seed: number,
  max: number,
): { readonly value: number; readonly seed: number } {
  const draw = mulberry32(seed);
  return { value: Math.floor(draw.value * max), seed: draw.seed };
}
