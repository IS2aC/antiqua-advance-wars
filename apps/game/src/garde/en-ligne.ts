/**
 * Salon du jeu en ligne : choix de son peuple, création d'une partie (duel J1 contre J2, ou
 * JN sur le Carrefour : J1 contre 3 IA), liste des parties ouvertes par les autres joueurs
 * (duels à rejoindre, places d'IA à demander en JN) et de ses propres parties, avec les
 * demandes reçues. Quand la partie commence (ou qu'une place est accordée), le joueur passe
 * sur `jeu.html?mode=enligne&partie=…`.
 */
import type { PlayerId } from '@antiqua/engine';
import {
  JN_MAP,
  ONLINE_MAPS,
  type OnlineMapId,
  type OnlineSummary,
  type ServerMessage,
} from '@antiqua/protocol';
import { MAPS } from '../maps';
import { OnlineConnection } from '../online/connection';
import { PEOPLE_CARDS } from './peuples';

const PEOPLE_KEY = 'antiqua:peuple-en-ligne';
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);

export const gameUrl = (id: string) => `./jeu.html?mode=enligne&partie=${encodeURIComponent(id)}`;

export function setupOnlineLobby(): void {
  const dialog = $<HTMLDialogElement>('#salon-en-ligne');
  const opener = $<HTMLButtonElement>('#ouvrir-en-ligne');
  const jnOpener = $<HTMLButtonElement>('#ouvrir-jn');
  const status = $<HTMLElement>('#en-ligne-etat');
  const peoples = $<HTMLElement>('#en-ligne-peuples');
  const mapSelect = $<HTMLSelectElement>('#en-ligne-carte');
  const create = $<HTMLButtonElement>('#en-ligne-creer-btn');
  const openOption = $<HTMLElement>('#en-ligne-ouverte');
  const openBox = openOption?.querySelector<HTMLInputElement>('input') ?? null;
  const openList = $<HTMLUListElement>('#parties-ouvertes');
  const mineList = $<HTMLUListElement>('#mes-parties');
  if (!dialog || !opener || !status || !peoples || !mapSelect || !create) return;
  if (!openList || !mineList) return;

  const ids = Object.keys(PEOPLE_CARDS) as PlayerId[];
  const saved = localStorage.getItem(PEOPLE_KEY);
  let people: PlayerId = ids.find((id) => id === saved) ?? 'koush';
  let connection: OnlineConnection | null = null;
  let lastLobby: Extract<ServerMessage, { type: 'salons' }> | null = null;

  // ——— Choix du peuple et de la carte ———
  for (const id of ids) {
    const card = PEOPLE_CARDS[id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'en-ligne__peuple';
    button.setAttribute('role', 'radio');
    button.dataset.peuple = id;
    button.style.setProperty('--equipe', card.color);
    button.innerHTML = `<img src="./assets/garde/peuples/${id}-ecusson.webp" alt="" /><span></span>`;
    const label = button.querySelector('span');
    if (label) label.textContent = card.name;
    button.addEventListener('click', () => {
      people = id;
      localStorage.setItem(PEOPLE_KEY, id);
      renderPeoples();
      if (lastLobby) renderLobby(lastLobby);
    });
    peoples.append(button);
  }
  const renderPeoples = () => {
    for (const button of peoples.querySelectorAll<HTMLButtonElement>('.en-ligne__peuple')) {
      button.setAttribute('aria-checked', String(button.dataset.peuple === people));
    }
  };
  renderPeoples();
  const mapLabel = (map: OnlineMapId) =>
    map === JN_MAP ? `JN · ${MAPS[map].name} (4 camps, avec IA)` : `Duel · ${MAPS[map].name}`;
  for (const map of ONLINE_MAPS) mapSelect.append(new Option(mapLabel(map), map));
  // JN : la partie reste invisible au salon tant que J1 ne l'ouvre pas aux autres joueurs.
  const showOpenOption = () => {
    if (openOption) openOption.hidden = mapSelect.value !== JN_MAP;
  };
  mapSelect.addEventListener('change', showOpenOption);

  // ——— Listes ———
  const peopleName = (id: PlayerId) => PEOPLE_CARDS[id].name;

  function item(text: string, detail: string, actions: HTMLElement[]): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'en-ligne__partie';
    const body = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = text;
    const small = document.createElement('span');
    small.textContent = detail;
    body.append(title, small);
    li.append(body, ...actions);
    return li;
  }

  function button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = primary ? 'en-ligne__bouton en-ligne__bouton--fort' : 'en-ligne__bouton';
    element.textContent = label;
    element.addEventListener('click', onClick);
    return element;
  }

  function empty(text: string): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'en-ligne__vide';
    li.textContent = text;
    return li;
  }

  function renderOpen(game: OnlineSummary): HTMLLIElement {
    if (game.kind === 'jn') return renderOpenJn(game);
    const host = game.seats[0];
    const samePeople = host?.people === people;
    const join = button(
      'Rejoindre',
      () => connection?.send({ type: 'rejoindre', id: game.id, people }),
      true,
    );
    join.disabled = samePeople;
    if (samePeople) join.title = 'Choisis un autre peuple que celui de ton adversaire.';
    return item(
      `${host?.pseudo ?? '?'} · ${host ? peopleName(host.people) : ''}`,
      MAPS[game.map].name,
      [join],
    );
  }

  /** JN en cours : une place par IA, à demander à J1. */
  function renderOpenJn(game: OnlineSummary): HTMLLIElement {
    const humans = game.seats.filter((seat) => !seat.cpu);
    const title = `JN · ${humans.map((seat) => seat.pseudo).join(', ')}`;
    const detail = `${MAPS[game.map].name} · ${humans.length}/4 joueurs`;
    if (game.requested) {
      return item(title, `${detail} · demande envoyée pour ${peopleName(game.requested)}…`, []);
    }
    const take = game.seats
      .filter((seat) => seat.cpu)
      .map((seat) =>
        button(`Prendre ${peopleName(seat.people)}`, () =>
          connection?.send({ type: 'demander', id: game.id, people: seat.people }),
        ),
      );
    return item(title, detail, take);
  }

  /** Demandes reçues par J1 (JN) : accepter ou refuser. */
  function renderRequests(game: OnlineSummary): HTMLLIElement[] {
    return game.requests.map((request) =>
      item(`${request.pseudo} demande ${peopleName(request.people)}`, 'Place d’IA, JN', [
        button(
          'Accepter',
          () =>
            connection?.send({ type: 'repondre', id: game.id, request: request.id, accept: true }),
          true,
        ),
        button('Refuser', () =>
          connection?.send({ type: 'repondre', id: game.id, request: request.id, accept: false }),
        ),
      ]),
    );
  }

  function renderMine(game: OnlineSummary): HTMLLIElement {
    if (game.status === 'attente') {
      return item(
        'En attente d’un adversaire…',
        `${MAPS[game.map].name} · ${peopleName(game.me ?? 'koush')}`,
        [button('Annuler', () => connection?.send({ type: 'annuler', id: game.id }))],
      );
    }
    const myTurn = game.turn !== null && game.turn === game.me;
    if (game.kind === 'jn') {
      const others = game.seats.filter((seat) => seat.people !== game.me && !seat.cpu);
      return item(
        `JN · ${peopleName(game.me ?? 'koush')}${others.length ? ` avec ${others.map((s) => s.pseudo).join(', ')}` : ' contre 3 IA'}`,
        `${MAPS[game.map].name} · ${myTurn ? 'à toi de jouer' : 'tour adverse'} · ${game.open ? 'ouverte' : 'fermée'} aux autres`,
        [
          // J1 seul (il reçoit les demandes) ouvre ou ferme sa partie.
          ...(game.seats.find((seat) => !seat.cpu)?.people === game.me
            ? [
                button(game.open ? 'Fermer' : 'Ouvrir', () =>
                  connection?.send({ type: 'ouvrir', id: game.id, open: !game.open }),
                ),
              ]
            : []),
          button('Reprendre', () => window.location.assign(gameUrl(game.id)), myTurn),
        ],
      );
    }
    const opponent = game.seats.find((seat) => seat.people !== game.me);
    return item(
      `Contre ${opponent?.pseudo ?? '?'} (${opponent ? peopleName(opponent.people) : ''})`,
      `${MAPS[game.map].name} · ${myTurn ? 'à toi de jouer' : 'tour adverse'}`,
      [button('Reprendre', () => window.location.assign(gameUrl(game.id)), myTurn)],
    );
  }

  function renderLobby(lobby: Extract<ServerMessage, { type: 'salons' }>): void {
    lastLobby = lobby;
    openList?.replaceChildren(
      ...(lobby.open.length > 0
        ? lobby.open.map(renderOpen)
        : [empty('Aucune partie ouverte pour l’instant : crée la tienne.')]),
    );
    mineList?.replaceChildren(
      ...(lobby.mine.length > 0
        ? lobby.mine.flatMap((game) => [renderMine(game), ...renderRequests(game)])
        : [empty('Aucune partie en cours.')]),
    );
    if (status)
      status.textContent = 'Duel ou JN (4 camps) au tour par tour avec d’autres joueurs connectés.';
  }

  // ——— Connexion au salon, seulement quand il est ouvert ———
  function connect(): void {
    if (connection) return;
    if (status) status.textContent = 'Connexion au salon…';
    connection = new OnlineConnection(() => connection?.send({ type: 'salons' }));
    connection.on((message) => {
      if (message.type === 'salons') renderLobby(message);
      else if (message.type === 'commencee') window.location.assign(gameUrl(message.id));
      else if (message.type === 'erreur' && status) status.textContent = message.message;
    });
  }

  create.addEventListener('click', () => {
    const map = ONLINE_MAPS.find((id) => id === mapSelect.value) ?? ONLINE_MAPS[0];
    connection?.send({ type: 'creer', map, people, open: openBox?.checked === true });
  });
  const open = (map: OnlineMapId | null) => {
    connect();
    if (map) mapSelect.value = map;
    showOpenOption();
    dialog.showModal();
    peoples.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  };
  opener.addEventListener('click', () => open(mapSelect.value === JN_MAP ? ONLINE_MAPS[0] : null));
  jnOpener?.addEventListener('click', () => open(JN_MAP));
  dialog.querySelector('.choix__fermer')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  // La connexion reste ouverte une fois le salon fermé : un joueur en attente est prévenu
  // (et emmené dans la partie) dès qu'un adversaire le rejoint.
}
