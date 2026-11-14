import Phaser from 'phaser';
import { CAPTURE_POINTS, FACTIONS, UNITS, type PlayerId } from '@antiqua/engine';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../config';
import { GRID, panel } from '../ui/panels';
import { BUILDING_ATLAS, buildingFrame, idleAnimation, walkAnimation } from '../view/art';
import { NEUTRAL_COLOR, TEAM_COLORS } from '../view/palette';
import { uiText } from '../view/text';
import { figureAnimation } from './packs';
import { soldierCount, type CaptureSetup } from './setup';
import { HUD_H, createFigure, drawBackdrop, type FigureSprite } from './stage';
import { StagedScene } from './StagedScene';

export interface CaptureSceneData {
  readonly setup: CaptureSetup;
  readonly speed: number;
  readonly onDone: () => void;
}

/**
 * Scène de siège : les troupes marchent sur le bâtiment et la jauge de capture baisse du
 * nombre de points retirés par le moteur. Quand elle atteint zéro, le drapeau change de
 * camp ; la prise d'un QG adverse est une annexion, qui annonce la victoire.
 * Comme les scènes de combat, elle illustre le résultat du moteur sans rien calculer.
 */

const BUILDING_SCALE = 3;
const BUILDING_X = 476;
const GROUND_Y = 352;
const NAMES = { village: 'Village', caserne: 'Caserne', qg: 'QG' } as const;

/** Rangs des troupes qui assiègent (côté gauche), du premier rang vers l'arrière. */
const SLOTS: readonly (readonly [number, number])[] = [
  [262, 352],
  [236, 300],
  [210, 352],
  [184, 300],
  [158, 352],
  [132, 300],
  [106, 352],
  [80, 300],
  [54, 352],
  [28, 300],
];

const colorOf = (owner: PlayerId | null) => (owner ? TEAM_COLORS[owner] : NEUTRAL_COLOR);
const css = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

export class CaptureScene extends StagedScene {
  constructor() {
    super('Capture');
  }

  create(data: CaptureSceneData): void {
    this.beginStage(data.speed);
    void this.run(data);
  }

  private async run(data: CaptureSceneData): Promise<void> {
    const { setup } = data;
    drawBackdrop(this, setup.building, 0, LOGICAL_WIDTH);

    // Le bâtiment, aux couleurs de son propriétaire actuel.
    const building = this.textures.exists(BUILDING_ATLAS)
      ? this.add
          .image(
            BUILDING_X,
            GROUND_Y,
            BUILDING_ATLAS,
            buildingFrame(setup.building, setup.previousOwner),
          )
          .setOrigin(0.5, 1)
          .setScale(BUILDING_SCALE)
      : this.add
          .rectangle(BUILDING_X, GROUND_Y, 96, 128, colorOf(setup.previousOwner))
          .setOrigin(0.5, 1);
    building.setDepth(GROUND_Y - 1);

    // Les troupes qui assiègent : un figurant par PV.
    const figures: { sprite: FigureSprite; pack: boolean; homeX: number }[] = [];
    const count = soldierCount(setup.unitType, setup.unitHp);
    for (let i = 0; i < count; i++) {
      const slot = SLOTS[i];
      if (!slot) break;
      const figure = createFigure(this, setup.owner, setup.unitType, slot[0], slot[1], false);
      figures.push({ ...figure, homeX: slot[0] });
    }

    // Bandeau : qui assiège quoi, et la jauge de capture (20 crans).
    const hud = this.buildHud(setup);

    this.cameras.main.fadeIn(150, 0, 0, 0);
    await this.wait(300);

    // Les troupes marchent sur le bâtiment.
    for (const figure of figures) this.play(figure, setup, 'walk');
    await Promise.all(
      figures.map((figure) =>
        this.tween({
          targets: figure.sprite,
          x: figure.homeX + 70,
          duration: 650,
          ease: 'Sine.easeInOut',
        }),
      ),
    );
    for (const figure of figures) this.play(figure, setup, 'attack');

    // La jauge descend cran par cran, le bâtiment tremble.
    for (let points = setup.pointsBefore - 1; points >= setup.pointsAfter; points--) {
      hud.setPoints(points);
      void this.tween({
        targets: building,
        x: BUILDING_X + (points % 2 === 0 ? 2 : -2),
        duration: 40,
        yoyo: true,
      });
      await this.wait(70);
    }
    hud.setPoints(setup.pointsAfter);
    building.setX(BUILDING_X);
    for (const figure of figures) this.play(figure, setup, 'idle');

    if (setup.captured) {
      // Le drapeau change de camp.
      this.cameras.main.flash(180, 255, 244, 200);
      if (building instanceof Phaser.GameObjects.Image) {
        building.setFrame(buildingFrame(setup.building, setup.owner));
      } else {
        building.setFillStyle(colorOf(setup.owner));
      }
      hud.setPoints(CAPTURE_POINTS, setup.owner);
      await this.announce(
        setup.annexation ? 'Annexion du QG !' : 'Capturé !',
        setup.annexation && setup.previousOwner
          ? `${FACTIONS[setup.owner].name} annexe ${FACTIONS[setup.previousOwner].name}`
          : null,
        setup.owner,
      );
      if (setup.annexation) {
        this.cameras.main.shake(300, 0.006);
        // Les troupes lèvent les armes.
        await Promise.all(
          figures.map((figure, i) =>
            this.wait(i * 40).then(() =>
              this.tween({
                targets: figure.sprite,
                y: figure.sprite.y - 10,
                duration: 160,
                yoyo: true,
                repeat: 1,
              }),
            ),
          ),
        );
      }
    }

    await this.wait(setup.annexation ? 1300 : 600);
    await this.endStage(data.onDone);
  }

  private buildHud(setup: CaptureSetup): {
    setPoints(points: number, owner?: PlayerId | null): void;
  } {
    const width = LOGICAL_WIDTH - GRID * 2;
    panel(this, GRID, GRID, width, HUD_H - GRID).setDepth(900);
    this.add
      .rectangle(GRID + 6, GRID + 6, 6, HUD_H - GRID - 12, TEAM_COLORS[setup.owner])
      .setOrigin(0)
      .setDepth(901);
    const target = setup.previousOwner ? FACTIONS[setup.previousOwner].name : 'neutre';
    uiText(
      this,
      GRID + 18,
      GRID + 4,
      `Siège · ${FACTIONS[setup.owner].name} ${UNITS[setup.unitType].name} → ${NAMES[setup.building]} (${target})`,
    ).setDepth(901);
    const label = uiText(this, GRID + 18, GRID + 24, '', 'small').setDepth(901);
    const gauge = this.add.graphics().setDepth(901);
    const gaugeX = LOGICAL_WIDTH - GRID * 3 - CAPTURE_POINTS * 9;
    let gaugeOwner = setup.previousOwner;
    const setPoints = (points: number, owner: PlayerId | null = gaugeOwner) => {
      gaugeOwner = owner;
      label.setText(`Capture ${points} / ${CAPTURE_POINTS}`);
      gauge.clear();
      for (let i = 0; i < CAPTURE_POINTS; i++) {
        gauge.fillStyle(i < points ? colorOf(gaugeOwner) : 0x3a2a1e, 1);
        gauge.fillRect(gaugeX + i * 9, GRID + 27, 7, 9);
      }
    };
    setPoints(setup.pointsBefore);
    return { setPoints };
  }

  /** Grand texte au centre, qui grossit puis se pose. */
  private async announce(text: string, subtitle: string | null, owner: PlayerId): Promise<void> {
    const title = uiText(this, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 24, text, 'title', {
      outline: true,
    })
      .setOrigin(0.5)
      .setColor(css(TEAM_COLORS[owner]))
      .setDepth(950)
      .setScale(0.4);
    if (subtitle) {
      uiText(this, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 20, subtitle, 'large', { outline: true })
        .setOrigin(0.5)
        .setDepth(950);
    }
    await this.tween({ targets: title, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  private play(
    figure: { sprite: FigureSprite; pack: boolean },
    setup: CaptureSetup,
    anim: 'idle' | 'walk' | 'attack',
  ): void {
    const sprite = figure.sprite;
    if (!(sprite instanceof Phaser.GameObjects.Sprite)) return;
    if (figure.pack) {
      const key = figureAnimation(setup.owner, setup.unitType, anim);
      if (this.anims.exists(key)) sprite.play(key, true);
      return;
    }
    // Sprites de carte : pas d'animation d'attaque, on garde la marche puis le repos.
    if (anim === 'walk') sprite.play(walkAnimation(setup.owner, setup.unitType, 'right'), true);
    if (anim === 'idle') sprite.play(idleAnimation(setup.owner, setup.unitType), true);
  }
}
