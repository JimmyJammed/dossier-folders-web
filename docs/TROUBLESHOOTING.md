# Troubleshooting

- **Flat records instead of a cabinet:** confirm the stylesheet and lazy controller
  load. The readable layout is intentional when enhancement is unavailable.
- **No automatic playback:** check reduced motion, Save-Data, per-block autoplay,
  and the global autoplay option. Browser autoplay policy can also block it;
  native controls remain available.
- **Tiny or clipped logos:** use sensible logo dimensions and a short visible
  label. The complete accessible name comes from the record title.
- **An update does not apply:** inspect the field-path error. Updates are atomic;
  correct the configuration rather than mutating the component's internal DOM.
- **Image missing after JSON import:** JSON contains paths, not image bytes. Export
  the ZIP and place assets under the page's asset directory, or reselect local files.
- **Nested-route 404s:** rebuild with DEMO_BASE and verify the configured prefix.
- **Duplicate IDs:** each record ID must be unique within one instance; server
  instance IDs must be unique across the document.
- **React hydration warning:** render identical options on server/client and retain
  a stable component identity. The client exclusively owns the enhanced inner DOM.
- **Browser tests cannot launch:** install Playwright browsers and ensure the host
  permits browser processes. Report launch failures separately from test failures.
- **Gallery image fails:** the previous image stays visible, rotation stops, and
  the status explains the problem. Use previous/next to choose another image.
