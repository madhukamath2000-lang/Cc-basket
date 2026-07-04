# Pulse — Test Plan

All tests are manual. There is no automated test suite. This document defines the repeatable manual test protocol for verifying a deployment.

---

## Environment Setup

Before running tests, ensure:
- You have a valid Upstox access token (obtain from Upstox developer portal or mobile app → Settings → API → Access Token)
- The deployment URL is accessible (local: `http://localhost:8080` with Wrangler, or production: `https://pulse.madhukamath.com/`)
- Browser DevTools → Application → Local Storage is open for inspection during security tests
- Browser is NOT in private/incognito mode for persistence tests (localStorage is session-scoped in incognito)

---

## 1. PIN Gate Tests

### 1.1 First-time setup
**Steps:**
1. Clear all `pulse_*` keys from localStorage.
2. Hard-reload the page (`Cmd+Shift+R` / `Ctrl+Shift+R`).
3. The PIN entry screen should appear.
4. Enter a new PIN (e.g. `1234`). Submit.
5. The PIN is accepted and the dashboard loads.

**Expected:** `pulse_pin_hash` appears in localStorage. Dashboard is unlocked.

### 1.2 Correct PIN on return visit
**Steps:**
1. Hard-reload the page.
2. Enter the correct PIN.

**Expected:** Dashboard loads. No error message.

### 1.3 Wrong PIN
**Steps:**
1. Hard-reload the page.
2. Enter an incorrect PIN.

**Expected:** Error message shown. Dashboard does not load. `sessionStorage` is not populated with `pulse_pin`.

### 1.4 Session persistence
**Steps:**
1. Unlock with correct PIN.
2. Navigate between tabs.
3. Soft-reload the page (F5 / navigate away and back within the same session).

**Expected:** Dashboard remains unlocked (PIN is in `sessionStorage`).

### 1.5 Session expiry on tab close
**Steps:**
1. Unlock with correct PIN.
2. Close the browser tab completely.
3. Reopen `pulse.madhukamath.com`.

**Expected:** PIN gate appears again (sessionStorage cleared on tab close).

---

## 2. Upstox Token Tests

### 2.1 Save token (no prior token)
**Steps:**
1. Navigate to the CC tab.
2. Expand "🔑 UPSTOX TOKEN" section.
3. Paste a valid Upstox token into the input.
4. Click SAVE + GO LIVE.

**Expected:**
- Input field is wiped immediately after save.
- `pulse_upstox_token_enc` appears in localStorage as a base64 string (NOT the plaintext token).
- Token status shows green "🔒✓ live — N positions pulling current LTPs".
- CC cards show "UPSTOX LIVE" tag.

**Verify security:** Inspect `pulse_upstox_token_enc` in localStorage. It must NOT be the raw token string — it should be an opaque base64-encoded blob.

### 2.2 Clear token
**Steps:**
1. With a token saved, expand the token section.
2. Leave the input empty and click SAVE + GO LIVE (or click clear, if available).

**Expected:**
- `pulse_upstox_token_enc` is removed from localStorage.
- Token status shows grey "no token" message.
- LTPs fall through to NSE or manual.

### 2.3 Expired token behavior
**Steps:**
1. Save an expired or invalid token (e.g., a random string).
2. Click ↻ LTPs.

**Expected:**
- Token status shows red message including the error reason (e.g., "Upstox HTTP 401").
- Feed falls through to NSE fallback.
- If NSE also fails, error note shows "Feeds down — last values shown. UPSTOX: Upstox HTTP 401."

### 2.4 Token after PIN change (cannot decrypt)
**Steps:**
1. Save a valid token with PIN `1234`.
2. Clear `pulse_pin_hash` from localStorage.
3. Reload and set a new PIN `5678`.
4. Navigate to CC tab.

**Expected:** Token decryption fails silently (wrong PIN → wrong key). `getUpstoxToken()` returns null. Status shows "no token" message. The encrypted blob remains in localStorage but is unreadable with the new PIN.

---

## 3. CC Basket — LTP Refresh Tests

### 3.1 First refresh loads LTPs (Upstox)
**Steps:**
1. Save a valid Upstox token.
2. Navigate to CC tab.
3. Note all LTP values.
4. Wait 30 seconds.
5. Click ↻ LTPs.

**Expected:** LTP values change (or stay the same if market is closed, but the timestamp updates). CC cards reflect new values.

### 3.2 Repeated refresh re-fetches (regression for the main bug)
**Steps:**
1. Save a valid Upstox token.
2. Click ↻ LTPs three times in succession (wait for each to complete).
3. Note the `src` tag on each card after each click.

**Expected:** All three clicks show "UPSTOX LIVE" tag. Values update on each click. The `live` flag is not stuck — each refresh re-fetches all positions.

**This test specifically validates the fix from commit `c3b5727`.**

### 3.3 NSE fallback when no Upstox token
**Steps:**
1. Clear the Upstox token.
2. Click ↻ LTPs.
3. Wait (NSE fetch is sequential, ~350ms per symbol, may take 5–10 seconds).

**Expected:** Some or all CC cards show "NSE LIVE" tag. If NSE is blocked by datacenter IP, cards remain on last-known values and error note shows "Feeds down".

### 3.4 Manual LTP override
**Steps:**
1. Clear the Upstox token.
2. Expand "✎ MANUAL LTP OVERRIDE".
3. Enter a value for one position.
4. Click UPDATE.

**Expected:** The relevant CC card shows the manually entered LTP. The card tag shows "MANUAL".

### 3.5 Partial feed (some live, some manual)
**Steps:**
1. Save a valid Upstox token that works for some symbols but not others (or disconnect network mid-fetch — difficult to reproduce; alternatively, comment out one symbol from `UNDERLYINGS` in a local test build).

**Expected:** Cards with live data show "UPSTOX LIVE". Cards without live data show "MANUAL" (last-known) and error note shows "N/M live — rest last-known".

---

## 4. CC Basket — P&L Calculations

### 4.1 MTM P&L per position
**Formula:** `(avg - ltp) * qty`
- If `avg=15.50`, `ltp=12.30`, `qty=550` → MTM = `(15.50 - 12.30) * 550 = 1760`

**Verify:** The value shown in the card's "MTM P&L" field matches this formula.

### 4.2 Premium collected
**Formula:** `sum(avg * qty)` for all open positions.

**Verify:** The "PREMIUM COLLECTED (OPEN POSITIONS)" total matches.

### 4.3 Net this cycle
**Formula:** `CYCLE_BOOKED + sum((avg - ltp) * qty)`

**Verify:** "NET THIS CYCLE" equals "BOOKED" + "OPEN MTM".

### 4.4 Close a position
**Steps:**
1. Expand "EDIT POSITIONS".
2. Click "CLOSE → BOOK" on one position.
3. Enter an exit price in the prompt.
4. Confirm.

**Expected:**
- The position is removed from `CC_POSITIONS`.
- `CYCLE_BOOKED` increases by `(avg - exitPrice) * qty`.
- localStorage keys `pulse_cc_positions_v3` and `pulse_cc_booked_v3` are updated.
- Reloading the page preserves the updated state.

---

## 5. Edit Positions

### 5.1 Edit and save position parameters
**Steps:**
1. Expand "EDIT POSITIONS".
2. Change the strike or qty for one position.
3. Click SAVE POSITIONS.

**Expected:** Values persist. On hard reload, the edited values are shown (read from `localStorage`).

### 5.2 Edit BOOKED amount
**Steps:**
1. Expand "EDIT POSITIONS".
2. Change the BOOKED P&L input to a new value.
3. Save.

**Expected:** "BOOKED" and "NET THIS CYCLE" update to reflect the new value.

---

## 6. Markets Tab

### 6.1 Price load
**Steps:** Navigate to Markets tab.

**Expected:** Prices load within 10 seconds. Each symbol shows a price and a day-change percentage (green for positive, red for negative).

### 6.2 Stale market (after hours)
**Expected:** Prices reflect the last closing price. Yahoo Finance returns the `regularMarketPrice` even after hours.

---

## 7. MF Tab

### 7.1 NAV load
**Expected:** NAV figures load for all configured scheme codes. Each fund shows NAV and date.

### 7.2 NAV day change
**Expected:** Day-change arrow appears if previous NAV was fetched successfully within the 4-second race timeout.

---

## 8. Overview Tab

### 8.1 Aggregated net worth
**Expected:** Net worth tile reflects the sum of all module values. Changing a position in CC tab (e.g., via manual LTP override + UPDATE) and then switching to Overview shows the updated net worth.

### 8.2 AI briefing
**With `ANTHROPIC_API_KEY` set:**
- Click "Refresh Briefing" (or equivalent).
- Expected: A short AI-generated summary appears within ~5 seconds.

**Without `ANTHROPIC_API_KEY`:**
- Expected: A graceful message like "AI briefing unavailable" — the tab does not error out.

---

## 9. Regression Tests (Run After Any Code Change)

These are the minimum regression checks after any edit to `index.html` or any Function file:

| # | Test | Pass criteria |
|---|------|---------------|
| R1 | PIN gate appears on hard reload | PIN prompt shown before dashboard |
| R2 | Correct PIN unlocks dashboard | All tabs accessible |
| R3 | CC tab loads without JS errors | DevTools Console shows no uncaught errors |
| R4 | ↻ LTPs clicked 3× — prices update each time | No freeze on 2nd or 3rd click |
| R5 | Token save — localStorage shows encrypted blob, not plaintext | DevTools inspection |
| R6 | Edit positions → save → reload → values persist | localStorage read correctly |
| R7 | Close position → CYCLE_BOOKED increases by correct amount | P&L arithmetic check |
| R8 | `/api/upstox-options` returns JSON (not 404) | curl or DevTools Network |
| R9 | `/api/prices` returns JSON | curl or DevTools Network |
| R10 | `/api/mf` returns JSON | curl or DevTools Network |
| R11 | Overview net worth tile reflects CC + Stocks + MF + Metals + Home | Manual arithmetic spot-check |

---

## 10. Edge Cases

| Scenario | Expected behaviour |
|----------|-------------------|
| All feeds down (Upstox 401 + NSE blocked) | Error note shown. Last-known LTPs displayed. No crash. |
| Network offline (DevTools → Network → Offline) | `tfetch` times out per AbortController. Error notes shown on each tab. |
| `localStorage` full (quota exceeded) | `LS.set` catches the exception. Position edit fails silently — user sees no confirmation. |
| Upstox returns strike not in `CC_POSITIONS` | Ignored — `applyChain` only matches configured strikes. |
| `ltp = 0` from Upstox | Treated as invalid (`ltp > 0` guard in `applyChain`). Position remains on last-known value. |
| Expiry date in the past | `nextNSEExpiry()` advances to next month's expiry. Days countdown shows negative (never seen in normal operation). |
| PIN entered incorrectly 10× | No lockout. PINs are hashed server-side. Brute force is a local browser attack only. |
| Token contains whitespace | `saveUpstoxToken()` calls `.trim()` before encrypting. Leading/trailing spaces are stripped. |

---

## 11. Failure Scenarios

### Cloudflare Function returns 500
- **Cause:** Unhandled exception in Function code.
- **Symptom:** `tfetch` resolves with a non-ok response. `r.ok` is false. Feed falls through to next tier.
- **Verify:** DevTools Network tab shows the request and 500 response body.

### Upstox API schema change
- **Cause:** Upstox modifies `/v2/option/chain` response structure.
- **Symptom:** `liveCount === 0` despite a valid token. No JS errors — just no LTPs matched.
- **Diagnose:** Add a temporary `console.log(JSON.stringify(rj))` after the Upstox fetch to inspect the raw response shape.

### `nextNSEExpiry()` returns wrong date
- **Symptom:** Upstox returns data but no strikes match (expiry mismatch — Upstox uses ISO date, NSE uses "DD-Mon-YYYY").
- **Diagnose:** Log `expIso` and `expStr` in `loadCC()` and compare against the current Upstox option chain available dates.

### PIN hash mismatch after migration
- **Cause:** User migrates browser profile; `pulse_pin_hash` copied but `pulse_upstox_token_enc` also copied. PIN works, but new device needs Upstox token re-paste (acceptable).
- **Note:** This is expected behaviour — token decryption uses a different salt per device.

---

## 12. Deployment Validation Checklist

Run after every production deploy:

- [ ] `https://pulse.madhukamath.com/` loads (HTTP 200, not from cache — check `cf-cache-status: MISS` or `BYPASS`)
- [ ] PIN gate appears on hard reload
- [ ] `index.html` response has `Cache-Control: no-store`
- [ ] `GET /api/prices?symbols=RELIANCE.NS` returns JSON with a `price` field
- [ ] `GET /api/mf?ids=120503` returns JSON with a `nav` field
- [ ] `GET /api/upstox-options?expiry=2026-01-29` returns `{"error":"No Upstox token saved"}` with HTTP 503 (proves the Function is running)
- [ ] Paste a valid Upstox token → ↻ LTPs → at least one position shows "UPSTOX LIVE"
- [ ] Click ↻ LTPs twice more — positions still show "UPSTOX LIVE" (regression check for the `p.live` fix)
- [ ] Overview tab loads without JS errors in DevTools Console
- [ ] PWA install prompt appears on mobile (or desktop Chrome "Install app" icon in address bar)
