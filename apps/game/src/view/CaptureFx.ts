import Phaser from 'phaser';
import { CAPTURE_POINTS, TERRAINS, type BuildingType, type PlayerId } from '@antiqua/engine';
import { TILE_SIZE } from '../config';
import { OUTLINE_COLOR, TEAM_COLORS } from './palette';
import { tileText } from './text';

const T = TILE_SIZE;
const GAUGE_W = 24;
const GAUGE_H = 4;

export interface CaptureFxData {
  readonly x: number;
  readonly y: number;
  readonly building: BuildingType;
  /** Camp qui capture. */
  readonly owner: PlayerId;
  readonly pointsBefore: number;
  readonly pointsAfter: number;
  readonly captured: boolean;
  /** L'unité qui capture (elle « pousse » sur le bâtiment). */
  readonly unit: Phaser.GameObjects.Container | null;
  /** Le bâtiment sur la carte (sprite, ou bloc sans atlas). */
  readonly buildingVisual: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null;
  /** Met la carte à l'état final (couleur du bâtiment, points restants). */
  readonly syncMap: () => void;
}

/**
 * Capture jouée sur le plateau, sans quitter la carte : l'unité pousse, une jauge monte
 * au-dessus du bâtiment ; à la prise, le bâtiment s'illumine et prend les couleurs du camp.
 * Coordonnées entières (pixel art), environ une seconde, deux à la prise.
 */
export async function playCaptureOnBoard(scene: Phaser.Scene, data: CaptureFxData): Promise<void> {
  const cx = data.x * T + T / 2;
  const top = data.y * T;
  const team = TEAM_COLORS[data.owner];
  const progress = (points: number) => (CAPTURE_POINTS - points) / CAPTURE_POINTS;

  // Jauge au-dessus de la case (le toit déborde sur la case du dessus : on la pose dessous
  // le bord haut de la case, sur le bâtiment).
  const gx = Math.round(cx - GAUGE_W / 2);
  const gy = Math.round(top - 2);
  const frame = scene.add
    .rectangle(gx - 1, gy - 1, GAUGE_W + 2, GAUGE_H + 2, OUTLINE_COLOR)
    .setOrigin(0)
    .setDepth(46);
  const fill = scene.add
    .rectangle(gx, gy, Math.round(GAUGE_W * progress(data.pointsBefore)), GAUGE_H, team)
    .setOrigin(0)
    .setDepth(47);

  const push = data.unit ? hop(scene, data.unit) : Promise.resolve();
  dust(scene, cx, top + T - 4);
  const counter = { value: progress(data.pointsBefore) };
  await Promise.all([
    push,
    tween(scene, {
      targets: counter,
      value: progress(data.pointsAfter),
      duration: 520,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        fill.width = Math.round(GAUGE_W * counter.value);
      },
    }),
  ]);

  if (data.captured) {
    await seize(scene, data, cx, top, team);
  } else {
    data.syncMap();
    popup(scene, cx, top - 6, `${data.pointsAfter}`, '#ffe066');
    await wait(scene, 380);
  }
  await tween(scene, { targets: [frame, fill], alpha: 0, duration: 200 });
  frame.destroy();
  fill.destroy();
}

/** Prise : éclat blanc, le bâtiment change de couleur avec un rebond, étincelles, texte. */
async function seize(
  scene: Phaser.Scene,
  data: CaptureFxData,
  cx: number,
  top: number,
  team: number,
): Promise<void> {
  const visual = data.buildingVisual;
  if (visual instanceof Phaser.GameObjects.Image) {
    visual.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
  }
  await wait(scene, 90);
  data.syncMap();
  if (visual instanceof Phaser.GameObjects.Image) {
    visual.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
  }
  if (visual) {
    const sx = visual.scaleX;
    const sy = visual.scaleY;
    void tween(scene, {
      targets: visual,
      scaleX: sx * 1.12,
      scaleY: sy * 1.12,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => visual.setScale(sx, sy),
    });
  }
  sparks(scene, cx, top + T / 2, team);
  popup(scene, cx, top - 6, `${TERRAINS[data.building].name} pris !`, '#ffe066');
  await wait(scene, 700);
}

/** L'unité pousse deux fois sur le bâtiment (petits sauts). */
function hop(scene: Phaser.Scene, unit: Phaser.GameObjects.Container): Promise<void> {
  const y = unit.y;
  return tween(scene, {
    targets: unit,
    y: y - 3,
    duration: 90,
    yoyo: true,
    repeat: 1,
    ease: 'Quad.easeOut',
    onComplete: () => unit.setY(y),
  });
}

/** Petits nuages de poussière aux pieds. */
function dust(scene: Phaser.Scene, x: number, y: number): void {
  for (const dx of [-7, 7]) {
    const puff = scene.add.rectangle(Math.round(x + dx), y, 3, 3, 0xd8c8a0).setDepth(44);
    scene.tweens.add({
      targets: puff,
      x: puff.x + Math.sign(dx) * 5,
      y: y - 3,
      alpha: 0,
      duration: 380,
      onComplete: () => puff.destroy(),
    });
  }
}

/** Étincelles aux couleurs du camp, en étoile. */
function sparks(scene: Phaser.Scene, x: number, y: number, team: number): void {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const color = i % 2 === 0 ? team : 0xffe066;
    const spark = scene.add.rectangle(x, y, 2, 2, color).setDepth(48);
    scene.tweens.add({
      targets: spark,
      x: Math.round(x + Math.cos(angle) * 14),
      y: Math.round(y + Math.sin(angle) * 14),
      alpha: 0,
      duration: 420,
      ease: 'Quad.easeOut',
      onComplete: () => spark.destroy(),
    });
  }
}

function popup(scene: Phaser.Scene, x: number, y: number, text: string, color: string): void {
  const label = tileText(scene, x, y, text, 11).setOrigin(0.5).setColor(color).setDepth(49);
  scene.tweens.add({
    targets: label,
    y: y - 12,
    alpha: 0,
    delay: 450,
    duration: 500,
    onComplete: () => label.destroy(),
  });
}

function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    const done = config.onComplete;
    scene.tweens.add({
      ...config,
      onComplete: (...args) => {
        if (done) (done as (...a: unknown[]) => void)(...args);
        resolve();
      },
    });
  });
}

function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => scene.time.delayedCall(ms, resolve));
}
