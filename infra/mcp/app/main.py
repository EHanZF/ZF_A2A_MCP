# infra/mcp/app/main.py
from __future__ import annotations
import os
import uuid
import json
from pathlib import Path
from datetime import timedelta
from typing import Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from schemas import HandshakeRequest, HandshakeResponse, MCPMessage
from session_store.base import SessionStore
from session_store.memory_store import MemorySessionStore

# Optional backends
SESSION_BACKEND = os.getenv("SESSION_BACKEND", "memory").lower()  # "redis"|"postgres"|"memory"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
POSTGRES_DSN = os.getenv("POSTGRES_DSN", "")
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "3600"))
TOOL_CONTRACT_DIR = Path(os.getenv("TOOL_CONTRACT_DIR", "/app/tool_contracts"))

app = FastAPI(title="MCP Server", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Choose store at startup
store: SessionStore = MemorySessionStore()

def load_tool_contracts() -> Dict[str, Any]:
    contracts: Dict[str, Any] = {}
    if not TOOL_CONTRACT_DIR.exists():
        return contracts
    for p in TOOL_CONTRACT_DIR.glob("*.json"):
        try:
            with open(p) as f:
                data = json.load(f)
                contracts[data["name"]] = data
        except Exception as e:
            print(f"Failed to load tool contract {p}: {e}")
    return contracts

@app.on_event("startup")
async def on_startup():
    global store
    ttl = timedelta(seconds=SESSION_TTL_SECONDS)
    if SESSION_BACKEND == "redis":
        from session_store.redis_store import RedisSessionStore
        store = RedisSessionStore(REDIS_URL, default_ttl=ttl)
        print("Session backend: Redis")
    elif SESSION_BACKEND == "postgres":
        from session_store.pg_store import PostgresSessionStore
        pg = PostgresSessionStore(POSTGRES_DSN, default_ttl=ttl)
        await pg.connect()
        await pg.migrate()
        store = pg
        print("Session backend: Postgres")
    else:
        store = MemorySessionStore()
        print("Session backend: Memory")

@app.post("/api/agents/handshake", response_model=HandshakeResponse)
async def agent_handshake(req: HandshakeRequest):
    # Validate bearer token here if needed

    session_id = f"sess_{uuid.uuid4().hex}"
    tool_contracts = load_tool_contracts()
    await store.create_session(
        session_id=session_id,
        agent_id=req.agent_id,
        capabilities=req.capabilities,
        metadata=req.metadata or {},
        tool_contracts=tool_contracts,
        ttl=timedelta(seconds=SESSION_TTL_SECONDS),
    )
    ws_url = f"/api/ws/{session_id}"
    return HandshakeResponse(session_id=session_id, ws_url=ws_url, tool_contracts=tool_contracts)

@app.websocket("/api/ws/{session_id}")
async def ws_channel(ws: WebSocket, session_id: str):
    await ws.accept()

    rec = await store.get_session(session_id)
    if not rec:
        await ws.send_json({"error": "Invalid or expired session"})
        await ws.close()
        return

    await store.attach_ws(session_id)

    try:
        # Optionally send a ready message
        await ws.send_json({"type": "ready", "session_id": session_id})

        while True:
            raw = await ws.receive_text()
            try:
                msg = MCPMessage.model_validate_json(raw)
            except Exception as e:
                await ws.send_json({"error": f"Schema error: {e}"})
                continue

            # Refresh liveness
            await store.touch(session_id)

            # TODO: route tools/message handling here
            await ws.send_json({"type": "ack", "session_id": session_id, "received": msg.model_dump()})

    except WebSocketDisconnect:
        pass
    finally:
        await store.detach_ws(session_id)
