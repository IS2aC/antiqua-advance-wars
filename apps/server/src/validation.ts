/** Contrôle des formulaires d'inscription et de connexion. Messages affichés tels quels. */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

export interface SignupInput {
  readonly pseudo: string;
  readonly email: string;
  readonly password: string;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PSEUDO = /^[\p{L}\p{N}_-]{3,20}$/u;

const text = (body: unknown, key: string): string => {
  const value =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[key] : undefined;
  return typeof value === 'string' ? value : '';
};

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export function checkSignup(body: unknown): Checked<SignupInput> {
  const pseudo = text(body, 'pseudo').trim();
  const email = normalizeEmail(text(body, 'email'));
  const password = text(body, 'motDePasse');
  if (!PSEUDO.test(pseudo)) {
    return { ok: false, error: 'Pseudo : 3 à 20 caractères, lettres, chiffres, - ou _.' };
  }
  if (email.length > 254 || !EMAIL.test(email))
    return { ok: false, error: 'Adresse email invalide.' };
  if (password.length < PASSWORD_MIN) {
    return { ok: false, error: `Mot de passe : au moins ${PASSWORD_MIN} caractères.` };
  }
  if (password.length > PASSWORD_MAX) return { ok: false, error: 'Mot de passe trop long.' };
  return { ok: true, value: { pseudo, email, password } };
}

export function checkLogin(body: unknown): Checked<LoginInput> {
  const email = normalizeEmail(text(body, 'email'));
  const password = text(body, 'motDePasse');
  if (!email || !password || password.length > PASSWORD_MAX) {
    return { ok: false, error: 'Email ou mot de passe incorrect.' };
  }
  return { ok: true, value: { email, password } };
}
