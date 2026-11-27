/**
 * « Installer le jeu » : ajoute Alkébulan à l'écran d'accueil (manifeste
 * `public/manifest.webmanifest`). Installé, le jeu s'ouvre en plein écran, sans barre du
 * navigateur : c'est le seul moyen d'y arriver sur iPhone.
 *
 * - Android, ordinateur (Chrome, Edge) : le navigateur propose l'installation
 *   (`beforeinstallprompt`), le bouton l'ouvre.
 * - iPhone, iPad (Safari) : pas d'installation par le site ; le bouton explique le geste.
 */

/** Événement `beforeinstallprompt` (Chrome, Edge), absent des types du DOM. */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const installed = (): boolean =>
  window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches ||
  (navigator as { standalone?: boolean }).standalone === true;

const isApple = (): boolean =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  // iPad récent : se présente comme un Mac, mais tactile.
  (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

export function setupInstall(): void {
  const button = document.querySelector<HTMLButtonElement>('#installer');
  const help = document.querySelector<HTMLElement>('#installer-aide');
  if (!button || !help || installed()) return;

  let deferred: InstallPrompt | null = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as InstallPrompt;
    button.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    button.hidden = true;
    help.hidden = true;
  });

  if (isApple()) button.hidden = false;

  button.addEventListener('click', () => {
    if (deferred) {
      const prompt = deferred;
      deferred = null;
      void prompt.prompt().then(() => prompt.userChoice);
      button.hidden = true;
      return;
    }
    help.hidden = !help.hidden;
    button.setAttribute('aria-expanded', String(!help.hidden));
  });
}
