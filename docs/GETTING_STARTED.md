# Getting started

1. Install Node 22.18+ and npm.
2. Clone the repository and run `npm ci`.
3. Run `npm run dev`; open the printed local URL.
4. Customize the demo, export configuration/assets, and try the examples.
5. Run `npm run check` and `npm run test:browser` before changing a release.

Install Playwright browsers once with `npx playwright install`. The repository
ships its sample assets; `npm run generate:assets` is optional and additionally
requires `ffmpeg` on PATH.

`npm run build` writes the demo to `dist/` and the library to `dist/library/`.
`npm run pack:library` writes an installable archive and SHA-256 to `artifacts/`.
`npm run verify:consumers` installs that archive into fresh temporary vanilla,
React 18, and React 19 projects and verifies types, SSR, builds, and browser use.
It may access the public npm registry. There is no public npm release yet.

See API.md for the record schema and examples/ for minimal integrations. Import
the stylesheet explicitly. A meaningful no-JavaScript fallback needs server-
rendered markup; an empty client-only mount naturally has no content before JS.
