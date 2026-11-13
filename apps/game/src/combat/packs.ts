import type Phaser from 'phaser';
import type { PlayerId, TerrainType, UnitType } from '@antiqua/engine';

/**
 * Packs de culture des scènes de combat, produits par le pipeline (`pnpm assets:build`) :
 * - `combat.json` : peuples et unités disponibles, décors disponibles ;
 * - `combat-<peuple>` : atlas des figurants 64×64 (frames `figure/<unité>/<anim>/<i>`) ;
 * - `decor-<terrain>` : décor d'une moitié d'écran (320×384).
 * Tout ce qui manque retombe sur la phase A (sprites de carte ×2, décors en tuiles).
 */

const MANIFEST = 'combat-manifest';
const PATH = 'assets/atlas/';

interface CombatManifest {
  readonly peoples: Readonly<Record<string, readonly string[]>>;
  readonly decors: readonly string[];
}

export type FigureAnim = 'idle' | 'walk' | 'attack' | 'hit' | 'death';

/** Nombre d'images et cadence de chaque animation (gabarit : docs/art-combat.md). */
const FIGURE_ANIMS: Readonly<Record<FigureAnim, { frames: number; rate: number; loop: boolean }>> =
  {
    idle: { frames: 4, rate: 6, loop: true },
    walk: { frames: 4, rate: 10, loop: true },
    attack: { frames: 4, rate: 12, loop: false },
    hit: { frames: 2, rate: 10, loop: false },
    death: { frames: 4, rate: 8, loop: false },
  };

export const figureAtlas = (people: PlayerId) => `combat-${people}`;
export const figureAnimation = (people: PlayerId, unit: UnitType, anim: FigureAnim) =>
  `${people}:${unit}:figure:${anim}`;
const decorKey = (terrain: string) => `decor-${terrain}`;

/** Charge le manifeste puis, dans la même passe, les atlas et décors qu'il annonce. */
export function preloadCombatPacks(scene: Phaser.Scene): void {
  scene.load.json(MANIFEST, `${PATH}combat.json`);
  scene.load.once(`filecomplete-json-${MANIFEST}`, (_key: string, _type: string, data: unknown) => {
    const manifest = data as Partial<CombatManifest> | undefined;
    for (const people of Object.keys(manifest?.peoples ?? {})) {
      scene.load.atlas(
        figureAtlas(people as PlayerId),
        `${PATH}combat-${people}.png`,
        `${PATH}combat-${people}.json`,
      );
    }
    for (const terrain of manifest?.decors ?? []) {
      scene.load.image(decorKey(terrain), `${PATH}decor-${terrain}.png`);
    }
  });
}

function manifest(scene: Phaser.Scene): CombatManifest {
  const data = scene.cache.json.get(MANIFEST) as Partial<CombatManifest> | undefined;
  return { peoples: data?.peoples ?? {}, decors: data?.decors ?? [] };
}

/** Le peuple a-t-il ses propres figurants pour cette unité ? */
export function hasFigure(scene: Phaser.Scene, people: PlayerId, unit: UnitType): boolean {
  return (
    scene.textures.exists(figureAtlas(people)) &&
    (manifest(scene).peoples[people] ?? []).includes(unit)
  );
}

/** Animations des figurants de tous les peuples chargés (une fois par jeu). */
export function createFigureAnimations(scene: Phaser.Scene): void {
  for (const [people, units] of Object.entries(manifest(scene).peoples)) {
    const key = figureAtlas(people as PlayerId);
    if (!scene.textures.exists(key)) continue;
    for (const unit of units) {
      for (const [anim, spec] of Object.entries(FIGURE_ANIMS) as [
        FigureAnim,
        (typeof FIGURE_ANIMS)[FigureAnim],
      ][]) {
        const animKey = figureAnimation(people as PlayerId, unit as UnitType, anim);
        if (scene.anims.exists(animKey)) continue;
        const frames = Array.from({ length: spec.frames }, (_, i) => ({
          key,
          frame: `figure/${unit}/${anim}/${i}`,
        })).filter(({ frame }) => scene.textures.get(key).has(frame));
        if (frames.length === 0) continue;
        scene.anims.create({
          key: animKey,
          frames,
          frameRate: spec.rate,
          repeat: spec.loop ? -1 : 0,
        });
      }
    }
  }
}

/** Décor du terrain s'il existe : route → plaine, pont → rivière. */
export function decorFor(scene: Phaser.Scene, terrain: TerrainType): string | null {
  const name = terrain === 'route' ? 'plaine' : terrain === 'pont' ? 'riviere' : terrain;
  const key = decorKey(name);
  return scene.textures.exists(key) ? key : null;
}
