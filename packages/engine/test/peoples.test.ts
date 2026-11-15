import { describe, expect, it } from 'vitest';
import { assignPeoples } from '../src/maps/peoples';
import { GUE_DU_NIL } from '../src/maps/gue-du-nil';
import { createGame } from '../src/setup';

describe('assignPeoples', () => {
  it('remplace les camps de la carte par les peuples choisis, dans l’ordre de jeu', () => {
    const map = assignPeoples(GUE_DU_NIL, ['ashanti', 'almoravides']);
    expect(map.players).toEqual(['ashanti', 'almoravides']);
    const owners = (player: string) => ({
      buildings: map.buildings.filter((b) => b.owner === player).length,
      units: map.units.filter((u) => u.owner === player).length,
    });
    // Koush (premier camp) → Ashanti ; Carthage (second) → Almoravides.
    const before = (player: string) => ({
      buildings: GUE_DU_NIL.buildings.filter((b) => b.owner === player).length,
      units: GUE_DU_NIL.units.filter((u) => u.owner === player).length,
    });
    expect(owners('ashanti')).toEqual(before('koush'));
    expect(owners('almoravides')).toEqual(before('carthage'));
    expect(owners('koush')).toEqual({ buildings: 0, units: 0 });
    expect(map.buildings.filter((b) => b.owner === null)).toEqual(
      GUE_DU_NIL.buildings.filter((b) => b.owner === null),
    );
    expect(createGame(map, { seed: 1 }).currentPlayer).toBe('ashanti');
  });

  it('peut échanger les camps', () => {
    const map = assignPeoples(GUE_DU_NIL, ['carthage', 'koush']);
    const hq = (player: string) => map.buildings.find((b) => b.type === 'qg' && b.owner === player);
    const original = (player: string) =>
      GUE_DU_NIL.buildings.find((b) => b.type === 'qg' && b.owner === player);
    expect(hq('carthage')).toMatchObject({ x: original('koush')?.x, y: original('koush')?.y });
    expect(map.players).toEqual(['carthage', 'koush']);
  });

  it('refuse un nombre de peuples faux ou un doublon', () => {
    expect(() => assignPeoples(GUE_DU_NIL, ['koush'])).toThrow();
    expect(() => assignPeoples(GUE_DU_NIL, ['koush', 'koush'])).toThrow();
  });
});
