from __future__ import annotations
import asyncio
import json
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta, timezone
import redis.asyncio as aioredis

from .base import SessionStore, SessionRecord, SessionLock

SESSION_KEY = "mcp:sessions:{sid}"
SESSION_INDEX = "mcp:sessions:index"        # sorted set by expires_at
LOCK_KEY = "mcp:lock:{key}"

def _now() -> datetime:
    return datetime.now(timezone.utc)

def _ts(dt: datetime) -> float:
    return dt.timestamp()

class _RedisLock(SessionLock):
    def __init__(self, r: aioredis.Redis, key: str, ttl: timedelta):
        self.r = r
        self.key = LOCK_KEY.format(key=key)
        self.ttl_ms = int(ttl.total_seconds() * 1000)
        self._token = None

    async def __aenter__(self):
        token = str(id(self))
        while True:
            ok = await self.r.set(self.key, token, nx=True, px=self.ttl_ms)
            if ok:
                self._token = token
                return self
            await asyncio.sleep(0.02)

    async def __aexit__(self, exc_type, exc, tb):
        # Best-effort unlock (no lua compare-del needed for template simplicity)
        try:
            await self.r.delete(self.key)
        except Exception:
            pass


class RedisSessionStore(SessionStore):
    def __init__(self, redis_url: str, *, default_ttl: timedelta):
        self.r = aioredis.from_url(redis_url, encoding="utf-8", decode_responses=True)
        self.default_ttl = default_ttl

    def _k(self, sid: str) -> str:
        return SESSION_KEY.format(sid=sid)

    async def create_session(self, *, session_id, agent_id, capabilities, metadata, tool_contracts, ttl: timedelta) -> SessionRecord:
        now = _now()
        rec = SessionRecord(
            session_id=session_id,
            agent_id=agent_id,
            capabilities=capabilities,
            metadata=metadata or {},
            tool_contracts=tool_contracts or {},
            created_at=now,
            expires_at=now + ttl,
            last_seen=now,
            ws_count=0,
            status="active",
        )
        payload = {
            "session_id": rec.session_id,
            "agent_id": rec.agent_id,
            "capabilities": rec.capabilities,
            "metadata": rec.metadata,
            "tool_contracts": rec.tool_contracts,
            "created_at": rec.created_at.isoformat(),
            "expires_at": rec.expires_at.isoformat(),
            "last_seen": rec.last_seen.isoformat(),
            "ws_count": rec.ws_count,
            "status": rec.status,
        }
        key = self._k(session_id)
        p = self.r.pipeline()
        p.hset(key, mapping={"data": json.dumps(payload)})
        p.expireat(key, int(_ts(rec.expires_at)))
        p.zadd(SESSION_INDEX, {session_id: _ts(rec.expires_at)})
        await p.execute()
        return rec

    async def _load(self, session_id: str) -> Optional[SessionRecord]:
        raw = await self.r.hget(self._k(session_id), "data")
        if not raw:
            return None
        data = json.loads(raw)
        now = _now()
        if data["status"] != "active":
            return None
        expires_at = datetime.fromisoformat(data["expires_at"])
        if expires_at <= now:
            return None
        # parse
        return SessionRecord(
            session_id=data["session_id"],
            agent_id=data["agent_id"],
            capabilities=data["capabilities"],
            metadata=data["metadata"],
            tool_contracts=data["tool_contracts"],
            created_at=datetime.fromisoformat(data["created_at"]),
            expires_at=expires_at,
            last_seen=datetime.fromisoformat(data["last_seen"]),
            ws_count=int(data["ws_count"]),
            status=data["status"],
        )

    async def get_session(self, session_id: str) -> Optional[SessionRecord]:
        return await self._load(session_id)

    async def touch(self, session_id: str) -> None:
        rec = await self._load(session_id)
        if not rec:
            return
        rec.last_seen = _now()
        await self.r.hset(self._k(session_id), "data", json.dumps({
            **rec.__dict__,
            "created_at": rec.created_at.isoformat(),
            "expires_at": rec.expires_at.isoformat(),
            "last_seen": rec.last_seen.isoformat(),
        }))

    async def attach_ws(self, session_id: str) -> int:
        async with self.lock(f"ws:{session_id}", ttl=timedelta(seconds=5)):
            rec = await self._load(session_id)
            if not rec:
                return 0
            rec.ws_count += 1
            await self.r.hset(self._k(session_id), "data", json.dumps({
                **rec.__dict__,
                "created_at": rec.created_at.isoformat(),
                "expires_at": rec.expires_at.isoformat(),
                "last_seen": rec.last_seen.isoformat(),
            }))
            return rec.ws_count

    async def detach_ws(self, session_id: str) -> int:
        async with self.lock(f"ws:{session_id}", ttl=timedelta(seconds=5)):
            rec = await self._load(session_id)
            if not rec:
                return 0
            rec.ws_count = max(0, rec.ws_count - 1)
            await self.r.hset(self._k(session_id), "data", json.dumps({
                **rec.__dict__,
                "created_at": rec.created_at.isoformat(),
                "expires_at": rec.expires_at.isoformat(),
                "last_seen": rec.last_seen.isoformat(),
            }))
            return rec.ws_count

    async def end_session(self, session_id: str) -> None:
        rec = await self._load(session_id)
        if not rec:
            return
        rec.status = "ended"
        await self.r.hset(self._k(session_id), "data", json.dumps({
            **rec.__dict__,
            "created_at": rec.created_at.isoformat(),
            "expires_at": rec.expires_at.isoformat(),
            "last_seen": rec.last_seen.isoformat(),
        }))

    async def set_tool_contracts(self, session_id: str, tool_contracts: Dict[str, Any]) -> None:
        rec = await self._load(session_id)
        if not rec:
            return
        rec.tool_contracts = tool_contracts
        await self.r.hset(self._k(session_id), "data", json.dumps({
            **rec.__dict__,
            "created_at": rec.created_at.isoformat(),
            "expires_at": rec.expires_at.isoformat(),
            "last_seen": rec.last_seen.isoformat(),
        }))

    async def list_active(self, *, agent_id: Optional[str] = None) -> List[SessionRecord]:
        # naive scan: in production you might maintain agent-based sets
        ids = await self.r.zrangebyscore(SESSION_INDEX, min=_ts(_now()), max="+inf")
        out: List[SessionRecord] = []
        for sid in ids:
            rec = await self._load(sid)
            if not rec:
                continue
            if agent_id and rec.agent_id != agent_id:
                continue
            out.append(rec)
        return out

    def lock(self, key: str, *, ttl: timedelta) -> SessionLock:
        return _RedisLock(self.r, key, ttl)
