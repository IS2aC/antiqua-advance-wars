import Phaser from 'phaser';
import { GUE_DU_NIL, createGame, type GameState, type PlayerId } from '@antiqua/engine';
import { TILE_SIZE } from '../config';
import { EventPlayer } from '../animation/EventPlayer';
import { goToCover } from '../launch';
import { BattleController } from '../controller/BattleController';
import { onKeyDown } from '../ui/keyboard';
import { createPanelTextures } from '../ui/panels';
import { ActionMenu } from '../view/ActionMenu';
import { createUnitAnimations } from '../view/art';
import { Cursor } from '../view/Cursor';
import { EndScreen } from '../view/EndScreen';
import { ForecastPanel } from '../view/ForecastPanel';
import { Hud } from '../view/Hud';
import { MapView } from '../view/MapView';
import { PathArrow } from '../view/PathArrow';
import { RangeOverlay } from '../view/RangeOverlay';
import { TurnBanner } from '../view/TurnBanner';
import { UnitLayer } from '../view/UnitLayer';

export interface BattleData {
  /** Partie sauvegardée à reprendre ; sinon, nouvelle partie. */
  readonly state?: GameState;
  /** Camps joués par l'IA ; absent ou vide : partie à deux sur le même écran. */
  readonly aiPlayers?: readonly PlayerId[];
}

/** Développement : accès à l'état courant pour la console et les tests de bout en bout. */
export interface DebugHook {
  state(): GameState;
  /** Mode d'interaction : idle, selected, menu, targeting, busy, over… */
  mode(): string;
}

/** Partie sur « Le Gué du Nil » : contre l'IA, ou à deux sur le même écran. */
export class BattleScene extends Phaser.Scene {
  private initial: GameState | null = null;
  private aiPlayers: readonly PlayerId[] = [];

  constructor() {
    super('Battle');
  }

  init(data: BattleData): void {
    this.initial = data.state ?? null;
    this.aiPlayers = data.aiPlayers ?? [];
  }

  create(): void {
    createPanelTextures(this);
    createUnitAnimations(this);
    const state =
      this.initial ?? createGame(GUE_DU_NIL, { seed: Math.floor(Math.random() * 2 ** 31) });

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
    // Le contrôleur est créé juste après : le HUD l'appelle par une fermeture.
    let controller: BattleController | null = null;
    const hud = new Hud(this, () => controller?.requestEndTurn());
    const player = new EventPlayer(this, { map, units, hud, banner });

    controller = new BattleController(
      this,
      state,
      { cursor, overlay, arrow, menu, hud, player, forecast, endScreen },
      (choice) => {
        if (choice === 'rejouer') this.scene.restart({ aiPlayers: this.aiPlayers });
        else goToCover();
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
}
