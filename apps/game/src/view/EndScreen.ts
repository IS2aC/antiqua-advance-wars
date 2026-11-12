import type Phaser from 'phaser';
import { FACTIONS, type GameState } from '@antiqua/engine';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../config';
import { GRID, panel } from '../ui/panels';
import { ActionMenu } from './ActionMenu';
import { pinToScreen, uiText } from './text';
import { DISABLED_TEXT_COLOR, TEAM_COLORS } from './palette';

export type EndChoice = 'rejouer' | 'menu';

const WIDTH = GRID * 44;
const HEIGHT = GRID * 26;
const ROW = GRID * 2;

/**
 * Écran de fin : vainqueur, nombre de jours, et pour chaque camp les unités produites,
 * les unités perdues et les bâtiments tenus. Puis « Rejouer » ou « Menu principal ».
 */
export class EndScreen {
  private readonly menu: ActionMenu;

  constructor(private readonly scene: Phaser.Scene) {
    this.menu = new ActionMenu(scene, false, 71);
  }

  get isOpen(): boolean {
    return this.menu.isOpen;
  }

  move(delta: number): void {
    this.menu.move(delta);
  }

  confirm(): void {
    this.menu.confirm();
  }

  async show(state: GameState): Promise<EndChoice> {
    const scene = this.scene;
    const shade = scene.add.rectangle(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x000000, 0.55);
    shade.setOrigin(0);
    const background = panel(scene, 0, 0, WIDTH, HEIGHT);
    const winner = state.winner;
    const title = uiText(
      scene,
      WIDTH / 2,
      GRID * 2,
      winner ? `Victoire : ${FACTIONS[winner].name} !` : 'Égalité',
      'large',
      { outline: true },
    ).setOrigin(0.5, 0);
    if (winner) title.setColor(`#${TEAM_COLORS[winner].toString(16).padStart(6, '0')}`);
    const subtitle = uiText(scene, WIDTH / 2, GRID * 7, `Partie terminée au jour ${state.day}`)
      .setOrigin(0.5, 0)
      .setColor(DISABLED_TEXT_COLOR);

    const columns = [GRID * 3, GRID * 17, GRID * 26, GRID * 35];
    const header = ['Camp', 'Produites', 'Perdues', 'Bâtiments'].map((label, i) =>
      uiText(scene, columns[i] ?? 0, GRID * 10, label, 'small', { color: DISABLED_TEXT_COLOR }),
    );
    const rows = state.players.flatMap((player, index) => {
      const y = GRID * 12 + index * ROW;
      const buildings = state.buildings.filter((b) => b.owner === player.id).length;
      const values = [
        FACTIONS[player.id].name + (player.defeated ? ' (vaincu)' : ''),
        String(player.stats.unitsBuilt),
        String(player.stats.unitsLost),
        String(buildings),
      ];
      return [
        scene.add.rectangle(GRID * 2, y + 6, 4, 6, TEAM_COLORS[player.id]).setOrigin(0),
        ...values.map((value, i) => uiText(scene, columns[i] ?? 0, y, value)),
      ];
    });

    const card = scene.add.container(
      (LOGICAL_WIDTH - WIDTH) / 2,
      (LOGICAL_HEIGHT - HEIGHT) / 2 - GRID * 3,
      [background, title, subtitle, ...header, ...rows],
    );
    pinToScreen(card).setDepth(70);
    const shadeLayer = scene.add.container(0, 0, [shade]);
    pinToScreen(shadeLayer).setDepth(69);

    const choice = await this.menu.open<EndChoice>(
      [
        { value: 'rejouer', label: 'Rejouer' },
        { value: 'menu', label: 'Menu principal' },
      ],
      { top: (LOGICAL_HEIGHT + HEIGHT) / 2 - GRID * 2 },
    );
    return choice ?? 'menu';
  }
}
