import Phaser from 'phaser';
import { FACTIONS, TERRAINS, UNITS, type TerrainType } from '@antiqua/engine';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../config';
import { GRID, panel } from '../ui/panels';
import { TERRAIN_ATLAS, hasUnitArt, idleAnimation, unitAtlas, walkAnimation } from '../view/art';
import { OUTLINE_COLOR, TEAM_COLORS, darken } from '../view/palette';
import { uiText } from '../view/text';
import { soldierCount, type CombatSetup, type CombatSide, type Side, type Strike } from './setup';

export interface CombatSceneData {
  readonly setup: CombatSetup;
  /** Vitesse de lecture (×4 quand le joueur accélère le tour de l'IA). */
  readonly speed: number;
  readonly onDone: () => void;
}

/**
 * Scène de combat plein écran, en écran partagé : chaque moitié montre un camp sur son
 * terrain, avec un figurant par PV restant. Elle est composée en direct à partir du
 * résultat du moteur (couches : décor, figurants, bandeau), jamais précalculée en vidéo.
 *
 * Phase A : les figurants sont les sprites de la carte agrandis ×2 et les décors sont faits
 * des tuiles de terrain. Les planches de combat par peuple viendront les remplacer.
 */

const HALF = LOGICAL_WIDTH / 2;
const SCALE = 2;
const HUD_H = GRID * 7;
const HORIZON = 168;
const ARROW_TEXTURE = 'combat-arrow';
const SKY = [0x5f9fd8, 0x74afe0, 0x8cbfe6, 0xa6cfeb, 0xbfdcee, 0xd6e8ef] as const;

/** Emplacements des figurants (moitié gauche, pieds au sol), du premier rang vers l'arrière. */
const SLOTS_SMALL: readonly (readonly [number, number])[] = [
  [266, 352],
  [240, 296],
  [214, 352],
  [188, 296],
  [162, 352],
  [136, 296],
  [110, 352],
  [84, 296],
  [58, 352],
  [32, 296],
];
const SLOTS_LARGE: readonly (readonly [number, number])[] = [
  [250, 356],
  [200, 300],
  [150, 356],
  [100, 300],
  [50, 356],
];

/** Décor d'horizon par terrain : la tuile qui se répète au loin. */
function horizonFrame(terrain: TerrainType): string | null {
  switch (terrain) {
    case 'foret':
      return 'terrain/foret/0';
    case 'montagne':
      return 'terrain/montagne/0';
    case 'colline':
      return 'terrain/colline/1';
    case 'marais':
      return 'terrain/marais/1';
    case 'desert':
      return null;
    default:
      return 'terrain/foret/2';
  }
}

/** Sol au premier plan par terrain. */
function groundFrame(terrain: TerrainType): string {
  switch (terrain) {
    case 'foret':
    case 'colline':
    case 'montagne':
    case 'desert':
    case 'marais':
      return `terrain/${terrain === 'montagne' ? 'colline' : terrain}/0`;
    default:
      return 'terrain/plaine/0';
  }
}

interface Figure {
  readonly sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  readonly homeX: number;
}

interface HalfView {
  readonly side: CombatSide;
  readonly figures: Figure[];
  readonly hpText: Phaser.GameObjects.Text;
  readonly root: Phaser.GameObjects.Container;
}

export class CombatScene extends Phaser.Scene {
  private skipped = false;
  private skipResolve: () => void = () => undefined;
  private skipSignal: Promise<void> = Promise.resolve();

  constructor() {
    super('Combat');
  }

  create(data: CombatSceneData): void {
    this.skipped = false;
    this.skipSignal = new Promise((resolve) => {
      this.skipResolve = resolve;
    });
    this.tweens.timeScale = data.speed;
    this.time.timeScale = data.speed;
    this.createArrowTexture();

    const halves: Record<Side, HalfView> = {
      left: this.buildHalf(data.setup.left),
      right: this.buildHalf(data.setup.right),
    };
    this.drawDivider();

    // Un clic, Entrée, Espace ou Échap passent la scène.
    const skip = () => this.skip();
    this.input.on('pointerdown', skip);
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (['Enter', 'Space', 'Escape'].includes(event.code)) skip();
    });

    void this.run(data, halves);
  }

  // ——— Déroulé ———

  private async run(data: CombatSceneData, halves: Record<Side, HalfView>): Promise<void> {
    this.cameras.main.fadeIn(150, 0, 0, 0);
    // Entrée : les deux moitiés glissent depuis les bords.
    halves.left.root.setX(-HALF / 2);
    halves.right.root.setX(HALF / 2);
    await Promise.all([
      this.tween({ targets: halves.left.root, x: 0, duration: 260, ease: 'Quad.easeOut' }),
      this.tween({ targets: halves.right.root, x: 0, duration: 260, ease: 'Quad.easeOut' }),
    ]);
    await this.wait(250);

    for (const strike of data.setup.strikes) {
      const from = halves[strike.from];
      const to = halves[strike.from === 'left' ? 'right' : 'left'];
      if (from.figures.length === 0) continue;
      await this.playStrike(strike, from, to);
      await this.wait(200);
    }

    await this.wait(450);
    this.cameras.main.fadeOut(150, 0, 0, 0);
    await this.wait(160);
    data.onDone();
    this.scene.stop();
  }

  private async playStrike(strike: Strike, from: HalfView, to: HalfView): Promise<void> {
    const direction = from.side.side === 'left' ? 1 : -1;
    if (strike.ranged) {
      await this.volley(from, to, from.side.unitType === 'catapulte');
    } else {
      // Charge : les figurants avancent vers la ligne de front, frappent, puis reviennent.
      for (const figure of from.figures) this.walk(figure, from.side, true);
      await Promise.all(
        from.figures.map((figure) =>
          this.tween({
            targets: figure.sprite,
            x: figure.homeX + direction * 46,
            duration: 360,
            ease: 'Quad.easeIn',
          }),
        ),
      );
    }

    await this.impact(to, strike);

    if (!strike.ranged) {
      await Promise.all(
        from.figures.map((figure) =>
          this.tween({
            targets: figure.sprite,
            x: figure.homeX,
            duration: 300,
            ease: 'Quad.easeOut',
          }),
        ),
      );
      for (const figure of from.figures) this.walk(figure, from.side, false);
    }
  }

  /** Tir : flèches (ou pierres de catapulte) en cloche vers les rangs adverses. */
  private async volley(from: HalfView, to: HalfView, heavy: boolean): Promise<void> {
    const shots = from.figures.slice(0, heavy ? 3 : 6);
    const flights = shots.map(async (figure, index) => {
      await this.wait(index * 70);
      const target = to.figures[index % Math.max(1, to.figures.length)];
      const start = { x: figure.sprite.x, y: figure.sprite.y - 40 };
      const end = target
        ? { x: target.sprite.x, y: target.sprite.y - 24 }
        : { x: start.x + (from.side.side === 'left' ? 300 : -300), y: 340 };
      const projectile = heavy
        ? this.add.circle(start.x, start.y, 9, 0x8a8478).setStrokeStyle(2, OUTLINE_COLOR)
        : this.add.image(start.x, start.y, ARROW_TEXTURE).setScale(SCALE);
      projectile.setDepth(500);
      const peak = Math.min(start.y, end.y) - (heavy ? 140 : 110);
      const flight = { t: 0 };
      await this.tween({
        targets: flight,
        t: 1,
        duration: heavy ? 680 : 520,
        ease: 'Linear',
        onUpdate: () => {
          const t = flight.t;
          // Courbe de Bézier quadratique : départ → sommet → cible.
          const midX = (start.x + end.x) / 2;
          const x = (1 - t) ** 2 * start.x + 2 * (1 - t) * t * midX + t * t * end.x;
          const y = (1 - t) ** 2 * start.y + 2 * (1 - t) * t * peak + t * t * end.y;
          const dx = x - projectile.x;
          const dy = y - projectile.y;
          projectile.setPosition(Math.round(x), Math.round(y));
          if (!heavy && (dx !== 0 || dy !== 0)) projectile.setRotation(Math.atan2(dy, dx));
        },
      });
      projectile.destroy();
    });
    await Promise.all(flights);
  }

  /** Impact : la cible clignote, ses PV baissent, les figurants en trop tombent. */
  private async impact(target: HalfView, strike: Strike): Promise<void> {
    this.cameras.main.shake(120, 0.004);
    for (const figure of target.figures) this.flash(figure);
    const counter = { value: strike.targetHpBefore };
    const countdown = this.tween({
      targets: counter,
      value: strike.targetHpAfter,
      duration: 420,
      ease: 'Linear',
      onUpdate: () => target.hpText.setText(String(Math.round(counter.value))),
    });

    const remaining = soldierCount(target.side.unitType, strike.targetHpAfter);
    const fallen = target.figures.splice(remaining);
    const falls = fallen.map((figure, index) =>
      this.wait(80 * index).then(() =>
        this.tween({
          targets: figure.sprite,
          angle: target.side.side === 'left' ? -80 : 80,
          alpha: 0,
          y: figure.sprite.y + 6,
          duration: 380,
          ease: 'Quad.easeIn',
        }),
      ),
    );
    await Promise.all([countdown, ...falls]);
    target.hpText.setText(String(strike.targetHpAfter));
  }

  // ——— Construction ———

  private buildHalf(side: CombatSide): HalfView {
    const left = side.side === 'left';
    const x0 = left ? 0 : HALF;
    const objects: Phaser.GameObjects.GameObject[] = [];

    // Ciel en bandes (dégradé « pixel »).
    const sky = this.add.graphics();
    const bandH = Math.ceil((HORIZON - HUD_H + 40) / SKY.length);
    SKY.forEach((color, i) =>
      sky.fillStyle(color, 1).fillRect(x0, HUD_H - 40 + i * bandH, HALF, bandH),
    );
    sky.fillStyle(SKY[0], 1).fillRect(x0, 0, HALF, HUD_H - 40);
    objects.push(sky);

    // Horizon et sol : tuiles du terrain, agrandies ×2 et répétées.
    const horizon = horizonFrame(side.terrain);
    if (horizon) {
      objects.push(
        this.add
          .tileSprite(x0, HORIZON - 64, HALF, 64, TERRAIN_ATLAS, horizon)
          .setOrigin(0)
          .setTileScale(SCALE),
      );
    }
    objects.push(
      this.add
        .tileSprite(
          x0,
          HORIZON,
          HALF,
          LOGICAL_HEIGHT - HORIZON,
          TERRAIN_ATLAS,
          groundFrame(side.terrain),
        )
        .setOrigin(0)
        .setTileScale(SCALE),
    );

    // Figurants : un par PV (un pour 2 PV pour montures et engins), tournés vers l'ennemi.
    const count = soldierCount(side.unitType, side.hpBefore);
    const slots =
      count > 5 || !['cavalerie', 'char', 'catapulte'].includes(side.unitType)
        ? SLOTS_SMALL
        : SLOTS_LARGE;
    const figures: Figure[] = [];
    for (let i = 0; i < count; i++) {
      const slot = slots[i];
      if (!slot) break;
      const homeX = left ? slot[0] : LOGICAL_WIDTH - slot[0];
      const sprite = this.makeFigure(side, homeX, slot[1]);
      figures.push({ sprite, homeX });
      objects.push(sprite);
    }

    // Bandeau : peuple et unité, terrain et défense, PV en grand.
    const hudX = left ? GRID : HALF + GRID;
    const hudW = HALF - GRID * 3;
    const card = panel(this, hudX, GRID, hudW, HUD_H - GRID);
    const stripe = this.add
      .rectangle(hudX + 6, GRID + 6, 6, HUD_H - GRID - 12, TEAM_COLORS[side.owner])
      .setOrigin(0);
    const title = uiText(
      this,
      hudX + 18,
      GRID + 4,
      `${FACTIONS[side.owner].name} · ${UNITS[side.unitType].name}`,
    );
    const terrain = uiText(
      this,
      hudX + 18,
      GRID + 24,
      `${TERRAINS[side.terrain].name} · déf.`,
      'small',
    );
    const pips = this.add.graphics();
    const stars = TERRAINS[side.terrain].defense;
    for (let i = 0; i < 4; i++) {
      pips.fillStyle(i < stars ? 0xffd166 : 0x4a3626, 1);
      pips.fillRect(hudX + 18 + terrain.width + 6 + i * 8, GRID + 30, 5, 5);
    }
    const hpText = uiText(this, hudX + hudW - 12, GRID + 4, String(side.hpBefore), 'title', {
      outline: true,
    }).setOrigin(1, 0);
    objects.push(card, stripe, title, terrain, pips, hpText);

    const root = this.add.container(0, 0, objects);
    return { side, figures, hpText, root };
  }

  private makeFigure(
    side: CombatSide,
    x: number,
    y: number,
  ): Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle {
    const facingLeft = side.side === 'right';
    if (hasUnitArt(this, side.owner)) {
      const sprite = this.add
        .sprite(x, y, unitAtlas(side.owner), `unit/${side.unitType}/idle/0`)
        .setOrigin(0.5, 1)
        .setScale(SCALE)
        .setFlipX(facingLeft)
        .setDepth(y);
      sprite.play({
        key: idleAnimation(side.owner, side.unitType),
        startFrame: Phaser.Math.Between(0, 3),
      });
      return sprite;
    }
    // Sans atlas : silhouette de couleur (placeholder).
    return this.add
      .rectangle(x, y, 40, 48, TEAM_COLORS[side.owner])
      .setOrigin(0.5, 1)
      .setStrokeStyle(2, darken(TEAM_COLORS[side.owner]))
      .setDepth(y);
  }

  /** Bande sombre en biais au milieu : sépare les deux moitiés et cache le raccord. */
  private drawDivider(): void {
    const g = this.add.graphics().setDepth(1000);
    g.fillStyle(OUTLINE_COLOR, 1);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(HALF + 6, 0),
        new Phaser.Math.Vector2(HALF + 16, 0),
        new Phaser.Math.Vector2(HALF - 6, LOGICAL_HEIGHT),
        new Phaser.Math.Vector2(HALF - 16, LOGICAL_HEIGHT),
      ],
      true,
    );
    g.fillStyle(0xfff4c8, 1);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(HALF + 9, 0),
        new Phaser.Math.Vector2(HALF + 12, 0),
        new Phaser.Math.Vector2(HALF - 10, LOGICAL_HEIGHT),
        new Phaser.Math.Vector2(HALF - 13, LOGICAL_HEIGHT),
      ],
      true,
    );
  }

  /** Flèche 16×5 dessinée une fois : hampe claire, pointe de bronze, empennage. */
  private createArrowTexture(): void {
    if (this.textures.exists(ARROW_TEXTURE)) return;
    const g = this.make.graphics({}, false);
    g.fillStyle(OUTLINE_COLOR, 1).fillRect(0, 1, 16, 3);
    g.fillStyle(0xe8d8b0, 1).fillRect(2, 2, 11, 1);
    g.fillStyle(0xd8a040, 1).fillRect(13, 1, 3, 3);
    g.fillStyle(0xfff4c8, 1).fillRect(0, 0, 3, 1).fillRect(0, 4, 3, 1);
    g.generateTexture(ARROW_TEXTURE, 16, 5);
    g.destroy();
  }

  // ——— Petits effets ———

  private walk(figure: Figure, side: CombatSide, walking: boolean): void {
    if (!(figure.sprite instanceof Phaser.GameObjects.Sprite)) return;
    const key = walking
      ? walkAnimation(side.owner, side.unitType, 'right')
      : idleAnimation(side.owner, side.unitType);
    figure.sprite.play(key, true);
  }

  private flash(figure: Figure): void {
    const sprite = figure.sprite;
    if (!(sprite instanceof Phaser.GameObjects.Sprite)) {
      sprite.setAlpha(0.4);
      this.time.delayedCall(120, () => sprite.setAlpha(1));
      return;
    }
    sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(90, () => sprite.clearTint());
  }

  private skip(): void {
    if (this.skipped) return;
    this.skipped = true;
    this.skipResolve();
  }

  /** Attente, interrompue si le joueur passe la scène. */
  private wait(ms: number): Promise<void> {
    if (this.skipped) return Promise.resolve();
    return Promise.race([
      new Promise<void>((resolve) => this.time.delayedCall(ms, resolve)),
      this.skipSignal,
    ]);
  }

  /** Tween, terminé d'un coup si le joueur passe la scène. */
  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    if (this.skipped) return Promise.resolve();
    return Promise.race([
      new Promise<void>((resolve) => {
        this.tweens.add({ ...config, onComplete: () => resolve() });
      }),
      this.skipSignal,
    ]);
  }
}
