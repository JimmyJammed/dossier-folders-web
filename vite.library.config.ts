import { defineConfig } from "vite";
export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist/library",
    emptyOutDir: true,
    lib: {
      entry: {
        index: "src/index.ts",
        react: "src/react.tsx",
        server: "src/server.ts",
        controller: "src/controller.ts",
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: (id) => /^(gsap|react|react-dom)(\/|$)/.test(id),
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
});
