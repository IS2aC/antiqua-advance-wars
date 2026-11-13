import { UNITS } from '../data/units';
import type { Draft, DraftBuilding, DraftUnit } from '../model/draft';
import type { GameEvent, GameState } from '../model/types';
import { buildingAt, displayHp, findUnit } from './grid';
import { defeatPlayer } from './victory';

/** Points de capture d'un bâtiment au repos. */
export const CAPTURE_POINTS = 20;

/** L'unité peut-elle capturer le bâtiment sur lequel elle se trouve ? */
export function canCapture(state: GameState, unitId: number): boolean {
  const unit = findUnit(state, unitId);
  if (!unit || !UNITS[unit.type].canCapture) return false;
  const building = buildingAt(state, unit.x, unit.y);
  return building !== undefined && building.owner !== unit.owner;
}

/** Retire les PV affichés de l'unité aux points du bâtiment ; à 0, il change de camp. */
export function resolveCapture(
  draft: Draft,
  events: GameEvent[],
  unit: DraftUnit,
  building: DraftBuilding,
): void {
  building.capturePoints = Math.max(0, building.capturePoints - displayHp(unit.hp));
  events.push({
    type: 'captureProgress',
    unitId: unit.id,
    x: building.x,
    y: building.y,
    capturePoints: building.capturePoints,
  });
  if (building.capturePoints > 0) return;

  const previousOwner = building.owner;
  building.owner = unit.owner;
  building.capturePoints = CAPTURE_POINTS;
  events.push({
    type: 'buildingCaptured',
    x: building.x,
    y: building.y,
    building: building.type,
    owner: unit.owner,
    previousOwner,
  });
  if (building.type === 'qg' && previousOwner !== null) {
    defeatPlayer(draft, events, previousOwner, 'hq');
  }
}

/** Une capture entamée repart à 20 quand l'unité quitte la case ou meurt. */
export function resetCaptureAt(draft: Draft, events: GameEvent[], x: number, y: number): void {
  const building = draft.buildings.find((candidate) => candidate.x === x && candidate.y === y);
  if (!building || building.capturePoints >= CAPTURE_POINTS) return;
  building.capturePoints = CAPTURE_POINTS;
  events.push({ type: 'captureReset', x, y });
}
