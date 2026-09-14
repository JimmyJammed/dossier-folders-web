# Deployment

The demonstration is an ordinary static Vite build. The package requires no
server. Build at the final path prefix:

```sh
DEMO_BASE=/portfolio/dossier-folders/ npm run build
```

The verified public destination is intended to be
`https://hickman.biz/portfolio/dossier-folders`. The existing website owns routing
and deployment; this repository owns the component and demo source. Copy only
the demo's index and assets to that route. Do not deploy `dist/library/`, private
working directories, source maps, or package-staging directories as demo assets.

For a root-hosted demo use `npm run build` without DEMO_BASE. `npm run preview`
serves the built output locally. All built-in media URLs and script/style URLs
are generated using the configured base. Set trailing-slash handling consistently;
asset paths in the published build use the explicit prefix.

Serve MP4/WebM with the correct MIME type and range support. Keep HTML revalidated;
content-hashed JS/CSS may be cached immutably. Original named sample media should
be revalidated on a release. No DNS changes or GitHub Actions workflow is needed.

Before promotion, verify the route, refresh, all assets, and an open/close cycle.
Keep unrelated host routes and content unchanged. Retain the prior hosting
revision for rollback. Record deployment/release results in VALIDATION.md.
