import { describe, expect, it } from 'vitest';
import { mulberry32, randomInt } from '../src/index';

function sequence(seed: number, length: number): number[] {
  const values: number[] = [];
  let current = seed;
  for (let i = 0; i < length; i++) {
    const draw = mulberry32(current);
    values.push(draw.value);
    current = draw.seed;
  }
  return values;
}

describe('PRNG mulberry32', () => {
  it('est déterministe pour une même graine', () => {
    expect(sequence(1234, 20)).toEqual(sequence(1234, 20));
  });

  it('donne des suites différentes pour des graines différentes', () => {
    expect(sequence(1, 5)).not.toEqual(sequence(2, 5));
  });

  it('renvoie des valeurs dans [0, 1) et fait avancer la graine', () => {
    let seed = 99;
    for (let i = 0; i < 1000; i++) {
      const draw = mulberry32(seed);
      expect(draw.value).toBeGreaterThanOrEqual(0);
      expect(draw.value).toBeLessThan(1);
      expect(draw.seed).not.toBe(seed);
      expect(Number.isInteger(draw.seed)).toBe(true);
      seed = draw.seed;
    }
  });

  it('randomInt couvre [0, max) uniformément à peu près', () => {
    const counts = new Array<number>(10).fill(0);
    let seed = 7;
    for (let i = 0; i < 10000; i++) {
      const draw = randomInt(seed, 10);
      counts[draw.value] = (counts[draw.value] ?? 0) + 1;
      seed = draw.seed;
    }
    for (const count of counts) {
      expect(count).toBeGreaterThan(800);
      expect(count).toBeLessThan(1200);
    }
  });
});
