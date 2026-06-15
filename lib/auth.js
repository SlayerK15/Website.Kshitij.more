// lib/auth.js
// Minimal session handling for the single-admin login at /admin.
// No database: the session is a signed, expiring cookie. The signing
// secret is SESSION_SECRET (falls back to ADMIN_PASSWORD if unset).
const crypto = require("crypto");

const COOKIE_NAME = "horizon_admin";
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function secret() {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("ADMIN_PASSWORD (or SESSION_SECRET) is not configured");
  return s;
}

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---- password check ----
function checkPassword(input) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !input) return false;
  return timingSafeEqual(String(input), expected);
}

// ---- session cookie ----
// `Secure` is omitted for plain-http local dev (e.g. `vercel dev`), where
// browsers would otherwise silently refuse to store/send the cookie.
function createSessionCookie(req) {
  const expires = Date.now() + SESSION_TTL;
  const token = `${expires}.${sign(String(expires))}`;
  const maxAge = Math.floor(SESSION_TTL / 1000);
  const secure = isHttps(req) ? " Secure;" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${maxAge}`;
}

function clearSessionCookie(req) {
  const secure = isHttps(req) ? " Secure;" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=0`;
}

function isHttps(req) {
  return req && req.headers["x-forwarded-proto"] === "https";
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((pair) => {
    const i = pair.indexOf("=");
    if (i === -1) return;
    out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  });
  return out;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature) return false;
  if (Number(expires) < Date.now()) return false;
  return timingSafeEqual(signature, sign(expires));
}

module.exports = {
  checkPassword,
  createSessionCookie,
  clearSessionCookie,
  isAuthenticated,
};
