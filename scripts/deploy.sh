#!/usr/bin/env bash
# Build locally, ship the standalone bundle over SSH, install the WordPress
# plugin, restart, smoke test.
#
#   npm run deploy                    # preflight, build, upload, plugin, restart, smoke test
#   npm run deploy -- --skip-build    # reuse the existing .next/standalone
#   npm run deploy -- --dry-run       # stop before anything reaches the server
#   npm run deploy -- --skip-plugin   # leave the WordPress side alone
#   npm run deploy:plugin             # only the WordPress plugin (--plugin-only)
#
# Settings, read from .env by scripts/deploy.mjs:
#   PRESSY_SSH       user@host
#   PRESSY_PORT      SSH port, default 22
#   PRESSY_DIR       remote folder for the app, relative to the SSH home, default news
#   PRESSY_WP_DIR    remote folder holding wp-config.php, e.g. public_html. Empty skips the plugin
#   PRESSY_PASSWORD  optional; handed to ssh through scripts/ssh-askpass.sh, so nothing is prompted
#
# Nothing is built or installed on the server: the standalone folder carries
# its own node_modules, so the upload is the whole install.
set -euo pipefail

: "${PRESSY_SSH:?Set PRESSY_SSH (e.g. PRESSY_SSH=user@your-server.example) in .env}"
PRESSY_DIR="${PRESSY_DIR:-news}"
PRESSY_PORT="${PRESSY_PORT:-22}"
PRESSY_WP_DIR="${PRESSY_WP_DIR:-}"
SKIP_BUILD=0; DRY_RUN=0; SKIP_PLUGIN=0; PLUGIN_ONLY=0; SKIP_PREFLIGHT=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --skip-plugin) SKIP_PLUGIN=1 ;;
    --plugin-only) PLUGIN_ONLY=1 ;;
    --skip-preflight) SKIP_PREFLIGHT=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."
STANDALONE=".next/standalone"
PLUGIN_DIR="wordpress/mu-plugins"
PLUGIN_CONFIG="$PLUGIN_DIR/pressy-headless-config.php"

step() { printf '\n== %s\n' "$*"; }

# SSH options shared by rsync, the plugin upload, the restart and the tar fallback.
SSH_OPTS=(-p "$PRESSY_PORT" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)
if [ -n "${PRESSY_PASSWORD:-}" ]; then
  chmod +x scripts/ssh-askpass.sh
  export SSH_ASKPASS="$PWD/scripts/ssh-askpass.sh" SSH_ASKPASS_REQUIRE=force
  SSH_OPTS+=(-o PubkeyAuthentication=no -o PreferredAuthentications=password,keyboard-interactive)
  echo "ssh: password mode (PRESSY_PASSWORD via scripts/ssh-askpass.sh)"
fi
SSH_CMD="ssh ${SSH_OPTS[*]}"

# What ships to the server. A hand-written .env.production wins and is uploaded
# as is; otherwise every line of .env that is not PRESSY_ or WORKFLOW_ is: the
# app's own values, none of the deploy credentials and none of the prompt-
# workflow settings. Same merge rule as `next build`.
[ -f .env ] || [ -f .env.production ] || { echo "ERROR: no .env found. Copy .env.example to .env and fill it in." >&2; exit 1; }
if [ -f .env.production ] && grep -qE '^[[:space:]]*(PRESSY_|WORKFLOW_)' .env.production; then
  echo "ERROR: .env.production contains PRESSY_* or WORKFLOW_* lines. It is uploaded verbatim; those belong in .env only." >&2; exit 1
fi
ship_env() {
  { [ -f .env.production ] && grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env.production; [ -f .env ] && grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env; true; } \
    | grep -vE '^(PRESSY_|WORKFLOW_)' | awk -F= '!seen[$1]++'
}
env_value() { ship_env | grep -E "^$1=" | head -1 | cut -d= -f2- | sed -E "s/^(['\"])(.*)\1$/\2/"; }
SITE_URL="$(env_value NEXT_PUBLIC_SITE_URL | sed 's#/$##')"
WP_URL="$(env_value WP_URL | sed 's#/$##')"
SECRET="$(env_value REVALIDATE_SECRET)"
[ -n "$SITE_URL" ] || { echo "ERROR: NEXT_PUBLIC_SITE_URL is not set in .env" >&2; exit 1; }
[ -n "$WP_URL" ] || { echo "ERROR: WP_URL is not set in .env" >&2; exit 1; }
[ -n "$SECRET" ] || { echo "ERROR: REVALIDATE_SECRET is not set in .env" >&2; exit 1; }

# The panel's startup command depends on where the app lands.
case "$PRESSY_DIR" in
  .|./|~|/) HOME_DEPLOY=1; START_CMD="node entry.js" ;;
  *) HOME_DEPLOY=0; START_CMD="node $PRESSY_DIR/entry.js" ;;
esac

# 0. Preflight ---------------------------------------------------------------------
if [ "$SKIP_PREFLIGHT" -eq 0 ]; then
  step "Preflight"
  node scripts/preflight.mjs --pre-deploy || { echo "Fix the problems above, then deploy again (or pass --skip-preflight)." >&2; exit 1; }
fi

# The WordPress plugin ------------------------------------------------------------
# The plugin file itself never changes per site. Its two values go into a
# companion file written from .env, so the secret is never typed into a
# tracked file. Both are uploaded into wp-content/mu-plugins/, which WordPress
# loads with no activation step.
php_quote() { printf '%s' "$1" | sed "s/\\\\/\\\\\\\\/g; s/'/\\\\'/g"; }
write_plugin_config() {
  # Kept next to the plugin, gitignored, so it can also be uploaded by hand.
  cat > "$PLUGIN_CONFIG" <<PHP
<?php
/**
 * Plugin Name: Pressy headless bridge settings
 * Description: Written by \`npm run deploy\` from the app's env file. Do not edit; deploy again instead.
 */
defined( 'ABSPATH' ) || exit;
if ( ! defined( 'PRESSY_NEXT_BASE' ) )         define( 'PRESSY_NEXT_BASE', '$(php_quote "$SITE_URL")' );
if ( ! defined( 'PRESSY_REVALIDATE_SECRET' ) ) define( 'PRESSY_REVALIDATE_SECRET', '$(php_quote "$SECRET")' );
PHP
  chmod 600 "$PLUGIN_CONFIG" 2>/dev/null || true
}
plugin_status() { curl -s --max-time 15 -H 'Accept: application/json' "$WP_URL/wp-json/pressy/v1/status" | sed 's#\\/#/#g' || true; }
install_plugin() {
  step "WordPress plugin"
  if [ -z "$PRESSY_WP_DIR" ]; then
    echo "PRESSY_WP_DIR is empty: leaving the WordPress side alone."
    echo "Set it to the folder holding wp-config.php (often public_html), or install the plugin by hand: docs/deploy.md."
    return 0
  fi
  local remote="$PRESSY_WP_DIR/wp-content/mu-plugins"
  write_plugin_config
  echo "wrote $PLUGIN_CONFIG for $SITE_URL"
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "dry run: would upload pressy-headless.php and pressy-headless-config.php to $PRESSY_SSH:$remote/"
    return 0
  fi
  tar -C "$PLUGIN_DIR" -cf - pressy-headless.php pressy-headless-config.php \
    | ssh "${SSH_OPTS[@]}" "$PRESSY_SSH" "mkdir -p '$remote' && tar -C '$remote' -xf -"
  echo "uploaded to $PRESSY_SSH:$remote/"
  local status; status="$(plugin_status)"
  if echo "$status" | grep -q '"configured":true' && echo "$status" | grep -q "\"next_base\":\"$SITE_URL\""; then
    echo "WordPress at $WP_URL reports the plugin installed and pointing at $SITE_URL"
  elif [ -z "$status" ] || ! echo "$status" | grep -q '"plugin":"pressy-headless"'; then
    echo "ERROR: $WP_URL does not see the plugin after the upload." >&2
    echo "       Is PRESSY_WP_DIR ($PRESSY_WP_DIR) the folder that holds wp-config.php on the server?" >&2
    exit 1
  else
    echo "ERROR: the plugin is installed but reports: $status" >&2
    exit 1
  fi
}

if [ "$PLUGIN_ONLY" -eq 1 ]; then
  install_plugin
  exit 0
fi

# A locally running preview of this project's own build holds .next/standalone
# open, and `next build` then dies with EBUSY when it tries to clear it. Only
# processes running THIS project's server.js are stopped.
stop_local_preview() {
  local target_posix="$PWD/$STANDALONE/server.js"
  if command -v cygpath >/dev/null 2>&1; then
    local target_win
    target_win="$(cygpath -w "$PWD/$STANDALONE" 2>/dev/null || true)"
    [ -n "$target_win" ] || return 0
    powershell.exe -NoProfile -Command "
      Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" |
        Where-Object { \$_.CommandLine -like '*$target_win*' } |
        ForEach-Object { Write-Output ('stopped local preview, pid ' + \$_.ProcessId); Stop-Process -Id \$_.ProcessId -Force }
    " 2>/dev/null | tr -d '\r' || true
  elif command -v pkill >/dev/null 2>&1; then
    if pkill -f "$target_posix" 2>/dev/null; then echo "stopped local preview server"; fi
  fi
}

# 1. Build ------------------------------------------------------------------
if [ "$SKIP_BUILD" -eq 0 ]; then
  step "Build"
  stop_local_preview
  [ -d node_modules ] || npm ci
  npm run build
else
  step "Build skipped (--skip-build)"
  [ -f "$STANDALONE/server.js" ] || { echo "ERROR: no $STANDALONE/server.js to reuse" >&2; exit 1; }
fi

# 2. Assemble the bundle ------------------------------------------------------
step "Assemble $STANDALONE"
[ -f "$STANDALONE/server.js" ] || { echo "ERROR: $STANDALONE/server.js not found; is output: 'standalone' set?" >&2; exit 1; }
[ -d public ] && cp -R public/. "$STANDALONE/public/"
[ -d .next/static ] || { echo "ERROR: .next/static missing" >&2; exit 1; }
mkdir -p "$STANDALONE/.next/static" && cp -R .next/static/. "$STANDALONE/.next/static/"
ship_env > "$STANDALONE/.env.production"
echo "wrote .env.production for the server ($(ship_env | cut -d= -f1 | tr '\n' ' '))"
cp scripts/standalone-entry.cjs "$STANDALONE/entry.js"
# next build copies every env file it loaded into the standalone folder,
# including .env with the deploy credentials. Only the file written above may ship.
for f in "$STANDALONE"/.env "$STANDALONE"/.env.local "$STANDALONE"/.env.development "$STANDALONE"/.env.development.local "$STANDALONE"/.env.production.local; do
  [ -f "$f" ] && rm -f "$f" && echo "removed $(basename "$f") from the bundle"
done
echo "bundle ready: $(du -sh "$STANDALONE" | cut -f1)"

# 3. Upload ---------------------------------------------------------------------
step "Upload to $PRESSY_SSH:$PRESSY_DIR/"
RSYNC_FLAGS=(-az --exclude '.env.production.bak')
if [ "$HOME_DEPLOY" -eq 1 ]; then
  # --delete on the SSH home would remove everything else in it, WordPress included.
  echo "PRESSY_DIR is the SSH home: stale files are left in place. A folder of its own (PRESSY_DIR=app) is safer."
else
  RSYNC_FLAGS+=(--delete)
fi
[ "$DRY_RUN" -eq 1 ] && RSYNC_FLAGS+=(-n -v)
if command -v rsync >/dev/null 2>&1; then
  rsync "${RSYNC_FLAGS[@]}" -e "$SSH_CMD" "$STANDALONE/" "$PRESSY_SSH:$PRESSY_DIR/"
else
  # Windows Git Bash has ssh and tar but no rsync: stream a tar archive instead.
  echo "rsync not found locally; falling back to tar over ssh (no --delete of stale files)." >&2
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "dry run: tar -C $STANDALONE -cf - . | $SSH_CMD $PRESSY_SSH \"mkdir -p '$PRESSY_DIR' && tar -C '$PRESSY_DIR' -xf -\""
  else
    tar -C "$STANDALONE" -cf - . | ssh "${SSH_OPTS[@]}" "$PRESSY_SSH" "mkdir -p '$PRESSY_DIR' && tar -C '$PRESSY_DIR' -xf -"
  fi
fi

# 4. WordPress plugin ---------------------------------------------------------------
if [ "$SKIP_PLUGIN" -eq 0 ]; then install_plugin; fi
[ "$DRY_RUN" -eq 1 ] && { echo; echo "dry run complete"; exit 0; }

# 5. Restart ----------------------------------------------------------------------
step "Restart"
# "[n]ode" keeps pkill from matching the remote shell that runs this very command
# (which would kill our own ssh session and abort the script).
if ssh "${SSH_OPTS[@]}" "$PRESSY_SSH" 'if pgrep -f "[n]ode.*(entry|server)\.js" >/dev/null; then pkill -f "[n]ode.*(entry|server)\.js"; echo "killed the running node process"; else echo "no node process matched; the panel may run it outside this shell view - use the dashboard Restart button"; fi'; then
  echo "the panel's crash-restart policy should (re)launch the app"
else
  echo "WARNING: the restart command over ssh failed; continuing with the probe" >&2
fi
UP=0
for i in $(seq 1 15); do
  sleep 1
  if curl -sf -o /dev/null --max-time 5 "$SITE_URL/"; then UP=1; break; fi
done
if [ "$UP" -eq 0 ]; then
  echo "WARNING: $SITE_URL/ did not answer within 15 s." >&2
  echo "         In the panel, check the Node app's startup command is \"$START_CMD\" and press Restart, then rerun:" >&2
  echo "         npm run deploy -- --skip-build" >&2
fi

# 6. Smoke test ----------------------------------------------------------------------
step "Smoke test"
FAIL=0
check() { # label, expected-code-regex, curl args...
  local label="$1" expect="$2"; shift 2
  local code; code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@" || echo 000)"
  if [[ "$code" =~ ^($expect)$ ]]; then echo "PASS  $label ($code)"; else echo "FAIL  $label ($code)"; FAIL=1; fi
}
FRONT="$(curl -s --max-time 15 "$SITE_URL/" || true)"
check "front page $SITE_URL/"           "200"     "$SITE_URL/"
# A WordPress front page is also a 200. Only the app's HTML links /_next/ assets.
if echo "$FRONT" | grep -q '/_next/'; then
  echo "PASS  front page is answered by the app"
else
  echo "FAIL  front page is not answered by the app"
  echo "      WordPress or the host's default page answered instead. Point the domain at the Node app:"
  echo "      make the app's domain primary and leave the proxy path blank (docs/going-live.md)."
  FAIL=1
fi
check "front page without slash"        "200|308" "$SITE_URL"
ARTICLE="$(curl -s --max-time 15 "$SITE_URL/sitemap.xml" | grep -o "$SITE_URL/[0-9]\{4\}/[0-9]\{2\}/[^<]*" | head -1 || true)"
if [ -n "$ARTICLE" ]; then check "article $ARTICLE" "200" "$ARTICLE"; else echo "FAIL  no article URL found in sitemap"; FAIL=1; fi
check "feed $SITE_URL/feed.xml"         "200"     "$SITE_URL/feed.xml"
check "sitemap $SITE_URL/sitemap.xml"   "200"     "$SITE_URL/sitemap.xml"
check "favicon $SITE_URL/icon"          "200"     "$SITE_URL/icon"
IMG="$(echo "$FRONT" | grep -o '<img[^>]*src="[^"]*"' | head -1 | sed 's/.*src="\([^"]*\)".*/\1/' | sed 's/&amp;/\&/g' || true)"
if [ -n "$IMG" ]; then check "image $IMG" "200" -I "$IMG"; else echo "SKIP  no <img> on the front page (no featured images in WordPress)"; fi
check "revalidate rejects a missing secret" "401" -X POST "$SITE_URL/api/revalidate"
check "revalidate accepts the secret"       "200" -X POST -H "x-revalidate-secret: $SECRET" -d 'type=page&slug=pressy-deploy-check' "$SITE_URL/api/revalidate"
if [ "$SKIP_PLUGIN" -eq 0 ] && [ -n "$PRESSY_WP_DIR" ]; then
  if plugin_status | grep -q '"configured":true'; then echo "PASS  WordPress plugin installed and configured"; else echo "FAIL  WordPress plugin status"; FAIL=1; fi
fi

if [ "$FAIL" -eq 0 ]; then
  echo "All smoke tests passed."
  echo "Admin stays at $WP_URL/wp-admin/. Edit a post there and reload the app to see it change."
else
  echo "Some smoke tests failed." >&2; exit 1
fi
