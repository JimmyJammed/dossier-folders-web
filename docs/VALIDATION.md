# Local validation — v0.1.0

Verified on **2026-09-14** using macOS, Node **26.7.0**, npm, and
Playwright **1.63.0**. These are recorded local results, not hosted CI badges.
The documented minimum Node version is 22.18; that exact runtime was not tested.

## Tested source

- Component and complete browser suite: `bf39ffaaf32137b77d21c0cb6d1baf4239041f80`.
- Final portable-export/editor changes and deployed demo: `591cbf08567fad6453173cb00953ac497a07a980`.
- Subsequent release changes contain documentation and license notices only.
- Machine-readable full-suite results: [validation-results.json](validation-results.json).

## Results

| Check | Actual result |
| --- | --- |
| Fresh public clone at `5f0f6294ee85de21adbc0fffca3b44cb2e33c684` | `npm ci`, `npm run check`, and `npm run pack:library` passed; archive identical to release candidate |
| `npm run check` | Passed lint, TypeScript, production demo/library builds, 10 unit tests, and product scan |
| `npm run test:browser` | 148 passed, 8 intentionally skipped, 0 failed; 156 scheduled |
| Final editor regression run across all four browser projects | 28 passed, 0 failed |
| `npm run pack:library` | Installable archive, explicit exports/types/styles, notices, and checksum produced |
| `npm run verify:consumers` | Fresh vanilla, React 18.3.1, and React 19.1.1 consumers passed archive installation, TypeScript, production builds, and Chromium interaction checks |
| Server rendering / React lifecycle | DOM-free Node rendering, hydration, and Strict Mode passed in consumer checks |
| `npm run generate:assets` | Original fictional logos/interfaces, two silent videos, and posters regenerated successfully |
| Root and nested base paths | Root development/build and nested production artifact checked; nested route also verified live |
| Host production build | Passed existing artifact checks, TypeScript, Vite, and media stamping |
| Existing host output comparison | All 639 previously built files remained byte-for-byte unchanged |
| Public route artifact comparison | All 25 deployed route files matched the validated artifact byte-for-byte |

The 28 editor checks overlap with the full suite; do not add the two counts to
claim a larger unique test total. The complete suite was not rerun after the
export-only follow-up; the affected editor tests were rerun in every browser.

### Browser coverage

| Project | Passed | Skipped | Failed |
| --- | ---: | ---: | ---: |
| Chromium desktop | 38 | 1 | 0 |
| Firefox desktop | 38 | 1 | 0 |
| WebKit desktop | 38 | 1 | 0 |
| WebKit iPhone 13 emulation | 34 | 5 | 0 |

Skips are platform-specific: touch-only behavior on desktop and desktop-specific
hover, geometry, resize, or keyboard scenarios on mobile. Mobile keyboard,
reduced-motion, and media behavior have separate coverage. There were no flaky
results in the recorded full run.

Coverage includes retained folder geometry and interruption regressions; record
counts 0/1/3/6/12; narrow containers; multiple instances; updates/destruction;
Escape and focus restoration; no-JavaScript content; reduced motion and Save-Data;
media failures and suspension; editor changes and invalid input; portable exports;
and print content. Review the tests for exact assertions and emulation limits.

## Hosted verification

**Live:** [hickman.biz/portfolio/dossier-folders](https://hickman.biz/portfolio/dossier-folders)

`npm run verify:hosted -- https://hickman.biz/portfolio/dossier-folders` passed:
desktop/mobile layouts, refresh, JSON export/import, ZIP asset contents including
video, lazy motion loading, open/close, and no missing assets or browser errors.
The same check passed against the nested local production build. A direct
unauthenticated Vercel preview check could not pass the project's SSO protection;
this is an access limitation, not a component failure. Production was verified
without authentication. Deployment adds only the dedicated route and its assets.

Desktop, mobile, and open-record previews were captured and visually reviewed in
[previews](../previews). No physical-device, real Safari hardware, or dedicated
screen-reader testing was performed. Browser emulation does not substitute for
those checks. No GitHub Actions workload was added or used; npm publication is
deferred in favor of downloadable release archives.

## Reproduce

```sh
npm ci
npx playwright install chromium firefox webkit
npm run check
npm run test:browser
npm run pack:library
npm run verify:consumers
DEMO_BASE=/portfolio/dossier-folders/ npm run build
npm run verify:hosted -- https://hickman.biz/portfolio/dossier-folders
```

The asset generator additionally requires ffmpeg. Consumer checks use temporary,
independent projects and the actual package archive, without sibling checkouts.
An existing host build reports a large Three.js chunk warning; it predates this
route and is unrelated to this library. No known implementation test failures
remain. Dependency/browser downloads require network access.
