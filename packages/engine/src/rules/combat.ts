import { BASE_DAMAGE } from '../data/damage-table';
import { TERRAINS } from '../data/terrains';
import { UNITS, isIndirect } from '../data/units';
import { draftPlayer, type Draft, type DraftUnit } from '../model/draft';
import type { GameEvent, GameState, Position, TerrainType, Unit, UnitType } from '../model/types';
import { randomInt } from '../rng';
import { distance, displayHp, findUnit, inBounds, samePosition, terrainOf } from './grid';
import { reachableTiles } from './movement';
import { resetCaptureAt } from './capture';

/** La chance L est tirée dans [0, MAX_LUCK]. */
export const MAX_LUCK = 9;

type Combatant = Pick<Unit, 'type' | 'hp'>;

/**
 * Formule de game-design.md :
 * D = floor((B + L) × PVatt/10 × (100 − E × PVdef) / 100), plafonné aux PV du défenseur.
 */
export function computeDamage(
  attacker: Combatant,
  defender: Combatant,
  defenderTerrain: TerrainType,
  luck: number,
): number {
  const base = BASE_DAMAGE[attacker.type][defender.type];
  const stars = TERRAINS[defenderTerrain].defense;
  const raw = Math.floor(
    ((base + luck) * displayHp(attacker.hp) * (100 - stars * displayHp(defender.hp))) / 1000,
  );
  return Math.max(0, Math.min(raw, defender.hp));
}

export function isInRange(type: UnitType, from: Position, target: Position): boolean {
  const gap = distance(from, target);
  return gap >= UNITS[type].minRange && gap <= UNITS[type].maxRange;
}

/** Riposte : seulement entre unités directes, adjacentes ; le défenseur doit survivre. */
export function canCounter(attacker: UnitType, defender: UnitType, gap: number): boolean {
  return !isIndirect(attacker) && !isIndirect(defender) && gap === 1;
}

/**
 * Ennemis attaquables depuis `from` (par défaut la case actuelle de l'unité).
 * Une unité indirecte qui a bougé, ou qui bougerait vers `from`, ne peut pas tirer.
 */
export function targetsInRange(state: GameState, unitId: number, from?: Position): Unit[] {
  const unit = findUnit(state, unitId);
  if (!unit) return [];
  const origin = from ?? unit;
  const moved = unit.hasMoved || !samePosition(origin, unit);
  if (isIndirect(unit.type) && moved) return [];
  return state.units.filter(
    (other) => other.owner !== unit.owner && isInRange(unit.type, origin, other),
  );
}

/**
 * Cases menacées par l'unité ce tour (zone rouge) : pour une unité directe, toute case
 * adjacente à une case atteignable ; pour une unité indirecte, la portée depuis sa case
 * actuelle, et rien si elle a déjà bougé. Une unité qui a agi ne menace plus rien.
 */
export function threatTiles(state: GameState, unitId: number): Position[] {
  const unit = findUnit(state, unitId);
  if (!unit || unit.hasActed) return [];
  const { minRange, maxRange } = UNITS[unit.type];
  let origins: readonly Position[];
  if (isIndirect(unit.type)) origins = unit.hasMoved ? [] : [unit];
  else origins = unit.hasMoved ? [unit] : reachableTiles(state, unitId);

  const seen = new Set<number>();
  const tiles: Position[] = [];
  for (const origin of origins) {
    for (let dy = -maxRange; dy <= maxRange; dy++) {
      for (let dx = -maxRange; dx <= maxRange; dx++) {
        const gap = Math.abs(dx) + Math.abs(dy);
        const x = origin.x + dx;
        const y = origin.y + dy;
        if (gap < minRange || gap > maxRange || !inBounds(state.map, x, y)) continue;
        const key = y * state.map.width + x;
        if (seen.has(key)) continue;
        seen.add(key);
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

export interface DamageRange {
  readonly min: number;
  readonly max: number;
}

export interface Forecast {
  readonly damage: DamageRange;
  /** `null` si le défenseur ne peut pas riposter ou meurt à coup sûr. */
  readonly counter: DamageRange | null;
}

/**
 * Fourchette de dégâts d'une attaque, sans consommer le PRNG.
 * `from` permet de prévoir depuis la case où l'unité va se déplacer.
 */
export function forecast(
  state: GameState,
  attackerId: number,
  targetId: number,
  from?: Position,
): Forecast | null {
  const attacker = findUnit(state, attackerId);
  const defender = findUnit(state, targetId);
  if (!attacker || !defender) return null;
  const origin = from ?? attacker;
  const defenderTerrain = terrainOf(state.map, defender);
  const min = computeDamage(attacker, defender, defenderTerrain, 0);
  const max = computeDamage(attacker, defender, defenderTerrain, MAX_LUCK);

  let counter: DamageRange | null = null;
  const strongestSurvivor = defender.hp - min;
  if (
    canCounter(attacker.type, defender.type, distance(origin, defender)) &&
    strongestSurvivor > 0
  ) {
    const attackerTerrain = terrainOf(state.map, origin);
    const weakestSurvivor = defender.hp - max;
    counter = {
      min:
        weakestSurvivor > 0
          ? computeDamage(
              { type: defender.type, hp: weakestSurvivor },
              attacker,
              attackerTerrain,
              0,
            )
          : 0,
      max: computeDamage(
        { type: defender.type, hp: strongestSurvivor },
        attacker,
        attackerTerrain,
        MAX_LUCK,
      ),
    };
  }
  return { damage: { min, max }, counter };
}

function rollLuck(draft: Draft): number {
  const draw = randomInt(draft.rngSeed, MAX_LUCK + 1);
  draft.rngSeed = draw.seed;
  return draw.value;
}

export function destroyUnit(draft: Draft, events: GameEvent[], unit: DraftUnit): void {
  draft.units = draft.units.filter((candidate) => candidate.id !== unit.id);
  draftPlayer(draft, unit.owner).stats.unitsLost += 1;
  events.push({ type: 'unitDestroyed', unitId: unit.id, owner: unit.owner, x: unit.x, y: unit.y });
  resetCaptureAt(draft, events, unit.x, unit.y);
}

function strike(
  draft: Draft,
  events: GameEvent[],
  kind: 'attackResolved' | 'counterResolved',
  attacker: DraftUnit,
  defender: DraftUnit,
): boolean {
  const luck = rollLuck(draft);
  const damage = computeDamage(attacker, defender, terrainOf(draft.map, defender), luck);
  defender.hp -= damage;
  events.push({
    type: kind,
    attackerId: attacker.id,
    defenderId: defender.id,
    damage,
    luck,
    defenderHp: defender.hp,
  });
  if (defender.hp > 0) return true;
  destroyUnit(draft, events, defender);
  return false;
}

/** Attaque puis, si les conditions sont réunies, riposte avec les PV restants. */
export function resolveAttack(
  draft: Draft,
  events: GameEvent[],
  attacker: DraftUnit,
  defender: DraftUnit,
): void {
  const survived = strike(draft, events, 'attackResolved', attacker, defender);
  if (survived && canCounter(attacker.type, defender.type, distance(attacker, defender))) {
    strike(draft, events, 'counterResolved', defender, attacker);
  }
}
