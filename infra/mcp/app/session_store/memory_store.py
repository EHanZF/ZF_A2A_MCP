from __future__ import annotations
import asyncio
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta, timezone
from .base import SessionStore, SessionRecord, SessionLock


class _MemLock(SessionLock):
    def __init__(self, lock: asyncio.Lock):
        self._lock = lock
    async def __aenter__(self):
        await self._lock.acquire()
        return self
    async def __aexit__(self, exc_type, exc, tb):
        self._lock.release()


class MemorySessionStore(SessionStore):
    def __init__(self):
        self._sessions: Dict[str, SessionRecord] = {}
        self._locks: Dict[str, asyncio.Lock] = {}
        self._global_lock = asyncio.Lock()

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    async def create_session(self, *, session_id, agent_id, capabilities, metadata, tool_contracts, ttl: timedelta) -> SessionRecord:
        now = self._now()
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
        self._sessions[session_id] = rec
        return rec

    async def get_session(self, session_id: str) -> Optional[SessionRecord]:
        rec = self._sessions.get(session_id)
        if rec and rec.expires_at > self._now() and rec.status == "active":
            return rec
        return None

    async def touch(self, session_id: str) -> None:
        rec = self._sessions.get(session_id)
        if rec:
            rec.last_seen = self._now()

    async def attach_ws(self, session_id: str) -> int:
        rec = self._sessions.get(session_id)
        if not rec:
            return 0
        rec.ws_count += 1
        return rec.ws_count

    async def detach_ws(self, session_id: str) -> int:
        rec = self._sessions.get(session_id)
        if not rec:
            return 0
        rec.ws_count = max(0, rec.ws_count - 1)
        return rec.ws_count

    async def end_session(self, session_id: str) -> None:
        rec = self._sessions.get(session_id)
        if rec:
            rec.status = "ended"

    async def set_tool_contracts(self, session_id: str, tool_contracts: Dict[str, Any]) -> None:
        rec = self._sessions.get(session_id)
        if rec:
            rec.tool_contracts = tool_contracts

    async def list_active(self, *, agent_id: Optional[str] = None) -> List[SessionRecord]:
        now = self._now()
        vals = [r for r in self._sessions.values() if r.status == "active" and r.expires_at > now]
        if agent_id:
            vals = [r for r in vals if r.agent_id == agent_id]
        return vals

    def lock(self, key: str, *, ttl: timedelta) -> SessionLock:
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return _MemLock(self._locks[key])
