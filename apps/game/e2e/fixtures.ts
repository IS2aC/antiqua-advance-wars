import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';

/** Joueur simulé : les tests du jeu tournent sans le serveur des comptes. */
export const TEST_PLAYER = { id: 'test', pseudo: 'Testeur', email: 'testeur@exemple.org' };

/**
 * `test` de Playwright avec un joueur déjà connecté : `/api/moi` répond le joueur simulé et
 * la présence annonce 3 joueurs en ligne. `connecte: false` laisse la page sans session.
 */
export const test = base.extend<{ connecte: boolean }>({
  connecte: [true, { option: true }],
  page: async ({ page, connecte }, use) => {
    await page.route('**/api/moi', (route) =>
      connecte
        ? route.fulfill({ json: { joueur: TEST_PLAYER, enLigne: 3 } })
        : route.fulfill({ status: 401, json: { erreur: 'Non connecté.' } }),
    );
    await page.routeWebSocket('**/api/presence', (socket) => {
      socket.send(JSON.stringify({ type: 'enLigne', nombre: 3 }));
    });
    await use(page);
  },
});
