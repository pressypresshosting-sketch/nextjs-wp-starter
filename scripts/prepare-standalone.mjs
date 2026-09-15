// Copies public/ and .next/static/ into the standalone output so that
// `node .next/standalone/server.js` serves a complete site. Runs as the
// `postbuild` script and again from `npm run deploy`.
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

if (!existsSync(join(standalone, "server.js"))) {
  console.error("No .next/standalone/server.js found. Run `npm run build` first (next.config.ts must keep output: 'standalone').");
  process.exit(1);
}

const publicDir = join(root, "public");
if (existsSync(publicDir)) {
  cpSync(publicDir, join(standalone, "public"), { recursive: true });
  console.log("Copied public/ -> .next/standalone/public/");
}

const staticDir = join(root, ".next", "static");
if (existsSync(staticDir)) {
  cpSync(staticDir, join(standalone, ".next", "static"), { recursive: true });
  console.log("Copied .next/static/ -> .next/standalone/.next/static/");
}

// Entry point that re-adds the path prefix the PressyPress proxy strips.
// See scripts/standalone-entry.cjs; the panel's start command runs this file.
cpSync(join(root, "scripts", "standalone-entry.cjs"), join(standalone, "entry.js"));
console.log("Copied scripts/standalone-entry.cjs -> .next/standalone/entry.js");

console.log("Standalone build is ready in .next/standalone/");
