# Pulse Advisory v1.0.0 — Release Notes

**Commit:** `3c93bc7`
**Branch:** `claude/pulse-cc-basket-fix-7epdll`
**Tag:** `v1.0.0-advisory` (local; push manually with `git push origin v1.0.0-advisory`)

---

## What Is New

Pulse Advisory v1 upgrades the CC Basket from a passive LTP scanner into a real-time covered-call decision engine. For every position and every unwritten candidate it now emits a single, numerically grounded recommendation.

### Write Candidates

For each symbol in `CC_UNIVERSE` that has live Upstox data the engine surfaces:

| Field | Description |
|---|---|
| Recommended strike | Highest-LTP CE in the 5–8% OTM band |
| Entry range | ±5% of LTP |
| Chase limit | LTP × 1.10 |
| Stop-loss | LTP × 1.5 (configurable via `CC_CFG.slMultiplier`) |
| Annualised return | `(premLot / capReq) × (365 / dte) × 100` |
| OTM % | Distance from spot to strike |
| Capital required | Spot × lot size |
| Assignment risk | LOW (>6% OTM) / MEDIUM (>3%) / HIGH (≤3%) |
| IV | From `option_greeks.iv` (Upstox v2 schema); "unavailable" if absent or zero |
| Action | `WRITE_NOW` / `WAIT` / `DATA_MISSING` / `RECOMPUTE` |

### Open Position Advisory

For each position held the engine computes:

| Field | Description |
|---|---|
| Premium captured % | `(avg − ltp) / avg × 100` |
| Premium remaining ₹ | Current LTP × qty |
| Remaining annualised yield | `(premRem / capLocked) × (365 / dte) × 100` |
| OTM % | Distance from spot to strike |
| Assignment probability | VERY HIGH (ITM) / HIGH (<2%) / MEDIUM (<5%) / LOW |

Decision precedence (highest wins):

1. **CLOSE** — LTP ≥ SL (stop triggered)
2. **WATCH** — LTP within 10% of SL (monitor closely)
3. **ROLL** — spot within `rollStrikeProximityPct` (default 2%) of strike and DTE > 5
4. **CLOSE** — ≥90% of premium captured (cost of carry exceeds residual)
5. **RECYCLE** — ≥70% captured AND best fresh opportunity annualised return > remaining × 1.5
6. **HOLD** — ≥70% captured but fresh opportunity fails the 1.5× hurdle
7. **EXTEND** — DTE ≤ 5 and not yet worth closing
8. **HOLD** — default

---

## Rules Implemented

| Rule | Code location |
|---|---|
| `p.live` reset before every `loadCC()` | `loadCC()` top |
| `window._upstoxErr` reset before every `loadCC()` | `loadCC()` top |
| `_writeAdv`, `_posAdv` reset before every `loadCC()` | `loadCC()` top |
| Advisory gate: only fires when Upstox chain data is present | `loadCC()`, `Object.keys(chainData).length > 0` |
| Upstox wins all price conflicts | `p.live` flag; Upstox data never overwritten by NSE fallback within one cycle |
| All timestamps in Sydney time | `sydneyNow()` with explicit `timeZone:'Australia/Sydney'` |
| Token never logged or returned | `upstox-options.js` — forwards and discards |
| IV `= 0` treated as unavailable | Server probe and client `ccWriteAdvisory` both apply `> 0` guard |

---

## Configuration (`CC_CFG`)

All thresholds are overridable via `LS.set('cc_cfg', {...})` without redeployment:

| Key | Default | Effect |
|---|---|---|
| `minAnnualisedFloor` | 12 | Minimum % p.a. to emit `WRITE_NOW` |
| `recycleMinCapturedPct` | 70 | Minimum captured % before RECYCLE is considered |
| `recycleYieldAdvantage` | 1.5 | Fresh must exceed remaining × this to trigger RECYCLE |
| `closeRemainingPremiumTinyPct` | 10 | Close when remaining premium < this % of original |
| `rollStrikeProximityPct` | 2 | Roll when spot within this % of strike |
| `stalePriceTolerancePct` | 10 | Warn when Upstox and Yahoo spot diverge beyond this % |
| `slMultiplier` | 1.5 | SL = LTP at write × this multiple |

---

## Known Limitations

1. **No Greeks.** Delta, gamma, vega are not computed. Assignment probability is a simple OTM% rule, not a model-derived figure. This is deliberate — see Upgrade Path.

2. **No volatility analytics.** IV is displayed but not used in any decision. No IV percentile, no IV rank, no skew analysis. Deliberate.

3. **No historical context.** The engine has no memory of prior cycles. RECYCLE compares the current remaining yield against the best current fresh opportunity only — it does not factor in the original trade rationale or market regime.

4. **NSE fallback unreliable from cloud IPs.** The NSE option chain is blocked or rate-limited from Cloudflare egress IPs. Upstox is the only reliable live source. If Upstox data is absent, actions are `DATA_MISSING` rather than falling back to NSE options data.

5. **Single expiry only.** The engine evaluates the nearest NSE expiry computed by `nextNSEExpiry()`. It does not scan multiple expiries or compute a term structure.

6. **OTM band is fixed per symbol.** `minOtmPct` and `maxOtmPct` in `CC_UNIVERSE` are 5–8% for all symbols. Volatility-adjusted OTM selection is a v2 enhancement.

7. **Lot sizes may change.** NSE revises lot sizes periodically. `CC_UNIVERSE` lot values must be verified against the current NSE F&O contract specification before each expiry cycle.

8. **No assignment simulation.** The engine flags assignment risk but does not simulate the P&L impact of assignment (buying back at spot vs. holding shares).

---

## Manual Verification Checklist

Run before declaring any session's recommendations actionable:

- [ ] Upstox token is valid — CC tab shows live LTPs, not `—`
- [ ] Expiry date shown in the CC tab matches the upcoming NSE weekly/monthly expiry
- [ ] Spot prices shown for each symbol are within ±2% of current NSE cash market prices
- [ ] At least one `WRITE_NOW` candidate has OTM% between 5% and 8%
- [ ] SL shown on each write candidate = LTP at write × 1.5 (verify one manually)
- [ ] Sydney timestamp refreshes on each `loadCC()` call
- [ ] `IV unavailable` rows appear only when Upstox `option_greeks` is absent — not for valid IV values
- [ ] RECYCLE recommendations: manually confirm that the fresh opportunity's annualised return genuinely exceeds remaining yield × 1.5 before acting
- [ ] All monetary figures are in INR (₹); no USD/USD-denominated instruments are in scope

---

## Test Suite

**File:** `cc-advisory-tests.js`
**Run:** `node cc-advisory-tests.js`
**Coverage:** 29 assertions across 12 scenarios

| Test | Scenario |
|---|---|
| T1 | WRITE_NOW: sufficient annualised return |
| T2 | WAIT: return below floor |
| T3 | DATA_MISSING: no spot |
| T4 | DATA_MISSING: no strike in OTM band |
| T5 | HOLD: 40% captured, no fresh opportunity |
| T6 | CLOSE: SL breached |
| T7 | ROLL: spot within 2% of strike |
| T8 | RECYCLE: 75%+ captured, fresh 2× remaining |
| T9 | HOLD: 75%+ captured but fresh fails 1.5× hurdle |
| T10 | IV propagated from `option_greeks.iv` |
| T10b | IV null when greeks absent |
| T11 | IV=0 normalised to null |
| T12 | Missing `option_greeks` entirely → IV null |

---

## Upgrade Path — v2

v2 work must not begin until at least three live covered-call cycles have been completed and the v1 recommendations have been manually verified against actual execution outcomes.

See `TODO_v2.md` for the full enhancement backlog.

**Minimum v2 gate:**
- At least 3 expiry cycles completed using v1 recommendations
- RECYCLE decisions validated: did recycled positions outperform held positions?
- ROLL decisions validated: did rolls successfully reduce assignment incidence?
- IV field confirmed present and non-zero in live Upstox responses

Only after this validation should Greeks, Black-Scholes, or IV analytics be introduced.
