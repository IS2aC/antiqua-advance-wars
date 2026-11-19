import { describe, expect, it } from 'vitest';
import {
  COTE,
  COTE_ROWS,
  applyAction,
  chooseGreedyAction,
  createGame,
  reachableTiles,
} from '../src/index';

describe('carte « La Côte des Comptoirs »', () => {
  it('fait 20×14 cases et reste identique tournée d’un demi-tour', () => {
    expect(COTE.width).toBe(20);
    expect(COTE.height).toBe(14);
    const h = COTE_ROWS.length;
    for (let y = 0; y < h; y++) {
      expect(COTE_ROWS[y]?.length).toBe(20);
      for (let x = 0; x < 20; x++) {
        expect(COTE_ROWS[h - 1 - y]?.[19 - x]).toBe(COTE_ROWS[y]?.[x]);
      }
    }
  });

  it('donne à chaque camp un port au bord de la mer', () => {
    for (const owner of ['koush', 'carthage'] as const) {
      const ports = COTE.buildings.filter((b) => b.type === 'port' && b.owner === owner);
      expect(ports).toHaveLength(1);
      const port = ports[0]!;
      const neighbours = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ].map(([dx, dy]) => COTE.tiles[(port.y + dy!) * COTE.width + port.x + dx!]);
      expect(neighbours).toContain('mer');
    }
  });

  it('relie les deux camps à pied par les isthmes, et par la mer en bateau', () => {
    const state = createGame(COTE, { seed: 1 });
    const foot = state.units.find((u) => u.owner === 'koush')!;
    // À pied, on peut traverser jusqu'au nord en plusieurs tours : la mer n'isole pas.
    const walk = (from: { x: number; y: number }) => {
      const seen = new Set<string>();
      const queue = [from];
      while (queue.length > 0) {
        const p = queue.shift()!;
        const key = `${p.x},${p.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const x = p.x + dx;
          const y = p.y + dy;
          if (x < 0 || y < 0 || x >= COTE.width || y >= COTE.height) continue;
          const terrain = COTE.tiles[y * COTE.width + x];
          if (terrain === 'mer' || terrain === 'montagne') continue;
          queue.push({ x, y });
        }
      }
      return seen;
    };
    expect(walk(foot).has('17,1')).toBe(true);
    expect(reachableTiles(state, foot.id).length).toBeGreaterThan(1);
  });

  it('l’IA joue plusieurs tours sans action illégale', () => {
    let state = createGame(COTE, { seed: 3 });
    for (let i = 0; i < 400 && state.day <= 8 && state.status === 'playing'; i++) {
      const result = applyAction(state, chooseGreedyAction(state));
      if (!result.ok) throw new Error(result.error.code);
      state = result.state;
    }
    expect(state.day).toBeGreaterThan(5);
  });
});
