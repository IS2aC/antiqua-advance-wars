import { describe, expect, it } from 'vitest';
import { Presence } from '../src/presence';

const socket = () => {
  const received: number[] = [];
  return { received, send: (data: string) => received.push(JSON.parse(data).nombre) };
};

describe('présence', () => {
  it('compte les comptes, pas les onglets, et diffuse chaque changement', () => {
    const presence = new Presence();
    const a1 = socket();
    const a2 = socket();
    const b = socket();
    presence.join(a1, 'a');
    presence.join(a2, 'a');
    expect(presence.count).toBe(1);
    presence.join(b, 'b');
    expect(presence.count).toBe(2);
    expect(a1.received).toEqual([1, 2]);
    expect(a2.received).toEqual([1, 2]);
    presence.leave(b);
    expect(a1.received).toEqual([1, 2, 1]);
  });
});
