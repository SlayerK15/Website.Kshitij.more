// api/admin/login.js
// POST { password } -> sets a signed session cookie if it matches ADMIN_PASSWORD.
const auth = require("../../lib/auth");
const { readJSON } = require("../../lib/http");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.ADMIN_PASSWORD) {
    res.status(500).json({ error: "ADMIN_PASSWORD is not configured on the server" });
    return;
  }

  try {
    const { password } = await readJSON(req);
    if (!auth.checkPassword(password)) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    res.setHeader("Set-Cookie", auth.createSessionCookie(req));
    res.status(200).json({ ok: true });
  } catch {
    res.status(400).json({ error: "Invalid request body" });
  }
};
