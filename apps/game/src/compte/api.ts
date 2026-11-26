/**
 * Client de l'API des comptes (`apps/server`, sous `/api`). La session vit dans un cookie
 * HttpOnly : la page ne voit jamais le jeton, elle demande seulement « qui suis-je ? ».
 */
export interface Player {
  readonly id: string;
  readonly pseudo: string;
  readonly email: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const UNREACHABLE = 'Serveur injoignable. Réessaie dans un instant.';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`./api/${path}`, {
      credentials: 'same-origin',
      headers: init?.body ? { 'content-type': 'application/json' } : {},
      ...init,
    });
  } catch {
    throw new ApiError(UNREACHABLE, 0);
  }
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as { erreur?: string } | null;
  if (!response.ok) {
    // 502/503/504 : le proxy répond mais le serveur des comptes est arrêté.
    const message = response.status >= 502 ? UNREACHABLE : (body?.erreur ?? 'Erreur inattendue.');
    throw new ApiError(message, response.status);
  }
  return body as T;
}

/** Joueur connecté et nombre de joueurs en ligne, ou null sans session valable. */
export async function fetchMe(): Promise<{ joueur: Player; enLigne: number } | null> {
  try {
    return await call('moi');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export const signup = (pseudo: string, email: string, motDePasse: string) =>
  call<{ joueur: Player }>('inscription', {
    method: 'POST',
    body: JSON.stringify({ pseudo, email, motDePasse }),
  });

export const login = (email: string, motDePasse: string) =>
  call<{ joueur: Player }>('connexion', {
    method: 'POST',
    body: JSON.stringify({ email, motDePasse }),
  });

export const logout = () => call<void>('deconnexion', { method: 'POST' });

/**
 * Nombre de joueurs connectés, en direct (WebSocket `/api/presence`). Se reconnecte après
 * une coupure ; la fonction renvoyée arrête l'écoute.
 */
export function watchPresence(onCount: (count: number) => void): () => void {
  let socket: WebSocket | null = null;
  let stopped = false;
  let delay = 1000;
  const open = () => {
    const url = new URL('./api/presence', window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(url);
    socket.addEventListener('message', (event) => {
      const data = JSON.parse(String(event.data)) as { type?: string; nombre?: number };
      if (data.type === 'enLigne' && typeof data.nombre === 'number') onCount(data.nombre);
      delay = 1000;
    });
    socket.addEventListener('close', (event) => {
      // 4401 : session refusée, inutile d'insister.
      if (stopped || event.code === 4401) return;
      window.setTimeout(open, delay);
      delay = Math.min(delay * 2, 30_000);
    });
  };
  open();
  return () => {
    stopped = true;
    socket?.close();
  };
}
