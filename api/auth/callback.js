// api/auth/callback.js
// Instagram redirects here after the owner approves. We exchange the code for a
// long-lived (~60 day) token and show it once so it can be pasted into Vercel
// as IG_LONG_LIVED_TOKEN. We deliberately do NOT auto-persist secrets to the
// repo or any public store.
const ig = require("../../lib/instagram");

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error_description");

    if (error) {
      res.status(400).send(page("Connection cancelled", escapeHtml(error)));
      return;
    }
    if (!code) {
      res.status(400).send(page("Missing code", "No authorization code was returned."));
      return;
    }

    const short = await ig.exchangeCodeForToken(code);
    const long = await ig.toLongLivedToken(short.access_token);
    const days = Math.round((long.expires_in || 0) / 86400);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(
      page(
        "Account connected",
        `<p>Copy this long-lived token into your Vercel project as
         <code>IG_LONG_LIVED_TOKEN</code>, then redeploy. It is valid for about
         ${days} days and refreshes itself automatically on each sync.</p>
         <textarea readonly onclick="this.select()">${escapeHtml(long.access_token)}</textarea>
         <p class="muted">This token is shown only here, only once. Treat it like a password.</p>`
      )
    );
  } catch (e) {
    res.status(500).send(page("Something went wrong", escapeHtml(e.message)));
  }
};

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function page(title, body) {
  return `<!doctype html><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — Horizon</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0d0d0f;color:#eee;
      display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}
    .card{max-width:560px;background:#16161a;border:1px solid #26262c;
      border-radius:14px;padding:32px}
    h1{font-size:20px;margin:0 0 12px}
    p{line-height:1.6;color:#bdbdc4}
    code{background:#26262c;padding:2px 6px;border-radius:4px;color:#fff}
    textarea{width:100%;height:90px;margin:12px 0;background:#0d0d0f;color:#7dd3fc;
      border:1px solid #26262c;border-radius:8px;padding:10px;font-family:monospace;
      font-size:12px;resize:none}
    .muted{font-size:13px;color:#7c7c85}
  </style>
  <div class="card"><h1>${title}</h1>${body}</div>`;
}
