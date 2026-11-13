/**
 * Page de garde : propose de reprendre la partie sauvegardée (si elle existe) et mène au
 * jeu (`jeu.html`) avec le mode choisi. Aucune dépendance à Phaser : la page reste légère.
 */
import { loadGame } from '../persistence/save';
import './garde.css';

const save = loadGame();
const resume = document.querySelector<HTMLAnchorElement>('#continuer');
const detail = document.querySelector<HTMLElement>('#continuer-detail');

if (save && resume && detail) {
  const mode = save.aiPlayers.length > 0 ? "contre l'IA" : 'à deux';
  detail.textContent = `Jour ${save.state.day} · ${mode}`;
  resume.hidden = false;
}

// Une partie en cours passe en premier ; sinon « Nouvelle partie ».
const first = document.querySelector<HTMLElement>(save ? '#continuer' : '.action--primary');
first?.focus({ preventScroll: true });

// Navigation au clavier dans le menu : flèches haut et bas.
const actions = [...document.querySelectorAll<HTMLElement>('.garde__menu .action')].filter(
  (element) => !element.hidden && !element.hasAttribute('disabled'),
);
document.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const current = actions.indexOf(document.activeElement as HTMLElement);
  const step = event.key === 'ArrowDown' ? 1 : -1;
  const next = actions[(current + step + actions.length) % actions.length];
  next?.focus();
  event.preventDefault();
});
