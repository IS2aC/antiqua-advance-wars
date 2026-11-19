import { describe, expect, it } from 'vitest';
import { VILLAGE_HEAL } from '../src/index';
import { C, K, act, eventsOfType, setup } from './helpers';

/** Fin du tour de Koush, puis de Carthage : Koush recommence (jour 2). */
function backToKoush(state: ReturnType<typeof setup>) {
  const afterK = act(state, { type: 'END_TURN' }).state;
  return act(afterK, { type: 'END_TURN' });
}

describe('soin sur les villages', () => {
  it('une unité sur un de ses villages regagne 2 PV au début de son tour', () => {
    const state = setup(['V...', '....'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0, hp: 50 },
        { type: 'fantassin', owner: C, x: 3, y: 1 },
      ],
      owners: { '0,0': K },
    });
    const { state: next, events } = backToKoush(state);
    expect(next.units.find((u) => u.id === 1)?.hp).toBe(50 + VILLAGE_HEAL);
    expect(eventsOfType(events, 'unitHealed')).toEqual([
      { type: 'unitHealed', unitId: 1, x: 0, y: 0, hp: 70 },
    ]);
  });

  it('plafonne à 10 PV et ne soigne pas une unité intacte', () => {
    const state = setup(['V.V.', '....'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0, hp: 95 },
        { type: 'fantassin', owner: K, x: 2, y: 0, hp: 100 },
        { type: 'fantassin', owner: C, x: 3, y: 1 },
      ],
      owners: { '0,0': K, '2,0': K },
    });
    const { state: next, events } = backToKoush(state);
    expect(next.units.find((u) => u.id === 1)?.hp).toBe(100);
    expect(eventsOfType(events, 'unitHealed')).toHaveLength(1);
  });

  it('ne soigne ni sur un village neutre ou adverse, ni sur une caserne, ni gratuitement l’adversaire', () => {
    const state = setup(['VVC.', '....'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0, hp: 50 },
        { type: 'fantassin', owner: K, x: 1, y: 0, hp: 50 },
        { type: 'fantassin', owner: K, x: 2, y: 0, hp: 50 },
        { type: 'fantassin', owner: C, x: 3, y: 1 },
      ],
      owners: { '1,0': C, '2,0': K },
    });
    const { state: next } = backToKoush(state);
    expect(next.units.filter((u) => u.owner === K).map((u) => u.hp)).toEqual([50, 50, 50]);
  });

  it('soigne au début du tour du propriétaire seulement', () => {
    const state = setup(['V...', '....'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0, hp: 50 },
        { type: 'fantassin', owner: C, x: 3, y: 1 },
      ],
      owners: { '0,0': K },
    });
    const afterK = act(state, { type: 'END_TURN' });
    expect(eventsOfType(afterK.events, 'unitHealed')).toEqual([]);
    expect(afterK.state.units[0]?.hp).toBe(50);
  });
});
