import { afterEach, describe, expect, it, vi } from 'vitest';
import { TURN_TIME_MS, type ServerMessage } from '@antiqua/protocol';
import { OnlineHub, type OnlineSocket } from '../src/online';
import { MemoryStore } from '../src/store';

class FakeSocket implements OnlineSocket {
  readonly received: ServerMessage[] = [];
  send(data: string): void {
    this.received.push(JSON.parse(data) as ServerMessage);
  }
  last<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> {
    const found = this.received.filter((m) => m.type === type).at(-1);
    if (!found) throw new Error(`aucun message « ${type} »`);
    return found as Extract<ServerMessage, { type: T }>;
  }
}

const AMINA = { id: 'u1', pseudo: 'Amina' };
const KOFI = { id: 'u2', pseudo: 'Kofi' };

async function setup(store = new MemoryStore()) {
  const hub = new OnlineHub(store);
  await hub.restore();
  const a = new FakeSocket();
  const b = new FakeSocket();
  hub.connect(a, AMINA);
  hub.connect(b, KOFI);
  const send = (socket: FakeSocket, message: object) => hub.handle(socket, JSON.stringify(message));
  return { hub, a, b, send, store };
}

/** Amina crée (Dahomey), Kofi rejoint (Sosso), les deux suivent la partie. */
async function started() {
  const ctx = await setup();
  await ctx.send(ctx.a, { type: 'creer', map: 'gue-du-nil', people: 'dahomey' });
  const id = ctx.a.last('creee').id;
  await ctx.send(ctx.b, { type: 'rejoindre', id, people: 'sosso' });
  await ctx.send(ctx.a, { type: 'suivre', id });
  await ctx.send(ctx.b, { type: 'suivre', id });
  return { ...ctx, id };
}

describe('jeu en ligne : salons', () => {
  it('une partie créée apparaît chez les autres, pas chez son créateur', async () => {
    const { a, b, send } = await setup();
    await send(a, { type: 'creer', map: 'cote', people: 'koush' });
    expect(b.last('salons').open).toHaveLength(1);
    expect(b.last('salons').open[0]?.seats[0]).toEqual({
      pseudo: 'Amina',
      people: 'koush',
      cpu: false,
    });
    expect(a.last('salons').open).toHaveLength(0);
    expect(a.last('salons').mine[0]?.status).toBe('attente');
  });

  it('rejoindre avec le même peuple est refusé ; sinon la partie commence pour les deux', async () => {
    const { a, b, send } = await setup();
    await send(a, { type: 'creer', map: 'gue-du-nil', people: 'koush' });
    const id = a.last('creee').id;
    await send(b, { type: 'rejoindre', id, people: 'koush' });
    expect(b.last('erreur').message).toMatch(/autre peuple/);
    await send(b, { type: 'rejoindre', id, people: 'carthage' });
    expect(a.last('commencee').id).toBe(id);
    expect(b.last('commencee').id).toBe(id);
    expect(b.last('salons').open).toHaveLength(0);
  });

  it('le créateur peut annuler une partie en attente', async () => {
    const { a, b, send } = await setup();
    await send(a, { type: 'creer', map: 'gue-du-nil', people: 'koush' });
    await send(a, { type: 'annuler', id: a.last('creee').id });
    expect(b.last('salons').open).toHaveLength(0);
  });
});

describe('jeu en ligne : partie', () => {
  it('chacun reçoit l’état et son camp ; le créateur joue en premier', async () => {
    const { a, b } = await started();
    expect(a.last('partie').me).toBe('dahomey');
    expect(b.last('partie').me).toBe('sosso');
    expect(a.last('partie').state.currentPlayer).toBe('dahomey');
    // Kofi arrive après Amina : il la voit en ligne, elle est prévenue de son arrivée.
    expect(b.last('partie').online).toEqual(['dahomey', 'sosso']);
    expect(a.last('adversaire').online).toBe(true);
  });

  it('transmet les actions validées à l’adversaire', async () => {
    const { a, b, send, id } = await started();
    await send(a, { type: 'actions', id, actions: [{ type: 'END_TURN' }] });
    expect(b.last('actions').actions).toEqual([{ type: 'END_TURN' }]);
    expect(a.received.some((m) => m.type === 'actions')).toBe(false);
  });

  it('refuse de jouer hors de son tour, et renvoie l’état officiel', async () => {
    const { a, b, send, id } = await started();
    await send(b, { type: 'actions', id, actions: [{ type: 'END_TURN' }] });
    expect(b.last('erreur').message).toMatch(/refusée/);
    expect(b.last('partie').state.currentPlayer).toBe('dahomey');
    expect(a.received.some((m) => m.type === 'actions')).toBe(false);
  });

  it('refuse une action illégale', async () => {
    const { a, send, id } = await started();
    await send(a, { type: 'actions', id, actions: [{ type: 'WAIT', unitId: 9999 }] });
    expect(a.last('erreur').message).toMatch(/refusée/);
  });

  it('abandon : l’adversaire gagne, la partie quitte « mes parties »', async () => {
    const { a, b, send, id } = await started();
    await send(a, { type: 'abandonner', id });
    expect(b.last('fin')).toMatchObject({ winner: 'sosso', reason: 'abandon' });
    expect(a.last('salons').mine).toHaveLength(0);
  });

  it('prévient quand l’adversaire quitte l’écran de jeu', async () => {
    const { hub, a, b } = await started();
    hub.disconnect(b);
    expect(a.last('adversaire').online).toBe(false);
  });

  it('reprend les parties en cours après un redémarrage du serveur', async () => {
    const { send, a, id, store } = await started();
    await send(a, { type: 'actions', id, actions: [{ type: 'END_TURN' }] });
    const restarted = await setup(store);
    await restarted.send(restarted.b, { type: 'suivre', id });
    expect(restarted.b.last('partie').state.currentPlayer).toBe('sosso');
  });
});

describe('jeu en ligne : minuteur du tour', () => {
  afterEach(() => vi.useRealTimers());

  it('passe le tour du joueur qui ne commence pas à temps', async () => {
    vi.useFakeTimers();
    const { a, b } = await started();
    expect(a.last('partie').timer).toMatchObject({ player: 'dahomey' });
    await vi.advanceTimersByTimeAsync(TURN_TIME_MS + 10);
    expect(a.last('tour-passe').player).toBe('dahomey');
    expect(b.last('actions').actions).toEqual([{ type: 'END_TURN' }]);
    // Au tour de Kofi, son minuteur démarre.
    expect(b.last('minuteur').timer).toMatchObject({ player: 'sosso' });
    expect(a.received.some((m) => m.type === 'actions')).toBe(false);
  });

  it('s’arrête dès que le joueur commence son tour', async () => {
    vi.useFakeTimers();
    const { a, b, send, id } = await started();
    await send(a, { type: 'actif', id });
    expect(b.last('minuteur').timer?.remainingMs).toBeNull();
    await vi.advanceTimersByTimeAsync(TURN_TIME_MS + 10);
    expect(a.received.some((m) => m.type === 'tour-passe')).toBe(false);
  });

  it('repart de zéro quand l’écran du joueur arrive à son tour', async () => {
    vi.useFakeTimers();
    const { a, send, id } = await started();
    await vi.advanceTimersByTimeAsync(TURN_TIME_MS - 1000);
    await send(a, { type: 'pret', id });
    await vi.advanceTimersByTimeAsync(2000);
    expect(a.received.some((m) => m.type === 'tour-passe')).toBe(false);
    await vi.advanceTimersByTimeAsync(TURN_TIME_MS);
    expect(a.last('tour-passe').player).toBe('dahomey');
  });
});

describe('jeu en ligne : JN (4 camps, places d’IA)', () => {
  const ZARA = { id: 'u3', pseudo: 'Zara' };

  /** Amina crée une partie JN (Koush) contre 3 IA. */
  async function jn() {
    const ctx = await setup();
    await ctx.send(ctx.a, { type: 'creer', map: 'carrefour', people: 'koush', open: true });
    const id = ctx.a.last('creee').id;
    expect(ctx.a.last('commencee').id).toBe(id);
    await ctx.send(ctx.a, { type: 'suivre', id });
    return { ...ctx, id };
  }

  it('commence tout de suite, J1 contre 3 IA, sans minuteur', async () => {
    const { a } = await jn();
    const game = a.last('partie');
    expect(game.seats.filter((s) => s.cpu)).toHaveLength(3);
    expect(game.seats.find((s) => !s.cpu)).toMatchObject({ pseudo: 'Amina', people: 'koush' });
    expect(game.timer).toBeNull();
  });

  it('l’IA joue ses tours sur le serveur, puis la main revient au joueur', async () => {
    const { a, send, id } = await jn();
    await send(a, { type: 'actions', id, actions: [{ type: 'END_TURN' }] });
    const cpu = a.last('actions').actions;
    expect(cpu.filter((action) => action.type === 'END_TURN')).toHaveLength(3);
    await send(a, { type: 'suivre', id });
    expect(a.last('partie').state).toMatchObject({ currentPlayer: 'koush', day: 2 });
  });

  it('un autre joueur demande une place d’IA ; J1 accepte ; minuteur à deux humains', async () => {
    const { hub, a, b, send, id } = await jn();
    const open = b.last('salons').open.find((g) => g.id === id);
    expect(open?.kind).toBe('jn');
    await send(b, { type: 'demander', id, people: 'carthage' });
    expect(b.last('salons').open.find((g) => g.id === id)?.requested).toBe('carthage');
    const request = a.last('demandes').requests[0];
    expect(request).toMatchObject({ pseudo: 'Kofi', people: 'carthage' });
    await send(a, { type: 'repondre', id, request: request?.id, accept: true });
    expect(b.last('commencee').id).toBe(id);
    expect(a.last('places').seats.find((s) => s.people === 'carthage')).toMatchObject({
      pseudo: 'Kofi',
      cpu: false,
    });
    // Deux humains : le minuteur démarre pour Amina, qui a la main.
    expect(a.last('minuteur').timer).toMatchObject({ player: 'koush' });
    await send(b, { type: 'suivre', id });
    expect(b.last('partie').me).toBe('carthage');
    hub.close();
  });

  it('fermée par défaut : invisible au salon tant que J1 ne l’ouvre pas', async () => {
    const { a, b, send } = await setup();
    await send(a, { type: 'creer', map: 'carrefour', people: 'koush' });
    const id = a.last('creee').id;
    await send(a, { type: 'suivre', id });
    expect(a.last('partie').open).toBe(false);
    expect(b.last('salons').open).toHaveLength(0);
    await send(b, { type: 'demander', id, people: 'carthage' });
    expect(b.last('erreur').message).toMatch(/plus ouverte/);
    // Seul J1 ouvre sa partie.
    await send(b, { type: 'ouvrir', id, open: true });
    expect(b.last('salons').open).toHaveLength(0);
    await send(a, { type: 'ouvrir', id, open: true });
    expect(a.last('acces').open).toBe(true);
    expect(b.last('salons').open[0]).toMatchObject({ id, open: true });
  });

  it('fermer la partie refuse les demandes en attente', async () => {
    const { hub, a, b, send, id } = await jn();
    await send(b, { type: 'demander', id, people: 'carthage' });
    await send(a, { type: 'ouvrir', id, open: false });
    expect(b.last('erreur').message).toMatch(/fermé/);
    expect(a.last('demandes').requests).toHaveLength(0);
    expect(b.last('salons').open).toHaveLength(0);
    hub.close();
  });

  it('J1 peut refuser ; une place déjà prise ne peut plus être demandée', async () => {
    const { hub, a, b, send, id } = await jn();
    const c = new FakeSocket();
    hub.connect(c, ZARA);
    await send(b, { type: 'demander', id, people: 'carthage' });
    await send(a, {
      type: 'repondre',
      id,
      request: a.last('demandes').requests[0]?.id,
      accept: false,
    });
    expect(b.last('erreur').message).toMatch(/refusé/);
    await send(c, { type: 'demander', id, people: 'carthage' });
    await send(a, {
      type: 'repondre',
      id,
      request: a.last('demandes').requests[0]?.id,
      accept: true,
    });
    await send(b, { type: 'demander', id, people: 'carthage' });
    expect(b.last('erreur').message).toMatch(/plus libre/);
    hub.close();
  });

  it('abandon en JN : l’IA reprend le camp, la partie continue', async () => {
    const { hub, a, b, send, id } = await jn();
    await send(b, { type: 'demander', id, people: 'carthage' });
    await send(a, {
      type: 'repondre',
      id,
      request: a.last('demandes').requests[0]?.id,
      accept: true,
    });
    await send(b, { type: 'suivre', id });
    await send(b, { type: 'abandonner', id });
    expect(b.last('fin')).toMatchObject({ reason: 'abandon' });
    expect(a.last('places').seats.find((s) => s.people === 'carthage')?.cpu).toBe(true);
    expect(a.last('salons').mine.find((g) => g.id === id)?.status).toBe('en-cours');
    hub.close();
  });
});
