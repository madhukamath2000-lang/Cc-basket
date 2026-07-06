// Upstox option chain — primary feed for CC LTPs. Route: /api/upstox-options
// Token comes from the x-upstox-token header (sent by the browser, encrypted at rest
// on-device) OR an optional UPSTOX_ACCESS_TOKEN env var. The token is NEVER stored here.
const UNDERLYINGS = {
  HDFCBANK: "NSE_EQ|INE040A01034",
  ICICIBANK: "NSE_EQ|INE090A01021",
  INFY: "NSE_EQ|INE009A01021",
  MAZDOCK: "NSE_EQ|INE249Z01020",
  RELIANCE: "NSE_EQ|INE002A01018",
  SUNPHARMA: "NSE_EQ|INE044A01036",
  TMPV: "NSE_EQ|INE155A01022",
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const expiry = url.searchParams.get("expiry"); // YYYY-MM-DD
  if (!expiry) return json({ error: "expiry required" }, 400);

  const token = request.headers.get("x-upstox-token") || env.UPSTOX_ACCESS_TOKEN;
  if (!token) return json({ error: "No Upstox token saved — paste it in Pulse → CC tab" }, 503);

  const out = {};
  await Promise.all(
    Object.entries(UNDERLYINGS).map(async ([sym, key]) => {
      try {
        const r = await fetch(
          `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(key)}&expiry_date=${expiry}`,
          { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
        );
        if (!r.ok) { out[sym] = { error: `Upstox HTTP ${r.status}` }; return; }
        const j = await r.json();
        const strikes = {};
        for (const row of j?.data || []) {
          const k = String(row.strike_price);
          const ce = row.call_options?.market_data;
          if (!ce) continue;
          // IV lives in option_greeks in the Upstox v2 schema, not in market_data.
          // Check all known locations in priority order; null if absent or zero (0% IV is not meaningful).
          const g = row.call_options?.option_greeks;
          const rawIv = g?.iv ?? g?.implied_volatility ?? ce?.iv ?? ce?.implied_volatility ?? null;
          const iv = (rawIv != null && rawIv > 0) ? rawIv : null;
          strikes[k] = { CE: { ltp: ce.ltp, oi: ce.oi, prevClose: ce.close_price, iv } };
        }
        out[sym] = { underlying: j?.data?.[0]?.underlying_spot_price, usedExpiry: expiry, strikes };
      } catch (e) {
        out[sym] = { error: e.message };
      }
    })
  );

  return json(out, 200, "public, max-age=60");
}

function json(obj, status = 200, cache) {
  const headers = { "Content-Type": "application/json" };
  if (cache) headers["Cache-Control"] = cache;
  return new Response(JSON.stringify(obj), { status, headers });
}
