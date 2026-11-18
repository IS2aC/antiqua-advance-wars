/**
 * Page de garde : propose de reprendre la partie sauvegardée (si elle existe) et mène au
 * jeu (`jeu.html`) avec le mode choisi. Aucune dépendance à Phaser : la page reste légère.
 */
import type { PlayerId } from '@antiqua/engine';
import { MAPS, mapFromParam, type MapId } from '../maps';
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

// Une partie en cours passe en premier ; sinon « À deux joueurs ».
const first = document.querySelector<HTMLElement>(save ? '#continuer' : '.action--primary');
first?.focus({ preventScroll: true });

// ——— Choix du peuple ———
// « À deux joueurs » : on choisit son peuple parmi les 4, puis celui de l'IA parmi les 3
// autres (la carte du Gué du Nil est réattribuée). « À quatre joueurs » : son peuple, l'IA
// prend les 3 autres. Chaque carte : portrait du dirigeant, écusson, traits. Sans
// JavaScript, les liens lancent directement la partie avec Koush.
const dialog = document.querySelector<HTMLDialogElement>('#choix-peuple');
const grid = document.querySelector<HTMLElement>('#choix-grille');
const title = document.querySelector<HTMLElement>('#choix-titre');
const subtitle = document.querySelector<HTMLElement>('#choix-carte');
const back = document.querySelector<HTMLButtonElement>('.choix__retour');
const ALL_PEOPLES = Object.keys(PEOPLE_CARDS) as PlayerId[];

/** Étape du choix : son peuple, puis (en duel) celui de l'IA. */
interface ChoiceStep {
  readonly map: MapId;
  readonly duel: boolean;
  /** Peuple déjà choisi par le joueur (deuxième étape du duel). */
  readonly human?: PlayerId;
}
let step: ChoiceStep | null = null;

function peopleCard(id: PlayerId, href: string): HTMLAnchorElement {
  const card = PEOPLE_CARDS[id];
  const link = document.createElement('a');
  link.className = 'peuple';
  link.href = href;
  link.dataset.peuple = id;
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
}

function showStep(next: ChoiceStep): void {
  if (!dialog || !grid || !title || !subtitle || !back) return;
  step = next;
  const name = MAPS[next.map].name;
  const launch = `./jeu.html?mode=ia&carte=${next.map}`;
  let ids: PlayerId[];
  let href: (id: PlayerId) => string;
  if (next.duel && next.human) {
    const human = next.human;
    title.textContent = "Choisis le peuple de l'IA";
    subtitle.textContent = `${name} · tu joues ${PEOPLE_CARDS[human].name}`;
    ids = ALL_PEOPLES.filter((id) => id !== human);
    href = (id) => `${launch}&peuple=${human}&adversaire=${id}`;
  } else {
    title.textContent = 'Choisis ton peuple';
    ids = next.duel ? ALL_PEOPLES : [...MAPS[next.map].players];
    subtitle.textContent = next.duel
      ? `${name} · duel contre l'IA`
      : `${name} · toi contre ${ids.length - 1} IA`;
    href = (id) => `${launch}&peuple=${id}`;
  }
  back.hidden = !(next.duel && next.human);
  grid.replaceChildren(...ids.map((id) => peopleCard(id, href(id))));
  if (!dialog.open) dialog.showModal();
  grid.querySelector<HTMLElement>('.peuple')?.focus();
}

for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-choix-carte]')) {
  link.addEventListener('click', (event) => {
    if (!dialog) return;
    event.preventDefault();
    showStep({ map: mapFromParam(link.dataset.choixCarte ?? ''), duel: 'duel' in link.dataset });
  });
}
// Duel, première étape : le peuple choisi mène au choix de l'IA au lieu de lancer la partie.
grid?.addEventListener('click', (event) => {
  const card = (event.target as Element).closest<HTMLAnchorElement>('.peuple');
  const id = card?.dataset.peuple as PlayerId | undefined;
  if (!step?.duel || step.human || !id) return;
  event.preventDefault();
  showStep({ ...step, human: id });
});
const stepBack = () => {
  if (step) showStep({ map: step.map, duel: step.duel });
};
back?.addEventListener('click', stepBack);
// Échap à la deuxième étape : revenir au choix de son peuple plutôt que tout fermer.
dialog?.addEventListener('cancel', (event) => {
  if (step?.human) {
    event.preventDefault();
    stepBack();
  }
});
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
