import { gsap } from "gsap";
import type { FolderRecord, DossierOptions, DossierState } from "./types";
import { acquire, release } from "./modal";
import { pauseRecordMedia, startRecordMedia } from "./media";
import { createFolderHinge } from "./cover";

type State = "closed" | "opening" | "open" | "closing";
type Folder = {
  el: HTMLElement;
  sizing: HTMLElement;
  cover: HTMLElement;
  path: SVGPathElement;
  clip: SVGPathElement;
  svg: SVGSVGElement;
  tab: HTMLButtonElement;
  rail: HTMLElement;
  track: HTMLElement;
  content: HTMLElement;
  scroll: HTMLElement;
  shadow: HTMLElement;
  backShadow: HTMLElement;
  faces: SVGGElement[];
  hinge: ReturnType<typeof createFolderHinge>;
  index: number;
  id: string;
};
const TAB_HEIGHT = 64;
const HOVER_LIFT = 16;
const STACK_ROW = 48;
const STACK_FACE = 160;
const RECESSED_SCALE = 0.88;
const EXTRACTION_TIME = 1.08;
// Ease both velocity and acceleration to rest at the cabinet handoffs. Keeping
// the cabinet and selected paper on this same curve preserves their clearance.
const EXTRACTION_EASE = (progress: number) =>
  progress ** 3 * (progress * (6 * progress - 15) + 10);
const TRANSPORT_TIME = 0.62;
const UNFOLD_START = TRANSPORT_TIME + 0.06;
const UNFOLD_TIME = 0.84;

/** One immutable paper layout, a uniformly scaled camera, and a separate hinge. */
export function initDossier(
  root: HTMLElement,
  records: readonly FolderRecord[],
  options: DossierOptions,
) {
  const token = {};
  const abort = new AbortController();
  const { signal } = abort;
  const q = <T extends Element>(selector: string) =>
    root.querySelector<T>(selector)!;
  const scene = q<HTMLElement>(".cabinet-scene");
  const home = q<HTMLElement>(".scene-home");
  const cabinet = q<HTMLElement>(".cabinet-front");
  const dialog = q<HTMLDialogElement>("dialog");
  const slot = q<HTMLElement>(".dialog-scene-slot");
  const closeButton = q<HTMLButtonElement>("[data-record-close]");
  const folders: Folder[] = records.map((record, index) => {
    const el = q<HTMLElement>(`[data-folder="${record.id}"]`);
    const find = <T extends Element>(selector: string) =>
      el.querySelector<T>(selector)!;
    return {
      el,
      index,
      id: record.id,
      sizing: find<HTMLElement>(".folder-sizing"),
      cover: find<HTMLElement>(".folder-cover"),
      path: find<SVGPathElement>(".folder-shape"),
      clip: find<SVGPathElement>(".folder-outline-clip"),
      svg: find<SVGSVGElement>(".folder-silhouette"),
      tab: find<HTMLButtonElement>(".folder-tab"),
      rail: find<HTMLElement>("[data-tab-rail]"),
      track: find<HTMLElement>(".folder-tab-track"),
      content: find<HTMLElement>(".folder-content"),
      scroll: find<HTMLElement>(".record-scroll"),
      shadow: find<HTMLElement>(".folder-opening-shadow"),
      backShadow: find<HTMLElement>(".folder-back-shadow"),
      faces: [...el.querySelectorAll<SVGGElement>(".cover-face")],
      hinge: createFolderHinge(find<HTMLElement>(".folder-cover")),
    };
  });
  let state: State = "closed";
  let selected: Folder | null = null;
  let exitTimeline: gsap.core.Timeline | null = null;
  let foldTimeline: gsap.core.Timeline | null = null;
  let originalRect: DOMRect;
  let selectedLift = 0;
  let originLift = 0;
  let width = 0;
  let height = 0;
  let paperWidth = 0;
  let paperHeight = 0;
  let closedScale = 0.9;
  let stacked = false;
  let closedPaperHeight = 0;
  let cabinetTop = 0;
  let tabWidth = 0;
  let tabHeight = TAB_HEIGHT;
  let railWidth = 0;
  let railScroll = 0;
  let storedRailScroll = 0;
  let pageScroll = { x: 0, y: 0 };
  let previousOverflow = "";
  let resizeFrame = 0;
  let closePositionFrame = 0;
  let forceResize = false;
  let measuredViewport: ReturnType<typeof viewportBounds> | null = null;
  let disposed = false;
  let needsFreshClose = false;
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const connection = (
    navigator as Navigator & {
      connection?: EventTarget & { saveData?: boolean };
    }
  ).connection;
  const reduceMotion = () =>
    options.motion === "reduced" ||
    motionQuery.matches ||
    !!connection?.saveData;
  let motionReduced = reduceMotion();
  const setState = (value: State) => {
    state = value;
    root.dataset.state = value;
    closeButton.hidden = value !== "open";
    root.dispatchEvent(
      new CustomEvent("dossier:state", {
        detail: {
          activeId: selected?.id ?? null,
          phase: state,
          layout: stacked ? "stack" : "rail",
          motion: reduceMotion() ? "reduced" : "full",
        } satisfies DossierState,
      }),
    );
  };
  const setMotion = () => {
    motionReduced = reduceMotion();
    root.dataset.motion = motionReduced ? "reduced" : "full";
  };
  const context = gsap.context(() => {}, root);
  const animate = <T>(callback: () => T): T => {
    let result!: T;
    context.add(() => {
      result = callback();
    });
    return result;
  };

  function silhouette(
    folder: Folder,
    w: number,
    h: number,
    x: number,
    tabW: number,
    b = tabHeight,
  ) {
    const left = x + 3,
      right = x + tabW - 3,
      radius = 18;
    folder.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    // The tab underlap must never square off either outside paper corner.
    folder.clip.setAttribute(
      "d",
      `M0 0 H${w} V${b} H0 Z M${radius} ${b} H${w - radius} Q${w} ${b} ${w} ${b + radius} V${h - radius} Q${w} ${h} ${w - radius} ${h} H${radius} Q0 ${h} 0 ${h - radius} V${b + radius} Q0 ${b} ${radius} ${b} Z`,
    );
    // One filled path: there is no seam, stroke, or shadow between tab and back.
    folder.path.setAttribute(
      "d",
      `M${radius} ${b} H${w - radius} Q${w} ${b} ${w} ${b + radius} V${h - radius} Q${w} ${h} ${w - radius} ${h} H${radius} Q0 ${h} 0 ${h - radius} V${b + radius} Q0 ${b} ${radius} ${b} Z M${left - 10} ${b + radius} V${b} Q${left - 2} ${b} ${left} ${b - 9} L${left + 7} 10 Q${left + 9} 0 ${left + 19} 0 H${right - 19} Q${right - 9} 0 ${right - 7} 10 L${right} ${b - 9} Q${right + 2} ${b} ${right + 10} ${b} V${b + radius} Z`,
    );
  }

  const tabX = (folder: Folder) =>
    stacked
      ? folder.index % 2
        ? paperWidth - 24 - tabWidth
        : 24
      : 24 + folder.index * tabWidth;
  const rowY = (folder: Folder) => (stacked ? folder.index * STACK_ROW : 0);
  const closedClip = () =>
    stacked
      ? `inset(0px 0px ${Math.max(0, paperHeight - closedPaperHeight)}px 0px round 0px 0px 18px 18px)`
      : "none";
  const openClip = () =>
    stacked ? "inset(0px 0px 0px 0px round 0px 0px 18px 18px)" : "none";

  function sizeFolder(folder: Folder, w: number, h: number) {
    Object.assign(folder.sizing.style, { width: `${w}px`, height: `${h}px` });
    folder.sizing.style.setProperty("--tab-width", `${tabWidth}px`);
    // Keep the native button reachable across the space vacated by its lift.
    folder.sizing.style.setProperty(
      "--hover-reach",
      `${HOVER_LIFT / closedScale + 2}px`,
    );
    folder.content.style.clipPath = "none";
    const coverTop = tabHeight + 6;
    folder.sizing.style.setProperty("--df-tab-height", `${tabHeight}px`);
    Object.assign(folder.cover.style, {
      left: "3px",
      width: `${w - 6}px`,
      top: `${coverTop}px`,
      height: `${h - coverTop - 3}px`,
    });
    folder.hinge.resize(w - 6, h - coverTop - 3, h, coverTop);
    const x = tabX(folder);
    folder.track.style.width = `${railWidth}px`;
    Object.assign(folder.tab.style, { left: `${x}px`, width: `${tabWidth}px` });
    folder.tab.style.top = "4px";
    folder.rail.style.height = `${tabHeight + 4 + HOVER_LIFT / closedScale}px`;
    gsap.set(folder.tab, { x: 0, scaleX: 1, scaleY: 1 });
    folder.sizing.style.clipPath = closedClip();
    silhouette(folder, w, h, x - railScroll, tabWidth);
  }

  function measureClosed() {
    if (home.clientWidth < 1) return;
    measuredViewport = viewportBounds();
    const rect = modalRect();
    paperWidth = rect.width;
    paperHeight = rect.height;
    stacked =
      options.layout === "stack" ||
      home.clientWidth <= 760 ||
      (home.clientWidth - 48) / Math.max(records.length, 1) < 100;
    root.dataset.layout = stacked ? "stack" : "rail";
    closedScale = Math.min(0.9, home.clientWidth / paperWidth);
    width = paperWidth * closedScale;
    const compactTabs = stacked && closedScale < 0.65;
    root.dataset.compactTabs = String(compactTabs);
    // Grow the actual paper silhouette with the hit target, never paint a
    // rectangular button over it. Retain one immutable layout through opening.
    tabHeight = compactTabs ? Math.max(TAB_HEIGHT, 12 + 44 / closedScale) : TAB_HEIGHT;
    root.style.setProperty("--df-closed-scale", String(closedScale));
    // Expose every phone tab above a compact cabinet face. Keep the underlying
    // reading layout full size; its mask expands as the selected sheet lifts out.
    closedPaperHeight = stacked
      ? Math.min(paperHeight, tabHeight + STACK_FACE / closedScale)
      : paperHeight;
    const lastRow = stacked ? Math.max(0, records.length - 1) * STACK_ROW : 0;
    height = closedPaperHeight * closedScale + lastRow;
    tabWidth = stacked
      ? Math.min(Math.max(184, 160 / closedScale), paperWidth - 48)
      : Math.max(100, (paperWidth - 48) / Math.max(records.length, 1));
    railWidth = stacked
      ? paperWidth
      : Math.max(paperWidth, tabWidth * records.length + 48);
    railScroll = stacked ? 0 : Math.min(railScroll, railWidth - paperWidth);
    if (stacked) storedRailScroll = 0;
    home.style.height = `${height}px`;
    scene.style.height = `${height}px`;
    scene.style.width = `${width}px`;
    scene.style.marginInline = "auto";
    cabinetTop = lastRow + (tabHeight + 13) * closedScale;
    cabinet.style.top = `${cabinetTop}px`;
    folders.forEach((folder) => {
      sizeFolder(folder, paperWidth, paperHeight);
      gsap.set(folder.sizing, {
        x: 0,
        y: rowY(folder),
        scale: closedScale,
        transformOrigin: "0 0",
      });
      folder.rail.scrollLeft = railScroll;
      restoreDepth(folder);
    });
  }

  function closedGeometry(folder: Folder) {
    Object.assign(folder.sizing.style, {
      left: "0px",
      top: "0px",
      transform: "none",
    });
    gsap.set(folder.sizing, {
      x: 0,
      y: rowY(folder),
      scale: closedScale,
      clipPath: closedClip(),
    });
    folder.rail.scrollLeft = storedRailScroll;
  }

  function revealTab(folder: Folder) {
    if (stacked) return;
    const left = tabX(folder);
    const right = left + tabWidth;
    let offset = railScroll;
    if (left < offset + 12) offset = left - 12;
    else if (right > offset + paperWidth - 12) offset = right - paperWidth + 12;
    railScroll = Math.max(0, Math.min(offset, railWidth - paperWidth));
    storedRailScroll = railScroll;
    folders.forEach((entry) => {
      entry.rail.scrollLeft = railScroll;
      silhouette(
        entry,
        paperWidth,
        paperHeight,
        tabX(entry) - railScroll,
        tabWidth,
      );
    });
  }

  function viewportBounds() {
    const viewport = window.visualViewport;
    // A native dialog can remove the scrollbar from visualViewport.width even
    // with a stable gutter. The document's box keeps the actual layout width;
    // a narrower visual viewport still accounts for pinch zoom and keyboards.
    return {
      width: Math.min(
        document.documentElement.getBoundingClientRect().width,
        viewport?.width ?? innerWidth,
      ),
      height: viewport?.height ?? innerHeight,
      left: viewport?.offsetLeft ?? 0,
      top: viewport?.offsetTop ?? 0,
    };
  }

  function modalRect() {
    const {
      width: vw,
      height: vh,
      left: offsetX,
      top: offsetY,
    } = viewportBounds();
    const mobile = innerWidth <= 760;
    const safeTop =
      parseFloat(getComputedStyle(dialog).getPropertyValue("--safe-top")) || 0;
    const safeBottom =
      parseFloat(getComputedStyle(dialog).getPropertyValue("--safe-bottom")) ||
      0;
    const w = Math.min(1160, vw - (mobile ? 32 : 96));
    const availableHeight = vh - safeTop - safeBottom;
    const h = Math.min(
      mobile ? 740 : 780,
      availableHeight * (mobile ? 0.88 : 0.84),
      Math.max(1, availableHeight - 88),
    );
    // Reserve 44px for Close, 12px of separation, and a 16px viewport inset.
    return {
      left: offsetX + (vw - w) / 2,
      top: offsetY + safeTop + Math.max(72, (availableHeight - h) / 2),
      width: w,
      height: h,
    };
  }

  function positionClose() {
    // Browser zoom can make the final transformed paper differ slightly from
    // its planned destination. Anchor the visible action to the rendered edge.
    const rendered = state === "open" ? selected : null;
    const rect = rendered
      ? rendered.sizing.getBoundingClientRect()
      : modalRect();
    const bounds = dialog.getBoundingClientRect();
    const buttonWidth = closeButton.offsetWidth || 88;
    const buttonHeight = closeButton.offsetHeight || 44;
    const paperScale = rendered ? rect.height / paperHeight : 1;
    let right = rect.left + rect.width;
    let top = rect.top + tabHeight * paperScale - 12 - buttonHeight;
    if (selected) {
      const renderedTab = rendered?.tab.getBoundingClientRect();
      const tabLeft =
        renderedTab?.left ?? rect.left + tabX(selected) - storedRailScroll;
      const tabRight = renderedTab?.right ?? tabLeft + tabWidth;
      // Share the tab band without covering a company's mark. Rear tabs can
      // occupy the right corner, so place Close in the free space beside them.
      if (right - buttonWidth < tabRight + 12 && right > tabLeft - 12) {
        if (tabLeft - 12 - buttonWidth >= rect.left) right = tabLeft - 12;
        else top = rect.top - 12 - buttonHeight;
      }
    }
    dialog.style.setProperty("--record-right", `${bounds.right - right}px`);
    dialog.style.setProperty("--record-top", `${top - bounds.top}px`);
  }

  function openCamera() {
    const rect = modalRect();
    positionClose();
    return {
      x: rect.left - originalRect.left,
      y: rect.top - originalRect.top - selectedLift,
      scale: 1,
    };
  }

  function openGeometry(folder: Folder) {
    gsap.set(folder.sizing, { ...openCamera(), clipPath: openClip() });
  }

  function recessionY() {
    if (stacked) {
      // The phone cabinet has its face below all tab rows. Keep a strip of
      // that face in view while leaving room to extract the compact sheet.
      return Math.max(
        24 + closedPaperHeight * closedScale + 16 - originalRect.top,
        innerHeight - 48 - originalRect.top - cabinetTop * RECESSED_SCALE,
      );
    }
    const travel = Math.min(135, Math.max(80, innerHeight * 0.14));
    // Leave room above the extracted tab, including in shorter desktop windows.
    // The cabinet stays behind the reading panel while the paper clears its tabs.
    return Math.max(travel, height + 40 - originalRect.top);
  }

  function backgroundLayers() {
    return [
      cabinet,
      ...folders
        .filter((folder) => folder !== selected)
        .map((folder) => folder.el),
    ];
  }

  function recessionOffset(element: Element) {
    // One scene-space pivot keeps the cabinet face and its contents together.
    return (
      recessionY() +
      (element === cabinet ? cabinetTop * (RECESSED_SCALE - 1) : 0)
    );
  }

  function extractionY() {
    // Clear the highest remaining tab as well as the cabinet lip before changing
    // depth, including when a rear folder passes in front of earlier records.
    return (
      recessionY() -
      closedPaperHeight * closedScale -
      (selected ? rowY(selected) : 0) -
      16
    );
  }

  function restoreDepth(folder: Folder) {
    folder.el.style.zIndex = String(
      stacked ? folder.index + 1 : records.length - folder.index,
    );
  }

  function pauseMedia() {
    pauseRecordMedia(scene);
  }

  function setCoverAngle(folder: Folder, angle: number) {
    folder.hinge.angle = angle;
    folder.hinge.render();
  }

  function finishedOpen() {
    if (!selected || state === "closing") return;
    const wasOpening = state === "opening";
    setState("open");
    positionClose();
    // WebKit can report the previous transformed paper bounds in the same
    // frame as an orientation change. Re-anchor after that layout is painted.
    cancelAnimationFrame(closePositionFrame);
    closePositionFrame = requestAnimationFrame(() => {
      if (!disposed && state === "open") positionClose();
    });
    selected.content.inert = false;
    selected.cover.style.visibility = "hidden";
    selected.sizing.style.willChange = "";
    selected.cover.style.willChange = "";
    if (wasOpening) {
      closeButton.focus({ preventScroll: true });
      startRecordMedia(selected.el);
    }
  }

  function finishClosed() {
    if (!selected) return;
    const origin = selected;
    exitTimeline?.kill();
    foldTimeline?.kill();
    exitTimeline = null;
    foldTimeline = null;
    pauseMedia();
    home.append(scene);
    scene.style.removeProperty("left");
    scene.style.removeProperty("top");
    scene.style.removeProperty("width");
    gsap.set([cabinet, ...folders.map((folder) => folder.el)], {
      y: 0,
      scale: 1,
    });
    // Keep the originating tab at its pre-click lift as keyboard focus returns.
    // Resetting it to zero here would introduce a dip at the end of the reverse.
    gsap.set(origin.el, { y: reduceMotion() ? 0 : originLift });
    folders.forEach((folder) => {
      delete folder.el.dataset.selected;
      folder.content.inert = true;
      folder.tab.disabled = false;
      folder.rail.inert = false;
      folder.rail.style.overflowX = "";
      folder.sizing.style.willChange = "";
      folder.cover.style.willChange = "";
      folder.cover.style.visibility = "";
      setCoverAngle(folder, 0);
      gsap.set(folder.faces, { opacity: 1 });
      gsap.set([folder.shadow, folder.backShadow], { opacity: 0 });
      restoreDepth(folder);
      closedGeometry(folder);
    });
    selected = null;
    railScroll = storedRailScroll;
    setState("closed");
    dialog.close();
    document.body.style.overflow = previousOverflow;
    release(token);
    measureClosed();
    if (needsFreshClose) revealTab(origin);
    window.scrollTo({
      left: pageScroll.x,
      top: pageScroll.y,
      behavior: "instant",
    });
    origin.tab.focus({ preventScroll: true });
    // Native focus may scroll its private rail; restore the synchronized view last.
    folders.forEach((folder) => {
      folder.rail.scrollLeft = railScroll;
    });
    needsFreshClose = false;
  }

  function returnCabinet() {
    if (!selected) return;
    selected.content.inert = true;
    closedGeometry(selected);
    setCoverAngle(selected, 0);
    restoreDepth(selected);
    if (!exitTimeline || reduceMotion()) {
      finishClosed();
      return;
    }
    exitTimeline.timeScale(1).reverse();
  }

  function beginFold() {
    if (!selected || state !== "opening") return;
    const folder = selected;
    selectedLift = Number(gsap.getProperty(folder.el, "y")) || 0;
    folder.el.style.zIndex = String(records.length + 2);
    const camera = openCamera();
    folder.sizing.style.willChange = "transform";
    folder.cover.style.willChange = "transform";
    animate(() => {
      foldTimeline = gsap.timeline({
        paused: true,
        onComplete: finishedOpen,
        onReverseComplete: returnCabinet,
      });
      foldTimeline.to(
        folder.sizing,
        {
          ...camera,
          clipPath: openClip(),
          duration: TRANSPORT_TIME,
          ease: "power2.inOut",
        },
        0,
      );
      foldTimeline.to(
        folder.backShadow,
        { opacity: 1, duration: TRANSPORT_TIME },
        0,
      );
      // The paper, tab, logo and content share exactly the same camera scale.
      // Once it reaches the reading position, only the cover and lighting move.
      foldTimeline.to(
        folder.hinge,
        {
          angle: -180,
          duration: UNFOLD_TIME,
          ease: "power2.inOut",
          onUpdate: folder.hinge.render,
        },
        UNFOLD_START,
      );
      foldTimeline.to(
        folder.shadow,
        { opacity: 0.55, duration: 0.28, ease: "sine.inOut" },
        UNFOLD_START,
      );
      foldTimeline.to(
        folder.shadow,
        { opacity: 0, duration: 0.44, ease: "sine.out" },
        UNFOLD_START + 0.28,
      );
      // Fade the small remaining flap below the reading panel as it falls out of
      // the foreground. Faces are leaves, so opacity cannot flatten the hinge.
      foldTimeline.to(
        folder.faces,
        { opacity: 0, duration: 0.23, ease: "power1.in" },
        UNFOLD_START + UNFOLD_TIME - 0.23,
      );
      foldTimeline.play(0);
    });
  }

  function open(id: string) {
    if (state !== "closed" || disposed) return;
    const folder = folders.find((entry) => entry.id === id);
    if (!folder) return;
    acquire(token, () => {
      exitTimeline?.kill();
      foldTimeline?.kill();
      if (selected) finishClosed();
    });
    selected = folder;
    gsap.killTweensOf(folders.map((entry) => entry.el));
    selectedLift = Number(gsap.getProperty(folder.el, "y")) || 0;
    originLift = selectedLift;
    railScroll = folder.rail.scrollLeft;
    storedRailScroll = railScroll;
    pageScroll = { x: scrollX, y: scrollY };
    originalRect = scene.getBoundingClientRect();
    previousOverflow = document.body.style.overflow;
    const readingScroll = {
      left: folder.scroll.scrollLeft,
      top: folder.scroll.scrollTop,
    };
    setState("opening");
    folder.el.dataset.selected = "";
    dialog.setAttribute(
      "aria-labelledby",
      folder.content.querySelector(".record-company")!.id,
    );
    folders.forEach((entry) => {
      entry.content.inert = true;
      entry.rail.inert = true;
      entry.rail.style.overflowX = "hidden";
    });
    // The complete scene enters the top layer, preserving every existing occluder.
    slot.append(scene);
    Object.assign(scene.style, {
      left: `${originalRect.left}px`,
      top: `${originalRect.top}px`,
      width: `${originalRect.width}px`,
    });
    dialog.showModal();
    document.body.style.overflow = "hidden";
    dialog.focus({ preventScroll: true });
    // showModal/scroll locking can remove a classic scrollbar. Its queued
    // viewport resize is our own layout change, not a reason to end the motion.
    // Measure after forcing the locked layout; genuine later resizes still settle.
    measuredViewport = viewportBounds();
    // Chromium's native showModal autofocus can scroll even inert descendants.
    // Restore the mounted content before the first frame, just like the rails.
    folder.scroll.scrollLeft = readingScroll.left;
    folder.scroll.scrollTop = readingScroll.top;
    // WebKit resets nested scroll offsets when their scene is reparented.
    // Restore after the dialog has layout so the physical tab cannot jump.
    folders.forEach((entry) => {
      entry.rail.scrollLeft = storedRailScroll;
      silhouette(
        entry,
        paperWidth,
        paperHeight,
        tabX(entry) - storedRailScroll,
        tabWidth,
      );
    });
    positionClose();
    const others = backgroundLayers();
    gsap.set(others, { transformOrigin: "50% 0%" });
    if (reduceMotion()) {
      gsap.set(others, {
        y: (_, element) => recessionOffset(element),
        scale: RECESSED_SCALE,
      });
      folder.el.style.zIndex = String(records.length + 2);
      openGeometry(folder);
      setCoverAngle(folder, -180);
      gsap.set(folder.faces, { opacity: 0 });
      gsap.set(folder.backShadow, { opacity: 1 });
      finishedOpen();
      return;
    }
    animate(() => {
      exitTimeline = gsap
        .timeline({ onComplete: beginFold, onReverseComplete: finishClosed })
        .to(
          others,
          {
            y: (_, element) => recessionOffset(element),
            scale: RECESSED_SCALE,
            duration: EXTRACTION_TIME,
            ease: EXTRACTION_EASE,
          },
          0,
        )
        .to(
          folder.el,
          {
            y: extractionY(),
            duration: EXTRACTION_TIME,
            ease: EXTRACTION_EASE,
          },
          0,
        )
        .to(
          folder.backShadow,
          { opacity: 0.65, duration: EXTRACTION_TIME, ease: EXTRACTION_EASE },
          0,
        );
    });
  }

  function freshClose() {
    if (!selected) return;
    const folder = selected;
    animate(() => {
      foldTimeline = gsap
        .timeline({
          onComplete: () => {
            restoreDepth(folder);
            exitTimeline = gsap
              .timeline({ onComplete: finishClosed })
              .to(
                backgroundLayers(),
                {
                  y: 0,
                  scale: 1,
                  duration: EXTRACTION_TIME,
                  ease: EXTRACTION_EASE,
                },
                0,
              )
              .to(
                folder.el,
                {
                  y: originLift,
                  duration: EXTRACTION_TIME,
                  ease: EXTRACTION_EASE,
                },
                0,
              )
              .to(
                folder.backShadow,
                {
                  opacity: 0,
                  duration: EXTRACTION_TIME,
                  ease: EXTRACTION_EASE,
                },
                0,
              );
          },
        })
        .to(folder.faces, { opacity: 1, duration: 0.2 }, 0)
        .to(
          folder.hinge,
          {
            angle: 0,
            duration: 0.72,
            ease: "power2.inOut",
            onUpdate: folder.hinge.render,
          },
          0,
        )
        .to(
          folder.shadow,
          { opacity: 0.45, duration: 0.36, ease: "sine.inOut" },
          0.2,
        )
        .to(folder.shadow, { opacity: 0, duration: 0.16 }, 0.56)
        .to(
          folder.sizing,
          {
            x: 0,
            y: rowY(folder),
            scale: closedScale,
            clipPath: closedClip(),
            duration: 0.56,
            ease: "power2.inOut",
          },
          0.72,
        )
        .to(folder.backShadow, { opacity: 0.65, duration: 0.56 }, 0.72);
    });
  }

  function close() {
    if (!selected || state === "closed" || state === "closing") return;
    setState("closing");
    dialog.focus({ preventScroll: true });
    // showModal/scroll locking can remove a classic scrollbar. Its queued
    // viewport resize is our own layout change, not a reason to end the motion.
    // Measure after forcing the locked layout; genuine later resizes still settle.
    measuredViewport = viewportBounds();
    pauseMedia();
    selected.content.inert = true;
    selected.cover.style.visibility = "";
    if (reduceMotion()) {
      finishClosed();
      return;
    }
    if (needsFreshClose) {
      freshClose();
      return;
    }
    if (foldTimeline) {
      if (foldTimeline.time() > 0) foldTimeline.timeScale(1.15).reverse();
      else returnCabinet();
    } else if (exitTimeline && exitTimeline.time() > 0) {
      exitTimeline.timeScale(1).reverse();
    } else finishClosed();
  }

  function hover(folder: Folder, lift: boolean) {
    if (state !== "closed" || stacked || reduceMotion()) return;
    animate(() =>
      gsap.to(folder.el, {
        y: lift ? -HOVER_LIFT : 0,
        duration: 0.18,
        ease: "power2.out",
        overwrite: true,
      }),
    );
  }

  folders.forEach((folder) => {
    folder.content.inert = true;
    folder.tab.addEventListener("click", () => open(folder.id), { signal });
    folder.tab.addEventListener(
      "pointerenter",
      (event) => {
        if (event.pointerType === "mouse") hover(folder, true);
      },
      { signal },
    );
    folder.tab.addEventListener("pointerleave", () => hover(folder, false), {
      signal,
    });
    folder.tab.addEventListener("focus", () => hover(folder, true), { signal });
    folder.tab.addEventListener("blur", () => hover(folder, false), { signal });
    folder.rail.addEventListener(
      "scroll",
      () => {
        if (
          state !== "closed" ||
          stacked ||
          Math.abs(folder.rail.scrollLeft - railScroll) < 0.5
        )
          return;
        railScroll = folder.rail.scrollLeft;
        folders.forEach((entry) => {
          if (entry !== folder) entry.rail.scrollLeft = railScroll;
          silhouette(
            entry,
            paperWidth,
            paperHeight,
            tabX(entry) - railScroll,
            tabWidth,
          );
        });
      },
      { signal, passive: true },
    );
  });
  closeButton.addEventListener("click", close, { signal });
  dialog.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey)
        return;
      // Native dialog supplies background inertness. Explicit wrapping also keeps
      // Tab inside the record when a browser would otherwise focus its chrome.
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(
          "a[href], button, input, select, textarea, video[controls], [tabindex]",
        ),
      ].filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(":disabled") &&
          !element.closest("[inert]") &&
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== "hidden",
      );
      // Safari can omit buttons from its default tab sequence. Use the complete
      // sequence here so both links and controls remain reachable in the modal.
      const stops = focusable.length ? focusable : [dialog];
      const index = stops.indexOf(document.activeElement as HTMLElement);
      const next =
        index < 0
          ? event.shiftKey
            ? stops.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;
      event.preventDefault();
      stops[next].focus();
    },
    { signal },
  );
  dialog.addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      close();
    },
    { signal },
  );
  dialog.addEventListener(
    "close",
    () => {
      if (selected && !dialog.open) finishClosed();
    },
    { signal },
  );
  window.addEventListener(
    "beforeprint",
    () => {
      // Native modal layers cannot paginate. Return every record to the page so
      // the print stylesheet can expose the complete history in document flow.
      if (selected) finishClosed();
      pauseMedia();
    },
    { signal },
  );
  function onResize(force = false) {
    forceResize ||= force;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (disposed) return;
      const viewport = viewportBounds();
      const unchanged =
        measuredViewport &&
        (["width", "height", "left", "top"] as const).every(
          (key) => Math.abs(viewport[key] - measuredViewport![key]) < 1,
        );
      const mustSettle = forceResize;
      forceResize = false;
      if (unchanged && !mustSettle) return;
      measuredViewport = viewport;
      if (state === "closed") {
        measureClosed();
        return;
      }
      if (state === "closing") {
        needsFreshClose = true;
        finishClosed();
        return;
      }
      if (!selected) return;
      exitTimeline?.kill();
      foldTimeline?.kill();
      exitTimeline = null;
      foldTimeline = null;
      railScroll = storedRailScroll;
      measureClosed();
      revealTab(selected);
      const destination = home.getBoundingClientRect();
      originalRect = new DOMRect(
        destination.left + (home.clientWidth - width) / 2,
        destination.top,
        width,
        height,
      );
      Object.assign(scene.style, {
        left: `${originalRect.left}px`,
        top: `${originalRect.top}px`,
      });
      gsap.set(backgroundLayers(), {
        y: (_, element) => recessionOffset(element),
        scale: RECESSED_SCALE,
        transformOrigin: "50% 0%",
      });
      selectedLift = extractionY();
      gsap.set(selected.el, { y: selectedLift, scale: 1 });
      selected.el.style.zIndex = String(records.length + 2);
      openGeometry(selected);
      setCoverAngle(selected, -180);
      gsap.set(selected.faces, { opacity: 0 });
      gsap.set(selected.shadow, { opacity: 0 });
      gsap.set(selected.backShadow, { opacity: 1 });
      finishedOpen();
      needsFreshClose = true;
    });
  }
  window.addEventListener("resize", () => onResize(), { signal });
  window.visualViewport?.addEventListener("resize", () => onResize(), {
    signal,
  });
  const observer = new ResizeObserver(() => {
    if (state === "closed") measureClosed();
  });
  observer.observe(home);
  const motionChanged = () => {
    if (reduceMotion() === motionReduced) return;
    setMotion();
    if (state !== "closed") onResize(true);
    else
      gsap.set(
        folders.map((entry) => entry.el),
        { y: 0 },
      );
  };
  motionQuery.addEventListener("change", motionChanged, { signal });
  connection?.addEventListener("change", motionChanged, { signal });
  setMotion();
  root.dataset.enhanced = "";
  setState("closed");
  measureClosed();

  const destroy = () => {
    disposed = true;
    abort.abort();
    observer.disconnect();
    cancelAnimationFrame(resizeFrame);
    cancelAnimationFrame(closePositionFrame);
    exitTimeline?.kill();
    foldTimeline?.kill();
    if (selected) finishClosed();
    context.revert();
    pauseMedia();
    folders.forEach((folder) => {
      folder.content.inert = false;
    });
    [home, scene, cabinet].forEach((element) => {
      for (const property of [
        "height",
        "width",
        "left",
        "top",
        "transform",
        "margin-inline",
      ])
        element.style.removeProperty(property);
    });
    folders.forEach((folder) => {
      for (const element of [
        folder.sizing,
        folder.cover,
        folder.tab,
        folder.track,
        folder.rail,
        folder.shadow,
        folder.backShadow,
        ...folder.faces,
      ])
        element.removeAttribute("style");
      folder.el.style.removeProperty("transform");
      folder.el.style.zIndex = String(records.length - folder.index);
      folder.content.style.removeProperty("clip-path");
      folder.tab.removeAttribute("aria-haspopup");
    });
    root.removeAttribute("data-enhanced");
    root.removeAttribute("data-motion");
    root.removeAttribute("data-layout");
    release(token);
  };
  return { open, close, destroy };
}
