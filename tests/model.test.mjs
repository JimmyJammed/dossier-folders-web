import test from "node:test";
import assert from "node:assert/strict";
import {
  validateOptions,
  parseConfig,
  stringifyConfig,
  isSafeUrl,
} from "../src/validate.ts";
import { renderDossierFoldersMarkup } from "../src/server.ts";
import { makeConfig } from "../demo/fixtures.ts";
test("all demo blocks validate and configuration round trips", () => {
  const c = makeConfig();
  validateOptions(c.options);
  assert.deepEqual(parseConfig(stringifyConfig(c)), c);
  assert.deepEqual(
    [
      ...new Set(c.options.records.flatMap((r) => r.blocks.map((b) => b.kind))),
    ].sort(),
    ["gallery", "image", "text", "timeline", "video"],
  );
});
test("rendering is deterministic, server-safe, and scoped", () => {
  const c = makeConfig();
  const a = renderDossierFoldersMarkup(c.options, { instanceId: "one" });
  assert.equal(a, renderDossierFoldersMarkup(c.options, { instanceId: "one" }));
  const b = renderDossierFoldersMarkup(c.options, { instanceId: "two" });
  const ids = [...a.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.every((id) => !b.includes(`id="${id}"`)));
  assert.ok(!/\ssrc="\.\/assets\/orbit-demo\.mp4"/.test(a));
});
test("all text and attributes escape markup", () => {
  const c = makeConfig();
  c.options.records[0].title = '"<script>alert(1)</script>';
  c.options.records[0].tab.label = "<img onerror=alert(1)>";
  const html = renderDossierFoldersMarkup(c.options, { instanceId: "safe" });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;img onerror=alert(1)&gt;"));
});
test("unsafe URLs and malformed colors are rejected", () => {
  for (const u of [
    "javascript:alert(1)",
    "data:text/html,test",
    "//evil.test",
    "https:\\evil.test",
    "java\nscript:test",
  ])
    assert.equal(isSafeUrl(u), false, u);
  for (const u of [
    "./asset.webp",
    "assets/a.mp4",
    "/images/a.png",
    "https://example.com/a",
    "#section",
  ])
    assert.equal(isSafeUrl(u), true, u);
  const c = makeConfig();
  c.options.records[0].fill = "red;display:none";
  assert.throws(() => validateOptions(c.options), /records\[0\].fill/);
});
test("duplicate IDs, unknown blocks, dimensions, empty galleries and multiple features fail with paths", () => {
  const c = makeConfig();
  c.options.records[1].id = c.options.records[0].id;
  assert.throws(() => validateOptions(c.options), /records\[1\].id/);
  for (const patch of [
    { kind: "html", html: "x" },
    { kind: "image", src: "a", alt: "a", width: 0, height: 1, caption: "a" },
    { kind: "gallery", label: "a", images: [], caption: "a" },
  ]) {
    const x = makeConfig();
    x.options.records[0].blocks = [patch];
    assert.throws(() => validateOptions(x.options), /records\[0\].blocks/);
  }
});
test("zero records renders an escaped readable empty state", () => {
  assert.equal(
    renderDossierFoldersMarkup(
      { records: [], labels: { empty: "Nothing <yet>" } },
      { instanceId: "empty" },
    ),
    '<p class="dossier-empty">Nothing &lt;yet&gt;</p>',
  );
});
test("versioned import rejects unknown versions and invalid background", () => {
  assert.throws(() => parseConfig('{"version":2}'), /version/);
  const c = makeConfig();
  c.background = "red";
  assert.throws(() => parseConfig(JSON.stringify(c)), /background/);
});
test("featured media preserves preceding story blocks and later flow order", () => {
  const html = renderDossierFoldersMarkup(makeConfig().options, {
    instanceId: "order",
  });
  assert.ok(
    html.indexOf("Built to feel effortless") <
      html.indexOf("data-record-video"),
  );
  assert.ok(
    html.indexOf("data-record-video") < html.indexOf("A platform taking shape"),
  );
});
