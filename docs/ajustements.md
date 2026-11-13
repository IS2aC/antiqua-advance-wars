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

## 2. Bouton pour quitter la partie

- Pendant la bataille, une action « Quitter » (menu de la carte ou bouton du HUD), avec
  confirmation, qui ramène à la page de garde (`goToCover()` dans `launch.ts`).
- Décider si on sauvegarde au moment de quitter. Aujourd'hui on ne sauvegarde qu'en fin de
  tour : quitter en plein tour reprendrait au début de ce tour.

## 3. Musique de stage pendant le combat

- Fichier fourni par toi. Une piste par stage, jouée en boucle pendant la bataille.
- Les navigateurs exigent un clic avant de jouer du son : la musique démarre après le clic
  « Nouvelle partie » ou « Continuer », jamais sur la page de garde seule.
- Prévoir un réglage de volume et un bouton muet (rejoint l'étape 7, « Habillage »).

## 4. Moteur d'animation des scènes de combat

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
