// Live NSE option chain proxy — no API key. Route: /api/options
// NOTE: NSE blocks many datacenter IPs; this is a best-effort fallback. The CC tab's
// primary feed is Upstox (/api/upstox-options); manual override exists if both are down.
const NSE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/option-chain",
};

async function getCookies() {
  const r = await fetch("https://www.nseindia.com/option-chain", { headers: NSE_HEADERS, redirect: "follow" });
  const setCookies = r.headers.getSetCookie?.() ?? [];
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

async function fetchChain(symbol, cookie) {
  const url = `https://www.nseindia.com/api/option-chain-equities?symbol=${encodeURIComponent(symbol)}`;
  const r = await fetch(url, { headers: { ...NSE_HEADERS, Cookie: cookie } });
  if (!r.ok) throw new Error(`NSE HTTP ${r.status}`);
  return await r.json();
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const symbols = (url.searchParams.get("symbols") || "")
    .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 12);
  const wantExpiry = url.searchParams.get("expiry"); // e.g. 25-Jun-2026
  if (!symbols.length) return json({ error: "symbols required" }, 400);

  let cookie = "";
  try { cookie = await getCookies(); } catch {}

  const out = {};
  for (const sym of symbols) {
    try {
      const j = await fetchChain(sym, cookie);
      const records = j?.records;
      const expiries = records?.expiryDates || [];
      const useExpiry = wantExpiry && expiries.includes(wantExpiry) ? wantExpiry : expiries[0];
      const strikes = {};
      for (const row of records?.data || []) {
        if (row.expiryDate !== useExpiry) continue; // ONLY chosen expiry — no cross-expiry mixups
        const k = String(row.strikePrice);
        if (!strikes[k]) strikes[k] = {};
        if (row.CE) strikes[k].CE = {
          ltp: row.CE.lastPrice, change: row.CE.change,
          oi: row.CE.openInterest, iv: row.CE.impliedVolatility, expiry: row.expiryDate,
        };
      }
      out[sym] = {
        underlying: records?.underlyingValue,
        usedExpiry: useExpiry,
        expiryDates: expiries.slice(0, 4),
        strikes,
      };
      await new Promise((r) => setTimeout(r, 350)); // gentle on NSE rate limits
    } catch (e) {
      out[sym] = { error: e.message };
    }
  }

  return json(out, 200, "public, max-age=120");
}

function json(obj, status = 200, cache) {
  const headers = { "Content-Type": "application/json" };
  if (cache) headers["Cache-Control"] = cache;
  return new Response(JSON.stringify(obj), { status, headers });
}
