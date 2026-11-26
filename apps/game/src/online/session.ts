import type { Action, GameState, PlayerId } from '@antiqua/engine';
import type {
  EndReason,
  OnlineSeat,
  SeatRequest,
  ServerMessage,
  TurnTimer,
} from '@antiqua/protocol';
import { OnlineConnection } from './connection';

/** Minuteur reçu du serveur, recalé sur l'horloge locale (`deadline` en ms, `Date.now()`). */
export interface LocalTimer {
  readonly player: PlayerId;
  readonly deadline: number;
}

/**
 * Ce dont le contrôleur de bataille et l'écran de jeu ont besoin pour une partie en ligne :
 * envoyer ses propres actions, recevoir celles des autres camps (joueurs ou IA du serveur),
 * abandonner, suivre les places, les demandes (JN), le minuteur et la fin de partie.
 */
export interface RemoteSession {
  /** Camp joué sur cet écran. */
  readonly me: PlayerId;
  /** Places de la partie (une IA peut être remplacée par un joueur en cours de partie). */
  readonly seats: readonly OnlineSeat[];
  /** Camps humains qui ont la partie ouverte. */
  readonly online: ReadonlySet<PlayerId>;
  readonly timer: LocalTimer | null;
  readonly requests: readonly SeatRequest[];
  /** Actions validées sur cet écran (un MOVE part avec l'action qui le suit). */
  send(actions: readonly Action[]): void;
  /** Prochaine action d'un autre camp (attend qu'elle arrive). */
  next(): Promise<Action>;
  /** L'écran est arrivé au tour du joueur (le serveur relance son minuteur). */
  ready(): void;
  /** Le joueur a commencé son tour (le minuteur s'arrête). */
  active(): void;
  resign(): void;
  /** JN : réponse de J1 à une demande de place. */
  answer(request: string, accept: boolean): void;
  /** Fin décidée par le serveur (abandon). */
  onEnd(listener: (winner: PlayerId | null, reason: EndReason) => void): void;
  /** Places, présence, minuteur ou demandes ont changé. */
  onChange(listener: () => void): void;
  /** Temps écoulé : le serveur a passé le tour de `player`. */
  onTurnSkipped(listener: (player: PlayerId) => void): void;
  /** État courant de l'écran, pour détecter un désaccord avec le serveur. */
  bindLocalState(read: () => GameState): void;
}

export interface OnlineStart {
  readonly state: GameState;
  readonly session: RemoteSession;
}

const localTimer = (timer: TurnTimer | null): LocalTimer | null =>
  timer && timer.remainingMs !== null
    ? { player: timer.player, deadline: Date.now() + timer.remainingMs }
    : null;

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
    const changeListeners: (() => void)[] = [];
    const skipListeners: ((player: PlayerId) => void)[] = [];
    let readLocal: (() => GameState) | null = null;
    let started = false;
    let seats: readonly OnlineSeat[] = [];
    let online = new Set<PlayerId>();
    let timer: LocalTimer | null = null;
    let requests: readonly SeatRequest[] = [];

    const deliver = (action: Action) => {
      const resolveNext = waiting.shift();
      if (resolveNext) resolveNext(action);
      else queue.push(action);
    };
    const changed = () => {
      for (const listener of changeListeners) listener();
    };

    connection.on((message: ServerMessage) => {
      if ('id' in message && message.id !== undefined && message.id !== id) return;
      switch (message.type) {
        case 'partie': {
          seats = message.seats;
          online = new Set(message.online);
          timer = localTimer(message.timer);
          requests = message.requests;
          if (!started) {
            started = true;
            const session: RemoteSession = {
              me: message.me,
              get seats() {
                return seats;
              },
              get online() {
                return online;
              },
              get timer() {
                return timer;
              },
              get requests() {
                return requests;
              },
              send: (actions) => connection.send({ type: 'actions', id, actions }),
              next: () =>
                new Promise((resolveNext) => {
                  const ready = queue.shift();
                  if (ready) resolveNext(ready);
                  else waiting.push(resolveNext);
                }),
              ready: () => connection.send({ type: 'pret', id }),
              active: () => connection.send({ type: 'actif', id }),
              resign: () => connection.send({ type: 'abandonner', id }),
              answer: (request, accept) =>
                connection.send({ type: 'repondre', id, request, accept }),
              onEnd: (listener) => endListeners.push(listener),
              onChange: (listener) => changeListeners.push(listener),
              onTurnSkipped: (listener) => skipListeners.push(listener),
              bindLocalState: (read) => (readLocal = read),
            };
            resolve({ state: message.state, session });
            return;
          }
          changed();
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
        case 'places':
          seats = message.seats;
          return changed();
        case 'demandes':
          requests = message.requests;
          return changed();
        case 'minuteur':
          timer = localTimer(message.timer);
          return changed();
        case 'tour-passe':
          for (const listener of skipListeners) listener(message.player);
          return;
        case 'adversaire':
          if (message.online) online.add(message.people);
          else online.delete(message.people);
          return changed();
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
