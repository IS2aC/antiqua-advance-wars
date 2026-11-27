import type { Screen } from '../config';

/**
 * Écran du jeu (`jeu.html`) : place disponible hors encoche, téléphone ou non, paysage
 * imposé sur téléphone, plein écran au premier toucher (là où le navigateur le permet).
 */

const isTouch = () => window.matchMedia('(pointer: coarse)').matches;
const isPortrait = () => window.matchMedia('(orientation: portrait)').matches;

/**
 * Place disponible : la zone `#game`, moins ses marges intérieures (`env(safe-area-inset-*)`
 * dans `jeu.html`, encoche et coins arrondis des téléphones).
 */
export function measureScreen(): Screen {
  const zone = document.getElementById('game');
  const style = zone ? getComputedStyle(zone) : null;
  const pad = (side: 'Left' | 'Right' | 'Top' | 'Bottom') =>
    style ? parseFloat(style[`padding${side}`]) || 0 : 0;
  const width = (zone?.clientWidth ?? window.innerWidth) - pad('Left') - pad('Right');
  const height = (zone?.clientHeight ?? window.innerHeight) - pad('Top') - pad('Bottom');
  return { width, height, dpr: window.devicePixelRatio || 1, touch: isTouch() };
}

/**
 * Sur téléphone, attend le paysage : en portrait, `jeu.html` affiche « Tourne ton
 * téléphone » (feuille de style) et le jeu ne démarre qu'une fois l'écran tourné, pour
 * choisir sa taille sur le bon écran.
 */
export function waitForLandscape(): Promise<void> {
  if (!isTouch() || !isPortrait()) return Promise.resolve();
  return new Promise((resolve) => {
    const query = window.matchMedia('(orientation: portrait)');
    const check = () => {
      if (query.matches) return;
      query.removeEventListener('change', check);
      // Laisser le navigateur finir de redimensionner la page.
      window.setTimeout(resolve, 150);
    };
    query.addEventListener('change', check);
  });
}

/**
 * Téléphone : le premier toucher passe en plein écran et verrouille le paysage (Android ;
 * l'iPhone n'a pas de plein écran pour les pages web, sauf jeu ajouté à l'écran d'accueil).
 */
export function fullscreenOnFirstTouch(): void {
  if (!isTouch() || !document.fullscreenEnabled) return;
  document.addEventListener(
    'pointerup',
    () => {
      if (document.fullscreenElement) return;
      document.documentElement
        .requestFullscreen({ navigationUI: 'hide' })
        .then(() => {
          const orientation = screen.orientation as ScreenOrientation & {
            lock?: (orientation: 'landscape') => Promise<void>;
          };
          return orientation.lock?.('landscape');
        })
        .catch(() => undefined);
    },
    { once: true },
  );
}
