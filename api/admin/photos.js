// api/admin/photos.js
// Authenticated CRUD for the gallery's photo manifest, backed by Vercel Blob.
//   GET    -> list photos (newest first)
//   POST   { filename, dataUrl, caption } -> upload a new photo
//   PATCH  { id, caption } or { order: [ids] } -> edit caption / reorder
//   DELETE { id } -> remove a photo
const crypto = require("crypto");
const auth = require("../../lib/auth");
const store = require("../../lib/blob");
const { readJSON } = require("../../lib/http");

const MAX_BYTES = 8 * 1024 * 1024; // 8MB per photo

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (!auth.isAuthenticated(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    if (req.method === "GET") {
      const manifest = await store.getManifest();
      res.status(200).json({ photos: manifest.photos || [] });
      return;
    }

    if (req.method === "POST") {
      const { filename, dataUrl, caption } = await readJSON(req);
      const match = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/.exec(dataUrl || "");
      if (!match) {
        res.status(400).json({ error: "dataUrl must be a base64 image data URL" });
        return;
      }
      const contentType = match[1];
      const buffer = Buffer.from(match[2], "base64");
      if (buffer.length > MAX_BYTES) {
        res.status(413).json({ error: "Image too large (max 8MB)" });
        return;
      }

      const id = crypto.randomUUID();
      const src = await store.uploadPhoto(id, buffer, contentType);

      const manifest = await store.getManifest();
      const photo = {
        id,
        src,
        caption: (caption || "").trim(),
        filename: filename || "",
        uploadedAt: Date.now(),
      };
      manifest.photos = [photo, ...(manifest.photos || [])];
      await store.saveManifest(manifest);

      res.status(201).json({ photo });
      return;
    }

    if (req.method === "PATCH") {
      const body = await readJSON(req);
      const manifest = await store.getManifest();
      manifest.photos = manifest.photos || [];

      if (Array.isArray(body.order)) {
        const byId = new Map(manifest.photos.map((p) => [p.id, p]));
        const reordered = body.order.map((id) => byId.get(id)).filter(Boolean);
        // append any photos missing from the supplied order (defensive)
        for (const p of manifest.photos) if (!body.order.includes(p.id)) reordered.push(p);
        manifest.photos = reordered;
      } else if (body.id) {
        const photo = manifest.photos.find((p) => p.id === body.id);
        if (!photo) {
          res.status(404).json({ error: "Not found" });
          return;
        }
        if (typeof body.caption === "string") photo.caption = body.caption.trim();
      } else {
        res.status(400).json({ error: "Provide { id, caption } or { order: [...] }" });
        return;
      }

      await store.saveManifest(manifest);
      res.status(200).json({ photos: manifest.photos });
      return;
    }

    if (req.method === "DELETE") {
      const { id } = await readJSON(req);
      const manifest = await store.getManifest();
      manifest.photos = manifest.photos || [];
      const photo = manifest.photos.find((p) => p.id === id);
      if (!photo) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      manifest.photos = manifest.photos.filter((p) => p.id !== id);
      await store.saveManifest(manifest);
      await store.deletePhoto(photo.src);
      res.status(200).json({ photos: manifest.photos });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
