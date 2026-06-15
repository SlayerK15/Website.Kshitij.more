# Horizon Films — gallery with admin uploads

A photography portfolio for **Kshitij More (Horizon Films)**: a cinematic
masonry gallery with a lightbox, plus a private `/admin` page where Kshitij
can log in and add, caption, reorder, or remove photos — no code edits.

This is the enhanced version of the original static site: same brand, but now
a managed gallery instead of hard-coded `project1.html` … `project10.html`
files.

## How it works

```
 /admin             ← password-protected: upload, caption, reorder, delete
        │  writes photos + manifest.json to Vercel Blob
        ▼
 /api/gallery       ← the public frontend calls this on load
        │  returns the current photo list as JSON
        ▼
 public/index.html  ← cinematic masonry gallery, lightbox, viewfinder hero
```

No database — photo files and their order/captions live in Vercel Blob as a
small `manifest.json` plus the image files. Until any photos are uploaded,
the site serves the 16 bundled photos in `public/assets/`, so it's never
blank.

## Project layout

```
api/
  gallery.js          → public JSON feed the frontend reads
  admin/login.js       → POST { password } -> sets session cookie
  admin/logout.js       → clears session cookie
  admin/photos.js        → authenticated CRUD (list/upload/caption/reorder/delete)
lib/
  auth.js             → signed session cookie (single admin password)
  blob.js             → Vercel Blob: manifest + photo storage
  http.js             → tiny JSON body reader
public/
  index.html, css/, js/, assets/   → public site
  admin/                            → login + management UI (not linked from the public site)
vercel.json           → routing + security headers
```

## Deploy

1. **Push to GitHub**, then import the repo at [vercel.com/new](https://vercel.com/new).
2. **Add a Blob store**: in the Vercel project, go to **Storage → Create
   Database → Blob**, and connect it to this project. This sets
   `BLOB_READ_WRITE_TOKEN` automatically.
3. **Set environment variables** in Vercel (see `.env.example`):
   - `ADMIN_PASSWORD` — the password for `/admin`. Required.
   - `SESSION_SECRET` — optional; falls back to `ADMIN_PASSWORD` if unset.
4. Redeploy. Visit `https://<your-domain>/admin`, log in, and start adding
   photos.

## Managing photos

Go to `/admin` (not linked anywhere on the public site — bookmark it) and log
in with `ADMIN_PASSWORD`:

- **Add photos**: click or drag-and-drop images onto the upload area. They're
  resized to a max of 2000px and re-encoded as JPEG client-side before
  upload, so even large camera files upload quickly.
- **Caption**: click into a photo's caption field and edit; it saves on blur.
- **Reorder**: drag tiles to change the order shown on the public gallery.
- **Delete**: click the × on a tile.

## Local development

```bash
npm i -g vercel
vercel dev
```

Without `ADMIN_PASSWORD`/Blob configured, `/api/gallery` serves the bundled
local photos and `/admin` will show login errors until env vars are set.
