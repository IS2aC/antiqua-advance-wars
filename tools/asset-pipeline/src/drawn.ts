/**
 * Combats dessinés (prototype) : traitement des grandes illustrations générées par IA.
 *
 * Fonctions pures, testées : détourage du fond (transparent, uni ou damier), découpe d'une
 * planche en poses ou en portraits, cadrage. Le lancement est dans `drawn-build.ts`.
 * Gabarits et prompts : docs/proto-combat.md.
 */
import { hexToRgb, rgbToHsv, type Rgb } from './color';
import type { Box, RgbaImage } from './image';

/** Poses d'une planche de personnage, de gauche à droite. */
export const DRAWN_POSES = ['idle', 'attack', 'hit', 'down'] as const;
export type DrawnPose = (typeof DRAWN_POSES)[number];

/** Expressions d'une planche de portraits, de gauche à droite. */
export const DRAWN_EXPRESSIONS = ['neutral', 'shout', 'hurt', 'smile'] as const;

/** Hauteur de la pose de repos après mise à l'échelle (les autres poses suivent la même échelle). */
export const FIGURE_IDLE_HEIGHT = 420;
/** Côté d'un portrait. */
export const PORTRAIT_SIZE = 256;
/** Décor : la résolution de la scène dessinée (5:3, comme la carte). */
export const DRAWN_DECOR_W = 1920;
export const DRAWN_DECOR_H = 1152;

/** Seuil d'opacité au-delà duquel un pixel compte comme « dessiné ». */
const SOLID = 32;

/**
 * `people` vaut `null` pour une planche commune (`unites/<unité>/`), dessinée une seule fois
 * en rouge puis recolorée pour chaque peuple, comme les sprites de la carte.
 */
export type DrawnFile =
  | { kind: 'figure'; people: string | null; unit: string }
  | { kind: 'sequence'; people: string | null; unit: string; sheet: SequenceSheet }
  | { kind: 'portrait'; people: string }
  | { kind: 'decor'; name: string };

/**
 * Planches de séquences (16 dessins par unité) : 4 planches de 4 images, chacune découpée
 * en une ou deux animations. Gabarits et prompts : docs/proto-combat.md.
 */
export const SEQUENCE_SHEETS = {
  repos: [{ anim: 'idle', from: 0, count: 4 }],
  attaque: [{ anim: 'attack', from: 0, count: 4 }],
  charge: [
    { anim: 'run', from: 0, count: 2 },
    { anim: 'hit', from: 2, count: 2 },
  ],
  chute: [
    { anim: 'fall', from: 0, count: 2 },
    { anim: 'victory', from: 2, count: 2 },
  ],
  // Vaincu sonné : il tombe assis (2 images), puis vacille, étourdi (2 images en boucle).
  // Les deux parties sont calées sur la même image (assis) : la première est en l'air.
  sonne: [
    { anim: 'sit', from: 0, count: 2, anchorFrom: 1 },
    { anim: 'dazed', from: 2, count: 2, anchorFrom: 1 },
  ],
} as const;
export type SequenceSheet = keyof typeof SEQUENCE_SHEETS;
/** Images par planche de séquence. */
export const SEQUENCE_CELLS = 4;

/** Planches d'une unité, dans l'ordre : les 4 poses de référence, puis les séquences. */
export const UNIT_SHEETS = ['poses', ...(Object.keys(SEQUENCE_SHEETS) as SequenceSheet[])] as const;

/**
 * Chemin (relatif au dossier des combats dessinés) → rôle :
 * - `unites/<unité>/poses.png` et `unites/<unité>/<planche>.png` : planches communes aux
 *   4 peuples (rouge d'équipe, recolorées au build) ;
 * - `peuples/<peuple>/<unité>/poses.png` : les 4 poses de référence propres à un peuple
 *   (d'après ses sprites, en rouge d'équipe, prioritaires sur la planche commune) ;
 * - `peuples/<peuple>/<unité>/<planche>.png` : une séquence (repos, attaque, charge, chute, sonne) ;
 * - `portraits/<peuple>.png` : 4 expressions ;
 * - `decors/<nom>.png` : un décor.
 */
export function classifyDrawnPath(
  path: string,
  peoples: readonly string[],
  units: readonly string[],
): DrawnFile | null {
  const parts = path
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/\.(png|jpe?g|webp)$/, '')
    .split('/');
  const [root, a, b, c] = parts;
  if (root === 'decors' && parts.length === 2 && a) return { kind: 'decor', name: a };
  if (root === 'portraits' && parts.length === 2 && a && peoples.includes(a)) {
    return { kind: 'portrait', people: a };
  }
  if (root === 'unites' && parts.length === 3 && a && b && units.includes(a)) {
    if (b === 'poses') return { kind: 'figure', people: null, unit: a };
    if (b in SEQUENCE_SHEETS) {
      return { kind: 'sequence', people: null, unit: a, sheet: b as SequenceSheet };
    }
    return null;
  }
  if (root !== 'peuples' || parts.length !== 4 || !a || !b || !c) return null;
  if (!peoples.includes(a) || !units.includes(b)) return null;
  if (c === 'poses') return { kind: 'figure', people: a, unit: b };
  if (c in SEQUENCE_SHEETS) {
    return { kind: 'sequence', people: a, unit: b, sheet: c as SequenceSheet };
  }
  return null;
}

/** Libellés des planches dans la liste « à faire ». */
const SHEET_LABELS: Readonly<Record<string, string>> = {
  poses: 'poses',
  repos: 'repos',
  attaque: 'attaque',
  charge: 'charge',
  chute: 'chute',
  sonne: 'sonné',
};

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * Liste de ce qui reste à dessiner (`A-FAIRE.md`), à partir des chemins présents (sans
 * extension, par exemple `unites/archers/repos`).
 */
export function todoReport(
  present: ReadonlySet<string>,
  peoples: readonly string[],
  units: readonly string[],
): string {
  const total = units.length * UNIT_SHEETS.length;
  let done = 0;
  const rows: string[] = [];
  const overrides: string[] = [];
  for (const unit of units) {
    const cells = UNIT_SHEETS.map((sheet) => {
      const shared = present.has(`unites/${unit}/${sheet}`);
      if (shared) done++;
      const own = peoples.filter((people) => present.has(`peuples/${people}/${unit}/${sheet}`));
      for (const people of own) overrides.push(`peuples/${people}/${unit}/${sheet}`);
      return shared ? '✅' : own.length > 0 ? `(${own.map(capitalize).join(', ')})` : '·';
    });
    rows.push(`| ${capitalize(unit)} | ${cells.join(' | ')} |`);
  }
  const portraits = peoples.map(
    (people) => `${present.has(`portraits/${people}`) ? '✅' : '·'} ${capitalize(people)}`,
  );
  const decors = [...present]
    .filter((path) => path.startsWith('decors/'))
    .map((path) => path.slice('decors/'.length))
    .sort();
  return [
    '# Combats dessinés — ce qui reste à dessiner',
    '',
    '> Fichier généré par `pnpm assets:dessin` : ne pas le modifier à la main.',
    '> Génération automatique : `pnpm art:generer` (fiches dans `art/specs/`, règles dans `docs/proto-combat.md`).',
    '',
    `**Planches communes : ${done} / ${total}** · portraits : ${portraits.filter((p) => p.startsWith('✅')).length} / ${peoples.length} · décors : ${decors.length}`,
    '',
    'Comme les sprites de la carte, chaque unité est dessinée une seule fois, en rouge, dans',
    '`unites/<unité>/` (6 fichiers aux noms fixes), puis recolorée pour chaque peuple.',
    'Entre parenthèses : une planche propre à un peuple, sans version commune.',
    '',
    `| Unité | ${UNIT_SHEETS.map((sheet) => SHEET_LABELS[sheet] ?? sheet).join(' | ')} |`,
    `| --- | ${UNIT_SHEETS.map(() => ':---:').join(' | ')} |`,
    ...rows,
    '',
    '## Planches propres à un peuple (`peuples/<peuple>/<unité>/`)',
    '',
    'Prioritaires sur la planche commune pour ce peuple ; dessinées en rouge et recolorées elles aussi.',
    '',
    overrides.length > 0 ? overrides.map((path) => `- \`${path}\``).join('\n') : 'aucune',
    '',
    '## Portraits (`portraits/<peuple>.png`)',
    '',
    portraits.join(' · '),
    '',
    '## Décors (`decors/<nom>.png`)',
    '',
    decors.length > 0 ? decors.join(' · ') : 'aucun',
    '',
  ].join('\n');
}

// ——— Couleur d'équipe ———

/** Rampe d'équipe, du plus sombre au plus clair. */
export type TeamRamp = readonly [Rgb, Rgb, Rgb, Rgb];

export const toRamp = (hexes: readonly [string, string, string, string]): TeamRamp =>
  hexes.map(hexToRgb) as unknown as TeamRamp;

/**
 * Part « rouge d'équipe » d'un pixel, de 0 à 1 : 1 pour un rouge franc et saturé, 0 pour la
 * peau cuivrée, l'or, le bois et la crème (plus orangés ou moins saturés), avec une
 * transition douce pour les bords adoucis entre deux couleurs.
 */
export function teamWeight(r: number, g: number, b: number): number {
  const { h, s, v } = rgbToHsv([r, g, b]);
  const hueGap = h > 180 ? 360 - h : h;
  const hue = hueGap <= 10 ? 1 : hueGap >= 16 ? 0 : (16 - hueGap) / 6;
  const sat = s >= 0.55 ? 1 : s <= 0.35 ? 0 : (s - 0.35) / 0.2;
  return v >= 0.18 ? hue * sat : 0;
}

const luma = ([r, g, b]: Rgb) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Couleur de la rampe `to` à la place qu'occupe la luminosité `l` sur la rampe `from`. */
function rampAt(from: TeamRamp, to: TeamRamp, l: number): Rgb {
  const stops = from.map(luma);
  const first = stops[0] ?? 0;
  const last = stops[stops.length - 1] ?? 255;
  // Plus sombre que la rampe : on assombrit le ton le plus sombre ; plus clair : on éclaircit.
  if (l <= first) return to[0].map((c) => (c * l) / Math.max(1, first)) as unknown as Rgb;
  if (l >= last) {
    const k = (l - last) / Math.max(1, 255 - last);
    return to[3].map((c) => c + (255 - c) * k) as unknown as Rgb;
  }
  let i = 0;
  while (i < stops.length - 2 && l > (stops[i + 1] ?? 0)) i++;
  const a = stops[i] ?? 0;
  const b = stops[i + 1] ?? 255;
  const t = (l - a) / Math.max(1, b - a);
  const ca = to[i] as Rgb;
  const cb = to[i + 1] as Rgb;
  return [0, 1, 2].map((k) => (ca[k] ?? 0) + ((cb[k] ?? 0) - (ca[k] ?? 0)) * t) as unknown as Rgb;
}

/**
 * Recolore les rouges d'équipe d'un dessin vers la rampe d'un peuple, en gardant les ombres
 * et les lumières (par luminosité) ; le reste du dessin ne bouge pas.
 */
export function recolorTeam(image: RgbaImage, from: TeamRamp, to: TeamRamp): RgbaImage {
  const data = new Uint8ClampedArray(image.data);
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) === 0) continue;
    const pixel: Rgb = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
    const w = teamWeight(...pixel);
    if (w === 0) continue;
    const target = rampAt(from, to, luma(pixel));
    for (let k = 0; k < 3; k++) {
      data[i + k] = Math.round((pixel[k] ?? 0) * (1 - w) + (target[k] ?? 0) * w);
    }
  }
  return { width: image.width, height: image.height, data };
}

// ——— Détourage ———

type Color = readonly [number, number, number];

function colorAt(image: RgbaImage, i: number): Color {
  return [image.data[i * 4] ?? 0, image.data[i * 4 + 1] ?? 0, image.data[i * 4 + 2] ?? 0];
}

function distance(a: Color, b: Color): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** L'image a-t-elle déjà un vrai fond transparent (plus de 2 % de pixels transparents) ? */
export function hasTransparency(image: RgbaImage): boolean {
  let transparent = 0;
  const total = image.width * image.height;
  for (let i = 0; i < total; i++) if ((image.data[i * 4 + 3] ?? 255) < 250) transparent++;
  return transparent > total * 0.02;
}

/**
 * Couleurs du fond, lues dans les quatre coins de l'image (pas sur tout le bord : une cape
 * de portrait touche souvent le bas). Une couleur (fond uni, magenta) ou plusieurs (faux
 * damier de transparence). Les couleurs proches sont regroupées ; une couleur rare dans les
 * coins (moins de 10 %) n'est pas du fond.
 */
export function borderColors(image: RgbaImage): Color[] {
  const { width, height } = image;
  const patch = Math.max(1, Math.min(24, Math.floor(Math.min(width, height) / 4)));
  const clusters: { color: Color; count: number }[] = [];
  const visit = (x: number, y: number) => {
    const color = colorAt(image, y * width + x);
    const cluster = clusters.find((c) => distance(c.color, color) < 12);
    if (cluster) cluster.count++;
    else clusters.push({ color, count: 1 });
  };
  for (const [cx, cy] of [
    [0, 0],
    [width - patch, 0],
    [0, height - patch],
    [width - patch, height - patch],
  ] as const) {
    for (let y = cy; y < cy + patch; y++) for (let x = cx; x < cx + patch; x++) visit(x, y);
  }
  const samples = 4 * patch * patch;
  return clusters
    .filter((cluster) => cluster.count >= samples * 0.1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((cluster) => cluster.color);
}

/**
 * Retire le fond : si l'image est déjà transparente, rien à faire ; sinon, remplissage
 * depuis les bords sur les pixels proches des couleurs du fond (le blanc d'une tunique,
 * entouré par le contour du personnage, n'est jamais touché). Les pixels de bordure à
 * demi proches deviennent semi-transparents (bord adouci).
 */
export function removeBackground(
  image: RgbaImage,
  options: { readonly pockets?: boolean } = {},
): RgbaImage {
  if (hasTransparency(image)) return image;
  const { width, height } = image;
  const background = borderColors(image);
  const data = new Uint8ClampedArray(image.data);
  const near = (i: number) =>
    Math.min(...background.map((color) => distance(color, colorAt(image, i))));
  const HARD = 48;
  const SOFT = 96;
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (seen[i]) return;
    seen[i] = 1;
    if (near(i) < HARD) stack.push(i);
    else if (near(i) < SOFT) {
      // Bord : à moitié fond, à moitié dessin.
      const alpha = Math.round(((near(i) - HARD) / (SOFT - HARD)) * 255);
      data[i * 4 + 3] = Math.min(data[i * 4 + 3] ?? 255, alpha);
    }
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length > 0) {
    const i = stack.pop() as number;
    data[i * 4 + 3] = 0;
    const x = i % width;
    const y = (i - x) / width;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  if (options.pockets) removePockets(image, data, background, HARD);
  return { width, height, data };
}

/**
 * Poches de fond enfermées dans le dessin (entre l'arc et la corde, sous un bras) : le
 * remplissage depuis les bords ne les atteint pas. On les retire quand on est sûr que
 * c'est du fond : une grande zone (au moins 0,03 % de l'image) dont presque tous les pixels
 * ont exactement la couleur du fond (une tunique crème en reste loin), ou n'importe quelle
 * zone d'un fond très saturé comme le magenta, absent du dessin. Réservé aux personnages :
 * sur un portrait, les dents ou le blanc des yeux pourraient y ressembler.
 */
function removePockets(
  image: RgbaImage,
  data: Uint8ClampedArray,
  background: readonly Color[],
  hard: number,
): void {
  const { width, height } = image;
  const saturated = background.length === 1 && saturation(background[0] as Color) > 150;
  const minSize = Math.max(64, width * height * 0.0003);
  const EXACT = 20;
  const nearest = (i: number): number => {
    let best = -1;
    let bestDistance = hard;
    background.forEach((color, k) => {
      const d = distance(color, colorAt(image, i));
      if (d < bestDistance) {
        bestDistance = d;
        best = k;
      }
    });
    return best;
  };
  const visited = new Uint8Array(width * height);
  for (let start = 0; start < width * height; start++) {
    if (visited[start] || (data[start * 4 + 3] ?? 0) === 0 || nearest(start) < 0) continue;
    const component: number[] = [];
    let exact = 0;
    const stack = [start];
    visited[start] = 1;
    while (stack.length > 0) {
      const i = stack.pop() as number;
      component.push(i);
      const closest = Math.min(...background.map((color) => distance(color, colorAt(image, i))));
      if (closest < EXACT) exact++;
      const x = i % width;
      const y = (i - x) / width;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (visited[n] || (data[n * 4 + 3] ?? 0) === 0 || nearest(n) < 0) continue;
        visited[n] = 1;
        stack.push(n);
      }
    }
    const isBackground =
      saturated || (component.length >= minSize && exact >= component.length * 0.85);
    if (isBackground) for (const i of component) data[i * 4 + 3] = 0;
  }
}

function saturation(color: Color): number {
  return Math.max(...color) - Math.min(...color);
}

// ——— Découpe ———

/** Colonnes contenant du dessin (au moins 2 pixels opaques). */
function occupiedColumns(image: RgbaImage, region: Box): boolean[] {
  const columns: boolean[] = [];
  for (let x = region.x; x < region.x + region.w; x++) {
    let count = 0;
    for (let y = region.y; y < region.y + region.h; y++) {
      if ((image.data[(y * image.width + x) * 4 + 3] ?? 0) > SOLID) count++;
      if (count >= 2) break;
    }
    columns.push(count >= 2);
  }
  return columns;
}

/**
 * Découpe une planche en `count` morceaux de gauche à droite, en suivant les colonnes
 * vides entre les dessins. Trop de morceaux (une lance détachée) : on fusionne les voisins
 * les plus proches. Pas assez (deux poses qui se touchent) : colonnes égales.
 */
export function splitColumns(image: RgbaImage, count: number): Box[] {
  const full: Box = { x: 0, y: 0, w: image.width, h: image.height };
  const columns = occupiedColumns(image, full);
  let runs: { start: number; end: number }[] = [];
  let start = -1;
  columns.forEach((filled, x) => {
    if (filled && start < 0) start = x;
    if (!filled && start >= 0) {
      runs.push({ start, end: x });
      start = -1;
    }
  });
  if (start >= 0) runs.push({ start, end: columns.length });
  // Miettes (moins de 1 % de la largeur) : bruit, ignorées.
  runs = runs.filter((run) => run.end - run.start >= image.width * 0.01);

  while (runs.length > count) {
    let best = 0;
    for (let i = 1; i < runs.length - 1; i++) {
      const gap = (runs[i + 1]?.start ?? 0) - (runs[i]?.end ?? 0);
      const bestGap = (runs[best + 1]?.start ?? 0) - (runs[best]?.end ?? 0);
      if (gap < bestGap) best = i;
    }
    const a = runs[best];
    const b = runs[best + 1];
    if (!a || !b) break;
    runs.splice(best, 2, { start: a.start, end: b.end });
  }

  if (runs.length < count) {
    const w = Math.floor(image.width / count);
    return Array.from({ length: count }, (_, i) =>
      trimBox(image, { x: i * w, y: 0, w, h: image.height }),
    );
  }
  return runs.map((run) =>
    trimBox(image, { x: run.start, y: 0, w: run.end - run.start, h: image.height }),
  );
}

/** Plus petit cadre contenant tout le dessin de la zone (la zone elle-même si elle est vide). */
export function trimBox(image: RgbaImage, region: Box): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let y = region.y; y < region.y + region.h; y++) {
    for (let x = region.x; x < region.x + region.w; x++) {
      if ((image.data[(y * image.width + x) * 4 + 3] ?? 0) > SOLID) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return region;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Échelle commune des poses : la pose de repos mesure FIGURE_IDLE_HEIGHT pixels. */
export function figureScale(boxes: readonly Box[]): number {
  const idle = boxes[0];
  if (!idle || idle.h === 0) return 1;
  return FIGURE_IDLE_HEIGHT / idle.h;
}

/** Échelle commune des portraits : le plus grand tient dans PORTRAIT_SIZE. */
export function portraitScale(boxes: readonly Box[]): number {
  const largest = Math.max(1, ...boxes.map((box) => Math.max(box.w, box.h)));
  return PORTRAIT_SIZE / largest;
}

// ——— Séquences ———

/**
 * Abscisse moyenne des pieds : les pixels dessinés dans le bas du cadre (6 %), sans les
 * appuis trop fins (hampe de lance posée au sol, pointe d'arme) : seuls comptent les
 * morceaux d'au moins 40 % de la largeur du plus large, c'est-à-dire les pieds.
 */
export function feetCenterX(image: RgbaImage, box: Box): number {
  const rows = Math.max(3, Math.round(box.h * 0.06));
  const columns: number[] = [];
  for (let x = box.x; x < box.x + box.w; x++) {
    let count = 0;
    for (let y = box.y + box.h - rows; y < box.y + box.h; y++) {
      if ((image.data[(y * image.width + x) * 4 + 3] ?? 0) > SOLID) count++;
    }
    columns.push(count);
  }
  const runs: { start: number; end: number; weight: number }[] = [];
  columns.forEach((count, i) => {
    const last = runs[runs.length - 1];
    if (count === 0) return;
    if (last && last.end === i) {
      last.end = i + 1;
      last.weight += count;
    } else runs.push({ start: i, end: i + 1, weight: count });
  });
  if (runs.length === 0) return box.x + box.w / 2;
  const widest = Math.max(...runs.map((run) => run.end - run.start));
  let sum = 0;
  let weight = 0;
  for (const run of runs) {
    if (run.end - run.start < widest * 0.4) continue;
    for (let i = run.start; i < run.end; i++) {
      sum += (box.x + i) * (columns[i] ?? 0);
      weight += columns[i] ?? 0;
    }
  }
  return weight > 0 ? sum / weight : box.x + box.w / 2;
}

export interface PlacedFrame {
  /** Le dessin, séparé de ses voisins. */
  readonly frame: SeparatedFrame;
  /** Sa place dans le cadre commun de l'animation (pixels source). */
  readonly dx: number;
  readonly dy: number;
}

export interface SequenceLayout {
  readonly anim: string;
  /** Cadre commun à toutes les images de l'animation (pixels source). */
  readonly width: number;
  readonly height: number;
  /** Point d'ancrage (pieds de la première image), en fraction du cadre. */
  readonly originX: number;
  readonly originY: number;
  readonly frames: readonly PlacedFrame[];
}

/**
 * Mise en page d'une animation tirée d'une planche « caméra fixe » : chaque dessin garde sa
 * position dans sa case (le mouvement d'une image à l'autre est celui dessiné), toutes les
 * images partagent un même cadre, et l'ancrage est pris aux pieds de la première image.
 * `frames` : les dessins séparés (un par case), `cellWidth` : largeur d'une case.
 */
export function layoutSequence(
  frames: readonly SeparatedFrame[],
  cellWidth: number,
  group: {
    readonly anim: string;
    readonly from: number;
    readonly count: number;
    /** Image de la planche qui sert de repère (par défaut, la première de l'animation). */
    readonly anchorFrom?: number;
  },
): SequenceLayout {
  const local = Array.from({ length: group.count }, (_, k) => {
    const i = group.from + k;
    const frame = frames[i] ?? {
      box: { x: i * cellWidth, y: 0, w: 1, h: 1 },
      pixels: { width: 1, height: 1, data: new Uint8ClampedArray(4) },
    };
    return { frame, x: frame.box.x - i * cellWidth, y: frame.box.y };
  });
  const minX = Math.min(...local.map((f) => f.x));
  const minY = Math.min(...local.map((f) => f.y));
  const maxX = Math.max(...local.map((f) => f.x + f.frame.box.w));
  const maxY = Math.max(...local.map((f) => f.y + f.frame.box.h));
  // Repère : une image de la planche, dans les coordonnées de sa case (comme les autres).
  const anchorIndex = group.anchorFrom ?? group.from;
  const anchorFrame = frames[anchorIndex];
  const anchorX = anchorFrame
    ? anchorFrame.box.x -
      anchorIndex * cellWidth +
      feetCenterX(anchorFrame.pixels, {
        x: 0,
        y: 0,
        w: anchorFrame.box.w,
        h: anchorFrame.box.h,
      })
    : minX;
  const anchorY = anchorFrame ? anchorFrame.box.y + anchorFrame.box.h : maxY;
  const width = maxX - minX;
  const height = maxY - minY;
  return {
    anim: group.anim,
    width,
    height,
    originX: (anchorX - minX) / width,
    originY: (anchorY - minY) / height,
    frames: local.map((f) => ({ frame: f.frame, dx: f.x - minX, dy: f.y - minY })),
  };
}

// ——— Séparation des dessins ———

export interface SeparatedFrame {
  /** Cadre du dessin dans la planche. */
  readonly box: Box;
  /** Le dessin seul (sans les morceaux des voisins), à la taille du cadre. */
  readonly pixels: RgbaImage;
}

/**
 * Sépare une planche en `count` dessins de gauche à droite, même quand ils se touchent ou
 * que leurs cadres se chevauchent (traits de vitesse, cape, lance qui dépasse) : chaque
 * gros morceau de dessin (pixels non transparents reliés entre eux) va à la case où tombe
 * son centre ; un petit morceau détaché (bout de lance coupé par le bouclier ou la main,
 * lance lâchée) suit le gros morceau le plus proche, même s'il déborde chez le voisin.
 * Chaque dessin ne garde que ses propres pixels : pas de pied ni de cape du voisin.
 */
export function separateFrames(image: RgbaImage, count: number): SeparatedFrame[] {
  const { width, height, data } = image;
  const labels = new Int32Array(width * height).fill(-1);
  const owner: number[] = [];
  const parts: { size: number; minX: number; maxX: number; minY: number; maxY: number }[] = [];
  const cellWidth = width / count;
  const stack: number[] = [];
  let next = 0;
  for (let start = 0; start < width * height; start++) {
    if (labels[start] !== -1 || (data[start * 4 + 3] ?? 0) === 0) continue;
    const label = next++;
    labels[start] = label;
    stack.push(start);
    let sumX = 0;
    let pixels = 0;
    const part = { size: 0, minX: width, maxX: -1, minY: height, maxY: -1 };
    while (stack.length > 0) {
      const i = stack.pop() as number;
      const x = i % width;
      const y = (i - x) / width;
      sumX += x;
      pixels++;
      if (x < part.minX) part.minX = x;
      if (x > part.maxX) part.maxX = x;
      if (y < part.minY) part.minY = y;
      if (y > part.maxY) part.maxY = y;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (labels[n] !== -1 || (data[n * 4 + 3] ?? 0) === 0) continue;
        labels[n] = label;
        stack.push(n);
      }
    }
    owner[label] = Math.min(count - 1, Math.max(0, Math.floor(sumX / pixels / cellWidth)));
    part.size = pixels;
    parts[label] = part;
  }

  // Petits morceaux détachés : rattachés au gros morceau le plus proche (écart entre cadres).
  const largest = Math.max(0, ...parts.map((p) => p.size));
  const big = parts.flatMap((p, label) => (p.size >= largest * 0.2 ? [label] : []));
  const gap = (a: (typeof parts)[number], b: (typeof parts)[number]) =>
    Math.hypot(
      Math.max(0, a.minX - b.maxX, b.minX - a.maxX),
      Math.max(0, a.minY - b.maxY, b.minY - a.maxY),
    );
  parts.forEach((part, label) => {
    if (part.size >= largest * 0.2) return;
    let best = -1;
    let bestGap = Infinity;
    for (const other of big) {
      const d = gap(part, parts[other] as (typeof parts)[number]);
      if (d < bestGap) {
        bestGap = d;
        best = other;
      }
    }
    if (best >= 0) owner[label] = owner[best] ?? owner[label] ?? 0;
  });

  const boxes = Array.from({ length: count }, () => ({
    minX: Infinity,
    minY: Infinity,
    maxX: -1,
    maxY: -1,
  }));
  for (let i = 0; i < width * height; i++) {
    const label = labels[i] ?? -1;
    if (label < 0) continue;
    const b = boxes[owner[label] ?? 0];
    if (!b) continue;
    const x = i % width;
    const y = (i - x) / width;
    if (x < b.minX) b.minX = x;
    if (x > b.maxX) b.maxX = x;
    if (y < b.minY) b.minY = y;
    if (y > b.maxY) b.maxY = y;
  }

  return boxes.map((b, frame) => {
    if (b.maxX < 0) {
      const box = { x: Math.round(frame * cellWidth), y: 0, w: 1, h: 1 };
      return { box, pixels: { width: 1, height: 1, data: new Uint8ClampedArray(4) } };
    }
    const box = { x: b.minX, y: b.minY, w: b.maxX - b.minX + 1, h: b.maxY - b.minY + 1 };
    const out = new Uint8ClampedArray(box.w * box.h * 4);
    for (let y = 0; y < box.h; y++) {
      for (let x = 0; x < box.w; x++) {
        const i = (box.y + y) * width + box.x + x;
        const label = labels[i] ?? -1;
        if (label < 0 || owner[label] !== frame) continue;
        out.set(data.subarray(i * 4, i * 4 + 4), (y * box.w + x) * 4);
      }
    }
    return { box, pixels: { width: box.w, height: box.h, data: out } };
  });
}
