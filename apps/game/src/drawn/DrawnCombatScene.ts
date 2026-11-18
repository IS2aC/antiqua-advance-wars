import Phaser from 'phaser';
import { FACTIONS, TERRAINS, UNITS } from '@antiqua/engine';
import { StagedScene } from '../combat/StagedScene';
import type { CombatSetup, CombatSide, Side, Strike } from '../combat/setup';
import { OUTLINE_COLOR, TEAM_COLORS, TEAM_RAMPS, darken } from '../view/palette';
import {
  DUST,
  SHADOW,
  SLASH,
  STAR,
  SPARK,
  STONE,
  arrowTexture,
  createDrawnAnimations,
  createEffectTextures,
  decorTexture,
  drawnAnimation,
  type DrawnAnim,
  portraitFacesLeft,
  portraitTexture,
  poseTexture,
} from './assets';
import {
  DRAWN_H,
  DRAWN_HALF,
  DRAWN_W,
  FIGURE_SCREEN_H,
  SLOTS,
  drawnFigureCount,
  finalExpression,
  type Expression,
  type Pose,
  type Slot,
} from './layout';

export interface DrawnCombatData {
  readonly setup: CombatSetup;
  /** Vitesse de lecture (×4 quand le joueur accélère le tour de l'IA). */
  readonly speed: number;
  readonly onDone: () => void;
}

/**
 * Combat dessiné (prototype), composé en direct en 1920×1152 à partir du résultat du
 * moteur, comme la scène pixel. Chaque camp vit dans son propre « monde » (décor et
 * figurants), filmé par sa caméra ; une troisième caméra porte l'interface.
 *
 * Déroulé : 1) l'attaquant seul, plein écran ; 2) son bandeau descend ; 3) l'écran se
 * partage et le défenseur arrive ; 4) l'attaque ; 5) l'impact (PV qui descendent,
 * chutes), puis la riposte éventuelle ; 6) expressions finales et retour à la carte.
 *
 * Une unité dont les séquences sont dessinées (16 dessins) joue de vraies animations :
 * repos en boucle, préparation, course, coup (gel à l'impact), coup reçu, chute, victoire.
 * Les autres retombent sur leurs 4 poses, animées par le code.
 */

const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';
/** Les deux mondes sont posés loin l'un de l'autre : chaque caméra ne voit que le sien. */
const WORLD_X: Record<Side, number> = { left: 0, right: 4000 };
const HUD_W = 900;
const HUD_H = 176;
const HUD_MARGIN = 24;
const PORTRAIT = 150;
/** Gel de l'image au moment où le coup porte : c'est ce qui donne du poids. */
const HITSTOP_MS = 90;
/**
 * Retard de réaction de chaque soldat, tiré au hasard : jamais de chorégraphie
 * synchronisée. Le premier rang réagit un peu plus vite que le second.
 */
const REACTION_MS: Readonly<Record<'front' | 'back', readonly [number, number]>> = {
  front: [0, 120],
  back: [60, 200],
};
/** Variation de taille entre soldats (±). */
const SIZE_JITTER = 0.05;
/** Teinte du second rang (un peu voilé : plus loin) et petites variations au premier. */
const BACK_ROW_TINT = 0xd8d0c0;
const FRONT_TINTS = [0xffffff, 0xfbf6ee, 0xf6f0e6] as const;
/** Plan de contact : un monde par caméra, loin des deux camps. */
const CLASH_X: Record<Side, number> = { left: 8000, right: 12000 };
/** Opacité des ombres au sol. */
const SHADOW_ALPHA = 0.7;

/** Pose de secours quand la séquence n'est pas dessinée. */
const FALLBACK_POSE: Readonly<Record<DrawnAnim, Pose>> = {
  idle: 'idle',
  run: 'attack',
  attack: 'attack',
  hit: 'hit',
  fall: 'down',
  sit: 'down',
  dazed: 'down',
  victory: 'idle',
};

interface Figure {
  readonly image: Phaser.GameObjects.Sprite;
  readonly homeX: number;
  readonly homeY: number;
  readonly baseScale: number;
  /** Teinte de repos (second rang voilé, petites variations au premier). */
  readonly tint: number;
  /** Retard de réaction propre à ce soldat. */
  readonly delay: number;
  /** Place dans les rangs (pour le plan de contact). */
  readonly slot: Slot;
  /** Ombre au sol : suit le soldat (position, transparence). */
  readonly shadow: Phaser.GameObjects.Image;
  breathing: Phaser.Tweens.Tween | null;
}

interface SideView {
  readonly side: CombatSide;
  /** +1 si le camp regarde vers la droite (il est à gauche de l'écran). */
  readonly dir: 1 | -1;
  readonly camera: Phaser.Cameras.Scene2D.Camera;
  readonly world: Phaser.GameObjects.Container;
  readonly figures: Figure[];
  readonly hud: Phaser.GameObjects.Container;
  readonly portrait: Phaser.GameObjects.Image;
  readonly hpText: Phaser.GameObjects.Text;
  readonly hpBar: Phaser.GameObjects.Graphics;
  hp: number;
}

export class DrawnCombatScene extends StagedScene {
  private ui!: Phaser.GameObjects.Container;
  private divider!: Phaser.GameObjects.Graphics;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private views!: Record<Side, SideView>;
  private attackerSide: Side = 'left';
  /** Décor et soldats du plan de contact, un par caméra. */
  private clashWorlds!: Record<Side, Phaser.GameObjects.Container>;
  /** Tous les soldats, tombés compris : leurs ombres les suivent. */
  private shadowed: Figure[] = [];

  constructor() {
    super('DrawnCombat');
  }

  create(data: DrawnCombatData): void {
    this.beginStage(data.speed);
    this.shadowed = [];
    // Les animations dessinées suivent la même vitesse (ralenti du banc d'essai compris).
    this.anims.globalTimeScale = data.speed;
    createEffectTextures(this);
    createDrawnAnimations(this);
    const { setup } = data;
    const attackerSide = setup.left.role === 'attaquant' ? 'left' : 'right';
    this.attackerSide = attackerSide;

    this.ui = this.add.container(0, 0).setDepth(100);
    const leftCamera = this.cameras.main;
    const rightCamera = this.cameras.add(0, 0, DRAWN_W, DRAWN_H);
    this.uiCamera = this.cameras.add(0, 0, DRAWN_W, DRAWN_H);
    for (const camera of [leftCamera, rightCamera]) camera.setBackgroundColor(0x1a1410);

    this.views = {
      left: this.buildSide(setup.left, leftCamera),
      right: this.buildSide(setup.right, rightCamera),
    };
    this.divider = this.add.graphics();
    this.ui.add(this.divider);

    this.clashWorlds = { left: this.add.container(0, 0), right: this.add.container(0, 0) };
    leftCamera.ignore([this.views.right.world, this.ui, this.clashWorlds.right]);
    rightCamera.ignore([this.views.left.world, this.ui, this.clashWorlds.left]);
    this.uiCamera.ignore([
      this.views.left.world,
      this.views.right.world,
      this.clashWorlds.left,
      this.clashWorlds.right,
    ]);

    // Au départ, seul l'attaquant est à l'écran, plein cadre.
    this.layoutCameras(attackerSide, 0);

    void this.run(data, attackerSide);
  }

  /** Les ombres suivent les soldats (charge, recul, chute qui s'efface). */
  override update(): void {
    for (const figure of this.shadowed) {
      figure.shadow.setX(figure.image.x).setAlpha(SHADOW_ALPHA * figure.image.alpha);
    }
  }

  // ——— Déroulé ———

  private async run(data: DrawnCombatData, attackerSide: Side): Promise<void> {
    const attacker = this.views[attackerSide];
    const defender = this.views[attackerSide === 'left' ? 'right' : 'left'];
    // Fondu d'entrée sur ce qui est à l'écran (le défenseur arrive plus tard, en glissant).
    for (const camera of [attacker.camera, this.uiCamera]) camera.fadeIn(250, 0, 0, 0);

    // 1) L'attaquant seul, avec une légère poussée de caméra.
    attacker.camera.setZoom(1.06);
    void this.tween({ targets: attacker.camera, zoom: 1, duration: 1400, ease: 'Sine.easeOut' });
    await this.wait(450);

    // 2) Son bandeau descend.
    await this.slideHud(attacker);
    await this.wait(250);

    // 3) Écran partagé : le défenseur arrive de son côté.
    const split = { p: 0 };
    await this.tween({
      targets: split,
      p: 1,
      duration: 480,
      ease: 'Cubic.easeInOut',
      onUpdate: () => this.layoutCameras(attackerSide, split.p),
    });
    this.layoutCameras(attackerSide, 1);
    await this.slideHud(defender);
    await this.wait(300);

    // 4) et 5) Le coup, puis la riposte éventuelle.
    for (const strike of data.setup.strikes) {
      const from = this.views[strike.from];
      const to = this.views[strike.from === 'left' ? 'right' : 'left'];
      if (from.figures.length === 0) continue;
      await this.playStrike(strike, from, to);
      await this.wait(250);
    }

    // 6) Expressions finales, puis retour à la carte.
    const left = data.setup.left;
    const right = data.setup.right;
    const endings: Record<Side, Expression> = {
      left: finalExpression(left, right),
      right: finalExpression(right, left),
    };
    for (const side of ['left', 'right'] as const) {
      const view = this.views[side];
      this.setExpression(view, endings[side]);
      // Le vainqueur lève son arme, et la caméra s'approche lentement de lui.
      if (endings[side] === 'smile') {
        for (const figure of view.figures) {
          void this.wait(figure.delay).then(() => this.act(view, figure, 'victory'));
        }
        void this.tween({ targets: view.camera, zoom: 1.07, duration: 1300, ease: 'Sine.easeOut' });
      }
    }
    await this.wait(1100);
    await this.finish(data.onDone);
  }

  private async playStrike(strike: Strike, from: SideView, to: SideView): Promise<void> {
    this.setExpression(from, 'shout');
    if (strike.ranged) {
      void this.tween({ targets: from.camera, zoom: 1.04, duration: 500, ease: 'Sine.easeInOut' });
      // Chaque tireur prend sa flèche, encoche, bande l'arc : sa flèche part à son lâcher.
      const released = new Map<Figure, Promise<void>>();
      for (const figure of from.figures) {
        released.set(
          figure,
          this.wait(figure.delay).then(() => this.shoot(from, figure)),
        );
      }
      await this.volley(
        from,
        to,
        from.side.unitType === 'catapulte',
        (figure) => released.get(figure) ?? Promise.resolve(),
      );
      await this.impact(to, strike);
    } else {
      await this.charge(from, to, strike);
    }

    for (const figure of from.figures) {
      if (!strike.ranged) {
        void this.tween({
          targets: figure.image,
          x: figure.homeX,
          y: figure.homeY,
          duration: 320,
          ease: 'Quad.easeOut',
        });
      }
      void this.act(from, figure, 'idle');
    }
    // La caméra du tireur ou du chargeur revient en place.
    void this.tween({ targets: from.camera, zoom: 1, duration: 400, ease: 'Sine.easeOut' });
    if (from.hp > 0) this.setExpression(from, 'neutral');
  }

  /**
   * Corps à corps : préparation (léger recul, la caméra se resserre), course par à-coups
   * vers l'ennemi (la caméra suit), puis le plan de contact où les deux lignes se
   * rencontrent, et retour à l'écran partagé pour les dégâts.
   */
  private async charge(from: SideView, to: SideView, strike: Strike): Promise<void> {
    const camera = from.camera;
    void this.tween({ targets: camera, zoom: 1.05, duration: 420, ease: 'Sine.easeInOut' });
    await Promise.all(
      from.figures.map(async (figure) => {
        await this.wait(figure.delay);
        this.still(from, figure, 'attack', 0);
        await this.tween({
          targets: figure.image,
          x: figure.homeX - from.dir * 36,
          duration: 180,
          ease: 'Quad.easeOut',
        });
      }),
    );
    await this.wait(100);
    void this.tween({
      targets: camera,
      scrollX: camera.scrollX + from.dir * 60,
      duration: 420,
      ease: 'Sine.easeIn',
    });
    await Promise.all(
      from.figures.map(async (figure) => {
        await this.wait(figure.delay);
        void this.act(from, figure, 'run');
        // Sans animation de course (dessin provisoire), rien à décaler.
        if (figure.image.anims.currentAnim) figure.image.anims.setProgress(Math.random());
        this.puff(from, figure.image.x - from.dir * 40, figure.image.y);
        // Par à-coups, au rythme des pas, avec un petit rebond à chaque foulée.
        void this.tween({
          targets: figure.image,
          y: figure.homeY - 14 * figure.baseScale,
          duration: 90,
          yoyo: true,
          repeat: 1,
          ease: 'Sine.easeOut',
        });
        await this.tween({
          targets: figure.image,
          x: figure.homeX + from.dir * 190,
          duration: 360,
          ease: 'Stepped',
          easeParams: [4],
        });
      }),
    );

    if (to.figures.length > 0) await this.clash(from, to);
    // De retour à l'écran partagé : les soldats finissent leur geste (suite du mouvement).
    for (const figure of from.figures) {
      this.still(from, figure, 'attack', 3);
      figure.image.setY(figure.homeY);
    }
    await this.impact(to, strike, { afterClash: to.figures.length > 0 });
  }

  /**
   * Plan de contact : un instant, la séparation disparaît. L'attaquant occupe tout l'écran,
   * ses soldats portent le coup dans la ligne adverse, les deux camps face à face sur le
   * même décor. Puis on revient à l'écran partagé.
   */
  private async clash(from: SideView, to: SideView): Promise<void> {
    const side = from.side.side;
    const camera = from.camera;
    const world = this.clashWorlds[side];
    const x0 = CLASH_X[side];
    const center = x0 + DRAWN_HALF;
    world.removeAll(true);
    world.add(
      this.add
        .image(x0, 0, decorTexture(this, to.side.terrain))
        .setOrigin(0)
        .setDisplaySize(DRAWN_W, DRAWN_H),
    );
    const spawn = (view: SideView, group: readonly Figure[], groupCenter: number) =>
      group.map((figure) => {
        const x = groupCenter + figure.slot.dx * 0.75 * view.dir;
        const y = figure.slot.y;
        const shadow = this.add
          .image(x, y, SHADOW)
          .setScale(figure.baseScale * 0.95)
          .setAlpha(SHADOW_ALPHA);
        const sprite = this.add
          .sprite(x, y, figure.image.texture.key, figure.image.frame.name)
          .setOrigin(figure.image.originX, figure.image.originY)
          .setScale(figure.baseScale)
          .setFlipX(view.dir < 0)
          .setTint(figure.tint);
        world.add(shadow);
        return { sprite, figure };
      });
    const attackers = spawn(from, from.figures, center - from.dir * 300);
    const defenders = spawn(to, to.figures, center + from.dir * 300);
    // Les rangs du fond derrière ceux du premier plan, tous camps confondus.
    [...attackers, ...defenders]
      .sort((a, b) => a.sprite.y - b.sprite.y)
      .forEach(({ sprite }) => world.add(sprite));
    const idle = drawnAnimation(this, to.side.owner, to.side.unitType, 'idle');
    for (const { sprite } of defenders) {
      if (idle) sprite.setOrigin(this.originX(to, idle.originX), idle.originY).play(idle.key);
      else this.posePuppet(to, sprite, 'idle');
    }

    // Coupe franche : plein écran sur le plan de contact.
    this.views[to.side.side].camera.setVisible(false);
    this.drawDivider(0, false);
    camera.setViewport(0, 0, DRAWN_W, DRAWN_H).setScroll(x0, 0).setZoom(1.1);

    const attack = drawnAnimation(this, from.side.owner, from.side.unitType, 'attack');
    for (const { sprite } of attackers) {
      if (attack) {
        sprite
          .setOrigin(this.originX(from, attack.originX), attack.originY)
          .play({ key: attack.key, startFrame: 1 });
      } else {
        this.posePuppet(from, sprite, 'attack');
      }
      void this.tween({
        targets: sprite,
        x: sprite.x + from.dir * 70,
        duration: 140,
        ease: 'Quad.easeOut',
      });
    }
    await this.wait(attack ? 130 : 90);

    // Le coup porte : silhouettes blanches, éclair, gel, étincelles sur la ligne de contact.
    const hit = drawnAnimation(this, to.side.owner, to.side.unitType, 'hit');
    for (const { sprite } of defenders) {
      if (hit) {
        sprite.setOrigin(this.originX(to, hit.originX), hit.originY).play(hit.key);
      } else {
        this.posePuppet(to, sprite, 'hit');
      }
      sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    }
    this.flashScreen();
    await this.hitstop(HITSTOP_MS + 30);
    camera.shake(220, 0.012);
    camera.setZoom(1.16);
    void this.tween({ targets: camera, zoom: 1.1, duration: 260, ease: 'Quad.easeOut' });
    for (const { sprite, figure } of defenders) {
      sprite.setTint(figure.tint).setTintMode(Phaser.TintModes.MULTIPLY);
      this.sparkAt(world, sprite.x - from.dir * 60, sprite.y - 220 * figure.baseScale);
      void this.tween({
        targets: sprite,
        x: sprite.x + from.dir * 40,
        duration: 140,
        ease: 'Quad.easeOut',
      });
    }
    await this.wait(380);

    // Retour à l'écran partagé.
    world.removeAll(true);
    camera.setZoom(1);
    this.layoutCameras(this.attackerSide, 1);
    this.views[to.side.side].camera.setVisible(true);
  }

  /** Tir : les projectiles quittent l'écran du tireur, puis tombent sur la cible. */
  private async volley(
    from: SideView,
    to: SideView,
    heavy: boolean,
    release: (figure: Figure) => Promise<void>,
  ): Promise<void> {
    const texture = heavy ? STONE : arrowTexture(from.side.owner);
    // Deux flèches par tireur (la seconde juste après), une pierre par engin.
    const shots = from.figures.flatMap((figure) =>
      heavy
        ? [{ figure, k: 0 }]
        : [
            { figure, k: 0 },
            { figure, k: 1 },
          ],
    );
    const outgoing = shots.map(async ({ figure, k }) => {
      await release(figure);
      await this.wait(k * 90);
      // Les archers tirent vers le haut (volée) : la flèche part de la main de l'arc, levée.
      const sx = figure.image.x + from.dir * (heavy ? 60 : 80);
      const sy = figure.image.y - (heavy ? 260 : 350) * figure.baseScale;
      const projectile = this.addTo(
        from,
        this.add.image(sx, sy, texture).setScale(1.5).setDepth(2000),
      );
      await this.flight(projectile, sx, sy, sx + from.dir * 900, sy - 420, heavy ? 420 : 340);
      projectile.destroy();
    });
    await Promise.all(outgoing);

    const center = WORLD_X[to.side.side] + DRAWN_HALF;
    const incoming = shots.map(async (_shot, i) => {
      await this.wait(i * 50);
      const target = to.figures[i % Math.max(1, to.figures.length)];
      const ex = target ? target.image.x + Phaser.Math.Between(-50, 50) : center;
      const ey = target ? target.image.y - 180 * target.baseScale : 900;
      const sx = center + to.dir * 620;
      const projectile = this.addTo(
        to,
        this.add.image(sx, 120, texture).setScale(1.5).setDepth(2000),
      );
      await this.flight(projectile, sx, 120, ex, ey, heavy ? 380 : 300);
      projectile.destroy();
      this.spark(to, ex, ey);
    });
    await Promise.all(incoming);
  }

  /** Vol en cloche (courbe de Bézier) ; la flèche s'oriente selon sa trajectoire. */
  private async flight(
    projectile: Phaser.GameObjects.Image,
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    duration: number,
  ): Promise<void> {
    const state = { t: 0 };
    const peak = Math.min(sy, ey) - 120;
    await this.tween({
      targets: state,
      t: 1,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        const t = state.t;
        const mx = (sx + ex) / 2;
        const x = (1 - t) ** 2 * sx + 2 * (1 - t) * t * mx + t * t * ex;
        const y = (1 - t) ** 2 * sy + 2 * (1 - t) * t * peak + t * t * ey;
        const angle = Math.atan2(y - projectile.y, x - projectile.x);
        projectile.setPosition(x, y);
        if (projectile.texture.key !== STONE) projectile.setRotation(angle);
      },
    });
  }

  /** Impact : éclair, gel, secousse, PV qui descendent, figurants qui tombent. */
  private async impact(
    target: SideView,
    strike: Strike,
    options: { readonly afterClash?: boolean } = {},
  ): Promise<void> {
    this.setExpression(target, 'hurt');
    const remaining = drawnFigureCount(target.side.unitType, strike.targetHpAfter);
    for (const figure of target.figures) void this.act(target, figure, 'hit');
    if (!options.afterClash) {
      // Le coup arrive ici (tir) : éclair, silhouettes blanches, gel et zoom brusque.
      this.flashHalf(target);
      for (const figure of target.figures) {
        figure.image.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      }
      await this.hitstop(HITSTOP_MS);
      target.camera.shake(220, 0.01);
      target.camera.setZoom(1.08);
      void this.tween({ targets: target.camera, zoom: 1, duration: 280, ease: 'Quad.easeOut' });
    }
    for (const figure of target.figures) {
      this.time.delayedCall(40, () => this.restoreTint(figure));
      void this.tween({
        targets: figure.image,
        x: figure.homeX - target.dir * 34,
        duration: 120,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }

    const counter = { value: strike.targetHpBefore };
    const countdown = this.tween({
      targets: counter,
      value: strike.targetHpAfter,
      duration: 520,
      ease: 'Linear',
      onUpdate: () => this.setHp(target, Math.round(counter.value)),
    });

    const fallen = target.figures.splice(remaining);
    // Les vaincus ne meurent pas : ils tombent assis, sonnés, des étoiles autour de la tête.
    // Avec la planche « sonné », ils restent assis jusqu'à la fin ; sans, ils s'effacent.
    const sits = drawnAnimation(this, target.side.owner, target.side.unitType, 'sit') !== null;
    const falls = fallen.map(async (figure, i) => {
      await this.wait(200 + i * 90 + figure.delay);
      await this.act(target, figure, sits ? 'sit' : 'fall');
      this.puff(target, figure.image.x, figure.image.y);
      this.dizzy(target, figure);
      if (sits) {
        void this.act(target, figure, 'dazed');
        return;
      }
      await this.tween({ targets: figure.image, alpha: 0, duration: 600, delay: 900 });
    });

    await Promise.all([countdown, ...falls]);
    this.setHp(target, strike.targetHpAfter);
    await this.wait(150);
    for (const figure of target.figures) void this.act(target, figure, 'idle');
  }

  /** Arrêt sur image : tweens et animations figés un instant (en temps réel). */
  private async hitstop(ms: number): Promise<void> {
    if (this.skipped) return;
    this.tweens.pauseAll();
    this.anims.pauseAll();
    await new Promise((resolve) => window.setTimeout(resolve, ms / this.tweens.timeScale));
    this.tweens.resumeAll();
    this.anims.resumeAll();
  }

  private async finish(onDone: () => void): Promise<void> {
    await new Promise<void>((resolve) => {
      this.uiCamera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => resolve());
      for (const camera of this.allCameras()) camera.fadeOut(250, 0, 0, 0);
    });
    onDone();
    this.scene.stop();
  }

  // ——— Construction ———

  private buildSide(side: CombatSide, camera: Phaser.Cameras.Scene2D.Camera): SideView {
    const dir: 1 | -1 = side.side === 'left' ? 1 : -1;
    const x0 = WORLD_X[side.side];
    const world = this.add.container(0, 0);
    world.add(
      this.add
        .image(x0, 0, decorTexture(this, side.terrain))
        .setOrigin(0)
        .setDisplaySize(DRAWN_W, DRAWN_H)
        .setFlipX(dir < 0),
    );

    const count = Math.min(SLOTS.length, drawnFigureCount(side.unitType, side.hpBefore));
    const figures: Figure[] = [];
    for (let i = 0; i < count; i++) {
      const slot = SLOTS[i];
      if (!slot) break;
      const homeX = x0 + DRAWN_HALF + slot.dx * dir;
      const pose = poseTexture(this, side.owner, side.unitType, 'idle', FIGURE_SCREEN_H);
      const front = slot.scale >= 1;
      const jitter = 1 + Phaser.Math.FloatBetween(-SIZE_JITTER, SIZE_JITTER);
      const baseScale = pose.scale * slot.scale * jitter;
      const tint = front ? Phaser.Utils.Array.GetRandom([...FRONT_TINTS]) : BACK_ROW_TINT;
      const [minDelay, maxDelay] = REACTION_MS[front ? 'front' : 'back'];
      const delay = Phaser.Math.Between(minDelay, maxDelay);
      const image = this.add
        .sprite(homeX, slot.y, pose.key)
        .setOrigin(0.5, 1)
        .setScale(baseScale)
        .setFlipX(dir < 0)
        .setTint(tint)
        .setDepth(slot.y);
      const shadow = this.add
        .image(homeX, slot.y, SHADOW)
        .setScale(baseScale * 0.95, baseScale * 0.95)
        .setAlpha(SHADOW_ALPHA);
      const figure: Figure = {
        image,
        homeX,
        homeY: slot.y,
        baseScale,
        tint,
        delay,
        slot,
        shadow,
        breathing: null,
      };
      this.shadowed.push(figure);
      const idle = drawnAnimation(this, side.owner, side.unitType, 'idle');
      if (idle) {
        // Repos dessiné : chaque soldat démarre à une image différente.
        image
          .setOrigin(dir < 0 ? 1 - idle.originX : idle.originX, idle.originY)
          .play({ key: idle.key, startFrame: Phaser.Math.Between(0, idle.frames.length - 1) });
      } else {
        this.breathe(figure);
      }
      figures.push(figure);
    }
    // Les ombres sous tous les soldats, puis le premier rang devant le second.
    for (const figure of figures) world.add(figure.shadow);
    figures
      .slice()
      .sort((a, b) => a.image.y - b.image.y)
      .forEach((figure) => world.add(figure.image));

    const hud = this.buildHud(side);
    const view: SideView = {
      side,
      dir,
      camera,
      world,
      figures,
      hud: hud.container,
      portrait: hud.portrait,
      hpText: hud.hpText,
      hpBar: hud.hpBar,
      hp: side.hpBefore,
    };
    this.setHp(view, side.hpBefore);
    return view;
  }

  private buildHud(side: CombatSide) {
    const left = side.side === 'left';
    const team = TEAM_COLORS[side.owner];
    const x = left ? HUD_MARGIN : DRAWN_W - HUD_MARGIN - HUD_W;
    const container = this.add.container(x, -HUD_H - 40);
    this.ui.add(container);

    const card = this.add.graphics();
    card.fillStyle(0x1a1410, 0.88).fillRoundedRect(0, 0, HUD_W, HUD_H, 22);
    card.lineStyle(6, team, 1).strokeRoundedRect(0, 0, HUD_W, HUD_H, 22);

    // Portrait au bord extérieur, chiffre des PV au bord intérieur (vers le centre).
    const px = left ? 13 : HUD_W - 13 - PORTRAIT;
    const frame = this.add.graphics();
    frame.fillStyle(darken(team), 1).fillRoundedRect(px, 13, PORTRAIT, PORTRAIT, 14);
    frame.lineStyle(4, 0xfff4c8, 1).strokeRoundedRect(px, 13, PORTRAIT, PORTRAIT, 14);
    const portrait = this.add.image(px + PORTRAIT / 2, 13 + PORTRAIT / 2, '__DEFAULT');
    this.showPortrait(portrait, side, 'neutral');

    const textX = left ? px + PORTRAIT + 24 : 200;
    const title = this.add.text(
      textX,
      18,
      `${FACTIONS[side.owner].name} · ${UNITS[side.unitType].name}`,
      { fontFamily: FONT, fontStyle: '800', fontSize: '40px', color: '#fff4c8' },
    );
    const defense = TERRAINS[side.terrain].defense;
    const terrain = this.add.text(
      textX,
      122,
      `${TERRAINS[side.terrain].name}   ${'★'.repeat(defense)}${'☆'.repeat(Math.max(0, 4 - defense))}`,
      { fontFamily: FONT, fontStyle: '700', fontSize: '30px', color: '#ffd166' },
    );
    const hpBar = this.add.graphics();
    hpBar.setPosition(textX, 78);

    const hpX = left ? HUD_W - 30 : 30;
    const hpText = this.add
      .text(hpX, HUD_H / 2 + 4, '', {
        fontFamily: FONT,
        fontStyle: '800',
        fontSize: '128px',
        color: '#ffffff',
        stroke: '#2b1b17',
        strokeThickness: 14,
      })
      .setOrigin(left ? 1 : 0, 0.5);

    container.add([card, frame, portrait, title, terrain, hpBar, hpText]);
    return { container, portrait, hpText, hpBar };
  }

  // ——— Caméras ———

  private allCameras(): Phaser.Cameras.Scene2D.Camera[] {
    return [this.views.left.camera, this.views.right.camera, this.uiCamera];
  }

  /**
   * Cadrage des deux caméras selon l'avancée du partage `p` (0 : l'attaquant plein écran,
   * 1 : moitié chacun). L'attaquant se resserre en gardant ses troupes au centre ; le
   * défenseur glisse depuis son bord.
   */
  private layoutCameras(attackerSide: Side, p: number): void {
    const defenderSide: Side = attackerSide === 'left' ? 'right' : 'left';
    const attacker = this.views[attackerSide].camera;
    const defender = this.views[defenderSide].camera;

    const aw = Math.round(DRAWN_W - DRAWN_HALF * p);
    attacker.setViewport(attackerSide === 'left' ? 0 : DRAWN_W - aw, 0, aw, DRAWN_H);
    attacker.setScroll(WORLD_X[attackerSide] + (DRAWN_W - aw) / 2, 0);

    const dw = DRAWN_W - aw;
    defender.setVisible(dw > 1);
    if (dw > 1) {
      if (defenderSide === 'left') {
        defender.setViewport(0, 0, dw, DRAWN_H);
        defender.setScroll(WORLD_X.left + DRAWN_HALF + DRAWN_HALF / 2 - dw, 0);
      } else {
        defender.setViewport(DRAWN_W - dw, 0, dw, DRAWN_H);
        defender.setScroll(WORLD_X.right + DRAWN_HALF / 2, 0);
      }
    }
    this.drawDivider(attackerSide === 'left' ? aw : DRAWN_W - aw, dw > 1);
  }

  /** Bande sombre en biais sur la jointure, avec un filet doré. */
  private drawDivider(x: number, visible: boolean): void {
    const g = this.divider.clear();
    if (!visible) return;
    const band = (inset: number, color: number) => {
      g.fillStyle(color, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(x - 12 + inset, 0),
          new Phaser.Math.Vector2(x + 34 - inset, 0),
          new Phaser.Math.Vector2(x + 12 - inset, DRAWN_H),
          new Phaser.Math.Vector2(x - 34 + inset, DRAWN_H),
        ],
        true,
      );
    };
    band(0, OUTLINE_COLOR);
    band(17, 0xffd166);
  }

  // ——— Petits effets ———

  private async slideHud(view: SideView): Promise<void> {
    await this.tween({
      targets: view.hud,
      y: HUD_MARGIN,
      duration: 380,
      ease: 'Back.easeOut',
    });
  }

  private setHp(view: SideView, hp: number): void {
    view.hp = hp;
    view.hpText.setText(String(Math.max(0, hp)));
    const g = view.hpBar.clear();
    const team = TEAM_COLORS[view.side.owner];
    for (let i = 0; i < 10; i++) {
      g.fillStyle(i < hp ? team : 0x4a3626, 1).fillRoundedRect(i * 42, 0, 34, 26, 6);
      g.lineStyle(3, 0x2b1b17, 1).strokeRoundedRect(i * 42, 0, 34, 26, 6);
    }
  }

  private setExpression(view: SideView, expression: Expression): void {
    this.showPortrait(view.portrait, view.side, expression);
  }

  /**
   * Image du cadre : un portrait remplit le cadre et regarde vers le centre de l'écran ;
   * l'écusson du peuple y tient entier, à ses proportions, sans être retourné.
   */
  private showPortrait(
    image: Phaser.GameObjects.Image,
    side: CombatSide,
    expression: Expression,
  ): void {
    const face = portraitTexture(this, side.owner, expression);
    image.setTexture(face.key);
    const box = PORTRAIT - (face.emblem ? 20 : 8);
    const scale = face.emblem ? Math.min(box / image.width, box / image.height) : 1;
    if (face.emblem) image.setScale(scale).setFlipX(false);
    else
      image
        .setDisplaySize(box, box)
        .setFlipX((side.side === 'left') === portraitFacesLeft(this, side.owner));
  }

  private setPose(view: SideView, figure: Figure, pose: Pose): void {
    const texture = poseTexture(this, view.side.owner, view.side.unitType, pose, FIGURE_SCREEN_H);
    figure.image
      .setTexture(texture.key)
      .setOrigin(0.5, 1)
      .setAngle(texture.angle * view.dir);
    if (pose === 'down') {
      figure.breathing?.stop();
      figure.breathing = null;
      figure.image.setScale(figure.baseScale);
    }
  }

  /**
   * Joue une animation de la séquence dessinée ; se résout à sa fin (aussitôt pour une
   * boucle). Sans séquence, la pose de secours, animée par le code.
   */
  /**
   * Tir d'un soldat ; se résout au lâcher. Tir dessiné : les 4 images (prendre la flèche,
   * encocher, bander, lâcher) à 8 par seconde, et la flèche part sur la dernière. Sinon,
   * pose d'attaque et départ après un court temps.
   */
  private shoot(view: SideView, figure: Figure): Promise<void> {
    const anim = drawnAnimation(this, view.side.owner, view.side.unitType, 'attack');
    if (!anim) {
      void this.act(view, figure, 'attack');
      return this.wait(320);
    }
    const sprite = figure.image;
    sprite.setOrigin(this.originX(view, anim.originX), anim.originY).setAngle(0);
    sprite.play({ key: anim.key, frameRate: 8 });
    if (this.skipped) return Promise.resolve();
    return Promise.race([
      new Promise<void>((resolve) => {
        const onUpdate = (_anim: unknown, frame: Phaser.Animations.AnimationFrame) => {
          if (!frame.isLast) return;
          sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, onUpdate);
          resolve();
        };
        sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, onUpdate);
      }),
      this.skipSignal,
      this.wait(1200),
    ]);
  }

  private act(view: SideView, figure: Figure, action: DrawnAnim): Promise<void> {
    const anim = drawnAnimation(this, view.side.owner, view.side.unitType, action);
    const sprite = figure.image;
    if (!anim) {
      sprite.anims.stop();
      this.setPose(view, figure, FALLBACK_POSE[action]);
      return Promise.resolve();
    }
    sprite.setOrigin(this.originX(view, anim.originX), anim.originY).setAngle(0);
    sprite.play(anim.key, true);
    if (action === 'idle' || action === 'run' || this.skipped) return Promise.resolve();
    return Promise.race([
      new Promise<void>((resolve) => sprite.once('animationcomplete', () => resolve())),
      this.skipSignal,
    ]);
  }

  /** Teinte de repos du soldat (après l'éclair blanc d'un coup). */
  private restoreTint(figure: Figure): void {
    figure.image.setTint(figure.tint).setTintMode(Phaser.TintModes.MULTIPLY);
  }

  /** Pose de secours sur un sprite du plan de contact (unité sans séquence). */
  private posePuppet(view: SideView, sprite: Phaser.GameObjects.Sprite, pose: Pose): void {
    const texture = poseTexture(this, view.side.owner, view.side.unitType, pose, FIGURE_SCREEN_H);
    sprite.anims.stop();
    sprite
      .setTexture(texture.key)
      .setOrigin(0.5, 1)
      .setAngle(texture.angle * view.dir);
  }

  /** Ancrage horizontal : un personnage retourné (camp de droite) a ses pieds en miroir. */
  private originX(view: SideView, originX: number): number {
    return view.dir < 0 ? 1 - originX : originX;
  }

  /** Une seule image de la séquence (la préparation, par exemple), ou la pose de secours. */
  private still(view: SideView, figure: Figure, action: DrawnAnim, index: number): void {
    const anim = drawnAnimation(this, view.side.owner, view.side.unitType, action);
    const texture = anim?.frames[index];
    if (!anim || !texture) return;
    figure.image.anims.stop();
    figure.image
      .setTexture(texture)
      .setOrigin(this.originX(view, anim.originX), anim.originY)
      .setAngle(0);
  }

  /** Respiration de repos : le figurant ne reste jamais figé. */
  private breathe(figure: Figure): void {
    figure.breathing = this.tweens.add({
      targets: figure.image,
      scaleY: figure.baseScale * 1.015,
      duration: Phaser.Math.Between(700, 1000),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: Phaser.Math.Between(0, 400),
    });
  }

  private addTo<T extends Phaser.GameObjects.GameObject>(view: SideView, object: T): T {
    view.world.add(object);
    return object;
  }

  private spark(view: SideView, x: number, y: number): void {
    this.sparkAt(view.world, x, y);
  }

  private sparkAt(world: Phaser.GameObjects.Container, x: number, y: number): void {
    const spark = this.add.image(x, y, SPARK).setScale(0.6).setDepth(2000);
    world.add(spark);
    void this.tween({
      targets: spark,
      scale: 1.6,
      alpha: 0,
      angle: 45,
      duration: 260,
      ease: 'Quad.easeOut',
    }).then(() => spark.destroy());
  }

  private slash(view: SideView, figure: Figure): void {
    const slash = this.addTo(
      view,
      this.add
        .image(figure.image.x, figure.image.y - 200 * figure.baseScale, SLASH)
        .setFlipX(view.dir > 0)
        // Le trait du coup prend le ton clair de l'équipe qui frappe.
        .setTint(TEAM_RAMPS[view.side.owner][3])
        .setScale(0.7),
    );
    void this.tween({
      targets: slash,
      scale: 1.15,
      alpha: 0,
      duration: 300,
      ease: 'Quad.easeOut',
    }).then(() => slash.destroy());
    this.spark(view, figure.image.x, figure.image.y - 220 * figure.baseScale);
  }

  private puff(view: SideView, x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const dust = this.addTo(
        view,
        this.add
          .image(x + Phaser.Math.Between(-40, 40), y - 10, DUST)
          .setScale(0.5)
          .setAlpha(0.9),
      );
      void this.tween({
        targets: dust,
        y: y - 50,
        x: dust.x + Phaser.Math.Between(-60, 60),
        scale: 1.4,
        alpha: 0,
        duration: 500,
        ease: 'Quad.easeOut',
      }).then(() => dust.destroy());
    }
  }

  /**
   * Trois étoiles qui tournent au-dessus de la tête d'un vaincu (orbite aplatie : elles
   * grossissent en passant devant), et s'effacent avec lui.
   */
  private dizzy(view: SideView, figure: Figure): void {
    const bounds = figure.image.getBounds();
    const cx = bounds.centerX;
    const cy = bounds.top + 24 * figure.baseScale;
    const radius = 70 * figure.baseScale;
    const stars = [0, 1, 2].map(() => {
      const star = this.add.image(cx, cy, STAR);
      view.world.add(star);
      return star;
    });
    const orbit = { a: 0 };
    this.tweens.add({
      targets: orbit,
      a: Math.PI * 2,
      duration: 1300,
      repeat: -1,
      onUpdate: () => {
        stars.forEach((star, i) => {
          const t = orbit.a + (i * Math.PI * 2) / 3;
          star
            .setPosition(cx + Math.cos(t) * radius, cy + Math.sin(t) * radius * 0.25)
            .setScale(figure.baseScale * (1.3 + 0.35 * Math.sin(t)))
            .setAlpha(figure.image.alpha);
        });
      },
    });
  }

  /** Éclair blanc sur tout l'écran (plan de contact). */
  private flashScreen(): void {
    const flash = this.add.rectangle(0, 0, DRAWN_W, DRAWN_H, 0xffffff, 0.6).setOrigin(0);
    this.ui.addAt(flash, 0);
    void this.tween({ targets: flash, alpha: 0, duration: 200 }).then(() => flash.destroy());
  }

  /** Éclair blanc sur la moitié touchée. */
  private flashHalf(view: SideView): void {
    const camera = view.camera;
    const flash = this.add
      .rectangle(camera.x, 0, camera.width, DRAWN_H, 0xffffff, 0.55)
      .setOrigin(0);
    this.ui.addAt(flash, 0);
    void this.tween({ targets: flash, alpha: 0, duration: 180 }).then(() => flash.destroy());
  }
}
