import test from "node:test";
import assert from "node:assert/strict";
import { mapAssets, safeArchivePath } from "../demo/portable.ts";
import { makeConfig } from "../demo/fixtures.ts";
test("portable asset mapping preserves literal record text and supports nested demo import", () => {
  const c = makeConfig("/portfolio/dossier-folders/");
  c.options.records[0].summary =
    "A path /portfolio/dossier-folders/assets/ should stay literal.";
  const portable = mapAssets(c, (s) =>
    s.replace("/portfolio/dossier-folders/assets/", "assets/"),
  );
  assert.equal(
    portable.options.records[0].summary,
    c.options.records[0].summary,
  );
  assert.equal(portable.options.records[0].tab.logo.src, "assets/logo-0.svg");
  assert.equal(
    mapAssets(portable, (s) =>
      s.startsWith("assets/") ? "/portfolio/dossier-folders/" + s : s,
    ).options.records[0].tab.logo.src,
    c.options.records[0].tab.logo.src,
  );
});
test("archive paths cannot traverse directories", () => {
  assert.equal(safeArchivePath("assets/normal.svg"), true);
  for (const path of [
    "assets/../secret",
    "assets/./x",
    "assets//x",
    "assets/..\\x",
    "../secret",
  ])
    assert.equal(safeArchivePath(path), false);
});
