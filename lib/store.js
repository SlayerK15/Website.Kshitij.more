// lib/store.js
// Tiny persistence layer for serverless. Two concerns:
//   1. Caching the synced gallery + refreshed token between warm invocations
//      (uses /tmp, which survives for the life of a function instance).
//   2. Reading optional curation overrides committed to the repo at
//      data/curation.json — lets the owner hide photos, reorder, or pin
//      favourites without touching code.

const fs = require("fs");
const path = require("path");

const TMP = "/tmp";
const CACHE_FILE = path.join(TMP, "horizon-gallery.json");
const TOKEN_FILE = path.join(TMP, "horizon-token.json");

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data));
    return true;
  } catch {
    return false; // /tmp may be read-only in some edge runtimes; non-fatal
  }
}

// --- gallery cache ---
const getCachedGallery = () => readJSON(CACHE_FILE, null);
const setCachedGallery = (gallery) =>
  writeJSON(CACHE_FILE, { gallery, cachedAt: Date.now() });

// --- token cache (refreshed token outlives the env var) ---
const getCachedToken = () => readJSON(TOKEN_FILE, null);
const setCachedToken = (token, expiresIn) =>
  writeJSON(TOKEN_FILE, { token, expiresAt: Date.now() + expiresIn * 1000 });

// --- curation overrides committed to the repo ---
function getCuration() {
  const file = path.join(process.cwd(), "data", "curation.json");
  return readJSON(file, { hidden: [], pinned: [], order: [], captions: {} });
}

// Apply curation rules to a normalized gallery array.
function applyCuration(gallery) {
  const c = getCuration();
  const hidden = new Set(c.hidden || []);
  let out = gallery.filter((g) => !hidden.has(g.id));

  // caption overrides
  out = out.map((g) =>
    c.captions && c.captions[g.id] ? { ...g, caption: c.captions[g.id] } : g
  );

  // explicit order wins, then pinned, then chronological (already sorted)
  if (c.order && c.order.length) {
    const rank = new Map(c.order.map((id, i) => [id, i]));
    out.sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  }
  if (c.pinned && c.pinned.length) {
    const pin = new Set(c.pinned);
    out.sort((a, b) => (pin.has(b.id) ? 1 : 0) - (pin.has(a.id) ? 1 : 0));
  }
  return out;
}

module.exports = {
  getCachedGallery,
  setCachedGallery,
  getCachedToken,
  setCachedToken,
  getCuration,
  applyCuration,
};
