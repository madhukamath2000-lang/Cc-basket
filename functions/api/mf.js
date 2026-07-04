// Mutual fund NAVs via mfapi.in (free, AMFI data, no key). Route: /api/mf
// GET /api/mf?ids=120503,118989  → latest + previous NAV per scheme code
// GET /api/mf?search=quant arbitrage  → scheme code search
const tf = async (u, ms) => {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(u, { signal: ac.signal }); }
  finally { clearTimeout(t); }
};

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const search = url.searchParams.get("search");
  const ids = url.searchParams.get("ids");

  try {
    if (search) {
      const r = await tf(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(search)}`, 8000);
      const j = await r.json();
      return json(j.slice(0, 10), 200, "public, max-age=86400");
    }

    if (ids) {
      const codes = ids.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
      const out = {};

      // ESSENTIAL: latest NAV per fund — small payload, parallel, 6s cap each.
      await Promise.all(codes.map(async (code) => {
        try {
          const r = await tf(`https://api.mfapi.in/mf/${code}/latest`, 6000);
          const j = await r.json();
          const d = j?.data;
          if (d?.length) out[code] = { name: j.meta?.scheme_name, nav: parseFloat(d[0].nav), date: d[0].date };
          else out[code] = { error: "no data" };
        } catch (e) { out[code] = { error: e.message || "fetch failed" }; }
      }));

      // OPTIONAL: previous NAV for the day-change arrow — large payload, whole round capped at 4s.
      await Promise.race([
        Promise.all(codes.map(async (code) => {
          if (!out[code] || out[code].error) return;
          try {
            const r = await tf(`https://api.mfapi.in/mf/${code}`, 4000);
            const j = await r.json();
            const d = j?.data;
            if (d?.length > 1) out[code].prevNav = parseFloat(d[1].nav);
          } catch {}
        })),
        new Promise((res) => setTimeout(res, 4000)),
      ]);

      return json(out, 200, "public, max-age=3600");
    }

    return json({ error: "ids or search required" }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(obj, status = 200, cache) {
  const headers = { "Content-Type": "application/json" };
  if (cache) headers["Cache-Control"] = cache;
  return new Response(JSON.stringify(obj), { status, headers });
}
