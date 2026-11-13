import type Phaser from 'phaser';
import { FACTIONS, displayHp, type GameEvent, type GameState } from '@antiqua/engine';
import { TILE_SIZE } from '../config';
import { buildCombatSetup, type CombatSetup } from '../combat/setup';
import type { Hud } from '../view/Hud';
import type { MapView } from '../view/MapView';
import { TEAM_COLORS } from '../view/palette';
import { tileText } from '../view/text';
import type { TurnBanner } from '../view/TurnBanner';
import type { UnitLayer } from '../view/UnitLayer';

export interface BattleViews {
  readonly map: MapView;
  readonly units: UnitLayer;
  readonly hud: Hud;
  readonly banner: TurnBanner;
}

/** Scènes de combat plein écran (fournies par la scène de bataille). */
export interface CombatPresenter {
  /** Réglage du joueur : scènes complètes, ou animation courte sur la carte. */
  enabled(): boolean;
  play(setup: CombatSetup): Promise<void>;
}

const T = TILE_SIZE;

/**
 * Joue les GameEvent du moteur dans l'ordre, un par un (file d'attente).
 * Il n'écrit jamais dans l'état : il anime, puis recale la vue sur l'état final.
 */
export class EventPlayer {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly views: BattleViews,
    private readonly combat: CombatPresenter | null = null,
  ) {}

  /**
   * Se résout quand tous les événements sont joués et la vue synchronisée sur `state`.
   * `before` (l'état avant l'action) permet de composer une scène de combat même quand
   * une unité est détruite.
   */
  play(events: readonly GameEvent[], state: GameState, before?: GameState): Promise<void> {
    this.queue = this.queue.then(async () => {
      let combatShown = false;
      for (const event of events) {
        if (event.type === 'attackResolved' && before && this.combat?.enabled()) {
          const counter = events.find(
            (e): e is Extract<GameEvent, { type: 'counterResolved' }> =>
              e.type === 'counterResolved',
          );
          const setup = buildCombatSetup(before, event, counter);
          if (setup) {
            await this.combat.play(setup);
            combatShown = true;
          }
        }
        if (combatShown && (event.type === 'attackResolved' || event.type === 'counterResolved')) {
          // Déjà montré en plein écran : on recale seulement les PV sur la carte.
          this.views.units.get(event.defenderId)?.setHp(event.defenderHp);
          continue;
        }
        await this.playEvent(event, state);
      }
      this.sync(state);
    });
    return this.queue;
  }

  sync(state: GameState): void {
    this.views.units.sync(state);
    this.views.map.sync(state);
    this.views.hud.sync(state);
  }

  private async playEvent(event: GameEvent, state: GameState): Promise<void> {
    const { units, banner } = this.views;
    switch (event.type) {
      case 'unitMoved':
        await units.get(event.unitId)?.walk(event.path);
        return;
      case 'attackResolved':
      case 'counterResolved': {
        const attacker = units.get(event.attackerId);
        const defender = units.get(event.defenderId);
        if (!attacker || !defender) return;
        await attacker.lunge(defender);
        this.popup(
          defender.container.x,
          defender.container.y - T / 2,
          `-${displayHp(event.damage)}`,
          '#ff8a7a',
        );
        await defender.flash();
        defender.setHp(event.defenderHp);
        await this.wait(120);
        return;
      }
      case 'unitDestroyed': {
        const sprite = units.get(event.unitId);
        units.forget(event.unitId);
        await sprite?.vanish();
        return;
      }
      case 'unitWaited':
        units.get(event.unitId)?.setExhausted(true);
        return;
      case 'captureProgress':
        this.popup(event.x * T + T / 2, event.y * T, `Capture ${event.capturePoints}`, '#ffe066');
        this.views.map.sync(state);
        await this.wait(350);
        return;
      case 'buildingCaptured':
        this.views.map.sync(state);
        this.popup(event.x * T + T / 2, event.y * T, 'Capturé !', '#ffe066');
        await this.wait(400);
        return;
      case 'unitBuilt': {
        const unit = state.units.find((candidate) => candidate.id === event.unit.id) ?? event.unit;
        await units.add(unit).appear();
        this.views.hud.sync(state);
        return;
      }
      case 'turnEnded':
        units.sync(state);
        return;
      case 'turnStarted':
        this.views.hud.sync(state);
        await banner.show(
          `Jour ${event.day} — ${FACTIONS[event.player].name}`,
          TEAM_COLORS[event.player],
        );
        return;
      case 'gameOver':
        // L'écran de fin est affiché par le contrôleur, une fois tous les événements joués.
        this.sync(state);
        return;
      case 'captureReset':
      case 'fundsGained':
      case 'playerDefeated':
        return;
    }
  }

  private popup(x: number, y: number, text: string, color: string): void {
    const label = tileText(this.scene, x, y, text, 11).setOrigin(0.5).setColor(color).setDepth(45);
    this.scene.tweens.add({
      targets: label,
      y: y - 14,
      alpha: 0,
      delay: 250,
      duration: 500,
      onComplete: () => label.destroy(),
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
  }
}
