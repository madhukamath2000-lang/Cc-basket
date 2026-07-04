# Pulse — Contributing Guide

This is a private, single-user family wealth dashboard. Contributions are made by the owner or an assigned engineer. This document defines how changes are made, tested, and deployed safely.

---

## Coding Conventions

### General
- **No framework, no build step.** All logic lives in `index.html` or in Cloudflare Pages Functions (`functions/api/*.js`). Do not introduce React, Vue, bundlers, or transpilers. The simplicity is load-bearing.
- **Vanilla JS only.** ES2020+ features are fine (async/await, optional chaining, nullish coalescing). No TypeScript. No JSX.
- **No comments explaining what the code does.** Well-named identifiers handle that. Only comment when a constraint, invariant, or workaround would surprise a reader: a subtle NSE rate-limit reason, a PBKDF2 iteration count rationale, a Cloudflare Workers API quirk.
- **No error handling for impossible cases.** Trust internal guarantees. Validate only at boundaries (user input, external API responses).
- **One file for the SPA.** `index.html` is intentionally monolithic. It contains the CSS, the PIN gate, the full HTML shell, and all JS. This is a feature, not a smell — it makes the entire application greppable in one search and deployable as a single file.

### CSS
- Use the existing CSS variable palette (`--bg`, `--ink`, `--gold`, `--green`, `--red`, `--muted`, `--muted2`, `--border`, `--blue`). Do not introduce new root colours without updating the brand spec.
- Match the existing component patterns: `.card`, `.total-box`, `.total-row`, `.cc-card`, `.cfg`, `.page-header`. Do not invent new layout primitives.

### JavaScript (`index.html`)
- **`LS.get` / `LS.set`** — always use these for `localStorage`. Never call `localStorage.getItem`/`setItem` directly. The `pulse_` prefix and try/catch are handled by the helper.
- **`tfetch(url, ms, opts)`** — always use this instead of bare `fetch` for external API calls. It wraps AbortController timeout.
- **`countUp(el, val, fmt)`** — always use this instead of `el.textContent = ...` for financial figures. It drives the count-up animation.
- **`setErr(id, msg)`** — use this for all error display. Passing `null` hides the error note.
- **`stamp(id)`** — always call this at the end of a load function to update the timestamp display.
- **Do not assign to `p.live` inside `applyChain` for any logic other than marking a position as successfully fetched.** The flag is reset at the start of each `loadCC()` call and used within that single call to prevent NSE from overwriting Upstox data for already-filled positions.
- **Do not call `renderOverview()` without first populating `MOD`.** Each load function writes its computed values into `MOD.{module}` before calling `renderOverview()`.

### Cloudflare Pages Functions
- Each Function is an ES module: `export async function onRequest(context)`.
- No Node.js APIs. Use only: `fetch`, `Response`, `URL`, `AbortController`, `setTimeout`, `Promise`, `JSON`.
- Never log tokens, keys, or credentials. Never return them in response bodies.
- Always return a `Response` from every code path. Missing returns cause Cloudflare to return a 500.
- Set `Cache-Control` headers explicitly. Public caches (Cloudflare edge) share responses across all users of the deployment — use `private` or omit caching for any user-specific data.
- The `json()` helper pattern is established in all existing Functions. Use it.

---

## Debugging Philosophy

### Start with the browser
1. Open DevTools → Console. Uncaught JS errors are the first thing to check.
2. Open DevTools → Network. Filter by `/api/` to inspect Function requests and responses.
3. Open DevTools → Application → Local Storage → `https://pulse.madhukamath.com`. Inspect `pulse_*` keys directly.

### For CC Basket LTP issues
1. Check DevTools Network for the `/api/upstox-options` request.
2. Inspect the raw JSON response — look for `{"HDFCBANK": {"error": "..."}}` style errors.
3. Check the `#upstox-token-status` element in the DOM — it reflects the current token state.
4. Add a temporary `console.log` in `applyChain` to trace which positions are being matched.

### For encryption/decryption issues
1. Check `sessionStorage` for `pulse_pin` — if missing, the user needs to re-enter their PIN.
2. Check `localStorage` for `pulse_upstox_token_enc` — if missing, no token is saved.
3. Decryption failure is silent (returns `null`). Add temporary logging in `getUpstoxToken()` to catch the error.

### For Cloudflare Function issues
1. Use `wrangler pages dev . --port 8080` locally to run Functions without deploying.
2. Check the Cloudflare Pages dashboard → Functions → Real-time Logs for production errors.
3. Functions have a 10-second CPU time limit and a 30-second wall-clock limit. The NSE option chain Function (sequential fetches, 350ms delay × 12 symbols = ~4.5s minimum) is the closest to these limits.

### For NSE feed failures
The NSE option chain fallback is unreliable from cloud datacenter IPs. Before debugging NSE code, verify whether the failure is an IP block by checking the raw HTTP status returned by the NSE Function (`out[sym].error`). `"NSE HTTP 403"` or `"NSE HTTP 429"` indicates an IP block — no code fix will resolve this; it is an upstream restriction.

---

## Deployment Workflow

### Development branch
All changes go to a feature branch, never directly to `main`.

```bash
git checkout -b fix/description-of-change
# ... make changes ...
git add <specific files>
git commit -m "Fix: description of what and why"
git push -u origin fix/description-of-change
```

### Review
1. Review the diff carefully before pushing.
2. Run the regression tests from `TEST_PLAN.md` (at minimum R1–R11) against a local Wrangler dev server.
3. Check DevTools Console for any new JS errors.
4. Inspect any changed `localStorage` keys to verify data integrity.

### Production deploy
1. The production branch (`main`) is connected to Cloudflare Pages auto-deploy.
2. Merging a feature branch to `main` triggers an automatic deployment.
3. Run the Deployment Validation Checklist from `TEST_PLAN.md` section 12 after every deploy.
4. If a deploy is bad, roll back by reverting the merge commit on `main` — Cloudflare Pages will auto-deploy the reverted state.

### What triggers a deploy
- Any push to the configured production branch in Cloudflare Pages.
- A manual "Retry deploy" in the Cloudflare Pages dashboard.
- A direct upload via `wrangler pages deploy .` (use for urgent hotfixes only).

---

## Adding a New Covered Call Symbol

This requires two changes:

**1. `functions/api/upstox-options.js` — add to `UNDERLYINGS` map:**
```js
const UNDERLYINGS = {
  // existing entries...
  NEWTICKER: "NSE_EQ|ISIN_CODE_HERE",
};
```
The ISIN code can be found in the Upstox instrument master or by searching the Upstox developer portal.

**2. `index.html` — add to `CC_POSITIONS` array** (default position; user can then edit via the UI):
```js
{ stock:"NEWTICKER", strike:0, avg:0, qty:0, sl:0, slAmt:0, sector:"SECTOR", ltp:0, live:false, src:"manual" },
```

After adding, deploy and verify the new symbol appears with "UPSTOX LIVE" after a token refresh.

---

## Changing the Options Expiry Logic

`nextNSEExpiry()` in `index.html` currently returns the last Thursday of the current month (or next month if fewer than 3 days remain). If NSE changes its expiry convention:

1. Update `nextNSEExpiry()` — this drives `expStr` (NSE format "25-Jun-2026") and `expIso` (ISO format "2026-06-25").
2. Verify that `expiryNSEFormat()` and `expiryISO()` produce the correct strings.
3. Test by checking that the Upstox response for the computed `expIso` returns option chain data (i.e., expiry dates in the Upstox response include the computed date).

---

## Changing the PIN

There is no in-app PIN change flow. To change the PIN:
1. Clear `pulse_pin_hash` and `pulse_upstox_token_enc` from localStorage.
2. Hard-reload the page.
3. Set the new PIN.
4. Re-save the Upstox token.

---

## Release Process

1. All changes are on a feature branch and have passed local regression tests.
2. Merge to `main`.
3. Cloudflare auto-deploys within ~60 seconds.
4. Run deployment validation checklist.
5. Update `CHANGELOG.md` with a new entry describing the release.
6. Update `PROJECT_STATUS.md` current release section.
7. Tag the commit: `git tag v{date} && git push origin v{date}` (optional but recommended).

---

## Do Not Touch

These elements must not be changed without a full security review:

| Item | Reason |
|------|--------|
| PBKDF2 iteration count (150,000) | Reducing it weakens key derivation against brute force |
| AES-256-GCM IV generation (`crypto.getRandomValues`) | Must remain random per encryption |
| `pulse_` localStorage prefix | Changing it orphans all saved data for existing users |
| `_v3` suffix on localStorage keys | Changing it without migration code causes data loss |
| `x-upstox-token` header name | Must match in both `index.html` and `upstox-options.js` |
| Token input wipe (`if(el) el.value=''`) | Must remain; prevents token from lingering in the DOM |
| Legacy plaintext token purge (`localStorage.removeItem('pulse_upstox_token')`) | Ensures any pre-encryption plaintext is always cleared on token save |
