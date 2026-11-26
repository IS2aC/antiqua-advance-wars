import { randomUUID } from 'node:crypto';
import {
  CARREFOUR,
  COTE,
  FACTIONS,
  GUE_DU_NIL,
  applyAction,
  assignPeoples,
  createGame,
  planTurn,
  type Action,
  type GameState,
  type MapDefinition,
  type PlayerId,
} from '@antiqua/engine';
import {
  ONLINE_MAPS,
  TURN_TIME_MS,
  kindOfMap,
  type ClientMessage,
  type OnlineMapId,
  type OnlineSeat,
  type OnlineStatus,
  type OnlineSummary,
  type SeatRequest,
  type ServerMessage,
  type TurnTimer,
} from '@antiqua/protocol';
import type { Store } from './store';

/**
 * Jeu en ligne : salons et parties.
 * - Duel (J1 contre J2) : créé en attente, commence quand un adversaire rejoint.
 * - JN (Carrefour, 4 camps) : commence tout de suite, J1 contre 3 IA jouées ici ; un autre
 *   joueur demande la place d'une IA, J1 (le premier joueur humain encore en jeu) accepte
 *   ou refuse. Un joueur qui abandonne rend sa place à l'IA.
 * Le serveur garde l'état officiel, valide chaque action avec le moteur, joue l'IA et
 * transmet le tout aux autres joueurs. Dès que deux humains jouent, chacun a
 * `TURN_TIME_MS` pour commencer son tour, sinon le serveur le passe. Chaque partie est
 * enregistrée après chaque coup (reprise après coupure ou redémarrage du serveur).
 */

const MAP_DEFINITIONS: Readonly<Record<OnlineMapId, MapDefinition>> = {
  'gue-du-nil': GUE_DU_NIL,
  cote: COTE,
  carrefour: CARREFOUR,
};

/** Actions acceptées en un seul message (un tour complet tient largement dedans). */
const MAX_ACTIONS_PER_MESSAGE = 8;

/** Tours d'IA joués d'affilée au plus (sécurité : la main revient vite à un humain). */
const MAX_CPU_TURNS = 12;

const CPU_PSEUDO = 'IA';

export interface Player {
  readonly id: string;
  readonly pseudo: string;
}

export interface OnlineSocket {
  send(data: string): void;
}

interface Seat {
  readonly userId: string | null;
  readonly pseudo: string;
  readonly people: PlayerId;
  readonly cpu: boolean;
}

interface PendingRequest extends SeatRequest {
  readonly userId: string;
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
  /** JN : demandes de place en attente de la réponse de J1. */
  requests: PendingRequest[];
  readonly createdAt: number;
}

/** Minuteur du tour en cours d'une partie (`key` : jour et camp). */
interface Clock {
  readonly key: string;
  readonly player: PlayerId;
  handle: ReturnType<typeof setTimeout> | null;
  deadline: number;
  /** L'écran du joueur a signalé qu'il était arrivé à son tour (minuteur relancé une fois). */
  ready: boolean;
  /** Le joueur a commencé son tour : plus de minuteur jusqu'au tour suivant. */
  started: boolean;
}

const isPeople = (value: unknown): value is PlayerId =>
  typeof value === 'string' && Object.hasOwn(FACTIONS, value);
const isMap = (value: unknown): value is OnlineMapId =>
  typeof value === 'string' && (ONLINE_MAPS as readonly string[]).includes(value);
const turnKey = (state: GameState) => `${state.day}:${state.currentPlayer}`;
const cpuSeat = (people: PlayerId): Seat => ({
  userId: null,
  pseudo: CPU_PSEUDO,
  people,
  cpu: true,
});
const publicSeat = ({ pseudo, people, cpu }: Seat): OnlineSeat => ({ pseudo, people, cpu });
const publicRequest = ({ id, pseudo, people }: PendingRequest): SeatRequest => ({
  id,
  pseudo,
  people,
});

export class OnlineHub {
  private readonly games = new Map<string, OnlineGame>();
  /** Joueur connecté derrière chaque socket. */
  private readonly sockets = new Map<OnlineSocket, Player>();
  /** Sockets qui suivent une partie (écran de jeu). */
  private readonly watchers = new Map<string, Set<OnlineSocket>>();
  private readonly clocks = new Map<string, Clock>();

  constructor(private readonly store: Store) {}

  /** Recharge les parties non terminées (démarrage du serveur). */
  async restore(): Promise<void> {
    for (const data of await this.store.loadOnlineGames()) {
      const game = data as OnlineGame;
      if (!game?.id || !isMap(game.map)) continue;
      // Parties enregistrées avant JN : pas d'IA, pas de demandes.
      game.seats = game.seats.map((seat) => ({ ...seat, cpu: seat.cpu ?? false }));
      game.requests = [];
      this.games.set(game.id, game);
      this.refreshClock(game);
    }
  }

  /** Arrêt du serveur : plus de minuteurs en cours. */
  close(): void {
    for (const clock of this.clocks.values()) if (clock.handle) clearTimeout(clock.handle);
    this.clocks.clear();
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
      case 'demander':
        return this.request(socket, player, message.id, message.people);
      case 'repondre':
        return this.answer(player, message.id, message.request, message.accept === true);
      case 'suivre':
        return this.watch(socket, player, message.id);
      case 'actions':
        return this.play(socket, player, message.id, message.actions);
      case 'pret':
        return this.ready(player, message.id);
      case 'actif':
        return this.active(player, message.id);
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
    const me: Seat = { userId: player.id, pseudo: player.pseudo, people, cpu: false };
    const game: OnlineGame = {
      id: randomUUID(),
      map,
      status: 'attente',
      seats: [me],
      state: null,
      winner: null,
      resigned: false,
      requests: [],
      createdAt: Date.now(),
    };
    if (kindOfMap(map) === 'jn') {
      // JN : la partie commence tout de suite, les autres camps sont joués par l'IA. Le
      // joueur garde son camp s'il est sur la carte, sinon il prend le premier.
      const players = MAP_DEFINITIONS[map].players;
      const peoples = players.includes(people) ? [...players] : [people, ...players.slice(1)];
      game.seats = peoples.map((p) => (p === people ? me : cpuSeat(p)));
      game.state = createGame(assignPeoples(MAP_DEFINITIONS[map], peoples), {
        seed: Math.floor(Math.random() * 2 ** 31),
      });
      game.status = 'en-cours';
      this.games.set(game.id, game);
      this.runCpu(game);
      this.refreshClock(game);
      await this.save(game);
      this.send(socket, { type: 'creee', id: game.id });
      this.send(socket, { type: 'commencee', id: game.id });
      return this.broadcastLobby();
    }
    // Duel : une seule partie en attente par joueur, la nouvelle remplace l'ancienne.
    for (const other of this.games.values()) {
      if (other.status === 'attente' && other.seats[0]?.userId === player.id) {
        this.games.delete(other.id);
      }
    }
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
    game.seats = [host, { userId: player.id, pseudo: player.pseudo, people, cpu: false }];
    game.state = createGame(assignPeoples(MAP_DEFINITIONS[game.map], [host.people, people]), {
      seed: Math.floor(Math.random() * 2 ** 31),
    });
    game.status = 'en-cours';
    this.refreshClock(game);
    await this.save(game);
    // Les deux joueurs passent à l'écran de jeu.
    this.sendToUser(host.userId, { type: 'commencee', id });
    this.sendToUser(player.id, { type: 'commencee', id });
    this.broadcastLobby();
  }

  /** JN : demander la place de l'IA qui joue `people`. */
  private request(socket: OnlineSocket, player: Player, id: string, people: unknown): void {
    const game = this.games.get(id);
    if (!game || game.status !== 'en-cours' || kindOfMap(game.map) !== 'jn') {
      return this.send(socket, { type: 'erreur', message: 'Cette partie n’est plus ouverte.', id });
    }
    if (game.seats.some((seat) => seat.userId === player.id)) {
      return this.send(socket, { type: 'erreur', message: 'Tu joues déjà dans cette partie.', id });
    }
    if (!isPeople(people) || !this.freeCpuSeats(game).some((seat) => seat.people === people)) {
      return this.send(socket, { type: 'erreur', message: 'Cette place n’est plus libre.', id });
    }
    // Une demande par joueur et par partie : la nouvelle remplace l'ancienne.
    game.requests = [
      ...game.requests.filter((r) => r.userId !== player.id),
      { id: randomUUID(), userId: player.id, pseudo: player.pseudo, people },
    ];
    this.notifyRequests(game);
    this.broadcastLobby();
  }

  /** JN : J1 accepte ou refuse une demande. */
  private async answer(player: Player, id: string, requestId: unknown, accept: boolean) {
    const game = this.games.get(id);
    if (!game || this.hostOf(game)?.userId !== player.id) return;
    const request = game.requests.find((r) => r.id === requestId);
    if (!request) return;
    game.requests = game.requests.filter((r) => r !== request);
    const index = game.seats.findIndex((seat) => seat.people === request.people);
    const free =
      game.status === 'en-cours' &&
      this.freeCpuSeats(game).some((seat) => seat.people === request.people) &&
      !game.seats.some((seat) => seat.userId === request.userId);
    if (!accept || !free || index < 0) {
      this.sendToUser(request.userId, {
        type: 'erreur',
        message: accept ? 'Cette place n’est plus libre.' : `${player.pseudo} a refusé ta demande.`,
        id,
      });
    } else {
      game.seats[index] = {
        userId: request.userId,
        pseudo: request.pseudo,
        people: request.people,
        cpu: false,
      };
      // Les autres demandes pour cette place, ou de ce joueur, n'ont plus d'objet.
      game.requests = game.requests.filter(
        (r) => r.people !== request.people && r.userId !== request.userId,
      );
      await this.save(game);
      this.broadcastSeats(game);
      this.refreshClock(game, true);
      this.sendToUser(request.userId, { type: 'commencee', id });
    }
    this.notifyRequests(game);
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
    this.send(socket, {
      type: 'partie',
      id,
      state: game.state,
      me: seat.people,
      seats: game.seats.map(publicSeat),
      online: game.seats
        .filter((s) => !s.cpu && s.userId !== null && this.isWatching(id, s.userId))
        .map((s) => s.people),
      requests: this.hostOf(game)?.userId === player.id ? game.requests.map(publicRequest) : [],
      timer: this.timerOf(game),
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
    this.stopClock(game.id, true);
    game.state = state;
    await this.commit(game, actions as Action[], (other) => other === socket);
  }

  /** L'écran du joueur est arrivé à son tour : son minuteur repart de zéro (une fois). */
  private ready(player: Player, id: string): void {
    const game = this.games.get(id);
    const clock = this.clocks.get(id);
    if (!game?.state || !clock?.handle || clock.ready) return;
    if (clock.key !== turnKey(game.state) || !this.isCurrent(game, player.id)) return;
    clock.ready = true;
    this.schedule(game, clock);
  }

  /** Le joueur a commencé son tour : le minuteur s'arrête. */
  private active(player: Player, id: string): void {
    const game = this.games.get(id);
    if (game?.state && this.isCurrent(game, player.id)) this.stopClock(id, true);
  }

  private async resign(player: Player, id: string): Promise<void> {
    const game = this.games.get(id);
    const index = game?.seats.findIndex((s) => s.userId === player.id) ?? -1;
    const seat = game?.seats[index];
    if (!game || !seat || game.status !== 'en-cours') return;
    if (kindOfMap(game.map) === 'jn') {
      // JN : l'IA reprend son camp ; la partie continue pour les autres.
      game.seats[index] = cpuSeat(seat.people);
      game.requests = game.requests.filter((r) => r.userId !== player.id);
      for (const socket of this.watchers.get(id) ?? []) {
        if (this.sockets.get(socket)?.id !== player.id) continue;
        this.send(socket, { type: 'fin', id, winner: null, reason: 'abandon' });
        this.watchers.get(id)?.delete(socket);
      }
      this.broadcastSeats(game);
      await this.commit(game, [], () => false);
      this.notifyRequests(game);
      return;
    }
    game.status = 'finie';
    game.winner = game.seats.find((s) => s.userId !== player.id)?.people ?? null;
    game.resigned = true;
    this.stopClock(id);
    await this.save(game);
    for (const socket of this.watchers.get(id) ?? []) {
      this.send(socket, { type: 'fin', id, winner: game.winner, reason: 'abandon' });
    }
    this.broadcastLobby();
  }

  /**
   * Après un changement d'état : transmet les actions (sauf aux sockets `skip`), fait
   * jouer l'IA, termine la partie s'il le faut, enregistre et relance le minuteur.
   */
  private async commit(
    game: OnlineGame,
    actions: readonly Action[],
    skip: (socket: OnlineSocket) => boolean,
  ): Promise<void> {
    if (actions.length > 0) {
      for (const other of this.watchers.get(game.id) ?? []) {
        if (!skip(other)) this.send(other, { type: 'actions', id: game.id, actions });
      }
    }
    const cpu = this.runCpu(game);
    if (cpu.length > 0) {
      for (const other of this.watchers.get(game.id) ?? []) {
        this.send(other, { type: 'actions', id: game.id, actions: cpu });
      }
    }
    const state = game.state;
    // Fin : victoire au moteur, ou (JN) plus aucun joueur humain en jeu.
    if (state?.status === 'finished') {
      game.status = 'finie';
      game.winner = state.winner;
    } else if (state && this.livingHumans(game).length === 0) {
      game.status = 'finie';
      game.winner = null;
    }
    this.refreshClock(game);
    await this.save(game);
    if (game.status === 'finie') this.broadcastLobby();
  }

  /** Joue les tours de l'IA tant qu'elle a la main ; renvoie les actions jouées. */
  private runCpu(game: OnlineGame): Action[] {
    const played: Action[] = [];
    for (let turn = 0; turn < MAX_CPU_TURNS; turn++) {
      const state = game.state;
      if (!state || state.status !== 'playing' || !this.isCpuTurn(game)) break;
      if (this.livingHumans(game).length === 0) break;
      let plan: Action[];
      try {
        plan = planTurn(state);
      } catch {
        plan = [{ type: 'END_TURN' }];
      }
      const key = turnKey(state);
      for (const action of plan) {
        const result = game.state ? applyAction(game.state, action) : null;
        if (!result?.ok) break;
        game.state = result.state;
        played.push(action);
      }
      // Plan interrompu : on passe le tour, pour ne jamais bloquer la partie.
      if (game.state && game.state.status === 'playing' && turnKey(game.state) === key) {
        const result = applyAction(game.state, { type: 'END_TURN' });
        if (!result.ok) break;
        game.state = result.state;
        played.push({ type: 'END_TURN' });
      }
    }
    return played;
  }

  // ——— Minuteur ———

  /**
   * Nouveau tour : minuteur pour le joueur qui a la main, s'il est humain et qu'au moins deux
   * humains jouent. `force` : le nombre de joueurs a changé pendant le tour (place accordée).
   */
  private refreshClock(game: OnlineGame, force = false): void {
    const state = game.state;
    const current = this.clocks.get(game.id);
    if (!state || game.status !== 'en-cours') {
      if (current) this.stopClock(game.id);
      return;
    }
    const key = turnKey(state);
    if (current?.key === key && !(force && !current.handle && !current.started)) return;
    if (current?.handle) clearTimeout(current.handle);
    const seat = game.seats.find((s) => s.people === state.currentPlayer);
    const clock: Clock = {
      key,
      player: state.currentPlayer,
      handle: null,
      deadline: 0,
      ready: false,
      started: false,
    };
    this.clocks.set(game.id, clock);
    if (!seat || seat.cpu || game.seats.filter((s) => !s.cpu).length < 2) {
      if (current?.handle) this.broadcastTimer(game);
      return;
    }
    this.schedule(game, clock);
  }

  private schedule(game: OnlineGame, clock: Clock): void {
    if (clock.handle) clearTimeout(clock.handle);
    clock.deadline = Date.now() + TURN_TIME_MS;
    clock.handle = setTimeout(() => void this.expire(game.id, clock.key), TURN_TIME_MS);
    clock.handle.unref?.();
    this.broadcastTimer(game);
  }

  /** Arrête le minuteur ; `started` : le joueur a commencé son tour (pas de relance). */
  private stopClock(id: string, started = false): void {
    const clock = this.clocks.get(id);
    if (!clock) return;
    const wasRunning = clock.handle !== null;
    if (clock.handle) clearTimeout(clock.handle);
    clock.handle = null;
    if (started) clock.started = true;
    const game = this.games.get(id);
    if (wasRunning && game) this.broadcastTimer(game);
  }

  /** Temps écoulé : le serveur passe le tour du joueur. */
  private async expire(id: string, key: string): Promise<void> {
    const game = this.games.get(id);
    const clock = this.clocks.get(id);
    if (!game?.state || game.status !== 'en-cours' || clock?.key !== key || !clock.handle) return;
    if (turnKey(game.state) !== key) return;
    const result = applyAction(game.state, { type: 'END_TURN' });
    if (!result.ok) return;
    clock.handle = null;
    const player = game.state.currentPlayer;
    const owner = game.seats.find((s) => s.people === player)?.userId ?? null;
    game.state = result.state;
    const isOwner = (socket: OnlineSocket) => this.sockets.get(socket)?.id === owner;
    for (const socket of this.watchers.get(id) ?? []) {
      if (isOwner(socket)) this.send(socket, { type: 'tour-passe', id, player });
    }
    await this.commit(game, [{ type: 'END_TURN' }], isOwner);
  }

  private timerOf(game: OnlineGame): TurnTimer | null {
    const clock = this.clocks.get(game.id);
    if (!clock?.handle) return null;
    return { player: clock.player, remainingMs: Math.max(0, clock.deadline - Date.now()) };
  }

  private broadcastTimer(game: OnlineGame): void {
    const clock = this.clocks.get(game.id);
    const timer: TurnTimer | null = clock
      ? {
          player: clock.player,
          remainingMs: clock.handle ? Math.max(0, clock.deadline - Date.now()) : null,
        }
      : null;
    for (const socket of this.watchers.get(game.id) ?? []) {
      this.send(socket, { type: 'minuteur', id: game.id, timer });
    }
  }

  // ——— Outils ———

  private reasonOf(game: OnlineGame): 'victoire' | 'abandon' {
    return game.resigned ? 'abandon' : 'victoire';
  }

  private isDefeated(game: OnlineGame, people: PlayerId): boolean {
    return game.state?.players.find((p) => p.id === people)?.defeated ?? false;
  }

  /** Joueurs humains encore en jeu. */
  private livingHumans(game: OnlineGame): Seat[] {
    return game.seats.filter((s) => !s.cpu && !this.isDefeated(game, s.people));
  }

  /** J1 : le premier joueur humain encore en jeu (répond aux demandes de place). */
  private hostOf(game: OnlineGame): Seat | undefined {
    return this.livingHumans(game)[0];
  }

  /** Places d'IA qu'un joueur peut demander (camp encore en jeu). */
  private freeCpuSeats(game: OnlineGame): Seat[] {
    return game.seats.filter((s) => s.cpu && !this.isDefeated(game, s.people));
  }

  private isCpuTurn(game: OnlineGame): boolean {
    const current = game.state?.currentPlayer;
    return game.seats.some((s) => s.people === current && s.cpu);
  }

  private isCurrent(game: OnlineGame, userId: string): boolean {
    const current = game.state?.currentPlayer;
    return game.seats.some((s) => s.people === current && s.userId === userId);
  }

  private isWatching(id: string, userId: string): boolean {
    return [...(this.watchers.get(id) ?? [])].some((s) => this.sockets.get(s)?.id === userId);
  }

  private notifyPresence(id: string, userId: string, online: boolean): void {
    const people = this.games.get(id)?.seats.find((s) => s.userId === userId)?.people;
    if (!people) return;
    for (const socket of this.watchers.get(id) ?? []) {
      if (this.sockets.get(socket)?.id !== userId) {
        this.send(socket, { type: 'adversaire', id, people, online });
      }
    }
  }

  private notifyRequests(game: OnlineGame): void {
    const host = this.hostOf(game);
    if (host?.userId) {
      this.sendToUser(host.userId, {
        type: 'demandes',
        id: game.id,
        requests: game.requests.map(publicRequest),
      });
    }
  }

  private broadcastSeats(game: OnlineGame): void {
    for (const socket of this.watchers.get(game.id) ?? []) {
      this.send(socket, { type: 'places', id: game.id, seats: game.seats.map(publicSeat) });
    }
  }

  private summary(game: OnlineGame, userId: string): OnlineSummary {
    const isHost = this.hostOf(game)?.userId === userId;
    return {
      id: game.id,
      map: game.map,
      kind: kindOfMap(game.map),
      status: game.status,
      seats: game.seats.map(publicSeat),
      me: game.seats.find((s) => s.userId === userId)?.people ?? null,
      turn: game.status === 'en-cours' ? (game.state?.currentPlayer ?? null) : null,
      requests: isHost ? game.requests.map(publicRequest) : [],
      requested: game.requests.find((r) => r.userId === userId)?.people ?? null,
    };
  }

  lobbyFor(player: Player): ServerMessage {
    const games = [...this.games.values()].sort((a, b) => b.createdAt - a.createdAt);
    const seated = (g: OnlineGame) => g.seats.some((s) => s.userId === player.id);
    return {
      type: 'salons',
      open: games
        .filter(
          (g) =>
            !seated(g) &&
            ((g.status === 'attente' && kindOfMap(g.map) === 'duel') ||
              (g.status === 'en-cours' &&
                kindOfMap(g.map) === 'jn' &&
                this.freeCpuSeats(g).length > 0)),
        )
        .map((g) => this.summary(g, player.id)),
      mine: games
        .filter((g) => g.status !== 'finie' && seated(g))
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

  private sendToUser(userId: string | null, message: ServerMessage): void {
    if (!userId) return;
    for (const [socket, who] of this.sockets) if (who.id === userId) this.send(socket, message);
  }

  private send(socket: OnlineSocket, message: ServerMessage): void {
    socket.send(JSON.stringify(message));
  }
}
