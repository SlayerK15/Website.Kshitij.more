// api/gallery.js
// Public read endpoint the frontend calls on page load. Returns the cached,
// curated gallery. If the cache is empty (cold start) it triggers a sync.
// Falls back to bundled local assets when Instagram isn't configured yet, so
// the site is never blank.
const ig = require("../lib/instagram");
const store = require("../lib/store");

const SIX_HOURS = 6 * 60 * 60 * 1000;

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=86400");

  try {
    const cached = store.getCachedGallery();
    const fresh = cached && Date.now() - cached.cachedAt < SIX_HOURS;

    if (fresh) {
      res.status(200).json({ source: "instagram", photos: store.applyCuration(cached.gallery) });
      return;
    }

    const token = resolveToken();
    if (!token) {
      res.status(200).json({ source: "local", photos: localFallback() });
      return;
    }

    const raw = await ig.fetchMedia(token, 60);
    const gallery = ig.normalize(raw);
    store.setCachedGallery(gallery);
    res.status(200).json({ source: "instagram", photos: store.applyCuration(gallery) });
  } catch (e) {
    // On any failure, still serve something usable.
    const cached = store.getCachedGallery();
    if (cached) {
      res.status(200).json({ source: "instagram-stale", photos: store.applyCuration(cached.gallery) });
    } else {
      res.status(200).json({ source: "local", photos: localFallback(), note: e.message });
    }
  }
};

function resolveToken() {
  const cached = store.getCachedToken();
  if (cached && cached.token && cached.expiresAt > Date.now()) return cached.token;
  return process.env.IG_LONG_LIVED_TOKEN || null;
}

// 16 bundled photos so the gallery renders before Instagram is connected.
function localFallback() {
  return Array.from({ length: 16 }, (_, i) => {
    const n = i + 1;
    return {
      id: `local-${n}`,
      src: `/assets/${n}.jpg`,
      thumb: `/assets/${n}.jpg`,
      caption: "",
      permalink: "https://www.instagram.com/the.horizonfilms/",
      timestamp: null,
    };
  });
}
