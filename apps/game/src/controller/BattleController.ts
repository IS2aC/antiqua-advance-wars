import type Phaser from 'phaser';
import {
  UNITS,
  UNIT_TYPES,
  applyAction,
  buildingAt,
  chooseGreedyAction,
  canCapture,
  canLoad,
  canMerge,
  findPath,
  findUnit,
  forecast,
  inBounds,
  producesUnit,
  mergePath,
  reachableTiles,
  targetsInRange,
  threatTiles,
  unitAt,
  unloadTiles,
  wallsInRange,
  type Action,
  type Building,
  type GameState,
  type PlayerId,
  type Position,
  type Unit,
  type UnitType,
} from '@antiqua/engine';
import { TILE_SIZE } from '../config';
import type { EventPlayer } from '../animation/EventPlayer';
import { combatSetting, loadOptions, saveOptions, withCombatSetting } from '../persistence/options';
import type { RemoteSession } from '../online/session';
import { clearSave, saveGame } from '../persistence/save';
import type { EndChoice, EndScreen } from '../view/EndScreen';
import type { ForecastPanel } from '../view/ForecastPanel';
import type { PauseMenu } from '../view/PauseMenu';
import type { ActionMenu, MenuItem } from '../view/ActionMenu';
import type { Cursor } from '../view/Cursor';
import type { Hud } from '../view/Hud';
import type { PathArrow } from '../view/PathArrow';
import type { RangeOverlay } from '../view/RangeOverlay';

const T = TILE_SIZE;

/**
 * Modes d'interaction :
 * - idle : rien de sélectionné ;
 * - selected : une unité à soi est sélectionnée, on choisit sa destination ;
 * - inspecting : zones d'une unité adverse (ou ayant agi) affichées ;
 * - menu : un menu est ouvert (il reçoit le clavier) ;
 * - targeting : choix de la cible d'une attaque ;
 * - busy : animation en cours, entrées ignorées ;
 * - ai : l'IA joue son tour (seule l'accélération est possible) ;
 * - over : partie terminée.
 */
type Mode =
  | 'idle'
  | 'selected'
  | 'inspecting'
  | 'menu'
  | 'targeting'
  | 'busy'
  | 'ai'
  /** Tour de l'adversaire en ligne : ses actions arrivent du serveur. */
  | 'remote'
  | 'paused'
  | 'over';

type Command = 'attack' | 'capture' | 'wait' | 'merge' | 'load' | 'unload' | 'breach';

const DIRECTION_NAMES: Readonly<Record<string, string>> = {
  '0,-1': 'Nord',
  '1,0': 'Est',
  '0,1': 'Sud',
  '-1,0': 'Ouest',
};

export interface ControllerViews {
  readonly cursor: Cursor;
  readonly overlay: RangeOverlay;
  readonly arrow: PathArrow;
  readonly menu: ActionMenu;
  readonly hud: Hud;
  readonly player: EventPlayer;
  readonly forecast: ForecastPanel;
  readonly endScreen: EndScreen;
  readonly pauseMenu: PauseMenu;
}

const same = (a: Position, b: Position) => a.x === b.x && a.y === b.y;

/** Rythme du tour de l'IA (ms, à vitesse normale). */
const AI_UNIT_PAUSE = 250;
const AI_PREVIEW = 350;
/** Facteur de vitesse du bouton « Accélérer ». */
const AI_FAST = 4;

/**
 * Traduit les entrées du joueur en Action, les envoie au moteur et fait jouer les
 * événements. C'est le seul endroit qui remplace l'état courant par celui du moteur.
 */
export class BattleController {
  private mode: Mode = 'idle';
  private selectedId: number | null = null;
  private reachable: Position[] = [];
  /** Unités alliées que l'unité sélectionnée peut rejoindre (fusion). */
  private mergeTargets: Unit[] = [];
  /** Transports alliés où l'unité sélectionnée peut monter. */
  private loadTargets: Unit[] = [];
  /** Cibles proposées (unités ennemies, ou remparts pour la catapulte). */
  private targets: Position[] = [];
  private targetIndex = 0;
  private resolveTarget: ((target: Position | null) => void) | null = null;
  private cameraTween: Phaser.Tweens.Tween | null = null;
  private fast = false;
  /** En ligne : déplacement pas encore envoyé (il part avec l'action qui le suit). */
  private pendingMove: Action | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private state: GameState,
    private readonly views: ControllerViews,
    /** Appelé quand le joueur quitte l'écran de fin. */
    private readonly onFinished: (choice: EndChoice) => void,
    /** Camps joués par l'IA (vide : partie à deux sur le même écran). */
    private readonly aiPlayers: readonly PlayerId[] = [],
    /** Partie en ligne : l'autre camp est joué par un adversaire distant. */
    private readonly remote: RemoteSession | null = null,
  ) {}

  /** État courant (lecture seule) : tests de bout en bout et console de développement. */
  get currentState(): GameState {
    return this.state;
  }

  /** Mode d'interaction courant (tests de bout en bout). */
  get currentMode(): string {
    return this.mode;
  }

  async start(): Promise<void> {
    this.views.player.sync(this.state);
    this.focusCurrentPlayer();
    this.mode = 'busy';
    await this.views.player.play(
      [{ type: 'turnStarted', player: this.state.currentPlayer, day: this.state.day }],
      this.state,
    );
    this.mode = 'idle';
    if (this.remote) this.listenRemote(this.remote);
    // Reprise d'une sauvegarde faite pendant le tour de l'IA.
    if (this.isAiTurn()) await this.runAiTurns();
    else if (this.isRemoteTurn()) await this.runRemoteTurns();
    else this.remote?.ready();
  }

  // ——— Entrées ———

  onKey(code: string): void {
    if (this.mode === 'paused') {
      if (code === 'ArrowUp') this.views.pauseMenu.move(-1);
      else if (code === 'ArrowDown') this.views.pauseMenu.move(1);
      else if (code === 'Enter' || code === 'Space') this.views.pauseMenu.confirm();
      else if (code === 'Escape' || code === 'Backspace') this.views.pauseMenu.cancel();
      return;
    }
    if (this.mode === 'ai' || this.mode === 'remote') {
      if (code === 'Enter' || code === 'Space') this.toggleFast();
      return;
    }
    if (this.mode === 'over') {
      if (code === 'ArrowUp') this.views.endScreen.move(-1);
      else if (code === 'ArrowDown') this.views.endScreen.move(1);
      else if (code === 'Enter' || code === 'Space') this.views.endScreen.confirm();
      return;
    }
    if (this.mode === 'menu') {
      if (code === 'ArrowUp') this.views.menu.move(-1);
      else if (code === 'ArrowDown') this.views.menu.move(1);
      else if (code === 'Enter' || code === 'Space') this.views.menu.confirm();
      else if (code === 'Escape' || code === 'Backspace') this.views.menu.cancel();
      return;
    }
    if (this.mode === 'targeting' && code.startsWith('Arrow')) {
      const step = code === 'ArrowLeft' || code === 'ArrowUp' ? -1 : 1;
      this.cycleTarget(step);
      return;
    }
    const moves: Record<string, Position> = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };
    const delta = moves[code];
    if (delta) {
      const { x, y } = this.views.cursor.position;
      this.pointAt({ x: x + delta.x, y: y + delta.y }, 2);
    } else if (code === 'Enter' || code === 'Space') {
      void this.confirm(this.views.cursor.position);
    } else if (code === 'Escape' || code === 'Backspace') {
      // Échap annule la sélection ; sans rien de sélectionné, il ouvre la pause.
      if (this.mode === 'idle') void this.openPauseMenu();
      else this.cancel();
    }
  }

  onPointerMove(worldX: number, worldY: number): void {
    if (this.mode === 'menu' || this.mode === 'ai' || this.mode === 'remote') return;
    if (this.mode === 'paused') return;
    this.pointAt({ x: Math.floor(worldX / T), y: Math.floor(worldY / T) }, 0);
  }

  /**
   * Clic (ou toucher) sur la carte. `rightButton` : clic droit ou appui long, qui annule.
   * Au doigt (`touch`), viser une cible demande deux touchers : le premier montre la
   * prévision du combat, le second attaque (une attaque ne s'annule pas).
   */
  onPointerDown(worldX: number, worldY: number, rightButton: boolean, touch = false): void {
    if (this.mode === 'ai' || this.mode === 'remote' || this.mode === 'paused') return;
    // Clic droit, appui long, ou clic hors d'un menu : on annule.
    if (rightButton || this.mode === 'menu') {
      if (this.mode === 'menu') this.views.menu.cancel();
      else this.cancel();
      return;
    }
    const tile = { x: Math.floor(worldX / T), y: Math.floor(worldY / T) };
    if (!inBounds(this.state.map, tile.x, tile.y)) return;
    const aimed = same(tile, this.views.cursor.position);
    this.pointAt(tile, 0);
    if (touch && this.mode === 'targeting' && !aimed) return;
    void this.confirm(tile);
  }

  /** Glisser la carte au doigt : la caméra suit (dans les limites de la carte). */
  onDrag(dx: number, dy: number): void {
    if (this.mode === 'paused' || this.mode === 'over') return;
    this.cameraTween?.stop();
    this.cameraTween = null;
    const camera = this.scene.cameras.main;
    camera.setScroll(camera.scrollX - dx, camera.scrollY - dy);
  }

  /**
   * Pause (bouton du HUD ou Échap) : reprendre, sauvegarder et quitter, ou abandonner.
   * Seulement quand la carte attend une commande : jamais pendant une animation, un menu
   * ou le tour de l'IA, pour que l'état sauvegardé soit toujours un état stable.
   */
  async openPauseMenu(): Promise<void> {
    if (this.mode !== 'idle' && this.mode !== 'inspecting') return;
    this.clearSelection();
    this.mode = 'paused';
    const choice = await this.views.pauseMenu.open(combatSetting(loadOptions()), (setting) =>
      saveOptions(withCombatSetting(loadOptions(), setting)),
    );
    if (choice === 'reprendre') {
      this.mode = 'idle';
      return;
    }
    // En ligne, la partie est gardée par le serveur ; « Abandonner » la donne à l'adversaire.
    if (this.remote) {
      if (choice !== 'quitter') this.remote.resign();
    } else if (choice === 'quitter') saveGame(this.state, this.aiPlayers);
    else clearSave();
    this.onFinished('menu');
  }

  /** Bouton du HUD : « Fin de tour », ou « Accélérer » pendant le tour de l'IA. */
  requestEndTurn(): void {
    if (this.mode === 'ai' || this.mode === 'remote') {
      this.toggleFast();
      return;
    }
    if (this.mode !== 'idle' && this.mode !== 'inspecting') return;
    this.clearSelection();
    void this.endTurn();
  }

  // ——— Curseur et caméra ———

  private pointAt(tile: Position, margin: number): void {
    if (!inBounds(this.state.map, tile.x, tile.y)) return;
    if (same(tile, this.views.cursor.position)) return;
    this.views.cursor.moveTo(tile);
    const scroll = this.scrollToShow(tile, margin);
    this.views.hud.avoid(tile.x * T - scroll.x, tile.y * T - scroll.y);
    this.views.hud.inspect(this.state, tile);
    if (this.mode === 'selected') this.updateArrow(tile);
    if (this.mode === 'targeting') this.updateForecast(tile);
  }

  /** Prévision de combat pour la cible sous le curseur (pendant le choix de la cible). */
  private updateForecast(tile: Position): void {
    const attacker = this.selectedId === null ? undefined : findUnit(this.state, this.selectedId);
    const spot = this.targets.find((candidate) => same(candidate, tile));
    const target = spot ? unitAt(this.state, spot.x, spot.y) : undefined;
    const prediction = attacker && target ? forecast(this.state, attacker.id, target.id) : null;
    if (attacker && target && prediction) this.views.forecast.show(attacker, target, prediction);
    else this.views.forecast.hide();
  }

  /**
   * Fait défiler la caméra quand le curseur approche du bord, dans les limites de la carte.
   * Renvoie le défilement visé (la caméra y arrive en douceur).
   */
  private scrollToShow(tile: Position, margin: number): Position {
    const camera = this.scene.cameras.main;
    const { width, height } = this.state.map;
    const fit = (value: number, scroll: number, view: number, size: number) => {
      const first = Math.round(scroll / T);
      let target = first;
      if (value < first + margin) target = value - margin;
      else if (value > first + view - 1 - margin) target = value - view + 1 + margin;
      return Math.max(0, Math.min(size - view, target)) * T;
    };
    // Cases entièrement visibles : la vue suit l'écran (moins de cases sur téléphone).
    const scrollX = fit(tile.x, camera.scrollX, Math.floor(camera.width / T), width);
    const scrollY = fit(tile.y, camera.scrollY, Math.floor(camera.height / T), height);
    if (scrollX === camera.scrollX && scrollY === camera.scrollY) return { x: scrollX, y: scrollY };
    this.cameraTween?.stop();
    this.cameraTween = this.scene.tweens.add({
      targets: camera,
      scrollX,
      scrollY,
      duration: 120,
      ease: 'Quad.easeOut',
    });
    return { x: scrollX, y: scrollY };
  }

  private screenPosition(tile: Position): Position {
    const camera = this.scene.cameras.main;
    return { x: tile.x * T - camera.scrollX, y: tile.y * T - camera.scrollY };
  }

  private focusCurrentPlayer(): void {
    const hq = this.state.buildings.find(
      (building) => building.type === 'qg' && building.owner === this.state.currentPlayer,
    );
    const anchor = hq ?? this.state.units.find((unit) => unit.owner === this.state.currentPlayer);
    if (anchor) this.pointAt(anchor, 3);
  }

  // ——— Confirmation / annulation ———

  private async confirm(tile: Position): Promise<void> {
    switch (this.mode) {
      case 'idle':
        return this.confirmIdle(tile);
      case 'inspecting':
        this.clearSelection();
        return this.confirmIdle(tile);
      case 'selected':
        return this.confirmDestination(tile);
      case 'targeting': {
        const target = this.targets.find((unit) => same(unit, tile));
        if (target) this.finishTargeting(target);
        return;
      }
      default:
        return;
    }
  }

  private cancel(): void {
    if (this.mode === 'targeting') this.finishTargeting(null);
    else if (this.mode === 'selected' || this.mode === 'inspecting') this.clearSelection();
  }

  private async confirmIdle(tile: Position): Promise<void> {
    const unit = unitAt(this.state, tile.x, tile.y);
    if (unit) {
      if (unit.owner === this.state.currentPlayer && !unit.hasActed) this.select(unit);
      else this.inspect(unit);
      return;
    }
    const building = buildingAt(this.state, tile.x, tile.y);
    if (
      (building?.type === 'caserne' || building?.type === 'port') &&
      building.owner === this.state.currentPlayer
    ) {
      await this.buildMenu(building);
      return;
    }
    await this.mapMenu(tile);
  }

  private select(unit: Unit): void {
    this.selectedId = unit.id;
    this.reachable = unit.hasMoved ? [unit] : reachableTiles(this.state, unit.id);
    this.mergeTargets = this.state.units.filter((other) => canMerge(this.state, unit.id, other.id));
    this.loadTargets = this.state.units.filter((other) => canLoad(this.state, unit.id, other.id));
    this.views.overlay.show(
      [...this.reachable, ...this.mergeTargets, ...this.loadTargets],
      threatTiles(this.state, unit.id),
    );
    this.mode = 'selected';
    this.updateArrow(this.views.cursor.position);
  }

  private inspect(unit: Unit): void {
    this.selectedId = null;
    this.views.overlay.show(reachableTiles(this.state, unit.id), threatTiles(this.state, unit.id));
    this.mode = 'inspecting';
  }

  private clearSelection(): void {
    this.selectedId = null;
    this.reachable = [];
    this.mergeTargets = [];
    this.loadTargets = [];
    this.views.overlay.clear();
    this.views.arrow.clear();
    if (this.mode !== 'over') this.mode = 'idle';
  }

  private updateArrow(tile: Position): void {
    const unit = this.selectedId === null ? undefined : findUnit(this.state, this.selectedId);
    const ally = [...this.mergeTargets, ...this.loadTargets].find((candidate) =>
      same(candidate, tile),
    );
    const path = !unit
      ? null
      : ally
        ? mergePath(this.state, unit.id, ally)
        : this.reachable.some((candidate) => same(candidate, tile)) && !same(unit, tile)
          ? findPath(this.state, unit.id, tile)
          : null;
    if (path) this.views.arrow.show(path);
    else this.views.arrow.clear();
  }

  // ——— Ordres d'unité ———

  private async confirmDestination(tile: Position): Promise<void> {
    const unit = this.selectedId === null ? undefined : findUnit(this.state, this.selectedId);
    if (!unit) return this.clearSelection();
    if (same(unit, tile)) return this.commandMenu(unit.id, null);
    const ally = this.mergeTargets.find((candidate) => same(candidate, tile));
    if (ally) return this.joinMenu(unit, ally, 'merge');
    const transport = this.loadTargets.find((candidate) => same(candidate, tile));
    if (transport) return this.joinMenu(unit, transport, 'load');
    if (!this.reachable.some((candidate) => same(candidate, tile))) return this.clearSelection();

    const before = this.state;
    this.views.overlay.clear();
    this.views.arrow.clear();
    if (await this.execute({ type: 'MOVE', unitId: unit.id, to: tile })) {
      await this.commandMenu(unit.id, before);
    } else {
      this.clearSelection();
    }
  }

  /**
   * Destination sur une unité alliée du même type, blessée : menu « Fusionner ». Échap
   * revient au choix de la destination (rien n'a bougé).
   */
  private async joinMenu(unit: Unit, ally: Unit, kind: 'merge' | 'load'): Promise<void> {
    this.views.overlay.clear();
    this.mode = 'menu';
    const choice = await this.views.menu.open<Command>(
      [{ value: kind, label: kind === 'merge' ? 'Fusionner' : 'Embarquer' }],
      this.screenPosition(ally),
    );
    this.views.arrow.clear();
    if (choice !== kind) {
      const restored = findUnit(this.state, unit.id);
      if (restored) this.select(restored);
      else this.clearSelection();
      return;
    }
    await this.execute(
      kind === 'merge'
        ? { type: 'MERGE', unitId: unit.id, targetId: ally.id }
        : { type: 'LOAD', unitId: unit.id, transportId: ally.id },
    );
    this.clearSelection();
  }

  /**
   * Débarquer : choix de l'unité à bord (s'il y en a plusieurs), puis de la case voisine.
   * Échap revient au menu du transport. Le transport peut ensuite débarquer encore ou
   * attendre ; il ne peut plus bouger.
   */
  private async unloadMenu(transport: Unit, beforeMove: GameState | null): Promise<void> {
    const aboard = (transport.cargo ?? []).filter(
      (passenger) => unloadTiles(this.state, transport.id, passenger.id).length > 0,
    );
    const anchor = this.screenPosition(transport);
    let passenger = aboard[0];
    if (aboard.length > 1) {
      const id = await this.views.menu.open(
        aboard.map((u) => ({
          value: String(u.id),
          label: `${UNITS[u.type].name} (${Math.ceil(u.hp / 10)} PV)`,
        })),
        anchor,
      );
      passenger = aboard.find((u) => String(u.id) === id);
    }
    if (!passenger) return this.commandMenu(transport.id, beforeMove);
    const tiles = unloadTiles(this.state, transport.id, passenger.id);
    this.views.overlay.show(tiles, []);
    const key = await this.views.menu.open(
      tiles.map((t) => {
        const k = `${t.x - transport.x},${t.y - transport.y}`;
        return { value: k, label: `Débarquer : ${DIRECTION_NAMES[k] ?? k}` };
      }),
      anchor,
    );
    this.views.overlay.clear();
    const tile = tiles.find((t) => `${t.x - transport.x},${t.y - transport.y}` === key);
    if (!tile) return this.commandMenu(transport.id, beforeMove);
    await this.execute({
      type: 'UNLOAD',
      transportId: transport.id,
      unitId: passenger.id,
      to: tile,
    });
    const after = findUnit(this.state, transport.id);
    if (after && !after.hasActed && this.mode !== 'over') return this.commandMenu(after.id, null);
    this.clearSelection();
  }

  /**
   * Menu Attaquer / Capturer / Attendre. Échap annule : si l'unité vient de bouger,
   * on revient à l'état d'avant le déplacement (le moteur n'a rien tiré au hasard).
   */
  private async commandMenu(unitId: number, beforeMove: GameState | null): Promise<void> {
    const unit = findUnit(this.state, unitId);
    if (!unit) return this.clearSelection();
    const targets = targetsInRange(this.state, unitId);
    const items: MenuItem<Command>[] = [];
    if (targets.length > 0) items.push({ value: 'attack', label: 'Attaquer' });
    const walls = wallsInRange(this.state, unit);
    if (walls.length > 0) items.push({ value: 'breach', label: 'Abattre le rempart' });
    if (canCapture(this.state, unitId)) items.push({ value: 'capture', label: 'Capturer' });
    if ((unit.cargo ?? []).some((p) => unloadTiles(this.state, unitId, p.id).length > 0)) {
      items.push({ value: 'unload', label: 'Débarquer' });
    }
    items.push({ value: 'wait', label: 'Attendre' });

    this.mode = 'menu';
    const choice = await this.views.menu.open(items, this.screenPosition(unit));

    if (choice === null) {
      if (beforeMove) {
        this.pendingMove = null;
        this.state = beforeMove;
        this.views.player.sync(this.state);
      }
      const restored = findUnit(this.state, unitId);
      if (restored) this.select(restored);
      else this.clearSelection();
      return;
    }

    if (choice === 'unload') return this.unloadMenu(unit, beforeMove);
    if (choice === 'breach') {
      const wall = await this.pickTile(walls);
      if (!wall) return this.commandMenu(unitId, beforeMove);
      this.views.overlay.clear();
      await this.execute({ type: 'FIRE_WALL', unitId, x: wall.x, y: wall.y });
      this.clearSelection();
      return;
    }
    let action: Action;
    if (choice === 'attack') {
      const target = await this.pickTarget(targets);
      if (!target) return this.commandMenu(unitId, beforeMove);
      action = { type: 'ATTACK', unitId, targetId: target.id };
    } else if (choice === 'capture') {
      action = { type: 'CAPTURE', unitId };
    } else {
      action = { type: 'WAIT', unitId };
    }
    this.views.overlay.clear();
    await this.execute(action);
    this.clearSelection();
  }

  private async pickTarget(targets: Unit[]): Promise<Unit | null> {
    const spot = await this.pickTile(targets);
    return spot ? (targets.find((unit) => same(unit, spot)) ?? null) : null;
  }

  /** Choix d'une case parmi `targets` (curseur, flèches ou clic ; Échap annule). */
  private pickTile(targets: readonly Position[]): Promise<Position | null> {
    this.targets = [...targets];
    this.targetIndex = 0;
    this.mode = 'targeting';
    this.views.overlay.showTargets(targets);
    const first = targets[0];
    if (first) this.pointAt(first, 1);
    this.updateForecast(this.views.cursor.position);
    return new Promise((resolve) => {
      this.resolveTarget = resolve;
    });
  }

  private cycleTarget(step: number): void {
    if (this.targets.length === 0) return;
    this.targetIndex = (this.targetIndex + step + this.targets.length) % this.targets.length;
    const target = this.targets[this.targetIndex];
    if (target) this.pointAt(target, 1);
  }

  private finishTargeting(target: Position | null): void {
    const resolve = this.resolveTarget;
    this.resolveTarget = null;
    this.targets = [];
    this.views.overlay.clear();
    this.views.forecast.hide();
    this.mode = 'busy';
    resolve?.(target);
  }

  // ——— Production et fin de tour ———

  private async buildMenu(building: Building): Promise<void> {
    if (unitAt(this.state, building.x, building.y)) return;
    const funds =
      this.state.players.find((player) => player.id === this.state.currentPlayer)?.funds ?? 0;
    // La caserne produit les troupes, le port les bateaux.
    const items: MenuItem<UnitType>[] = UNIT_TYPES.filter((type) =>
      producesUnit(building.type, type),
    ).map((type) => ({
      value: type,
      label: UNITS[type].name,
      detail: String(UNITS[type].cost),
      enabled: UNITS[type].cost <= funds,
    }));
    this.mode = 'menu';
    const choice = await this.views.menu.open(items, this.screenPosition(building));
    this.mode = 'idle';
    if (choice)
      await this.execute({ type: 'BUILD', x: building.x, y: building.y, unitType: choice });
  }

  private async mapMenu(tile: Position): Promise<void> {
    this.mode = 'menu';
    const choice = await this.views.menu.open(
      [{ value: 'end', label: 'Fin de tour' }],
      this.screenPosition(tile),
    );
    this.mode = 'idle';
    if (choice === 'end') await this.endTurn();
  }

  private async endTurn(): Promise<void> {
    if (!(await this.execute({ type: 'END_TURN' }))) return;
    if (this.isAiTurn()) await this.runAiTurns();
    else if (this.isRemoteTurn()) await this.runRemoteTurns();
    else this.focusCurrentPlayer();
  }

  // ——— Tour de l'IA ———

  private isAiTurn(): boolean {
    return this.state.status === 'playing' && this.aiPlayers.includes(this.state.currentPlayer);
  }

  /** Joue les tours de l'IA jusqu'à ce que la main revienne à un joueur humain. */
  private async runAiTurns(): Promise<void> {
    while (this.isAiTurn()) {
      this.clearSelection();
      this.mode = 'ai';
      this.views.hud.setPauseEnabled(false);
      this.views.hud.setButtonLabel('Accélérer');
      await this.playAiTurn();
      this.setFast(false);
      this.views.hud.setButtonLabel('Fin de tour');
      this.views.hud.setPauseEnabled(true);
      if (this.state.status === 'finished') return;
    }
    this.mode = 'idle';
    this.focusCurrentPlayer();
  }

  /**
   * Une action de l'IA à la fois, choisie sur l'état courant : la caméra suit l'unité,
   * la zone de déplacement et le chemin s'affichent un instant, puis l'EventPlayer joue.
   */
  private async playAiTurn(): Promise<void> {
    const player = this.state.currentPlayer;
    while (this.state.status === 'playing' && this.state.currentPlayer === player) {
      const action = chooseGreedyAction(this.state);
      await this.previewAiAction(action);
      const ok = await this.execute(action);
      if (this.mode === 'over') return;
      this.mode = 'ai';
      if (!ok) {
        // Ne devrait jamais arriver (testé dans le moteur) : on rend la main proprement.
        if (action.type !== 'END_TURN') await this.execute({ type: 'END_TURN' });
        return;
      }
      if (action.type === 'END_TURN') return;
      if (action.type !== 'MOVE') await this.pause(AI_UNIT_PAUSE);
    }
  }

  private async previewAiAction(action: Action): Promise<void> {
    switch (action.type) {
      case 'MOVE': {
        const unit = findUnit(this.state, action.unitId);
        const path = findPath(this.state, action.unitId, action.to);
        if (!unit || !path) return;
        this.pointAt(unit, 3);
        this.views.overlay.show(reachableTiles(this.state, unit.id), []);
        this.views.arrow.show(path);
        await this.pause(AI_PREVIEW);
        this.views.overlay.clear();
        this.views.arrow.clear();
        return;
      }
      case 'ATTACK': {
        const target = findUnit(this.state, action.targetId);
        if (!target) return;
        this.views.overlay.showTargets([target]);
        this.pointAt(target, 2);
        await this.pause(AI_PREVIEW);
        this.views.overlay.clear();
        return;
      }
      case 'FIRE_WALL':
        this.views.overlay.showTargets([action]);
        this.pointAt(action, 2);
        await this.pause(AI_PREVIEW);
        this.views.overlay.clear();
        return;
      case 'UNLOAD':
        this.pointAt(action.to, 3);
        await this.pause(AI_PREVIEW / 2);
        return;
      case 'LOAD':
      case 'MERGE': {
        const unit = findUnit(this.state, action.unitId);
        const ally = findUnit(
          this.state,
          action.type === 'MERGE' ? action.targetId : action.transportId,
        );
        const path = unit && ally ? mergePath(this.state, unit.id, ally) : null;
        if (!unit || !path) return;
        this.pointAt(unit, 3);
        this.views.arrow.show(path);
        await this.pause(AI_PREVIEW);
        this.views.arrow.clear();
        return;
      }
      case 'BUILD':
        this.pointAt(action, 3);
        await this.pause(AI_PREVIEW / 2);
        return;
      case 'CAPTURE':
      case 'WAIT': {
        const unit = findUnit(this.state, action.unitId);
        if (unit) this.pointAt(unit, 3);
        return;
      }
      case 'END_TURN':
        return;
    }
  }

  // ——— Adversaire en ligne ———

  private isRemoteTurn(): boolean {
    return (
      this.remote !== null &&
      this.state.status === 'playing' &&
      this.state.currentPlayer !== this.remote.me
    );
  }

  private listenRemote(remote: RemoteSession): void {
    remote.bindLocalState(() => this.state);
    remote.onChange(() => {
      if (this.mode === 'remote') this.views.hud.setButtonLabel(this.remoteLabel());
    });
    remote.onTurnSkipped((player) => void this.turnSkipped(player));
    // Abandon (de l'un ou de l'autre) : écran de fin, même au milieu du tour adverse.
    remote.onEnd((winner, reason) => {
      if (this.mode === 'over' || reason !== 'abandon') return;
      void this.showEnd(winner === remote.me ? 'Victoire : abandon adverse' : 'Défaite : abandon');
    });
  }

  /** Partie terminée (le mode change pendant les `await`, d'où une méthode). */
  private isOver(): boolean {
    return this.mode === 'over';
  }

  /** Bouton du HUD pendant le tour d'un autre camp (le bandeau en ligne dit qui joue). */
  private remoteLabel(): string {
    const seat = this.remote?.seats.find((s) => s.people === this.state.currentPlayer);
    if (seat?.cpu) return 'Tour de l’IA';
    return !seat || this.remote?.online.has(seat.people) ? 'Tour adverse' : 'Adversaire absent';
  }

  /**
   * Temps écoulé : le serveur a passé le tour de ce joueur, qui n'avait encore rien joué.
   * L'écran rejoue cette fin de tour ; s'il était au milieu d'un choix (menu, pause), on
   * repart de l'état du serveur.
   */
  private async turnSkipped(player: PlayerId): Promise<void> {
    if (!this.remote || player !== this.remote.me || this.isOver()) return;
    // Écran en retard (tours précédents pas encore rejoués) ou au milieu d'un choix.
    const busy = this.mode !== 'idle' && this.mode !== 'selected' && this.mode !== 'inspecting';
    if (this.state.currentPlayer !== player || busy) {
      window.location.reload();
      return;
    }
    this.clearSelection();
    this.pendingMove = null;
    if (!(await this.execute({ type: 'END_TURN' }, true))) {
      window.location.reload();
      return;
    }
    if (this.isRemoteTurn()) await this.runRemoteTurns();
  }

  /** Rejoue les actions de l'adversaire, reçues du serveur, jusqu'à ce que la main revienne. */
  private async runRemoteTurns(): Promise<void> {
    while (this.isRemoteTurn() && this.remote) {
      this.clearSelection();
      this.mode = 'remote';
      this.views.hud.setPauseEnabled(false);
      this.views.hud.setButtonLabel(this.remoteLabel());
      const action = await this.remote.next();
      if (this.isOver()) return;
      await this.previewAiAction(action);
      const ok = await this.execute(action, true);
      if (this.isOver()) return;
      if (!ok) {
        // Désaccord avec le serveur : son état fait foi.
        window.location.reload();
        return;
      }
      this.mode = 'remote';
      if (action.type !== 'MOVE' && action.type !== 'END_TURN') await this.pause(AI_UNIT_PAUSE);
    }
    this.setFast(false);
    this.views.hud.setButtonLabel('Fin de tour');
    this.views.hud.setPauseEnabled(true);
    if (this.state.status === 'finished') return;
    this.mode = 'idle';
    this.focusCurrentPlayer();
    this.remote?.ready();
  }

  /** Envoie au serveur une action jouée sur cet écran (un MOVE attend l'action suivante). */
  private sendToRemote(action: Action): void {
    if (!this.remote) return;
    if (action.type === 'MOVE') {
      // Premier déplacement : le joueur a commencé son tour, le minuteur s'arrête.
      if (!this.pendingMove) this.remote.active();
      this.pendingMove = action;
      return;
    }
    this.remote.send(this.pendingMove ? [this.pendingMove, action] : [action]);
    this.pendingMove = null;
  }

  /** « Accélérer » : animations, minuteries et tweens tournent plus vite. */
  private toggleFast(): void {
    this.setFast(!this.fast);
  }

  private setFast(fast: boolean): void {
    this.fast = fast;
    const scale = fast ? AI_FAST : 1;
    this.scene.tweens.timeScale = scale;
    this.scene.time.timeScale = scale;
    this.scene.anims.globalTimeScale = scale;
    if (this.isAiTurn()) this.views.hud.setButtonLabel(fast ? 'Vitesse ×4' : 'Accélérer');
    else if (this.mode === 'remote') this.views.hud.setButtonLabel(this.remoteLabel());
  }

  private pause(ms: number): Promise<void> {
    return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
  }

  // ——— Moteur ———

  /** Envoie l'action au moteur, puis joue ses événements. Renvoie false si l'action est refusée. */
  private async execute(action: Action, fromRemote = false): Promise<boolean> {
    const result = applyAction(this.state, action);
    if (!result.ok) {
      console.warn(
        `[moteur] ${action.type} refusée : ${result.error.code} — ${result.error.message}`,
      );
      return false;
    }
    const before = this.state;
    this.state = result.state;
    if (!fromRemote) this.sendToRemote(action);
    this.mode = 'busy';
    await this.views.player.play(result.events, result.state, before);
    this.views.hud.inspect(this.state, this.views.cursor.position);
    if (this.state.status === 'finished' || this.humansDefeated() || this.remoteDefeated()) {
      if (!this.remote) clearSave();
      void this.showEnd();
      return true;
    }
    // Sauvegarde automatique à chaque fin de tour.
    if (action.type === 'END_TURN' && !this.remote) saveGame(this.state, this.aiPlayers);
    this.mode = 'idle';
    return true;
  }

  /**
   * Contre l'IA, la partie s'arrête dès que tous les camps humains sont vaincus : à 4 peuples,
   * les IA restantes ne jouent pas la fin entre elles.
   */
  private humansDefeated(): boolean {
    if (this.aiPlayers.length === 0) return false;
    const humans = this.state.players.filter((player) => !this.aiPlayers.includes(player.id));
    return humans.length > 0 && humans.every((player) => player.defeated);
  }

  /** En ligne à 4 (JN) : le camp de ce joueur est vaincu, la partie continue sans lui. */
  private remoteDefeated(): boolean {
    const me = this.remote?.me;
    return me !== undefined && this.state.players.some((p) => p.id === me && p.defeated);
  }

  private async showEnd(heading: string | null = null): Promise<void> {
    this.mode = 'over';
    this.clearSelection();
    this.views.hud.setVisible(false);
    const defeat = this.state.status !== 'finished' ? 'Défaite' : null;
    this.onFinished(await this.views.endScreen.show(this.state, heading ?? defeat));
  }
}
