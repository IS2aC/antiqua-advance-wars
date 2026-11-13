import Phaser from 'phaser';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, TILE_SIZE } from '../config';
import { GRID, panel, snap } from '../ui/panels';
import { pinToScreen, uiText } from './text';
import { DISABLED_TEXT_COLOR, TEXT_COLOR } from './palette';

export interface MenuItem<T extends string> {
  readonly value: T;
  readonly label: string;
  /** Texte aligné à droite (prix…). */
  readonly detail?: string;
  readonly enabled?: boolean;
}

const ROW = GRID * 2;
const PADDING = GRID;

/**
 * Où placer le menu : près d'une case (coordonnées écran), centré à l'écran, ou centré
 * horizontalement à partir d'une ordonnée donnée.
 */
export type MenuAnchor =
  { readonly x: number; readonly y: number } | { readonly top: number } | 'center';

/**
 * Menu dans un panneau 9-slice (Attaquer / Capturer / Attendre, production, fin de tour,
 * écran titre). Clavier : flèches, Entrée, Échap (routés par la scène). Souris : survol, clic.
 */
export class ActionMenu {
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.NineSlice;
  private readonly highlight: Phaser.GameObjects.NineSlice;
  private items: readonly MenuItem<string>[] = [];
  private objects: Phaser.GameObjects.GameObject[] = [];
  private selected = 0;
  private resolve: ((value: string | null) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cancellable = true,
    depth = 50,
  ) {
    this.background = panel(scene, 0, 0, 64, 32);
    this.highlight = panel(scene, PADDING / 2, 0, 48, ROW + 8, 'highlight');
    this.container = scene.add.container(0, 0, [this.background, this.highlight]);
    pinToScreen(this.container).setDepth(depth).setVisible(false);
  }

  get isOpen(): boolean {
    return this.resolve !== null;
  }

  /** Ouvre le menu ; renvoie la valeur choisie, ou `null` si le joueur annule. */
  open<T extends string>(items: readonly MenuItem<T>[], anchor: MenuAnchor): Promise<T | null> {
    this.close(null);
    this.items = items;
    this.objects.forEach((object) => object.destroy());

    const labels = items.map((item, index) => this.makeText(item.label, index, item.enabled));
    const details = items.map((item, index) =>
      item.detail ? this.makeText(item.detail, index, item.enabled) : null,
    );
    const labelWidth = Math.max(...labels.map((t) => t.width));
    const detailWidth = Math.max(0, ...details.map((t) => t?.width ?? 0));
    const width = snap(PADDING * 3 + labelWidth + (detailWidth > 0 ? detailWidth + GRID * 2 : 0));
    const height = snap(items.length * ROW + PADDING * 2);
    for (const detail of details) detail?.setX(width - PADDING - 4 - (detail?.width ?? 0));

    const zones = items.map((item, index) => {
      const zone = this.scene.add
        .zone(0, PADDING + index * ROW, width, ROW)
        .setOrigin(0)
        .setInteractive({ useHandCursor: item.enabled !== false });
      zone.on('pointerover', () => this.select(index));
      zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (pointer.leftButtonDown()) this.confirm();
      });
      return zone;
    });

    this.objects = [...labels, ...details.filter((t) => t !== null), ...zones];
    this.background.setSize(width, height);
    this.highlight.setSize(width - PADDING, ROW + 4);
    this.container.add(this.objects);
    pinToScreen(this.container);

    let x: number;
    let y: number;
    if (anchor === 'center') {
      x = (LOGICAL_WIDTH - width) / 2;
      y = (LOGICAL_HEIGHT - height) / 2;
    } else if ('top' in anchor) {
      x = (LOGICAL_WIDTH - width) / 2;
      y = anchor.top;
    } else {
      const rightSide = anchor.x + TILE_SIZE + width + 4 <= LOGICAL_WIDTH;
      x = rightSide ? anchor.x + TILE_SIZE + 4 : anchor.x - width - 4;
      y = Phaser.Math.Clamp(anchor.y - PADDING, 4, LOGICAL_HEIGHT - height - 4);
    }
    this.container.setPosition(Math.round(Math.max(4, x)), Math.round(y)).setVisible(true);
    this.selected = Math.max(
      0,
      items.findIndex((item) => item.enabled !== false),
    );
    this.refresh();
    return new Promise<T | null>((resolve) => {
      this.resolve = resolve as (value: string | null) => void;
    });
  }

  move(delta: number): void {
    if (!this.isOpen || this.items.length === 0) return;
    this.select((this.selected + delta + this.items.length) % this.items.length);
  }

  confirm(): void {
    const item = this.items[this.selected];
    if (item && item.enabled !== false) this.close(item.value);
  }

  cancel(): void {
    if (this.cancellable) this.close(null);
  }

  private makeText(
    content: string,
    index: number,
    enabled: boolean | undefined,
  ): Phaser.GameObjects.Text {
    return uiText(this.scene, PADDING + 4, PADDING + index * ROW + 1, content, 'normal', {
      color: enabled === false ? DISABLED_TEXT_COLOR : TEXT_COLOR,
    });
  }

  private select(index: number): void {
    this.selected = index;
    this.refresh();
  }

  private refresh(): void {
    this.highlight.setY(PADDING + this.selected * ROW - 2);
  }

  private close(value: string | null): void {
    const resolve = this.resolve;
    this.resolve = null;
    this.container.setVisible(false);
    for (const object of this.objects) {
      if (object.input) object.disableInteractive();
    }
    resolve?.(value);
  }
}
