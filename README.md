# Pulse — Private Family Wealth Dashboard

A single-page, PIN-gated wealth dashboard for tracking covered calls, stocks, mutual funds, metals, and real estate. Hosted on Cloudflare Pages. No backend server. No database. No framework.

---

## Purpose

Pulse is a personal financial operating system built for one family. It aggregates live market data from multiple free and authenticated sources, displays portfolio positions with real-time P&L, and surfaces a daily AI briefing — all behind a PIN gate with client-side encryption for sensitive credentials.

It is intentionally simple: one HTML file, a handful of Cloudflare Pages Functions for CORS-safe API proxying, and localStorage for persistence. No build pipeline, no npm, no React.

---

## Pulse Advisory v1 — Status

**Release:** `v1.0.0-advisory` · **Commit:** `3c93bc7` · **Branch:** `claude/pulse-cc-basket-fix-7epdll`

The CC Basket tab now includes a real-time covered-call advisory engine. For each symbol with live Upstox data it emits a single, numerically grounded recommendation — `WRITE_NOW`, `WAIT`, `HOLD`, `ROLL`, `RECYCLE`, `CLOSE`, `EXTEND`, or `DATA_MISSING` — with the exact contract, yield figures, and reasoning.

**Frozen:** No new quant features (Delta, Greeks, IV analytics) until ≥3 live expiry cycles validate v1 recommendations. See `TODO_v2.md`.

---

## Architecture

```
Browser (index.html — single SPA file)
│
├── PIN gate (PBKDF2 key derivation, AES-256-GCM)
│   └── Upstox token: encrypted in localStorage, decrypted transiently in memory
│
├── Tab: CC Basket
│   ├── loadCC()
│   │   ├── 1. Reset p.live, _upstoxErr, _writeAdv, _posAdv
│   │   ├── 2. Fetch /api/upstox-options?expiry=YYYY-MM-DD
│   │   │       └── Cloudflare Pages Function → Upstox v2 API (token forwarded, never stored)
│   │   ├── 3. applyChain(): write Upstox LTPs → set p.live = true
│   │   ├── 4. NSE fallback fetch (skipped if p.live already true)
│   │   ├── 5. ccWriteAdvisory() for each CC_UNIVERSE symbol
│   │   ├── 6. ccPositionAdvisory() for each open position
│   │   └── 7. renderCC() + renderAdvisory()
│   │
│   ├── ccBestStrike(spot, strikes, minOtmPct, maxOtmPct)
│   │   └── Returns highest-LTP CE in the OTM band
│   ├── ccWriteAdvisory(sym, spot, strikes, dte, lot, cfg, secondarySpot)
│   │   └── Returns: strike, LTP, SL, annRet, OTM%, capReq, IV, action, reason
│   └── ccPositionAdvisory(p, spot, strikes, dte, cfg, bestFresh)
│       └── Returns: captPct, premRem, remAnn, assignProb, action, reason
│
├── Tab: Overview → /api/summary (Cloudflare Function → Anthropic Claude API)
├── Tab: Markets → Yahoo Finance query1.finance.yahoo.com
├── Tab: Stocks → Yahoo Finance
├── Tab: MF → mfapi.in (AMFI)
├── Tab: Metals → Yahoo Finance
└── Tab: Home → static valuation

Cloudflare Pages Functions (functions/api/)
├── upstox-options.js   ← CC LTPs + IV from Upstox v2 option chain
├── nse-options.js      ← NSE fallback (unreliable from cloud IPs)
└── summary.js          ← AI briefing via Claude

Persistence: localStorage only (via LS.get/LS.set helpers, pulse_ prefix)
```

---

## Features

| Tab | What it does |
|-----|-------------|
| **Overview** | Aggregated net worth snapshot across all modules; AI briefing via Claude |
| **Markets** | Live quotes for equity indices and global ETFs via Yahoo Finance |
| **CC Basket** | Covered call advisory engine — write candidates, open position decisions, live LTPs from Upstox → NSE → manual fallback; MTM P&L, decay bars |
| **Stocks** | Individual equity holdings with live prices and P&L |
| **MF** | Mutual fund NAVs via mfapi.in (AMFI data, no key required) |
| **Metals** | Gold and silver price tracking |
| **Home** | Real estate asset valuation |

**Security:** AES-256-GCM client-side encryption of the Upstox API token. PIN never leaves the browser. Token never stored in plaintext or on any server.

**PWA:** Installable on mobile and desktop via `manifest.json`.

---

## Quick Start (Local Preview)

The site has no build step. Serve the root directory with any static file server:

```bash
# Python
python3 -m http.server 8080

# Node (npx)
npx serve .
```

Then open `http://localhost:8080`.

**Limitations of local preview:**
- Cloudflare Pages Functions (`/api/*` routes) will not work locally without Wrangler.
- LTP fetches will fail; manual LTP override still works.
- PIN gate and encryption work normally (uses `crypto.subtle` — requires localhost or HTTPS).

**With Wrangler (full local dev):**

```bash
npm install -g wrangler
wrangler pages dev . --port 8080
```

This runs Pages Functions locally, so all `/api/*` routes work.

---

## Deployment

**Platform:** Cloudflare Pages (direct upload or GitHub integration)

**Required Cloudflare Pages settings:**

| Setting | Value |
|---------|-------|
| Build command | *(leave blank — no build step)* |
| Build output directory | `/` (root) |
| Root directory | `/` (root) |
| Node.js compatibility | Enable (for `getSetCookie` in `options.js`) |

**Optional environment variables** (Pages → Settings → Environment Variables):

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Enables AI briefing on the Overview tab. Not required. |
| `UPSTOX_ACCESS_TOKEN` | Server-side fallback Upstox token. Not required — browser-side encrypted token is the primary path. |

**Deploy via GitHub:**
1. Connect the `madhukamath2000-lang/Cc-basket` repository to a Cloudflare Pages project.
2. Set the branch to `main` (or whichever branch is approved for production).
3. Leave build command blank.
4. Cloudflare will auto-deploy on every push to the production branch.

**Custom domain:** `pulse.madhukamath.com` — configured in Cloudflare Pages → Custom Domains.

**Cache config:** `_headers` sets `Cache-Control: no-store, must-revalidate` for `/` and `/index.html` so users always receive the latest version without a hard reload.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Plain HTML5 / CSS3 / Vanilla JS (ES2020+) |
| Hosting | Cloudflare Pages (static) |
| API proxies | Cloudflare Pages Functions (ES module Workers) |
| Encryption | Web Crypto API — AES-256-GCM, PBKDF2-SHA-256 |
| Market data (equities) | Yahoo Finance (`query1.finance.yahoo.com`) — no key |
| Market data (options) | Upstox v2 API (token required) + NSE option chain (cookie-based, no key) |
| Market data (MF) | mfapi.in — AMFI data, no key |
| AI briefing | Anthropic Claude API (`claude-sonnet-4-20250514`) — optional |
| Fonts | Google Fonts — Chakra Petch + IBM Plex Mono |
| PWA | `manifest.json` + `apple-mobile-web-app` meta tags |
