# Prototype de scène de combat en 2D dessinée

But : vérifier qu'une scène de combat en grand dessin animé 2D (style de la pochette) fonctionne
dans le jeu, avec **une seule rencontre** : fantassin carthaginois contre archers de Koush.
Si le résultat plaît, on produit les autres unités de la même façon.

## Qui fait quoi

| Étape | Qui | Quoi |
| --- | --- | --- |
| 1 | Toi | Générer les 5 images dans ChatGPT (prompts ci-dessous), une par une |
| 2 | Toi | Les déposer dans `art/raw/combat-dessine/` avec les noms exacts |
| 3 | Claude (en parallèle) | Couche de combat haute définition, mise en scène en 6 temps, effets, interface, avec des images provisoires |
| 4 | Claude | Brancher tes images : découpe des poses, détourage, mise à l'échelle |
| 5 | Ensemble | Tester dans le navigateur, juger, corriger les prompts si besoin |

## Étape 1 — Les 5 images à générer

Règles pour toutes les images :

- Une conversation ChatGPT par image. Joins ta planche de personnage quand le prompt le dit.
- Si le fond transparent ne marche pas, redemande avec « solid flat magenta #FF00FF background ».
- Vérifie avant de passer à la suivante (liste « À vérifier » sous chaque prompt). Si une seule
  pose rate, demande à ChatGPT de refaire **seulement** cette pose, même cadre, même échelle.

Le bloc de style est le même partout : il demande un dessin animé 2D classique, avec peu de
traits, des aplats et une seule ombre. C'est ce qui évite l'aspect « image IA » (trop de
plis, de muscles, de petits ornements et de dégradés).

### Image 1 — Fantassin carthaginois, 4 poses → `peuples/carthage/fantassin/poses.png`

Joindre : la moitié droite de ta planche (le guerrier carthaginois).

```text
Use the attached character sheet only as a reference for the character's design and colors.

Create a 2D animation pose sheet of this Carthaginian foot soldier: 4 full-body poses side by side in one horizontal row, 4 equal invisible columns, same character, same size in every pose, feet resting on the same baseline, generous empty space around each figure, nothing touching the image edges. All poses face RIGHT, in a 3/4 side view.

Poses, left to right:
1. Idle: ready stance, spear held upright, round shield in front.
2. Attack: lunging forward with a strong spear thrust, weight on the front leg.
3. Hit: recoiling backward, head turned away, shield raised, off balance.
4. Defeated: down on one knee, head lowered, spear on the ground.

Design: bronze Montefortino helmet with a short red horsehair plume on top (no tall Greek crest), red tunic and short red cape, bronze greaves, round cream shield with a single red palm tree emblem.

Style: classic hand-drawn 2D feature animation, 1990s cel look. Simple, appealing shapes and a strong readable silhouette. Clean uniform ink outline, few interior lines, no muscle definition lines, no fabric wrinkles beyond one or two folds, no small ornaments. Flat color fills with ONE darker shadow tone, no gradients, no texture, no painterly rendering, no glow. Expressive pose with clear line of action, like a key drawing from an animated film.

Transparent background. No ground shadow, no text, no labels, no frame.
```

À vérifier : même visage et même tenue sur les 4 poses ; 4 personnages de même taille ; pieds
alignés ; tous tournés vers la droite ; rien de coupé au bord.

### Image 2 — Archers de Koush, 4 poses → `peuples/koush/archers/poses.png`

Joindre : la moitié gauche de ta planche (le Roi de Koush), pour le style et les couleurs
seulement.

```text
Use the attached character sheet only as a reference for the art style and the Kushite color palette (royal blue, gold, cream). This is a DIFFERENT character: a young Kushite archer, a simple soldier, not a king.

Create a 2D animation pose sheet of this Kushite archer: 4 full-body poses side by side in one horizontal row, 4 equal invisible columns, same character, same size in every pose, feet resting on the same baseline, generous empty space around each figure, nothing touching the image edges. All poses face RIGHT, in a 3/4 side view.

Poses, left to right:
1. Idle: relaxed ready stance, long bow held low, quiver on the back.
2. Attack: drawing the bow to full extension, aiming right, arrow nocked.
3. Hit: recoiling backward, bow lowered, off balance.
4. Defeated: sitting on the ground, head lowered, bow dropped beside him.

Design: short dark curly hair with a simple blue headband, cream linen kilt with a blue belt, blue sash across the chest, gold arm bands, leather quiver, long wooden bow.

Style: classic hand-drawn 2D feature animation, 1990s cel look. Simple, appealing shapes and a strong readable silhouette. Clean uniform ink outline, few interior lines, no muscle definition lines, no fabric wrinkles beyond one or two folds, no small ornaments. Flat color fills with ONE darker shadow tone, no gradients, no texture, no painterly rendering, no glow. Expressive pose with clear line of action, like a key drawing from an animated film.

Transparent background. No ground shadow, no text, no labels, no frame.
```

À vérifier : mêmes points que l'image 1.

### Image 3 — Portrait du chef carthaginois, 4 expressions → `portraits/carthage.png`

Joindre : la moitié droite de ta planche.

```text
Use the attached character sheet as the reference for this character's face and helmet.

Create 4 head-and-shoulders portraits of this Carthaginian commander in one horizontal row, 4 equal square cells, same framing and same size in every cell, facing slightly to the right.

Expressions, left to right:
1. Neutral, calm and confident.
2. Shouting a battle cry, mouth wide open.
3. Hurt, wincing, eyes squeezed.
4. Proud smile, victorious.

Design: bronze Montefortino helmet with a short red horsehair plume (no tall Greek crest), short dark beard, red cape on the shoulders.

Style: classic hand-drawn 2D feature animation, 1990s cel look. Simple appealing shapes, clean uniform ink outline, few interior lines, flat color fills with ONE darker shadow tone, no gradients, no texture, no painterly rendering.

Transparent background. No text, no labels, no frame.
```

À vérifier : même visage sur les 4 cases ; même cadrage ; expressions bien lisibles.

### Image 4 — Portrait du Roi de Koush, 4 expressions → `portraits/koush.png`

Joindre : la moitié gauche de ta planche.

```text
Use the attached character sheet as the reference for this character's face, headband and cape.

Create 4 head-and-shoulders portraits of this King of Kush in one horizontal row, 4 equal square cells, same framing and same size in every cell, facing slightly to the left.

Expressions, left to right:
1. Neutral, calm and confident.
2. Shouting an order, mouth wide open.
3. Hurt, wincing, eyes squeezed.
4. Proud smile, victorious.

Style: classic hand-drawn 2D feature animation, 1990s cel look. Simple appealing shapes, clean uniform ink outline, few interior lines, flat color fills with ONE darker shadow tone, no gradients, no texture, no painterly rendering.

Transparent background. No text, no labels, no frame.
```

À vérifier : même visage sur les 4 cases ; même cadrage ; expressions bien lisibles.

### Image 5 — Décor de savane → `decors/savane.png`

Rien à joindre.

```text
A wide 16:9 background painting for a 2D animated film battle scene, no characters. An African savanna: flat golden grass ground covering the lower third of the image, a few acacia trees in the middle distance, soft hills far away, a bright warm sky with simple rounded clouds.

Style: classic hand-drawn 2D feature animation background, 1990s look. Simple, readable shapes, soft flat color areas with gentle shading, limited palette of warm golds, ochres, soft greens and light blue. Calm, sunny, peaceful mood. Keep the lower half simple and uncluttered so characters can stand on it.

No characters, no animals, no text, no frame.
```

À vérifier : sol plat et dégagé en bas ; pas de personnage ; format large.

## Étape 2 — Où déposer les images

Dans `art/raw/combat-dessine/`, un dossier par unité, avec des noms de fichiers fixes :

```text
art/raw/combat-dessine/
├── A-FAIRE.md          ← généré : ce qui existe et ce qui manque
├── reglages.json       ← corrections d'échelle et calages
├── decors/savane.png
├── portraits/
│   ├── carthage.png
│   └── koush.png
└── peuples/<peuple>/<unité>/
    ├── poses.png       ← les 4 poses (référence de taille)
    ├── repos.png
    ├── attaque.png
    ├── charge.png
    ├── chute.png
    └── sonne.png
```

Après chaque dépôt, `pnpm assets:dessin` traite les images et met à jour `A-FAIRE.md`.

## Expérience « 16 dessins » — fantassin carthaginois

But : comparer dans le jeu un fantassin animé avec 16 dessins à l'archer resté à 4 poses.
Les 16 dessins sont répartis sur **4 planches de 4 cases**, une planche par action, chaque
case étant une image de la séquence, dans l'ordre.

| Planche | Fichier | Cases (de gauche à droite) |
| --- | --- | --- |
| 1 | `peuples/carthage/fantassin/repos.png` | repos neutre · inspiration · cape vers l'arrière · cape vers l'avant |
| 2 | `peuples/carthage/fantassin/attaque.png` | préparation · image de vitesse · coup · suite du mouvement |
| 3 | `peuples/carthage/fantassin/charge.png` | course 1 · course 2 · coup reçu · recul |
| 4 | `peuples/carthage/fantassin/chute.png` | déséquilibre · à terre · victoire, lance levée · victoire, cri |

Règles communes :

- Une conversation par planche. Joins **à chaque fois** `art/raw/combat-dessine/peuples/carthage/fantassin/poses.png`
  (la planche actuelle) : c'est la référence du personnage et de sa taille.
- **Caméra fixe** : dans une planche, les 4 cases sont des images d'un même plan. Le
  personnage reste au même endroit dans sa case, le pied d'appui ne bouge pas sauf si le geste
  le déplace. C'est ce qui évite qu'il tremble à l'écran.
- Fond **blanc uni**, sans damier.
- À vérifier : même personnage et même taille que la référence ; 4 cases de même largeur ;
  pieds sur la même ligne ; rien de coupé ; tourné vers la droite.

Le bloc de style (identique pour les 4 planches) :

```text
Style: classic hand-drawn 2D feature animation, 1990s cel look. Simple, appealing shapes and a strong readable silhouette. Clean uniform ink outline, few interior lines, no muscle definition lines, no fabric wrinkles beyond one or two folds, no small ornaments. Flat color fills with ONE darker shadow tone, no gradients, no texture, no painterly rendering, no glow.

Plain solid pure white background (#FFFFFF), no checkerboard, no ground shadow, no ground line, no text, no labels, no frame, no cell borders.
```

### Planche 1 — Repos → `peuples/carthage/fantassin/repos.png`

```text
Use the attached pose sheet as the exact reference for this Carthaginian soldier: same face, same helmet with red crest, same red tunic and cape, same round shield with the red palm tree, same proportions and SAME SIZE as the first (idle) pose.

Create 4 frames of a hand-drawn animation sequence, side by side in one wide image, 4 equal invisible columns, as if filmed by a locked camera: the soldier stays at exactly the same place in each column, both feet planted on the same baseline, facing RIGHT in a 3/4 side view. Subtle idle breathing loop, the changes between frames are small:
1. Neutral ready stance, spear upright in the right hand, shield in front.
2. Inhale: chest slightly raised, shoulders up a few pixels, head a touch higher.
3. Exhale: shoulders relaxed, the cape swings slightly backward.
4. The cape swings slightly forward, the crest leans a little forward.

[STYLE BLOCK]
```

### Planche 2 — Attaque → `peuples/carthage/fantassin/attaque.png`

```text
Use the attached pose sheet as the exact reference for this Carthaginian soldier: same face, same helmet with red crest, same red tunic and cape, same round shield with the red palm tree, same proportions and SAME SIZE as the first (idle) pose.

Create 4 frames of a hand-drawn animation sequence of a spear thrust, side by side in one wide image, 4 equal invisible columns, as if filmed by a locked camera: the back foot stays planted at the same spot in each column, feet on the same baseline, facing RIGHT in a 3/4 side view.
1. Anticipation: weight shifted onto the back leg, spear pulled back at shoulder height, shield tucked, body coiled, determined face.
2. Motion smear frame, like in classic hand-drawn animation: the body lunging forward, the arm and spear stretched and elongated into a fast blurred shape with a few speed lines drawn in the same ink style.
3. Full extension: deep lunge, front knee bent, spear fully thrust forward, shouting, the cape flying behind.
4. Follow-through: still extended but settling, spear tip lowering slightly, cape falling back.

[STYLE BLOCK]
```

### Planche 3 — Charge et coup reçu → `peuples/carthage/fantassin/charge.png`

```text
Use the attached pose sheet as the exact reference for this Carthaginian soldier: same face, same helmet with red crest, same red tunic and cape, same round shield with the red palm tree, same proportions and SAME SIZE as the first (idle) pose.

Create 4 frames side by side in one wide image, 4 equal invisible columns, as if filmed by a locked camera, feet on the same baseline, facing RIGHT in a 3/4 side view.
Frames 1-2: a running charge cycle, spear held forward at waist height, shield in front.
1. Running, left leg forward, right leg pushing off behind, body leaning forward, cape flowing back.
2. Running, legs passing under the body, one foot on the ground, body slightly higher.
Frames 3-4: getting hit.
3. Impact: head snapped back, eyes squeezed, shield knocked upward, body jolted, standing in place.
4. Recoil: stumbling one step backward, off balance, arms out, spear still in hand.

[STYLE BLOCK]
```

### Planche 4 — Chute et victoire → `peuples/carthage/fantassin/chute.png`

```text
Use the attached pose sheet as the exact reference for this Carthaginian soldier: same face, same helmet with red crest, same red tunic and cape, same round shield with the red palm tree, same proportions and SAME SIZE as the first (idle) pose.

Create 4 frames side by side in one wide image, 4 equal invisible columns, as if filmed by a locked camera, feet on the same baseline, facing RIGHT in a 3/4 side view.
Frames 1-2: defeat.
1. Staggering: knees buckling, leaning backward, spear slipping from the hand, shield lowered.
2. Down: kneeling on the ground, head lowered, spear lying on the ground.
Frames 3-4: victory.
3. Spear raised high above the head, shield held up, proud and confident.
4. Victory shout: mouth wide open, spear still raised, chest out, cape flying.

[STYLE BLOCK]
```

Remplace `[STYLE BLOCK]` par le bloc de style ci-dessus avant d'envoyer.

### Banc d'essai

Entrée « Animation (proto) » de la page de garde (`jeu.html?mode=proto`) : on choisit
l'attaquant, le défenseur, les PV avant et après, la riposte et la vitesse (dont un ralenti
×0,25 pour examiner chaque image), puis on rejoue le combat autant de fois que nécessaire.
Provisoire : à retirer quand les combats dessinés seront validés (`src/drawn/ProtoBench.ts`
et l'entrée du menu dans `index.html`).

### Traitement et réglages

`pnpm assets:dessin` sépare les dessins d'une planche même quand ils se touchent ou se
chevauchent (traits de vitesse, cape, lance) : chaque morceau de dessin va à la case où tombe
son centre, et chaque image ne garde que ses propres pixels. La position de chaque dessin dans
sa case est conservée : le mouvement d'une image à l'autre est celui que ChatGPT a dessiné. Chaque animation est ancrée aux pieds de sa première image, et mise à la
même échelle que la planche de 4 poses de l'unité.

ChatGPT ne dessine pas toujours le personnage à la même taille d'une planche à l'autre. Une
correction par planche se règle dans `art/raw/combat-dessine/reglages.json`, rubrique
`echelles` (par exemple `"carthage/fantassin/repos": 0.92` : la planche de repos était
dessinée 8 % trop grande).

Petits sauts entre deux animations : chaque animation est ancrée au centre des pieds de sa
première image (sans la hampe de lance posée au sol). Pour corriger un saut à l'œil, un
décalage en pixels par animation se règle dans `reglages.json`, rubrique `calages`, par
exemple `"carthage/fantassin": { "attack": 12 }` (positif : le personnage recule).

Dans le jeu : ombre douce sous chaque soldat, repos en aller-retour (6 images/s), préparation, course (10 images/s), coup à partir
de l'image de vitesse (14 images/s) avec un gel de 90 ms à l'impact, coup reçu, chute, et
victoire pour le camp qui a perdu le moins. Une unité sans séquence garde ses 4 poses.


Mise en scène :

- **Foule vivante** : chaque soldat a sa taille (±5 %), sa teinte (second rang voilé) et son
  retard de réaction (0 à 200 ms), et démarre à une image différente de son repos.
- **Course par à-coups** au rythme des pas, avec un rebond à chaque foulée.
- **Caméra** : elle se resserre pendant la préparation, suit la charge, donne un zoom
  brusque à l'impact d'un tir, et s'approche lentement du vainqueur à la fin.
- **Plan de contact** (corps à corps) : au moment du choc, la séparation disparaît ; les deux
  lignes se rencontrent en plein écran sur le même décor (coup, silhouettes blanches, gel,
  étincelles), puis on revient à l'écran partagé pour les PV et les chutes.

## Vaincus sonnés — planche 5 du fantassin

Dans Alkébulan, les soldats vaincus ne meurent pas : ils tombent assis, sonnés, avec des
étoiles qui tournent au-dessus de la tête (ajoutées par le jeu, pas dessinées). Les 2 premières
images sont la chute ; les 2 dernières se jouent en boucle lente (il vacille, étourdi). Sans
cette planche, le jeu utilise la chute de la planche 4 et efface le soldat.

Fichier : `peuples/carthage/fantassin/sonne.png`. Joindre la planche de poses comme référence, et
ajouter le bloc de style à la fin.

```text
Use the attached pose sheet as the exact reference for this Carthaginian soldier: same face, same helmet with red crest, same red tunic and cape, same round shield with the red palm tree, same proportions and SAME SIZE as the first (idle) pose.

Create 4 frames of a funny, gentle hand-drawn cartoon sequence, side by side in one wide image, 4 equal invisible columns, as if filmed by a locked camera, on the same ground baseline, facing RIGHT in a 3/4 side view. The soldier is knocked out in a comical, non-violent way, like in a family animated film: no blood, no injury.
1. Losing balance: knocked backward, arms flailing, spear flying out of his hand, helmet tilting.
2. Landing: sitting down hard on the ground, legs stretched forward, shield fallen flat beside him, spear lying on the ground, helmet askew over one eye.
3. Dazed: still sitting, upper body swaying to the left, eyes dizzy and half closed, silly dazed smile, helmet askew.
4. Dazed: same sitting position, upper body swaying to the right, same dizzy face. Frames 3 and 4 must be almost identical except for the sway, so they can loop.

Do not draw any stars, birds or symbols above his head.

[STYLE BLOCK]
```

## Archers de Koush — 5 planches (20 dessins)

Même méthode que le fantassin : une conversation par planche, 4 images par planche, caméra
fixe, fond blanc uni. Joins **à chaque fois** `art/raw/combat-dessine/peuples/koush/archers/poses.png` (la
planche de 4 poses) comme référence, et termine chaque prompt par le bloc de style.

| Planche | Fichier | Cases (de gauche à droite) |
| --- | --- | --- |
| 1 | `peuples/koush/archers/repos.png` | neutre · inspiration · arc qui balance · retour |
| 2 | `peuples/koush/archers/attaque.png` | prendre une flèche · encocher · arc bandé · lâcher |
| 3 | `peuples/koush/archers/charge.png` | petits pas 1 · petits pas 2 · coup reçu · recul |
| 4 | `peuples/koush/archers/chute.png` | perte d'équilibre · à genoux · arc levé · cri de victoire |
| 5 | `peuples/koush/archers/sonne.png` | bascule · assis · étourdi à gauche · étourdi à droite |

Le début commun des 5 prompts :

```text
Use the attached pose sheet as the exact reference for this young Kushite archer: same face, same blue headband, same cream linen kilt with blue belt, same blue sash across the chest, same gold arm bands, same leather quiver and long wooden bow, same proportions and SAME SIZE as the first (idle) pose.
```

### Planche 1 — Repos → `peuples/koush/archers/repos.png`

```text
[DÉBUT COMMUN]

Create 4 frames of a hand-drawn animation sequence, side by side in one wide image, 4 equal invisible columns, as if filmed by a locked camera: the archer stays at exactly the same place in each column, both feet planted on the same baseline, facing RIGHT in a 3/4 side view. Subtle idle breathing loop, the changes between frames are small:
1. Relaxed ready stance, bow held low in the left hand.
2. Inhale: chest slightly raised, shoulders up a few pixels.
3. Exhale: shoulders relaxed, the bow swings slightly forward, sash moving.
4. The bow swings slightly back, the headband ends flutter a little.

[STYLE BLOCK]
```

### Planche 2 — Tir → `peuples/koush/archers/attaque.png`

```text
[DÉBUT COMMUN]

Create 4 frames of a hand-drawn animation sequence of shooting an arrow, side by side in one wide image, 4 equal invisible columns, as if filmed by a locked camera: the feet stay planted at the same spot in each column, on the same baseline, facing RIGHT in a 3/4 side view.
1. Reaching back over the shoulder to the quiver and pulling out an arrow, bow held low.
2. Nocking the arrow on the string, bow raised in front, starting to draw.
3. Full draw: bow fully bent, string pulled back to the cheek, aiming right, intense focus.
4. Release and follow-through: the string has snapped forward, the arrow is gone, the drawing hand flung back open, bow arm still extended, a few short speed lines at the string in the same ink style.

[STYLE BLOCK]
```

### Planche 3 — Petits pas et coup reçu → `peuples/koush/archers/charge.png`

```text
[DÉBUT COMMUN]

Create 4 frames side by side in one wide image, 4 equal invisible columns, as if filmed by a locked camera, feet on the same baseline, facing RIGHT in a 3/4 side view.
Frames 1-2: a light jogging step forward, bow held in the left hand, body slightly leaning forward.
1. Left foot forward, right foot pushing off behind.
2. Feet passing under the body, one foot on the ground.
Frames 3-4: getting hit.
3. Impact: head snapped back, eyes squeezed, bow knocked upward, body jolted, standing in place.
4. Recoil: stumbling one step backward, off balance, free arm out, bow still in hand.

[STYLE BLOCK]
```

### Planche 4 — Chute et victoire → `peuples/koush/archers/chute.png`

```text
[DÉBUT COMMUN]

Create 4 frames side by side in one wide image, 4 equal invisible columns, as if filmed by a locked camera, feet on the same baseline, facing RIGHT in a 3/4 side view.
Frames 1-2: defeat.
1. Staggering backward: knees buckling, bow slipping from the hand.
2. Down on one knee, head lowered, bow lying on the ground.
Frames 3-4: victory.
3. Bow raised high above the head in one hand, proud and confident smile.
4. Victory cheer: mouth wide open, bow still raised, other fist pumped, chest out.

[STYLE BLOCK]
```

### Planche 5 — Sonné → `peuples/koush/archers/sonne.png`

```text
[DÉBUT COMMUN]

Create 4 frames of a funny, gentle hand-drawn cartoon sequence, side by side in one wide image, 4 equal invisible columns, as if filmed by a locked camera, on the same ground baseline, facing RIGHT in a 3/4 side view. The archer is knocked out in a comical, non-violent way, like in a family animated film: no blood, no injury.
1. Losing balance: knocked backward, arms flailing, bow flying out of his hand, a few arrows spilling from the quiver.
2. Landing: sitting down hard on the ground, legs stretched forward, bow lying on the ground beside him, arrows scattered, headband slipped over one eye.
3. Dazed: still sitting, upper body swaying to the left, eyes dizzy and half closed, silly dazed smile.
4. Dazed: same sitting position, upper body swaying to the right, same dizzy face. Frames 3 and 4 must be almost identical except for the sway, so they can loop.

Do not draw any stars, birds or symbols above his head.

[STYLE BLOCK]
```
