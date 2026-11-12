/**
 * Types du modèle de jeu. Tous les objets d'état sont en lecture seule :
 * seul le reducer produit un nouvel état, à partir d'une copie interne.
 */

/** Factions jouables (Stage 1 : Koush contre Carthage). */
export type PlayerId = 'koush' | 'carthage' | 'kemet' | 'aksoum';

export type UnitType = 'fantassin' | 'lancier' | 'archers' | 'cavalerie' | 'char' | 'catapulte';

export type MoveType = 'pied' | 'lourd' | 'monture' | 'roues';

export type BuildingType = 'village' | 'caserne' | 'qg';

export type TerrainType =
  | 'plaine'
  | 'foret'
  | 'colline'
  | 'montagne'
  | 'desert'
  | 'marais'
  | 'route'
  | 'riviere'
  | 'pont'
  | BuildingType;

export interface Position {
  readonly x: number;
  readonly y: number;
}

/** Carte statique : terrains rangés ligne par ligne (index = y * width + x). */
export interface GameMap {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly TerrainType[];
}

export interface Unit {
  readonly id: number;
  readonly type: UnitType;
  readonly owner: PlayerId;
  readonly x: number;
  readonly y: number;
  /** PV internes, de 1 à 100. Les PV affichés valent ceil(hp / 10). */
  readonly hp: number;
  readonly hasMoved: boolean;
  readonly hasActed: boolean;
}

export interface Building {
  readonly type: BuildingType;
  readonly x: number;
  readonly y: number;
  readonly owner: PlayerId | null;
  /** 20 au repos ; la capture est réussie quand ils tombent à 0. */
  readonly capturePoints: number;
}

export interface PlayerStats {
  readonly unitsBuilt: number;
  readonly unitsLost: number;
}

export interface Player {
  readonly id: PlayerId;
  readonly funds: number;
  readonly defeated: boolean;
  readonly stats: PlayerStats;
}

export type GameStatus = 'playing' | 'finished';

export interface GameState {
  readonly map: GameMap;
  readonly units: readonly Unit[];
  readonly buildings: readonly Building[];
  /** Ordre de jeu : le premier joueur de la liste commence chaque jour. */
  readonly players: readonly Player[];
  readonly currentPlayer: PlayerId;
  readonly day: number;
  /** Graine courante du PRNG mulberry32 ; elle avance à chaque tirage. */
  readonly rngSeed: number;
  readonly nextUnitId: number;
  readonly status: GameStatus;
  readonly winner: PlayerId | null;
}

/** Description d'une carte jouable, avant le début de la partie. */
export interface MapDefinition {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly TerrainType[];
  readonly buildings: readonly {
    readonly type: BuildingType;
    readonly x: number;
    readonly y: number;
    readonly owner: PlayerId | null;
  }[];
  readonly units: readonly {
    readonly type: UnitType;
    readonly owner: PlayerId;
    readonly x: number;
    readonly y: number;
  }[];
  readonly players: readonly PlayerId[];
  readonly startingFunds: number;
}

export type Action =
  | { readonly type: 'MOVE'; readonly unitId: number; readonly to: Position }
  | { readonly type: 'ATTACK'; readonly unitId: number; readonly targetId: number }
  | { readonly type: 'CAPTURE'; readonly unitId: number }
  | { readonly type: 'WAIT'; readonly unitId: number }
  | { readonly type: 'BUILD'; readonly x: number; readonly y: number; readonly unitType: UnitType }
  | { readonly type: 'END_TURN' };

export type DefeatReason = 'hq' | 'rout';

/** Résultat d'une frappe : `attackerId` frappe `defenderId`. */
interface StrikeEvent {
  readonly attackerId: number;
  readonly defenderId: number;
  readonly damage: number;
  /** Chance tirée par le PRNG, de 0 à 9. */
  readonly luck: number;
  /** PV internes restants du défenseur (0 = détruit). */
  readonly defenderHp: number;
}

/** Événements renvoyés par le moteur, à jouer dans l'ordre par le rendu. */
export type GameEvent =
  | {
      readonly type: 'unitMoved';
      readonly unitId: number;
      /** Chemin case par case, de la case de départ (incluse) à l'arrivée. */
      readonly path: readonly Position[];
    }
  | ({ readonly type: 'attackResolved' } & StrikeEvent)
  | ({ readonly type: 'counterResolved' } & StrikeEvent)
  | {
      readonly type: 'unitDestroyed';
      readonly unitId: number;
      readonly owner: PlayerId;
      readonly x: number;
      readonly y: number;
    }
  | { readonly type: 'unitWaited'; readonly unitId: number }
  | {
      readonly type: 'captureProgress';
      readonly unitId: number;
      readonly x: number;
      readonly y: number;
      readonly capturePoints: number;
    }
  | { readonly type: 'captureReset'; readonly x: number; readonly y: number }
  | {
      readonly type: 'buildingCaptured';
      readonly x: number;
      readonly y: number;
      readonly building: BuildingType;
      readonly owner: PlayerId;
      readonly previousOwner: PlayerId | null;
    }
  | { readonly type: 'unitBuilt'; readonly unit: Unit; readonly cost: number }
  | { readonly type: 'turnEnded'; readonly player: PlayerId }
  | { readonly type: 'turnStarted'; readonly player: PlayerId; readonly day: number }
  | {
      readonly type: 'fundsGained';
      readonly player: PlayerId;
      readonly amount: number;
      readonly funds: number;
    }
  | { readonly type: 'playerDefeated'; readonly player: PlayerId; readonly reason: DefeatReason }
  | { readonly type: 'gameOver'; readonly winner: PlayerId | null };
