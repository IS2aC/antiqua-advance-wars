import { applyAction, createGame, parseAsciiMap } from '../src/index';
import type { Action, GameEvent, GameState, PlayerId, UnitType } from '../src/index';

export const K: PlayerId = 'koush';
export const C: PlayerId = 'carthage';

export interface UnitSpec {
  readonly type: UnitType;
  readonly owner: PlayerId;
  readonly x: number;
  readonly y: number;
  readonly hp?: number;
}

export interface SetupOptions {
  readonly units: readonly UnitSpec[];
  /** Propriétaires des bâtiments, clé « x,y » ; neutre par défaut. */
  readonly owners?: Readonly<Record<string, PlayerId | null>>;
  readonly funds?: number;
  readonly seed?: number;
  readonly day?: number;
}

/** Crée une petite partie de test à partir d'une carte texte (ids d'unités = 1, 2, 3…). */
export function setup(rows: readonly string[], options: SetupOptions): GameState {
  const parsed = parseAsciiMap(rows);
  const state = createGame(
    {
      name: 'test',
      width: parsed.width,
      height: parsed.height,
      tiles: parsed.tiles,
      buildings: parsed.buildings.map((cell) => ({
        type: cell.type,
        x: cell.x,
        y: cell.y,
        owner: options.owners?.[`${cell.x},${cell.y}`] ?? null,
      })),
      units: options.units.map(({ type, owner, x, y }) => ({ type, owner, x, y })),
      players: [K, C],
      startingFunds: options.funds ?? 2000,
    },
    { seed: options.seed ?? 42 },
  );
  return {
    ...state,
    day: options.day ?? 1,
    units: state.units.map((unit, index) => ({ ...unit, hp: options.units[index]?.hp ?? 100 })),
  };
}

/** Applique une action qui doit être légale. */
export function act(
  state: GameState,
  action: Action,
): { state: GameState; events: readonly GameEvent[] } {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(`${result.error.code} : ${result.error.message}`);
  return result;
}

/** Applique une suite d'actions légales et concatène les événements. */
export function play(
  state: GameState,
  actions: readonly Action[],
): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (const action of actions) {
    const result = act(current, action);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

/** Termine le tour des deux joueurs. */
export function endRound(state: GameState): GameState {
  return play(state, [{ type: 'END_TURN' }, { type: 'END_TURN' }]).state;
}

/** Code d'erreur d'une action qui doit être refusée. */
export function errorOf(state: GameState, action: Action): string {
  const result = applyAction(state, action);
  if (result.ok) throw new Error(`L'action ${action.type} aurait dû être refusée.`);
  return result.error.code;
}

export function eventsOfType<T extends GameEvent['type']>(
  events: readonly GameEvent[],
  type: T,
): Extract<GameEvent, { type: T }>[] {
  return events.filter((event): event is Extract<GameEvent, { type: T }> => event.type === type);
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
