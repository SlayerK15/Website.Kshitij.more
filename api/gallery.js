// api/gallery.js
// Public read endpoint the frontend calls on page load. Returns the photos
// uploaded via /admin, or an empty list if none have been uploaded yet.
const store = require("../lib/blob");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=30");

  try {
    const manifest = await store.getManifest();
    const photos = (manifest.photos || []).map((p) => ({
      id: p.id,
      src: p.src,
      thumb: p.src,
      caption: p.caption || "",
    }));
    res.status(200).json({ source: photos.length ? "live" : "empty", photos });
  } catch (e) {
    res.status(200).json({ source: "empty", photos: [], note: e.message });
  }
};
