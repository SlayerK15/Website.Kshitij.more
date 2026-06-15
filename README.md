# Horizon Films — self-syncing gallery

A photography portfolio for **Kshitij More (Horizon Films)** that keeps itself
current. Post a photo to Instagram and it shows up here on its own — framed,
laid out in a cinematic masonry gallery, no code edits.

This is the enhanced version of the original static site: same brand, but now a
managed gallery instead of hard-coded `project1.html` … `project10.html` files.

## How it works

```
 Instagram account
        │  (Instagram Graph API, OAuth — owner connects once)
        ▼
 /api/sync          ← Vercel Cron runs this once daily
        │  fetches recent media, refreshes the token, caches the result
        ▼
 /api/gallery       ← the frontend calls this on load
        │  returns the cached + curated photo list as JSON
        ▼
 public/index.html  ← cinematic masonry gallery, lightbox, viewfinder hero
```

No database and no server to babysit — everything runs as Vercel serverless
functions plus static files. Until Instagram is connected, the site serves the
16 bundled photos in `public/assets/`, so it's never blank.

## Project layout

```
api/
  auth/start.js      → redirects to the Instagram consent screen
  auth/callback.js   → exchanges the code for a long-lived token
  gallery.js         → public JSON feed the frontend reads
  sync.js            → refreshes media + token (Cron + manual)
lib/
  instagram.js       → Graph API wrapper
  store.js           → /tmp cache + curation overrides
data/
  curation.json      → hide / pin / reorder / re-caption photos
public/
  index.html, css/, js/, assets/
vercel.json          → routing + the every-6-hours sync cron
```

## Deploy

1. **Push to GitHub**, then import the repo at [vercel.com/new](https://vercel.com/new).
2. **Create the Instagram app** at [developers.facebook.com](https://developers.facebook.com):
   - Add the **Instagram** product, using *Instagram API with Instagram Login*.
   - The Instagram account must be a **Professional (Business/Creator)** account.
   - Add an OAuth redirect URI: `https://<your-domain>/api/auth/callback`.
3. **Set environment variables** in Vercel (see `.env.example`):
   `IG_APP_ID`, `IG_APP_SECRET`, `IG_REDIRECT_URI`, `SYNC_SECRET`.
4. **Connect the account once:** visit `https://<your-domain>/api/auth/start`,
   approve, then copy the long-lived token it shows you into Vercel as
   `IG_LONG_LIVED_TOKEN` and redeploy.
5. Done. The cron keeps the gallery synced and refreshes the token before it
   expires.

> **Note on "auto-sync":** Instagram does not allow silent scraping of an
> account. The only compliant path is the Graph API with a one-time OAuth
> connect, which is what this uses. After that single approval, syncing is fully
> automatic.

## Curating without code

Edit `data/curation.json` and redeploy. Get photo IDs from `/api/gallery`.

```json
{
  "hidden":   ["17900000000000000"],
  "pinned":   ["17911111111111111"],
  "order":    [],
  "captions": { "17922222222222222": "Backstage, Nagpur — 2026" }
}
```

## Local development

```bash
npm i -g vercel
vercel dev
```

Without credentials it runs against the bundled local photos.
