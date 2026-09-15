// Cross-platform launcher for scripts/deploy.sh.
//
// 1. Loads PRESSY_* settings (PRESSY_SSH, PRESSY_PASSWORD, PRESSY_PORT,
//    PRESSY_DIR, PRESSY_WP_DIR) from .env / .env.local so they need not be
//    exported each time. Variables already set in the shell win. Only PRESSY_*
//    keys are read here; deploy.sh reads the app's own values itself.
// 2. Runs deploy.sh with Git Bash on Windows (npm scripts go through cmd.exe
//    there, which has no `bash` on PATH) and with plain `bash` elsewhere.
// All arguments (--dry-run, --skip-build, --skip-plugin, --plugin-only,
// --skip-preflight) pass straight through.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "scripts", "deploy.sh");

/** Minimal dotenv reader: KEY=value, optional quotes, no expansion, # comments. */
function loadPressyEnv(file) {
  if (!existsSync(file)) return [];
  const loaded = [];
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    if (!key.startsWith("PRESSY_")) continue;
    let value = line.slice(eq + 1).trim();
    const quoted = value.match(/^(['"])(.*)\1$/);
    if (quoted) value = quoted[2];
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
      loaded.push(key);
    }
  }
  return loaded;
}

const loaded = [...loadPressyEnv(join(root, ".env")), ...loadPressyEnv(join(root, ".env.local"))];
if (loaded.length) console.log(`deploy: using ${loaded.join(", ")} from .env`);

function findBash() {
  if (process.env.PRESSY_BASH) return process.env.PRESSY_BASH;
  if (process.platform !== "win32") return "bash";
  const candidates = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    join(process.env.LOCALAPPDATA ?? "", "Programs", "Git", "bin", "bash.exe"),
    join(process.env.ProgramW6432 ?? "", "Git", "bin", "bash.exe"),
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (found) return found;
  console.error(
    "Git Bash was not found. Install Git for Windows (https://git-scm.com), or set PRESSY_BASH to the path of a bash.exe.\n" +
      "Note: C:\\Windows\\System32\\bash.exe is WSL, which works too if rsync/ssh are installed inside it.",
  );
  process.exit(1);
}

const result = spawnSync(findBash(), [script, ...process.argv.slice(2)], { stdio: "inherit", env: process.env, cwd: root });
process.exit(result.status ?? 1);
