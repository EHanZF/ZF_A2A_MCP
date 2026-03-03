from __future__ import annotations
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta, timezone
import asyncpg
import json
import zlib
from .base import SessionStore, SessionRecord, SessionLock

def _now() -> datetime:
    return datetime.now(timezone.utc)

def _lock_key(key: str) -> int:
    # derive a 31-bit hash for advisory locks
    return zlib.adler32(key.encode("utf-8")) & 0x7FFFFFFF

class _PgLock(SessionLock):
    def __init__(self, pool: asyncpg.Pool, key: str, ttl: timedelta):
        self.pool = pool
        self.key = _lock_key(key)
        self._conn: Optional[asyncpg.Connection] = None

    async def __aenter__(self):
        self._conn = await self.pool.acquire()
        await self._conn.execute("SELECT pg_advisory_lock($1);", self.key)
        return self

    async def __aexit__(self, exc_type, exc, tb):
        try:
            await self._conn.execute("SELECT pg_advisory_unlock($1);", self.key)
        finally:
            await self.pool.release(self._conn)
            self._conn = None


class PostgresSessionStore(SessionStore):
    def __init__(self, dsn: str, *, default_ttl: timedelta):
        self.dsn = dsn
        self.default_ttl = default_ttl
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        if not self.pool:
            self.pool = await asyncpg.create_pool(dsn=self.dsn, min_size=1, max_size=10)

    async def migrate(self):
        sql = """
        CREATE TABLE IF NOT EXISTS mcp_sessions (
            session_id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            capabilities JSONB NOT NULL,
            metadata JSONB NOT NULL,
            tool_contracts JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            last_seen TIMESTAMPTZ NOT NULL,
            ws_count INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active'
        );
        CREATE INDEX IF NOT EXISTS idx_mcp_sessions_active
          ON mcp_sessions (expires_at) WHERE status = 'active';

        CREATE TABLE IF NOT EXISTS mcp_ws_channels (
            connection_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES mcp_sessions(session_id) ON DELETE CASCADE,
            connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
        async with self.pool.acquire() as conn:
            for stmt in sql.split(";"):
                s = stmt.strip()
                if s:
                    await conn.execute(s + ";")

    async def create_session(self, *, session_id, agent_id, capabilities, metadata, tool_contracts, ttl: timedelta) -> SessionRecord:
        await self.connect()
        now = _now()
        expires = now + ttl
        async with self.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO mcp_sessions (session_id, agent_id, capabilities, metadata, tool_contracts, created_at, expires_at, last_seen, ws_count, status)
                VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $6, 0, 'active')
                ON CONFLICT (session_id) DO UPDATE
                SET agent_id = EXCLUDED.agent_id,
                    capabilities = EXCLUDED.capabilities,
                    metadata = EXCLUDED.metadata,
                    tool_contracts = EXCLUDED.tool_contracts,
                    expires_at = EXCLUDED.expires_at,
                    last_seen = EXCLUDED.last_seen,
                    status = 'active';
            """, session_id, agent_id, json.dumps(capabilities), json.dumps(metadata or {}), json.dumps(tool_contracts or {}), now, expires)
        return SessionRecord(
            session_id=session_id,
            agent_id=agent_id,
            capabilities=capabilities,
            metadata=metadata or {},
            tool_contracts=tool_contracts or {},
            created_at=now,
            expires_at=expires,
            last_seen=now,
            ws_count=0,
            status="active",
        )

    async def get_session(self, session_id: str) -> Optional[SessionRecord]:
        await self.connect()
        row = await self.pool.fetchrow("""
            SELECT session_id, agent_id, capabilities, metadata, tool_contracts, created_at, expires_at, last_seen, ws_count, status
            FROM mcp_sessions
            WHERE session_id = $1 AND status = 'active' AND expires_at > NOW();
        """, session_id)
        if not row:
            return None
        return SessionRecord(
            session_id=row["session_id"],
            agent_id=row["agent_id"],
            capabilities=row["capabilities"],
            metadata=row["metadata"],
            tool_contracts=row["tool_contracts"],
            created_at=row["created_at"],
            expires_at=row["expires_at"],
            last_seen=row["last_seen"],
            ws_count=row["ws_count"],
            status=row["status"],
        )

    async def touch(self, session_id: str) -> None:
        await self.connect()
        await self.pool.execute("UPDATE mcp_sessions SET last_seen = NOW() WHERE session_id = $1;", session_id)

    async def attach_ws(self, session_id: str) -> int:
        await self.connect()
        async with self.lock(f"ws:{session_id}", ttl=timedelta(seconds=5)):
            await self.pool.execute("""
                UPDATE mcp_sessions SET ws_count = ws_count + 1 WHERE session_id = $1;
            """, session_id)
            row = await self.pool.fetchrow("SELECT ws_count FROM mcp_sessions WHERE session_id = $1;", session_id)
            return row["ws_count"] if row else 0

    async def detach_ws(self, session_id: str) -> int:
        await self.connect()
        async with self.lock(f"ws:{session_id}", ttl=timedelta(seconds=5)):
            await self.pool.execute("""
                UPDATE mcp_sessions SET ws_count = GREATEST(0, ws_count - 1) WHERE session_id = $1;
            """, session_id)
            row = await self.pool.fetchrow("SELECT ws_count FROM mcp_sessions WHERE session_id = $1;", session_id)
            return row["ws_count"] if row else 0

    async def end_session(self, session_id: str) -> None:
        await self.connect()
        await self.pool.execute("UPDATE mcp_sessions SET status = 'ended' WHERE session_id = $1;", session_id)

    async def set_tool_contracts(self, session_id: str, tool_contracts: Dict[str, Any]) -> None:
        await self.connect()
        await self.pool.execute("""
            UPDATE mcp_sessions SET tool_contracts = $2::jsonb WHERE session_id = $1;
        """, session_id, json.dumps(tool_contracts or {}))

    async def list_active(self, *, agent_id: Optional[str] = None) -> List[SessionRecord]:
        await self.connect()
        if agent_id:
            rows = await self.pool.fetch("""
                SELECT session_id, agent_id, capabilities, metadata, tool_contracts, created_at, expires_at, last_seen, ws_count, status
                FROM mcp_sessions
                WHERE status = 'active' AND expires_at > NOW() AND agent_id = $1
                ORDER BY created_at DESC;
            """, agent_id)
        else:
            rows = await self.pool.fetch("""
                SELECT session_id, agent_id, capabilities, metadata, tool_contracts, created_at, expires_at, last_seen, ws_count, status
                FROM mcp_sessions
                WHERE status = 'active' AND expires_at > NOW()
                ORDER BY created_at DESC;
            """)
        out: List[SessionRecord] = []
        for r in rows:
            out.append(SessionRecord(
                session_id=r["session_id"],
                agent_id=r["agent_id"],
                capabilities=r["capabilities"],
                metadata=r["metadata"],
                tool_contracts=r["tool_contracts"],
                created_at=r["created_at"],
                expires_at=r["expires_at"],
                last_seen=r["last_seen"],
                ws_count=r["ws_count"],
                status=r["status"],
            ))
        return out

    def lock(self, key: str, *, ttl: timedelta) -> SessionLock:
        # TTL is not enforced by advisory locks; used only for Redis. Here it's ignored.
        assert self.pool is not None
        return _PgLock(self.pool, key, ttl)
