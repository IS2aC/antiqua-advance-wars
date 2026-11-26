import type { Action, GameState, PlayerId } from '@antiqua/engine';

/**
 * Jeu en ligne : messages échangés sur le WebSocket `/api/jeu` entre le jeu
 * (`apps/game/src/online/`) et le serveur (`apps/server/src/online.ts`). Le serveur garde
 * l'état officiel de chaque partie, valide chaque action avec le moteur et joue les camps de
 * l'IA ; les navigateurs rejouent les actions reçues (le moteur est déterministe).
 *
 * Deux sortes de parties :
 * - duel (J1 contre J2) : en attente d'un adversaire, commence quand il rejoint ;
 * - JN (Carrefour, 4 camps) : commence tout de suite, J1 contre 3 IA ; un autre joueur
 *   demande à prendre la place d'une IA, J1 accepte ou refuse.
 */

/** Cartes jouables en ligne. */
export const ONLINE_MAPS = ['gue-du-nil', 'cote', 'carrefour'] as const;
export type OnlineMapId = (typeof ONLINE_MAPS)[number];

/** Carte des parties JN (4 camps). */
export const JN_MAP: OnlineMapId = 'carrefour';

export type OnlineKind = 'duel' | 'jn';
export const kindOfMap = (map: OnlineMapId): OnlineKind => (map === JN_MAP ? 'jn' : 'duel');

/**
 * Dès que deux joueurs humains jouent, chacun a ce temps pour commencer son tour (première
 * action) ; sinon le serveur passe son tour.
 */
export const TURN_TIME_MS = 210_000;

export type OnlineStatus = 'attente' | 'en-cours' | 'finie';

export interface OnlineSeat {
  readonly pseudo: string;
  readonly people: PlayerId;
  /** Camp joué par l'IA du serveur (JN). */
  readonly cpu: boolean;
}

/** Demande d'un joueur pour prendre la place d'une IA (JN), en attente de la réponse de J1. */
export interface SeatRequest {
  readonly id: string;
  readonly pseudo: string;
  readonly people: PlayerId;
}

/** Résumé d'une partie, pour les listes du salon. */
export interface OnlineSummary {
  readonly id: string;
  readonly map: OnlineMapId;
  readonly kind: OnlineKind;
  readonly status: OnlineStatus;
  readonly seats: readonly OnlineSeat[];
  /** Peuple de celui qui reçoit la liste, s'il joue dans cette partie. */
  readonly me: PlayerId | null;
  /** Peuple qui doit jouer (partie en cours). */
  readonly turn: PlayerId | null;
  /** JN : demandes en attente (seulement pour J1, qui y répond). */
  readonly requests: readonly SeatRequest[];
  /** JN : place demandée par celui qui reçoit la liste, en attente de réponse. */
  readonly requested: PlayerId | null;
}

/** Minuteur du tour en cours : `remainingMs` null quand il n'y en a pas (ou plus). */
export interface TurnTimer {
  readonly player: PlayerId;
  readonly remainingMs: number | null;
}

export type ClientMessage =
  | { readonly type: 'salons' }
  /** Duel : partie en attente ; JN (carte Carrefour) : partie commencée contre 3 IA. */
  | { readonly type: 'creer'; readonly map: OnlineMapId; readonly people: PlayerId }
  | { readonly type: 'annuler'; readonly id: string }
  | { readonly type: 'rejoindre'; readonly id: string; readonly people: PlayerId }
  /** JN : demander la place de l'IA qui joue `people`. */
  | { readonly type: 'demander'; readonly id: string; readonly people: PlayerId }
  /** JN : réponse de J1 à une demande. */
  | {
      readonly type: 'repondre';
      readonly id: string;
      readonly request: string;
      readonly accept: boolean;
    }
  | { readonly type: 'suivre'; readonly id: string }
  /** Actions déjà validées sur l'écran du joueur (un MOVE part avec l'action qui suit). */
  | { readonly type: 'actions'; readonly id: string; readonly actions: readonly Action[] }
  /** L'écran du joueur est arrivé à son tour (les tours précédents sont rejoués). */
  | { readonly type: 'pret'; readonly id: string }
  /** Le joueur a commencé son tour (premier déplacement) : le minuteur s'arrête. */
  | { readonly type: 'actif'; readonly id: string }
  | { readonly type: 'abandonner'; readonly id: string };

export type EndReason = 'victoire' | 'abandon';

export type ServerMessage =
  | {
      readonly type: 'salons';
      /** Duels en attente d'un adversaire, et parties JN avec des places d'IA à prendre. */
      readonly open: readonly OnlineSummary[];
      /** Parties du joueur (en attente ou en cours). */
      readonly mine: readonly OnlineSummary[];
    }
  | { readonly type: 'creee'; readonly id: string }
  /** La partie commence (ou une place est accordée) : aller sur `jeu.html?mode=enligne…`. */
  | { readonly type: 'commencee'; readonly id: string }
  | {
      readonly type: 'partie';
      readonly id: string;
      readonly state: GameState;
      readonly me: PlayerId;
      readonly seats: readonly OnlineSeat[];
      /** Camps humains dont le joueur a la partie ouverte. */
      readonly online: readonly PlayerId[];
      readonly requests: readonly SeatRequest[];
      readonly timer: TurnTimer | null;
    }
  /** Actions des autres camps (joueurs ou IA), à rejouer dans l'ordre. */
  | { readonly type: 'actions'; readonly id: string; readonly actions: readonly Action[] }
  /** Un camp change de mains (IA remplacée par un joueur, ou l'inverse). */
  | { readonly type: 'places'; readonly id: string; readonly seats: readonly OnlineSeat[] }
  /** JN : demandes en attente, envoyées à J1. */
  | { readonly type: 'demandes'; readonly id: string; readonly requests: readonly SeatRequest[] }
  | { readonly type: 'minuteur'; readonly id: string; readonly timer: TurnTimer | null }
  /** Temps écoulé : le serveur a passé le tour de `player` (fin de tour à rejouer). */
  | { readonly type: 'tour-passe'; readonly id: string; readonly player: PlayerId }
  | {
      readonly type: 'adversaire';
      readonly id: string;
      readonly people: PlayerId;
      readonly online: boolean;
    }
  | {
      readonly type: 'fin';
      readonly id: string;
      readonly winner: PlayerId | null;
      readonly reason: EndReason;
    }
  | { readonly type: 'erreur'; readonly message: string; readonly id?: string };
