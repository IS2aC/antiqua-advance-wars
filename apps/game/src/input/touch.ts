import type Phaser from 'phaser';

/**
 * Gestes au doigt sur la carte (un seul doigt) :
 * - toucher : comme un clic (choisir une unité, une case, une cible) ;
 * - glisser : déplace la carte ;
 * - appui long : comme un clic droit (annuler), avec une courte vibration.
 * Les boutons et menus gèrent eux-mêmes leurs touchers. La souris garde ses propres
 * événements (BattleScene).
 */
export interface TouchTarget {
  onPointerDown(worldX: number, worldY: number, rightButton: boolean, touch: boolean): void;
  onDrag(dx: number, dy: number): void;
}

/** Au-delà de ce déplacement (pixels logiques), le toucher devient un glissé. */
const DRAG_START = 6;
const LONG_PRESS_MS = 500;

interface Gesture {
  readonly id: number;
  readonly startX: number;
  readonly startY: number;
  lastX: number;
  lastY: number;
  dragging: boolean;
  /** Appui long déjà joué, ou geste abandonné (second doigt) : pas de toucher au lâcher. */
  done: boolean;
  timer: number;
}

export function setupTouch(scene: Phaser.Scene, target: TouchTarget): void {
  let gesture: Gesture | null = null;
  const world = (pointer: Phaser.Input.Pointer) =>
    scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
  const end = () => {
    if (gesture) window.clearTimeout(gesture.timer);
    gesture = null;
  };

  scene.input.on(
    'pointerdown',
    (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!pointer.wasTouch) return;
      // Second doigt : on abandonne le geste en cours (pas de toucher involontaire).
      if (gesture) {
        gesture.done = true;
        window.clearTimeout(gesture.timer);
        return;
      }
      if (over.length > 0) return;
      const started: Gesture = {
        id: pointer.id,
        startX: pointer.x,
        startY: pointer.y,
        lastX: pointer.x,
        lastY: pointer.y,
        dragging: false,
        done: false,
        timer: 0,
      };
      // Temps réel (et non l'horloge de la scène, accélérée pendant le tour de l'IA).
      started.timer = window.setTimeout(() => {
        if (gesture !== started || started.dragging || started.done) return;
        started.done = true;
        navigator.vibrate?.(15);
        const point = world(pointer);
        target.onPointerDown(point.x, point.y, true, true);
      }, LONG_PRESS_MS);
      gesture = started;
    },
  );

  scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    if (!pointer.wasTouch || !gesture || pointer.id !== gesture.id || gesture.done) return;
    if (
      !gesture.dragging &&
      Math.hypot(pointer.x - gesture.startX, pointer.y - gesture.startY) > DRAG_START
    ) {
      gesture.dragging = true;
      window.clearTimeout(gesture.timer);
    }
    if (gesture.dragging) target.onDrag(pointer.x - gesture.lastX, pointer.y - gesture.lastY);
    gesture.lastX = pointer.x;
    gesture.lastY = pointer.y;
  });

  scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    if (!pointer.wasTouch || !gesture || pointer.id !== gesture.id) return;
    const tap = !gesture.dragging && !gesture.done;
    end();
    if (!tap) return;
    const point = world(pointer);
    target.onPointerDown(point.x, point.y, false, true);
  });

  scene.events.once('shutdown', end);
}
