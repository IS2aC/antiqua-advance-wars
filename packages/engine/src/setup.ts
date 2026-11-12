import { CAPTURE_POINTS } from './rules/capture';
import { inBounds, tileIndex } from './rules/grid';
import type { GameState, MapDefinition } from './model/types';

export interface GameOptions {
  /** Graine du PRNG : même graine + mêmes actions = même partie. */
  readonly seed: number;
}

/**
 * Vérifie une définition de carte. Une carte invalide est une erreur de développement :
 * on lève une exception explicite plutôt que de démarrer une partie incohérente.
 */
function validate(definition: MapDefinition): void {
  const { width, height, tiles } = definition;
  const fail = (message: string): never => {
    throw new Error(`Carte « ${definition.name} » invalide : ${message}`);
  };
  if (tiles.length !== width * height) fail(`${tiles.length} cases pour ${width}×${height}.`);
  if (definition.players.length < 2) fail('il faut au moins 2 joueurs.');
  const map = { name: definition.name, width, height, tiles };
  for (const building of definition.buildings) {
    if (!inBounds(map, building.x, building.y))
      fail(`bâtiment hors carte en (${building.x}, ${building.y}).`);
    if (tiles[tileIndex(map, building.x, building.y)] !== building.type) {
      fail(
        `le terrain en (${building.x}, ${building.y}) ne correspond pas au bâtiment ${building.type}.`,
      );
    }
    if (building.owner !== null && !definition.players.includes(building.owner)) {
      fail(`bâtiment attribué à un joueur absent (${building.owner}).`);
    }
  }
  const occupied = new Set<number>();
  for (const unit of definition.units) {
    if (!inBounds(map, unit.x, unit.y)) fail(`unité hors carte en (${unit.x}, ${unit.y}).`);
    if (!definition.players.includes(unit.owner)) fail(`unité d'un joueur absent (${unit.owner}).`);
    const index = tileIndex(map, unit.x, unit.y);
    if (occupied.has(index)) fail(`deux unités en (${unit.x}, ${unit.y}).`);
    occupied.add(index);
  }
}

/** Crée l'état initial : jour 1, au premier joueur de la liste de jouer. */
export function createGame(definition: MapDefinition, options: GameOptions): GameState {
  validate(definition);
  const firstPlayer = definition.players[0];
  if (firstPlayer === undefined) throw new Error('Aucun joueur.');
  return {
    map: {
      name: definition.name,
      width: definition.width,
      height: definition.height,
      tiles: [...definition.tiles],
    },
    units: definition.units.map((unit, index) => ({
      id: index + 1,
      type: unit.type,
      owner: unit.owner,
      x: unit.x,
      y: unit.y,
      hp: 100,
      hasMoved: false,
      hasActed: false,
    })),
    buildings: definition.buildings.map((building) => ({
      ...building,
      capturePoints: CAPTURE_POINTS,
    })),
    players: definition.players.map((id) => ({
      id,
      funds: definition.startingFunds,
      defeated: false,
      stats: { unitsBuilt: 0, unitsLost: 0 },
    })),
    currentPlayer: firstPlayer,
    day: 1,
    rngSeed: options.seed | 0,
    nextUnitId: definition.units.length + 1,
    status: 'playing',
    winner: null,
  };
}
