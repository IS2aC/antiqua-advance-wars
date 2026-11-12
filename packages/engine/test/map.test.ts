import { describe, expect, it } from 'vitest';
import {
  GUE_DU_NIL,
  GUE_DU_NIL_ROWS,
  createGame,
  movementCost,
  parseAsciiMap,
  rotateRows,
} from '../src/index';
import type { MapDefinition, MoveType, PlayerId, Position } from '../src/index';

const { width, height, tiles } = GUE_DU_NIL;
const terrain = (x: number, y: number) => tiles[y * width + x];

/** Remplissage sans limite de mouvement, pour vérifier la connexité de la carte. */
function connected(
  moveType: MoveType,
  from: Position,
  to: Position,
  withBridges: boolean,
): boolean {
  const seen = new Set<string>([`${from.x},${from.y}`]);
  const queue: Position[] = [from];
  for (let current = queue.shift(); current; current = queue.shift()) {
    if (current.x === to.x && current.y === to.y) return true;
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const next = { x: current.x + dx, y: current.y + dy };
      const type = terrain(next.x, next.y);
      if (next.x < 0 || next.y < 0 || next.x >= width || next.y >= height || !type) continue;
      if (type === 'pont' && !withBridges) continue;
      if (movementCost(type, moveType) === null || seen.has(`${next.x},${next.y}`)) continue;
      seen.add(`${next.x},${next.y}`);
      queue.push(next);
    }
  }
  return false;
}

describe('carte « Le Gué du Nil »', () => {
  it('fait 20×14 cases et elle est symétrique par rotation de 180°', () => {
    expect([width, height, tiles.length]).toEqual([20, 14, 280]);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        expect(terrain(x, y)).toBe(terrain(width - 1 - x, height - 1 - y));
      }
    }
  });

  it('donne à chaque camp 1 QG, 2 casernes, 3 villages, et 4 villages neutres', () => {
    const count = (owner: PlayerId | null, type: string) =>
      GUE_DU_NIL.buildings.filter((b) => b.owner === owner && b.type === type).length;
    for (const owner of ['koush', 'carthage'] as const) {
      expect([count(owner, 'qg'), count(owner, 'caserne'), count(owner, 'village')]).toEqual([
        1, 2, 3,
      ]);
    }
    expect(GUE_DU_NIL.buildings.filter((b) => b.owner === null)).toHaveLength(4);
    expect(count(null, 'village')).toBe(4);
  });

  it('place le QG de Koush en bas à gauche et celui de Carthage en haut à droite', () => {
    const hq = (owner: PlayerId) =>
      GUE_DU_NIL.buildings.find((b) => b.type === 'qg' && b.owner === owner);
    expect(hq('koush')).toMatchObject({ x: 2, y: 12 });
    expect(hq('carthage')).toMatchObject({ x: 17, y: 1 });
  });

  it('a un fleuve avec 2 ponts, que seuls fantassins et lanciers passent à gué', () => {
    expect(tiles.filter((t) => t === 'pont')).toHaveLength(2);
    const koushHq = { x: 2, y: 12 };
    const carthageHq = { x: 17, y: 1 };
    expect(connected('roues', koushHq, carthageHq, true)).toBe(true);
    expect(connected('roues', koushHq, carthageHq, false)).toBe(false);
    expect(connected('monture', koushHq, carthageHq, false)).toBe(false);
    expect(connected('pied', koushHq, carthageHq, false)).toBe(true);
  });

  it('démarre avec 2 000 d’or et 2 fantassins par camp, Koush en premier', () => {
    const state = createGame(GUE_DU_NIL, { seed: 1 });
    expect(state.currentPlayer).toBe('koush');
    expect(state.players.map((p) => p.funds)).toEqual([2000, 2000]);
    expect(state.units.map((u) => `${u.owner}:${u.type}`)).toEqual([
      'koush:fantassin',
      'koush:fantassin',
      'carthage:fantassin',
      'carthage:fantassin',
    ]);
    expect(GUE_DU_NIL_ROWS).toHaveLength(14);
  });
});

describe('cartes en texte', () => {
  it('rejette une ligne de mauvaise longueur ou une lettre inconnue', () => {
    expect(() => parseAsciiMap(['...', '..'])).toThrow(/Ligne 1/);
    expect(() => parseAsciiMap(['.X.'])).toThrow(/Lettre inconnue/);
  });

  it('tourne une carte de 180°', () => {
    expect(rotateRows(['ab', 'cd'])).toEqual(['dc', 'ba']);
  });
});

describe('createGame — validation', () => {
  const valid: MapDefinition = {
    name: 'mini',
    width: 2,
    height: 1,
    tiles: ['qg', 'plaine'],
    buildings: [{ type: 'qg', x: 0, y: 0, owner: 'koush' }],
    units: [{ type: 'fantassin', owner: 'koush', x: 1, y: 0 }],
    players: ['koush', 'carthage'],
    startingFunds: 0,
  };

  it('accepte une carte cohérente', () => {
    expect(createGame(valid, { seed: 3 }).units).toHaveLength(1);
  });

  it.each<[string, Partial<MapDefinition>]>([
    ['cases', { tiles: ['plaine'] }],
    ['2 joueurs', { players: ['koush'] }],
    ['hors carte', { buildings: [{ type: 'qg', x: 5, y: 0, owner: 'koush' }] }],
    ['ne correspond pas', { buildings: [{ type: 'village', x: 0, y: 0, owner: 'koush' }] }],
    ['joueur absent', { buildings: [{ type: 'qg', x: 0, y: 0, owner: 'kemet' }] }],
    ['unité hors carte', { units: [{ type: 'fantassin', owner: 'koush', x: 0, y: 3 }] }],
    ["unité d'un joueur absent", { units: [{ type: 'fantassin', owner: 'aksoum', x: 0, y: 0 }] }],
    [
      'deux unités',
      {
        units: [
          { type: 'fantassin', owner: 'koush', x: 1, y: 0 },
          { type: 'lancier', owner: 'koush', x: 1, y: 0 },
        ],
      },
    ],
  ])('rejette une carte invalide (%s)', (message, patch) => {
    expect(() => createGame({ ...valid, ...patch }, { seed: 1 })).toThrow(message);
  });
});
