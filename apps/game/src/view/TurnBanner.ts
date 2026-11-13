import type Phaser from 'phaser';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../config';
import { GRID, panel } from '../ui/panels';
import { pinToScreen, uiText } from './text';

const WIDTH = LOGICAL_WIDTH - GRID * 8;
const HEIGHT = GRID * 6;

/** Bandeau « Jour N — Koush » entre les tours. */
export class TurnBanner {
  private readonly container: Phaser.GameObjects.Container;
  private readonly stripes: Phaser.GameObjects.Rectangle[];
  private readonly label: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    const background = panel(scene, 0, 0, WIDTH, HEIGHT);
    // Liserés à la couleur du camp qui commence son tour.
    this.stripes = [GRID, HEIGHT - GRID - 2].map((y) =>
      scene.add.rectangle(GRID, y, WIDTH - GRID * 2, 2, 0xffffff).setOrigin(0),
    );
    this.label = uiText(scene, WIDTH / 2, HEIGHT / 2, '', 'large', { outline: true });
    this.label.setOrigin(0.5);
    this.container = scene.add.container(
      (LOGICAL_WIDTH - WIDTH) / 2,
      (LOGICAL_HEIGHT - HEIGHT) / 2,
      [background, ...this.stripes, this.label],
    );
    pinToScreen(this.container).setDepth(60).setVisible(false);
  }

  /** Fait glisser le bandeau, le garde `holdMs` ms, puis le retire. */
  show(text: string, color: number, holdMs = 900): Promise<void> {
    const baseX = (LOGICAL_WIDTH - WIDTH) / 2;
    this.label.setText(text);
    for (const stripe of this.stripes) stripe.setFillStyle(color);
    this.container
      .setVisible(true)
      .setAlpha(0)
      .setX(baseX - LOGICAL_WIDTH / 4);
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        x: baseX,
        alpha: 1,
        duration: 220,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: this.container,
            x: baseX + LOGICAL_WIDTH / 4,
            alpha: 0,
            delay: holdMs,
            duration: 200,
            ease: 'Quad.easeIn',
            onComplete: () => {
              this.container.setVisible(false);
              resolve();
            },
          });
        },
      });
    });
  }
}
