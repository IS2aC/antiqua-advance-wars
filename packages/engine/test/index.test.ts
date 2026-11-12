import { describe, expect, it } from 'vitest';
import * as engine from '../src/index';

describe('API publique', () => {
  it('expose sa version et ses points d’entrée', () => {
    expect(engine.ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof engine.applyAction).toBe('function');
    expect(typeof engine.createGame).toBe('function');
    expect(engine.GUE_DU_NIL.name).toBe('Le Gué du Nil');
  });
});
