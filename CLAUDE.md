# CLAUDE.md — Pulse Repository

This file is read by Claude Code at the start of every session on this repository. It captures architecture rules, coding standards, deployment rules, and safety principles that must be followed without exception.

---

## What This Project Is

**Pulse** is a private, single-user family wealth dashboard. It is a plain HTML/CSS/JS single-page application hosted on Cloudflare Pages with Cloudflare Pages Functions as API proxies.

- **No framework.** No React, Vue, Angular, Next.js, or any other UI framework.
- **No build step.** No webpack, Vite, Rollup, or any bundler. The source is deployed as-is.
- **No database.** All persistence is `localStorage` in the user's browser.
- **No backend server.** The Cloudflare Pages Functions are stateless API proxies only.

Understand this deeply before suggesting any change. The simplicity is intentional and load-bearing.

---

## Architecture Rules

### The Single-File SPA
The entire application lives in `index.html`. This is intentional. Do not split it into multiple files, do not introduce module imports, do not suggest a build pipeline. If a change requires adding a second HTML or JS file, the scope of the change is too large — escalate to the user first.

### Cloudflare Pages Functions
- All files in `functions/api/` are ES modules. Export `onRequest(context)`. Nothing else.
- No Node.js APIs. The Workers runtime provides: `fetch`, `Response`, `Request`, `URL`, `AbortController`, `crypto`, `setTimeout`, `Promise`, `JSON`.
- Functions are stateless. Do not attempt to use global variables to cache state between requests.
- The `context.env` object is the only way to access Cloudflare environment variables (API keys, etc.).

### LocalStorage
All reads and writes to `localStorage` must go through the `LS` helper defined in `index.html`:
```js
LS.get(key, defaultValue)  // reads pulse_{key}, JSON.parse, returns defaultValue on error
LS.set(key, val)           // writes pulse_{key} as JSON
```
Never call `localStorage.getItem` or `localStorage.setItem` directly. Never use a key without the `pulse_` prefix.

### The `p.live` Flag
`CC_POSITIONS[i].live` is a single-call flag. It must be reset to `false` at the start of every `loadCC()` call:
```js
CC_POSITIONS.forEach(p => { p.live = false; });
```
Do not add any logic that sets `p.live = true` and expects it to persist across `loadCC()` calls. The flag's only valid use is to prevent `applyChain` from overwriting Upstox data with NSE data within a single refresh cycle.

### `window._upstoxErr`
Reset to `null` at the start of every `loadCC()` call:
```js
window._upstoxErr = null;
```
Set it when a top-level Upstox error is detected, or when all positions are unfilled after an Upstox response and a per-symbol error exists. Never let a value from a previous cycle persist into the current one.

---

## Security Rules — Non-Negotiable

**Before any change to the security model, stop and ask the user.**

### Token handling
1. The Upstox token is **never stored in plaintext** anywhere — not in `localStorage`, not in a cookie, not in a URL param, not in a log.
2. The token is encrypted with AES-256-GCM before going to `localStorage`. The key is derived from the user's PIN via PBKDF2 (150,000 iterations, random salt, SHA-256). Do not reduce iteration count. Do not use a fixed salt.
3. The decrypted token lives **transiently in memory only** — the return value of `getUpstoxToken()`. It is used in the `x-upstox-token` HTTP header and then garbage-collected.
4. The Cloudflare Function `upstox-options.js` forwards the token to Upstox API and **never logs it, never returns it, never stores it**.
5. When saving a token, the input field is wiped immediately (`el.value = ''`). This must never be removed.
6. Any legacy plaintext token is purged on save (`localStorage.removeItem('pulse_upstox_token')`). This must never be removed.

### Secrets in source
**Never hardcode any secret in any file.** No API keys, no tokens, no passwords, no ISIN codes that could be used for trading without authorisation. The only permitted API key reference is `env.ANTHROPIC_API_KEY` and `env.UPSTOX_ACCESS_TOKEN` — read from Cloudflare environment variables, never from source.

### PIN handling
- The PIN hash (`pulse_pin_hash`) is SHA-256. Do not switch to a weaker hash.
- The plaintext PIN is in `sessionStorage` only, as `pulse_pin`. It is never written to `localStorage`.
- Do not add a "remember PIN" feature without a full security design review.

---

## Coding Standards

### Comments
Write no comments unless the WHY is genuinely non-obvious: a hidden constraint, a subtle workaround, an invariant that would surprise a reader. Never explain WHAT the code does — use good names for that.

### Error handling
Validate only at system boundaries (user input, external API responses). Do not add error handling for internal code paths that cannot fail. Do not write `catch(e){}` anywhere new — silent failure is usually worse than an uncaught error for debugging. If a catch is necessary, at minimum set `setErr()` or `window._upstoxErr` with the error message.

### No premature abstraction
Three similar lines is better than a premature helper. Only extract a function when it is used in three or more genuinely distinct callsites and the extraction reduces cognitive load, not just line count.

### No unused code
Do not leave commented-out code, `_unused` variable names, or dead functions. Delete unused code completely.

### Financial arithmetic
All P&L calculations follow the formula documented in `ARCHITECTURE.md`. Do not introduce new P&L computation patterns without verifying them against the established formulas. Round monetary values to 2 decimal places where displayed; keep full precision in intermediate calculations.

---

## Deployment Rules

1. **Never push directly to `main`.** All changes go to a feature branch. Merge to `main` is a deliberate production deploy.
2. **Cloudflare Pages auto-deploys on merge to main.** Treat a push to `main` as equivalent to a production deploy.
3. **Run the deployment validation checklist** from `TEST_PLAN.md` section 12 after every deploy.
4. **No build step.** Do not add a `package.json`, `wrangler.toml`, or `build` script to this project. Cloudflare Pages builds the project by deploying the root directory as-is.
5. **Do not introduce npm dependencies.** If you think you need one, reconsider. This project is deliberately dependency-free.
6. **The `_headers` file is not a Netlify file.** It is a Cloudflare Pages `_headers` convention. Do not modify it without understanding that it sets edge-level cache headers.

---

## What Not to Change Without Explicit User Approval

| Item | Why |
|------|-----|
| PBKDF2 parameters (iterations, salt length, hash) | Changing weakens encryption of existing stored tokens |
| AES-256-GCM IV generation | Must remain random-per-encryption |
| `pulse_` localStorage prefix | Changing orphans all existing user data |
| `_v3` suffix on `cc_positions_v3`, `cc_booked_v3` | Changing without migration causes data loss |
| `x-upstox-token` header name | Must match between `index.html` and `upstox-options.js` |
| The PIN gate logic (first `<script>` block) | Core security boundary; changes need full review |
| Brand palette (CSS variables) | Pulse identity; changes require explicit design approval |
| Google Fonts URLs | Changing breaks the brand typography |
| `claude-sonnet-4-20250514` in `summary.js` | Changing model changes AI behaviour; user should decide |

---

## Known Fragile Areas

- **`nextNSEExpiry()`** — hardcodes "last Thursday of month". If NSE changes expiry convention, this breaks silently (Upstox will return empty data for the computed date).
- **NSE option chain fallback** — unreliable from cloud IPs. Do not invest debugging time in NSE failures without first checking whether it is an IP block (HTTP 403/429 from NSE).
- **Yahoo Finance** — undocumented API, no SLA. The `/v8/finance/chart/` endpoint has been stable for years but could change without notice.
- **Upstox `UNDERLYINGS` map** — hardcoded in `upstox-options.js`. Adding or removing a covered call symbol requires editing this file and redeploying.

---

## Useful Reference Points in `index.html`

| What | Where |
|------|-------|
| PIN gate + crypto functions | Lines 117–172 (first `<script>` block) |
| CC Basket HTML | Lines 317–363 |
| Data definitions (positions, stocks, MF, metals, home) | Lines 522–593 |
| `loadCC()` function | Around line 887 |
| `applyChain()` inner function | Inside `loadCC()` |
| `renderCC()` function | Around line 858 |
| `nextNSEExpiry()` function | Search for `nextNSEExpiry` |
| `LS` helper | Around line 518 |
| `tfetch` helper | Around line 511 |
| `refreshAll()` | Near end of second `<script>`, around line 1300+ |
| Init (calls `refreshAll` on load) | Lines 1348–1354 |

---

## Session Startup Checklist

At the start of every Claude session on this repo:
1. Read `ARCHITECTURE.md` to understand the system.
2. Read `PROJECT_STATUS.md` to understand current state and known issues.
3. Read `CHANGELOG.md` to understand what has changed recently.
4. If the task involves `loadCC()` or the CC Basket, re-read the `p.live` flag rule above before touching any code.
5. If the task involves security (PIN, token, encryption), re-read the Security Rules section above before touching any code.
6. Do not assume the repo state matches the live site without checking the Cloudflare Pages deployment log.
