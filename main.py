from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import httpx
import os

app = FastAPI()

app.add_middleware(
CORSMiddleware,
allow_origins=[”*”],
allow_methods=[”*”],
allow_headers=[”*”],
)

TOKEN = os.environ.get(“UPSTOX_TOKEN”, “eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiIyMjEzMzgiLCJqdGkiOiI2OWZhODdmYTA3YzlmYTFmZjhkYTI5NzMiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6dHJ1ZSwiaXNFeHRlbmRlZCI6dHJ1ZSwiaWF0IjoxNzc4MDI2NDkwLCJpc3MiOiJ1ZGFwaS1nYXRld2F5LXNlcnZpY2UiLCJleHAiOjE4MDk2NDA4MDB9.Hexx8mI8Hj8HTKcYd8-zzKnXyIY25X6-X8wo56EQyvk”)

@app.get(”/positions”)
async def get_positions():
async with httpx.AsyncClient() as client:
r = await client.get(
“https://api.upstox.com/v2/portfolio/short-term-positions”,
headers={“Authorization”: f”Bearer {TOKEN}”, “Accept”: “application/json”}
)
return r.json()

@app.get(”/health”)
async def health():
return {“status”: “ok”}
