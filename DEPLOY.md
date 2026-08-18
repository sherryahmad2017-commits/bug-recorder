# Going public — deployment runbook

This is the exact sequence to get ReproFlow's backend and dashboard onto public
URLs, then rebuild the extension to point at them and submit it to the Chrome
Web Store. Every step that needs an account, a click in someone else's
dashboard, or a payment is called out — I can't do those for you, but
everything in this repo is ready for them.

Stack: **Railway** (API + Postgres + Redis), **Vercel** (dashboard),
**Cloudflare R2** (object storage — needed once Phase 2 adds attachments;
set it up now so it's not a blocker later).

---

## 0. Push this repo to GitHub

Railway and Vercel both deploy from a GitHub repo (you can also deploy via
their CLIs without GitHub, but GitHub gives you auto-deploy on every push,
which you want).

```bash
# Create an empty repo on github.com first (no README/license — this repo
# already has commits), then:
git remote add origin https://github.com/<your-account>/reproflow.git
git push -u origin main
```

---

## 1. Backend — Railway

1. Go to railway.app → sign up (free tier is enough to start).
2. **New Project → Deploy from GitHub repo** → pick this repo.
3. Railway will ask which directory to build — set it to **`backend`** (it'll
   auto-detect `backend/Dockerfile` and `backend/railway.json`).
4. In the same project, click **+ New → Database → Add PostgreSQL**, and
   again **+ New → Database → Add Redis**. Railway provisions both and
   exposes connection variables automatically.
5. On the backend service → **Variables**, add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Reference → select the Postgres plugin's `DATABASE_URL` |
   | `REDIS_URL` | Reference → select the Redis plugin's `REDIS_URL` |
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` |
   | `JWT_ACCESS_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
   | `JWT_ACCESS_TTL` | `15m` |
   | `REFRESH_TOKEN_TTL_DAYS` | `30` |
   | `ENCRYPTION_KEY` | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
   | `DASHBOARD_ORIGIN` | placeholder for now, e.g. `https://example.com` — you'll come back and set this to the real Vercel URL in step 3 |
   | `EXTENSION_IDS` | leave empty for now — filled in step 4 |
   | `STORAGE_*` | from step 2 below |

6. **Settings → Networking → Generate Domain** to get a public URL, e.g.
   `https://reproflow-api-production.up.railway.app`.
7. Verify it's actually up:
   ```bash
   curl https://<your-railway-domain>/health/ready
   # {"status":"ok","database":"ok","redis":"ok"}
   ```
   If this fails, check **Deployments → View Logs** — most likely cause is a
   missing/invalid env var (`ENCRYPTION_KEY`/`JWT_ACCESS_SECRET` must be at
   least 16 characters, `DASHBOARD_ORIGIN` must be a valid URL).

No local Docker needed for this path — Railway builds the Dockerfile in the
cloud. (If you want, you can also point your local `backend/.env` at these
same Railway `DATABASE_URL`/`REDIS_URL` values for local development instead
of installing Docker Desktop — Railway's Postgres/Redis both accept external
connections.)

---

## 2. Object storage — Cloudflare R2

Not used by anything yet (attachments are Phase 2), but it's a five-minute
setup and the config plumbing (`STORAGE_*` env vars) already expects it.

1. dash.cloudflare.com → **R2** → sign up (free tier: 10 GB storage, no
   egress fees).
2. **Create bucket** → name it `reproflow-prod`.
3. **Manage R2 API Tokens → Create API Token** → permissions: Object
   Read & Write, scoped to that bucket. Copy the Access Key ID, Secret
   Access Key, and the **S3 API endpoint** (looks like
   `https://<account-id>.r2.cloudflarestorage.com`).
4. Back in Railway, set on the backend service:

   | Variable | Value |
   |---|---|
   | `STORAGE_ENDPOINT` | the R2 S3 API endpoint |
   | `STORAGE_REGION` | `auto` |
   | `STORAGE_BUCKET` | `reproflow-prod` |
   | `STORAGE_ACCESS_KEY_ID` | from the R2 token |
   | `STORAGE_SECRET_ACCESS_KEY` | from the R2 token |
   | `STORAGE_FORCE_PATH_STYLE` | `true` |

---

## 3. Dashboard — Vercel

1. vercel.com → sign up → **Add New → Project** → import the same GitHub repo.
2. **Root Directory** → set to `dashboard`.
3. Environment variables:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<your-railway-domain>/api/v1` |
   | `API_URL` | same value |
   | `NODE_ENV` | `production` |

4. Deploy. Vercel gives you a URL like `https://reproflow.vercel.app`.
5. **Go back to Railway** and update `DASHBOARD_ORIGIN` on the backend
   service to this exact Vercel URL (no trailing slash), then redeploy the
   backend so CORS allows it.
6. Smoke test: open the Vercel URL → `/signup` → create an account → you
   should land on the project list. If signup fails with a CORS error in the
   browser console, `DASHBOARD_ORIGIN` doesn't match exactly (check http vs
   https, trailing slash).

---

## 4. Extension — point it at the real API, rebuild, repackage

```bash
cd extension
# edit .env:
#   VITE_API_BASE_URL=https://<your-railway-domain>/api/v1
npm run release
```

This produces a new `release/reproflow-extension-v0.1.0.zip` built against
the public API instead of localhost.

Load it unpacked once to get its real extension ID (`chrome://extensions`,
Developer mode, Load unpacked → `extension/dist`), then add that ID to
Railway's `EXTENSION_IDS` variable on the backend and redeploy — otherwise
the API's CORS check rejects requests from the installed extension. Note:
**the ID changes when you eventually install the Chrome Web Store version**
(unpacked and Store-installed IDs differ unless you set a fixed `key` in the
manifest) — after the Store approves it, check the real listing's ID and
update `EXTENSION_IDS` again.

---

## 5. Chrome Web Store — make it installable by anyone

1. chrome.google.com/webstore/devconsole → sign in → pay the one-time **$5
   developer registration fee** (per account, not per extension).
2. **New Item** → upload `release/reproflow-extension-v0.1.0.zip`.
3. Fill in the listing (see `extension/README.md`'s checklist for the full
   list): icon, at least one 1280×800 screenshot, description, category,
   **privacy policy URL** (publish one based on `docs/ARCHITECTURE.md` §27
   somewhere public — even a page on the Vercel-hosted dashboard works),
   and the permission justifications for `storage` and `sidePanel`.
4. Choose visibility: **Public** lists it in the Chrome Web Store for anyone
   to find and install. **Unlisted** gives you an installable link without
   search-listing it — useful if you want early testers before a full public
   launch.
5. Submit for review. Google's review is typically same-day to a few days
   for a first submission. You'll get an email when it's approved or if they
   need changes.

Once approved and set to Public, it's live for anyone with Chrome to install
— nothing further to configure on your end.

---

## What's still Phase 1 only

Worth remembering once this is public: today's build only covers sign-up,
login, and project selection. There's no "Report a bug" capture flow yet.
If real users start installing it from a Public listing, they'll hit that
gap immediately — worth switching the listing to **Unlisted** until Phase 2
(screenshot capture + report submission) ships, or clearly labeling it as
early access in the listing description.
