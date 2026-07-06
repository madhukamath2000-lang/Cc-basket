# Pulse — Project Status

*As of: 2026-07-04*

---

## Current Release

**Branch:** `claude/pulse-cc-basket-fix-7epdll`
**Commit:** `c3b5727` — "Replace legacy prototype with real Pulse Cloudflare Pages source + fix CC Basket LTP refresh"
**Status:** Staged for production — awaiting Cloudflare Pages deployment from this branch (or merge to main)

---

## Working Features

### Core Infrastructure
- [x] PIN gate with SHA-256 hash comparison
- [x] AES-256-GCM client-side encryption of Upstox token (PBKDF2, 150k iterations)
- [x] Cloudflare Pages Functions routing (`/api/*`)
- [x] `_headers` cache-busting for `index.html`
- [x] PWA installable (`manifest.json`, apple meta tags)
- [x] 5-minute auto-refresh of all data (`setInterval(refreshAll, 5*60*1000)`)
- [x] Animated number count-up on all financial figures

### CC Basket
- [x] Live LTP fetch from Upstox v2 option chain API (token encrypted on-device)
- [x] NSE option chain fallback when Upstox unavailable
- [x] Manual LTP override input (last resort)
- [x] Per-position source tag (UPSTOX LIVE / NSE LIVE / MANUAL)
- [x] MTM P&L per position with decay bar and percentage
- [x] Action signals (HOLD / WATCH / BUY BACK NOW / BOOK PROFIT)
- [x] Stop-loss threshold display
- [x] Premium collected (total open premium)
- [x] Booked P&L for closed positions this cycle (`CYCLE_BOOKED`)
- [x] Net this cycle = booked + open MTM
- [x] Edit positions (strike, avg, qty, SL) with localStorage persistence
- [x] Close position → prompt for exit price → compute realized P&L → move to booked
- [x] Token status UI (live green / expired red / no-token grey)
- [x] Expiry countdown (days remaining to monthly NSE expiry)
- [x] **LTP refresh now works correctly on repeated calls** (bug fixed this release)
- [x] **Per-symbol Upstox errors now surfaced in UI** (e.g. "Upstox HTTP 401")

### Markets
- [x] Live quotes for equity indices and global ETFs (Yahoo Finance proxy)
- [x] Day change percentage

### MF
- [x] Latest NAV per scheme (mfapi.in, AMFI data)
- [x] Previous NAV for day-change arrow (best-effort, 4s race timeout)
- [x] Scheme code search

### Overview
- [x] Aggregated net worth across all modules
- [x] AI briefing via Anthropic Claude API (gracefully disabled if no API key)
- [x] Module-level P&L tiles

### Stocks, Metals, Home
- [x] Static holdings with live price overlay
- [x] P&L computations

---

## Known Issues

### Feed Reliability
- **NSE option chain is unreliable from Cloudflare datacenter IPs.** NSE blocks many cloud egress IPs. The NSE fallback may return errors for some or all symbols depending on which Cloudflare datacenter handles the request. This is an upstream NSE restriction, not a code bug.
- **Yahoo Finance may throttle.** No rate-limit handling beyond the 30-symbol cap in `prices.js`. If throttled, individual symbols return `{error: "HTTP 429"}` — the UI shows last-known values silently.
- **Upstox tokens expire daily.** The user must paste a fresh token each trading day. There is no token refresh flow.

### UX
- **No offline mode.** If all feeds fail and the page is reloaded, the last-known values in `localStorage` are shown, but there is no explicit "you are offline" indicator at the page level.
- **PIN recovery is impossible.** If the user forgets their PIN, the encrypted Upstox token is permanently unrecoverable (by design). There is no reset/recovery flow — the user must paste the token again after clearing `pulse_upstox_token_enc` from localStorage.
- **Mobile keyboard on LTP inputs.** On iOS Safari, number inputs with `step="0.05"` can show decimal keyboards inconsistently.

### Data
- **Positions are hardcoded in `index.html`.** The initial `CC_POSITIONS`, `STOCKS`, `METALS`, `MF`, and `HOME` arrays are defined directly in the JS. Edits made via the UI are persisted to localStorage and override the defaults — but if `localStorage` is cleared, positions revert to the hardcoded defaults. This is intentional for a single-user personal dashboard.
- **CYCLE_BOOKED resets require manual clearing.** There is no "new cycle" button. To start a new options cycle, the user must edit the booked amount input to `0`.
- **`nextNSEExpiry()` assumes last Thursday of the month.** If NSE changes its expiry convention (e.g., moves to Tuesdays, or introduces weekly expiries for these stocks), this function must be updated.

---

## Technical Debt

| Item | Severity | Notes |
|------|----------|-------|
| Positions hardcoded in `index.html` | Low | Intentional for single-user, but makes multi-cycle resets awkward |
| `UNDERLYINGS` map hardcoded in `upstox-options.js` | Medium | Adding a new covered call symbol requires editing the Function file and redeploying |
| No structured error logging | Low | `catch(e){}` swallows many errors silently; only user-visible errors are surfaced |
| Google Fonts loaded from CDN | Low | External dependency; fonts fail to load if Google CDN is unreachable (falls back to system fonts) |
| `claude-sonnet-4-20250514` hardcoded in `summary.js` | Low | Model ID will eventually be deprecated; needs periodic update |
| No CSP headers | Medium | No `Content-Security-Policy` header is set. Low risk for a single-user personal site with no user-submitted content, but worth adding |
| `cache-control: public` on Upstox options | Medium | All users of this deployment share the 60s cached Upstox response. For a single-user site this is fine, but for a shared deployment it could leak positions across users |
| `nextNSEExpiry()` hardcodes "last Thursday" | Medium | NSE expiry convention for individual stocks is monthly last Thursday. Weekly options (Nifty/BankNifty) are not handled. This is correct for the current CC strategy but would need revision if strategy changes. |

---

## Next Priorities

These are suggested, not committed. All require explicit user approval before implementation.

1. **New cycle reset UI** — a "Start New Cycle" button that zeros `CYCLE_BOOKED` and optionally clears all `CC_POSITIONS`, with a confirmation prompt.
2. **Add symbol support in `upstox-options.js`** — allow the user to configure which symbols appear in the UNDERLYINGS map without editing source code (e.g., via a config section in the CC tab that persists to localStorage).
3. **Token auto-expiry warning** — detect when the Upstox token has been saved for >20 hours and proactively show a "token may be expiring soon" warning before market open.
4. **CSP header** — add a `Content-Security-Policy` to `_headers` to restrict script sources.
5. **Offline indicator** — a top-of-page banner when all three feed sources return errors simultaneously.

---

## Production Readiness Assessment

| Dimension | Status | Notes |
|-----------|--------|-------|
| Core functionality | Ready | CC Basket LTP refresh bug fixed; all tabs functional |
| Security | Ready for intended use case | AES-256-GCM encryption correct; no secrets in source; single-user threat model acceptable |
| Reliability | Acceptable | Upstox + NSE + manual = three-layer fallback; YF may throttle |
| Performance | Good | No build step, no JS framework, Cloudflare edge delivery, 60s/120s API caches |
| Observability | Minimal | No error reporting, no analytics, no uptime monitoring |
| Recoverability | Acceptable | No database to corrupt; worst case is re-pasting the Upstox token |
| Documentation | Now complete | See README, ARCHITECTURE, TEST_PLAN, CONTRIBUTING |

**Verdict:** Production-ready for its intended use case (single-user private family dashboard). Not production-ready for a multi-user deployment without significant changes to the caching model, PIN/auth model, and positions storage.
