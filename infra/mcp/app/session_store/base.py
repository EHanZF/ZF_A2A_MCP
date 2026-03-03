from __future__ import annotations
from typing import Any, Dict, List, Optional, AsyncIterator, Protocol
from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass
class SessionRecord:
    session_id: str
    agent_id: str
    capabilities: List[str]
    metadata: Dict[str, Any]
    tool_contracts: Dict[str, Any]
    created_at: datetime
    expires_at: datetime
    last_seen: datetime
    ws_count: int
    status: str  # "active" | "ended"


class SessionLock(Protocol):
    async def __aenter__(self) -> "SessionLock": ...
    async def __aexit__(self, exc_type, exc, tb) -> None: ...


class SessionStore(Protocol):
    async def create_session(
        self,
        *,
        session_id: str,
        agent_id: str,
        capabilities: List[str],
        metadata: Dict[str, Any],
        tool_contracts: Dict[str, Any],
        ttl: timedelta,
    ) -> SessionRecord: ...

    async def get_session(self, session_id: str) -> Optional[SessionRecord]: ...

    async def touch(self, session_id: str) -> None: ...

    async def attach_ws(self, session_id: str) -> int: ...
    async def detach_ws(self, session_id: str) -> int: ...

    async def end_session(self, session_id: str) -> None: ...

    async def set_tool_contracts(self, session_id: str, tool_contracts: Dict[str, Any]) -> None: ...
    async def list_active(self, *, agent_id: Optional[str] = None) -> List[SessionRecord]: ...

    # Concurrency guards
    def lock(self, key: str, *, ttl: timedelta) -> SessionLock: ...
