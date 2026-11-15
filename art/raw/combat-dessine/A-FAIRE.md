# Combats dessinés — ce qui reste à dessiner

> Fichier généré par `pnpm assets:dessin` : ne pas le modifier à la main.
> Génération automatique : `pnpm art:generer` (fiches dans `art/specs/`, règles dans `docs/proto-combat.md`).

**Planches communes : 0 / 36** · portraits : 2 / 4 · décors : 1

Comme les sprites de la carte, chaque unité est dessinée une seule fois, en rouge, dans
`unites/<unité>/` (6 fichiers aux noms fixes), puis recolorée pour chaque peuple.
Entre parenthèses : une ancienne planche propre à un peuple, sans version commune.

| Unité | poses | repos | attaque | charge | chute | sonné |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Fantassin | · | · | · | · | · | · |
| Lancier | · | · | · | · | · | · |
| Archers | (Koush) | (Koush) | (Koush) | (Koush) | (Koush) | (Koush) |
| Cavalerie | · | · | · | · | · | · |
| Char | · | · | · | · | · | · |
| Catapulte | · | · | · | · | · | · |

## Planches propres à un peuple (`peuples/<peuple>/<unité>/`)

Prioritaires sur la planche commune pour ce peuple, et non recolorées.

- `peuples/koush/archers/poses`
- `peuples/koush/archers/repos`
- `peuples/koush/archers/attaque`
- `peuples/koush/archers/charge`
- `peuples/koush/archers/chute`
- `peuples/koush/archers/sonne`

## Portraits (`portraits/<peuple>.png`)

✅ Koush · ✅ Carthage · · Kemet · · Aksoum

## Décors (`decors/<nom>.png`)

savane
