# ANTIQUA — règles du projet pour Claude Code

Jeu de tactique au tour par tour sur grille, dans le navigateur, avec des armées antiques (Afrique, Méditerranée).
Bible complète : `README.md`. Règles et données : `docs/game-design.md` (source de vérité). Art : `docs/art-bible.md`.

## Architecture

Monorepo pnpm :

| Dossier                | Package                   | Rôle                                                  |
| ---------------------- | ------------------------- | ----------------------------------------------------- |
| `packages/engine`      | `@antiqua/engine`         | Moteur de règles, **TypeScript pur, zéro dépendance** |
| `apps/game`            | `@antiqua/game`           | Client Phaser 4 + Vite (rendu, input, UI)             |
| `apps/site`            | `@antiqua/site`           | Site vitrine Astro                                    |
| `tools/asset-pipeline` | `@antiqua/asset-pipeline` | Pipeline d'assets Node (`pnpm assets:build`)          |
| `tools/cli`            | `@antiqua/cli`            | Match aléatoire en console (`pnpm match`)             |

### Séparation moteur / rendu (règle n°1)

- `packages/engine` n'importe **jamais** `phaser`, ni rien de `apps/` ou `tools/`. ESLint le vérifie.
- API du moteur : `applyAction(state, action) → { state, events }`. Immuable, déterministe (PRNG mulberry32 à graine stockée dans l'état).
- Le rendu traduit les clics en `Action`, envoie au moteur, puis joue les `GameEvent` dans l'ordre (`EventPlayer`). **La vue ne modifie jamais l'état.**
- Une action illégale renvoie une erreur typée, jamais d'exception silencieuse.

### Client de jeu (`apps/game/src`)

- `controller/BattleController.ts` : seul endroit qui transforme les entrées en `Action`, appelle `applyAction` et remplace l'état courant. Annuler un déplacement = revenir à l'état d'avant le `MOVE` (le moteur n'a rien tiré au hasard).
- `animation/EventPlayer.ts` : joue les `GameEvent` dans l'ordre, puis recale la vue sur l'état final (`sync`).
- IA adverse : `packages/engine/src/ai/greedy-ai.ts` (`chooseGreedyAction`, `planTurn`), gloutonne et déterministe. Le contrôleur joue le tour de l'IA action par action via l'`EventPlayer` (mode `ai`, bouton « Accélérer »). La sauvegarde garde les camps joués par l'IA (`aiPlayers`).
- `view/` : objets d'affichage seulement (carte, unités, curseur, zones, flèche, menus, HUD, bandeau). Les éléments fixés à l'écran passent par `pinToScreen()` (contournement d'un bug de `Container.setScrollFactor` dans Phaser 4.2).
- La carte vient du moteur (`GUE_DU_NIL`), pas d'un fichier Tiled : une seule source de vérité tant qu'on ne dessine pas les cartes dans Tiled.
- En développement, le jeu est exposé sur `window.__ANTIQUA_GAME__` (tests de bout en bout, console).

### Rendu pixel art

- `TILE_SIZE = 32` (constante unique dans `apps/game/src/config.ts`, jamais de 32 en dur ailleurs).
- Résolution logique 640×384 (20×12 cases), zoom **entier** uniquement (×1, ×2, ×3), `pixelArt: true`, `roundPixels: true`.

## Conventions

- TypeScript strict partout (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- Code et identifiants en anglais ; commentaires, docs et textes du jeu en français.
- Noms de types de données métier en français tels que dans game-design.md (`fantassin`, `lancier`, `archers`, `cavalerie`, `char`, `catapulte`).
- Frames d'atlas : `unit/<type>/<anim>/<direction>/<index>`, `terrain/<type>/<variante>`.
- `apps/game/public/assets/` est **généré** par le pipeline : ne pas éditer à la main.
- Sprites : pas de retouche manuelle requise ; `art/clean/` (facultatif) a priorité sur la sortie automatique.
- Un fichier de test par règle dans `packages/engine/test/`, couverture ≥ 80 %.

## Commandes

```bash
pnpm install          # dépendances
pnpm dev              # client de jeu (http://localhost:5173)
pnpm dev:site         # site vitrine
pnpm test             # tests (Vitest, couverture du moteur)
pnpm lint             # ESLint + Prettier
pnpm typecheck        # tsc sur tous les packages
pnpm build            # build de tous les packages
pnpm assets:build     # pipeline d'assets : art/raw → apps/game/public/assets/atlas + report.html
pnpm match            # match aléatoire en ligne de commande (moteur seul)
```

Docker : `docker build -t antiqua .` sert `apps/game/dist` via Nginx (compatible Dokploy).
