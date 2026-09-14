const OPEN_MEDIA = "dossier:media-open";
const PAUSE_MEDIA = "dossier:media-pause";
const SLIDE_TIME = 3000;

/** Attach sources only to revealed records; preload=none keeps manual mode quiet. */
export function prepareRecordMedia(root: HTMLElement): void {
  root
    .querySelectorAll<HTMLVideoElement>("[data-record-video]")
    .forEach((video) => {
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.controls = true;
      if (!video.getAttribute("src") && video.dataset.videoSrc)
        video.src = video.dataset.videoSrc;
    });
}

export function startRecordMedia(record: HTMLElement): void {
  record.dispatchEvent(new CustomEvent(OPEN_MEDIA, { bubbles: true }));
}

export function pauseRecordMedia(root: HTMLElement): void {
  // Stop timers before pausing videos so pending play cannot restart on close.
  root.dispatchEvent(new CustomEvent(PAUSE_MEDIA, { bubbles: true }));
  root
    .querySelectorAll<HTMLVideoElement>("video")
    .forEach((video) => video.pause());
}

/** The optional folder animation sends open/close; media owns its own lifecycle. */
export function initRecordMedia(root: HTMLElement): () => void {
  type Video = {
    node: HTMLVideoElement;
    media: HTMLElement;
    visible: boolean;
    wanted: boolean;
    pending: boolean;
    revision: number;
    managedPauses: number;
    userPaused: boolean;
  };
  type Gallery = {
    media: HTMLElement;
    images: HTMLImageElement[];
    index: number;
    running: boolean;
    visible: boolean;
    userPaused: boolean;
    ready: boolean;
    pending: boolean;
    revision: number;
    timer?: number;
  };
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
    root.dataset.autoplay === "false" ||
    motion.matches ||
    !!connection?.saveData;
  let active: HTMLElement | null = null;
  let disposed = false;
  let frame = 0;
  let generation = 0;
  let displayed = false;
  const videos: Video[] = [
    ...root.querySelectorAll<HTMLVideoElement>("[data-record-video]"),
  ].map((node) => ({
    node,
    media: node.closest<HTMLElement>(".record-media")!,
    visible: false,
    wanted: false,
    pending: false,
    revision: 0,
    managedPauses: 0,
    userPaused: false,
  }));
  const galleries: Gallery[] = [
    ...root.querySelectorAll<HTMLElement>("[data-record-gallery]"),
  ].map((media) => ({
    media,
    images: [
      ...media.querySelectorAll<HTMLImageElement>("[data-gallery-image]"),
    ],
    index: 0,
    running: false,
    visible: false,
    userPaused: false,
    ready: false,
    pending: false,
    revision: 0,
  }));

  function available(media: HTMLElement): boolean {
    return (
      !disposed &&
      (!root.hasAttribute("data-enhanced") ||
        (displayed &&
          root.dataset.state === "open" &&
          !!active?.contains(media)))
    );
  }

  function report(node: HTMLImageElement | HTMLVideoElement, message: string) {
    root.dispatchEvent(
      new CustomEvent("dossier:media-error", {
        detail: {
          recordId:
            node.closest<HTMLElement>("[data-folder]")?.dataset.folder ?? "",
          source: node.getAttribute("src") ?? "",
          message,
        },
      }),
    );
  }
  root
    .querySelectorAll<HTMLImageElement>(".record-media img")
    .forEach((image) =>
      image.addEventListener(
        "error",
        () => {
          const status = image
            .closest(".record-media")
            ?.querySelector<HTMLElement>("[data-video-status]");
          if (status) {
            status.textContent =
              "Image unavailable. The rest of this record is still readable.";
            status.hidden = false;
          }
          report(image, "Image unavailable.");
        },
        { signal },
      ),
    );

  function videoStatus(entry: Video, message = "") {
    const status = entry.media.querySelector<HTMLElement>(
      "[data-video-status]",
    );
    if (status) {
      status.textContent = message;
      status.hidden = !message;
    }
  }

  function suspendVideo(entry: Video) {
    if (!entry.node.paused) {
      entry.managedPauses++;
      entry.node.pause();
    }
  }

  function reconcileVideo(entry: Video) {
    if (!available(entry.media) || document.hidden || !entry.visible) {
      suspendVideo(entry);
      return;
    }
    if (
      !entry.wanted ||
      entry.pending ||
      !entry.node.paused ||
      entry.node.error
    )
      return;
    entry.pending = true;
    const revision = ++entry.revision;
    void entry.node
      .play()
      .catch((error: unknown) => {
        if (disposed || revision !== entry.revision) return;
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        entry.wanted = false;
        if (available(entry.media) && !document.hidden) {
          videoStatus(
            entry,
            entry.node.error
              ? "Video unavailable. The rest of this record is still readable."
              : "Use the video controls to play the demo.",
          );
        }
      })
      .finally(() => {
        if (disposed || revision !== entry.revision) return;
        entry.pending = false;
        reconcileVideo(entry);
      });
  }

  function galleryControls(entry: Gallery) {
    const previous = entry.media.querySelector<HTMLButtonElement>(
      "[data-gallery-prev]",
    );
    const next = entry.media.querySelector<HTMLButtonElement>(
      "[data-gallery-next]",
    );
    const toggle = entry.media.querySelector<HTMLButtonElement>(
      "[data-gallery-toggle]",
    );
    if (previous) previous.disabled = entry.index === 0;
    if (next) next.disabled = entry.index >= entry.images.length - 1;
    if (toggle) {
      toggle.textContent = entry.running
        ? "Pause slideshow"
        : "Resume slideshow";
      toggle.setAttribute("aria-pressed", String(entry.running));
    }
  }

  function stopTimer(entry: Gallery) {
    clearTimeout(entry.timer);
    entry.timer = undefined;
  }

  function canAdvance(entry: Gallery) {
    return (
      available(entry.media) &&
      !document.hidden &&
      entry.visible &&
      entry.running &&
      entry.images.length > 1
    );
  }

  function queueSlide(entry: Gallery) {
    stopTimer(entry);
    if (!canAdvance(entry) || !entry.ready || entry.pending) return;
    entry.timer = window.setTimeout(() => {
      entry.timer = undefined;
      if (canAdvance(entry))
        void showSlide(entry, (entry.index + 1) % entry.images.length);
    }, SLIDE_TIME);
  }

  async function showSlide(entry: Gallery, index: number, announce = false) {
    const image = entry.images[index];
    if (!image) return;
    stopTimer(entry);
    const revision = ++entry.revision;
    entry.pending = true;
    image.loading = "eager";
    // Count three seconds from a decoded, displayed slide, not its request.
    let failed = false;
    await image.decode().catch(() => {
      failed = true;
    });
    if (failed && !disposed && revision === entry.revision) {
      entry.pending = false;
      entry.running = false;
      entry.ready = false;
      entry.index = index;
      const status = entry.media.querySelector<HTMLElement>(
        "[data-video-status]",
      );
      if (status) {
        status.hidden = false;
        status.textContent = "Image unavailable. Try another slide.";
      }
      report(image, "Image unavailable.");
      galleryControls(entry);
      return;
    }
    if (disposed || revision !== entry.revision || !available(entry.media))
      return;
    if (!announce && !canAdvance(entry)) {
      entry.pending = false;
      return;
    }
    entry.index = index;
    entry.ready = true;
    entry.pending = false;
    entry.images.forEach((item, itemIndex) => {
      item.hidden = itemIndex !== index;
      if (itemIndex === index) {
        item.dataset.active = "";
        item.removeAttribute("aria-hidden");
      } else {
        delete item.dataset.active;
        item.setAttribute("aria-hidden", "true");
      }
    });
    galleryControls(entry);
    // Automatic rotation must not repeatedly interrupt screen-reader speech.
    if (announce) {
      const status = entry.media.querySelector<HTMLElement>(
        "[data-gallery-status]",
      );
      if (status) status.textContent = image.alt;
    }
    queueSlide(entry);
  }

  function reconcile() {
    videos.forEach(reconcileVideo);
    galleries.forEach((entry) => {
      if (!canAdvance(entry)) {
        stopTimer(entry);
        return;
      }
      if (!entry.ready && !entry.pending) void showSlide(entry, entry.index);
      else if (!entry.timer) queueSlide(entry);
    });
  }

  function stop() {
    generation++;
    cancelAnimationFrame(frame);
    active = null;
    displayed = false;
    videos.forEach((entry) => {
      entry.wanted = false;
      entry.pending = false;
      entry.revision++;
      suspendVideo(entry);
    });
    galleries.forEach((entry) => {
      stopTimer(entry);
      entry.running = false;
      entry.pending = false;
      entry.revision++;
      galleryControls(entry);
    });
  }

  root.addEventListener(
    OPEN_MEDIA,
    (event) => {
      const record = event.target;
      if (!(record instanceof HTMLElement) || !root.contains(record)) return;
      stop();
      active = record;
      prepareRecordMedia(record);
      videos
        .filter((entry) => record.contains(entry.media))
        .forEach((entry) => {
          entry.wanted =
            !motionDenied() &&
            !entry.userPaused &&
            entry.media.dataset.autoplay !== "false";
          videoStatus(entry);
          if (entry.node.readyState > 0) entry.node.currentTime = 0;
        });
      galleries
        .filter((entry) => record.contains(entry.media))
        .forEach((entry) => {
          entry.index = 0;
          entry.ready = false;
          entry.running =
            !motionDenied() &&
            !entry.userPaused &&
            entry.media.dataset.autoplay !== "false";
          entry.images.forEach((image, index) => {
            image.hidden = index !== 0;
            if (!index) {
              image.dataset.active = "";
              image.removeAttribute("aria-hidden");
            } else {
              delete image.dataset.active;
              image.setAttribute("aria-hidden", "true");
            }
            if (entry.running) {
              image.loading = "eager";
              void image.decode().catch(() => {});
            }
          });
          const status = entry.media.querySelector<HTMLElement>(
            "[data-gallery-status]",
          );
          if (status) status.textContent = "";
          galleryControls(entry);
        });
      const revision = generation;
      // Let the exposed back-panel content paint before playback begins.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (disposed || revision !== generation) return;
          displayed = true;
          reconcile();
        });
      });
    },
    { signal },
  );
  root.addEventListener(PAUSE_MEDIA, stop, { signal });

  root.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>("button");
      const entry = galleries.find(
        (gallery) => button && gallery.media.contains(button),
      );
      if (!button || !entry || !available(entry.media)) return;
      if (button.matches("[data-gallery-toggle]")) {
        entry.running = !entry.running;
        entry.userPaused = !entry.running;
        galleryControls(entry);
        reconcile();
      } else if (button.matches("[data-gallery-prev], [data-gallery-next]")) {
        const direction = button.matches("[data-gallery-next]") ? 1 : -1;
        void showSlide(
          entry,
          Math.max(
            0,
            Math.min(entry.images.length - 1, entry.index + direction),
          ),
          true,
        );
      }
    },
    { signal },
  );

  videos.forEach((entry) => {
    entry.node.addEventListener(
      "play",
      () => {
        // A queued play event may arrive after a close or a managed pause.
        if (entry.node.paused) return;
        if (!available(entry.media) || document.hidden || !entry.visible) {
          suspendVideo(entry);
          return;
        }
        entry.wanted = true;
        entry.userPaused = false;
        videoStatus(entry);
      },
      { signal },
    );
    entry.node.addEventListener(
      "pause",
      () => {
        if (entry.managedPauses) entry.managedPauses--;
        else {
          entry.wanted = false;
          entry.userPaused = true;
        }
      },
      { signal },
    );
    entry.node.addEventListener(
      "error",
      () => {
        entry.wanted = false;
        report(entry.node, "Video unavailable.");
        videoStatus(
          entry,
          "Video unavailable. The rest of this record is still readable.",
        );
      },
      { signal },
    );
  });

  const visibility = new IntersectionObserver(
    (changes) => {
      for (const change of changes) {
        for (const entry of [...videos, ...galleries]) {
          if (entry.media === change.target)
            entry.visible =
              change.isIntersecting && change.intersectionRatio > 0.05;
        }
      }
      reconcile();
    },
    { threshold: [0, 0.05] },
  );
  [...videos, ...galleries].forEach((entry) => visibility.observe(entry.media));
  document.addEventListener("visibilitychange", reconcile, { signal });
  const preferencesChanged = () => {
    if (!motionDenied()) return;
    videos.forEach((entry) => {
      entry.wanted = false;
      suspendVideo(entry);
    });
    galleries.forEach((entry) => {
      entry.running = false;
      stopTimer(entry);
      galleryControls(entry);
    });
  };
  motion.addEventListener("change", preferencesChanged, { signal });
  connection?.addEventListener("change", preferencesChanged, { signal });

  return () => {
    disposed = true;
    stop();
    abort.abort();
    visibility.disconnect();
    videos.forEach(({ node }) => {
      node.removeAttribute("src");
      node.load();
    });
  };
}
