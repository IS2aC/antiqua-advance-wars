# ALKÉBULAN — règles du projet pour Claude Code

Jeu de tactique au tour par tour sur grille, dans le navigateur, avec des armées antiques (Afrique, Méditerranée).
Présentation et architecture : `README.md`. Bible de production (prompts, étapes) : `docs/bible-de-production.md`. Règles et données : `docs/game-design.md` (source de vérité). Art : `docs/art-bible.md`.
Idées pour plus tard (à ne pas implémenter sans demande) : `docs/ajustements.md`.

## Architecture

Monorepo pnpm :

| Dossier                | Package                   | Rôle                                                   |
| ---------------------- | ------------------------- | ------------------------------------------------------ |
| `packages/engine`      | `@antiqua/engine`         | Moteur de règles, **TypeScript pur, zéro dépendance**  |
| `apps/game`            | `@antiqua/game`           | Client Phaser 4 + Vite (rendu, input, UI)              |
| `apps/site`            | `@antiqua/site`           | Site vitrine Astro                                     |
| `apps/server`          | `@antiqua/server`         | Comptes, présence, jeu en ligne (Fastify + PostgreSQL) |
| `packages/protocol`    | `@antiqua/protocol`       | Messages du jeu en ligne (types partagés)              |
| `tools/asset-pipeline` | `@antiqua/asset-pipeline` | Pipeline d'assets Node (`pnpm assets:build`)           |
| `tools/cli`            | `@antiqua/cli`            | Match aléatoire en console (`pnpm match`)              |

### Séparation moteur / rendu (règle n°1)

- `packages/engine` n'importe **jamais** `phaser`, ni rien de `apps/` ou `tools/`. ESLint le vérifie.
- API du moteur : `applyAction(state, action) → { state, events }`. Immuable, déterministe (PRNG mulberry32 à graine stockée dans l'état).
- Le rendu traduit les clics en `Action`, envoie au moteur, puis joue les `GameEvent` dans l'ordre (`EventPlayer`). **La vue ne modifie jamais l'état.**
- Une action illégale renvoie une erreur typée, jamais d'exception silencieuse.

### Comptes et serveur (`apps/server`)

- Pas d'accès au jeu sans compte : la page de garde est floutée derrière « Se connecter / Créer un compte » (`src/garde/compte.ts`), `jeu.html` renvoie à la page de garde sans session (`src/main.ts`). Client de l'API : `src/compte/api.ts`.
- API sous `/api` : `inscription`, `connexion`, `deconnexion`, `moi`, `sante`, WebSocket `presence` (nombre de joueurs en ligne). Mots de passe hachés scrypt, session = cookie HttpOnly (`alk_session`), seule l'empreinte SHA-256 du jeton est en base. Schéma créé au démarrage (`pg-store.ts`) ; tests sur `MemoryStore`, sans base.
- En développement : `docker compose -f docker-compose.yml -f compose.local.yml up -d db`, puis `pnpm dev:server` (port 3000) ; Vite relaie `/api` (`vite.config.ts`). Tests de bout en bout : `e2e/fixtures.ts` simule un joueur connecté (`connecte: false` pour l'écran de connexion) ; `E2E_PORT` si 5173 est pris.

### Jeu en ligne (J1 contre J2, JN)

- Salon sur la page de garde (`src/garde/en-ligne.ts`) : choisir son peuple, créer une partie (duel : Gué du Nil ou Côte ; JN : Carrefour), rejoindre un duel ouvert (peuple différent), demander la place d'une IA dans une JN, répondre aux demandes, reprendre ses parties. Partie : `jeu.html?mode=enligne&partie=<id>` ; `main.ts` attend l'état officiel (`src/online/session.ts`) avant de lancer Phaser, puis pose le bandeau HTML (`src/online/overlay.ts` : minuteur, demandes de place, messages).
- Serveur (`apps/server/src/online.ts`, WebSocket `/api/jeu`, messages typés dans `packages/protocol`) : il garde l'état officiel, valide chaque action avec le moteur (camp qui a la main, action légale), l'enregistre (`parties_en_ligne`, rechargée au démarrage) et la transmet aux autres. Duel : abandon = victoire de l'adversaire.
- JN : la partie commence tout de suite, J1 contre 3 IA que le serveur joue (`planTurn`). Fermée par défaut (invisible au salon) : J1 l'ouvre à la création ou ensuite (message `ouvrir`) ; la fermer refuse les demandes en attente. Un joueur demande la place d'une IA, J1 (premier humain encore en jeu) accepte ou refuse ; un joueur qui abandonne rend son camp à l'IA. Plus aucun humain en jeu : partie finie.
- Minuteur (`TURN_TIME_MS`, 3 min 30) : dès que deux humains jouent, celui qui a la main doit commencer son tour (message `actif` au premier déplacement, ou une action) ; sinon le serveur joue `END_TURN` (`tour-passe`). Le compte repart de zéro une fois quand l'écran du joueur arrive à son tour (`pret`).
- Client : le contrôleur envoie ses actions (`execute` → `sendToRemote` ; un `MOVE` part avec l'action qui le suit, puisqu'on peut l'annuler) et rejoue celles des autres camps (joueurs ou IA du serveur) comme un tour d'IA (mode `remote`). Désaccord avec le serveur : la page se recharge, l'état du serveur fait foi.
- Tests : `apps/server/test/online.test.ts` ; bout en bout à deux navigateurs `e2e/en-ligne.spec.ts` (duel et JN), avec le serveur en mémoire (`pnpm --filter @antiqua/server start:memoire`, lancé par `playwright.config.ts`, `API_PORT`).

### Client de jeu (`apps/game/src`)

- Deux pages : `index.html` = page de garde (HTML/CSS, `src/garde/`, sans Phaser) ; `jeu.html` = le jeu. Menu : Continuer, Campagne (bientôt), Battle → J1 vs CPU, J1 vs 3 CPU, J1 vs J2 online et JN (salon en ligne), Duel sur la côte, Défense de forteresse. La page de garde lance `jeu.html?mode=ia|deux|continuer&carte=…` (`src/launch.ts`) ; « Menu principal » en fin de partie y ramène. Images : `art/static/` → `public/assets/garde/` via `pnpm assets:cover`.

- `controller/BattleController.ts` : seul endroit qui transforme les entrées en `Action`, appelle `applyAction` et remplace l'état courant. Annuler un déplacement = revenir à l'état d'avant le `MOVE` (le moteur n'a rien tiré au hasard).
- `animation/EventPlayer.ts` : joue les `GameEvent` dans l'ordre, puis recale la vue sur l'état final (`sync`).
- `combat/` : `setup.ts` (pur) tire du résultat du moteur les deux camps, leurs PV avant/après et les coups ; la scène illustre, elle ne calcule jamais. Les combats sont joués par `drawn/` (combats dessinés, seule scène de combat). Captures : jouées sur le plateau (`view/CaptureFx.ts` : l'unité pousse, jauge au-dessus du bâtiment, changement de couleur, étincelles) ; seule l'annexion du QG adverse passe en plein écran, `CaptureScene.ts`, en pixel art ; `stage.ts` (décor, figurants) et `packs.ts` (figurants 64×64 par peuple et décors par terrain, `art/raw/peuples/<peuple>/combat/` et `art/raw/combat/decors/`, voir `docs/art-combat.md` ; sinon sprites de carte ×2 et décors en tuiles) la servent ; `StagedScene.ts` (vitesse, passage par clic ou Entrée) est commun avec les combats dessinés. Réglage « Scènes de combat : oui / non » dans la pause (`persistence/options.ts`) ; « non » = animation courte sur la carte.
- `drawn/` : combats dessinés. Chargement : décors et écussons au démarrage, dessins des unités par peuple (`loadPeoples`), une planche par unité (`atlas.webp` + `atlas.json`, images détourées, `tools/asset-pipeline/src/drawn-atlas.ts`), lancé dès l'ouverture de la partie pour ses seuls peuples ; adresses versionnées par l'empreinte du manifeste (`?v=`), gardées un an en cache (`nginx.conf`). Second jeu Phaser en 1920×1152, sans pixel art, superposé au canvas de la carte le temps d'un combat (`DrawnStage.ts`) ; `DrawnCombatScene.ts` compose le déroulé en 6 temps à partir du même `CombatSetup`. Images : `art/raw/combat-dessine/` (un dossier par unité, `unites/<unité>/` : `poses`, `repos`, `attaque`, `charge`, `chute`, `sonne`, dessinés une fois en rouge comme les sprites puis recolorés par peuple ; `peuples/<peuple>/<unité>/` prioritaire, lui aussi dessiné en rouge et recoloré ; `A-FAIRE.md` généré liste ce qui manque) → `pnpm assets:dessin` (détourage, séparation des dessins, recoloration, séquences calées) → `public/assets/combat-hd/` ; ce qui manque est dessiné en provisoire. Génération : `pnpm art:generer` (fiches `art/specs/`, contrôles, budget, `validation.html`). Banc d'essai (outil de test, caché aux joueurs) : `jeu.html?mode=proto`, en développement seulement (entrée du menu en commentaire dans `index.html`, `ProtoBench.ts`). Prompts : `docs/proto-combat.md`.
- IA adverse : `packages/engine/src/ai/greedy-ai.ts` (`chooseGreedyAction`, `planTurn`), gloutonne et déterministe. Le contrôleur joue le tour de l'IA action par action via l'`EventPlayer` (mode `ai`, bouton « Accélérer »). La sauvegarde garde les camps joués par l'IA (`aiPlayers`).
- `view/` : objets d'affichage seulement (carte, unités, curseur, zones, flèche, menus, HUD, bandeau). Les éléments fixés à l'écran passent par `pinToScreen()` (contournement d'un bug de `Container.setScrollFactor` dans Phaser 4.2).
- Les cartes viennent du moteur (`GUE_DU_NIL` à 2 peuples, `CARREFOUR` à 4 peuples, symétrique par quart de tour), pas d'un fichier Tiled : une seule source de vérité tant qu'on ne dessine pas les cartes dans Tiled. Choix par l'URL (`jeu.html?mode=ia&carte=carrefour`, registre `apps/game/src/maps.ts`) ; contre l'IA, le joueur commande le peuple choisi sur la page de garde (écran « Choisis ton peuple », `src/garde/peuples.ts`, `peuple=` dans l'URL, Koush par défaut, 6 peuples : Koush, Carthage, Almoravides, Ashanti, Dahomey, Sosso ; un peuple absent de la carte prend le premier camp) et l'IA tous les autres. « À deux joueurs » = duel contre l'IA : on choisit aussi le peuple de l'IA (`adversaire=`), et le moteur réattribue les camps de la carte (`assignPeoples`) ; le mode `deux` (même écran) n'a plus d'entrée au menu. Portraits des dirigeants et écussons : découpés des planches `art/reference/peuples/` et `art/static/peuples/` par `pnpm assets:cover`.
- En développement, le jeu est exposé sur `window.__ANTIQUA_GAME__` (tests de bout en bout, console).

### Rendu pixel art

- Phaser 4.2.1 est patché (`patches/phaser@4.2.1.patch`, `pnpm patch`) : le shader de teinte divisait par un alpha nul (0/0) sur les pixels transparents, ce qui affichait des carrés noirs derrière les sprites sur les vieux iPhone/iPad (issue phaserjs/phaser#7392). À retirer quand une version de Phaser intègre le correctif.
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
pnpm dev:server       # serveur des comptes (base : voir docker-compose.yml)
pnpm test             # tests (Vitest, couverture du moteur)
pnpm lint             # ESLint + Prettier
pnpm typecheck        # tsc sur tous les packages
pnpm build            # build de tous les packages
pnpm assets:build     # pipeline d'assets : art/raw → apps/game/public/assets/atlas + report.html
pnpm assets:cover     # images de la page de garde : art/static → apps/game/public/assets/garde (WebP)
pnpm assets:dessin    # combats dessinés (proto) : art/raw/combat-dessine → apps/game/public/assets/combat-hd
pnpm art:generer      # génère les dessins de combat via OpenRouter ou OpenAI (fiches art/specs/, --liste, --faux, --budget)
pnpm match            # match aléatoire en ligne de commande (moteur seul)
```

Docker : `docker-compose.yml` (Dokploy, aucun port publié) lance la base PostgreSQL, le serveur des comptes et le jeu (service `alkebulan`, Nginx, `/api` relayé vers le serveur) ; `POSTGRES_PASSWORD` à définir dans Dokploy. En local, ajouter `-f compose.local.yml` (ports, cookie sans HTTPS) : http://localhost:8080. `docker build -t antiqua .` seul sert le jeu sans comptes.
