// lib/blob.js
// Photo storage on Vercel Blob (public store). Two kinds of objects:
//   - manifest-<ts>-<rand>.json → ordered list of { id, src, caption, uploadedAt }
//   - photos/<id>.ext           → the actual image bytes, served directly via
//     their public blob URL (stored as `src` in the manifest)
// Array order in the manifest is the display order shown on the gallery.
const { put, del, list, head } = require("@vercel/blob");

// A fixed manifest.json URL can serve a stale CDN-cached copy right after a
// write — cache-busting query strings and no-store don't reliably prevent
// this (it's edge propagation delay). Instead, each save writes a new
// uniquely-named manifest-*.json (a URL the CDN has never seen can't be
// stale) and reads find the newest one via list(), which queries the Blob
// API directly rather than the CDN.
const MANIFEST_PREFIX = "manifest-";
const LEGACY_MANIFEST_PATH = "manifest.json"; // pre-migration single-file manifest

async function getManifest() {
  try {
    const { blobs } = await list({ prefix: MANIFEST_PREFIX });
    if (blobs.length) {
      blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      const res = await fetch(blobs[0].url, { cache: "no-store" });
      if (res.ok) return await res.json();
    }
    // One-time fallback for sites that still have the old manifest.json.
    const legacy = await head(LEGACY_MANIFEST_PATH).catch(() => null);
    if (legacy) {
      const res = await fetch(legacy.url, { cache: "no-store" });
      if (res.ok) return await res.json();
    }
    return { photos: [] };
  } catch {
    return { photos: [] };
  }
}

async function saveManifest(manifest) {
  const { blobs: old } = await list({ prefix: MANIFEST_PREFIX }).catch(() => ({ blobs: [] }));
  await put(`${MANIFEST_PREFIX}${Date.now()}.json`, JSON.stringify(manifest), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: true,
  });
  if (old.length) {
    await del(old.map((b) => b.url)).catch(() => {});
  }
  await del(LEGACY_MANIFEST_PATH).catch(() => {});
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
