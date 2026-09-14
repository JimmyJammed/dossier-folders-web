import {
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const version = JSON.parse(readFileSync("package.json", "utf8")).version,
  stage = resolve(".package-staging"),
  out = resolve("artifacts");
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
mkdirSync(out, { recursive: true });
cpSync("dist/library", `${stage}/dist`, { recursive: true });
cpSync("src/styles.css", `${stage}/styles.css`);
for (const file of ["LICENSE", "THIRD_PARTY_LICENSES.md", "README.md"])
  cpSync(file, `${stage}/${file}`);
const exports = {};
for (const key of ["index", "react", "server"])
  exports[key === "index" ? "." : `./${key}`] = {
    types: `./dist/${key}.d.ts`,
    import: `./dist/${key}.js`,
  };
exports["./styles.css"] = "./styles.css";
writeFileSync(
  `${stage}/package.json`,
  JSON.stringify(
    {
      name: "dossier-folders",
      version,
      type: "module",
      license: "MIT",
      description:
        "Tactile, accessible folder UI for stories, projects, and collections.",
      repository: {
        type: "git",
        url: "https://github.com/JimmyJammed/dossier-folders-web.git",
      },
      main: "./dist/index.js",
      types: "./dist/index.d.ts",
      exports,
      sideEffects: ["**/*.css"],
      dependencies: { gsap: "3.15.0" },
      peerDependencies: { react: ">=18 <20" },
      peerDependenciesMeta: { react: { optional: true } },
      files: [
        "dist",
        "styles.css",
        "LICENSE",
        "README.md",
        "THIRD_PARTY_LICENSES.md",
      ],
    },
    null,
    2,
  ),
);
execFileSync("npm", ["pack", "--pack-destination", out], {
  cwd: stage,
  stdio: "inherit",
});
rmSync(stage, { recursive: true, force: true });
const name = `dossier-folders-${version}.tgz`;
writeFileSync(
  `${out}/${name}.sha256`,
  `${createHash("sha256")
    .update(readFileSync(`${out}/${name}`))
    .digest("hex")}  ${name}\n`,
);
