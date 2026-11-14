# Prototype de scène de combat en 2D dessinée

But : vérifier qu'une scène de combat en grand dessin animé 2D (style de la pochette) fonctionne
dans le jeu, avec **une seule rencontre** : fantassin carthaginois contre archers de Koush.
Si le résultat plaît, on produit les autres unités de la même façon.

## Qui fait quoi

| Étape | Qui | Quoi |
| --- | --- | --- |
| 1 | Toi | Générer les 5 images dans ChatGPT (prompts ci-dessous), une par une |
| 2 | Toi | Les déposer dans `art/raw/proto-combat/` avec les noms exacts |
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

### Image 1 — Fantassin carthaginois, 4 poses → `carthage-fantassin.png`

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

### Image 2 — Archers de Koush, 4 poses → `koush-archers.png`

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

### Image 3 — Portrait du chef carthaginois, 4 expressions → `portrait-carthage.png`

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

### Image 4 — Portrait du Roi de Koush, 4 expressions → `portrait-koush.png`

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

### Image 5 — Décor de savane → `decor-savane.png`

Rien à joindre.

```text
A wide 16:9 background painting for a 2D animated film battle scene, no characters. An African savanna: flat golden grass ground covering the lower third of the image, a few acacia trees in the middle distance, soft hills far away, a bright warm sky with simple rounded clouds.

Style: classic hand-drawn 2D feature animation background, 1990s look. Simple, readable shapes, soft flat color areas with gentle shading, limited palette of warm golds, ochres, soft greens and light blue. Calm, sunny, peaceful mood. Keep the lower half simple and uncluttered so characters can stand on it.

No characters, no animals, no text, no frame.
```

À vérifier : sol plat et dégagé en bas ; pas de personnage ; format large.

## Étape 2 — Où déposer les images

Dans `art/raw/proto-combat/`, avec ces noms exacts :

```text
art/raw/proto-combat/
├── carthage-fantassin.png
├── koush-archers.png
├── portrait-carthage.png
├── portrait-koush.png
└── decor-savane.png
```

Tu peux les déposer au fur et à mesure : chaque image remplace l'image provisoire correspondante.
