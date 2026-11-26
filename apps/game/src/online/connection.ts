import type { ClientMessage, ServerMessage } from '@antiqua/protocol';

type Handler = (message: ServerMessage) => void;

/**
 * WebSocket du jeu en ligne (`/api/jeu`). Se reconnecte seul après une coupure ; `onOpen`
 * est rappelé à chaque (re)connexion, pour redemander l'état. Les messages envoyés pendant
 * une coupure attendent la reconnexion.
 */
export class OnlineConnection {
  private socket: WebSocket | null = null;
  private readonly handlers = new Set<Handler>();
  private readonly pending: string[] = [];
  private delay = 1000;
  private closed = false;

  constructor(private readonly onOpen: () => void = () => undefined) {
    this.open();
  }

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(message: ClientMessage): void {
    const data = JSON.stringify(message);
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(data);
    else this.pending.push(data);
  }

  close(): void {
    this.closed = true;
    this.socket?.close();
  }

  private open(): void {
    const url = new URL('./api/jeu', window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.addEventListener('open', () => {
      this.delay = 1000;
      this.onOpen();
      for (const data of this.pending.splice(0)) socket.send(data);
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      for (const handler of this.handlers) handler(message);
    });
    socket.addEventListener('close', (event) => {
      if (this.closed || event.code === 4401) return;
      window.setTimeout(() => this.open(), this.delay);
      this.delay = Math.min(this.delay * 2, 15_000);
    });
  }
}
