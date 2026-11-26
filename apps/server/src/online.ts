import { randomUUID } from 'node:crypto';
import {
  COTE,
  FACTIONS,
  GUE_DU_NIL,
  applyAction,
  assignPeoples,
  createGame,
  type Action,
  type GameState,
  type MapDefinition,
  type PlayerId,
} from '@antiqua/engine';
import {
  ONLINE_MAPS,
  type ClientMessage,
  type OnlineMapId,
  type OnlineStatus,
  type OnlineSummary,
  type ServerMessage,
} from '@antiqua/protocol';
import type { Store } from './store';

/**
 * Jeu en ligne, J1 contre J2 : salons (créer, rejoindre, annuler) et parties. Le serveur
 * garde l'état officiel et valide chaque action avec le moteur, puis la transmet à
 * l'adversaire. Chaque partie est enregistrée après chaque coup (reprise après coupure ou
 * redémarrage du serveur).
 */

const MAP_DEFINITIONS: Readonly<Record<OnlineMapId, MapDefinition>> = {
  'gue-du-nil': GUE_DU_NIL,
  cote: COTE,
};

/** Actions acceptées en un seul message (un tour complet tient largement dedans). */
const MAX_ACTIONS_PER_MESSAGE = 8;

export interface Player {
  readonly id: string;
  readonly pseudo: string;
}

export interface OnlineSocket {
  send(data: string): void;
}

interface Seat {
  readonly userId: string;
  readonly pseudo: string;
  readonly people: PlayerId;
}

export interface OnlineGame {
  readonly id: string;
  readonly map: OnlineMapId;
  status: OnlineStatus;
  seats: Seat[];
  state: GameState | null;
  winner: PlayerId | null;
  /** Terminée par un abandon (sinon par la victoire du moteur). */
  resigned: boolean;
  readonly createdAt: number;
}

const isPeople = (value: unknown): value is PlayerId =>
  typeof value === 'string' && Object.hasOwn(FACTIONS, value);
const isMap = (value: unknown): value is OnlineMapId =>
  typeof value === 'string' && (ONLINE_MAPS as readonly string[]).includes(value);

export class OnlineHub {
  private readonly games = new Map<string, OnlineGame>();
  /** Joueur connecté derrière chaque socket. */
  private readonly sockets = new Map<OnlineSocket, Player>();
  /** Sockets qui suivent une partie (écran de jeu). */
  private readonly watchers = new Map<string, Set<OnlineSocket>>();

  constructor(private readonly store: Store) {}

  /** Recharge les parties non terminées (démarrage du serveur). */
  async restore(): Promise<void> {
    for (const data of await this.store.loadOnlineGames()) {
      const game = data as OnlineGame;
      if (game?.id && isMap(game.map)) this.games.set(game.id, game);
    }
  }

  connect(socket: OnlineSocket, player: Player): void {
    this.sockets.set(socket, player);
  }

  disconnect(socket: OnlineSocket): void {
    const player = this.sockets.get(socket);
    this.sockets.delete(socket);
    for (const [id, watching] of this.watchers) {
      if (!watching.delete(socket) || !player) continue;
      if (!this.isWatching(id, player.id)) this.notifyPresence(id, player.id, false);
    }
  }

  /** Message reçu d'un client connecté. */
  async handle(socket: OnlineSocket, raw: string): Promise<void> {
    const player = this.sockets.get(socket);
    if (!player) return;
    let message: ClientMessage;
    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      return this.send(socket, { type: 'erreur', message: 'Message illisible.' });
    }
    switch (message?.type) {
      case 'salons':
        return this.send(socket, this.lobbyFor(player));
      case 'creer':
        return this.create(socket, player, message.map, message.people);
      case 'annuler':
        return this.cancel(player, message.id);
      case 'rejoindre':
        return this.join(socket, player, message.id, message.people);
      case 'suivre':
        return this.watch(socket, player, message.id);
      case 'actions':
        return this.play(socket, player, message.id, message.actions);
      case 'abandonner':
        return this.resign(player, message.id);
      default:
        return this.send(socket, { type: 'erreur', message: 'Message inconnu.' });
    }
  }

  // ——— Salons ———

  private async create(
    socket: OnlineSocket,
    player: Player,
    map: unknown,
    people: unknown,
  ): Promise<void> {
    if (!isMap(map) || !isPeople(people)) {
      return this.send(socket, { type: 'erreur', message: 'Carte ou peuple inconnu.' });
    }
    // Une seule partie en attente par joueur : la nouvelle remplace l'ancienne.
    for (const game of this.games.values()) {
      if (game.status === 'attente' && game.seats[0]?.userId === player.id) {
        this.games.delete(game.id);
      }
    }
    const game: OnlineGame = {
      id: randomUUID(),
      map,
      status: 'attente',
      seats: [{ userId: player.id, pseudo: player.pseudo, people }],
      state: null,
      winner: null,
      resigned: false,
      createdAt: Date.now(),
    };
    this.games.set(game.id, game);
    this.send(socket, { type: 'creee', id: game.id });
    this.broadcastLobby();
  }

  private cancel(player: Player, id: string): void {
    const game = this.games.get(id);
    if (game?.status !== 'attente' || game.seats[0]?.userId !== player.id) return;
    this.games.delete(id);
    this.broadcastLobby();
  }

  private async join(
    socket: OnlineSocket,
    player: Player,
    id: string,
    people: unknown,
  ): Promise<void> {
    const game = this.games.get(id);
    const host = game?.seats[0];
    if (!game || game.status !== 'attente' || !host) {
      return this.send(socket, { type: 'erreur', message: 'Cette partie n’est plus ouverte.', id });
    }
    if (host.userId === player.id) {
      return this.send(socket, { type: 'erreur', message: 'Tu ne peux pas te rejoindre.', id });
    }
    if (!isPeople(people) || people === host.people) {
      return this.send(socket, {
        type: 'erreur',
        message: 'Choisis un autre peuple que celui de ton adversaire.',
        id,
      });
    }
    game.seats = [host, { userId: player.id, pseudo: player.pseudo, people }];
    game.state = createGame(assignPeoples(MAP_DEFINITIONS[game.map], [host.people, people]), {
      seed: Math.floor(Math.random() * 2 ** 31),
    });
    game.status = 'en-cours';
    await this.save(game);
    // Les deux joueurs passent à l'écran de jeu.
    for (const [other, who] of this.sockets) {
      if (who.id === host.userId || who.id === player.id) {
        this.send(other, { type: 'commencee', id });
      }
    }
    this.broadcastLobby();
  }

  // ——— Partie ———

  private watch(socket: OnlineSocket, player: Player, id: string): void {
    const game = this.games.get(id);
    const seat = game?.seats.find((s) => s.userId === player.id);
    if (!game || !seat || !game.state) {
      return this.send(socket, { type: 'erreur', message: 'Partie introuvable.', id });
    }
    const wasWatching = this.isWatching(id, player.id);
    const watching = this.watchers.get(id) ?? new Set();
    watching.add(socket);
    this.watchers.set(id, watching);
    const opponent = game.seats.find((s) => s.userId !== player.id);
    this.send(socket, {
      type: 'partie',
      id,
      state: game.state,
      me: seat.people,
      seats: game.seats.map(({ pseudo, people }) => ({ pseudo, people })),
      opponentOnline: opponent ? this.isWatching(id, opponent.userId) : false,
    });
    if (game.status === 'finie') {
      this.send(socket, { type: 'fin', id, winner: game.winner, reason: this.reasonOf(game) });
    }
    if (!wasWatching) this.notifyPresence(id, player.id, true);
  }

  private async play(
    socket: OnlineSocket,
    player: Player,
    id: string,
    actions: unknown,
  ): Promise<void> {
    const game = this.games.get(id);
    const seat = game?.seats.find((s) => s.userId === player.id);
    if (!game || !seat || !game.state || game.status !== 'en-cours') {
      return this.send(socket, { type: 'erreur', message: 'Partie terminée ou introuvable.', id });
    }
    if (
      !Array.isArray(actions) ||
      actions.length === 0 ||
      actions.length > MAX_ACTIONS_PER_MESSAGE
    ) {
      return this.send(socket, { type: 'erreur', message: 'Actions invalides.', id });
    }
    let state = game.state;
    for (const action of actions as Action[]) {
      // Chaque action doit venir du camp qui a la main, et passer le moteur.
      const result =
        state.status === 'playing' && state.currentPlayer === seat.people
          ? applyAction(state, action)
          : null;
      if (!result?.ok) {
        // Désaccord avec l'écran du joueur : on lui renvoie l'état officiel.
        this.send(socket, { type: 'erreur', message: 'Action refusée par le serveur.', id });
        return this.watch(socket, player, id);
      }
      state = result.state;
    }
    game.state = state;
    if (state.status === 'finished') {
      game.status = 'finie';
      game.winner = state.winner;
    }
    await this.save(game);
    for (const other of this.watchers.get(id) ?? []) {
      if (other !== socket) this.send(other, { type: 'actions', id, actions: actions as Action[] });
    }
    if (game.status === 'finie') this.broadcastLobby();
  }

  private async resign(player: Player, id: string): Promise<void> {
    const game = this.games.get(id);
    const seat = game?.seats.find((s) => s.userId === player.id);
    if (!game || !seat || game.status !== 'en-cours') return;
    game.status = 'finie';
    game.winner = game.seats.find((s) => s.userId !== player.id)?.people ?? null;
    game.resigned = true;
    await this.save(game);
    for (const socket of this.watchers.get(id) ?? []) {
      this.send(socket, { type: 'fin', id, winner: game.winner, reason: 'abandon' });
    }
    this.broadcastLobby();
  }

  // ——— Outils ———

  private reasonOf(game: OnlineGame): 'victoire' | 'abandon' {
    return game.resigned ? 'abandon' : 'victoire';
  }

  private isWatching(id: string, userId: string): boolean {
    return [...(this.watchers.get(id) ?? [])].some((s) => this.sockets.get(s)?.id === userId);
  }

  private notifyPresence(id: string, userId: string, online: boolean): void {
    for (const socket of this.watchers.get(id) ?? []) {
      if (this.sockets.get(socket)?.id !== userId) {
        this.send(socket, { type: 'adversaire', id, online });
      }
    }
  }

  private summary(game: OnlineGame, userId: string): OnlineSummary {
    return {
      id: game.id,
      map: game.map,
      status: game.status,
      seats: game.seats.map(({ pseudo, people }) => ({ pseudo, people })),
      me: game.seats.find((s) => s.userId === userId)?.people ?? null,
      turn: game.status === 'en-cours' ? (game.state?.currentPlayer ?? null) : null,
    };
  }

  lobbyFor(player: Player): ServerMessage {
    const games = [...this.games.values()].sort((a, b) => b.createdAt - a.createdAt);
    return {
      type: 'salons',
      open: games
        .filter((g) => g.status === 'attente' && g.seats[0]?.userId !== player.id)
        .map((g) => this.summary(g, player.id)),
      mine: games
        .filter((g) => g.status !== 'finie' && g.seats.some((s) => s.userId === player.id))
        .map((g) => this.summary(g, player.id)),
    };
  }

  private broadcastLobby(): void {
    for (const [socket, player] of this.sockets) this.send(socket, this.lobbyFor(player));
  }

  private async save(game: OnlineGame): Promise<void> {
    // Une partie finie reste en mémoire jusqu'au redémarrage : l'écran de fin peut encore
    // la recharger ; elle n'est plus rechargée depuis la base.
    await this.store.saveOnlineGame({ id: game.id, finished: game.status === 'finie', data: game });
  }

  private send(socket: OnlineSocket, message: ServerMessage): void {
    socket.send(JSON.stringify(message));
  }
}
