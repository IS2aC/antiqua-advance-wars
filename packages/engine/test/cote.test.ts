import { describe, expect, it } from 'vitest';
import {
  COTE,
  COTE_ROWS,
  applyAction,
  chooseGreedyAction,
  createGame,
  movementCost,
  reachableTiles,
} from '../src/index';

describe('carte « La Côte des Comptoirs »', () => {
  it('fait 20×14 cases, symétrique nord/sud, avec 60 % de mer', () => {
    expect(COTE.width).toBe(20);
    expect(COTE.height).toBe(14);
    const h = COTE_ROWS.length;
    for (let y = 0; y < h; y++) {
      expect(COTE_ROWS[y]?.length).toBe(20);
      expect(COTE_ROWS[h - 1 - y]).toBe(COTE_ROWS[y]);
    }
    const sea = COTE.tiles.filter((t) => t === 'mer').length;
    expect(sea / COTE.tiles.length).toBeCloseTo(0.6, 2);
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

  it('un seul couloir de terre, le long du bord ouest, relie les deux côtes', () => {
    // Au milieu de la carte, seule la colonne 0 est de la terre.
    for (const y of [5, 6, 7, 8]) {
      const row = COTE_ROWS[y]!;
      expect(row[0]).toBe('.');
      expect(row.slice(1).replace(/w/g, '')).toBe('');
    }
    const state = createGame(COTE, { seed: 1 });
    const foot = state.units.find((u) => u.owner === 'koush')!;
    expect(reachableTiles(state, foot.id).length).toBeGreaterThan(1);
  });

  it('la cavalerie peut aller de sa côte au couloir et jusqu’à la côte adverse', () => {
    // Parcours en largeur sur le terrain praticable pour une monture.
    const ok = (x: number, y: number) =>
      movementCost(COTE.tiles[y * COTE.width + x]!, 'monture') !== null;
    const seen = new Set<string>(['17,1']);
    const queue = [{ x: 17, y: 1 }];
    while (queue.length > 0) {
      const p = queue.shift()!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const x = p.x + dx;
        const y = p.y + dy;
        const key = `${x},${y}`;
        if (x < 0 || y < 0 || x >= COTE.width || y >= COTE.height || seen.has(key)) continue;
        if (!ok(x, y)) continue;
        seen.add(key);
        queue.push({ x, y });
      }
    }
    expect(seen.has('17,12')).toBe(true);
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
