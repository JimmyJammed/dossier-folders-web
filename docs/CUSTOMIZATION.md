# Customize and export

Start with the six-record showcase, three-project collection, or neutral document
preset. Select a record in **Folders & tabs**. Add, duplicate, remove, or move it
with explicit buttons. Records retain their IDs when reordered.

Set the tab to text, a logo, or both. The accessible title always names the full
record. Choose colors directly or use **Auto ink**; the contrast indicator reports
normal-text AA contrast. The palette action recolors the collection. Three system
font presets are bundled without remote font requests.

**Record content** edits headers, chips, and blocks. Text paragraphs and bullets
are arrays of strings or structured inline arrays. The advanced JSON fields
preserve emphasis and links without allowing arbitrary HTML. Timeline entries use
`dates`, `title`, `body`, and optional `current`. Media fields edit captions,
alt text, dimensions, frames, optional actions, and automatic playback. Select
featured layout and mark one media block to use the desktop sidebar.

Changes apply after a short debounce; invalid inputs show a message while the
last valid preview stays usable. Structural changes settle open folders and
rebuild the collection. Presets and reset replace current edits.

## Assets

Use a relative path, HTTPS URL, or local file. Images support PNG, JPEG, WebP,
GIF, SVG, and AVIF; videos support MP4/WebM. The editor caps local files at 50 MB.
Files are held in browser memory, never uploaded. SVGs are loaded as images, not
inserted as markup. A file's native dimensions are not automatically inferred;
set the width/height fields for its intended aspect ratio.

**Export JSON** writes `dossier.config.json`, converting local object URLs into
portable asset paths. **Config + assets** writes a ZIP containing that JSON,
original built-in assets used by the configuration, and uploaded files. External
HTTPS assets stay external. Arbitrary custom relative assets must be available
at their configured path to bundle successfully. Imported JSON preserves its
paths; reselect local files or serve those paths when importing on another machine.

Place `assets/` in the application's public directory and pass `config.options`
to either integration example. Relative URLs resolve against the page URL, so use
an explicit site base or absolute site path for nested application routes. A ZIP
export is not a standalone application; install the package and use the example.

No drafts are saved automatically. Export before closing the page. Replacing
or resetting uploaded assets revokes object URLs after media teardown.
