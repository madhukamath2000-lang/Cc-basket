// AI summary proxy to Anthropic. Route: /api/summary
// OPTIONAL: set ANTHROPIC_API_KEY in Cloudflare Pages env vars to enable the AI briefing.
// This is unrelated to the Upstox token and not required for the dashboard to work.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(
      { error: "no_key", message: "AI summary disabled — add ANTHROPIC_API_KEY in Cloudflare Pages env vars." },
      200
    );
  }

  try {
    const { prompt } = await request.json();
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{ role: "user", content: String(prompt).slice(0, 8000) }],
      }),
    });
    const d = await r.json();
    const text = d?.content?.[0]?.text || "Summary unavailable.";
    return json({ text }, 200);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
