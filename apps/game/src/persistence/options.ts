/**
 * Réglages du joueur, mémorisés dans le navigateur (localStorage). Comme pour la sauvegarde,
 * une lecture ou une écriture impossible est ignorée : on garde les valeurs par défaut.
 */

const KEY = 'antiqua:options';

export interface Options {
  /** Scènes de combat dessinées plein écran (sinon : animation courte sur la carte). */
  readonly combatScenes: boolean;
}

const DEFAULTS: Options = { combatScenes: true };

export function loadOptions(): Options {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Options>;
    return {
      combatScenes:
        typeof parsed.combatScenes === 'boolean' ? parsed.combatScenes : DEFAULTS.combatScenes,
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

/** Réglage « Scènes de combat » de la pause. */
export type CombatSetting = 'oui' | 'non';

export function combatSetting(options: Options): CombatSetting {
  return options.combatScenes ? 'oui' : 'non';
}

/** Valeur suivante quand le joueur appuie sur le réglage. */
export function nextCombatSetting(setting: CombatSetting): CombatSetting {
  return setting === 'oui' ? 'non' : 'oui';
}

export function withCombatSetting(options: Options, setting: CombatSetting): Options {
  return { ...options, combatScenes: setting === 'oui' };
}
