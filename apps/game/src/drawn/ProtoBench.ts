import {
  FACTIONS,
  TERRAINS,
  UNITS,
  UNIT_TYPES,
  isIndirect,
  type PlayerId,
  type TerrainType,
  type UnitType,
} from '@antiqua/engine';
import type { CombatSetup, Strike } from '../combat/setup';
import { goToCover } from '../launch';
import { drawnStage } from './DrawnStage';

/**
 * Banc d'essai des combats dessinés (`jeu.html?mode=proto`, entrée « Animation (proto) »
 * de la page de garde). Provisoire : il sert à régler l'animation sans passer par une
 * partie, et disparaîtra quand les combats dessinés seront validés.
 *
 * On choisit l'attaquant, le défenseur, les PV avant et après, la riposte et la vitesse
 * (ralenti compris), puis on rejoue le combat autant de fois que nécessaire.
 */

const PEOPLES: readonly PlayerId[] = [
  'carthage',
  'koush',
  'almoravides',
  'ashanti',
  'dahomey',
  'sosso',
];
const TERRAIN_TYPES = Object.keys(TERRAINS) as TerrainType[];

const CSS = `
.banc { position: fixed; inset: 0; display: grid; grid-template-columns: 300px 1fr; gap: 20px;
  padding: 20px; box-sizing: border-box; background: #1a1410; color: #f3e6c4;
  font: 500 14px/1.4 "Plus Jakarta Sans", system-ui, sans-serif; }
.banc h1 { font-size: 18px; margin: 0 0 4px; color: #ffd166; }
.banc p { margin: 0 0 14px; color: #d8c8a0; font-size: 13px; }
.banc form { display: flex; flex-direction: column; gap: 10px; overflow: auto; }
.banc fieldset { border: 1px solid #4a3626; border-radius: 10px; padding: 10px 12px; margin: 0;
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; }
.banc legend { padding: 0 6px; color: #ffd166; font-weight: 700; }
.banc label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: #d8c8a0; }
.banc label.check { flex-direction: row; align-items: center; grid-column: 1 / -1; }
.banc select, .banc input[type=number] { background: #2b1b17; color: #fff4c8;
  border: 1px solid #6a4a30; border-radius: 6px; padding: 5px 6px; font: inherit; }
.banc .boutons { display: flex; gap: 8px; }
.banc button { flex: 1; padding: 10px; border-radius: 8px; border: 0; font: 700 14px/1 inherit;
  font-family: inherit; cursor: pointer; background: #ffd166; color: #2b1b17; }
.banc button.secondaire { background: #3a2a20; color: #f3e6c4; }
.banc button:disabled { opacity: .5; cursor: default; }
.banc .scene { position: relative; align-self: center; justify-self: center; width: 100%;
  max-height: 100%; aspect-ratio: 5 / 3; background: #000; border-radius: 6px;
  display: grid; place-items: center; color: #8a7a60; }
@media (max-width: 760px) { .banc { grid-template-columns: 1fr; grid-template-rows: auto 1fr; } }
`;

function options<T extends string>(values: readonly T[], label: (v: T) => string, selected: T) {
  return values
    .map((v) => `<option value="${v}"${v === selected ? ' selected' : ''}>${label(v)}</option>`)
    .join('');
}

function side(
  prefix: string,
  title: string,
  people: PlayerId,
  unit: UnitType,
  terrain: TerrainType,
): string {
  return `
    <fieldset>
      <legend>${title}</legend>
      <label>Peuple<select name="${prefix}-peuple">${options(PEOPLES, (p) => FACTIONS[p].name, people)}</select></label>
      <label>Unité<select name="${prefix}-unite">${options(UNIT_TYPES, (u) => UNITS[u].name, unit)}</select></label>
      <label>Terrain<select name="${prefix}-terrain">${options(TERRAIN_TYPES, (t) => TERRAINS[t].name, terrain)}</select></label>
      <label>PV avant<input type="number" name="${prefix}-avant" min="1" max="10" value="10" /></label>
      <label>PV après<input type="number" name="${prefix}-apres" min="0" max="10" value="${prefix === 'att' ? 10 : 4}" /></label>
    </fieldset>`;
}

/** Monte le banc d'essai à la place du jeu. */
export function startProtoBench(): void {
  document.getElementById('game')?.remove();
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'banc';
  root.innerHTML = `
    <form>
      <div>
        <h1>Animation (proto)</h1>
        <p>Banc d'essai des combats dessinés. L'attaquant est à gauche. Clic ou Entrée sur la scène pour la passer.</p>
      </div>
      ${side('att', 'Attaquant', 'carthage', 'fantassin', 'foret')}
      ${side('def', 'Défenseur', 'koush', 'archers', 'riviere')}
      <fieldset>
        <legend>Déroulé</legend>
        <label class="check"><input type="checkbox" name="riposte" /> Riposte du défenseur (PV après de l'attaquant)</label>
        <label>Vitesse<select name="vitesse">
          <option value="0.25">×0,25 (ralenti)</option>
          <option value="0.5">×0,5</option>
          <option value="1" selected>×1</option>
          <option value="2">×2</option>
        </select></label>
      </fieldset>
      <div class="boutons">
        <button type="submit">Lancer le combat</button>
        <button type="button" class="secondaire" data-retour>Menu</button>
      </div>
    </form>
    <div class="scene">La scène s'affiche ici.</div>`;
  document.body.appendChild(root);

  const form = root.querySelector('form') as HTMLFormElement;
  const stage = root.querySelector('.scene') as HTMLElement;
  const launch = form.querySelector('button[type=submit]') as HTMLButtonElement;
  root.querySelector('[data-retour]')?.addEventListener('click', () => goToCover());

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (launch.disabled) return;
    const data = new FormData(form);
    const get = (name: string) => String(data.get(name) ?? '');
    const hp = (name: string, min: number) =>
      Math.max(min, Math.min(10, Math.round(Number(get(name)) || min)));
    const attacker = {
      owner: get('att-peuple') as PlayerId,
      unitType: get('att-unite') as UnitType,
      before: hp('att-avant', 1),
      after: hp('att-apres', 0),
    };
    const defender = {
      owner: get('def-peuple') as PlayerId,
      unitType: get('def-unite') as UnitType,
      before: hp('def-avant', 1),
      after: Math.min(hp('def-apres', 0), hp('def-avant', 1)),
    };
    const riposte = data.get('riposte') !== null && defender.after > 0;
    const attackerAfter = riposte ? Math.min(attacker.after, attacker.before) : attacker.before;

    const strikes: Strike[] = [
      {
        from: 'left',
        targetHpBefore: defender.before,
        targetHpAfter: defender.after,
        ranged: isIndirect(attacker.unitType),
      },
    ];
    if (riposte) {
      strikes.push({
        from: 'right',
        targetHpBefore: attacker.before,
        targetHpAfter: attackerAfter,
        ranged: isIndirect(defender.unitType),
      });
    }
    const setup: CombatSetup = {
      left: {
        side: 'left',
        owner: attacker.owner,
        unitType: attacker.unitType,
        terrain: get('att-terrain') as TerrainType,
        role: 'attaquant',
        hpBefore: attacker.before,
        hpAfter: attackerAfter,
      },
      right: {
        side: 'right',
        owner: defender.owner,
        unitType: defender.unitType,
        terrain: get('def-terrain') as TerrainType,
        role: 'defenseur',
        hpBefore: defender.before,
        hpAfter: defender.after,
      },
      strikes,
    };

    launch.disabled = true;
    stage.textContent = '';
    void drawnStage.play(stage, setup, Number(get('vitesse')) || 1).finally(() => {
      launch.disabled = false;
      launch.focus();
    });
  });
}
