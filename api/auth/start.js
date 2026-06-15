// api/auth/start.js
// Kicks off the Instagram OAuth consent screen. The owner visits
// /api/auth/start once to connect their account.
const ig = require("../../lib/instagram");

module.exports = (req, res) => {
  if (!process.env.IG_APP_ID || !process.env.IG_REDIRECT_URI) {
    res.status(500).json({
      error: "Instagram app not configured.",
      fix: "Set IG_APP_ID, IG_APP_SECRET and IG_REDIRECT_URI in your Vercel project settings.",
    });
    return;
  }
  res.writeHead(302, { Location: ig.authorizeUrl() });
  res.end();
};
