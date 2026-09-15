// Bundles src/lambda.ts (plus all its deps) into a single CJS file so the
// Lambda zip doesn't need a node_modules folder at all.
import { build } from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync("build", { recursive: true });

await build({
  entryPoints: ["src/lambda.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "build/lambda.js",
  sourcemap: false,
  minify: false,
  logLevel: "info",
});
