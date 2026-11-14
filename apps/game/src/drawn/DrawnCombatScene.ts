import Phaser from 'phaser';
import { FACTIONS, TERRAINS, UNITS } from '@antiqua/engine';
import { StagedScene } from '../combat/StagedScene';
import type { CombatSetup, CombatSide, Side, Strike } from '../combat/setup';
import { OUTLINE_COLOR, TEAM_COLORS, darken } from '../view/palette';
import {
  ARROW,
  DUST,
  SLASH,
  SPARK,
  STONE,
  createEffectTextures,
  decorTexture,
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
 */

const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';
/** Les deux mondes sont posés loin l'un de l'autre : chaque caméra ne voit que le sien. */
const WORLD_X: Record<Side, number> = { left: 0, right: 4000 };
const HUD_W = 900;
const HUD_H = 176;
const HUD_MARGIN = 24;
const PORTRAIT = 150;

interface Figure {
  readonly image: Phaser.GameObjects.Image;
  readonly homeX: number;
  readonly baseScale: number;
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

  constructor() {
    super('DrawnCombat');
  }

  create(data: DrawnCombatData): void {
    this.beginStage(data.speed);
    createEffectTextures(this);
    const { setup } = data;
    const attackerSide = setup.left.role === 'attaquant' ? 'left' : 'right';

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

    leftCamera.ignore([this.views.right.world, this.ui]);
    rightCamera.ignore([this.views.left.world, this.ui]);
    this.uiCamera.ignore([this.views.left.world, this.views.right.world]);

    // Au départ, seul l'attaquant est à l'écran, plein cadre.
    this.layoutCameras(attackerSide, 0);

    void this.run(data, attackerSide);
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
    this.setExpression(this.views.left, finalExpression(left, right));
    this.setExpression(this.views.right, finalExpression(right, left));
    await this.wait(900);
    await this.finish(data.onDone);
  }

  private async playStrike(strike: Strike, from: SideView, to: SideView): Promise<void> {
    this.setExpression(from, 'shout');
    if (strike.ranged) {
      for (const figure of from.figures) this.setPose(from, figure, 'attack');
      await this.wait(260);
      await this.volley(from, to, from.side.unitType === 'catapulte');
    } else {
      // Anticipation (léger recul), puis charge vers l'ennemi.
      await Promise.all(
        from.figures.map((figure) =>
          this.tween({
            targets: figure.image,
            x: figure.homeX - from.dir * 36,
            duration: 160,
            ease: 'Quad.easeOut',
          }),
        ),
      );
      for (const figure of from.figures) {
        this.setPose(from, figure, 'attack');
        this.puff(from, figure.image.x - from.dir * 40, figure.image.y);
      }
      await Promise.all(
        from.figures.map((figure) =>
          this.tween({
            targets: figure.image,
            x: figure.homeX + from.dir * 170,
            duration: 190,
            ease: 'Quad.easeIn',
          }),
        ),
      );
      // Le coup porte de l'autre côté : une entaille sur chaque cible.
      for (const figure of to.figures) this.slash(to, figure);
    }

    await this.impact(to, strike);

    for (const figure of from.figures) {
      if (!strike.ranged) {
        void this.tween({
          targets: figure.image,
          x: figure.homeX,
          duration: 320,
          ease: 'Quad.easeOut',
        });
      }
      this.setPose(from, figure, 'idle');
    }
    if (from.hp > 0) this.setExpression(from, 'neutral');
  }

  /** Tir : les projectiles quittent l'écran du tireur, puis tombent sur la cible. */
  private async volley(from: SideView, to: SideView, heavy: boolean): Promise<void> {
    const texture = heavy ? STONE : ARROW;
    const shots = from.figures.flatMap((figure) => (heavy ? [figure] : [figure, figure]));
    const outgoing = shots.map(async (figure, i) => {
      await this.wait(i * 60);
      const sx = figure.image.x + from.dir * 60;
      const sy = figure.image.y - 260 * figure.baseScale;
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
        if (projectile.texture.key === ARROW) projectile.setRotation(angle);
      },
    });
  }

  /** Impact : éclair, secousse, PV qui descendent, figurants qui tombent. */
  private async impact(target: SideView, strike: Strike): Promise<void> {
    this.setExpression(target, 'hurt');
    target.camera.shake(220, 0.01);
    this.flashHalf(target);

    for (const figure of target.figures) {
      this.setPose(target, figure, 'hit');
      figure.image.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.time.delayedCall(90, () => figure.image.clearTint());
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

    const remaining = drawnFigureCount(target.side.unitType, strike.targetHpAfter);
    const fallen = target.figures.splice(remaining);
    const falls = fallen.map(async (figure, i) => {
      await this.wait(220 + i * 90);
      this.setPose(target, figure, 'down');
      this.puff(target, figure.image.x, figure.image.y);
      await this.tween({ targets: figure.image, alpha: 0, duration: 450, delay: 450 });
    });

    await Promise.all([countdown, ...falls]);
    this.setHp(target, strike.targetHpAfter);
    await this.wait(200);
    for (const figure of target.figures) this.setPose(target, figure, 'idle');
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
      const baseScale = pose.scale * slot.scale;
      const image = this.add
        .image(homeX, slot.y, pose.key)
        .setOrigin(0.5, 1)
        .setScale(baseScale)
        .setFlipX(dir < 0)
        .setDepth(slot.y);
      // Second rang un peu voilé : profondeur.
      if (slot.scale < 1) image.setTint(0xd8d0c0);
      const figure: Figure = { image, homeX, baseScale, breathing: null };
      this.breathe(figure);
      figures.push(figure);
    }
    // Le premier rang devant le second.
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
    const portrait = this.add
      .image(px + PORTRAIT / 2, 13 + PORTRAIT, portraitTexture(this, side.owner, 'neutral'))
      .setOrigin(0.5, 1)
      .setDisplaySize(PORTRAIT - 8, PORTRAIT - 8)
      // Chaque portrait regarde vers le centre de l'écran.
      .setFlipX(left === portraitFacesLeft(this, side.owner));

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
    view.portrait
      .setTexture(portraitTexture(this, view.side.owner, expression))
      .setDisplaySize(PORTRAIT - 8, PORTRAIT - 8);
  }

  private setPose(view: SideView, figure: Figure, pose: Pose): void {
    const texture = poseTexture(this, view.side.owner, view.side.unitType, pose, FIGURE_SCREEN_H);
    figure.image.setTexture(texture.key).setAngle(texture.angle * view.dir);
    if (pose === 'down') {
      figure.breathing?.stop();
      figure.breathing = null;
      figure.image.setScale(figure.baseScale);
    }
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
    const spark = this.addTo(view, this.add.image(x, y, SPARK).setScale(0.6).setDepth(2000));
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
