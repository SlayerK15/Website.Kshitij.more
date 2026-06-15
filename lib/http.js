// lib/http.js
// Small helper to read a JSON request body without relying on a
// runtime-specific body parser (works under `vercel dev` and plain Node).
function readJSON(req) {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined) {
      if (typeof req.body === "string") {
        try { resolve(req.body ? JSON.parse(req.body) : {}); } catch (e) { reject(e); }
      } else {
        resolve(req.body);
      }
      return;
    }
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

module.exports = { readJSON };
