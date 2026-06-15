// api/photo/[...path].js
// Public image proxy for photos stored in the private Vercel Blob store.
// The frontend's <img src> points here; this fetches the bytes server-side
// (using BLOB_READ_WRITE_TOKEN) and streams them to the browser.
const { get } = require("@vercel/blob");

module.exports = async (req, res) => {
  const { path } = req.query;
  const pathname = Array.isArray(path) ? path.join("/") : path;

  try {
    const result = await get(pathname, { access: "private" });
    if (!result) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", result.blob.contentType || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    for await (const chunk of result.stream) {
      res.write(chunk);
    }
    res.end();
  } catch {
    res.status(404).end();
  }
};
