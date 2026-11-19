import Phaser from 'phaser';
import { assignPeoples, createGame, type GameState, type PlayerId } from '@antiqua/engine';
import { DEFAULT_MAP, MAPS, mapOfState, type MapId } from '../maps';
import { TILE_SIZE } from '../config';
import { EventPlayer } from '../animation/EventPlayer';
import { goToCover } from '../launch';
import type { CaptureSceneData } from '../combat/CaptureScene';
import type { CombatSetup } from '../combat/setup';
import { createFigureAnimations } from '../combat/packs';
import { drawnStage } from '../drawn/DrawnStage';
import type { CombatPresenter } from '../animation/EventPlayer';
import { loadOptions } from '../persistence/options';
import { BattleController } from '../controller/BattleController';
import { onKeyDown } from '../ui/keyboard';
import { createPanelTextures } from '../ui/panels';
import { ActionMenu } from '../view/ActionMenu';
import { createUnitAnimations } from '../view/art';
import { Cursor } from '../view/Cursor';
import { EndScreen } from '../view/EndScreen';
import { ForecastPanel } from '../view/ForecastPanel';
import { PauseMenu } from '../view/PauseMenu';
import { Hud } from '../view/Hud';
import { MapView } from '../view/MapView';
import { PathArrow } from '../view/PathArrow';
import { RangeOverlay } from '../view/RangeOverlay';
import { TurnBanner } from '../view/TurnBanner';
import { UnitLayer } from '../view/UnitLayer';

export interface BattleData {
  /** Partie sauvegardée à reprendre ; sinon, nouvelle partie. */
  readonly state?: GameState;
  /** Camps joués par l'IA ; absent ou vide : partie à plusieurs sur le même écran. */
  readonly aiPlayers?: readonly PlayerId[];
  /** Carte d'une nouvelle partie (par défaut « Le Gué du Nil »). */
  readonly map?: MapId;
  /** Peuples de la nouvelle partie, dans l'ordre de jeu (absent : ceux de la carte). */
  readonly peoples?: readonly PlayerId[];
}

/** Développement : accès à l'état courant pour la console et les tests de bout en bout. */
export interface DebugHook {
  state(): GameState;
  /** Mode d'interaction : idle, selected, menu, targeting, busy, over… */
  mode(): string;
}

/** Partie sur une des cartes de `maps.ts` : contre l'IA, ou à plusieurs sur le même écran. */
export class BattleScene extends Phaser.Scene {
  private initial: GameState | null = null;
  private aiPlayers: readonly PlayerId[] = [];
  private map: MapId = DEFAULT_MAP;
  private peoples: readonly PlayerId[] | null = null;

  constructor() {
    super('Battle');
  }

  init(data: BattleData): void {
    this.initial = data.state ?? null;
    this.aiPlayers = data.aiPlayers ?? [];
    this.map = data.state ? mapOfState(data.state) : (data.map ?? DEFAULT_MAP);
    // « Rejouer » relance avec les mêmes peuples, même après une reprise de sauvegarde.
    this.peoples = data.state?.players.map((player) => player.id) ?? data.peoples ?? null;
  }

  create(): void {
    createPanelTextures(this);
    createUnitAnimations(this);
    createFigureAnimations(this);
    const definition = this.peoples ? assignPeoples(MAPS[this.map], this.peoples) : MAPS[this.map];
    const state =
      this.initial ?? createGame(definition, { seed: Math.floor(Math.random() * 2 ** 31) });

    this.cameras.main.setBounds(0, 0, state.map.width * TILE_SIZE, state.map.height * TILE_SIZE);

    const map = new MapView(this, state);
    const overlay = new RangeOverlay(this);
    const arrow = new PathArrow(this);
    const units = new UnitLayer(this, state);
    const cursor = new Cursor(this);
    const menu = new ActionMenu(this);
    const banner = new TurnBanner(this);
    const forecast = new ForecastPanel(this);
    const endScreen = new EndScreen(this);
    const pauseMenu = new PauseMenu(this);
    // Le contrôleur est créé juste après : le HUD l'appelle par une fermeture.
    let controller: BattleController | null = null;
    const hud = new Hud(
      this,
      () => controller?.requestEndTurn(),
      () => void controller?.openPauseMenu(),
    );
    const player = new EventPlayer(this, { map, units, hud, banner }, this.combatPresenter());

    controller = new BattleController(
      this,
      state,
      { cursor, overlay, arrow, menu, hud, player, forecast, endScreen, pauseMenu },
      (choice) => {
        if (choice === 'rejouer') {
          this.scene.restart({
            aiPlayers: this.aiPlayers,
            map: this.map,
            ...(this.peoples ? { peoples: this.peoples } : {}),
          });
        } else goToCover();
      },
      this.aiPlayers,
    );
    const input = controller;

    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      // Survoler le HUD ou un menu ne déplace pas le curseur de case.
      if (this.input.hitTestPointer(pointer).length > 0) return;
      input.onPointerMove(pointer.worldX, pointer.worldY);
    });
    this.input.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        // Un clic sur un menu ou un bouton ne compte pas comme un clic sur la carte.
        if (over.length > 0 && !pointer.rightButtonDown()) return;
        input.onPointerDown(pointer.worldX, pointer.worldY, pointer.rightButtonDown());
      },
    );
    onKeyDown(this, (event) => {
      if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
      input.onKey(event.code);
    });

    if (import.meta.env.DEV) {
      const hook: DebugHook = { state: () => input.currentState, mode: () => input.currentMode };
      (window as unknown as { __ANTIQUA__: DebugHook }).__ANTIQUA__ = hook;
    }

    void controller.start();
  }

  /**
   * Scènes de combat : les combats dessinés (second canvas en haute définition) et la prise
   * de bâtiment (scène « Capture ») se posent sur la carte, qui ne reçoit plus d'entrées le
   * temps de la scène. Elles suivent la vitesse du tour (accélération de l'IA).
   */
  private combatPresenter(): CombatPresenter {
    const capture = (setup: CaptureSceneData['setup']) =>
      new Promise<void>((resolve) => {
        this.input.enabled = false;
        this.scene.launch('Capture', {
          setup,
          speed: this.tweens.timeScale,
          onDone: () => {
            this.input.enabled = true;
            resolve();
          },
        });
      });
    const drawn = async (setup: CombatSetup) => {
      this.input.enabled = false;
      try {
        await drawnStage.play(this.game.canvas, setup, this.tweens.timeScale);
      } finally {
        this.input.enabled = true;
      }
    };
    return {
      enabled: () => loadOptions().combatScenes,
      play: drawn,
      capture,
    };
  }
}
