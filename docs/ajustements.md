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
> moteur. Code : `apps/game/src/combat/` (`setup.ts` pur, `CombatScene.ts` pour le rendu).
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
