/** Rapport HTML de contrôle : accepter un sprite, ou le régénérer. */

export interface ReportImage {
  readonly label: string;
  readonly png: Buffer;
}

export interface ReportData {
  readonly palette: readonly { hex: string; role: string }[];
  readonly paletteCreated: boolean;
  readonly units: readonly {
    type: string;
    red: readonly ReportImage[];
    blue: readonly ReportImage[];
  }[];
  readonly idleOnTerrain: {
    readonly units: readonly ReportImage[];
    readonly terrains: readonly ReportImage[];
  };
  readonly terrain: readonly ReportImage[];
  readonly seams: readonly ReportImage[];
  readonly buildings: readonly ReportImage[];
  readonly autotiles: readonly {
    kind: string;
    found: readonly string[];
    missing: readonly string[];
  }[];
  readonly warnings: readonly string[];
  readonly info: readonly string[];
}

const uri = (image: ReportImage) => `data:image/png;base64,${image.png.toString('base64')}`;
const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function sprite(image: ReportImage, zoom: number, extra = ''): string {
  return `<img src="${uri(image)}" class="z${zoom}" alt="${escape(image.label)}" title="${escape(image.label)}" ${extra}>`;
}

function figure(image: ReportImage): string {
  return `<figure class="checker">${sprite(image, 1)}${sprite(image, 2)}<figcaption>${escape(image.label.split('/').slice(2).join('/') || image.label)}</figcaption></figure>`;
}

export function renderReport(data: ReportData): string {
  const units = data.units
    .map(
      (unit) => `<h3>${escape(unit.type)}</h3>
<div class="row">${unit.red.map(figure).join('')}</div>
<div class="row">${unit.blue.map(figure).join('')}</div>`,
    )
    .join('');

  const onTerrain = data.idleOnTerrain.units
    .map(
      (unit) =>
        `<div class="row">${data.idleOnTerrain.terrains
          .map(
            (terrain) =>
              `<div class="tile" style="background-image:url(${uri(terrain)})" title="${escape(terrain.label)}">${sprite(unit, 2)}</div>`,
          )
          .join('')}</div>`,
    )
    .join('');

  const seams = data.seams
    .map(
      (tile) =>
        `<figure><div class="seam" style="background-image:url(${uri(tile)})"></div><figcaption>${escape(tile.label)}</figcaption></figure>`,
    )
    .join('');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ANTIQUA — rapport d'assets</title>
<style>
  :root { color-scheme: dark; --bg: #1a1410; --panel: #2a201a; --text: #fff4c8; --muted: #b8a888; --warn: #ffb35a; }
  body { margin: 0; padding: 16px; background: var(--bg); color: var(--text); font: 14px/1.5 system-ui, sans-serif; }
  h1, h2, h3 { font-weight: 600; } h2 { margin-top: 32px; border-bottom: 1px solid #4a3a2a; }
  img { image-rendering: pixelated; display: block; }
  .z1 { zoom: 1; } .z2 { width: calc(var(--w, 32px) * 2); height: auto; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  figure.checker { flex-direction: row; align-items: flex-end; padding: 6px; background: conic-gradient(#3a3a3a 25%, #2a2a2a 0 50%, #3a3a3a 0 75%, #2a2a2a 0) 0 0 / 8px 8px; border-radius: 4px; }
  figcaption { font-size: 11px; color: var(--muted); writing-mode: horizontal-tb; }
  figure.checker figcaption { display: none; }
  .tile { width: 64px; height: 64px; background-size: 64px 64px; image-rendering: pixelated; }
  .tile img { width: 64px; height: 64px; }
  .seam { width: 256px; height: 256px; background-size: 64px 64px; image-rendering: pixelated; }
  .swatch { width: 28px; height: 28px; border-radius: 3px; border: 1px solid #0006; }
  .warn li { color: var(--warn); }
  code { color: var(--muted); }
</style>
</head>
<body>
<h1>Rapport d'assets</h1>
<p>Chaque sprite à ×1 et ×2 sur damier. Un sprite raté se régénère (art/raw) ou se corrige dans <code>art/clean/&lt;nom de frame&gt;.png</code>, prioritaire sur la sortie automatique.</p>

<h2>Avertissements (${data.warnings.length})</h2>
<ul class="warn">${data.warnings.map((w) => `<li>${escape(w)}</li>`).join('') || '<li style="color:var(--muted)">Aucun.</li>'}</ul>
<ul>${data.info.map((line) => `<li>${escape(line)}</li>`).join('')}</ul>

<h2>Palette antiqua-32 ${data.paletteCreated ? '(créée par ce build)' : '(figée, art/palette/antiqua-32.png)'}</h2>
<div class="row">${data.palette.map((c) => `<div class="swatch" style="background:${c.hex}" title="${c.hex} ${escape(c.role)}"></div>`).join('')}</div>

<h2>Unités (Carthage puis Koush)</h2>
${units}

<h2>Unités sur chaque terrain (×2)</h2>
${onTerrain}

<h2>Bâtiments</h2>
<div class="row">${data.buildings.map((b) => `<figure class="checker" style="--w:32px">${sprite(b, 1)}${sprite(b, 2)}</figure>`).join('')}</div>
<div class="row">${data.buildings.map((b) => `<figcaption style="width:${32 * 3 + 12}px">${escape(b.label)}</figcaption>`).join('')}</div>

<h2>Raccords des tuiles (4×4, ×2)</h2>
<div class="row">${seams}</div>

<h2>Autotiling</h2>
<ul>${data.autotiles.map((a) => `<li><b>${escape(a.kind)}</b> : ${a.found.length} pièces (${escape(a.found.join(' '))})${a.missing.length ? ` — manquantes : ${escape(a.missing.join(' '))}` : ''}</li>`).join('')}</ul>

<h2>Toutes les tuiles</h2>
<div class="row">${data.terrain.map((t) => `<figure>${sprite(t, 2)}<figcaption>${escape(t.label.replace('terrain/', ''))}</figcaption></figure>`).join('')}</div>
</body>
</html>
`;
}
