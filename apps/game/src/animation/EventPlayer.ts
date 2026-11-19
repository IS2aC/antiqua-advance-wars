import type Phaser from 'phaser';
import { FACTIONS, displayHp, type GameEvent, type GameState } from '@antiqua/engine';
import { TILE_SIZE } from '../config';
import {
  buildCaptureSetup,
  buildCombatSetup,
  type CaptureSetup,
  type CombatSetup,
} from '../combat/setup';
import { playCaptureOnBoard } from '../view/CaptureFx';
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
  /** Scène plein écran de l'annexion du QG adverse (les autres captures : sur le plateau). */
  capture(setup: CaptureSetup): Promise<void>;
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
      let captureShown = false;
      for (const event of events) {
        if (event.type === 'captureProgress' && before) {
          const captured = events.find(
            (e): e is Extract<GameEvent, { type: 'buildingCaptured' }> =>
              e.type === 'buildingCaptured' && e.x === event.x && e.y === event.y,
          );
          const setup = buildCaptureSetup(before, event, captured);
          if (setup?.annexation && this.combat?.enabled()) {
            // Prise du QG adverse : la fin de la partie mérite la scène plein écran.
            await this.combat.capture(setup);
            captureShown = true;
          } else if (setup) {
            // Capture ordinaire : jouée sur le plateau, sans quitter la carte.
            await playCaptureOnBoard(this.scene, {
              x: event.x,
              y: event.y,
              building: setup.building,
              owner: setup.owner,
              pointsBefore: setup.pointsBefore,
              pointsAfter: setup.pointsAfter,
              captured: setup.captured,
              unit: this.views.units.get(event.unitId)?.container ?? null,
              buildingVisual: this.views.map.buildingVisual(event.x, event.y),
              syncMap: () => this.views.map.sync(state),
            });
            captureShown = true;
          }
        }
        if (
          captureShown &&
          (event.type === 'captureProgress' || event.type === 'buildingCaptured')
        ) {
          // Déjà montré (plateau ou plein écran) : la carte prend l'état final du bâtiment.
          this.views.map.sync(state);
          continue;
        }
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
      case 'unitLoaded': {
        // L'unité, arrivée sur le transport, y monte : elle disparaît, le compteur monte.
        const passenger = units.get(event.unitId);
        units.forget(event.unitId);
        await passenger?.vanish();
        const carrier = state.units.find((u) => u.id === event.transportId);
        if (carrier) units.get(carrier.id)?.setCargo(carrier.cargo?.length ?? 0);
        return;
      }
      case 'unitUnloaded': {
        // L'unité réapparaît sur le transport, puis descend sur la case voisine.
        const passenger = state.units.find((u) => u.id === event.unitId);
        if (!passenger) return;
        const sprite = units.get(passenger.id) ?? units.add({ ...passenger, ...event.from });
        sprite.placeAt(event.from);
        await sprite.walk([event.from, event.to]);
        sprite.setExhausted(true);
        const carrier = state.units.find((u) => u.id === event.transportId);
        units.get(event.transportId)?.setCargo(carrier?.cargo?.length ?? 0);
        return;
      }
      case 'unitHealed': {
        // Soin au village, au début du tour : « +2 PV » en vert au-dessus de l'unité.
        const healed = units.get(event.unitId);
        if (!healed) return;
        const gained = displayHp(event.hp) - displayHp(healed.hpShown);
        healed.setHp(event.hp);
        this.popup(
          healed.container.x,
          healed.container.y - T / 2,
          `+${Math.max(1, gained)} PV`,
          '#8fe388',
        );
        await this.wait(260);
        return;
      }
      case 'unitsMerged': {
        // L'unité arrivée se fond dans celle qu'elle rejoint, qui reprend des forces.
        const mover = units.get(event.unitId);
        const joined = units.get(event.targetId);
        units.forget(event.unitId);
        await mover?.vanish();
        if (joined) {
          const gained = displayHp(event.hp) - displayHp(joined.hpShown);
          joined.setHp(event.hp);
          joined.setExhausted(true);
          this.popup(
            joined.container.x,
            joined.container.y - T / 2,
            gained > 0 ? `+${gained} PV` : 'Fusion',
            '#8fe388',
          );
          await joined.flash();
        }
        if (event.refund > 0 && joined) {
          this.popup(joined.container.x, joined.container.y - T, `+${event.refund} or`, '#ffe066');
        }
        this.views.hud.sync(state);
        await this.wait(250);
        return;
      }
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
      case 'playerDefeated':
        // Le royaume vaincu quitte la carte : bandeau, puis ses unités disparaissent et ses
        // bâtiments redeviennent neutres.
        await banner.show(`${FACTIONS[event.player].name} est vaincu`, TEAM_COLORS[event.player]);
        this.sync(state);
        return;
      case 'captureReset':
      case 'fundsGained':
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
