import type { Action, GameState, PlayerId } from '@antiqua/engine';
import type { EndReason, OnlineSeat, ServerMessage } from '@antiqua/protocol';
import { OnlineConnection } from './connection';

/**
 * Ce dont le contrôleur de bataille a besoin pour une partie en ligne : envoyer ses propres
 * actions, recevoir celles de l'adversaire, abandonner, savoir quand la partie s'arrête.
 */
export interface RemoteSession {
  /** Camp joué sur cet écran. */
  readonly me: PlayerId;
  readonly seats: readonly OnlineSeat[];
  /** Actions validées sur cet écran (un MOVE part avec l'action qui le suit). */
  send(actions: readonly Action[]): void;
  /** Prochaine action de l'adversaire (attend qu'elle arrive). */
  next(): Promise<Action>;
  resign(): void;
  /** Fin décidée par le serveur (abandon). */
  onEnd(listener: (winner: PlayerId | null, reason: EndReason) => void): void;
  onOpponent(listener: (online: boolean) => void): void;
  /** État courant de l'écran, pour détecter un désaccord avec le serveur. */
  bindLocalState(read: () => GameState): void;
}

export interface OnlineStart {
  readonly state: GameState;
  readonly session: RemoteSession;
  readonly opponentOnline: boolean;
}

/**
 * Ouvre la partie `id` : attend l'état officiel envoyé par le serveur. Un nouvel état reçu
 * plus tard (reconnexion, action refusée) qui ne correspond plus à l'écran recharge la page :
 * l'état du serveur fait foi.
 */
export function openOnlineGame(id: string): Promise<OnlineStart> {
  return new Promise((resolve, reject) => {
    const connection = new OnlineConnection(() => connection.send({ type: 'suivre', id }));
    const queue: Action[] = [];
    const waiting: ((action: Action) => void)[] = [];
    const endListeners: ((winner: PlayerId | null, reason: EndReason) => void)[] = [];
    const opponentListeners: ((online: boolean) => void)[] = [];
    let readLocal: (() => GameState) | null = null;
    let started = false;

    const deliver = (action: Action) => {
      const resolveNext = waiting.shift();
      if (resolveNext) resolveNext(action);
      else queue.push(action);
    };

    connection.on((message: ServerMessage) => {
      if ('id' in message && message.id !== undefined && message.id !== id) return;
      switch (message.type) {
        case 'partie': {
          if (!started) {
            started = true;
            const session: RemoteSession = {
              me: message.me,
              seats: message.seats,
              send: (actions) => connection.send({ type: 'actions', id, actions }),
              next: () =>
                new Promise((resolveNext) => {
                  const ready = queue.shift();
                  if (ready) resolveNext(ready);
                  else waiting.push(resolveNext);
                }),
              resign: () => connection.send({ type: 'abandonner', id }),
              onEnd: (listener) => endListeners.push(listener),
              onOpponent: (listener) => opponentListeners.push(listener),
              bindLocalState: (read) => (readLocal = read),
            };
            resolve({ state: message.state, session, opponentOnline: message.opponentOnline });
            return;
          }
          // Reconnexion : si l'écran a pris du retard ou diverge, on repart de l'état officiel.
          const local = readLocal?.();
          if (
            local &&
            JSON.stringify(local) !== JSON.stringify(message.state) &&
            queue.length === 0
          ) {
            window.location.reload();
          }
          return;
        }
        case 'actions':
          for (const action of message.actions) deliver(action);
          return;
        case 'adversaire':
          for (const listener of opponentListeners) listener(message.online);
          return;
        case 'fin':
          for (const listener of endListeners) listener(message.winner, message.reason);
          return;
        case 'erreur':
          if (!started) reject(new Error(message.message));
          else console.warn(`[en ligne] ${message.message}`);
          return;
        default:
          return;
      }
    });
  });
}
