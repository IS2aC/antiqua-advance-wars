# Alkébulan — Art des scènes de combat (phase B)

> Les scènes de combat sont composées en direct : un **décor** par terrain, et des **figurants**
> (un par PV) propres à chaque peuple. Ce document dit quoi produire, où le déposer et avec
> quels prompts. Tout ce qui manque retombe automatiquement sur la phase A (sprites de carte
> agrandis, décors en tuiles) : on peut livrer planche par planche.

## 1. Ce qu'il faut produire

| Quoi | Combien | Où déposer (noms exacts) |
| --- | --- | --- |
| Figurants de Koush | 6 planches | `art/raw/peuples/koush/combat/<unité>.png` |
| Figurants de Carthage | 6 planches | `art/raw/peuples/carthage/combat/<unité>.png` |
| Décors | 10 images, communs à tous les peuples | `art/raw/combat/decors/<terrain>.png` |

- `<unité>` : `fantassin`, `lancier`, `archers`, `cavalerie`, `char`, `catapulte`.
- `<terrain>` : `plaine`, `foret`, `colline`, `montagne`, `desert`, `marais`, `riviere`, `village`, `caserne`, `qg`. La route utilise le décor `plaine`, le pont le décor `riviere`.

Ensuite : `pnpm assets:build`, puis ouvrir `tools/asset-pipeline/report.html`, section « Scènes de combat ». Un nom de fichier inconnu est signalé dans les avertissements.

**Ordre conseillé** : une planche (le fantassin de Koush), la valider dans le rapport et en jeu, puis les autres en joignant la planche validée à chaque nouvelle génération.

## 2. Gabarit d'une planche de figurant

```text
4 colonnes × 5 lignes, une case = 64×64 pixels de jeu, agrandie ×4 → 256×256 px
Planche entière : 1024 × 1280 px, fond magenta #FF00FF uni, sans quadrillage visible

ligne 1  repos      4 images  (respiration, boucle)
ligne 2  marche     4 images  (cycle de marche ou de galop, boucle)
ligne 3  attaque    4 images  (coup porté, tir de l'arc, lancement de la catapulte)
ligne 4  touché     2 images  (colonnes 1 et 2 ; colonnes 3 et 4 restent magenta)
ligne 5  mort       4 images  (chute ; la dernière image est le corps au sol)
```

- **Un seul personnage par case**, toujours le même, **tourné vers la droite**, de profil ou trois-quarts. Le jeu le retourne lui-même pour l'autre côté de l'écran.
- **Pieds sur le bas de la case**, même hauteur dans toutes les images d'une ligne. Garde 2 pixels de jeu de marge autour du personnage.
- Cavalerie, char et catapulte tiennent aussi dans leur case de 64 : on les dessine « chibi », pas à l'échelle réelle.
- **Couleurs d'équipe** : vêtements, plumes, boucliers et étendards utilisent **uniquement** les 4 rouges réservés (`#4A1218`, `#8E1F24`, `#D13A2E`, `#F2735A`). Le pipeline les remplace par la couleur du camp. Aucun autre rouge ailleurs.

## 3. Gabarit d'un décor

```text
Image portrait 1024 × 1536 px, sans fond magenta, sans personnage, sans texte
Le jeu recadre au centre (environ 1024 × 1229) puis réduit à 320 × 384 pixels de jeu
```

- Laisse **les 10 % du haut et du bas** sans élément important (recadrage).
- **Le haut (environ 15 %) est couvert par le bandeau** des PV : du ciel suffit.
- **Horizon vers 40 % de la hauteur**. La **moitié basse est un sol dégagé et plat**, vu légèrement de haut : les figurants s'y tiennent en deux rangs.
- Vue de côté, lumière venant de la gauche, couleurs moyennes et un peu sourdes (les figurants doivent ressortir). Pas de rouge vif.

## 4. Bloc de style (en tête de chaque prompt de figurant)

```text
STYLE: true pixel art sprite sheet for the battle scenes of a turn-based tactics game, in the spirit of early-2000s handheld consoles. Each frame is exactly 64x64 game pixels drawn on a strict pixel grid and scaled up 4x with nearest-neighbor, so every game pixel is a perfect 4x4 block. No anti-aliasing, no blur, no gradients, no dithering noise. Chunky heroic proportions (about 3 heads tall), readable silhouette, 1-pixel dark brown outline (#2B1B17), light from the top-left. Limited palette, max 16 colors per sprite. TEAM COLOR: clothing, plumes, banners and shield faces use ONLY these 4 reds: #4A1218, #8E1F24, #D13A2E, #F2735A; never use these reds anywhere else. Respectful, historically grounded depiction of ancient African and Mediterranean peoples, no caricature. Background: flat solid magenta #FF00FF. No text, no labels, no numbers.

LAYOUT: one sprite sheet, 4 columns x 5 rows, each cell 64x64 game pixels, the same character in every cell, facing right, feet on the bottom of the cell. Row 1: idle (4 frames, breathing). Row 2: walk or gallop cycle (4 frames). Row 3: attack (4 frames). Row 4: hit reaction (2 frames in columns 1-2, columns 3-4 left empty magenta). Row 5: death (4 frames, the last one lying on the ground).
```

Joindre à chaque génération la planche de style maître (`art/raw/planche style maitre.png`) et la dernière planche de figurant validée.

## 5. Fiches de Koush (royaume de Kerma, Napata et Méroé)

Le « pays de l'arc » : archers réputés, lin blanc, cuir, bronze et or, plumes d'autruche.

| Unité | Fiche (à coller après le bloc de style) |
| --- | --- |
| `fantassin` | `CHARACTER: Kushite infantryman. Dark brown skin, short white linen kilt, leather sash, team-red headband with a single ostrich feather, gold armlets, oval cowhide shield with team-red rim, bronze-tipped spear. Attack row: a forward spear thrust.` |
| `lancier` | `CHARACTER: Kushite heavy spearman, broader and sturdier than the infantryman. Quilted linen and leather armor, team-red cape, leather cap with two ostrich feathers, tall cowhide shield, long heavy spear held level. Attack row: a powerful two-handed lunge behind the shield.` |
| `archers` | `CHARACTER: Kushite archer of Ta-Seti, the land of the bow. Lean, white linen kilt, team-red sash and headband with feathers, quiver of arrows on the back, a long self bow almost as tall as him. Attack row: draw the bow to full tension, release, follow-through.` |
| `cavalerie` | `CHARACTER: Kushite light horseman on a small agile horse. Rider with team-red tunic and feathered headband, two javelins, team-red saddle cloth. Walk row is a gallop. Attack row: a javelin throw from horseback.` |
| `char` | `CHARACTER: Kushite war chariot, light two-wheeled chariot pulled by one horse (drawn chibi to fit 64x64), a driver and an archer, team-red chariot panel and horse cloth, gold fittings. Walk row: wheels turning, horse trotting. Attack row: the archer shoots from the moving chariot.` |
| `catapulte` | `CHARACTER: Kushite siege engine: a wooden throwing engine on four wheels, bound with leather and bronze, a team-red banner, one Kushite engineer pushing or operating it. Attack row: the arm swings and launches a stone.` |

## 6. Fiches de Carthage (puissance punique)

Bronze, lin et laine teinte de pourpre ; armée de citoyens, de Libyens et de Numides.

| Unité | Fiche (à coller après le bloc de style) |
| --- | --- |
| `fantassin` | `CHARACTER: Libyan-Punic infantryman. Warm brown skin, short linen tunic in team red, simple bronze helmet, round wooden shield with bronze rim and team-red face, spear. Attack row: a spear thrust over the shield.` |
| `lancier` | `CHARACTER: Carthaginian heavy hoplite of the Sacred Band, broader and sturdier than the infantryman. Bronze muscle cuirass, team-red crest on an Attic bronze helmet, large round bronze shield (aspis) with team-red face, long spear. Attack row: a braced overhand spear strike.` |
| `archers` | `CHARACTER: Punic archer. Light linen tunic in team red, leather cap, quiver at the hip, recurved composite bow. Attack row: draw, release, follow-through.` |
| `cavalerie` | `CHARACTER: Numidian light horseman, riding without saddle or bridle on a small fast horse, team-red cloak, small round leather shield, a bundle of javelins. Walk row is a gallop. Attack row: a javelin throw at full gallop.` |
| `char` | `CHARACTER: Carthaginian war chariot, heavy two-wheeled chariot pulled by one armored horse (drawn chibi to fit 64x64), driver and spearman, team-red chariot panel, bronze fittings. Walk row: wheels turning. Attack row: the spearman strikes forward from the charging chariot.` |
| `catapulte` | `CHARACTER: Punic torsion catapult (Hellenistic style) on wheels, wooden frame with bronze fittings, a team-red banner, one Punic engineer working it. Attack row: the arm springs forward and launches a stone.` |

## 7. Prompts des décors

Bloc commun, puis la ligne du terrain :

```text
STYLE: true pixel art battle backdrop for the side-view battle scenes of a turn-based tactics game, early-2000s handheld console look. Portrait image, 320x384 game pixels drawn on a strict pixel grid and scaled up with nearest-neighbor. Side view, light from the left, muted mid-value colors, max 24 colors, no pure black. Horizon at about 40% of the height; the lower half is flat open ground seen slightly from above, empty, where soldiers will stand. Keep the top 10% and bottom 10% free of important details. Africa and the Mediterranean in antiquity. No people, no animals, no text, no bright red.
```

| Terrain | Ligne à ajouter |
| --- | --- |
| `plaine` | `SCENE: open golden savanna, tufts of grass, a few distant acacia trees on the horizon, wide blue sky with soft clouds.` |
| `foret` | `SCENE: edge of an acacia and baobab woodland, trees framing the horizon, dappled shade on grassy ground.` |
| `colline` | `SCENE: rolling green-ochre hills, the ground rises gently, scattered rocks, distant hills under a clear sky.` |
| `montagne` | `SCENE: rocky mountain pass, steep brown cliffs on the horizon, stony ground with boulders.` |
| `desert` | `SCENE: sand dunes under a pale hot sky, wind ripples on the sand, a distant rocky outcrop.` |
| `marais` | `SCENE: Nile marshland, papyrus reeds on the horizon, shallow pools between muddy grass patches.` |
| `riviere` | `SCENE: bank of the Nile, wide blue river along the horizon, wet sandy bank and reeds in the foreground.` |
| `village` | `SCENE: edge of a village with round thatched mud huts and wooden fences on the horizon, beaten earth ground.` |
| `caserne` | `SCENE: in front of a mud-brick military camp with walls, a gate and crossed spears, beaten earth parade ground.` |
| `qg` | `SCENE: before a great mud-brick fortress with tall towers in the Sudano-Sahelian style, a wide open esplanade in front.` |

## 8. Ajouter un peuple plus tard

Un nouveau dossier `art/raw/peuples/<peuple>/combat/` suffit au pipeline et à la scène de combat. Aujourd'hui, les peuples reconnus sont ceux du moteur (`koush`, `carthage`, `kemet`, `aksoum`) : en ajouter un autre demande encore de le déclarer dans le moteur et sa rampe de couleurs dans `tools/asset-pipeline/src/palette.ts`. La phase D supprimera cette étape.
