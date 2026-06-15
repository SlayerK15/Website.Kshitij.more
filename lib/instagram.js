// lib/instagram.js
// Thin wrapper around the Instagram Graph API (Instagram Login / Business flow).
//
// Required env vars (set in Vercel project settings, never commit them):
//   IG_APP_ID            - Instagram app ID from Meta developer console
//   IG_APP_SECRET        - Instagram app secret
//   IG_REDIRECT_URI      - https://<your-domain>/api/auth/callback
//   IG_LONG_LIVED_TOKEN  - (optional) a pre-exchanged long-lived token, so the
//                          public site can sync without an interactive login
//
// Token storage: by default this reads IG_LONG_LIVED_TOKEN from the environment.
// You connect once (see /api/auth/start), copy the long-lived token it prints,
// and paste it into Vercel as IG_LONG_LIVED_TOKEN. Tokens last ~60 days and are
// auto-refreshed by /api/sync whenever they are within 7 days of expiry, with
// the refreshed value cached to /tmp for the life of the function instance.

const GRAPH = "https://graph.instagram.com";
const OAUTH = "https://api.instagram.com";

const APP_ID = process.env.IG_APP_ID;
const APP_SECRET = process.env.IG_APP_SECRET;
const REDIRECT_URI = process.env.IG_REDIRECT_URI;

// ---- OAuth helpers -------------------------------------------------------

function authorizeUrl(state = "horizon") {
  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "instagram_business_basic",
    state,
  });
  return `${OAUTH}/oauth/authorize?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    client_id: APP_ID,
    client_secret: APP_SECRET,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
    code,
  });
  const res = await fetch(`${OAUTH}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Code exchange failed: ${res.status} ${await res.text()}`);
  return res.json(); // { access_token, user_id, permissions }
}

async function toLongLivedToken(shortToken) {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: APP_SECRET,
    access_token: shortToken,
  });
  const res = await fetch(`${GRAPH}/access_token?${params.toString()}`);
  if (!res.ok) throw new Error(`Long-lived exchange failed: ${res.status} ${await res.text()}`);
  return res.json(); // { access_token, token_type, expires_in }
}

async function refreshLongLivedToken(token) {
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: token,
  });
  const res = await fetch(`${GRAPH}/refresh_access_token?${params.toString()}`);
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  return res.json(); // { access_token, token_type, expires_in }
}

// ---- Media -------------------------------------------------------------

// Pull media, following pagination up to `limit` items.
async function fetchMedia(token, limit = 60) {
  const fields = [
    "id",
    "caption",
    "media_type",
    "media_url",
    "permalink",
    "thumbnail_url",
    "timestamp",
  ].join(",");

  let url =
    `${GRAPH}/me/media?fields=${encodeURIComponent(fields)}` +
    `&limit=25&access_token=${encodeURIComponent(token)}`;

  const items = [];
  while (url && items.length < limit) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Media fetch failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    items.push(...(json.data || []));
    url = json.paging && json.paging.next ? json.paging.next : null;
  }
  return items.slice(0, limit);
}

// Normalise the raw Graph payload into what the frontend needs.
function normalize(items) {
  return items
    .filter((m) => m.media_type === "IMAGE" || m.media_type === "CAROUSEL_ALBUM")
    .map((m) => ({
      id: m.id,
      src: m.media_url,
      thumb: m.thumbnail_url || m.media_url,
      caption: (m.caption || "").trim(),
      permalink: m.permalink,
      timestamp: m.timestamp,
    }));
}

module.exports = {
  authorizeUrl,
  exchangeCodeForToken,
  toLongLivedToken,
  refreshLongLivedToken,
  fetchMedia,
  normalize,
};
