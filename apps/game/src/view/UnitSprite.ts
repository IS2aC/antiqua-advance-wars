import Phaser from 'phaser';
import { displayHp, type PlayerId, type Position, type Unit, type UnitType } from '@antiqua/engine';
import { MOVE_STEP_MS, TILE_SIZE } from '../config';
import { hasUnitArt, idleAnimation, unitAtlas, walkAnimation } from './art';
import { tileText } from './text';
import { OUTLINE_COLOR, TEAM_COLORS, UNIT_LABELS, darken } from './palette';

export type Facing = 'right' | 'left' | 'up' | 'down';

const T = TILE_SIZE;
const BODY = T - 8;
/** Teinte (multiplication) des unités ayant agi : assombries jusqu'à la fin du tour. */
const EXHAUSTED_TINT = 0x6a6a6a;

/**
 * Unité sur la carte : sprite animé de l'atlas de sa faction (repos, marche par direction,
 * gauche = miroir de droite), ou carré de couleur avec une lettre si l'atlas manque.
 * Sa position suit toujours une case ; aucune physique.
 */
export class UnitSprite {
  readonly container: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Sprite | null = null;
  private readonly body: Phaser.GameObjects.Rectangle | null = null;
  private readonly label: Phaser.GameObjects.Text | null = null;
  private readonly hp: Phaser.GameObjects.Text;
  private readonly color: number;
  private readonly owner: PlayerId;
  private readonly type: UnitType;
  private exhausted = false;
  /** Orientation au repos et pendant la marche. */
  facing: Facing = 'right';
  /** Vrai pendant une animation : la synchronisation ne touche pas la position. */
  animating = false;

  constructor(
    private readonly scene: Phaser.Scene,
    unit: Unit,
  ) {
    this.owner = unit.owner;
    this.type = unit.type;
    this.color = TEAM_COLORS[unit.owner];
    // Carthage part du haut à droite : ses unités regardent vers la gauche au départ.
    this.facing = unit.owner === 'carthage' ? 'left' : 'right';
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (hasUnitArt(scene, unit.owner)) {
      this.sprite = scene.add.sprite(0, 0, unitAtlas(unit.owner), `unit/${unit.type}/idle/0`);
      parts.push(this.sprite);
    } else {
      this.body = scene.add
        .rectangle(0, 0, BODY, BODY, this.color)
        .setStrokeStyle(2, OUTLINE_COLOR);
      this.label = tileText(scene, 0, -1, UNIT_LABELS[unit.type], 11).setOrigin(0.5);
      parts.push(this.body, this.label);
    }
    this.hp = tileText(scene, T / 2 - 1, T / 2 - 1, '', 9).setOrigin(1);
    this.container = scene.add.container(0, 0, [...parts, this.hp]).setDepth(10);
    this.placeAt(unit);
    this.update(unit);
    this.playIdle();
  }

  placeAt(position: Position): void {
    this.container.setPosition(position.x * T + T / 2, position.y * T + T / 2);
  }

  update(unit: Unit): void {
    this.setHp(unit.hp);
    this.setExhausted(unit.hasActed);
  }

  setHp(hp: number): void {
    const shown = displayHp(hp);
    this.hp.setText(shown < 10 && shown > 0 ? String(shown) : '');
  }

  setExhausted(exhausted: boolean): void {
    if (exhausted === this.exhausted && this.sprite) return;
    this.exhausted = exhausted;
    if (this.sprite) {
      if (exhausted) {
        this.sprite.setTint(EXHAUSTED_TINT);
        this.sprite.anims.pause();
      } else {
        this.sprite.clearTint();
        this.playIdle();
      }
    }
    this.body?.setFillStyle(exhausted ? darken(this.color) : this.color);
    this.label?.setAlpha(exhausted ? 0.55 : 1);
  }

  /** Déplacement case par case le long du chemin (tween linéaire, animation selon le pas). */
  async walk(path: readonly Position[]): Promise<void> {
    this.animating = true;
    for (let i = 1; i < path.length; i++) {
      const from = path[i - 1];
      const to = path[i];
      if (!from || !to) continue;
      this.face(to.x > from.x ? 'right' : to.x < from.x ? 'left' : to.y < from.y ? 'up' : 'down');
      await this.tween({
        x: to.x * T + T / 2,
        y: to.y * T + T / 2,
        duration: MOVE_STEP_MS,
        ease: 'Linear',
      });
    }
    // Au repos, on ne garde que gauche ou droite (le profil de l'animation de repos).
    if (this.facing === 'up' || this.facing === 'down') {
      this.facing = this.owner === 'carthage' ? 'left' : 'right';
    }
    this.playIdle();
    this.animating = false;
  }

  /** Petit élan vers la cible. */
  async lunge(target: UnitSprite): Promise<void> {
    const dx = Math.sign(target.container.x - this.container.x) * 4;
    const dy = Math.sign(target.container.y - this.container.y) * 4;
    if (dx !== 0) {
      this.facing = dx > 0 ? 'right' : 'left';
      this.playIdle();
    }
    await this.tween({
      x: this.container.x + dx,
      y: this.container.y + dy,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  async flash(): Promise<void> {
    await this.tween({ alpha: 0.2, duration: 60, yoyo: true, repeat: 2 });
    this.container.setAlpha(1);
  }

  async vanish(): Promise<void> {
    this.animating = true;
    await this.tween({ alpha: 0, scale: 0.4, duration: 260, ease: 'Quad.easeIn' });
    this.container.destroy();
  }

  async appear(): Promise<void> {
    this.container.setScale(0.3);
    await this.tween({ scale: 1, duration: 180, ease: 'Back.easeOut' });
  }

  destroy(): void {
    this.container.destroy();
  }

  /** Change d'orientation et lance la marche correspondante (gauche = droite en miroir). */
  private face(facing: Facing): void {
    if (facing === this.facing && this.sprite?.anims.isPlaying && !this.exhausted) {
      const current = this.sprite.anims.currentAnim?.key ?? '';
      if (current.includes(':walk:')) return;
    }
    this.facing = facing;
    if (!this.sprite) return;
    const direction = facing === 'left' ? 'right' : facing;
    this.sprite.setFlipX(facing === 'left');
    this.sprite.play(walkAnimation(this.owner, this.type, direction), true);
  }

  private playIdle(): void {
    if (!this.sprite) return;
    this.sprite.setFlipX(this.facing === 'left');
    if (this.exhausted) return;
    this.sprite.play(idleAnimation(this.owner, this.type), true);
  }

  private tween(config: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({ ...config, targets: this.container, onComplete: () => resolve() });
    });
  }
}
