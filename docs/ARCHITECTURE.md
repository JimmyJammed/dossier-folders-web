# Architecture

The package separates data validation, pure rendering, optional motion, media,
and host integration. Demo fixtures and editor logic are never library defaults.

The factory validates options before rendering and imports the controller lazily.
The renderer emits semantic articles with known content blocks; it escapes text
and scopes clip paths, gradient IDs, headings, media captions, and controls by
instance. The React adapter keeps a stable server-rendered inner tree and lets
the imperative component own it after hydration.

## Motion preserved during extraction

The closed cabinet has a fixed filing order. Hover raises a sheet without changing
its depth. Opening extracts it past sibling tabs (1.08 seconds), transports one
uniformly scaled reading layout (0.62 seconds), and unfolds a projected SVG cover
(0.84 seconds). Closing reverses those stages. The SVG hinge avoids nested CSS
perspective differences in Safari. Geometry/interruption regression tests retain
these invariants from the original component.

The reading panel is measured against the visual viewport. The closed cabinet
scales into its host and chooses a horizontal row or alternating stacked tabs
from container width and record count. Redundant resize/network events preserve
motion; genuine geometry/preference changes settle into a usable state.

Native dialog owns modal semantics. A shared owner coordinates multiple cabinets;
opening another one settles the current owner before acquiring its scroll lock.
Destroy/update cancel motion, release media, disconnect observers, and restore
host state. Selectors and motion contexts are scoped to the component.

Media is a separate lifecycle. Opening attaches video sources and starts eligible
media only once content is exposed. Intersection/visibility observers suspend
work. Gallery decode errors preserve readable state. Scroll-edge fades decorate
the boundaries without blurring actual content.

## Deliberate changes

Employment-specific fields became generic record headers and ordered blocks.
A single video/gallery slot became multiple media blocks with an optional featured
placement. Labels, colors, fonts, and tabs are configurable. Host fonts and global
document rules were removed. No real employment copy, employer branding, asset
paths, or source history was imported.

The demo is a Vite static app. Its default records are rendered into HTML at build
time. The editor edits the same options consumed by the library; its export format
is versioned. There is no backend, persistence, telemetry, or paid service.
