import type Phaser from 'phaser';
import {
  CAPTURE_POINTS,
  FACTIONS,
  TERRAINS,
  UNITS,
  buildingAt,
  displayHp,
  terrainAt,
  unitAt,
  type GameState,
  type Position,
} from '@antiqua/engine';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, TILE_SIZE } from '../config';
import { GRID, panel } from '../ui/panels';
import { pinToScreen, uiText } from './text';
import { DISABLED_TEXT_COLOR, TEAM_COLORS } from './palette';

const MARGIN = 4;
const BAR_H = GRID * 3;
const BUTTON_W = GRID * 13;
const INFO_W = GRID * 24;
const PIP = 5;

const formatGold = (amount: number) => amount.toLocaleString('fr-FR').replace(/\s/g, ' ');

/**
 * HUD : barre d'état (jour, camp, or), bouton « Fin de tour », et panneau d'informations
 * (terrain sous le curseur, unité éventuelle). Le panneau se place toujours du côté opposé
 * au curseur pour ne jamais masquer la case visée ; la barre passe en bas quand le curseur
 * monte sous elle.
 */
export class Hud {
  private readonly bar: Phaser.GameObjects.Container;
  private readonly status: Phaser.GameObjects.Text;
  private readonly statusPanel: Phaser.GameObjects.NineSlice;
  private readonly teamPip: Phaser.GameObjects.Rectangle;
  private readonly button: Phaser.GameObjects.NineSlice;

  private readonly info: Phaser.GameObjects.Container;
  private readonly infoPanel: Phaser.GameObjects.NineSlice;
  private readonly terrainName: Phaser.GameObjects.Text;
  private readonly terrainDetail: Phaser.GameObjects.Text;
  private readonly defensePips: Phaser.GameObjects.Graphics;
  private readonly unitName: Phaser.GameObjects.Text;
  private readonly unitDetail: Phaser.GameObjects.Text;
  private readonly unitPip: Phaser.GameObjects.Rectangle;
  private infoOnLeft = true;

  constructor(scene: Phaser.Scene, onEndTurn: () => void) {
    // ——— Barre d'état ———
    this.statusPanel = panel(scene, MARGIN, 0, 200, BAR_H);
    this.teamPip = scene.add.rectangle(MARGIN + 8, BAR_H / 2, 6, 6, 0xffffff).setOrigin(0, 0.5);
    this.status = uiText(scene, MARGIN + 20, 4, '');
    this.button = panel(scene, LOGICAL_WIDTH - MARGIN - BUTTON_W, 0, BUTTON_W, BAR_H, 'button');
    this.button.setInteractive({ useHandCursor: true });
    const label = uiText(scene, LOGICAL_WIDTH - MARGIN - BUTTON_W / 2, 4, 'Fin de tour');
    label.setOrigin(0.5, 0);
    this.button.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) onEndTurn();
    });
    this.button.on('pointerover', () => this.button.setTint(0xffe0a0));
    this.button.on('pointerout', () => this.button.clearTint());
    this.bar = scene.add.container(0, MARGIN, [
      this.statusPanel,
      this.teamPip,
      this.status,
      this.button,
      label,
    ]);
    pinToScreen(this.bar).setDepth(40);

    // ——— Panneau terrain / unité ———
    this.infoPanel = panel(scene, 0, 0, INFO_W, GRID * 5);
    this.terrainName = uiText(scene, GRID, GRID - 2, '');
    this.defensePips = scene.add.graphics();
    this.terrainDetail = uiText(scene, GRID, GRID * 3 - 4, '', 'small', {
      color: DISABLED_TEXT_COLOR,
    });
    this.unitPip = scene.add.rectangle(GRID, GRID * 5 + 7, 6, 6, 0xffffff).setOrigin(0);
    this.unitName = uiText(scene, GRID + 10, GRID * 5 + 2, '');
    this.unitDetail = uiText(scene, GRID, GRID * 7 + 2, '', 'small');
    this.info = scene.add.container(0, 0, [
      this.infoPanel,
      this.terrainName,
      this.defensePips,
      this.terrainDetail,
      this.unitPip,
      this.unitName,
      this.unitDetail,
    ]);
    pinToScreen(this.info).setDepth(40);
  }

  sync(state: GameState): void {
    const player = state.players.find((candidate) => candidate.id === state.currentPlayer);
    const name = FACTIONS[state.currentPlayer].name;
    this.status.setText(`Jour ${state.day} · ${name} · ${formatGold(player?.funds ?? 0)} or`);
    this.statusPanel.setSize(Math.ceil((this.status.width + 32) / GRID) * GRID, BAR_H);
    this.teamPip.setFillStyle(TEAM_COLORS[state.currentPlayer]);
  }

  /** Met à jour le panneau d'informations pour la case visée. */
  inspect(state: GameState, tile: Position): void {
    const terrain = terrainAt(state.map, tile.x, tile.y);
    if (!terrain) return;
    const stats = TERRAINS[terrain];
    const building = buildingAt(state, tile.x, tile.y);
    this.terrainName.setText(stats.name);

    // Étoiles de défense : 4 pastilles, allumées selon le terrain.
    const g = this.defensePips.clear();
    const pipsX = INFO_W - GRID - 4 * (PIP + 2);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i < stats.defense ? 0xffd166 : 0x4a3626, 1);
      g.fillRect(pipsX + i * (PIP + 2), GRID + 2, PIP, PIP);
    }

    const details: string[] = [];
    if (building) {
      details.push(building.owner ? FACTIONS[building.owner].name : 'Neutre');
      if (building.capturePoints < CAPTURE_POINTS) {
        details.push(`capture ${building.capturePoints}/${CAPTURE_POINTS}`);
      }
      details.push(`+${formatGold(stats.income)} or`);
    } else {
      details.push(`défense ${stats.defense}`);
    }
    this.terrainDetail.setText(details.join(' · '));

    const unit = unitAt(state, tile.x, tile.y);
    const hasUnit = unit !== undefined;
    this.unitName.setVisible(hasUnit);
    this.unitDetail.setVisible(hasUnit);
    this.unitPip.setVisible(hasUnit);
    if (unit) {
      const unitStats = UNITS[unit.type];
      const range =
        unitStats.minRange === unitStats.maxRange
          ? `${unitStats.maxRange}`
          : `${unitStats.minRange}–${unitStats.maxRange}`;
      this.unitPip.setFillStyle(TEAM_COLORS[unit.owner]);
      this.unitName.setText(`${unitStats.name}${unit.hasActed ? ' (a agi)' : ''}`);
      this.unitDetail.setText(
        `PV ${displayHp(unit.hp)}/10 · dépl. ${unitStats.move} · portée ${range}`,
      );
    }
    this.infoPanel.setSize(INFO_W, hasUnit ? GRID * 10 : GRID * 5);
    this.placeInfo();
  }

  /** Place la barre et le panneau du côté opposé au curseur (coordonnées écran de la case). */
  avoid(screenX: number, screenY: number): void {
    const barAtTop = this.bar.y < LOGICAL_HEIGHT / 2;
    if (barAtTop && screenY < BAR_H + MARGIN) this.bar.setY(LOGICAL_HEIGHT - BAR_H - MARGIN);
    else if (!barAtTop && screenY > LOGICAL_HEIGHT - BAR_H * 2 - MARGIN) this.bar.setY(MARGIN);
    this.infoOnLeft = screenX + TILE_SIZE / 2 > LOGICAL_WIDTH / 2;
    this.placeInfo();
  }

  setVisible(visible: boolean): void {
    this.bar.setVisible(visible);
    this.info.setVisible(visible);
  }

  private placeInfo(): void {
    const height = this.infoPanel.height;
    const barAtBottom = this.bar.y > LOGICAL_HEIGHT / 2;
    const y = barAtBottom ? BAR_H + MARGIN * 2 : LOGICAL_HEIGHT - height - MARGIN;
    const x = this.infoOnLeft ? MARGIN : LOGICAL_WIDTH - INFO_W - MARGIN;
    this.info.setPosition(x, y);
  }
}
