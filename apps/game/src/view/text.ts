import Phaser from 'phaser';
import { font, type TextSize } from '../ui/font';
import { TEXT_COLOR } from './palette';

export interface TextOptions {
  /** Contour sombre : pour le texte posé directement sur la carte (PV, popups). */
  readonly outline?: boolean;
  readonly color?: string;
}

/** Texte d'interface dans la police du jeu (m5x7, ou monospace en secours). */
export function uiText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  size: TextSize = 'normal',
  options: TextOptions = {},
): Phaser.GameObjects.Text {
  const setup = font();
  return scene.add.text(Math.round(x), Math.round(y), content, {
    fontFamily: setup.family,
    fontSize: `${setup.sizes[size]}px`,
    fontStyle: setup.pixel ? 'normal' : 'bold',
    color: options.color ?? TEXT_COLOR,
    ...(options.outline ? { stroke: '#2b1b17', strokeThickness: setup.pixel ? 4 : 3 } : {}),
  });
}

/** Ancienne signature, conservée pour le texte posé sur la carte (contour). */
export function tileText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  size: number,
): Phaser.GameObjects.Text {
  const textSize: TextSize =
    size >= 24 ? 'title' : size >= 16 ? 'large' : size <= 9 ? 'small' : 'normal';
  return uiText(scene, x, y, content, textSize, { outline: true });
}

/**
 * Fixe un conteneur et tous ses enfants à l'écran (insensibles à la caméra).
 * `Container.setScrollFactor(0, 0, true)` ne suffit pas dans Phaser 4.2 : il ne met à jour
 * que les enfants dont `scrollFactorX` a déjà été modifié, si bien que leur zone de clic
 * restait décalée du défilement de la caméra.
 */
export function pinToScreen<T extends Phaser.GameObjects.Container>(container: T): T {
  container.setScrollFactor(0);
  for (const child of container.list) {
    if ('setScrollFactor' in child && typeof child.setScrollFactor === 'function') {
      (child as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0);
    }
  }
  return container;
}
