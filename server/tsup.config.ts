import { defineConfig } from "tsup";

// Production build. We *bundle* rather than plain-tsc so that @leetpix/shared —
// which is consumed as TypeScript source (its package.json points at src/*.ts) —
// gets inlined into the output. A plain tsc build leaves `import "@leetpix/shared"`
// in dist/, which Node then can't load at runtime (ERR_UNKNOWN_FILE_EXTENSION on
// the .ts). This mirrors how Vite already inlines shared into the client bundle.
//
// npm/node_modules deps (express, prisma, helmet, …) stay external and resolve
// from node_modules at runtime; only the workspace package is bundled in.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Force the workspace package to be bundled (tsup treats `dependencies` as
  // external by default, and shared is listed there as "*").
  noExternal: ["@leetpix/shared"],
});
