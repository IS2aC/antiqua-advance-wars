/**
 * Page de garde : propose de reprendre la partie sauvegardée (si elle existe) et mène au
 * jeu (`jeu.html`) avec le mode choisi. Aucune dépendance à Phaser : la page reste légère.
 */
import { MAPS, mapFromParam } from '../maps';
import { loadGame } from '../persistence/save';
import './garde.css';
import { PEOPLE_CARDS } from './peuples';

const save = loadGame();
const resume = document.querySelector<HTMLAnchorElement>('#continuer');
const detail = document.querySelector<HTMLElement>('#continuer-detail');

if (save && resume && detail) {
  const mode = save.aiPlayers.length > 0 ? "contre l'IA" : 'même écran';
  detail.textContent = `${save.state.map.name} · jour ${save.state.day} · ${mode}`;
  resume.hidden = false;
}

// Une partie en cours passe en premier ; sinon « Nouvelle partie ».
const first = document.querySelector<HTMLElement>(save ? '#continuer' : '.action--primary');
first?.focus({ preventScroll: true });

// ——— Choix du peuple ———
// « Nouvelle partie » et « Les 4 royaumes » ouvrent d'abord le choix du peuple : une carte par
// peuple de la carte de jeu (portrait du dirigeant, écusson, traits). Sans JavaScript, les
// liens lancent directement la partie avec Koush.
const dialog = document.querySelector<HTMLDialogElement>('#choix-peuple');
const grid = document.querySelector<HTMLElement>('#choix-grille');
const mapLabel = document.querySelector<HTMLElement>('#choix-carte');

function openPeopleChoice(mapParam: string): void {
  if (!dialog || !grid || !mapLabel) return;
  const map = mapFromParam(mapParam);
  const definition = MAPS[map];
  mapLabel.textContent = `${definition.name} · ${definition.players.length} peuples`;
  grid.replaceChildren(
    ...definition.players.map((id) => {
      const card = PEOPLE_CARDS[id];
      const link = document.createElement('a');
      link.className = 'peuple';
      link.href = `./jeu.html?mode=ia&carte=${map}&peuple=${id}`;
      link.style.setProperty('--equipe', card.color);
      link.style.setProperty('--equipe-sombre', card.dark);
      link.innerHTML = `
        <span class="peuple__portrait">
          <img src="./assets/garde/peuples/${id}-roi.webp" alt="" width="480" height="560" loading="lazy" />
        </span>
        <img class="peuple__ecusson" src="./assets/garde/peuples/${id}-ecusson.webp" alt="" loading="lazy" />
        <span class="peuple__corps">
          <span class="peuple__nom"></span>
          <span class="peuple__chef"></span>
          <span class="peuple__traits"></span>
          <span class="peuple__texte"></span>
        </span>`;
      const fill = (selector: string, text: string) => {
        const element = link.querySelector(selector);
        if (element) element.textContent = text;
      };
      fill('.peuple__nom', card.name);
      fill('.peuple__chef', card.leader);
      fill('.peuple__traits', card.traits);
      fill('.peuple__texte', card.text);
      link.setAttribute('aria-label', `${card.name}, ${card.leader}`);
      return link;
    }),
  );
  dialog.showModal();
  grid.querySelector<HTMLElement>('.peuple')?.focus();
}

for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-choix-carte]')) {
  link.addEventListener('click', (event) => {
    if (!dialog) return;
    event.preventDefault();
    openPeopleChoice(link.dataset.choixCarte ?? '');
  });
}
dialog?.querySelector('.choix__fermer')?.addEventListener('click', () => dialog.close());
// Clic sur le fond (en dehors du panneau) : fermer.
dialog?.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

// Navigation au clavier : flèches dans le menu, ou entre les peuples quand le choix est ouvert.
const actions = [...document.querySelectorAll<HTMLElement>('.garde__menu .action')].filter(
  (element) => !element.hidden && !element.hasAttribute('disabled'),
);
document.addEventListener('keydown', (event) => {
  if (dialog?.open) {
    const cards = [...(grid?.querySelectorAll<HTMLElement>('.peuple') ?? [])];
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step || cards.length === 0) return;
    const current = cards.indexOf(document.activeElement as HTMLElement);
    cards[(current + step + cards.length) % cards.length]?.focus();
    event.preventDefault();
    return;
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const current = actions.indexOf(document.activeElement as HTMLElement);
  const step = event.key === 'ArrowDown' ? 1 : -1;
  const next = actions[(current + step + actions.length) % actions.length];
  next?.focus();
  event.preventDefault();
});
