import Phaser from 'phaser';
import type { CombatSetup } from '../combat/setup';
import { preloadDrawn } from './assets';
import { DrawnCombatScene, type DrawnCombatData } from './DrawnCombatScene';
import { DRAWN_H, DRAWN_W } from './layout';

/**
 * Scène des combats dessinés : un second jeu Phaser en 1920×1152, sans pixel art, posé
 * au-dessus du canvas de la carte le temps d'un combat. La carte reste en pixel art
 * (zoom entier) ; les illustrations restent lisses. Créé au premier combat, puis gardé
 * (caché) pour les suivants.
 */

const READY = 'drawn-ready';

class DrawnBootScene extends Phaser.Scene {
  constructor() {
    super('DrawnBoot');
  }

  preload(): void {
    preloadDrawn(this);
  }

  create(): void {
    this.game.events.emit(READY);
  }
}

class DrawnStage {
  private game: Phaser.Game | null = null;
  private ready: Promise<void> | null = null;
  private overlay: HTMLDivElement | null = null;
  private host: HTMLElement | null = null;

  /**
   * Joue un combat par-dessus l'élément `host` (le canvas de la carte, ou la zone du banc
   * d'essai) ; se résout au retour à la carte.
   */
  async play(host: HTMLElement, setup: CombatSetup, speed: number): Promise<void> {
    this.host = host;
    await this.ensure();
    const overlay = this.overlay;
    const game = this.game;
    if (!overlay || !game) return;
    this.place();
    overlay.style.visibility = 'visible';
    overlay.style.pointerEvents = 'auto';
    await new Promise<void>((resolve) => {
      const data: DrawnCombatData = { setup, speed, onDone: resolve };
      game.scene.start('DrawnCombat', data);
    });
    this.hide();
  }

  /**
   * Caché sans `display: none` : le calque garde sa taille, sinon Phaser calcule une
   * mise à l'échelle nulle (canvas de 0 px).
   */
  private hide(): void {
    if (!this.overlay) return;
    this.overlay.style.visibility = 'hidden';
    this.overlay.style.pointerEvents = 'none';
  }

  private ensure(): Promise<void> {
    if (this.ready) return this.ready;
    const overlay = document.createElement('div');
    overlay.id = 'combat-dessine';
    Object.assign(overlay.style, {
      position: 'fixed',
      zIndex: '10',
      background: '#000',
      overflow: 'hidden',
    });
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.hide();
    this.place();
    window.addEventListener('resize', () => this.place());

    this.ready = (async () => {
      // La police de l'interface dessinée ; si elle ne vient pas, police système.
      await Promise.race([
        document.fonts.load('800 48px "Plus Jakarta Sans"').catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
      await new Promise<void>((resolve) => {
        this.game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: overlay,
          width: DRAWN_W,
          height: DRAWN_H,
          backgroundColor: '#000000',
          antialias: true,
          pixelArt: false,
          banner: false,
          audio: { noAudio: true },
          scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
          scene: [DrawnBootScene, DrawnCombatScene],
        });
        this.game.events.once(READY, () => resolve());
      });
      // Le décor du jeu dessiné n'affiche rien hors combat.
      this.game?.scene.stop('DrawnBoot');
      if (import.meta.env.DEV) {
        (window as unknown as { __ANTIQUA_DRAWN__: Phaser.Game | null }).__ANTIQUA_DRAWN__ =
          this.game;
      }
    })();
    return this.ready;
  }

  /** Recouvre exactement le canvas de la carte. */
  private place(): void {
    if (!this.overlay || !this.host) return;
    const rect = this.host.getBoundingClientRect();
    Object.assign(this.overlay.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    this.game?.scale.refresh();
  }
}

/** Une seule scène dessinée par page, partagée par les parties successives. */
export const drawnStage = new DrawnStage();
