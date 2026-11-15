/**
 * Génération des dessins de combat : `pnpm art:generer`.
 *
 * Lit le catalogue `art/specs/`, assemble les prompts, appelle un générateur d'images
 * (OpenRouter, ou OpenAI en direct, ou le faux générateur avec `--faux`), contrôle chaque image et la régénère si elle rate, la range
 * à son emplacement fixe dans `art/raw/combat-dessine/`, tient le journal des coûts, écrit la
 * page de validation, puis lance l'assemblage (`pnpm assets:dessin`).
 *
 *   pnpm art:generer --liste                     ce qui serait généré, et le coût prévu
 *   pnpm art:generer --unite fantassin            les 6 planches du fantassin
 *   pnpm art:generer --unite fantassin --peuple koush   sa version koushite (d'après ses sprites)
 *   pnpm art:generer --unite archers --planche attaque --refaire
 *   pnpm art:generer --portraits --peuple koush
 *   pnpm art:generer --decors
 *   pnpm art:generer --tout --budget 15
 *   pnpm art:generer --faux --dossier /tmp/essai  essai complet, sans clé ni dépense
 *
 * Clé dans `.env` à la racine du dépôt (jamais commité) : `OPENROUTER_API_KEY` (utilisée en
 * priorité) ou `OPENAI_API_KEY`. Réglages facultatifs : `OPENROUTER_IMAGE_MODEL`
 * (openai/gpt-image-2), `OPENAI_IMAGE_MODEL` (gpt-image-2), `IMAGE_QUALITE` (high),
 * `OPENAI_IMAGE_PRIX` (« 5,8,30 » $ par million de jetons texte, image en entrée, image en
 * sortie, OpenAI direct seulement), `IMAGE_ESTIMATION` (coût prévu d'une image, 0.25 $).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { COMBAT_UNITS, PEOPLES } from './combat';
import { UNIT_SHEETS } from './drawn';
import { checkPortraitSheet, checkUnitSheet, idleHeight, type CheckResult } from './gen/checks';
import { emptyJournal, validationPage, type Journal } from './gen/journal';
import { planJobs, type Job } from './gen/prompts';
import {
  fakeProvider,
  openAiProvider,
  openRouterProvider,
  parseRates,
  type ImageProvider,
  type Reference,
} from './gen/providers';
import { loadSpecs, validateSpecs, type UnitSheet } from './gen/specs';
import { loadImage, type RgbaImage } from './image';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SPECS = join(ROOT, 'art/specs');
const DEFAULT_OUT = join(ROOT, 'art/raw/combat-dessine');

const list = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

/** Charge `.env` (lignes `CLÉ=valeur`) sans écraser l'environnement. */
async function loadEnv(): Promise<void> {
  try {
    const text = await readFile(join(ROOT, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match?.[1] || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = (match[2] ?? '').replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch {
    // Pas de .env : la clé peut venir de l'environnement.
  }
}

async function readJournal(path: string): Promise<Journal> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Journal;
  } catch {
    return emptyJournal();
  }
}

const toRgba = async (png: Buffer): Promise<RgbaImage> => {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
  };
};

/** Images jointes : le sprite (depuis le dépôt) ou la planche de poses déjà générée. */
async function references(job: Job, out: string): Promise<Reference[] | string> {
  const refs: Reference[] = [];
  for (const ref of job.references) {
    const path = ref.startsWith('depot:') ? join(ROOT, ref.slice('depot:'.length)) : join(out, ref);
    if (!existsSync(path)) return ref.startsWith('depot:') ? ref.slice(6) : ref;
    // Toujours en PNG : l'API n'accepte que PNG, JPEG ou WebP.
    refs.push({
      name: path.split('/').pop() ?? 'reference.png',
      data: await sharp(path).png().toBuffer(),
    });
  }
  return refs;
}

async function check(job: Job, png: Buffer, out: string): Promise<CheckResult> {
  const image = await toRgba(png);
  if (job.kind === 'portrait') return checkPortraitSheet(image);
  if (job.kind === 'decor') return { ok: true, problems: [], notes: [] };
  const posesPath = join(out, dirname(job.id), 'poses.png');
  const reference =
    job.sheet !== 'poses' && existsSync(posesPath) ? idleHeight(await loadImage(posesPath)) : null;
  return checkUnitSheet(image, job.sheet as UnitSheet, reference);
}

/** Écrit les corrections d'échelle trouvées dans `reglages.json` (rubrique `echelles`). */
async function saveScales(out: string, scales: Record<string, number>): Promise<void> {
  if (Object.keys(scales).length === 0) return;
  const path = join(out, 'reglages.json');
  let settings: { echelles?: Record<string, number>; calages?: unknown } = {};
  try {
    settings = JSON.parse(await readFile(path, 'utf8')) as typeof settings;
  } catch {
    // Pas encore de réglages.
  }
  settings.echelles = { ...settings.echelles, ...scales };
  settings.calages ??= {};
  await writeFile(path, `${JSON.stringify(settings, null, 2)}\n`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((arg) => arg !== '--'),
    options: {
      unite: { type: 'string' },
      planche: { type: 'string' },
      portraits: { type: 'boolean', default: false },
      peuple: { type: 'string' },
      decors: { type: 'boolean', default: false },
      decor: { type: 'string' },
      tout: { type: 'boolean', default: false },
      refaire: { type: 'boolean', default: false },
      liste: { type: 'boolean', default: false },
      prompts: { type: 'boolean', default: false },
      faux: { type: 'boolean', default: false },
      budget: { type: 'string', default: '10' },
      essais: { type: 'string', default: '3' },
      dossier: { type: 'string' },
      'sans-assemblage': { type: 'boolean', default: false },
    },
  });
  await loadEnv();
  const specs = await loadSpecs(SPECS);
  const errors = validateSpecs(specs, COMBAT_UNITS, PEOPLES);
  if (errors.length > 0)
    throw new Error(`Catalogue art/specs incomplet :\n- ${errors.join('\n- ')}`);

  const units = list(values.unite);
  const sheets = list(values.planche) as UnitSheet[];
  for (const sheet of sheets) {
    if (!(UNIT_SHEETS as readonly string[]).includes(sheet)) {
      throw new Error(`Planche inconnue : ${sheet} (connues : ${UNIT_SHEETS.join(', ')})`);
    }
  }
  const onlyOthers =
    (values.portraits || values.decors) && units.length === 0 && sheets.length === 0;
  const jobs = planJobs(
    specs,
    {
      units,
      sheets,
      peoples: list(values.peuple),
      decors: list(values.decor),
      withUnits: values.tout || !onlyOthers,
      withPortraits: values.tout || values.portraits,
      withDecors: values.tout || values.decors,
    },
    COMBAT_UNITS,
    PEOPLES,
    UNIT_SHEETS,
  );

  const out = values.dossier
    ? resolve(process.env.INIT_CWD ?? process.cwd(), values.dossier)
    : DEFAULT_OUT;
  const budget = Number(values.budget);
  const tries = Math.max(1, Math.round(Number(values.essais)) || 1);
  const estimate = Number(process.env.IMAGE_ESTIMATION) || 0.25;
  const pending = jobs.filter((job) => values.refaire || !existsSync(join(out, `${job.id}.png`)));

  if (values.liste) {
    for (const job of jobs) {
      const todo = pending.includes(job) ? 'à générer' : 'déjà là';
      console.log(
        `${job.id.padEnd(32)} ${todo.padEnd(10)} réf. : ${job.references.join(', ') || '—'}`,
      );
      if (values.prompts) console.log(`\n${job.prompt}\n${'—'.repeat(60)}`);
    }
    const low = pending.length * 0.04;
    const high = pending.length * estimate;
    console.log(
      `\n${pending.length} image(s) à générer sur ${jobs.length}. Coût prévu : ${low.toFixed(2)} à ${high.toFixed(2)} $ (+ régénérations éventuelles, ${tries} essais max par image).`,
    );
    return;
  }

  let provider: ImageProvider = fakeProvider;
  if (!values.faux) {
    const quality = process.env.IMAGE_QUALITE ?? 'high';
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;
    if (openRouterKey) {
      provider = openRouterProvider({
        apiKey: openRouterKey,
        model: process.env.OPENROUTER_IMAGE_MODEL ?? 'openai/gpt-image-2',
        quality,
        estimateUsd: estimate,
      });
    } else if (openAiKey) {
      provider = openAiProvider({
        apiKey: openAiKey,
        model: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2',
        quality,
        rates: parseRates(process.env.OPENAI_IMAGE_PRIX),
        estimateUsd: estimate,
      });
    } else {
      throw new Error(
        'Clé absente : ajoute une ligne OPENROUTER_API_KEY=sk-or-... (ou OPENAI_API_KEY=sk-...) dans le fichier .env à la racine du dépôt (il n’est jamais commité), ou essaie avec --faux.',
      );
    }
  }

  const journalPath = join(out, 'generation.json');
  const journal = await readJournal(journalPath);
  const scales: Record<string, number> = {};
  let spent = 0;
  let made = 0;
  let stopped = false;
  console.log(
    `[art] ${provider.name} · ${pending.length} image(s) · budget ${budget.toFixed(2)} $ · dossier ${out}`,
  );

  const writePage = async () => {
    const present = new Set(
      jobs.filter((job) => existsSync(join(out, `${job.id}.png`))).map((job) => job.id),
    );
    await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    await writeFile(
      join(out, 'validation.html'),
      validationPage(jobs, journal, present, String(Date.now())),
    );
  };

  for (const job of pending) {
    if (stopped) break;
    const refs = await references(job, out);
    if (typeof refs === 'string') {
      console.warn(`[art] ${job.id} : bloqué, il manque la référence ${refs}.`);
      journal.images[job.id] = {
        statut: 'bloque',
        essais: 0,
        coutUsd: 0,
        problemes: [`référence manquante : ${refs}`],
        notes: [],
        generateur: provider.name,
        date: new Date().toISOString(),
      };
      continue;
    }
    let best: { png: Buffer; result: CheckResult } | null = null;
    let cost = 0;
    let attempts = 0;
    for (let attempt = 1; attempt <= tries; attempt++) {
      if (spent + provider.estimateUsd > budget) {
        console.warn(
          `[art] budget de ${budget.toFixed(2)} $ atteint (${spent.toFixed(2)} $ dépensés) : arrêt.`,
        );
        stopped = true;
        break;
      }
      attempts = attempt;
      process.stdout.write(`[art] ${job.id} : essai ${attempt}/${tries}… `);
      const generated = await provider.generate(job, refs);
      spent += generated.costUsd;
      cost += generated.costUsd;
      journal.totalUsd = Number((journal.totalUsd + generated.costUsd).toFixed(4));
      const result = await check(job, generated.png, out);
      console.log(
        `${generated.costUsd.toFixed(3)} $ · ${result.ok ? 'OK' : result.problems.join(' ; ')}`,
      );
      // Les essais ratés sont gardés à part, pour comprendre ce qui coince.
      if (!result.ok) {
        const failed = join(out, '.essais', `${job.id}-${attempt}.png`);
        await mkdir(dirname(failed), { recursive: true });
        await writeFile(failed, generated.png);
      }
      if (!best || result.problems.length < best.result.problems.length) {
        best = { png: generated.png, result };
      }
      if (result.ok) break;
    }
    if (!best) continue;
    const target = join(out, `${job.id}.png`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, best.png);
    made++;
    if (best.result.scale && job.unit && job.sheet) {
      // Même clé que `pnpm assets:dessin` : « <peuple>/<unité>/<planche> » ou « <unité>/<planche> ».
      scales[`${job.people ? `${job.people}/` : ''}${job.unit}/${job.sheet}`] = best.result.scale;
    }
    journal.images[job.id] = {
      statut: best.result.ok ? 'ok' : 'a-revoir',
      essais: attempts,
      coutUsd: Number(cost.toFixed(4)),
      problemes: best.result.problems,
      notes: best.result.notes,
      generateur: provider.name,
      date: new Date().toISOString(),
    };
    await writePage();
  }

  await saveScales(out, scales);
  await writePage();
  console.log(
    `[art] ${made} image(s) rangée(s), ${spent.toFixed(2)} $ dépensés (cumul ${journal.totalUsd.toFixed(2)} $). Validation : ${join(out, 'validation.html')}`,
  );
  // Une planche propre à un peuple reste prioritaire sur la planche commune : on le signale.
  const shadowed = jobs
    .filter((job) => job.kind === 'unit' && !job.people)
    .flatMap((job) =>
      PEOPLES.filter((people) =>
        existsSync(join(out, `peuples/${people}/${job.unit}/${job.sheet}.png`)),
      ).map((people) => `peuples/${people}/${job.unit}/${job.sheet}.png`),
    );
  if (shadowed.length > 0) {
    console.log(
      `[art] attention : ces anciennes planches restent prioritaires sur la version commune (les déplacer dans archives/ pour utiliser la nouvelle) :\n  ${[...new Set(shadowed)].join('\n  ')}`,
    );
  }
  if (made > 0 && out === DEFAULT_OUT && !values['sans-assemblage']) {
    console.log('[art] assemblage : pnpm assets:dessin');
    execFileSync('pnpm', ['assets:dessin'], { cwd: ROOT, stdio: 'inherit' });
  }
}

main().catch((error: unknown) => {
  const { message, cause } = error as Error & { cause?: { code?: string; message?: string } };
  // « fetch failed » seul ne dit rien : la cause (délai, réseau…) est dans `cause`.
  console.error(`[art] ${message}${cause ? ` (${cause.code ?? ''} ${cause.message ?? ''})` : ''}`);
  process.exit(1);
});
