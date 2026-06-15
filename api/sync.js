// api/sync.js
// Refreshes media from Instagram and rotates the token if it's near expiry.
// Triggered automatically by Vercel Cron (see vercel.json) and can be hit
// manually. Protected by an optional SYNC_SECRET to stop strangers forcing
// re-syncs.
const ig = require("../lib/instagram");
const store = require("../lib/store");

const REFRESH_WINDOW = 7 * 24 * 60 * 60 * 1000; // refresh if <7 days left

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  // Cron requests carry a Vercel header; manual ones may pass ?secret=
  const secret = process.env.SYNC_SECRET;
  if (secret) {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const provided = url.searchParams.get("secret") || req.headers["x-sync-secret"];
    const isCron = req.headers["x-vercel-cron"] !== undefined;
    if (!isCron && provided !== secret) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  try {
    let token = process.env.IG_LONG_LIVED_TOKEN;
    const cached = store.getCachedToken();
    if (cached && cached.token && cached.expiresAt > Date.now()) token = cached.token;
    if (!token) {
      res.status(400).json({ error: "No token. Connect via /api/auth/start first." });
      return;
    }

    // Refresh token if it's getting old (only works on long-lived tokens).
    if (cached && cached.expiresAt - Date.now() < REFRESH_WINDOW) {
      try {
        const refreshed = await ig.refreshLongLivedToken(token);
        token = refreshed.access_token;
        store.setCachedToken(token, refreshed.expires_in);
      } catch {
        /* refresh is best-effort; keep using current token */
      }
    } else if (!cached) {
      // Seed the cache so future refreshes have an expiry to track.
      try {
        const refreshed = await ig.refreshLongLivedToken(token);
        store.setCachedToken(refreshed.access_token, refreshed.expires_in);
        token = refreshed.access_token;
      } catch {
        store.setCachedToken(token, 60 * 24 * 60 * 60); // assume 60d
      }
    }

    const raw = await ig.fetchMedia(token, 60);
    const gallery = ig.normalize(raw);
    store.setCachedGallery(gallery);

    res.status(200).json({ ok: true, count: gallery.length, syncedAt: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
