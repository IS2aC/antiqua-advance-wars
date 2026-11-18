/**
 * Prompts et liste des images à générer, à partir du catalogue `art/specs/`. Fonctions pures.
 *
 * Les unités sont dessinées en rouge d'équipe, puis recolorées pour chaque peuple par
 * `pnpm assets:dessin`, comme les sprites de la carte : une fois pour tous (`unites/<unité>/`),
 * ou par peuple d'après ses propres sprites (`peuples/<peuple>/<unité>/`, avec `--peuple`).
 * La planche de poses prend le sprite de la carte comme référence ; les séquences prennent la
 * planche de poses (même personnage, même taille).
 */
import type { PeopleUnitSpec, Specs, UnitSheet } from './specs';

export const IMAGE_SIZE = '1536x1024';

export type JobKind = 'unit' | 'portrait' | 'decor';

export interface Job {
  /** Fichier produit, relatif au dossier des combats dessinés, sans extension. */
  readonly id: string;
  readonly kind: JobKind;
  readonly unit?: string;
  readonly sheet?: UnitSheet;
  readonly people?: string;
  readonly prompt: string;
  /**
   * Images jointes. `depot:` = chemin depuis la racine du dépôt (sprites) ; sinon chemin
   * relatif au dossier des combats dessinés (planche de poses déjà générée).
   */
  readonly references: readonly string[];
}

/** Bloc de couleurs, rempli avec les teintes relevées sur les sprites et l'équipe voulue. */
export function colorBlock(
  specs: Specs,
  people: string,
  pure: boolean,
  skin: { readonly base: string; readonly ombre: string } = specs.couleurs.peau,
): string {
  const c = specs.couleurs;
  const team = c.equipes[people];
  if (!team) throw new Error(`Équipe inconnue : ${people}`);
  const values: Record<string, string> = {
    peau: skin.base,
    peauOmbre: skin.ombre,
    cheveux: c.cheveux,
    or: c.or.base,
    orClair: c.or.clair,
    creme: c.creme,
    bois: c.bois,
    equipeNom: team.nom,
    equipe1: team.rampe[1],
    equipe2: team.rampe[2],
    equipe3: team.rampe[3],
  };
  const text = specs.style.couleurs.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);
  return pure ? `${text} ${specs.style.couleursPures}` : text;
}

const numbered = (cells: readonly string[]) => cells.map((cell, i) => `${i + 1}. ${cell}`);

function character(unit: Pick<PeopleUnitSpec, 'sujet' | 'design'>): string {
  return `Character: ${unit.sujet}. Design (team color = the team color below): ${unit.design}`;
}

/** Version propre à un peuple d'une unité (erreur claire si la fiche n'existe pas). */
function peopleUnit(specs: Specs, unitName: string, people: string): PeopleUnitSpec {
  const own = specs.unites[unitName]?.peuples?.[people];
  if (!own) {
    throw new Error(
      `Pas de fiche « ${unitName} » pour ${people} : ajoute unites.json → ${unitName}.peuples.${people}`,
    );
  }
  return own;
}

/** Sprite de carte d'un peuple : même nom de fichier que le sprite commun. */
export function peopleSprite(sprite: string, people: string): string {
  const name = sprite.split('/').pop() ?? sprite;
  return `art/raw/sprites-unités/peuples/${people}/${name}`;
}

export function unitPrompt(
  specs: Specs,
  unitName: string,
  sheet: UnitSheet,
  people?: string,
): string {
  const unit = specs.unites[unitName];
  if (!unit) throw new Error(`Unité inconnue : ${unitName}`);
  const own = people ? peopleUnit(specs, unitName, people) : null;
  const source = specs.couleurs.equipeSource;
  const s = specs.style;
  const poses = sheet === 'poses';
  return [
    poses ? (own ? s.referenceSpritePeuple : s.referenceSprite) : s.referencePoses,
    character(own ?? unit),
    colorBlock(specs, source, true, own?.peau),
    poses ? s.cadrePoses : s.cadreSequence,
    poses ? 'Poses, left to right:' : 'Frames, left to right:',
    ...numbered(own?.planches?.[sheet] ?? unit.planches[sheet]),
    ...(sheet === 'sonne' ? [s.sonne] : []),
    s.style,
    s.fond,
  ].join('\n\n');
}

export function portraitPrompt(specs: Specs, people: string): string {
  const portrait = specs.portraits.peuples[people];
  if (!portrait) throw new Error(`Portrait inconnu : ${people}`);
  const side = portrait.regard === 'gauche' ? 'left' : 'right';
  return [
    `Create 4 head-and-shoulders portraits of ${portrait.chef} in one horizontal row, 4 equal square cells, the same character with the same framing and the same size in every cell, facing slightly to the ${side}, generous empty space between the cells.`,
    `Design (team color = the team color below): ${portrait.design}`,
    colorBlock(specs, people, false),
    'Expressions, left to right:',
    ...numbered(specs.portraits.expressions),
    specs.style.style,
    specs.style.fond,
  ].join('\n\n');
}

export function decorPrompt(specs: Specs, name: string): string {
  const terrain = specs.decors.terrains[name];
  if (!terrain) throw new Error(`Décor inconnu : ${name}`);
  return `${terrain}\n\n${specs.decors.commun}`;
}

export interface JobFilter {
  /** Unités voulues (toutes si vide). */
  readonly units: readonly string[];
  /** Planches voulues (toutes si vide). */
  readonly sheets: readonly UnitSheet[];
  readonly peoples: readonly string[];
  readonly withUnits: boolean;
  readonly withPortraits: boolean;
  readonly withDecors: boolean;
  /** Décors voulus (tous si vide). */
  readonly decors: readonly string[];
}

/**
 * Liste ordonnée des images à générer : pour chaque unité, la planche de poses d'abord (elle
 * sert de référence aux séquences), puis les portraits, puis les décors.
 */
export function planJobs(
  specs: Specs,
  filter: JobFilter,
  allUnits: readonly string[],
  allPeoples: readonly string[],
  allSheets: readonly UnitSheet[],
): Job[] {
  const jobs: Job[] = [];
  if (filter.withUnits) {
    const units = filter.units.length > 0 ? filter.units : allUnits;
    const sheets = filter.sheets.length > 0 ? filter.sheets : allSheets;
    for (const unit of units) {
      const spec = specs.unites[unit];
      if (!spec) throw new Error(`Unité inconnue : ${unit} (connues : ${allUnits.join(', ')})`);
      // Avec --peuple : la version propre à chaque peuple (d'après ses sprites).
      const targets: (string | null)[] = filter.peoples.length > 0 ? [...filter.peoples] : [null];
      for (const people of targets) {
        const dir = people ? `peuples/${people}/${unit}` : `unites/${unit}`;
        const sprite = people ? peopleSprite(spec.sprite, people) : spec.sprite;
        for (const sheet of allSheets.filter((s) => sheets.includes(s))) {
          jobs.push({
            id: `${dir}/${sheet}`,
            kind: 'unit',
            unit,
            sheet,
            ...(people ? { people } : {}),
            prompt: unitPrompt(specs, unit, sheet, people ?? undefined),
            references: sheet === 'poses' ? [`depot:${sprite}`] : [`${dir}/poses.png`],
          });
        }
      }
    }
  }
  if (filter.withPortraits) {
    const peoples = filter.peoples.length > 0 ? filter.peoples : allPeoples;
    for (const people of peoples) {
      jobs.push({
        id: `portraits/${people}`,
        kind: 'portrait',
        people,
        prompt: portraitPrompt(specs, people),
        references: [],
      });
    }
  }
  if (filter.withDecors) {
    const names = filter.decors.length > 0 ? filter.decors : Object.keys(specs.decors.terrains);
    for (const name of names) {
      jobs.push({
        id: `decors/${name}`,
        kind: 'decor',
        prompt: decorPrompt(specs, name),
        references: [],
      });
    }
  }
  return jobs;
}
