/**
 * Page de garde : propose de reprendre la partie sauvegardée (si elle existe) et mène au
 * jeu (`jeu.html`) avec le mode choisi. Aucune dépendance à Phaser : la page reste légère.
 */
import type { PlayerId } from '@antiqua/engine';
import { MAPS, mapFromParam, type MapId } from '../maps';
import { loadGame } from '../persistence/save';
import './garde.css';
import { requireAccount } from './compte';
import { PEOPLE_CARDS } from './peuples';

const save = loadGame();
const resume = document.querySelector<HTMLAnchorElement>('#continuer');
const detail = document.querySelector<HTMLElement>('#continuer-detail');

if (save && resume && detail) {
  const mode = save.aiPlayers.length > 0 ? "contre l'IA" : 'même écran';
  detail.textContent = `${save.state.map.name} · jour ${save.state.day} · ${mode}`;
  resume.hidden = false;
}

// ——— Menus : principal (Continuer, Campagne, Battle) et Battle (les modes de bataille) ———
const mainMenu = document.querySelector<HTMLElement>('.garde__menu:not(#menu-battle)');
const battleMenu = document.querySelector<HTMLElement>('#menu-battle');

function showMenu(battle: boolean): void {
  if (!mainMenu || !battleMenu) return;
  mainMenu.hidden = battle;
  battleMenu.hidden = !battle;
  const first = battle
    ? battleMenu.querySelector<HTMLElement>('.action--primary')
    : document.querySelector<HTMLElement>(save ? '#continuer' : '#ouvrir-battle');
  first?.focus({ preventScroll: true });
}
document.querySelector('#ouvrir-battle')?.addEventListener('click', () => showMenu(true));
document.querySelector('#retour-menu')?.addEventListener('click', () => showMenu(false));

// Pas d'accès au menu sans compte : une partie en cours passe en premier, sinon « Battle ».
requireAccount(() => showMenu(false));

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
  /** Peuple de l'IA déjà choisi (défense de forteresse : reste la difficulté). */
  readonly rival?: PlayerId;
}

const DIFFICULTIES = [
  { id: 'facile', label: 'Facile', days: 10 },
  { id: 'normal', label: 'Normal', days: 15 },
  { id: 'difficile', label: 'Difficile', days: 20 },
] as const;

/** Carte de difficulté (défense de forteresse) : jours à tenir. */
function difficultyCard(label: string, days: number, href: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'peuple peuple--difficulte';
  link.href = href;
  const body = document.createElement('span');
  body.className = 'peuple__corps';
  const nom = document.createElement('span');
  nom.className = 'peuple__nom';
  nom.textContent = label;
  const texte = document.createElement('span');
  texte.className = 'peuple__texte';
  texte.textContent = `Tenir ton QG ${days} jours face aux vagues ennemies.`;
  body.append(nom, texte);
  link.append(body);
  link.setAttribute('aria-label', `${label}, tenir ${days} jours`);
  return link;
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
  if (next.duel && next.human && next.rival) {
    const { human, rival } = next;
    title.textContent = 'Choisis la difficulté';
    subtitle.textContent = `${name} · ${PEOPLE_CARDS[human].name} contre ${PEOPLE_CARDS[rival].name}`;
    back.hidden = false;
    grid.replaceChildren(
      ...DIFFICULTIES.map((level) =>
        difficultyCard(
          level.label,
          level.days,
          `${launch}&peuple=${human}&adversaire=${rival}&difficulte=${level.id}`,
        ),
      ),
    );
    if (!dialog.open) dialog.showModal();
    grid.querySelector<HTMLElement>('.peuple')?.focus();
    return;
  }
  if (next.duel && next.human) {
    const human = next.human;
    title.textContent = "Choisis le peuple de l'IA";
    subtitle.textContent = `${name} · tu joues ${PEOPLE_CARDS[human].name}`;
    ids = ALL_PEOPLES.filter((id) => id !== human);
    href = (id) => `${launch}&peuple=${human}&adversaire=${id}`;
  } else {
    title.textContent = 'Choisis ton peuple';
    // Tous les peuples : un peuple absent de la carte prend le premier camp (launch.ts).
    ids = ALL_PEOPLES;
    subtitle.textContent = next.duel
      ? `${name} · duel contre l'IA`
      : `${name} · toi contre ${MAPS[next.map].players.length - 1} IA`;
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
  if (!step?.duel || !id || step.rival) return;
  if (!step.human) {
    event.preventDefault();
    showStep({ ...step, human: id });
    return;
  }
  // Défense de forteresse : après le peuple de l'IA, le choix de la difficulté.
  if (MAPS[step.map].siege) {
    event.preventDefault();
    showStep({ ...step, rival: id });
  }
});
const stepBack = () => {
  if (!step) return;
  if (step.rival && step.human) showStep({ map: step.map, duel: step.duel, human: step.human });
  else showStep({ map: step.map, duel: step.duel });
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
// Échap dans le menu Battle : retour au menu principal.
const visibleActions = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '.garde__menu:not([hidden]) .action, .garde__menu:not([hidden]) .garde__retour',
    ),
  ].filter((element) => !element.hidden && !element.hasAttribute('disabled'));
document.addEventListener('keydown', (event) => {
  if (document.querySelector<HTMLDialogElement>('#compte')?.open) return;
  if (dialog?.open) {
    const cards = [...(grid?.querySelectorAll<HTMLElement>('.peuple') ?? [])];
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step || cards.length === 0) return;
    const current = cards.indexOf(document.activeElement as HTMLElement);
    cards[(current + step + cards.length) % cards.length]?.focus();
    event.preventDefault();
    return;
  }
  if (event.key === 'Escape' && battleMenu && !battleMenu.hidden) {
    showMenu(false);
    event.preventDefault();
    return;
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const actions = visibleActions();
  const current = actions.indexOf(document.activeElement as HTMLElement);
  const step = event.key === 'ArrowDown' ? 1 : -1;
  const next = actions[(current + step + actions.length) % actions.length];
  next?.focus();
  event.preventDefault();
});
