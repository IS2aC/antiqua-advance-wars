import type { Action, GameState, PlayerId } from '@antiqua/engine';

/**
 * Jeu en ligne (J1 contre J2) : messages échangés sur le WebSocket `/api/jeu` entre le
 * jeu (`apps/game/src/online/`) et le serveur (`apps/server/src/online.ts`). Le serveur
 * garde l'état officiel de chaque partie et valide chaque action avec le moteur ; les
 * navigateurs rejouent les actions reçues (le moteur est déterministe).
 */

/** Cartes jouables en ligne (duels). */
export const ONLINE_MAPS = ['gue-du-nil', 'cote'] as const;
export type OnlineMapId = (typeof ONLINE_MAPS)[number];

export type OnlineStatus = 'attente' | 'en-cours' | 'finie';

export interface OnlineSeat {
  readonly pseudo: string;
  readonly people: PlayerId;
}

/** Résumé d'une partie, pour les listes du salon. */
export interface OnlineSummary {
  readonly id: string;
  readonly map: OnlineMapId;
  readonly status: OnlineStatus;
  readonly seats: readonly OnlineSeat[];
  /** Peuple de celui qui reçoit la liste, s'il joue dans cette partie. */
  readonly me: PlayerId | null;
  /** Peuple qui doit jouer (partie en cours). */
  readonly turn: PlayerId | null;
}

export type ClientMessage =
  | { readonly type: 'salons' }
  | { readonly type: 'creer'; readonly map: OnlineMapId; readonly people: PlayerId }
  | { readonly type: 'annuler'; readonly id: string }
  | { readonly type: 'rejoindre'; readonly id: string; readonly people: PlayerId }
  | { readonly type: 'suivre'; readonly id: string }
  /** Actions déjà validées sur l'écran du joueur (un MOVE part avec l'action qui suit). */
  | { readonly type: 'actions'; readonly id: string; readonly actions: readonly Action[] }
  | { readonly type: 'abandonner'; readonly id: string };

export type EndReason = 'victoire' | 'abandon';

export type ServerMessage =
  | {
      readonly type: 'salons';
      /** Parties en attente d'un adversaire, créées par d'autres joueurs. */
      readonly open: readonly OnlineSummary[];
      /** Parties du joueur (en attente ou en cours). */
      readonly mine: readonly OnlineSummary[];
    }
  | { readonly type: 'creee'; readonly id: string }
  /** La partie commence : les deux joueurs vont sur `jeu.html?mode=enligne&partie=…`. */
  | { readonly type: 'commencee'; readonly id: string }
  | {
      readonly type: 'partie';
      readonly id: string;
      readonly state: GameState;
      readonly me: PlayerId;
      readonly seats: readonly OnlineSeat[];
      readonly opponentOnline: boolean;
    }
  /** Actions de l'adversaire, à rejouer dans l'ordre. */
  | { readonly type: 'actions'; readonly id: string; readonly actions: readonly Action[] }
  | { readonly type: 'adversaire'; readonly id: string; readonly online: boolean }
  | {
      readonly type: 'fin';
      readonly id: string;
      readonly winner: PlayerId | null;
      readonly reason: EndReason;
    }
  | { readonly type: 'erreur'; readonly message: string; readonly id?: string };
