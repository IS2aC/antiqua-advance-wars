import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/password';

describe('mots de passe', () => {
  it('ne stocke jamais le mot de passe et le vérifie', async () => {
    const stored = await hashPassword('mot-de-passe');
    expect(stored).not.toContain('mot-de-passe');
    expect(await verifyPassword('mot-de-passe', stored)).toBe(true);
    expect(await verifyPassword('autre', stored)).toBe(false);
    expect(await verifyPassword('mot-de-passe', 'abimé')).toBe(false);
  });

  it('sale chaque empreinte', async () => {
    expect(await hashPassword('x')).not.toBe(await hashPassword('x'));
  });
});
