import type Phaser from 'phaser';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../config';
import { GRID } from '../ui/panels';
import { ActionMenu } from './ActionMenu';
import { pinToScreen, uiText } from './text';

/**
 * - reprendre : retour à la partie ;
 * - quitter : la partie est sauvegardée telle quelle, puis retour au menu principal
 *   (« Continuer » la reprendra exactement là) ;
 * - abandonner : la sauvegarde est effacée, puis retour au menu principal.
 */
export type PauseChoice = 'reprendre' | 'quitter' | 'abandonner';

const MENU_TOP = GRID * 21;
/** Plus clair que le texte désactivé : il doit se lire sur le voile sombre. */
const HINT_COLOR = '#d8c8a0';

/** Menu pause : voile sombre sur la carte, titre, puis les choix (Échap = reprendre). */
export class PauseMenu {
  private readonly menu: ActionMenu;
  private readonly overlay: Phaser.GameObjects.Container;
  private readonly hint: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.menu = new ActionMenu(scene, true, 66);
    const shade = scene.add
      .rectangle(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x000000, 0.6)
      .setOrigin(0)
      .setInteractive(); // bloque les clics sur la carte pendant la pause
    const title = uiText(scene, LOGICAL_WIDTH / 2, GRID * 13, 'Pause', 'large', {
      outline: true,
    }).setOrigin(0.5);
    this.hint = uiText(scene, LOGICAL_WIDTH / 2, GRID * 17, '', 'small', {
      color: HINT_COLOR,
      outline: true,
    }).setOrigin(0.5);
    this.overlay = scene.add.container(0, 0, [shade, title, this.hint]);
    pinToScreen(this.overlay).setDepth(65).setVisible(false);
  }

  get isOpen(): boolean {
    return this.overlay.visible;
  }

  move(delta: number): void {
    this.menu.move(delta);
  }

  confirm(): void {
    this.menu.confirm();
  }

  cancel(): void {
    this.menu.cancel();
  }

  /** Ouvre la pause et renvoie le choix du joueur (abandon confirmé à part). */
  async open(): Promise<PauseChoice> {
    this.overlay.setVisible(true);
    try {
      for (;;) {
        this.hint.setText('Quitter garde la partie : « Continuer » la reprendra ici.');
        const choice = await this.menu.open<PauseChoice>(
          [
            { value: 'reprendre', label: 'Reprendre' },
            { value: 'quitter', label: 'Sauvegarder et quitter' },
            { value: 'abandonner', label: 'Abandonner la partie' },
          ],
          { top: MENU_TOP },
        );
        if (choice !== 'abandonner') return choice ?? 'reprendre';

        this.hint.setText('La partie sera perdue : impossible de la reprendre.');
        const sure = await this.menu.open(
          [
            { value: 'non', label: 'Non, revenir' },
            { value: 'oui', label: 'Oui, abandonner' },
          ],
          { top: MENU_TOP },
        );
        if (sure === 'oui') return 'abandonner';
      }
    } finally {
      this.overlay.setVisible(false);
    }
  }
}
