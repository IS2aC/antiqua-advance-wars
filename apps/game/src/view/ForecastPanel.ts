import type Phaser from 'phaser';
import { UNITS, displayHp, type Forecast, type Unit } from '@antiqua/engine';
import { LOGICAL_WIDTH } from '../config';
import { GRID, panel } from '../ui/panels';
import { pinToScreen, uiText } from './text';
import { TEAM_COLORS } from './palette';

const WIDTH = GRID * 24;
const HEIGHT = GRID * 7;

/** Les dégâts sont en % des 100 PV internes ; on les montre aussi en PV affichés. */
function describe(range: { min: number; max: number }): string {
  const percent = range.min === range.max ? `${range.min} %` : `${range.min}–${range.max} %`;
  const [low, high] = [displayHp(range.min), displayHp(range.max)];
  return `${percent} (${low === high ? low : `${low}–${high}`} PV)`;
}

/**
 * Prévision de combat, affichée pendant le choix de la cible : dégâts estimés min–max
 * et riposte estimée, calculés par `forecast()` du moteur (sans tirer au hasard).
 */
export class ForecastPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly damage: Phaser.GameObjects.Text;
  private readonly counter: Phaser.GameObjects.Text;
  private readonly attackerPip: Phaser.GameObjects.Rectangle;
  private readonly defenderPip: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    const background = panel(scene, 0, 0, WIDTH, HEIGHT);
    this.attackerPip = scene.add.rectangle(GRID, GRID + 3, 6, 6, 0xffffff).setOrigin(0);
    this.defenderPip = scene.add.rectangle(WIDTH - GRID - 6, GRID + 3, 6, 6, 0xffffff).setOrigin(0);
    this.title = uiText(scene, WIDTH / 2, GRID - 2, '').setOrigin(0.5, 0);
    this.damage = uiText(scene, GRID, GRID * 3, '');
    this.counter = uiText(scene, GRID, GRID * 5 - 2, '', 'small');
    this.container = scene.add.container((LOGICAL_WIDTH - WIDTH) / 2, GRID * 4, [
      background,
      this.attackerPip,
      this.defenderPip,
      this.title,
      this.damage,
      this.counter,
    ]);
    pinToScreen(this.container).setDepth(45).setVisible(false);
  }

  show(attacker: Unit, defender: Unit, prediction: Forecast): void {
    this.attackerPip.setFillStyle(TEAM_COLORS[attacker.owner]);
    this.defenderPip.setFillStyle(TEAM_COLORS[defender.owner]);
    this.title.setText(`${UNITS[attacker.type].name} → ${UNITS[defender.type].name}`);
    this.damage.setText(`Dégâts : ${describe(prediction.damage)}`);
    this.counter.setText(
      prediction.counter ? `Riposte : ${describe(prediction.counter)}` : 'Pas de riposte',
    );
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }
}
