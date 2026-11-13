import type Phaser from 'phaser';

/**
 * Appuis clavier d'une scène, chacun traité **une seule fois**.
 *
 * Phaser 4.2 réémet parfois le même `KeyboardEvent` sur deux images consécutives quand le
 * rendu est lent (WebGL logiciel, appareil modeste) : une touche validait alors deux fois
 * un menu. On mémorise les événements déjà traités et on ignore leurs doublons.
 */
export function onKeyDown(scene: Phaser.Scene, handler: (event: KeyboardEvent) => void): void {
  const handled = new WeakSet<KeyboardEvent>();
  scene.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
    if (handled.has(event)) return;
    handled.add(event);
    handler(event);
  });
}
