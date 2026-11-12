/**
 * Police d'interface. Cible : m5x7 de Daniel Linssen (gratuite avec crédit), posée dans
 * `apps/game/public/fonts/m5x7.ttf` et déclarée dans index.html. Elle se lit à 16 px
 * (ou 32 px) pour garder des pixels nets. Si le fichier manque, on retombe sur une
 * monospace système à des tailles plus petites.
 */

export type TextSize = 'small' | 'normal' | 'large' | 'title';

interface FontSetup {
  family: string;
  pixel: boolean;
  sizes: Record<TextSize, number>;
}

const PIXEL: FontSetup = {
  family: 'm5x7',
  pixel: true,
  sizes: { small: 16, normal: 16, large: 32, title: 48 },
};

const FALLBACK: FontSetup = {
  family: 'monospace',
  pixel: false,
  sizes: { small: 9, normal: 11, large: 18, title: 32 },
};

let current: FontSetup = FALLBACK;

/** À appeler avant de créer le jeu : attend la police pixel si elle est disponible. */
export async function loadFonts(): Promise<void> {
  try {
    await document.fonts.load('16px m5x7');
    if (document.fonts.check('16px m5x7')) current = PIXEL;
  } catch {
    current = FALLBACK;
  }
}

export function font(): Readonly<FontSetup> {
  return current;
}
