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

TOKEN = os.environ.get("UPSTOX_TOKEN", "")

@app.get("/positions")
async def get_positions():
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://api.upstox.com/v2/portfolio/short-term-positions",
            headers={"Authorization": f"Bearer {TOKEN.strip()}", "Accept": "application/json"}
        )
        return r.json()

@app.get("/health")
async def health():
    return {"status": "ok"}
