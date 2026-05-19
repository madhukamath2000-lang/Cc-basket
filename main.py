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
TD_KEY = "1f0743aac84a43b6b1c8f893a603cbd3"

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

# CURRENT CC POSITIONS - Updated May 18 2026
# Two expiry cycles open simultaneously
CC_OPTIONS = [
    # MAY 26 2026 EXPIRY
    {"symbol":"ICICIBANK",  "strike":1280, "underlying":"NSE_EQ|INE090A01021", "avg":10.95, "qty":700, "sl":24,  "sl_amt":16800, "expiry":"2026-05-26"},
    {"symbol":"MAZDOCK",    "strike":2700, "underlying":"NSE_EQ|INE249A01024", "avg":83.05, "qty":200, "sl":105, "sl_amt":21000, "expiry":"2026-05-26"},
    {"symbol":"RELIANCE",   "strike":1420, "underlying":"NSE_EQ|INE002A01018", "avg":12.05, "qty":500, "sl":25,  "sl_amt":12500, "expiry":"2026-05-26"},
    {"symbol":"SUNPHARMA",  "strike":1940, "underlying":"NSE_EQ|INE044A01036", "avg":11.10, "qty":350, "sl":22,  "sl_amt":7700,  "expiry":"2026-05-26"},
    # JUNE 30 2026 EXPIRY
    {"symbol":"HDFCBANK",   "strike":800,  "underlying":"NSE_EQ|INE040A01034", "avg":16.15, "qty":550, "sl":24,  "sl_amt":13200, "expiry":"2026-06-30"},
    {"symbol":"ICICIBANK",  "strike":1300, "underlying":"NSE_EQ|INE090A01021", "avg":24.45, "qty":700, "sl":24,  "sl_amt":16800, "expiry":"2026-06-30"},
    {"symbol":"RELIANCE",   "strike":1420, "underlying":"NSE_EQ|INE002A01018", "avg":29.50, "qty":500, "sl":25,  "sl_amt":12500, "expiry":"2026-06-30"},
    {"symbol":"TATAMOTORS", "strike":360,  "underlying":"NSE_EQ|INE155A01022", "avg":12.25, "qty":800, "sl":15,  "sl_amt":12000, "expiry":"2026-06-30"},
]

CC_CLOSED = [
    {"symbol":"INFY", "strike":1160, "avg":21.15, "qty":400, "pnl":-6060, "expiry":"2026-06-30"},
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
                    f"?instrument_key={opt['underlying']}&expiry_date={opt['expiry']}",
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

            pnl = round((opt["avg"] - ltp) * opt["qty"], 2) if ltp else None
            results.append({
                "symbol":  opt["symbol"],
                "strike":  opt["strike"],
                "expiry":  opt["expiry"],
                "avg":     opt["avg"],
                "qty":     opt["qty"],
                "sl":      opt["sl"],
                "sl_amt":  opt["sl_amt"],
                "ltp":     ltp,
                "pnl":     pnl,
                "status":  "open",
                "error":   error,
            })

    for c in CC_CLOSED:
        results.append({
            "symbol":  c["symbol"],
            "strike":  c["strike"],
            "expiry":  c["expiry"],
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
        "total_pnl": total_pnl,
        "data":      results,
    }
@app.get("/markets")
async def get_markets():
    try:
        results = {}
        async with httpx.AsyncClient(timeout=15) as client:
            symbols = "XAU/USD,XAG/USD,USD/INR,AUD/INR,DXY,UKOIL"
            r = await client.get(
                f"https://api.twelvedata.com/price?symbol={symbols}&apikey={TD_KEY}"
            )
            data = r.json()
            results["xauusd"] = float(data["XAU/USD"]["price"])
            results["xagusd"] = float(data["XAG/USD"]["price"])
            results["usdinr"] = float(data["USD/INR"]["price"])
            results["audinr"] = float(data["AUD/INR"]["price"])
            results["dxy"]    = float(data["DXY"]["price"])
            results["brent"]  = float(data["UKOIL"]["price"])
        return {"status": "success", "data": results}
    except Exception as e:
        return {"status": "error", "message": str(e)}
