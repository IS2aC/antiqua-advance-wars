import Phaser from 'phaser';
import { FACTIONS, GUE_DU_NIL, createGame } from '@antiqua/engine';
import { AI_OPPONENT, battleFromUrl } from '../launch';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, TILE_SIZE } from '../config';
import { loadGame } from '../persistence/save';
import { font } from '../ui/font';
import { onKeyDown } from '../ui/keyboard';
import { GRID, createPanelTextures } from '../ui/panels';
import { ActionMenu, type MenuItem } from '../view/ActionMenu';
import { createUnitAnimations, preloadArt } from '../view/art';
import { MapView } from '../view/MapView';
import { uiText } from '../view/text';
import { DISABLED_TEXT_COLOR } from '../view/palette';

type TitleChoice = 'continuer' | 'ia' | 'deux';

/** Écran titre : « Continuer » (si une sauvegarde existe), « Contre l'IA » et « À deux ». */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  /** Atlas produits par `pnpm assets:build` ; s'ils manquent, le jeu garde les placeholders. */
  preload(): void {
    preloadArt(this);
  }

  create(): void {
    // Arrivée depuis la page de garde avec un mode : on va droit à la bataille.
    const launch = battleFromUrl();
    if (launch) {
      this.scene.start('Battle', launch);
      return;
    }
    createPanelTextures(this);
    createUnitAnimations(this);

    // La carte du Gué du Nil en fond, assombrie.
    const preview = createGame(GUE_DU_NIL, { seed: 1 });
    new MapView(this, preview);
    this.cameras.main.setScroll(0, ((preview.map.height * TILE_SIZE - LOGICAL_HEIGHT) / 2) | 0);
    this.add
      .rectangle(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x1a1410, 0.72)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(20);

    uiText(this, LOGICAL_WIDTH / 2, GRID * 8, 'ALKÉBULAN', 'title', { outline: true })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setColor('#ffd166');
    uiText(this, LOGICAL_WIDTH / 2, GRID * 14, 'Rise of Kingdoms', 'large', { outline: true })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30);
    if (font().pixel) {
      uiText(
        this,
        LOGICAL_WIDTH / 2,
        LOGICAL_HEIGHT - GRID * 2,
        'Police m5x7 — Daniel Linssen',
        'small',
        {
          color: DISABLED_TEXT_COLOR,
        },
      )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(30);
    }

    const save = loadGame();
    const items: MenuItem<TitleChoice>[] = [];
    if (save) {
      items.push({
        value: 'continuer',
        label: 'Continuer',
        detail: `Jour ${save.state.day} · ${save.aiPlayers.length > 0 ? "contre l'IA" : 'à deux'}`,
      });
    }
    items.push({ value: 'ia', label: "Contre l'IA", detail: FACTIONS.koush.name });
    items.push({ value: 'deux', label: 'À deux joueurs', detail: 'même écran' });

    const menu = new ActionMenu(this, false);
    onKeyDown(this, (event) => {
      if (event.code === 'ArrowUp') menu.move(-1);
      else if (event.code === 'ArrowDown') menu.move(1);
      else if (event.code === 'Enter' || event.code === 'Space') menu.confirm();
    });
    void menu.open(items, { top: GRID * 22 }).then((choice) => {
      if (choice === 'continuer' && save) {
        this.scene.start('Battle', { state: save.state, aiPlayers: save.aiPlayers });
      } else if (choice === 'ia') {
        this.scene.start('Battle', { aiPlayers: [AI_OPPONENT] });
      } else {
        this.scene.start('Battle', {});
      }
    });
  }
}
