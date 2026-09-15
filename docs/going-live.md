# Going live

The order that gets a fresh copy of this starter onto a server without the
detours, and what each failure looks like when a step is skipped. Every item
here went wrong on a real first deploy. `docs/deploy.md` has the reference
detail; this is the short path through it.

Throughout, `cms.example` is the WordPress domain and `app.example` is the
app's domain.

## What you need

- One server running WordPress, with SSH access and a panel that can run a
  Node app. Both sites live on it.
- Two domain names pointed at that server: one for WordPress, one for the app.
  A second server is not needed.
- Node.js 20 or newer on your own machine. Nothing is built on the server.

## The order

1. **Fill in `.env`.** Copy `.env.example` and fill in every value. One file:
   the three app values ship to the server, the `PRESSY_*` values stay here.

   ```bash
   cp .env.example .env
   openssl rand -hex 32      # paste as REVALIDATE_SECRET
   ```

   `PRESSY_DIR` is where the app lands on the server and `PRESSY_WP_DIR` is
   where WordPress already lives, both relative to the SSH home. Never
   `source .env` in a shell: a password containing `@` or `^` turns into a
   different password, three wrong logins get your IP banned, and SSH and
   HTTPS both stop answering until the panel unbans it.

2. **Check WordPress.** `npm run inspect` prints what the site contains. If it
   prints HTML instead of JSON, set permalinks in WordPress to anything other
   than Plain. While in the admin, set the site title under Settings, General:
   it becomes the masthead, the metadata and the favicon. Hosting panels often
   leave it as the hostname.

3. **Create the Node app in the panel.** Port `3000`, startup command
   `node news/entry.js` (or `node <PRESSY_DIR>/entry.js` if you changed the
   folder), auto-restart on crash. It has nothing to run yet; that is fine.

4. **Route the app's domain to it.** Make `app.example` the primary domain and
   leave the proxy path blank, so the whole domain goes to port 3000. Do this
   with the app's domain, never WordPress's: a blank path on the WordPress
   domain cuts off `/wp-admin` and `/wp-json`.

5. **Run `npm run preflight`.** It checks the env file, that WordPress answers
   on `WP_URL`, that WordPress still knows its own address, and whether the
   plugin is installed. The one it almost always catches at this point:

   > WordPress thinks its own address is https://app.example

   Changing the primary domain makes the panel rewrite WordPress's address to
   match. Every image URL then points at the app's domain and 404s. Fix it
   over SSH, in the WordPress folder:

   ```bash
   wp option update siteurl https://cms.example && wp option update home https://cms.example
   ```

6. **Run `npm run deploy`.** It runs preflight again, builds, uploads the app,
   installs the WordPress plugin with the secret from `.env`, restarts, and
   smoke tests. The plugin is a file in this repo that WordPress has never
   seen, and nothing else puts it there. If `PRESSY_WP_DIR` is empty the deploy
   says so and skips that step; `docs/deploy.md` shows the by-hand install.

7. **Read the smoke test.** All green means done. Otherwise the table below.

8. **Prove the loop.** Edit a post in `https://cms.example/wp-admin/` and
   reload the app. The change shows within seconds. Without the plugin it
   shows within ten minutes.

## Reading the smoke test

| Result | What it means | Fix |
| --- | --- | --- |
| Front page 200, "not answered by the app", everything else 404 | WordPress or the host's default page answered. A WordPress front page is also a 200 | Step 4: the app's domain is not routed to the Node app |
| Front page never answers, restart says no process matched | The panel runs the app where SSH cannot see it, or the startup command names the wrong folder | Set the startup command to `node <PRESSY_DIR>/entry.js` and press Restart in the panel. Then `npm run deploy -- --skip-build` |
| Image 404 | WordPress builds image URLs from its own address, which is wrong | Step 5 |
| Plugin status FAIL, "does not see the plugin" | `PRESSY_WP_DIR` is not the folder holding `wp-config.php` | Fix `PRESSY_WP_DIR`, then `npm run deploy:plugin` |
| Revalidate rejects the secret | The plugin on the server has a different secret from `.env` | `npm run deploy:plugin` rewrites it |
| `/wp-admin` on the app's domain | Not a failure. The app forwards it to WordPress. Admin lives at `https://cms.example/wp-admin/` | Bookmark the CMS address |

## Things that look like failures and are not

- **`wp` prints `include` warnings** about some plugin. A broken plugin
  missing a file. Harmless for WP-CLI; remove or reinstall that plugin.
- **`ss -ltnp` shows the listener but `ps` shows no node process.** The panel
  runs it in its own namespace. Use the panel's Restart button.
- **The first request after an edit still shows the old version.** The page
  regenerates in the background. The next request is current.

## Local checks worth keeping

- `npm run typecheck && npm run lint` must both be clean. Lint runs with
  `--max-warnings 0`.
- Delete `.next/cache` before a build if content changed. Next.js keeps API
  responses between builds and would embed stale content.
- Only one dev server per folder. Next.js refuses a second one.
- Headless Chrome on Windows will not open a window narrower than about
  500px, so `--window-size=390` silently tests a wider layout. Use the
  DevTools protocol with `Emulation.setDeviceMetricsOverride` for phone widths.

## When something new goes wrong

Add it here, with the symptom as it appeared, the cause, and the fix. Then
add a check for it to `scripts/preflight.mjs` or the smoke test in
`scripts/deploy.sh` if a script can catch it.
