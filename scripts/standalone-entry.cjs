/**
 * Standalone entry point for hosts whose path proxy STRIPS the path prefix.
 *
 * The PressyPress panel proxies https://your-site.example/news to this app's
 * port, but forwards the request as "/latest" rather than "/news/latest".
 * The app is built with basePath "/news", so it would answer 404 for every
 * URL and serve no CSS. This wrapper puts the prefix back on the incoming
 * request URL, then hands over to the generated server.js unchanged.
 *
 * It is idempotent: a request that already carries the prefix is left alone,
 * so the same file keeps working if the proxy is ever changed to preserve the
 * path. With no basePath configured it does nothing at all.
 *
 * Start with:  node entry.js   (or `node news/entry.js` from the parent dir)
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

/** basePath = pathname of NEXT_PUBLIC_SITE_URL, the same rule next.config.ts uses. */
function readBasePath() {
  if (process.env.BASE_PATH !== undefined) return process.env.BASE_PATH.replace(/\/$/, "");
  const envFile = path.join(__dirname, ".env.production");
  let siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl && fs.existsSync(envFile)) {
    for (const raw of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      if (line.slice(0, eq).trim() !== "NEXT_PUBLIC_SITE_URL") continue;
      siteUrl = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  if (!siteUrl) return "";
  try {
    return new URL(siteUrl).pathname.replace(/\/$/, "");
  } catch {
    return "";
  }
}

const BASE = readBasePath();

if (BASE) {
  const createServer = http.createServer;
  http.createServer = function patched(options, listener) {
    const handler = typeof options === "function" ? options : listener;
    const wrapped = (req, res) => {
      const url = req.url ?? "/";
      const q = url.indexOf("?");
      const pathname = q === -1 ? url : url.slice(0, q);
      const search = q === -1 ? "" : url.slice(q);
      // Segment-aware check, so a slug such as /newsroom-story is not mistaken
      // for a request that already carries the /news prefix.
      if (pathname !== BASE && !pathname.startsWith(`${BASE}/`)) {
        req.url = `${BASE}${pathname === "/" ? "" : pathname}${search}`;
      }
      return handler(req, res);
    };
    return typeof options === "function" ? createServer(wrapped) : createServer(options, wrapped);
  };
  console.log(`[entry] proxy strips the path prefix; re-adding "${BASE}" to incoming requests`);
}

require("./server.js");
