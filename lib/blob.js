// lib/blob.js
// Photo storage on Vercel Blob (private store). Two kinds of objects:
//   - manifest.json   → ordered list of { id, src, caption, uploadedAt }
//   - photos/<id>.ext → the actual image bytes
// Array order in the manifest is the display order shown on the gallery.
// Private blobs require the BLOB_READ_WRITE_TOKEN to read, so photos are
// served through /api/photo/<pathname>, which proxies the bytes.
const { put, del, get } = require("@vercel/blob");

const MANIFEST_PATH = "manifest.json";

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

async function getManifest() {
  try {
    const result = await get(MANIFEST_PATH, { access: "private" });
    if (!result) return { photos: [] };
    const buf = await streamToBuffer(result.stream);
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return { photos: [] };
  }
}

async function saveManifest(manifest) {
  await put(MANIFEST_PATH, JSON.stringify(manifest), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function uploadPhoto(id, buffer, contentType) {
  const ext = (contentType.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const pathname = `photos/${id}.${ext}`;
  await put(pathname, buffer, {
    access: "private",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return `/api/photo/${pathname}`;
}

async function deletePhoto(src) {
  const pathname = src.replace(/^\/api\/photo\//, "");
  try {
    await del(pathname);
  } catch {
    /* already gone, ignore */
  }
}

module.exports = { getManifest, saveManifest, uploadPhoto, deletePhoto };
