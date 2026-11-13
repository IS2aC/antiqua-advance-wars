import type { GameState } from './types';

/** Version modifiable d'un type en lecture seule (usage interne au reducer). */
export type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;

/** Copie de travail de l'état, que les règles modifient avant d'être rendue figée. */
export type Draft = DeepMutable<GameState>;
export type DraftUnit = Draft['units'][number];
export type DraftBuilding = Draft['buildings'][number];

/**
 * Copie l'état pour qu'une action puisse le modifier sans toucher l'original.
 * La carte est statique : elle est partagée et ne doit jamais être modifiée.
 */
export function cloneState(state: GameState): Draft {
  return {
    ...state,
    map: state.map as Draft['map'],
    units: state.units.map((unit) => ({ ...unit })),
    buildings: state.buildings.map((building) => ({ ...building })),
    players: state.players.map((player) => ({ ...player, stats: { ...player.stats } })),
  };
}

export function draftUnit(draft: Draft, unitId: number): DraftUnit {
  const unit = draft.units.find((candidate) => candidate.id === unitId);
  if (!unit) throw new Error(`Invariant violé : unité ${unitId} absente de la copie de travail.`);
  return unit;
}

export function draftPlayer(draft: Draft, playerId: string): Draft['players'][number] {
  const player = draft.players.find((candidate) => candidate.id === playerId);
  if (!player)
    throw new Error(`Invariant violé : joueur ${playerId} absent de la copie de travail.`);
  return player;
}
