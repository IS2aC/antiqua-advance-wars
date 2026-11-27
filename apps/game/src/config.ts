/** Taille d'une case en pixels logiques. Constante unique : ne jamais coder 32 en dur ailleurs. */
export const TILE_SIZE = 32;

/**
 * Résolution logique du jeu : elle suit l'écran, dans ces limites (les cartes font 20 cases
 * de large). Ordinateur : jusqu'à 640×384 (20×12 cases) ; téléphone en paysage : moins de
 * cases, mais plus grandes au doigt.
 */
export const MAX_LOGICAL_WIDTH = TILE_SIZE * 20;
export const MAX_LOGICAL_HEIGHT = TILE_SIZE * 12;
/** Hauteur minimale (8 cases) : en dessous, le HUD cacherait la carte. */
export const MIN_LOGICAL_HEIGHT = TILE_SIZE * 8;
/** Taille visée d'une case à l'écran (pixels CSS) : au doigt, et à la souris. */
const TOUCH_TILE_CSS = 40;
const MOUSE_TILE_CSS = 32;

/**
 * Taille logique choisie au démarrage (`configureView`), lue par tout l'affichage. Les
 * modules qui en dépendent la lisent au moment de dessiner, jamais à leur chargement.
 */
export let LOGICAL_WIDTH = MAX_LOGICAL_WIDTH;
export let LOGICAL_HEIGHT = MAX_LOGICAL_HEIGHT;

export interface Screen {
  /** Place disponible, en pixels CSS (hors encoche). */
  readonly width: number;
  readonly height: number;
  /** Pixels physiques par pixel CSS (`devicePixelRatio`). */
  readonly dpr: number;
  /** Écran tactile (pointeur grossier). */
  readonly touch: boolean;
}

/**
 * Agrandissement en pixels PHYSIQUES : un pixel du jeu devient exactement `zoom × zoom`
 * pixels de l'écran, donc le pixel art reste net même quand le zoom en pixels CSS
 * (`zoom / dpr`) n'est pas entier. Un téléphone a 2 à 3 pixels physiques par pixel CSS :
 * on y gagne des cases plus grandes qu'avec un zoom entier en pixels CSS.
 */
export function chooseView(screen: Screen): { width: number; height: number; zoom: number } {
  const w = Math.floor(screen.width * screen.dpr);
  const h = Math.floor(screen.height * screen.dpr);
  const tile = screen.touch ? TOUCH_TILE_CSS : MOUSE_TILE_CSS;
  const view = (zoom: number) => ({
    width: Math.min(Math.floor(w / zoom), MAX_LOGICAL_WIDTH),
    height: Math.min(Math.floor(h / zoom), MAX_LOGICAL_HEIGHT),
    zoom,
  });
  /** Part de l'écran remplie (le reste : bandes noires). */
  const coverage = (zoom: number) => {
    const v = view(zoom);
    return (v.width * zoom * v.height * zoom) / (w * h);
  };
  // Zoom minimal pour des cases assez grandes, maximal pour garder 8 cases de haut.
  const zoomForTiles = Math.max(1, Math.ceil((tile * screen.dpr) / TILE_SIZE));
  const zoomForHeight = Math.max(1, Math.floor(h / MIN_LOGICAL_HEIGHT));
  if (zoomForTiles >= zoomForHeight) return view(zoomForHeight);
  // Entre les deux : le plus petit zoom qui remplit presque l'écran (le plus de carte
  // visible), sinon celui qui le remplit le mieux.
  let best = zoomForTiles;
  for (let zoom = zoomForTiles; zoom <= zoomForHeight; zoom++) {
    if (coverage(zoom) >= 0.85) return view(zoom);
    if (coverage(zoom) > coverage(best)) best = zoom;
  }
  return view(best);
}

/** Fixe la taille logique (une fois, avant de lancer Phaser). */
export function configureView(width: number, height: number): void {
  LOGICAL_WIDTH = width;
  LOGICAL_HEIGHT = height;
}

/**
 * Zoom d'affichage (pixels CSS par pixel du jeu) quand la fenêtre change : le plus grand
 * agrandissement entier en pixels physiques qui tient ; sinon (fenêtre plus petite que le
 * jeu) on réduit, flou plutôt que coupé.
 */
export function displayZoom(screen: Screen): number {
  const fit = Math.min(
    (screen.width * screen.dpr) / LOGICAL_WIDTH,
    (screen.height * screen.dpr) / LOGICAL_HEIGHT,
  );
  return (fit >= 1 ? Math.floor(fit) : fit) / screen.dpr;
}

export const BACKGROUND_COLOR = '#1a1410';

/** Durée d'un pas de déplacement, case par case (ms). */
export const MOVE_STEP_MS = 80;
