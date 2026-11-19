# Alkébulan — liste des ajustements

Idées retenues pour plus tard, **pas pour maintenant**. Chaque entrée dit ce qu'on veut et
où elle se branchera dans le code actuel. On la sort de cette liste quand on la planifie.

## 1. Mode campagne

- Le bouton « Campagne » existe déjà sur la page de garde (`apps/game/index.html`), grisé
  avec le badge « Bientôt ».
- Le lancer par le même chemin qu'une partie normale : un mode de plus dans `jeu.html?mode=…`
  (`apps/game/src/launch.ts`), qui donne à `BattleScene` une carte, les camps joués par l'IA
  et l'avancement de la campagne.
- À prévoir : plusieurs cartes (le Stage 2 annonce 5 cartes de campagne), la carte n'étant
  plus seulement `GUE_DU_NIL`, et une sauvegarde de progression séparée de la sauvegarde de
  partie.

## 2. Bouton pour quitter la partie — fait

> Fait : bouton pause du HUD (ou Échap sur la carte) → Reprendre / Sauvegarder et quitter /
> Abandonner la partie (avec confirmation). Quitter sauvegarde l'état du moment : « Continuer »
> reprend en plein tour. Pause indisponible pendant le tour de l'IA.


- Pendant la bataille, une action « Quitter » (menu de la carte ou bouton du HUD), avec
  confirmation, qui ramène à la page de garde (`goToCover()` dans `launch.ts`).
- Décider si on sauvegarde au moment de quitter. Aujourd'hui on ne sauvegarde qu'en fin de
  tour : quitter en plein tour reprendrait au début de ce tour.

## 3. Musique de stage pendant le combat

- Fichier fourni par toi. Une piste par stage, jouée en boucle pendant la bataille.
- Les navigateurs exigent un clic avant de jouer du son : la musique démarre après le clic
  « Nouvelle partie » ou « Continuer », jamais sur la page de garde seule.
- Prévoir un réglage de volume et un bouton muet (rejoint l'étape 7, « Habillage »).

## 4. Moteur d'animation des scènes de combat — phase A faite

> **Décision** : pas de vidéos ni d'API serveur. La scène est composée en direct dans le
> navigateur, par couches (décor du terrain, figurants, bandeau), à partir des événements du
> moteur. Code : `apps/game/src/combat/` (`setup.ts` pur, `drawn/` pour le rendu).
>
> **Phase A (faite)** : écran partagé, un figurant par PV (un pour 2 PV pour cavalerie, char,
> catapulte), charge ou volée, impact, chutes, PV qui descendent, riposte. Figurants = sprites
> de carte ×2, décors = tuiles de terrain. Clic ou Entrée pour passer ; réglage « Scènes de
> combat : oui/non » dans la pause (mémorisé).
>
> **Phase B (système prêt, art à produire)** : le pipeline découvre les planches de figurants
> (`art/raw/peuples/<peuple>/combat/<unité>.png`, gabarit 4×5 en 64 px) et les décors
> (`art/raw/combat/decors/<terrain>.png`), et la scène les utilise dès qu'ils existent.
> Gabarits et prompts : `docs/art-combat.md`.
>
> **Phase C (faite)** : scène de siège (les troupes marchent sur le bâtiment, la jauge de
> capture baisse cran par cran), prise de bâtiment (le drapeau change de camp, « Capturé ! »)
> et annexion du QG (« Annexion du QG ! », puis écran de victoire). Code :
> `apps/game/src/combat/CaptureScene.ts` ; décor et figurants partagés avec les combats
> (`combat/stage.ts`), mécanique commune de passage (`combat/StagedScene.ts`). Même réglage
> « Scènes de combat » dans la pause.
>
> **Suite** : B — produire les planches Koush et Carthage (figurants de combat 64×64 propres à
> chaque peuple, décors par terrain) ; C — scènes de siège, de prise de bâtiment et
> d'annexion du QG ; D — guide « ajouter un peuple ».


Scènes de combat plein écran, dans l'esprit du genre : les deux camps face à face, tir,
charge, impact, PV qui baissent.

**Entrées d'une scène** : l'unité qui attaque et celle qui défend (type d'unité, faction,
PV avant et après), le terrain de chacune (plaine, forêt, colline, désert…) et le résultat
réel du moteur (dégâts, riposte, destruction). La scène illustre le résultat, elle ne le
calcule jamais : le moteur de règles reste la seule source de vérité.

**Scènes à prévoir en plus du combat** :

- siège d'une ville, d'un village ou d'une caserne (capture en cours) ;
- prise d'un bâtiment (le drapeau change de camp) ;
- annexion d'un quartier général, qui est aussi l'animation de victoire.

**Architecture envisagée** : une API, sans doute en Rust, pour générer les animations vite
et garder un rendu fluide.

**Points à challenger avant de choisir** :

- Un aller-retour réseau par combat ajoute de la latence, justement là où l'on veut de la
  fluidité. Une animation se joue en quelques centaines de ms côté client.
- Le moteur renvoie déjà des événements complets (`attackResolved`, `counterResolved`,
  `unitDestroyed`, `captureProgress`, `buildingCaptured`). Une scène peut donc être
  composée dans le navigateur à partir de ces événements et de sprites préparés à
  l'avance par le pipeline d'assets.
- Si on veut du Rust pour les performances, il peut tourner **dans le navigateur** en
  WebAssembly, sans serveur.
- Un serveur reste utile pour ce qui est lourd et ne se fait pas en temps réel : générer ou
  précalculer des planches d'animation une fois, les mettre en cache, puis les servir comme
  des assets ordinaires.
- Le jeu doit rester jouable hors ligne et sans scènes de combat (option « animations :
  courtes / complètes », comme dans le genre).

## 5. Nouveaux peuples : Koush, Carthage, Almoravides, Ashanti — Kemet et Aksoum ensuite

- Décision (novembre 2026) : les 4 peuples jouables deviennent **Koush** (bleu), **Carthage**
  (rouge), **Almoravides** (vert) et **Ashanti** (jaune or), chacun avec son histoire, son
  teint de peau, son dirigeant et son écusson. Fiches de référence et prompts :
  `docs/planches-peuples.md`.
- **Kemet et Aksoum viendront après**, comme 5e et 6e peuples, avec leur propre planche
  (prompts à écrire sur le même gabarit) et une couleur à trouver.
- À reprendre quand on le planifiera :
  - moteur : la liste des peuples (`kemet`, `aksoum` → `almoravides`, `ashanti`), les cartes
    et les noms affichés ;
  - pipeline : `PEOPLES`, `art/specs/couleurs.json` (rampes vert et jaune réattribuées),
    `art/specs/portraits.json` (dirigeants d'après les planches) ;
  - sprites : chaque peuple ayant son look, il faudra des sprites de carte et des dessins de
    combat propres à chaque peuple, au lieu d'un seul modèle rouge recoloré.

## 6. Fusion de deux unités du même type — fait

> Fait : action `MERGE` (moteur, `rules/merge.ts`), choix « Fusionner » en visant une unité
> alliée du même type et blessée, PV en trop remboursés en or (10 % du prix par PV),
> l'unité fusionnée a fini son tour ; l'IA fusionne ses unités à 4 PV ou moins. Règle dans
> `docs/game-design.md`.
>
> Ajouté au passage : soins au village (+2 PV par tour sur un village à soi, gratuits) ;
> l'IA y envoie ses unités blessées.


- Une unité blessée peut rejoindre une autre unité **du même type** de son camp (par
  exemple un fantassin à 3 PV et un fantassin à 7 PV donnent un fantassin à 10 PV).
- Les PV s'additionnent, **plafonnés à 10** (règle actuelle du maximum).
- À décider ensemble : ce que deviennent les PV en trop (perdus, ou remboursés en or comme
  dans le genre), et si l'unité fusionnée peut encore agir ce tour-ci.
- Code : une action `MERGE` dans le moteur (`packages/engine`, avec sa règle et son fichier
  de test), un choix « Fusionner » dans le menu d'action quand on arrive sur une unité alliée
  du même type (`BattleController`, `ActionMenu`), et l'IA (`greedy-ai.ts`).

## 7. Moyens de transport, propres à chaque peuple — transport terrestre fait

> Fait (étape 1) : le **convoi** (règles dans `docs/game-design.md`), embarquer et débarquer,
> sprites de carte des 4 peuples via Codex, buffle ashanti à la place de leur char.
> Reste : l'IA qui produit et utilise des convois ; les combats dessinés du convoi (le
> palanquin ashanti est archivé dans `art/raw/combat-dessine/archives/`).
>
> Fait (étape 2) : le **bateau** (quota 3, tous types, tir comme une catapulte), la **mer**,
> le **port**, la carte « La Côte des Comptoirs » (« Duel sur la côte » sur la page de garde),
> images via Codex. Reste : l'IA des transports (convoi et bateau), les combats dessinés
> du convoi et du bateau (silhouettes provisoires), un décor de mer.


Nouvelles unités de transport, avec **un quota** (nombre d'unités embarquées) pour chacune,
à fixer ensemble. Sprites de carte et animations (combats dessinés compris) d'après
l'histoire de chaque peuple, comme pour les autres unités.

- **Transport terrestre** : embarque les unités à pied.
  - Fantassin.
  - Lancier lourd.
  - Archers.
- **Bateau** : navire de guerre et transport maritime.
  - Fantassin.
  - Lancier lourd.
  - Archers.
  - Cavalerie légère.
  - Char de guerre.
  - Catapulte.
- Le bateau suppose aussi :
  - des cases de mer, ou de fleuve navigable, sur les cartes ;
  - un mode de déplacement « naval » ;
  - un port (ou un bâtiment de production navale) ;
  - les animations d'embarquement et de débarquement.
- Pistes d'inspiration historique, à valider :
  - Carthage : la grande puissance navale du jeu (quinquérèmes, port circulaire).
  - Koush : embarcations du Nil.
  - Almoravides : caravanes et navires du détroit vers al-Andalus.
  - Ashanti : pirogues de rivière.
- Code :
  - moteur : nouveaux types d'unités (`UNITS`), quota et actions `LOAD` / `UNLOAD`,
    terrains marins, déplacement naval, avec leurs fichiers de test ;
  - rendu : unités embarquées affichées dans le transport, menu « Embarquer / Débarquer » ;
  - pipeline : sprites et planches de combat (`art/specs/unites.json`).

## 8. Nouveaux bâtiments

- D'autres bâtiments que la caserne, par exemple un **grenier**.
- À définir ensemble (brainstorming) : leur rôle (revenu, soins, production, ravitaillement),
  leur coût et s'ils se capturent comme les villages.
- Code :
  - moteur : `BuildingType` (aujourd'hui village, caserne, QG) et leurs règles ;
  - rendu : sprites de bâtiment et animation de capture sur le plateau ;
  - cartes : placement des nouveaux bâtiments.
