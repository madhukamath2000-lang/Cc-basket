# Pulse — Architecture Reference

## High-Level Architecture

```
Browser (pulse.madhukamath.com)
│
├── index.html          ← entire SPA: HTML + CSS + JS in one file
│   ├── PIN gate        ← AES-256-GCM encryption, PBKDF2 key derivation
│   ├── 7 tab pages     ← Overview / Markets / CC / Stocks / MF / Metals / Home
│   └── JS modules      ← data definitions, helpers, load functions, renderers
│
├── /api/upstox-options ← Cloudflare Pages Function
├── /api/options        ← Cloudflare Pages Function (NSE fallback)
├── /api/prices         ← Cloudflare Pages Function (Yahoo Finance)
├── /api/mf             ← Cloudflare Pages Function (mfapi.in)
└── /api/summary        ← Cloudflare Pages Function (Anthropic)
     │
     └── Upstox API / NSE / Yahoo / mfapi.in / Anthropic
         (all external HTTPS calls made server-side by Functions to avoid CORS)
```

There is no database. There is no backend server. All persistent state lives in the browser's `localStorage` under the `pulse_` key prefix.

---

## Frontend

**Single file:** `index.html` (≈1357 lines). No framework, no transpiler, no bundler.

**Structure:**
- `<style>` block: brand CSS variables, layout, component styles
- `<script>` block 1 (lines 117–172): PIN gate and cryptographic functions
- `<body>` (lines 175–509): static HTML shell — header, tab bar, 7 page divs
- `<script>` block 2 (lines 511–1355): all runtime logic

**Brand palette (CSS variables):**
```css
--bg:     #FAF7F0   /* warm off-white */
--ink:    #1A1814   /* near-black */
--gold:   #A6781E   /* accent */
--green:  #2D6A4F
--red:    #7A2222
--muted:  #8C8680
--muted2: #B0AB9E
--border: #E8E3DA
--blue:   #1A4A7A
```

**Fonts:** Chakra Petch (headings, labels) + IBM Plex Mono (numbers). Loaded from Google Fonts at startup.

**Key globals:**
```js
CC_POSITIONS   // Array<Position> — covered call open positions
CYCLE_BOOKED   // number — realized P&L for positions closed this cycle
STOCKS         // Array<Stock> — equity holdings
METALS         // Object — gold/silver quantities and purchase prices
MF             // Array<Fund> — mutual fund holdings with scheme codes
HOME           // Object — real estate assets
PLAN           // Object — financial plan targets
MOD            // Object — computed module metrics fed into Overview rendering
priceData      // Object — last-fetched Yahoo Finance price cache
```

**Helper functions:**
```js
LS.get(key, default)    // localStorage read with pulse_ prefix + JSON.parse
LS.set(key, val)        // localStorage write with pulse_ prefix + JSON.stringify
tfetch(url, ms, opts)   // fetch with AbortController timeout
countUp(el, val, fmt)   // animated number count-up via requestAnimationFrame
fmtINR(val, signed)     // format number as Indian Rupees
pnlClass(el, val)       // apply .up/.dn class based on sign
setErr(id, msg)         // show/hide error note element
stamp(id)               // write current time to a timestamp element
nextNSEExpiry()         // returns Date of last Thursday of current/next month
```

**Initialisation:** `refreshAll()` is called immediately on page load and then on a 5-minute interval (`setInterval(refreshAll, 5*60*1000)`).

---

## Cloudflare Pages

**Project structure:**
```
/
├── index.html           ← served as the SPA
├── manifest.json        ← PWA manifest
├── icon.svg             ← app icon
├── _headers             ← Cloudflare cache directives
└── functions/
    └── api/
        ├── upstox-options.js
        ├── options.js
        ├── prices.js
        ├── mf.js
        └── summary.js
```

**Routing:** Cloudflare Pages automatically maps `functions/api/*.js` to `/api/*` endpoints. No `wrangler.toml` or explicit routing config is required.

**No build step.** Cloudflare Pages deploys the root directory as-is. The `_headers` file is a Cloudflare Pages convention (not a Netlify file).

**`_headers` contents:**
```
/
  Cache-Control: no-store, must-revalidate

/index.html
  Cache-Control: no-store, must-revalidate
```

This ensures the browser always fetches the latest `index.html`. Static assets (`icon.svg`, `manifest.json`) get Cloudflare's default long-lived caching.

---

## Pages Functions

Each function is an ES module exporting `onRequest(context)`. They run in the Cloudflare Workers runtime (V8 isolates, no Node.js APIs — use `fetch`, `Response`, `URL`, `AbortController`).

**Pattern:**
```js
export async function onRequest(context) {
  const url = new URL(context.request.url);
  // ... read params, call upstream API, return Response
}
```

**`context` properties used:**
- `context.request` — the incoming Request
- `context.env` — Cloudflare environment variables (set in Pages dashboard)

---

## API Routes

### `GET /api/upstox-options?expiry=YYYY-MM-DD`

**Purpose:** Primary covered call LTP feed.

**Auth:** Reads `x-upstox-token` header (sent by browser with the decrypted token) OR `env.UPSTOX_ACCESS_TOKEN` (server-side fallback).

**Upstream:** `https://api.upstox.com/v2/option/chain?instrument_key=...&expiry_date=...`

**Symbols hardcoded in the Function:**
```js
HDFCBANK  → NSE_EQ|INE040A01034
ICICIBANK → NSE_EQ|INE090A01021
INFY      → NSE_EQ|INE009A01021
MAZDOCK   → NSE_EQ|INE249Z01020
RELIANCE  → NSE_EQ|INE002A01018
SUNPHARMA → NSE_EQ|INE044A01036
TMPV      → NSE_EQ|INE155A01022
```

**Response shape:**
```json
{
  "HDFCBANK": {
    "underlying": 1820.5,
    "usedExpiry": "2025-06-26",
    "strikes": {
      "1800": { "CE": { "ltp": 12.5, "oi": 450000, "prevClose": 14.2 } }
    }
  }
}
```

**Cache:** `public, max-age=60` (Cloudflare edge caches for 60s — all users of this deployment share the cached response).

**Error responses:**
- `400` — missing `expiry` param
- `503` — no token available

---

### `GET /api/options?symbols=SYM1,SYM2&expiry=25-Jun-2026`

**Purpose:** NSE option chain — fallback when Upstox is unavailable.

**Auth:** None. Uses cookie-based NSE session (fetches homepage cookies first).

**Upstream:** `https://www.nseindia.com/api/option-chain-equities?symbol=...`

**Notes:**
- NSE blocks many datacenter IPs. This is best-effort.
- Fetches symbols sequentially with 350ms delay to respect NSE rate limits.
- `expiry` param is NSE date format: `25-Jun-2026`.

**Cache:** `public, max-age=120`

---

### `GET /api/prices?symbols=RELIANCE.NS,^NSEI`

**Purpose:** Equity and index prices via Yahoo Finance.

**Auth:** None.

**Upstream:** `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=2d`

**Response shape:**
```json
{
  "RELIANCE.NS": { "symbol": "RELIANCE.NS", "price": 1420.5, "prev": 1410.2, "pct": 0.73 }
}
```

**Cache:** `public, max-age=60`

---

### `GET /api/mf?ids=120503,118989`
### `GET /api/mf?search=quant arbitrage`

**Purpose:** Mutual fund NAVs via mfapi.in (AMFI data, no API key).

**`?ids=...`** — fetches latest NAV and previous NAV per scheme code. Latest NAV is fetched in parallel; previous NAV is fetched with a 4-second race timeout (large payload, best-effort).

**`?search=...`** — returns up to 10 scheme results for search query.

**Cache:** `public, max-age=3600` (NAVs update once daily)

---

### `POST /api/summary`

**Purpose:** AI briefing via Anthropic Claude API.

**Auth:** Requires `ANTHROPIC_API_KEY` Cloudflare Pages env var. Returns `{"error":"no_key"}` with HTTP 200 if missing (graceful degradation — the dashboard still works).

**Request body:** `{ "prompt": "string" }` (truncated to 8000 chars server-side)

**Upstream model:** `claude-sonnet-4-20250514`, `max_tokens: 500`

**Response:** `{ "text": "..." }` or `{ "error": "..." }`

---

## Upstox Integration

**Token lifecycle:**

```
User pastes token into CC tab input
    → saveUpstoxToken() called
    → PIN read from sessionStorage (set at unlock time, never persisted)
    → PBKDF2(PIN, randomSalt, 150000 iterations, SHA-256) → AES-256-GCM key
    → AES-GCM encrypt(token) → {iv, salt, ct} → JSON → base64
    → stored as pulse_upstox_token_enc in localStorage
    → input field wiped immediately

On loadCC():
    → getUpstoxToken() reads pulse_upstox_token_enc
    → decrypts using PIN from sessionStorage → plaintext token in memory
    → token sent as x-upstox-token HTTP header to /api/upstox-options
    → Function forwards it to Upstox API as Authorization: Bearer {token}
    → token never logged, never stored server-side, never appears in any response
```

**Token expiry:** Upstox daily tokens expire at market close or after 24h. When expired, `/api/upstox-options` returns `{"HDFCBANK": {"error": "Upstox HTTP 401"}, ...}`. The CC tab surfaces this in the token status UI ("encrypted token saved but feed rejected it (Upstox HTTP 401)").

**Fallback chain:**
```
Upstox /api/upstox-options   ← primary (requires token)
    ↓ (any positions not filled)
NSE /api/options             ← fallback (no token, datacenter-IP-dependent)
    ↓ (any positions still not filled)
Manual LTP override          ← last resort (user types LTPs directly)
```

---

## Security Model

| Concern | Approach |
|---------|---------|
| PIN storage | SHA-256 hash in `localStorage`. Plaintext only in `sessionStorage` (session duration only, never persisted to disk) |
| Token storage | AES-256-GCM encrypted blob in `localStorage`. Plaintext only transiently in memory during fetch, immediately GC'd |
| Token transmission | HTTPS header `x-upstox-token` → Cloudflare Function → Upstox HTTPS. Never in URL params. Never in response bodies. |
| Server-side token | Never stored. `env.UPSTOX_ACCESS_TOKEN` is an optional server-side fallback, not the primary flow |
| Secrets in source | None. No API keys, no tokens, no credentials anywhere in the codebase |
| Cloudflare env vars | `ANTHROPIC_API_KEY` and optional `UPSTOX_ACCESS_TOKEN` — set in Cloudflare dashboard, never in code |
| PBKDF2 parameters | 150,000 iterations, random 16-byte salt per encryption, SHA-256, 256-bit key |
| AES-GCM | Random 12-byte IV per encryption, 128-bit authentication tag |
| Legacy plaintext token | On token save, `localStorage.removeItem('pulse_upstox_token')` purges any pre-encryption plaintext |

**Threat model:** This is a single-user personal dashboard. The PIN gate prevents casual access on a shared or unattended device. The encryption prevents the token from being extracted by inspecting `localStorage` without knowing the PIN. It does not defend against a compromised device or browser extension with localStorage access.

---

## Data Flow

### CC Basket LTP refresh (`loadCC()`)

```
loadCC() called
│
├── Reset: window._upstoxErr=null, CC_POSITIONS.forEach(p=>p.live=false)
│
├── getUpstoxToken()
│   ├── read pulse_upstox_token_enc from localStorage
│   ├── decrypt with PIN from sessionStorage
│   └── return plaintext token (or null)
│
├── fetch /api/upstox-options?expiry=YYYY-MM-DD
│   └── [Function] → Upstox API → return strikes per symbol
│
├── applyChain(rj, 'upstox')
│   └── for each CC_POSITIONS entry: if strike found in data, set p.ltp, p.live=true
│
├── (if any positions still not live)
│   └── fetch /api/options?symbols=...&expiry=...
│       └── [Function] → NSE option chain → return strikes
│       └── applyChain(rj, 'nse')
│
├── stamp('ts-cc')                      // update timestamp display
├── setErr('err-cc', ...)               // show/hide feed status message
├── update #upstox-token-status UI
└── renderCC() → countUp() animations → renderOverview()
```

### Overview rendering

```
renderOverview()
│
├── reads MOD.cc, MOD.stocks, MOD.mf, MOD.metals, MOD.home
├── sums to net worth
└── countUp() on all overview figures
```

Each module's load function (`loadCC`, `loadStocks`, `loadMF`, etc.) writes into `MOD` before calling `renderOverview()`, so Overview is always derived from the last-known values of all modules.

---

## LocalStorage Schema

All keys are prefixed with `pulse_`. The `LS` helper applies this prefix automatically.

| Key (without prefix) | Type | Description |
|---------------------|------|-------------|
| `pin_hash` | string | SHA-256 hex hash of the user's PIN |
| `upstox_token_enc` | string | Base64-encoded JSON `{iv, salt, ct}` — AES-256-GCM encrypted Upstox token |
| `cc_positions_v3` | JSON array | Open covered call positions. See schema below. |
| `cc_booked_v3` | number | Cumulative realized P&L for positions closed in the current options cycle |

**`cc_positions_v3` entry schema:**
```json
{
  "stock":  "HDFCBANK",
  "strike": 1800,
  "avg":    15.5,
  "qty":    550,
  "sl":     31.0,
  "slAmt":  8525,
  "sector": "BANKING",
  "ltp":    12.3,
  "live":   true,
  "src":    "upstox"
}
```

**Version suffix (`_v3`):** The `v3` suffix exists to avoid conflicts with any prior data format stored under the same logical key. If the Position schema changes materially, bump to `v4`.

---

## Database Interactions

None. Pulse has no database. All persistence is `localStorage` in the user's browser. Data is device-local and is lost if the browser storage is cleared.

If multi-device sync or data durability is needed in the future, the natural extension would be Cloudflare KV (for server-side storage keyed by a user identifier) or D1 (for relational data). Neither is currently wired up.
