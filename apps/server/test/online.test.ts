import { describe, expect, it } from 'vitest';
import type { ServerMessage } from '@antiqua/protocol';
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
    expect(b.last('salons').open[0]?.seats[0]).toEqual({ pseudo: 'Amina', people: 'koush' });
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
    expect(b.last('partie').opponentOnline).toBe(true);
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
