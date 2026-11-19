import type { UnitType } from '../model/types';

/**
 * Dégâts de base B, en % des PV du défenseur (ligne = attaquant, colonne = défenseur).
 * Valeurs : docs/game-design.md, table « Dégâts de base B ».
 */
export const BASE_DAMAGE: Readonly<Record<UnitType, Readonly<Record<UnitType, number>>>> = {
  fantassin: {
    fantassin: 55,
    lancier: 45,
    archers: 60,
    cavalerie: 15,
    char: 5,
    catapulte: 15,
    convoi: 75,
  },
  lancier: {
    fantassin: 65,
    lancier: 55,
    archers: 70,
    cavalerie: 70,
    char: 55,
    catapulte: 70,
    convoi: 85,
  },
  archers: {
    fantassin: 70,
    lancier: 60,
    archers: 65,
    cavalerie: 55,
    char: 30,
    catapulte: 55,
    convoi: 80,
  },
  cavalerie: {
    fantassin: 70,
    lancier: 30,
    archers: 75,
    cavalerie: 35,
    char: 10,
    catapulte: 45,
    convoi: 85,
  },
  char: {
    fantassin: 75,
    lancier: 40,
    archers: 80,
    cavalerie: 75,
    char: 55,
    catapulte: 70,
    convoi: 90,
  },
  catapulte: {
    fantassin: 90,
    lancier: 85,
    archers: 80,
    cavalerie: 75,
    char: 70,
    catapulte: 75,
    convoi: 90,
  },
  // Le convoi n'attaque pas : sa ligne ne sert jamais.
  convoi: { fantassin: 0, lancier: 0, archers: 0, cavalerie: 0, char: 0, catapulte: 0, convoi: 0 },
};
