# Pulse Advisory v2 — Post-Validation Enhancement Backlog

**Status:** LOCKED — do not begin any item here until the v2 gate in `RELEASE_NOTES_v1.0.0.md` is cleared.

**Gate:** ≥3 live expiry cycles completed; v1 RECYCLE, ROLL, and HOLD outcomes manually validated against actual execution results.

---

## Enhancements

### 1. Delta / Black-Scholes

Introduce a proper options pricing model to replace the OTM%-based heuristics currently used for assignment probability and strike selection.

- Compute delta for each candidate CE using Black-Scholes (spot, strike, r, T, σ)
- Use delta as the assignment probability surrogate (delta of a call ≈ probability of expiring ITM under risk-neutral measure)
- Replace fixed OTM band (5–8%) with a delta-band target (e.g., 0.15–0.25 delta)
- Show delta on each write candidate card

**Prerequisite:** IV must be confirmed as reliably present in live Upstox responses across at least 3 cycles before delta can be computed.

---

### 2. IV Analytics

Analyse implied volatility to assess option richness and inform strike/timing decisions.

- IV percentile (relative to rolling 30/60/90-day history stored in localStorage)
- IV rank (current IV vs 52-week range)
- IV trend (rising vs. falling) as a WAIT/WRITE signal: prefer writing when IV is elevated
- Surface "IV rich" / "IV cheap" label on each write candidate

**Prerequisite:** IV must be confirmed present and non-zero in live Upstox `option_greeks` across multiple cycles. Build the history store before computing percentiles.

---

### 3. Assignment Probability Model

Replace the current OTM%-bucket heuristic (LOW/MEDIUM/HIGH) with a model-derived figure.

- Use Black-Scholes `N(d2)` as the risk-neutral probability of assignment
- Display as a percentage (e.g., "18% assignment probability") rather than a label
- Feed into ROLL decision: trigger ROLL when assignment probability exceeds a threshold (e.g., 30%) rather than relying on fixed OTM% proximity

---

### 4. Volatility History Store

Build a rolling IV history in localStorage to support IV analytics.

- On each `loadCC()` call, append the current IV for each symbol to a history array in `LS.get('cc_iv_history', {})`
- Cap to 90 data points per symbol to avoid unbounded localStorage growth
- Expose `ivPct(sym)` helper: returns IV percentile over the stored window
- Use `ivPct` in the WRITE_NOW / WAIT decision: if IV < 25th percentile, downgrade to WAIT regardless of annualised return floor

---

### 5. Portfolio Optimisation Enhancements

Improve capital allocation across multiple simultaneous write candidates.

- When multiple WRITE_NOW candidates exist, rank by risk-adjusted yield: `annRet / assignmentProbability`
- Surface a "portfolio view" showing total premium income, total capital deployed, and weighted average annualised return across all active positions + proposed writes
- RECYCLE decision: factor in portfolio-level capital concentration — do not recycle into the same symbol if it already represents >40% of deployed capital
- Cross-symbol correlation awareness: flag when two WRITE_NOW candidates are in the same sector (requires a sector map in `CC_UNIVERSE`)

---

## Non-Goals for v2

These remain out of scope indefinitely:

- Automatic order placement via Upstox Orders API
- Real-time WebSocket streaming (keep polling on refresh)
- Server-side state or database
- Multi-user support
- Any change to the AES-256-GCM / PBKDF2 security model
