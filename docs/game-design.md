# ALKÉBULAN — Game design (source de vérité)

> Extrait du README. Toute valeur de `packages/engine/src/data/` doit correspondre à ce fichier. En cas de conflit, ce fichier fait foi.

## Vision et périmètre du Stage 1

On construit un jeu de stratégie au tour par tour, case par case, jouable dans le navigateur, avec des armées de l'Antiquité (Afrique et Méditerranée) à la place des tanks. Le Stage 1 = une seule carte jouable de bout en bout : 2 factions, 6 unités, 9 terrains et 3 bâtiments, production, capture, combat, victoire.

**Nom du jeu — à changer avant toute publication.** « Advance Wars » est une marque de Nintendo : on peut s'inspirer librement des mécaniques (grille, tour par tour, capture, production), mais ni le nom, ni le logo, ni les sprites, ni les personnages ne doivent être repris ou imités. « Advance Wars Antique » ou « Advance Wars Africa » exposent à un retrait de la page ou de l'hébergement dès qu'il y a de la visibilité. Nom retenu : **Alkébulan — Rise of Kingdoms** (logo dans `art/static/`). L'ancien nom de travail, *ANTIQUA*, ne subsiste que dans les identifiants techniques (`@antiqua/*`, clé de sauvegarde `antiqua:sauvegarde`). À vérifier avant publication : « Rise of Kingdoms » est déjà le titre d'un jeu mobile commercial ; *Alkébulan* seul, ou un autre sous-titre, éviterait toute confusion.

Même logique pour les prompts d'images : ils décrivent un style (pixel art 32 px façon consoles portables 2001–2005, proportions trapues, contours sombres) sans jamais nommer le jeu de Nintendo. Ton planche « Africa Campaign » sert de référence d'ambiance, pas de modèle à copier.

**Lecture retenue de « antique »** (à ajuster) : factions inspirées de civilisations antiques, avec l'ancrage africain de ta planche.

| Faction (couleur) | Inspiration | Signature de gameplay (Stage 2+) |
| --- | --- | --- |
| Koush (bleu) | Royaume de Kerma / Napata, « pays de l'arc » | Archers +1 portée |
| Carthage (rouge) | Puissance navale punique | Éléphants moins chers |
| Kemet (jaune) | Égypte pharaonique | Chars de guerre plus rapides |
| Aksoum (vert) | Royaume d'Aksoum | Infanterie capture plus vite |

**Stage 1 = Koush vs Carthage**, les unités partagent les mêmes sprites et ne changent que de couleur d'équipe (exactement comme le genre le fait). Les commandants, pouvoirs spéciaux, brouillard de guerre, unités navales et multijoueur arrivent après.

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

## Clarifications de règles

- **Archers** : portée 2 exactement (min 2, max 2), tir indirect.
- **Catapulte** : portée 2 à 3, tir indirect.
- **Tir indirect** : impossible après un déplacement dans le même tour ; ne riposte jamais.
- **Riposte** : seulement pour une unité directe, adjacente à l'attaquant et survivante.
- **Gué** : coût 2 pour le Pied, 1 pour le Lourd (le lancier lourd est l'unité « tout-terrain »). Valeur volontaire, à réévaluer en équilibrage.
- **Unité produite** : ne peut ni bouger ni agir le tour de sa production.
- **Victoire** : capture du QG adverse, ou l'adversaire n'a plus aucune unité à partir du jour 2.

Décisions prises à l'implémentation du moteur (étape 2), à revoir en équilibrage :

- **Fleuve** : faute de terrain « eau profonde » dans les 9 terrains, tout le fleuve est en terrain *Rivière (gué)*. Fantassins, archers et lanciers le traversent partout (coût 2, ou 1 pour le Lourd) ; cavalerie, chars et catapultes doivent prendre l'un des 2 ponts. Le « gué » du Gué du Nil est le coude central du fleuve (4 cases). Si on veut un fleuve infranchissable hors ponts et gué, il faut un 10ᵉ terrain.
- **Revenu** : versé au début de chaque tour à partir du jour 2. Au jour 1, les deux camps jouent avec les 2 000 d'or de départ (sinon Koush, qui joue en premier, serait désavantagé ou avantagé).
- **Ordre de jeu** : Koush joue en premier ; le jour avance quand Koush recommence.
- **Déplacement puis action** : une unité bouge au plus une fois (MOVE), puis agit une fois (ATTACK, CAPTURE ou WAIT) ; après l'action, elle ne peut plus bouger. Elle peut agir sans bouger.
- **Disponibilité** : les unités d'un camp redeviennent disponibles à la fin de son tour.
- **Capture** : une capture entamée est conservée tant que l'unité reste sur la case, même si elle ne capture pas à chaque tour.
- **Carte du Stage 1** : symétrique par rotation de 180° (QG de Koush en bas à gauche, de Carthage en haut à droite). Source : `packages/engine/src/maps/gue-du-nil.ts`.
