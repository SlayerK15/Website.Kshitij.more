// lib/blob.js
// Photo storage on Vercel Blob (public store). Two kinds of objects:
//   - manifest.json   → ordered list of { id, src, caption, uploadedAt }
//   - photos/<id>.ext → the actual image bytes, served directly via their
//     public blob URL (stored as `src` in the manifest)
// Array order in the manifest is the display order shown on the gallery.
const { put, del, head } = require("@vercel/blob");

const MANIFEST_PATH = "manifest.json";

// The Blob CDN can briefly serve a stale manifest.json right after a write
// (cache-busting query strings and `cache: "no-store"` don't fully prevent
// this — it's edge propagation delay, not a local fetch-cache issue). Retry
// a couple of times with a short delay so read-modify-write operations
// (upload/delete/reorder) see the latest data.
async function getManifest() {
  let last = { photos: [] };
  for (const delay of [0, 400, 900]) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      const info = await head(MANIFEST_PATH);
      const res = await fetch(`${info.url}?v=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      if (res.ok) last = await res.json();
    } catch {
      /* keep last good result, try again */
    }
  }
  return last;
}

async function saveManifest(manifest) {
  await put(MANIFEST_PATH, JSON.stringify(manifest), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

async function uploadPhoto(id, buffer, contentType) {
  const ext = (contentType.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const { url } = await put(`photos/${id}.${ext}`, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return url;
}

async function deletePhoto(url) {
  try {
    await del(url);
  } catch {
    /* already gone, ignore */
  }
}

module.exports = { getManifest, saveManifest, uploadPhoto, deletePhoto };
