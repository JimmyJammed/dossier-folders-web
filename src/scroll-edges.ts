type Gsap = (typeof import("gsap"))["gsap"];
type Tween = ReturnType<Gsap["to"]>;
type Edge = { node: HTMLSpanElement; visible: boolean; tween?: Tween };
type ScrollFrame = {
  frame: HTMLElement;
  scroll: HTMLElement;
  top: Edge;
  bottom: Edge;
};

/** Subtle scroll boundaries; only the decorative leaves are masked or blurred. */
export function initRecordScrollEdges(root: HTMLElement): () => void {
  const abort = new AbortController();
  const { signal } = abort;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const connection = (
    navigator as Navigator & {
      connection?: EventTarget & { saveData?: boolean };
    }
  ).connection;
  const motionDenied = () =>
    root.dataset.preference === "reduced" ||
    motion.matches ||
    !!connection?.saveData;
  let engine: Gsap | undefined;
  let loadingEngine = false;
  let failedEngine = false;
  let disposed = false;
  let frameRequest = 0;
  let immediate = true;
  const dirty = new Set<ScrollFrame>();

  function createEdge(side: "top" | "bottom"): Edge {
    const node = document.createElement("span");
    node.className = `record-scroll-edge record-scroll-edge--${side}`;
    node.setAttribute("aria-hidden", "true");
    node.dataset.scrollEdge = side;
    return { node, visible: false };
  }

  const frames: ScrollFrame[] = [];
  root
    .querySelectorAll<HTMLElement>(".record-scroll-frame")
    .forEach((frame) => {
      const scroll = frame.querySelector<HTMLElement>(
        ":scope > .record-scroll",
      );
      if (!scroll) return;
      const top = createEdge("top"),
        bottom = createEdge("bottom");
      frame.append(top.node, bottom.node);
      frames.push({ frame, scroll, top, bottom });
    });

  function loadAnimation() {
    if (engine || loadingEngine || failedEngine || disposed || motionDenied())
      return;
    loadingEngine = true;
    // The readable fallback must not depend on a motion bundle succeeding.
    void import("gsap")
      .then((module) => {
        if (!disposed) engine = module.gsap;
      })
      .catch(() => {
        failedEngine = true;
      })
      .finally(() => {
        loadingEngine = false;
      });
  }

  function setEdge(edge: Edge, visible: boolean, instant: boolean) {
    if (edge.visible === visible && !instant) return;
    edge.visible = visible;
    edge.tween?.kill();
    edge.tween = undefined;
    if (instant || motionDenied() || !engine || document.hidden) {
      edge.node.style.opacity = visible ? "1" : "0";
      return;
    }
    // This runs only when a boundary changes, not at pointer/scroll frequency.
    edge.tween = engine.to(edge.node, {
      opacity: visible ? 1 : 0,
      duration: 0.18,
      ease: "power2.out",
      overwrite: true,
    });
  }

  function flush() {
    frameRequest = 0;
    if (disposed) return;
    const instant = immediate;
    immediate = false;
    const open =
      root.hasAttribute("data-enhanced") &&
      root.dataset.state === "open" &&
      !document.hidden;
    // Read every scroller before changing the overlay leaves.
    const updates = [...dirty].map((entry) => {
      const { scroll } = entry;
      const max = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
      const position = Math.max(0, Math.min(scroll.scrollTop, max));
      const overflow = open && scroll.clientHeight > 0 && max > 1;
      return {
        entry,
        above: overflow && position > 1,
        below: overflow && max - position > 1,
      };
    });
    dirty.clear();
    updates.forEach(({ entry, above, below }) => {
      entry.frame.dataset.scrollAbove = String(above);
      entry.frame.dataset.scrollBelow = String(below);
      setEdge(entry.top, above, instant || !open);
      setEdge(entry.bottom, below, instant || !open);
    });
  }

  function schedule(entry?: ScrollFrame, instant = false) {
    if (disposed) return;
    if (entry) dirty.add(entry);
    else frames.forEach((item) => dirty.add(item));
    immediate ||= instant;
    if (!frameRequest) frameRequest = requestAnimationFrame(flush);
  }

  const resize = new ResizeObserver(() => schedule());
  frames.forEach((entry) => {
    entry.scroll.addEventListener("scroll", () => schedule(entry), {
      passive: true,
      signal,
    });
    resize.observe(entry.frame);
    resize.observe(entry.scroll);
    // Late images, font metrics, and variable-length records can change the
    // scroll extent without changing the viewport's own dimensions.
    for (const child of entry.scroll.children) resize.observe(child);
  });
  const state = new MutationObserver(() => schedule(undefined, true));
  state.observe(root, {
    attributes: true,
    attributeFilter: ["data-state", "data-enhanced"],
  });
  root.addEventListener("load", () => schedule(), { capture: true, signal });
  window.addEventListener("resize", () => schedule(), {
    passive: true,
    signal,
  });
  document.addEventListener(
    "visibilitychange",
    () => schedule(undefined, true),
    { signal },
  );
  const motionChanged = () => {
    loadAnimation();
    schedule(undefined, true);
  };
  motion.addEventListener("change", motionChanged, { signal });
  connection?.addEventListener("change", motionChanged, { signal });
  void document.fonts?.ready.then(() => schedule());
  loadAnimation();
  schedule(undefined, true);

  return () => {
    disposed = true;
    abort.abort();
    cancelAnimationFrame(frameRequest);
    resize.disconnect();
    state.disconnect();
    dirty.clear();
    frames.forEach(({ frame, top, bottom }) => {
      top.tween?.kill();
      bottom.tween?.kill();
      top.node.remove();
      bottom.node.remove();
      delete frame.dataset.scrollAbove;
      delete frame.dataset.scrollBelow;
    });
  };
}
