import { renderFolderCover } from "./cover.ts";
import { escape as e, validateOptions } from "./validate.ts";
import type {
  DossierOptions,
  FolderRecord,
  ContentBlock,
  RecordText,
} from "./types.ts";
export { validateOptions, parseConfig, stringifyConfig } from "./validate.ts";
export type * from "./types.ts";
const text = (v: RecordText): string =>
  typeof v === "string"
    ? e(v)
    : v
        .map((p) =>
          typeof p === "string"
            ? e(p)
            : "strong" in p
              ? `<strong>${e(p.strong)}</strong>`
              : `<a href="${e(p.href)}" target="_blank" rel="noopener noreferrer">${e(p.label)}<span class="sr-only"> (opens in a new tab)</span></a>`,
        )
        .join("");
function block(b: ContentBlock, id: string): string {
  if (b.kind === "text")
    return `<section class="record-section">${b.heading ? `<h3 class="record-section-title">${e(b.heading)}</h3>` : ""}${(b.paragraphs ?? []).map((p) => `<p>${text(p)}</p>`).join("")}${b.bullets?.length ? `<ul class="record-highlights">${b.bullets.map((p) => `<li>${text(p)}</li>`).join("")}</ul>` : ""}</section>`;
  if (b.kind === "timeline")
    return `<section class="record-progression"><h3 class="record-section-title">${e(b.heading ?? "Milestones")}</h3><ol class="record-timeline">${b.entries.map((t) => `<li class="record-timeline-entry"${t.current ? " data-current" : ""}><p class="record-timeline-dates">${e(t.dates)}</p><h4>${e(t.title)}</h4><p>${e(t.body)}</p></li>`).join("")}</ol></section>`;
  let inside = "";
  const size = b.kind === "gallery" ? b.images[0] : b;
  if (b.kind === "image")
    inside = `<img src="${e(b.src)}" alt="${e(b.alt)}" width="${b.width}" height="${b.height}" loading="lazy" decoding="async">`;
  if (b.kind === "video")
    inside = `<video data-record-video data-video-src="${e(b.src)}" poster="${e(b.poster)}" width="${b.width}" height="${b.height}" preload="none" muted playsinline loop controls aria-label="${e(b.label)}"></video>`;
  if (b.kind === "gallery")
    inside = b.images
      .map(
        (im, i) =>
          `<img data-gallery-image${i ? ' hidden aria-hidden="true"' : " data-active"} src="${e(im.src)}" alt="${e(im.alt)}" width="${im.width}" height="${im.height}" loading="lazy" decoding="async">`,
      )
      .join("");
  return `<figure class="record-media record-${b.kind}${b.frame === "phone" ? "" : " record-media--unframed"}" ${b.kind === "gallery" ? "data-record-gallery " : ""}data-autoplay="${b.kind !== "image" && b.autoplay !== false}" aria-labelledby="${id}-caption"><div class="record-phone"><div id="${id}-screen" class="record-phone-screen ${b.kind === "gallery" ? "record-gallery-screen" : ""}" style="aspect-ratio:${size.width}/${size.height}">${inside}</div></div>${b.kind === "gallery" ? `<div class="record-gallery-controls" role="group" aria-label="Browse ${e(b.label)}"><button type="button" data-gallery-prev aria-label="Previous image" aria-controls="${id}-screen" disabled>←</button><button type="button" data-gallery-toggle aria-pressed="false"${b.images.length < 2 ? " disabled" : ""}>Resume slideshow</button><button type="button" data-gallery-next aria-label="Next image" aria-controls="${id}-screen"${b.images.length < 2 ? " disabled" : ""}>→</button></div><p class="sr-only" data-gallery-status aria-live="polite"></p>` : ""}<p class="record-media-status" data-video-status role="status" hidden></p><figcaption id="${id}-caption" class="record-media-caption">${e(b.caption)}</figcaption>${b.action ? `<a class="record-action" href="${e(b.action.href)}" target="_blank" rel="noopener noreferrer">${e(b.action.label)}<span class="sr-only"> (opens in a new tab)</span></a>` : ""}</figure>`;
}
function content(r: FolderRecord, id: string): string {
  const featured =
    r.contentLayout === "featured"
      ? r.blocks.findIndex((b) => "featured" in b && b.featured)
      : -1;
  const intro = `${r.headline ? `<h2 class="record-headline">${e(r.headline)}</h2>` : ""}${r.summary ? `<p class="record-summary">${e(r.summary)}</p>` : ""}${r.chips?.length ? `<ul class="record-chips" aria-label="Topics">${r.chips.map((c) => `<li>${e(c)}</li>`).join("")}</ul>` : ""}`;
  // A featured block is explicitly placed beside the introduction; every other block keeps its declared order.
  const before =
    featured >= 0
      ? r.blocks
          .slice(0, featured)
          .map((b, i) => block(b, `${id}-b${i}`))
          .join("")
      : "";
  const rest = r.blocks
    .map((b, i) =>
      featured >= 0 && i <= featured ? "" : block(b, `${id}-b${i}`),
    )
    .join("");
  return `<header class="record-header"><div class="record-identity"><p class="record-company" id="${id}-title">${e(r.title)}</p>${r.subtitle ? `<p class="record-role">${e(r.subtitle)}</p>` : ""}</div>${r.dates ? `<p class="record-dates">${e(r.dates)}</p>` : ""}</header><div class="record-scroll-frame"><div class="record-scroll" tabindex="0" role="region" aria-label="${e(r.title)} details">${featured >= 0 ? `<div class="record-layout record-layout--media"><div class="record-story">${intro}${before}</div>${block(r.blocks[featured], `${id}-b${featured}`)}</div>${rest}` : `<div class="record-story">${intro}${rest}</div>`}</div></div>`;
}
/** Stable instanceId must be unique within the host document, including server rendering. */
export function renderDossierFoldersMarkup(
  options: DossierOptions,
  { instanceId }: { instanceId: string },
): string {
  validateOptions(options, true);
  if (!/^[a-zA-Z][\w-]*$/.test(instanceId))
    throw new TypeError(
      "instanceId: use letters, digits, underscores or hyphens",
    );
  const o = options,
    records = o.records;
  if (!records.length)
    return `<p class="dossier-empty">${e(o.labels?.empty ?? "No records yet.")}</p>`;
  return `<div class="scene-home"><div class="cabinet-scene">${records
    .map((r, i) => {
      const id = `${instanceId}-${r.id}`,
        logo = r.tab.logo;
      return `<article class="folder" data-folder="${e(r.id)}" style="--folder-color:${r.fill};--folder-ink:${r.ink};z-index:${records.length - i}"><div class="folder-sizing"><div class="folder-back-shadow" aria-hidden="true"></div><svg class="folder-silhouette" aria-hidden="true" preserveAspectRatio="none"><defs><clipPath id="${id}-rounding"><path class="folder-outline-clip" /></clipPath></defs><path class="folder-shape" clip-path="url(#${id}-rounding)" /></svg><div class="folder-content">${content(r, id)}</div><div class="folder-opening-shadow" aria-hidden="true"></div><div class="folder-crease" aria-hidden="true"></div>${renderFolderCover(id)}<div class="folder-tab-viewport" data-tab-rail><div class="folder-tab-track"><button class="folder-tab" type="button" data-company="${e(r.id)}" aria-label="${e(o.labels?.open ?? "Open")} ${e(r.title)}" aria-haspopup="dialog">${r.tab.mode !== "text" && logo ? `<img src="${e(logo.src)}" width="${logo.width}" height="${logo.height}" alt="" draggable="false" style="--logo-width:${logo.width}px;--logo-height:${logo.height}px">` : ""}${r.tab.mode !== "logo" ? `<span>${e(r.tab.label ?? r.title)}</span>` : ""}</button></div></div></div></article>`;
    })
    .join(
      "",
    )}<div class="cabinet-front" aria-hidden="true" style="z-index:${records.length + 1};--cabinet-color:${o.cabinet?.color ?? "#152238"}"><div class="cabinet-material"></div><div class="cabinet-stamp" style="color:${o.cabinet?.stampColor ?? "#8192ad"}">${e(
    o.cabinet?.label ?? "Dossier\nFolders",
  )
    .split("\n")
    .map((s) => `<span>${s}</span>`)
    .join(
      "",
    )}</div></div></div></div>${o.showHint !== false ? `<p class="cabinet-hint">${e(o.labels?.hint ?? "Select a tab. Open a story.")}</p>` : ""}<dialog data-dossier-dialog tabindex="-1" aria-label="${e(o.labels?.dialog ?? "Record details")}"><div class="dialog-scene-slot"></div><button class="record-close" data-record-close type="button" hidden>${e(o.labels?.close ?? "Close")}</button></dialog>`;
}
