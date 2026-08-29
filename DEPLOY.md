# Deploying PAARA

## Why not both frontend AND backend on Vercel?

Vercel's backend hosting only supports **serverless functions** — no persistent
disk. Your backend uses:
- `better-sqlite3` (a single SQLite file on disk)
- Local file writes for uploaded product images (`routes/admin.js`)

On Vercel, both of these get wiped every time a function cold-starts. Making
this work on Vercel end-to-end would mean swapping SQLite for a hosted DB
(Neon/Turso) and image uploads for a service like Vercel Blob or Cloudinary,
then rewriting every route file that touches the DB. That's a much bigger
project than "deploy this app."

**What actually works today, unchanged:** frontend on Vercel, backend on
Render (or Railway) — a host with a real persistent disk. Same code, same
SQLite file, same image uploads, just pointed at a disk that survives
redeploys.

## What changed in this zip
- `paara-backend/server.js`
  - `ALLOWED_ORIGINS` env var lets you add your production frontend URL to CORS
    (previously hardcoded to localhost only — your deployed frontend would
    have been blocked).
  - Added `express.static` for `/uploads` — **uploaded product images were
    being written to disk but never served over HTTP.** This was a pre-existing
    bug; anyone using the admin image uploader would have gotten broken image
    links. Fixed.
  - Added `GET /` health route (Render pings this by default).
- `paara-backend/routes/admin.js`
  - Upload directory is now `UPLOADS_DIR` (env-configurable) instead of a
    path baked into the repo, so it can point at Render's persistent disk.
- `paara-backend/render.yaml` — one-click Render deploy config with a mounted
  disk for the DB + uploaded images.
- `paara-backend/.env.example` — documents the new vars.
- `paara-backend/.gitignore` — added (wasn't present in the backend folder).
- `vercel.json` (repo root) — Vite build config for the frontend.

## 1. Deploy the backend to Render

1. Push this updated code to your GitHub repo (replace your existing
   `paara-backend` folder with the one in this zip).
2. Go to [render.com](https://render.com) → New → Blueprint → connect your
   repo. Render will detect `render.yaml` automatically. Alternatively:
   New → Web Service → root directory `paara-backend`, build command
   `npm install`, start command `npm start`.
3. In the Render dashboard, fill in the env vars marked `sync: false` in
   `render.yaml` (JWT_SECRET, ADMIN_API_KEY, RAZORPAY_KEY_ID/SECRET, email
   settings, etc.) — use real production values, not the test placeholders
   from `.env.example`.
4. Leave `DB_PATH=/data/paara.db` and `UPLOADS_DIR=/data/uploads` as set —
   these point at the persistent disk Render creates.
5. Deploy. Note the resulting URL, e.g. `https://paara-backend.onrender.com`.
6. Once deployed, initialize the DB schema if this is a fresh disk:
   Render dashboard → Shell → `npm run init-db`.

## 2. Deploy the frontend to Vercel

1. Import the repo into Vercel. Set **Root Directory** to the repo root
   (where `package.json`, `index.html`, `vite.config.js` live).
2. Vercel will pick up `vercel.json` automatically (Vite preset, `dist` output).
3. Add an environment variable:
   `VITE_API_URL = https://paara-backend.onrender.com/api`
4. Deploy.

## 3. Connect the two

Back in Render, set `ALLOWED_ORIGINS` to your Vercel URL, e.g.:
```
ALLOWED_ORIGINS=https://paara.vercel.app
```
Redeploy the backend so CORS picks it up.

## 4. Sanity check
- `https://paara-backend.onrender.com/api/health` → `{"ok":true}`
- Your Vercel frontend should load products, and admin image uploads should
  now actually display (previously broken — see fix above).

## Note on Render's free tier
Free web services spin down after inactivity and cold-start on the next
request (a few seconds delay). The persistent disk survives this — only
paid tiers avoid the spin-down itself. Railway is a similar alternative if
you'd rather avoid that.

## If you want everything on Vercel later
That requires: migrating SQLite → Turso (libsql, closest to a drop-in) or
Neon (Postgres), migrating image uploads → Vercel Blob or Cloudinary, and
converting `server.js`'s `app.listen()` into a Vercel serverless handler.
Happy to help with that migration in a follow-up — it touches most of the
route files, so it's worth doing as its own step rather than bundled here.
