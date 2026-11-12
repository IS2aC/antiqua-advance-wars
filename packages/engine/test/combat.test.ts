import { describe, expect, it } from 'vitest';
import { computeDamage, forecast, targetsInRange, threatTiles } from '../src/index';
import type { UnitType } from '../src/index';
import { C, K, act, errorOf, eventsOfType, setup } from './helpers';

describe('formule de dégâts', () => {
  const full = (type: UnitType, hp = 100) => ({ type, hp });

  it('applique (B + L) × PVatt/10 × (100 − E × PVdef)/100, arrondi inférieur', () => {
    expect(computeDamage(full('fantassin'), full('fantassin'), 'plaine', 0)).toBe(49);
    expect(computeDamage(full('fantassin'), full('fantassin'), 'plaine', 9)).toBe(57);
    expect(computeDamage(full('fantassin'), full('fantassin'), 'montagne', 0)).toBe(33);
    expect(computeDamage(full('fantassin', 45), full('fantassin'), 'plaine', 0)).toBe(24);
  });

  it('ne dépasse jamais les PV restants du défenseur', () => {
    expect(computeDamage(full('catapulte'), full('fantassin', 10), 'plaine', 9)).toBe(10);
  });
});

describe('portée', () => {
  const row = (attacker: UnitType, gap: number) =>
    setup(['......'], {
      units: [
        { type: attacker, owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: C, x: gap, y: 0 },
      ],
    });

  it.each<[UnitType, number, boolean]>([
    ['archers', 1, false],
    ['archers', 2, true],
    ['archers', 3, false],
    ['catapulte', 1, false],
    ['catapulte', 2, true],
    ['catapulte', 3, true],
    ['catapulte', 4, false],
    ['fantassin', 1, true],
    ['fantassin', 2, false],
  ])('%s à %i case(s) : attaquable = %s', (type, gap, expected) => {
    const state = row(type, gap);
    expect(targetsInRange(state, 1).length > 0).toBe(expected);
    if (!expected) {
      expect(errorOf(state, { type: 'ATTACK', unitId: 1, targetId: 2 })).toBe(
        'TARGET_OUT_OF_RANGE',
      );
    }
  });

  it('les archers ne tirent pas après avoir bougé', () => {
    const state = setup(['......'], {
      units: [
        { type: 'archers', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: C, x: 3, y: 0 },
      ],
    });
    expect(targetsInRange(state, 1, { x: 1, y: 0 })).toEqual([]);
    const moved = act(state, { type: 'MOVE', unitId: 1, to: { x: 1, y: 0 } }).state;
    expect(targetsInRange(moved, 1)).toEqual([]);
    expect(errorOf(moved, { type: 'ATTACK', unitId: 1, targetId: 2 })).toBe(
      'CANNOT_FIRE_AFTER_MOVING',
    );
  });

  it('une unité directe attaque après avoir bougé', () => {
    const state = setup(['......'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: C, x: 3, y: 0 },
      ],
    });
    expect(targetsInRange(state, 1, { x: 2, y: 0 })).toHaveLength(1);
    const moved = act(state, { type: 'MOVE', unitId: 1, to: { x: 2, y: 0 } }).state;
    expect(
      eventsOfType(act(moved, { type: 'ATTACK', unitId: 1, targetId: 2 }).events, 'attackResolved'),
    ).toHaveLength(1);
  });

  it('ne renvoie rien pour une unité inconnue', () => {
    expect(targetsInRange(row('fantassin', 1), 99)).toEqual([]);
  });
});

describe('attaque et riposte', () => {
  const duel = (attacker: UnitType, defender: UnitType, gap: number, hp = 100, seed = 42) =>
    setup(['......'], {
      seed,
      units: [
        { type: attacker, owner: K, x: 0, y: 0, hp },
        { type: defender, owner: C, x: gap, y: 0 },
      ],
    });

  it('le défenseur direct, adjacent et survivant riposte avec ses PV restants', () => {
    const state = duel('fantassin', 'fantassin', 1);
    const { state: next, events } = act(state, { type: 'ATTACK', unitId: 1, targetId: 2 });
    const [hit] = eventsOfType(events, 'attackResolved');
    const [counter] = eventsOfType(events, 'counterResolved');
    expect(hit).toBeDefined();
    expect(counter).toBeDefined();
    if (!hit || !counter) return;
    expect(counter.attackerId).toBe(2);
    expect(counter.damage).toBe(
      computeDamage(
        { type: 'fantassin', hp: hit.defenderHp },
        { type: 'fantassin', hp: 100 },
        'plaine',
        counter.luck,
      ),
    );
    expect(next.units.find((unit) => unit.id === 1)?.hp).toBe(100 - counter.damage);
    expect(next.units.find((unit) => unit.id === 1)?.hasActed).toBe(true);
    expect(next.rngSeed).not.toBe(state.rngSeed);
  });

  it('des archers attaqués au contact ne ripostent pas', () => {
    const { events } = act(duel('fantassin', 'archers', 1), {
      type: 'ATTACK',
      unitId: 1,
      targetId: 2,
    });
    expect(eventsOfType(events, 'counterResolved')).toEqual([]);
  });

  it('on ne riposte pas à un tir à distance', () => {
    const { events } = act(duel('archers', 'fantassin', 2), {
      type: 'ATTACK',
      unitId: 1,
      targetId: 2,
    });
    expect(eventsOfType(events, 'counterResolved')).toEqual([]);
  });

  it('un défenseur détruit ne riposte pas', () => {
    const state = setup(['......'], {
      units: [
        { type: 'char', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: C, x: 1, y: 0, hp: 10 },
        { type: 'fantassin', owner: C, x: 5, y: 0 },
      ],
    });
    const { state: next, events } = act(state, { type: 'ATTACK', unitId: 1, targetId: 2 });
    expect(events.map((event) => event.type)).toEqual(['attackResolved', 'unitDestroyed']);
    expect(next.units.map((unit) => unit.id)).toEqual([1, 3]);
    expect(next.players.find((player) => player.id === C)?.stats.unitsLost).toBe(1);
  });

  it('l’attaquant peut mourir sous la riposte', () => {
    const state = setup(['......'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0, hp: 5 },
        { type: 'lancier', owner: C, x: 1, y: 0 },
        { type: 'fantassin', owner: K, x: 5, y: 0 },
      ],
    });
    const { state: next, events } = act(state, { type: 'ATTACK', unitId: 1, targetId: 2 });
    expect(events.map((event) => event.type)).toEqual([
      'attackResolved',
      'counterResolved',
      'unitDestroyed',
    ]);
    expect(next.units.map((unit) => unit.id)).toEqual([2, 3]);
  });

  it('refuse les attaques illégales', () => {
    const state = setup(['......'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: K, x: 1, y: 0 },
      ],
    });
    expect(errorOf(state, { type: 'ATTACK', unitId: 1, targetId: 99 })).toBe('TARGET_NOT_FOUND');
    expect(errorOf(state, { type: 'ATTACK', unitId: 1, targetId: 2 })).toBe('NOT_AN_ENEMY');
  });

  it('une unité n’attaque qu’une fois par tour', () => {
    const state = setup(['......'], {
      units: [
        { type: 'lancier', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: C, x: 1, y: 0 },
      ],
    });
    const after = act(state, { type: 'ATTACK', unitId: 1, targetId: 2 }).state;
    expect(errorOf(after, { type: 'ATTACK', unitId: 1, targetId: 2 })).toBe('UNIT_ALREADY_ACTED');
  });
});

describe('prévision de combat', () => {
  it('encadre les dégâts réels sans consommer le PRNG', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = setup(['F.....'], {
        seed,
        units: [
          { type: 'lancier', owner: K, x: 1, y: 0 },
          { type: 'fantassin', owner: C, x: 0, y: 0 },
        ],
      });
      const prediction = forecast(state, 1, 2);
      const { events } = act(state, { type: 'ATTACK', unitId: 1, targetId: 2 });
      const [hit] = eventsOfType(events, 'attackResolved');
      const [counter] = eventsOfType(events, 'counterResolved');
      expect(prediction).not.toBeNull();
      if (!prediction || !hit || !counter || !prediction.counter) throw new Error('incomplet');
      expect(hit.damage).toBeGreaterThanOrEqual(prediction.damage.min);
      expect(hit.damage).toBeLessThanOrEqual(prediction.damage.max);
      expect(counter.damage).toBeGreaterThanOrEqual(prediction.counter.min);
      expect(counter.damage).toBeLessThanOrEqual(prediction.counter.max);
    }
  });

  it('pas de riposte prévue si le défenseur meurt à coup sûr ou tire à distance', () => {
    const state = setup(['......'], {
      units: [
        { type: 'char', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: C, x: 1, y: 0, hp: 60 },
      ],
    });
    expect(forecast(state, 1, 2)?.counter).toBeNull();
    const archers = setup(['......'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0 },
        { type: 'archers', owner: C, x: 1, y: 0 },
      ],
    });
    expect(forecast(archers, 1, 2)?.counter).toBeNull();
  });

  it('riposte minimale nulle quand le défenseur peut mourir', () => {
    const state = setup(['......'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: C, x: 1, y: 0, hp: 55 },
      ],
    });
    expect(forecast(state, 1, 2)).toEqual({
      damage: { min: 51, max: 55 },
      counter: { min: 0, max: 5 },
    });
  });

  it('prévoit depuis une case de destination', () => {
    const state = setup(['......'], {
      units: [
        { type: 'fantassin', owner: K, x: 0, y: 0 },
        { type: 'fantassin', owner: C, x: 3, y: 0 },
      ],
    });
    expect(forecast(state, 1, 2)?.counter).toBeNull();
    expect(forecast(state, 1, 2, { x: 2, y: 0 })?.counter).not.toBeNull();
    expect(forecast(state, 1, 99)).toBeNull();
  });
});

describe('zone de menace (threatTiles)', () => {
  const keys = (tiles: readonly { x: number; y: number }[]) =>
    tiles.map((t) => `${t.x},${t.y}`).sort();

  it('unité directe : cases adjacentes aux cases atteignables', () => {
    const state = setup(['......'], { units: [{ type: 'lancier', owner: K, x: 0, y: 0 }] });
    expect(keys(threatTiles(state, 1))).toEqual(['0,0', '1,0', '2,0', '3,0']);
  });

  it('unité indirecte : sa portée depuis sa case, rien après un déplacement', () => {
    const state = setup(['......'], { units: [{ type: 'catapulte', owner: K, x: 0, y: 0 }] });
    expect(keys(threatTiles(state, 1))).toEqual(['2,0', '3,0']);
    const moved = act(state, { type: 'MOVE', unitId: 1, to: { x: 1, y: 0 } }).state;
    expect(threatTiles(moved, 1)).toEqual([]);
  });

  it('une unité directe qui a bougé menace autour d’elle, plus rien après avoir agi', () => {
    const state = setup(['......'], { units: [{ type: 'fantassin', owner: K, x: 0, y: 0 }] });
    const moved = act(state, { type: 'MOVE', unitId: 1, to: { x: 2, y: 0 } }).state;
    expect(keys(threatTiles(moved, 1))).toEqual(['1,0', '3,0']);
    const done = act(moved, { type: 'WAIT', unitId: 1 }).state;
    expect(threatTiles(done, 1)).toEqual([]);
    expect(threatTiles(state, 99)).toEqual([]);
  });
});
