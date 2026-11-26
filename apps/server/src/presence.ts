/**
 * Joueurs connectés : un compte compte une fois, même avec plusieurs onglets ouverts.
 * Chaque changement du nombre est diffusé à tous les abonnés.
 */
export interface PresenceSocket {
  send(data: string): void;
}

export class Presence {
  private readonly sockets = new Map<PresenceSocket, string>();
  private lastCount = 0;

  get count(): number {
    return new Set(this.sockets.values()).size;
  }

  join(socket: PresenceSocket, userId: string): void {
    this.sockets.set(socket, userId);
    // Le nouveau venu reçoit le nombre dans tous les cas, les autres seulement s'il change.
    if (!this.broadcastIfChanged()) socket.send(this.message());
  }

  leave(socket: PresenceSocket): void {
    if (this.sockets.delete(socket)) this.broadcastIfChanged();
  }

  private message(): string {
    return JSON.stringify({ type: 'enLigne', nombre: this.count });
  }

  private broadcastIfChanged(): boolean {
    const count = this.count;
    if (count === this.lastCount) return false;
    this.lastCount = count;
    const message = this.message();
    for (const socket of this.sockets.keys()) socket.send(message);
    return true;
  }
}
