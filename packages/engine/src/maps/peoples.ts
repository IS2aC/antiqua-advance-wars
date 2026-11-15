import type { MapDefinition, PlayerId } from '../model/types';

/**
 * Même carte, autres peuples : le i-ème camp de la carte (`map.players[i]`) devient
 * `peoples[i]` partout (bâtiments, unités, ordre de jeu). Sert à jouer « Le Gué du Nil »
 * avec deux peuples quelconques. Il faut autant de peuples que de camps, tous différents.
 */
export function assignPeoples(map: MapDefinition, peoples: readonly PlayerId[]): MapDefinition {
  if (peoples.length !== map.players.length || new Set(peoples).size !== peoples.length) {
    throw new Error(
      `assignPeoples : ${map.players.length} peuples différents attendus, reçu ${peoples.join(', ')}`,
    );
  }
  const swap = new Map(map.players.map((player, index) => [player, peoples[index] ?? player]));
  const rename = (player: PlayerId): PlayerId => swap.get(player) ?? player;
  return {
    ...map,
    buildings: map.buildings.map((building) => ({
      ...building,
      owner: building.owner === null ? null : rename(building.owner),
    })),
    units: map.units.map((unit) => ({ ...unit, owner: rename(unit.owner) })),
    players: map.players.map(rename),
  };
}
