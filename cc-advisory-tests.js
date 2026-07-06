/**
 * cc-advisory-tests.js
 * Self-contained tests for the CC advisory engine pure functions.
 * Run: node cc-advisory-tests.js
 * Or paste into browser console after loading index.html (functions are global).
 */

/* ── inline copies of pure functions (for Node.js) ── */
const CC_CFG_TEST = {
  minAnnualisedFloor: 12,
  recycleMinCapturedPct: 70,
  recycleYieldAdvantage: 1.5,
  closeRemainingPremiumTinyPct: 10,
  rollStrikeProximityPct: 2,
  stalePriceTolerancePct: 10,
  slMultiplier: 1.5,
};

const CC_UNIVERSE_TEST = {
  HDFCBANK:  { lot: 550, yahooSym: 'HDFCBANK.NS',  minOtmPct: 5, maxOtmPct: 8 },
  MAZDOCK:   { lot: 200, yahooSym: 'MAZDOCK.NS',   minOtmPct: 5, maxOtmPct: 8 },
  RELIANCE:  { lot: 500, yahooSym: 'RELIANCE.NS',  minOtmPct: 5, maxOtmPct: 8 },
  SUNPHARMA: { lot: 350, yahooSym: 'SUNPHARMA.NS', minOtmPct: 5, maxOtmPct: 8 },
};

function ccBestStrike(spot, strikes, minOtmPct, maxOtmPct) {
  if (!strikes || !spot) return null;
  const lo = spot * (1 + minOtmPct / 100), hi = spot * (1 + maxOtmPct / 100);
  let best = null;
  for (const [ks, d] of Object.entries(strikes)) {
    const k = parseFloat(ks);
    if (k < lo || k > hi) continue;
    const ce = d.CE;
    if (!ce || typeof ce.ltp !== 'number' || ce.ltp <= 0) continue;
    if (!best || ce.ltp > best.ltp) best = { strike: k, ltp: ce.ltp, oi: ce.oi || 0, iv: ce.iv ?? null };
  }
  return best;
}

function ccWriteAdvisory(sym, spot, strikes, dte, lot, cfg, secondarySpot) {
  if (!spot || !strikes || dte <= 0) return { sym, action: 'DATA_MISSING', reason: 'No live Upstox data for this symbol' };
  const u = CC_UNIVERSE_TEST[sym]; if (!u) return { sym, action: 'RECOMPUTE', reason: 'Not in CC_UNIVERSE' };
  const best = ccBestStrike(spot, strikes, u.minOtmPct, u.maxOtmPct);
  if (!best) return { sym, action: 'DATA_MISSING', reason: `No liquid CE in ${u.minOtmPct}–${u.maxOtmPct}% OTM band` };
  const otmPct = (best.strike - spot) / spot * 100;
  const premLot = best.ltp * lot;
  const capReq = spot * lot;
  const annRet = (premLot / capReq) * (365 / dte) * 100;
  const sl = Math.round(best.ltp * cfg.slMultiplier * 20) / 20;
  let validation = null;
  if (secondarySpot && Math.abs(secondarySpot - spot) / spot * 100 > cfg.stalePriceTolerancePct)
    validation = `Spot ₹${spot.toFixed(0)} vs Yahoo ₹${secondarySpot.toFixed(0)} — verify`;
  const action = annRet >= cfg.minAnnualisedFloor ? 'WRITE_NOW' : 'WAIT';
  return {
    sym, strike: best.strike, ltp: best.ltp, sl, lot, dte, spot,
    otmPct: otmPct.toFixed(1), premLot: Math.round(premLot), capReq: Math.round(capReq),
    annRet: annRet.toFixed(1), oi: best.oi, iv: best.iv != null ? best.iv.toFixed(1) : null,
    assignRisk: otmPct > 6 ? 'LOW' : otmPct > 3 ? 'MEDIUM' : 'HIGH',
    action, validation,
    reason: `${annRet.toFixed(1)}% ann · ${otmPct.toFixed(1)}% OTM · ₹${Math.round(premLot)} premium/lot · ${dte}d DTE`,
  };
}

function ccPositionAdvisory(p, spot, strikes, dte, cfg, bestFresh) {
  const captPct = Math.max(0, Math.min(100, Math.round((p.avg - p.ltp) / p.avg * 100)));
  const premRem = p.ltp * p.qty;
  const capLocked = (spot || p.strike) * p.qty;
  const remAnn = dte > 0 ? (premRem / capLocked) * (365 / dte) * 100 : 0;
  const otmPct = spot ? (p.strike - spot) / spot * 100 : null;
  const assignProb = otmPct == null ? '—' : otmPct < 0 ? 'VERY HIGH (ITM)' : otmPct < 2 ? 'HIGH' : otmPct < 5 ? 'MEDIUM' : 'LOW';
  let action = 'HOLD', reason = '';
  if (p.ltp >= p.sl) {
    action = 'CLOSE'; reason = `LTP ₹${p.ltp} ≥ SL ₹${p.sl}. Stop triggered.`;
  } else if (p.ltp >= p.sl * 0.90) {
    action = 'WATCH'; reason = `LTP ₹${p.ltp} within 10% of SL ₹${p.sl}. Monitor closely.`;
  } else if (otmPct != null && otmPct >= 0 && otmPct < cfg.rollStrikeProximityPct && dte > 5) {
    action = 'ROLL'; reason = `Spot within ${otmPct.toFixed(1)}% of ${p.strike} strike. Roll out to reduce assignment risk.`;
  } else if (captPct >= (100 - cfg.closeRemainingPremiumTinyPct)) {
    action = 'CLOSE'; reason = `${captPct}% captured — cost of carry exceeds ₹${Math.round(premRem)} remaining.`;
  } else if (captPct >= cfg.recycleMinCapturedPct && bestFresh && bestFresh.action === 'WRITE_NOW') {
    const freshAnn = parseFloat(bestFresh.annRet);
    if (freshAnn > remAnn * cfg.recycleYieldAdvantage) {
      action = 'RECYCLE'; reason = `${captPct}% captured · remaining ${remAnn.toFixed(1)}% ann vs fresh ${freshAnn.toFixed(1)}% (>${cfg.recycleYieldAdvantage}×). Redeploy.`;
    } else {
      action = 'HOLD'; reason = `${captPct}% captured but fresh ${bestFresh.annRet}% fails ${cfg.recycleYieldAdvantage}× hurdle over ${remAnn.toFixed(1)}%. Hold.`;
    }
  } else if (dte <= 5 && captPct < (100 - cfg.closeRemainingPremiumTinyPct)) {
    action = 'EXTEND'; reason = `${dte}d to expiry with ${captPct}% captured. Consider writing next cycle.`;
  } else {
    action = 'HOLD'; reason = `${captPct}% captured · ₹${Math.round(premRem)} remaining · ${remAnn.toFixed(1)}% ann · ${dte}d left.`;
  }
  return { captPct, premRem: Math.round(premRem), remAnn: remAnn.toFixed(1), otmPct: otmPct != null ? otmPct.toFixed(1) : null, assignProb, action, reason };
}

/* ── test harness ── */
let passed = 0, failed = 0;
function test(name, got, expected) {
  if (got === expected) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}\n    expected: ${expected}\n    got:      ${got}`);
    failed++;
  }
}

console.log('\nCC ADVISORY ENGINE — TEST SUITE\n' + '='.repeat(40));

/* T1 — WRITE_NOW: good premium in OTM band, return exceeds floor */
console.log('\nT1 · WRITE_NOW: sufficient annualised return');
{
  // HDFCBANK spot 1800. 5-8% OTM = 1890-1944. Strike 1900 at LTP 24. Ann = (24×550)/(1800×550) × (365/28) × 100 = (13200/990000) × 13.04 × 100 = 17.4%
  const strikes = { '1900': { CE: { ltp: 24, oi: 120000 } }, '2000': { CE: { ltp: 8, oi: 40000 } } };
  const a = ccWriteAdvisory('HDFCBANK', 1800, strikes, 28, 550, CC_CFG_TEST, null);
  test('action', a.action, 'WRITE_NOW');
  test('strike', String(a.strike), '1900');
  const annNum = parseFloat(a.annRet);
  test('annRet >= 12%', String(annNum >= 12), 'true');
  test('otmPct ~ 5.6%', String(parseFloat(a.otmPct) > 5 && parseFloat(a.otmPct) < 6), 'true');
  test('assignRisk LOW (>6% OTM would be LOW, >3% MEDIUM)', a.assignRisk, 'MEDIUM'); // 5.6% OTM is MEDIUM
}

/* T2 — WAIT: premium below annualised floor */
console.log('\nT2 · WAIT: annualised return below floor');
{
  // SUNPHARMA spot 1750. 5-8% OTM = 1838-1890. Strike 1850 at LTP 6. Ann = (6×350)/(1750×350) × (365/28) × 100 = (2100/612500) × 13.04 × 100 = 4.5%
  const strikes = { '1850': { CE: { ltp: 6, oi: 55000 } }, '1900': { CE: { ltp: 3, oi: 22000 } } };
  const a = ccWriteAdvisory('SUNPHARMA', 1750, strikes, 28, 350, CC_CFG_TEST, null);
  test('action', a.action, 'WAIT');
  test('annRet < 12%', String(parseFloat(a.annRet) < 12), 'true');
}

/* T3 — DATA_MISSING: no spot price */
console.log('\nT3 · DATA_MISSING: no live spot from Upstox');
{
  const a = ccWriteAdvisory('HDFCBANK', null, { '1900': { CE: { ltp: 20, oi: 50000 } } }, 25, 550, CC_CFG_TEST, null);
  test('action', a.action, 'DATA_MISSING');
}

/* T4 — DATA_MISSING: no liquid strike in OTM band */
console.log('\nT4 · DATA_MISSING: no strike in 5-8% OTM range');
{
  // Only strikes outside the 5-8% band (spot 1800 → band 1890-1944)
  const strikes = { '1800': { CE: { ltp: 50, oi: 200000 } }, '2100': { CE: { ltp: 5, oi: 10000 } } };
  const a = ccWriteAdvisory('HDFCBANK', 1800, strikes, 28, 550, CC_CFG_TEST, null);
  test('action', a.action, 'DATA_MISSING');
}

/* T5 — HOLD: position too early (40% captured), no compelling fresh opportunity */
console.log('\nT5 · HOLD: early position, 40% captured');
{
  const p = { stock: 'MAZDOCK', strike: 2650, avg: 64.25, ltp: 38.55, qty: 200, sl: 96 };
  // 40% captured: (64.25-38.55)/64.25 = 40%
  const a = ccPositionAdvisory(p, 2500, {}, 18, CC_CFG_TEST, null);
  test('captPct ~ 40%', String(a.captPct), '40');
  test('action', a.action, 'HOLD');
}

/* T6 — CLOSE: SL hit */
console.log('\nT6 · CLOSE: stop loss breached');
{
  const p = { stock: 'HDFCBANK', strike: 1900, avg: 24, ltp: 36.5, qty: 550, sl: 36 };
  // LTP 36.5 >= SL 36
  const a = ccPositionAdvisory(p, 1870, {}, 14, CC_CFG_TEST, null);
  test('action', a.action, 'CLOSE');
  test('reason contains SL', String(a.reason.includes('SL')), 'true');
}

/* T7 — ROLL: spot within 2% of strike */
console.log('\nT7 · ROLL: spot within rollStrikeProximityPct of strike');
{
  // MAZDOCK strike 2460, spot 2415 (1.8% OTM), dte=14 > 5
  const p = { stock: 'MAZDOCK', strike: 2460, avg: 64.25, ltp: 55, qty: 200, sl: 96 };
  const a = ccPositionAdvisory(p, 2415, {}, 14, CC_CFG_TEST, null);
  test('action', a.action, 'ROLL');
  test('assignProb HIGH', a.assignProb, 'HIGH');
}

/* T8 — RECYCLE: 75% captured, fresh opportunity 2× remaining yield */
console.log('\nT8 · RECYCLE: 75%+ captured, fresh >> remaining');
{
  // Position: SUNPHARMA 1800CE sold at 25.50, LTP now 6.375 (75% captured), dte=20
  const p = { stock: 'SUNPHARMA', strike: 1800, avg: 25.50, ltp: 6.375, qty: 350, sl: 38 };
  // premRem = 6.375*350 = 2231. capLocked = 1750*350 = 612500. remAnn = (2231/612500)*(365/20)*100 = 6.65%
  // bestFresh annRet must be > 6.65 * 1.5 = 9.975%. Let's say 16% → qualifies
  const bestFresh = { sym: 'HDFCBANK', strike: 1900, ltp: 22, annRet: '16.0', action: 'WRITE_NOW' };
  const a = ccPositionAdvisory(p, 1750, {}, 20, CC_CFG_TEST, bestFresh);
  test('captPct >= 70', String(a.captPct >= 70), 'true');
  test('action', a.action, 'RECYCLE');
  test('reason mentions >', String(a.reason.includes('>')), 'true');
}

/* T9 — HOLD: 75% captured but fresh yield below 1.5× hurdle */
console.log('\nT9 · HOLD: 75%+ captured but fresh fails hurdle');
{
  // Same position as T8 but bestFresh only has 8% annRet < 6.65*1.5=9.975
  const p = { stock: 'SUNPHARMA', strike: 1800, avg: 25.50, ltp: 6.375, qty: 350, sl: 38 };
  const bestFresh = { sym: 'HDFCBANK', strike: 1900, ltp: 14, annRet: '8.0', action: 'WRITE_NOW' };
  const a = ccPositionAdvisory(p, 1750, {}, 20, CC_CFG_TEST, bestFresh);
  test('captPct >= 70', String(a.captPct >= 70), 'true');
  test('action', a.action, 'HOLD');
  test('reason mentions fails hurdle', String(a.reason.includes('hurdle')), 'true');
}

/* T10 — IV propagated from chain data to advisory output */
console.log('\nT10 · IV propagated: Upstox iv field flows through to advisory');
{
  // Strike includes iv=32.5 from Upstox market_data
  const strikes = { '1900': { CE: { ltp: 24, oi: 120000, prevClose: 22, iv: 32.5 } } };
  const a = ccWriteAdvisory('HDFCBANK', 1800, strikes, 28, 550, CC_CFG_TEST, null);
  test('iv present', String(a.iv != null), 'true');
  test('iv value', String(a.iv), '32.5');
}

/* ── summary ── */
console.log('\n' + '='.repeat(40));
console.log(`RESULTS: ${passed} passed · ${failed} failed`);
if (failed > 0) {
  console.error('SELF-TEST FAILED — review failures above before deploying');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
}
