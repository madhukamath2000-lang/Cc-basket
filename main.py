from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TOKEN = os.environ.get("UPSTOX_TOKEN", "").strip()
EXPIRY = "2026-05-26"

EQUITY_SYMBOLS = {
    "HDFCBANK":   "NSE_EQ|INE040A01034",
    "ICICIBANK":  "NSE_EQ|INE090A01021",
    "INFY":       "NSE_EQ|INE009A01021",
    "MAZDOCK":    "NSE_EQ|INE249A01024",
    "RELIANCE":   "NSE_EQ|INE002A01018",
    "TATAMOTORS": "NSE_EQ|INE155A01022",
    "SUNPHARMA":  "NSE_EQ|INE044A01036",
    "HAL":        "NSE_EQ|INE066F01012",
    "ONGC":       "NSE_EQ|INE213A01029",
    "POWERGRID":  "NSE_EQ|INE752E01010",
    "SCI":        "NSE_EQ|INE109A01011",
}

# Active CC positions — update each cycle
CC_OPTIONS = [
    {"symbol": "HDFCBANK",   "strike": 800,  "underlying": "NSE_EQ|INE040A01034", "avg": 17.25, "qty": 550, "sl": 24,  "sl_amt": 13200},
    {"symbol": "INFY",       "strike": 1230, "underlying": "NSE_EQ|INE009A01021", "avg": 24.05, "qty": 400, "sl": 36,  "sl_amt": 14400},
    {"symbol": "MAZDOCK",    "strike": 2700, "underlying": "NSE_EQ|INE249A01024", "avg": 83.05, "qty": 200, "sl": 105, "sl_amt": 21000},
   {"symbol": "ICICIBANK", "strike": 1280, "underlying": "NSE_EQ|INE090A01021", "avg": 10.95, "qty": 700, "sl": 24, "sl_amt": 16800},
   {"symbol": "SUNPHARMA", "strike": 1860, "underlying": "NSE_EQ|INE044A01036", "avg": 19.35, "qty": 350, "sl": 22, "sl_amt": 7700},
    {"symbol": "TATAMOTORS", "strike": 370,  "underlying": "NSE_EQ|INE155A01022", "avg": 10.30, "qty": 800, "sl": 15,  "sl_amt": 12000},
]

# Closed this cycle — locked P&L
CC_CLOSED = [
    {"symbol": "RELIANCE", "strike": 1500, "avg": 15.60, "qty": 500, "pnl": 5900},
]

def headers():
    return {"Authorization": f"Bearer {TOKEN}", "Accept": "application/json"}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/prices")
async def get_prices():
    keys = ",".join(EQUITY_SYMBOLS.values())
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"https://api.upstox.com/v2/market-quote/ltp?instrument_key={keys}",
            headers=headers()
        )
        return r.json()

@app.get("/options")
async def get_options():
    results = []
    async with httpx.AsyncClient(timeout=15) as client:
        for opt in CC_OPTIONS:
            ltp = None
            error = None
            try:
                r = await client.get(
                    f"https://api.upstox.com/v2/option/chain"
                    f"?instrument_key={opt['underlying']}&expiry_date={EXPIRY}",
                    headers=headers()
                )
                data = r.json()
                if data.get("status") == "success":
                    for row in data["data"]:
                        if float(row["strike_price"]) == float(opt["strike"]):
                            ltp = row["call_options"]["market_data"]["ltp"]
                            break
            except Exception as e:
                error = str(e)

            pnl = round((opt["avg"] - (ltp or opt["avg"])) * opt["qty"], 2) if ltp else None
            results.append({
                "symbol":    opt["symbol"],
                "strike":    opt["strike"],
                "avg":       opt["avg"],
                "qty":       opt["qty"],
                "sl":        opt["sl"],
                "sl_amt":    opt["sl_amt"],
                "ltp":       ltp,
                "pnl":       pnl,
                "status":    "open",
                "error":     error,
            })

    # Add closed positions
    for c in CC_CLOSED:
        results.append({
            "symbol":  c["symbol"],
            "strike":  c["strike"],
            "avg":     c["avg"],
            "qty":     0,
            "sl":      None,
            "sl_amt":  0,
            "ltp":     None,
            "pnl":     c["pnl"],
            "status":  "closed",
            "error":   None,
        })

    total_pnl = sum(r["pnl"] for r in results if r["pnl"] is not None)

    return {
        "status":    "success",
        "expiry":    EXPIRY,
        "total_pnl": total_pnl,
        "data":      results,
    }
