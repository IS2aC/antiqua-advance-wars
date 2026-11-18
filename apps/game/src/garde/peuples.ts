import type { PlayerId } from '@antiqua/engine';

/**
 * Fiches de l'écran de choix du peuple, d'après les planches de référence
 * (`art/reference/peuples/`, `docs/planches-peuples.md`) : dirigeant, traits, couleur
 * d'équipe (rampe des sprites), portrait et écusson (`pnpm assets:cover`).
 */
export interface PeopleCard {
  readonly id: PlayerId;
  readonly name: string;
  readonly leader: string;
  readonly traits: string;
  readonly text: string;
  /** Couleur d'équipe (rampe des sprites : franche, puis sombre pour le texte). */
  readonly color: string;
  readonly dark: string;
}

export const PEOPLE_CARDS: Readonly<Record<PlayerId, PeopleCard>> = {
  koush: {
    id: 'koush',
    name: 'Royaume de Koush',
    leader: 'Taharqa, roi de Koush et pharaon',
    traits: 'Archers · Or · Amon',
    text: 'Le « pays de l’arc », sur le Nil moyen : ses archers nubiens sont les plus redoutés de l’Antiquité.',
    color: '#3A73D1',
    dark: '#24418E',
  },
  carthage: {
    id: 'carthage',
    name: 'Carthage',
    leader: 'Hannibal Barca',
    traits: 'Marins · Éléphants · Tanit',
    text: 'Cité punique fondée par les Phéniciens de Tyr, maîtresse des mers de la Méditerranée occidentale.',
    color: '#D13A2E',
    dark: '#8E1F24',
  },
  almoravides: {
    id: 'almoravides',
    name: 'Almoravides',
    leader: 'Youssef ibn Tachfine',
    traits: 'Sahara · Chameliers · Marrakech',
    text: 'Confédération amazighe du Sahara, voilée d’indigo, qui fonda Marrakech et régna du Sénégal à al-Andalus.',
    color: '#2EAE4E',
    dark: '#1F6E34',
  },
  ashanti: {
    id: 'ashanti',
    name: 'Empire ashanti',
    leader: 'Osei Tutu, asantehene',
    traits: 'Or · Kente · Tabouret d’or',
    text: 'Royaume akan des forêts du Ghana, uni autour du Tabouret d’or et riche de l’or de la Côte.',
    color: '#D1A72E',
    dark: '#8E6A1F',
  },
};
