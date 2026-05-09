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

SYMBOLS = {
    "HDFCBANK": "NSE_EQ|INE040A01034",
    "ICICIBANK": "NSE_EQ|INE090A01021",
    "INFY": "NSE_EQ|INE009A01021",
    "MAZDOCK": "NSE_EQ|INE249A01024",
    "RELIANCE": "NSE_EQ|INE002A01018",
    "TATAMOTORS": "NSE_EQ|INE155A01022",
    "SUNPHARMA": "NSE_EQ|INE044A01036",
    "HAL": "NSE_EQ|INE066F01012",
    "ONGC": "NSE_EQ|INE213A01029",
    "POWERGRID": "NSE_EQ|INE752E01010",
    "SCI": "NSE_EQ|INE109A01011",
}

@app.get("/prices")
async def get_prices():
    keys = ",".join(SYMBOLS.values())
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"https://api.upstox.com/v2/market-quote/ltp?instrument_key={keys}",
            headers={"Authorization": f"Bearer {TOKEN}", "Accept": "application/json"}
        )
        return r.json()

@app.get("/health")
async def health():
    return {"status": "ok"}
