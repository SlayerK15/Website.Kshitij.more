// api/admin/logout.js
// POST -> clears the admin session cookie.
const auth = require("../../lib/auth");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Set-Cookie", auth.clearSessionCookie(req));
  res.status(200).json({ ok: true });
};
