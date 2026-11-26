/**
 * Accès à l'espace de jeu : tant que le joueur n'est pas connecté, la page de garde reste
 * floutée derrière le formulaire « Se connecter / Créer un compte ». Une fois connecté :
 * pseudo, nombre de joueurs en ligne et déconnexion en haut du panneau.
 */
import { fetchMe, login, logout, signup, watchPresence, type Player } from '../compte/api';

type Tab = 'connexion' | 'inscription';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);

export function requireAccount(onReady: () => void): void {
  const dialog = $<HTMLDialogElement>('#compte');
  const form = $<HTMLFormElement>('#compte-form');
  const garde = $<HTMLElement>('.garde');
  if (!dialog || !form || !garde) return;
  const error = $<HTMLElement>('#compte-erreur');
  const submit = $<HTMLButtonElement>('#compte-envoi');
  const pseudoField = $<HTMLElement>('#champ-pseudo');
  const passwordHelp = $<HTMLElement>('#aide-mdp');
  const title = $<HTMLElement>('#compte-titre');
  const password = form.elements.namedItem('motDePasse') as HTMLInputElement;
  const pseudo = form.elements.namedItem('pseudo') as HTMLInputElement;
  const email = form.elements.namedItem('email') as HTMLInputElement;
  let tab: Tab = 'connexion';
  let stopPresence: (() => void) | null = null;

  const setTab = (next: Tab) => {
    tab = next;
    const signingUp = next === 'inscription';
    for (const id of ['connexion', 'inscription'] as const) {
      $(`#onglet-${id}`)?.setAttribute('aria-selected', String(id === next));
    }
    if (pseudoField) pseudoField.hidden = !signingUp;
    if (passwordHelp) passwordHelp.hidden = !signingUp;
    pseudo.required = signingUp;
    password.autocomplete = signingUp ? 'new-password' : 'current-password';
    const label = signingUp ? 'Créer mon compte' : 'Se connecter';
    if (title) title.textContent = signingUp ? 'Créer un compte' : 'Connexion';
    const submitLabel = submit?.querySelector('.action__label');
    if (submitLabel) submitLabel.textContent = label;
    if (error) error.textContent = '';
    (signingUp ? pseudo : email).focus();
  };

  const lock = () => {
    garde.inert = true;
    garde.classList.add('garde--verrouillee');
    if (!dialog.open) dialog.showModal();
  };

  const unlock = (player: Player, online: number) => {
    garde.inert = false;
    garde.classList.remove('garde--verrouillee');
    dialog.close();
    const bar = $<HTMLElement>('#joueur');
    const name = $<HTMLElement>('#joueur-pseudo');
    if (name) name.textContent = player.pseudo;
    if (bar) bar.hidden = false;
    showOnline(online);
    stopPresence?.();
    stopPresence = watchPresence(showOnline);
    onReady();
  };

  const showOnline = (count: number) => {
    const node = $<HTMLElement>('#en-ligne-nombre');
    if (node) node.textContent = `${count} joueur${count > 1 ? 's' : ''} en ligne`;
  };

  $('#onglet-connexion')?.addEventListener('click', () => setTab('connexion'));
  $('#onglet-inscription')?.addEventListener('click', () => setTab('inscription'));
  // Le formulaire ne se ferme pas : pas d'accès au jeu sans compte.
  dialog.addEventListener('cancel', (event) => event.preventDefault());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (error) error.textContent = '';
    if (!form.reportValidity()) return;
    if (submit) submit.disabled = true;
    try {
      const result =
        tab === 'inscription'
          ? await signup(pseudo.value, email.value, password.value)
          : await login(email.value, password.value);
      password.value = '';
      const me = await fetchMe();
      unlock(result.joueur, me?.enLigne ?? 1);
    } catch (failure) {
      if (error) error.textContent = (failure as Error).message;
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  $('#deconnexion')?.addEventListener('click', async () => {
    stopPresence?.();
    stopPresence = null;
    await logout().catch(() => undefined);
    const bar = $<HTMLElement>('#joueur');
    if (bar) bar.hidden = true;
    lock();
    setTab('connexion');
  });

  lock();
  fetchMe().then(
    (me) => (me ? unlock(me.joueur, me.enLigne) : setTab('connexion')),
    (failure: Error) => {
      setTab('connexion');
      if (error) error.textContent = failure.message;
    },
  );
}
