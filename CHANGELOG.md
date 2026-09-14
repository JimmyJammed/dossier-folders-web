# Changelog

## 0.1.2 — 2026-09-14

- Synchronize preset, record, and block-kind menus with editor state.
- Mark edited/imported configurations as custom so every preset can be selected again.
- Retain menu focus and collapsed sections across redraws; discard stale debounced edits after preset/reset/import changes.

## 0.1.1 — 2026-09-14

- Keep tab labels transparent on hover; only the complete folder lifts.
- Scale the continuous SVG paper tab with its accessible hit target in narrow desktop embeds, avoiding detached rectangular labels.
- Preserve extraction, transport, and unfolding when native modal scroll locking changes the viewport's scrollbar width.
- Add demo-level WebKit/Chromium/Firefox regressions for all three issues.

## 0.1.0 — 2026-09-14

- Extracted the tactile cabinet and projected folder hinge into a generic component.
- Added vanilla TypeScript, React 18/19, and server-rendering exports.
- Added ordered rich content, images, video, galleries, and timelines.
- Added a responsive editor, portable JSON/asset export, and six fictional records.
- Added isolated consumer, browser, geometry, fallback, and product-boundary checks.
- Original code and fictional assets released under MIT; no public npm publication.
