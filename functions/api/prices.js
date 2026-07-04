// Yahoo Finance quote proxy (CORS-safe, no key). Route: /api/prices
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const symbols = url.searchParams.get("symbols");
  if (!symbols) return json({ error: "symbols param required" }, 400);

  const list = symbols.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);

  const fetchOne = async (symbol) => {
    try {
      const r = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
        { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" } }
      );
      if (!r.ok) return { symbol, error: `HTTP ${r.status}` };
      const j = await r.json();
      const meta = j?.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) return { symbol, error: "no data" };
      const price = meta.regularMarketPrice;
      const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
      const pct = prev ? ((price - prev) / prev) * 100 : 0;
      return { symbol, price, prev, pct };
    } catch (e) {
      return { symbol, error: e.message };
    }
  };

  const results = await Promise.all(list.map(fetchOne));
  const out = {};
  for (const r of results) out[r.symbol] = r;
  return json(out, 200, "public, max-age=60");
}

function json(obj, status = 200, cache) {
  const headers = { "Content-Type": "application/json" };
  if (cache) headers["Cache-Control"] = cache;
  return new Response(JSON.stringify(obj), { status, headers });
}
