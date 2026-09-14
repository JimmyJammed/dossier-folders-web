import { mapAssets, safeArchivePath } from "./portable.ts";
import "../src/styles.css";
import "./style.css";
import {
  createDossierFolders,
  validateOptions,
  parseConfig,
  stringifyConfig,
} from "../src/index.ts";
import { escape as e, isColor } from "../src/validate.ts";
import type {
  DossierConfig,
  ContentBlock,
  FolderRecord,
} from "../src/types.ts";
import { makeConfig, preset } from "./fixtures.ts";
import { zipSync, strToU8 } from "fflate";
const base = import.meta.env.BASE_URL;
let config = makeConfig(base),
  selected = 0,
  language = "vanilla",
  activePreset = "showcase",
  rendering = false,
  newBlockKind = "text",
  pendingField: HTMLInputElement | undefined,
  timer: ReturnType<typeof setTimeout> | undefined;
const root = document.querySelector<HTMLElement>("#preview")!,
  controls = document.querySelector<HTMLElement>("#controls")!,
  status = document.querySelector<HTMLElement>("#editor-status")!;
const api = createDossierFolders(root, config.options);
const uploads = new Map<string, { file: File; path: string }>();
let uploadSerial = 0;
const clone = <T>(o: T): T => structuredClone(o);
const message = (s: string) => {
  status.textContent = s;
};
const get = (o: any, path: string): any =>
  path.split(".").reduce((v, k) => v?.[k], o);
function set(o: any, path: string, value: any) {
  const keys = path.split("."),
    last = keys.pop()!;
  let t = o;
  for (const key of keys)
    t = t[key] ??= /^\d+$/.test(keys[keys.indexOf(key) + 1] ?? "") ? [] : {};
  t[last] = value;
}
const input = (
  label: string,
  path: string,
  value: any,
  type = "text",
  extra = "",
) =>
  `<label class="field">${e(label)}<input data-path="${path}" type="${type}" ${type === "checkbox" ? (value ? "checked" : "") : `value="${e(String(value ?? ""))}"`} ${extra}></label>`;
const area = (label: string, path: string, value: any, format = "text") =>
  `<label class="field">${e(label)}<textarea data-path="${path}" data-format="${format}">${e(format === "json" ? JSON.stringify(value ?? [], null, 2) : format === "lines" ? (value ?? []).join("\n") : String(value ?? ""))}</textarea>${format === "json" ? '<small>Structured JSON: strings, {"strong":"text"}, or {"label":"text","href":"https://…"}.</small>' : ""}</label>`;
const select = (label: string, path: string, value: any, items: string[]) =>
  `<label class="field">${e(label)}<select data-path="${path}">${items.map((i) => `<option${i === value ? " selected" : ""}>${e(i)}</option>`).join("")}</select></label>`;
const upload = (label: string, path: string, value: string, accept: string) =>
  `${input(label, path, value)}<label class="field">Or choose a local file<input class="asset-file" type="file" data-asset="${path}" accept="${accept}"></label>`;
const details = (title: string, html: string, open = false) =>
  `<details${open ? " open" : ""}><summary>${title}</summary><div class="fields">${html}</div></details>`;
function mediaFields(b: any, p: string) {
  return `${area("Caption", `${p}.caption`, b.caption)}${select("Frame", `${p}.frame`, b.frame ?? "none", ["none", "phone"])}${input("Featured beside introduction", `${p}.featured`, b.featured, "checkbox")}${input("Action label", `${p}.action.label`, b.action?.label ?? "")}${input("Action URL", `${p}.action.href`, b.action?.href ?? "")}`;
}
function blockFields(b: ContentBlock, i: number) {
  const p = `options.records.${selected}.blocks.${i}`;
  let html = "";
  if (b.kind === "text")
    html = `${input("Section heading", `${p}.heading`, b.heading)}${area("Paragraphs", `${p}.paragraphs`, b.paragraphs, "json")}${area("Bullet points", `${p}.bullets`, b.bullets, "json")}`;
  if (b.kind === "timeline")
    html = `${input("Timeline heading", `${p}.heading`, b.heading)}${area("Timeline entries", `${p}.entries`, b.entries, "json")}`;
  if (b.kind === "image" || b.kind === "video")
    html = `${upload(b.kind === "video" ? "Video source" : "Image source", `${p}.src`, b.src, b.kind === "video" ? "video/mp4,video/webm" : "image/*")}${b.kind === "video" ? upload("Poster", `${p}.poster`, b.poster, "image/*") : ""}${input(b.kind === "image" ? "Alternative text" : "Accessible description", `${p}.${b.kind === "image" ? "alt" : "label"}`, b.kind === "image" ? b.alt : b.label)}<div class="row">${input("Width", `${p}.width`, b.width, "number", 'min="1" max="16384"')}${input("Height", `${p}.height`, b.height, "number", 'min="1" max="16384"')}</div>${b.kind === "video" ? input("Automatic playback", `${p}.autoplay`, b.autoplay !== false, "checkbox") : ""}${mediaFields(b, p)}`;
  if (b.kind === "gallery")
    html = `${input("Gallery description", `${p}.label`, b.label)}${input("Automatic slideshow", `${p}.autoplay`, b.autoplay !== false, "checkbox")}${b.images.map((im, n) => `<div class="block-card"><h3>Image ${n + 1}</h3>${upload("Image source", `${p}.images.${n}.src`, im.src, "image/*")}${input("Alternative text", `${p}.images.${n}.alt`, im.alt)}<div class="row">${input("Width", `${p}.images.${n}.width`, im.width, "number")}${input("Height", `${p}.images.${n}.height`, im.height, "number")}</div><div class="row"><button data-action="image-up" data-block="${i}" data-image="${n}" ${n === 0 ? "disabled" : ""}>↑</button><button data-action="image-down" data-block="${i}" data-image="${n}" ${n === b.images.length - 1 ? "disabled" : ""}>↓</button><button data-action="image-remove" data-block="${i}" data-image="${n}" ${b.images.length === 1 ? "disabled" : ""}>Remove image</button></div></div>`).join("")}<button data-action="image-add" data-block="${i}">Add image</button>${mediaFields(b, p)}`;
  return `<details class="block-card" data-block-card="${i}"><summary>${i + 1}. ${b.kind}</summary><div class="fields">${html}<div class="row"><button data-action="block-up" data-block="${i}" ${i === 0 ? "disabled" : ""} aria-label="Move block ${i + 1} up">↑</button><button data-action="block-down" data-block="${i}" ${i === config.options.records[selected].blocks.length - 1 ? "disabled" : ""} aria-label="Move block ${i + 1} down">↓</button><button data-action="block-remove" data-block="${i}">Remove block</button></div></div></details>`;
}
function render() {
  const hadControls = controls.childElementCount > 0;
  const focusId = controls.contains(document.activeElement) ? document.activeElement?.id : undefined;
  const opened = [
    ...controls.querySelectorAll<HTMLDetailsElement>("details[open]"),
  ].map((d) => d.querySelector("summary")?.textContent);
  const r = config.options.records[selected],
    p = `options.records.${selected}`;
  rendering = true;
  controls.innerHTML =
    details(
      "Collection",
      `<label class="field">Preset<select id="preset"><option value="custom" disabled>Custom configuration</option><option value="showcase">Six-record showcase</option><option value="compact">Three projects</option><option value="neutral">Neutral collection</option></select></label>${area("Cabinet label", "options.cabinet.label", config.options.cabinet?.label)}<div class="row">${input("Cabinet", "options.cabinet.color", config.options.cabinet?.color, "color")}${input("Stamp", "options.cabinet.stampColor", config.options.cabinet?.stampColor, "color")}${input("Page", "background", config.background, "color")}</div>${select("Typography", "options.cabinet.font", config.options.cabinet?.font ?? "editorial", ["editorial", "modern", "mono"])}${input("Show hint", "options.showHint", config.options.showHint !== false, "checkbox")}${input("Hint text", "options.labels.hint", config.options.labels?.hint ?? "Select a tab. Open a story.")}${select("Layout", "options.layout", config.options.layout ?? "auto", ["auto", "stack"])}${select("Motion", "options.motion", config.options.motion ?? "auto", ["auto", "reduced"])}${input("Automatic media", "options.autoplay", config.options.autoplay !== false, "checkbox")}`,
      true,
    ) +
    details(
      "Folders & tabs",
      `<label class="field">Selected record<select id="record-select">${config.options.records.map((r, i) => `<option value="${i}"${i === selected ? " selected" : ""}>${i + 1}. ${e(r.title)}</option>`).join("")}</select></label><div class="row"><button data-action="record-add" ${config.options.records.length >= 12 ? "disabled" : ""}>Add</button><button data-action="record-duplicate" ${config.options.records.length >= 12 ? "disabled" : ""}>Duplicate</button><button data-action="record-remove" ${config.options.records.length <= 1 ? "disabled" : ""}>Remove</button></div><div class="row"><button data-action="record-up" ${selected === 0 ? "disabled" : ""}>Move up</button><button data-action="record-down" ${selected === config.options.records.length - 1 ? "disabled" : ""}>Move down</button></div>${input("Accessible title", `${p}.title`, r.title)}${select("Tab presentation", `${p}.tab.mode`, r.tab.mode, ["text", "logo", "both"])}${input("Tab text", `${p}.tab.label`, r.tab.label ?? r.title)}${r.tab.mode !== "text" ? `${upload("Logo source", `${p}.tab.logo.src`, r.tab.logo!.src, "image/*")}<div class="row">${input("Logo width", `${p}.tab.logo.width`, r.tab.logo!.width, "number")}${input("Logo height", `${p}.tab.logo.height`, r.tab.logo!.height, "number")}</div>` : ""}<div class="row">${input("Folder", `${p}.fill`, r.fill, "color")}${input("Ink", `${p}.ink`, r.ink, "color")}</div><p id="contrast" class="contrast"></p><div class="row"><button data-action="auto-ink">Auto ink</button><button data-action="palette">Apply palette</button></div>`,
      true,
    ) +
    details(
      "Record content",
      `${input("Subtitle", `${p}.subtitle`, r.subtitle)}${input("Dates", `${p}.dates`, r.dates)}${input("Headline", `${p}.headline`, r.headline)}${area("Summary", `${p}.summary`, r.summary)}${area("Chips — one per line", `${p}.chips`, r.chips, "lines")}${select("Content layout", `${p}.contentLayout`, r.contentLayout ?? "flow", ["flow", "featured"])}${r.blocks.map(blockFields).join("")}<label class="field">New content block<select id="new-block-kind"><option>text</option><option>timeline</option><option>image</option><option>video</option><option>gallery</option></select></label><button data-action="block-add">Add content block</button>`,
    );
  controls.querySelectorAll<HTMLDetailsElement>("details").forEach((d) => {
    if (hadControls) d.open = opened.includes(d.querySelector("summary")?.textContent);
  });
  refresh();
  if (focusId) controls.querySelector<HTMLElement>(`#${CSS.escape(focusId)}`)?.focus({preventScroll: true});
  rendering = false;
}
function luminance(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/../g)!
    .map((v) => {
      const x = parseInt(v, 16) / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function refresh() {
  (controls.querySelector("#preset") as HTMLSelectElement).value = activePreset;
  (controls.querySelector("#new-block-kind") as HTMLSelectElement).value = newBlockKind;
  const recordSelect = controls.querySelector<HTMLSelectElement>("#record-select")!;
  [...recordSelect.options].forEach((option, i) => { option.textContent = `${i + 1}. ${config.options.records[i].title}`; });
  recordSelect.value = String(selected);
  document.body.style.setProperty("--page-bg", config.background);
  document.querySelector("#record-count")!.textContent =
    `${config.options.records.length} RECORDS`;
  const r = config.options.records[selected],
    a = luminance(r.fill),
    b = luminance(r.ink),
    ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const contrast = controls.querySelector("#contrast");
  if (contrast)
    contrast.textContent = `Text contrast ${ratio.toFixed(1)}:1 · ${ratio >= 4.5 ? "Meets normal-text AA contrast" : "Choose darker or lighter ink for readable text"}`;
  const snippet =
    language === "vanilla"
      ? `import { createDossierFolders } from 'dossier-folders';\nimport 'dossier-folders/styles.css';\nimport config from './dossier.config.json';\n\nconst folders = createDossierFolders(\n  document.querySelector('#folders'),\n  config.options\n);\n\n// When the view unmounts:\nfolders.destroy();`
      : `import { DossierFolders } from 'dossier-folders/react';\nimport 'dossier-folders/styles.css';\nimport config from './dossier.config.json';\n\nexport function Collection() {\n  return <DossierFolders options={config.options} />;\n}`;
  document.querySelector("#snippet")!.textContent = snippet;
}
function releaseUnused() {
  const serialized = JSON.stringify(config);
  for (const [url] of uploads)
    if (!serialized.includes(url)) {
      URL.revokeObjectURL(url);
      uploads.delete(url);
    }
}
function apply(next: DossierConfig, repaint = false, presetName?: string) {
  validateOptions(next.options, true);
  if (!isColor(next.background))
    throw new Error("background: use a six-digit hex color");
  const changed = JSON.stringify(next) !== JSON.stringify(config);
  if (changed) api.update(next.options);
  clearTimeout(timer);
  pendingField = undefined;
  activePreset = presetName ?? (changed ? "custom" : activePreset);
  config = next;
  releaseUnused();
  message("");
  if (repaint) render();
  else refresh();
}
function readField(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
) {
  const next = clone(config),
    path = el.dataset.path!;
  let value: any = el.value;
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox") value = el.checked;
    if (el.type === "number") value = Number(value);
  }
  if (el.dataset.format === "json") value = JSON.parse(value);
  if (el.dataset.format === "lines") value = value.split("\n").filter(Boolean);
  set(next, path, value);
  // Empty action fields remove the optional action; a half-filled action remains editable until its pair is supplied.
  if (path.includes(".action.")) {
    const actionPath = path.slice(0, path.lastIndexOf("."));
    const a = get(next, actionPath);
    const label =
      controls.querySelector<HTMLInputElement>(
        `[data-path="${actionPath}.label"]`,
      )?.value ?? a.label;
    const href =
      controls.querySelector<HTMLInputElement>(
        `[data-path="${actionPath}.href"]`,
      )?.value ?? a.href;
    if (!label && !href) {
      const keys = actionPath.split(".");
      delete get(next, keys.slice(0, -1).join("."))[keys.at(-1)!];
    } else set(next, actionPath, { label, href });
  }
  if (path.endsWith(".tab.mode") && value !== "text") {
    const tab = get(next, path.slice(0, -5));
    tab.logo ??= { src: `${base}assets/logo-0.svg`, width: 32, height: 32 };
  }
  apply(next, path.endsWith(".tab.mode"));
  el.removeAttribute("aria-invalid");
}
controls.addEventListener("input", (event) => {
  if (rendering) return;
  const el = event.target as HTMLInputElement;
  if (!el.dataset.path) return;
  clearTimeout(timer);
  pendingField = el;
  timer = setTimeout(() => {
    if (!el.isConnected) return;
    try {
      readField(el);
    } catch (error) {
      el.setAttribute("aria-invalid", "true");
      message(String(error instanceof Error ? error.message : error));
    }
  }, 250);
});
function flushPending() {
  const field = pendingField;
  pendingField = undefined;
  clearTimeout(timer);
  if (field?.isConnected) {
    try { readField(field); } catch (error) { message((error as Error).message); }
  }
}
controls.addEventListener("change", async (event) => {
  if (rendering) return;
  const el = event.target as HTMLInputElement;
  if (el.dataset.path) {
    clearTimeout(timer);
    try {
      readField(el);
    } catch (error) {
      el.setAttribute("aria-invalid", "true");
      message((error as Error).message);
    }
    return;
  }
  if (el.id === "new-block-kind") newBlockKind = el.value;
  if (el.id === "record-select") {
    flushPending();
    selected = Number(el.value);
    render();
  }
  if (el.id === "preset") {
    selected = 0;
    apply(preset(el.value, base), true, el.value);
  }
  if (el.dataset.asset && el.files?.[0]) {
    const file = el.files[0];
    if (file.size > 50 * 1024 * 1024) {
      message("Choose a file smaller than 50 MB.");
      return;
    }
    if (
      !/^(image\/(png|jpeg|webp|gif|svg\+xml|avif)|video\/(mp4|webm))$/.test(
        file.type,
      )
    ) {
      message("Choose an image or MP4/WebM video.");
      return;
    }
    const url = URL.createObjectURL(file),
      name = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    uploads.set(url, { file, path: `assets/upload-${++uploadSerial}-${name}` });
    try {
      const next = clone(config);
      set(next, el.dataset.asset, url);
      apply(next, true);
    } catch (error) {
      URL.revokeObjectURL(url);
      uploads.delete(url);
      message((error as Error).message);
    }
  }
});
const defaultBlock = (kind: string): ContentBlock => {
  const fixture = makeConfig(base);
  if (kind === "text")
    return {
      kind: "text",
      heading: "A new chapter",
      paragraphs: ["Write your story here."],
      bullets: [],
    };
  if (kind === "timeline")
    return {
      kind: "timeline",
      heading: "Milestones",
      entries: [
        { dates: "2025", title: "A beginning", body: "Describe what changed." },
      ],
    };
  if (kind === "video")
    return {
      ...clone(fixture.options.records[0].blocks[1]),
      featured: false,
    } as ContentBlock;
  if (kind === "gallery")
    return {
      ...clone(fixture.options.records[1].blocks[1]),
      featured: false,
    } as ContentBlock;
  return clone(fixture.options.records[2].blocks[1]);
};
controls.addEventListener("click", (event) => {
  const b = (event.target as Element).closest<HTMLButtonElement>(
    "[data-action]",
  );
  if (!b || b.disabled) return;
  flushPending();
  const action = b.dataset.action!,
    next = clone(config),
    records = next.options.records as FolderRecord[],
    r = records[selected],
    blocks = r.blocks as ContentBlock[],
    i = Number(b.dataset.block),
    n = Number(b.dataset.image);
  const move = (list: any[], from: number, to: number) => {
    if (to >= 0 && to < list.length) {
      const [v] = list.splice(from, 1);
      list.splice(to, 0, v);
    }
  };
  if (action === "record-add" || action === "record-duplicate") {
    if (records.length >= 12) return;
    const copy = clone(
      action === "record-add" ? makeConfig(base).options.records[5] : r,
    );
    let id = 1;
    while (records.some((r) => r.id === `record-${id}`)) id++;
    copy.id = `record-${id}`;
    copy.title = action === "record-add" ? "New record" : `${copy.title} copy`;
    records.push(copy);
    selected = records.length - 1;
  }
  if (action === "record-remove" && records.length > 1) {
    records.splice(selected, 1);
    selected = Math.max(0, selected - 1);
  }
  if (action === "record-up") {
    move(records, selected, selected - 1);
    selected = Math.max(0, selected - 1);
  }
  if (action === "record-down") {
    move(records, selected, selected + 1);
    selected = Math.min(records.length - 1, selected + 1);
  }
  if (action === "block-add")
    blocks.push(
      defaultBlock(
        (document.querySelector("#new-block-kind") as HTMLSelectElement).value,
      ),
    );
  if (action === "block-remove") blocks.splice(i, 1);
  if (action === "block-up") move(blocks, i, i - 1);
  if (action === "block-down") move(blocks, i, i + 1);
  if (action.startsWith("image-")) {
    const block = blocks[i];
    if (block.kind === "gallery") {
      const images = block.images as any[];
      if (action === "image-add") images.push(clone(images[0]));
      if (action === "image-remove" && images.length > 1) images.splice(n, 1);
      if (action === "image-up") move(images, n, n - 1);
      if (action === "image-down") move(images, n, n + 1);
    }
  }
  if (action === "auto-ink")
    r.ink = luminance(r.fill) > 0.179 ? "#000000" : "#ffffff";
  if (action === "palette") {
    const colors = [
      "#2d4860",
      "#436457",
      "#7b493a",
      "#5b4772",
      "#775927",
      "#354752",
    ];
    records.forEach((r, i) => {
      r.fill = colors[i % colors.length];
      r.ink = "#fff5e7";
    });
  }
  try {
    apply(next, true);
  } catch (error) {
    message((error as Error).message);
  }
});
function portable() {
  return mapAssets(
    config,
    (source) =>
      uploads.get(source)?.path ??
      (source.startsWith(`${base}assets/`)
        ? source.replace(`${base}assets/`, "assets/")
        : source),
  );
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.querySelector("#reset")!.addEventListener("click", () => {
  selected = 0;
  newBlockKind = "text";
  apply(makeConfig(base), true, "showcase");
});
for (const type of ["vanilla", "react"])
  document.querySelector(`#${type}-tab`)!.addEventListener("click", () => {
    language = type;
    for (const t of ["vanilla", "react"])
      document
        .querySelector(`#${t}-tab`)!
        .setAttribute("aria-pressed", String(t === type));
    refresh();
  });
document.querySelector("#copy-code")!.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(
      document.querySelector("#snippet")!.textContent!,
    );
    message("Integration example copied.");
  } catch {
    message("Select and copy the integration example below.");
  }
});
document.querySelector("#export-json")!.addEventListener("click", () => {
  try {
    download(
      new Blob([stringifyConfig(portable())], { type: "application/json" }),
      "dossier.config.json",
    );
    message(
      uploads.size
        ? "JSON exported. Export Config + assets to include your local files."
        : "JSON exported. Use Config + assets to include the sample assets.",
    );
  } catch (error) {
    message((error as Error).message);
  }
});
document.querySelector("#export-zip")!.addEventListener("click", async () => {
  try {
    message("Preparing your configuration and assets…");
    const c = portable(),
      files: Record<string, Uint8Array> = {
        "dossier.config.json": strToU8(stringifyConfig(c)),
        "README.txt": strToU8(
          "Install dossier-folders from its GitHub release. Place dossier.config.json alongside your example and serve assets/ from the same directory as the page. External HTTPS media stay external. Uploaded files retain their original ownership.\n",
        ),
      };
    const paths = new Set<string>();
    mapAssets(c, (source) => {
      if (source.startsWith("assets/")) paths.add(source);
      return source;
    });
    for (const path of paths) {
      if (!safeArchivePath(path))
        throw new Error(`Unsafe archive asset path: ${path}`);
      const local = [...uploads.values()].find((v) => v.path === path);
      if (local) files[path] = new Uint8Array(await local.file.arrayBuffer());
      else {
        const response = await fetch(`${base}${path}`);
        if (!response.ok) throw new Error(`Could not bundle ${path}`);
        files[path] = new Uint8Array(await response.arrayBuffer());
      }
    }
    files["assets/NOTICE.txt"] = strToU8(
      "Bundled fictional demo assets: MIT. User-uploaded assets retain their original ownership.",
    );
    download(
      new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], {
        type: "application/zip",
      }),
      "dossier-config.zip",
    );
    message("Configuration and assets exported.");
  } catch (error) {
    message((error as Error).message);
  }
});
document
  .querySelector("#import-json")!
  .addEventListener("change", async (event) => {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    try {
      const next = mapAssets(parseConfig(await file.text()), (source) =>
        source.startsWith("assets/") ? `${base}${source}` : source,
      );
      if (next.options.records.length < 1 || next.options.records.length > 12)
        throw new Error("The editor supports 1–12 records.");
      selected = 0;
      newBlockKind = "text";
      apply(next, true, "custom");
      message(
        "Configuration imported. Relative assets must be available at their configured paths.",
      );
    } catch (error) {
      message((error as Error).message);
    }
    input.value = "";
  });
render();
if (import.meta.env.DEV)
  (window as any).__demo = {
    api,
    getConfig: () => clone(config),
    apply: (c: DossierConfig) => {
      selected = 0;
      apply(c, true);
    },
    createDossierFolders,
  };
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    clearTimeout(timer);
    api.destroy();
    for (const [url] of uploads) URL.revokeObjectURL(url);
  });
