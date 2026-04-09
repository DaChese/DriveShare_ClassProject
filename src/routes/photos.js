import express from "express";

const TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const cache = new Map(); // query -> { at, photo }

function cacheGet(key) {
  const v = cache.get(key);
  if (!v) return null;
  if (Date.now() - v.at > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return v.photo;
}

function cacheSet(key, photo) {
  cache.set(key, { at: Date.now(), photo });
}

export default function photoRoutes() {
  const r = express.Router();

  // GET /api/photos/unsplash?query=2022%20Honda%20Civic%20car
  r.get("/unsplash", async (req, res) => {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) {
      return res.status(400).json({ ok: false, error: "UNSPLASH_ACCESS_KEY not set." });
    }

    const query = String(req.query.query || "").trim();
    if (!query) return res.status(400).json({ ok: false, error: "Missing query." });

    const key = query.toLowerCase();
    const hit = cacheGet(key);
    if (hit) return res.json({ ok: true, photo: hit, cached: true });

    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "1");
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("content_filter", "high");

    const apiRes = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${accessKey}` },
    });

    if (!apiRes.ok) {
      const detail = await apiRes.text();
      return res.status(502).json({ ok: false, error: "Unsplash error", detail });
    }

    const json = await apiRes.json();
    const p = json?.results?.[0];
    if (!p) return res.json({ ok: true, photo: null });

    const utm = "utm_source=driveshare&utm_medium=referral";
    const photo = {
      id: p.id,
      small: p.urls?.small,
      regular: p.urls?.regular,
      photographerName: p.user?.name || "Unknown",
      photographerLink: (p.user?.links?.html || "https://unsplash.com") + `?${utm}`,
      unsplashLink: `https://unsplash.com?${utm}`,
    };

    cacheSet(key, photo);
    return res.json({ ok: true, photo, cached: false });
  });

  return r;
}