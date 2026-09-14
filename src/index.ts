import type { DossierInstance, DossierOptions, DossierState } from "./types.ts";
import { renderDossierFoldersMarkup } from "./server.ts";
import { validateOptions } from "./validate.ts";
import { initRecordMedia, prepareRecordMedia } from "./media.ts";
import { initRecordScrollEdges } from "./scroll-edges.ts";
export type * from "./types.ts";
export { validateOptions, parseConfig, stringifyConfig } from "./validate.ts";
const instances = new WeakMap<HTMLElement, DossierInstance>();
let serial = 0;
export function createDossierFolders(
  root: HTMLElement,
  initial: DossierOptions,
): DossierInstance {
  validateOptions(initial, true);
  if (instances.has(root))
    throw new Error(
      "This element already contains a Dossier Folders instance.",
    );
  const originalHTML = root.innerHTML,
    originalAttributes = [...root.attributes].map((a) => [a.name, a.value]);
  const existing = root.querySelector<HTMLElement>('[id$="-title"]')?.id;
  const first = initial.records[0];
  const instanceId =
    existing && first
      ? existing.slice(0, -(`${first.id}-title`.length + 1))
      : `df${++serial}`;
  let options = initial,
    dead = false,
    revision = 0,
    controller:
      | Awaited<ReturnType<(typeof import("./controller.ts"))["initDossier"]>>
      | undefined;
  let clean: (() => void)[] = [];
  let pending: string | undefined;
  let state: DossierState = {
    activeId: null,
    phase: "closed",
    layout: "rail",
    motion: "full",
  };
  const notify = (s: DossierState) => {
    const old = state;
    state = s;
    options.onStateChange?.({ ...s });
    if (s.phase === "open" && old.phase !== "open" && s.activeId)
      options.onOpen?.(s.activeId);
    if (s.phase === "closed" && old.phase !== "closed" && old.activeId)
      options.onClose?.(old.activeId);
  };
  const release = () => {
    controller?.destroy();
    controller = undefined;
    clean
      .splice(0)
      .reverse()
      .forEach((fn) => fn());
  };
  const fallback = () => {
    root.removeAttribute("data-enhanced");
    root
      .querySelectorAll<HTMLElement>("[inert]")
      .forEach((el) => (el.inert = false));
    prepareRecordMedia(root);
    root
      .querySelectorAll<HTMLButtonElement>(".folder-tab")
      .forEach((b) => b.removeAttribute("aria-haspopup"));
  };
  function build(reuse = false) {
    const seq = ++revision;
    pending = undefined;
    release();
    root.classList.add("dossier");
    root.dataset.font = options.cabinet?.font ?? "editorial";
    root.dataset.autoplay = String(options.autoplay !== false);
    root.dataset.preference = options.motion ?? "auto";
    if (!reuse)
      root.innerHTML = renderDossierFoldersMarkup(options, { instanceId });
    const reduced =
      options.motion === "reduced" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !!(navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData;
    state = {
      activeId: null,
      phase: "closed",
      layout:
        options.layout === "stack" || root.clientWidth <= 760
          ? "stack"
          : "rail",
      motion: reduced ? "reduced" : "full",
    };
    const abort = new AbortController();
    clean.push(() => abort.abort());
    root.addEventListener(
      "dossier:state",
      ((event: CustomEvent<DossierState>) =>
        notify(event.detail)) as EventListener,
      { signal: abort.signal },
    );
    root.addEventListener(
      "dossier:media-error",
      ((
        event: CustomEvent<{
          recordId: string;
          source: string;
          message: string;
        }>,
      ) => options.onMediaError?.(event.detail)) as EventListener,
      { signal: abort.signal },
    );
    root.addEventListener(
      "click",
      (e) => {
        if (controller) return;
        const b = (e.target as Element).closest<HTMLElement>(".folder-tab");
        if (b)
          b.closest(".folder")
            ?.querySelector(".record-header")
            ?.scrollIntoView();
      },
      { signal: abort.signal },
    );
    if (!options.records.length) return;
    clean.push(initRecordMedia(root), initRecordScrollEdges(root));
    void import("./controller.ts")
      .then(({ initDossier }) => {
        if (dead || seq !== revision) return;
        try {
          controller = initDossier(root, options.records, options);
          if (pending) {
            controller.open(pending);
            pending = undefined;
          }
        } catch (error) {
          fallback();
          console.error("Dossier Folders: motion unavailable.", error);
        }
      })
      .catch(() => {
        if (!dead && seq === revision) fallback();
      });
  }
  const api: DossierInstance = {
    open(id) {
      if (dead || !options.records.some((r) => r.id === id)) return;
      if (controller) controller.open(id);
      else {
        pending = id;
        root
          .querySelector<HTMLElement>(`[data-folder="${id}"] .record-header`)
          ?.scrollIntoView();
      }
    },
    close() {
      pending = undefined;
      controller?.close();
    },
    update(patch) {
      if (dead) return;
      const next = { ...options, ...patch };
      validateOptions(next, true);
      const focus = document.activeElement;
      const tab =
        focus instanceof HTMLElement && root.contains(focus)
          ? (focus.closest<HTMLElement>("[data-folder]")?.dataset.folder ??
            state.activeId)
          : undefined;
      release();
      options = next;
      build();
      if (tab)
        root
          .querySelector<HTMLButtonElement>(
            `[data-folder="${tab}"] .folder-tab`,
          )
          ?.focus({ preventScroll: true });
    },
    getState: () => ({
      ...state,
      layout:
        root.dataset.layout === "stack"
          ? "stack"
          : root.dataset.layout === "rail"
            ? "rail"
            : state.layout,
      motion:
        root.dataset.motion === "reduced"
          ? "reduced"
          : root.dataset.motion === "full"
            ? "full"
            : state.motion,
    }),
    destroy() {
      if (dead) return;
      dead = true;
      revision++;
      release();
      root.innerHTML = originalHTML;
      [...root.attributes].forEach((a) => root.removeAttribute(a.name));
      originalAttributes.forEach(([k, v]) => root.setAttribute(k, v));
      instances.delete(root);
    },
  };
  instances.set(root, api);
  build(!!root.querySelector(".scene-home"));
  return api;
}
