import type { PlayerId } from '../model/types';

export interface FactionInfo {
  readonly name: string;
  /** Couleur d'équipe (nom de la rampe de palette dans art-bible.md). */
  readonly color: 'rouge' | 'bleu' | 'jaune' | 'vert';
}

export const FACTIONS: Readonly<Record<PlayerId, FactionInfo>> = {
  koush: { name: 'Koush', color: 'bleu' },
  carthage: { name: 'Carthage', color: 'rouge' },
  ashanti: { name: 'Ashanti', color: 'jaune' },
  almoravides: { name: 'Almoravides', color: 'vert' },
};
