/**
 * Générateurs d'images : OpenRouter (qui revend les modèles d'OpenAI, de Google…), l'API
 * d'images d'OpenAI en direct, et un faux générateur (dessins schématiques
 * faits localement, gratuit) pour essayer toute la chaîne sans clé ni dépense.
 */
import sharp from 'sharp';
import type { Job } from './prompts';
import { IMAGE_SIZE } from './prompts';

export interface Reference {
  readonly name: string;
  readonly data: Buffer;
}

export interface Generated {
  readonly png: Buffer;
  /** Coût réel (d'après les jetons facturés), en dollars ; 0 pour le faux générateur. */
  readonly costUsd: number;
}

export interface ImageProvider {
  readonly name: string;
  /** Coût prévu d'une image, pour ne jamais dépasser le budget. */
  readonly estimateUsd: number;
  generate(job: Job, references: readonly Reference[]): Promise<Generated>;
}

/** Prix par million de jetons, en dollars. */
export interface Rates {
  readonly textInput: number;
  readonly imageInput: number;
  readonly imageOutput: number;
}

/** Tarifs publiés pour GPT Image (à ajuster par `OPENAI_IMAGE_PRIX` si OpenAI les change). */
export const DEFAULT_RATES: Rates = { textInput: 5, imageInput: 8, imageOutput: 30 };

export interface Usage {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly input_tokens_details?: { readonly text_tokens?: number; readonly image_tokens?: number };
}

/** Coût d'un appel d'après les jetons consommés que renvoie l'API. */
export function costFromUsage(usage: Usage, rates: Rates): number {
  const imageIn = usage.input_tokens_details?.image_tokens ?? 0;
  const textIn = usage.input_tokens_details?.text_tokens ?? (usage.input_tokens ?? 0) - imageIn;
  const out = usage.output_tokens ?? 0;
  return (textIn * rates.textInput + imageIn * rates.imageInput + out * rates.imageOutput) / 1e6;
}

/** « 5,8,30 » → tarifs ; valeur absente ou invalide → tarifs par défaut. */
export function parseRates(value: string | undefined): Rates {
  const parts = (value ?? '').split(',').map((part) => Number(part.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) return DEFAULT_RATES;
  const [textInput, imageInput, imageOutput] = parts as [number, number, number];
  return { textInput, imageInput, imageOutput };
}

export interface OpenAiOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly quality: string;
  readonly rates: Rates;
  readonly estimateUsd: number;
}

const API = 'https://api.openai.com/v1/images';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function openAiProvider(options: OpenAiOptions): ImageProvider {
  const call = async (job: Job, references: readonly Reference[]): Promise<Response> => {
    const headers = { Authorization: `Bearer ${options.apiKey}` };
    if (references.length === 0) {
      return fetch(`${API}/generations`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model,
          prompt: job.prompt,
          size: IMAGE_SIZE,
          quality: options.quality,
          n: 1,
        }),
        signal: AbortSignal.timeout(300_000),
      });
    }
    const form = new FormData();
    form.append('model', options.model);
    form.append('prompt', job.prompt);
    form.append('size', IMAGE_SIZE);
    form.append('quality', options.quality);
    form.append('n', '1');
    for (const ref of references) {
      form.append('image[]', new Blob([new Uint8Array(ref.data)], { type: 'image/png' }), ref.name);
    }
    return fetch(`${API}/edits`, {
      method: 'POST',
      headers,
      body: form,
      signal: AbortSignal.timeout(300_000),
    });
  };

  return {
    name: `OpenAI ${options.model} (${options.quality})`,
    estimateUsd: options.estimateUsd,
    async generate(job, references) {
      // Trop de demandes ou panne passagère : on attend et on réessaie (sans payer deux fois).
      for (let attempt = 1; ; attempt++) {
        const response = await call(job, references);
        if (response.ok) {
          const body = (await response.json()) as {
            data?: { b64_json?: string }[];
            usage?: Usage;
          };
          const b64 = body.data?.[0]?.b64_json;
          if (!b64) throw new Error("Réponse d'OpenAI sans image.");
          const costUsd = body.usage
            ? costFromUsage(body.usage, options.rates)
            : options.estimateUsd;
          return { png: Buffer.from(b64, 'base64'), costUsd };
        }
        const text = await response.text();
        const retry = response.status === 429 || response.status >= 500;
        if (!retry || attempt >= 4) {
          let message = text;
          try {
            message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
          } catch {
            // Réponse non JSON : on garde le texte brut.
          }
          throw new Error(`OpenAI ${response.status} : ${message}`);
        }
        await sleep(5_000 * attempt);
      }
    },
  };
}

// ——— OpenRouter ———

export interface OpenRouterOptions {
  readonly apiKey: string;
  /** Identifiant OpenRouter, par exemple `openai/gpt-image-2`. */
  readonly model: string;
  readonly quality: string;
  readonly estimateUsd: number;
}

/** Corps de la requête OpenRouter (`POST /api/v1/images`). Pur, testé. */
export function openRouterBody(
  options: Pick<OpenRouterOptions, 'model' | 'quality'>,
  job: Job,
  references: readonly Reference[],
): Record<string, unknown> {
  const openai = options.model.startsWith('openai/');
  return {
    model: options.model,
    prompt: job.prompt,
    n: 1,
    // 1536×1024 : le format de toutes les planches.
    aspect_ratio: '3:2',
    // `quality` et `output_format` n'existent que chez certains modèles (ceux d'OpenAI).
    ...(openai ? { quality: options.quality, output_format: 'png' } : {}),
    ...(references.length > 0
      ? {
          input_references: references.map((ref) => ({
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${ref.data.toString('base64')}` },
          })),
        }
      : {}),
  };
}

/** Échecs de connexion : la requête n'est pas partie, donc rien n'est facturé. */
const CONNECT_ERRORS = new Set([
  'UND_ERR_CONNECT_TIMEOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
]);

/**
 * `fetch` qui réessaie (5 fois, 2 s d'écart) quand la connexion ne s'établit pas : filet de
 * sécurité pour un réseau capricieux (voir aussi `network.ts`).
 */
export async function fetchConnecting(
  url: string,
  init: RequestInit,
  tries = 5,
  wait = 2000,
): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      const code = (error as { cause?: { code?: string } }).cause?.code;
      if (attempt >= tries || !code || !CONNECT_ERRORS.has(code)) throw error;
      console.warn(`[art] connexion impossible (${code}), nouvel essai ${attempt + 1}/${tries}…`);
      await new Promise((done) => setTimeout(done, wait));
    }
  }
}

export function openRouterProvider(options: OpenRouterOptions): ImageProvider {
  return {
    name: `OpenRouter ${options.model}${options.model.startsWith('openai/') ? ` (${options.quality})` : ''}`,
    estimateUsd: options.estimateUsd,
    async generate(job, references) {
      for (let attempt = 1; ; attempt++) {
        const response = await fetchConnecting('https://openrouter.ai/api/v1/images', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
            'X-Title': 'Alkebulan art pipeline',
          },
          body: JSON.stringify(openRouterBody(options, job, references)),
          signal: AbortSignal.timeout(300_000),
        });
        if (response.ok) {
          const body = (await response.json()) as {
            data?: { b64_json?: string }[];
            usage?: { cost?: number };
          };
          const b64 = body.data?.[0]?.b64_json;
          if (!b64) throw new Error("Réponse d'OpenRouter sans image.");
          // Les générations ratées (502) ne sont pas facturées ; `usage.cost` = montant débité.
          const costUsd =
            typeof body.usage?.cost === 'number' ? body.usage.cost : options.estimateUsd;
          return { png: await sharp(Buffer.from(b64, 'base64')).png().toBuffer(), costUsd };
        }
        const text = await response.text();
        const retry = response.status === 429 || response.status >= 500;
        if (!retry || attempt >= 4) {
          let message = text;
          try {
            message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
          } catch {
            // Réponse non JSON : on garde le texte brut.
          }
          const hint =
            response.status === 402
              ? ' (crédits OpenRouter insuffisants : recharger le compte)'
              : '';
          throw new Error(`OpenRouter ${response.status} : ${message}${hint}`);
        }
        await sleep(5_000 * attempt);
      }
    },
  };
}

// ——— Faux générateur ———

const TEAM = '#D13A2E';
const SKIN = '#C65922';
const INK = '#2B1B17';
const CREAM = '#EFD6A8';

/** Un soldat schématique, pieds sur `base`, dessiné dans une case de 384 px. */
function figure(cx: number, base: number, height: number, lean: number): string {
  const head = height * 0.12;
  const top = base - height;
  return `<g stroke="${INK}" stroke-width="6" transform="rotate(${lean} ${cx} ${base})">
    <rect x="${cx - 30}" y="${base - height * 0.32}" width="22" height="${height * 0.32}" fill="${SKIN}"/>
    <rect x="${cx + 8}" y="${base - height * 0.32}" width="22" height="${height * 0.32}" fill="${SKIN}"/>
    <rect x="${cx - 50}" y="${top + head * 2}" width="100" height="${height * 0.5}" rx="20" fill="${TEAM}"/>
    <rect x="${cx - 48}" y="${base - height * 0.36}" width="96" height="16" fill="${CREAM}"/>
    <circle cx="${cx}" cy="${top + head}" r="${head}" fill="${SKIN}"/>
    <rect x="${cx - head}" y="${top + head * 0.4}" width="${head * 2}" height="14" fill="${TEAM}"/>
    <line x1="${cx + 70}" y1="${top}" x2="${cx + 70}" y2="${base}" stroke-width="10"/>
  </g>`;
}

function fakeSvg(job: Job): string {
  const [w, h] = IMAGE_SIZE.split('x').map(Number) as [number, number];
  let body: string;
  if (job.kind === 'decor') {
    body = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#6fb2e8"/><stop offset="1" stop-color="#f6dfae"/></linearGradient></defs>
      <rect width="${w}" height="${h}" fill="url(#sky)"/>
      <rect y="${h * 0.62}" width="${w}" height="${h * 0.38}" fill="#d9b45a"/>`;
  } else if (job.kind === 'portrait') {
    body = [0, 1, 2, 3]
      .map((i) => {
        const cx = (i + 0.5) * (w / 4);
        return `<g stroke="${INK}" stroke-width="6">
          <ellipse cx="${cx}" cy="${h * 0.7}" rx="150" ry="110" fill="${TEAM}"/>
          <circle cx="${cx}" cy="${h * 0.42}" r="110" fill="${SKIN}"/></g>`;
      })
      .join('');
  } else {
    const cell = w / 4;
    const base = h * 0.82;
    body = [0, 1, 2, 3]
      .map((i) => {
        const sitting = (job.sheet === 'sonne' && i > 0) || (job.sheet === 'chute' && i === 1);
        return figure((i + 0.45) * cell, base, sitting ? 330 : 560, i % 2 === 0 ? 0 : 6);
      })
      .join('');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="#ffffff"/>${body}</svg>`;
}

/** Faux générateur : dessins schématiques qui passent les contrôles, sans appel réseau. */
export const fakeProvider: ImageProvider = {
  name: 'faux générateur (local, gratuit)',
  estimateUsd: 0,
  async generate(job) {
    const png = await sharp(Buffer.from(fakeSvg(job)))
      .png()
      .toBuffer();
    return { png, costUsd: 0 };
  },
};
