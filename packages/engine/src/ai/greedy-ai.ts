import { TERRAINS, movementCost } from '../data/terrains';
import { UNITS, UNIT_TYPES, isIndirect } from '../data/units';
import type {
  Action,
  Building,
  BuildingType,
  GameMap,
  GameState,
  MoveType,
  PlayerId,
  Position,
  Unit,
  UnitType,
} from '../model/types';
import { applyAction } from '../reducer';
import { computeDamage, forecast, targetsInRange } from '../rules/combat';
import {
  buildingAt,
  displayHp,
  inBounds,
  samePosition,
  terrainOf,
  tileIndex,
  unitAt,
} from '../rules/grid';
import { CAPTURE_POINTS } from '../rules/capture';
import { reachableTiles } from '../rules/movement';

/**
 * IA « gloutonne » (étape 6). À chaque appel, elle choisit la prochaine action du joueur
 * courant sans rien tirer au hasard : elle prend la première unité disponible (unité déjà
 * déplacée, puis tirs indirects, puis unités de capture, puis le reste), évalue chaque case
 * atteignable et chaque action possible depuis cette case, et garde la meilleure note.
 * Une fois les unités jouées, elle dépense l'or dans les casernes, puis finit le tour.
 *
 * Les notes sont en « pièces d'or » : détruire la moitié d'un fantassin vaut 500.
 */

/** Poids des différents termes de la note. Réglés par des matchs simulés. */
const WEIGHTS = {
  /** Bonus quand l'attaque détruit la cible à coup sûr (fraction de son coût). */
  kill: 0.5,
  /** Part du coût propre comptée par étoile de défense du terrain. */
  defense: 0.02,
  /** Part des pertes attendues au tour adverse (menace ennemie). */
  threat: 0.15,
  /** Les unités indirectes, fragiles au contact, craignent davantage la menace. */
  indirectThreat: 1.5,
  /** Part du coût propre perdue par point de mouvement qui reste jusqu'à l'objectif. */
  distance: 0.04,
  /** Malus pour une unité qui reste sur sa propre caserne et bloque la production. */
  blockBarracks: 600,
  /** Bonus pour frapper une unité qui capture un de nos bâtiments. */
  stopCapture: 800,
} as const;

/** Valeur d'un bâtiment pris (ou dont la capture progresse). */
const CAPTURE_VALUE: Readonly<Record<BuildingType, number>> = {
  village: 1200,
  caserne: 1800,
  qg: 3000,
};

/** Prendre le QG adverse gagne la partie. */
const WINNING_CAPTURE = 1_000_000;

/** Luck moyenne utilisée pour estimer les dégâts (le PRNG n'est jamais consommé). */
const AVERAGE_LUCK = 4.5;

type Category = 'infantry' | 'mobile' | 'indirect';

/** Composition visée de l'armée. */
const TARGET_MIX: Readonly<Record<Category, number>> = {
  infantry: 0.5,
  mobile: 0.3,
  indirect: 0.2,
};

const CATEGORY_OF: Readonly<Record<UnitType, Category>> = {
  fantassin: 'infantry',
  lancier: 'infantry',
  cavalerie: 'mobile',
  char: 'mobile',
  archers: 'indirect',
  catapulte: 'indirect',
};

const NEIGHBOURS: readonly Position[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/**
 * Distances par le terrain seul (unités ignorées), file à seaux car les coûts sont
 * de petits entiers. `toward = true` : coût pour aller de chaque case vers une source
 * (champ d'objectif) ; sinon coût pour partir d'une source (portée d'un ennemi).
 */
function terrainDistances(
  map: GameMap,
  sources: readonly Position[],
  moveType: MoveType,
  toward: boolean,
  limit = Infinity,
): Float64Array {
  const size = map.width * map.height;
  const dist = new Float64Array(size).fill(Infinity);
  const buckets: number[][] = [[]];
  const sourceSet = new Set<number>();
  for (const source of sources) {
    if (!inBounds(map, source.x, source.y)) continue;
    const index = tileIndex(map, source.x, source.y);
    sourceSet.add(index);
    dist[index] = 0;
    buckets[0]?.push(index);
  }
  for (let cost = 0; cost < buckets.length; cost++) {
    const bucket = buckets[cost] ?? [];
    for (const current of bucket) {
      if ((dist[current] ?? Infinity) < cost) continue;
      const cx = current % map.width;
      const cy = Math.floor(current / map.width);
      for (const step of NEIGHBOURS) {
        const nx = cx + step.x;
        const ny = cy + step.y;
        if (!inBounds(map, nx, ny)) continue;
        const next = tileIndex(map, nx, ny);
        const nextTerrain = map.tiles[next];
        if (nextTerrain === undefined || movementCost(nextTerrain, moveType) === null) continue;
        let stepCost: number | null;
        if (toward) {
          // On remonte le chemin : passer de `next` à `current` coûte l'entrée dans `current`.
          // Une source occupée par un ennemi s'atteint « au contact » (coût 1).
          const terrain = map.tiles[current];
          stepCost = sourceSet.has(current)
            ? 1
            : terrain === undefined
              ? null
              : movementCost(terrain, moveType);
        } else {
          stepCost = movementCost(nextTerrain, moveType);
        }
        if (stepCost === null) continue;
        const total = cost + stepCost;
        if (total > limit || total >= (dist[next] ?? Infinity)) continue;
        dist[next] = total;
        (buckets[total] ??= []).push(next);
      }
    }
  }
  return dist;
}

/** Une menace ennemie : l'unité et les cases d'où elle peut frapper au prochain tour. */
interface Threat {
  readonly unit: Unit;
  readonly tiles: ReadonlySet<number>;
}

function threatsAgainst(state: GameState, me: PlayerId): Threat[] {
  const { map } = state;
  return state.units
    .filter((unit) => unit.owner !== me)
    .map((unit) => {
      const { move, moveType, minRange, maxRange } = UNITS[unit.type];
      // Un tireur indirect ne tire que depuis sa case ; une unité directe bouge puis frappe.
      const origins: number[] = [];
      if (isIndirect(unit.type)) origins.push(tileIndex(map, unit.x, unit.y));
      else {
        const reach = terrainDistances(map, [unit], moveType, false, move);
        reach.forEach((cost, index) => {
          if (cost !== Infinity) origins.push(index);
        });
      }
      const tiles = new Set<number>();
      for (const origin of origins) {
        const ox = origin % map.width;
        const oy = Math.floor(origin / map.width);
        for (let dy = -maxRange; dy <= maxRange; dy++) {
          for (let dx = -maxRange; dx <= maxRange; dx++) {
            const gap = Math.abs(dx) + Math.abs(dy);
            if (gap < minRange || gap > maxRange || !inBounds(map, ox + dx, oy + dy)) continue;
            tiles.add(tileIndex(map, ox + dx, oy + dy));
          }
        }
      }
      return { unit, tiles };
    });
}

/** Pertes attendues (en or) si l'unité reste sur `tile` pendant le tour adverse. */
function expectedLosses(
  state: GameState,
  unit: Unit,
  tile: Position,
  threats: readonly Threat[],
  ignoredId: number | null,
): number {
  const terrain = terrainOf(state.map, tile);
  const index = tileIndex(state.map, tile.x, tile.y);
  let damage = 0;
  for (const threat of threats) {
    if (threat.unit.id === ignoredId || !threat.tiles.has(index)) continue;
    damage += computeDamage(threat.unit, unit, terrain, AVERAGE_LUCK);
  }
  return (Math.min(damage, unit.hp) / 100) * UNITS[unit.type].cost;
}

/** Objectifs d'une unité : bâtiments à prendre pour les unités de capture, sinon l'ennemi. */
function objectivesFor(state: GameState, unit: Unit): Position[] {
  const enemies = state.units.filter((other) => other.owner !== unit.owner);
  if (UNITS[unit.type].canCapture) {
    const buildings = state.buildings.filter((building) => {
      if (building.owner === unit.owner) return false;
      const occupant = unitAt(state, building.x, building.y);
      return !occupant || occupant.id === unit.id || occupant.owner !== unit.owner;
    });
    if (buildings.length > 0) return buildings;
  }
  if (enemies.length > 0) return enemies;
  return state.buildings.filter(
    (building) => building.type === 'qg' && building.owner !== unit.owner,
  );
}

interface Candidate {
  readonly tile: Position;
  readonly action: Action;
  readonly score: number;
}

function captureScore(unit: Unit, building: Building): number {
  const remaining = building.capturePoints - displayHp(unit.hp);
  if (remaining <= 0) {
    return building.type === 'qg' && building.owner !== null
      ? WINNING_CAPTURE
      : CAPTURE_VALUE[building.type] * 2;
  }
  // Une capture entamée vaut d'autant plus qu'elle est avancée.
  return CAPTURE_VALUE[building.type] * (1 + (CAPTURE_POINTS - remaining) / CAPTURE_POINTS);
}

/** Note d'une attaque depuis `tile`, et si elle détruit la cible à coup sûr. */
function attackScore(
  state: GameState,
  unit: Unit,
  target: Unit,
  tile: Position,
): { value: number; kills: boolean } {
  const prediction = forecast(state, unit.id, target.id, tile);
  if (!prediction) return { value: -Infinity, kills: false };
  const dealt = (prediction.damage.min + prediction.damage.max) / 2;
  const received = prediction.counter ? (prediction.counter.min + prediction.counter.max) / 2 : 0;
  let score = (dealt / 100) * UNITS[target.type].cost - (received / 100) * UNITS[unit.type].cost;
  const kills = prediction.damage.min >= target.hp;
  if (kills) score += WEIGHTS.kill * UNITS[target.type].cost;
  const building = buildingAt(state, target.x, target.y);
  if (building && building.owner === unit.owner && building.capturePoints < CAPTURE_POINTS) {
    score += WEIGHTS.stopCapture * (building.type === 'qg' ? 4 : 1);
  }
  return { value: score, kills };
}

/** Meilleure action de l'unité (déplacement compris), avec sa note. */
function bestCandidate(state: GameState, unit: Unit, threats: readonly Threat[]): Candidate {
  const stats = UNITS[unit.type];
  const tiles: Position[] = unit.hasMoved
    ? [{ x: unit.x, y: unit.y }]
    : reachableTiles(state, unit.id).map(({ x, y }) => ({ x, y }));
  const field = terrainDistances(state.map, objectivesFor(state, unit), stats.moveType, true);
  const threatWeight = WEIGHTS.threat * (isIndirect(unit.type) ? WEIGHTS.indirectThreat : 1);

  let best: Candidate = {
    tile: unit,
    action: { type: 'WAIT', unitId: unit.id },
    score: -Infinity,
  };
  for (const tile of tiles) {
    const terrain = terrainOf(state.map, tile);
    const building = buildingAt(state, tile.x, tile.y);
    const remaining = field[tileIndex(state.map, tile.x, tile.y)] ?? Infinity;
    let position =
      TERRAINS[terrain].defense * WEIGHTS.defense * stats.cost -
      (remaining === Infinity ? 0 : remaining * WEIGHTS.distance * stats.cost);
    if (building?.type === 'caserne' && building.owner === unit.owner) {
      position -= WEIGHTS.blockBarracks;
    }

    const options: { action: Action; value: number; spared: number | null }[] = [
      { action: { type: 'WAIT', unitId: unit.id }, value: 0, spared: null },
    ];
    if (stats.canCapture && building && building.owner !== unit.owner) {
      options.push({
        action: { type: 'CAPTURE', unitId: unit.id },
        value: captureScore(unit, building),
        spared: null,
      });
    }
    for (const target of targetsInRange(state, unit.id, tile)) {
      const { value, kills } = attackScore(state, unit, target, tile);
      options.push({
        action: { type: 'ATTACK', unitId: unit.id, targetId: target.id },
        value,
        // Une cible détruite à coup sûr ne menacera plus la case au tour adverse.
        spared: kills ? target.id : null,
      });
    }

    for (const option of options) {
      const losses = expectedLosses(state, unit, tile, threats, option.spared);
      const score = position + option.value - threatWeight * losses;
      if (score > best.score) best = { tile, action: option.action, score };
    }
  }
  return best;
}

/** Ordre de jeu des unités : finir celle qui a bougé, puis indirects, capture, le reste. */
function nextUnit(state: GameState): Unit | undefined {
  const rank = (unit: Unit): number => {
    if (unit.hasMoved) return 0;
    if (isIndirect(unit.type)) return 1;
    if (UNITS[unit.type].canCapture) return 2;
    return 3;
  };
  return state.units
    .filter((unit) => unit.owner === state.currentPlayer && !unit.hasActed)
    .sort((a, b) => rank(a) - rank(b) || a.id - b.id)[0];
}

/** Type d'unité à produire, selon la composition visée et l'armée adverse. */
function chooseUnitType(state: GameState, funds: number): UnitType | null {
  const me = state.currentPlayer;
  const mine = state.units.filter((unit) => unit.owner === me);
  const enemies = state.units.filter((unit) => unit.owner !== me);
  const affordable = (type: UnitType) => UNITS[type].cost <= funds;

  // Tant qu'il reste des bâtiments à prendre, on manque surtout de fantassins.
  const capturers = mine.filter((unit) => UNITS[unit.type].canCapture).length;
  const toCapture = state.buildings.filter((building) => building.owner !== me).length;

  const counts: Record<Category, number> = { infantry: 0, mobile: 0, indirect: 0 };
  for (const unit of mine) counts[CATEGORY_OF[unit.type]] += 1;
  const total = mine.length + 1;
  const deficits = (Object.keys(TARGET_MIX) as Category[])
    .map((category) => ({ category, gap: TARGET_MIX[category] - counts[category] / total }))
    .sort((a, b) => b.gap - a.gap);
  // Plus de cavalerie et de chars en face que de lanciers chez nous : on en produit.
  const enemyMobiles = enemies.filter((unit) => CATEGORY_OF[unit.type] === 'mobile').length;
  const lanciers = mine.filter((unit) => unit.type === 'lancier').length;
  const counterMobiles = enemyMobiles >= 2 && lanciers < enemyMobiles;
  const wanted: Category[] =
    capturers < Math.min(4, toCapture) || counterMobiles
      ? ['infantry']
      : deficits.map((entry) => entry.category);

  const preferences: Readonly<Record<Category, readonly UnitType[]>> = {
    // Contre la cavalerie et les chars, le lancier est la réponse.
    infantry: counterMobiles ? ['lancier', 'fantassin'] : ['fantassin', 'lancier'],
    mobile: ['char', 'cavalerie'],
    indirect: ['catapulte', 'archers'],
  };

  for (const category of wanted) {
    const choice = preferences[category].find(affordable);
    if (choice) return choice;
  }
  return UNIT_TYPES.filter(affordable).sort((a, b) => UNITS[a].cost - UNITS[b].cost)[0] ?? null;
}

function chooseBuild(state: GameState): Action | null {
  const me = state.currentPlayer;
  const funds = state.players.find((player) => player.id === me)?.funds ?? 0;
  const barracks = state.buildings
    .filter(
      (building) =>
        building.type === 'caserne' &&
        building.owner === me &&
        !unitAt(state, building.x, building.y),
    )
    // Les casernes les plus proches de l'ennemi d'abord.
    .sort((a, b) => frontDistance(state, a) - frontDistance(state, b));
  const barrack = barracks[0];
  if (!barrack) return null;
  // On répartit l'or entre les casernes libres pour ne pas tout miser sur une seule.
  const budget = Math.min(funds, Math.max(funds / barracks.length, UNITS.fantassin.cost));
  const unitType = chooseUnitType(state, budget);
  return unitType ? { type: 'BUILD', x: barrack.x, y: barrack.y, unitType } : null;
}

function frontDistance(state: GameState, position: Position): number {
  const enemies = state.units.filter((unit) => unit.owner !== state.currentPlayer);
  if (enemies.length === 0) return 0;
  return Math.min(
    ...enemies.map((enemy) => Math.abs(enemy.x - position.x) + Math.abs(enemy.y - position.y)),
  );
}

/** Prochaine action de l'IA pour le joueur courant. Déterministe, toujours légale. */
export function chooseGreedyAction(state: GameState): Action {
  if (state.status !== 'playing') return { type: 'END_TURN' };
  const unit = nextUnit(state);
  if (unit) {
    const threats = threatsAgainst(state, state.currentPlayer);
    const best = bestCandidate(state, unit, threats);
    if (!samePosition(best.tile, unit)) {
      return { type: 'MOVE', unitId: unit.id, to: { x: best.tile.x, y: best.tile.y } };
    }
    return best.action;
  }
  return chooseBuild(state) ?? { type: 'END_TURN' };
}

/** Limite de sécurité : un tour ne compte jamais autant d'actions. */
const MAX_TURN_ACTIONS = 500;

/**
 * Tour complet de l'IA, simulé avec le moteur : la liste d'actions se termine par
 * `END_TURN` (ou par l'action qui gagne la partie). Le moteur étant déterministe,
 * rejouer ces actions sur le même état donne exactement le même résultat.
 */
export function planTurn(state: GameState): Action[] {
  const actions: Action[] = [];
  let current = state;
  const player = state.currentPlayer;
  while (
    current.status === 'playing' &&
    current.currentPlayer === player &&
    actions.length < MAX_TURN_ACTIONS
  ) {
    const action = chooseGreedyAction(current);
    const result = applyAction(current, action);
    if (!result.ok) throw new Error(`IA : action illégale ${action.type} (${result.error.code}).`);
    actions.push(action);
    current = result.state;
    if (action.type === 'END_TURN') break;
  }
  return actions;
}
