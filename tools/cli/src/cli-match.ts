/**
 * Match aléatoire en ligne de commande : deux joueurs aléatoires s'affrontent sur
 * « Le Gué du Nil » pendant 30 jours au plus. Toute action illégale arrête le match.
 *
 *   pnpm match            # graine aléatoire
 *   pnpm match -- 1234    # graine fixe (partie reproductible)
 */
import {
  ASCII_LEGEND,
  FACTIONS,
  GUE_DU_NIL,
  applyAction,
  chooseRandomAction,
  createGame,
  displayHp,
  incomeFor,
  type GameState,
  type PlayerId,
  type UnitType,
} from '@antiqua/engine';

const MAX_DAYS = 30;
const MAX_ACTIONS_PER_TURN = 500;

const UNIT_LETTERS: Record<UnitType, string> = {
  fantassin: 'i',
  lancier: 'l',
  archers: 'a',
  cavalerie: 'c',
  char: 'r',
  catapulte: 't',
};
const COLORS: Record<PlayerId, string> = {
  koush: '\x1b[34m',
  carthage: '\x1b[31m',
  kemet: '\x1b[33m',
  aksoum: '\x1b[32m',
};
const RESET = '\x1b[0m';
const TERRAIN_LETTERS = new Map(
  Object.entries(ASCII_LEGEND).map(([letter, terrain]) => [terrain, letter]),
);

const name = (id: PlayerId | null) => (id ? FACTIONS[id].name : 'personne');
const paint = (owner: PlayerId | null, text: string) =>
  owner ? `${COLORS[owner]}${text}${RESET}` : text;

/** Carte en texte : unités en couleur de camp (i l a c r t), bâtiments colorés. */
function render(state: GameState): string {
  const lines: string[] = [];
  for (let y = 0; y < state.map.height; y++) {
    let line = '';
    for (let x = 0; x < state.map.width; x++) {
      const unit = state.units.find((u) => u.x === x && u.y === y);
      const building = state.buildings.find((b) => b.x === x && b.y === y);
      const terrain = state.map.tiles[y * state.map.width + x];
      if (unit)
        line += paint(
          unit.owner,
          unit.owner === 'koush' ? UNIT_LETTERS[unit.type] : UNIT_LETTERS[unit.type].toUpperCase(),
        );
      else if (building)
        line += paint(
          building.owner,
          building.type === 'village' ? 'V' : building.type === 'caserne' ? 'C' : 'Q',
        );
      else line += terrain ? (TERRAIN_LETTERS.get(terrain) ?? '?') : '?';
    }
    lines.push(`  ${line}`);
  }
  return lines.join('\n');
}

function summary(state: GameState, id: PlayerId): string {
  const player = state.players.find((p) => p.id === id);
  const units = state.units.filter((u) => u.owner === id);
  const hp = units.reduce((total, u) => total + displayHp(u.hp), 0);
  const buildings = state.buildings.filter((b) => b.owner === id).length;
  return `${name(id).padEnd(8)} ${String(player?.funds ?? 0).padStart(6)} or · ${String(units.length).padStart(2)} unités (${hp} PV) · ${buildings} bâtiments · +${incomeFor(state, id)}/tour`;
}

function main(): void {
  const seed = Number.parseInt(process.argv[2] ?? '', 10);
  const gameSeed = Number.isNaN(seed) ? Math.floor(Math.random() * 2 ** 31) : seed;
  let state = createGame(GUE_DU_NIL, { seed: gameSeed });
  let agentSeed = gameSeed ^ 0x5bd1e995;
  let actions = 0;
  let actionsThisTurn = 0;

  console.log(`ALKÉBULAN — match aléatoire sur « ${GUE_DU_NIL.name} » (graine ${gameSeed})\n`);
  console.log(render(state));
  console.log();

  while (state.status === 'playing' && state.day <= MAX_DAYS) {
    const decision = chooseRandomAction(state, agentSeed);
    agentSeed = decision.seed;
    const result = applyAction(state, decision.action);
    if (!result.ok) {
      console.error(`Action illégale n°${actions} (${JSON.stringify(decision.action)}) :`);
      console.error(`  ${result.error.code} — ${result.error.message}`);
      process.exit(1);
    }
    const previousDay = state.day;
    state = result.state;
    actions += 1;
    actionsThisTurn = decision.action.type === 'END_TURN' ? 0 : actionsThisTurn + 1;
    if (actionsThisTurn > MAX_ACTIONS_PER_TURN) {
      console.error('Le joueur aléatoire tourne en rond : match interrompu.');
      process.exit(1);
    }
    if (state.day !== previousDay && state.status === 'playing') {
      console.log(`Jour ${String(previousDay).padStart(2)} terminé`);
      for (const player of state.players) console.log(`  ${summary(state, player.id)}`);
    }
  }

  console.log(`\nCarte finale (jour ${Math.min(state.day, MAX_DAYS)}, ${actions} actions) :`);
  console.log(render(state));
  console.log();
  for (const player of state.players) {
    console.log(
      `  ${summary(state, player.id)} · produites ${player.stats.unitsBuilt}, perdues ${player.stats.unitsLost}`,
    );
  }

  if (state.status === 'finished') {
    console.log(`\nVainqueur : ${name(state.winner)} (jour ${state.day}).`);
    return;
  }
  // Pas de fin au bout de 30 jours : on départage aux bâtiments puis aux PV.
  const score = (id: PlayerId) =>
    state.buildings.filter((b) => b.owner === id).length * 100 +
    state.units.filter((u) => u.owner === id).reduce((total, u) => total + displayHp(u.hp), 0);
  const [first, second] = [...state.players].sort((a, b) => score(b.id) - score(a.id));
  const leader = first && second && score(first.id) > score(second.id) ? first.id : null;
  console.log(
    `\n${MAX_DAYS} jours écoulés sans victoire : ${leader ? `avantage ${name(leader)} aux points` : 'égalité'}.`,
  );
}

main();
