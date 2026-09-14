# API and content

## Client

`createDossierFolders(root, options)` enhances matching static markup or renders
an empty host. Import `dossier-folders/styles.css` once. Do not mount twice on
one element. Use a stable host element; its original HTML/attributes are restored
by `destroy()`.

| Method | Behavior |
| --- | --- |
| `open(id)` | Opens a known record. Unknown IDs and requests during an active transition are ignored. A request before the lazy controller resolves is queued. |
| `close()` | Closes the record; interrupts opening through the same return path as Escape. |
| `update(patch)` | Shallow-merges top-level options, validates before mutation, closes current content, releases media and rebuilds. Nested objects/arrays replace their old values. |
| `getState()` | Returns a copy of `{activeId, phase, layout, motion}`. |
| `destroy()` | Idempotent teardown and restoration of the original host. |

Phases: `closed`, `opening`, `open`, `closing`. Layout: `rail`, `stack`.
Effective motion: `full`, `reduced`.

Callbacks: `onOpen(id)`, `onClose(id)`, `onStateChange(state)`, and
`onMediaError({recordId, source, message})`. Open/close callbacks run when the
transition completes; aborted openings can produce a close callback. Callbacks
should not throw. Rendering remains synchronous; enhancement loads asynchronously.

## Options

- `records`: required ordered array; empty arrays display a readable empty state.
- `cabinet`: optional `label` (newlines supported), `color`, `stampColor`, and
  `font` (`editorial`, `modern`, `mono`). Colors use six-digit hex values.
- `labels`: optional `open`, `close`, `dialog`, `hint`, `empty` strings.
- `showHint`: defaults to true.
- `layout`: `auto` (default) or `stack`. Auto stacks at container widths of 760px
  or less, or when equal-width tabs would be narrower than 100px.
- `motion`: `auto` (default) or `reduced`. System reduced-motion and Save-Data
  always take precedence over automatic animation.
- `autoplay`: defaults to true; controls automatic media only. Native playback
  and gallery controls remain available.

The library has no record-count cap. The demo editor allows 1–12 records.
Large collections increase DOM and layout cost; use a smaller collection when
that improves navigation.

## Records

`FolderRecord` requires `id`, `title`, `fill`, `ink`, `tab`, and `blocks`.
IDs start with a letter and contain letters, digits, underscores, or hyphens;
IDs must be unique within an instance.

`tab.mode` is `text`, `logo`, or `both`. Text defaults to the record title;
`tab.label` overrides visible text. Logos require `{src,width,height}` and use
an empty image alt because the button receives its accessible name from `title`.
Logo dimensions specify the intended size, constrained by the tab's available room.

Optional header fields: `subtitle`, `dates`, `headline`, `summary`, `chips`.
`contentLayout` defaults to `flow`. Choose `featured` and mark one media block
`featured:true` to place that block beside the introduction and preceding text
on desktop. Following blocks remain in normal document order. Mobile collapses
the featured arrangement to one column.

## Content blocks

```ts
import type { ContentBlock } from 'dossier-folders';
const blocks: ContentBlock[] = [
  { kind: 'text', heading: 'The idea', paragraphs: [
    ['A ', {strong: 'useful'}, ' example.'],
    [{label: 'Reference', href: 'https://example.com'}],
  ], bullets: ['First point', 'Second point'] },
  { kind: 'timeline', heading: 'Milestones', entries: [
    { dates: '2025', title: 'First version', body: 'A small beginning.', current: true },
  ] },
  { kind: 'image', src: './assets/board.svg', alt: 'Project board',
    width: 960, height: 600, caption: 'A fictional project board.' },
  { kind: 'video', src: './assets/demo.mp4', poster: './assets/poster.png',
    label: 'A silent walkthrough', width: 390, height: 720,
    caption: 'Original interface recording.', frame: 'phone', autoplay: false },
  { kind: 'gallery', label: 'Interface screens', caption: 'Two iterations.',
    frame: 'none', images: [
      {src: './assets/one.png', alt: 'First iteration', width: 960, height: 600},
      {src: './assets/two.png', alt: 'Second iteration', width: 960, height: 600},
    ] },
];
```

Media can also have `action:{label,href}`. Video/gallery frames are `phone` or
`none`; individual images support the same frame property. Galleries need at
least one image. Dimensions must be positive finite numbers up to 16384.
Video playback is muted, inline, and looping. Gallery rotation uses three seconds
per decoded slide. Automatic rotation does not make screen-reader announcements.

All strings are escaped. URLs support relative paths and HTTPS. Arbitrary HTML,
executable URLs, protocol-relative URLs, and raw SVG markup are not supported.
Use SVG files through image URLs. In-memory blob URLs are supported for the local
editor; portable JSON accepts relative/HTTPS paths only.

## Static rendering and React

```ts
import {renderDossierFoldersMarkup} from 'dossier-folders/server';
const markup = renderDossierFoldersMarkup(options, {instanceId: 'projects'});
// Place markup inside an element with class="dossier" and enhance that element.
```

Every server-rendered instance must have a unique, stable `instanceId`. The server
entry has no DOM or GSAP initialization. Render the same options on both sides.
No-JavaScript content is readable; interactive media controls initialize with JS.

```tsx
import {DossierFolders, type DossierFoldersHandle} from 'dossier-folders/react';
import 'dossier-folders/styles.css';
const ref = useRef<DossierFoldersHandle>(null);
<DossierFolders ref={ref} options={options} />;
```

The adapter uses React's stable `useId`, server markup, effect-based enhancement,
and Strict Mode cleanup. The ref exposes `open`, `close`, `getState`. React 18/19
are supported. The host component should have a stable identity and key.

## Portable configuration

`DossierConfig` is `{version:1, options, background}`; callback functions are not
serialized. `parseConfig(json)` and `stringifyConfig(config)` validate the format.
`background` is demo-shell state, not a library-wide page style. Validation throws
`TypeError` with a field path; invalid updates do not replace the current UI.
