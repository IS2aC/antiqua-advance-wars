/**
 * Sprites de carte propres à chaque peuple : `pnpm art:sprites`.
 *
 * Pour chaque peuple et chaque unité du catalogue `art/specs/sprites-peuples.json`, demande
 * à OpenRouter une planche 4×4 en rouge d'équipe, avec deux images jointes : la planche rouge
 * commune (format, taille des pixels, poses) et la planche de référence du peuple
 * (`art/reference/peuples/<peuple>.png` : teint, visage, tenue). Sortie :
 * `art/raw/sprites-unités/peuples/<peuple>/<fichier de la planche commune>`.
 *
 *   pnpm art:sprites                              tout ce qui manque
 *   pnpm art:sprites --unite archers --peuple koush --refaire
 *   pnpm art:sprites --liste
 *
 * Clé : `OPENROUTER_API_KEY` dans `.env` à la racine du dépôt (jamais commité).
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const MODEL = 'openai/gpt-image-2';
/** Coût constaté d'une planche carrée en qualité haute, pour le budget. */
const ESTIMATE_USD = 0.25;

interface Catalog {
  readonly style: string;
  readonly unites: Readonly<
    Record<string, { readonly format: string; readonly peuples: Readonly<Record<string, string>> }>
  >;
}

interface Task {
  readonly unit: string;
  readonly people: string;
  readonly format: string;
  readonly prompt: string;
  readonly out: string;
}

async function loadEnv(): Promise<void> {
  try {
    for (const line of (await readFile(join(ROOT, '.env'), 'utf8')).split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match?.[1] || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = (match[2] ?? '').replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch {
    // Pas de .env : la clé peut venir de l'environnement.
  }
}

const dataUrl = async (path: string) =>
  `data:image/png;base64,${(await sharp(path).png().toBuffer()).toString('base64')}`;

async function generate(task: Task, apiKey: string): Promise<number> {
  const images = [
    await dataUrl(join(ROOT, 'art/raw', task.format)),
    await dataUrl(join(ROOT, 'art/reference/peuples', `${task.people}.png`)),
  ];
  for (let attempt = 1; ; attempt++) {
    const response = await fetch('https://openrouter.ai/api/v1/images', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Alkebulan art pipeline',
      },
      body: JSON.stringify({
        model: MODEL,
        prompt: task.prompt,
        n: 1,
        aspect_ratio: '1:1',
        quality: 'high',
        output_format: 'png',
        input_references: images.map((url) => ({ type: 'image_url', image_url: { url } })),
      }),
      signal: AbortSignal.timeout(500_000),
    });
    const text = await response.text();
    if (response.ok) {
      const body = JSON.parse(text) as {
        data?: { b64_json?: string }[];
        usage?: { cost?: number };
      };
      const b64 = body.data?.[0]?.b64_json;
      if (!b64) throw new Error(`${task.people}/${task.unit} : réponse sans image`);
      await mkdir(dirname(task.out), { recursive: true });
      await writeFile(task.out, Buffer.from(b64, 'base64'));
      return body.usage?.cost ?? ESTIMATE_USD;
    }
    if ((response.status !== 429 && response.status < 500) || attempt >= 4) {
      throw new Error(`${task.people}/${task.unit} : OpenRouter ${response.status} ${text}`);
    }
    await new Promise((done) => setTimeout(done, 5_000 * attempt));
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((arg) => arg !== '--'),
    options: {
      unite: { type: 'string' },
      peuple: { type: 'string' },
      refaire: { type: 'boolean', default: false },
      liste: { type: 'boolean', default: false },
      budget: { type: 'string', default: '8' },
      paralleles: { type: 'string', default: '4' },
    },
  });
  await loadEnv();
  const catalog = JSON.parse(
    await readFile(join(ROOT, 'art/specs/sprites-peuples.json'), 'utf8'),
  ) as Catalog;
  const wanted = (value: string | undefined) =>
    new Set(
      (value ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    );
  const units = wanted(values.unite);
  const peoples = wanted(values.peuple);

  const tasks: Task[] = [];
  for (const [unit, spec] of Object.entries(catalog.unites)) {
    if (units.size > 0 && !units.has(unit)) continue;
    for (const [people, description] of Object.entries(spec.peuples)) {
      if (peoples.size > 0 && !peoples.has(people)) continue;
      const out = join(ROOT, 'art/raw/sprites-unités/peuples', people, basename(spec.format));
      if (!values.refaire && existsSync(out)) continue;
      tasks.push({
        unit,
        people,
        format: spec.format,
        prompt: `${catalog.style}\n\n${description}`,
        out,
      });
    }
  }
  const budget = Number(values.budget);
  console.log(
    `[sprites] ${tasks.length} planche(s), ~${(tasks.length * ESTIMATE_USD).toFixed(2)} $ prévus, budget ${budget.toFixed(2)} $`,
  );
  if (values.liste) {
    for (const task of tasks) console.log(`  ${task.people}/${task.unit}`);
    return;
  }
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Clé absente : ajoute OPENROUTER_API_KEY=sk-or-... dans .env.');

  let spent = 0;
  let reserved = 0;
  const queue = [...tasks];
  const failures: string[] = [];
  const worker = async () => {
    for (let task = queue.shift(); task; task = queue.shift()) {
      if (spent + reserved + ESTIMATE_USD > budget) {
        console.warn(`[sprites] budget atteint : ${task.people}/${task.unit} non générée`);
        continue;
      }
      reserved += ESTIMATE_USD;
      const started = Date.now();
      try {
        const cost = await generate(task, apiKey);
        spent += cost;
        console.log(
          `[sprites] ${task.people}/${task.unit} : ${cost.toFixed(3)} $, ${Math.round((Date.now() - started) / 1000)} s`,
        );
      } catch (error) {
        failures.push((error as Error).message);
        console.error(`[sprites] ${(error as Error).message}`);
      } finally {
        reserved -= ESTIMATE_USD;
      }
    }
  };
  const parallel = Math.max(1, Number(values.paralleles) || 1);
  await Promise.all(Array.from({ length: parallel }, worker));
  console.log(`[sprites] terminé : ${spent.toFixed(2)} $ dépensés, ${failures.length} échec(s).`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`[sprites] ${(error as Error).message}`);
  process.exit(1);
});
