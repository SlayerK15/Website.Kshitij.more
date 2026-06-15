// lib/blob.js
// Photo storage on Vercel Blob (public store). Two kinds of objects:
//   - manifest.json   → ordered list of { id, src, caption, uploadedAt }
//   - photos/<id>.ext → the actual image bytes, served directly via their
//     public blob URL (stored as `src` in the manifest)
// Array order in the manifest is the display order shown on the gallery.
const { put, del, head } = require("@vercel/blob");

const MANIFEST_PATH = "manifest.json";

async function getManifest() {
  try {
    const info = await head(MANIFEST_PATH);
    const res = await fetch(info.url, { cache: "no-store" });
    if (!res.ok) return { photos: [] };
    return await res.json();
  } catch {
    return { photos: [] };
  }
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
