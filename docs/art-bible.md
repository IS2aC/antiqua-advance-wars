# ALKÉBULAN — Bible artistique

> Extrait de la bible de production (`docs/bible-de-production.md`). Référence pour le pipeline d'assets et toutes les générations d'images.

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

## Couleurs d'équipe

Chaque sprite est dessiné une seule fois en rouge. Le pipeline remplace les 4 rouges réservés (du plus sombre au plus clair) par la rampe de la faction.

| Faction | Sombre | Moyen-sombre | Moyen-clair | Clair |
| --- | --- | --- | --- | --- |
| Carthage (rouge, source) | `#4A1218` | `#8E1F24` | `#D13A2E` | `#F2735A` |
| Koush (bleu) | `#16234A` | `#24418E` | `#3A73D1` | `#73B4F2` |
| Kemet (jaune) | `#4A3512` | `#8E6A1F` | `#D1A72E` | `#F2D65A` |
| Aksoum (vert) | `#123A1E` | `#1F6E34` | `#2EAE4E` | `#6FDE85` |

Contour : `#2B1B17` (brun-noir, jamais de noir pur). Magenta `#FF00FF` = fond à rendre transparent.

## Nommage des frames

- Unités : `unit/<type>/<anim>/<direction>/<index>` → `unit/fantassin/walk/right/0`, `unit/fantassin/idle/0`.
- Terrains : `terrain/<type>/<variante>` → `terrain/route/ns`, `terrain/riviere/coude-ne`.

## Production des sprites (sans retouche manuelle)

1. Planche de style maître (GPT), une seule fois.
2. Sprites finaux via PixelLab (unités) ou Retro Diffusion (terrains, bâtiments), 32×32, palette antiqua-32 imposée.
3. `pnpm assets:build` : découpe, réduction, quantification, **autofix** (pixels isolés, recentrage, pieds, contour, coin PV), couleurs d'équipe, atlas.
4. Validation dans `tools/asset-pipeline/report.html` : accepter ou régénérer.
5. Retouche manuelle facultative dans `art/clean/` (prioritaire sur l'automatique).

Les prompts complets (blocs de style, fiches unités, terrains, bâtiments) sont dans `docs/bible-de-production.md`, sections « Prompts sprites ».

## Pipeline d'assets : décisions d'implémentation (étape 4)

- **Sources** : `tools/asset-pipeline/src/sources.ts` décrit chaque planche de `art/raw/` (fichier, gabarit, ordre). C'est le seul fichier à modifier quand une planche est régénérée ou renommée.
- **Palette antiqua-32** : faute de pouvoir projeter des planches GPT sur Endesga 32 sans dénaturer la savane, la palette est **extraite des planches elles-mêmes** au premier build (coupe médiane, même poids pour chaque planche) : 27 couleurs générales + le contour `#2B1B17` + les 4 rouges réservés. Elle est alors **figée** dans `art/palette/antiqua-32.png` (et `.gpl`) ; supprimer ce fichier pour la recalculer.
- **Rouges d'équipe** : les planches IA n'utilisent pas exactement les 4 rouges réservés. Le pipeline repère les rouges francs et saturés (teinte ±15°, saturation ≥ 0,66) et les envoie sur la rampe réservée, par luminosité. Peau, bois et or n'en font pas partie. Le remplacement par faction se fait ensuite couleur par couleur, comme prévu.
- **Coin des PV** : il n'est pas vidé automatiquement (on amputerait les roues du char et de la catapulte) ; le rapport signale les sprites où il est chargé à plus de 50 %.
- **Autotiling** : les connexions de chaque pièce de route ou de rivière sont détectées sur ses bords. Frames : `terrain/route/<masque>`, `terrain/riviere/<masque>`, masque = lettres `n e s w` dans cet ordre (`ns`, `nes`…), `o` pour une pièce isolée ; un doublon devient `<masque>-2`. Le jeu choisit la pièce exacte, sinon la plus proche.
- **Autres frames** : `terrain/<type>/<0-3>` (variantes de base), `terrain/pont/ew` (pont pour une route est-ouest, donc fleuve nord-sud) et `terrain/pont/ns`, `building/<type>/<neutre|faction>` (32×64), et un atlas d'unités par faction (`units-<faction>`).
- **Retouche facultative** : `art/clean/<nom de frame>.png` (même taille que la frame) remplace la sortie automatique, ex. `art/clean/unit/fantassin/idle/0.png`.
