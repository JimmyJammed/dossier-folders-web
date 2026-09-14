import { defineConfig } from "vite";
import { renderDossierFoldersMarkup } from "./src/server";
import { makeConfig } from "./demo/fixtures";
export default defineConfig(({ mode }) => {
  const base = process.env.DEMO_BASE ?? "/";
  return {
    base,
    plugins: [
      {
        name: "static-records",
        transformIndexHtml(html) {
          return html.replace(
            "<!--records-->",
            renderDossierFoldersMarkup(makeConfig(base).options, {
              instanceId: "demo",
            }),
          );
        },
      },
    ],
    build: { outDir: "dist", emptyOutDir: true },
    server: { port: 5196, strictPort: true },
    define: { __BUILD_MODE__: JSON.stringify(mode) },
  };
});
