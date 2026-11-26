import { expect, test } from './fixtures';

/** Sans compte, la page de garde est floutée derrière le formulaire, et le jeu y renvoie. */
test.describe('sans session', () => {
  test.use({ connecte: false });

  test('le formulaire bloque la page de garde', async ({ page }) => {
    await page.goto('/');
    const form = page.getByRole('dialog', { name: 'Connexion' });
    await expect(form).toBeVisible();
    await expect(page.locator('.garde')).toHaveClass(/garde--verrouillee/);
    // Échap ne ferme pas le formulaire.
    await page.keyboard.press('Escape');
    await expect(form).toBeVisible();
    await page.getByRole('tab', { name: 'Créer un compte' }).click();
    await expect(page.getByRole('dialog', { name: 'Créer un compte' })).toBeVisible();
    await expect(page.getByLabel('Pseudo')).toBeVisible();
  });

  test('le jeu renvoie à la page de garde', async ({ page }) => {
    await page.goto('/jeu.html?mode=deux');
    await expect(page).toHaveURL(/\/$/);
  });

  test('connexion réussie : accès au menu', async ({ page }) => {
    await page.route('**/api/connexion', (route) =>
      route.fulfill({ json: { joueur: { id: 'a', pseudo: 'Amina', email: 'a@ex.org' } } }),
    );
    await page.goto('/');
    await page.getByLabel('Email').fill('a@ex.org');
    await page.getByLabel('Mot de passe').fill('motdepasse');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('dialog', { name: 'Connexion' })).toBeHidden();
    await expect(page.getByText('Amina')).toBeVisible();
    await expect(page.getByRole('button', { name: /Battle/ })).toBeFocused();
  });
});
