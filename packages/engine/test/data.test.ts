import { describe, expect, it } from 'vitest';
import { BASE_DAMAGE, FACTIONS, TERRAINS, UNITS, UNIT_TYPES, isIndirect } from '../src/index';

describe('données (conformes à docs/game-design.md)', () => {
  it('définit les 6 unités du Stage 1 avec leurs coûts et déplacements', () => {
    expect(UNIT_TYPES).toHaveLength(6);
    expect(UNIT_TYPES.map((type) => [UNITS[type].cost, UNITS[type].move])).toEqual([
      [1000, 3],
      [2500, 2],
      [3000, 3],
      [4000, 7],
      [7000, 6],
      [6000, 4],
    ]);
  });

  it('seuls fantassin et lancier capturent', () => {
    expect(UNIT_TYPES.filter((type) => UNITS[type].canCapture)).toEqual(['fantassin', 'lancier']);
  });

  it('archers (2 exactement) et catapulte (2–3) tirent à distance', () => {
    expect([UNITS.archers.minRange, UNITS.archers.maxRange]).toEqual([2, 2]);
    expect([UNITS.catapulte.minRange, UNITS.catapulte.maxRange]).toEqual([2, 3]);
    expect(UNIT_TYPES.filter(isIndirect)).toEqual(['archers', 'catapulte']);
  });

  it('les bâtiments rapportent 1 000 et les terrains naturels rien', () => {
    expect(TERRAINS.village.income).toBe(1000);
    expect(TERRAINS.caserne.income).toBe(1000);
    expect(TERRAINS.qg.income).toBe(1000);
    expect(TERRAINS.plaine.income).toBe(0);
    expect([TERRAINS.qg.defense, TERRAINS.montagne.defense, TERRAINS.marais.defense]).toEqual([
      4, 4, 0,
    ]);
  });

  it('la table de dégâts est complète et reprend les valeurs du document', () => {
    for (const attacker of UNIT_TYPES) {
      for (const defender of UNIT_TYPES) {
        expect(BASE_DAMAGE[attacker][defender]).toBeGreaterThan(0);
      }
    }
    expect(BASE_DAMAGE.fantassin.char).toBe(5);
    expect(BASE_DAMAGE.lancier.cavalerie).toBe(70);
    expect(BASE_DAMAGE.catapulte.fantassin).toBe(90);
  });

  it('nomme les factions', () => {
    expect(FACTIONS.koush).toEqual({ name: 'Koush', color: 'bleu' });
    expect(FACTIONS.carthage.color).toBe('rouge');
  });
});
