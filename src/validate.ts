import type { DossierOptions, DossierConfig } from "./types.ts";
export const escape = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const fail = (path: string, message: string): never => {
  throw new TypeError(`${path}: ${message}`);
};
export const isColor = (s: unknown): s is string =>
  typeof s === "string" && /^#[\da-f]{6}$/i.test(s);
export function isSafeUrl(s: unknown, allowBlob = false): s is string {
  if (
    typeof s !== "string" ||
    !s ||
    /[\s\\]/.test(s) ||
    [...s].some((c) => c.charCodeAt(0) < 32) ||
    s.startsWith("//")
  )
    return false;
  if (/^https:\/\//i.test(s)) {
    try {
      return !!new URL(s).hostname;
    } catch {
      return false;
    }
  }
  if (allowBlob && /^blob:https?:\/\//.test(s)) return true;
  return !/^[^/?#]*:/.test(s);
}
export function validateOptions(
  value: unknown,
  allowBlob = false,
): asserts value is DossierOptions {
  const obj = (x: unknown, p: string): Record<string, any> =>
    x && typeof x === "object" && !Array.isArray(x)
      ? (x as Record<string, any>)
      : fail(p, "must be an object");
  const str = (x: unknown, p: string, required = false) => {
    if (x === undefined && !required) return;
    if (typeof x !== "string" || (required && !x.trim()))
      fail(p, "must be a string" + (required ? " with content" : ""));
  };
  const arr = (x: unknown, p: string): any[] =>
    Array.isArray(x) ? x : fail(p, "must be an array");
  const color = (x: unknown, p: string) => {
    if (!isColor(x)) fail(p, "use a six-digit hex color");
  };
  const choice = (x: unknown, p: string, choices: string[]) => {
    if (x !== undefined && !choices.includes(String(x)))
      fail(p, `expected ${choices.join(", ")}`);
  };
  const bool = (x: unknown, p: string) => {
    if (x !== undefined && typeof x !== "boolean") fail(p, "must be boolean");
  };
  const url = (x: unknown, p: string) => {
    if (!isSafeUrl(x, allowBlob)) fail(p, "use a relative path or HTTPS URL");
  };
  const asset = (x: unknown, p: string, alt = false) => {
    const a = obj(x, p);
    url(a.src, `${p}.src`);
    for (const k of ["width", "height"])
      if (
        typeof a[k] !== "number" ||
        !Number.isFinite(a[k]) ||
        a[k] <= 0 ||
        a[k] > 16384
      )
        fail(`${p}.${k}`, "must be between 0 and 16384");
    if (alt) str(a.alt, `${p}.alt`, true);
  };
  const text = (x: unknown, p: string) => {
    if (typeof x === "string") return;
    arr(x, p).forEach((t, i) => {
      if (typeof t === "string") return;
      const o = obj(t, `${p}[${i}]`);
      if ("strong" in o) str(o.strong, `${p}[${i}].strong`, true);
      else {
        str(o.label, `${p}[${i}].label`, true);
        url(o.href, `${p}[${i}].href`);
      }
    });
  };
  const o = obj(value, "options");
  const ids = new Set<string>();
  arr(o.records, "records").forEach((raw, i) => {
    const p = `records[${i}]`,
      r = obj(raw, p);
    if (typeof r.id !== "string" || !/^[a-zA-Z][\w-]*$/.test(r.id))
      fail(
        `${p}.id`,
        "use a letter followed by letters, digits, underscores or hyphens",
      );
    if (ids.has(r.id)) fail(`${p}.id`, "must be unique");
    ids.add(r.id);
    str(r.title, `${p}.title`, true);
    color(r.fill, `${p}.fill`);
    color(r.ink, `${p}.ink`);
    for (const k of ["subtitle", "dates", "headline", "summary"])
      str(r[k], `${p}.${k}`);
    if (r.chips !== undefined)
      arr(r.chips, `${p}.chips`).forEach((x, j) =>
        str(x, `${p}.chips[${j}]`, true),
      );
    const tab = obj(r.tab, `${p}.tab`);
    choice(tab.mode, `${p}.tab.mode`, ["text", "logo", "both"]);
    if (!tab.mode) fail(`${p}.tab.mode`, "required");
    str(tab.label, `${p}.tab.label`);
    if (tab.mode !== "text") asset(tab.logo, `${p}.tab.logo`);
    else if (tab.logo) asset(tab.logo, `${p}.tab.logo`);
    choice(r.contentLayout, `${p}.contentLayout`, ["flow", "featured"]);
    let featured = 0;
    arr(r.blocks, `${p}.blocks`).forEach((raw, j) => {
      const q = `${p}.blocks[${j}]`,
        b = obj(raw, q);
      if (b.kind === "text") {
        str(b.heading, `${q}.heading`);
        for (const k of ["paragraphs", "bullets"])
          if (b[k] !== undefined)
            arr(b[k], `${q}.${k}`).forEach((x, n) =>
              text(x, `${q}.${k}[${n}]`),
            );
      } else if (b.kind === "timeline") {
        str(b.heading, `${q}.heading`);
        arr(b.entries, `${q}.entries`).forEach((raw, n) => {
          const e = obj(raw, `${q}.entries[${n}]`);
          for (const k of ["dates", "title", "body"])
            str(e[k], `${q}.entries[${n}].${k}`, true);
          bool(e.current, `${q}.entries[${n}].current`);
        });
      } else if (["image", "video", "gallery"].includes(b.kind)) {
        str(b.caption, `${q}.caption`, true);
        choice(b.frame, `${q}.frame`, ["phone", "none"]);
        bool(b.featured, `${q}.featured`);
        if (b.featured) featured++;
        if (b.kind === "image") asset(b, q, true);
        if (b.kind === "video") {
          asset(b, q);
          url(b.poster, `${q}.poster`);
          str(b.label, `${q}.label`, true);
          bool(b.autoplay, `${q}.autoplay`);
        }
        if (b.kind === "gallery") {
          str(b.label, `${q}.label`, true);
          bool(b.autoplay, `${q}.autoplay`);
          const imgs = arr(b.images, `${q}.images`);
          if (!imgs.length) fail(`${q}.images`, "add at least one image");
          imgs.forEach((x, n) => asset(x, `${q}.images[${n}]`, true));
        }
        if (b.action !== undefined) {
          const a = obj(b.action, `${q}.action`);
          str(a.label, `${q}.action.label`, true);
          url(a.href, `${q}.action.href`);
        }
      } else fail(`${q}.kind`, "unknown content block");
    });
    if (featured > 1)
      fail(`${p}.blocks`, "only one media block may be featured");
  });
  choice(o.layout, "layout", ["auto", "stack"]);
  choice(o.motion, "motion", ["auto", "reduced"]);
  bool(o.showHint, "showHint");
  bool(o.autoplay, "autoplay");
  if (o.cabinet) {
    const c = obj(o.cabinet, "cabinet");
    str(c.label, "cabinet.label");
    for (const k of ["color", "stampColor"])
      if (c[k] !== undefined) color(c[k], `cabinet.${k}`);
    choice(c.font, "cabinet.font", ["editorial", "modern", "mono"]);
  }
  if (o.labels) {
    const l = obj(o.labels, "labels");
    for (const k of ["open", "close", "dialog", "hint", "empty"])
      str(l[k], `labels.${k}`);
  }
  for (const k of ["onOpen", "onClose", "onStateChange", "onMediaError"])
    if (o[k] !== undefined && typeof o[k] !== "function")
      fail(k, "must be a function");
}
export function parseConfig(text: string): DossierConfig {
  const v = JSON.parse(text);
  if (v?.version !== 1) fail("version", "expected 1");
  validateOptions(v.options);
  if (!isColor(v.background)) fail("background", "use a six-digit hex color");
  return v;
}
export function stringifyConfig(config: DossierConfig): string {
  validateOptions(config.options);
  if (!isColor(config.background))
    fail("background", "use a six-digit hex color");
  return JSON.stringify(
    { version: 1, options: config.options, background: config.background },
    null,
    2,
  );
}
