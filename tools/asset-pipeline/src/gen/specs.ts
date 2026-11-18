/**
 * Catalogue des dessins de combat (`art/specs/`) : couleurs relevées sur les sprites, blocs
 * de style, fiche de chaque unité (équipement d'après son sprite, contenu de chaque planche),
 * portraits des chefs et décors. Lu par `pnpm art:generer`.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { UNIT_SHEETS } from '../drawn';

export type UnitSheet = (typeof UNIT_SHEETS)[number];
type Four = readonly [string, string, string, string];

export interface ColorSpec {
  readonly peau: { readonly base: string; readonly ombre: string };
  readonly cheveux: string;
  readonly or: { readonly base: string; readonly clair: string };
  readonly creme: string;
  readonly bois: string;
  readonly pierre: string;
  readonly contour: string;
  readonly equipes: Readonly<Record<string, { readonly nom: string; readonly rampe: Four }>>;
  /** Peuple dont la couleur sert à dessiner les planches communes (rouge). */
  readonly equipeSource: string;
}

export interface StyleSpec {
  readonly style: string;
  readonly fond: string;
  readonly couleurs: string;
  readonly couleursPures: string;
  readonly referenceSprite: string;
  /** Planche de poses propre à un peuple : son sprite de carte (en rouge d'équipe). */
  readonly referenceSpritePeuple: string;
  readonly referencePoses: string;
  readonly cadrePoses: string;
  readonly cadreSequence: string;
  readonly sonne: string;
}

/** Version d'une unité propre à un peuple, d'après ses sprites de carte. */
export interface PeopleUnitSpec {
  readonly sujet: string;
  readonly design: string;
  /** Teint relevé sur ses sprites, à la place du teint commun. */
  readonly peau?: { readonly base: string; readonly ombre: string };
  /**
   * Cases propres à ce peuple, quand l'unité n'a pas la même forme (palanquin au lieu d'un
   * char, cavalier lourd) ; les planches absentes reprennent celles de l'unité.
   */
  readonly planches?: Readonly<Partial<Record<UnitSheet, Four>>>;
}

export interface UnitSpec {
  readonly nom: string;
  /** Planche de sprites de la carte (chemin depuis la racine du dépôt). */
  readonly sprite: string;
  readonly sujet: string;
  readonly design: string;
  readonly planches: Readonly<Record<UnitSheet, Four>>;
  /** Versions propres à un peuple (`peuples/<peuple>/<unité>/`) ; absentes : planche commune. */
  readonly peuples?: Readonly<Record<string, PeopleUnitSpec>>;
}

export interface PortraitSpec {
  readonly expressions: Four;
  readonly peuples: Readonly<
    Record<
      string,
      { readonly regard: 'gauche' | 'droite'; readonly chef: string; readonly design: string }
    >
  >;
}

export interface DecorSpec {
  readonly commun: string;
  readonly terrains: Readonly<Record<string, string>>;
}

export interface Specs {
  readonly couleurs: ColorSpec;
  readonly style: StyleSpec;
  readonly unites: Readonly<Record<string, UnitSpec>>;
  readonly portraits: PortraitSpec;
  readonly decors: DecorSpec;
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isFour = (value: unknown): value is Four =>
  Array.isArray(value) && value.length === 4 && value.every(isText);

/**
 * Vérifie le catalogue et renvoie la liste des erreurs, en clair (vide si tout va bien) :
 * une fiche incomplète donnerait un prompt bancal, autant le dire avant de payer.
 */
export function validateSpecs(
  specs: Specs,
  units: readonly string[],
  peoples: readonly string[],
): string[] {
  const errors: string[] = [];
  for (const key of [
    'style',
    'fond',
    'couleurs',
    'couleursPures',
    'referenceSprite',
    'referenceSpritePeuple',
    'referencePoses',
    'cadrePoses',
    'cadreSequence',
    'sonne',
  ] as const) {
    if (!isText(specs.style[key])) errors.push(`style.json : « ${key} » manquant`);
  }
  for (const people of peoples) {
    const team = specs.couleurs.equipes[people];
    if (!team || !isFour(team.rampe) || !isText(team.nom)) {
      errors.push(`couleurs.json : équipe « ${people} » incomplète`);
    }
    const portrait = specs.portraits.peuples[people];
    if (!portrait || !isText(portrait.chef) || !isText(portrait.design)) {
      errors.push(`portraits.json : chef de « ${people} » incomplet`);
    }
  }
  if (!specs.couleurs.equipes[specs.couleurs.equipeSource]) {
    errors.push(`couleurs.json : équipe source « ${specs.couleurs.equipeSource} » inconnue`);
  }
  if (!isFour(specs.portraits.expressions)) {
    errors.push('portraits.json : il faut 4 expressions');
  }
  for (const unit of units) {
    const spec = specs.unites[unit];
    if (!spec) {
      errors.push(`unites.json : fiche « ${unit} » manquante`);
      continue;
    }
    for (const key of ['nom', 'sprite', 'sujet', 'design'] as const) {
      if (!isText(spec[key])) errors.push(`unites.json : ${unit}.${key} manquant`);
    }
    for (const [people, own] of Object.entries(spec.peuples ?? {})) {
      if (!specs.couleurs.equipes[people])
        errors.push(`unites.json : ${unit}.peuples.${people} : peuple inconnu`);
      if (!isText(own.sujet) || !isText(own.design)) {
        errors.push(`unites.json : ${unit}.peuples.${people} : sujet ou design manquant`);
      }
      for (const [sheet, cells] of Object.entries(own.planches ?? {})) {
        if (!(UNIT_SHEETS as readonly string[]).includes(sheet) || !isFour(cells)) {
          errors.push(
            `unites.json : ${unit}.peuples.${people}.planches.${sheet} : 4 cases attendues`,
          );
        }
      }
    }
    for (const sheet of UNIT_SHEETS) {
      if (!isFour(spec.planches?.[sheet])) {
        errors.push(`unites.json : ${unit}.planches.${sheet} doit avoir 4 cases`);
      }
    }
  }
  return errors;
}

async function readJson<T>(path: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    throw new Error(`Lecture de ${path} impossible : ${(error as Error).message}`, {
      cause: error,
    });
  }
}

export async function loadSpecs(dir: string): Promise<Specs> {
  const [couleurs, style, unites, portraits, decors] = await Promise.all([
    readJson<ColorSpec>(join(dir, 'couleurs.json')),
    readJson<StyleSpec>(join(dir, 'style.json')),
    readJson<Record<string, UnitSpec>>(join(dir, 'unites.json')),
    readJson<PortraitSpec>(join(dir, 'portraits.json')),
    readJson<DecorSpec>(join(dir, 'decors.json')),
  ]);
  return { couleurs, style, unites, portraits, decors };
}
