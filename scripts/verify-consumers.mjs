import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  cpSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import { makeConfig } from "../demo/fixtures.ts";
const root = process.cwd(),
  version = JSON.parse(readFileSync("package.json")).version,
  archive = resolve(`artifacts/dossier-folders-${version}.tgz`);
if (!existsSync(archive)) throw new Error("Run npm run pack:library first.");
const configs = [
  ["vanilla", null],
  ["react18", "18.3.1"],
  ["react19", "19.1.1"],
];
const browser = await chromium.launch();
try {
  for (const [name, react] of configs) {
    const dir = mkdtempSync(join(tmpdir(), `dossier-${name}-`));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        private: true,
        type: "module",
        dependencies: {
          "dossier-folders": `file:${archive}`,
          ...(react ? { react, "react-dom": react } : {}),
        },
        devDependencies: {
          vite: "6.4.3",
          typescript: "5.9.3",
          ...(react
            ? {
                "@types/react": react.startsWith("18") ? "^18.3.0" : "^19.1.0",
                "@types/react-dom": react.startsWith("18")
                  ? "^18.3.0"
                  : "^19.1.0",
              }
            : {}),
        },
      }),
    );
    execFileSync("npm", ["install", "--no-audit", "--no-fund"], {
      cwd: dir,
      stdio: "pipe",
    });
    const config = makeConfig("/");
    config.options.motion = "reduced";
    writeFileSync(join(dir, "dossier.config.json"), JSON.stringify(config));
    mkdirSync(join(dir, "public"), { recursive: true });
    cpSync(join(root, "public/assets"), join(dir, "public/assets"), {
      recursive: true,
    });
    const ssr = `import {renderDossierFoldersMarkup} from 'dossier-folders/server';import {readFileSync} from 'node:fs';const c=JSON.parse(readFileSync('dossier.config.json'));const markup=renderDossierFoldersMarkup(c.options,{instanceId:'consumer'});if(!markup.includes('Orbit Market'))throw new Error('SSR failed');console.log('Server import and render passed');`;
    writeFileSync(join(dir, "ssr.mjs"), ssr);
    execFileSync("node", ["ssr.mjs"], { cwd: dir, stdio: "pipe" });
    let markup = "";
    if (react) {
      writeFileSync(
        join(dir, "react-ssr.mjs"),
        `import React from 'react';import{renderToString}from'react-dom/server';import{DossierFolders}from'dossier-folders/react';import{readFileSync,writeFileSync}from'node:fs';const c=JSON.parse(readFileSync('dossier.config.json'));writeFileSync('markup.html',renderToString(React.createElement(React.StrictMode,null,React.createElement(DossierFolders,{options:c.options}))));`,
      );
      execFileSync("node", ["react-ssr.mjs"], { cwd: dir, stdio: "pipe" });
      markup = readFileSync(join(dir, "markup.html"), "utf8");
    }
    writeFileSync(
      join(dir, "index.html"),
      `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consumer</title></head><body><main id="app">${markup}</main><script type="module" src="/main.ts${react ? "x" : ""}"></script></body></html>`,
    );
    const source = react
      ? `import React from 'react';import{hydrateRoot}from'react-dom/client';import{DossierFolders}from'dossier-folders/react';import type{DossierOptions}from'dossier-folders';import'dossier-folders/styles.css';import config from './dossier.config.json';hydrateRoot(document.querySelector('#app')!,<React.StrictMode><DossierFolders options={config.options as DossierOptions}/></React.StrictMode>);`
      : `import{createDossierFolders}from'dossier-folders';import type{DossierOptions}from'dossier-folders';import'dossier-folders/styles.css';import config from './dossier.config.json';const folders=createDossierFolders(document.querySelector('#app')!,config.options as DossierOptions);Object.assign(window,{folders});`;
    writeFileSync(join(dir, `main.ts${react ? "x" : ""}`), source);
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          lib: ["ES2022", "DOM"],
          strict: true,
          skipLibCheck: true,
          jsx: "react-jsx",
          resolveJsonModule: true,
          noEmit: true,
        },
        include: ["main.ts", "main.tsx"],
      }),
    );
    execFileSync(join(dir, "node_modules/.bin/tsc"), ["--noEmit"], {
      cwd: dir,
      stdio: "pipe",
    });
    execFileSync(join(dir, "node_modules/.bin/vite"), ["build"], {
      cwd: dir,
      stdio: "pipe",
    });
    const server = createServer((req, res) => {
      const path = join(
        dir,
        "dist",
        decodeURIComponent(
          req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0],
        ),
      );
      try {
        const mime = path.endsWith(".js")
          ? "text/javascript"
          : path.endsWith(".css")
            ? "text/css"
            : path.endsWith(".svg")
              ? "image/svg+xml"
              : path.endsWith(".mp4")
                ? "video/mp4"
                : path.endsWith(".png")
                  ? "image/png"
                  : "text/html";
        res.setHeader("Content-Type", mime);
        res.end(readFileSync(path));
      } catch {
        res.statusCode = 404;
        res.end();
      }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    try {
      const page = await browser.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.locator(".dossier[data-enhanced]").waitFor();
      await page
        .getByRole("button", { name: "Open Orbit Market", exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelector(".dossier")?.dataset.state === "open",
      );
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => document.querySelector(".dossier")?.dataset.state === "closed",
      );
      if (errors.length) throw new Error(errors.join("\n"));
      await page.close();
      console.log(
        `${name}: isolated install, types, SSR, production build, browser open/close passed.`,
      );
    } finally {
      await new Promise((r) => server.close(r));
    }
  }
} finally {
  await browser.close();
}
