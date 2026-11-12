# antiqua-advance-wars
------------------------------------------------------------------
## Jeu tactique Antique — Bible de production (Stage 1)

Nov 12, 2026 · @Is2ac

## Vision et périmètre du Stage 1

On construit un jeu de stratégie au tour par tour, case par case, jouable dans le navigateur, avec des armées de l'Antiquité (Afrique et Méditerranée) à la place des tanks. Le Stage 1 = une seule carte jouable de bout en bout : 2 factions, 6 unités, 9 terrains et 3 bâtiments, production, capture, combat, victoire.

**Nom du jeu — à changer avant toute publication.** « Advance Wars » est une marque de Nintendo : on peut s'inspirer librement des mécaniques (grille, tour par tour, capture, production), mais ni le nom, ni le logo, ni les sprites, ni les personnages ne doivent être repris ou imités. « Advance Wars Antique » ou « Advance Wars Africa » exposent à un retrait de la page ou de l'hébergement dès qu'il y a de la visibilité. Ce document utilise le nom de travail **ANTIQUA — Guerre des Royaumes** ; autres pistes : *Royaumes de Bronze*, *Kemet Tactics*, *Lances & Sables*.

Même logique pour les prompts d'images : ils décrivent un style (pixel art 32 px façon consoles portables 2001–2005, proportions trapues, contours sombres) sans jamais nommer le jeu de Nintendo. Ton planche « Africa Campaign » sert de référence d'ambiance, pas de modèle à copier.

**Lecture retenue de « antique »** (à ajuster) : factions inspirées de civilisations antiques, avec l'ancrage africain de ta planche.

| Faction (couleur) | Inspiration | Signature de gameplay (Stage 2+) |
| --- | --- | --- |
| Koush (bleu) | Royaume de Kerma / Napata, « pays de l'arc » | Archers +1 portée |
| Carthage (rouge) | Puissance navale punique | Éléphants moins chers |
| Kemet (jaune) | Égypte pharaonique | Chars de guerre plus rapides |
| Aksoum (vert) | Royaume d'Aksoum | Infanterie capture plus vite |

**Stage 1 = Koush vs Carthage**, les unités partagent les mêmes sprites et ne changent que de couleur d'équipe (exactement comme le genre le fait). Les commandants, pouvoirs spéciaux, brouillard de guerre, unités navales et multijoueur arrivent après.

## Prompt de la pochette (site web)

Génère l'illustration **sans texte**, puis pose le logo dans Figma : les modèles d'image déforment encore les lettres. Deux formats : jaquette 3:4 (page du jeu) et bannière 16:9 (hero du site). Les prompts sont en anglais, le modèle y répond mieux.

**Version A — jaquette illustrée (3:4)**

```text
Video game box art, portrait 3:4, vibrant hand-painted anime illustration in the style of early-2000s handheld strategy game covers. Dynamic low-angle composition: in the foreground a young Kushite commander in blue-and-gold linen armor and a leopard-skin shoulder cape points a bronze spear forward, shouting an order. Behind him, a charging African war elephant with a blue banner and two archers on its back, a two-wheeled war chariot pulled by horses, and a line of infantry with tall oval hide shields. In the background, across a river, a rival red army with a catapult launching a flaming stone. Setting: golden savanna, acacia trees, distant mud-brick pyramids of Meroe, dramatic sunset sky orange to purple, dust and motion lines. Bold clean outlines, saturated colors, cel shading, heroic and fun, not gory. Leave the top 25% of the image as open sky for a title logo. No text, no letters, no logo, no watermark.
```

**Version B — bannière pixel art (16:9)**

```text
Wide 16:9 pixel art key visual, 320x180 pixel resolution upscaled with nearest-neighbor, limited palette of 32 colors, crisp pixels, no anti-aliasing, no gradients. A tactical battlefield seen from a high 3/4 angle: blue army on the left (spear infantry with oval shields, archers, horse cavalry, a war elephant), red army on the right (infantry, catapult, chariot), a river with a wooden bridge in the middle, savanna grass, acacia trees, rocky hills, a mud-brick fortress with a blue flag on the left and a red flag on the right. Chibi proportions, units about 2 heads tall, dark 1-pixel outlines, warm sunset lighting. Leave the center-top area empty for a title. No text, no UI, no letters.
```

**Logo** : typo display épaisse type *Lilita One* ou *Bungee* (licences OFL), contour sombre 4 px, dégradé or vers ocre, bandeau rouge sous le titre pour « Guerre des Royaumes ». Garde l'icône Afrique de ta planche, c'est une bonne idée et elle est à toi.

## Étapes de développement

Le Stage 1 tient en 8 étapes, environ 6 à 8 semaines pour un dev seul avec Claude Code. Règle d'or : **la logique du jeu avance avec des carrés de couleur**, les vrais sprites arrivent à l'étape 4. Tu ne bloques jamais le code en attendant l'art.

1. **Fondations** (2–3 jours) — monorepo, Vite + TypeScript + Phaser, lint, tests, CI, déploiement preview.
   - Sortie : une page affiche une grille 20×12 de cases colorées, déployée sur une URL.
2. **Moteur de règles pur** (1–2 semaines) — état de partie, terrains, unités, calcul de déplacement (coûts par terrain), portée d'attaque, formule de dégâts, riposte, capture, argent, fin de tour, victoire. Zéro dépendance graphique.
   - Sortie : 80 %+ de couverture de tests ; une partie se joue entièrement en ligne de commande.
3. **Rendu et interaction** (1–2 semaines) — carte chargée depuis Tiled, curseur, zone de déplacement bleue, zone d'attaque rouge, flèche de chemin, déplacement animé case par case, menu d'action (Attendre / Attaquer / Capturer), unités grisées après action.
   - Sortie : on joue une partie à 2 sur le même écran avec des placeholders.
4. **Pipeline d'assets** (1 semaine, en parallèle de 2–3) — génération, nettoyage **automatique** (pixels parasites, recentrage, contour, coin des PV), quantification palette, découpage, atlas, couleurs d'équipe par palette swap. Aucune retouche manuelle requise.
   - Sortie : `pnpm assets:build` produit l'atlas ; les placeholders sont remplacés.
5. **Boucle de jeu complète** — production dans les casernes, HUD (infos terrain, infos unité, or, jour), prévision de combat (dégâts estimés), écran de début de tour, écran de victoire, sauvegarde locale.
   - Sortie : une partie de 15–20 jours se termine sans bug bloquant.
6. **IA adverse simple** — IA « gloutonne » : capture, attaque la meilleure cible, produit selon l'or.
   - Sortie : l'IA bat un joueur passif et perd contre un joueur attentif.
7. **Habillage** — sons, musique, transitions, menu titre, mobile (tap), mini-animation de combat optionnelle.
8. **Site vitrine et lancement** — page du jeu avec la pochette, bouton Jouer, analytics, retours joueurs.
   - Sortie Stage 1 : la carte « Le Gué du Nil » jouable contre l'IA, 60 fps sur un PC moyen et un Android milieu de gamme.

**Après le Stage 1** : Stage 2 = commandants et pouvoirs, brouillard de guerre, unités navales, 5 cartes de campagne. Stage 3 = multijoueur asynchrone (tour par tour en ligne). Stage 4 = éditeur de cartes communautaire.

## Stack graphique

Tout repose sur une grille de **32×32 px**, affichée à l'échelle entière ×1, ×2 ou ×3 (32, 64 ou 96 px à l'écran), sans lissage. C'est ce qui donne la netteté du genre ; une échelle non entière (×1,5) déforme les pixels. **Décision prise : 32×32** plutôt que 16×16, car les générateurs d'images y sont nettement meilleurs et cela évite la retouche manuelle. `TILE_SIZE` reste une constante unique côté jeu ; le moteur de règles n'en dépend pas.

**Résolution logique** : 640×384 px = 20×12 cases visibles, caméra qui défile sur les cartes plus grandes. Rendu à 640×384 (×1), 1280×768 (×2) ou 1920×1152 (×3) selon l'écran.

| Asset | Taille du cadre | Frames | Notes |
| --- | --- | --- | --- |
| Unité sur carte (idle) | 32×32 | 3 (boucle 1-2-3-2, 150 ms) | Profil tourné vers la droite ; vers la gauche = miroir dans le code |
| Unité en marche | 32×32 | 4 par direction : droite, haut (dos), bas (face) | Gauche = miroir de droite ; jouée pendant le déplacement case par case |
| Unité « a agi » | — | — | Aucun sprite : désaturation + assombrissement dans le code |
| PV, capture, ravitaillement | 10×10 | 1 | Chiffres 1–9 et icônes posés en bas à droite de la case |
| Tuile de terrain | 32×32 | 1 (eau : 4 frames) | Routes, rivières : jeu de 16 tuiles d'autotiling |
| Bâtiment | 32×64 | 1 | Dépasse d'une case vers le haut, ancré en bas ; 5 versions : neutre + 4 factions |
| Portrait de commandant | 96×96 | 1–3 expressions | Stage 2 |
| Panneaux d'interface | 9-slice 24×24 | 1 | Grille de 8 px pour tout le HUD |

**Règles de lisibilité pour le déplacement case par case** : chaque unité tient dans 30×30 px utiles (1 px de marge), les pieds sur la ligne 31, la silhouette reconnaissable en noir pur. Les grosses unités (éléphant, catapulte) restent dans 32×32 : on les dessine « chibi », pas à l'échelle réelle. Le coin bas-droit (10×10 px) reste peu chargé, c'est là que s'affichent les PV.

**Palette** : une palette maître de 32 couleurs, part de *Endesga 32* sur Lospec et remplace 4 teintes par des ocres de savane. Contours en brun-noir, jamais en noir pur. Lumière venant d'en haut à gauche, partout.

**Couleurs d'équipe** : toutes les unités sont dessinées une seule fois en **rouge** (rampe de 4 rouges réservés, utilisés nulle part ailleurs). Le script de build remplace ces 4 couleurs exactes pour produire bleu, jaune et vert. Un sprite = 4 factions, sans régénérer.

**Outils**

- **Aseprite** (\~20 $, ou Pixelorama gratuit) : retouche, animation, export en planche.
- **Tiled** (gratuit) : dessin des cartes, export JSON, règles d'autotiling (Wang sets) pour routes et rivières.
- **Lospec** : palettes ; **free-tex-packer-cli** : atlas de textures.
- **Police pixel** : *m5x7* et *m6x11* de Daniel Linssen (gratuites avec crédit) pour le HUD.
- **Figma** : maquettes d'interface, logo, pochette finale.

## Stack technique

TypeScript partout, **Phaser 4** pour le rendu, et un moteur de règles en TypeScript pur, séparé du rendu. Cette séparation est la décision la plus importante : elle rend la logique testable, permet l'IA (qui simule des coups) et le multijoueur plus tard (le serveur exécute le même moteur pour valider les tours).

| Couche | Choix | Pourquoi |
| --- | --- | --- |
| Langage / build | TypeScript 5 strict, Vite, pnpm workspaces | Build instantané, un seul langage client/serveur |
| Rendu 2D | Phaser 4.x ([release 4.0.0, avril 2026](https://phaser.io/download/phaser4)) | Tilemaps, sprites, caméra, input souris/tactile, `pixelArt: true` ; le dépôt inclut des fichiers *skills* pour agents IA, utiles avec Claude Code ([README](https://cdn.jsdelivr.net/npm/phaser@4.2.0/README.md)) |
| Moteur de règles | Package `@antiqua/engine`, TS pur, zéro dépendance | `applyAction(state, action) → { state, events }` : déterministe, rejouable, annulable |
| Aléatoire | PRNG avec graine (mulberry32) dans l'état | Bonus de chance sur les dégâts, parties rejouables à l'identique |
| Déplacement | Dijkstra borné par les points de mouvement, coût par type de déplacement × terrain | Alliés traversables mais pas d'arrêt dessus, ennemis bloquants |
| Cartes | Tiled → JSON, propriétés custom (propriétaire, unités de départ) | Level design sans coder |
| Tests | Vitest (moteur), Playwright (parcours de fumée) | Le moteur doit être couvert avant le rendu |
| Sauvegarde Stage 1 | localStorage (sérialisation JSON de l'état) | Pas de backend au Stage 1 |
| Site vitrine | Astro (statique) | Page rapide, SEO, la pochette et le bouton Jouer |
| Hébergement | Build statique sur Dokploy (Nginx) ou Cloudflare Pages | Aucun serveur applicatif au Stage 1 |
| Plus tard (Stage 3) | Supabase (Postgres, auth, realtime) + Edge Function qui exécute `@antiqua/engine` | Tour par tour asynchrone, anti-triche côté serveur |
| Assets | Scripts Node (`sharp`) : nettoyage, quantification, palette swap, atlas | Pipeline reproductible, `pnpm assets:build` |

**Flux d'une action** : clic du joueur → la scène Phaser traduit en `Action` (`MOVE`, `ATTACK`, `CAPTURE`, `BUILD`, `END_TURN`) → le moteur valide et renvoie le nouvel état + des `events` (`unitMoved`, `damageDealt`, `unitDestroyed`…) → le rendu joue les animations des events dans l'ordre. Le rendu ne modifie jamais l'état lui-même.

## Organisation des fichiers

Un monorepo pnpm : le moteur, le client de jeu, le site et le pipeline d'assets vivent séparément, et les **sources d'art ne sont jamais mélangées aux fichiers exportés**.

```text
antiqua/
├─ CLAUDE.md                     # règles du projet pour Claude Code (archi, conventions, interdits)
├─ package.json                  # scripts racine : dev, test, build, assets:build
├─ pnpm-workspace.yaml
├─ docs/
│  ├─ game-design.md               # règles, unités, terrains (source de vérité)
│  └─ art-bible.md                 # palette, tailles, prompts validés
├─ packages/
│  └─ engine/                      # @antiqua/engine — TS pur, AUCUN import Phaser
│     ├─ src/
│     │  ├─ data/
│     │  │  ├─ units.ts              # stats des 6 unités
│     │  │  ├─ terrains.ts           # défense, coûts de déplacement
│     │  │  └─ damage-table.ts       # dégâts de base attaquant × défenseur
│     │  ├─ model/                   # types : GameState, Unit, Tile, Player, Action, GameEvent
│     │  ├─ rules/
│     │  │  ├─ movement.ts           # reachableTiles(), findPath()
│     │  │  ├─ combat.ts             # targetsInRange(), computeDamage(), forecast()
│     │  │  ├─ capture.ts
│     │  │  ├─ economy.ts            # revenus, production
│     │  │  └─ victory.ts
│     │  ├─ reducer.ts               # applyAction(state, action) → { state, events }
│     │  ├─ ai/greedy-ai.ts
│     │  ├─ rng.ts
│     │  └─ index.ts
│     └─ test/                       # un fichier de test par règle
├─ apps/
│  ├─ game/                        # client Phaser
│  │  ├─ public/assets/              # ⚠ généré par le pipeline, ne pas éditer à la main
│  │  │  ├─ atlas/units.png + units.json
│  │  │  ├─ atlas/terrain.png + terrain.json
│  │  │  ├─ maps/gue-du-nil.json
│  │  │  ├─ ui/  fonts/  audio/
│  │  ├─ src/
│  │  │  ├─ main.ts                  # config Phaser (pixelArt, zoom entier)
│  │  │  ├─ scenes/                  # Boot, Preload, Title, Battle, Hud, Victory
│  │  │  ├─ view/                    # MapView, UnitSprite, RangeOverlay, PathArrow, Cursor
│  │  │  ├─ ui/                      # ActionMenu, BuildMenu, TerrainPanel, UnitPanel, ForecastPanel
│  │  │  ├─ controller/              # InputController : clics → Actions moteur
│  │  │  ├─ animation/EventPlayer.ts  # joue les GameEvent dans l'ordre
│  │  │  └─ persistence/save.ts
│  │  └─ index.html
│  └─ site/                        # Astro : vitrine, pochette, bouton Jouer
├─ art/                           # SOURCES d'art (versionnées, Git LFS)
│  ├─ palette/antiqua-32.gpl  antiqua-32.png
│  ├─ raw/                         # sorties brutes GPT / API, jamais modifiées
│  │  ├─ units/  terrain/  buildings/  cover/
│  ├─ clean/                       # FACULTATIF : retouches manuelles, prioritaires sur l'auto
│  │  ├─ units/fantassin.aseprite …
│  │  └─ terrain/ buildings/
│  └─ maps/gue-du-nil.tmx  antiqua.tsx   # projets Tiled
└─ tools/
   └─ asset-pipeline/
      ├─ slice.ts            # découpe une planche en cases
      ├─ downscale.ts        # image IA → 32 px (vote majoritaire, détection de grille)
      ├─ autofix.ts          # nettoyage auto : pixels isolés, recentrage, pieds, contour, coin PV
      ├─ quantize.ts         # force la palette antiqua-32
      ├─ team-colors.ts      # rouge → bleu / jaune / vert
      └─ pack.ts             # atlas + JSON pour Phaser
```

**Conventions de nommage des frames** : `unit/<type>/<anim>/<direction>/<index>` → `unit/fantassin/walk/right/0`, `unit/fantassin/idle/0`. Terrains : `terrain/<type>/<variante>` → `terrain/route/ns`, `terrain/riviere/coude-ne`.

## Données de jeu du Stage 1

Ces tables sont la source de vérité de `packages/engine/src/data/` et de `docs/game-design.md` ; elles dictent aussi ce que chaque sprite doit communiquer (lourd, rapide, à distance). Valeurs de départ, à équilibrer en jouant.

**Unités** (PV affichés 1–10, 100 PV internes)

| Unité | Rôle | Coût (or) | Déplacement | Type | Portée | Capture |
| --- | --- | --- | --- | --- | --- | --- |
| Fantassin | Infanterie de base, capture | 1 000 | 3 | Pied | 1 | Oui |
| Lancier lourd | Anti-cavalerie, passe les montagnes | 2 500 | 2 | Lourd | 1 | Oui |
| Archers | Tir à distance bon marché | 3 000 | 3 | Pied | 2 exactement (indirect) | Non |
| Cavalerie légère | Éclaireur rapide | 4 000 | 7 | Monture | 1 | Non |
| Char de guerre | Unité de choc | 7 000 | 6 | Roues | 1 | Non |
| Catapulte | Siège, gros dégâts | 6 000 | 4 | Roues | 2–3 (indirect) | Non |

Une unité à tir indirect ne peut pas bouger et tirer dans le même tour, et ne riposte jamais. Les archers tirent à 2 cases exactement : ils ne peuvent pas viser une unité adjacente. Stage 2 : éléphant de guerre, convoi de ravitaillement, navire.

**Terrains et coûts de déplacement** (— = infranchissable)

| Terrain | Défense (★) | Pied | Lourd | Monture | Roues | Revenu / tour |
| --- | --- | --- | --- | --- | --- | --- |
| Plaine (savane) | 1 | 1 | 1 | 1 | 1 | — |
| Forêt (acacias) | 2 | 1 | 1 | 2 | 3 | — |
| Colline | 2 | 1 | 1 | 2 | 3 | — |
| Montagne | 4 | 2 | 1 | — | — | — |
| Désert (dunes) | 1 | 1 | 1 | 2 | 2 | — |
| Marais | 0 | 2 | 2 | 3 | — | — |
| Route / piste | 0 | 1 | 1 | 1 | 1 | — |
| Rivière (gué) | 0 | 2 | 1 | — | — | — |
| Pont | 0 | 1 | 1 | 1 | 1 | — |
| Village | 2 | 1 | 1 | 1 | 1 | 1 000 |
| Caserne (produit les unités) | 3 | 1 | 1 | 1 | 1 | 1 000 |
| QG (sa capture = victoire) | 4 | 1 | 1 | 1 | 1 | 1 000 |

**Capture** : un bâtiment a 20 points ; chaque tour, l'unité qui capture retire ses PV affichés. Elle repart à 20 si l'unité bouge ou meurt.

**Dégâts** (en % des 100 PV du défenseur, arrondi inférieur) :

```latex
D = \left\lfloor (B + L) \cdot \frac{PV_{att}}{10} \cdot \frac{100 - E \cdot PV_{def}}{100} \right\rfloor
```

B = dégâts de base (table ci-dessous), L = chance 0–9 tirée par le PRNG, E = étoiles de défense du terrain du défenseur, PV = PV affichés (1–10). La riposte se calcule après, avec les PV restants du défenseur.

**Dégâts de base B** (ligne = attaquant, colonne = défenseur)

| Att. \\ Déf. | Fantassin | Lancier | Archers | Cav. légère | Char | Catapulte |
| --- | --- | --- | --- | --- | --- | --- |
| Fantassin | 55 | 45 | 60 | 15 | 5 | 15 |
| Lancier lourd | 65 | 55 | 70 | 70 | 55 | 70 |
| Archers | 70 | 60 | 65 | 55 | 30 | 55 |
| Cav. légère | 70 | 30 | 75 | 35 | 10 | 45 |
| Char | 75 | 40 | 80 | 75 | 55 | 70 |
| Catapulte | 90 | 85 | 80 | 75 | 70 | 75 |

**Carte du Stage 1 — « Le Gué du Nil »** : 20×14 cases, symétrique. Un fleuve nord-sud au centre avec 2 ponts et 1 gué. Chaque camp : 1 QG, 2 casernes, 3 villages ; 4 villages neutres au centre. Or de départ : 2 000 ; unités de départ : 2 fantassins.

## Prompts de développement (Claude Code)

Un prompt par étape, à lancer dans l'ordre, chacun dans une session neuve. Avant le prompt 1, copie les sections « Données de jeu », « Stack graphique » et « Organisation des fichiers » de ce document dans `docs/game-design.md` et `docs/art-bible.md` : chaque prompt s'y réfère au lieu de tout répéter.

**Prompt 1 — Fondations**

```text
Tu es lead dev d'un jeu web de stratégie au tour par tour sur grille (genre "tactics" GBA), nom de code ANTIQUA. Lis docs/game-design.md et docs/art-bible.md.

Objectif : initialiser le monorepo.
- pnpm workspaces : packages/engine (TS pur), apps/game (Vite + Phaser 4), apps/site (Astro, page vide pour l'instant), tools/asset-pipeline.
- TypeScript strict partout, ESLint + Prettier, Vitest dans engine, scripts racine : dev, test, build, lint, assets:build.
- Règle d'architecture vérifiée par ESLint : packages/engine ne peut importer ni phaser ni rien de apps/.
- apps/game : config Phaser avec pixelArt: true, roundPixels: true, TILE_SIZE = 32, résolution logique 640x384, zoom entier automatique (x1, x2 ou x3 selon la fenêtre, jamais de zoom fractionnaire), fond #1a1410.
- Une scène Battle qui dessine une grille 20x12 de rectangles 32x32 colorés aléatoirement parmi 5 couleurs de terrain.
- GitHub Actions : lint + test + build sur chaque push.
- Dockerfile multi-stage (build Node -> Nginx) pour servir apps/game/dist, compatible Dokploy.
- Écris CLAUDE.md à la racine : architecture, séparation moteur/rendu, conventions de nommage, commandes.
Critère de fin : pnpm dev affiche la grille nette (pixels carrés, pas de flou), pnpm test et pnpm build passent.
```

**Prompt 2 — Moteur de règles**

```text
Lis CLAUDE.md et docs/game-design.md. Implémente packages/engine, sans aucune dépendance graphique.

1. model/ : types GameState (map, units, players, buildings, currentPlayer, day, rngSeed), Unit (id, type, owner, x, y, hp 0-100, hasMoved, hasActed), Tile, Building (type, owner|null, capturePoints), Action (union discriminée : MOVE, ATTACK, CAPTURE, WAIT, BUILD, END_TURN), GameEvent (unitMoved avec le chemin case par case, attackResolved, counterResolved, unitDestroyed, captureProgress, buildingCaptured, unitBuilt, turnStarted, fundsGained, gameOver).
2. data/ : units.ts, terrains.ts, damage-table.ts avec exactement les valeurs de game-design.md.
3. rules/movement.ts : reachableTiles(state, unitId) par Dijkstra borné aux points de mouvement, coût = terrains[terrain].moveCost[unit.moveType] ; cases infranchissables exclues ; les alliés se traversent mais on ne s'arrête pas dessus ; les ennemis bloquent. findPath() renvoie la liste ordonnée des cases (nécessaire pour l'animation case par case).
4. rules/combat.ts : targetsInRange (direct = cases adjacentes après déplacement ; indirect = portée min-max, uniquement si l'unité n'a pas bougé), computeDamage avec la formule de game-design.md et la chance 0-9 du PRNG, riposte uniquement pour les unités directes adjacentes et survivantes, forecast() qui renvoie la fourchette min-max sans consommer le PRNG.
5. capture.ts, economy.ts (revenus en début de tour, BUILD seulement depuis une caserne possédée et libre), victory.ts (QG capturé ou plus aucune unité après le jour 1).
6. reducer.ts : applyAction(state, action) -> { state, events } ; immuable ; toute action illégale renvoie une erreur typée, jamais d'exception silencieuse.
7. rng.ts : mulberry32, la graine avance dans l'état.
8. Tests Vitest : un fichier par règle, couverture > 80 %, dont : coût montagne pour chaque type, allié traversable, ennemi bloquant, archers qui ne tirent pas après déplacement, capture remise à 20, partie complète scripted jusqu'à gameOver.
Critère de fin : un script tools/cli-match.ts joue une partie aléatoire de 30 jours sans erreur et affiche le vainqueur.
```

**Prompt 3 — Rendu et interaction**

```text
Lis CLAUDE.md. Dans apps/game, branche le rendu sur @antiqua/engine. Utilise encore des placeholders (rectangles colorés 32x32 avec une lettre pour le type d'unité).

- Chargement de la carte depuis public/assets/maps/gue-du-nil.json (format Tiled : un calque terrain, un calque objets pour bâtiments et unités de départ via propriétés custom owner et unitType). Crée aussi cette carte de test 20x14 selon game-design.md.
- view/ : MapView, UnitSprite (position = case, pas de physique), Cursor qui suit la souris et le clavier (flèches + Entrée/Échap), RangeOverlay (cases atteignables en bleu translucide, cases attaquables en rouge), PathArrow qui dessine le chemin pendant le survol.
- Flux : clic sur une unité -> zone bleue -> clic sur une case -> l'unité se déplace CASE PAR CASE le long de findPath (80 ms par case, tween linéaire, sens d'animation droite/gauche/haut/bas selon le pas) -> ActionMenu (Attaquer / Capturer / Attendre, seulement les actions légales) -> Échap annule et ramène l'unité.
- Les unités ayant agi sont assombries (tint gris) jusqu'au tour suivant.
- animation/EventPlayer : file d'attente qui joue les GameEvent dans l'ordre ; aucune modification d'état dans la vue.
- Bouton Fin de tour, bandeau "Jour N — Koush" entre les tours, mode 2 joueurs sur le même écran.
- Caméra : défilement quand le curseur approche du bord, limites de la carte.
Critère de fin : une partie complète jouable à deux, souris et clavier.
```

**Prompt 4 — Pipeline d'assets**

```text
Lis CLAUDE.md et docs/art-bible.md. Crée tools/asset-pipeline en Node + sharp, exécuté par pnpm assets:build.

- slice.ts : prend une planche art/raw/... (fond magenta #FF00FF uni, sprites disposés en grille), détecte les cases et les découpe.
- downscale.ts : détecte la taille du "gros pixel" de l'image IA (analyse des runs de couleur), réduit chaque case à 32x32 par vote majoritaire par bloc (pas de moyenne, pas de bilinéaire), magenta -> transparent.
- autofix.ts : nettoyage automatique qui remplace la retouche manuelle : supprime les pixels isolés et les franges, recentre le sprite horizontalement, pose les pieds sur la dernière ligne, ajoute ou corrige le contour 1 px #2B1B17, vide le coin bas-droit 10x10, signale tout pixel rouge réservé hors des zones d'équipe.
- quantize.ts : remplace chaque pixel par la couleur la plus proche de art/palette/antiqua-32.png (distance en espace Lab), alpha binaire (0 ou 255).
- team-colors.ts : remplace les 4 rouges réservés par les rampes bleu, jaune, vert définies dans art-bible.md -> 4 variantes par sprite.
- pack.ts : atlas units.png/units.json et terrain.png/terrain.json au format Phaser, noms de frames selon la convention de art-bible.md (unit/<type>/<anim>/<direction>/<index>).
- Un rapport HTML tools/asset-pipeline/report.html qui affiche chaque sprite à x1 et x2 sur fond damier, sur chaque terrain, avec les avertissements d'autofix, pour décider : accepter ou régénérer.
- Facultatif : un fichier présent dans art/clean/ a priorité sur la sortie automatique.
Puis remplace les placeholders du jeu par l'atlas : animations idle (1-2-3-2, 150 ms) et walk par direction, miroir horizontal pour la gauche.
```

**Prompt 5 — Boucle de jeu complète**

```text
Lis CLAUDE.md. Complète l'expérience de partie dans apps/game :
- BuildMenu : clic sur une caserne libre possédée -> liste des 6 unités avec coût, grisées si or insuffisant ; l'unité produite ne peut pas agir ce tour.
- HUD (scène Hud superposée) : TerrainPanel (nom, étoiles de défense, points de capture), UnitPanel (PV, déplacement, portée), compteur d'or et jour, coin opposé au curseur pour ne jamais masquer la carte.
- ForecastPanel : au survol d'une cible, dégâts estimés min-max et riposte estimée via engine.forecast().
- Chiffre de PV 8x8 en bas à droite des unités blessées, icône de capture en cours.
- Écran de victoire / défaite avec statistiques (jours, unités produites, perdues).
- persistence/save.ts : sauvegarde automatique en localStorage à chaque fin de tour, bouton Continuer sur l'écran titre.
- Toute l'UI en police pixel m5x7, panneaux 9-slice, grille de 8 px.
Critère de fin : test Playwright qui lance une partie, produit une unité, déplace, attaque, termine le tour.
```

**Prompt 6 — IA adverse**

```text
Lis CLAUDE.md. Implémente packages/engine/src/ai/greedy-ai.ts : planTurn(state, playerId) -> Action[].
Pour chaque unité, dans l'ordre (indirects d'abord, puis unités qui peuvent capturer, puis le reste) : évalue chaque case atteignable et chaque action avec un score = dégâts infligés x coût de la cible - dégâts de riposte x coût propre + bonus capture (QG > caserne > village) + bonus défense du terrain - malus si la case est dans la portée de beaucoup d'ennemis. Utilise forecast() (moyenne) pour ne pas consommer le PRNG.
Production : dépense l'or en visant un ratio 50 % fantassins/lanciers, 30 % mobiles, 20 % indirects, en réagissant à la composition adverse (plus de lanciers si l'adversaire a de la cavalerie).
Côté jeu : l'IA joue ses actions une par une via l'EventPlayer, avec la caméra qui suit, 250 ms entre deux unités, bouton pour accélérer.
Tests : l'IA ne produit jamais d'action illégale sur 200 parties simulées ; elle bat un joueur qui ne fait rien en moins de 20 jours.
```

**Prompt 7 — Habillage**

```text
Lis CLAUDE.md. Ajoute : écran titre (illustration de pochette, Nouvelle partie / Continuer / Options), transitions en fondu pixelisé, sons (sélection, déplacement, attaque, destruction, capture, fin de tour) depuis public/assets/audio, musique en boucle par faction, volume mémorisé. Mobile : tap = clic, appui long = infos, boutons tactiles 48 px min, orientation paysage forcée avec message en portrait. Option : mini-scène de combat de 1,5 s (deux camps face à face, PV qui descendent) désactivable dans les options. Vérifie 60 fps sur la carte complète avec 30 unités (profiling Chrome) et un bundle initial < 2 Mo.
```

**Prompt 8 — Site vitrine**

```text
Lis CLAUDE.md. Construis apps/site en Astro : page d'accueil avec la pochette en hero (art/raw/cover), logo, pitch en 2 phrases, bouton "Jouer maintenant" vers /play (build de apps/game copié dans le site), section factions, section "comment jouer" en 4 visuels, formulaire de retour (Formspree ou endpoint simple), balises Open Graph avec la pochette, analytics léger (Plausible ou Umami auto-hébergé). Style pixel cohérent avec le jeu, police m6x11 pour les titres, texte courant en police lisible. Mets à jour le Dockerfile pour servir le site + /play.
```

## Génération des sprites : GPT ou API dédiée

**Recommandation : GPT pour la pochette et la planche de style, une API pixel art dédiée (PixelLab, Retro Diffusion) pour les sprites finaux, nettoyage 100 % automatique par le pipeline. Pas de retouche manuelle : un sprite raté se régénère.** GPT produit du « style pixel art » : bords lissés, gros pixels de tailles inégales, des centaines de couleurs. Le pipeline corrige une partie de ces défauts, mais les API dédiées partent d'une grille propre.

| Outil | Ce qu'il fait bien | Accès | Usage dans ANTIQUA |
| --- | --- | --- | --- |
| [PixelLab](https://api.pixellab.ai/v2/llms.txt) | Personnages en 4 ou 8 directions, animations, tilesets, objets de carte, retouche (inpaint, rotation) | API REST, serveur MCP pour Claude Code, extension Aseprite ([docs](https://www.pixellab.ai/docs/ways-to-use-pixellab)) | Unités (4 directions + marche), tilesets d'autotiling |
| [Retro Diffusion](https://github.com/Retro-Diffusion/api-examples) | Vrai pixel art aligné sur la grille, palette contrôlée, fond transparent ; style *low\_res* de 16 à 128 px | API HTTP, serveur MCP ([détails](https://mcpservers.org/fr/servers/retro-diffusion/retro-diffusion-mcp)) ; environ 0,015 à 0,18 $ par image ([source](https://skillsmp.com/skills/playableintelligence-game-creator-skills-retrodiffusion-skill-md)) | Terrains, bâtiments, icônes d'UI |
| GPT (image) | Composition, ambiance, planches de référence cohérentes | ChatGPT ou API OpenAI | Pochette, planche de style maître, concepts d'unités |

Les deux API proposent un serveur MCP : Claude Code peut donc générer un sprite, lancer `pnpm assets:build` et l'intégrer dans la même session.

**Flux de production d'un sprite**

1. **Planche de style maître** (GPT, une seule fois) : ta planche actuelle, revue avec la palette figée. Elle accompagne ensuite chaque génération comme image de référence.
2. **Concept** de l'unité à grande taille (GPT) pour valider la silhouette et l'équipement.
3. **Sprite final** via PixelLab ou Retro Diffusion avec la planche maître en référence de style, palette imposée, taille cible directe.
4. **Pipeline** (`pnpm assets:build`) : découpe, réduction, quantification sur antiqua-32, variantes de couleurs d'équipe, atlas.
5. **Validation dans `report.html`** : accepter, ou régénérer le sprite (1 minute) plutôt que le retoucher. La retouche Aseprite/Pixelorama reste possible mais facultative (`art/clean/`).
6. **Test en jeu** sur une case de chaque terrain : l'unité doit se lire sur plaine, forêt et désert.

**Si tu restes sur GPT**, trois règles : fond magenta #FF00FF uni, une grille explicite de cases, et toujours joindre la planche maître + le dernier sprite validé dans la même conversation. Demande un « sprite de 32×32 pixels agrandi 8 fois » : le script `downscale.ts` détecte la taille des gros pixels et reconstruit la grille.

**Décision prise : 32×32.** Les générateurs sont nettement meilleurs à 32×32 qu'à 16×16, ce qui permet de se passer de retouche. Les prompts ci-dessous indiquent la taille entre crochets `[32]` pour pouvoir rebasculer facilement.

## Prompts sprites : unités

Chaque prompt = **bloc de style commun + fiche de l'unité + gabarit de planche**. La planche est pensée pour le déplacement case par case : une ligne idle, puis une ligne de marche par direction (droite, dos, face), les pieds toujours sur la dernière ligne de pixels pour que l'unité ne « flotte » pas entre deux cases.

**1. Bloc de style commun** (à coller en tête de chaque prompt)

```text
STYLE: true pixel art sprite for a top-down tactical turn-based strategy game in the spirit of early-2000s handheld consoles. Each sprite is exactly [32]x[32] pixels, drawn on a strict pixel grid, scaled up 8x with nearest-neighbor so every game pixel is a perfect 8x8 square block. No anti-aliasing, no blur, no gradients, no dithering noise, no shadows outside the sprite. Chunky chibi proportions (big head, about 2 heads tall), readable silhouette, 1-pixel dark brown outline (#2B1B17), light from the top-left. Limited palette, max 12 colors per sprite. TEAM COLOR: clothing, banners and shield faces use ONLY these 4 reds: #4A1218, #8E1F24, #D13A2E, #F2735A; never use these reds anywhere else. Skin: warm dark brown tones. Metal: bronze and gold, no steel. Setting: African and Mediterranean antiquity. Background: flat solid magenta #FF00FF, no ground, no scenery. Keep the bottom-right 10x10 pixel corner of each sprite mostly empty. No text, no labels, no numbers.
```

**2. Gabarit de planche** (à coller après la fiche)

```text
LAYOUT: one sprite sheet, 4 columns x 4 rows, each cell [32]x[32] game pixels with 2 game pixels of magenta padding, same character in every cell, identical size and proportions.
Row 1 - IDLE facing right, 3 frames: neutral, breathing up 1 pixel, neutral with slight weapon sway. 4th cell empty.
Row 2 - WALK facing right (side view), 4 frames: contact, passing, contact (other leg), passing.
Row 3 - WALK facing up (back view), 4 frames, same cycle.
Row 4 - WALK facing down (front view), 4 frames, same cycle.
Feet always touch the bottom pixel row of the cell. Head may bob 1 pixel, never more. No horizontal drift inside the cell.
```

**3. Fiches unités**

**Fantassin** — infanterie de base, légère et nombreuse.

```text
UNIT: basic spearman infantry. Young warrior, bare arms, short red linen kilt and red headband, holding a short bronze-tipped spear upright in the front hand and a small oval hide shield with a red pattern on the back arm. Light and agile pose. Sandals.
```

**Lancier lourd** — anti-cavalerie, lent, passe les montagnes ; doit paraître plus massif que le fantassin.

```text
UNIT: heavy pikeman, anti-cavalry. Stocky veteran in padded red tunic with bronze scale chest plate and bronze helmet with a red crest, tall rectangular shield almost as tall as him, very long pike angled forward past the cell edge by at most 1 pixel. Slow, heavy stance, wide feet. Walk cycle is short and heavy (small steps).
```

**Archers** — tir indirect à 2 cases ; l'arc doit être lisible à 1×.

```text
UNIT: archer. Slim warrior with a red feathered headband, red sash across the chest, a large recurved wooden bow held vertically in the front hand (bow is the most visible element of the silhouette), quiver of arrows on the back with 2 red fletchings visible. No armor.
```

**Cavalerie légère** — éclaireur rapide, 7 cases.

```text
UNIT: light cavalry scout. A small rider with a red headscarf and a short javelin on a lean brown horse with a red saddle blanket. The horse fills the cell width, the rider's head reaches the top. WALK rows are a GALLOP cycle (4 frames: legs gathered, front legs reaching, legs extended, back legs pushing); body bobs 1 pixel. Back view shows horse rump and tail; front view shows horse head and chest.
```

**Char de guerre** — unité de choc sur roues ; pas de rebond, ce sont les roues qui tournent.

```text
UNIT: two-wheeled war chariot. Light wooden chariot with a red painted front panel and a bronze-rimmed spoked wheel, pulled by one horse (simplified, chibi), one driver with a red crested helmet and a short spear. WALK rows: the horse trots, the wheel spokes rotate between frames (4 positions), no vertical bobbing of the chariot, a 2-pixel dust puff behind the wheel on frames 2 and 4. Back and front views stay recognizable: front shows horse head, back shows the open rear of the chariot.
```

**Catapulte** — siège à portée 2–3, sur roues.

```text
UNIT: wheeled siege catapult (onager style). Compact wooden frame on 2 small wheels, a throwing arm with a sling cup holding a round stone, red cloth banner on top, one tiny crewman with a red headband pushing from behind. IDLE: the arm sways 1 pixel. WALK rows: wheels rotate, crewman pushes, no bobbing. The catapult must fit inside the cell; draw it chibi and squat, not to scale.
```

**4. Planche de style maître** (GPT, à faire en premier)

```text
[STYLE BLOCK]
Create a reference sheet on magenta: the 6 units above (spearman, heavy pikeman, archer, light cavalry, war chariot, siege catapult) each shown once in IDLE facing right, in a single row, same scale, then the same 6 units recolored in blue (#16234A, #24418E, #3A73D1, #73B4F2) in a second row. Each sprite [32]x[32] game pixels, scaled 8x.
```

**5. Variante PixelLab / Retro Diffusion** : ces API attendent une description courte et des paramètres. Champ description = la fiche unité seule (sans le bloc style ni le gabarit) ; taille 32×32 ; vue *side* puis rotation 4 directions ; animation *walk* ; image de style = planche maître ; palette forcée = antiqua-32.png.

## Prompts sprites : terrains et bâtiments

Les terrains portent la mécanique : leur coût de déplacement et leur défense diffèrent, donc **chaque type doit se reconnaître d'un coup d'œil**, même sous la surbrillance bleue de déplacement ou rouge d'attaque. On les veut moins contrastés que les unités, sans personnage dessus, et raccordables bord à bord.

**1. Bloc de style terrain** (en tête de chaque prompt)

```text
STYLE: true pixel art terrain tiles for a top-down tactical grid strategy game, early-2000s handheld console look. Each tile is exactly [32]x[32] pixels on a strict grid, scaled 8x with nearest-neighbor. Camera straight top-down for ground; trees, rocks and mountains drawn with a slight front-facing 3/4 look so they read as volumes. Seamless: the left/right and top/bottom edges must tile perfectly with themselves and with plain grass. Muted, mid-value colors (units will be drawn on top and must stand out); no pure black, outlines in dark olive or dark brown. Light from the top-left. Max 8 colors per tile, shared palette across all tiles. African savanna and Nile valley in antiquity. No units, no people, no text, no grid lines. Lay tiles out in a grid with 2 pixels of magenta #FF00FF between them.
```

**2. Tuiles de base** (une planche)

```text
[TERRAIN STYLE BLOCK]
Sheet of base tiles, one row each, 4 variants per row so repetition is not visible:
Row 1 - PLAIN: short savanna grass, yellow-green, a few dry tufts and tiny pebbles; variant 4 has 3 small flowers.
Row 2 - FOREST: 2 to 3 small flat-topped acacia trees with dark trunks on grass, canopy fills the top two thirds of the tile.
Row 3 - HILL: one soft rounded grassy mound with a lighter top and a shadow on the bottom-right.
Row 4 - MOUNTAIN: one tall rocky ochre peak with a lighter left face, darker right face, filling the tile up to 1 pixel from the top.
Row 5 - DESERT: pale sand with 2 gentle dune ripples; variant 4 has a small dry shrub.
Row 6 - MARSH: dark green-blue shallow water patches between reed clumps and mud.
```

**3. Route / piste (autotiling 16 tuiles)**

```text
[TERRAIN STYLE BLOCK]
Autotile sheet for a DIRT ROAD (packed red-ochre earth with lighter wheel ruts and a 1-pixel darker edge) on plain grass. 16 tiles in a 4x4 grid, the road always 16 pixels wide and centered so all pieces connect:
isolated dot, end-N, end-E, end-S, end-W, straight N-S, straight E-W, corner N-E, corner N-W, corner S-E, corner S-W, T open N-E-S, T open E-S-W, T open S-W-N, T open W-N-E, crossroads.
Where the road meets the tile edge, the grass on both sides matches plain grass exactly.
```

**4. Rivière, pont et gué**

```text
[TERRAIN STYLE BLOCK]
Autotile sheet for a RIVER (Nile blue-green water, lighter ripple highlights, sandy 1-2 pixel banks, then plain grass). Same 16-piece set as the road (isolated, 4 ends, 2 straights, 4 corners, 4 T-junctions, crossroads), river 20 pixels wide and centered.
Then a second row: BRIDGE N-S and BRIDGE E-W (wooden planks with rope rails over the river), FORD N-S and FORD E-W (shallow lighter water with stepping stones), and 4 animation frames of the straight N-S river where the ripple highlights shift down by 1 pixel per frame (loop).
```

**5. Bâtiments** (cadre \[32\]×\[64\], la base occupe la case, le haut dépasse sur la case du dessus)

```text
[TERRAIN STYLE BLOCK] Exception: each building cell is [32] wide x [64] tall, the building's footprint sits on the bottom [32]x[32], the roof and flag may rise into the top half; top half is otherwise magenta.
Three buildings, each in 2 versions side by side: NEUTRAL (grey-white flag and grey roof trim) and TEAM (flag and roof trim using ONLY #4A1218, #8E1F24, #D13A2E, #F2735A).
1. VILLAGE: two round mud huts with conical thatched roofs and a small fence.
2. BARRACKS (unit production): rectangular mud-brick building with a wooden gate, crossed spears above the door, a flag on the roof.
3. HEADQUARTERS: small mud-brick fortress with two towers in Sahelian style (wooden beams sticking out of the walls), the tallest building, big flag on top.
Each building must read clearly as different from the others at 1x, even in black silhouette.
```

**Contrôle avant validation**

- [ ] Posées en damier 4×4 dans Tiled, aucune couture visible.
- [ ] Les 9 terrains se distinguent en niveaux de gris (test : désaturation complète).
- [ ] Un fantassin rouge et un bleu restent lisibles sur chaque tuile, avec et sans surbrillance.
- [ ] Route et rivière : les 16 pièces se raccordent sur la carte « Le Gué du Nil ».
- [ ] Bâtiments : la version neutre et les 4 couleurs sortent du pipeline sans pixel rouge parasite.

## Sources

- [PixelLab — référence API v2](https://api.pixellab.ai/v2/llms.txt) et [modes d'utilisation](https://www.pixellab.ai/docs/ways-to-use-pixellab)
- [Retro Diffusion — exemples d'API](https://github.com/Retro-Diffusion/api-examples) et [serveur MCP](https://mcpservers.org/fr/servers/retro-diffusion/retro-diffusion-mcp)
- [Retro Diffusion — coût par image (fiche skill)](https://skillsmp.com/skills/playableintelligence-game-creator-skills-retrodiffusion-skill-md)
- [Phaser 4 — historique des versions](https://phaser.io/download/phaser4) et [README 4.2.0](https://cdn.jsdelivr.net/npm/phaser@4.2.0/README.md)
