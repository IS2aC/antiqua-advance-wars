/**
 * Réglages du joueur, mémorisés dans le navigateur (localStorage). Comme pour la sauvegarde,
 * une lecture ou une écriture impossible est ignorée : on garde les valeurs par défaut.
 */

const KEY = 'antiqua:options';

export interface Options {
  /** Scènes de combat plein écran (sinon : animation courte sur la carte). */
  readonly combatScenes: boolean;
  /** Style des scènes : grandes illustrations dessinées (par défaut), ou pixel art. */
  readonly combatStyle: 'pixel' | 'dessin';
}

const DEFAULTS: Options = { combatScenes: true, combatStyle: 'dessin' };

export function loadOptions(): Options {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Options>;
    return {
      combatScenes:
        typeof parsed.combatScenes === 'boolean' ? parsed.combatScenes : DEFAULTS.combatScenes,
      combatStyle:
        parsed.combatStyle === 'pixel' || parsed.combatStyle === 'dessin'
          ? parsed.combatStyle
          : DEFAULTS.combatStyle,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveOptions(options: Options): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(options));
  } catch {
    // Stockage indisponible : le réglage vaut pour cette session seulement.
  }
}

/** Réglage « Scènes de combat » de la pause : oui (pixel), non, dessinées. */
export type CombatSetting = 'oui' | 'non' | 'dessinees';

export function combatSetting(options: Options): CombatSetting {
  if (!options.combatScenes) return 'non';
  return options.combatStyle === 'dessin' ? 'dessinees' : 'oui';
}

/**
 * Valeur suivante quand le joueur appuie sur le réglage : dessinées (par défaut) → non →
 * oui (pixel art) → dessinées.
 */
export function nextCombatSetting(setting: CombatSetting): CombatSetting {
  return setting === 'dessinees' ? 'non' : setting === 'non' ? 'oui' : 'dessinees';
}

export function withCombatSetting(options: Options, setting: CombatSetting): Options {
  return {
    ...options,
    combatScenes: setting !== 'non',
    combatStyle: setting === 'dessinees' ? 'dessin' : 'pixel',
  };
}
