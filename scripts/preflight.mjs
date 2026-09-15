/**
 * Check everything a deploy depends on, before deploying.
 *
 *   npm run preflight                   # env file, WordPress, the plugin, the live app
 *   npm run preflight -- --pre-deploy   # what `npm run deploy` runs first: skips the live app
 *
 * Every check here is something that went wrong on a real first deploy.
 * No dependencies. Exit code 1 when something must be fixed; warnings do not fail.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const preDeploy = process.argv.includes("--pre-deploy");
const headers = { Accept: "application/json", "User-Agent": "pressy-next/1.0" };

// ---- Reporting ------------------------------------------------------------------

let failures = 0;
let warnings = 0;
const section = (title) => console.log(`\n${title}`);
const ok = (msg) => console.log(`  ok    ${msg}`);
const info = (msg) => console.log(`  info  ${msg}`);
const warn = (msg, ...lines) => {
  warnings += 1;
  console.log(`  warn  ${msg}`);
  for (const line of lines) console.log(`        ${line}`);
};
const fail = (msg, ...lines) => {
  failures += 1;
  console.log(`  FAIL  ${msg}`);
  for (const line of lines) console.log(`        ${line}`);
};

// ---- Env file ---------------------------------------------------------------------

/** KEY=value lines, optional quotes, no expansion. */
function readEnv(file) {
  const path = join(root, file);
  if (!existsSync(path)) return null;
  const values = new Map();
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    let value = line.slice(eq + 1).trim();
    const quoted = value.match(/^(['"])(.*)\1$/);
    if (quoted) value = quoted[2];
    values.set(key, value);
  }
  return values;
}

section("Env file");
const dotEnv = readEnv(".env");
const dotProd = readEnv(".env.production");
if (!dotEnv && !dotProd) fail("No .env found.", "Copy .env.example to .env and fill in every value.");
if (dotEnv) ok(".env found");
if (dotProd) {
  info(".env.production found: it ships to the server as is and overrides .env at build time");
  const leaked = [...dotProd.keys()].filter((key) => key.startsWith("PRESSY_"));
  if (leaked.length) fail(`.env.production contains ${leaked.join(", ")}.`, "That file is uploaded. Deploy settings belong in .env only.");
}

/** What the build and the server see: .env.production wins, .env fills the gaps. */
const effective = (key) => process.env[key] || dotProd?.get(key) || dotEnv?.get(key) || "";
const deploySetting = (key) => process.env[key] || dotEnv?.get(key) || "";

function parseUrl(key, value) {
  if (!value) {
    fail(`${key} is empty.`);
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("not http(s)");
    return url;
  } catch {
    fail(`${key} is not a URL: ${value}`);
    return null;
  }
}

const WP_URL = effective("WP_URL").replace(/\/$/, "");
const SITE_URL = effective("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "");
const SECRET = effective("REVALIDATE_SECRET");

const wp = parseUrl("WP_URL", WP_URL);
if (wp) {
  if (/\/wp-json/.test(wp.pathname)) fail("WP_URL must be the WordPress base URL, without /wp-json.");
  else ok(`WP_URL ${WP_URL}`);
  if (wp.protocol === "http:") warn("WP_URL is plain http, so every image and API call is unencrypted.");
}
const app = parseUrl("NEXT_PUBLIC_SITE_URL", SITE_URL);
if (app) {
  const basePath = app.pathname.replace(/\/$/, "");
  ok(`NEXT_PUBLIC_SITE_URL ${SITE_URL}${basePath ? ` (served under the path ${basePath})` : " (served at a domain root)"}`);
  if (wp && wp.host === app.host && !basePath) {
    fail("WP_URL and NEXT_PUBLIC_SITE_URL are the same address.", "Give the app its own domain, or a path such as https://site.example/news.");
  }
}
if (!SECRET) fail("REVALIDATE_SECRET is empty.", "Generate one: openssl rand -hex 32");
else if (SECRET === "change-me" || SECRET.length < 16) fail("REVALIDATE_SECRET is a placeholder or too short.", "Generate one: openssl rand -hex 32");
else ok("REVALIDATE_SECRET set");

const PRESSY_SSH = deploySetting("PRESSY_SSH");
const PRESSY_DIR = deploySetting("PRESSY_DIR") || "news";
const PRESSY_WP_DIR = deploySetting("PRESSY_WP_DIR");
if (!PRESSY_SSH) warn("PRESSY_SSH is empty. npm run deploy needs it, as user@host.");
else ok(`PRESSY_SSH ${PRESSY_SSH}`);
const homeDeploy = [".", "./", "~", "/"].includes(PRESSY_DIR);
info(`app folder on the server: ${homeDeploy ? "the SSH home itself" : PRESSY_DIR}. Panel startup command: node ${homeDeploy ? "" : `${PRESSY_DIR}/`}entry.js`);
if (homeDeploy) warn("PRESSY_DIR points at the SSH home, so the upload cannot delete stale files.", "A folder of its own, such as PRESSY_DIR=app, is safer.");
if (PRESSY_WP_DIR) info(`WordPress folder on the server: ${PRESSY_WP_DIR}. The plugin is installed into ${PRESSY_WP_DIR}/wp-content/mu-plugins/ on deploy`);
else warn("PRESSY_WP_DIR is empty, so the deploy will not install the WordPress plugin.", "Set it to the folder holding wp-config.php, often public_html, or copy the plugin by hand. See docs/deploy.md.");

// ---- WordPress --------------------------------------------------------------------

async function get(url, init = {}) {
  const response = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(15_000), ...init });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: response.status, headers: response.headers, text, json };
}

let wpReachable = false;
if (wp) {
  section("WordPress");
  try {
    const rootResponse = await get(`${WP_URL}/wp-json/`);
    if (rootResponse.status >= 300 && rootResponse.status < 400) {
      fail(`${WP_URL}/wp-json/ redirects to ${rootResponse.headers.get("location")}.`, "WP_URL must be the address WordPress itself answers on, with the right scheme and host.");
    } else if (!rootResponse.json || typeof rootResponse.json !== "object") {
      fail(`${WP_URL}/wp-json/ did not return JSON (status ${rootResponse.status}).`, "Set permalinks in WordPress to anything other than Plain, and check that WP_URL is right.");
    } else {
      wpReachable = true;
      ok(`REST API answers at ${WP_URL}/wp-json/`);
      const home = String(rootResponse.json.home ?? "").replace(/\/$/, "");
      let homeHost = "";
      try {
        homeHost = home ? new URL(home).host : "";
      } catch {
        /* leave empty */
      }
      if (homeHost && homeHost !== wp.host) {
        fail(
          `WordPress thinks its own address is ${home}, not ${WP_URL}.`,
          "Every image and admin link is built from that setting, so images 404 in the app.",
          "Hosting panels rewrite it when the primary domain changes. Fix over SSH, in the WordPress folder:",
          `  wp option update siteurl ${WP_URL} && wp option update home ${WP_URL}`,
        );
      } else {
        ok(`WordPress address is ${home || WP_URL}`);
      }
      const name = String(rootResponse.json.name ?? "").trim();
      if (!name || name === wp.host) {
        warn(`The WordPress site title is "${name || "empty"}". It becomes the site name and favicon.`, "Set it under Settings, General, or override site.name in lib/site.ts.");
      } else {
        ok(`site title "${name}"`);
      }
    }
  } catch (error) {
    fail(`Could not reach ${WP_URL}: ${error?.message ?? error}`);
  }
}

if (wpReachable) {
  try {
    const posts = await get(`${WP_URL}/wp-json/wp/v2/posts?per_page=1&_embed=wp:featuredmedia`);
    const list = Array.isArray(posts.json) ? posts.json : [];
    const total = Number(posts.headers.get("x-wp-total") ?? list.length);
    if (!total) warn("WordPress has no published posts, so the front page will be empty.");
    else ok(`${total} published post${total === 1 ? "" : "s"}`);
    const media = list[0]?._embedded?.["wp:featuredmedia"]?.[0];
    const source = typeof media?.source_url === "string" ? media.source_url : "";
    if (source) {
      const host = new URL(source).host;
      if (host !== wp.host) fail(`Image URLs point at ${host}, not ${wp.host}.`, "The app only loads images from the WP_URL host. Usually the WordPress address above is the cause.");
      else ok(`images served from ${host}`);
    } else {
      info("the newest post has no featured image; every layout has a no-image variant");
    }
  } catch (error) {
    warn(`Could not read posts: ${error?.message ?? error}`);
  }
}

// ---- The plugin -------------------------------------------------------------------

if (wpReachable) {
  section("WordPress plugin");
  // Before a deploy that will install the plugin, its absence is expected.
  const notYet = preDeploy && PRESSY_WP_DIR ? info : fail;
  const installHint = PRESSY_WP_DIR
    ? "npm run deploy:plugin installs it."
    : "Set PRESSY_WP_DIR in .env and run npm run deploy:plugin, or install it by hand. See docs/deploy.md.";
  try {
    const status = await get(`${WP_URL}/wp-json/pressy/v1/status`);
    if (status.status === 404 || !status.json || status.json.plugin !== "pressy-headless") {
      // Plugin 1.0 had no status endpoint. Its redirect of the WordPress front page gives it away.
      const front = await get(`${WP_URL}/`, { headers: { "User-Agent": headers["User-Agent"] } });
      const location = front.headers.get("location") ?? "";
      if (front.status === 302 && SITE_URL && location.startsWith(SITE_URL)) {
        notYet(`An older version of the plugin is installed on ${wp.host}.`, "It works, but cannot report its settings.", installHint.replace("installs", "updates"));
      } else {
        notYet(`The plugin is not installed on ${wp.host}.`, "Without it, edits take up to 10 minutes to show and WordPress URLs do not redirect to the app.", installHint);
      }
    } else if (!status.json.configured) {
      notYet("The plugin is installed but has no settings yet.", installHint);
    } else {
      const nextBase = String(status.json.next_base ?? "").replace(/\/$/, "");
      if (SITE_URL && nextBase !== SITE_URL) notYet(`The plugin points at ${nextBase}, but NEXT_PUBLIC_SITE_URL is ${SITE_URL}.`, installHint);
      else ok(`plugin ${status.json.version} installed and pointing at ${nextBase}`);
    }
  } catch (error) {
    warn(`Could not read the plugin status: ${error?.message ?? error}`);
  }
}

// ---- The live app -----------------------------------------------------------------

if (app && !preDeploy) {
  section("Live app");
  try {
    const front = await get(`${SITE_URL}/`, { headers: { "User-Agent": headers["User-Agent"] } });
    const poweredBy = front.headers.get("x-powered-by") ?? "";
    if (front.status >= 300 && front.status < 400) {
      fail(`${SITE_URL}/ redirects to ${front.headers.get("location")}.`, "NEXT_PUBLIC_SITE_URL must be the final address, with the right scheme and host.");
    } else if (front.text.includes("/_next/")) {
      ok(`${SITE_URL}/ is answered by the app (${front.status})`);
    } else if (/php/i.test(poweredBy) || /wp-content|wp-includes/.test(front.text)) {
      fail(
        `${SITE_URL}/ is answered by WordPress, not the app (${front.status}).`,
        "The domain is not routed to the Node app. In the hosting panel, make the app's domain",
        "primary and leave the proxy path blank so the whole domain reaches the app's port.",
      );
    } else {
      fail(`${SITE_URL}/ answered ${front.status}, but not with the app.`, "Check the panel's proxy settings and the startup command.");
    }
    const revalidate = await get(`${SITE_URL}/api/revalidate`, { method: "POST" });
    if (revalidate.status === 401) ok("revalidate endpoint rejects a request without the secret");
    else warn(`POST ${SITE_URL}/api/revalidate answered ${revalidate.status}, expected 401.`);
  } catch (error) {
    info(`${SITE_URL} is not answering yet (${error?.message ?? error}). Expected before the first deploy.`);
  }
}

// ---- Summary ----------------------------------------------------------------------

console.log("");
if (failures) {
  console.log(`${failures} problem${failures === 1 ? "" : "s"} to fix${warnings ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}.`);
  process.exit(1);
}
console.log(warnings ? `Ready, with ${warnings} warning${warnings === 1 ? "" : "s"}.` : "Ready.");
