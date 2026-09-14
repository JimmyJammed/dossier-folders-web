/** Text is structured data, never HTML. */
export type RecordText =
  | string
  | readonly (string | { strong: string } | { label: string; href: string })[];
export type Asset = { src: string; width: number; height: number };
export type RecordImage = Asset & { alt: string };
export type Action = { label: string; href: string };
export type TimelineEntry = {
  dates: string;
  title: string;
  body: string;
  current?: boolean;
};
export type TextBlock = {
  kind: "text";
  heading?: string;
  paragraphs?: readonly RecordText[];
  bullets?: readonly RecordText[];
};
export type TimelineBlock = {
  kind: "timeline";
  heading?: string;
  entries: readonly TimelineEntry[];
};
export type MediaBase = {
  caption: string;
  action?: Action;
  featured?: boolean;
  frame?: "phone" | "none";
};
export type ImageBlock = MediaBase & RecordImage & { kind: "image" };
export type VideoBlock = MediaBase &
  Asset & { kind: "video"; poster: string; label: string; autoplay?: boolean };
export type GalleryBlock = MediaBase & {
  kind: "gallery";
  label: string;
  images: readonly RecordImage[];
  autoplay?: boolean;
};
export type ContentBlock =
  | TextBlock
  | TimelineBlock
  | ImageBlock
  | VideoBlock
  | GalleryBlock;
export type FolderRecord = {
  id: string;
  title: string;
  fill: string;
  ink: string;
  tab: { mode: "text" | "logo" | "both"; label?: string; logo?: Asset };
  subtitle?: string;
  dates?: string;
  headline?: string;
  summary?: string;
  chips?: readonly string[];
  contentLayout?: "flow" | "featured";
  blocks: readonly ContentBlock[];
};
export type DossierState = {
  activeId: string | null;
  phase: "closed" | "opening" | "open" | "closing";
  layout: "stack" | "rail";
  motion: "full" | "reduced";
};
export type DossierOptions = {
  records: readonly FolderRecord[];
  cabinet?: {
    label?: string;
    color?: string;
    stampColor?: string;
    font?: "editorial" | "modern" | "mono";
  };
  labels?: {
    open?: string;
    close?: string;
    dialog?: string;
    hint?: string;
    empty?: string;
  };
  showHint?: boolean;
  layout?: "auto" | "stack";
  motion?: "auto" | "reduced";
  autoplay?: boolean;
  onOpen?: (id: string) => void;
  onClose?: (id: string) => void;
  onStateChange?: (state: DossierState) => void;
  onMediaError?: (error: {
    recordId: string;
    source: string;
    message: string;
  }) => void;
};
export type DossierInstance = {
  open(id: string): void;
  close(): void;
  update(options: Partial<DossierOptions>): void;
  getState(): DossierState;
  destroy(): void;
};
export type DossierConfig = {
  version: 1;
  options: Omit<
    DossierOptions,
    "onOpen" | "onClose" | "onStateChange" | "onMediaError"
  >;
  background: string;
};
