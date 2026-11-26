# Planches des peuples (fiches de référence)

Une planche par peuple, dans l'esprit de la planche « Roi de Koush / Guerrier carthaginois » :
le dirigeant (grand portrait, vues sous 4 angles, expressions), les guerriers typiques du
peuple, l'écusson, la palette et les objets marquants. Elles servent de **référence visuelle**
pour la suite (sprites de la carte, combats dessinés, portraits, site).

Peuples retenus : **Koush, Carthage, Almoravides, Ashanti**, puis **Dahomey et Sosso**
(demandés le 26/11/2026). Kemet et Aksoum viendront après (voir `docs/ajustements.md`).

Les prompts sont en anglais (les générateurs d'images le suivent mieux) ; les textes affichés
sur la planche sont en français et donnés mot pour mot. Format conseillé : 16:9 (1536×864 ou
plus), qualité haute. Si le modèle écorche les textes, générer sans texte (retirer les lignes
« Text ») et poser les titres ensuite.

## Couleurs d'équipe

Une couleur par peuple, nettement différente des trois autres pour rester lisible sur la carte.

| Peuple      | Couleur d'équipe                 | Rampe (sombre → clair)              | Pourquoi                                                                 |
| ----------- | -------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| Carthage    | rouge cramoisi (pourpre de Tyr)  | #4A1218 · #8E1F24 · #D13A2E · #F2735A | la pourpre phénicienne, teinture qui a fait la richesse de Tyr et Carthage |
| Koush       | bleu roi                         | #16234A · #24418E · #3A73D1 · #73B4F2 | déjà en place ; faïence bleue et lapis des parures nubiennes               |
| Almoravides | vert émeraude                    | #123A1E · #1F6E34 · #2EAE4E · #6FDE85 | bannières des dynasties du Maghreb ; voile indigo sombre en complément    |
| Ashanti     | jaune or                         | #4A3512 · #8E6A1F · #D1A72E · #F2D65A | l'or de la Côte de l'Or et du Tabouret d'or ; kente or, vert et noir       |
| Dahomey     | violet royal                     | #2E1240 · #5A2380 · #8A3FC4 · #C38AF0 | couleur libre, lisible à côté des quatre autres                            |
| Sosso       | orange terre cuite               | #4A2208 · #8E4214 · #D9711E · #F7AE5E | la terre et le fer du Sahel ; bogolan noir et crème en complément          |

Les rampes vert et jaune reprennent celles des sprites actuels (ex-Aksoum et ex-Kemet) : rien à
redessiner côté couleurs de la carte.

## Gabarit commun (à placer en tête de chaque prompt)

```text
A professional character design reference sheet for a 2D strategy video game called "ALKÉBULAN", in a polished Disney-style 2D animated feature look blended with modern anime: clean confident ink outlines, flat bright colors with soft two-tone cel shading, warm sunny lighting, appealing slightly stylized proportions, large expressive eyes and readable expressions, painterly but simple backgrounds. Not photorealistic, not a detailed oil painting. Landscape 16:9 layout on a warm cream parchment background, with a decorative title banner in the people's team color across the top and a small golden game logo "ALKÉBULAN" at the top center.

Layout, left to right and top to bottom:
- Left column: a large bust portrait of the leader, in front of a softly painted background of their homeland.
- Top right, labeled "Vues": the leader standing in a full-body turnaround (front, three-quarter, side, back), same scale, feet on one line.
- Middle right, labeled "Expressions": 5 small heads of the leader (calm, battle cry, determined smile, wincing in pain, thinking).
- Bottom right, labeled "Guerriers": 3 full-body warriors typical of this people, same art style, smaller than the leader.
- Bottom left, labeled "Palette": 6 color swatches (team color dark and light, skin tone, gold, cream, dark brown).
- Bottom center, labeled "Écusson et objets": the people's emblem drawn as a heraldic badge, then 3 iconic objects.
- Bottom right corner: a small action scene of the leader commanding troops.

Historically grounded, respectful and dignified depiction; accurate skin tones; no modern elements; no extra text besides the labels given. All text in French, spelled exactly as written.
```

## Koush

```text
People: the Kingdom of Kush (Nubia, Napata and Meroë, middle Nile, Sudan), "Ta-Seti, the Land of the Bow", famed for its archers; Kushite kings ruled Egypt as the 25th dynasty.
Team color: royal blue (#24418E, #3A73D1), with gold and white linen.
Text: title "Royaume de Koush", subtitle "Taharqa, roi de Koush et pharaon · Archers · Or · Amon".
Leader: King Taharqa, a Nubian king in his forties, very dark brown skin, short tightly curled hair, short beard, strong and serene. Kushite skullcap crown in gold with two uraeus cobras on the brow and long ribbons at the back, gold broad collar with ram-head pendants, gold armlets, white pleated linen kilt and a royal-blue sash and cloak with gold edging.
Warriors: a Nubian archer with a long self bow, a feather in the headband, a team-blue sash and a leather quiver; a spearman with a tall oval cowhide shield; a mounted archer or a camel rider of the Meroitic period. Skin from dark brown to very dark brown.
Emblem: the ram head of Amun crowned with a sun disk, gold on royal blue.
Objects: a long Nubian bow with arrows, the gold double-cobra crown, a small Meroitic pyramid.
Homeland background: the steep pyramids of Meroë and the Nile among sand and acacias.
```

## Carthage

```text
People: Carthage, the Punic city founded by Phoenicians from Tyre on the coast of Tunisia, a maritime empire of traders and sailors, with armies of Libyan, Numidian and Iberian soldiers and war elephants.
Team color: crimson red and Tyrian purple (#8E1F24, #D13A2E), with gold and cream.
Text: title "Carthage", subtitle "Hannibal Barca · Marins · Éléphants · Tanit".
Leader: Hannibal Barca, a general in his thirties, Mediterranean North African look, warm olive-tan to light brown skin, short dark curly hair and short beard, sharp determined eyes. Bronze-and-gold Hellenistic helmet with cheek guards and a crimson crest, muscled bronze cuirass, crimson cloak with purple border, a gold brooch.
Warriors: a Libyan-Punic heavy infantryman with a round shield bearing the sign of Tanit, a crested helmet and a long spear; a Numidian light horseman, darker brown skin, riding bareback with javelins; a war elephant with a small tower and a mahout. Skin from olive-tan to dark brown (Punic, Libyan, Numidian).
Emblem: the sign of Tanit (a triangle with a disk and horizontal arms) above a palm tree, gold on crimson.
Objects: a round shield with the sign of Tanit, a Punic warship prow with a bronze ram, a coin with a horse head and a palm tree.
Homeland background: the circular military harbor of Carthage and white houses by the sea.
```

## Almoravides

```text
People: the Almoravids (al-Murābiṭūn), a Saharan Amazigh (Berber) Sanhaja confederation from Mauritania and the western Sahara, 11th–12th century, who founded Marrakech and ruled from the Senegal river to al-Andalus; men wore the litham, a face veil covering mouth and nose.
Team color: emerald green (#1F6E34, #2EAE4E), with deep indigo cloth, gold and white wool.
Text: title "Almoravides", subtitle "Youssef ibn Tachfine · Sahara · Chameliers · Marrakech".
Leader: Yusuf ibn Tashfin, a lean Saharan Amazigh emir in his fifties, brown skin weathered by the desert sun, dark eyes, short grey-streaked beard partly hidden by an indigo litham veil pulled down below the chin in the portrait and worn over the face in the action scene, emerald-green turban, white wool burnous with an emerald-green border, a curved dagger at the belt.
Warriors: a veiled camel rider with a long lance; an infantryman with a large round lamt shield of white antelope hide and a javelin, in disciplined ranks; a war drummer with a large drum. Skin from tan to dark brown; Saharan and West African soldiers side by side.
Emblem: a round white lamt shield with an emerald-green Amazigh geometric pattern (diamonds and the yaz ⵣ sign), no writing.
Objects: the white lamt hide shield, a gold Almoravid dinar (decorated with abstract geometric lines, no readable script), a war drum.
Homeland background: red-ochre walls of Marrakech with palm trees and the Atlas mountains, and dunes of the Sahara.
```

## Ashanti

```text
People: the Asante (Ashanti) Empire of the Akan people, in the forests of present-day Ghana, founded around 1700 by Osei Tutu and the priest Okomfo Anokye around the Golden Stool, rich in gold, famous for kente cloth and adinkra symbols.
Team color: gold yellow (#8E6A1F, #D1A72E), with kente green, black and red accents.
Text: title "Empire ashanti", subtitle "Osei Tutu, asantehene · Or · Kente · Tabouret d'or".
Leader: Osei Tutu, the first Asantehene, a strong West African king in his forties, very dark brown skin, short black hair, clean-shaven, calm and majestic. A gold-and-black crown band with gold ornaments, heavy gold necklaces, gold bracelets and rings, a kente cloth in gold, green and black worn toga-style over one shoulder, gold sandals.
Warriors: a forest warrior with a spear and a small wooden shield, gold-yellow cloth, protective amulets on a cotton war shirt; a scout with a bow; a war-horn blower with an ivory horn. Skin dark brown to very dark brown.
Emblem: the Golden Stool (Sika Dwa Kofi) in gold with small bells, on a field of gold-yellow kente.
Objects: the Golden Stool, an akrafena state sword with gold-leaf handle, a strip of kente cloth.
Homeland background: the dense tropical forest of Kumasi with red earth paths and a palace of carved walls.
```

## Dahomey

```text
People: the Kingdom of Dahomey (the Fon people, capital Abomey, in present-day Benin), 17th–19th century, famous for its royal army of women soldiers, the Agojie (also called Mino, "our mothers"), and for the royal appliqué cloths and clay bas-reliefs of the palaces of Abomey.
Team color: royal violet (#5A2380, #8A3FC4), with gold, white cotton and indigo accents.
Text: title "Royaume du Dahomey", subtitle "Béhanzin, roi d'Abomey · Agojié · Requin · Abomey".
Leader: King Béhanzin (Gbèhanzin), a Fon king in his forties, very dark brown skin, round strong face, short black beard and moustache, calm and proud. A large team-violet cloth with white and gold appliqué borders draped toga-style over one shoulder, a small white cotton cap, a silver bracelet, sandals, holding a récade (a carved wooden royal scepter with a curved head inlaid with silver).
Warriors: three Agojie women soldiers, strong and dignified, very dark brown skin, short hair: one with a short curved sword and a wooden club, a white cotton cap with a small team-violet crocodile emblem, a knee-length sleeveless tunic with team-violet and white vertical stripes, a leather belt; one archer with a bow and a quiver; one with a long spear. Women warriors, not men.
Emblem: Béhanzin's symbol, a gold shark above an egg, on a team-violet field with a white appliqué border.
Objects: the récade royal scepter, an Abomey appliqué cloth with animal figures, a royal parasol.
Homeland background: the royal palace of Abomey with red clay walls decorated with bas-reliefs, palm trees and a red earth courtyard.
```

## Sosso

```text
People: the Sosso kingdom (Soso), 12th–13th century, in the Sahel of present-day Mali, a Soninke kingdom of blacksmith kings; its king Soumaoro Kanté, the blacksmith-sorcerer king of the Mande epic, fought Sundiata Keita at the battle of Kirina; his warriors included the dozos, the brotherhood of Mande hunters in mud-cloth tunics covered with amulets.
Team color: terracotta orange (#8E4214, #D9711E), with bogolan mud-cloth black and cream, ochre and iron grey.
Text: title "Royaume de Sosso", subtitle "Soumaoro Kanté, roi-forgeron · Dozos · Fer · Balafon".
Leader: Soumaoro Kanté, an imposing Sahelian king in his fifties, very dark brown skin, strong jaw, short grey-flecked beard, piercing eyes, powerful and mysterious. A tall dark hunter-king cap ornamented with iron and gold, a long team-orange bogolan tunic with black geometric mud-cloth patterns, covered with small leather amulets (gris-gris) and cowrie shells, heavy iron bracelets, holding a staff with an iron head shaped like a blacksmith's hammer.
Warriors: a dozo hunter with a brown mud-cloth tunic covered with small leather amulets and cowries, a brimmed conical hunter's hat, a bow and a quiver; a Sosso spearman with an iron-headed spear, a round leather shield and a team-orange tunic; a Sahelian horseman with an iron lance and a quilted team-orange horse cloth. Skin dark brown to very dark brown. Bows, spears and lances only, no firearms.
Emblem: a crossed iron blacksmith hammer and hunting bow above an anvil, on a team-orange field with a black-and-cream bogolan border.
Objects: the Sosso Bala (a large wooden balafon with gourd resonators), a blacksmith's anvil with tongs, a dozo hunter's tunic covered with amulets.
Homeland background: the Sahel savanna with baobabs, rocky hills, a village of mud-brick houses and round granaries, the smoke of a forge.
```

## Points d'attention

- **Époques** : Koush et Carthage sont antiques ; les Almoravides (XIe–XIIe s.) et l'empire
  ashanti (à partir de 1700) sont plus tardifs. Les prompts gardent des armes blanches (lances,
  arcs, boucliers) pour rester dans l'esprit du jeu ; historiquement, l'armée ashanti des
  XVIIIe–XIXe s. utilisait aussi des fusils.
- **Teints** : chaque peuple a son teint (olive à brun chez les Carthaginois, brun chez les
  Almoravides, brun foncé à très foncé chez les Nubiens et les Ashanti). Cela sort de la règle
  actuelle « un seul sprite rouge recoloré pour tous » : une fois les planches validées, il
  faudra des sprites et des dessins de combat propres à chaque peuple (voir
  `docs/ajustements.md`).
- **Dahomey et Sosso** : armes blanches et arcs seulement (pas de fusils), comme pour les
  Ashanti. L'armée du Dahomey est représentée surtout par des femmes (les Agojié).
- **Symboles** : pas d'écriture sacrée ni de calligraphie sur les écussons (le modèle
  l'écorcherait) ; motifs géométriques et objets à la place.

## Passage en style dessin animé (à partir d'une planche validée)

Pour changer de style sans perdre les visages, les teints, les couleurs et les écussons, on
joint **deux images** : la planche à garder (contenu) puis une planche modèle du style voulu
(la planche « Roi de Koush / Guerrier carthaginois »). Avec la seule planche de contenu, le
modèle recopie aussi son rendu et le style change à peine. Coût constaté : 0,15 $ par planche
(`openai/gpt-image-2`, qualité haute, 16:9).

```text
Two reference images are attached. Image 1 is the CONTENT reference: a character reference sheet whose layout, characters, faces, skin tones, clothing, colors, emblem, objects and texts must be kept. Image 2 is the STYLE reference only (ignore its characters, its layout and its texts).
Redraw the sheet of image 1 entirely in the art style of image 2: a Disney-style 2D animated feature look blended with modern anime, bold clean black outlines, large flat areas of bright saturated color, simple two-tone cel shading with no painterly texture, no fine engraving detail, no crosshatching, smooth simplified shapes, slightly stylized heroic proportions, bigger expressive eyes with highlights, bright sky-blue backgrounds with soft cartoon clouds, a clean light cream background behind the panels. Simplify ornaments, jewelry and fabric patterns into bold readable cartoon shapes while keeping their colors and motifs.
Keep from image 1: the same layout and panels in the same places, the same characters recognizable with the same face shapes, facial features, beards, hair and ages, exactly the same skin tones, the same clothing and jewelry, the same team colors and palette swatches, the same emblem and objects, the same warriors and action scene. Keep all the texts and spell them exactly: {textes}.
```

Dans `{textes}`, mettre le logo, les titres de section et la ligne « Text » du peuple.
