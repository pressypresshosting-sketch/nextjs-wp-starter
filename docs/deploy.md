# Deploying

WordPress and this app run on one server. You need two domain names pointed at it: one for WordPress, one for the public site. A second host is not required.

The app is built on your machine and uploaded as a finished folder. Nothing is built or installed on the server. `docs/going-live.md` is the checklist for the first time; this file is the reference.

## Two URL modes

The pathname of `NEXT_PUBLIC_SITE_URL` becomes `basePath`. That single value decides the mode.

### A. The app at a domain root

```dotenv
WP_URL=https://cms.example
NEXT_PUBLIC_SITE_URL=https://app.example
```

Result: `app.example/` serves the site, `cms.example/` serves WordPress including `/wp-admin` and `/wp-json`.

On a PressyPress-style panel the proxy attaches to whichever domain is primary, and its Path field can be left blank to forward the whole domain. So:

1. Make the app's domain primary.
2. Confirm `https://cms.example/wp-json/` still returns JSON.
3. Clear the Path field in the Node app's proxy settings and save.
4. Run `npm run preflight`. See the warning below.

Order matters. A blank path sends everything on the primary domain to Node, including `/wp-admin` and `/wp-json`. Doing this while the WordPress domain is primary removes access to the admin and the REST API, and the public site goes blank because it reads content from `/wp-json`. Reversible by typing a path back in.

> Changing the primary domain makes the panel rewrite WordPress's Site Address to match. WordPress then returns image URLs on the app's domain and every image 404s. `npm run preflight` reports it. Fix over SSH, in the WordPress folder, and check again after any domain change:
>
> ```bash
> wp option update siteurl https://cms.example
> wp option update home https://cms.example
> ```

### B. The app under a path

```dotenv
WP_URL=https://site.example
NEXT_PUBLIC_SITE_URL=https://site.example/news
```

For hosts that cannot give the app a domain. The panel proxies the path `news` to the app's port.

Some proxies strip the path before forwarding. The app is built expecting `/news/latest` but receives `/latest`, so every URL returns a 404 with no CSS. `entry.js` puts the prefix back. To check which behaviour you have, request the prefix twice: if `site.example/news/news` returns the front page while `site.example/news` 404s, it is being stripped.

## WordPress paths on the app's domain

In mode A the app owns its domain, so requests to that host for `/wp-admin` reach the app. `next.config.ts` forwards these to `WP_URL`, keeping query strings so a login token survives:

`/wp-admin`, `/wp-admin/*`, `/wp-login.php`, `/wp-cron.php`, `/xmlrpc.php`, `/wp-json/*`, `/wp-content/*`, `/wp-includes/*`

Forwarding is skipped when WordPress and the app share a host, where it would loop.

## Panel settings

| Setting | Value |
| --- | --- |
| App type | Node.js |
| Port | `3000` |
| Proxy | Enabled. Path blank in mode A, `news` in mode B |
| Working directory | Leave empty. Some panels ignore it |
| Startup command | `node news/entry.js`, or `node <PRESSY_DIR>/entry.js` for another folder. `node entry.js` when `PRESSY_DIR` is the SSH home |
| Node version | Stable |
| Auto-restart on crash | On |

The start command names the path because some panels ignore the working directory setting. The standalone server calls `process.chdir(__dirname)` at start-up, so it finds its own files from anywhere. `entry.js` is correct in both modes: it disables itself when there is no path prefix.

## The env file

`.env` is the only file to fill in. Start from `.env.example`.

```dotenv
WP_URL=https://cms.example
NEXT_PUBLIC_SITE_URL=https://app.example
REVALIDATE_SECRET=<openssl rand -hex 32>

PRESSY_SSH=user@your-server.example
PRESSY_PASSWORD=<ssh password, or empty for a key>
PRESSY_PORT=22
PRESSY_DIR=news
PRESSY_WP_DIR=public_html
```

At deploy time the script writes a `.env.production` into the bundle from every non-`PRESSY_` line of `.env`, so the app's values ship and the deploy credentials never do. `next build` also copies `.env` itself into the standalone folder; the script removes it.

`NEXT_PUBLIC_SITE_URL` is inlined at build time, so changing it needs a rebuild. `WP_URL` is read at run time and takes effect on restart.

To ship different values from the ones you develop with, write a `.env.production` in the project root. It overrides `.env` at build time, exactly as Next.js does, and is uploaded in place of the generated file. It must not contain `PRESSY_*` lines; the deploy refuses to run if it does. For a local WordPress during development, `.env.development` overrides `.env` under `next dev` only.

| Variable | Value |
| --- | --- |
| `PRESSY_SSH` | `user@host` |
| `PRESSY_PORT` | SSH port, default `22` |
| `PRESSY_DIR` | Remote folder for the app, relative to the SSH home, default `news` |
| `PRESSY_WP_DIR` | Remote folder holding `wp-config.php`, relative to the SSH home. The deploy installs the plugin into its `wp-content/mu-plugins/`. Empty skips the plugin |
| `PRESSY_PASSWORD` | Optional. When set, ssh and rsync read it through `scripts/ssh-askpass.sh` and nothing is prompted. When unset, your key or the normal prompt is used |

Never `source .env` in a shell. Passwords with `@` or `^` in them break, and repeated failed logins get the client IP banned by the server.

## Preflight

```bash
npm run preflight
```

Checks, in order: the env file is complete and the secret is not a placeholder; `WP_URL/wp-json/` returns JSON; WordPress's own address matches `WP_URL`; image URLs use the `WP_URL` host; the plugin is installed, configured and pointing at `NEXT_PUBLIC_SITE_URL`; the app's domain is answered by the app rather than WordPress. Each failure prints its fix. `npm run deploy` runs the same checks first, minus the live-app ones.

## Deploy

```bash
npm run deploy                    # preflight, build, upload, plugin, restart, smoke test
npm run deploy:dry                # stop before anything reaches the server
npm run deploy -- --skip-build    # reuse the existing .next/standalone
npm run deploy -- --skip-plugin   # leave the WordPress side alone
npm run deploy:plugin             # only the WordPress plugin
```

Steps, each stopping on failure:

1. Preflight, as above.
2. Stops any local preview holding `.next/standalone` open, then builds.
3. Copies `public/`, `.next/static/` and `entry.js` into `.next/standalone/`, writes its `.env.production`, and removes every other env file from it.
4. Uploads with `rsync -az --delete`. Without rsync, as on Windows, it streams a tar archive over ssh, which cannot delete stale remote files. `--delete` is also left out when `PRESSY_DIR` is the SSH home, where it would remove WordPress.
5. Uploads the WordPress plugin and its generated settings file, then asks WordPress whether it sees them.
6. Stops the app process and polls the public URL for 15 seconds.
7. Smoke tests: the front page answers, and with the app's HTML rather than WordPress's; an article from the sitemap; the feed; the sitemap; the favicon; an image; the revalidate endpoint rejects a missing secret and accepts the real one; the plugin reports itself configured.

### By hand

```bash
npm ci
npm run build
cp -R public/. .next/standalone/public/ 2>/dev/null || true
mkdir -p .next/standalone/.next/static && cp -R .next/static/. .next/standalone/.next/static/
grep -E '^[A-Za-z_]+=' .env | grep -v '^PRESSY_' > .next/standalone/.env.production
cp scripts/standalone-entry.cjs .next/standalone/entry.js
rm -f .next/standalone/.env .next/standalone/.env.local
rsync -az --delete .next/standalone/ user@your-server.example:news/
ssh user@your-server.example 'pkill -f "[n]ode.*(entry|server)\.js" || true'
```

## Restart

```bash
ssh user@your-server.example 'pkill -f "[n]ode.*(entry|server)\.js" || true'
```

If that matches nothing, the panel runs the process where your SSH user cannot see it. `ss -ltnp` may show the listener as pid 5 while `ps` shows no node process. Use the panel's Restart button.

A restart is only needed for code changes. Content changes never need one.

## Roll back

```bash
git checkout v1.2.0
npm run deploy
git checkout main
```

Tag anything you may want to return to. `.env` is not in git, so it stays in place while switching tags.

## WordPress plugin

`wordpress/mu-plugins/pressy-headless.php` is never edited for a site. It reads two values from a companion file, `pressy-headless-config.php`, which `npm run deploy` writes from `.env` and uploads next to it. The companion file is gitignored, so the secret never enters a tracked file. WordPress loads both from `wp-content/mu-plugins/` with no activation step. Until the settings exist the plugin does nothing at all.

The plugin posts to `/api/revalidate` when a post or page is published, updated, trashed or unpublished, and redirects front-end visitors to the matching app route, including WordPress pages at their own path. Feeds, REST, admin, cron, AJAX, previews, and logged-in editors using `?wp=1` are left alone.

`GET https://cms.example/wp-json/pressy/v1/status` reports whether it is installed and which app it points at. It never includes the secret.

### Without SSH

`npm run deploy:plugin -- --dry-run` writes `wordpress/mu-plugins/pressy-headless-config.php` without uploading anything. Upload both files from that folder into `wp-content/mu-plugins/` with the panel's file manager or SFTP. The folder may not exist yet; create it.

### Through wp-config.php instead

The companion file is optional. These two lines in `wp-config.php` do the same job, and win if both exist:

```php
define( 'PRESSY_NEXT_BASE', 'https://app.example' );
define( 'PRESSY_REVALIDATE_SECRET', '<REVALIDATE_SECRET from .env>' );
```

## Verify

```bash
APP=https://app.example
CMS=https://cms.example
SECRET=$(grep '^REVALIDATE_SECRET=' .env | cut -d= -f2)

curl -sI $APP/ | head -1                                  # 200
curl -s  $APP/ | grep -c '/_next/'                        # more than 0: the app answered, not WordPress
curl -sI $APP/feed.xml | head -1                          # 200
curl -sI $APP/icon | head -1                              # 200, image/png
curl -sI $CMS/wp-login.php | head -1                      # 200: WordPress still owns its domain
curl -s  $CMS/wp-json/ | grep -o '"home":"[^"]*"'         # the CMS domain
curl -s  $CMS/wp-json/pressy/v1/status                    # "configured":true, next_base is $APP
curl -s  $APP/ | grep -o 'src="https://[^/]*' | sort -u   # only the CMS host
curl -s -X POST -H "x-revalidate-secret: $SECRET" -d 'type=post&slug=some-slug' $APP/api/revalidate
```

Then edit that post and reload. The first request after a change can still serve the previous version while the new one regenerates. The next one is current.

## Known issues

1. Changing the primary domain rewrites WordPress's Site Address and breaks every image. `npm run preflight` after any domain change.
2. `next build` copies `.env` into the standalone output. The deploy script removes it. A manual upload would not.
3. Next.js keeps API responses in `.next/cache` between builds. Delete it when content changed.
4. `pkill -f "node server.js"` matches the shell running it over SSH and kills the session. Use `[n]ode`.
5. npm scripts run through `cmd.exe` on Windows, which has no bash. `scripts/deploy.mjs` finds Git Bash.
6. A running local preview locks `.next/standalone` and the build fails with `EBUSY`.
7. A WordPress attachment inherits its parent post's visibility. If the post is in the Trash, its images return 401 from the REST API. Empty the trash. WordPress reassigns attachments up one level, so the files survive.
8. LiteSpeed ignores mod_proxy's `[P]` flag in `.htaccess` and returns 503. Host-based routing must be done by the panel. Check for `/usr/local/lsws` before assuming Apache.
9. Three failed SSH logins get the client IP banned, and HTTPS from that IP stops too. Unban it in the panel. The usual cause is a password mangled by `source .env`.
