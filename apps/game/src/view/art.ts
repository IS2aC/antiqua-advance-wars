import Phaser from 'phaser';
import type { GameState, PlayerId, TerrainType, UnitType } from '@antiqua/engine';

/**
 * Accès aux atlas produits par le pipeline (`pnpm assets:build`). Si les atlas manquent,
 * le jeu retombe sur les placeholders (carrés de couleur).
 */

export const TERRAIN_ATLAS = 'terrain';
export const BUILDING_ATLAS = 'buildings';
export const PLAYERS_WITH_ART: readonly PlayerId[] = ['koush', 'carthage', 'kemet', 'aksoum'];
export const unitAtlas = (owner: PlayerId) => `units-${owner}`;

export function preloadArt(scene: Phaser.Scene): void {
  scene.load.setPath('assets/atlas/');
  scene.load.atlas(TERRAIN_ATLAS, 'terrain.png', 'terrain.json');
  scene.load.atlas(BUILDING_ATLAS, 'buildings.png', 'buildings.json');
  for (const owner of PLAYERS_WITH_ART) {
    scene.load.atlas(unitAtlas(owner), `units-${owner}.png`, `units-${owner}.json`);
  }
  scene.load.setPath('');
}

export function hasArt(scene: Phaser.Scene): boolean {
  return scene.textures.exists(TERRAIN_ATLAS) && scene.textures.exists(BUILDING_ATLAS);
}

export function hasUnitArt(scene: Phaser.Scene, owner: PlayerId): boolean {
  return scene.textures.exists(unitAtlas(owner));
}

// ——— Animations d'unités ———

export type WalkDirection = 'right' | 'up' | 'down';

export const idleAnimation = (owner: PlayerId, type: UnitType) => `${owner}:${type}:idle`;
export const walkAnimation = (owner: PlayerId, type: UnitType, direction: WalkDirection) =>
  `${owner}:${type}:walk:${direction}`;

const UNIT_TYPES: readonly UnitType[] = [
  'fantassin',
  'lancier',
  'archers',
  'cavalerie',
  'char',
  'catapulte',
];

/** Repos : boucle 1-2-3-2 à 150 ms (docs/art-bible.md) ; marche : 4 images par direction. */
export function createUnitAnimations(scene: Phaser.Scene): void {
  for (const owner of PLAYERS_WITH_ART) {
    const key = unitAtlas(owner);
    if (!scene.textures.exists(key)) continue;
    for (const type of UNIT_TYPES) {
      if (!scene.anims.exists(idleAnimation(owner, type))) {
        scene.anims.create({
          key: idleAnimation(owner, type),
          frames: [0, 1, 2, 1].map((i) => ({ key, frame: `unit/${type}/idle/${i}` })),
          frameRate: 1000 / 150,
          repeat: -1,
        });
      }
      for (const direction of ['right', 'up', 'down'] as const) {
        if (scene.anims.exists(walkAnimation(owner, type, direction))) continue;
        scene.anims.create({
          key: walkAnimation(owner, type, direction),
          frames: [0, 1, 2, 3].map((i) => ({ key, frame: `unit/${type}/walk/${direction}/${i}` })),
          frameRate: 10,
          repeat: -1,
        });
      }
    }
  }
}

// ——— Choix des tuiles ———

/** Hachage stable d'une case : même carte = mêmes variantes à chaque partie. */
function tileHash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

const DIRS = [
  ['n', 0, -1],
  ['e', 1, 0],
  ['s', 0, 1],
  ['w', -1, 0],
] as const;

/** Index des frames d'atlas, groupées par préfixe (« terrain/route/ns » → ses variantes). */
export class TerrainFrames {
  private readonly groups = new Map<string, string[]>();

  constructor(scene: Phaser.Scene) {
    for (const name of scene.textures.get(TERRAIN_ATLAS).getFrameNames()) {
      // « terrain/plaine/2 » (variante numérotée) et « terrain/route/ns-2 » (doublon) → groupe.
      const base = name.replace(/(-\d+|\/\d+)$/, '');
      const group = this.groups.get(base) ?? [];
      group.push(name);
      this.groups.set(base, group);
    }
    for (const group of this.groups.values()) group.sort();
  }

  /** Frame de la case (x, y), ou null s'il n'y a pas de tuile pour ce terrain. */
  frameFor(state: GameState, x: number, y: number): string | null {
    const terrain = this.terrain(state, x, y);
    if (terrain === undefined) return null;
    switch (terrain) {
      case 'route':
        return this.autotile(
          'route',
          this.mask(state, x, y, ['route', 'pont', 'village', 'caserne', 'qg'], false),
          x,
          y,
        );
      case 'riviere':
        return this.autotile('riviere', this.mask(state, x, y, ['riviere', 'pont'], true), x, y);
      case 'pont': {
        const river = this.mask(state, x, y, ['riviere'], true);
        const riverNorthSouth = river.includes('n') || river.includes('s');
        return this.pick(`terrain/pont/${riverNorthSouth ? 'ew' : 'ns'}`, x, y);
      }
      case 'village':
      case 'caserne':
      case 'qg':
        return this.pick('terrain/plaine', x, y);
      default:
        return this.pick(`terrain/${terrain}`, x, y);
    }
  }

  private terrain(state: GameState, x: number, y: number): TerrainType | undefined {
    if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) return undefined;
    return state.map.tiles[y * state.map.width + x];
  }

  /** Côtés reliés à une case du même réseau ; `edges` : le bord de carte prolonge le réseau. */
  private mask(
    state: GameState,
    x: number,
    y: number,
    joins: readonly TerrainType[],
    edges: boolean,
  ): string {
    const name = DIRS.filter(([, dx, dy]) => {
      const neighbor = this.terrain(state, x + dx, y + dy);
      return neighbor === undefined ? edges : joins.includes(neighbor);
    })
      .map(([letter]) => letter)
      .join('');
    return name === '' ? 'o' : name;
  }

  /** Pièce exacte si elle existe, sinon celle qui partage le plus de connexions. */
  private autotile(kind: string, mask: string, x: number, y: number): string | null {
    const exact = this.pick(`terrain/${kind}/${mask}`, x, y);
    if (exact) return exact;
    const wanted = new Set(mask === 'o' ? [] : mask.split(''));
    let best: string | null = null;
    let bestScore = -Infinity;
    for (const base of this.groups.keys()) {
      if (!base.startsWith(`terrain/${kind}/`)) continue;
      const candidate = base.slice(`terrain/${kind}/`.length);
      const has = new Set(candidate === 'o' ? [] : candidate.split(''));
      let score = 0;
      for (const letter of 'nesw') {
        if (wanted.has(letter) && has.has(letter)) score += 2;
        else if (wanted.has(letter) !== has.has(letter)) score -= 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = base;
      }
    }
    return best ? this.pick(best, x, y) : null;
  }

  private pick(base: string, x: number, y: number): string | null {
    const group = this.groups.get(base);
    if (!group || group.length === 0) return null;
    return group[tileHash(x, y) % group.length] ?? null;
  }
}

export function buildingFrame(type: string, owner: PlayerId | null): string {
  return `building/${type}/${owner ?? 'neutre'}`;
}
