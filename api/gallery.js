// api/gallery.js
// Public read endpoint the frontend calls on page load. Returns the photos
// uploaded via /admin, or the 16 bundled local photos if none have been
// uploaded yet, so the site is never blank.
const store = require("../lib/blob");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=86400");

  try {
    const manifest = await store.getManifest();
    if (manifest.photos && manifest.photos.length) {
      res.status(200).json({
        source: "live",
        photos: manifest.photos.map((p) => ({
          id: p.id,
          src: p.src,
          thumb: p.src,
          caption: p.caption || "",
        })),
      });
      return;
    }
    res.status(200).json({ source: "local", photos: localFallback() });
  } catch (e) {
    res.status(200).json({ source: "local", photos: localFallback(), note: e.message });
  }
};

// 16 bundled photos so the gallery renders before anything is uploaded.
function localFallback() {
  return Array.from({ length: 16 }, (_, i) => {
    const n = i + 1;
    return {
      id: `local-${n}`,
      src: `/assets/${n}.jpg`,
      thumb: `/assets/${n}.jpg`,
      caption: "",
    };
  });
}
