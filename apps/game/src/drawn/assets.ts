import Phaser from 'phaser';
import { FACTIONS, type PlayerId, type TerrainType, type UnitType } from '@antiqua/engine';
import { OUTLINE_COLOR, SPRITE_COLORS, TEAM_COLORS, TEAM_RAMPS, darken } from '../view/palette';
import {
  DRAWN_H,
  DRAWN_W,
  FIGURE_SOURCE_H,
  decorCandidates,
  type Expression,
  type Pose,
} from './layout';

/**
 * Images des combats dessinés : celles du pipeline (`pnpm assets:dessin`, manifeste
 * `assets/combat-hd/manifest.json`) quand elles existent, sinon des images provisoires
 * dessinées par le code (silhouettes, visages, savane), pour que tout reste jouable.
 */

const BASE = 'assets/combat-hd/';
const MANIFEST = 'drawn-manifest';

interface AnimInfo {
  readonly frames: number;
  readonly originX: number;
  readonly originY: number;
}

interface DrawnManifest {
  readonly figures: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /** Séquences (16 dessins) : peuple → unité → animation. */
  readonly anims?: Readonly<
    Record<string, Readonly<Record<string, Readonly<Record<string, AnimInfo>>>>>
  >;
  readonly portraits: readonly string[];
  readonly decors: readonly string[];
}

const figureKey = (people: string, unit: string, pose: string) => `d:fig:${people}:${unit}:${pose}`;
const portraitKey = (people: string, expression: string) => `d:por:${people}:${expression}`;
const decorKey = (name: string) => `d:decor:${name}`;
/** Portrait du dirigeant de la page de garde (`pnpm assets:cover`), 480×560. */
const leaderKey = (people: string) => `d:roi:${people}`;
const LEADER = { width: 480, height: 560 } as const;
/** Cadrage carré sur le visage et les épaules, dans le portrait du dirigeant. */
const LEADER_FRAME = 'visage';
const LEADER_CROP = { x: 40, y: 0, size: 400 } as const;
const animFrameKey = (people: string, unit: string, anim: string, i: number) =>
  `d:anim:${people}:${unit}:${anim}:${i}`;
const animKey = (people: string, unit: string, anim: string) => `d:${people}:${unit}:${anim}`;

/**
 * Animations des séquences et leur cadence (images par seconde, boucle ou non). Le repos
 * se joue en aller-retour (1-2-3-4-3-2…) : pas de saut de la dernière image à la première.
 */
export const DRAWN_ANIMS = {
  idle: { rate: 6, loop: true, yoyo: true },
  run: { rate: 10, loop: true, yoyo: false },
  attack: { rate: 14, loop: false, yoyo: false },
  hit: { rate: 10, loop: false, yoyo: false },
  fall: { rate: 8, loop: false, yoyo: false },
  victory: { rate: 5, loop: false, yoyo: false },
  // Vaincu : tombe assis, puis vacille lentement, étourdi.
  sit: { rate: 8, loop: false, yoyo: false },
  dazed: { rate: 3, loop: true, yoyo: true },
} as const;
export type DrawnAnim = keyof typeof DRAWN_ANIMS;

export interface DrawnAnimation {
  readonly key: string;
  readonly originX: number;
  readonly originY: number;
  /** Texture de chaque image (pour afficher une image seule, comme l'anticipation). */
  readonly frames: readonly string[];
}

/** Crée une fois les animations Phaser des séquences chargées. */
export function createDrawnAnimations(scene: Phaser.Scene): void {
  const manifest = scene.cache.json.get(MANIFEST) as Partial<DrawnManifest> | undefined;
  for (const [people, units] of Object.entries(manifest?.anims ?? {})) {
    for (const [unit, anims] of Object.entries(units)) {
      for (const [anim, info] of Object.entries(anims)) {
        const spec = DRAWN_ANIMS[anim as DrawnAnim] as (typeof DRAWN_ANIMS)[DrawnAnim] | undefined;
        const key = animKey(people, unit, anim);
        if (!spec || scene.anims.exists(key)) continue;
        const frames = Array.from({ length: info.frames }, (_, i) => ({
          key: animFrameKey(people, unit, anim, i),
        })).filter((frame) => scene.textures.exists(frame.key));
        if (frames.length === 0) continue;
        scene.anims.create({
          key,
          frames,
          frameRate: spec.rate,
          repeat: spec.loop ? -1 : 0,
          yoyo: spec.yoyo,
        });
      }
    }
  }
}

/** L'animation d'une unité, si sa séquence a été dessinée. */
export function drawnAnimation(
  scene: Phaser.Scene,
  people: PlayerId,
  unit: UnitType,
  anim: DrawnAnim,
): DrawnAnimation | null {
  const key = animKey(people, unit, anim);
  if (!scene.anims.exists(key)) return null;
  const manifest = scene.cache.json.get(MANIFEST) as Partial<DrawnManifest> | undefined;
  const info = manifest?.anims?.[people]?.[unit]?.[anim];
  if (!info) return null;
  return {
    key,
    originX: info.originX,
    originY: info.originY,
    frames: Array.from({ length: info.frames }, (_, i) => animFrameKey(people, unit, anim, i)),
  };
}

/** Charge le manifeste puis, dans la même passe, les images qu'il annonce. */
export function preloadDrawn(scene: Phaser.Scene): void {
  scene.load.json(MANIFEST, `${BASE}manifest.json`);
  for (const people of Object.keys(FACTIONS)) {
    scene.load.image(leaderKey(people), `assets/garde/peuples/${people}-roi.webp`);
  }
  scene.load.once(`filecomplete-json-${MANIFEST}`, (_key: string, _type: string, data: unknown) => {
    const manifest = data as Partial<DrawnManifest> | undefined;
    for (const [people, units] of Object.entries(manifest?.figures ?? {})) {
      for (const [unit, poses] of Object.entries(units)) {
        for (const pose of Object.keys(poses as object)) {
          scene.load.image(figureKey(people, unit, pose), `${BASE}${people}/${unit}/${pose}.webp`);
        }
      }
    }
    for (const [people, units] of Object.entries(manifest?.anims ?? {})) {
      for (const [unit, anims] of Object.entries(units)) {
        for (const [anim, info] of Object.entries(anims)) {
          for (let i = 0; i < info.frames; i++) {
            scene.load.image(
              animFrameKey(people, unit, anim, i),
              `${BASE}${people}/${unit}/${anim}-${i}.webp`,
            );
          }
        }
      }
    }
    for (const people of manifest?.portraits ?? []) {
      for (const expression of ['neutral', 'shout', 'hurt', 'smile']) {
        scene.load.image(
          portraitKey(people, expression),
          `${BASE}portraits/${people}/${expression}.webp`,
        );
      }
    }
    for (const name of manifest?.decors ?? []) {
      scene.load.image(decorKey(name), `${BASE}decor-${name}.webp`);
    }
  });
}

/** Texture d'une pose, et l'inclinaison à lui donner (les poses provisoires s'inclinent). */
export interface PoseTexture {
  readonly key: string;
  readonly angle: number;
  /** Échelle à l'écran pour un figurant du premier rang. */
  readonly scale: number;
}

const PLACEHOLDER_ANGLES: Readonly<Record<Pose, number>> = {
  idle: 0,
  attack: 12,
  hit: -14,
  down: -78,
};

export function poseTexture(
  scene: Phaser.Scene,
  people: PlayerId,
  unit: UnitType,
  pose: Pose,
  screenHeight: number,
): PoseTexture {
  const real = figureKey(people, unit, pose);
  if (scene.textures.exists(real)) {
    return { key: real, angle: 0, scale: screenHeight / FIGURE_SOURCE_H };
  }
  const key = placeholderFigure(scene, people, unit);
  return { key, angle: PLACEHOLDER_ANGLES[pose], scale: screenHeight / FIGURE_SOURCE_H };
}

export function hasRealFigure(scene: Phaser.Scene, people: PlayerId, unit: UnitType): boolean {
  return scene.textures.exists(figureKey(people, unit, 'idle'));
}

/**
 * Sens du regard des portraits fournis : les prompts demandent Carthage tourné vers la
 * droite et Koush vers la gauche (docs/proto-combat.md). Les provisoires regardent à droite.
 */
const PORTRAITS_FACING_LEFT: ReadonlySet<string> = new Set(['koush']);

export function portraitFacesLeft(scene: Phaser.Scene, people: PlayerId): boolean {
  return scene.textures.exists(portraitKey(people, 'neutral')) && PORTRAITS_FACING_LEFT.has(people);
}

/** Texture d'un portrait et, s'il y a lieu, le cadre à afficher dans cette texture. */
export interface PortraitTexture {
  readonly key: string;
  readonly frame?: string;
}

/**
 * Portrait du bandeau : le portrait dessiné du combat (4 expressions) s'il existe, sinon le
 * portrait du dirigeant de la page de garde (une seule expression), sinon un provisoire.
 */
export function portraitTexture(
  scene: Phaser.Scene,
  people: PlayerId,
  expression: Expression,
): PortraitTexture {
  const real = portraitKey(people, expression);
  if (scene.textures.exists(real)) return { key: real };
  const leader = leaderKey(people);
  if (scene.textures.exists(leader)) {
    const texture = scene.textures.get(leader);
    const source = texture.getSourceImage();
    if (!texture.has(LEADER_FRAME) && source.width === LEADER.width) {
      const { x, y, size } = LEADER_CROP;
      texture.add(LEADER_FRAME, 0, x, y, size, size);
    }
    return { key: leader, ...(texture.has(LEADER_FRAME) ? { frame: LEADER_FRAME } : {}) };
  }
  return { key: placeholderPortrait(scene, people, expression) };
}

export function decorTexture(scene: Phaser.Scene, terrain: TerrainType): string {
  for (const name of decorCandidates(terrain)) {
    if (scene.textures.exists(decorKey(name))) return decorKey(name);
  }
  return placeholderDecor(scene);
}

// ——— Images provisoires ———

// Couleurs des sprites de carte : le provisoire ressemble déjà au soldat de la carte.
const SKIN = SPRITE_COLORS.skin;
const CREAM = SPRITE_COLORS.cream;
const BRONZE = SPRITE_COLORS.gold;
const WOOD = SPRITE_COLORS.wood;
const LINE = 6;

/** Armes d'hast et boucliers, ou arc, selon l'unité. */
function usesBow(unit: UnitType): boolean {
  return unit === 'archers' || unit === 'catapulte';
}

/** Silhouette de 240×420, tournée vers la droite, pieds en bas. */
function placeholderFigure(scene: Phaser.Scene, people: PlayerId, unit: UnitType): string {
  const bow = usesBow(unit);
  const key = `d:ph:fig:${people}:${bow ? 'arc' : 'lance'}`;
  if (scene.textures.exists(key)) return key;
  const team = TEAM_COLORS[people];
  const g = scene.make.graphics({}, false);
  g.lineStyle(LINE, OUTLINE_COLOR, 1);
  // Jambes.
  g.fillStyle(SKIN, 1);
  g.fillRect(88, 300, 26, 112).strokeRect(88, 300, 26, 112);
  g.fillRect(124, 300, 26, 112).strokeRect(124, 300, 26, 112);
  // Tunique.
  g.fillStyle(team, 1);
  g.fillRoundedRect(72, 160, 96, 160, 24).strokeRoundedRect(72, 160, 96, 160, 24);
  g.fillStyle(CREAM, 1).fillRect(74, 268, 92, 14);
  // Tête et bandeau (ou casque).
  g.fillStyle(SKIN, 1);
  g.fillCircle(124, 104, 46).strokeCircle(124, 104, 46);
  g.fillStyle(bow ? team : BRONZE, 1);
  g.fillRect(80, 70, 90, 18).strokeRect(80, 70, 90, 18);
  g.fillStyle(OUTLINE_COLOR, 1).fillCircle(146, 100, 6);
  if (bow) {
    // Arc tendu devant le corps.
    g.lineStyle(10, WOOD, 1);
    g.beginPath();
    g.arc(160, 230, 110, -1.1, 1.1, false);
    g.strokePath();
    g.lineStyle(3, CREAM, 1).lineBetween(209, 130, 209, 330);
  } else {
    // Lance et bouclier rond.
    g.lineStyle(10, WOOD, 1).lineBetween(200, 30, 200, 412);
    g.fillStyle(BRONZE, 1).fillTriangle(190, 34, 210, 34, 200, 4);
    g.fillStyle(CREAM, 1);
    g.lineStyle(LINE, OUTLINE_COLOR, 1);
    g.fillCircle(170, 238, 54).strokeCircle(170, 238, 54);
    g.fillStyle(team, 1).fillCircle(170, 238, 20);
  }
  g.generateTexture(key, 240, FIGURE_SOURCE_H);
  g.destroy();
  return key;
}

/** Visage provisoire 256×256 : la bouche et les yeux changent avec l'expression. */
function placeholderPortrait(
  scene: Phaser.Scene,
  people: PlayerId,
  expression: Expression,
): string {
  const key = `d:ph:por:${people}:${expression}`;
  if (scene.textures.exists(key)) return key;
  const team = TEAM_COLORS[people];
  const g = scene.make.graphics({}, false);
  g.lineStyle(LINE, OUTLINE_COLOR, 1);
  // Épaules et cape.
  g.fillStyle(darken(team), 1).fillEllipse(128, 262, 240, 130).strokeEllipse(128, 262, 240, 130);
  // Tête.
  g.fillStyle(SKIN, 1).fillCircle(128, 118, 74).strokeCircle(128, 118, 74);
  g.fillStyle(team, 1).fillRect(58, 58, 140, 24).strokeRect(58, 58, 140, 24);
  // Yeux.
  g.fillStyle(OUTLINE_COLOR, 1);
  if (expression === 'hurt') {
    g.lineStyle(5, OUTLINE_COLOR, 1);
    g.lineBetween(92, 112, 112, 104).lineBetween(144, 104, 164, 112);
  } else if (expression === 'smile') {
    g.lineStyle(5, OUTLINE_COLOR, 1);
    g.beginPath().arc(102, 114, 10, Math.PI, 0, false).strokePath();
    g.beginPath().arc(154, 114, 10, Math.PI, 0, false).strokePath();
  } else {
    g.fillCircle(102, 110, 8).fillCircle(154, 110, 8);
  }
  // Bouche.
  g.lineStyle(5, OUTLINE_COLOR, 1);
  if (expression === 'shout') {
    g.fillStyle(0x4a1a14, 1).fillEllipse(128, 160, 44, 40).strokeEllipse(128, 160, 44, 40);
  } else if (expression === 'smile') {
    g.beginPath()
      .arc(128, 146, 26, 0.2, Math.PI - 0.2, false)
      .strokePath();
  } else if (expression === 'hurt') {
    g.lineBetween(106, 164, 118, 156)
      .lineBetween(118, 156, 138, 164)
      .lineBetween(138, 164, 150, 156);
  } else {
    g.lineBetween(108, 160, 148, 160);
  }
  g.generateTexture(key, 256, 256);
  g.destroy();
  return key;
}

/** Savane provisoire en 1920×1152 : ciel en dégradé, collines, sol doré, acacias. */
function placeholderDecor(scene: Phaser.Scene): string {
  const key = 'd:ph:decor';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  const top = Phaser.Display.Color.ValueToColor(0x6fb2e8);
  const bottom = Phaser.Display.Color.ValueToColor(0xf6dfae);
  const horizon = 760;
  const bands = 32;
  for (let i = 0; i < bands; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, bands - 1, i);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    g.fillRect(0, Math.floor((i * horizon) / bands), DRAWN_W, Math.ceil(horizon / bands) + 1);
  }
  g.fillStyle(0xfff3c4, 1).fillCircle(1500, 230, 90);
  g.fillStyle(0xffffff, 0.85);
  for (const [x, y, s] of [
    [300, 180, 1],
    [820, 120, 0.8],
    [1250, 300, 0.7],
  ] as const) {
    g.fillEllipse(x, y, 260 * s, 70 * s).fillEllipse(x + 70 * s, y - 30 * s, 160 * s, 80 * s);
  }
  // Collines au loin.
  g.fillStyle(0x9fae78, 1);
  g.fillEllipse(380, horizon + 40, 1100, 260).fillEllipse(1500, horizon + 50, 1200, 220);
  g.fillStyle(0x8c9c62, 1).fillEllipse(960, horizon + 70, 1300, 200);
  // Sol.
  g.fillStyle(0xd9b45a, 1).fillRect(0, horizon + 40, DRAWN_W, DRAWN_H - horizon - 40);
  g.fillStyle(0xe6c672, 1).fillRect(0, horizon + 40, DRAWN_W, 60);
  g.fillStyle(0xc9a24c, 1);
  for (let x = 40; x < DRAWN_W; x += 160) g.fillEllipse(x, 1010 + ((x * 7) % 60), 120, 18);
  // Acacias.
  for (const [x, s] of [
    [220, 1],
    [700, 0.7],
    [1380, 0.85],
    [1760, 0.6],
  ] as const) {
    const base = horizon + 60;
    g.fillStyle(0x6b4a2c, 1).fillRect(x - 8 * s, base - 150 * s, 16 * s, 150 * s);
    g.fillStyle(0x5f7d3a, 1).fillEllipse(x, base - 160 * s, 300 * s, 70 * s);
    g.fillStyle(0x6f8f44, 1).fillEllipse(x - 20 * s, base - 175 * s, 200 * s, 40 * s);
  }
  g.generateTexture(key, DRAWN_W, DRAWN_H);
  g.destroy();
  return key;
}

// ——— Effets ———

export const SPARK = 'd:fx:spark';
export const DUST = 'd:fx:dust';
const ARROW = 'd:fx:arrow';
/** Flèche aux couleurs d'un peuple. */
export const arrowTexture = (people: PlayerId): string => `${ARROW}:${people}`;
export const SLASH = 'd:fx:slash';
export const STONE = 'd:fx:stone';
/** Étoile d'étourdissement, qui tourne au-dessus de la tête des vaincus. */
export const STAR = 'd:fx:star';
/** Ombre douce au sol, sous chaque soldat (256×64). */
export const SHADOW = 'd:fx:shadow';

/** Petites textures d'effets, dessinées une fois. */
export function createEffectTextures(scene: Phaser.Scene): void {
  const make = (
    key: string,
    w: number,
    h: number,
    draw: (g: Phaser.GameObjects.Graphics) => void,
  ) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({}, false);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  make(SPARK, 48, 48, (g) => {
    g.fillStyle(0xfff4c8, 1)
      .fillTriangle(24, 0, 30, 24, 18, 24)
      .fillTriangle(24, 48, 30, 24, 18, 24);
    g.fillTriangle(0, 24, 24, 18, 24, 30).fillTriangle(48, 24, 24, 18, 24, 30);
    g.fillStyle(0xffffff, 1).fillCircle(24, 24, 7);
  });
  make(DUST, 64, 64, (g) => {
    g.fillStyle(0xe8d3a0, 0.9).fillCircle(32, 32, 30);
    g.fillStyle(0xf6e7c0, 0.9).fillCircle(26, 26, 16);
  });
  // Une flèche par peuple : pointe dorée et empennage aux couleurs de l'équipe, comme le
  // carquois des archers sur la carte.
  for (const people of Object.keys(TEAM_RAMPS) as PlayerId[]) {
    const [, dark, mid] = TEAM_RAMPS[people];
    make(arrowTexture(people), 96, 14, (g) => {
      g.fillStyle(OUTLINE_COLOR, 1).fillRect(0, 5, 84, 5);
      g.fillStyle(WOOD, 1).fillRect(8, 6, 70, 3);
      g.fillStyle(BRONZE, 1).fillTriangle(78, 0, 78, 14, 96, 7);
      g.fillStyle(mid, 1).fillTriangle(0, 0, 18, 6, 0, 6).fillTriangle(0, 14, 18, 8, 0, 8);
      g.fillStyle(dark, 1).fillRect(0, 5, 18, 4);
    });
  }
  make(SLASH, 220, 220, (g) => {
    g.lineStyle(14, 0xffffff, 1);
    g.beginPath().arc(110, 110, 90, -2.4, -0.2, false).strokePath();
    g.lineStyle(6, 0xfff4c8, 1);
    g.beginPath().arc(110, 110, 72, -2.2, -0.4, false).strokePath();
  });
  make(STAR, 48, 48, (g) => {
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 21 : 9;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      points.push(new Phaser.Math.Vector2(24 + r * Math.cos(a), 24 + r * Math.sin(a)));
    }
    g.fillStyle(0xffd166, 1).fillPoints(points, true);
    g.lineStyle(3, OUTLINE_COLOR, 1).strokePoints(points, true);
  });
  make(SHADOW, 256, 64, (g) => {
    // Ellipses concentriques peu opaques : le centre, où elles se cumulent, est le plus sombre.
    for (let i = 0; i < 10; i++) {
      const k = 1 - i / 10;
      g.fillStyle(0x3a2810, 0.1).fillEllipse(128, 32, 248 * k, 56 * k);
    }
  });
  make(STONE, 64, 64, (g) => {
    // Pierre grise, comme dans le godet de la catapulte sur la carte.
    g.fillStyle(SPRITE_COLORS.stone, 1).fillCircle(32, 32, 26);
    g.lineStyle(5, OUTLINE_COLOR, 1).strokeCircle(32, 32, 26);
    g.fillStyle(0xa89c88, 1).fillCircle(24, 24, 8);
  });
}
