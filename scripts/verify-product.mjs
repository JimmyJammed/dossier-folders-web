import { readFileSync, readdirSync, statSync } from "node:fs";
import assert from "node:assert/strict";
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`;
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
}
for (const dir of ["src", "demo", "public", "dist"]) walk(dir);
const prohibited =
  /rakuten|stumbleupon|grocertools|wellsfargo|pbhs|hickman-portfolio-website|\/Users\/jarvis|apps\.apple\.com|AKIA[0-9A-Z]{16}|gh[pousr]_[a-zA-Z0-9]{30,}/i;
for (const path of files)
  if (/\.(ts|tsx|js|css|html|svg|json|txt|md)$/.test(path))
    assert.ok(
      !prohibited.test(readFileSync(path, "utf8")),
      `Private source or data in ${path}`,
    );
const bundle = readFileSync("dist/library/index.js", "utf8");
assert.ok(!/from ["']react/.test(bundle));
assert.ok(
  readFileSync("dist/library/controller.js", "utf8").includes("initDossier"),
);
assert.ok(!readFileSync("src/styles.css", "utf8").includes("/fonts/"));
console.log(
  `Product boundary and package checks passed (${files.length} files inspected).`,
);
