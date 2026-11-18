import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMBAT_UNITS, PEOPLES } from '../src/combat';
import { UNIT_SHEETS, recolorTeam, teamWeight, toRamp } from '../src/drawn';
import { checkUnitSheet } from '../src/gen/checks';
import { emptyJournal, validationPage } from '../src/gen/journal';
import { colorBlock, planJobs, unitPrompt } from '../src/gen/prompts';
import { costFromUsage, openRouterBody, parseRates, DEFAULT_RATES } from '../src/gen/providers';
import { loadSpecs, validateSpecs } from '../src/gen/specs';
import type { RgbaImage } from '../src/image';
import { TEAM_RAMPS } from '../src/palette';

const specs = await loadSpecs(join(resolve(__dirname, '../../..'), 'art/specs'));
const ALL = {
  units: [],
  sheets: [],
  peoples: [],
  decors: [],
  withUnits: true,
  withPortraits: true,
  withDecors: true,
} as const;

type Rgba = readonly [number, number, number, number];
function image(width: number, height: number, fill: (x: number, y: number) => Rgba): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4);
  }
  return { width, height, data };
}
const WHITE: Rgba = [255, 255, 255, 255];
const TEAM: Rgba = [209, 58, 46, 255];
const SKIN: Rgba = [198, 89, 34, 255];
const INK: Rgba = [43, 27, 23, 255];

/** Planche de `count` soldats (corps rouge d'équipe, jambes cuivrées) sur fond blanc. */
function sheet(count: number, feet: (i: number) => number = () => 80): RgbaImage {
  return image(400, 100, (x, y) => {
    const i = Math.floor(x / 100);
    const cx = i * 100 + 50;
    if (i >= count || Math.abs(x - cx) > 15) return WHITE;
    const bottom = feet(i);
    if (y > bottom || y < bottom - 60) return WHITE;
    if (Math.abs(x - cx) > 13 || y > bottom - 2) return INK;
    return y > bottom - 20 ? SKIN : TEAM;
  });
}

describe('catalogue art/specs', () => {
  it('est complet pour toutes les unités et tous les peuples', () => {
    expect(validateSpecs(specs, COMBAT_UNITS, PEOPLES)).toEqual([]);
  });
  it('signale une planche à moins de 4 cases', () => {
    const broken = structuredClone(specs) as unknown as {
      unites: Record<string, { planches: Record<string, string[]> }>;
    };
    broken.unites.fantassin!.planches.repos = ['un', 'deux'];
    expect(validateSpecs(broken as never, ['fantassin'], [])).toContain(
      'unites.json : fantassin.planches.repos doit avoir 4 cases',
    );
  });
});

describe('prompts', () => {
  it('impose les couleurs des sprites et le rouge d’équipe', () => {
    const text = colorBlock(specs, 'carthage', true);
    expect(text).toContain('#C65922');
    expect(text).toContain('#D13A2E');
    expect(text).not.toMatch(/\{\w+\}/);
    expect(colorBlock(specs, 'koush', false)).toContain('#3A73D1');
  });
  it('une planche de poses part du sprite, une séquence de la planche de poses', () => {
    const poses = unitPrompt(specs, 'archers', 'poses');
    expect(poses).toContain('pixel-art sprite sheet');
    expect(poses).toContain('1. Idle');
    expect(poses).toContain('4. Defeated');
    const daze = unitPrompt(specs, 'archers', 'sonne');
    expect(daze).toContain('attached pose sheet');
    expect(daze).toContain('Do not draw any stars');
  });
  it('liste les poses avant les séquences, puis portraits et décors', () => {
    const jobs = planJobs(specs, ALL, COMBAT_UNITS, PEOPLES, UNIT_SHEETS);
    expect(jobs.filter((job) => job.kind === 'unit')).toHaveLength(36);
    expect(jobs.filter((job) => job.kind === 'portrait')).toHaveLength(4);
    expect(jobs[0]).toMatchObject({
      id: 'unites/fantassin/poses',
      references: ['depot:art/raw/sprites-unités/fantassins-rouge.png'],
    });
    expect(jobs[1]).toMatchObject({
      id: 'unites/fantassin/repos',
      references: ['unites/fantassin/poses.png'],
    });
  });
  it('filtre par unité et planche', () => {
    const jobs = planJobs(
      specs,
      { ...ALL, units: ['char'], sheets: ['attaque'], withPortraits: false, withDecors: false },
      COMBAT_UNITS,
      PEOPLES,
      UNIT_SHEETS,
    );
    expect(jobs.map((job) => job.id)).toEqual(['unites/char/attaque']);
  });
});

describe('couleur d’équipe', () => {
  it('reconnaît le rouge d’équipe mais pas la peau, l’or ni la crème', () => {
    expect(teamWeight(209, 58, 46)).toBe(1);
    expect(teamWeight(142, 31, 36)).toBe(1);
    expect(teamWeight(198, 89, 34)).toBe(0);
    expect(teamWeight(159, 80, 33)).toBe(0);
    expect(teamWeight(214, 150, 37)).toBe(0);
    expect(teamWeight(239, 214, 168)).toBe(0);
  });
  it('recolore la rampe rouge vers celle du peuple, sans toucher la peau', () => {
    const img = image(2, 1, (x) => (x === 0 ? TEAM : SKIN));
    const out = recolorTeam(img, toRamp(TEAM_RAMPS.carthage), toRamp(TEAM_RAMPS.koush));
    const near = (value: number, target: number) => Math.abs(value - target) <= 8;
    expect(near(out.data[0]!, 0x3a) && near(out.data[1]!, 0x73) && near(out.data[2]!, 0xd1)).toBe(
      true,
    );
    expect([...out.data.slice(4, 7)]).toEqual([198, 89, 34]);
  });
});

describe('contrôles automatiques', () => {
  it('accepte 4 dessins séparés, pieds alignés, avec du rouge d’équipe', () => {
    const result = checkUnitSheet(sheet(4), 'repos', 60);
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  });
  it('refuse une planche à 3 dessins', () => {
    expect(checkUnitSheet(sheet(3), 'poses', null).ok).toBe(false);
  });
  it('refuse des pieds qui ne sont pas sur la même ligne', () => {
    const result = checkUnitSheet(
      sheet(4, (i) => (i === 2 ? 95 : 70)),
      'repos',
      null,
    );
    expect(result.problems).toContain('pieds pas sur la même ligne');
  });
  it('propose une correction d’échelle pour la planche de repos', () => {
    expect(checkUnitSheet(sheet(4), 'repos', 55).scale).toBe(0.9);
  });
});

describe('coûts', () => {
  it('calcule le coût d’après les jetons facturés', () => {
    const cost = costFromUsage(
      {
        input_tokens: 1300,
        output_tokens: 6000,
        input_tokens_details: { text_tokens: 300, image_tokens: 1000 },
      },
      DEFAULT_RATES,
    );
    expect(cost).toBeCloseTo((300 * 5 + 1000 * 8 + 6000 * 30) / 1e6);
  });
  it('lit les tarifs de .env, sinon garde ceux par défaut', () => {
    expect(parseRates('5, 10, 40')).toEqual({ textInput: 5, imageInput: 10, imageOutput: 40 });
    expect(parseRates('n’importe quoi')).toBe(DEFAULT_RATES);
  });
});

describe('OpenRouter', () => {
  it('envoie le prompt, le format 3:2 et les références en base64', () => {
    const [job] = planJobs(
      specs,
      { ...ALL, units: ['archers'], sheets: ['repos'], withPortraits: false, withDecors: false },
      COMBAT_UNITS,
      PEOPLES,
      UNIT_SHEETS,
    );
    const body = openRouterBody({ model: 'openai/gpt-image-2', quality: 'high' }, job!, [
      { name: 'poses.png', data: Buffer.from('abc') },
    ]);
    expect(body).toMatchObject({
      model: 'openai/gpt-image-2',
      aspect_ratio: '3:2',
      quality: 'high',
      output_format: 'png',
      input_references: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,YWJj' } }],
    });
    expect(body.prompt).toContain('attached pose sheet');
  });
  it('n’envoie pas les réglages propres à OpenAI aux autres modèles', () => {
    const [job] = planJobs(
      specs,
      { ...ALL, withUnits: false, withPortraits: false, decors: ['savane'] },
      COMBAT_UNITS,
      PEOPLES,
      UNIT_SHEETS,
    );
    const body = openRouterBody({ model: 'google/gemini-3-pro-image', quality: 'high' }, job!, []);
    expect(body).not.toHaveProperty('quality');
    expect(body).not.toHaveProperty('input_references');
  });
});

describe('page de validation', () => {
  it('montre chaque image, son état et la commande pour la refaire', () => {
    const jobs = planJobs(
      specs,
      { ...ALL, units: ['archers'], sheets: ['poses'], withPortraits: false, withDecors: false },
      COMBAT_UNITS,
      PEOPLES,
      UNIT_SHEETS,
    );
    const journal = emptyJournal();
    journal.images['unites/archers/poses'] = {
      statut: 'a-revoir',
      essais: 3,
      coutUsd: 0.5,
      problemes: ['pieds pas sur la même ligne'],
      notes: [],
      generateur: 'faux',
      date: '2026-11-14T10:00:00Z',
    };
    const html = validationPage(jobs, journal, new Set(['unites/archers/poses']), '1');
    expect(html).toContain('unites/archers/poses.png?v=1');
    expect(html).toContain('à revoir');
    expect(html).toContain('pieds pas sur la même ligne');
    expect(html).toContain('pnpm art:generer --unite archers --planche poses --refaire');
  });
});

describe('planches propres à un peuple', () => {
  it('partent du sprite du peuple, avec son teint, et se rangent dans peuples/', () => {
    const jobs = planJobs(
      specs,
      { ...ALL, units: ['fantassin'], peoples: ['koush'], withPortraits: false, withDecors: false },
      COMBAT_UNITS,
      PEOPLES,
      UNIT_SHEETS,
    );
    expect(jobs).toHaveLength(6);
    expect(jobs[0]).toMatchObject({
      id: 'peuples/koush/fantassin/poses',
      people: 'koush',
      references: ['depot:art/raw/sprites-unités/peuples/koush/fantassins-rouge.png'],
    });
    expect(jobs[1]).toMatchObject({
      id: 'peuples/koush/fantassin/repos',
      references: ['peuples/koush/fantassin/poses.png'],
    });
    // Dessiné en rouge (recoloré au build), avec le teint relevé sur ses sprites.
    expect(jobs[0]?.prompt).toContain('for this people');
    expect(jobs[0]?.prompt).toContain('#D13A2E');
    expect(jobs[0]?.prompt).toContain('#7A4420');
    expect(jobs[0]?.prompt).toContain('cowhide');
  });
  it('prennent les cases propres au peuple quand il en a', () => {
    const char = specs.unites.char!;
    const own = {
      sujet: 'royal palanquin',
      design: 'two bearers',
      planches: { poses: ['A', 'B', 'C', 'D'] as const },
    };
    const custom = {
      ...specs,
      unites: { ...specs.unites, char: { ...char, peuples: { ashanti: own } } },
    };
    const jobs = planJobs(
      custom,
      { ...ALL, units: ['char'], peoples: ['ashanti'], withPortraits: false, withDecors: false },
      COMBAT_UNITS,
      PEOPLES,
      UNIT_SHEETS,
    );
    expect(jobs[0]?.prompt).toContain('1. A');
    // Planche non surchargée : les cases de l'unité.
    expect(jobs[1]?.prompt).toContain(char.planches.repos[0]);
  });
  it('refusent un peuple sans fiche', () => {
    const char = specs.unites.char!;
    const without = { ...specs, unites: { ...specs.unites, char: { ...char, peuples: {} } } };
    expect(() =>
      planJobs(
        without,
        { ...ALL, units: ['char'], peoples: ['carthage'], withPortraits: false, withDecors: false },
        COMBAT_UNITS,
        PEOPLES,
        UNIT_SHEETS,
      ),
    ).toThrow(/char\.peuples\.carthage/);
  });
});

describe('connexion', () => {
  it('réessaie quand la connexion ne s’établit pas, pas sur une autre erreur', async () => {
    const { fetchConnecting } = await import('../src/gen/providers');
    const original = globalThis.fetch;
    let calls = 0;
    const fail = (code: string) =>
      Object.assign(new TypeError('fetch failed'), { cause: { code } });
    try {
      globalThis.fetch = (async () => {
        calls++;
        if (calls < 3) throw fail('UND_ERR_CONNECT_TIMEOUT');
        return new Response('ok');
      }) as typeof fetch;
      expect(await (await fetchConnecting('https://x', {}, 5, 0)).text()).toBe('ok');
      expect(calls).toBe(3);
      calls = 0;
      globalThis.fetch = (async () => {
        calls++;
        throw fail('UND_ERR_SOCKET');
      }) as typeof fetch;
      await expect(fetchConnecting('https://x', {}, 5, 0)).rejects.toThrow('fetch failed');
      expect(calls).toBe(1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
