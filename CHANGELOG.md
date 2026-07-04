# Pulse — Changelog

---

## [Current] — 2026-07-04 — Production Baseline

**Branch:** `claude/pulse-cc-basket-fix-7epdll`
**Commit:** `c3b5727`

### Fixed
- **CC Basket: LTP refresh freeze** — `p.live` flag in `loadCC()` was set to `true` on the first successful LTP fetch but never reset before subsequent refresh cycles. Every `↻ LTPs` click after the first silently skipped all previously-fetched positions (the `if(p.live) return` guard in `applyChain` fired immediately), causing prices to freeze while the timestamp updated normally. Fix: `CC_POSITIONS.forEach(p=>{ p.live=false; })` added at the top of `loadCC()` before any fetch attempts.

- **Silent Upstox error swallowing** — Per-symbol Upstox errors (e.g. `{"HDFCBANK": {"error": "Upstox HTTP 401"}}` for an expired token) were nested inside the response object and never surfaced to `window._upstoxErr`. Only top-level errors (missing param, missing token) were captured. Fix: after `applyChain(rj, 'upstox')`, if `liveCount === 0`, the first `rj[sym].error` value is extracted and assigned to `window._upstoxErr` for display in the UI.

- **Stale Upstox error from previous cycle** — `window._upstoxErr` was set but never cleared, so an error from a previous `loadCC()` call (e.g. "No Upstox token saved") persisted into subsequent calls where the token was now valid but the error text still appeared in the UI. Fix: `window._upstoxErr = null` added at the top of `loadCC()`.

- **Token status: missing error detail** — The "encrypted token saved but feed rejected it" message did not include the reason. Fix: `window._upstoxErr` is now appended to the message when available (e.g. "encrypted token saved but feed rejected it (Upstox HTTP 401)").

### Changed
- Replaced legacy prototype files with real production Pulse source.

### Removed
- `main.py` — Legacy FastAPI backend prototype targeting Render.com. Contained a hardcoded Twelve Data API key (`TD_KEY`), syntax errors (missing `except` clause, inconsistent indentation), and no connection to the live Pulse site.
- `requirements.txt` — FastAPI/uvicorn/httpx dependencies for the above legacy file.
- `CC Basket` — Standalone HTML prototype with hardcoded financial data in plaintext JS, no PIN gate, no token encryption, targeting Render.com as backend. Not part of the live site.

### Added
- `index.html` — Full Pulse SPA (1357 lines). The entire application: PIN gate, encryption, all 7 tabs, all data and logic.
- `functions/api/upstox-options.js` — Upstox v2 option chain proxy. Parallel fetch for 7 configured symbols. Token via header or env var. 60s public cache.
- `functions/api/options.js` — NSE option chain fallback. Cookie-based session. Sequential fetch with 350ms delay. 120s public cache.
- `functions/api/prices.js` — Yahoo Finance CORS proxy. No API key. 60s public cache.
- `functions/api/mf.js` — mfapi.in NAV proxy (AMFI data). Supports `?ids=` and `?search=`. 1h public cache.
- `functions/api/summary.js` — Anthropic Claude API proxy. POST only. Requires `ANTHROPIC_API_KEY` env var; gracefully returns `no_key` error if missing.
- `manifest.json` — PWA manifest (name: "Pulse", background: `#FAF7F0`, theme: `#1A1814`).
- `_headers` — Cloudflare Pages cache override: `no-store, must-revalidate` for `/` and `/index.html`.
- `icon.svg` — App icon.
- `README.md`, `ARCHITECTURE.md`, `PROJECT_STATUS.md`, `TEST_PLAN.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `CLAUDE.md` — Engineering documentation.

---

## [Pre-baseline] — Repository History (Legacy Prototype Phase)

The `madhukamath2000-lang/Cc-basket` repository previously contained an unrelated prototype that was never deployed to `pulse.madhukamath.com`. The actual live Pulse site was deployed separately, outside of source control. This is the history of that prototype phase for completeness.

### Legacy prototype contents (removed in current release)
- **`main.py`** — FastAPI backend with routes `/markets` (Twelve Data integration), `/position` (hardcoded single HDFCBANK CC position), `/portfolio` (placeholder). Had a syntax error (`get_markets()` — inconsistent indentation causing `IndentationError`), an incomplete `try` block with no `except`, and a hardcoded API key committed to source.
- **`requirements.txt`** — `fastapi`, `uvicorn`, `httpx`.
- **`CC Basket`** (HTML file, no extension) — Standalone covered call tracker prototype. Hardcoded HDFCBANK position data. Referenced `http://localhost:8000` (local FastAPI backend) for price data. No PIN gate. No encryption. No Cloudflare integration.

### Real Pulse site history (outside source control)
The production Pulse site at `pulse.madhukamath.com` was developed and deployed independently through Cloudflare Pages. The source was maintained locally and uploaded as a zip (`pulsecloudflare.zip`). This changelog entry marks the point at which the production source was brought into version control.

---

## Format Note

This changelog uses [Keep a Changelog](https://keepachangelog.com/) conventions:
- **Fixed** — bug fixes
- **Changed** — changes to existing behaviour
- **Added** — new files or features
- **Removed** — deleted files or features
- **Deprecated** — features scheduled for removal
- **Security** — security-relevant changes
