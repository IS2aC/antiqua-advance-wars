/**
 * Journal de génération (`generation.json`) et page de validation (`validation.html`), dans
 * le dossier des combats dessinés. Fonctions pures pour la page.
 */
import type { Job } from './prompts';

export type EntryStatus = 'ok' | 'a-revoir' | 'bloque';

export interface JournalEntry {
  readonly statut: EntryStatus;
  readonly essais: number;
  readonly coutUsd: number;
  readonly problemes: readonly string[];
  readonly notes: readonly string[];
  readonly generateur: string;
  readonly date: string;
}

export interface Journal {
  /** Dépense cumulée de toutes les générations, en dollars. */
  totalUsd: number;
  images: Record<string, JournalEntry>;
}

export const emptyJournal = (): Journal => ({ totalUsd: 0, images: {} });

const escape = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  );

const LABELS: Readonly<Record<EntryStatus, string>> = {
  ok: 'contrôles OK',
  'a-revoir': 'à revoir',
  bloque: 'bloqué',
};

/**
 * Page de validation : chaque image avec son état, ses contrôles, son coût, son prompt, et la
 * commande pour la refaire. `present` : images présentes sur le disque (sans extension).
 */
export function validationPage(
  jobs: readonly Job[],
  journal: Journal,
  present: ReadonlySet<string>,
  version: string,
): string {
  const cards = jobs.map((job) => {
    const entry = journal.images[job.id];
    const exists = present.has(job.id);
    const status = entry?.statut ?? (exists ? 'ok' : null);
    const label = status ? LABELS[status] : 'à générer';
    const origin = entry
      ? `${entry.generateur}, ${entry.date.slice(0, 16).replace('T', ' ')}`
      : exists
        ? 'déposée à la main'
        : '';
    const flag =
      job.kind === 'unit'
        ? `--unite ${job.unit} --planche ${job.sheet}`
        : job.kind === 'portrait'
          ? `--portraits --peuple ${job.people}`
          : `--decors --decor ${job.id.split('/')[1]}`;
    const list = (items: readonly string[] | undefined, cls: string) =>
      items && items.length > 0
        ? `<ul class="${cls}">${items.map((i) => `<li>${escape(i)}</li>`).join('')}</ul>`
        : '';
    return `<article class="carte ${status ?? 'manque'}">
  <h3>${escape(job.id)} <span class="etat">${label}</span></h3>
  ${exists ? `<a href="${job.id}.png?v=${version}" target="_blank"><img loading="lazy" src="${job.id}.png?v=${version}" alt="${escape(job.id)}"></a>` : '<div class="vide">pas encore d’image</div>'}
  <p class="meta">${escape(origin)}${entry ? ` · ${entry.essais} essai(s) · ${entry.coutUsd.toFixed(3)} $` : ''}</p>
  ${list(entry?.problemes, 'problemes')}${list(entry?.notes, 'notes')}
  <details><summary>Prompt</summary><pre>${escape(job.prompt)}</pre></details>
  <code>pnpm art:generer ${flag} --refaire</code>
</article>`;
  });
  const done = jobs.filter((job) => present.has(job.id)).length;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Validation des dessins</title>
<style>
:root { color-scheme: light dark; --fond: #f6f1e7; --carte: #fff; --texte: #2b1b17; --doux: #7a6a5a; --ok: #2e8a4e; --revoir: #c47a12; --ko: #b3261e; }
@media (prefers-color-scheme: dark) { :root { --fond: #1a1410; --carte: #2b211b; --texte: #f3e6c4; --doux: #b8a888; } }
body { margin: 0; padding: 16px; background: var(--fond); color: var(--texte); font: 14px/1.45 system-ui, sans-serif; }
h1 { margin: 0 0 4px; font-size: 20px; } .resume { color: var(--doux); margin: 0 0 16px; }
.grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); gap: 14px; }
.carte { background: var(--carte); border-radius: 10px; padding: 12px; border-left: 5px solid var(--doux); min-width: 0; }
.carte.ok { border-left-color: var(--ok); } .carte.a-revoir { border-left-color: var(--revoir); } .carte.bloque { border-left-color: var(--ko); }
h3 { margin: 0 0 8px; font-size: 14px; display: flex; justify-content: space-between; gap: 8px; }
.etat { font-weight: 600; color: var(--doux); } .ok .etat { color: var(--ok); } .a-revoir .etat { color: var(--revoir); } .bloque .etat { color: var(--ko); }
img { width: 100%; background: #fff; border-radius: 6px; display: block; }
.vide { height: 120px; display: grid; place-items: center; color: var(--doux); border: 1px dashed var(--doux); border-radius: 6px; }
.meta { color: var(--doux); margin: 6px 0; font-size: 12px; }
ul { margin: 4px 0; padding-left: 18px; } .problemes { color: var(--ko); } .notes { color: var(--doux); }
pre { white-space: pre-wrap; font-size: 11px; max-height: 260px; overflow: auto; }
code { display: block; font-size: 11px; color: var(--doux); overflow-wrap: anywhere; margin-top: 6px; }
</style></head><body>
<h1>Validation des dessins de combat</h1>
<p class="resume">${done} / ${jobs.length} images · dépense cumulée ${journal.totalUsd.toFixed(2)} $ · les unités sont en rouge ici, recolorées pour chaque peuple par <code style="display:inline">pnpm assets:dessin</code> (banc d’essai « Animation (proto) » pour les voir animées).</p>
<div class="grille">
${cards.join('\n')}
</div>
</body></html>
`;
}
