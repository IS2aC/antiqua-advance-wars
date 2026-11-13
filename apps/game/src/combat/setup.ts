import {
  displayHp,
  isIndirect,
  terrainAt,
  type GameEvent,
  type GameState,
  type PlayerId,
  type TerrainType,
  type UnitType,
} from '@antiqua/engine';

/**
 * Description d'une scène de combat, tirée du résultat du moteur. La scène illustre ce
 * résultat (qui frappe, combien de soldats tombent) ; elle ne calcule jamais rien.
 */

export type Side = 'left' | 'right';

export interface CombatSide {
  readonly side: Side;
  readonly owner: PlayerId;
  readonly unitType: UnitType;
  readonly terrain: TerrainType;
  readonly role: 'attaquant' | 'defenseur';
  /** PV affichés (1 à 10) avant le combat. */
  readonly hpBefore: number;
  /** PV affichés après le combat (0 = unité détruite). */
  readonly hpAfter: number;
}

export interface Strike {
  readonly from: Side;
  /** PV affichés de la cible avant et après ce coup. */
  readonly targetHpBefore: number;
  readonly targetHpAfter: number;
  /** Tir à distance (archers, catapulte) ou corps à corps. */
  readonly ranged: boolean;
}

export interface CombatSetup {
  readonly left: CombatSide;
  readonly right: CombatSide;
  /** Le coup de l'attaquant, puis la riposte éventuelle. */
  readonly strikes: readonly Strike[];
}

type AttackEvent = Extract<GameEvent, { type: 'attackResolved' }>;
type CounterEvent = Extract<GameEvent, { type: 'counterResolved' }>;

/** Unités représentées par moitié moins de figurants (une figure pour 2 PV). */
const LARGE_UNITS: ReadonlySet<UnitType> = new Set(['cavalerie', 'char', 'catapulte']);

/**
 * Nombre de figurants pour des PV affichés : un soldat par PV (jusqu'à 10), une monture
 * ou un engin pour 2 PV (jusqu'à 5). Au moins un tant que l'unité vit.
 */
export function soldierCount(unitType: UnitType, hp: number): number {
  if (hp <= 0) return 0;
  return LARGE_UNITS.has(unitType) ? Math.ceil(hp / 2) : hp;
}

/**
 * Compose la scène à partir de l'état AVANT l'action (pour connaître une unité détruite)
 * et des événements d'attaque et de riposte. L'unité la plus à gauche sur la carte se
 * place à gauche de l'écran ; à égalité, l'attaquant.
 */
export function buildCombatSetup(
  before: GameState,
  attack: AttackEvent,
  counter: CounterEvent | undefined,
): CombatSetup | null {
  const attacker = before.units.find((unit) => unit.id === attack.attackerId);
  const defender = before.units.find((unit) => unit.id === attack.defenderId);
  if (!attacker || !defender) return null;
  const attackerTerrain = terrainAt(before.map, attacker.x, attacker.y);
  const defenderTerrain = terrainAt(before.map, defender.x, defender.y);
  if (!attackerTerrain || !defenderTerrain) return null;

  const attackerSide: Side = attacker.x <= defender.x ? 'left' : 'right';
  const defenderSide: Side = attackerSide === 'left' ? 'right' : 'left';
  const attackerAfter = counter ? counter.defenderHp : attacker.hp;

  const sides: Record<'attaquant' | 'defenseur', CombatSide> = {
    attaquant: {
      side: attackerSide,
      owner: attacker.owner,
      unitType: attacker.type,
      terrain: attackerTerrain,
      role: 'attaquant',
      hpBefore: displayHp(attacker.hp),
      hpAfter: displayHp(Math.max(0, attackerAfter)),
    },
    defenseur: {
      side: defenderSide,
      owner: defender.owner,
      unitType: defender.type,
      terrain: defenderTerrain,
      role: 'defenseur',
      hpBefore: displayHp(defender.hp),
      hpAfter: displayHp(Math.max(0, attack.defenderHp)),
    },
  };

  const strikes: Strike[] = [
    {
      from: attackerSide,
      targetHpBefore: sides.defenseur.hpBefore,
      targetHpAfter: sides.defenseur.hpAfter,
      ranged: isIndirect(attacker.type),
    },
  ];
  if (counter) {
    strikes.push({
      from: defenderSide,
      targetHpBefore: sides.attaquant.hpBefore,
      targetHpAfter: sides.attaquant.hpAfter,
      ranged: isIndirect(defender.type),
    });
  }

  const left = attackerSide === 'left' ? sides.attaquant : sides.defenseur;
  const right = attackerSide === 'left' ? sides.defenseur : sides.attaquant;
  return { left, right, strikes };
}

// ——— Capture ———

export interface CaptureSetup {
  /** Camp et unité qui capturent. */
  readonly owner: PlayerId;
  readonly unitType: UnitType;
  /** PV affichés de l'unité qui capture (nombre de figurants). */
  readonly unitHp: number;
  readonly building: 'village' | 'caserne' | 'qg';
  /** Propriétaire du bâtiment avant la capture (null = neutre). */
  readonly previousOwner: PlayerId | null;
  readonly pointsBefore: number;
  readonly pointsAfter: number;
  /** Le bâtiment change de camp à l'issue de ce tour de capture. */
  readonly captured: boolean;
  /** Prise d'un QG adverse : annexion, fin de partie. */
  readonly annexation: boolean;
}

type ProgressEvent = Extract<GameEvent, { type: 'captureProgress' }>;
type CapturedEvent = Extract<GameEvent, { type: 'buildingCaptured' }>;

/** Compose la scène de siège (et de prise) à partir de l'état AVANT la capture. */
export function buildCaptureSetup(
  before: GameState,
  progress: ProgressEvent,
  captured: CapturedEvent | undefined,
): CaptureSetup | null {
  const unit = before.units.find((candidate) => candidate.id === progress.unitId);
  const building = before.buildings.find(
    (candidate) => candidate.x === progress.x && candidate.y === progress.y,
  );
  if (!unit || !building) return null;
  return {
    owner: unit.owner,
    unitType: unit.type,
    unitHp: displayHp(unit.hp),
    building: building.type,
    previousOwner: building.owner,
    pointsBefore: building.capturePoints,
    pointsAfter: progress.capturePoints,
    captured: captured !== undefined,
    annexation: captured !== undefined && building.type === 'qg' && building.owner !== null,
  };
}
