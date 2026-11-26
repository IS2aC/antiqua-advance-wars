import { PEOPLE_CARDS } from '../garde/peuples';
import type { RemoteSession } from './session';

/**
 * Bandeau HTML au-dessus de la carte, en partie en ligne : minuteur du tour (dès que deux
 * joueurs humains jouent), demandes de place adressées à J1 (JN) et messages brefs.
 */
export interface OnlineOverlay {
  notify(text: string): void;
}

const STYLE = `
.enligne-bandeau { position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 6px; z-index: 10;
  font: 600 14px/1.3 system-ui, sans-serif; color: #f6ead2; pointer-events: none; }
.enligne-bandeau > * { pointer-events: auto; background: rgba(26, 20, 16, 0.92);
  border: 1px solid #a77c3c; border-radius: 8px; padding: 6px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4); }
.enligne-minuteur { font-variant-numeric: tabular-nums; }
.enligne-minuteur--urgent { color: #ffb4a0; border-color: #d1452e; }
.enligne-demande { display: flex; align-items: center; gap: 10px; }
.enligne-demande button { font: inherit; cursor: pointer; border-radius: 6px; padding: 3px 10px;
  border: 1px solid #a77c3c; background: #3a2b1c; color: inherit; }
.enligne-demande button.oui { background: #a77c3c; color: #1a1410; }
`;

const format = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export function createOnlineOverlay(session: RemoteSession): OnlineOverlay {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);
  const root = document.createElement('div');
  root.className = 'enligne-bandeau';
  root.setAttribute('aria-live', 'polite');
  const clock = document.createElement('div');
  clock.className = 'enligne-minuteur';
  clock.hidden = true;
  const requests = document.createElement('div');
  requests.style.display = 'contents';
  const toast = document.createElement('div');
  toast.hidden = true;
  root.append(clock, requests, toast);
  document.body.append(root);

  let hideToast = 0;
  function notify(text: string): void {
    toast.textContent = text;
    toast.hidden = false;
    window.clearTimeout(hideToast);
    hideToast = window.setTimeout(() => (toast.hidden = true), 5000);
  }

  const nameOf = (people: keyof typeof PEOPLE_CARDS) => PEOPLE_CARDS[people].name;

  const tick = () => {
    const timer = session.timer;
    clock.hidden = timer === null;
    if (!timer) return;
    const left = timer.deadline - Date.now();
    const seat = session.seats.find((s) => s.people === timer.player);
    const who = timer.player === session.me ? 'À toi de jouer' : `Tour de ${seat?.pseudo ?? '?'}`;
    clock.textContent = `${who} · ${format(left)} pour commencer`;
    clock.classList.toggle('enligne-minuteur--urgent', left < 30_000);
  };

  const renderRequests = () => {
    requests.replaceChildren(
      ...session.requests.map((request) => {
        const card = document.createElement('div');
        card.className = 'enligne-demande';
        const text = document.createElement('span');
        text.textContent = `${request.pseudo} demande la place de ${nameOf(request.people)} (IA)`;
        const yes = document.createElement('button');
        yes.type = 'button';
        yes.className = 'oui';
        yes.textContent = 'Accepter';
        yes.addEventListener('click', () => session.answer(request.id, true));
        const no = document.createElement('button');
        no.type = 'button';
        no.textContent = 'Refuser';
        no.addEventListener('click', () => session.answer(request.id, false));
        card.append(text, yes, no);
        return card;
      }),
    );
  };

  // Arrivées et départs (JN) : une IA remplacée par un joueur, ou l'inverse.
  let seats = session.seats;
  session.onChange(() => {
    for (const seat of session.seats) {
      const before = seats.find((s) => s.people === seat.people);
      if (!before || before.cpu === seat.cpu || seat.people === session.me) continue;
      notify(
        seat.cpu
          ? `${before.pseudo} a abandonné : l’IA reprend ${nameOf(seat.people)}`
          : `${seat.pseudo} prend la place de ${nameOf(seat.people)}`,
      );
    }
    seats = session.seats;
    tick();
    renderRequests();
  });
  session.onTurnSkipped((player) => {
    if (player === session.me) notify('Temps écoulé : ton tour est passé');
  });
  tick();
  renderRequests();
  window.setInterval(tick, 500);

  return { notify };
}
