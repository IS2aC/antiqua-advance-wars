/**
 * Contrôles automatiques d'une image générée, avant de l'accepter (sinon on régénère).
 * Fonctions pures, testées. Ils reprennent ce qu'on vérifiait à l'œil : 4 dessins bien
 * séparés, rien de coupé, pieds alignés, même taille que la référence, couleur d'équipe
 * présente (sinon la recoloration par peuple ne marche pas).
 */
import {
  SEQUENCE_CELLS,
  removeBackground,
  separateFrames,
  splitColumns,
  teamWeight,
} from '../drawn';
import type { Box, RgbaImage } from '../image';
import type { UnitSheet } from './specs';

export interface CheckResult {
  readonly ok: boolean;
  /** Défauts bloquants : l'image est régénérée. */
  readonly problems: readonly string[];
  /** Remarques sans gravité, affichées sur la page de validation. */
  readonly notes: readonly string[];
  /** Correction d'échelle à écrire dans `reglages.json` (planche de repos seulement). */
  readonly scale?: number;
}

const SOLID = 32;

/** Dessins où le personnage est debout : leurs pieds doivent être sur la même ligne. */
const STANDING: Readonly<Record<UnitSheet, readonly number[]>> = {
  poses: [0, 1, 2],
  repos: [0, 1, 2, 3],
  attaque: [0, 1, 2, 3],
  charge: [0, 2],
  chute: [2, 3],
  sonne: [2, 3],
};

function solidPixels(image: RgbaImage): number {
  let count = 0;
  for (let i = 3; i < image.data.length; i += 4) if ((image.data[i] ?? 0) > SOLID) count++;
  return count;
}

/** Part des pixels dessinés qui sont du rouge d'équipe franc. */
export function teamShare(image: RgbaImage): number {
  let team = 0;
  let total = 0;
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    if ((d[i + 3] ?? 0) <= SOLID) continue;
    total++;
    if (teamWeight(d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0) > 0.5) team++;
  }
  return total === 0 ? 0 : team / total;
}

const touchesEdge = (box: Box, image: RgbaImage, margin = 2) =>
  box.x <= margin ||
  box.y <= margin ||
  box.x + box.w >= image.width - margin ||
  box.y + box.h >= image.height - margin;

/** Hauteur du premier dessin (repos) d'une planche de poses : la référence de taille. */
export function idleHeight(image: RgbaImage): number {
  const frames = separateFrames(removeBackground(image, { pockets: true }), SEQUENCE_CELLS);
  return frames[0]?.box.h ?? 0;
}

export function checkUnitSheet(
  source: RgbaImage,
  sheet: UnitSheet,
  referenceIdleHeight: number | null,
): CheckResult {
  const problems: string[] = [];
  const notes: string[] = [];
  const image = removeBackground(source, { pockets: true });
  const area = image.width * image.height;
  const drawn = solidPixels(image);
  if (drawn > 0.6 * area) {
    return { ok: false, problems: ['fond non détouré (pas de fond blanc uni)'], notes };
  }
  const frames = separateFrames(image, SEQUENCE_CELLS);
  const sizes = frames.map((frame) => solidPixels(frame.pixels));
  const median = [...sizes].sort((a, b) => a - b)[Math.floor(sizes.length / 2)] ?? 0;
  frames.forEach((frame, i) => {
    const n = i + 1;
    if ((sizes[i] ?? 0) < 0.2 * median || frame.box.h < 0.15 * image.height) {
      problems.push(`dessin ${n} absent ou minuscule (pas 4 dessins séparés ?)`);
    } else if (touchesEdge(frame.box, image)) {
      problems.push(`dessin ${n} coupé au bord de l'image`);
    }
  });
  if (problems.length > 0) return { ok: false, problems, notes };

  const standing = STANDING[sheet].map((i) => frames[i]?.box).filter((b): b is Box => !!b);
  const bottoms = standing.map((box) => box.y + box.h);
  const tallest = Math.max(...frames.map((frame) => frame.box.h));
  if (bottoms.length > 1 && Math.max(...bottoms) - Math.min(...bottoms) > 0.06 * tallest) {
    problems.push('pieds pas sur la même ligne');
  }

  const share = teamShare(image);
  if (share < 0.01) {
    problems.push(
      `presque pas de rouge d'équipe (${(share * 100).toFixed(1)} %) : la recoloration par peuple ne marcherait pas`,
    );
  } else if (share > 0.6) {
    notes.push(`beaucoup de rouge d'équipe (${(share * 100).toFixed(0)} %)`);
  }

  let scale: number | undefined;
  if (referenceIdleHeight && sheet === 'repos') {
    const ratio = referenceIdleHeight / (frames[0]?.box.h ?? referenceIdleHeight);
    if (ratio < 0.7 || ratio > 1.4) {
      problems.push(`taille trop différente de la planche de poses (×${ratio.toFixed(2)})`);
    } else if (Math.abs(ratio - 1) > 0.03) {
      scale = Number(ratio.toFixed(2));
      notes.push(`échelle corrigée automatiquement : ×${scale}`);
    }
  }
  return { ok: problems.length === 0, problems, notes, ...(scale ? { scale } : {}) };
}

export function checkPortraitSheet(source: RgbaImage): CheckResult {
  const image = removeBackground(source, { pockets: false });
  const problems: string[] = [];
  const boxes = splitColumns(image, 4);
  boxes.forEach((box, i) => {
    if (box.w < 0.08 * image.width || box.h < 0.2 * image.height) {
      problems.push(`portrait ${i + 1} absent ou trop petit`);
    }
  });
  return { ok: problems.length === 0, problems, notes: [] };
}
