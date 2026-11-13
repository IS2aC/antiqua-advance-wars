import Phaser from 'phaser';

/**
 * Base des scènes plein écran (combat, siège) : vitesse de lecture, et passage de la scène
 * par un clic, Entrée, Espace ou Échap. Une fois la scène passée, toutes les attentes et
 * tous les tweens en cours se résolvent aussitôt, et le déroulé file jusqu'à la fin.
 */
export abstract class StagedScene extends Phaser.Scene {
  protected skipped = false;
  protected skipSignal: Promise<void> = Promise.resolve();
  private skipResolve: () => void = () => undefined;

  /** À appeler au début de `create()`. */
  protected beginStage(speed: number): void {
    this.skipped = false;
    this.skipSignal = new Promise((resolve) => {
      this.skipResolve = resolve;
    });
    this.tweens.timeScale = speed;
    this.time.timeScale = speed;
    const skip = () => this.skip();
    this.input.on('pointerdown', skip);
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (['Enter', 'Space', 'Escape'].includes(event.code)) skip();
    });
  }

  protected skip(): void {
    if (this.skipped) return;
    this.skipped = true;
    this.skipResolve();
  }

  /** Attente, interrompue si le joueur passe la scène. */
  protected wait(ms: number): Promise<void> {
    if (this.skipped) return Promise.resolve();
    return Promise.race([
      new Promise<void>((resolve) => this.time.delayedCall(ms, resolve)),
      this.skipSignal,
    ]);
  }

  /** Tween, terminé d'un coup si le joueur passe la scène. */
  protected tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    if (this.skipped) return Promise.resolve();
    return Promise.race([
      new Promise<void>((resolve) => {
        this.tweens.add({ ...config, onComplete: () => resolve() });
      }),
      this.skipSignal,
    ]);
  }

  /** Fondu de sortie, puis rend la main à la bataille. */
  protected async endStage(onDone: () => void): Promise<void> {
    this.cameras.main.fadeOut(150, 0, 0, 0);
    await this.wait(160);
    onDone();
    this.scene.stop();
  }
}
